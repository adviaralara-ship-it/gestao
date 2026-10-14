import React, { useState } from 'react'
import { Plus, Edit2, Trash2, Search, CheckCircle, AlertTriangle, Building2, Crown } from 'lucide-react'
import MonthRangeFilter from '../../components/MonthRangeFilter'
import { isAlphaInterno } from '../Financeiro'

export default function ContasReceber({ lancamentos, boletos = [], condoFilter = 'Todos', setModalLanc, deleteLancamento, updateLancamento }) {
  const [search, setSearch] = useState('')
  const hoje = new Date()
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}`
  const [mesDe, setMesDe] = useState(mesAtual)
  const [mesAte, setMesAte] = useState(mesAtual)
  const [statusFilter, setStatusFilter] = useState('Todas')

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

  // Filtrar boletos válidos pelo condomínio selecionado
  const isAlpha = condoFilter === 'Alpha (Interno)' || condoFilter?.toLowerCase()?.includes('alpha')
  const isTodos = !condoFilter || condoFilter === 'Todos'

  const boletosDoCondo = (boletos || []).filter(b => {
    if (b.status === 'Cancelado' || b.status === 'Excluído' || b.status === 'Excluido' || b.excluido || b.deletado) return false
    if (isTodos) return true
    if (isAlpha) return false
    return condoMatch(b.condominio, condoFilter)
  })

  // Transforma boletos em formato compatível com receitas se não houver lançamento correspondente
  const receitasLancamentos = (lancamentos || []).filter(t => t.tipo === 'Receita')
  const boletoIdsExistentes = new Set(receitasLancamentos.map(l => l.boletoId).filter(Boolean))

  const boletosComoReceita = boletosDoCondo
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

  // Unifica tudo em uma única listagem de contas a receber
  const todasReceitas = [...receitasLancamentos, ...boletosComoReceita]

  let contasReceber = todasReceitas

  if (statusFilter !== 'Todas') {
    if (statusFilter === 'Recebido') {
      contasReceber = contasReceber.filter(t => t.status === 'Recebido' || t.status === 'Pago')
    } else if (statusFilter === 'Pendente') {
      contasReceber = contasReceber.filter(t => t.status === 'Pendente' || t.status === 'Vencido')
    } else {
      contasReceber = contasReceber.filter(t => t.status === statusFilter)
    }
  }

  if (mesDe && mesAte) {
    contasReceber = contasReceber.filter(t => {
      const m = parseAnoMes(t.competencia, t.data) || parseAnoMes(t.data, t.competencia)
      return m >= mesDe && m <= mesAte
    })
  } else if (mesDe) {
    contasReceber = contasReceber.filter(t => {
      const m = parseAnoMes(t.competencia, t.data) || parseAnoMes(t.data, t.competencia)
      return m >= mesDe
    })
  } else if (mesAte) {
    contasReceber = contasReceber.filter(t => {
      const m = parseAnoMes(t.competencia, t.data) || parseAnoMes(t.data, t.competencia)
      return m <= mesAte
    })
  }
  if (search) {
    const s = search.toLowerCase()
    contasReceber = contasReceber.filter(t => 
      (t.descricao || '').toLowerCase().includes(s) || 
      (t.categoria || '').toLowerCase().includes(s) ||
      (t.condominio || '').toLowerCase().includes(s)
    )
  }

  contasReceber.sort((a, b) => parseDateStr(b.data || b.vencimento) - parseDateStr(a.data || a.vencimento))

  // Lançamentos de receita filtrados pelo período selecionado para os cards de resumo
  const receitasPeriodo = todasReceitas.filter(t => {
    const m = parseAnoMes(t.competencia, t.data) || parseAnoMes(t.data, t.competencia)
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
    const isRecebido = t.status === 'Recebido' || t.status === 'Pago'
    const novoStatus = isRecebido ? 'Pendente' : 'Recebido'
    const acao = !isRecebido ? 'Confirmar recebimento' : 'Voltar para Pendente'
    if (window.confirm(`${acao} de "${t.descricao}"?`)) {
      if (t.isBoletoVirtual) {
        if (updateBoleto) {
          await updateBoleto(t.boletoId, { status: novoStatus === 'Recebido' ? 'Pago' : 'Pendente' })
        }
      } else {
        await updateLancamento(t.id, { ...t, status: novoStatus })
      }
    }
  }

  const handleDeleteItem = async (t) => {
    if (!window.confirm(`Excluir "${t.descricao}"?`)) return
    if (t.isBoletoVirtual) {
      if (deleteBoleto) {
        await deleteBoleto(t.boletoId)
      }
    } else {
      await deleteLancamento(t.id)
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
                            {t.data ? (t.data.includes('/') ? t.data : t.data.split('-').reverse().join('/')) : '—'}
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
                            className={`p-1.5 rounded-xl transition-all cursor-pointer border ${
                              t.status === 'Recebido' 
                                ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border-emerald-300 font-bold' 
                                : 'bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 border-slate-300'
                            }`}
                          >
                            <CheckCircle size={15} className="stroke-[2.2]" />
                          </button>
                          <button onClick={() => setModalLanc(t)} className="p-1.5 rounded-xl bg-slate-100 hover:bg-brand-100 text-slate-700 hover:text-brand-900 border border-slate-300 hover:border-brand-300 transition-all cursor-pointer shadow-xs" title="Editar"><Edit2 size={14} className="stroke-[2.2]" /></button>
                          <button onClick={() => handleDeleteItem(t)} className="p-1.5 rounded-xl bg-slate-100 hover:bg-rose-100 text-slate-700 hover:text-rose-700 border border-slate-300 hover:border-rose-300 transition-all cursor-pointer shadow-xs" title="Excluir"><Trash2 size={14} className="stroke-[2.2]" /></button>
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
