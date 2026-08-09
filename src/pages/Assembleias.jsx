import React, { useState } from 'react'
import { Gavel, Plus, Trash2, Download, FileText, Search, Video, X, BarChart3, Clock, CheckCircle2 } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { notificarAdm } from '../emailjs.config'
import { useAuth } from '../context/AuthContext'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '../firebase'
import { gerarAtaPorAudio } from '../utils/aiTranscricao'
import { jsPDF } from 'jspdf'

function ModalAssembleia({ onClose, onSave }) {
  const [form, setForm] = useState({ titulo:'', data:'', hora:'', local:'', tipo:'Ordinária', pauta:'' })
  const set = (k,v) => setForm(f=>({...f,[k]:v}))
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e=>e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">Nova Assembleia</h3>
          <button onClick={onClose} className="text-gray-400 text-lg hover:text-gray-700">✕</button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div><label className="label">Título</label><input className="input" value={form.titulo} onChange={e=>set('titulo',e.target.value)} placeholder="Ex: Assembleia Geral Ordinária"/></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Data</label><input type="date" className="input" value={form.data} onChange={e=>set('data',e.target.value)}/></div>
            <div><label className="label">Hora</label><input type="time" className="input" value={form.hora} onChange={e=>set('hora',e.target.value)}/></div>
          </div>
          <div><label className="label">Local</label><input className="input" value={form.local} onChange={e=>set('local',e.target.value)} placeholder="Ex: Salão de Festas – Bloco A"/></div>
          <div><label className="label">Tipo</label>
            <select className="input" value={form.tipo} onChange={e=>set('tipo',e.target.value)}>
              <option>Ordinária</option><option>Extraordinária</option>
            </select>
          </div>
          <div><label className="label">Pauta</label><textarea className="input resize-none min-h-[80px]" value={form.pauta} onChange={e=>set('pauta',e.target.value)} placeholder="Descreva os itens da pauta..."/></div>
        </div>
        <div className="p-6 border-t border-cream-300 flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={()=>{if(!form.titulo||!form.data)return;onSave({...form,status:'Agendada'})}} className="btn-primary"><Plus size={14}/>Agendar</button>
        </div>
      </div>
    </div>
  )
}

