import React, { useState, useEffect } from 'react'
import { Megaphone, MessageSquare, Heart, Share2, AlertCircle, Calendar, MapPin, User, Search, Volume2, Loader2, Plus, Trash2, Check, X } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'
import { format } from 'date-fns'

const tipoBadge = t => ({
  Aviso: 'bg-blue-100 text-blue-700 border-blue-200',
  Comunicado: 'bg-green-100 text-green-700 border-green-200',
  Convocação: 'bg-purple-100 text-purple-700 border-purple-200',
  Urgente: 'bg-red-100 text-red-700 border-red-200'
}[t] || 'bg-blue-100 text-blue-700 border-blue-200')

const tipoIcone = t => ({
  Aviso: <MessageSquare size={18}/>,
  Comunicado: <Megaphone size={18}/>,
  Convocação: <Calendar size={18}/>,
  Urgente: <AlertCircle size={18}/>
}[t] || <MessageSquare size={18}/>)

export default function Mural() {
  const { user } = useAuth()
  const { items: avisos, add: addAviso, remove: removeAviso } = useFirestore('avisos')
  const { items: condominios } = useFirestore('condominios')

  const [search, setSearch] = useState('')
  const [curtidas, setCurtidas] = useState({})
  const [modalNovoAberto, setModalNovoAberto] = useState(false)

  // Formulário de Novo Recado
  const [form, setForm] = useState({
    titulo: '',
    tipo: 'Comunicado', // 'Aviso', 'Comunicado', 'Convocação', 'Urgente'
    condominio: user?.condominio || 'Todos',
    destino: 'Todos', // 'Todos', 'Moradores', 'Colaboradores'
    texto: ''
  })

  const [audioTocandoId, setAudioTocandoId] = useState(null)
  const [audioObj, setAudioObj] = useState(null)
  const [carregandoAudioId, setCarregandoAudioId] = useState(null)

  const toggleAudio = (id, texto) => {
    if (audioTocandoId === id && audioObj) {
      audioObj.pause()
      setAudioObj(null)
      setAudioTocandoId(null)
      return
    }
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
      setCarregandoAudioId(null)
      setAudioTocandoId(null)
    }
    setAudioObj(novoAudio)
  }

  useEffect(() => {
    return () => {
      if (audioObj) audioObj.pause()
    }
  }, [audioObj])

  // Filtragem de avisos por permissão e condomínio
  const avisosVisiveis = avisos.filter(a => {
    if (['Administrador', 'Síndico'].includes(user?.role)) return true
    if (a.condominio && a.condominio !== 'Todos' && user?.condominio && a.condominio !== user.condominio) return false
    if (user?.role === 'Morador' && a.destino === 'Colaboradores') return false
    return true
  }).sort((a, b) => new Date(b._createdAt || 0) - new Date(a._createdAt || 0))

  const feedFiltrado = avisosVisiveis.filter(a =>
    a.titulo?.toLowerCase().includes(search.toLowerCase()) ||
    a.texto?.toLowerCase().includes(search.toLowerCase())
  )

  const handleCurtir = (id) => {
    setCurtidas(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const handleSalvarRecado = async () => {
    if (!form.titulo.trim() || !form.texto.trim()) {
      alert('Por favor, preencha o Título e a Mensagem do recado.')
      return
    }

    try {
      await addAviso({
        titulo: form.titulo,
        tipo: form.tipo,
        condominio: form.condominio || 'Todos',
        destino: form.destino || 'Todos',
        texto: form.texto,
        autor: user?.nome || 'Administração',
        data: format(new Date(), 'dd/MM/yyyy'),
        createdAt: new Date().toISOString()
      })
      // Disparo automático via WhatsApp para os números cadastrados de avisos
      const telefonesAvisos = ['558396885931', '5583996806325', '5583999797285', '5583998350321', '5583998468997']
      const msgAvisoWhats = `📢 *NOVO ${form.tipo ? form.tipo.toUpperCase() : 'COMUNICADO'} NO MURAL - ALPHA GESTÃO*\n\n📌 *Título:* ${form.titulo}\n🏢 *Condomínio:* ${form.condominio || 'Todos'}\n🎯 *Destino:* ${form.destino || 'Todos'}\n\n📝 *Mensagem:*\n${form.texto}\n\n🔗 *Acesse o Mural:* https://alpha-solucoes-condominiais.vercel.app/mural`

      for (const tel of telefonesAvisos) {
        fetch('/api/whatsapp-send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            number: tel,
            text: msgAvisoWhats,
            instance: 'InstanciaAlpha'
          })
        }).catch(e => console.warn('Falha no envio de aviso WhatsApp Mural:', tel, e))
      }

      setModalNovoAberto(false)
      setForm({
        titulo: '',
        tipo: 'Comunicado',
        condominio: user?.condominio || 'Todos',
        destino: 'Todos',
        texto: ''
      })
      alert('Recado publicado com sucesso no Mural!')
    } catch (e) {
      console.error(e)
      alert('Erro ao publicar recado.')
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-4xl mx-auto w-full pb-12">
      {/* Topo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="section-title text-2xl font-black bg-gradient-to-r from-brand-700 to-brand-500 bg-clip-text text-transparent flex items-center gap-2">
            <Megaphone className="text-brand-600"/> Mural de Recados & Comunicados
          </h2>
          <p className="text-gray-500 font-medium text-xs md:text-sm mt-0.5">
            Fique por dentro dos avisos oficiais, informativos e convocações do condomínio.
          </p>
        </div>

        <button
          onClick={() => setModalNovoAberto(true)}
          className="btn-primary flex items-center gap-2 py-2.5 px-4 shadow-md"
        >
          <Plus size={18} />
          <span>Novo Recado</span>
        </button>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"/>
        <input
          className="input pl-10 rounded-xl bg-white border border-pale-300 shadow-sm text-sm"
          placeholder="Buscar no mural por assunto, aviso ou palavra-chave..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Lista de Recados */}
      <div className="flex flex-col gap-5 mt-1">
        {feedFiltrado.length === 0 && (
          <div className="card text-center py-16 flex flex-col items-center border border-pale-300 shadow-sm">
            <div className="w-16 h-16 bg-cream-200 rounded-full flex items-center justify-center text-gray-400 mb-3">
              <Megaphone size={26}/>
            </div>
            <p className="text-gray-700 font-bold text-base">Nenhum aviso no momento.</p>
            <p className="text-sm text-gray-500 mt-1 mb-4">
              O mural está vazio ou sua busca não encontrou resultados.
            </p>
            <button
              onClick={() => setModalNovoAberto(true)}
              className="btn-primary flex items-center gap-2 py-2 px-4 text-xs font-bold"
            >
              <Plus size={15} /> Publicar o Primeiro Recado
            </button>
          </div>
        )}

        {feedFiltrado.map(post => (
          <div key={post.id} className="bg-white rounded-2xl shadow-sm border border-pale-300 overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tipoBadge(post.tipo)} bg-opacity-20`}>
                    <span className={tipoBadge(post.tipo).split(' ')[1]}>{tipoIcone(post.tipo)}</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg leading-tight">{post.titulo}</h3>
                    <div className="flex items-center gap-2 mt-0.5 text-xs font-medium text-gray-500">
                      <span className="flex items-center gap-1"><User size={12}/> {post.autor || 'Administração'}</span>
                      <span>•</span>
                      <span>{post.data || format(new Date(), 'dd/MM/yyyy')}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${tipoBadge(post.tipo)} uppercase tracking-wider`}>
                    {post.tipo}
                  </span>
                  {(['Administrador', 'Síndico'].includes(user?.role) || post.autor === user?.nome) && (
                    <button
                      onClick={async () => {
                        if (window.confirm('Excluir este aviso do mural?')) {
                          await removeAviso(post.id)
                        }
                      }}
                      className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                      title="Excluir aviso"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
              
              <div className="text-gray-800 whitespace-pre-line text-sm leading-relaxed mb-3">
                {post.texto}
              </div>

              {post.condominio && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-700 bg-brand-50 px-3 py-1 rounded-lg inline-flex">
                  <MapPin size={13}/> Condomínio: {post.condominio}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-pale-200 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => handleCurtir(post.id)}
                  className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${curtidas[post.id] ? 'text-red-500' : 'text-gray-500 hover:text-red-500'}`}
                >
                  <Heart size={16} fill={curtidas[post.id] ? "currentColor" : "none"} className={curtidas[post.id] ? "scale-110 transition-transform" : ""} />
                  {curtidas[post.id] ? 'Curtido' : 'Curtir'}
                </button>
                <button
                  onClick={() => alert("Link copiado para a área de transferência!")}
                  className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-brand-600 transition-colors"
                >
                  <Share2 size={16} /> Compartilhar
                </button>
              </div>

              <button 
                onClick={() => toggleAudio(post.id, post.texto)} 
                disabled={carregandoAudioId === post.id}
                className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${audioTocandoId === post.id ? 'text-brand-600' : 'text-gray-500 hover:text-brand-600'}`}>
                {carregandoAudioId === post.id ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Volume2 size={16} className={audioTocandoId === post.id ? 'animate-pulse' : ''} />
                )}
                <span>{audioTocandoId === post.id ? 'Pausar Áudio' : 'Ouvir Recado'}</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal de Publicação de Novo Recado */}
      {modalNovoAberto && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                <Megaphone className="text-brand-600" size={20} />
                Novo Recado para o Mural
              </h3>
              <button onClick={() => setModalNovoAberto(false)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              <div>
                <label className="label font-bold text-gray-700">Título do Aviso *</label>
                <input
                  type="text"
                  className="input font-medium"
                  placeholder="Ex: Manutenção na rede de gás, Convocação para reunião..."
                  value={form.titulo}
                  onChange={e => setForm({ ...form, titulo: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label font-bold text-gray-700">Tipo de Comunicado</label>
                  <select
                    className="input font-medium"
                    value={form.tipo}
                    onChange={e => setForm({ ...form, tipo: e.target.value })}
                  >
                    <option value="Comunicado">📢 Comunicado</option>
                    <option value="Aviso">💬 Aviso Geral</option>
                    <option value="Convocação">📅 Convocação</option>
                    <option value="Urgente">🚨 Urgente / Alerta</option>
                  </select>
                </div>

                <div>
                  <label className="label font-bold text-gray-700">Condomínio</label>
                  {user?.role === 'Administrador' ? (
                    <select
                      className="input font-medium"
                      value={form.condominio}
                      onChange={e => setForm({ ...form, condominio: e.target.value })}
                    >
                      <option value="Todos">Todos os Condomínios</option>
                      {condominios.map(c => (
                        <option key={c.id || c.nome} value={c.nome}>{c.nome}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="input bg-gray-100 text-gray-700 font-semibold cursor-not-allowed">
                      {user?.condominio || 'Condomínio Atual'}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="label font-bold text-gray-700">Mensagem / Conteúdo *</label>
                <textarea
                  rows={5}
                  className="input font-medium resize-none"
                  placeholder="Escreva a mensagem que todos os moradores visualizarão no mural..."
                  value={form.texto}
                  onChange={e => setForm({ ...form, texto: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-200">
              <button
                onClick={() => setModalNovoAberto(false)}
                className="btn-secondary text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvarRecado}
                className="btn-primary text-xs flex items-center gap-1.5 px-5"
              >
                <Check size={16} /> Publicar no Mural
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
