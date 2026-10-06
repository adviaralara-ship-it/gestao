import React, { useState } from 'react'
import { MessageSquare, Plus, Send, Megaphone, Trash2, Search, User, Smartphone, CheckSquare, Square, ExternalLink, Sparkles, Loader2, Bot } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { enviarEmail } from '../emailjs.config'
import { enviarMensagemWhatsApp } from '../utils/whatsappAutomacao'
import { GoogleGenerativeAI } from '@google/generative-ai'

const API_KEYS = [
  import.meta.env?.VITE_GEMINI_API_KEY,
  "AQ.Ab8RN6KdJTQzq73dAmBYqMifqbyYBO58ewLnP57zgB49j1xPYA",
  "AQ.Ab8RN6Ik8r-5xXO62z8qMO7Ne9Qxf8jUNTLpuWN4Ou2SPJAhXA"
].filter(Boolean)

const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-flash-latest",
  "gemini-1.5-flash",
  "gemini-2.0-flash"
]

async function gerarTextoComunicado(prompt) {
  let lastError = null
  for (const modelName of GEMINI_MODELS) {
    for (const key of API_KEYS) {
      try {
        const genAI = new GoogleGenerativeAI(key)
        const model = genAI.getGenerativeModel({ model: modelName })
        const result = await model.generateContent(prompt)
        const text = result?.response?.text()?.trim()
        if (text) return text
      } catch (err) {
        lastError = err
      }
    }
  }
  throw lastError || new Error("Falha ao conectar com o serviço de IA.")
}

const tipoBadge = t=>({Aviso:'badge-blue',Comunicado:'badge-green',Convocação:'badge-purple',Urgente:'badge-red'}[t]||'badge-blue')

