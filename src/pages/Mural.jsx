import React, { useState, useEffect } from 'react'
import { Megaphone, MessageSquare, Heart, Share2, AlertCircle, Calendar, MapPin, User, Search, Volume2, VolumeX, Loader2 } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'

const tipoBadge = t => ({ Aviso: 'bg-blue-100 text-blue-700', Comunicado: 'bg-green-100 text-green-700', Convocação: 'bg-purple-100 text-purple-700', Urgente: 'bg-red-100 text-red-700' }[t] || 'bg-blue-100 text-blue-700')
const tipoIcone = t => ({ Aviso: <MessageSquare size={18}/>, Comunicado: <Megaphone size={18}/>, Convocação: <Calendar size={18}/>, Urgente: <AlertCircle size={18}/> }[t] || <MessageSquare size={18}/>)

export default function Mural() {
  const { user } = useAuth()
  const { items: avisos } = useFirestore('avisos')
  const [search, setSearch] = useState('')
  const [curtidas, setCurtidas] = useState({})

  const [audioTocandoId, setAudioTocandoId] = useState(null)
  const [audioObj, setAudioObj] = useState(null)
  const [carregandoAudioId, setCarregandoAudioId] = useState(null)

  const toggleAudio = (id, texto) => {
    // Se já estiver tocando ESSE áudio, pausa e cancela
    if (audioTocandoId === id && audioObj) {
      audioObj.pause()
      setAudioObj(null)
      setAudioTocandoId(null)
      return
    }
    // Se estiver tocando OUTRO, pausa
    if (audioObj) {
      audioObj.pause()
      setAudioObj(null)
    }

    setCarregandoAudioId(id)
    const textoCodificado = encodeURIComponent(texto)
    const novoAudio = new Audio(`/api/gerar-audio?texto=${textoCodificado}`)
    
    novoAudio.oncanplaythrough = () => {
      setCarregandoAudioId(null)
      setAudioTocandoId(id)
      novoAudio.play().catch(e => {
        console.error("Erro ao tocar:", e)
        setAudioTocandoId(null)
      })
    }
    novoAudio.onended = () => {
      setAudioTocandoId(null)
      setAudioObj(null)
    }
    novoAudio.onerror = () => {
      console.error("Erro de áudio")
      setCarregandoAudioId(null)
      setAudioTocandoId(null)
    }
    setAudioObj(novoAudio)
  }

  // Cleanup na desmontagem
  useEffect(() => {
    return () => {
      if (audioObj) audioObj.pause()
    }
  }, [audioObj])


  // Filtra avisos que o usuário pode ver:
  // Todos, ou específicos para o condomínio dele, ou se for Admin/Síndico vê todos
  const avisosVisiveis = avisos.filter(a => {
    if (['Administrador', 'Síndico'].includes(user?.role)) return true
    if (a.condominio && a.condominio !== 'Todos' && user?.condominio && a.condominio !== user.condominio) return false
    
    // Simplificando: morador vê "Todos" ou destino "Moradores" (aqui trata Todos, Proprietários, Inquilinos)
    if (user?.role === 'Morador' && a.destino === 'Colaboradores') return false
    return true
  }).sort((a,b) => new Date(b._createdAt || 0) - new Date(a._createdAt || 0))

  const feedFiltrado = avisosVisiveis.filter(a => a.titulo?.toLowerCase().includes(search.toLowerCase()) || a.texto?.toLowerCase().includes(search.toLowerCase()))

  const handleCurtir = (id) => {
    setCurtidas(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-3xl mx-auto w-full">
      <div className="page-header">
        <div>
          <h2 className="section-title text-xl flex items-center gap-2"><Megaphone className="text-brand-600"/> Mural de Recados</h2>
          <p className="section-sub">Fique por dentro das novidades do condomínio</p>
        </div>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
        <input className="input pl-9 rounded-full bg-white border-none shadow-sm" placeholder="Buscar no mural..." value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>

      <div className="flex flex-col gap-6 mt-2">
        {feedFiltrado.length === 0 && (
          <div className="card text-center py-16 flex flex-col items-center">
            <div className="w-16 h-16 bg-cream-200 rounded-full flex items-center justify-center text-gray-400 mb-4"><Megaphone size={24}/></div>
            <p className="text-gray-500 font-medium">Nenhum aviso no momento.</p>
            <p className="text-sm text-gray-400 mt-1">O mural está vazio ou sua busca não encontrou resultados.</p>
          </div>
        )}

        {feedFiltrado.map(post => (
          <div key={post.id} className="bg-white rounded-2xl shadow-sm border border-cream-200 overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tipoBadge(post.tipo)} bg-opacity-20`}>
                    <span className={tipoBadge(post.tipo).split(' ')[1]}>{tipoIcone(post.tipo)}</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg leading-tight">{post.titulo}</h3>
                    <div className="flex items-center gap-2 mt-0.5 text-xs font-medium text-gray-500">
                      <span className="flex items-center gap-1"><User size={12}/> {post.autor || 'Administração'}</span>
                      <span>•</span>
                      <span>{post.data}</span>
                    </div>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${tipoBadge(post.tipo)} uppercase tracking-wider`}>{post.tipo}</span>
              </div>
              
              <div className="text-gray-700 whitespace-pre-line text-[15px] leading-relaxed mb-4">
                {post.texto}
              </div>

              {post.condominio && post.condominio !== 'Todos' && (
                <div className="flex items-center gap-1.5 text-xs font-medium text-purple-600 bg-purple-50 px-3 py-1.5 rounded-lg inline-flex mb-2">
                  <MapPin size={14}/> Direcionado ao condomínio: {post.condominio}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-cream-100 bg-gray-50/50 flex items-center gap-6">
              <button onClick={() => handleCurtir(post.id)} className={`flex items-center gap-1.5 text-sm font-semibold transition-colors ${curtidas[post.id] ? 'text-red-500' : 'text-gray-500 hover:text-red-500'}`}>
                <Heart size={18} fill={curtidas[post.id] ? "currentColor" : "none"} className={curtidas[post.id] ? "scale-110 transition-transform" : ""} />
                {curtidas[post.id] ? 'Curtido' : 'Curtir'}
              </button>
              <button className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-brand-600 transition-colors">
                <Share2 size={18} /> Compartilhar
              </button>
              <button 
                onClick={() => toggleAudio(post.id, post.texto)} 
                disabled={carregandoAudioId === post.id}
                className={`flex items-center gap-1.5 text-sm font-semibold transition-colors ${audioTocandoId === post.id ? 'text-brand-600' : 'text-gray-500 hover:text-brand-600'}`}>
                {carregandoAudioId === post.id ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : audioTocandoId === post.id ? (
                  <VolumeX size={18} />
                ) : (
                  <Volume2 size={18} />
                )}
                {carregandoAudioId === post.id ? 'Gerando Voz...' : audioTocandoId === post.id ? 'Parar' : 'Ouvir'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
