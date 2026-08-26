import React, { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { Search, Edit2, Trash2, Download } from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function Historico({ lancamentos, setModalLanc, deleteLancamento, updateLancamento }) {
  const { user } = useAuth()
  const isMorador = user?.role === 'Morador'
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('Todos')
  const [mesFiltro, setMesFiltro] = useState('')

  const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const statusBadge = (s) => ({ Recebido: 'badge-green', Pago: 'badge-blue', Pendente: 'badge-yellow', 'Aguardando Aprovação': 'bg-orange-100 text-orange-800 px-2 py-0.5 rounded text-[10px] font-bold border border-orange-200' }[s] || 'badge-blue')

  const filtered = lancamentos.filter(t => {
    const matchSearch = (t.descricao || '').toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'Todos' || t.tipo === filter
    const matchMes = mesFiltro === '' || t.data?.startsWith(mesFiltro)
    return matchSearch && matchFilter && matchMes
  }).sort((a, b) => new Date(b.data) - new Date(a.data)) // Ordenar do mais recente para o mais antigo

  const totalReceitas = filtered.filter(t => t.tipo === 'Receita').reduce((acc, curr) => acc + Number(curr.valor || 0), 0)
  const totalDespesas = filtered.filter(t => t.tipo === 'Despesa').reduce((acc, curr) => acc + Number(curr.valor || 0), 0)
  const saldoTotal = totalReceitas - totalDespesas

  
  const gerarBalancete = () => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.width
    
    doc.setFontSize(20)
    doc.setTextColor(3, 22, 56)
    doc.text('Balancete Discriminado de Transparencia', pageWidth / 2, 20, { align: 'center' })
    
    doc.setFontSize(14)
    doc.setTextColor(100)
    doc.text(`Mes de Referencia: ${mesFiltro ? mesFiltro.split('-').reverse().join('/') : 'Historico Geral'}`, pageWidth / 2, 30, { align: 'center' })
    
    doc.setFontSize(12)
    doc.setTextColor(50)
    doc.text(`Total Arrecadado (Receitas): R$ ${fmt(totalReceitas)}`, 14, 50)
    doc.text(`Total Gasto (Despesas): R$ ${fmt(totalDespesas)}`, 14, 60)
    // PROPOSITALMENTE NÃO MOSTRAR SALDO FINAL AQUI
    
    const tableData = filtered.map(t => [
      t.data ? t.data.split('-').reverse().join('/') : '-',
      t.descricao + (t.condominio ? ` (${t.condominio})` : ''),
      t.categoria || '-',
      t.tipo,
      `R$ ${fmt(t.valor)}`
    ])

    autoTable(doc, {
      startY: 75,
      head: [['Data', 'Descricao', 'Categoria', 'Tipo', 'Valor']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [3, 22, 56] },
      didParseCell: function(data) {
        if (data.section === 'body' && data.column.index === 3) {
          if (data.cell.raw === 'Receita') data.cell.styles.textColor = [0, 150, 0]
          if (data.cell.raw === 'Despesa') data.cell.styles.textColor = [200, 0, 0]
        }
      }
    })
    
    doc.save(`Balancete_Transparencia_${mesFiltro || 'Geral'}.pdf`)
  }

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-gray-800">Histórico Completo de Lançamentos</h3>
          <p className="text-sm text-gray-500">Todas as movimentações financeiras (receitas e despesas)</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mt-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Buscar lançamento..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <input type="month" className="input py-2 w-auto" value={mesFiltro} onChange={e => setMesFiltro(e.target.value)} />
          <button onClick={() => setMesFiltro('')} className="text-xs text-brand-600 hover:underline mr-2 hidden sm:block">Mês Atual</button>
          
          {['Todos', 'Receita', 'Despesa'].map(f => (
            <button 
              key={f} 
              onClick={() => setFilter(f)} 
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filter === f ? 'bg-brand-600 text-white' : 'bg-white border border-cream-400 text-gray-500 hover:text-brand-600'}`}
            >
              {f}
            </button>
          ))}
        
          <button onClick={gerarBalancete} className="px-4 py-2 rounded-xl text-sm font-medium bg-brand-600 text-white flex items-center gap-2 hover:bg-brand-700 transition-all ml-4">
            <Download size={16} /> Balancete PDF
          </button>
        </div>

      </div>

      <div className="card p-0 overflow-hidden mt-2">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-cream-100 border-b border-cream-300">
              <tr>
                <th className="table-head">Data</th>
                <th className="table-head">Descrição</th>
                <th className="table-head">Tipo</th>
                <th className="table-head">Valor</th>
                <th className="table-head">Status</th>
                <th className="table-head">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={6} className="text-center py-10 text-gray-400 text-sm">Nenhum lançamento encontrado.</td></tr>
                : filtered.map(t => (
                  <tr key={t.id} className="table-row">
                    <td className="table-cell text-gray-500 font-medium">
                      {t.data ? t.data.split('-').reverse().join('/') : '-'}
                    </td>
                    <td className="table-cell">
                      <p className="font-medium text-gray-800">{t.descricao}</p>
                      <p className="text-xs text-gray-400">{t.categoria}</p>
                      {t.condominio && <span className="text-[10px] text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded border border-brand-100 block w-fit mt-1">{t.condominio}</span>}
                    </td>
                    <td className="table-cell">
                      <span className={t.tipo === 'Receita' ? 'badge-green' : 'badge-red'}>{t.tipo}</span>
                    </td>
                    <td className="table-cell">
                      <span className={`font-bold ${t.tipo === 'Receita' ? 'text-emerald-600' : 'text-red-500'}`}>
                        {t.tipo === 'Receita' ? '+' : '-'} R$ {fmt(t.valor)}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className={statusBadge(t.status)}>{t.status}</span>
                    </td>
                    <td className="table-cell">
                      <div className="flex gap-2">
                        {t.arquivoUrl && <a href={t.arquivoUrl} target="_blank" rel="noreferrer" title="Ver Anexo" className="p-1.5 rounded-lg bg-cream-100 hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition-all">📄</a>}
                        {!isMorador && (
                          <>
                            {t.status === 'Aguardando Aprovação' && (user?.role === 'Síndico' || user?.role === 'Administrador') && (
                              <button onClick={() => { if(window.confirm('Confirma a aprovação desta despesa? O status mudará para Pendente.')) updateLancamento(t.id, { ...t, status: 'Pendente' }) }} title="Aprovar Despesa" className="p-1.5 rounded-lg bg-orange-100 hover:bg-emerald-100 text-orange-600 hover:text-emerald-600 border border-transparent hover:border-emerald-200 transition-all">
                                <CheckCircle2 size={14} />
                              </button>
                            )}
                            <button onClick={() => setModalLanc(t)} title="Editar" className="p-1.5 rounded-lg bg-cream-100 hover:bg-brand-100 text-gray-400 hover:text-brand-600 transition-all"><Edit2 size={14} /></button>
                            <button onClick={() => deleteLancamento(t.id)} title="Excluir" className="p-1.5 rounded-lg bg-cream-100 hover:bg-red-100 text-gray-400 hover:text-red-500 transition-all"><Trash2 size={14} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              }
            </tbody>
            {filtered.length > 0 && (
              <tfoot className="bg-brand-50 border-t border-brand-100 font-bold text-gray-800">
                <tr>
                  <td colSpan="3" className="table-cell text-right py-4">Total Filtrado:</td>
                  <td className="table-cell py-4">
                    <span className="text-emerald-600 block text-xs">Receitas: R$ {fmt(totalReceitas)}</span>
                    <span className="text-red-500 block text-xs">Despesas: R$ {fmt(totalDespesas)}</span>
                    <span className={`block mt-1 ${saldoTotal >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>Saldo: R$ {fmt(saldoTotal)}</span>
                  </td>
                  <td colSpan="2" className="table-cell"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