function ModalComunicado({ onClose, onSave, moradores, condominios }) {
  const [form, setForm] = useState({ titulo:'', texto:'', tipo:'Aviso', destino:'Todos', moradorEspecifico:'', condominio: 'Todos' })
  const set = (k,v) => setForm(f=>({...f,[k]:v}))
  const destinoIndividual = form.destino==='Individual'
  const [gerandoIA, setGerandoIA] = useState(false)
  const redigirComIA = async () => {
    if (!form.titulo) return alert("Por favor, digite pelo menos o Título para a IA ter uma base.")
    setGerandoIA(true)
    try {
      const prompt = `Atue como um síndico/administrador profissional de condomínio. 
Escreva um comunicado ${form.tipo.toLowerCase()} com o título "${form.titulo}". 
${form.texto ? `Use o seguinte rascunho/ideia como base: ${form.texto}` : ''}
O tom deve ser respeitoso, claro, objetivo e amigável. Retorne apenas o texto final do comunicado, sem aspas, pronto para ser enviado aos ${form.destino}.`
      
      const text = await gerarTextoComunicado(prompt)
      set('texto', text)
    } catch (e) {
      console.error(e)
      alert("Erro ao gerar texto com IA. Verifique a conexão e tente novamente.")
    } finally {
      setGerandoIA(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e=>e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">Novo Comunicado</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-lg">✕</button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div><label className="label">Título</label><input className="input" value={form.titulo} onChange={e=>set('titulo',e.target.value)} placeholder="Título do comunicado..."/></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Tipo</label>
              <select className="input" value={form.tipo} onChange={e=>set('tipo',e.target.value)}>
                <option>Aviso</option><option>Comunicado</option><option>Convocação</option><option>Urgente</option>
              </select>
            </div>
            <div><label className="label">Destinatários</label>
              <select className="input" value={form.destino} onChange={e=>set('destino',e.target.value)}>
                <option>Todos</option><option>Proprietários</option><option>Inquilinos</option><option>Colaboradores</option><option>Individual</option>
              </select>
            </div>
            {!destinoIndividual && (
              <div className="col-span-2"><label className="label">Condomínio</label>
                <select className="input" value={form.condominio} onChange={e=>set('condominio',e.target.value)}>
                  <option value="Todos">Todos os Condomínios</option>
                  {condominios.map(c=>(<option key={c.id} value={c.nome}>{c.nome}</option>))}
                </select>
              </div>
            )}
          </div>
          {destinoIndividual && (
            <div className="animate-fade-in">
              <label className="label">Selecionar Morador</label>
              <select className="input" value={form.moradorEspecifico} onChange={e=>set('moradorEspecifico',e.target.value)}>
                <option value="">— Selecione o morador —</option>
                {moradores.map(m=>(
                  <option key={m.id} value={`${m.nome} (${m.apt||m.unidade})`}>{m.nome} – Apt {m.apt||m.unidade}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label m-0">Mensagem</label>
              <button onClick={redigirComIA} disabled={gerandoIA} type="button" className="flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 px-3 py-1 rounded-full transition-colors disabled:opacity-50">
                {gerandoIA ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12}/>}
                {gerandoIA ? 'Escrevendo...' : 'Redigir com IA'}
              </button>
            </div>
            <textarea className="input resize-none min-h-[120px]" value={form.texto} onChange={e=>set('texto',e.target.value)} placeholder="Escreva o comunicado detalhado aqui ou clique em 'Redigir com IA' para expandir o seu rascunho..."/>
          </div>
        </div>
        <div className="p-6 border-t border-cream-300 flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={()=>{
            if(!form.titulo||!form.texto)return
            if(destinoIndividual&&!form.moradorEspecifico)return
            onSave({...form, autor:'Administração', data:new Date().toLocaleDateString('pt-BR'),
              destino:destinoIndividual?form.moradorEspecifico:form.destino})
          }} className="btn-primary"><Send size={14}/>Publicar</button>
        </div>
      </div>
    </div>
  )
}

function ModalMensagem({ onClose, onSave, moradores }) {
  const [form, setForm] = useState({ moradorId:'', texto:'' })
  const selected = moradores.find(m=>m.id===form.moradorId)
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e=>e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">Nova Mensagem para Morador</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-lg">✕</button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div>
            <label className="label">Selecionar Morador</label>
            <select className="input" value={form.moradorId} onChange={e=>setForm(f=>({...f,moradorId:e.target.value}))}>
              <option value="">— Selecione o morador —</option>
              {moradores.map(m=>(
                <option key={m.id} value={m.id}>{m.nome} – Apt {m.apt||m.unidade||'?'} {m.condominio?`(${m.condominio})`:''}</option>
              ))}
            </select>
          </div>
          {selected && (
            <div className="flex items-center gap-2 p-3 bg-pale-100 rounded-xl border border-brand-200 animate-fade-in">
              <div className="w-8 h-8 bg-brand-600 rounded-full flex items-center justify-center text-white text-sm font-bold">{selected.nome[0]}</div>
              <div>
                <p className="text-sm font-semibold text-gray-800">{selected.nome}</p>
                <p className="text-xs text-gray-500">Apt {selected.apt||selected.unidade} {selected.condominio?`· ${selected.condominio}`:''}</p>
              </div>
            </div>
          )}
          <div><label className="label">Mensagem</label><textarea className="input resize-none min-h-[100px]" value={form.texto} onChange={e=>setForm(f=>({...f,texto:e.target.value}))} placeholder="Escreva sua mensagem..."/></div>
        </div>
        <div className="p-6 border-t border-cream-300 flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={()=>{
            if(!form.moradorId||!form.texto||!selected)return
            onSave({
              de:`Administração → ${selected.nome}`, apt:selected.apt||selected.unidade||'',
              texto:form.texto, data:new Date().toLocaleDateString('pt-BR'),
              hora:new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}),
              lida:true, enviada:true, moradorEmail:selected.email||'', moradorTel:selected.tel||'',
              moradorId: form.moradorId
            })
          }} className="btn-primary"><Send size={14}/>Enviar</button>
        </div>
      </div>
    </div>
  )
}

