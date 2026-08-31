import React, { useState } from 'react'
import { Plus, Edit2, Trash2, Search, CheckCircle, AlertCircle } from 'lucide-react'

export default function ContasPagar({ lancamentos, setModalLanc, deleteLancamento, updateLancamento }) {
  const [search, setSearch] = useState('')
  const [filterMes, setFilterMes] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todas') // 'Todas', 'Pendente', 'Pago'

  // Filtrar Despesas
  let contasPagar = lancamentos.filter(t => t.tipo === 'Despesa')

  if (statusFilter !== 'Todas') {
    contasPagar = contasPagar.filter(t => t.status === statusFilter)
  }
  if (filterMes) {
    contasPagar = contasPagar.filter(t => t.data?.startsWith(filterMes))
  }
  if (search) {
    contasPagar = contasPagar.filter(t => (t.descricao || '').toLowerCase().includes(search.toLowerCase()) || (t.categoria || '').toLowerCase().includes(search.toLowerCase()))
  }

  // Ordenar por data (do mais recente ou por vencimento)
  contasPagar.sort((a, b) => new Date(b.data) - new Date(a.data))

  const totalPendente = lancamentos.filter(t => t.tipo === 'Despesa' && t.status === 'Pendente').reduce((acc, curr) => acc + Number(curr.valor || 0), 0)
  const totalPago = lancamentos.filter(t => t.tipo === 'Despesa' && t.status === 'Pago').reduce((acc, curr) => acc + Number(curr.valor || 0), 0)
  const totalExibido = contasPagar.reduce((acc, curr) => acc + Number(curr.valor || 0), 0)
  const hoje = new Date()

  const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const marcarComoPago = async (t) => {
    const novoStatus = t.status === 'Pago' ? 'Pendente' : 'Pago'
    const acao = novoStatus === 'Pago' ? 'Confirmar pagamento' : 'Voltar para Pendente'
    if (window.confirm(`${acao} de "${t.descricao}"?`)) {
      await updateLancamento(t.id, { ...t, status: novoStatus })
    }
  }

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h3 className="text-xl font-bold text-gray-800">Contas a Pagar & Despesas</h3>
          <p className="text-xs sm:text-sm text-gray-500">
            Pendente: <span className="font-bold text-red-600">R$ {fmt(totalPendente)}</span> &nbsp;•&nbsp; 
            Pago: <span className="font-bold text-emerald-600">R$ {fmt(totalPago)}</span> &nbsp;•&nbsp; 
            Exibindo: <span className="font-black text-gray-900">R$ {fmt(totalExibido)}</span> ({contasPagar.length} lançamentos)
          </p>
        </div>
        <button onClick={() => setModalLanc({ tipo: 'Despesa', status: 'Pendente', descricao: '', categoria: '', valor: '', data: new Date().toISOString().split('T')[0] })} className="btn-primary shrink-0">
          <Plus size={16} /> Nova Despesa / Conta a Pagar
        </button>
      </div>

      {/* Filtros de Busca, Mês e Status */}
      <div className="flex flex-wrap gap-2 sm:gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 text-xs" placeholder="Buscar despesa ou fornecedor..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-200 text-xs">
          {['Todas', 'Pendente', 'Pago'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${statusFilter === st ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              {st === 'Todas' ? 'Todas as Despesas' : st === 'Pendente' ? 'Pendentes' : 'Pagas'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input type="month" className="input text-xs w-auto py-1.5" value={filterMes} onChange={e => setFilterMes(e.target.value)} />
          {filterMes && (
            <button onClick={() => setFilterMes('')} className="text-xs text-brand-600 font-bold hover:underline">Ver Histórico Todo</button>
          )}
        </div>
      </div>

      <div className="card p-0 overflow-hidden mt-2">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-cream-100 border-b border-cream-300">
              <tr>
                <th className="table-head">Vencimento</th>
                <th className="table-head">Descrição / Fornecedor</th>
                <th className="table-head">Categoria</th>
                <th className="table-head">Valor</th>
                <th className="table-head">Status</th>
                <th className="table-head">Ações</th>
              </tr>
            </thead>
            <tbody>
              {contasPagar.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400 text-sm">Nenhuma conta a pagar encontrada.</td></tr>
              ) : (
                contasPagar.map(t => {
                  const vencimento = new Date(t.data)
                  const atrasado = vencimento < hoje
                  return (
                    <tr key={t.id} className={`table-row ${atrasado ? 'bg-red-50' : ''}`}>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          {atrasado && <AlertCircle size={14} className="text-red-500" title="Vencido!" />}
                          <span className={atrasado ? 'text-red-600 font-bold' : 'text-gray-600'}>
                            {t.data.split('-').reverse().join('/')}
                          </span>
                        </div>
                      </td>
                      <td className="table-cell font-medium text-gray-800">{t.descricao}</td>
                      <td className="table-cell text-gray-500 text-sm">{t.categoria}</td>
                      <td className="table-cell font-bold text-red-500">R$ {fmt(t.valor)}</td>
                      <td className="table-cell"><span className="badge-yellow">Pendente</span></td>
                      <td className="table-cell">
                        <div className="flex gap-2">
                          {t.arquivoUrl && <a href={t.arquivoUrl} target="_blank" rel="noreferrer" title="Ver Anexo" className="p-1.5 rounded-lg bg-cream-100 hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition-all">📄</a>}
                          <button onClick={() => marcarComoPago(t)} title="Marcar como Pago" className="p-1.5 rounded-lg bg-green-100 hover:bg-green-200 text-green-600 transition-all"><CheckCircle size={14} /></button>
                          <button onClick={() => setModalLanc(t)} className="p-1.5 rounded-lg bg-cream-100 hover:bg-brand-100 text-gray-400 hover:text-brand-600 transition-all"><Edit2 size={14} /></button>
                          <button onClick={() => deleteLancamento(t.id)} className="p-1.5 rounded-lg bg-cream-100 hover:bg-red-100 text-gray-400 hover:text-red-500 transition-all"><Trash2 size={14} /></button>
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
