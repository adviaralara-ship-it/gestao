import React, { useState, useEffect } from 'react'
import { Megaphone, MessageSquare, Heart, Share2, AlertCircle, Calendar, MapPin, User, Search, Volume2, Loader2, Plus, Trash2, Check, X, Send, Smartphone, Building2 } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'
import { format } from 'date-fns'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { enviarMensagemWhatsApp } from '../utils/whatsappAutomacao'

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

// Função auxiliar para normalizar nomes de condomínio
const normalizar = str => (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

const MESES_NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

const getMesAno = (item) => {
  if (!item) return ''
  const iso = item._createdAt || item.createdAt || item.criadoEm || item.time
  if (iso) {
    try {
      const d = typeof iso === 'object' && iso.toDate ? iso.toDate() : new Date(iso)
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        return `${y}-${m}`
      }
    } catch {}
  }
  if (item.data && typeof item.data === 'string' && item.data.includes('/')) {
    const parts = item.data.split('/')
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}`
    }
  }
  return ''
}

const getTime = (item) => {
  if (!item) return 0
  const raw = item._createdAt || item.createdAt || item.criadoEm || item.time
  if (raw) {
    if (typeof raw === 'object' && raw.toDate) return raw.toDate().getTime()
    const t = new Date(raw).getTime()
    if (!isNaN(t)) return t
  }
  if (item.data && typeof item.data === 'string' && item.data.includes('/')) {
    const parts = item.data.split('/')
    if (parts.length === 3) {
      const horaStr = item.hora || '00:00'
      const t = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T${horaStr}:00`).getTime()
      if (!isNaN(t)) return t
    }
  }
  return 0
}

const formatarMesAno = (mesAnoStr) => {
  if (!mesAnoStr || mesAnoStr === 'Todos') return 'Todos os Meses'
  const [ano, mes] = mesAnoStr.split('-')
  const idx = parseInt(mes, 10) - 1
  return `${MESES_NOMES[idx] || mes} de ${ano}`
}

