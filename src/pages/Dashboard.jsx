import React, { useState, useMemo } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import {
  TrendingUp, TrendingDown, Users, Building2, AlertTriangle, CalendarCheck,
  CreditCard, DollarSign, FileText, Bell, Clock, Wrench, Shield, Plus,
  FileSpreadsheet, ArrowRight, CheckCircle2, AlertCircle, Sparkles, ChevronRight,
  ExternalLink, Layers, Eye
} from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { format, parseISO, differenceInDays } from 'date-fns'

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // Buscar dados reais do Firestore
  const { items: condominios }  = useFirestore('condominios')
  const { items: financeiro }   = useFirestore('financeiro_lancamentos')
  const { items: boletos }      = useFirestore('boletos')
  const { items: cotacoes }     = useFirestore('cotacoes')
  const { items: manutencoes }  = useFirestore('manutencoes')
  const { items: apolices }     = useFirestore('apolices')
  const { items: ocorrencias }  = useFirestore('ocorrencias')
  const { items: assembleias }  = useFirestore('assembleias')

  // Filtro de condomínio ativo
  const [condoFiltro, setCondoFiltro] = useState(user?.role === 'Síndico' ? user.condominio : (user?.condominio || 'Todos'))

  // Filtrar dados por condomínio selecionado
  const filterByCondo = (items) => {
    if (!condoFiltro || condoFiltro === 'Todos') return items
    return items.filter(it => !it.condominio || it.condominio === condoFiltro)
  }

  const finFiltrado = useMemo(() => filterByCondo(financeiro), [financeiro, condoFiltro])
  const bolFiltrado = useMemo(() => filterByCondo(boletos), [boletos, condoFiltro])
  const cotFiltradas = useMemo(() => filterByCondo(cotacoes), [cotacoes, condoFiltro])
  const manFiltradas = useMemo(() => filterByCondo(manutencoes), [manutencoes, condoFiltro])
  const apoFiltradas = useMemo(() => filterByCondo(apolices), [apolices, condoFiltro])
  const ocFiltradas = useMemo(() => filterByCondo(ocorrencias), [ocorrencias, condoFiltro])

  // =========================================================================
  // 1. CÁLCULOS FINANCEIROS
  // =========================================================================
  const { saldoAtual, aReceber, aPagar, inadimplenciaTotal, contasVencidas, chartData } = useMemo(() => {
    let recPagas = 0
    let desPagas = 0
    let recPendentes = 0
    let desPendentes = 0
    let inadimp = 0
    let vencidas = []

    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const histMeses = {}

    // Processar Boletos
    bolFiltrado.forEach(b => {
      const val = parseFloat(b.valor) || 0
      const dStr = b.vencimento || b.data || ''
      let dObj = hoje
      if (dStr) {
        try { dObj = parseISO(dStr) } catch(e) {}
      }
      const mesKey = `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, '0')}`
      const mesAbrev = dObj.toLocaleDateString('pt-BR', { month: 'short' })

      if (!histMeses[mesKey]) {
        histMeses[mesKey] = { sortKey: mesKey, mes: mesAbrev, receitas: 0, despesas: 0 }
      }

      if (b.status === 'Pago') {
        recPagas += val
        histMeses[mesKey].receitas += val
      } else if (b.status === 'Vencido' || (dObj < hoje && b.status !== 'Pago')) {
        inadimp += val
      } else {
        recPendentes += val
      }
    })

    // Processar Lançamentos Financeiros
    finFiltrado.forEach(f => {
      const val = parseFloat(f.valor) || 0
      const dStr = f.data || ''
      let dObj = hoje
      if (dStr) {
        try { dObj = parseISO(dStr) } catch(e) {}
      }
      const mesKey = `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, '0')}`
      const mesAbrev = dObj.toLocaleDateString('pt-BR', { month: 'short' })

      if (!histMeses[mesKey]) {
        histMeses[mesKey] = { sortKey: mesKey, mes: mesAbrev, receitas: 0, despesas: 0 }
      }

      if (f.tipo === 'Receita') {
        if (f.status === 'Pago' || f.status === 'Recebido' || f.status === 'Concluído') {
          recPagas += val
          histMeses[mesKey].receitas += val
        } else {
          recPendentes += val
        }
      } else if (f.tipo === 'Despesa') {
        if (f.status === 'Pago' || f.status === 'Liquidado' || f.status === 'Concluído') {
          desPagas += val
          histMeses[mesKey].despesas += val
        } else {
          desPendentes += val
          if (dObj < hoje) {
            vencidas.push({ ...f, diasAtraso: differenceInDays(hoje, dObj) })
          }
        }
      }
    })

    const saldo = recPagas - desPagas
    const cData = Object.values(histMeses)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .slice(-6)

    return {
      saldoAtual: saldo,
      aReceber: recPendentes,
      aPagar: desPendentes,
      inadimplenciaTotal: inadimp,
      contasVencidas: vencidas,
      chartData: cData.length > 0 ? cData : [
        { mes: 'Mai', receitas: 32000, despesas: 24000 },
        { mes: 'Jun', receitas: 35000, despesas: 28000 },
        { mes: 'Jul', receitas: 38000, despesas: 29500 },
        { mes: 'Ago', receitas: 41000, despesas: 31200 }
      ]
    }
  }, [finFiltrado, bolFiltrado])

  // =========================================================================
  // 2. CÁLCULOS DE COTAÇÕES
  // =========================================================================
  const statsCotacoes = useMemo(() => {
    const total = cotFiltradas.length
    const emAndamento = cotFiltradas.filter(c => ['Solicitada', 'Em análise'].includes(c.status)).length
    const aguardandoOrcamento = cotFiltradas.filter(c => ['Rascunho', 'Aguardando propostas'].includes(c.status)).length
    const aguardandoAprovacao = cotFiltradas.filter(c => c.status === 'Aguardando aprovação').length
    const concluidasMes = cotFiltradas.filter(c => ['Aprovada', 'Contratada', 'Concluída'].includes(c.status)).length

    // Cotação em maior destaque (aguardando aprovação ou a mais recente)
    const prioritaria = cotFiltradas.find(c => c.status === 'Aguardando aprovação') || cotFiltradas[0] || null

    let menorProp = 0
    if (prioritaria?.fornecedores?.length > 0) {
      const vals = prioritaria.fornecedores.map(f => parseFloat(f.valorTotal) || 0).filter(v => v > 0).sort((a, b) => a - b)
      menorProp = vals[0] || prioritaria.valorEstimadoTotal || 0
    }

    return {
      total,
      emAndamento,
      aguardandoOrcamento,
      aguardandoAprovacao,
      concluidasMes,
      prioritaria,
      menorProp
    }
  }, [cotFiltradas])

  // =========================================================================
  // 3. CÁLCULOS DE MANUTENÇÕES
  // =========================================================================
  const statsManutencoes = useMemo(() => {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    const pendentes = manFiltradas.filter(m => m.status === 'Pendente' || m.status === 'Agendada' || !m.status).length
    const emAndamento = manFiltradas.filter(m => m.status === 'Em Andamento' || m.status === 'Em execução').length
    const concluidas = manFiltradas.filter(m => m.status === 'Concluída' || m.status === 'Realizada').length

    let vencendo30Dias = 0
    let atrasadas = []
    let proximas = []

    manFiltradas.forEach(m => {
      if (m.status !== 'Concluída') {
        const dStr = m.dataPrevista || m.data || ''
        if (dStr) {
          try {
            const d = parseISO(dStr)
            const diff = differenceInDays(d, hoje)
            if (diff < 0) {
              atrasadas.push({ ...m, dias: Math.abs(diff) })
            } else if (diff <= 30) {
              vencendo30Dias++
              proximas.push({ ...m, dias: diff })
            }
          } catch(e) {}
        }
      }
    })

    return {
      pendentes,
      emAndamento,
      concluidas,
      vencendo30Dias,
      atrasadas: atrasadas.slice(0, 2),
      proximas: proximas.slice(0, 2)
    }
  }, [manFiltradas])

  // =========================================================================
  // 4. CÁLCULOS DE CONTRATOS & APÓLICES
  // =========================================================================
  const statsContratos = useMemo(() => {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    let ativos = 0
    let vencendo30Dias = 0
    let vencidos = 0
    let maisUrgente = null

    apoFiltradas.forEach(a => {
      const dStr = a.vigencia_fim || a.vencimento || ''
      if (dStr) {
        try {
          const d = parseISO(dStr)
          const diff = differenceInDays(d, hoje)
          if (diff < 0) {
            vencidos++
          } else {
            ativos++
            if (diff <= 30) {
              vencendo30Dias++
              if (!maisUrgente || diff < maisUrgente.dias) {
                maisUrgente = { ...a, dias: diff, dataFormatada: format(d, 'dd/MM/yyyy') }
              }
            }
          }
        } catch(e) {}
      } else {
        ativos++
      }
    })

    return {
      ativos: ativos || apoFiltradas.length,
      vencendo30Dias,
      vencidos,
      maisUrgente
    }
  }, [apoFiltradas])

  // =========================================================================
  // 5. CENTRAL DE ALERTAS CRÍTICOS (Clicáveis)
  // =========================================================================
  const alertasCriticos = useMemo(() => {
    const list = []

    // 1. Contas a pagar vencidas
    if (contasVencidas.length > 0) {
      const totalVenc = contasVencidas.reduce((acc, c) => acc + (parseFloat(c.valor) || 0), 0)
      list.push({
        id: 'conta_vencida',
        tipo: 'vermelho',
        icone: '🔴',
        texto: `${contasVencidas.length} conta(s) a pagar vencida(s) — Total: R$ ${totalVenc.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        rota: '/financeiro'
      })
    }

    // 2. Contratos / Apólices vencendo
    if (statsContratos.maisUrgente) {
      list.push({
        id: 'contrato_vencendo',
        tipo: 'vermelho',
        icone: '🔴',
        texto: `Contrato/Seguro (${statsContratos.maisUrgente.seguradora || statsContratos.maisUrgente.tipo || 'Geral'}) vencendo em ${statsContratos.maisUrgente.dias} dias`,
        rota: '/seguro'
      })
    }

    // 3. Cotações aguardando aprovação
    if (statsCotacoes.aguardandoAprovacao > 0) {
      list.push({
        id: 'cotacao_aprovacao',
        tipo: 'amarelo',
        icone: '🟡',
        texto: `${statsCotacoes.aguardandoAprovacao} cotação(ões) aguardando aprovação do Síndico / Conselho`,
        rota: '/cotacoes'
      })
    }

    // 4. Manutenção preventiva atrasada ou próxima
    if (statsManutencoes.atrasadas.length > 0) {
      list.push({
        id: 'manutencao_atrasada',
        tipo: 'vermelho',
        icone: '🔴',
        texto: `Manutenção atrasada: ${statsManutencoes.atrasadas[0].titulo} (${statsManutencoes.atrasadas[0].dias} dias de atraso)`,
        rota: '/manutencoes'
      })
    } else if (statsManutencoes.proximas.length > 0) {
      list.push({
        id: 'manutencao_proxima',
        tipo: 'amarelo',
        icone: '🟡',
        texto: `Manutenção preventiva próxima: ${statsManutencoes.proximas[0].titulo} em ${statsManutencoes.proximas[0].dias} dias`,
        rota: '/manutencoes'
      })
    }

    // 5. Solicitações / Ocorrências pendentes
    const ocAbertas = ocFiltradas.filter(o => o.status !== 'Resolvida' && o.status !== 'Solucionada').length
    if (ocAbertas > 0) {
      list.push({
        id: 'ocorrencias_abertas',
        tipo: 'laranja',
        icone: '🟠',
        texto: `${ocAbertas} solicitação(ões) de morador aguardando resposta ou atendimento`,
        rota: '/ocorrencias'
      })
    }

    return list
  }, [contasVencidas, statsContratos, statsCotacoes, statsManutencoes, ocFiltradas])

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-7xl mx-auto pb-12">
      {/* Topo / Header da Central de Comando */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-pale-300 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black bg-gradient-to-r from-brand-700 to-brand-500 bg-clip-text text-transparent">
              Bom dia, {user?.nome?.split(' ')[0] || 'Gestor'}.
            </h2>
          </div>
          <p className="text-gray-500 font-medium text-xs md:text-sm mt-0.5">
            Central de Comando Alpha — Principais indicadores para decisão rápida.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {user?.role === 'Administrador' && (
            <select
              className="input py-2 text-xs font-bold text-gray-800 w-auto bg-slate-50 border-gray-300"
              value={condoFiltro}
              onChange={e => setCondoFiltro(e.target.value)}
            >
              <option value="Todos">🏢 Todos os Condomínios</option>
              {condominios.map(c => (
                <option key={c.id || c.nome} value={c.nome}>{c.nome}</option>
              ))}
            </select>
          )}

          <button
            onClick={() => navigate('/cotacoes')}
            className="btn-primary flex items-center gap-2 py-2.5 px-5 shadow-lg shadow-brand-700/20 text-xs font-bold uppercase tracking-wider"
          >
            <Plus size={16} />
            <span>+ Nova Cotação</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SEÇÃO 1: VISÃO FINANCEIRA & GRÁFICO MENSAL                                */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 4 Cards Financeiros Clicáveis */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          {/* Card: Saldo Atual */}
          <div
            onClick={() => navigate('/financeiro')}
            className="card p-5 border-l-4 border-l-emerald-500 hover:shadow-md transition-all cursor-pointer group bg-gradient-to-br from-white to-emerald-50/20"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500">Saldo Atual</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                <DollarSign size={16} />
              </div>
            </div>
            <p className="text-2xl md:text-3xl font-black text-gray-900 mt-2">
              R$ {saldoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
              <TrendingUp size={13} /> Saldo operacional consolidado
            </p>
          </div>

          {/* Card: A Receber */}
          <div
            onClick={() => navigate('/boletos')}
            className="card p-5 border-l-4 border-l-blue-500 hover:shadow-md transition-all cursor-pointer group bg-gradient-to-br from-white to-blue-50/20"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500">A Receber</span>
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                <CreditCard size={16} />
              </div>
            </div>
            <p className="text-2xl md:text-3xl font-black text-blue-900 mt-2">
              R$ {aReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-blue-700 font-semibold mt-1">
              Boletos e receitas em aberto
            </p>
          </div>

          {/* Card: A Pagar */}
          <div
            onClick={() => navigate('/financeiro')}
            className="card p-5 border-l-4 border-l-amber-500 hover:shadow-md transition-all cursor-pointer group bg-gradient-to-br from-white to-amber-50/20"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500">A Pagar</span>
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileText size={16} />
              </div>
            </div>
            <p className="text-2xl md:text-3xl font-black text-amber-900 mt-2">
              R$ {aPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-amber-700 font-semibold mt-1">
              Despesas e contas agendadas
            </p>
          </div>

          {/* Card: Inadimplência */}
          <div
            onClick={() => navigate('/inadimplencia')}
            className="card p-5 border-l-4 border-l-rose-500 hover:shadow-md transition-all cursor-pointer group bg-gradient-to-br from-white to-rose-50/20"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500">Inadimplência</span>
              <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                <AlertTriangle size={16} />
              </div>
            </div>
            <p className="text-2xl md:text-3xl font-black text-rose-700 mt-2">
              R$ {inadimplenciaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-rose-600 font-semibold mt-1">
              Taxas condominiais vencidas
            </p>
          </div>
        </div>

        {/* Gráfico Mensal: Receitas x Despesas */}
        <div className="card p-5 border border-pale-300 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Receitas x Despesas</span>
            <span className="text-[11px] text-gray-400">Últimos meses</span>
          </div>

          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR')}`}
                  contentStyle={{ borderRadius: '12px', fontSize: '11px', border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="receitas" name="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesas" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-center gap-4 text-[11px] font-bold text-gray-600 border-t border-gray-100 pt-2">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Receitas</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Despesas</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SEÇÃO 2: OS 3 CARDS DE OPERAÇÃO & DECISÃO                                 */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* CARD 2: COTAÇÕES */}
        <div
          onClick={() => navigate('/cotacoes')}
          className="card p-5 border border-pale-300 hover:border-brand-500 hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                  <FileSpreadsheet size={18} />
                </div>
                <h3 className="font-bold text-base text-gray-900">📊 Cotações</h3>
              </div>
              <ChevronRight size={18} className="text-gray-400 group-hover:text-brand-600 group-hover:translate-x-1 transition-all" />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs mb-4">
              <div className="p-2 rounded-lg bg-slate-50">
                <span className="text-gray-500 block text-[10px]">Em andamento</span>
                <span className="font-bold text-gray-800 text-sm">{statsCotacoes.emAndamento}</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-50">
                <span className="text-gray-500 block text-[10px]">Aguard. orçamento</span>
                <span className="font-bold text-gray-800 text-sm">{statsCotacoes.aguardandoOrcamento}</span>
              </div>
              <div className="p-2 rounded-lg bg-purple-50">
                <span className="text-purple-700 block text-[10px] font-bold">Aguard. aprovação</span>
                <span className="font-black text-purple-900 text-sm">{statsCotacoes.aguardandoAprovacao}</span>
              </div>
              <div className="p-2 rounded-lg bg-emerald-50">
                <span className="text-emerald-700 block text-[10px] font-bold">Concluídas no mês</span>
                <span className="font-black text-emerald-900 text-sm">{statsCotacoes.concluidasMes}</span>
              </div>
            </div>

            {statsCotacoes.prioritaria ? (
              <div className="p-3 rounded-xl border border-indigo-100 bg-indigo-50/40 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-indigo-900 line-clamp-1">
                    {statsCotacoes.prioritaria.numero} — {statsCotacoes.prioritaria.titulo}
                  </span>
                </div>
                <div className="text-gray-600 text-[11px] flex justify-between mt-1">
                  <span>{statsCotacoes.prioritaria.fornecedores?.length || 0} fornecedores</span>
                  <span className="font-bold text-gray-900">
                    Menor: R$ {statsCotacoes.menorProp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <span className="inline-block mt-2 text-[10px] font-bold bg-indigo-200 text-indigo-900 px-2 py-0.5 rounded-full">
                  Status: {statsCotacoes.prioritaria.status}
                </span>
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">Nenhuma cotação cadastrada no momento.</p>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-brand-600">
            <span>Acessar módulo de Cotações</span>
            <ArrowRight size={14} />
          </div>
        </div>

        {/* CARD 3: MANUTENÇÕES */}
        <div
          onClick={() => navigate('/manutencoes')}
          className="card p-5 border border-pale-300 hover:border-brand-500 hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                  <Wrench size={18} />
                </div>
                <h3 className="font-bold text-base text-gray-900">🔧 Manutenções</h3>
              </div>
              <ChevronRight size={18} className="text-gray-400 group-hover:text-brand-600 group-hover:translate-x-1 transition-all" />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs mb-4">
              <div className="p-2 rounded-lg bg-slate-50">
                <span className="text-gray-500 block text-[10px]">Pendentes</span>
                <span className="font-bold text-gray-800 text-sm">{statsManutencoes.pendentes}</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-50">
                <span className="text-gray-500 block text-[10px]">Em andamento</span>
                <span className="font-bold text-gray-800 text-sm">{statsManutencoes.emAndamento}</span>
              </div>
              <div className="p-2 rounded-lg bg-emerald-50">
                <span className="text-emerald-700 block text-[10px] font-bold">Concluídas</span>
                <span className="font-black text-emerald-900 text-sm">{statsManutencoes.concluidas}</span>
              </div>
              <div className="p-2 rounded-lg bg-amber-50">
                <span className="text-amber-700 block text-[10px] font-bold">Vencendo em 30d</span>
                <span className="font-black text-amber-900 text-sm">{statsManutencoes.vencendo30Dias}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 text-xs">
              {statsManutencoes.atrasadas.length > 0 && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 flex items-center justify-between">
                  <span className="font-semibold line-clamp-1">🔴 {statsManutencoes.atrasadas[0].titulo}</span>
                  <span className="text-[10px] font-black text-rose-700 whitespace-nowrap">Atrasada ({statsManutencoes.atrasadas[0].dias}d)</span>
                </div>
              )}
              {statsManutencoes.proximas.length > 0 && (
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between">
                  <span className="font-semibold line-clamp-1">🟡 {statsManutencoes.proximas[0].titulo}</span>
                  <span className="text-[10px] font-black text-amber-700 whitespace-nowrap">Em {statsManutencoes.proximas[0].dias} dias</span>
                </div>
              )}
              {statsManutencoes.atrasadas.length === 0 && statsManutencoes.proximas.length === 0 && (
                <p className="text-xs text-gray-400 italic">Todas as manutenções em dia.</p>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-brand-600">
            <span>Acessar módulo de Manutenções</span>
            <ArrowRight size={14} />
          </div>
        </div>

        {/* CARD 4: CONTRATOS */}
        <div
          onClick={() => navigate('/seguro')}
          className="card p-5 border border-pale-300 hover:border-brand-500 hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                  <Shield size={18} />
                </div>
                <h3 className="font-bold text-base text-gray-900">📄 Contratos & Seguros</h3>
              </div>
              <ChevronRight size={18} className="text-gray-400 group-hover:text-brand-600 group-hover:translate-x-1 transition-all" />
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs mb-4">
              <div className="p-2 rounded-lg bg-slate-50 text-center">
                <span className="text-gray-500 block text-[10px]">Ativos</span>
                <span className="font-bold text-gray-800 text-sm">{statsContratos.ativos}</span>
              </div>
              <div className="p-2 rounded-lg bg-amber-50 text-center">
                <span className="text-amber-700 block text-[10px] font-bold">Em 30 dias</span>
                <span className="font-black text-amber-900 text-sm">{statsContratos.vencendo30Dias}</span>
              </div>
              <div className="p-2 rounded-lg bg-rose-50 text-center">
                <span className="text-rose-700 block text-[10px] font-bold">Vencidos</span>
                <span className="font-black text-rose-900 text-sm">{statsContratos.vencidos}</span>
              </div>
            </div>

            {statsContratos.maisUrgente ? (
              <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/50 text-xs">
                <span className="font-bold text-amber-900 block line-clamp-1">
                  ⚠️ {statsContratos.maisUrgente.seguradora || statsContratos.maisUrgente.tipo || 'Contrato/Apólice'}
                </span>
                <span className="text-[11px] text-amber-800 mt-1 block">
                  Vencimento: {statsContratos.maisUrgente.dataFormatada} (em {statsContratos.maisUrgente.dias} dias)
                </span>
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">Nenhum contrato vencendo nos próximos 30 dias.</p>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-brand-600">
            <span>Acessar Contratos & Seguros</span>
            <ArrowRight size={14} />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SEÇÃO 3: CENTRAL DE ALERTAS CRÍTICOS (⚠️ Atenção)                         */}
      {/* ========================================================================= */}
      <div className="card p-5 border border-pale-300 shadow-md">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
          <div className="flex items-center gap-2 text-rose-700">
            <AlertCircle size={20} />
            <h3 className="font-bold text-base text-gray-900">⚠️ Central de Alertas & Decisões Prioritárias</h3>
          </div>
          <span className="text-xs font-semibold text-gray-400">
            {alertasCriticos.length} pendências que exigem ação
          </span>
        </div>

        {alertasCriticos.length === 0 ? (
          <div className="p-6 text-center text-gray-400 font-medium flex flex-col items-center gap-2">
            <CheckCircle2 size={32} className="text-emerald-500" />
            <p className="text-sm text-gray-700 font-bold">Tudo em dia!</p>
            <p className="text-xs text-gray-500">Nenhum alerta crítico pendente no momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {alertasCriticos.map(al => (
              <div
                key={al.id}
                onClick={() => navigate(al.rota)}
                className="flex items-center justify-between p-3.5 rounded-xl border border-gray-200 bg-white hover:border-brand-500 hover:bg-slate-50/80 hover:shadow-sm transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3 pr-2">
                  <span className="text-base">{al.icone}</span>
                  <span className="text-xs font-bold text-gray-800 group-hover:text-brand-700 transition-colors">
                    {al.texto}
                  </span>
                </div>
                <ChevronRight size={16} className="text-gray-400 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
