import React, { useState } from 'react'
import { Plus, Trash2, Mail, Phone, Calendar, Video, Clock } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'

const COLUMNS = [
  { id: 'novos', title: 'Novos Currículos', color: 'border-blue-500', bg: 'bg-blue-50' },
  { id: 'analise', title: 'Em Análise', color: 'border-yellow-500', bg: 'bg-yellow-50' },
  { id: 'entrevista', title: 'Entrevista', color: 'border-purple-500', bg: 'bg-purple-50' },
  { id: 'aprovados', title: 'Aprovados', color: 'border-green-500', bg: 'bg-green-50' },
  { id: 'reprovados', title: 'Reprovados', color: 'border-red-500', bg: 'bg-red-50' }
]

function CandidateModal({ data, onClose, onSave }) {
  const [form, setForm] = useState(data || { 
    nome: '', vaga: '', telefone: '', email: '', status: 'novos'
  })

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300">
          <h3 className="font-bold text-gray-800">{data ? 'Editar Candidato' : 'Novo Candidato'}</h3>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase">Nome do Candidato</label>
            <input className="input mt-1" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase">Vaga de Interesse</label>
            <input className="input mt-1" value={form.vaga} onChange={e => setForm({...form, vaga: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Telefone</label>
              <input className="input mt-1" value={form.telefone} onChange={e => setForm({...form, telefone: e.target.value})} />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">E-mail</label>
              <input className="input mt-1" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
            </div>
          </div>
        </div>
        <div className="p-6 border-t border-cream-300 flex justify-end gap-3 bg-cream-50 rounded-b-2xl">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={() => { onSave(form); onClose() }} className="btn-primary">Salvar</button>
        </div>
      </div>
    </div>
  )
}

export default function Recrutamento() {
  const { items: candidatos, addItem, updateItem, deleteItem } = useFirestore('recrutamento')
  const [modal, setModal] = useState(null)
  const [dragging, setDragging] = useState(null)

  const handleDragStart = (e, candidato) => {
    setDragging(candidato)
    e.dataTransfer.setData('text/plain', candidato.id)
  }

  const handleDragOver = (e) => {
    e.preventDefault() // Necessary to allow dropping
  }

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault()
    if (!dragging) return
    if (dragging.status !== targetStatus) {
      await updateItem(dragging.id, { status: targetStatus })
    }
    setDragging(null)
  }

  const handleSave = async (form) => {
    if (modal === 'new') await addItem(form)
    else await updateItem(modal.id, form)
  }

  return (
    <div className="flex flex-col h-full min-h-[85vh] animate-fade-in gap-6">
      <div className="page-header shrink-0">
        <div>
          <h2 className="section-title text-xl">Recrutamento</h2>
          <p className="section-sub">Acompanhe seus candidatos no funil de contratação.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => window.open('/conferencias', '_blank')} className="btn-secondary border-brand-200 text-brand-600 hover:bg-brand-50">
            <Video size={16} /> Sala de Entrevista
          </button>
          <button onClick={() => setModal('new')} className="btn-primary">
            <Plus size={16} /> Adicionar Candidato
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max h-full">
          {COLUMNS.map(col => {
            const columnCandidates = candidatos.filter(c => c.status === col.id)
            return (
              <div 
                key={col.id}
                className={`w-[300px] flex flex-col bg-white rounded-2xl border-t-4 shadow-sm ${col.color}`}
                onDragOver={handleDragOver}
                onDrop={e => handleDrop(e, col.id)}
              >
                <div className={`p-4 border-b border-cream-200 ${col.bg} rounded-t-xl flex items-center justify-between`}>
                  <h3 className="font-bold text-gray-800">{col.title}</h3>
                  <span className="bg-white text-xs font-bold px-2 py-1 rounded-full shadow-sm text-gray-600">
                    {columnCandidates.length}
                  </span>
                </div>
                
                <div className="p-3 flex-1 overflow-y-auto space-y-3 min-h-[200px] bg-gray-50/50">
                  {columnCandidates.map(c => (
                    <div 
                      key={c.id} 
                      draggable
                      onDragStart={e => handleDragStart(e, c)}
                      className="bg-white border border-cream-300 p-4 rounded-xl shadow-sm cursor-grab active:cursor-grabbing hover:border-brand-300 transition-colors group relative"
                    >
                      <button 
                        onClick={() => deleteItem(c.id)}
                        className="absolute top-3 right-3 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remover"
                      >
                        <Trash2 size={14} />
                      </button>
                      <h4 className="font-bold text-gray-800 pr-6">{c.nome}</h4>
                      <p className="text-xs font-medium text-brand-600 mb-3">{c.vaga}</p>
                      
                      <div className="space-y-1.5">
                        {c.telefone && (
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Phone size={12} /> {c.telefone}
                          </div>
                        )}
                        {c.email && (
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Mail size={12} /> <span className="truncate">{c.email}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="mt-4 pt-3 border-t border-cream-100">
                        <button onClick={() => setModal(c)} className="text-xs text-gray-400 hover:text-brand-600 font-medium">
                          Editar informações
                        </button>
                      </div>
                    </div>
                  ))}
                  {columnCandidates.length === 0 && (
                    <div className="h-24 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-xs font-medium text-gray-400">
                      Arraste para cá
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {modal && <CandidateModal data={modal === 'new' ? null : modal} onClose={() => setModal(null)} onSave={handleSave} />}
    </div>
  )
}
