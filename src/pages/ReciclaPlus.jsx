// src/pages/ReciclaPlus.jsx
// Módulo Recicla + — Sustentabilidade, Separação de Resíduos e Conscientização
// Alpha Soluções Condominiais — Identidade Visual Oficial & Motor de Disparos (Etapa 3)

import React, { useState, useMemo, useEffect, useRef } from 'react'
import {
  Recycle, Search, Plus, Filter, Smartphone, Edit2, Trash2, Copy,
  CheckCircle2, AlertCircle, Clock, ShieldCheck, Users, Building2,
  Leaf, Info, Check, X, ArrowRight, RefreshCw, Send, ChevronRight,
  Sparkles, FileText, Share2, HelpCircle, PhoneOff, PhoneForwarded, Lock,
  Play, Pause, Square, AlertTriangle, Sliders, CheckSquare
} from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'
import {
  collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, setDoc, query, where, getDocs
} from 'firebase/firestore'
import { db } from '../firebase'
import {
  TEMAS_RECICLA,
  CAMPANHAS_PADRAO,
  interpolarMensagem,
  gerarChaveIdempotencia,
  normalizarTelefone,
  validarTelefoneWhatsApp,
  filtrarMoradoresElegiveis
} from '../utils/reciclaData'
import { enviarMensagemWhatsApp } from '../utils/whatsappAutomacao'

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
  const [activeTab, setActiveTab] = useState('campanhas') // 'campanhas' | 'disparos' | 'fila' | 'moradores' | 'guia'
  const [selectedCondo, setSelectedCondo] = useState(() => (isAdmin ? 'Todos' : userCondo || 'Todos'))
  const [selectedTema, setSelectedTema] = useState('Todos')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [moradorSubFilter, setMoradorSubFilter] = useState('todos') // 'todos' | 'elegiveis' | 'optout' | 'invalidos' | 'duplicados'

  // Estados da Etapa 3 — Motor de Disparos WhatsApp
  const [disparoCondo, setDisparoCondo] = useState(() => (isAdmin ? (condominiosList[0]?.nome || '') : userCondo))
  const [disparoCampanhaId, setDisparoCampanhaId] = useState('')
  const [disparoTexto, setDisparoTexto] = useState('')
  const [disparoDelay, setDisparoDelay] = useState(3) // delay em segundos (2 a 5s)
  const [disparoModoPiloto, setDisparoModoPiloto] = useState(false)
  const [moradoresSelecionados, setMoradoresSelecionados] = useState(new Set())
  const [testeNumero, setTesteNumero] = useState('')
  const [testandoEnvio, setTestandoEnvio] = useState(false)
  const [resultadoTeste, setResultadoTeste] = useState(null)
  const [confirmModal, setConfirmModal] = useState(false)

  // Controle de Fila e Execução em Lote
  const [isFilaExecutando, setIsFilaExecutando] = useState(false)
  const [isFilaPausada, setIsFilaPausada] = useState(false)
  const [disparoAtualIndex, setDisparoAtualIndex] = useState(0)
  const [disparoTotalLote, setDisparoTotalLote] = useState(0)
  const [loteAtivoId, setLoteAtivoId] = useState(null)
  const filaCanceladaRef = useRef(false)
  const filaPausadaRef = useRef(false)

  // Modais de Edição e Prévia
  const [previewModal, setPreviewModal] = useState(null)
  const [previewMoradorExemplo, setPreviewMoradorExemplo] = useState('Maria Silva')
  const [editModal, setEditModal] = useState(null)
  const [copiadoFeedback, setCopiadoFeedback] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState('')

  const showFeedback = (msg) => {
    setFeedbackMsg(msg)
    setTimeout(() => setFeedbackMsg(''), 4500)
  }

  // Sincroniza condomínio padrão para disparo
  useEffect(() => {
    if (!isAdmin && userCondo) {
      setDisparoCondo(userCondo)
    } else if (isAdmin && !disparoCondo && condominiosList.length > 0) {
      setDisparoCondo(condominiosList[0].nome)
    }
  }, [isAdmin, userCondo, condominiosList, disparoCondo])

  // Sincroniza primeira campanha para disparo quando a lista carregar
  useEffect(() => {
    if (campanhas.length > 0 && !disparoCampanhaId) {
      const ativa = campanhas.find(c => c.status === 'Ativa') || campanhas[0]
      setDisparoCampanhaId(ativa.id)
      setDisparoTexto(ativa.texto)
    }
  }, [campanhas, disparoCampanhaId])

  // Filtragem de Campanhas por Condomínio, Tema, Busca e Status (com Isolamento de Tenant)
  const campanhasFiltradas = useMemo(() => {
    return campanhas.filter(c => {
      if (!isAdmin && userCondo) {
        if (c.condominio !== 'Todos' && c.condominio !== userCondo) return false
      } else if (selectedCondo !== 'Todos') {
        if (c.condominio !== 'Todos' && c.condominio !== selectedCondo) return false
      }

      if (selectedTema !== 'Todos' && c.tema !== selectedTema) return false
      if (statusFilter !== 'Todos' && c.status !== statusFilter) return false

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

  // Moradores filtrados para a aba Moradores
  const moradoresDoCondo = useMemo(() => {
    return moradoresList.filter(m => {
      const condoMorador = m.condominio || ''
      if (!isAdmin && userCondo) {
        return condoMorador === userCondo
      }
      if (selectedCondo !== 'Todos') {
        return condoMorador === selectedCondo
      }
      return true
    })
  }, [moradoresList, selectedCondo, isAdmin, userCondo])

  // Moradores específicos do condomínio selecionado para Disparo (Etapa 3)
  const moradoresDoDisparo = useMemo(() => {
    const alvo = isAdmin ? disparoCondo : userCondo
    if (!alvo) return []
    return moradoresList.filter(m => (m.condominio || '') === alvo)
  }, [moradoresList, disparoCondo, isAdmin, userCondo])

  // Mapa de Opt-out para checagem rápida O(1)
  const optoutSet = useMemo(() => {
    const set = new Set()
    optoutList.forEach(item => {
      if (item.ativo !== false) {
        if (item.moradorId) set.add(String(item.moradorId))
        if (item.telefone) {
          const tClean = String(item.telefone).replace(/\D/g, '')
          set.add(tClean)
          const tNorm = normalizarTelefone(tClean)
          if (tNorm) set.add(tNorm)
        }
      }
    })
    return set
  }, [optoutList])

  // Relatório de elegibilidade do condomínio focado na aba Moradores
  const relatorioElegibilidade = useMemo(() => {
    return filtrarMoradoresElegiveis(moradoresDoCondo, optoutSet)
  }, [moradoresDoCondo, optoutSet])

  // Relatório de elegibilidade específico para a aba Disparos (Etapa 3)
  const relatorioDisparo = useMemo(() => {
    return filtrarMoradoresElegiveis(moradoresDoDisparo, optoutSet)
  }, [moradoresDoDisparo, optoutSet])

  // Quando o condomínio do disparo muda, pré-seleciona todos os elegíveis (ou até 5 se modo piloto)
  useEffect(() => {
    const elegiveis = relatorioDisparo.elegiveis || []
    const limite = disparoModoPiloto ? elegiveis.slice(0, 5) : elegiveis
    setMoradoresSelecionados(new Set(limite.map(m => m.id)))
  }, [disparoCondo, relatorioDisparo.elegiveis, disparoModoPiloto])

  // Campanha selecionada atualmente para disparo
  const campanhaSelecionadaParaDisparo = useMemo(() => {
    return campanhas.find(c => c.id === disparoCampanhaId) || null
  }, [campanhas, disparoCampanhaId])

  // Lista de moradores exibida conforme sub-filtro na aba Moradores
  const moradoresExibidos = useMemo(() => {
    switch (moradorSubFilter) {
      case 'elegiveis':
        return relatorioElegibilidade.elegiveis
      case 'optout':
        return relatorioElegibilidade.bloqueadosOptOut
      case 'invalidos':
        return relatorioElegibilidade.telefonesInvalidos
      case 'duplicados':
        return relatorioElegibilidade.telefonesDuplicados
      case 'todos':
      default:
        return moradoresDoCondo
    }
  }, [moradorSubFilter, relatorioElegibilidade, moradoresDoCondo])

  // Métricas do Painel Principal
  const metrics = useMemo(() => {
    const totalCampanhas = campanhas.length
    const ativas = campanhas.filter(c => c.status === 'Ativa').length
    const rascunhos = campanhas.filter(c => c.status === 'Rascunho').length

    const enviadosApi = disparosList.filter(d => d.status === 'enviado_api' || d.status === 'entregue').length
    const entregues = disparosList.filter(d => d.status === 'entregue').length
    const pendentes = disparosList.filter(d => d.status === 'pendente').length
    const falhas = disparosList.filter(d => d.status === 'falha').length

    return {
      totalCampanhas,
      ativas,
      rascunhos,
      moradoresElegiveis: relatorioElegibilidade.estatisticas.elegiveisCount,
      moradoresOptOut: relatorioElegibilidade.estatisticas.optOutCount,
      telefonesInvalidos: relatorioElegibilidade.estatisticas.invalidosCount,
      totalCondominios: condominiosList.length,
      disparosAceitos: enviadosApi,
      disparosEntregues: entregues,
      disparosPendentes: pendentes,
      disparosFalhas: falhas
    }
  }, [campanhas, relatorioElegibilidade, condominiosList, disparosList])

  // Ação: Restaurar Catálogo Padrão (Semear as 10 Campanhas no Firestore)
  const handleRestaurarCatalogo = async () => {
    if (!isAdmin) {
      alert('Apenas administradores da Alpha podem restaurar o catálogo oficial de campanhas globais.')
      return
    }

    if (!window.confirm('Deseja semear/restaurar as 10 Campanhas Educativas Oficiais do Programa Recicla + no banco de dados?')) {
      return
    }

    setActionLoading(true)
    try {
      const colRef = collection(db, 'recicla_campanhas')
      let adicionadas = 0

      for (const item of CAMPANHAS_PADRAO) {
        const jaExiste = campanhas.some(c => c.idPadrao === item.idPadrao || (c.temaId === item.temaId && c.condominio === 'Todos'))
        if (!jaExiste) {
          await addDoc(colRef, {
            ...item,
            criadoEm: serverTimestamp(),
            atualizadoEm: serverTimestamp(),
            criadoPor: user?.email || 'admin'
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

    if (!isAdmin && formData.condominio !== userCondo) {
      alert(`Acesso não autorizado: Você só pode criar ou editar campanhas para o seu condomínio (${userCondo}).`)
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
        condominio: isAdmin ? (formData.condominio || 'Todos') : userCondo,
        atualizadoEm: serverTimestamp()
      }

      if (formData.id) {
        await updateDoc(doc(db, 'recicla_campanhas', formData.id), payload)
        showFeedback('Campanha atualizada com sucesso no Firestore!')
      } else {
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
    let destinoCondo = ''
    if (isAdmin) {
      destinoCondo = prompt(`Duplicar campanha para qual condomínio? (Deixe "Todos" para cópia global ou digite o nome)`, campanha.condominio || 'Todos')
      if (!destinoCondo) return
    } else {
      if (!userCondo) {
        alert('Seu usuário de Síndico não possui um condomínio vinculado para personalizar campanhas.')
        return
      }
      destinoCondo = userCondo
      if (!window.confirm(`Deseja criar uma cópia personalizada desta campanha para o condomínio "${userCondo}"?`)) {
        return
      }
    }

    const novoNome = `${campanha.nome} (${destinoCondo === 'Todos' ? 'Cópia' : destinoCondo})`

    setActionLoading(true)
    try {
      const colRef = collection(db, 'recicla_campanhas')
      const { id, idPadrao, _createdAt, _updatedAt, ...dadosLimpos } = campanha

      await addDoc(colRef, {
        ...dadosLimpos,
        nome: novoNome,
        condominio: destinoCondo,
        status: 'Rascunho',
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
        criadoPor: user?.email || 'sistema'
      })
      showFeedback(`Campanha personalizada duplicada com sucesso para ${destinoCondo}!`)
    } catch (err) {
      alert(`Erro ao duplicar: ${err.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  // Ação: Excluir Campanha
  const handleExcluirCampanha = async (campanha) => {
    if (campanha.condominio === 'Todos' && !isAdmin) {
      alert('Modelos globais oficiais da Alpha não podem ser excluídos por síndicos.')
      return
    }

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

  // Ação: Alternar Opt-out (LGPD)
  const handleToggleOptOut = async (morador) => {
    const rawTel = morador.tel || morador.telefone || morador.whatsapp || morador.celular || ''
    const telLimpo = String(rawTel).replace(/\D/g, '')
    const telE164 = normalizarTelefone(rawTel)
    const condoNome = morador.condominio || userCondo || 'Geral'
    const idChave = `${condoNome.replace(/[^a-zA-Z0-9]/g, '_')}_${morador.id}`

    const isAtualmenteBloqueado = optoutSet.has(String(morador.id)) ||
                                 (telLimpo && optoutSet.has(telLimpo)) ||
                                 (telE164 && optoutSet.has(telE164))

    setActionLoading(true)
    try {
      const docRef = doc(db, 'recicla_optout', idChave)
      if (isAtualmenteBloqueado) {
        await setDoc(docRef, {
          moradorId: String(morador.id),
          moradorNome: morador.nome || 'Morador',
          condominio: condoNome,
          telefone: telE164 || telLimpo,
          ativo: false,
          atualizadoEm: serverTimestamp(),
          atualizadoPor: user?.email || 'sistema'
        }, { merge: true })
        showFeedback(`Morador(a) ${morador.nome} reativado para receber comunicados ambientais.`)
      } else {
        await setDoc(docRef, {
          moradorId: String(morador.id),
          moradorNome: morador.nome || 'Morador',
          condominio: condoNome,
          telefone: telE164 || telLimpo,
          ativo: true,
          motivo: 'Solicitação do morador (LGPD)',
          dataOptOut: serverTimestamp(),
          atualizadoPor: user?.email || 'sistema'
        })
        showFeedback(`Opt-out ativado para ${morador.nome}. Mensagens futuras bloqueadas com segurança jurídica.`)
      }
    } catch (err) {
      alert(`Erro ao alterar preferência: ${err.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  // ─── ETAPA 3: TESTE ANTES DO ENVIO (BOTÃO ENVIAR TESTE) ─────────────────
  const handleEnviarTeste = async () => {
    const validacao = validarTelefoneWhatsApp(testeNumero)
    if (!validacao.valido) {
      alert(`Número de teste inválido: ${validacao.motivo}. Digite um celular válido com DDD (ex: 83999998888).`)
      return
    }

    if (!disparoTexto?.trim()) {
      alert('Selecione uma campanha ou digite o texto da mensagem antes de enviar o teste.')
      return
    }

    const condoAlvo = isAdmin ? disparoCondo : userCondo
    const textoFormatado = interpolarMensagem(disparoTexto, {
      nomeMorador: 'Administrador (Teste)',
      nomeCondominio: condoAlvo || 'Condomínio de Teste'
    })

    setTestandoEnvio(true)
    setResultadoTeste(null)

    try {
      const res = await enviarMensagemWhatsApp({
        number: validacao.numeroE164,
        text: `🧪 *[TESTE DE CAMPANHA RECICLA+]*\n\n${textoFormatado}\n\n_Mensagem de verificação prévia emitida pelo Alpha Gestão._`,
        instance: 'InstanciaAlpha'
      })

      if (res && res.success) {
        const msgId = res.data?.key?.id || res.data?.id || 'TESTE_OK'
        setResultadoTeste({
          success: true,
          message: `Teste entregue com sucesso no número ${validacao.numeroE164}! ID: ${msgId}`
        })
        showFeedback('Mensagem de teste enviada com sucesso!')
      } else {
        setResultadoTeste({
          success: false,
          message: res?.error || 'Falha ao entregar teste via Evolution API.'
        })
      }
    } catch (err) {
      setResultadoTeste({
        success: false,
        message: err.message || 'Erro de comunicação ao enviar teste.'
      })
    } finally {
      setTestandoEnvio(false)
    }
  }

  // ─── ETAPA 3: MOTOR DE DISPAROS SEQUENCIAL EM FILA ──────────────────────
  const handleConfirmarELancarLote = async () => {
    const condoAlvo = isAdmin ? disparoCondo : userCondo
    if (!condoAlvo) {
      alert('Selecione um condomínio para realizar os disparos.')
      return
    }

    const elegiveis = relatorioDisparo.elegiveis.filter(m => moradoresSelecionados.has(m.id))
    if (elegiveis.length === 0) {
      alert('Nenhum morador elegível selecionado para envio.')
      return
    }

    // Se modo piloto, garante no máximo 5 números
    const listaDisparo = disparoModoPiloto ? elegiveis.slice(0, 5) : elegiveis
    const loteId = `LOTE_${Date.now()}_${condoAlvo.replace(/[^a-zA-Z0-9]/g, '_')}`

    setConfirmModal(false)
    setIsFilaExecutando(true)
    setIsFilaPausada(false)
    setLoteAtivoId(loteId)
    setDisparoAtualIndex(0)
    setDisparoTotalLote(listaDisparo.length)
    filaCanceladaRef.current = false
    filaPausadaRef.current = false

    // Muda automaticamente para a aba de Fila e Acompanhamento
    setActiveTab('fila')
    showFeedback(`Iniciando lote de ${listaDisparo.length} mensagens com intervalo de ${disparoDelay}s...`)

    const colDisparos = collection(db, 'recicla_disparos')
    let enviadosComSucesso = 0
    let falhas = 0

    try {
      for (let i = 0; i < listaDisparo.length; i++) {
        // Verifica se a execução foi cancelada
        if (filaCanceladaRef.current) {
          showFeedback('Processamento da fila cancelado pelo operador.')
          break
        }

        // Verifica se a execução foi pausada
        while (filaPausadaRef.current && !filaCanceladaRef.current) {
          await new Promise(r => setTimeout(r, 1000))
        }

        if (filaCanceladaRef.current) break

        const morador = listaDisparo[i]
        setDisparoAtualIndex(i + 1)

        const chaveIdempotencia = gerarChaveIdempotencia(disparoCampanhaId, morador.id, morador.telefoneE164)

        // 1. Controle Antiduplicidade: Verifica se já existe registro de sucesso para este morador e campanha
        const jaEnviadoQuery = query(
          colDisparos,
          where('chaveIdempotencia', '==', chaveIdempotencia),
          where('status', 'in', ['enviado_api', 'entregue'])
        )
        const snapJaEnviado = await getDocs(jaEnviadoQuery)

        if (!snapJaEnviado.empty) {
          console.warn(`[Recicla+] Ignorando morador ${morador.nome}: Mensagem já enviada anteriormente (Idempotência).`)
          continue
        }

        // 2. Interpolação individualizada da mensagem
        const textoPersonalizado = interpolarMensagem(disparoTexto, {
          nomeMorador: morador.nome,
          nomeCondominio: condoAlvo
        })

        // 3. Registro prévio com status 'pendente'
        const docDisparoRef = await addDoc(colDisparos, {
          loteId,
          campanhaId: disparoCampanhaId,
          campanhaNome: campanhaSelecionadaParaDisparo?.nome || 'Campanha Recicla+',
          condominio: condoAlvo,
          moradorId: String(morador.id),
          moradorNome: morador.nome || 'Morador',
          moradorApt: morador.apt || '',
          moradorBloco: morador.bloco || '',
          telefone: morador.telefoneE164,
          mensagem: textoPersonalizado,
          chaveIdempotencia,
          status: 'pendente',
          tentativas: 1,
          maxTentativas: 3,
          criadoEm: serverTimestamp()
        })

        // 4. Disparo através do endpoint seguro
        let tentativaAtual = 1
        let disparoOk = false
        let msgIdApi = ''
        let erroDesc = ''

        while (tentativaAtual <= 3 && !disparoOk) {
          try {
            const res = await enviarMensagemWhatsApp({
              number: morador.telefoneE164,
              text: textoPersonalizado,
              instance: 'InstanciaAlpha'
            })

            if (res && res.success) {
              disparoOk = true
              msgIdApi = res.data?.key?.id || res.data?.id || `EVO_${Date.now()}`
              enviadosComSucesso++
            } else {
              erroDesc = res?.error || 'Erro reportado pela Evolution API'
              tentativaAtual++
              if (tentativaAtual <= 3) {
                // Intervalo progressivo de retry
                await new Promise(r => setTimeout(r, tentativaAtual * 2000))
              }
            }
          } catch (errApi) {
            erroDesc = errApi.message
            tentativaAtual++
            if (tentativaAtual <= 3) {
              await new Promise(r => setTimeout(r, tentativaAtual * 2000))
            }
          }
        }

        // 5. Atualização atômica do resultado
        if (disparoOk) {
          await updateDoc(docDisparoRef, {
            status: 'enviado_api',
            mensagemIdApi: msgIdApi,
            enviadoEm: serverTimestamp(),
            tentativas: tentativaAtual
          })
        } else {
          falhas++
          await updateDoc(docDisparoRef, {
            status: 'falha',
            erro: erroDesc,
            tentativas: tentativaAtual
          })
        }

        // 6. Intervalo cadenciado entre disparos (2 a 5 segundos)
        if (i < listaDisparo.length - 1 && !filaCanceladaRef.current) {
          await new Promise(r => setTimeout(r, disparoDelay * 1000))
        }
      }

      showFeedback(`Lote finalizado! ${enviadosComSucesso} enviados com sucesso, ${falhas} falhas.`)
    } catch (errLote) {
      console.error('Erro crítico no lote:', errLote)
      alert(`Falha no motor de disparos: ${errLote.message}`)
    } finally {
      setIsFilaExecutando(false)
      setIsFilaPausada(false)
    }
  }

  const handlePausarFila = () => {
    filaPausadaRef.current = true
    setIsFilaPausada(true)
    showFeedback('Fila pausada! O próximo disparo está em espera.')
  }

  const handleRetomarFila = () => {
    filaPausadaRef.current = false
    setIsFilaPausada(false)
    showFeedback('Retomando processamento da fila...')
  }

  const handleCancelarFila = () => {
    if (window.confirm('Tem certeza que deseja cancelar o restante da fila de disparos?')) {
      filaCanceladaRef.current = true
      setIsFilaExecutando(false)
      setIsFilaPausada(false)
      showFeedback('Fila cancelada.')
    }
  }

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
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#6E8B85]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-72 h-72 bg-[#DCE8E3]/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DCE8E3]/20 border border-[#A8BCB9]/40 text-[#DCE8E3] text-xs font-semibold uppercase tracking-wider">
                <Leaf size={14} className="text-[#A8BCB9]" /> Sustentabilidade Alpha
              </span>
              <span className="text-xs text-slate-300 font-mono">Etapa 3 • Motor de Disparos WhatsApp</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <span className="p-2.5 bg-[#6E8B85]/20 rounded-2xl border border-[#A8BCB9]/30 inline-flex text-[#DCE8E3]">
                <Recycle size={28} className="animate-spin-slow" />
              </span>
              Recicla +
            </h1>
            <p className="text-sm text-slate-200/90 max-w-2xl font-light">
              Módulo oficial de conscientização ambiental, separação de resíduos e disparos individuais pelo WhatsApp.
            </p>
          </div>

          {/* Controles de Condomínio & Ações Rápidas */}
          <div className="flex flex-wrap items-center gap-3">
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
                  Condomínio: {userCondo || 'Vinculado'}
                </span>
              )}
            </div>

            {isAdmin && (
              <button
                onClick={handleRestaurarCatalogo}
                disabled={actionLoading}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-2xl text-xs font-semibold transition-all flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                title="Restaurar o catálogo oficial de 10 campanhas da Alpha no Firestore"
              >
                <RefreshCw size={14} className={actionLoading ? 'animate-spin' : ''} />
                <span>Restaurar Catálogo Oficial</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('disparos')}
              className="px-4 py-2.5 bg-[#6E8B85] hover:bg-[#5a736e] text-white rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shadow-md cursor-pointer hover:shadow-lg"
            >
              <Send size={16} strokeWidth={2.5} />
              <span>Novo Disparo WhatsApp</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── PAINEL DE KPIS & MÉTRICAS PRINCIPAIS ──────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
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

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col justify-between hover:border-[#6E8B85]/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Condomínios</span>
            <span className="p-2 bg-blue-50 text-blue-700 rounded-xl"><Building2 size={18} /></span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-extrabold text-[#233044]">{metrics.totalCondominios}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Recorte: <span className="font-semibold text-slate-800">{isAdmin ? selectedCondo : userCondo}</span>
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col justify-between hover:border-[#6E8B85]/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Aptos p/ Disparo</span>
            <span className="p-2 bg-emerald-50 text-emerald-700 rounded-xl"><Smartphone size={18} /></span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-extrabold text-emerald-700">{metrics.moradoresElegiveis}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Celulares válidos sem opt-out</p>
          </div>
        </div>

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

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col justify-between hover:border-[#6E8B85]/40 transition-colors col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Entregas API</span>
            <span className="p-2 bg-purple-50 text-purple-700 rounded-xl"><Send size={18} /></span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-extrabold text-[#233044]">{metrics.disparosAceitos}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              <span className="font-semibold text-purple-700">{metrics.disparosPendentes} pendentes</span> • {metrics.disparosFalhas} falhas
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
          onClick={() => setActiveTab('disparos')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'disparos'
              ? 'bg-[#233044] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Send size={16} />
          <span>Disparos WhatsApp (Motor)</span>
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
          <span>Fila & Acompanhamento ({disparosList.length})</span>
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
          <span>Moradores & Elegibilidade</span>
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
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center gap-3">
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
                <p className="text-xs text-slate-500">Nenhum resultado corresponde aos filtros aplicados.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {campanhasFiltradas.map((campanha) => {
                const isRascunho = campanha.status === 'Rascunho'
                const isPausada = campanha.status === 'Pausada'
                const isModeloGlobal = campanha.condominio === 'Todos'
                const isReadOnlyParaUsuario = isModeloGlobal && !isAdmin

                return (
                  <div
                    key={campanha.id}
                    className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group hover:border-[#6E8B85]/60"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#DCE8E3]/40 border border-[#A8BCB9]/40 text-[#233044] text-[11px] font-bold truncate max-w-[70%]">
                          <Leaf size={12} className="text-[#6E8B85] shrink-0" />
                          <span className="truncate">{campanha.tema || 'Sustentabilidade'}</span>
                        </span>

                        <div className="flex items-center gap-1.5">
                          {isModeloGlobal ? (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200 flex items-center gap-1">
                              <Sparkles size={10} /> Modelo Oficial Alpha
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200">
                              🏢 {campanha.condominio}
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

                      <h3 className="font-extrabold text-slate-900 text-base leading-snug group-hover:text-[#233044]">
                        {campanha.nome}
                      </h3>

                      {campanha.dicaRapida && (
                        <div className="p-3 bg-slate-50 border-l-3 border-[#6E8B85] rounded-r-xl text-xs text-slate-700">
                          <strong className="text-[#233044] font-semibold">💡 Dica de Ouro:</strong>{' '}
                          <span>{campanha.dicaRapida}</span>
                        </div>
                      )}

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

                    <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => setPreviewModal(campanha)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-[#233044] text-slate-700 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                        title="Ver prévia real como no WhatsApp do morador"
                      >
                        <Smartphone size={14} />
                        <span>Ver Prévia</span>
                      </button>

                      <div className="flex items-center gap-1">
                        {isReadOnlyParaUsuario ? (
                          <button
                            onClick={() => handleDuplicarCampanha(campanha)}
                            className="px-2.5 py-1.5 rounded-xl bg-[#DCE8E3]/80 hover:bg-[#DCE8E3] text-[#233044] text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                            title="Criar uma cópia personalizada deste modelo para o seu condomínio"
                          >
                            <Copy size={13} />
                            <span>Personalizar Cópia</span>
                          </button>
                        ) : (
                          <>
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
                          </>
                        )}
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
      {/* ABA 2: DISPAROS WHATSAPP (MOTOR DE DISPARO DA ETAPA 3)           */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'disparos' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Coluna 1 e 2: Configuração da Campanha e Texto */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="font-extrabold text-[#233044] text-base flex items-center gap-2">
                    <Send size={18} className="text-[#6E8B85]" />
                    1. Seleção e Preparação da Mensagem
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">Disparos Individuais</span>
                </div>

                {/* Seleção do Condomínio e Campanha */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">Condomínio Alvo *</label>
                    {isAdmin ? (
                      <select
                        value={disparoCondo}
                        onChange={(e) => setDisparoCondo(e.target.value)}
                        className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#6E8B85] font-semibold text-slate-800 cursor-pointer"
                      >
                        {condominiosList.map(c => (
                          <option key={c.id} value={c.nome}>
                            🏢 {c.nome}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        disabled
                        value={userCondo || 'Seu condomínio'}
                        className="w-full px-3 py-2.5 text-xs bg-slate-100 border border-slate-200 rounded-xl text-slate-600 font-semibold cursor-not-allowed"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">Campanha Educativa *</label>
                    <select
                      value={disparoCampanhaId}
                      onChange={(e) => {
                        const id = e.target.value
                        setDisparoCampanhaId(id)
                        const sel = campanhas.find(c => c.id === id)
                        if (sel) setDisparoTexto(sel.texto)
                      }}
                      className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#6E8B85] font-semibold text-slate-800 cursor-pointer"
                    >
                      {campanhas.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.status === 'Ativa' ? '🟢' : '🟡'} {c.nome} ({c.condominio === 'Todos' ? 'Global' : c.condominio})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Texto da Mensagem Personalizável */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-800">
                      Conteúdo da Mensagem (com placeholders dinâmicos)
                    </label>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {disparoTexto?.length || 0} caracteres
                    </span>
                  </div>
                  <textarea
                    rows={8}
                    value={disparoTexto}
                    onChange={(e) => setDisparoTexto(e.target.value)}
                    placeholder="Digite o texto da campanha educativa..."
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs text-slate-800 focus:outline-none focus:border-[#6E8B85] focus:bg-white leading-relaxed"
                  />
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span>Substituição automática: <code>{'{{nome_morador}}'}</code> e <code>{'{{nome_condominio}}'}</code>.</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (campanhaSelecionadaParaDisparo) {
                          setDisparoTexto(campanhaSelecionadaParaDisparo.texto)
                          showFeedback('Texto restaurado para o modelo original da campanha.')
                        }
                      }}
                      className="text-xs text-[#6E8B85] hover:underline font-bold cursor-pointer"
                    >
                      Restaurar Modelo
                    </button>
                  </div>
                </div>

                {/* Parâmetros do Motor: Delay e Modo Piloto */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <Sliders size={14} className="text-[#6E8B85]" />
                    Parâmetros do Motor de Disparo
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-600 font-medium">Intervalo entre disparos:</span>
                        <strong className="text-[#233044] font-bold">{disparoDelay} segundos</strong>
                      </div>
                      <input
                        type="range"
                        min={2}
                        max={5}
                        step={1}
                        value={disparoDelay}
                        onChange={(e) => setDisparoDelay(Number(e.target.value))}
                        className="w-full accent-[#6E8B85] cursor-pointer"
                      />
                      <span className="text-[10px] text-slate-400">Protege a instância contra banimento por spam no WhatsApp.</span>
                    </div>

                    <div className="flex items-start gap-2.5 p-2.5 bg-emerald-50/60 border border-emerald-200/60 rounded-xl">
                      <input
                        type="checkbox"
                        id="modoPiloto"
                        checked={disparoModoPiloto}
                        onChange={(e) => setDisparoModoPiloto(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded text-emerald-600 accent-emerald-600 cursor-pointer"
                      />
                      <label htmlFor="modoPiloto" className="text-xs text-emerald-950 font-medium cursor-pointer">
                        <strong className="font-bold text-emerald-900 block">Modo Piloto Controlado</strong>
                        Limitar disparo a no máximo 5 números autorizados para validação.
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Coluna 3: Envio de Teste e Botão de Ação */}
            <div className="space-y-4">
              {/* Card de Teste Antes do Envio */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                <div className="pb-2 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-extrabold text-[#233044] text-sm flex items-center gap-2">
                    <Smartphone size={16} className="text-[#6E8B85]" />
                    2. Enviar Teste Prévio
                  </h3>
                  <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    Recomendado
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Informe o seu próprio WhatsApp para receber a mensagem de teste em tempo real antes de autorizar o lote.
                </p>

                <div className="space-y-2">
                  <input
                    type="text"
                    value={testeNumero}
                    onChange={(e) => setTesteNumero(e.target.value)}
                    placeholder="DDD + Celular (ex: 83999998888)"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#6E8B85] font-mono text-slate-800"
                  />
                  <button
                    onClick={handleEnviarTeste}
                    disabled={testandoEnvio}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    {testandoEnvio ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                    <span>{testandoEnvio ? 'Enviando Teste...' : 'ENVIAR TESTE AGORA'}</span>
                  </button>
                </div>

                {resultadoTeste && (
                  <div className={`p-3 rounded-xl border text-xs ${
                    resultadoTeste.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}>
                    {resultadoTeste.success ? '✅ ' : '❌ '}
                    {resultadoTeste.message}
                  </div>
                )}
              </div>

              {/* Card de Resumo e Lançamento do Lote */}
              <div className="bg-gradient-to-br from-[#233044] to-[#1e2a3c] text-white rounded-3xl p-6 shadow-md space-y-4">
                <h3 className="font-extrabold text-white text-sm flex items-center gap-2">
                  <CheckSquare size={16} className="text-[#A8BCB9]" />
                  3. Lançamento do Disparo
                </h3>

                <div className="space-y-2 text-xs text-slate-200">
                  <div className="flex justify-between border-b border-white/10 pb-1.5">
                    <span>Condomínio Destino:</span>
                    <strong className="text-white truncate max-w-[140px]">{isAdmin ? disparoCondo : userCondo}</strong>
                  </div>
                  <div className="flex justify-between border-b border-white/10 pb-1.5">
                    <span>Total Cadastrados:</span>
                    <strong className="text-white">{relatorioDisparo.estatisticas.totalCadastrados}</strong>
                  </div>
                  <div className="flex justify-between border-b border-white/10 pb-1.5">
                    <span>Aptos p/ Disparo:</span>
                    <strong className="text-emerald-400 font-bold">{relatorioDisparo.estatisticas.elegiveisCount}</strong>
                  </div>
                  <div className="flex justify-between border-b border-white/10 pb-1.5">
                    <span>Selecionados no Lote:</span>
                    <strong className="text-[#DCE8E3] text-sm font-extrabold">
                      {disparoModoPiloto ? Math.min(moradoresSelecionados.size, 5) : moradoresSelecionados.size}
                    </strong>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span>Tempo Estimado:</span>
                    <strong className="text-slate-300">
                      ~{Math.ceil(((disparoModoPiloto ? Math.min(moradoresSelecionados.size, 5) : moradoresSelecionados.size) * disparoDelay) / 60)} min
                    </strong>
                  </div>
                </div>

                <button
                  onClick={() => {
                    const total = disparoModoPiloto ? Math.min(moradoresSelecionados.size, 5) : moradoresSelecionados.size
                    if (total === 0) {
                      alert('Selecione pelo menos 1 morador elegível na lista abaixo.')
                      return
                    }
                    setConfirmModal(true)
                  }}
                  disabled={isFilaExecutando || (disparoModoPiloto ? Math.min(moradoresSelecionados.size, 5) : moradoresSelecionados.size) === 0}
                  className="w-full py-3 bg-[#6E8B85] hover:bg-[#5a736e] text-white rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer hover:scale-101 disabled:opacity-50"
                >
                  <Send size={16} />
                  <span>
                    {isFilaExecutando ? 'Fila em Andamento...' : `DISPARAR PARA ${disparoModoPiloto ? Math.min(moradoresSelecionados.size, 5) : moradoresSelecionados.size} MORADORES`}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Lista de Seleção de Moradores do Condomínio com Controles Individuais */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/80">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="selectAll"
                  checked={moradoresSelecionados.size === (relatorioDisparo.elegiveis || []).length && (relatorioDisparo.elegiveis || []).length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      const elegiveis = relatorioDisparo.elegiveis || []
                      const limite = disparoModoPiloto ? elegiveis.slice(0, 5) : elegiveis
                      setMoradoresSelecionados(new Set(limite.map(m => m.id)))
                    } else {
                      setMoradoresSelecionados(new Set())
                    }
                  }}
                  className="w-4 h-4 rounded text-[#233044] accent-[#233044] cursor-pointer"
                />
                <label htmlFor="selectAll" className="text-xs font-extrabold text-slate-800 cursor-pointer">
                  Destinatários do Condomínio ({moradoresDoDisparo.length}) — {isAdmin ? disparoCondo : userCondo}
                </label>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-emerald-700 font-semibold">{relatorioDisparo.estatisticas.elegiveisCount} aptos</span>
                <span className="text-slate-300">•</span>
                <span className="text-amber-700 font-semibold">{relatorioDisparo.estatisticas.optOutCount} opt-out</span>
                <span className="text-slate-300">•</span>
                <span className="text-rose-700 font-semibold">{relatorioDisparo.estatisticas.invalidosCount} sem celular</span>
              </div>
            </div>

            <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
              {moradoresDoDisparo.length === 0 ? (
                <div className="p-10 text-center text-xs text-slate-500">
                  Nenhum morador cadastrado neste condomínio.
                </div>
              ) : (
                moradoresDoDisparo.map(m => {
                  const rawTel = m.tel || m.telefone || m.whatsapp || m.celular || ''
                  const telLimpo = String(rawTel).replace(/\D/g, '')
                  const telE164 = normalizarTelefone(rawTel)
                  const validacao = validarTelefoneWhatsApp(rawTel)
                  const isOptOut = optoutSet.has(String(m.id)) ||
                                   (telLimpo && optoutSet.has(telLimpo)) ||
                                   (telE164 && optoutSet.has(telE164))

                  const isElegivel = validacao.valido && !isOptOut
                  const isSelected = moradoresSelecionados.has(m.id)

                  return (
                    <div
                      key={m.id}
                      className={`p-3.5 px-4 flex items-center justify-between gap-3 text-xs transition-colors ${
                        !isElegivel ? 'bg-slate-50/60 opacity-70' : isSelected ? 'bg-emerald-50/30' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          disabled={!isElegivel}
                          checked={isSelected}
                          onChange={(e) => {
                            const newSet = new Set(moradoresSelecionados)
                            if (e.target.checked) {
                              newSet.add(m.id)
                            } else {
                              newSet.delete(m.id)
                            }
                            setMoradoresSelecionados(newSet)
                          }}
                          className="w-4 h-4 rounded text-[#6E8B85] accent-[#6E8B85] cursor-pointer disabled:cursor-not-allowed"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 truncate">{m.nome}</span>
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">
                              {m.apt ? `Apt ${m.apt}` : 'Sem apt'} {m.bloco ? `• Bl ${m.bloco}` : ''}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                            <Smartphone size={12} className={validacao.valido ? 'text-emerald-600' : 'text-slate-300'} />
                            {validacao.valido ? rawTel : (rawTel ? `${rawTel} (${validacao.motivo})` : 'Telefone não cadastrado')}
                          </p>
                        </div>
                      </div>

                      <div>
                        {isOptOut ? (
                          <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 text-[10px] font-bold">
                            🚫 Opt-out Ativo (LGPD)
                          </span>
                        ) : !validacao.valido ? (
                          <span className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 text-[10px] font-bold">
                            ⚠️ Inelegível
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            ✅ Apto para Disparo
                          </span>
                        )}
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
      {/* ABA 3: FILA & ACOMPANHAMENTO DE DISPAROS                         */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'fila' && (
        <div className="space-y-4">
          {/* Painel de Controle de Execução da Fila Ativa */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-[#233044] text-base">Painel da Fila em Tempo Real</h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    isFilaExecutando
                      ? isFilaPausada ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800 animate-pulse'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {isFilaExecutando ? (isFilaPausada ? 'Fila Pausada' : 'Processando Sequencial') : 'Fila em Espera'}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {isFilaExecutando
                    ? `Disparando mensagem ${disparoAtualIndex} de ${disparoTotalLote} com intervalo de ${disparoDelay}s...`
                    : 'Nenhum lote em processamento ativo no momento.'}
                </p>
              </div>

              {/* Botões de Controle da Fila */}
              {isFilaExecutando && (
                <div className="flex items-center gap-2">
                  {isFilaPausada ? (
                    <button
                      onClick={handleRetomarFila}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Play size={14} />
                      <span>Retomar Fila</span>
                    </button>
                  ) : (
                    <button
                      onClick={handlePausarFila}
                      className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Pause size={14} />
                      <span>Pausar</span>
                    </button>
                  )}

                  <button
                    onClick={handleCancelarFila}
                    className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Square size={14} />
                    <span>Cancelar Lote</span>
                  </button>
                </div>
              )}
            </div>

            {/* Barra de Progresso Visual */}
            {isFilaExecutando && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-slate-700">
                  <span>Progresso do Lote Ativo:</span>
                  <span>{disparoTotalLote > 0 ? Math.round((disparoAtualIndex / disparoTotalLote) * 100) : 0}%</span>
                </div>
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                  <div
                    className="bg-[#6E8B85] h-full transition-all duration-300"
                    style={{ width: `${disparoTotalLote > 0 ? (disparoAtualIndex / disparoTotalLote) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Histórico Individual dos Disparos */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-extrabold text-slate-800 text-sm">
                Histórico de Disparos Registrados ({disparosList.length})
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                Ordenado cronologicamente
              </span>
            </div>

            {disparosList.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <Clock size={32} className="text-slate-300 mx-auto" />
                <h4 className="font-bold text-slate-700 text-sm">Nenhum registro de disparo ainda</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Acesse a aba <strong>Disparos WhatsApp</strong> para iniciar o primeiro teste ou lote.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                {disparosList.map((d) => (
                  <div key={d.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-slate-50/80">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <strong className="text-slate-900 font-bold">{d.moradorNome || 'Morador'}</strong>
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">
                          {d.condominio} {d.moradorApt ? `• Apt ${d.moradorApt}` : ''}
                        </span>
                      </div>
                      <p className="text-slate-500 font-mono text-[11px]">{d.telefone} • Campanha: {d.campanhaNome}</p>
                      {d.mensagemIdApi && (
                        <p className="text-[10px] text-slate-400 font-mono">ID WhatsApp: {d.mensagemIdApi}</p>
                      )}
                      {d.erro && (
                        <p className="text-[10px] text-rose-600 font-medium">Motivo falha: {d.erro}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                        d.status === 'enviado_api' || d.status === 'entregue'
                          ? 'bg-emerald-100 text-emerald-800'
                          : d.status === 'falha'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                      }`}>
                        {d.status === 'enviado_api' ? 'Aceito pela API' : d.status === 'entregue' ? 'Entregue' : d.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ABA 4: MORADORES & ELEGIBILIDADE (PREVENÇÃO LGPD E HIGIENIZAÇÃO)  */}
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

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setMoradorSubFilter('todos')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                moradorSubFilter === 'todos' ? 'bg-[#233044] text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Todos ({relatorioElegibilidade.estatisticas.totalCadastrados})
            </button>
            <button
              onClick={() => setMoradorSubFilter('elegiveis')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                moradorSubFilter === 'elegiveis' ? 'bg-emerald-700 text-white' : 'bg-white border border-slate-200 text-emerald-800 hover:bg-emerald-50'
              }`}
            >
              ✅ Aptos para Disparo ({relatorioElegibilidade.estatisticas.elegiveisCount})
            </button>
            <button
              onClick={() => setMoradorSubFilter('optout')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                moradorSubFilter === 'optout' ? 'bg-amber-700 text-white' : 'bg-white border border-slate-200 text-amber-800 hover:bg-amber-50'
              }`}
            >
              🚫 Opt-out Ativo ({relatorioElegibilidade.estatisticas.optOutCount})
            </button>
            <button
              onClick={() => setMoradorSubFilter('invalidos')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                moradorSubFilter === 'invalidos' ? 'bg-rose-700 text-white' : 'bg-white border border-slate-200 text-rose-800 hover:bg-rose-50'
              }`}
            >
              ⚠️ Inválidos / Fixos ({relatorioElegibilidade.estatisticas.invalidosCount})
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-extrabold text-slate-800 text-sm">
                Lista de Moradores ({moradoresExibidos.length}) — {isAdmin ? selectedCondo : userCondo}
              </h3>
            </div>

            <div className="divide-y divide-slate-100 max-h-[550px] overflow-y-auto">
              {moradoresExibidos.map((m) => {
                const rawTel = m.tel || m.telefone || m.whatsapp || m.celular || m.telefoneOriginal || ''
                const telLimpo = String(rawTel).replace(/\D/g, '')
                const telE164 = normalizarTelefone(rawTel)
                const validacao = validarTelefoneWhatsApp(rawTel)
                const temOptOut = optoutSet.has(String(m.id)) ||
                                 (telLimpo && optoutSet.has(telLimpo)) ||
                                 (telE164 && optoutSet.has(telE164))

                return (
                  <div key={m.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{m.nome}</span>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-semibold">
                          {m.apt ? `Apt ${m.apt}` : 'Sem apt'} {m.bloco ? `• Bloco ${m.bloco}` : ''}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">{m.condominio}</span>
                      </div>
                      <p className="font-mono text-slate-500">
                        {validacao.valido ? rawTel : (rawTel ? `${rawTel} (${validacao.motivo})` : 'Telefone não cadastrado')}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-semibold ${temOptOut ? 'text-amber-700' : (validacao.valido ? 'text-emerald-700' : 'text-slate-400')}`}>
                        {temOptOut ? '🚫 Bloqueado (Opt-out)' : (validacao.valido ? '✅ Apto p/ WhatsApp' : '⚠️ Inelegível')}
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
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ABA 5: DIRETRIZES DO PROGRAMA RECICLA +                          */}
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
                As campanhas educativas cobrem desde a separação básica com duas lixeiras em casa até o descarte seguro de pilhas, óleos e caixas de papelão desmontadas, reduzindo em até 70% o volume ocupado nas lixeiras coletivas.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <h3 className="font-bold text-sm text-[#233044] flex items-center gap-2">
                <Smartphone size={16} className="text-[#6E8B85]" />
                2. Disparos Individuais e Respeito aos Moradores
              </h3>
              <p className="text-xs text-slate-700 leading-relaxed">
                Nunca são enviados comunicados em grupos abertos de WhatsApp para evitar poluição visual e debates paralelos. Cada mensagem é enviada diretamente ao número do morador, personalizada com seu primeiro nome e condomínio.
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
                Condomínios organizados e limpos têm menor incidência de pragas urbanas, menores despesas com desentupimento de caixas de gordura e valorizam o patrimônio coletivo.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL DE CONFIRMAÇÃO EXPRESSA DE DISPARO EM LOTE ─────────── */}
      {confirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm"
          onClick={() => setConfirmModal(false)}
        >
          <div
            className="bg-white max-w-lg w-full rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-5 animate-scale-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-[#233044]">
              <div className="p-3 bg-amber-100 text-amber-800 rounded-2xl">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="font-extrabold text-base">Confirmar Disparo em Lote</h3>
                <p className="text-xs text-slate-500">Leia com atenção antes de autorizar o envio.</p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600">Condomínio Alvo:</span>
                <strong className="text-slate-900">{isAdmin ? disparoCondo : userCondo}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Campanha:</span>
                <strong className="text-slate-900">{campanhaSelecionadaParaDisparo?.nome}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Destinatários Selecionados:</span>
                <strong className="text-emerald-700 text-sm font-extrabold">
                  {disparoModoPiloto ? Math.min(moradoresSelecionados.size, 5) : moradoresSelecionados.size} moradores
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Intervalo entre Mensagens:</span>
                <strong className="text-slate-900">{disparoDelay} segundos</strong>
              </div>
              {disparoModoPiloto && (
                <div className="p-2 bg-emerald-100 text-emerald-900 rounded-lg text-[11px] font-bold">
                  🧪 Modo Piloto Ativo: Limitado rigorosamente aos primeiros 5 números para validação controlada.
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmModal(false)}
                className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarELancarLote}
                className="px-5 py-2.5 bg-[#233044] hover:bg-[#1a2535] text-white rounded-xl font-bold text-xs shadow-md cursor-pointer flex items-center gap-2"
              >
                <Check size={16} />
                <span>Sim, Autorizo o Início do Disparo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL DE PRÉVIA INTERATIVA WHATSAPP ────────────────────────── */}
      {previewModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm"
          onClick={() => setPreviewModal(null)}
        >
          <div
            className="bg-white max-w-md w-full rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden animate-scale-up"
            onClick={e => e.stopPropagation()}
          >
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

            <div className="p-4 overflow-y-auto bg-[#ECE5DD] flex-1 space-y-3 font-sans">
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

              <div className="bg-white rounded-2xl rounded-tl-sm p-4 shadow-sm border border-black/5 text-xs text-slate-800 space-y-3 leading-relaxed relative">
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#DCE8E3] text-[#233044] text-[10px] font-bold">
                  🌱 {previewModal.tema}
                </div>

                <div className="whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-slate-900">
                  {interpolarMensagem(previewModal.texto, {
                    nomeMorador: previewMoradorExemplo || 'Morador(a)',
                    nomeCondominio: selectedCondo === 'Todos' ? (previewModal.condominio === 'Todos' ? 'Residencial Florença' : previewModal.condominio) : selectedCondo
                  })}
                </div>

                <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 pt-1">
                  <span>09:00</span>
                  <span className="text-blue-500 font-bold">✓✓</span>
                </div>
              </div>
            </div>

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

      {/* ─── MODAL DE EDIÇÃO DE CAMPANHA ─────────────────────────────────── */}
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
