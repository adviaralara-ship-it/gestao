import React, { useState, useEffect, useRef } from 'react'
import { Plus, X, Search, FileText, Download, Copy, RefreshCw, Scale, Lightbulb, Users, Calendar, Megaphone, Send, Bot, Camera, Sparkles, AlertCircle, Maximize2, Minimize2, Settings, History, User, ChevronDown, CheckCircle, Zap, Volume2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { doc, getDoc, setDoc, updateDoc, arrayUnion, serverTimestamp, collection, addDoc, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { GoogleGenerativeAI } from '@google/generative-ai'
import QRCode from 'react-qr-code'

// Chave da API e Instância do Gemini
const API_KEYS = [
  import.meta.env?.VITE_GEMINI_API_KEY,
  "AQ.Ab8RN6Ik8r-5xXO62z8qMO7Ne9Qxf8jUNTLpuWN4Ou2SPJAhXA"
].filter(Boolean)

// Resposta inteligente local baseada no contexto do condomínio e nos dados reais do Firestore
async function generateLocalAIResponse(input, user, knowledgeBase) {
  const norm = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
  const q = norm(input)

  let sindicoNome = 'Síndico(a) do Condomínio'
  let sindicoTel = ''
  let sindicoEmail = ''
  let condoNome = user.condominio || 'ALPHA CONDOMINIOS'
  let chavePix = ''

  try {
    const condosSnap = await getDocs(collection(db, 'condominios'))
    const matchCondo = condosSnap.docs.find(d => {
      const n = norm(d.data().nome)
      return n === norm(user.condominio) || n.includes(norm(user.condominio)) || norm(user.condominio).includes(n)
    })
    if (matchCondo) {
      const cData = matchCondo.data()
      if (cData.sindico) sindicoNome = cData.sindico
      if (cData.chave_pix) chavePix = cData.chave_pix
    }

    const usersSnap = await getDocs(collection(db, 'usuarios'))
    const sindicoUser = usersSnap.docs.find(d => {
      const u = d.data()
      return (u.role === 'Síndico' || u.role === 'Administrador') && 
        (!u.condominio || norm(u.condominio) === norm(user.condominio) || norm(u.condominio).includes(norm(user.condominio)))
    })
    if (sindicoUser) {
      const uData = sindicoUser.data()
      if (uData.telefone) sindicoTel = uData.telefone
      if (uData.email) sindicoEmail = uData.email
      if (uData.nome && sindicoNome === 'Síndico(a) do Condomínio') sindicoNome = uData.nome
    }
  } catch (err) {
    console.warn("Erro ao buscar dados contextuais:", err)
  }

  if (q.includes('sindico') || q.includes('whatsapp') || q.includes('telefone') || q.includes('contato') || q.includes('numero') || q.includes('falar com')) {
    const telFormat = sindicoTel ? `📱 **WhatsApp / Telefone:** ${sindicoTel}` : `📱 **WhatsApp da Administração:** (83) 99846-8997`
    const emailFormat = sindicoEmail ? `\n✉️ **E-mail:** ${sindicoEmail}` : ''
    return `Olá, ${user.nome}! Seguem os dados de contato do síndico e da administração do condomínio **${condoNome}**:\n\n👤 **Síndico(a):** ${sindicoNome}\n${telFormat}${emailFormat}\n\nVocê pode entrar em contato para dúvidas administrativas ou agendamentos. Se preferir, posso registrar uma ocorrência ou solicitação direta para você aqui!`
  }

  if (q.includes('boleto') || q.includes('segunda via') || q.includes('2 via') || q.includes('pagamento') || q.includes('pagar') || q.includes('vencimento') || q.includes('taxa')) {
    const pixInfo = chavePix ? `\n\n🔑 **Chave PIX do Condomínio:** \`${chavePix}\`` : ''
    return `Olá, ${user.nome}! Para consultar seus boletos e efetuar o pagamento da cota condominial:\n\n1. Acesse o menu **Boletos & Fundo** no painel lateral.\n2. Lá você encontrará a lista de boletos da sua unidade (${user.unidade ? 'Apt ' + user.unidade : 'sua unidade'}).\n3. Você pode baixar o **PDF oficial**, copiar a **Linha Digitável** ou pagar via **PIX Copia e Cola** instantâneo.${pixInfo}\n\nTodos os boletos são enviados também automaticamente no seu WhatsApp cadastrado!`
  }

  if (q.includes('reserva') || q.includes('salao') || q.includes('churrasqueira') || q.includes('espaco gourmet') || q.includes('agendar') || q.includes('piscina')) {
    let espacoDetectado = 'Salão de Festas'
    if (q.includes('churrasqueira')) espacoDetectado = 'Churrasqueira'
    if (q.includes('gourmet')) espacoDetectado = 'Espaço Gourmet'
    return `Olá, ${user.nome}! Você pode solicitar a reserva de áreas comuns diretamente por aqui ou no menu **Reservas**.\n\n📅 **Espaço:** ${espacoDetectado}\n🏢 **Unidade:** ${user.unidade || 'Morador'}\n\nClique no botão abaixo para confirmar o seu pedido de reserva:\n\n[CRIAR_RESERVA: ${espacoDetectado} - ${new Date().toLocaleDateString('pt-BR')} - 18:00]`
  }

  if (q.includes('barulho') || q.includes('reclam') || q.includes('vazamento') || q.includes('lampada') || q.includes('quebr') || q.includes('som alto') || q.includes('problema') || q.includes('ocorrencia') || q.includes('sujeira') || q.includes('cachorro') || q.includes('vizinho')) {
    return `Entendido, ${user.nome}. Sinto muito pelo transtorno. Posso registrar uma ocorrência formal diretamente para a administração e o síndico tomarem as providências necessárias.\n\nClique no botão abaixo para oficializar o registro:\n\n[CRIAR_OCORRENCIA: ${input.trim()}]`
  }

  if (q.includes('regra') || q.includes('horario') || q.includes('silencio') || q.includes('mudanca') || q.includes('lixo') || q.includes('pet') || q.includes('animais')) {
    return `Olá, ${user.nome}! Aqui estão as diretrizes de convivência do condomínio **${condoNome}**:\n\n🔇 **Horário de Silêncio:** Das 22h00 às 08h00 (em dias de semana) e até 09h00 aos finais de semana.\n📦 **Mudanças e Obras:** De segunda a sexta-feira, das 08h00 às 17h00 (necessário agendamento prévio com a administração).\n🗑️ **Descarte de Lixo:** Todo lixo deve ser ensacado e depositado na lixeira do bloco.\n🐾 **Animais de Estimação (Pets):** Permitidos nas áreas privativas; nas áreas comuns devem circular com coleira/guia.\n\nPara consultar o documento completo, acesse a aba **Regime & Documentos** no menu lateral!`
  }

  if (q.includes('visitante') || q.includes('convidado') || q.includes('portaria') || q.includes('encomenda') || q.includes('entrega') || q.includes('qr code')) {
    return `Olá, ${user.nome}!\n\n🚪 **Visitantes & Convidados:** Você pode cadastrar e gerar um convite com **QR Code digital** no menu **Eventos & Visitantes** para liberar a entrada rápida na portaria.\n📦 **Encomendas:** Assim que uma encomenda ou entrega chegar para sua unidade, a portaria registrará no sistema e você receberá uma notificação automática no seu WhatsApp!`
  }

  if (q.includes('ola') || q.includes('oi') || q.includes('bom dia') || q.includes('boa tarde') || q.includes('boa noite') || q.includes('tudo bem') || q.includes('quem e voce')) {
    return `Olá, ${user.nome}! Tudo bem? Eu sou o **Alpha AI**, seu Concierge Virtual do condomínio **${condoNome}**.\n\nEstou à sua disposição 24 horas por dia para:\n• Informar dados de contato do síndico e administração;\n• Ajudar na emissão de boletos e 2ª via;\n• Agendar reservas de áreas comuns (salão de festas, churrasqueira);\n• Registrar ocorrências e solicitações de manutenção;\n• Esclarecer regras e horários do condomínio.\n\nComo posso te ajudar agora?`
  }

  return `Olá, ${user.nome}! Compreendi a sua mensagem referente a "${input}".\n\nCaso precise de assistência imediata com o síndico ou a administração do condomínio **${condoNome}**, você pode entrar em contato via WhatsApp no número **${sindicoTel || '(83) 99846-8997'}** (${sindicoNome}).\n\nSe desejar abrir um chamado formal ou reservar um espaço, basta me pedir que registro imediatamente para você!`
}

// Componente interno para processar e renderizar os "Widgets" de Ação no meio da mensagem
const RenderMessage = ({ message, user }) => {
  let text = message.text

  // Ocorrência
  const matchOcorrencia = text.match(/\[CRIAR_OCORRENCIA:(.*?)\]/)
  let ocorrenciaDesc = ''
  if (matchOcorrencia) {
    ocorrenciaDesc = matchOcorrencia[1].trim()
    text = text.replace(matchOcorrencia[0], '')
  }

  // Reserva
  const matchReserva = text.match(/\[CRIAR_RESERVA:(.*?)\]/)
  let reservaDetails = ''
  if (matchReserva) {
    reservaDetails = matchReserva[1].trim()
    text = text.replace(matchReserva[0], '')
  }

  const [actionStatus, setActionStatus] = useState(null) // null, 'loading', 'done'
  const [isPlaying, setIsPlaying] = useState(false)

  const handleSpeak = () => {
    if (isPlaying) {
      window.speechSynthesis.cancel()
      setIsPlaying(false)
      return
    }
    
    const cleanText = text.replace(/\[.*?\]/g, '').replace(/\*/g, '')
    const utterance = new SpeechSynthesisUtterance(cleanText)
    utterance.lang = 'pt-BR'
    utterance.pitch = 1.1 // Voz um pouco mais animada
    utterance.rate = 1.05
    
    utterance.onend = () => setIsPlaying(false)
    
    setIsPlaying(true)
    window.speechSynthesis.speak(utterance)
  }

  const handleCriarOcorrencia = async () => {
    setActionStatus('loading')
    try {
      await addDoc(collection(db, 'ocorrencias'), {
        titulo: 'Ocorrência via IA',
        categoria: 'Outros',
        prioridade: 'Média',
        visibilidade: 'Público',
        autor: user.nome,
        nome_morador: user.nome,
        apt: user.apt || '',
        condominio: user.condominio || '',
        data: new Date().toLocaleDateString('pt-BR'),
        descricao: ocorrenciaDesc,
        status: 'Aberta',
        uid: user.uid || user.id,
        _createdAt: serverTimestamp()
      })
      
      // Notificação
      await addDoc(collection(db,'notificacoes'),{
        text:`[${user.condominio}] Nova Ocorrência (Via AI): ${ocorrenciaDesc}`,
        time:new Date().toISOString(), tipo:'ocorrencia', lida:false, condominio: user.condominio, _createdAt:serverTimestamp()
      })
      setActionStatus('done')
    } catch (e) {
      alert("Erro ao criar ocorrência.")
      setActionStatus(null)
    }
  }

  const handleCriarReserva = async () => {
    setActionStatus('loading')
    try {
      const parts = reservaDetails.split(' - ')
      const espaco = parts[0] || reservaDetails
      const dataStr = parts[1] || new Date().toLocaleDateString('pt-BR')
      const horarioStr = parts[2] || 'A definir'
      
      await addDoc(collection(db, 'reservas'), {
        morador: user.nome,
        apt: user.apt || '',
        condominio: user.condominio || '',
        espaco: espaco,
        data: dataStr,
        horario: horarioStr,
        pessoas: '',
        status: 'Pendente',
        uid: user.uid || user.id,
        _createdAt: serverTimestamp()
      })
      
      // Notificação
      await addDoc(collection(db,'notificacoes'),{
        text:`[${user.condominio}] Nova Reserva (Via AI): ${espaco} - Pendente Aprovação`,
        time:new Date().toISOString(), tipo:'reserva', lida:false, condominio: user.condominio, _createdAt:serverTimestamp()
      })
      setActionStatus('done')
    } catch (e) {
      alert("Erro ao criar reserva.")
      setActionStatus(null)
    }
  }

  return (
    <div className={`p-3 rounded-2xl max-w-[85%] shadow-sm relative ${message.role === 'user' ? 'bg-brand-600 text-white rounded-br-none ml-auto' : 'bg-white border border-cream-200 text-gray-700 rounded-bl-none mr-auto'}`}>
      <p className="text-sm whitespace-pre-wrap leading-relaxed">{text}</p>
      
      {message.role === 'model' && (
        <div className="mt-2 pt-2 border-t border-cream-100 flex justify-end">
          <button 
            onClick={handleSpeak} 
            className="flex items-center gap-1 p-1 px-2 bg-cream-50 rounded-lg text-gray-500 hover:text-brand-600 hover:bg-brand-50 transition-all text-[10px] font-medium"
            title="Ouvir resposta"
          >
            <Volume2 size={12} className={isPlaying ? 'text-brand-600 animate-pulse' : ''} />
            {isPlaying ? 'Ouvindo...' : 'Ouvir resposta'}
          </button>
        </div>
      )}
      
      {/* Widget de Ocorrência */}
      {matchOcorrencia && (
        <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-xl">
          <p className="text-xs font-bold text-red-800 mb-2 flex items-center gap-1"><Zap size={14}/> Abertura de Ocorrência</p>
          <p className="text-xs text-red-700 mb-3">{ocorrenciaDesc}</p>
          {actionStatus === 'done' ? (
            <div className="text-xs font-bold text-emerald-600 flex items-center gap-1"><CheckCircle size={14}/> Ocorrência Registrada!</div>
          ) : (
            <button onClick={handleCriarOcorrencia} disabled={actionStatus==='loading'} className="btn-primary py-1.5 px-3 text-xs w-full justify-center bg-red-600 hover:bg-red-700 border-none">
              {actionStatus === 'loading' ? 'Registrando...' : 'Confirmar e Abrir Chamado'}
            </button>
          )}
        </div>
      )}

      {/* Widget de Reserva */}
      {matchReserva && (
        <div className="mt-3 p-3 bg-brand-50 border border-brand-100 rounded-xl">
          <p className="text-xs font-bold text-brand-800 mb-2 flex items-center gap-1"><Zap size={14}/> Pré-Reserva Gerada</p>
          <p className="text-xs text-brand-700 mb-3">{reservaDetails}</p>
          {actionStatus === 'done' ? (
            <div className="flex flex-col items-center gap-2 mt-2 pt-2 border-t border-brand-200">
              <div className="text-xs font-bold text-emerald-600 flex items-center gap-1"><CheckCircle size={14}/> Pedido de reserva enviado para aprovação!</div>
            </div>
          ) : (
            <button onClick={handleCriarReserva} disabled={actionStatus==='loading'} className="btn-primary py-1.5 px-3 text-xs w-full justify-center">
              {actionStatus === 'loading' ? 'Enviando...' : 'Confirmar Pedido de Reserva'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function AlphaAI() {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)
  
  // Base de Conhecimento
  const [knowledgeBase, setKnowledgeBase] = useState("")

  const chatDocRef = user ? doc(db, 'ai_chats', user.uid || user.id) : null

  useEffect(() => {
    if (user && isOpen) {
      loadHistory()
      loadKnowledgeBase()
    }
  }, [user, isOpen])

  useEffect(() => {
    const handleOpenChat = () => setIsOpen(true)
    window.addEventListener('open-ai-chat', handleOpenChat)
    return () => window.removeEventListener('open-ai-chat', handleOpenChat)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadKnowledgeBase = async () => {
    try {
      const snap = await getDocs(collection(db, 'ai_knowledge'))
      const rules = snap.docs.map(d => d.data().text).join('\n')
      setKnowledgeBase(rules)
    } catch (e) {
      console.error("Erro ao carregar base de conhecimento", e)
    }
  }

  const loadHistory = async () => {
    if (!chatDocRef) return
    const snap = await getDoc(chatDocRef)
    if (snap.exists()) {
      setMessages(snap.data().messages || [])
    } else {
      // Mensagem de boas vindas inicial
      const welcomeMsg = { role: 'model', text: `OlÃ¡, ${user.nome}! Eu sou o Alpha AI, seu Concierge Virtual. Como posso te ajudar hoje?` }
      setMessages([welcomeMsg])
      await setDoc(chatDocRef, {
        userId: user.uid || user.id,
        userName: user.nome,
        condominio: user.condominio || '',
        apt: user.apt || '',
        lastActivity: serverTimestamp(),
        messages: [welcomeMsg]
      })
    }
  }

  const handleSend = async () => {
    if (!input.trim() || !user || loading) return
    
    const userMsg = { role: 'user', text: input }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      await updateDoc(chatDocRef, {
        messages: arrayUnion(userMsg),
        lastActivity: serverTimestamp()
      })

      let aiResponse = ''

      for (const key of API_KEYS) {
        try {
          const genAI = new GoogleGenerativeAI(key)
          const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

          const systemPrompt = `
Você é o "Alpha AI", o Concierge Virtual extremamente educado e inteligente do condomínio "${user.condominio || 'ALPHA CONDOMINIOS'}".
O morador com quem você está falando se chama "${user.nome}" (Apartamento ${user.apt || user.unidade || 'Unidade'}).
Seja amigável, direto, e use português brasileiro formal e acolhedor.

BASE DE CONHECIMENTO DO CONDOMÍNIO:
${knowledgeBase || "Regras padrão de boa convivência e gestão condominial."}

REGRAS ESPECIAIS DE AÇÃO (TOOL CALLING):
1. Se o morador relatar um problema/ocorrência (ex: barulho, vazamento, lâmpada queimada), inclua no final da sua resposta a tag:
[CRIAR_OCORRENCIA: resumo curto da ocorrência]
2. Se o morador quiser agendar ou reservar uma área comum (ex: salão de festas, churrasqueira), inclua no final:
[CRIAR_RESERVA: Espaço - Data - Horário]
`
          const chat = model.startChat({
            history: [
              { role: 'user', parts: [{ text: systemPrompt }] },
              { role: 'model', parts: [{ text: `Olá! Sou o assistente virtual do condomínio ${user.condominio}. Como posso ajudar?` }] },
              ...messages.slice(-8).map(m => ({
                role: m.role,
                parts: [{ text: m.text }]
              }))
            ]
          })

          const result = await chat.sendMessage(input)
          aiResponse = result.response.text()
          if (aiResponse) break
        } catch (err) {
          console.warn("Gemini indisponível no widget, acionando motor local:", err.message)
        }
      }

      if (!aiResponse) {
        aiResponse = await generateLocalAIResponse(input, user, knowledgeBase)
      }

      const modelMsg = { role: 'model', text: aiResponse }
      setMessages(prev => [...prev, modelMsg])

      await updateDoc(chatDocRef, {
        messages: arrayUnion(modelMsg),
        lastActivity: serverTimestamp()
      })
    } catch (e) {
      console.error("Erro no Alpha AI Widget:", e)
      const fallback = await generateLocalAIResponse(input, user, knowledgeBase)
      const modelMsg = { role: 'model', text: fallback }
      setMessages(prev => [...prev, modelMsg])
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  return (
    <>
      {/* BotÃ£o Flutuante transformado em botÃ£o de Header */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-brand-600 hover:text-brand-800 hover:bg-pale-100 transition-all flex items-center justify-center"
        title="Alpha AI"
      >
        {isOpen ? <ChevronDown size={18} /> : <Bot size={18} />}
      </button>

      {/* Janela de Chat */}
      {isOpen && (
        <div className="absolute top-16 right-4 w-80 md:w-96 h-[500px] max-h-[80vh] bg-gray-50 rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden border border-cream-300 animate-fade-in">
          {/* Header */}
          <div className="bg-brand-700 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center relative">
                <Bot size={22} className="text-white"/>
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-brand-700 rounded-full"></span>
              </div>
              <div>
                <h3 className="font-bold text-sm">Alpha AI</h3>
                <p className="text-[10px] text-brand-100">Concierge Virtual</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-white/70 hover:text-white p-1"><X size={18}/></button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar">
            {messages.map((m, idx) => (
              <RenderMessage key={idx} message={m} user={user} />
            ))}
            {loading && (
              <div className="mr-auto bg-white border border-cream-200 rounded-2xl rounded-bl-none p-3 shadow-sm flex gap-1">
                <span className="w-2 h-2 bg-brand-400 rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-brand-400 rounded-full animate-bounce" style={{animationDelay:'0.2s'}}></span>
                <span className="w-2 h-2 bg-brand-400 rounded-full animate-bounce" style={{animationDelay:'0.4s'}}></span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 bg-white border-t border-cream-200">
            <div className="relative flex items-center">
              <input 
                className="w-full bg-gray-100 border-none rounded-full pl-4 pr-12 py-3 text-sm focus:ring-2 focus:ring-brand-500 transition-all outline-none"
                placeholder="Pergunte ao Alpha AI..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
              />
              <button 
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="absolute right-1 w-9 h-9 bg-brand-600 rounded-full flex items-center justify-center text-white disabled:bg-gray-300 disabled:text-gray-500 transition-colors"
              >
                <Send size={16} />
              </button>
            </div>
            <p className="text-[9px] text-center text-gray-400 mt-2">A IA pode cometer erros. Verifique informaÃ§Ãµes importantes.</p>
          </div>
        </div>
      )}
    </>
  )
}

