import React, { useState, useEffect, useRef } from 'react'
import { Plus, X, Search, FileText, Download, Copy, RefreshCw, Scale, Lightbulb, Users, Calendar, Megaphone, Send, Bot, Camera, Sparkles, AlertCircle, Maximize2, Minimize2, Settings, History, User, ChevronDown, CheckCircle, Zap } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { doc, getDoc, setDoc, updateDoc, arrayUnion, serverTimestamp, collection, addDoc, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { GoogleGenerativeAI } from '@google/generative-ai'
import QRCode from 'react-qr-code'

// Chave da API e Instância do Gemini
const API_KEY = "AQ.Ab8RN6Ik8r-5xXO62z8qMO7Ne9Qxf8jUNTLpuWN4Ou2SPJAhXA"
const genAI = new GoogleGenerativeAI(API_KEY)
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" })

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
      // Salva a mensagem do usuário no banco
      await updateDoc(chatDocRef, {
        messages: arrayUnion(userMsg),
        lastActivity: serverTimestamp()
      })

      // Prompt de Sistema para definir a personalidade e capacidades
      const systemPrompt = `
Você é o "Alpha AI", o Concierge Virtual extremamente educado e inteligente do condomínio "${user.condominio}".
O morador com quem você está falando se chama "${user.nome}" (Apartamento ${user.apt}).
Seja amigável, direto, e use emojis ocasionalmente.

BASE DE CONHECIMENTO DO CONDOMÍNIO:
${knowledgeBase || "Nenhuma regra extra adicionada."}

REGRAS ESPECIAIS DE AÇÃO (SIMULAÇÃO DE TOOL CALLING):
Se o morador pedir para abrir uma ocorrência ou registrar um problema (ex: lâmpada queimada, barulho), responda normalmente e INCLUA EXATAMENTE este texto na sua resposta:
[CRIAR_OCORRENCIA: Resumo do Problema]
Exemplo: "Claro, vou registrar isso para você! [CRIAR_OCORRENCIA: Lâmpada queimada no corredor]"

Se o morador quiser reservar um espaço (ex: salão de festas, churrasqueira), você DEVE pedir a data e o HORÁRIO de início e fim. Se ele já informou tudo, INCLUA EXATAMENTE:
[CRIAR_RESERVA: Nome do Espaço - Data - Horário]
Exemplo: "Reserva pré-aprovada! [CRIAR_RESERVA: Salão de Festas - 15/10/2026 - 14:00 as 22:00]"
`
      
      // Constrói o histórico para a API do Gemini
      const history = messages.map(m => ({
        role: m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.text }]
      }))
      
      const chat = model.startChat({
        history: [{ role: 'user', parts: [{ text: systemPrompt }] }, { role: 'model', parts: [{ text: "Entendido. Serei o Alpha AI." }] }, ...history],
        generationConfig: { maxOutputTokens: 1000 },
      })

      const result = await chat.sendMessage(userMsg.text)
      const aiResponse = result.response.text()

      const modelMsg = { role: 'model', text: aiResponse }
      setMessages(prev => [...prev, modelMsg])

      // Salva a resposta da IA no banco
      await updateDoc(chatDocRef, {
        messages: arrayUnion(modelMsg),
        lastActivity: serverTimestamp()
      })

    } catch (error) {
      console.error("Erro no Gemini:", error)
      const errorMsg = { role: 'model', text: "Desculpe, estou com problemas de conexão. Tente novamente em instantes." }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setLoading(false)
    }
  }

  // Componente interno para processar e renderizar os "Widgets" de Ação no meio da mensagem
  const RenderMessage = ({ message }) => {
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
      <div className={`p-3 rounded-2xl max-w-[85%] shadow-sm ${message.role === 'user' ? 'bg-brand-600 text-white rounded-br-none ml-auto' : 'bg-white border border-cream-200 text-gray-700 rounded-bl-none mr-auto'}`}>
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{text}</p>
        
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

  // Não renderiza nada se não estiver logado
  if (!user) return null

  return (
    <>
      {/* Botão Flutuante transformado em botão de Header */}
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
              <RenderMessage key={idx} message={m} />
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
            <p className="text-[9px] text-center text-gray-400 mt-2">A IA pode cometer erros. Verifique informações importantes.</p>
          </div>
        </div>
      )}
    </>
  )
}
