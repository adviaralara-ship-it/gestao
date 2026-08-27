import React, { useState, useEffect, useRef } from 'react'
import { Plus, X, Search, FileText, Download, Copy, RefreshCw, Scale, Lightbulb, Users, Calendar, Megaphone, Send, Bot, Camera, Sparkles, AlertCircle, Maximize2, Minimize2, Settings, History, User, ChevronDown, CheckCircle, Zap, Volume2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { doc, getDoc, setDoc, updateDoc, arrayUnion, serverTimestamp, collection, addDoc, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { GoogleGenerativeAI } from '@google/generative-ai'
import QRCode from 'react-qr-code'

// Chave da API e Instância do Gemini
const API_KEY = "AQ.Ab8RN6Ik8r-5xXO62z8qMO7Ne9Qxf8jUNTLpuWN4Ou2SPJAhXA"
const genAI = new GoogleGenerativeAI(API_KEY)
const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" })

// Função auxiliar para sanitizar textos corrompidos por encoding UTF-8 antigo
const fixEncoding = (str) => {
  if (!str || typeof str !== 'string') return str
  return str
    .replace(/OlÃ¡/g, 'Olá')
    .replace(/Olï¿½/g, 'Olá')
    .replace(/condomÃ­nio/g, 'condomínio')
    .replace(/VocÃª/g, 'Você')
    .replace(/vocÃª/g, 'você')
    .replace(/estÃ¡/g, 'está')
    .replace(/usuÃ¡rio/g, 'usuário')
    .replace(/AÃ‡ÃƒO/g, 'AÇÃO')
    .replace(/CONDOMÃ NIO/g, 'CONDOMÍNIO')
}

// Componente interno para processar e renderizar os "Widgets" de Ação no meio da mensagem
const RenderMessage = ({ message, user }) => {
  let text = fixEncoding(message.text)

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
    utterance.pitch = 1.1
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
        status: 'Pendente',
        _createdAt: serverTimestamp()
      })
      
      await addDoc(collection(db,'notificacoes'),{
        text:`[${user.condominio}] Nova Reserva (Via AI): ${espaco} por ${user.nome}`,
        time:new Date().toISOString(), tipo:'reserva', lida:false, condominio: user.condominio, _createdAt:serverTimestamp()
      })
      setActionStatus('done')
    } catch (e) {
      alert("Erro ao criar reserva.")
      setActionStatus(null)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="whitespace-pre-wrap leading-relaxed text-sm">
        {text}
      </div>

      {/* Widget Interativo de Criação de Ocorrência */}
      {matchOcorrencia && (
        <div className="mt-3 p-4 bg-brand-50 border border-brand-200 rounded-xl flex flex-col gap-2">
          <div className="flex items-center gap-2 text-brand-700 font-bold text-xs uppercase tracking-wider">
            <AlertCircle size={16} /> Ação Detectada: Registrar Ocorrência
          </div>
          <p className="text-xs text-gray-700 font-medium bg-white p-2.5 rounded-lg border border-brand-100">
            "{ocorrenciaDesc}"
          </p>
          {actionStatus === 'done' ? (
            <div className="flex items-center gap-1.5 text-xs text-green-600 font-bold bg-green-50 p-2 rounded-lg border border-green-200">
              <CheckCircle size={16} /> Ocorrência enviada para a Administração!
            </div>
          ) : (
            <button 
              onClick={handleCriarOcorrencia}
              disabled={actionStatus === 'loading'}
              className="btn-primary text-xs py-2 px-3 flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 w-full"
            >
              {actionStatus === 'loading' ? 'Registrando...' : 'Confirmar e Enviar para o Síndico'}
            </button>
          )}
        </div>
      )}

      {/* Widget Interativo de Reserva de Espaço */}
      {matchReserva && (
        <div className="mt-3 p-4 bg-purple-50 border border-purple-200 rounded-xl flex flex-col gap-2">
          <div className="flex items-center gap-2 text-purple-700 font-bold text-xs uppercase tracking-wider">
            <Calendar size={16} /> Ação Detectada: Pré-Reserva de Espaço
          </div>
          <p className="text-xs text-gray-700 font-medium bg-white p-2.5 rounded-lg border border-purple-100">
            "{reservaDetails}"
          </p>
          {actionStatus === 'done' ? (
            <div className="flex items-center gap-1.5 text-xs text-green-600 font-bold bg-green-50 p-2 rounded-lg border border-green-200">
              <CheckCircle size={16} /> Solicitação de Reserva Enviada!
            </div>
          ) : (
            <button 
              onClick={handleCriarReserva}
              disabled={actionStatus === 'loading'}
              className="btn-primary text-xs py-2 px-3 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 w-full"
            >
              {actionStatus === 'loading' ? 'Solicitando...' : 'Confirmar Solicitação de Reserva'}
            </button>
          )}
        </div>
      )}

      {/* Botão de Ouvir Mensagem */}
      {message.role === 'model' && (
        <div className="flex justify-end mt-1">
          <button 
            onClick={handleSpeak}
            className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-brand-600 transition-colors"
            title="Ouvir mensagem"
          >
            <Volume2 size={13} className={isPlaying ? "text-brand-600 animate-pulse" : ""} />
            <span>{isPlaying ? 'Parar áudio' : 'Ouvir resposta'}</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default function AlphaAIChat() {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)

  // Base de Conhecimento
  const [knowledgeBase, setKnowledgeBase] = useState("")

  const chatDocRef = user ? doc(db, 'ai_chats', user.uid || user.id) : null

  useEffect(() => {
    if (user) {
      loadHistory()
      loadKnowledgeBase()
    }
  }, [user])

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
      const savedMessages = snap.data().messages || []
      // Sanitizar mensagens anteriores corrigindo eventuais acentos corrompidos
      const cleanMessages = savedMessages.map(m => ({ ...m, text: fixEncoding(m.text) }))
      setMessages(cleanMessages)
    } else {
      // Mensagem de boas vindas inicial em Português do Brasil
      const welcomeMsg = { role: 'model', text: `Olá, ${user.nome}! Eu sou o Alpha AI, seu Concierge Virtual. Como posso te ajudar hoje?` }
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

      const systemPrompt = `
Você é o "Alpha AI", o Concierge Virtual extremamente educado e inteligente do condomínio "${user.condominio}".
O morador com quem você está falando se chama "${user.nome}" (Apartamento ${user.apt}).
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
      const aiResponse = result.response.text()

      const modelMsg = { role: 'model', text: aiResponse }
      setMessages(prev => [...prev, modelMsg])

      await updateDoc(chatDocRef, {
        messages: arrayUnion(modelMsg),
        lastActivity: serverTimestamp()
      })
    } catch (e) {
      console.error(e)
      const errorMsg = { role: 'model', text: "Desculpe, tive uma instabilidade momentânea. Pode repetir a sua mensagem?" }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setLoading(false)
    }
  }

  const handleClearHistory = async () => {
    if (!window.confirm("Deseja realmente limpar o histórico da conversa?")) return
    const welcomeMsg = { role: 'model', text: `Olá, ${user.nome}! Histórico limpo. Como posso te ajudar agora?` }
    setMessages([welcomeMsg])
    if (chatDocRef) {
      await updateDoc(chatDocRef, {
        messages: [welcomeMsg],
        lastActivity: serverTimestamp()
      })
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] max-w-5xl mx-auto w-full bg-white rounded-2xl border border-pale-300 shadow-md overflow-hidden animate-fade-in">
      {/* Header do Chat */}
      <div className="p-4 bg-gradient-to-r from-[#2d3045] to-[#1e2030] text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center shadow-md">
              <Bot size={22} className="text-white" />
            </div>
            <span className="w-3 h-3 bg-emerald-400 border-2 border-[#2d3045] rounded-full absolute bottom-0 right-0"></span>
          </div>
          <div>
            <h3 className="font-bold text-base flex items-center gap-2">
              Alpha AI — Concierge Virtual
              <span className="bg-brand-500/30 text-brand-200 text-[10px] px-2 py-0.5 rounded-full font-semibold border border-brand-400/30">
                Online
              </span>
            </h3>
            <p className="text-xs text-gray-300">
              {user?.condominio || 'Condomínio'} • Atendimento inteligente 24h
            </p>
          </div>
        </div>

        <button
          onClick={handleClearHistory}
          className="text-xs text-gray-300 hover:text-white px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-all"
        >
          Limpar conversa
        </button>
      </div>

      {/* Lista de Mensagens */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-4 bg-slate-50/50 custom-scrollbar">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-2.5 max-w-[85%] ${m.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${m.role === 'user' ? 'bg-brand-700 text-white' : 'bg-[#2d3045] text-brand-200'}`}>
              {m.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>

            <div className={`p-4 rounded-2xl shadow-sm ${m.role === 'user' ? 'bg-brand-700 text-white rounded-tr-none' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none'}`}>
              <RenderMessage message={m} user={user} />
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-gray-400 text-xs italic mr-auto">
            <Bot size={16} className="animate-spin text-brand-600" />
            Alpha AI está digitando...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input de Mensagem */}
      <div className="p-3 md:p-4 bg-white border-t border-gray-200 flex items-center gap-2">
        <input
          type="text"
          className="input flex-1 text-sm bg-slate-50 border-gray-300 focus:bg-white"
          placeholder="Pergunte ao Alpha AI sobre regras, boletos, reservas ou solicite ajuda..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || loading}
          className="btn-primary py-2.5 px-4 flex items-center gap-1.5 shadow-md disabled:opacity-50"
        >
          <Send size={16} />
          <span className="hidden md:inline">Enviar</span>
        </button>
      </div>
    </div>
  )
}