export default function Comunicacao() {
  const { user } = useAuth()
  const { items: avisos,   addItem: addAviso,   deleteItem: delAviso }   = useFirestore('avisos')
  const { items: mensagens,addItem: addMensagem,updateItem: updMsg,deleteItem: delMensagem } = useFirestore('mensagens')
  const { items: moradores } = useFirestore('moradores')
  const { items: allCondominios } = useFirestore('condominios')
  const condominios = allCondominios.filter(c => c.status !== 'Inativo')
  const [tab,    setTab]    = useState('comunicados')
  const [modal,  setModal]  = useState(null)
  const [search, setSearch] = useState('')
  const [respostas, setRespostas] = useState({})
  const [msgWpp, setMsgWpp] = useState('')
  const [selecionadosWpp, setSelecionadosWpp] = useState([])
  const [statusWpp, setStatusWpp] = useState('')

  const isMorador = user?.role === 'Morador'
  const condoUser = user?.condominio ? user.condominio.trim().toLowerCase() : ''

  const toggleWpp    = id  => setSelecionadosWpp(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id])
  const toggleTodos  = ()  => setSelecionadosWpp(selecionadosWpp.length===moradores.length?[]:moradores.map(m=>m.id))

  const dispararWppWeb = () => {
    if(!msgWpp||selecionadosWpp.length===0) return
    const primeiro = moradores.find(m=>m.id===selecionadosWpp[0])
    const tel = primeiro?.telefone?.replace(/\D/g,'') || primeiro?.tel?.replace(/\D/g,'') || '558396885931'
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msgWpp)}`,'_blank')
    setStatusWpp(`✅ Link aberto para ${primeiro?.nome}. Para envio em lote, use a API.`)
    setTimeout(()=>setStatusWpp(''),5000)
  }

  // Filtragem de comunicados: administradores e síndicos veem tudo ou seus condomínios; morador vê estritamente o seu condomínio ou os direcionados a ele
  const avisosFiltrados = avisos.filter(a => {
    if (isMorador && condoUser) {
      const aCondo = (a.condominio || '').trim().toLowerCase()
      // Se tiver condomínio especificado e for diferente do condomínio do morador, não exibe
      if (aCondo && aCondo !== 'todos' && aCondo !== condoUser) {
        return false
      }
      if (a.destino === 'Colaboradores') return false
      if (a.destino && a.destino !== 'Todos' && a.destino !== 'Proprietários' && a.destino !== 'Inquilinos') {
        const uNome = (user?.nome || '').trim().toLowerCase()
        const dStr = String(a.destino).trim().toLowerCase()
        if (!dStr.includes(uNome) && !uNome.includes(dStr)) {
          return false
        }
      }
    }
    const matchSearch = a.titulo?.toLowerCase().includes(search.toLowerCase()) || a.texto?.toLowerCase().includes(search.toLowerCase())
    return matchSearch
  })

  // Filtragem de mensagens: moradores só veem mensagens pertinentes à sua unidade/nome/email
  const mensagensFiltradas = mensagens.filter(m => {
    if (isMorador) {
      const uApt = String(user?.unidade || user?.apt || '').trim().toLowerCase()
      const uNome = (user?.nome || '').trim().toLowerCase()
      const uEmail = (user?.email || '').trim().toLowerCase()
      const mApt = String(m.apt || '').trim().toLowerCase()
      const mDe = String(m.de || '').trim().toLowerCase()
      const mEmail = String(m.moradorEmail || '').trim().toLowerCase()
      const match = (uEmail && mEmail === uEmail) || (uNome && mDe.includes(uNome)) || (uApt && mApt === uApt)
      if (!match) return false
    }
    const matchSearch = m.de?.toLowerCase().includes(search.toLowerCase()) || m.texto?.toLowerCase().includes(search.toLowerCase())
    return matchSearch
  })
  const naoLidas           = mensagensFiltradas.filter(m=>!m.lida).length

  const handleResponder = async id => {
    const texto = respostas[id]
    if(!texto?.trim()) return
    const original = mensagens.find(x => x.id === id)
    await updMsg(id,{lida:true})
    
    // Adiciona a resposta como uma nova mensagem recebida pela Administração
    await addMensagem({
      de: `Resposta de Morador`,
      apt: original?.apt || '',
      texto: texto,
      data: new Date().toLocaleDateString('pt-BR'),
      hora: new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}),
      lida: false,
      enviada: false // falso = recebida pela admin
    })

    // (Opcional) Poderia enviar email para a ADM avisando da resposta
    setRespostas(r=>({...r,[id]:''}))
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="page-header">
        <div><h2 className="section-title text-xl">Comunicação</h2><p className="section-sub">Avisos e mensagens dos residentes</p></div>
        <div className="flex gap-2">
          <button onClick={()=>setModal('mensagem')} className="btn-secondary"><User size={15}/>Mensagem Individual</button>
          <button onClick={()=>setModal('comunicado')} className="btn-primary"><Plus size={16}/>Novo Comunicado</button>
        </div>
      </div>

      <div className="flex gap-2">
        {[{id:'comunicados',label:'Comunicados'},{id:'mensagens',label:'Mensagens',count:naoLidas},{id:'whatsapp',label:'Disparo WhatsApp'}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${tab===t.id?'bg-brand-600 text-white shadow-md':'bg-white text-gray-500 hover:text-brand-700 border border-cream-400 hover:bg-cream-100'}`}>
            {t.label}
            {t.count>0&&<span className="w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center text-white font-bold">{t.count}</span>}
          </button>
        ))}
      </div>

      {tab!=='whatsapp' && (
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input className="input pl-9" placeholder={tab==='comunicados'?'Buscar comunicados...':'Buscar mensagens...'} value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
      )}

      {/* Comunicados */}
      {tab==='comunicados' && (
        <div className="flex flex-col gap-4">
          {avisosFiltrados.length===0&&<div className="card text-center py-10 text-gray-400 text-sm">Nenhum comunicado encontrado.</div>}
          {avisosFiltrados.map(a=>(
            <div key={a.id} className="card hover:border-brand-300 transition-all group">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2"><Megaphone size={16} className="text-brand-500"/><h3 className="font-bold text-gray-800">{a.titulo}</h3></div>
                <div className="flex gap-2 items-center">
                  <span className={tipoBadge(a.tipo)}>{a.tipo}</span>
                  <span className="badge-blue">{a.destino}</span>
                  {a.condominio && a.condominio !== 'Todos' && <span className="badge-purple">{a.condominio}</span>}
                  <button onClick={()=>delAviso(a.id)} className="p-1.5 rounded-lg bg-cream-200 hover:bg-red-100 text-gray-400 hover:text-red-500 transition-all"><Trash2 size={13}/></button>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-3 leading-relaxed">{a.texto}</p>
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>📝 {a.autor}</span><span>{a.data}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mensagens */}
      {tab==='mensagens' && (
        <div className="flex flex-col gap-3">
          {mensagensFiltradas.length===0&&<div className="card text-center py-10 text-gray-400 text-sm">Nenhuma mensagem encontrada.</div>}
          {mensagensFiltradas.map(m=>(
            <div key={m.id} className={`card transition-all group ${!m.lida?'border-brand-400 bg-pale-100':'hover:border-brand-200'}`}>
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white min-w-9 ${m.enviada?'bg-emerald-500':!m.lida?'bg-brand-600':'bg-brand-400'}`}>{m.de?.[0]||'?'}</div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-gray-800 text-sm">{m.de} <span className="text-gray-400 font-normal text-xs">({m.apt})</span></p>
                    <div className="flex items-center gap-2">
                      {!m.lida&&<span className="badge-blue">Nova</span>}
                      {m.enviada&&<span className="badge-green">Enviada</span>}
                      <span className="text-xs text-gray-400">{m.hora}</span>
                      <button onClick={()=>delMensagem(m.id)} className="p-1 rounded-lg hover:bg-red-100 text-gray-400 hover:text-red-500 transition-all"><Trash2 size={13}/></button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">{m.texto}</p>
                </div>
              </div>
              {!m.enviada&&(
                <div className="mt-3 flex gap-2">
                  <div className="flex-1 relative">
                    <input className="input pr-10 text-xs py-2" placeholder="Responder..." value={respostas[m.id]||''} onChange={e=>setRespostas(r=>({...r,[m.id]:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&handleResponder(m.id)}/>
                    <button onClick={()=>handleResponder(m.id)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg bg-brand-600 hover:bg-brand-500 transition-all"><Send size={11} className="text-white"/></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Disparo WhatsApp */}
      {tab==='whatsapp' && (
        <div className="card grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <p className="font-bold text-gray-800 text-sm mb-1">Destinatários ({selecionadosWpp.length} selecionados)</p>
              <p className="text-xs text-gray-500">Moradores cadastrados no sistema</p>
            </div>
            <div className="bg-pale-100 border border-cream-300 rounded-xl max-h-[280px] overflow-y-auto overflow-x-hidden">
              <div className="flex items-center gap-3 p-3 border-b border-cream-300 cursor-pointer hover:bg-cream-200 transition-colors" onClick={toggleTodos}>
                {selecionadosWpp.length===moradores.length?<CheckSquare size={16} className="text-brand-600"/>:<Square size={16} className="text-gray-400"/>}
                <span className="text-sm font-bold text-gray-700">Selecionar Todos</span>
              </div>
              {moradores.length===0&&<p className="text-center text-xs text-gray-400 p-4">Nenhum morador cadastrado.</p>}
              {moradores.map(m=>(
                <div key={m.id} className="flex items-center justify-between p-3 border-b border-cream-200 cursor-pointer hover:bg-cream-200 transition-colors" onClick={()=>toggleWpp(m.id)}>
                  <div className="flex items-center gap-3">
                    {selecionadosWpp.includes(m.id)?<CheckSquare size={16} className="text-brand-600"/>:<Square size={16} className="text-gray-400"/>}
                    <span className="text-sm text-gray-800 font-medium">{m.nome}</span>
                  </div>
                  <span className="badge-blue shrink-0">Apt {m.apt||m.unidade||'?'}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-xs text-green-800"><strong>📝 Como funciona:</strong> Clique em "WhatsApp Web" para abrir uma conversa direta com o morador selecionado via wa.me.</p>
            </div>
            <div><label className="label">Mensagem do WhatsApp</label>
              <textarea className="input resize-none min-h-[120px]" placeholder="Olá! Este é um lembrete do condomínio..." value={msgWpp} onChange={e=>setMsgWpp(e.target.value)}/>
            </div>
            {statusWpp&&<p className="text-sm font-medium text-brand-700 bg-brand-50 p-3 rounded-lg text-center animate-fade-in">{statusWpp}</p>}
            <div className="flex gap-2 mt-auto">
              <button onClick={dispararWppWeb} disabled={!msgWpp||selecionadosWpp.length===0} className="btn-primary flex-1 justify-center bg-green-600 hover:bg-green-700 disabled:opacity-50 py-3">
                <ExternalLink size={14}/>WhatsApp Web
              </button>
            </div>
          </div>
        </div>
      )}

      {modal==='comunicado'&&(
        <ModalComunicado moradores={moradores} condominios={condominios} onClose={()=>setModal(null)} onSave={async a=>{
          await addAviso(a)

          // 1. Notificação geral / administrativa no sistema
          await addDoc(collection(db,'notificacoes'),{
            text:`📢 Novo comunicado: "${a.titulo}" – para ${a.destino}${a.condominio !== 'Todos' ? ` (${a.condominio})` : ''}`,
            time:new Date().toISOString(),tipo:'comunicado',lida:false,_createdAt:serverTimestamp(),
            destino: a.destino,
            condominio: a.condominio
          })

          // Filtrar moradores do condomínio selecionado (ou todos caso seja 'Todos')
          const moradoresAlvo = moradores.filter(m => {
            if (a.condominio && a.condominio !== 'Todos') {
              return m.condominio === a.condominio
            }
            return true
          })

          // 2. Criar notificações individuais no Firestore para cada morador do condomínio
          for (const m of moradoresAlvo) {
            try {
              await addDoc(collection(db, 'notificacoes'), {
                text: `📢 Novo comunicado no condomínio: "${a.titulo}"`,
                time: new Date().toISOString(),
                tipo: 'comunicado',
                lida: false,
                _createdAt: serverTimestamp(),
                condominio: m.condominio || a.condominio,
                moradorId: m.id,
                moradorNome: m.nome,
                moradorEmail: m.email || '',
                link: '/comunicacao'
              })
            } catch (errNotif) {
              console.warn('Erro ao salvar notificação individual do morador:', m.nome, errNotif)
            }
          }
          
          let targetEmails = null;
          if (a.condominio && a.condominio !== 'Todos') {
            targetEmails = moradoresAlvo.filter(m => m.email).map(m => m.email);
            if (targetEmails.length === 0) targetEmails = ['dummy_para_nao_enviar_para_todos@local.host'];
          }
          
          // 3. Disparo Push OneSignal para o condomínio específico ou geral
          fetch('/api/onesignal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              title: `📢 ${a.tipo || 'Comunicado'}: ${a.titulo}`, 
              message: a.texto,
              targetUserIds: targetEmails,
              targetUrl: window.location.origin + '/mural'
            })
          }).catch(e => console.error("Push erro", e))

          // 4. Disparo WhatsApp para os telefones administrativos e para os moradores cadastrados no condomínio
          const msgAvisoWhats = `📢 *NOVO ${a.tipo ? a.tipo.toUpperCase() : 'COMUNICADO'} - ALPHA GESTÃO*\n\n📌 *Título:* ${a.titulo}\n🏢 *Condomínio:* ${a.condominio || 'Todos'}\n🎯 *Destino:* ${a.destino || 'Todos'}\n\n📝 *Mensagem:*\n${a.texto}\n\n🔗 *Acesse o Mural Completo:*\nhttps://alpha-solucoes-condominiais.vercel.app/mural`

          // Telefones de avisos administrativos
          const telefonesAvisos = ['558396885931', '5583996806325', '5583999797285', '5583998350321', '5583998468997']
          
          // Coletar telefones únicos dos moradores do condomínio
          const telefonesMoradores = moradoresAlvo
            .map(m => (m.tel || m.telefone || m.whatsapp || m.celular || m.fone || m.contato || m.numero || '').replace(/\D/g, ''))
            .filter(t => t && t.length >= 8)
            .map(t => t.startsWith('55') ? t : `55${t}`)

          const todosTelefones = Array.from(new Set([...telefonesAvisos, ...telefonesMoradores]))

          // Enviar via whatsappAutomacao (tenta endpoint da API e possui fallback direto na Evolution API)
          todosTelefones.forEach(tel => {
            enviarMensagemWhatsApp({
              number: tel,
              text: msgAvisoWhats,
              instance: 'InstanciaAlpha'
            }).catch(e => console.warn('Falha no envio de aviso WhatsApp:', tel, e))
          })

          setModal(null)
        }}/>
      )}
      {modal==='mensagem'&&(
        <ModalMensagem moradores={moradores} onClose={()=>setModal(null)} onSave={async m=>{
          await addMensagem(m)
          // Notificação sistema para o morador
          await addDoc(collection(db,'notificacoes'),{
            text:`💬 Nova mensagem da Administração para ${m.de.split('→')[1]?.trim()||'morador'}`,
            time:new Date().toISOString(),tipo:'mensagem',lida:false,_createdAt:serverTimestamp(),
            destino: 'Individual', moradorEmail: m.moradorEmail||''
          })
          
          // Se tivermos o ID do morador alvo na mensagem
          const targetUserId = m.moradorId;

          // Disparo Push OneSignal Específico para o Morador
          if (targetUserId) {
            fetch('/api/onesignal', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                title: 'Nova Mensagem - Administração', 
                message: m.texto,
                targetUserId: m.moradorEmail,
                targetUrl: window.location.origin + '/comunicacao'
              })
            }).catch(e => console.error("Push erro", e))
          }

          // Email direto para o morador (se tiver email cadastrado)
          if (m.moradorEmail) {
            await enviarEmail(
              m.moradorEmail, 
              m.de.split('→')[1]?.trim() || 'Morador', 
              '💬 Nova mensagem da Administração', 
              `Você recebeu uma nova mensagem da administração do condomínio:<br><br><i>"${m.texto}"</i><br><br>Acesse o sistema para responder.`
            )
          }
          setModal(null)
        }}/>
      )}
    </div>
  )
}
