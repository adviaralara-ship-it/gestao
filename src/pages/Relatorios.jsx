import React, { useState, useEffect } from 'react'
import { FileText, Download, Building, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format, parseISO } from 'date-fns'

export default function Relatorios() {
  const { user } = useAuth()
  const [condominios, setCondominios] = useState([])
  const [selectedCondominio, setSelectedCondominio] = useState(user?.role === 'Síndico' ? user.condominio : 'Todos')
  const [mes, setMes] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [loading, setLoading] = useState(false)

  // Buscar lista de condomínios
  useEffect(() => {
    async function fetchCondominios() {
      const snap = await getDocs(collection(db, 'condominios'))
      const list = snap.docs.map(d => d.data().nome).filter(Boolean)
      setCondominios(list)
    }
    fetchCondominios()
  }, [])

  const gerarRelatorio = async () => {
    setLoading(true)
    try {
      const isAdm = user?.role === 'Administrador'
      const filtroCondominio = selectedCondominio === 'Todos' ? null : selectedCondominio

      // Funções auxiliares para buscar dados e filtrar
      const fetchAndFilter = async (colName, dateField = '_createdAt') => {
        const snap = await getDocs(collection(db, colName))
        let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))

        // Filtro de Condomínio
        if (filtroCondominio) {
          docs = docs.filter(d => d.condominio === filtroCondominio || !d.condominio)
        }

        // Filtro de Mês (usamos o campo de data se existir, ou _createdAt)
        const [anoAlvo, mesAlvo] = mes.split('-')
        docs = docs.filter(d => {
          let dateStr = ''
          if (d.data && typeof d.data === 'string' && d.data.includes('-')) {
            dateStr = d.data // YYYY-MM-DD
          } else if (d._createdAt?.seconds) {
            const dateObj = new Date(d._createdAt.seconds * 1000)
            dateStr = dateObj.toISOString()
          } else {
            return true // Se não tiver data, inclui
          }
          const [ano, mes] = dateStr.split('-')
          return ano === anoAlvo && mes === mesAlvo
        })

        return docs
      }

      // Buscar os dados
      let ocorrencias = await fetchAndFilter('ocorrencias')
      let tarefas = await fetchAndFilter('tarefas')
      let reservas = await fetchAndFilter('reservas')
      let visitantes = await fetchAndFilter('visitantes')
      let portaria = await fetchAndFilter('portaria') // Para Manutenções/Registros
      let encomendas = await fetchAndFilter('encomendas')

      // Filtro de Visibilidade para Síndicos/Moradores
      if (!isAdm) {
        ocorrencias = ocorrencias.filter(o => o.visibilidade !== 'Apenas Adm')
        tarefas = tarefas.filter(t => t.visibilidade !== 'Apenas Adm')
        visitantes = visitantes.filter(v => v.visibilidade !== 'Apenas Adm')
        portaria = portaria.filter(p => p.visibilidade !== 'Apenas Adm')
        encomendas = encomendas.filter(e => e.visibilidade !== 'Apenas Adm')
      }

      // --- GERAR PDF ---
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.width
      
      // Cabeçalho
      doc.setFontSize(20)
      doc.setTextColor(3, 22, 56) // primary color
      doc.text('Relatório Mensal de Atividades', pageWidth / 2, 20, { align: 'center' })
      
      doc.setFontSize(12)
      doc.setTextColor(100)
      doc.text(`Mês Referência: ${mes.split('-').reverse().join('/')}`, pageWidth / 2, 28, { align: 'center' })
      doc.text(`Condomínio: ${selectedCondominio}`, pageWidth / 2, 34, { align: 'center' })

      let startY = 45

      // NOVO: Quadro Resumo
      const totalOcorrencias = ocorrencias.length
      const solucionadas = ocorrencias.filter(o => o.status === 'Resolvida' || o.status === 'Solucionada' || o.status === 'Fechada').length
      const abertas = totalOcorrencias - solucionadas

      doc.setFontSize(14)
      doc.setTextColor(3, 22, 56)
      doc.text('Resumo Geral (Dashboard)', 14, startY)
      autoTable(doc, {
        startY: startY + 5,
        head: [['Total de Ocorrências', 'Solucionadas', 'Em Andamento / Abertas', 'Total Reservas', 'Total Tarefas']],
        body: [[
          totalOcorrencias.toString(),
          solucionadas.toString(),
          abertas.toString(),
          reservas.length.toString(),
          tarefas.length.toString()
        ]],
        theme: 'grid',
        headStyles: { fillColor: [26, 43, 78], halign: 'center' },
        bodyStyles: { halign: 'center', fontStyle: 'bold' }
      })
      startY = doc.lastAutoTable.finalY + 15

      // 1. Ocorrências
      if (ocorrencias.length > 0) {
        doc.setFontSize(14)
        doc.setTextColor(3, 22, 56)
        doc.text('Ocorrências', 14, startY)
        autoTable(doc, {
          startY: startY + 5,
          head: [['Data', 'Apt', 'Categoria', 'Título', 'Status', 'Prioridade']],
          body: ocorrencias.map(o => [
            o.data || format(new Date(o._createdAt?.seconds * 1000 || Date.now()), 'dd/MM/yyyy'),
            o.apt || '-',
            o.categoria || '-',
            o.titulo || '-',
            o.status || '-',
            o.prioridade || '-'
          ]),
          theme: 'striped',
          headStyles: { fillColor: [26, 43, 78] },
          styles: { fontSize: 9 }
        })
        startY = doc.lastAutoTable.finalY + 15
      }

      // 2. Tarefas e Manutenções
      if (tarefas.length > 0 || portaria.length > 0) {
        if (startY > 250) { doc.addPage(); startY = 20; }
        doc.setFontSize(14)
        doc.setTextColor(3, 22, 56)
        doc.text('Tarefas e Manutenções', 14, startY)
        
        const combinedTasks = [
          ...tarefas.map(t => ({ source: 'Tarefa', title: t.titulo, status: t.status || t.etapa, responsible: t.responsavel, date: t.prazo })),
          ...portaria.map(p => ({ source: 'Portaria/Manutenção', title: p.descricao || p.titulo, status: p.status, responsible: p.porteiro || p.responsavel, date: p.data }))
        ].filter(i => i.title)

        autoTable(doc, {
          startY: startY + 5,
          head: [['Tipo', 'Data', 'Descrição', 'Responsável', 'Status']],
          body: combinedTasks.map(t => [
            t.source,
            t.date || '-',
            t.title || '-',
            t.responsible || '-',
            t.status || '-'
          ]),
          theme: 'striped',
          headStyles: { fillColor: [0, 106, 102] },
          styles: { fontSize: 9 }
        })
        startY = doc.lastAutoTable.finalY + 15
      }

      // 3. Agendamentos nas Áreas (Reservas)
      if (reservas.length > 0) {
        if (startY > 250) { doc.addPage(); startY = 20; }
        doc.setFontSize(14)
        doc.setTextColor(3, 22, 56)
        doc.text('Agendamentos nas Áreas', 14, startY)
        autoTable(doc, {
          startY: startY + 5,
          head: [['Data', 'Área', 'Morador', 'Apt', 'Status']],
          body: reservas.map(r => [
            r.data || '-',
            r.area || r.espaco || '-',
            r.morador || r.nome || '-',
            r.apt || r.unidade || '-',
            r.status || '-'
          ]),
          theme: 'striped',
          headStyles: { fillColor: [26, 43, 78] },
          styles: { fontSize: 9 }
        })
        startY = doc.lastAutoTable.finalY + 15
      }

      // 4. Visitantes
      if (visitantes.length > 0) {
        if (startY > 250) { doc.addPage(); startY = 20; }
        doc.setFontSize(14)
        doc.setTextColor(3, 22, 56)
        doc.text('Visitantes Cadastrados', 14, startY)
        autoTable(doc, {
          startY: startY + 5,
          head: [['Data', 'Nome', 'Apt Destino', 'Autorizado Por']],
          body: visitantes.map(v => [
            v.data || format(new Date(v._createdAt?.seconds * 1000 || Date.now()), 'dd/MM/yyyy'),
            v.nome || '-',
            v.apt || v.unidade || '-',
            v.moradorNome || v.autorizadoPor || v.morador || '-'
          ]),
          theme: 'striped',
          headStyles: { fillColor: [0, 106, 102] },
          styles: { fontSize: 9 }
        })
        startY = doc.lastAutoTable.finalY + 15
      }

      // 5. Encomendas
      if (encomendas.length > 0) {
        if (startY > 250) { doc.addPage(); startY = 20; }
        doc.setFontSize(14)
        doc.setTextColor(3, 22, 56)
        doc.text('Encomendas Recebidas', 14, startY)
        autoTable(doc, {
          startY: startY + 5,
          head: [['Data', 'Morador / Destino', 'Descrição', 'Status']],
          body: encomendas.map(e => [
            e.dataRecebimento ? format(parseISO(e.dataRecebimento), 'dd/MM/yyyy') : format(new Date(e._createdAt?.seconds * 1000 || Date.now()), 'dd/MM/yyyy'),
            `${e.morador || '-'} (Apt ${e.apt || '-'})`,
            e.descricao || '-',
            e.status || '-'
          ]),
          theme: 'striped',
          headStyles: { fillColor: [26, 43, 78] },
          styles: { fontSize: 9 }
        })
        startY = doc.lastAutoTable.finalY + 15
      }

      doc.save(`Relatorio_Mensal_${selectedCondominio}_${mes}.pdf`)

    } catch (err) {
      console.error(err)
      alert("Erro ao gerar relatório. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-4xl mx-auto">
      <div className="page-header">
        <div>
          <h2 className="section-title text-xl">Relatórios</h2>
          <p className="section-sub">Gere um relatório mensal unificado das atividades do condomínio.</p>
        </div>
      </div>

      <div className="card flex flex-col gap-6">
        <div className="flex items-center gap-3 text-brand-700">
          <FileText size={24} />
          <h3 className="font-bold text-lg">Configurar Relatório</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="label">Mês de Referência</label>
            <input 
              type="month" 
              className="input" 
              value={mes} 
              onChange={e => setMes(e.target.value)} 
            />
          </div>

          <div>
            <label className="label">Condomínio</label>
            {user?.role === 'Administrador' ? (
              <select 
                className="input" 
                value={selectedCondominio} 
                onChange={e => setSelectedCondominio(e.target.value)}
              >
                <option value="Todos">Todos (Visão Global)</option>
                {condominios.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            ) : (
              <div className="input bg-gray-50 text-gray-500 cursor-not-allowed">
                {user.condominio || 'Não vinculado'}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-cream-300 pt-6">
          <p className="text-sm text-gray-500 mb-4">
            O relatório será exportado em PDF contendo as seguintes informações filtradas para o mês selecionado:
            <br/><br/>
            • <b>Ocorrências:</b> Status e prioridade<br/>
            • <b>Tarefas e Manutenções:</b> Andamentos e responsáveis<br/>
            • <b>Agendamentos:</b> Reservas de áreas comuns<br/>
            • <b>Visitantes:</b> Cadastros realizados no mês e por quem foi autorizado<br/>
            • <b>Encomendas:</b> Pacotes recebidos para cada morador/unidade
            <br/><br/>
            <i>{user?.role !== 'Administrador' && "⚠️ Notas e ocorrências internas da administradora não serão incluídas neste documento."}</i>
          </p>

          <button 
            onClick={gerarRelatorio} 
            disabled={loading || !mes || (!selectedCondominio && user?.role !== 'Administrador')}
            className="btn-primary w-full md:w-auto"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            {loading ? 'Processando Dados...' : 'Baixar Relatório PDF'}
          </button>
        </div>
      </div>
    </div>
  )
}