const mesAtualPadrao = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function Mural() {
  const { user } = useAuth()
  const { items: avisos, add: addAviso, remove: removeAviso } = useFirestore('avisos')
  const { items: allCondominios } = useFirestore('condominios')
  const condominios = (allCondominios || []).filter(c => c.status !== 'Inativo')
  const { items: moradores } = useFirestore('moradores')

  const [search, setSearch] = useState('')
  const [condoFiltro, setCondoFiltro] = useState(user?.condominio || 'Todos')
  const [mesFiltro, setMesFiltro] = useState(mesAtualPadrao())
  const [curtidas, setCurtidas] = useState({})
  const [modalNovoAberto, setModalNovoAberto] = useState(false)
  const [modalDisparoAberto, setModalDisparoAberto] = useState(false)

  const opcoesMeses = React.useMemo(() => {
    const set = new Set()
    const now = new Date()
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      set.add(val)
    }
    avisos.forEach(a => {
      const m = getMesAno(a)
      if (m) set.add(m)
    })
    return Array.from(set).sort().reverse().map(valor => ({
      valor,
      label: formatarMesAno(valor)
    }))
  }, [avisos])

  // Formulário de Novo Recado
  const [form, setForm] = useState({
    titulo: '',
    tipo: 'Comunicado', // 'Aviso', 'Comunicado', 'Convocação', 'Urgente'
    condominio: user?.condominio || 'Todos',
    destino: 'Todos', // 'Todos', 'Moradores', 'Colaboradores'
    texto: '',
    dispararWhatsApp: true
  })

  // Formulário de Disparo Rápido por Residencial
  const [formDisparo, setFormDisparo] = useState({
    recadoId: '', // ID do recado selecionado, se houver
    condominio: user?.condominio || (condominios[0]?.nome || 'Todos'),
    titulo: '',
    mensagem: '',
    tipo: 'Comunicado'
  })

  // Função para abrir o disparo já com um recado específico carregado
  const abrirDisparoParaRecado = (recado) => {
    setFormDisparo({
      recadoId: recado.id,
      condominio: recado.condominio && recado.condominio !== 'Todos' ? recado.condominio : (user?.condominio || condominios[0]?.nome || 'Todos'),
      titulo: recado.titulo || '',
      mensagem: recado.texto || '',
      tipo: recado.tipo || 'Comunicado'
    })
    setStatusEnvio(null)
    setModalDisparoAberto(true)
  }

  // Ao selecionar um recado na lista suspensa do modal de disparo
  const handleSelecionarRecadoNoModal = (id) => {
    if (!id) {
      setFormDisparo(prev => ({
        ...prev,
        recadoId: '',
        titulo: '',
        mensagem: '',
        tipo: 'Comunicado'
      }))
      return
    }
    const r = avisos.find(a => a.id === id)
    if (r) {
      setFormDisparo(prev => ({
        ...prev,
        recadoId: r.id,
        titulo: r.titulo || '',
        mensagem: r.texto || '',
        tipo: r.tipo || 'Comunicado',
        condominio: r.condominio && r.condominio !== 'Todos' ? r.condominio : prev.condominio
      }))
    }
  }

  const [enviandoRecado, setEnviandoRecado] = useState(false)
  const [enviandoDisparo, setEnviandoDisparo] = useState(false)
  const [statusEnvio, setStatusEnvio] = useState(null)

  const [audioTocandoId, setAudioTocandoId] = useState(null)
  const [audioObj, setAudioObj] = useState(null)
  const [carregandoAudioId, setCarregandoAudioId] = useState(null)

  // Moradores alvo de acordo com o condomínio selecionado no form de novo recado
  const moradoresAlvoRecado = (moradores || []).filter(m => {
    if (!form.condominio || form.condominio === 'Todos') return true
    const mCondo = normalizar(m.condominio)
    const fCondo = normalizar(form.condominio)
    return mCondo === fCondo || mCondo.includes(fCondo) || fCondo.includes(mCondo)
  })

  // Moradores alvo para o modal de disparo rápido
  const moradoresAlvoDisparo = (moradores || []).filter(m => {
    if (!formDisparo.condominio || formDisparo.condominio === 'Todos') return true
    const mCondo = normalizar(m.condominio)
    const fCondo = normalizar(formDisparo.condominio)
    return mCondo === fCondo || mCondo.includes(fCondo) || fCondo.includes(mCondo)
  })

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

  // Filtragem de avisos por permissão, condomínio e mês
  const avisosVisiveis = avisos.filter(a => {
    if (user?.role !== 'Administrador') {
      if (a.condominio && a.condominio !== 'Todos' && user?.condominio) {
        const aCondo = normalizar(a.condominio)
        const uCondo = normalizar(user.condominio)
        if (aCondo !== uCondo && !aCondo.includes(uCondo) && !uCondo.includes(aCondo)) return false
      }
      if (user?.role === 'Morador' && a.destino === 'Colaboradores') return false
    }
    // Filtro visual de condomínio selecionado
    if (condoFiltro && condoFiltro !== 'Todos') {
      const aCondo = normalizar(a.condominio)
      const alvo = normalizar(condoFiltro)
      if (aCondo !== 'todos' && aCondo !== alvo && !aCondo.includes(alvo) && !alvo.includes(aCondo)) return false
    }
    // Filtro visual de mês
    if (mesFiltro && mesFiltro !== 'Todos') {
      const mesA = getMesAno(a)
      if (mesA && mesA !== mesFiltro) return false
    }
    return true
  }).sort((a, b) => getTime(b) - getTime(a))

  const feedFiltrado = avisosVisiveis.filter(a =>
    !search.trim() ||
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

    setEnviandoRecado(true)
    try {
      await addAviso({
        titulo: form.titulo,
        tipo: form.tipo,
        condominio: form.condominio || 'Todos',
        destino: form.destino || 'Todos',
        texto: form.texto,
        autor: user?.nome || 'Administração',
        data: format(new Date(), 'dd/MM/yyyy'),
        createdAt: new Date().toISOString(),
        _createdAt: new Date().toISOString()
      })

      // 1. Notificação geral / administrativa no sistema
      await addDoc(collection(db, 'notificacoes'), {
        text: `📢 Novo comunicado no Mural: "${form.titulo}" – para ${form.destino}${form.condominio !== 'Todos' ? ` (${form.condominio})` : ''}`,
        time: new Date().toISOString(),
        tipo: 'comunicado',
        lida: false,
        _createdAt: serverTimestamp(),
        destino: form.destino,
        condominio: form.condominio
      })

      // 2. Notificações individuais no Firestore para cada morador do condomínio
      for (const m of moradoresAlvoRecado) {
        try {
          await addDoc(collection(db, 'notificacoes'), {
            text: `📢 Novo recado no Mural: "${form.titulo}"`,
            time: new Date().toISOString(),
            tipo: 'comunicado',
            lida: false,
            _createdAt: serverTimestamp(),
            condominio: m.condominio || form.condominio,
            moradorId: m.id,
            moradorNome: m.nome,
            moradorEmail: m.email || '',
            link: '/mural'
          })
        } catch (errNotif) {
          console.warn('Erro ao salvar notificação individual no Mural:', m.nome, errNotif)
        }
      }

      // 3. Disparo Push OneSignal para os moradores do condomínio
      let targetEmails = null
      if (form.condominio && form.condominio !== 'Todos') {
        targetEmails = moradoresAlvoRecado.filter(m => m.email).map(m => m.email)
        if (targetEmails.length === 0) targetEmails = ['dummy_para_nao_enviar_para_todos@local.host']
      }

      fetch('/api/onesignal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `📢 ${form.tipo || 'Comunicado'}: ${form.titulo}`,
          message: form.texto,
          targetUserIds: targetEmails,
          targetUrl: window.location.origin + '/mural'
        })
      }).catch(e => console.error('Push erro Mural:', e))

      // 4. Disparo WhatsApp para os moradores caso a opção esteja ativa
      if (form.dispararWhatsApp) {
        const telefonesAvisos = ['558396885931', '5583996806325', '5583999797285', '5583998350321', '5583998468997']
        const msgAvisoWhats = `📢 *NOVO ${form.tipo ? form.tipo.toUpperCase() : 'COMUNICADO'} NO MURAL - ALPHA GESTÃO*\n\n📌 *Título:* ${form.titulo}\n🏢 *Condomínio:* ${form.condominio || 'Todos'}\n🎯 *Destino:* ${form.destino || 'Todos'}\n\n📝 *Mensagem:*\n${form.texto}\n\n🔗 *Acesse o Mural:* https://alpha-solucoes-condominiais.vercel.app/mural`

        const telefonesMoradores = moradoresAlvoRecado
          .map(m => (m.tel || m.telefone || m.whatsapp || m.celular || m.fone || m.contato || m.numero || '').replace(/\D/g, ''))
          .filter(t => t && t.length >= 8)
          .map(t => t.startsWith('55') ? t : `55${t}`)

        const todosTelefones = Array.from(new Set([...telefonesAvisos, ...telefonesMoradores]))

        todosTelefones.forEach(tel => {
          enviarMensagemWhatsApp({
            number: tel,
            text: msgAvisoWhats,
            instance: 'InstanciaAlpha'
          }).catch(e => console.warn('Falha no envio de aviso WhatsApp Mural:', tel, e))
        })
      }

      setModalNovoAberto(false)
      setForm({
        titulo: '',
        tipo: 'Comunicado',
        condominio: user?.condominio || 'Todos',
        destino: 'Todos',
        texto: '',
        dispararWhatsApp: true
      })
      alert(`Recado publicado com sucesso no Mural!${form.dispararWhatsApp ? ' Notificações e WhatsApp disparados para os moradores.' : ''}`)
    } catch (e) {
      console.error(e)
      alert('Erro ao publicar recado.')
    } finally {
      setEnviandoRecado(false)
    }
  }

  // Disparo Rápido via WhatsApp direto por Residencial
  const handleDisparoRapido = async () => {
    if (!formDisparo.mensagem.trim()) {
      alert('Por favor, digite a mensagem a ser disparada para os moradores.')
      return
    }

    setEnviandoDisparo(true)
    setStatusEnvio('Iniciando disparos para os moradores...')
    try {
      const msgTexto = `📢 *ALPHA GESTÃO - AVISO AOS MORADORES*\n\n🏢 *Condomínio:* ${formDisparo.condominio || 'Todos'}\n${formDisparo.titulo ? `📌 *Assunto:* ${formDisparo.titulo}\n` : ''}\n📝 *Mensagem:*\n${formDisparo.mensagem}\n\n🔗 *Acesse o Portal:* https://alpha-solucoes-condominiais.vercel.app/mural`

      const telefonesAvisos = ['558396885931', '5583996806325', '5583999797285', '5583998350321', '5583998468997']
      const telefonesMoradores = moradoresAlvoDisparo
        .map(m => (m.tel || m.telefone || m.whatsapp || m.celular || m.fone || m.contato || m.numero || '').replace(/\D/g, ''))
        .filter(t => t && t.length >= 8)
        .map(t => t.startsWith('55') ? t : `55${t}`)

      const todosTelefones = Array.from(new Set([...telefonesAvisos, ...telefonesMoradores]))

      let enviados = 0
      for (const tel of todosTelefones) {
        try {
          await enviarMensagemWhatsApp({
            number: tel,
            text: msgTexto,
            instance: 'InstanciaAlpha'
          })
          enviados++
          setStatusEnvio(`Enviando: ${enviados}/${todosTelefones.length} contatos...`)
        } catch (err) {
          console.warn('Erro ao disparar para', tel, err)
        }
      }

      // Notificação no sistema também
      await addDoc(collection(db, 'notificacoes'), {
        text: `📲 Disparo WhatsApp para moradores: "${formDisparo.titulo || 'Comunicado'}" (${formDisparo.condominio})`,
        time: new Date().toISOString(),
        tipo: 'comunicado',
        lida: false,
        _createdAt: serverTimestamp(),
        condominio: formDisparo.condominio
      })

      setStatusEnvio(`✅ Sucesso! Disparo enviado para ${todosTelefones.length} telefones (${telefonesMoradores.length} moradores de ${formDisparo.condominio}).`)
      setTimeout(() => {
        setModalDisparoAberto(false)
        setStatusEnvio(null)
        setFormDisparo({
          condominio: user?.condominio || (condominios[0]?.nome || 'Todos'),
          titulo: '',
          mensagem: '',
          tipo: 'Comunicado'
        })
      }, 2500)
    } catch (e) {
      console.error(e)
      alert('Erro durante o disparo.')
      setStatusEnvio(null)
    } finally {
      setEnviandoDisparo(false)
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

        <div className="flex items-center gap-2">
          <button
            onClick={() => setModalDisparoAberto(true)}
            className="flex items-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold bg-green-600 hover:bg-green-700 text-white shadow-md transition-all active:scale-95"
            title="Disparar aviso via WhatsApp para os moradores de um residencial"
          >
            <Smartphone size={18} />
            <span>Disparo WhatsApp</span>
          </button>

          <button
            onClick={() => setModalNovoAberto(true)}
            className="btn-primary flex items-center gap-2 py-2.5 px-4 shadow-md"
          >
            <Plus size={18} />
            <span>Novo Recado</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtro de Condomínio e Mês */}
      <div className="bg-white rounded-2xl shadow-sm border border-pale-300 p-4 flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Building2 size={13} className="text-gray-400" /> Condomínio:
              </label>
              <select
                value={condoFiltro}
                onChange={e => setCondoFiltro(e.target.value)}
                className="input py-1.5 px-3 text-sm font-semibold w-auto min-w-[200px]"
              >
                <option value="Todos">Todos os Condomínios (Geral)</option>
                {condominios.map(c => (
                  <option key={c.id} value={c.nome}>{c.nome}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Calendar size={13} className="text-gray-400" /> Mês:
              </label>
              <select
                value={mesFiltro}
                onChange={e => setMesFiltro(e.target.value)}
                className="input py-1.5 px-3 text-sm font-semibold w-auto min-w-[170px]"
              >
                <option value="Todos">Todos os Meses</option>
                {opcoesMeses.map(m => (
                  <option key={m.valor} value={m.valor}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          <span className="text-xs text-gray-400 font-medium">
            Exibindo {feedFiltrado.length} comunicado(s) {mesFiltro !== 'Todos' ? `em ${formatarMesAno(mesFiltro)}` : ''} {condoFiltro !== 'Todos' ? `• ${condoFiltro}` : ''}
          </span>
        </div>

        {/* Busca */}
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input
            className="input pl-10 rounded-xl bg-pale-50 border border-pale-200 shadow-xs text-sm"
            placeholder="Buscar no mural por assunto, aviso ou palavra-chave..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
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

                {['Administrador', 'Síndico'].includes(user?.role) && (
                  <button
                    onClick={() => abrirDisparoParaRecado(post)}
                    className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 transition-all shadow-xs"
                    title="Enviar este recado diretamente via WhatsApp para os moradores de um residencial"
                  >
                    <Smartphone size={14} className="text-emerald-600" />
                    <span>Enviar para Residencial</span>
                  </button>
                )}
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
                  <label className="label font-bold text-gray-700 flex items-center justify-between">
                    <span>Residencial / Condomínio</span>
                    <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      {moradoresAlvoRecado.length} {moradoresAlvoRecado.length === 1 ? 'morador' : 'moradores'}
                    </span>
                  </label>
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
                </div>
              </div>

              <div>
                <label className="label font-bold text-gray-700">Mensagem / Conteúdo *</label>
                <textarea
                  rows={4}
                  className="input font-medium resize-none"
                  placeholder="Escreva a mensagem que todos os moradores visualizarão no mural..."
                  value={form.texto}
                  onChange={e => setForm({ ...form, texto: e.target.value })}
                />
              </div>

              {/* Opção de Disparo WhatsApp */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="dispararWhatsCheck"
                  checked={form.dispararWhatsApp}
                  onChange={e => setForm({ ...form, dispararWhatsApp: e.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300"
                />
                <label htmlFor="dispararWhatsCheck" className="text-xs text-gray-700 cursor-pointer flex-1">
                  <span className="font-bold text-emerald-800 flex items-center gap-1.5">
                    <Smartphone size={14} className="text-emerald-600" /> Disparar WhatsApp para os moradores deste residencial
                  </span>
                  <p className="text-gray-500 text-[11px] mt-0.5">
                    Envia automaticamente uma mensagem no WhatsApp para os telefones cadastrados no {form.condominio === 'Todos' ? 'todos os condomínios' : form.condominio} ({moradoresAlvoRecado.length} contatos).
                  </p>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-200">
              <button
                onClick={() => setModalNovoAberto(false)}
                className="btn-secondary text-xs"
                disabled={enviandoRecado}
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvarRecado}
                disabled={enviandoRecado}
                className="btn-primary text-xs flex items-center gap-1.5 px-5 disabled:opacity-50"
              >
                {enviandoRecado ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Publicando & Disparando...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>Publicar no Mural</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Disparo Direto via WhatsApp por Residencial */}
      {modalDisparoAberto && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-4 animate-scale-in border border-emerald-100">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Smartphone size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-gray-900 leading-tight">
                    Disparo de WhatsApp para Moradores
                  </h3>
                  <p className="text-xs text-gray-500">Selecione o residencial e envie o aviso diretamente nos celulares</p>
                </div>
              </div>
              <button onClick={() => !enviandoDisparo && setModalDisparoAberto(false)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              {/* Seletor de Recado já criado */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3">
                <label className="label font-bold text-amber-900 flex items-center justify-between mb-1">
                  <span>📌 Usar um Recado já Criado (Opcional)</span>
                  {formDisparo.recadoId && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                      Recado Carregado
                    </span>
                  )}
                </label>
                <select
                  className="input font-medium bg-white text-gray-800 border-amber-300"
                  value={formDisparo.recadoId}
                  onChange={e => handleSelecionarRecadoNoModal(e.target.value)}
                >
                  <option value="">— Criar mensagem avulsa ou selecione um recado abaixo —</option>
                  {avisos.map(a => (
                    <option key={a.id} value={a.id}>
                      [{a.tipo || 'Aviso'}] {a.titulo} {a.condominio ? `(Original: ${a.condominio})` : ''} - {a.data || ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-amber-700 mt-1">
                  Você pode selecionar qualquer recado já postado no mural para dispará-lo aos moradores do residencial escolhido.
                </p>
              </div>

              <div>
                <label className="label font-bold text-gray-700 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Building2 size={14} className="text-brand-600" /> Residencial de Destino para o Disparo *
                  </span>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                    {moradoresAlvoDisparo.length} moradores encontrados
                  </span>
                </label>
                <select
                  className="input font-semibold text-gray-800 bg-emerald-50/40 border-emerald-300 focus:border-emerald-500 text-sm"
                  value={formDisparo.condominio}
                  onChange={e => setFormDisparo({ ...formDisparo, condominio: e.target.value })}
                >
                  <option value="Todos">🌐 Todos os Residenciais ({moradores?.length || 0} moradores)</option>
                  {condominios.map(c => {
                    const count = (moradores || []).filter(m => {
                      const mCondo = normalizar(m.condominio)
                      const cCondo = normalizar(c.nome)
                      return mCondo === cCondo || mCondo.includes(cCondo) || cCondo.includes(mCondo)
                    }).length
                    return (
                      <option key={c.id || c.nome} value={c.nome}>
                        🏢 {c.nome} ({count} moradores)
                      </option>
                    )
                  })}
                </select>
              </div>

              <div>
                <label className="label font-bold text-gray-700">Título / Assunto (Opcional)</label>
                <input
                  type="text"
                  className="input font-medium"
                  placeholder="Ex: Interrupção temporária de água, Reunião de emergência..."
                  value={formDisparo.titulo}
                  onChange={e => setFormDisparo({ ...formDisparo, titulo: e.target.value })}
                />
              </div>

              <div>
                <label className="label font-bold text-gray-700">Mensagem do Aviso *</label>
                <textarea
                  rows={4}
                  className="input font-medium resize-none"
                  placeholder="Escreva a mensagem clara e objetiva para os moradores deste residencial..."
                  value={formDisparo.mensagem}
                  onChange={e => setFormDisparo({ ...formDisparo, mensagem: e.target.value })}
                />
              </div>

              {statusEnvio && (
                <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${statusEnvio.includes('✅') ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`}>
                  {enviandoDisparo && <Loader2 size={15} className="animate-spin text-emerald-600 shrink-0" />}
                  <span>{statusEnvio}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-200">
              <span className="text-[11px] text-gray-500">
                Disparo via <strong>Instância Alpha</strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setModalDisparoAberto(false)}
                  className="btn-secondary text-xs"
                  disabled={enviandoDisparo}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDisparoRapido}
                  disabled={enviandoDisparo || moradoresAlvoDisparo.length === 0}
                  className="btn-primary bg-emerald-600 hover:bg-emerald-700 text-xs flex items-center gap-2 px-5 py-2.5 shadow-md disabled:opacity-50"
                >
                  {enviandoDisparo ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Enviando mensagens...</span>
                    </>
                  ) : (
                    <>
                      <Send size={15} />
                      <span>Disparar para Moradores ({moradoresAlvoDisparo.length})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
