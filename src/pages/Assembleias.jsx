import React, { useState } from 'react'
import { Gavel, Plus, Trash2, Download, FileText, Search } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { notificarAdm } from '../emailjs.config'

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
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-2xl" onClick={e=>e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">Registrar Ata – {assembleia.titulo}</h3>
          <button onClick={onClose} className="text-gray-400 text-lg hover:text-gray-700">✕</button>
        </div>
        <div className="p-6">
          <label className="label">Conteúdo da Ata</label>
          <textarea className="input resize-none min-h-[200px]" value={texto} onChange={e=>setTexto(e.target.value)} placeholder="Digite o conteúdo completo da ata..."/>
        </div>
        <div className="p-6 border-t border-cream-300 flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={()=>{if(!texto)return;onSave(texto)}} className="btn-primary"><FileText size={14}/>Salvar Ata</button>
        </div>
      </div>
    </div>
  )
}

export default function Assembleias() {
  const { items: assembleias, addItem: addAssembleia, deleteItem: delAssembleia, updateItem: updAssembleia } = useFirestore('assembleias')
  const { items: atas, addItem: addAta, deleteItem: delAta } = useFirestore('atas')
  const [tab,    setTab]   = useState('assembleias')
  const [modal,  setModal] = useState(null)
  const [search, setSearch] = useState('')

  const filtAssembleias = assembleias.filter(a=>a.titulo?.toLowerCase().includes(search.toLowerCase())||a.local?.toLowerCase().includes(search.toLowerCase()))
  const filtAtas        = atas.filter(a=>a.titulo?.toLowerCase().includes(search.toLowerCase()))

  const handleNovaAssembleia = async a => {
    await addAssembleia(a)
    // Notificação no sistema
    await addDoc(collection(db,'notificacoes'),{
      text:`🏛️ Nova assembleia agendada: "${a.titulo}" em ${a.data} às ${a.hora} – ${a.local}`,
      time:new Date().toISOString(), tipo:'assembleia', lida:false, _createdAt:serverTimestamp()
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

  const handleNovaAta = async (assembleia, texto) => {
    await addAta({ titulo:assembleia.titulo, data:assembleia.data, texto })
    await updAssembleia(assembleia.id,{status:'Realizada'})
    // Notificação sistema
    await addDoc(collection(db,'notificacoes'),{
      text:`📄 Ata registrada: "${assembleia.titulo}" (${assembleia.data})`,
      time:new Date().toISOString(), tipo:'assembleia', lida:false, _createdAt:serverTimestamp()
    })
    // Email ADM
    notificarAdm(
      `📄 Ata Registrada: ${assembleia.titulo}`,
      `A ata da assembleia "${assembleia.titulo}" (${assembleia.data}) foi registrada:\n\n${texto}`
    )
    // WhatsApp
    const wppMsg = encodeURIComponent(`📄 *Ata Registrada*\n\n*${assembleia.titulo}* – ${assembleia.data}\n\n${texto.substring(0,200)}...`)
    window.open(`https://wa.me/?text=${wppMsg}`,'_blank')
    setModal(null)
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
                  <div className="flex gap-2 items-center">
                    <button onClick={()=>setModal(a)} className="btn-secondary py-1.5 text-xs"><FileText size={12}/>Registrar Ata</button>
                    <button onClick={()=>delAssembleia(a.id)} className="p-1.5 rounded-lg bg-cream-200 hover:bg-red-100 text-gray-400 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={12}/></button>
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
            : filtAtas.map(a=>(
              <div key={a.id} className="card hover:border-brand-300 transition-all group">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-gray-800 mb-1">{a.titulo}</p>
                    <p className="text-xs text-gray-500 mb-2">{a.data}</p>
                    <p className="text-sm text-gray-600 line-clamp-3">{a.texto}</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-secondary py-1.5 text-xs"><Download size={12}/>PDF</button>
                    <button onClick={()=>delAta(a.id)} className="p-1.5 rounded-lg bg-cream-200 hover:bg-red-100 text-gray-400 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={12}/></button>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}

      {modal==='new'&&<ModalAssembleia onClose={()=>setModal(null)} onSave={handleNovaAssembleia}/>}
      {modal&&modal!=='new'&&(
        <ModalAta assembleia={modal} onClose={()=>setModal(null)} onSave={texto=>handleNovaAta(modal,texto)}/>
      )}
    </div>
  )
}
