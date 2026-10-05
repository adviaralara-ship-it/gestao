import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Download, Building, Loader2, DollarSign, Calendar, TrendingUp, TrendingDown, CheckCircle2, History, AlertCircle, ShieldAlert } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format, parseISO, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function Relatorios() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [condominios, setCondominios] = useState([])
  const [selectedCondominio, setSelectedCondominio] = useState(user?.role === 'Síndico' ? user.condominio : (user?.condominio || 'Todos'))
  const [mes, setMes] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [tipoRelatorio, setTipoRelatorio] = useState('financeiro') // 'financeiro' ou 'operacional'
  const [loading, setLoading] = useState(false)
  const [downloadingMes, setDownloadingMes] = useState(null)

  // Gerar lista dos últimos 12 meses para o histórico rápido
  const ultimos12Meses = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(new Date(), i)
    return {
      valor: format(d, 'yyyy-MM'),
      label: format(d, 'MMMM yyyy', { locale: ptBR }),
      mesAnoFormatado: format(d, 'MM/yyyy')
    }
  })

  // Buscar lista de condomínios
  useEffect(() => {
    async function fetchCondominios() {
      try {
        const snap = await getDocs(collection(db, 'condominios'))
        const list = snap.docs.map(d => d.data().nome).filter(Boolean)
        setCondominios(list)
        if (user?.role !== 'Administrador' && user?.condominio) {
          setSelectedCondominio(user.condominio)
        }
      } catch (err) {
        console.error("Erro ao carregar condomínios:", err)
      }
    }
    fetchCondominios()
  }, [user])

  // Função para gerar Relatório Financeiro (Receitas & Despesas)
  const gerarRelatorioFinanceiro = async (mesAlvo = mes, condoAlvo = selectedCondominio) => {
    setLoading(true)
    try {
      const filtroCondominio = condoAlvo === 'Todos' ? null : condoAlvo
      const [anoStr, mesStr] = mesAlvo.split('-')

      // Buscar Lançamentos Financeiros
      const snapFin = await getDocs(collection(db, 'financeiro_lancamentos'))
      let lancamentos = snapFin.docs.map(d => ({ id: d.id, ...d.data() }))

      // Buscar Boletos
      const snapBol = await getDocs(collection(db, 'boletos'))
      let boletos = snapBol.docs.map(d => ({ id: d.id, ...d.data() }))

      // Buscar Rateio de Água do Mês
      const snapAgua = await getDocs(collection(db, 'rateios_agua'))
      let rateiosAgua = snapAgua.docs.map(d => ({ id: d.id, ...d.data() }))

      // Filtro de condomínio
      if (filtroCondominio) {
        lancamentos = lancamentos.filter(l => !l.condominio || l.condominio === filtroCondominio)
        boletos = boletos.filter(b => !b.condominio || b.condominio === filtroCondominio)
        rateiosAgua = rateiosAgua.filter(r => !r.condominio || r.condominio.toLowerCase().includes(filtroCondominio.toLowerCase()) || filtroCondominio.toLowerCase().includes(r.condominio.toLowerCase()))
      }

      // Identifica o rateio de água específico daquele mês
      const rateioAguaMes = rateiosAgua.find(r => r.competencia === mesAlvo)

      // Filtro de mês para Lançamentos
      lancamentos = lancamentos.filter(l => {
        let dStr = l.data || ''
        if (!dStr && l._createdAt?.seconds) {
          dStr = new Date(l._createdAt.seconds * 1000).toISOString()
        }
        return dStr.startsWith(`${anoStr}-${mesStr}`)
      })

      // Filtro de mês para Boletos (vencimento ou pagamento)
      boletos = boletos.filter(b => {
        let dStr = b.vencimento || b.data || ''
        if (!dStr && b._createdAt?.seconds) {
          dStr = new Date(b._createdAt.seconds * 1000).toISOString()
        }
        return dStr.startsWith(`${anoStr}-${mesStr}`)
      })

      // Separar Receitas e Despesas
      const despesas = lancamentos.filter(l => l.tipo === 'Despesa')
      const receitasLancadas = lancamentos.filter(l => l.tipo === 'Receita')

      // Total de Boletos Pagos vs Pendentes
      const boletosPagos = boletos.filter(b => b.status === 'Pago')
      const boletosPendentes = boletos.filter(b => b.status === 'Pendente' || b.status === 'Vencido')

      const totalBoletosPagos = boletosPagos.reduce((acc, b) => acc + (parseFloat(b.valor) || 0), 0)
      const totalBoletosPendentes = boletosPendentes.reduce((acc, b) => acc + (parseFloat(b.valor) || 0), 0)
      const totalReceitasExtras = receitasLancadas.reduce((acc, r) => acc + (parseFloat(r.valor) || 0), 0)
      const totalReceitas = totalBoletosPagos + totalReceitasExtras
      const totalDespesas = despesas.reduce((acc, d) => acc + (parseFloat(d.valor) || 0), 0)
      const saldoMes = totalReceitas - totalDespesas

      // --- GERAR PDF ---
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.width

      // Cabeçalho
      doc.setFillColor(26, 43, 78)
      doc.rect(0, 0, pageWidth, 28, 'F')
      doc.setFontSize(18)
      doc.setTextColor(255, 255, 255)
      doc.text('Prestação de Contas & Relatório Financeiro', pageWidth / 2, 12, { align: 'center' })
      doc.setFontSize(11)
      doc.setTextColor(200, 220, 255)
      doc.text(`Condomínio: ${filtroCondominio || 'Todos os Condomínios'}  |  Mês de Referência: ${mesStr}/${anoStr}`, pageWidth / 2, 20, { align: 'center' })

      let startY = 36

      // Quadro Resumo Balanço
      doc.setFontSize(13)
      doc.setTextColor(26, 43, 78)
      doc.text('1. Demonstrativo Sintético do Mês', 14, startY)

      autoTable(doc, {
        startY: startY + 4,
        head: [['Total Receitas Arrecadadas', 'Total de Despesas Pagas', 'Saldo Operacional do Mês', 'Inadimplência em Aberto']],
        body: [[
          `R$ ${totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          `R$ ${totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          `R$ ${saldoMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          `R$ ${totalBoletosPendentes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        ]],
        theme: 'grid',
        headStyles: { fillColor: [26, 43, 78], halign: 'center', fontSize: 9 },
        bodyStyles: { halign: 'center', fontStyle: 'bold', fontSize: 10, textColor: [30, 41, 59] }
      })

      startY = doc.lastAutoTable.finalY + 12

      // Tabela de Despesas Detalhadas
      doc.setFontSize(13)
      doc.setTextColor(26, 43, 78)
      doc.text('2. Discriminação de Despesas', 14, startY)

      if (despesas.length === 0) {
        doc.setFontSize(10)
        doc.setTextColor(120)
        doc.text('Nenhuma despesa registrada para este período.', 14, startY + 8)
        startY += 16
      } else {
        autoTable(doc, {
          startY: startY + 4,
          head: [['Data', 'Categoria', 'Descrição / Fornecedor', 'Status', 'Valor (R$)']],
          body: despesas.map(d => [
            d.data ? format(parseISO(d.data), 'dd/MM/yyyy') : '-',
            d.categoria || 'Geral',
            d.descricao || '-',
            d.status || 'Pago',
            `R$ ${(parseFloat(d.valor) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
          ]),
          theme: 'striped',
          headStyles: { fillColor: [185, 28, 28] },
          styles: { fontSize: 8 },
          columnStyles: { 4: { halign: 'right', fontStyle: 'bold' } }
        })
        startY = doc.lastAutoTable.finalY + 12
      }

      // Tabela de Receitas Detalhadas
      if (startY > 230) { doc.addPage(); startY = 20; }
      doc.setFontSize(13)
      doc.setTextColor(26, 43, 78)
      doc.text('3. Discriminação de Receitas & Taxas Condominiais', 14, startY)

      const receitasBody = [
        ...boletosPagos.slice(0, 100).map(b => [
          b.vencimento ? format(parseISO(b.vencimento), 'dd/MM/yyyy') : '-',
          'Taxa Condominial',
          `Unidade ${b.unidade || b.apt || '-'} - ${b.moradorNome || 'Morador'}`,
          'Recebido',
          `R$ ${(parseFloat(b.valor) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        ]),
        ...receitasLancadas.map(r => [
          r.data ? format(parseISO(r.data), 'dd/MM/yyyy') : '-',
          r.categoria || 'Outras Receitas',
          r.descricao || '-',
          r.status || 'Recebido',
          `R$ ${(parseFloat(r.valor) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        ])
      ]

      if (receitasBody.length === 0) {
        doc.setFontSize(10)
        doc.setTextColor(120)
        doc.text('Nenhuma receita registrada para este período.', 14, startY + 8)
      } else {
        autoTable(doc, {
          startY: startY + 4,
          head: [['Data', 'Categoria', 'Descrição / Origem', 'Status', 'Valor (R$)']],
          body: receitasBody,
          theme: 'striped',
          headStyles: { fillColor: [16, 110, 80] },
          styles: { fontSize: 8 },
          columnStyles: { 4: { halign: 'right', fontStyle: 'bold' } }
        })
      }

      // Seção 4: Demonstrativo e Rateio Individualizado de Água por Hidrômetro (se houver medição registrada)
      if (rateioAguaMes && Array.isArray(rateioAguaMes.linhas) && rateioAguaMes.linhas.length > 0) {
        doc.addPage()
        let aguaStartY = 20

        doc.setFontSize(13)
        doc.setTextColor(14, 116, 144) // Azul ciano
        doc.text(`4. Demonstrativo e Rateio de Água por Hidrômetro — ${rateioAguaMes.condominio || filtroCondominio || 'Condomínio'}`, 14, aguaStartY)

        doc.setFontSize(9)
        doc.setTextColor(71, 85, 105)
        const subAgua = `Fatura Total da Concessionária: R$ ${(parseFloat(rateioAguaMes.valorTotalConta) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | Consumo Medido Total: ${rateioAguaMes.consumoTotalM3 || 0} m³ | Excesso Total: ${rateioAguaMes.excessoTotalM3 || 0} m³`
        doc.text(subAgua, 14, aguaStartY + 6)

        const aguaBody = rateioAguaMes.linhas.map(l => [
          String(l.apt || '-'),
          l.morador || '-',
          l.vinculo || 'Proprietário',
          `${l.leituraAnterior !== undefined && l.leituraAnterior !== '' ? l.leituraAnterior : '-'} m³`,
          `${l.leituraAtual !== undefined && l.leituraAtual !== '' ? l.leituraAtual : '-'} m³`,
          `${l.consumoM3 || 0} m³`,
          `${l.excessoM3 || 0} m³`,
          `R$ ${(parseFloat(l.valorRateio) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          l.observacao || '-'
        ])

        autoTable(doc, {
          startY: aguaStartY + 10,
          head: [['Apto', 'Morador / Pagador', 'Vínculo', 'Leit. Ant.', 'Leit. Atual', 'Consumo', 'Excesso', 'Valor (R$)', 'Obs']],
          body: aguaBody,
          theme: 'striped',
          headStyles: { fillColor: [8, 145, 178], fontSize: 8 },
          styles: { fontSize: 8, halign: 'center' },
          columnStyles: { 
            0: { fontStyle: 'bold' },
            1: { halign: 'left' },
            7: { halign: 'right', fontStyle: 'bold', textColor: [4, 120, 87] }
          }
        })
      }

      // Rodapé
      const totalPages = doc.internal.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(140)
        doc.text(
          `Documento gerado automaticamente pelo Sistema Alpha Soluções Condominiais em ${format(new Date(), 'dd/MM/yyyy HH:mm')} - Página ${i} de ${totalPages}`,
          pageWidth / 2,
          doc.internal.pageSize.height - 8,
          { align: 'center' }
        )
      }

      doc.save(`Relatorio_Financeiro_${filtroCondominio || 'Geral'}_${mesAlvo}.pdf`)
    } catch (err) {
      console.error(err)
      alert("Erro ao gerar relatório financeiro. Tente novamente.")
    } finally {
      setLoading(false)
      setDownloadingMes(null)
    }
  }

  // Função para gerar Relatório Operacional de Atividades
  const gerarRelatorioOperacional = async (mesAlvo = mes, condoAlvo = selectedCondominio) => {
    setLoading(true)
    try {
      const isAdm = user?.role === 'Administrador'
      const filtroCondominio = condoAlvo === 'Todos' ? null : condoAlvo
      const [anoAlvo, mesAlvoStr] = mesAlvo.split('-')

      const fetchAndFilter = async (colName) => {
        const snap = await getDocs(collection(db, colName))
        let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))

        if (filtroCondominio) {
          docs = docs.filter(d => d.condominio === filtroCondominio || !d.condominio)
        }

        docs = docs.filter(d => {
          let dateStr = ''
          if (d.data && typeof d.data === 'string' && d.data.includes('-')) {
            dateStr = d.data
          } else if (d._createdAt?.seconds) {
            dateStr = new Date(d._createdAt.seconds * 1000).toISOString()
          } else {
            return true
          }
          return dateStr.startsWith(`${anoAlvo}-${mesAlvoStr}`)
        })

        return docs
      }

      let ocorrencias = await fetchAndFilter('ocorrencias')
      let tarefas = await fetchAndFilter('tarefas')
      let reservas = await fetchAndFilter('reservas')
      let visitantes = await fetchAndFilter('visitantes')
      let portaria = await fetchAndFilter('portaria')
      let encomendas = await fetchAndFilter('encomendas')

      if (!isAdm) {
        ocorrencias = ocorrencias.filter(o => o.visibilidade !== 'Apenas Adm')
        tarefas = tarefas.filter(t => t.visibilidade !== 'Apenas Adm')
        visitantes = visitantes.filter(v => v.visibilidade !== 'Apenas Adm')
        portaria = portaria.filter(p => p.visibilidade !== 'Apenas Adm')
        encomendas = encomendas.filter(e => e.visibilidade !== 'Apenas Adm')
      }

      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.width

      doc.setFillColor(26, 43, 78)
      doc.rect(0, 0, pageWidth, 28, 'F')
      doc.setFontSize(18)
      doc.setTextColor(255, 255, 255)
      doc.text('Relatório Operacional de Atividades', pageWidth / 2, 12, { align: 'center' })
      doc.setFontSize(11)
      doc.setTextColor(200, 220, 255)
      doc.text(`Condomínio: ${filtroCondominio || 'Todos os Condomínios'}  |  Mês de Referência: ${mesAlvoStr}/${anoAlvo}`, pageWidth / 2, 20, { align: 'center' })

      let startY = 36

      const totalOcorrencias = ocorrencias.length
      const solucionadas = ocorrencias.filter(o => o.status === 'Resolvida' || o.status === 'Solucionada' || o.status === 'Fechada').length
      const abertas = totalOcorrencias - solucionadas

      doc.setFontSize(13)
      doc.setTextColor(26, 43, 78)
      doc.text('Resumo Operacional', 14, startY)
      autoTable(doc, {
        startY: startY + 4,
        head: [['Total Ocorrências', 'Solucionadas', 'Em Andamento', 'Reservas de Áreas', 'Tarefas & Manutenções']],
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
      startY = doc.lastAutoTable.finalY + 12

      if (ocorrencias.length > 0) {
        doc.setFontSize(13)
        doc.setTextColor(26, 43, 78)
        doc.text('Ocorrências do Período', 14, startY)
        autoTable(doc, {
          startY: startY + 4,
          head: [['Data', 'Unidade', 'Categoria', 'Título', 'Status', 'Prioridade']],
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
          styles: { fontSize: 8 }
        })
        startY = doc.lastAutoTable.finalY + 12
      }

      if (reservas.length > 0) {
        if (startY > 240) { doc.addPage(); startY = 20; }
        doc.setFontSize(13)
        doc.setTextColor(26, 43, 78)
        doc.text('Reservas de Áreas Comuns', 14, startY)
        autoTable(doc, {
          startY: startY + 4,
          head: [['Data', 'Espaço', 'Morador Responsável', 'Unidade', 'Status']],
          body: reservas.map(r => [
            r.data || '-',
            r.area || r.espaco || '-',
            r.morador || r.nome || '-',
            r.apt || r.unidade || '-',
            r.status || '-'
          ]),
          theme: 'striped',
          headStyles: { fillColor: [0, 106, 102] },
          styles: { fontSize: 8 }
        })
        startY = doc.lastAutoTable.finalY + 12
      }

      const totalPages = doc.internal.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(140)
        doc.text(
          `Documento gerado automaticamente pelo Sistema Alpha Soluções Condominiais em ${format(new Date(), 'dd/MM/yyyy HH:mm')} - Página ${i} de ${totalPages}`,
          pageWidth / 2,
          doc.internal.pageSize.height - 8,
          { align: 'center' }
        )
      }

      doc.save(`Relatorio_Operacional_${filtroCondominio || 'Geral'}_${mesAlvo}.pdf`)
    } catch (err) {
      console.error(err)
      alert("Erro ao gerar relatório operacional. Tente novamente.")
    } finally {
      setLoading(false)
      setDownloadingMes(null)
    }
  }

  const handleDownloadPersonalizado = () => {
    if (tipoRelatorio === 'financeiro') {
      gerarRelatorioFinanceiro(mes, selectedCondominio)
    } else {
      gerarRelatorioOperacional(mes, selectedCondominio)
    }
  }

  const handleDownloadMesHistorico = (mesValor, tipo) => {
    setDownloadingMes(`${mesValor}_${tipo}`)
    if (tipo === 'financeiro') {
      gerarRelatorioFinanceiro(mesValor, selectedCondominio)
    } else {
      gerarRelatorioOperacional(mesValor, selectedCondominio)
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-5xl mx-auto pb-10">
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="section-title text-2xl font-black bg-gradient-to-r from-brand-700 to-brand-500 bg-clip-text text-transparent">
            Central de Relatórios & Prestação de Contas
          </h2>
          <p className="text-gray-600 font-medium text-sm">
            Consulte e baixe relatórios mensais completos de receitas, despesas, balanços e atividades operacionais.
          </p>
        </div>
        <button
          onClick={() => navigate('/seguranca')}
          className="btn-secondary bg-red-50 text-red-700 border-red-200 hover:bg-red-100 flex items-center gap-1.5 font-bold shadow-xs whitespace-nowrap"
          title="Acessar histórico de backups, restaurações e alarmes de segurança"
        >
          <ShieldAlert size={16} className="text-red-600" /> Segurança & Backups
        </button>
      </div>

      {/* Card 1: Gerador Personalizado */}
      <div className="card flex flex-col gap-6 border border-pale-300 shadow-md">
        <div className="flex items-center justify-between border-b border-pale-200 pb-4">
          <div className="flex items-center gap-3 text-brand-700">
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center border border-brand-200">
              <FileText size={22} className="text-brand-700" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-900">Exportar Relatório sob Demanda</h3>
              <p className="text-xs text-gray-500">Escolha o condomínio, o mês e o tipo de demonstrativo</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label font-bold text-gray-700">Tipo de Relatório</label>
            <select
              className="input font-medium"
              value={tipoRelatorio}
              onChange={e => setTipoRelatorio(e.target.value)}
            >
              <option value="financeiro">💰 Financeiro (Receitas & Despesas)</option>
              <option value="operacional">📋 Operacional (Atividades & Ocorrências)</option>
            </select>
          </div>

          <div>
            <label className="label font-bold text-gray-700">Mês de Referência</label>
            <input 
              type="month" 
              className="input font-medium" 
              value={mes} 
              onChange={e => setMes(e.target.value)} 
            />
          </div>

          <div>
            <label className="label font-bold text-gray-700">Condomínio</label>
            {user?.role === 'Administrador' ? (
              <select 
                className="input font-medium" 
                value={selectedCondominio} 
                onChange={e => setSelectedCondominio(e.target.value)}
              >
                <option value="Todos">Todos (Visão Global)</option>
                {condominios.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            ) : (
              <div className="input bg-gray-100 text-gray-700 font-semibold cursor-not-allowed flex items-center gap-2">
                <Building size={16} className="text-gray-500" />
                {user?.condominio || 'Condomínio Principal'}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-pale-200 pt-4 mt-2">
          <span className="text-xs text-gray-500 flex items-center gap-1.5">
            <CheckCircle2 size={16} className="text-emerald-600" />
            Arquivo gerado em formato PDF oficial com assinatura Alpha
          </span>
          <button 
            onClick={handleDownloadPersonalizado} 
            disabled={loading || !mes}
            className="btn-primary flex items-center gap-2 px-6 py-2.5 shadow-md"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            {loading ? 'Gerando Relatório...' : 'Baixar Relatório PDF'}
          </button>
        </div>
      </div>

      {/* Card 2: Histórico Rápido dos Últimos 12 Meses */}
      <div className="card flex flex-col gap-4 border border-pale-300 shadow-md">
        <div className="flex items-center justify-between border-b border-pale-200 pb-3">
          <div className="flex items-center gap-3 text-brand-700">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-200">
              <History size={20} className="text-emerald-700" />
            </div>
            <div>
              <h3 className="font-bold text-base text-gray-900">Histórico de Prestação de Contas (Últimos 12 Meses)</h3>
              <p className="text-xs text-gray-500">
                Acesse e baixe com 1 clique o histórico financeiro e operacional do condomínio: {selectedCondominio || 'Geral'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
          {ultimos12Meses.map((m, idx) => {
            const isDownloadingFin = downloadingMes === `${m.valor}_financeiro`
            const isDownloadingOp = downloadingMes === `${m.valor}_operacional`

            return (
              <div 
                key={m.valor} 
                className="flex flex-col justify-between p-3.5 rounded-xl border border-gray-200 bg-white hover:border-brand-400 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-brand-600" />
                    <span className="font-bold text-sm text-gray-800 capitalize">
                      {m.label}
                    </span>
                  </div>
                  {idx === 0 && (
                    <span className="text-[10px] bg-brand-100 text-brand-800 font-bold px-2 py-0.5 rounded-full">
                      Mês Atual
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownloadMesHistorico(m.valor, 'financeiro')}
                    disabled={loading}
                    title="Baixar Receitas & Despesas deste mês"
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 transition-colors"
                  >
                    {isDownloadingFin ? <Loader2 size={13} className="animate-spin" /> : <TrendingUp size={13} />}
                    <span>💰 Receitas/Despesas</span>
                  </button>

                  <button
                    onClick={() => handleDownloadMesHistorico(m.valor, 'operacional')}
                    disabled={loading}
                    title="Baixar Atividades e Ocorrências deste mês"
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold border border-blue-200 transition-colors"
                  >
                    {isDownloadingOp ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                    <span>📋 Atividades</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
