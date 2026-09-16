import React, { useState } from 'react'
import { Plus, Edit2, Trash2, Search, CheckCircle, AlertTriangle, Building2, Crown } from 'lucide-react'
import MonthRangeFilter from '../../components/MonthRangeFilter'
import { isAlphaInterno } from '../Financeiro'

export default function ContasReceber({ lancamentos, setModalLanc, deleteLancamento, updateLancamento }) {
  const [search, setSearch] = useState('')
  const hoje = new Date()
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}`
  const [mesDe, setMesDe] = useState(mesAtual)
  const [mesAte, setMesAte] = useState(mesAtual)
  const [statusFilter, setStatusFilter] = useState('Todas')

  let contasReceber = lancamentos.filter(t => t.tipo === 'Receita')

  if (statusFilter !== 'Todas') {
    contasReceber = contasReceber.filter(t => t.status === statusFilter)
  }
  if (mesDe && mesAte) {
    contasReceber = contasReceber.filter(t => {
      const m = t.data?.substring(0, 7)
      return m >= mesDe && m <= mesAte
    })
  } else if (mesDe) {
    contasReceber = contasReceber.filter(t => t.data?.substring(0, 7) >= mesDe)
  } else if (mesAte) {
    contasReceber = contasReceber.filter(t => t.data?.substring(0, 7) <= mesAte)
  }
  if (search) {
    contasReceber = contasReceber.filter(t => 
      (t.descricao || '').toLowerCase().includes(search.toLowerCase()) || 
      (t.categoria || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.condominio || '').toLowerCase().includes(search.toLowerCase())
    )
  }

  contasReceber.sort((a, b) => new Date(b.data) - new Date(a.data))

  // Lançamentos de receita filtrados pelo período selecionado para os cards de resumo
  const receitasPeriodo = lancamentos.filter(t => {
    if (t.tipo !== 'Receita') return false
    const m = t.data?.substring(0, 7)
    if (mesDe && mesAte) return m >= mesDe && m <= mesAte
    if (mesDe) return m >= mesDe
    if (mesAte) return m <= mesAte
    return true
  })

  const totalPendente = receitasPeriodo.filter(t => t.status === 'Pendente' || t.status === 'Vencido').reduce((acc, curr) => acc + Number(curr.valor || 0), 0)
  const totalRecebido = receitasPeriodo.filter(t => t.status === 'Recebido' || t.status === 'Pago').reduce((acc, curr) => acc + Number(curr.valor || 0), 0)
  const totalExibido = contasReceber.reduce((acc, curr) => acc + Number(curr.valor || 0), 0)

  const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const marcarComoRecebido = async (t) => {
    const novoStatus = t.status === 'Recebido' ? 'Pendente' : 'Recebido'
    const acao = novoStatus === 'Recebido' ? 'Confirmar recebimento' : 'Voltar para Pendente'
    if (window.confirm(`${acao} de "${t.descricao}"?`)) {
      await updateLancamento(t.id, { ...t, status: novoStatus })
    }
  }

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-white p-4 rounded-2xl border border-pale-300 shadow-sm">
        <div>
          <h3 className="text-xl font-bold text-gray-800">Contas a Receber (Receitas)</h3>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            A Receber: <span className="font-bold text-amber-600">R$ {fmt(totalPendente)}</span> &nbsp;•&nbsp; 
            Recebido: <span className="font-bold text-emerald-600">R$ {fmt(totalRecebido)}</span> &nbsp;•&nbsp; 
            Total Listado: <span className="font-black text-gray-900">R$ {fmt(totalExibido)}</span> ({contasReceber.length} lançamentos)
          </p>
        </div>
        <button onClick={() => setModalLanc({ tipo: 'Receita', status: 'Pendente', descricao: '', categoria: '', valor: '', data: new Date().toISOString().split('T')[0] })} className="btn-primary shrink-0 cursor-pointer">
          <Plus size={16} /> Nova Receita
        </button>
      </div>

      <div className="flex flex-col gap-2 bg-white p-4 rounded-2xl border border-pale-300 shadow-sm">
        <div className="flex flex-wrap gap-2 sm:gap-3 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9 text-xs" placeholder="Buscar receita, pagador, condomínio..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            {['Todas', 'Pendente', 'Recebido'].map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${statusFilter === st ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}
              >
                {st === 'Todas' ? 'Todas' : st === 'Pendente' ? 'A Receber' : 'Recebidas'}
              </button>
            ))}
          </div>
        </div>

        <MonthRangeFilter mesDe={mesDe} setMesDe={setMesDe} mesAte={mesAte} setMesAte={setMesAte} />
      </div>

      <div className="bg-white rounded-2xl border border-pale-300 shadow-sm overflow-hidden mt-2">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-gray-200 text-gray-600 font-bold uppercase text-[11px]">
              <tr>
                <th className="p-3.5">Data</th>
                <th className="p-3.5">Descrição / Pagador</th>
                <th className="p-3.5">Origem / Condomínio</th>
                <th className="p-3.5">Categoria</th>
                <th className="p-3.5">Valor</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contasReceber.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400 text-sm">
                    Nenhuma conta a receber encontrada.
                  </td>
                </tr>
              ) : (
                contasReceber.map(t => {
                  const vencimento = new Date(t.data)
                  const atrasado = t.status === 'Pendente' && vencimento < hoje
                  const ehAlpha = isAlphaInterno(t.condominio)

                  return (
                    <tr key={t.id} className={`hover:bg-slate-50/80 transition-colors ${atrasado ? 'bg-orange-50/50' : ''}`}>
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {atrasado && <AlertTriangle size={14} className="text-orange-500 shrink-0" title="Atrasado!" />}
                          <span className={atrasado ? 'text-orange-600 font-bold' : 'text-gray-700 font-medium'}>
                            {t.data ? t.data.split('-').reverse().join('/') : '—'}
                          </span>
                        </div>
                      </td>

                      <td className="p-3.5 font-bold text-gray-900">
                        <div className="max-w-[220px] truncate" title={t.descricao}>
                          {t.descricao}
                        </div>
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        {ehAlpha ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-900 border border-indigo-200 text-[10px] font-black">
                            <Crown size={11} className="text-indigo-600" /> Alpha Interno
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-bold">
                            <Building2 size={10} /> {t.condominio || 'Geral'}
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-gray-600 whitespace-nowrap">{t.categoria || '—'}</td>

                      <td className="p-3.5 font-black text-emerald-600 whitespace-nowrap">R$ {fmt(t.valor)}</td>

                      <td className="p-3.5 whitespace-nowrap">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                          t.status === 'Recebido' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {t.status || 'Pendente'}
                        </span>
                      </td>

                      <td className="p-3.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button 
                            onClick={() => marcarComoRecebido(t)} 
                            title={t.status === 'Recebido' ? 'Marcar como Pendente' : 'Confirmar Recebimento'} 
                            className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                              t.status === 'Recebido' 
                                ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold' 
                                : 'bg-slate-100 hover:bg-emerald-100 text-gray-500 hover:text-emerald-700'
                            }`}
                          >
                            <CheckCircle size={15} />
                          </button>
                          <button onClick={() => setModalLanc(t)} className="p-1.5 rounded-xl bg-slate-100 hover:bg-brand-50 text-gray-500 hover:text-brand-700 transition-all cursor-pointer" title="Editar"><Edit2 size={14} /></button>
                          <button onClick={() => { if (window.confirm(`Excluir "${t.descricao}"?`)) deleteLancamento(t.id) }} className="p-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-gray-400 hover:text-rose-600 transition-all cursor-pointer" title="Excluir"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
