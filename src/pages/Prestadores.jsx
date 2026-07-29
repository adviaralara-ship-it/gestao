import React, { useState } from 'react'
import { Briefcase, Plus, Search, Edit2, Trash2, Star } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'


function Modal({ data, onClose, onSave }) {
  const [form, setForm] = useState(data || { nome: '', servico: '', contato: '', email: '', valor: '', avaliacao: 5, status: 'Ativo' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">{data ? 'Editar Prestador' : 'Novo Prestador'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className="label">Nome / Empresa</label><input className="input" value={form.nome} onChange={e => set('nome', e.target.value)} /></div>
          <div className="col-span-2"><label className="label">Serviço Prestado</label><input className="input" value={form.servico} onChange={e => set('servico', e.target.value)} /></div>
          <div><label className="label">Telefone</label><input className="input" value={form.contato} onChange={e => set('contato', e.target.value)} /></div>
          <div><label className="label">E-mail</label><input className="input" value={form.email} onChange={e => set('email', e.target.value)} /></div>
          <div><label className="label">Valor</label><input className="input" value={form.valor} onChange={e => set('valor', e.target.value)} /></div>
          <div><label className="label">Status</label>
            <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
              <option>Ativo</option><option>Eventual</option><option>Inativo</option>
            </select>
          </div>
        </div>
        <div className="p-6 border-t border-cream-300 flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={() => onSave(form)} className="btn-primary">Salvar</button>
        </div>
      </div>
    </div>
  )
}

export default function Prestadores() {
  const { items, addItem, updateItem, deleteItem } = useFirestore('prestadores')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)

  const filtered = items.filter(i => i.nome.toLowerCase().includes(search.toLowerCase()) || i.servico.toLowerCase().includes(search.toLowerCase()))
  const handleSave = async (form) => {
    if (modal === 'new') await addItem(form)
    else await updateItem(modal.id, form)
    setModal(null)
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="page-header">
        <div><h2 className="section-title text-xl">Prestadores de Serviços</h2><p className="section-sub">{items.length} cadastrados</p></div>
        <button onClick={() => setModal('new')} className="btn-primary"><Plus size={16} />Novo Prestador</button>
      </div>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input className="input pl-9" placeholder="Buscar prestador..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      {items.length === 0
        ? <div className="card text-center py-10 text-gray-400 text-sm">Nenhum prestador cadastrado ainda.</div>
        : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map(item => (
              <div key={item.id} className="card hover:border-brand-300 transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center border border-amber-200">
                    <Briefcase size={16} className="text-amber-500" />
                  </div>
                  <span className={item.status === 'Ativo' ? 'badge-green' : item.status === 'Eventual' ? 'badge-yellow' : 'badge-red'}>{item.status}</span>
                </div>
                <p className="font-bold text-gray-800">{item.nome}</p>
                <p className="text-sm text-gray-400 mb-1">{item.servico}</p>
                <div className="flex gap-0.5 mb-3">
                  {[1,2,3,4,5].map(s => <Star key={s} size={12} className={s <= item.avaliacao ? 'text-amber-400 fill-amber-400' : 'text-gray-300'} />)}
                </div>
                <div className="pt-3 border-t border-cream-300 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">Valor contratado</p>
                    <p className="text-sm font-bold text-emerald-600">{item.valor}</p>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setModal(item)} className="p-1.5 rounded-lg bg-cream-200 hover:bg-brand-100 text-gray-400 hover:text-brand-700 transition-all"><Edit2 size={12} /></button>
                    <button onClick={() => deleteItem(item.id)} className="p-1.5 rounded-lg bg-cream-200 hover:bg-red-100 text-gray-400 hover:text-red-500 transition-all"><Trash2 size={12} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      }
      {modal && <Modal data={modal === 'new' ? null : modal} onClose={() => setModal(null)} onSave={handleSave} />}
    </div>
  )
}
