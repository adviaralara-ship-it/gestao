import React, { useState } from 'react'
import { Plus, Edit2, Trash2, Search, CheckCircle, AlertCircle, Eye, Download, Copy, Check, ExternalLink, Sparkles, Building2 } from 'lucide-react'
import MonthRangeFilter from '../../components/MonthRangeFilter'

export default function ContasPagar({ lancamentos, setModalLanc, deleteLancamento, updateLancamento }) {
  const [search, setSearch] = useState('')
  const [mesDe, setMesDe] = useState('')
  const [mesAte, setMesAte] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todas') // 'Todas', 'Pendente', 'Pago'
  const [copiadoId, setCopiadoId] = useState(null)

  const handleCopiarCodigo = (id, texto) => {
    if (!texto) return
    navigator.clipboard.writeText(texto)
    setCopiadoId(id)
    setTimeout(() => setCopiadoId(null), 2500)
  }

  // Filtrar Despesas
  let contasPagar = lancamentos.filter(t => t.tipo === 'Despesa')

  if (statusFilter !== 'Todas') {
    contasPagar = contasPagar.filter(t => t.status === statusFilter)
  }
  if (mesDe && mesAte) {
    contasPagar = contasPagar.filter(t => {
      const m = t.data?.substring(0, 7)
      return m >= mesDe && m <= mesAte
    })
  } else if (mesDe) {
    contasPagar = contasPagar.filter(t => t.data?.substring(0, 7) >= mesDe)
  } else if (mesAte) {
    contasPagar = contasPagar.filter(t => t.data?.substring(0, 7) <= mesAte)
  }
  if (search) {
    const s = search.toLowerCase()
    contasPagar = contasPagar.filter(t => 
      (t.descricao || '').toLowerCase().includes(s) || 
      (t.categoria || '').toLowerCase().includes(s) ||
      (t.condominio || '').toLowerCase().includes(s) ||
      (t.linhaDigitavel || '').includes(s)
    )
  }

  // Ordenar por data
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
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-white p-4 rounded-2xl border border-pale-300 shadow-sm">
        <div>
          <h3 className="text-xl font-bold text-gray-800">Contas a Pagar, Boletos & Recibos</h3>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Pendente: <span className="font-bold text-red-600">R$ {fmt(totalPendente)}</span> &nbsp;•&nbsp; 
            Pago: <span className="font-bold text-emerald-600">R$ {fmt(totalPago)}</span> &nbsp;•&nbsp; 
            Total Listado: <span className="font-black text-gray-900">R$ {fmt(totalExibido)}</span> ({contasPagar.length} lançamentos)
          </p>
        </div>
        <button onClick={() => setModalLanc({ tipo: 'Despesa', status: 'Pendente', descricao: '', categoria: '', valor: '', data: new Date().toISOString().split('T')[0] })} className="btn-primary shrink-0 cursor-pointer">
          <Plus size={16} /> Nova Conta / Despesa
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-2 bg-white p-4 rounded-2xl border border-pale-300 shadow-sm">
        <div className="flex flex-wrap gap-2 sm:gap-3 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9 text-xs" placeholder="Buscar despesa, fornecedor, condomínio ou código..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            {['Todas', 'Pendente', 'Pago'].map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${statusFilter === st ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}
              >
                {st === 'Todas' ? 'Todas' : st === 'Pendente' ? 'Pendentes' : 'Pagas'}
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
                <th className="p-3.5">Vencimento</th>
                <th className="p-3.5">Descrição / Fornecedor</th>
                <th className="p-3.5">Condomínio</th>
                <th className="p-3.5">Categoria</th>
                <th className="p-3.5">Valor</th>
                <th className="p-3.5">Boleto / Pagamento</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contasPagar.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400 text-sm">
                    Nenhuma conta a pagar encontrada para este período ou filtro.
                  </td>
                </tr>
              ) : (
                contasPagar.map(t => {
                  const vencimento = new Date(t.data)
                  const atrasado = t.status === 'Pendente' && vencimento < hoje
                  const temCodigo = !!(t.linhaDigitavel || t.pix)

                  return (
                    <tr key={t.id} className={`hover:bg-slate-50/80 transition-colors ${atrasado ? 'bg-rose-50/50' : ''}`}>
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {atrasado && <AlertCircle size={14} className="text-red-500 shrink-0" title="Vencido!" />}
                          <span className={atrasado ? 'text-red-700 font-black' : 'text-gray-700 font-medium'}>
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
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-bold">
                          <Building2 size={10} /> {t.condominio || 'Geral'}
                        </span>
                      </td>

                      <td className="p-3.5 text-gray-600 whitespace-nowrap">{t.categoria || '—'}</td>

                      <td className="p-3.5 font-black text-rose-600 whitespace-nowrap">R$ {fmt(t.valor)}</td>

                      {/* Boleto Anexado e Botão de Copiar Código de Barras / PIX */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {t.arquivoUrl ? (
                            <a
                              href={t.arquivoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold flex items-center gap-1 text-[10px]"
                              title="Visualizar Boleto / Comprovante"
                            >
                              <Eye size={12} /> Boleto
                            </a>
                          ) : null}

                          {temCodigo ? (
                            <button
                              onClick={() => handleCopiarCodigo(t.id, t.linhaDigitavel || t.pix)}
                              className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold flex items-center gap-1 text-[10px] cursor-pointer"
                              title="Copiar Linha Digitável / PIX"
                            >
                              {copiadoId === t.id ? (
                                <>
                                  <Check size={12} className="text-emerald-600" /> Copiado!
                                </>
                              ) : (
                                <>
                                  <Copy size={12} /> Copiar Código
                                </>
                              )}
                            </button>
                          ) : (
                            <span className="text-[10px] text-gray-300">—</span>
                          )}
                        </div>
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                          t.status === 'Pago' ? 'bg-emerald-100 text-emerald-800' :
                          t.status === 'Aguardando Aprovação' ? 'bg-amber-100 text-amber-800' :
                          'bg-rose-100 text-rose-800'
                        }`}>
                          {t.status || 'Pendente'}
                        </span>
                      </td>

                      <td className="p-3.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button 
                            onClick={() => marcarComoPago(t)} 
                            title={t.status === 'Pago' ? 'Marcar como Pendente' : 'Confirmar Pagamento'} 
                            className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                              t.status === 'Pago' 
                                ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold' 
                                : 'bg-slate-100 hover:bg-emerald-100 text-gray-500 hover:text-emerald-700'
                            }`}
                          >
                            <CheckCircle size={15} />
                          </button>
                          <button 
                            onClick={() => setModalLanc(t)} 
                            className="p-1.5 rounded-xl bg-slate-100 hover:bg-brand-50 text-gray-500 hover:text-brand-700 transition-all cursor-pointer" 
                            title="Editar Lançamento"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            onClick={() => {
                              if (window.confirm(`Deseja realmente excluir "${t.descricao}"?`)) {
                                deleteLancamento(t.id)
                              }
                            }} 
                            className="p-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-gray-400 hover:text-rose-600 transition-all cursor-pointer" 
                            title="Excluir"
                          >
                            <Trash2 size={14} />
                          </button>
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
