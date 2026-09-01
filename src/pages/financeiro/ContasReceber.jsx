import React, { useState } from 'react'
import { Plus, Edit2, Trash2, Search, CheckCircle, AlertTriangle } from 'lucide-react'
import MonthRangeFilter from '../../components/MonthRangeFilter'

export default function ContasReceber({ lancamentos, setModalLanc, deleteLancamento, updateLancamento }) {
  const [search, setSearch] = useState('')
  const [mesDe, setMesDe] = useState('')
  const [mesAte, setMesAte] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todas')

  // Filtrar Receitas
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
    contasReceber = contasReceber.filter(t => (t.descricao || '').toLowerCase().includes(search.toLowerCase()) || (t.categoria || '').toLowerCase().includes(search.toLowerCase()))
  }

  // Ordenar por data
  contasReceber.sort((a, b) => new Date(b.data) - new Date(a.data))

  const totalPendente = lancamentos.filter(t => t.tipo === 'Receita' && t.status === 'Pendente').reduce((acc, curr) => acc + Number(curr.valor || 0), 0)
  const totalRecebido = lancamentos.filter(t => t.tipo === 'Receita' && t.status === 'Recebido').reduce((acc, curr) => acc + Number(curr.valor || 0), 0)
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
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h3 className="text-xl font-bold text-gray-800">Contas a Receber (Receitas)</h3>
          <p className="text-xs sm:text-sm text-gray-500">
            A Receber: <span className="font-bold text-amber-600">R$ {fmt(totalPendente)}</span> &nbsp;•&nbsp; 
            Recebido: <span className="font-bold text-emerald-600">R$ {fmt(totalRecebido)}</span> &nbsp;•&nbsp; 
            Exibindo: <span className="font-black text-gray-900">R$ {fmt(totalExibido)}</span> ({contasReceber.length} lançamentos)
          </p>
        </div>
        <button onClick={() => setModalLanc({ tipo: 'Receita', status: 'Pendente', descricao: '', categoria: '', valor: '', data: new Date().toISOString().split('T')[0] })} className="btn-primary shrink-0">
          <Plus size={16} /> Nova Receita
        </button>
      </div>

      {/* Filtros de Busca, Período De...Até e Status */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2 sm:gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9 text-xs" placeholder="Buscar receita ou morador..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-200 text-xs">
            {['Todas', 'Pendente', 'Recebido'].map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${statusFilter === st ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                {st === 'Todas' ? 'Todas as Receitas' : st === 'Pendente' ? 'Pendentes' : 'Recebidas'}
              </button>
            ))}
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
                <th className="table-head">Vencimento</th>
                <th className="table-head">Descrição / Unidade</th>
                <th className="table-head">Categoria</th>
                <th className="table-head">Valor</th>
                <th className="table-head">Status</th>
                <th className="table-head">Ações</th>
              </tr>
            </thead>
            <tbody>
              {contasReceber.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400 text-sm">Nenhuma conta a receber encontrada.</td></tr>
              ) : (
                contasReceber.map(t => {
                  const vencimento = new Date(t.data)
                  const atrasado = vencimento < hoje
                  return (
                    <tr key={t.id} className={`table-row ${atrasado ? 'bg-orange-50' : ''}`}>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          {atrasado && <AlertTriangle size={14} className="text-orange-500" title="Atrasado (Inadimplente)" />}
                          <span className={atrasado ? 'text-orange-600 font-bold' : 'text-gray-600'}>
                            {t.data.split('-').reverse().join('/')}
                          </span>
                        </div>
                      </td>
                      <td className="table-cell font-medium text-gray-800">{t.descricao}</td>
                      <td className="table-cell text-gray-500 text-sm">{t.categoria}</td>
                      <td className="table-cell font-bold text-emerald-500">R$ {fmt(t.valor)}</td>
                      <td className="table-cell">
                        <span className={t.status === 'Recebido' ? 'badge-green font-bold' : 'badge-yellow font-bold'}>
                          {t.status || 'Pendente'}
                        </span>
                      </td>
                      <td className="table-cell">
                        <div className="flex gap-2">
                          {t.arquivoUrl && <a href={t.arquivoUrl} target="_blank" rel="noreferrer" title="Ver Anexo" className="p-1.5 rounded-lg bg-cream-100 hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition-all">📄</a>}
                          <button 
                            onClick={() => marcarComoRecebido(t)} 
                            title={t.status === 'Recebido' ? 'Marcar como Pendente' : 'Confirmar Recebimento'} 
                            className={`p-1.5 rounded-lg transition-all ${t.status === 'Recebido' ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-bold' : 'bg-cream-100 hover:bg-green-100 text-gray-400 hover:text-green-600'}`}
                          >
                            <CheckCircle size={14} />
                          </button>
                          <button onClick={() => setModalLanc(t)} className="p-1.5 rounded-lg bg-cream-100 hover:bg-brand-100 text-gray-400 hover:text-brand-600 transition-all" title="Editar"><Edit2 size={14} /></button>
                          <button onClick={() => deleteLancamento(t.id)} className="p-1.5 rounded-lg bg-cream-100 hover:bg-red-100 text-gray-400 hover:text-red-500 transition-all" title="Excluir"><Trash2 size={14} /></button>
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