function ModalAta({ assembleia, onClose, onSave }) {
  const [texto, setTexto] = useState('')
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)

  const handleSave = async () => {
    if (!texto && !file) return
    let docUrl = null
    if (file) {
      setUploading(true)
      try {
        const fileRef = ref(storage, `atas/${Date.now()}_${file.name}`)
        await uploadBytes(fileRef, file)
        docUrl = await getDownloadURL(fileRef)
      } catch (e) {
        alert("Erro ao enviar arquivo.")
        setUploading(false)
        return
      }
      setUploading(false)
    }
    onSave(texto, docUrl)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-2xl" onClick={e=>e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">Registrar Ata – {assembleia.titulo}</h3>
          <button onClick={onClose} className="text-gray-400 text-lg hover:text-gray-700">✕</button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div>
            <label className="label">Conteúdo da Ata (Opcional se enviar anexo)</label>
            <textarea className="input resize-none min-h-[120px]" value={texto} onChange={e=>setTexto(e.target.value)} placeholder="Digite o conteúdo da ata..."/>
          </div>
          <div className="bg-cream-50 p-4 rounded-xl border border-dashed border-cream-400">
            <label className="label text-brand-600 mb-1">Ou Anexe a Ata Assinada (Foto/PDF)</label>
            <p className="text-xs text-gray-500 mb-3">No celular, isso abrirá a câmera para você tirar uma foto do papel.</p>
            <input 
              type="file" 
              accept="image/*,application/pdf"
              capture="environment"
              className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
              onChange={e=>setFile(e.target.files[0])}
            />
          </div>
        </div>
        <div className="p-6 border-t border-cream-300 flex gap-3 justify-end">
          <button onClick={onClose} disabled={uploading} className="btn-secondary">Cancelar</button>
          <button onClick={handleSave} disabled={uploading || (!texto && !file)} className="btn-primary">
            <FileText size={14}/> {uploading ? 'Enviando...' : 'Salvar Ata'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Assembleias() {
  const { user } = useAuth()
  const { items: assembleias, addItem: addAssembleia, deleteItem: delAssembleia, updateItem: updAssembleia } = useFirestore('assembleias')
  const { items: atas, addItem: addAta, deleteItem: delAta, updateItem: updAta } = useFirestore('atas')
  const [tab,    setTab]   = useState('assembleias')
  const [modal,  setModal] = useState(null)
  const [salaVirtual, setSalaVirtual] = useState(null)
  const [search, setSearch] = useState('')

  const filtAssembleias = assembleias.filter(a=>a.titulo?.toLowerCase().includes(search.toLowerCase())||a.local?.toLowerCase().includes(search.toLowerCase()))
  const filtAtas        = atas.filter(a=>a.titulo?.toLowerCase().includes(search.toLowerCase()))

  const handleNovaAssembleia = async a => {
    await addAssembleia({...a, condominio: user?.condominio || ''})
    // Notificação no sistema
    await addDoc(collection(db,'notificacoes'),{
      text:`🏛️ Nova assembleia agendada: "${a.titulo}" em ${a.data} às ${a.hora} – ${a.local}`,
      time:new Date().toISOString(), tipo:'assembleia', lida:false, condominio: user?.condominio || '', _createdAt:serverTimestamp()
    })
    // Email para ADM
    notificarAdm(
      `🏛️ Nova Assembleia: ${a.titulo}`,
      `Uma nova assembleia foi agendada:\n\n📋 Título: ${a.titulo}\n📅 Data: ${a.data} às ${a.hora}\n📍 Local: ${a.local}\n📄 Tipo: ${a.tipo}\n\nPauta:\n${a.pauta}`
    )
    // WhatsApp via link
    const wppMsg = encodeURIComponent(`🏛️ *Nova Assembleia Agendada*\n\n*${a.titulo}*\n📅 ${a.data} às ${a.hora}\n📍 ${a.local}\n\nPauta: ${a.pauta}`)
    window.open(`https://wa.me/?text=${wppMsg}`,'_blank')
    setModal(null)
  }

  const handleNovaAta = async (assembleia, texto, docUrl) => {
    await addAta({ titulo:assembleia.titulo, data:assembleia.data, texto, documentoFisicoUrl: docUrl, assinaturas: [], condominio: user?.condominio || '' })
    await updAssembleia(assembleia.id,{status:'Realizada'})
    // Notificação sistema
    await addDoc(collection(db,'notificacoes'),{
      text:`📄 Ata registrada: "${assembleia.titulo}" (${assembleia.data})`,
      time:new Date().toISOString(), tipo:'assembleia', lida:false, condominio: user?.condominio || '', _createdAt:serverTimestamp()
    })
    // Email ADM
    notificarAdm(
      `📄 Ata Registrada: ${assembleia.titulo}`,
      `A ata da assembleia "${assembleia.titulo}" (${assembleia.data}) foi registrada:\n\n${texto}`
    )
    // WhatsApp
    const wppMsg = encodeURIComponent(`📄 *Ata Registrada*\n\n*${assembleia.titulo}* – ${assembleia.data}\n\n${texto ? texto.substring(0,200) + '...' : 'Anexo disponível no sistema.'}`)
    window.open(`https://wa.me/?text=${wppMsg}`,'_blank')
    setModal(null)
  }

  const handleAssinarAta = async (ata) => {
    const confirmacao = window.confirm('Deseja registrar sua assinatura digital atestando que leu e concorda com esta ata?')
    if (!confirmacao) return
    const assinaturasAtuais = ata.assinaturas || []
    const novaAssinatura = { id: user.id || user.uid, nome: user.nome, apt: user.apt || '', data: new Date().toLocaleString('pt-BR') }
    await updAta(ata.id, { assinaturas: [...assinaturasAtuais, novaAssinatura] })
  }

  const gerarPdfAta = (ata) => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.width
    
    doc.setFontSize(16)
    doc.text(`ATA: ${ata.titulo}`, pageWidth / 2, 20, { align: 'center' })
    doc.setFontSize(10)
    doc.text(`Data: ${ata.data}`, pageWidth / 2, 28, { align: 'center' })
    
    doc.setFontSize(12)
    const textLines = doc.splitTextToSize(ata.texto, pageWidth - 30)
    doc.text(textLines, 15, 45)
    
    let yPos = 45 + (textLines.length * 6) + 10
    
    if (ata.assinaturas && ata.assinaturas.length > 0) {
      doc.setFontSize(14)
      doc.text('Assinaturas Digitais:', 15, yPos)
      yPos += 10
      doc.setFontSize(10)
      ata.assinaturas.forEach((ass, index) => {
        if (yPos > 270) { doc.addPage(); yPos = 20; }
        doc.text(`${index + 1}. ${ass.nome} (Apt: ${ass.apt}) - Data: ${ass.data}`, 15, yPos)
        yPos += 6
      })
    }
    
    doc.save(`Ata_${ata.titulo}_${ata.data}.pdf`)
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="page-header">
        <div><h2 className="section-title text-xl">Assembleias &amp; Atas</h2><p className="section-sub">{assembleias.length} assembleias cadastradas</p></div>
        {tab==='assembleias'&&<button onClick={()=>setModal('new')} className="btn-primary"><Plus size={16}/>Nova Assembleia</button>}
      </div>

      <div className="flex gap-2">
        {['assembleias','atas'].map(t=>(
          <button key={t} onClick={()=>setTab(t)} className={`px-5 py-2 rounded-lg text-sm font-medium capitalize transition-all ${tab===t?'bg-brand-600 text-white':'bg-white text-gray-500 hover:text-brand-700 border border-cream-400'}`}>{t}</button>
        ))}
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
        <input className="input pl-9" placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>

      {tab==='assembleias' && (
        <div className="flex flex-col gap-4">
          {filtAssembleias.length===0
            ? <div className="card text-center py-10 text-gray-400 text-sm">Nenhuma assembleia cadastrada.</div>
            : filtAssembleias.map(a=>(
              <div key={a.id} className="card hover:border-brand-300 transition-all group">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Gavel size={16} className="text-brand-500"/>
                      <p className="font-bold text-gray-800">{a.titulo}</p>
                      <span className="badge-blue">{a.tipo}</span>
                      {a.status==='Realizada'&&<span className="badge-green">Realizada</span>}
                    </div>
                    <p className="text-xs text-gray-500">📅 {a.data} às {a.hora} · 📍 {a.local}</p>
                    {a.pauta&&<p className="text-xs text-gray-500 mt-1 line-clamp-2">Pauta: {a.pauta}</p>}
                  </div>
                  <div className="flex gap-2 items-center flex-wrap justify-end">
                    <button onClick={()=>setSalaVirtual(a)} className="btn-primary py-1.5 text-xs bg-brand-600 hover:bg-brand-700 border-none"><Video size={12}/> Sala Virtual</button>
                    {['Administrador', 'Síndico'].includes(user?.role) && (
                      <>
                        <button onClick={()=>setModal(a)} className="btn-secondary py-1.5 text-xs"><FileText size={12}/>Registrar Ata</button>
                        <button onClick={()=>delAssembleia(a.id)} className="p-1.5 rounded-lg bg-cream-200 hover:bg-red-100 text-gray-400 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={12}/></button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}

      {tab==='atas' && (
        <div className="flex flex-col gap-4">
          {filtAtas.length===0
            ? <div className="card text-center py-10 text-gray-400 text-sm">Nenhuma ata registrada ainda.</div>
            : filtAtas.map(a=>{
                const assinaturas = a.assinaturas || []
                const jaAssinou = assinaturas.some(ass => ass.id === (user.id || user.uid))
                return (
                  <div key={a.id} className="card hover:border-brand-300 transition-all group flex flex-col md:flex-row gap-4 justify-between">
                    <div className="flex-1">
                      <p className="font-bold text-gray-800 mb-1">{a.titulo}</p>
                      <p className="text-xs text-gray-500 mb-2">{a.data}</p>
                      <p className="text-sm text-gray-600 line-clamp-3 mb-3">{a.texto}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="bg-cream-100 text-gray-600 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                          <CheckCircle2 size={12}/> {assinaturas.length} Assinatura{assinaturas.length !== 1 ? 's' : ''} Digital
                        </span>
                      </div>
                    </div>
                    <div className="flex md:flex-col gap-2 items-end justify-center shrink-0 border-t md:border-t-0 md:border-l border-cream-200 pt-3 md:pt-0 md:pl-4">
                      {jaAssinou ? (
                        <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1 border border-emerald-200 w-full justify-center">
                          <CheckCircle2 size={14}/> Você Assinou
                        </div>
                      ) : (
                        <button onClick={() => handleAssinarAta(a)} className="btn-primary py-2 px-4 text-xs bg-emerald-600 hover:bg-emerald-700 border-none w-full justify-center shadow-md">
                          Assinar Ata Online
                        </button>
                      )}
                      
                      {a.documentoFisicoUrl ? (
                        <a href={a.documentoFisicoUrl} target="_blank" rel="noreferrer" className="btn-secondary py-2 text-xs w-full justify-center text-brand-700 border-brand-300 bg-brand-50 hover:bg-brand-100">
                          <Download size={14}/> Ver Anexo Escaneado
                        </a>
                      ) : (
                        <button onClick={() => gerarPdfAta(a)} className="btn-secondary py-2 text-xs w-full justify-center">
                          <Download size={14}/> Baixar PDF
                        </button>
                      )}

                      {['Administrador', 'Síndico'].includes(user?.role) && (
                        <button onClick={()=>delAta(a.id)} className="p-2 rounded-lg bg-cream-100 hover:bg-red-100 text-gray-400 hover:text-red-500 transition-all w-full flex justify-center"><Trash2 size={14}/></button>
                      )}
                    </div>
                  </div>
                )
              })}
        </div>
      )}

      {modal==='new'&&<ModalAssembleia onClose={()=>setModal(null)} onSave={handleNovaAssembleia}/>}
      {modal&&modal!=='new'&&(
        <ModalAta assembleia={modal} onClose={()=>setModal(null)} onSave={(texto, docUrl)=>handleNovaAta(modal,texto, docUrl)}/>
      )}
      {salaVirtual && <SalaVirtualAssembleia assembleia={salaVirtual} onClose={() => setSalaVirtual(null)} />}
    </div>
  )
}

function SalaVirtualAssembleia({ assembleia, onClose }) {
  const { user } = useAuth()
  const isAdmin = ['Administrador', 'Síndico'].includes(user?.role)
  const { items: enquetes, updateItem } = useFirestore('enquetes')
  const { addItem: addAta, updateItem: updAssembleia } = useFirestore('atas') // usaremos p/ salvar
  const { updateItem: updAssembleiaReal } = useFirestore('assembleias')

  const activeEnquetes = enquetes.filter(e => e.status === 'Aberta').sort((a,b) => new Date(b._createdAt || 0) - new Date(a._createdAt || 0))

  // Estados de Gravação
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState(null)
  const audioChunks = React.useRef([])
  const [transcricaoPronta, setTranscricaoPronta] = useState(false)

  const handleVotar = async (e, opcaoIndex) => {
    const confirmacao = window.confirm(`Confirmar voto em: "${e.opcoes[opcaoIndex]}"?`)
    if (!confirmacao) return
    const novosVotos = { ...e.votos, [user.id]: opcaoIndex }
    await updateItem(e.id, { votos: novosVotos })
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      audioChunks.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.current.push(e.data) }
      
      recorder.onstop = async () => {
        setIsTranscribing(true)
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' })
        
        try {
          // Salva o áudio no storage opcionalmente (pode demorar, mas garante backup)
          const fileRef = ref(storage, `gravacoes/${Date.now()}_assembleia_${assembleia.id}.webm`)
          await uploadBytes(fileRef, audioBlob)
          const audioUrl = await getDownloadURL(fileRef)

          // Envia pro Gemini gerar a Ata
          const textoAta = await gerarAtaPorAudio(audioBlob, 'assembleia', `${assembleia.titulo} - ${assembleia.pauta}`)
          
          // Salva a Ata no banco!
          await addAta({
            titulo: assembleia.titulo,
            data: assembleia.data,
            texto: textoAta,
            documentoFisicoUrl: null,
            audioUrl: audioUrl,
            assinaturas: [],
            condominio: assembleia.condominio || ''
          })
          
          await updAssembleiaReal(assembleia.id, { status: 'Realizada' })
          
          setTranscricaoPronta(true)
        } catch (error) {
          alert("Erro ao transcrever o áudio: " + error.message)
        } finally {
          setIsTranscribing(false)
          stream.getTracks().forEach(track => track.stop())
        }
      }

      recorder.start()
      setMediaRecorder(recorder)
      setIsRecording(true)
    } catch (e) {
      alert("Permissão de microfone negada ou não disponível.")
    }
  }

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
      setIsRecording(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-gray-100 flex flex-col animate-fade-in">
      <div className="bg-brand-700 text-white p-4 flex items-center justify-between shadow-md">
        <div>
          <h2 className="font-bold text-lg flex items-center gap-2"><Video size={20}/> Assembleia Virtual: {assembleia.titulo}</h2>
          <p className="text-brand-100 text-sm">Pauta: {assembleia.pauta}</p>
        </div>
        <button onClick={onClose} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors">Sair da Sala <X size={18}/></button>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <div className="flex-1 bg-black relative">
          <iframe 
            src={`https://meet.jit.si/AlphaCondominio-${assembleia.id}`} 
            allow="camera; microphone; fullscreen; display-capture"
            className="absolute inset-0 w-full h-full border-0"
          ></iframe>
        </div>
        <div className="w-full lg:w-96 bg-white border-l border-cream-300 flex flex-col shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-10">
          
          {/* PAINEL DE GRAVAÇÃO (Somente Adm) */}
          {isAdmin && (
            <div className="p-4 border-b border-cream-200 bg-brand-50">
              <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><Video size={16}/> Gravação Automática da Ata</h3>
              
              {!isRecording && !isTranscribing && !transcricaoPronta && (
                <button onClick={startRecording} className="btn-primary w-full justify-center bg-red-600 hover:bg-red-700 border-none">
                  Gravar Reunião com IA
                </button>
              )}

              {isRecording && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-red-600 font-bold text-sm animate-pulse">
                    <span className="w-3 h-3 bg-red-600 rounded-full"></span> Gravando Áudio...
                  </div>
                  <button onClick={stopRecording} className="btn-secondary border-red-200 text-red-700 bg-white hover:bg-red-50 w-full justify-center">
                    Parar e Gerar Ata
                  </button>
                </div>
              )}

              {isTranscribing && (
                <div className="flex flex-col items-center gap-2 py-2">
                  <div className="w-6 h-6 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
                  <p className="text-xs font-bold text-brand-700">A IA está gerando a Ata Oficial...</p>
                </div>
              )}

              {transcricaoPronta && (
                <div className="bg-emerald-100 text-emerald-800 p-3 rounded-lg border border-emerald-200 text-sm">
                  <p className="font-bold mb-1 flex items-center gap-1"><CheckCircle2 size={16}/> Ata Gerada com Sucesso!</p>
                  <p className="text-xs">A ata já está disponível no menu "Atas" para assinatura digital e impressão.</p>
                </div>
              )}
            </div>
          )}

          <div className="p-4 border-b border-cream-200 bg-gray-50 flex items-center gap-2">
            <BarChart3 className="text-brand-600" size={18}/>
            <h3 className="font-bold text-gray-800">Painel de Votação Ao Vivo</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {activeEnquetes.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-10">Nenhuma votação ativa no momento.</p>
            ) : (
              activeEnquetes.map(e => {
                const totalVotos = Object.keys(e.votos || {}).length
                const jaVotou = e.votos && e.votos[user?.id] !== undefined
                const contagem = e.opcoes.map((_, i) => Object.values(e.votos || {}).filter(v => v === i).length)

                return (
                  <div key={e.id} className="border border-cream-300 rounded-xl overflow-hidden shadow-sm">
                    <div className="p-3 bg-gray-50 border-b border-cream-200">
                      <h4 className="font-bold text-gray-800 text-sm mb-1">{e.pergunta}</h4>
                      <p className="text-xs text-gray-500 flex items-center gap-1"><Clock size={11}/> {totalVotos} votos</p>
                    </div>
                    <div className="p-3 bg-white flex flex-col gap-2">
                      {!jaVotou ? (
                        e.opcoes.map((opcao, i) => (
                          <button key={i} onClick={() => handleVotar(e, i)} className="w-full text-left p-2 rounded-lg border border-cream-200 hover:border-brand-400 hover:bg-brand-50 text-sm font-medium text-gray-700 transition-colors">
                            {opcao}
                          </button>
                        ))
                      ) : (
                        <div className="flex flex-col gap-3">
                          {e.opcoes.map((opcao, i) => {
                            const pct = totalVotos === 0 ? 0 : Math.round((contagem[i] / totalVotos) * 100)
                            const isVencedor = pct > 0 && pct === Math.max(...contagem.map((v,j) => totalVotos ? Math.round((v/totalVotos)*100) : 0))
                            return (
                              <div key={i} className="relative">
                                <div className="flex justify-between text-[11px] font-bold mb-1 px-1">
                                  <span className={isVencedor ? 'text-gray-800' : 'text-gray-500'}>{opcao} {e.votos[user.id] === i && '✓'}</span>
                                  <span className={isVencedor ? 'text-brand-600' : 'text-gray-400'}>{pct}%</span>
                                </div>
                                <div className="w-full bg-cream-100 rounded-full h-1.5"><div className={`h-1.5 rounded-full ${isVencedor ? 'bg-brand-500' : 'bg-gray-300'}`} style={{ width: `${pct}%` }} /></div>
                              </div>
                            )
                          })}
                          <p className="text-xs text-emerald-600 font-bold flex items-center justify-center gap-1 mt-1"><CheckCircle2 size={12}/> Voto registrado</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
          {isAdmin && (
            <div className="p-4 border-t border-cream-200 bg-gray-50 text-center">
              <p className="text-xs text-gray-500 mb-2">Para gerenciar enquetes, acesse o menu</p>
              <a href="/enquetes" target="_blank" rel="noreferrer" className="btn-secondary w-full justify-center text-xs">Abrir Painel de Enquetes</a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

