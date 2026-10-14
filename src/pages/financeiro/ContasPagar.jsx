import React, { useState } from 'react'
import { Plus, Edit2, Trash2, Search, CheckCircle, AlertCircle, Eye, Download, Copy, Check, ExternalLink, Sparkles, Building2, Crown, Send, Loader2, Square, CheckSquare, DollarSign, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import MonthRangeFilter from '../../components/MonthRangeFilter'
import { isAlphaInterno } from '../Financeiro'

export default function ContasPagar({ lancamentos, setModalLanc, deleteLancamento, updateLancamento }) {
  const [search, setSearch] = useState('')
  const hoje = new Date()
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}`
  const [mesDe, setMesDe] = useState(mesAtual)
  const [mesAte, setMesAte] = useState(mesAtual)
  const [statusFilter, setStatusFilter] = useState('Todas')
  const [copiadoId, setCopiadoId] = useState(null)
  const [disparandoAlertas, setDisparandoAlertas] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [ordemVencimento, setOrdemVencimento] = useState('asc') // 'asc' (outubro -> dezembro) | 'desc'

  const handleDispararAlertasAgora = async () => {
    if (!window.confirm('Deseja disparar agora a notificação no WhatsApp das Administradoras com todas as contas vencendo hoje?')) return
    setDisparandoAlertas(true)

    try {
      // 1. Tenta acionar via backend cron endpoint passando secret
      const resp = await fetch('/api/cron/alertas-vencimento', {
        headers: { 'x-cron-secret': 'Cron_Alpha_Auth_Secret_2026_Secure_Key' }
      }).catch(() => null)
      if (resp && resp.ok) {
        const data = await resp.json()
        alert(`✅ Notificação enviada com sucesso no WhatsApp!\nTotal de contas vencendo hoje: ${data.totalVencendoHoje || 0}`)
        setDisparandoAlertas(false)
        return
      }

      // 2. Monta o envio direto com dados em tempo real da aplicação (fallback de alta disponibilidade)
      const hoje = new Date()
      const yyyy = hoje.getFullYear()
      const mm = String(hoje.getMonth() + 1).padStart(2, '0')
      const dd = String(hoje.getDate()).padStart(2, '0')
      const hojeIso = `${yyyy}-${mm}-${dd}`
      const hojeBr = `${dd}/${mm}/${yyyy}`

      const normalizarParaIso = (val) => {
        if (!val) return ''
        const s = String(val).trim()
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10)
        const brMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
        if (brMatch) return `${brMatch[3]}-${brMatch[2].padStart(2, '0')}-${brMatch[1].padStart(2, '0')}`
        return ''
      }

      const contasHoje = lancamentos.filter(item => {
        const isDespesa = item.tipo === 'Despesa' || (item.categoria && String(item.categoria).toLowerCase().includes('despesa'))
        if (!isDespesa) return false
        const pago = item.status === 'Pago' || item.status === 'Liquidado' || item.pago === true
        if (pago) return false
        const dtVenc = item.vencimento || item.data || ''
        const iso = normalizarParaIso(dtVenc)
        return iso === hojeIso
      })

      if (contasHoje.length === 0) {
        alert(`ℹ️ Nenhuma conta com vencimento para hoje (${hojeBr}) pendente de pagamento.`)
        setDisparandoAlertas(false)
        return
      }

      const alphaInterno = contasHoje.filter(c => isAlphaInterno(c.condominio))
      const condominios = contasHoje.filter(c => !isAlphaInterno(c.condominio))

      // Agrupa condomínios por nome
      const contasPorCondo = {}
      condominios.forEach(c => {
        const nomeCondo = c.condominio || 'Sem Condomínio'
        if (!contasPorCondo[nomeCondo]) contasPorCondo[nomeCondo] = []
        contasPorCondo[nomeCondo].push(c)
      })

      let msg = `🔔 *ALERTAS DE VENCIMENTO DO DIA (${hojeBr})*\n`
      msg += `Total de contas a pagar hoje: *${contasHoje.length}*\n\n`

      // BLOCO A) Alpha Interno
      msg += `🏢 *BLOCO A: ALPHA INTERNO*\n`
      if (alphaInterno.length === 0) {
        msg += `_Nenhuma conta interna vencendo hoje._\n\n`
      } else {
        let tot = 0
        alphaInterno.forEach(c => {
          const val = parseFloat(c.valor) || 0
          tot += val
          msg += `• *${c.descricao || 'Despesa'}*: R$ ${fmt(val)}${c.categoria ? ` (${c.categoria})` : ''}\n`
        })
        msg += `*Total Alpha:* R$ ${fmt(tot)} (${alphaInterno.length} contas)\n\n`
      }

      // BLOCO B) Condomínios Cadastrados Agrupados
      msg += `🏘️ *BLOCO B: CONTAS DOS CONDOMÍNIOS*\n`
      const nomesCondos = Object.keys(contasPorCondo)
      if (nomesCondos.length === 0) {
        msg += `_Nenhuma conta de condomínio vencendo hoje._\n\n`
      } else {
        nomesCondos.sort().forEach(condo => {
          const lista = contasPorCondo[condo]
          const subtotal = lista.reduce((acc, c) => acc + (parseFloat(c.valor) || 0), 0)
          msg += `\n📍 *${condo.toUpperCase()}* (${lista.length} conta(s) - R$ ${fmt(subtotal)}):\n`
          lista.forEach(c => {
            const val = parseFloat(c.valor) || 0
            msg += `  - ${c.descricao || 'Despesa'}: R$ ${fmt(val)}${c.categoria ? ` (${c.categoria})` : ''}\n`
          })
        })
        msg += `\n`
      }

      msg += `🔗 *Acesse o módulo Financeiro:* https://alpha-solucoes-condominiais.vercel.app/financeiro`

      const telefones = [
        '5583996885931',
        '5583996806325',
        '5583999797285',
        '5583998350321',
        '5583998468997'
      ]

      let enviados = 0
      for (const num of telefones) {
        try {
          const res = await fetch('/api/whatsapp-send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ number: num, text: msg, instance: 'InstanciaAlpha' })
          })
          const resData = await res.json().catch(() => null)
          if (res.ok && resData?.success) {
            enviados++
          } else {
            console.warn('Falha no envio para', num, resData?.error)
          }
        } catch (e) {
          console.warn('Falha no envio WhatsApp:', num, e)
        }
      }

      alert(`✅ Notificações de vencimento disparadas com sucesso!\n\n🏢 Alpha Interno: ${alphaInterno.length} contas\n🏘️ Condomínios: ${condominios.length} contas\n📲 Enviado para ${enviados} números das Administradoras.`)
    } catch (err) {
      alert(`Erro ao disparar alertas: ${err.message}`)
    } finally {
      setDisparandoAlertas(false)
    }
  }

  const handleCopiarCodigo = (id, texto) => {
    if (!texto) return
    navigator.clipboard.writeText(texto)
    setCopiadoId(id)
    setTimeout(() => setCopiadoId(null), 2500)
  }

  // Abre PDF sem tela em branco: converte base64 → Blob URL
  const abrirArquivo = (url) => {
    if (!url) return
    if (url.startsWith('data:')) {
      try {
        const [header, base64] = url.split(',')
        const mime = header.match(/:(.*?);/)[1]
        const bytes = atob(base64)
        const arr = new Uint8Array(bytes.length)
        for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
        const blob = new Blob([arr], { type: mime })
        window.open(URL.createObjectURL(blob), '_blank')
      } catch { window.open(url, '_blank') }
    } else {
      window.open(url, '_blank')
    }
  }

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

  // Ordenação cronológica: padrão ascendente (ex: outubro -> novembro -> dezembro)
  contasPagar.sort((a, b) => {
    const rawA = String(a.data || a.vencimento || '').trim()
    const rawB = String(b.data || b.vencimento || '').trim()
    
    // Converte se estiver em dd/mm/yyyy para yyyy-mm-dd
    const parseDateStr = (str) => {
      if (!str) return 0
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
        const [d, m, y] = str.split('/')
        return new Date(`${y}-${m}-${d}T00:00:00`).getTime()
      }
      return new Date(str.includes('T') ? str : `${str}T00:00:00`).getTime() || 0
    }

    const timeA = parseDateStr(rawA)
    const timeB = parseDateStr(rawB)

    return ordemVencimento === 'asc' ? timeA - timeB : timeB - timeA
  })

  // Lançamentos de despesa filtrados pelo período selecionado para os cards de resumo
  const despesasPeriodo = lancamentos.filter(t => {
    if (t.tipo !== 'Despesa') return false
    const m = t.data?.substring(0, 7)
    if (mesDe && mesAte) return m >= mesDe && m <= mesAte
    if (mesDe) return m >= mesDe
    if (mesAte) return m <= mesAte
    return true
  })

  const totalPendente = despesasPeriodo.filter(t => t.status === 'Pendente' || t.status === 'Aguardando Aprovação').reduce((acc, curr) => acc + Number(curr.valor || 0), 0)
  const totalPago = despesasPeriodo.filter(t => t.status === 'Pago' || t.status === 'Liquidado' || t.pago).reduce((acc, curr) => acc + Number(curr.valor || 0), 0)
  const totalExibido = contasPagar.reduce((acc, curr) => acc + Number(curr.valor || 0), 0)

  const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  // Seleção e soma dinâmica das contas selecionadas
  const toggleSelectConta = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  const allVisibleSelected = contasPagar.length > 0 && contasPagar.every(c => selectedIds.includes(c.id))

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      // Remove da seleção os que estão visíveis atualmente
      const visibleIds = new Set(contasPagar.map(c => c.id))
      setSelectedIds(prev => prev.filter(id => !visibleIds.has(id)))
    } else {
      // Adiciona todos os visíveis na seleção
      const newIds = new Set([...selectedIds, ...contasPagar.map(c => c.id)])
      setSelectedIds(Array.from(newIds))
    }
  }

  const contasSelecionadas = contasPagar.filter(t => selectedIds.includes(t.id))
  const totalSelecionado = contasSelecionadas.reduce((acc, curr) => acc + Number(curr.valor || 0), 0)

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
        <div className="flex items-center gap-2">
          <button 
            onClick={handleDispararAlertasAgora} 
            disabled={disparandoAlertas}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
            title="Dispara mensagem agora para os WhatsApps das Administradoras com as contas que vencem hoje"
          >
            {disparandoAlertas ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {disparandoAlertas ? 'Enviando Alertas...' : 'Disparar Alertas Hoje (WhatsApp)'}
          </button>

          <button onClick={() => setModalLanc({ tipo: 'Despesa', status: 'Pendente', descricao: '', categoria: '', valor: '', data: new Date().toISOString().split('T')[0] })} className="btn-primary shrink-0 cursor-pointer">
            <Plus size={16} /> Nova Conta / Despesa
          </button>
        </div>
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

      {/* Barra Informativa de Seleção e Soma de Contas */}
      {selectedIds.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-brand-50 to-indigo-50 border border-brand-200 p-3.5 rounded-2xl shadow-sm animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <DollarSign size={22} className="stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-brand-900">Contas Selecionadas:</span>
                <span className="px-2 py-0.5 rounded-full bg-brand-600 text-white text-[11px] font-black">
                  {selectedIds.length} {selectedIds.length === 1 ? 'conta' : 'contas'}
                </span>
              </div>
              <div className="text-sm font-medium text-gray-700 mt-0.5">
                Soma total: <span className="text-lg font-black text-rose-600">R$ {fmt(totalSelecionado)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 font-bold text-xs transition-all cursor-pointer shadow-sm"
            >
              Desmarcar Todas
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-pale-300 shadow-sm overflow-hidden mt-1">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-gray-200 text-gray-600 font-bold uppercase text-[11px]">
              <tr>
                <th className="p-3.5 w-10 text-center">
                  <button 
                    onClick={toggleSelectAll} 
                    className="p-1 hover:text-brand-700 transition-colors inline-flex items-center justify-center cursor-pointer"
                    title={allVisibleSelected ? "Desmarcar todos" : "Selecionar todos visíveis"}
                  >
                    {allVisibleSelected ? (
                      <CheckSquare size={18} className="text-brand-700 stroke-[2.5]" />
                    ) : selectedIds.length > 0 ? (
                      <div className="w-4 h-4 rounded border-2 border-brand-700 bg-brand-100 flex items-center justify-center text-[10px] font-black text-brand-800 leading-none">-</div>
                    ) : (
                      <Square size={18} className="text-slate-600 hover:text-slate-900 stroke-[2]" />
                    )}
                  </button>
                </th>
                <th className="p-3.5">
                  <button
                    type="button"
                    onClick={() => setOrdemVencimento(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="flex items-center gap-1.5 hover:text-brand-600 transition-colors uppercase font-black cursor-pointer group"
                    title={`Ordenação atual: ${ordemVencimento === 'asc' ? 'Do mais antigo ao mais recente (Outubro → Dezembro)' : 'Do mais recente ao mais antigo (Dezembro → Outubro)'}. Clique para alternar.`}
                  >
                    <span>Vencimento</span>
                    {ordemVencimento === 'asc' ? (
                      <ArrowUp size={14} className="text-brand-600" />
                    ) : (
                      <ArrowDown size={14} className="text-brand-600" />
                    )}
                  </button>
                </th>
                <th className="p-3.5">Descrição / Fornecedor</th>
                <th className="p-3.5">Origem / Condomínio</th>
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
                  <td colSpan={9} className="text-center py-12 text-gray-400 text-sm">
                    Nenhuma conta a pagar encontrada para este período ou filtro.
                  </td>
                </tr>
              ) : (
                contasPagar.map(t => {
                  const vencimento = new Date(t.data)
                  const atrasado = t.status === 'Pendente' && vencimento < hoje
                  const temCodigo = !!(t.linhaDigitavel || t.pix)
                  const ehAlpha = isAlphaInterno(t.condominio)
                  const isSelected = selectedIds.includes(t.id)

                  return (
                    <tr 
                      key={t.id} 
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? 'bg-brand-50/60 font-medium' : atrasado ? 'bg-rose-50/50' : ''
                      }`}
                    >
                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => toggleSelectConta(t.id)}
                          className="p-1 hover:text-brand-700 transition-colors inline-flex items-center justify-center cursor-pointer"
                          title={isSelected ? "Desmarcar conta" : "Selecionar conta"}
                        >
                          {isSelected ? (
                            <CheckSquare size={18} className="text-brand-700 stroke-[2.5]" />
                          ) : (
                            <Square size={18} className="text-slate-600 hover:text-slate-900 stroke-[2]" />
                          )}
                        </button>
                      </td>

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

                      <td className="p-3.5 font-black text-rose-600 whitespace-nowrap">R$ {fmt(t.valor)}</td>

                      <td className="p-3.5">
                        <div className="flex flex-col gap-1 min-w-[140px]">
                          {/* Código visível (truncado) */}
                          {(t.linhaDigitavel || t.pix) && (
                            <span className="font-mono text-[10px] text-gray-500 bg-slate-100 px-1.5 py-0.5 rounded truncate max-w-[160px]" title={t.linhaDigitavel || t.pix}>
                              {(t.linhaDigitavel || t.pix || '').substring(0, 22)}…
                            </span>
                          )}

                          <div className="flex items-center gap-1 flex-wrap">
                            {/* Botão abrir PDF (corrigido para não abrir em branco) */}
                            {t.arquivoUrl && (
                              <button
                                onClick={() => abrirArquivo(t.arquivoUrl)}
                                className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold flex items-center gap-1 text-[10px] cursor-pointer"
                                title="Visualizar Boleto / Comprovante"
                              >
                                <Eye size={12} /> Boleto
                              </button>
                            )}

                            {/* Botão copiar código */}
                            {temCodigo && (
                              <button
                                onClick={() => handleCopiarCodigo(t.id, t.linhaDigitavel || t.pix)}
                                className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold flex items-center gap-1 text-[10px] cursor-pointer"
                                title="Copiar Linha Digitável / PIX"
                              >
                                {copiadoId === t.id ? (
                                  <><Check size={12} className="text-emerald-600" /> Copiado!</>
                                ) : (
                                  <><Copy size={12} /> Copiar</>
                                )}
                              </button>
                            )}

                            {/* Sem código e sem arquivo */}
                            {!temCodigo && !t.arquivoUrl && (
                              <span className="text-[10px] text-gray-300">—</span>
                            )}
                          </div>
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
                            className={`p-1.5 rounded-xl transition-all cursor-pointer border ${
                              t.status === 'Pago' 
                                ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border-emerald-300 font-bold' 
                                : 'bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 border-slate-300'
                            }`}
                          >
                            <CheckCircle size={15} className="stroke-[2.2]" />
                          </button>
                          <button 
                            onClick={() => setModalLanc(t)} 
                            className="p-1.5 rounded-xl bg-slate-100 hover:bg-brand-100 text-slate-700 hover:text-brand-900 border border-slate-300 hover:border-brand-300 transition-all cursor-pointer shadow-xs" 
                            title="Editar Lançamento"
                          >
                            <Edit2 size={14} className="stroke-[2.2]" />
                          </button>
                          <button 
                            onClick={() => {
                              if (window.confirm(`Deseja realmente excluir "${t.descricao}"?`)) {
                                deleteLancamento(t.id)
                              }
                            }} 
                            className="p-1.5 rounded-xl bg-slate-100 hover:bg-rose-100 text-slate-700 hover:text-rose-700 border border-slate-300 hover:border-rose-300 transition-all cursor-pointer shadow-xs" 
                            title="Excluir"
                          >
                            <Trash2 size={14} className="stroke-[2.2]" />
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
