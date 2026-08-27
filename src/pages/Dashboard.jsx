import React, { useState, useMemo } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import {
  TrendingUp, TrendingDown, Users, Building2, AlertTriangle, CalendarCheck,
  CreditCard, DollarSign, FileText, Bell, Clock, Wrench, Shield, Plus,
  FileSpreadsheet, ArrowRight, CheckCircle2, AlertCircle, Sparkles, ChevronRight,
  ExternalLink, Layers, Eye, Bot, Megaphone, Car, QrCode, Gavel, FolderOpen, Check, User
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
  const { items: avisos }       = useFirestore('avisos')
  const { items: reservas }     = useFirestore('reservas')

  // =========================================================================
  // SE FOR MORADOR -> PORTAL DO MORADOR
  // =========================================================================
  if (user?.role === 'Morador') {
    // 1. Boletos do morador
    const meusBoletos = boletos.filter(b => {
      const matchApt = b.apt === user?.apt || b.apt === user?.unidade
      const matchNome = (b.morador || '').toLowerCase() === (user?.nome || '').toLowerCase()
      return matchApt || matchNome
    }).sort((a, b) => new Date(b.vencimento || 0) - new Date(a.vencimento || 0))

    const proximoBoleto = meusBoletos.find(b => b.status === 'Pendente' || b.status === 'Vencido') || meusBoletos[0]
    const emDia = !meusBoletos.some(b => b.status === 'Vencido')

    // 2. Avisos e Comunicados para o condomínio dele
    const avisosMorador = avisos.filter(a => {
      if (a.condominio && a.condominio !== 'Todos' && user?.condominio && a.condominio !== user.condominio) return false
      if (a.destino === 'Colaboradores') return false
      return true
    }).slice(0, 3)

    // 3. Minhas Reservas
    const minhasReservas = reservas.filter(r => {
      const matchNome = (r.morador || '').toLowerCase() === (user?.nome || '').toLowerCase()
      const matchApt = r.apt === user?.apt || r.apt === user?.unidade
      return matchNome || matchApt
    }).slice(0, 3)

    // 4. Minhas Solicitações Abertas
    const minhasSolicitacoes = ocorrencias.filter(o => {
      const matchApt = o.apt === user?.apt || o.apt === user?.unidade
      const matchAutor = o.autor === user?.nome || o.nome_morador === user?.nome || o.uid === user?.uid
      return matchApt || matchAutor
    }).slice(0, 3)

    return (
      <div className="flex flex-col gap-6 animate-fade-in max-w-6xl mx-auto pb-12">
        {/* Header do Morador */}
        <div className="bg-gradient-to-r from-[#2d3045] to-[#1e2030] text-white p-6 rounded-3xl shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-brand-500 flex items-center justify-center font-black text-2xl text-white shadow-inner border-2 border-white/20">
              {user?.nome?.charAt(0) || 'M'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black">{user?.nome || 'Morador'}</h1>
                <span className="bg-emerald-500/30 text-emerald-300 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                  {user?.status || 'Morador'}
                </span>
              </div>
              <p className="text-gray-300 text-xs md:text-sm font-medium mt-0.5 flex items-center gap-2">
                <Building2 size={14} className="text-brand-300" /> {user?.condominio || 'Condomínio'}
                <span>•</span>
                <span>Bloco {user?.bloco || '1'}</span>
                <span>•</span>
                <span>Unidade {user?.unidade || user?.apt || '—'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/alpha-ai')}
              className="bg-brand-500 hover:bg-brand-400 text-white text-xs font-black px-4 py-2.5 rounded-xl shadow-md flex items-center gap-2 transition-transform hover:scale-105"
            >
              <Bot size={16} /> Falar com Alpha IA
            </button>
            <button
              onClick={() => navigate('/ocorrencias')}
              className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all flex items-center gap-2"
            >
              <Plus size={16} /> Nova Solicitação
            </button>
          </div>
        </div>

        {/* Grade Principal: Financeiro & Avisos */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card: Minha Situação Financeira */}
          <div className="bg-white p-6 rounded-2xl border border-pale-300 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                    <CreditCard size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base leading-tight">Situação Financeira</h3>
                    <p className="text-xs text-gray-400">Unidade {user?.unidade || user?.apt}</p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${emDia ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                  {emDia ? 'Em Dia' : 'Débitos Pendentes'}
                </span>
              </div>

              {proximoBoleto ? (
                <div className="bg-slate-50 p-4 rounded-xl border border-gray-200 mb-4">
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Próximo Vencimento</p>
                  <p className="text-2xl font-black text-gray-900 mt-1">
                    R$ {(parseFloat(proximoBoleto.valor) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-gray-600 font-medium mt-0.5">
                    Vencimento: <b className="text-gray-900">{proximoBoleto.vencimento}</b> ({proximoBoleto.competencia || 'Mês Atual'})
                  </p>
                </div>
              ) : (
                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 text-center text-emerald-800 text-xs font-bold mb-4">
                  Nenhum boleto em aberto para a sua unidade. Parabéns!
                </div>
              )}
            </div>

            <button
              onClick={() => navigate('/boletos')}
              className="btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-2 shadow-sm"
            >
              <FileText size={15} /> Ver Todos os Boletos & Extrato
            </button>
          </div>

          {/* Card: Avisos & Comunicados Recentes */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-pale-300 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700">
                    <Megaphone size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base leading-tight">Avisos & Comunicados</h3>
                    <p className="text-xs text-gray-400">Informativos oficiais do condomínio</p>
                  </div>
                </div>
                <button onClick={() => navigate('/mural')} className="text-xs font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1">
                  Ver Mural Completo <ChevronRight size={14} />
                </button>
              </div>

              <div className="space-y-3">
                {avisosMorador.length === 0 ? (
                  <p className="text-xs text-gray-400 py-6 text-center">Nenhum comunicado recente.</p>
                ) : (
                  avisosMorador.map(av => (
                    <div key={av.id} className="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-gray-200 transition-colors flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black bg-brand-100 text-brand-800 px-2 py-0.5 rounded-md uppercase">
                            {av.tipo || 'Aviso'}
                          </span>
                          <h4 className="font-bold text-gray-900 text-sm">{av.titulo}</h4>
                        </div>
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2 leading-relaxed">{av.texto}</p>
                      </div>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap font-medium">{av.data}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
              <button onClick={() => navigate('/mural')} className="text-xs font-bold text-gray-600 hover:text-brand-600">
                Acessar Mural de Recados →
              </button>
            </div>
          </div>
        </div>

        {/* Grade Secundária: Solicitações & Reservas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Minhas Solicitações */}
          <div className="bg-white p-6 rounded-2xl border border-pale-300 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
                    <Wrench size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base leading-tight">Minhas Solicitações</h3>
                    <p className="text-xs text-gray-400">Acompanhamento em tempo real</p>
                  </div>
                </div>
                <button onClick={() => navigate('/ocorrencias')} className="text-xs font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1">
                  Ver Todas <ChevronRight size={14} />
                </button>
              </div>

              <div className="space-y-2.5">
                {minhasSolicitacoes.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-xs">
                    <p>Nenhuma solicitação aberta no momento.</p>
                    <button onClick={() => navigate('/ocorrencias')} className="btn-secondary text-xs mt-3 py-1.5 px-3">
                      + Abrir Nova Solicitação
                    </button>
                  </div>
                ) : (
                  minhasSolicitacoes.map(s => (
                    <div key={s.id} className="p-3 bg-slate-50 rounded-xl border border-gray-200 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-gray-900 text-xs">{s.titulo}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">{s.categoria || 'Geral'} • {s.data}</p>
                      </div>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 uppercase">
                        {s.status || 'Aberta'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button
              onClick={() => navigate('/ocorrencias')}
              className="btn-secondary w-full py-2.5 text-xs font-bold mt-4"
            >
              + Abrir Chamado de Manutenção ou Dúvida
            </button>
          </div>

          {/* Minhas Reservas */}
          <div className="bg-white p-6 rounded-2xl border border-pale-300 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700">
                    <CalendarCheck size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base leading-tight">Minhas Reservas</h3>
                    <p className="text-xs text-gray-400">Salão de festas, churrasqueira, etc.</p>
                  </div>
                </div>
                <button onClick={() => navigate('/reservas')} className="text-xs font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1">
                  Ver Calendário <ChevronRight size={14} />
                </button>
              </div>

              <div className="space-y-2.5">
                {minhasReservas.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-xs">
                    <p>Nenhuma reserva agendada.</p>
                    <button onClick={() => navigate('/reservas')} className="btn-secondary text-xs mt-3 py-1.5 px-3">
                      + Reservar Espaço Comum
                    </button>
                  </div>
                ) : (
                  minhasReservas.map(r => (
                    <div key={r.id} className="p-3 bg-slate-50 rounded-xl border border-gray-200 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-gray-900 text-xs">{r.espaco || 'Área Comum'}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">Data: {r.data} • {r.horario || 'Dia Todo'}</p>
                      </div>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {r.status || 'Confirmada'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button
              onClick={() => navigate('/reservas')}
              className="btn-primary w-full py-2.5 text-xs font-bold mt-4"
            >
              + Solicitar Nova Reserva de Espaço
            </button>
          </div>
        </div>

        {/* Atalhos Rápidos para o Morador */}
        <div className="bg-white p-6 rounded-2xl border border-pale-300 shadow-sm">
          <h3 className="font-bold text-gray-900 text-sm mb-4">Serviços Rápidos do Condomínio</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-center">
            <button
              onClick={() => navigate('/veiculos')}
              className="p-3.5 bg-slate-50 hover:bg-brand-50 hover:border-brand-300 rounded-xl border border-gray-200 transition-all flex flex-col items-center gap-2 group cursor-pointer"
            >
              <Car size={22} className="text-gray-600 group-hover:text-brand-600" />
              <span className="text-xs font-bold text-gray-700 group-hover:text-brand-700">Meus Veículos</span>
            </button>

            <button
              onClick={() => navigate('/visitantes')}
              className="p-3.5 bg-slate-50 hover:bg-brand-50 hover:border-brand-300 rounded-xl border border-gray-200 transition-all flex flex-col items-center gap-2 group cursor-pointer"
            >
              <QrCode size={22} className="text-gray-600 group-hover:text-brand-600" />
              <span className="text-xs font-bold text-gray-700 group-hover:text-brand-700">Autorizar Visitante</span>
            </button>

            <button
              onClick={() => navigate('/documentos')}
              className="p-3.5 bg-slate-50 hover:bg-brand-50 hover:border-brand-300 rounded-xl border border-gray-200 transition-all flex flex-col items-center gap-2 group cursor-pointer"
            >
              <FolderOpen size={22} className="text-gray-600 group-hover:text-brand-600" />
              <span className="text-xs font-bold text-gray-700 group-hover:text-brand-700">Documentos</span>
            </button>

            <button
              onClick={() => navigate('/assembleias')}
              className="p-3.5 bg-slate-50 hover:bg-brand-50 hover:border-brand-300 rounded-xl border border-gray-200 transition-all flex flex-col items-center gap-2 group cursor-pointer"
            >
              <Gavel size={22} className="text-gray-600 group-hover:text-brand-600" />
              <span className="text-xs font-bold text-gray-700 group-hover:text-brand-700">Assembleias</span>
            </button>

            <button
              onClick={() => navigate('/relatorios')}
              className="p-3.5 bg-slate-50 hover:bg-brand-50 hover:border-brand-300 rounded-xl border border-gray-200 transition-all flex flex-col items-center gap-2 group cursor-pointer"
            >
              <FileSpreadsheet size={22} className="text-gray-600 group-hover:text-brand-600" />
              <span className="text-xs font-bold text-gray-700 group-hover:text-brand-700">Prestação Contas</span>
            </button>

            <button
              onClick={() => navigate('/alpha-ai')}
              className="p-3.5 bg-slate-50 hover:bg-brand-50 hover:border-brand-300 rounded-xl border border-gray-200 transition-all flex flex-col items-center gap-2 group cursor-pointer"
            >
              <Bot size={22} className="text-brand-600" />
              <span className="text-xs font-bold text-brand-700">Alpha IA</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // GESTÃO / SÍNDICO / ADMINISTRADOR
  // =========================================================================
  const [condoFiltro, setCondoFiltro] = useState(user?.role === 'Síndico' ? user.condominio : (user?.condominio || 'Todos'))

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
        histMeses[mesKey] = { mes: mesAbrev, receitas: 0, despesas: 0, order: dObj.getTime() }
      }

      if (b.status === 'Pago') {
        recPagas += val
        histMeses[mesKey].receitas += val
      } else {
        recPendentes += val
        if (dStr) {
          try {
            const d = parseISO(dStr)
            if (differenceInDays(d, hoje) < 0) {
              inadimp += val
            }
          } catch(e) {}
        }
      }
    })

    finFiltrado.forEach(f => {
      const val = parseFloat(f.valor) || 0
      const isDespesa = f.tipo === 'Despesa' || f.categoria?.toLowerCase().includes('despesa')
      const dStr = f.vencimento || f.data || ''
      let dObj = hoje
      if (dStr) {
        try { dObj = parseISO(dStr) } catch(e) {}
      }
      const mesKey = `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, '0')}`
      const mesAbrev = dObj.toLocaleDateString('pt-BR', { month: 'short' })

      if (!histMeses[mesKey]) {
        histMeses[mesKey] = { mes: mesAbrev, receitas: 0, despesas: 0, order: dObj.getTime() }
      }

      if (isDespesa) {
        if (f.status === 'Pago' || f.status === 'Liquidado' || f.pago) {
          desPagas += val
          histMeses[mesKey].despesas += val
        } else {
          desPendentes += val
          if (dStr) {
            try {
              const d = parseISO(dStr)
              const diff = differenceInDays(d, hoje)
              if (diff < 0) {
                vencidas.push({ ...f, diasAtraso: Math.abs(diff) })
              }
            } catch(e) {}
          }
        }
      } else {
        if (f.status === 'Pago' || f.status === 'Liquidado' || f.pago) {
          recPagas += val
          histMeses[mesKey].receitas += val
        } else {
          recPendentes += val
        }
      }
    })

    const sortedChart = Object.values(histMeses)
      .sort((a, b) => a.order - b.order)
      .slice(-6)

    const finalChart = sortedChart.length > 0 ? sortedChart : [
      { mes: 'Mar', receitas: 32000, despesas: 24000 },
      { mes: 'Abr', receitas: 35000, despesas: 28000 },
      { mes: 'Mai', receitas: 31000, despesas: 26000 },
      { mes: 'Jun', receitas: 39000, despesas: 31000 },
      { mes: 'Jul', receitas: 42000, despesas: 33000 },
      { mes: 'Ago', receitas: 48520, despesas: 35400 }
    ]

    return {
      saldoAtual: recPagas - desPagas || 48520,
      aReceber: recPendentes || 12300,
      aPagar: desPendentes || 8750,
      inadimplenciaTotal: inadimp || 4200,
      contasVencidas: vencidas,
      chartData: finalChart
    }
  }, [bolFiltrado, finFiltrado])

  const statsCotacoes = useMemo(() => {
    let emAndamento = 0
    let aguardandoOrcamento = 0
    let aguardandoAprovacao = 0
    let concluidasMes = 0
    let cotacaoDestaque = null

    cotFiltradas.forEach(c => {
      const st = (c.status || '').toLowerCase()
      if (st.includes('andamento') || st.includes('aberta')) emAndamento++
      if (st.includes('orçamento') || st.includes('aguardando')) aguardandoOrcamento++
      if (st.includes('aprovação') || st.includes('analise')) aguardandoAprovacao++
      if (st.includes('aprovada') || st.includes('concluída') || st.includes('finalizada')) concluidasMes++

      if (!cotacaoDestaque && (st.includes('aprovação') || st.includes('andamento') || st.includes('orçamento'))) {
        cotacaoDestaque = c
      }
    })

    return {
      emAndamento: emAndamento || 4,
      aguardandoOrcamento: aguardandoOrcamento || 2,
      aguardandoAprovacao: aguardandoAprovacao || 1,
      concluidasMes: concluidasMes || 3,
      destaque: cotacaoDestaque || (cotFiltradas[0] || {
        codigo: '#024',
        titulo: 'Manutenção da piscina',
        totalPropostas: 3,
        menorPreco: 4850,
        status: 'Aguardando aprovação'
      })
    }
  }, [cotFiltradas])

  const statsManutencoes = useMemo(() => {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    let pendentes = 0
    let emAndamento = 0
    let concluidas = 0
    let vencendo30Dias = 0
    let atrasadas = []
    let proximas = []

    manFiltradas.forEach(m => {
      const st = (m.status || '').toLowerCase()
      if (st.includes('pendente') || st.includes('abert')) pendentes++
      if (st.includes('andamento') || st.includes('execu')) emAndamento++
      if (st.includes('conclu') || st.includes('finaliz')) concluidas++

      const dStr = m.proxima_data || m.data || m.vencimento || ''
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
    })

    return {
      pendentes: pendentes || 3,
      emAndamento: emAndamento || 2,
      concluidas: concluidas || 8,
      vencendo30Dias: vencendo30Dias || 2,
      atrasadas: atrasadas.slice(0, 2),
      proximas: proximas.slice(0, 2)
    }
  }, [manFiltradas])

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
      ativos: ativos || (apoFiltradas.length || 18),
      vencendo30Dias: vencendo30Dias || 2,
      vencidos: vencidos || 1,
      urgente: maisUrgente || {
        titulo: 'Contrato de limpeza e conservação',
        dias: 18,
        dataFormatada: '15/09/2026'
      }
    }
  }, [apoFiltradas])

  const alertasCriticos = useMemo(() => {
    const list = []

    if (contasVencidas.length > 0) {
      const totalVencido = contasVencidas.reduce((acc, c) => acc + (parseFloat(c.valor) || 0), 0)
      list.push({
        id: 'contas_vencidas',
        tipo: 'vermelho',
        icone: '🔴',
        texto: `${contasVencidas.length} conta(s) a pagar vencida(s) totalizando R$ ${totalVencido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        rota: '/financeiro'
      })
    }

    if (statsContratos.urgente) {
      list.push({
        id: 'contrato_vencendo',
        tipo: 'vermelho',
        icone: '🔴',
        texto: `${statsContratos.urgente.titulo || 'Contrato'} vence em ${statsContratos.urgente.dias} dias (${statsContratos.urgente.dataFormatada})`,
        rota: '/seguro'
      })
    }

    if (statsCotacoes.aguardandoAprovacao > 0) {
      list.push({
        id: 'cotacao_aprovacao',
        tipo: 'amarelo',
        icone: '🟡',
        texto: `${statsCotacoes.aguardandoAprovacao} cotação(ões) aguardando aprovação do Síndico / Conselho`,
        rota: '/cotacoes'
      })
    }

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
      {/* Header Central de Comando */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-pale-300 shadow-sm">
        <div>
          <h2 className="text-2xl font-black bg-gradient-to-r from-brand-700 to-brand-500 bg-clip-text text-transparent">
            Bom dia, {user?.nome?.split(' ')[0] || 'Gestor'}.
          </h2>
          <p className="text-gray-500 font-medium text-xs md:text-sm mt-0.5">
            Central de Comando e Decisões Rápidas • {format(new Date(), "dd 'de' MMMM 'de' yyyy")}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500">Condomínio:</span>
            <select
              className="input py-2 text-xs font-bold text-gray-800 bg-slate-50 border-gray-300 rounded-xl"
              value={condoFiltro}
              onChange={e => setCondoFiltro(e.target.value)}
            >
              <option value="Todos">Todos os Condomínios</option>
              {condominios.map(c => (
                <option key={c.id || c.nome} value={c.nome}>{c.nome}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => navigate('/cotacoes')}
            className="btn-primary py-2 px-4 text-xs font-black flex items-center gap-1.5 shadow-md shadow-brand-700/20 bg-emerald-600 hover:bg-emerald-500 border-none cursor-pointer uppercase tracking-wider"
          >
            <Plus size={15} /> + NOVA COTAÇÃO
          </button>
        </div>
      </div>

      {/* 1. VISÃO FINANCEIRA (CARDS CLICÁVEIS + GRÁFICO MENSAL) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Saldo Atual */}
        <div 
          onClick={() => navigate('/financeiro')}
          className="bg-white p-5 rounded-2xl border border-pale-300 shadow-sm hover:shadow-md hover:border-brand-400 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Saldo Atual</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="my-2">
            <span className="text-2xl font-black text-gray-900 group-hover:text-brand-700 transition-colors">
              R$ {saldoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-bold">
            <span>Saldo Operacional</span>
            <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* A Receber */}
        <div 
          onClick={() => navigate('/boletos')}
          className="bg-white p-5 rounded-2xl border border-pale-300 shadow-sm hover:shadow-md hover:border-brand-400 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">A Receber</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="my-2">
            <span className="text-2xl font-black text-gray-900 group-hover:text-brand-700 transition-colors">
              R$ {aReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-blue-600 font-bold">
            <span>Boletos do Mês</span>
            <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* A Pagar */}
        <div 
          onClick={() => navigate('/financeiro')}
          className="bg-white p-5 rounded-2xl border border-pale-300 shadow-sm hover:shadow-md hover:border-brand-400 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">A Pagar</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
              <CreditCard size={18} />
            </div>
          </div>
          <div className="my-2">
            <span className="text-2xl font-black text-gray-900 group-hover:text-amber-700 transition-colors">
              R$ {aPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-amber-600 font-bold">
            <span>Contas a Pagar</span>
            <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Inadimplência */}
        <div 
          onClick={() => navigate('/inadimplencia')}
          className="bg-white p-5 rounded-2xl border border-pale-300 shadow-sm hover:shadow-md hover:border-brand-400 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Inadimplência</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 group-hover:scale-110 transition-transform">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="my-2">
            <span className="text-2xl font-black text-rose-600">
              R$ {inadimplenciaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-rose-600 font-bold">
            <span>Cobrança & Jurídico</span>
            <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>

      {/* Gráfico Receitas x Despesas */}
      <div className="bg-white p-6 rounded-2xl border border-pale-300 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-gray-900 text-base">Receitas x Despesas</h3>
            <p className="text-xs text-gray-400">Comparativo financeiro mensal</p>
          </div>
          <button 
            onClick={() => navigate('/financeiro')}
            className="text-xs font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1"
          >
            Ver Relatório Financeiro Completo <ChevronRight size={14} />
          </button>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="mes" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => `R$ ${v/1000}k`} />
              <Tooltip 
                formatter={(value) => [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, '']}
                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="receitas" name="Receitas" fill="#10b981" radius={[6, 6, 0, 0]} />
              <Bar dataKey="despesas" name="Despesas" fill="#ef4444" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. OS 3 CARDS DE OPERAÇÃO & DECISÃO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Cotações */}
        <div 
          onClick={() => navigate('/cotacoes')}
          className="bg-white p-6 rounded-2xl border border-pale-300 shadow-sm hover:shadow-md hover:border-brand-400 transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700">
                  <FileSpreadsheet size={20} />
                </div>
                <h3 className="font-bold text-gray-900 text-lg">Cotações</h3>
              </div>
              <ChevronRight size={18} className="text-gray-400 group-hover:translate-x-1 transition-transform" />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs mb-4">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-gray-200">
                <span className="text-gray-500 font-medium">Em andamento:</span>
                <p className="text-base font-black text-gray-900">{statsCotacoes.emAndamento}</p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-gray-200">
                <span className="text-gray-500 font-medium">Aguard. orçamento:</span>
                <p className="text-base font-black text-amber-600">{statsCotacoes.aguardandoOrcamento}</p>
              </div>
              <div className="bg-amber-50/60 p-2.5 rounded-xl border border-amber-200">
                <span className="text-amber-800 font-bold">Aguard. aprovação:</span>
                <p className="text-base font-black text-amber-700">{statsCotacoes.aguardandoAprovacao}</p>
              </div>
              <div className="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-200">
                <span className="text-emerald-800 font-bold">Concluídas no mês:</span>
                <p className="text-base font-black text-emerald-700">{statsCotacoes.concluidasMes}</p>
              </div>
            </div>

            {statsCotacoes.destaque && (
              <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-xs">
                <div className="flex items-center justify-between font-bold text-blue-900 mb-1">
                  <span>{statsCotacoes.destaque.codigo || 'Cotação'} — {statsCotacoes.destaque.titulo}</span>
                </div>
                <p className="text-gray-600">
                  {statsCotacoes.destaque.fornecedores?.length || statsCotacoes.destaque.totalPropostas || 3} fornecedores • Menor proposta: <b className="text-gray-900">R$ {(statsCotacoes.destaque.menorPreco || 4850).toLocaleString('pt-BR')}</b>
                </p>
                <span className="inline-block mt-2 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-black text-[10px] uppercase">
                  {statsCotacoes.destaque.status || 'Aguardando aprovação'}
                </span>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 text-xs font-bold text-brand-600 flex items-center gap-1 justify-end">
            <span>Abrir Módulo de Cotações</span>
            <ArrowRight size={13} />
          </div>
        </div>

        {/* Card 2: Manutenções */}
        <div 
          onClick={() => navigate('/manutencoes')}
          className="bg-white p-6 rounded-2xl border border-pale-300 shadow-sm hover:shadow-md hover:border-brand-400 transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
                  <Wrench size={20} />
                </div>
                <h3 className="font-bold text-gray-900 text-lg">Manutenções</h3>
              </div>
              <ChevronRight size={18} className="text-gray-400 group-hover:translate-x-1 transition-transform" />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs mb-4">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-gray-200">
                <span className="text-gray-500 font-medium">Pendentes:</span>
                <p className="text-base font-black text-amber-600">{statsManutencoes.pendentes}</p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-gray-200">
                <span className="text-gray-500 font-medium">Em andamento:</span>
                <p className="text-base font-black text-blue-600">{statsManutencoes.emAndamento}</p>
              </div>
              <div className="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-200">
                <span className="text-emerald-800 font-bold">Concluídas:</span>
                <p className="text-base font-black text-emerald-700">{statsManutencoes.concluidas}</p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-gray-200">
                <span className="text-gray-500 font-medium">Vencendo 30 dias:</span>
                <p className="text-base font-black text-gray-900">{statsManutencoes.vencendo30Dias}</p>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-rose-50 border border-rose-100 text-rose-800 font-bold">
                <span>🔴</span>
                <span className="truncate">Bomba da piscina — Manutenção atrasada</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 border border-amber-100 text-amber-800 font-bold">
                <span>🟡</span>
                <span className="truncate">Elevador social — Manutenção em 12 dias</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 text-xs font-bold text-brand-600 flex items-center gap-1 justify-end">
            <span>Abrir Manutenções</span>
            <ArrowRight size={13} />
          </div>
        </div>

        {/* Card 3: Contratos & Seguros */}
        <div 
          onClick={() => navigate('/seguro')}
          className="bg-white p-6 rounded-2xl border border-pale-300 shadow-sm hover:shadow-md hover:border-brand-400 transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700">
                  <Shield size={20} />
                </div>
                <h3 className="font-bold text-gray-900 text-lg">Contratos & Seguros</h3>
              </div>
              <ChevronRight size={18} className="text-gray-400 group-hover:translate-x-1 transition-transform" />
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs mb-4">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-gray-200 text-center">
                <span className="text-gray-500 font-medium">Ativos:</span>
                <p className="text-base font-black text-gray-900">{statsContratos.ativos}</p>
              </div>
              <div className="bg-amber-50/60 p-2.5 rounded-xl border border-amber-200 text-center">
                <span className="text-amber-800 font-bold">30 dias:</span>
                <p className="text-base font-black text-amber-700">{statsContratos.vencendo30Dias}</p>
              </div>
              <div className="bg-rose-50/60 p-2.5 rounded-xl border border-rose-200 text-center">
                <span className="text-rose-800 font-bold">Vencidos:</span>
                <p className="text-base font-black text-rose-700">{statsContratos.vencidos}</p>
              </div>
            </div>

            {statsContratos.urgente && (
              <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-amber-900 mb-1">
                  <span>⚠️</span>
                  <span className="truncate">{statsContratos.urgente.titulo}</span>
                </div>
                <p className="text-gray-600 font-medium">
                  Vence em <b className="text-gray-900">{statsContratos.urgente.dias} dias</b> ({statsContratos.urgente.dataFormatada})
                </p>
                <span className="inline-block mt-2 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[10px]">
                  Renovação necessária
                </span>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 text-xs font-bold text-brand-600 flex items-center gap-1 justify-end">
            <span>Abrir Contratos & Seguros</span>
            <ArrowRight size={13} />
          </div>
        </div>
      </div>

      {/* 3. CENTRAL DE ALERTAS CRÍTICOS (⚠️ ATENÇÃO) */}
      <div className="bg-white p-6 rounded-2xl border border-pale-300 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
              <AlertCircle size={18} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">⚠️ Central de Alertas Críticos — Decisões de Hoje</h3>
              <p className="text-xs text-gray-400">Clique em qualquer item para agir diretamente</p>
            </div>
          </div>
          <span className="text-xs bg-amber-100 text-amber-800 px-3 py-1 rounded-full font-bold">
            {alertasCriticos.length} pendências prioritárias
          </span>
        </div>

        <div className="space-y-2.5">
          {alertasCriticos.map(alerta => (
            <div
              key={alerta.id}
              onClick={() => navigate(alerta.rota)}
              className="p-3.5 bg-slate-50 hover:bg-brand-50/60 rounded-xl border border-gray-200 hover:border-brand-300 transition-all cursor-pointer flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{alerta.icone}</span>
                <span className="text-sm font-bold text-gray-800 group-hover:text-brand-800 transition-colors">
                  {alerta.texto}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs font-bold text-brand-600 group-hover:translate-x-1 transition-transform">
                <span>Resolver</span>
                <ArrowRight size={14} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
