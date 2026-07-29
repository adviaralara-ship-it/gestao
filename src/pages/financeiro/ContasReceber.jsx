import React, { useState } from 'react'
import { Plus, Edit2, Trash2, Search, CheckCircle, AlertTriangle } from 'lucide-react'

export default function ContasReceber({ lancamentos, setModalLanc, deleteLancamento, updateLancamento }) {
  const [search, setSearch] = useState('')
  const [filterMes, setFilterMes] = useState('')

  // Filtrar apenas Receitas Pendentes (Contas a Receber)
  let contasReceber = lancamentos.filter(t => t.tipo === 'Receita' && t.status === 'Pendente')

  if (filterMes) {
    contasReceber = contasReceber.filter(t => t.data?.startsWith(filterMes))
  }
  if (search) {
    contasReceber = contasReceber.filter(t => (t.descricao || '').toLowerCase().includes(search.toLowerCase()))
  }

  // Ordenar por data de vencimento
  contasReceber.sort((a, b) => new Date(a.data) - new Date(b.data))

  const totalReceber = contasReceber.reduce((acc, curr) => acc + Number(curr.valor || 0), 0)
  const hoje = new Date()

  const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const marcarComoRecebido = async (t) => {
    if (window.confirm(`Confirmar o recebimento de "${t.descricao}"?`)) {
      await updateLancamento(t.id, { ...t, status: 'Recebido' })
    }
  }

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-gray-800">Contas a Receber (Inadimplência)</h3>
          <p className="text-sm text-gray-500">Total a receber: <span className="font-bold text-emerald-600">R$ {fmt(totalReceber)}</span></p>
        </div>
        <button onClick={() => setModalLanc({ tipo: 'Receita', status: 'Pendente', descricao: '', categoria: '', valor: '', data: '' })} className="btn-primary">
          <Plus size={16} /> Nova Conta a Receber
        </button>
      </div>

      <div className="flex gap-3 mt-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Buscar cobrança..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <input type="month" className="input w-auto" value={filterMes} onChange={e => setFilterMes(e.target.value)} />
        <button onClick={() => setFilterMes('')} className="text-xs text-brand-600 hover:underline px-2">Ver Todas</button>
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
                      <td className="table-cell"><span className="badge-yellow">Pendente</span></td>
                      <td className="table-cell">
                        <div className="flex gap-2">
                          {t.arquivoUrl && <a href={t.arquivoUrl} target="_blank" rel="noreferrer" title="Ver Anexo" className="p-1.5 rounded-lg bg-cream-100 hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition-all">📄</a>}
                          <button onClick={() => marcarComoRecebido(t)} title="Marcar como Recebido" className="p-1.5 rounded-lg bg-green-100 hover:bg-green-200 text-green-600 transition-all"><CheckCircle size={14} /></button>
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
