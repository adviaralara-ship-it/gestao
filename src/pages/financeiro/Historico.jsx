import React, { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { Search, Edit2, Trash2, Download, CheckCircle2, Loader2 } from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import MonthRangeFilter from '../../components/MonthRangeFilter'

export default function Historico({ lancamentos, boletos = [], condoFilter = 'Todos', setModalLanc, deleteLancamento, updateLancamento, updateBoleto, deleteBoleto }) {
  const { user } = useAuth()
  const isMorador = user?.role === 'Morador'
  const searchParams = new URLSearchParams(window.location.search)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState(searchParams.get('tipo') || 'Todos')
  const [mesDe, setMesDe] = useState(searchParams.get('mes') || '')
  const [mesAte, setMesAte] = useState('')

  const normalizarNomeCondo = (nome) => {
    return String(nome || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/^(residencial|condominio|edificio|ed\.)\s+/i, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .trim()
      .toLowerCase()
  }

  const condoMatch = (c1, c2) => {
    if (!c1 || !c2) return false
    const n1 = normalizarNomeCondo(c1)
    const n2 = normalizarNomeCondo(c2)
    return n1 === n2 || n1.includes(n2) || n2.includes(n1)
  }

  const parseAnoMes = (str, competenciaStr) => {
    const raw = String(str || competenciaStr || '').trim()
    if (!raw) return ''
    if (/^\d{4}-\d{2}/.test(raw)) return raw.substring(0, 7)
    const brMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
    if (brMatch) return `${brMatch[3]}-${brMatch[2].padStart(2, '0')}`
    
    const c = raw.toLowerCase()
    const mNum = c.match(/(\d{1,2})\/(\d{4})/)
    if (mNum) return `${mNum[2]}-${mNum[1].padStart(2, '0')}`
    
    const mesesMap = {
      jan: '01', fev: '02', mar: '03', abr: '04', mai: '05', jun: '06',
      jul: '07', ago: '08', set: '09', out: '10', nov: '11', dez: '12'
    }
    for (const [prefix, num] of Object.entries(mesesMap)) {
      if (c.includes(prefix)) {
        const anoMatch = c.match(/\d{4}/)
        if (anoMatch) return `${anoMatch[0]}-${num}`
      }
    }
    return ''
  }

  const parseDateStr = (str) => {
    if (!str) return 0
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
      const [d, m, y] = str.split('/')
      return new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T00:00:00`).getTime()
    }
    return new Date(str.includes('T') ? str : `${str}T00:00:00`).getTime() || 0
  }

  const isAlpha = condoFilter === 'Alpha (Interno)' || condoFilter?.toLowerCase()?.includes('alpha')
  const isTodos = !condoFilter || condoFilter === 'Todos'

  // Filtrar boletos compatíveis com o condomínio selecionado
  const boletosDoCondo = (boletos || []).filter(b => {
    if (b.status === 'Cancelado' || b.status === 'Excluído' || b.status === 'Excluido' || b.excluido || b.deletado) return false
    if (isTodos) return true
    if (isAlpha) return false
    return condoMatch(b.condominio, condoFilter)
  })

  // Transforma boletos em lançamentos de receita se não houver lançamento espelho já criado
  const boletoIdsExistentes = new Set((lancamentos || []).map(l => l.boletoId).filter(Boolean))

  const boletosComoLancamento = boletosDoCondo
    .filter(b => !boletoIdsExistentes.has(b.id))
    .map(b => {
      const dtVenc = b.vencimento || b.data || ''
      return {
        id: `boleto_${b.id}`,
        boletoId: b.id,
        isBoletoVirtual: true,
        tipo: 'Receita',
        descricao: `Recebimento Cota: ${b.morador || 'Morador'} - Apt ${b.apt || ''}`,
        categoria: 'Cota Condominial',
        condominio: b.condominio || 'Residencial',
        valor: Number(b.valor || 0),
        data: dtVenc,
        competencia: b.competencia,
        status: b.status === 'Pago' ? 'Recebido' : (b.status || 'Pendente')
      }
    })

  const todosLancamentos = [...(lancamentos || []), ...boletosComoLancamento]

  const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const statusBadge = (s) => ({ Recebido: 'badge-green', Pago: 'badge-blue', Pendente: 'badge-yellow', 'Aguardando Aprovação': 'bg-orange-100 text-orange-800 px-2 py-0.5 rounded text-[10px] font-bold border border-orange-200' }[s] || 'badge-blue')

  const filtered = todosLancamentos.filter(t => {
    const matchSearch = (t.descricao || '').toLowerCase().includes(search.toLowerCase()) || 
      (t.categoria || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.condominio || '').toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'Todos' || t.tipo === filter
    let matchPeriodo = true
    const mes = parseAnoMes(t.competencia, t.data) || parseAnoMes(t.data, t.competencia)
    if (mesDe && mesAte) {
      matchPeriodo = mes >= mesDe && mes <= mesAte
    } else if (mesDe) {
      matchPeriodo = mes >= mesDe
    } else if (mesAte) {
      matchPeriodo = mes <= mesAte
    }
    return matchSearch && matchFilter && matchPeriodo
  }).sort((a, b) => parseDateStr(b.data || b.vencimento) - parseDateStr(a.data || a.vencimento))

  const totalReceitas = filtered.filter(t => t.tipo === 'Receita').reduce((acc, curr) => acc + Number(curr.valor || 0), 0)
  const totalDespesas = filtered.filter(t => t.tipo === 'Despesa').reduce((acc, curr) => acc + Number(curr.valor || 0), 0)
  const saldoTotal = totalReceitas - totalDespesas
  const [loadingHistId, setLoadingHistId] = useState(null)

  const alternarStatusPago = async (t) => {
    try {
      setLoadingHistId(t.id)
      const isPago = t.status === 'Recebido' || t.status === 'Pago' || t.status === 'Liquidado'
      const novoStatus = isPago ? 'Pendente' : (t.tipo === 'Receita' ? 'Recebido' : 'Pago')
      
      if (t.isBoletoVirtual) {
        if (updateBoleto) {
          await updateBoleto(t.boletoId, { status: novoStatus === 'Recebido' ? 'Pago' : 'Pendente' })
        }
      } else if (updateLancamento) {
        await updateLancamento(t.id, { ...t, status: novoStatus })
      }
    } catch (err) {
      console.error('Erro ao alternar status no histórico:', err)
      alert('Erro ao atualizar status: ' + (err.message || 'Tente novamente'))
    } finally {
      setLoadingHistId(null)
    }
  }

  const handleDeleteItem = async (t) => {
    if (!window.confirm(`Excluir "${t.descricao}"?`)) return
    if (t.isBoletoVirtual) {
      if (deleteBoleto) {
        await deleteBoleto(t.boletoId)
      }
    } else if (deleteLancamento) {
      await deleteLancamento(t.id)
    }
  }

  const gerarBalancete = () => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.width
    
    doc.setFontSize(20)
    doc.setTextColor(3, 22, 56)
    doc.text('Balancete Discriminado de Transparencia', pageWidth / 2, 20, { align: 'center' })
    
    const periodoTexto = (mesDe && mesAte) ? `${mesDe.split('-').reverse().join('/')} até ${mesAte.split('-').reverse().join('/')}` : (mesDe ? `A partir de ${mesDe.split('-').reverse().join('/')}` : 'Historico Geral')
    doc.setFontSize(14)
    doc.setTextColor(100)
    doc.text(`Periodo: ${periodoTexto}`, pageWidth / 2, 30, { align: 'center' })
    
    doc.setFontSize(12)
    doc.setTextColor(50)
    doc.text(`Total Arrecadado (Receitas): R$ ${fmt(totalReceitas)}`, 14, 50)
    doc.text(`Total Gasto (Despesas): R$ ${fmt(totalDespesas)}`, 14, 60)
    
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
    
    doc.save(`Balancete_Transparencia_${mesDe || 'Geral'}.pdf`)
  }

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-gray-800">Histórico Completo de Lançamentos</h3>
          <p className="text-sm text-gray-500">Todas as movimentações financeiras (receitas e despesas)</p>
        </div>
      </div>

      <div className="flex flex-col gap-2 mt-2">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9" placeholder="Buscar lançamento por descrição ou categoria..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            {['Todos', 'Receita', 'Despesa'].map(f => (
              <button 
                key={f} 
                onClick={() => setFilter(f)} 
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filter === f ? 'bg-brand-600 text-white' : 'bg-white border border-cream-400 text-gray-500 hover:text-brand-600'}`}
              >
                {f}
              </button>
            ))}
          
            <button onClick={gerarBalancete} className="px-4 py-2 rounded-xl text-sm font-medium bg-emerald-600 text-white flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-sm">
              <Download size={16} /> Balancete PDF
            </button>
          </div>
        </div>

        {/* Filtro De ... Até ... */}
        <MonthRangeFilter mesDe={mesDe} setMesDe={setMesDe} mesAte={mesAte} setMesAte={setMesAte} />
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
                : filtered.map(t => {
                  const isPago = t.status === 'Recebido' || t.status === 'Pago' || t.status === 'Liquidado'
                  return (
                  <tr key={t.id} className="table-row">
                    <td className="table-cell text-gray-500 font-medium">
                      {t.data ? (t.data.includes('/') ? t.data : t.data.split('-').reverse().join('/')) : '-'}
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
                      <button
                        type="button"
                        onClick={() => alternarStatusPago(t)}
                        disabled={loadingHistId === t.id}
                        title={isPago ? '1-Clique: Marcar como Pendente' : '1-Clique: Marcar como Pago/Recebido'}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase transition-all shadow-xs cursor-pointer select-none active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${
                          isPago
                            ? 'bg-emerald-500 hover:bg-emerald-600 text-white border border-emerald-600 shadow-emerald-200'
                            : 'bg-amber-100 hover:bg-emerald-100 text-amber-800 hover:text-emerald-800 border border-amber-300 hover:border-emerald-300'
                        }`}
                      >
                        {loadingHistId === t.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : isPago ? (
                          <CheckCircle2 size={12} className="stroke-[2.5]" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        )}
                        {isPago ? (t.tipo === 'Receita' ? 'Recebido' : 'Pago') : 'Pendente'}
                      </button>
                    </td>
                    <td className="table-cell">
                      <div className="flex gap-2 items-center">
                        {t.arquivoUrl && <a href={t.arquivoUrl} target="_blank" rel="noreferrer" title="Ver Anexo" className="p-1.5 rounded-lg bg-cream-100 hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition-all">📄</a>}
                        {!isMorador && (
                          <>
                            <button 
                              onClick={() => alternarStatusPago(t)} 
                              disabled={loadingHistId === t.id}
                              title={isPago ? '1-Clique: Marcar como Pendente' : '1-Clique: Confirmar Pagamento/Recebimento'} 
                              className={`p-1.5 rounded-lg border transition-all cursor-pointer active:scale-90 ${
                                isPago 
                                  ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border-emerald-300 font-bold' 
                                  : 'bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 border-slate-300'
                              }`}
                            >
                              {loadingHistId === t.id ? (
                                <Loader2 size={14} className="animate-spin text-brand-600" />
                              ) : (
                                <CheckCircle2 size={14} />
                              )}
                            </button>
                            <button onClick={() => setModalLanc(t)} title="Editar" className="p-1.5 rounded-lg bg-slate-100 hover:bg-brand-100 text-slate-700 hover:text-brand-900 border border-slate-300 hover:border-brand-300 transition-all shadow-xs"><Edit2 size={14} className="stroke-[2.2]" /></button>
                            <button onClick={() => handleDeleteItem(t)} title="Excluir" className="p-1.5 rounded-lg bg-slate-100 hover:bg-red-100 text-slate-700 hover:text-red-700 border border-slate-300 hover:border-red-300 transition-all shadow-xs"><Trash2 size={14} className="stroke-[2.2]" /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  )
                })
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
