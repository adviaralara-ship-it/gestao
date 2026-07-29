import React, { useState } from 'react'
import { Video, Plus, Edit2, Trash2, ExternalLink } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'

function CameraModal({ data, onClose, onSave, currentUser }) {
  const [form, setForm] = useState(data||{
    nome:'', link:'', appExterno:'', condominio: currentUser?.condominio || ''
  })
  const set = (k,v) => setForm(f=>({...f,[k]:v}))
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e=>e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">{data?'Editar Câmera':'Nova Câmera'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <p className="text-xs text-gray-500 mb-2">Para câmeras web, cole o link no formato Iframe/WebRTC. Para DVRs antigos, cole o link do aplicativo da App Store (ex: Intelbras iSIC).</p>
          <div><label className="label">Nome da Câmera / Área</label><input className="input" placeholder="Ex: Portaria Principal" value={form.nome} onChange={e=>set('nome',e.target.value)}/></div>
          <div><label className="label">Condomínio</label><input className="input" value={form.condominio} onChange={e=>set('condominio',e.target.value)} disabled={currentUser?.role==='Morador'}/></div>
          <div><label className="label">Link Web (Deixe em branco se não houver)</label><input className="input" placeholder="https://..." value={form.link} onChange={e=>set('link',e.target.value)}/></div>
          <div><label className="label">Link do App Externo (Android/iOS)</label><input className="input" placeholder="https://..." value={form.appExterno} onChange={e=>set('appExterno',e.target.value)}/></div>
        </div>
        <div className="p-6 border-t border-cream-300 flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={()=>onSave(form)} className="btn-primary">Salvar</button>
        </div>
      </div>
    </div>
  )
}

export default function Cameras() {
  const { user } = useAuth()
  const { items, addItem, updateItem, deleteItem } = useFirestore('cameras')
  const isMorador = user?.role === 'Morador'
  
  const [modal, setModal] = useState(null)
  
  const filtered = items.filter(c => {
    if (isMorador && c.condominio !== user.condominio) return false
    return true
  })

  const handleSave = async form => {
    if (modal==='new') await addItem(form)
    else await updateItem(modal.id,form)
    setModal(null)
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h2 className="section-title text-xl">Monitoramento e Câmeras</h2>
          <p className="section-sub">{isMorador ? 'Acesse as câmeras do seu condomínio' : `Gerenciamento de streams de CFTV`}</p>
        </div>
        {!isMorador && <button onClick={()=>setModal('new')} className="btn-primary"><Plus size={16}/>Nova Câmera</button>}
      </div>

      {filtered.length===0 ? (
        <div className="card text-center py-12 text-gray-400 text-sm">Nenhuma câmera configurada para este condomínio.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(c => (
            <div key={c.id} className="card p-0 overflow-hidden group">
              <div className="bg-slate-900 aspect-video relative flex items-center justify-center">
                {c.link ? (
                  <iframe src={c.link} className="w-full h-full border-0" allowFullScreen title={c.nome}></iframe>
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-500 p-6 text-center">
                    <Video size={48} className="mb-4 opacity-50" />
                    <p className="text-sm font-medium text-slate-300">Câmera Externa (DVR)</p>
                    {c.appExterno && (
                      <a href={c.appExterno} target="_blank" rel="noopener noreferrer" className="mt-4 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-bold transition-all flex items-center gap-2">
                        Abrir App da Câmera <ExternalLink size={14}/>
                      </a>
                    )}
                  </div>
                )}
                
                {!isMorador && (
                  <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={()=>setModal(c)} className="p-1.5 rounded-lg bg-black/50 hover:bg-white/20 text-white transition-all backdrop-blur-sm"><Edit2 size={12}/></button>
                    <button onClick={()=>deleteItem(c.id)} className="p-1.5 rounded-lg bg-red-500/80 hover:bg-red-500 text-white transition-all backdrop-blur-sm"><Trash2 size={12}/></button>
                  </div>
                )}
              </div>
              <div className="p-4 bg-white border-t border-cream-200">
                <h3 className="font-bold text-gray-800">{c.nome}</h3>
                <p className="text-xs text-gray-500">🏢 {c.condominio}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && <CameraModal data={modal==='new'?null:modal} onClose={()=>setModal(null)} onSave={handleSave} currentUser={user} />}
    </div>
  )
}
