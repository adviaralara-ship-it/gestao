import React, { useState } from 'react'
import { Bot, BookOpen, Trash2, Search, Zap, User } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'

export default function MonitoramentoIA() {
  const { user } = useAuth()
  const { items: chats, deleteItem: delChat } = useFirestore('ai_chats')
  const { items: knowledge, addItem: addKnowledge, deleteItem: delKnowledge } = useFirestore('ai_knowledge')
  
  const [tab, setTab] = useState('chats') // 'chats', 'knowledge'
  const [search, setSearch] = useState('')
  const [newRule, setNewRule] = useState('')
  const [selectedChat, setSelectedChat] = useState(null)

  // Filtra chats pelo condomínio do admin, ou mostra todos se for 'Todos' ou Admin Global
  const chatsVisiveis = chats.filter(c => {
    if (user?.role === 'Administrador' && (!user.condominio || user.condominio === 'Todos')) return true
    return c.condominio === user?.condominio
  }).sort((a,b) => new Date(b.lastActivity || 0) - new Date(a.lastActivity || 0))

  const chatsFiltrados = chatsVisiveis.filter(c => c.userName?.toLowerCase().includes(search.toLowerCase()) || c.condominio?.toLowerCase().includes(search.toLowerCase()))

  const handleAddRule = async () => {
    if (!newRule.trim()) return
    await addKnowledge({ text: newRule, addedBy: user.nome, date: new Date().toLocaleDateString('pt-BR') })
    setNewRule('')
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-6xl mx-auto w-full h-full">
      <div className="page-header">
        <div>
          <h2 className="section-title text-xl flex items-center gap-2"><Bot className="text-brand-600"/> Monitoramento IA</h2>
          <p className="section-sub">Acompanhe as conversas do Alpha AI e treine a base de conhecimento</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => {setTab('chats'); setSelectedChat(null)}} className={`px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${tab==='chats'?'bg-brand-600 text-white shadow-md':'bg-white text-gray-500 hover:text-brand-700 border border-cream-400'}`}>
          <Bot size={16}/> Histórico de Chats
        </button>
        <button onClick={() => setTab('knowledge')} className={`px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${tab==='knowledge'?'bg-brand-600 text-white shadow-md':'bg-white text-gray-500 hover:text-brand-700 border border-cream-400'}`}>
          <BookOpen size={16}/> Treinar IA
        </button>
      </div>

      {tab === 'chats' && (
        <div className="flex gap-6 h-[600px]">
          {/* Lista de Chats */}
          <div className="w-1/3 bg-white border border-cream-300 rounded-2xl flex flex-col overflow-hidden shadow-sm">
            <div className="p-4 border-b border-cream-200">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input className="input pl-9 text-sm" placeholder="Buscar morador..." value={search} onChange={e=>setSearch(e.target.value)}/>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1 custom-scrollbar">
              {chatsFiltrados.length === 0 && <p className="text-center text-sm text-gray-400 py-10">Nenhuma conversa encontrada.</p>}
              {chatsFiltrados.map(c => (
                <div key={c.id} onClick={() => setSelectedChat(c)} className={`p-3 rounded-xl cursor-pointer transition-all flex flex-col gap-1 ${selectedChat?.id === c.id ? 'bg-brand-50 border border-brand-200' : 'hover:bg-gray-50 border border-transparent'}`}>
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-gray-800 text-sm truncate flex items-center gap-1.5"><User size={14} className="text-gray-400"/> {c.userName}</p>
                    <button onClick={(e)=>{e.stopPropagation(); delChat(c.id)}} className="text-gray-400 hover:text-red-500 transition-colors p-1"><Trash2 size={12}/></button>
                  </div>
                  <p className="text-xs text-gray-500">Apt {c.apt} • {c.condominio}</p>
                  <p className="text-xs text-gray-400 mt-1 truncate">{c.messages?.[c.messages.length-1]?.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Área da Conversa Selecionada */}
          <div className="flex-1 bg-white border border-cream-300 rounded-2xl flex flex-col overflow-hidden shadow-sm relative">
            {!selectedChat ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <Bot size={48} className="mb-4 opacity-50"/>
                <p>Selecione uma conversa à esquerda para visualizar</p>
              </div>
            ) : (
              <>
                <div className="p-4 border-b border-cream-200 bg-gray-50">
                  <h3 className="font-bold text-gray-800">Conversa com {selectedChat.userName}</h3>
                  <p className="text-xs text-gray-500">Apartamento {selectedChat.apt} | Condomínio {selectedChat.condominio}</p>
                </div>
                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 custom-scrollbar bg-cream-50/50">
                  {selectedChat.messages?.map((m, idx) => (
                    <div key={idx} className={`p-3 rounded-2xl max-w-[80%] shadow-sm ${m.role === 'user' ? 'bg-white border border-cream-200 text-gray-700 ml-auto rounded-tr-none' : 'bg-brand-100 border border-brand-200 text-brand-900 mr-auto rounded-tl-none'}`}>
                      <p className="text-xs font-bold mb-1 opacity-50">{m.role === 'user' ? selectedChat.userName : 'Alpha AI'}</p>
                      <p className="text-sm whitespace-pre-wrap">{m.text}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'knowledge' && (
        <div className="flex flex-col gap-6">
          <div className="card bg-gradient-to-r from-brand-600 to-brand-500 text-white">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-2"><Zap size={20}/> Ensine algo novo ao Alpha AI</h3>
            <p className="text-brand-100 text-sm mb-4">A IA vai ler essas regras toda vez que conversar com um morador. Digite como se estivesse explicando para um funcionário.</p>
            <div className="flex flex-col gap-3">
              <textarea 
                className="w-full bg-white/10 border border-white/20 rounded-xl p-4 text-white placeholder-brand-200 focus:outline-none focus:ring-2 focus:ring-white resize-none min-h-[100px]"
                placeholder="Exemplo: O horário da piscina é das 08:00 às 22:00 e não é permitido vidro na área."
                value={newRule}
                onChange={e => setNewRule(e.target.value)}
              />
              <button onClick={handleAddRule} disabled={!newRule.trim()} className="btn-secondary bg-white text-brand-700 hover:bg-brand-50 border-none w-max self-end font-bold px-6">
                Salvar Regra
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {knowledge.length === 0 && <p className="text-gray-500 text-sm col-span-2">A base de conhecimento está vazia. Adicione regras acima.</p>}
            {knowledge.map(k => (
              <div key={k.id} className="card relative group hover:border-brand-300 transition-colors">
                <button onClick={() => delKnowledge(k.id)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14}/></button>
                <p className="text-sm text-gray-700 mb-3 whitespace-pre-wrap pr-6">{k.text}</p>
                <p className="text-[10px] text-gray-400">Adicionado por {k.addedBy} em {k.date}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
