import React, { useState, useEffect, useRef } from 'react'
import { Plus, X, Search, FileText, Download, Copy, RefreshCw, Scale, Lightbulb, Users, Calendar, Megaphone, Send, Bot, Camera, Sparkles, AlertCircle, Maximize2, Minimize2, Settings, History, User, ChevronDown, CheckCircle, Zap, Volume2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { doc, getDoc, setDoc, updateDoc, arrayUnion, serverTimestamp, collection, addDoc, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { GoogleGenerativeAI } from '@google/generative-ai'
import QRCode from 'react-qr-code'

// Chave da API e InstÃ¢ncia do Gemini
const API_KEY = "AQ.Ab8RN6Ik8r-5xXO62z8qMO7Ne9Qxf8jUNTLpuWN4Ou2SPJAhXA"
const genAI = new GoogleGenerativeAI(API_KEY)
const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" })

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
    <div className="h-full flex flex-col bg-gray-50 rounded-2xl shadow-sm border border-cream-200 overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="bg-brand-700 text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center relative">
            <Bot size={26} className="text-white"/>
            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-400 border-2 border-brand-700 rounded-full"></span>
          </div>
          <div>
            <h3 className="font-bold text-lg">Alpha AI</h3>
            <p className="text-xs text-brand-100">Seu Concierge Virtual Inteligente</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-4 custom-scrollbar">
        {messages.map((m, idx) => (
          <RenderMessage key={idx} message={m} user={user} />
        ))}
        {loading && (
          <div className="mr-auto bg-white border border-cream-200 rounded-2xl rounded-bl-none p-4 shadow-sm flex gap-1">
            <span className="w-2.5 h-2.5 bg-brand-400 rounded-full animate-bounce"></span>
            <span className="w-2.5 h-2.5 bg-brand-400 rounded-full animate-bounce" style={{animationDelay:'0.2s'}}></span>
            <span className="w-2.5 h-2.5 bg-brand-400 rounded-full animate-bounce" style={{animationDelay:'0.4s'}}></span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-cream-200">
        <div className="relative flex items-center max-w-4xl mx-auto">
          <input 
            className="w-full bg-gray-100 border-none rounded-full pl-6 pr-14 py-4 text-sm md:text-base focus:ring-2 focus:ring-brand-500 transition-all outline-none"
            placeholder="Pergunte ao Alpha AI..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="absolute right-2 w-10 h-10 bg-brand-600 rounded-full flex items-center justify-center text-white disabled:bg-gray-300 disabled:text-gray-500 transition-colors hover:bg-brand-700"
          >
            <Send size={18} />
          </button>
        </div>
        <p className="text-[10px] text-center text-gray-400 mt-2">A IA pode cometer erros. Verifique informações importantes.</p>
      </div>
    </div>
  )
}