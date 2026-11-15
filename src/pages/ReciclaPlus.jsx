// src/pages/ReciclaPlus.jsx
// Módulo Recicla + — Sustentabilidade, Separação de Resíduos e Conscientização
// Alpha Soluções Condominiais — Identidade Visual Oficial

import React, { useState, useMemo } from 'react'
import {
  Recycle, Search, Plus, Filter, Smartphone, Edit2, Trash2, Copy,
  CheckCircle2, AlertCircle, Clock, ShieldCheck, Users, Building2,
  Leaf, Info, Check, X, ArrowRight, RefreshCw, Send, ChevronRight,
  Sparkles, FileText, Share2, HelpCircle
} from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'
import {
  collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, setDoc
} from 'firebase/firestore'
import { db } from '../firebase'
import {
  TEMAS_RECICLA,
  CAMPANHAS_PADRAO,
  interpolarMensagem,
  gerarChaveIdempotencia,
  normalizarTelefone
} from '../utils/reciclaData'

export default function ReciclaPlus() {
  const { user } = useAuth() || {}
  const isAdmin = user?.role === 'Administrador'
  const isSindico = user?.role === 'Síndico' || user?.role === 'Subsíndico'
  const userCondo = user?.condominio || ''

  // Coleções do Firestore
  const { items: campanhas, loading: loadingCampanhas } = useFirestore('recicla_campanhas')
  const { items: condominiosList } = useFirestore('condominios')
  const { items: moradoresList } = useFirestore('moradores')
  const { items: optoutList } = useFirestore('recicla_optout')
  const { items: disparosList } = useFirestore('recicla_disparos')

  // Estado de Navegação e Filtros
  const [activeTab, setActiveTab] = useState('campanhas') // 'campanhas' | 'moradores' | 'fila' | 'guia'
  const [selectedCondo, setSelectedCondo] = useState(() => (isAdmin ? 'Todos' : userCondo || 'Todos'))
  const [selectedTema, setSelectedTema] = useState('Todos')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos')

  // Modais
  const [previewModal, setPreviewModal] = useState(null) // campanha selecionada para prévia
  const [previewMoradorExemplo, setPreviewMoradorExemplo] = useState('Dona Maria')
  const [editModal, setEditModal] = useState(null) // null = fechado, {} = nova/editar
  const [copiadoFeedback, setCopiadoFeedback] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState('')

  // Notificação toast temporária
  const showFeedback = (msg) => {
    setFeedbackMsg(msg)
    setTimeout(() => setFeedbackMsg(''), 4000)
  }

  // Filtragem de Campanhas por Condomínio, Tema, Busca e Status
  const campanhasFiltradas = useMemo(() => {
    return campanhas.filter(c => {
      // Filtro de Condomínio:
      // Se 'Todos' selecionado no dropdown:
      // - Admin vê todas
      // - Síndico vê campanhas com 'Todos' OU com seu próprio condomínio
      if (selectedCondo !== 'Todos') {
        if (c.condominio !== 'Todos' && c.condominio !== selectedCondo) return false
      } else if (!isAdmin && userCondo) {
        if (c.condominio !== 'Todos' && c.condominio !== userCondo) return false
      }

      // Filtro de Tema
      if (selectedTema !== 'Todos' && c.tema !== selectedTema) return false

      // Filtro de Status
      if (statusFilter !== 'Todos' && c.status !== statusFilter) return false

      // Busca textual (nome, tema ou dica rápida)
      if (searchTerm) {
        const termo = searchTerm.toLowerCase()
        const matchNome = (c.nome || '').toLowerCase().includes(termo)
        const matchTema = (c.tema || '').toLowerCase().includes(termo)
        const matchDica = (c.dicaRapida || '').toLowerCase().includes(termo)
        if (!matchNome && !matchTema && !matchDica) return false
      }

      return true
    })
  }, [campanhas, selectedCondo, selectedTema, statusFilter, searchTerm, isAdmin, userCondo])

  // Moradores filtrados pelo condomínio selecionado
  const moradoresFiltrados = useMemo(() => {
    return moradoresList.filter(m => {
      const condoMorador = m.condominio || ''
      if (selectedCondo !== 'Todos' && condoMorador !== selectedCondo) return false
      if (!isAdmin && userCondo && condoMorador !== userCondo) return false
      return true
    })
  }, [moradoresList, selectedCondo, isAdmin, userCondo])

  // Mapa de Opt-out para checagem rápida O(1)
  const optoutMap = useMemo(() => {
    const map = new Set()
    optoutList.forEach(item => {
      if (item.ativo !== false) {
        if (item.moradorId) map.add(String(item.moradorId))
        if (item.telefone) map.add(String(item.telefone).replace(/\D/g, ''))
      }
    })
    return map
  }, [optoutList])

  // Métricas do Painel Principal
  const metrics = useMemo(() => {
    const totalCampanhas = campanhas.length
    const ativas = campanhas.filter(c => c.status === 'Ativa').length
    const rascunhos = campanhas.filter(c => c.status === 'Rascunho').length

    // Moradores elegíveis (com telefone válido e sem opt-out)
    let comTelefone = 0
    let optouts = 0
    moradoresFiltrados.forEach(m => {
      const rawTel = m.tel || m.telefone || m.whatsapp || m.celular || ''
      const tel = String(rawTel).replace(/\D/g, '')
      const temOptOut = optoutMap.has(String(m.id)) || (tel && optoutMap.has(tel))

      if (temOptOut) {
        optouts++
      } else if (tel.length >= 10) {
        comTelefone++
      }
    })

    // Disparos
    const enviadosApi = disparosList.filter(d => d.status === 'enviado_api' || d.status === 'entregue').length
    const entregues = disparosList.filter(d => d.status === 'entregue').length
    const pendentes = disparosList.filter(d => d.status === 'pendente').length

    return {
      totalCampanhas,
      ativas,
      rascunhos,
      moradoresElegiveis: comTelefone,
      moradoresOptOut: optouts,
      totalCondominios: condominiosList.length,
      disparosAceitos: enviadosApi,
      disparosEntregues: entregues,
      disparosPendentes: pendentes
    }
  }, [campanhas, moradoresFiltrados, optoutMap, condominiosList, disparosList])

  // Ação: Restaurar Catálogo Padrão (Semear as 10 Campanhas no Firestore)
  const handleRestaurarCatalogo = async () => {
    if (!window.confirm('Deseja semear/restaurar as 10 Campanhas Educativas Oficiais do Programa Recicla + no banco de dados?')) {
      return
    }

    setActionLoading(true)
    try {
      const colRef = collection(db, 'recicla_campanhas')
      let adicionadas = 0

      for (const item of CAMPANHAS_PADRAO) {
        // Verifica se já existe uma campanha com o mesmo temaId ou idPadrao
        const jaExiste = campanhas.some(c => c.idPadrao === item.idPadrao || (c.temaId === item.temaId && c.condominio === 'Todos'))
        if (!jaExiste) {
          await addDoc(colRef, {
            ...item,
            criadoEm: serverTimestamp(),
            atualizadoEm: serverTimestamp(),
            criadoPor: user?.email || 'sistema'
          })
          adicionadas++
        }
      }

      showFeedback(adicionadas > 0
        ? `Sucesso! ${adicionadas} campanhas oficiais foram cadastradas no Firestore.`
        : 'Todas as 10 campanhas padrão já estão cadastradas e ativas.')
    } catch (err) {
      console.error('Erro ao restaurar catálogo:', err)
      alert(`Falha ao semear campanhas: ${err.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  // Ação: Salvar Edição ou Nova Campanha
  const handleSalvarCampanha = async (formData) => {
    if (!formData.nome?.trim() || !formData.texto?.trim()) {
      alert('Por favor, preencha o Nome da Campanha e o Texto da Mensagem.')
      return
    }

    setActionLoading(true)
    try {
      const colRef = collection(db, 'recicla_campanhas')
      const payload = {
        nome: formData.nome.trim(),
        tema: formData.tema || TEMAS_RECICLA[0],
        temaId: formData.temaId || (TEMAS_RECICLA.indexOf(formData.tema) + 1) || 1,
        dicaRapida: formData.dicaRapida?.trim() || '',
        sugestaoMaterial: formData.sugestaoMaterial?.trim() || 'Infográfico / Card Digital',
        texto: formData.texto.trim(),
        status: formData.status || 'Ativa',
        condominio: formData.condominio || (isAdmin ? 'Todos' : userCondo),
        atualizadoEm: serverTimestamp()
      }

      if (formData.id) {
        // Atualização de existente
        await updateDoc(doc(db, 'recicla_campanhas', formData.id), payload)
        showFeedback('Campanha atualizada com sucesso no Firestore!')
      } else {
        // Criação de nova
        payload.criadoEm = serverTimestamp()
        payload.criadoPor = user?.email || 'admin'
        await addDoc(colRef, payload)
        showFeedback('Nova campanha criada com sucesso!')
      }

      setEditModal(null)
    } catch (err) {
      console.error('Erro ao salvar campanha:', err)
      alert(`Falha ao salvar campanha: ${err.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  // Ação: Duplicar Campanha
  const handleDuplicarCampanha = async (campanha) => {
    const novoNome = `${campanha.nome} (Cópia)`
    const destinoCondo = prompt(`Duplicar campanha para qual condomínio? (Deixe "Todos" para global ou digite o nome)`, campanha.condominio || 'Todos')
    if (!destinoCondo) return

    setActionLoading(true)
    try {
      const colRef = collection(db, 'recicla_campanhas')
      await addDoc(colRef, {
        ...campanha,
        id: undefined,
        idPadrao: undefined,
        nome: novoNome,
        condominio: destinoCondo,
        status: 'Rascunho',
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
        criadoPor: user?.email || 'sistema'
      })
      showFeedback('Campanha duplicada com sucesso como rascunho!')
    } catch (err) {
      alert(`Erro ao duplicar: ${err.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  // Ação: Excluir Campanha
  const handleExcluirCampanha = async (campanha) => {
    if (!window.confirm(`Tem certeza que deseja excluir a campanha "${campanha.nome}"? Esta ação é irreversível.`)) {
      return
    }

    setActionLoading(true)
    try {
      await deleteDoc(doc(db, 'recicla_campanhas', campanha.id))
      showFeedback('Campanha removida com sucesso!')
    } catch (err) {
      alert(`Erro ao excluir campanha: ${err.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  // Ação: Alternar Opt-out (LGPD / Preferência de Comunicação)
  const handleToggleOptOut = async (morador) => {
    const rawTel = morador.tel || morador.telefone || morador.whatsapp || morador.celular || ''
    const tel = String(rawTel).replace(/\D/g, '')
    const idChave = `${morador.condominio || 'Geral'}_${morador.id}`
    const isAtualmenteBloqueado = optoutMap.has(String(morador.id)) || (tel && optoutMap.has(tel))

    setActionLoading(true)
    try {
      const docRef = doc(db, 'recicla_optout', idChave)
      if (isAtualmenteBloqueado) {
        // Desbloquear (permitir recebimento)
        await setDoc(docRef, {
          moradorId: String(morador.id),
          moradorNome: morador.nome || 'Morador',
          condominio: morador.condominio || '',
          telefone: tel,
          ativo: false,
          atualizadoEm: serverTimestamp(),
          atualizadoPor: user?.email || 'sistema'
        }, { merge: true })
        showFeedback(`Morador(a) ${morador.nome} reativado para receber comunicados ambientais.`)
      } else {
        // Bloquear (opt-out ativado)
        await setDoc(docRef, {
          moradorId: String(morador.id),
          moradorNome: morador.nome || 'Morador',
          condominio: morador.condominio || '',
          telefone: tel,
          ativo: true,
          motivo: 'Solicitação do morador (LGPD)',
          dataOptOut: serverTimestamp(),
          atualizadoPor: user?.email || 'sistema'
        })
        showFeedback(`Opt-out ativado para ${morador.nome}. Mensagens futuras bloqueadas.`)
      }
    } catch (err) {
      alert(`Erro ao alterar preferência: ${err.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  // Copiar prévia para clipboard
  const handleCopiarMensagem = (texto) => {
    navigator.clipboard.writeText(texto)
    setCopiadoFeedback(true)
    setTimeout(() => setCopiadoFeedback(false), 2500)
  }

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* ─── TOAST FEEDBACK ────────────────────────────────────────────── */}
      {feedbackMsg && (
        <div className="fixed top-20 right-6 z-50 bg-[#233044] text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-[#6E8B85]/40 animate-slide-in">
          <CheckCircle2 size={20} className="text-[#A8BCB9]" />
          <span className="text-sm font-medium">{feedbackMsg}</span>
        </div>
      )}

      {/* ─── CABEÇALHO DO MÓDULO (IDENTIDADE ALPHA) ────────────────────── */}
      <div className="bg-gradient-to-br from-[#233044] to-[#1a2535] rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        {/* Elemento de iluminação suave sage green */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#6E8B85]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-72 h-72 bg-[#DCE8E3]/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DCE8E3]/20 border border-[#A8BCB9]/40 text-[#DCE8E3] text-xs font-semibold uppercase tracking-wider">
                <Leaf size={14} className="text-[#A8BCB9]" /> Sustentabilidade Alpha
              </span>
              <span className="text-xs text-slate-300 font-mono">Etapas 1 e 2 • Estrutura & Catálogo</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <span className="p-2.5 bg-[#6E8B85]/20 rounded-2xl border border-[#A8BCB9]/30 inline-flex text-[#DCE8E3]">
                <Recycle size={28} className="animate-spin-slow" />
              </span>
              Recicla +
            </h1>
            <p className="text-sm text-slate-200/90 max-w-2xl font-light">
              Módulo oficial de conscientização ambiental, separação correta de resíduos e comunicação responsável com os moradores via WhatsApp.
            </p>
          </div>

          {/* Controles de Condomínio & Ações Rápidas */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Seletor de Condomínio */}
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-2 flex items-center gap-2">
              <Building2 size={16} className="text-[#A8BCB9] ml-1" />
              {isAdmin ? (
                <select
                  value={selectedCondo}
                  onChange={(e) => setSelectedCondo(e.target.value)}
                  className="bg-transparent text-white text-xs font-semibold focus:outline-none cursor-pointer pr-3"
                >
                  <option value="Todos" className="text-slate-900 font-medium">🏢 Todos os Condomínios (Global)</option>
                  {condominiosList.map(c => (
                    <option key={c.id} value={c.nome} className="text-slate-900 font-medium">
                      🏢 {c.nome}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs font-semibold text-white px-2 py-0.5">
                  {userCondo || 'Condomínio Vinculado'}
                </span>
              )}
            </div>

            {/* Botão de Semear / Restaurar Catálogo */}
            <button
              onClick={handleRestaurarCatalogo}
              disabled={actionLoading}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-2xl text-xs font-semibold transition-all flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
              title="Restaurar o catálogo oficial de 10 campanhas da Alpha no Firestore"
            >
              <RefreshCw size={14} className={actionLoading ? 'animate-spin' : ''} />
              <span>Restaurar Catálogo Padrão</span>
            </button>

            {/* Botão Nova Campanha */}
            <button
              onClick={() => setEditModal({
                nome: '',
                tema: TEMAS_RECICLA[0],
                dicaRapida: '',
                sugestaoMaterial: 'Infográfico / Card Digital',
                texto: '',
                status: 'Ativa',
                condominio: selectedCondo === 'Todos' ? (isAdmin ? 'Todos' : userCondo) : selectedCondo
              })}
              className="px-4 py-2.5 bg-[#6E8B85] hover:bg-[#5a736e] text-white rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shadow-md cursor-pointer hover:shadow-lg hover:scale-102"
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>Nova Campanha</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── PAINEL DE KPIS & MÉTRICAS PRINCIPAIS ──────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* KPI 1: Campanhas */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col justify-between hover:border-[#6E8B85]/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Campanhas</span>
            <span className="p-2 bg-[#DCE8E3]/40 text-[#233044] rounded-xl"><Recycle size={18} /></span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-extrabold text-[#233044]">{metrics.totalCampanhas}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              <span className="text-emerald-700 font-semibold">{metrics.ativas} ativas</span> • {metrics.rascunhos} rascunhos
            </p>
          </div>
        </div>

        {/* KPI 2: Condomínios */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col justify-between hover:border-[#6E8B85]/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Condomínios</span>
            <span className="p-2 bg-blue-50 text-blue-700 rounded-xl"><Building2 size={18} /></span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-extrabold text-[#233044]">{metrics.totalCondominios}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Foco atual: <span className="font-semibold text-slate-800">{selectedCondo === 'Todos' ? 'Global' : selectedCondo}</span>
            </p>
          </div>
        </div>

        {/* KPI 3: Moradores com WhatsApp */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col justify-between hover:border-[#6E8B85]/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Com WhatsApp</span>
            <span className="p-2 bg-emerald-50 text-emerald-700 rounded-xl"><Smartphone size={18} /></span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-extrabold text-emerald-700">{metrics.moradoresElegiveis}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Moradores elegíveis no recorte</p>
          </div>
        </div>

        {/* KPI 4: Opt-out (LGPD) */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col justify-between hover:border-[#6E8B85]/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Opt-out (LGPD)</span>
            <span className="p-2 bg-amber-50 text-amber-700 rounded-xl"><ShieldCheck size={18} /></span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-extrabold text-amber-700">{metrics.moradoresOptOut}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Bloqueio preventivo respeitado</p>
          </div>
        </div>

        {/* KPI 5: Disparos & Status */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col justify-between hover:border-[#6E8B85]/40 transition-colors col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Entregas</span>
            <span className="p-2 bg-purple-50 text-purple-700 rounded-xl"><Send size={18} /></span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-extrabold text-[#233044]">{metrics.disparosEntregues}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              <span className="font-semibold text-purple-700">{metrics.disparosAceitos} aceitos</span> • {metrics.disparosPendentes} na fila
            </p>
          </div>
        </div>
      </div>

      {/* ─── NAVEGAÇÃO POR ABAS ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('campanhas')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'campanhas'
              ? 'bg-[#233044] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Recycle size={16} />
          <span>Campanhas Educativas ({campanhasFiltradas.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('moradores')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'moradores'
              ? 'bg-[#233044] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users size={16} />
          <span>Moradores & Elegibilidade ({moradoresFiltrados.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('fila')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'fila'
              ? 'bg-[#233044] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Clock size={16} />
          <span>Fila de Disparos (Arquitetura)</span>
        </button>

        <button
          onClick={() => setActiveTab('guia')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'guia'
              ? 'bg-[#233044] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <HelpCircle size={16} />
          <span>Diretrizes & LGPD</span>
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ABA 1: CATÁLOGO DE CAMPANHAS EDUCATIVAS                          */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'campanhas' && (
        <div className="space-y-4">
          {/* Barra de Filtros e Busca */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center gap-3">
            {/* Campo de Busca */}
            <div className="relative flex-1 w-full">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar campanha por título, tema ou dica rápida..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#6E8B85] focus:bg-white transition-all text-slate-800"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filtro por Tema */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Filter size={16} className="text-slate-400 shrink-0" />
              <select
                value={selectedTema}
                onChange={(e) => setSelectedTema(e.target.value)}
                className="w-full md:w-60 py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:border-[#6E8B85] cursor-pointer"
              >
                <option value="Todos">🌿 Todos os 10 Temas</option>
                {TEMAS_RECICLA.map((tema, i) => (
                  <option key={tema} value={tema}>
                    {i + 1}. {tema}
                  </option>
                ))}
              </select>

              {/* Filtro de Status */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:border-[#6E8B85] cursor-pointer"
              >
                <option value="Todos">Status: Todos</option>
                <option value="Ativa">Ativas</option>
                <option value="Rascunho">Rascunhos</option>
                <option value="Pausada">Pausadas</option>
              </select>
            </div>
          </div>

          {/* Grid de Cards de Campanhas */}
          {loadingCampanhas ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
              <RefreshCw size={28} className="animate-spin text-[#6E8B85] mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-600">Sincronizando campanhas com o Firestore...</p>
            </div>
          ) : campanhasFiltradas.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 text-center border border-dashed border-slate-300 space-y-4">
              <div className="w-16 h-16 bg-[#DCE8E3]/50 text-[#233044] rounded-full flex items-center justify-center mx-auto">
                <Recycle size={32} />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-base font-bold text-slate-800">Nenhuma campanha encontrada</h3>
                <p className="text-xs text-slate-500">
                  {campanhas.length === 0
                    ? 'O banco ainda não possui campanhas cadastradas. Clique abaixo para carregar as 10 campanhas oficiais da Alpha.'
                    : 'Nenhum resultado corresponde aos filtros aplicados.'}
                </p>
              </div>
              {campanhas.length === 0 && (
                <button
                  onClick={handleRestaurarCatalogo}
                  className="px-5 py-2.5 bg-[#233044] text-white rounded-2xl text-xs font-bold hover:bg-[#1a2535] transition-colors inline-flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <Sparkles size={16} className="text-[#A8BCB9]" />
                  <span>Carregar Catálogo Oficial (10 Campanhas)</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {campanhasFiltradas.map((campanha) => {
                const isRascunho = campanha.status === 'Rascunho'
                const isPausada = campanha.status === 'Pausada'

                return (
                  <div
                    key={campanha.id}
                    className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group hover:border-[#6E8B85]/60"
                  >
                    <div className="space-y-3">
                      {/* Topo do Card: Tema e Status */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#DCE8E3]/40 border border-[#A8BCB9]/40 text-[#233044] text-[11px] font-bold truncate max-w-[70%]">
                          <Leaf size={12} className="text-[#6E8B85] shrink-0" />
                          <span className="truncate">{campanha.tema || 'Sustentabilidade'}</span>
                        </span>

                        <div className="flex items-center gap-1.5">
                          {campanha.condominio && campanha.condominio !== 'Todos' && (
                            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200">
                              {campanha.condominio}
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                            isRascunho
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : isPausada
                                ? 'bg-slate-100 text-slate-600 border-slate-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                            {campanha.status || 'Ativa'}
                          </span>
                        </div>
                      </div>

                      {/* Título da Campanha */}
                      <h3 className="font-extrabold text-slate-900 text-base leading-snug group-hover:text-[#233044]">
                        {campanha.nome}
                      </h3>

                      {/* Caixa de Dica Rápida */}
                      {campanha.dicaRapida && (
                        <div className="p-3 bg-slate-50 border-l-3 border-[#6E8B85] rounded-r-xl text-xs text-slate-700">
                          <strong className="text-[#233044] font-semibold">💡 Dica de Ouro:</strong>{' '}
                          <span>{campanha.dicaRapida}</span>
                        </div>
                      )}

                      {/* Trecho da Mensagem com Destaque de Variáveis */}
                      <div className="bg-[#F8FAFC] p-3 rounded-xl border border-slate-100 text-xs text-slate-600 font-mono line-clamp-3 leading-relaxed whitespace-pre-wrap">
                        {campanha.texto}
                      </div>

                      {campanha.sugestaoMaterial && (
                        <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                          <FileText size={12} className="text-slate-400" />
                          <span>Material sugerido: <strong>{campanha.sugestaoMaterial}</strong></span>
                        </p>
                      )}
                    </div>

                    {/* Rodapé de Ações do Card */}
                    <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => setPreviewModal(campanha)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-[#233044] text-slate-700 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                        title="Ver prévia real como no WhatsApp do morador"
                      >
                        <Smartphone size={14} />
                        <span>Ver Prévia WhatsApp</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditModal(campanha)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-[#233044] hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Editar campanha"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleDuplicarCampanha(campanha)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                          title="Duplicar para outro condomínio"
                        >
                          <Copy size={15} />
                        </button>
                        <button
                          onClick={() => handleExcluirCampanha(campanha)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                          title="Excluir campanha"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ABA 2: MORADORES & ELEGIBILIDADE (PREVENÇÃO LGPD)                 */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'moradores' && (
        <div className="space-y-4">
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-900">
            <Info size={18} className="text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="font-bold text-amber-950">Privacidade & Conformidade com a LGPD:</strong>
              <p>
                As mensagens ambientais do Recicla + são enviadas individualmente apenas para moradores cadastrados com WhatsApp válido. Se algum morador solicitar o bloqueio de comunicados ambientais, utilize a chave de <strong>Opt-out</strong> abaixo para suspender os envios para aquele número com garantia jurídica.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
              <h3 className="font-extrabold text-slate-800 text-sm">
                Lista de Moradores ({moradoresFiltrados.length}) — {selectedCondo === 'Todos' ? 'Todos os Condomínios' : selectedCondo}
              </h3>
              <span className="text-xs text-slate-500">
                {metrics.moradoresElegiveis} aptos para envio • {metrics.moradoresOptOut} com opt-out
              </span>
            </div>

            <div className="divide-y divide-slate-100 max-h-[550px] overflow-y-auto">
              {moradoresFiltrados.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Nenhum morador encontrado para o filtro selecionado.
                </div>
              ) : (
                moradoresFiltrados.map((m) => {
                  const rawTel = m.tel || m.telefone || m.whatsapp || m.celular || ''
                  const tel = String(rawTel).replace(/\D/g, '')
                  const temTelValido = tel.length >= 10
                  const temOptOut = optoutMap.has(String(m.id)) || (tel && optoutMap.has(tel))

                  return (
                    <div key={m.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">{m.nome}</span>
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-semibold">
                            {m.apt ? `Apt ${m.apt}` : 'Sem apt'} {m.bloco ? `• Bloco ${m.bloco}` : ''}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">{m.condominio}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1 font-mono">
                            <Smartphone size={13} className={temTelValido ? 'text-emerald-600' : 'text-slate-300'} />
                            {temTelValido ? rawTel : 'Telefone não cadastrado'}
                          </span>
                        </div>
                      </div>

                      {/* Controle de Opt-out */}
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-semibold ${temOptOut ? 'text-amber-700' : 'text-emerald-700'}`}>
                          {temOptOut ? '🚫 Bloqueado (Opt-out)' : '✅ Elegível'}
                        </span>
                        <button
                          onClick={() => handleToggleOptOut(m)}
                          disabled={actionLoading}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                            temOptOut
                              ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {temOptOut ? 'Reativar Morador' : 'Ativar Opt-out'}
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ABA 3: FILA & HISTÓRICO DE DISPAROS (ARQUITETURA PRONTA)         */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'fila' && (
        <div className="space-y-4">
          <div className="bg-[#233044]/5 border border-[#233044]/15 rounded-2xl p-4 flex items-start gap-3 text-xs text-[#233044]">
            <ShieldCheck size={20} className="text-[#6E8B85] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="font-bold text-sm">Arquitetura de Fila Desacoplada e Segura (Pronta para a Etapa 3):</strong>
              <p className="text-slate-600 leading-relaxed">
                A estrutura do banco Firestore está preparada com as coleções <code>recicla_disparos</code> e chaves de idempotência (<code>chaveIdempotencia</code>). Quando os disparos em massa forem autorizados na Etapa 3, o backend executará a fila sem depender de manter o navegador aberto, com controle estrito contra duplicidade, contagem de tentativas e diferenciação entre <em>Aceito pela API</em> e <em>Efetivamente Entregue</em>.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-extrabold text-slate-800 text-sm">
                Registros da Fila de Disparos ({disparosList.length})
              </h3>
              <span className="text-xs text-slate-500 font-mono">
                Coleção: recicla_disparos
              </span>
            </div>

            {disparosList.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <Clock size={32} className="text-slate-300 mx-auto" />
                <h4 className="font-bold text-slate-700 text-sm">Nenhum disparo na fila ainda</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  A fila será alimentada assim que as campanhas forem agendadas ou disparadas nos condomínios participantes.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                {disparosList.map((d) => (
                  <div key={d.id} className="p-4 flex items-center justify-between text-xs">
                    <div>
                      <strong className="text-slate-800">{d.moradorNome || 'Morador'}</strong>
                      <p className="text-slate-500 font-mono text-[11px]">{d.chaveIdempotencia}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                      {d.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ABA 4: DIRETRIZES DO PROGRAMA RECICLA +                          */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'guia' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-extrabold text-[#233044]">
              Diretrizes Operacionais do Programa Recicla +
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Manual de boas práticas para síndicos, zeladores e equipe de governança predial da Alpha Soluções Condominiais.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-[#DCE8E3]/30 border border-[#A8BCB9]/40 space-y-2">
              <h3 className="font-bold text-sm text-[#233044] flex items-center gap-2">
                <Leaf size={16} className="text-[#6E8B85]" />
                1. Os 10 Pilares da Coleta Seletiva Predial
              </h3>
              <p className="text-xs text-slate-700 leading-relaxed">
                As campanhas educativas foram divididas em 10 temas objetivos que cobrem desde a separação básica com duas lixeiras em casa até o descarte seguro de pilhas, óleos e caixas de papelão desmontadas, reduzindo em até 70% o volume ocupado nas lixeiras coletivas.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <h3 className="font-bold text-sm text-[#233044] flex items-center gap-2">
                <Smartphone size={16} className="text-[#6E8B85]" />
                2. Disparos Individuais e Respeito aos Moradores
              </h3>
              <p className="text-xs text-slate-700 leading-relaxed">
                Nunca são enviados comunicados em grupos abertos de WhatsApp para evitar poluição visual e debates paralelos. Cada mensagem é enviada diretamente ao número do morador, personalizada com seu primeiro nome e nome do seu condomínio.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <h3 className="font-bold text-sm text-[#233044] flex items-center gap-2">
                <ShieldCheck size={16} className="text-[#6E8B85]" />
                3. Conformidade Rígida com a LGPD
              </h3>
              <p className="text-xs text-slate-700 leading-relaxed">
                O morador tem direito inegociável de solicitar o bloqueio de comunicados ambientais. Ao registrar o opt-out, o sistema marca a trava e impede disparos futuros mesmo em campanhas globais.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#DCE8E3]/30 border border-[#A8BCB9]/40 space-y-2">
              <h3 className="font-bold text-sm text-[#233044] flex items-center gap-2">
                <Building2 size={16} className="text-[#6E8B85]" />
                4. Valorização Patrimonial e Convivência
              </h3>
              <p className="text-xs text-slate-700 leading-relaxed">
                Condomínios organizados e limpos têm menor incidência de pragas urbanas, menores despesas com desentupimento de caixas de gordura e valorizam as unidades autônomas em até 15% na percepção de novos compradores e locatários.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODAL 1: PRÉVIA INTERATIVA WHATSAPP (SIMULAÇÃO REALISTA)         */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {previewModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm"
          onClick={() => setPreviewModal(null)}
        >
          <div
            className="bg-white max-w-md w-full rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden animate-scale-up"
            onClick={e => e.stopPropagation()}
          >
            {/* Header do Modal */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-2">
                <Smartphone size={18} className="text-[#6E8B85]" />
                <h3 className="font-extrabold text-slate-900 text-sm">
                  Prévia no WhatsApp do Morador
                </h3>
              </div>
              <button
                onClick={() => setPreviewModal(null)}
                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Configuração de Simulação Dinâmica */}
            <div className="p-3 bg-slate-100/70 border-b border-slate-200 text-xs flex items-center gap-2 shrink-0">
              <span className="text-slate-500 font-medium">Simular para:</span>
              <input
                type="text"
                value={previewMoradorExemplo}
                onChange={(e) => setPreviewMoradorExemplo(e.target.value)}
                placeholder="Nome do Morador"
                className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#6E8B85] w-36"
              />
              <span className="text-slate-400">•</span>
              <span className="text-slate-600 truncate font-semibold">
                {selectedCondo === 'Todos' ? (previewModal.condominio === 'Todos' ? 'Residencial Florença' : previewModal.condominio) : selectedCondo}
              </span>
            </div>

            {/* Conteúdo do Smartphone (Visual WhatsApp) */}
            <div className="p-4 overflow-y-auto bg-[#ECE5DD] flex-1 space-y-3 font-sans">
              {/* Topo do Chat do WhatsApp */}
              <div className="bg-[#075E54] text-white p-3 rounded-2xl flex items-center gap-3 shadow-sm">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm">
                  A
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-xs truncate">Alpha Soluções Condominiais</h4>
                  <p className="text-[10px] text-emerald-200 truncate flex items-center gap-1">
                    <CheckCircle2 size={10} /> Canal Oficial • Programa Recicla +
                  </p>
                </div>
              </div>

              {/* Balão da Mensagem */}
              <div className="bg-white rounded-2xl rounded-tl-sm p-4 shadow-sm border border-black/5 text-xs text-slate-800 space-y-3 leading-relaxed relative">
                {/* Banner de tema decorativo */}
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#DCE8E3] text-[#233044] text-[10px] font-bold">
                  🌱 {previewModal.tema}
                </div>

                {/* Texto Interpolado */}
                <div className="whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-slate-900">
                  {interpolarMensagem(previewModal.texto, {
                    nomeMorador: previewMoradorExemplo || 'Morador(a)',
                    nomeCondominio: selectedCondo === 'Todos' ? (previewModal.condominio === 'Todos' ? 'Residencial Florença' : previewModal.condominio) : selectedCondo
                  })}
                </div>

                {/* Hora e Checkmarks do WhatsApp */}
                <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 pt-1">
                  <span>09:00</span>
                  <span className="text-blue-500 font-bold">✓✓</span>
                </div>
              </div>
            </div>

            {/* Rodapé do Modal com Ação de Copiar */}
            <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-500">
                Variáveis substituídas em tempo real.
              </span>
              <button
                onClick={() => handleCopiarMensagem(interpolarMensagem(previewModal.texto, {
                  nomeMorador: previewMoradorExemplo,
                  nomeCondominio: selectedCondo === 'Todos' ? 'Residencial Florença' : selectedCondo
                }))}
                className="px-4 py-2 bg-[#233044] hover:bg-[#1a2535] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                {copiadoFeedback ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>{copiadoFeedback ? 'Copiado!' : 'Copiar Texto'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODAL 2: CRIAÇÃO / EDIÇÃO DE CAMPANHA                            */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {editModal && (
        <CampanhaModal
          data={editModal}
          condominiosList={condominiosList}
          isAdmin={isAdmin}
          userCondo={userCondo}
          onClose={() => setEditModal(null)}
          onSave={handleSalvarCampanha}
          loading={actionLoading}
        />
      )}
    </div>
  )
}

// ─── COMPONENTE MODAL DE FORMULÁRIO DE CAMPANHA ───────────────────────────
function CampanhaModal({ data, condominiosList, isAdmin, userCondo, onClose, onSave, loading }) {
  const isEditing = Boolean(data.id)
  const [form, setForm] = useState({
    id: data.id || null,
    nome: data.nome || '',
    tema: data.tema || TEMAS_RECICLA[0],
    temaId: data.temaId || 1,
    dicaRapida: data.dicaRapida || '',
    sugestaoMaterial: data.sugestaoMaterial || 'Infográfico / Card Digital',
    texto: data.texto || '',
    status: data.status || 'Ativa',
    condominio: data.condominio || (isAdmin ? 'Todos' : userCondo)
  })

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Helper para inserir tags dinâmicas no texto
  const inserirTag = (tag) => {
    setForm(f => ({
      ...f,
      texto: (f.texto ? f.texto + ' ' : '') + tag
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(form)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white max-w-2xl w-full rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-[#DCE8E3]/60 text-[#233044] rounded-xl"><Recycle size={18} /></span>
            <h3 className="font-extrabold text-slate-900 text-base">
              {isEditing ? 'Editar Campanha Educativa' : 'Nova Campanha Recicla +'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700">
          {/* Nome da Campanha */}
          <div>
            <label className="block font-bold text-slate-800 mb-1">Nome da Campanha *</label>
            <input
              type="text"
              required
              value={form.nome}
              onChange={e => setField('nome', e.target.value)}
              placeholder="Ex: Separação Prática: O Básico Bem Feito em Casa"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#6E8B85] focus:bg-white transition-all text-slate-800 font-medium"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Tema Oficial */}
            <div>
              <label className="block font-bold text-slate-800 mb-1">Tema Educativo</label>
              <select
                value={form.tema}
                onChange={e => {
                  const val = e.target.value
                  const idx = TEMAS_RECICLA.indexOf(val)
                  setField('tema', val)
                  setField('temaId', idx >= 0 ? idx + 1 : 1)
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#6E8B85] cursor-pointer"
              >
                {TEMAS_RECICLA.map((t, i) => (
                  <option key={t} value={t}>
                    {i + 1}. {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Condomínio Alvo */}
            <div>
              <label className="block font-bold text-slate-800 mb-1">Condomínio Destino</label>
              {isAdmin ? (
                <select
                  value={form.condominio}
                  onChange={e => setField('condominio', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#6E8B85] cursor-pointer"
                >
                  <option value="Todos">Global (Todos os Condomínios)</option>
                  {condominiosList.map(c => (
                    <option key={c.id} value={c.nome}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  disabled
                  value={userCondo || 'Seu condomínio'}
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-medium cursor-not-allowed"
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Status */}
            <div>
              <label className="block font-bold text-slate-800 mb-1">Status</label>
              <select
                value={form.status}
                onChange={e => setField('status', e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#6E8B85] cursor-pointer"
              >
                <option value="Ativa">Ativa (Pronta para Envio)</option>
                <option value="Rascunho">Rascunho (Em Elaboração)</option>
                <option value="Pausada">Pausada</option>
              </select>
            </div>

            {/* Sugestão de Material */}
            <div>
              <label className="block font-bold text-slate-800 mb-1">Sugestão de Material / Card</label>
              <input
                type="text"
                value={form.sugestaoMaterial}
                onChange={e => setField('sugestaoMaterial', e.target.value)}
                placeholder="Ex: Infográfico A4 - Guia dos 2 Baldes"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#6E8B85]"
              />
            </div>
          </div>

          {/* Dica Rápida */}
          <div>
            <label className="block font-bold text-slate-800 mb-1">Dica de Ouro (Destaque Rápido)</label>
            <input
              type="text"
              value={form.dicaRapida}
              onChange={e => setField('dicaRapida', e.target.value)}
              placeholder="Ex: Tenha apenas duas lixeiras em casa: uma para secos e outra para orgânicos."
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#6E8B85]"
            />
          </div>

          {/* Texto da Mensagem */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block font-bold text-slate-800">Texto da Mensagem (WhatsApp) *</label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => inserirTag('{{nome_morador}}')}
                  className="px-2 py-0.5 rounded-md bg-[#DCE8E3] hover:bg-[#c2d6ce] text-[#233044] text-[10px] font-bold cursor-pointer transition-colors"
                >
                  + {'{{nome_morador}}'}
                </button>
                <button
                  type="button"
                  onClick={() => inserirTag('{{nome_condominio}}')}
                  className="px-2 py-0.5 rounded-md bg-[#DCE8E3] hover:bg-[#c2d6ce] text-[#233044] text-[10px] font-bold cursor-pointer transition-colors"
                >
                  + {'{{nome_condominio}}'}
                </button>
              </div>
            </div>

            <textarea
              required
              rows={8}
              value={form.texto}
              onChange={e => setField('texto', e.target.value)}
              placeholder="Digite aqui o texto educativo que será enviado para os moradores..."
              className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:outline-none focus:border-[#6E8B85] focus:bg-white leading-relaxed text-slate-800"
            />
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Use *texto* para negrito e emojis para deixar a leitura convidativa.</span>
              <span>{form.texto?.length || 0} caracteres</span>
            </div>
          </div>

          {/* Botões do Rodapé */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-[#233044] hover:bg-[#1a2535] text-white rounded-xl font-bold transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
              <span>{isEditing ? 'Salvar Alterações' : 'Criar Campanha'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
