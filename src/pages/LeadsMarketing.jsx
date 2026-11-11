import React, { useState, useMemo } from 'react'
import {
  Target,
  Users,
  Eye,
  MessageCircle,
  ExternalLink,
  Sparkles,
  TrendingUp,
  Search,
  Filter,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Building2,
  X,
  Send,
  PhoneCall,
  Calendar,
  FileText
} from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'

const STATUS_OPTIONS = [
  { id: 'novo', label: 'Novo Lead', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { id: 'em_contato', label: 'Em Contato', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  { id: 'reuniao_agendada', label: 'Reunião Agendada', color: 'bg-purple-100 text-purple-700 border-purple-300' },
  { id: 'proposta_enviada', label: 'Proposta Enviada', color: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
  { id: 'fechado', label: 'Contrato Fechado 🎉', color: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold' },
  { id: 'arquivado', label: 'Arquivado', color: 'bg-gray-100 text-gray-600 border-gray-300' },
]

export default function LeadsMarketing() {
  const { user } = useAuth()
  const { data: leads, loading: loadingLeads, update: updateLead, remove: removeLead } = useFirestore('leads_diagnosticos')
  const { data: stats, loading: loadingStats } = useFirestore('site_stats')

  const [activeTab, setActiveTab] = useState('todos')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedLeadModal, setSelectedLeadModal] = useState(null)

  // 1. Cálculos de Estatísticas de Visitas do Site
  const analyticsSummary = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0]
    let totalPageviews = 0
    let totalWhatsappClicks = 0
    let todayPageviews = 0
    let todayWhatsapp = 0
    let pagesMap = {}
    let referrersMap = {}

    if (Array.isArray(stats)) {
      stats.forEach(item => {
        const pv = Number(item.pageviews || 0)
        const wa = Number(item.whatsapp_clicks || 0)
        totalPageviews += pv
        totalWhatsappClicks += wa

        if (item.date === todayStr || item.id === todayStr) {
          todayPageviews += pv
          todayWhatsapp += wa
        }

        if (item.pages && typeof item.pages === 'object') {
          Object.entries(item.pages).forEach(([p, count]) => {
            pagesMap[p] = (pagesMap[p] || 0) + Number(count || 0)
          })
        }

        if (item.referrers && typeof item.referrers === 'object') {
          Object.entries(item.referrers).forEach(([ref, count]) => {
            referrersMap[ref] = (referrersMap[ref] || 0) + Number(count || 0)
          })
        }
      })
    }

    const sortedPages = Object.entries(pagesMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    const sortedReferrers = Object.entries(referrersMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)

    return {
      totalPageviews,
      totalWhatsappClicks,
      todayPageviews,
      todayWhatsapp,
      sortedPages,
      sortedReferrers,
    }
  }, [stats])

  // 2. Filtro e Ordenação dos Leads
  const filteredLeads = useMemo(() => {
    if (!Array.isArray(leads)) return []

    return leads
      .filter(l => {
        const matchesTab = activeTab === 'todos' ? true : (l.status || 'novo') === activeTab
        const term = searchTerm.toLowerCase()
        const matchesSearch =
          !term ||
          (l.nome && l.nome.toLowerCase().includes(term)) ||
          (l.condominio && l.condominio.toLowerCase().includes(term)) ||
          (l.bairro && l.bairro.toLowerCase().includes(term)) ||
          (l.whatsapp && l.whatsapp.includes(term)) ||
          (l.desafio_principal && l.desafio_principal.toLowerCase().includes(term))

        return matchesTab && matchesSearch
      })
      .sort((a, b) => {
        const timeA = new Date(a.created_at || a._createdAt || 0).getTime()
        const timeB = new Date(b.created_at || b._createdAt || 0).getTime()
        return timeB - timeA
      })
  }, [leads, activeTab, searchTerm])

  const totalLeadsCount = leads?.length || 0

  // 3. Ação: Abrir conversa no WhatsApp com texto personalizado
  const handleOpenWhatsApp = (lead) => {
    const rawNumber = String(lead.whatsapp || '').replace(/\D/g, '')
    const fullNumber = rawNumber.startsWith('55') ? rawNumber : `55${rawNumber}`
    const msg = encodeURIComponent(
      `Olá, ${lead.nome}! Sou da equipe Alpha Soluções Condominiais.\n\n` +
      `Vi que você gerou o Diagnóstico Inteligente para o *${lead.condominio}* (${lead.bairro || 'João Pessoa'}), com foco prioritário em *${lead.desafio_principal || 'gestão e custos'}*.\n\n` +
      `Gostaria de agendar um café ou uma rápida reunião para apresentar as soluções práticas e a estimativa de redução de custos que preparamos para o seu condomínio. Como está sua disponibilidade esta semana?`
    )
    window.open(`https://wa.me/${fullNumber}?text=${msg}`, '_blank')
  }

  // 4. Ação: Atualizar status do lead
  const handleStatusChange = async (leadId, newStatus) => {
    try {
      await updateLead(leadId, { status: newStatus, atualizadoEm: new Date().toISOString() })
    } catch (err) {
      console.error('Erro ao atualizar status do lead:', err)
    }
  }

  // 5. Ação: Excluir lead com confirmação
  const handleDeleteLead = async (leadId, nomeCondominio) => {
    if (window.confirm(`Tem certeza que deseja excluir o lead do "${nomeCondominio}"?`)) {
      try {
        await removeLead(leadId)
        if (selectedLeadModal?.id === leadId) setSelectedLeadModal(null)
      } catch (err) {
        console.error('Erro ao remover lead:', err)
      }
    }
  }

  const getScoreBadge = (score) => {
    const s = Number(score || 75)
    if (s >= 80) return 'bg-emerald-100 text-emerald-800 border-emerald-300'
    if (s >= 65) return 'bg-amber-100 text-amber-800 border-amber-300'
    return 'bg-rose-100 text-rose-800 border-rose-300'
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-cream-400 shadow-sm">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 border border-brand-200 text-xs font-bold text-brand-700 uppercase tracking-wide mb-1">
            <Target size={14} className="text-brand-600" />
            <span>Captação & Performance Comercial</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 font-display">
            🎯 Leads & Visitas do Site Oficial
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            Acompanhe em tempo real quem visita o site <b className="text-brand-700">alphaadmsc.com.br</b> e converta síndicos em contratos fechados.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="https://alphaadmsc.com.br/diagnostico"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-sm transition"
          >
            <Sparkles size={14} />
            <span>Ver Diagnóstico no Site</span>
            <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* CARDS DE MÉTRICAS DO SITE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Visitas Totais */}
        <div className="bg-white p-5 rounded-2xl border border-cream-400 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Visitas no Site</p>
            <h3 className="text-2xl font-bold text-gray-800 mt-1">
              {loadingStats ? '...' : analyticsSummary.totalPageviews}
            </h3>
            <p className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              {analyticsSummary.todayPageviews} visitas hoje
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
            <Eye size={22} />
          </div>
        </div>

        {/* Card 2: Cliques no WhatsApp do Site */}
        <div className="bg-white p-5 rounded-2xl border border-cream-400 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliques no WhatsApp</p>
            <h3 className="text-2xl font-bold text-gray-800 mt-1">
              {loadingStats ? '...' : analyticsSummary.totalWhatsappClicks}
            </h3>
            <p className="text-[11px] text-emerald-600 font-medium mt-1">
              {analyticsSummary.todayWhatsapp} contatos hoje
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
            <MessageCircle size={22} />
          </div>
        </div>

        {/* Card 3: Total de Leads / Diagnósticos */}
        <div className="bg-white p-5 rounded-2xl border border-cream-400 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Diagnósticos Gerados</p>
            <h3 className="text-2xl font-bold text-brand-700 mt-1">
              {loadingLeads ? '...' : totalLeadsCount}
            </h3>
            <p className="text-[11px] text-gray-500 mt-1">
              Condomínios cadastrados
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center border border-brand-200">
            <Target size={22} />
          </div>
        </div>

        {/* Card 4: Taxa de Conversão */}
        <div className="bg-white p-5 rounded-2xl border border-cream-400 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Taxa de Conversão</p>
            <h3 className="text-2xl font-bold text-purple-700 mt-1">
              {analyticsSummary.totalPageviews > 0
                ? `${((totalLeadsCount / analyticsSummary.totalPageviews) * 100).toFixed(1)}%`
                : '100%'}
            </h3>
            <p className="text-[11px] text-purple-600 mt-1 flex items-center gap-1 font-medium">
              <TrendingUp size={12} />
              Visitante ➔ Lead Ativo
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-200">
            <Sparkles size={22} />
          </div>
        </div>
      </div>

      {/* MURAL DE LEADS DE DIAGNÓSTICO */}
      <div className="bg-white rounded-2xl border border-cream-400 shadow-sm overflow-hidden">
        {/* BARRA DE FILTROS E BUSCA */}
        <div className="p-4 sm:p-5 border-b border-cream-400 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-cream-50/50">
          {/* TABS DE STATUS */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <button
              onClick={() => setActiveTab('todos')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                activeTab === 'todos'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-cream-200 border border-cream-300'
              }`}
            >
              Todos ({totalLeadsCount})
            </button>
            {STATUS_OPTIONS.map(st => {
              const count = leads?.filter(l => (l.status || 'novo') === st.id).length || 0
              return (
                <button
                  key={st.id}
                  onClick={() => setActiveTab(st.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    activeTab === st.id
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'bg-white text-gray-600 hover:bg-cream-200 border border-cream-300'
                  }`}
                >
                  {st.label} ({count})
                </button>
              )
            })}
          </div>

          {/* BUSCA RÁPIDA */}
          <div className="relative min-w-[240px]">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar síndico, condomínio ou bairro..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-cream-400 rounded-xl text-xs focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>

        {/* LISTA / TABELA DE LEADS */}
        {loadingLeads ? (
          <div className="p-12 text-center text-gray-500 text-sm">
            <div className="w-8 h-8 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-3" />
            Carregando leads do banco de dados...
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-sm space-y-3">
            <Target size={36} className="text-gray-300 mx-auto" />
            <p className="font-semibold text-gray-700">Nenhum diagnóstico encontrado para este filtro.</p>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              Assim que um síndico preencher o teste gratuito no site oficial da Alpha, o contato dele aparecerá aqui instantaneamente com a análise da IA.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-cream-300">
            {filteredLeads.map(lead => {
              const currentStatus = STATUS_OPTIONS.find(s => s.id === (lead.status || 'novo')) || STATUS_OPTIONS[0]
              const dataFormatada = lead.created_at
                ? new Date(lead.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                : 'Data recente'

              return (
                <div
                  key={lead.id}
                  className="p-4 sm:p-5 hover:bg-cream-50/50 transition flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  {/* DADOS PRINCIPAIS DO CONDOMÍNIO E SÍNDICO */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-base text-gray-800 flex items-center gap-1.5">
                        <Building2 size={16} className="text-brand-600 shrink-0" />
                        <span className="truncate">{lead.condominio}</span>
                      </span>

                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-cream-200 text-gray-700 font-semibold border border-cream-300">
                        📍 {lead.bairro || 'João Pessoa'}
                      </span>

                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${getScoreBadge(
                          lead.health_score
                        )}`}
                      >
                        Score: {lead.health_score || 75}/100
                      </span>
                    </div>

                    <div className="text-xs text-gray-600 flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5">
                      <span className="font-medium text-gray-700 flex items-center gap-1">
                        <Users size={13} className="text-gray-400" />
                        Contato: <b>{lead.nome}</b>
                      </span>
                      <span>📱 {lead.whatsapp}</span>
                      <span>🏢 {lead.tipo} · {lead.unidades}</span>
                      <span className="text-gray-400 flex items-center gap-1">
                        <Clock size={12} /> {dataFormatada}
                      </span>
                    </div>

                    {/* DOR PRINCIPAL DECLARADA */}
                    <div className="pt-1">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-800">
                        <AlertTriangle size={12} />
                        Maior dor: {lead.desafio_principal} · Inadimplência: {lead.inadimplencia_estimada || 'Não informada'}
                      </span>
                    </div>
                  </div>

                  {/* AÇÕES E CONTROLE DE STATUS */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0 pt-2 lg:pt-0">
                    {/* SELETOR DE STATUS */}
                    <select
                      value={lead.status || 'novo'}
                      onChange={e => handleStatusChange(lead.id, e.target.value)}
                      className={`text-xs font-bold px-3 py-2 rounded-xl border outline-none cursor-pointer ${currentStatus.color}`}
                    >
                      {STATUS_OPTIONS.map(st => (
                        <option key={st.id} value={st.id}>
                          {st.label}
                        </option>
                      ))}
                    </select>

                    {/* BOTÃO VER DIAGNÓSTICO IA */}
                    <button
                      onClick={() => setSelectedLeadModal(lead)}
                      className="px-3.5 py-2 rounded-xl bg-white hover:bg-cream-100 text-gray-700 border border-cream-400 text-xs font-semibold transition flex items-center gap-1.5"
                      title="Ver Raio-X completo da IA"
                    >
                      <Sparkles size={14} className="text-brand-600" />
                      <span>Ver Raio-X</span>
                    </button>

                    {/* BOTÃO CHAMAR NO WHATSAPP */}
                    <button
                      onClick={() => handleOpenWhatsApp(lead)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition flex items-center gap-1.5"
                      title="Abrir WhatsApp com mensagem pronta"
                    >
                      <MessageCircle size={15} />
                      <span>Chamar no WhatsApp</span>
                    </button>

                    {/* BOTÃO EXCLUIR */}
                    <button
                      onClick={() => handleDeleteLead(lead.id, lead.condominio)}
                      className="p-2 rounded-xl text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition"
                      title="Excluir Lead"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* RESUMO DOS CANAIS E PÁGINAS MAIS ACESSADAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Páginas Mais Lidas */}
        <div className="bg-white p-5 rounded-2xl border border-cream-400 shadow-sm space-y-3">
          <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <FileText size={16} className="text-brand-600" />
            Páginas & Artigos Mais Acessados no Site
          </h4>
          {analyticsSummary.sortedPages.length === 0 ? (
            <p className="text-xs text-gray-500 py-3">Registrando acessos do site...</p>
          ) : (
            <div className="space-y-2">
              {analyticsSummary.sortedPages.map(([page, count], idx) => (
                <div key={idx} className="flex items-center justify-between text-xs py-1.5 border-b border-cream-200">
                  <span className="text-gray-700 font-medium truncate max-w-[260px] sm:max-w-xs">{page}</span>
                  <span className="font-bold text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded-full border border-brand-200">
                    {count} views
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Origens de Acesso */}
        <div className="bg-white p-5 rounded-2xl border border-cream-400 shadow-sm space-y-3">
          <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <TrendingUp size={16} className="text-purple-600" />
            Canais de Atração dos Visitantes
          </h4>
          {analyticsSummary.sortedReferrers.length === 0 ? (
            <p className="text-xs text-gray-500 py-3">Registrando canais de atração...</p>
          ) : (
            <div className="space-y-2">
              {analyticsSummary.sortedReferrers.map(([ref, count], idx) => (
                <div key={idx} className="flex items-center justify-between text-xs py-1.5 border-b border-cream-200">
                  <span className="text-gray-700 font-medium capitalize">
                    {ref === 'direto' ? '🔗 Acesso Direto / WhatsApp' : `🌐 ${ref}`}
                  </span>
                  <span className="font-bold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
                    {count} visitas
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MODAL DETALHES DO DIAGNÓSTICO (RAIO-X IA) */}
      {selectedLeadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl border border-cream-400 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-cream-300">
              <div>
                <span className="text-[11px] font-bold text-brand-600 uppercase tracking-wider">
                  Raio-X de Saúde Condominial
                </span>
                <h3 className="text-xl font-bold text-gray-800 font-display mt-0.5">
                  {selectedLeadModal.condominio}
                </h3>
                <p className="text-xs text-gray-500">
                  {selectedLeadModal.bairro} · {selectedLeadModal.unidades} · {selectedLeadModal.tipo}
                </p>
              </div>
              <button
                onClick={() => setSelectedLeadModal(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-cream-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Score & Nível */}
            <div className="p-4 rounded-xl bg-cream-50 border border-cream-300 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500">Score de Saúde Calculado</p>
                <span className="text-3xl font-extrabold text-gray-800">
                  {selectedLeadModal.health_score || 75}
                  <span className="text-sm font-normal text-gray-400">/100</span>
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs px-3 py-1 rounded-full font-bold bg-white border border-cream-400 text-gray-700 shadow-sm">
                  {selectedLeadModal.nivel_alerta || 'Atenção Operacional'}
                </span>
                <p className="text-[11px] text-emerald-700 font-bold mt-1.5">
                  {selectedLeadModal.potencial_economia}
                </p>
              </div>
            </div>

            {/* Resumo IA */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                Resumo da Avaliação:
              </h4>
              <p className="text-xs sm:text-sm text-gray-700 leading-relaxed p-3.5 bg-cream-50 rounded-xl border border-cream-300">
                {selectedLeadModal.resumo_diagnostico || 'Diagnóstico preliminar gerado com base nas informações prestadas pelo responsável.'}
              </p>
            </div>

            {/* 3 Ações Prioritárias */}
            {Array.isArray(selectedLeadModal.pontos_de_acao) && selectedLeadModal.pontos_de_acao.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
                  3 Ações Recomendadas para Fechamento:
                </h4>
                <div className="space-y-2">
                  {selectedLeadModal.pontos_de_acao.map((acao, i) => (
                    <div key={i} className="text-xs text-gray-700 p-3 bg-white rounded-xl border border-cream-300 flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-brand-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <span>{acao}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Botão de Fechamento */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-end">
              <button
                type="button"
                onClick={() => setSelectedLeadModal(null)}
                className="px-4 py-2.5 rounded-xl border border-cream-400 text-xs font-semibold text-gray-600 hover:bg-cream-100 transition"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => handleOpenWhatsApp(selectedLeadModal)}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow flex items-center justify-center gap-2"
              >
                <MessageCircle size={15} />
                <span>Iniciar Conversa no WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
