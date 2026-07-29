import React, { useState } from 'react'
import { UserCog, Plus, Search, Edit2, Trash2, Briefcase } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'


function ColabModal({ data, onClose, onSave }) {
  const [form, setForm] = useState(data || { nome: '', cargo: '', dept: '', salario: '', admissao: '', status: 'Ativo' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">{data ? 'Editar Colaborador' : 'Novo Colaborador'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className="label">Nome Completo</label><input className="input" value={form.nome} onChange={e => set('nome', e.target.value)} /></div>
          <div><label className="label">Cargo</label><input className="input" value={form.cargo} onChange={e => set('cargo', e.target.value)} /></div>
          <div><label className="label">Departamento</label><input className="input" value={form.dept} onChange={e => set('dept', e.target.value)} /></div>
          <div><label className="label">Salário</label><input className="input" value={form.salario} onChange={e => set('salario', e.target.value)} /></div>
          <div><label className="label">Data Admissão</label><input type="date" className="input" value={form.admissao} onChange={e => set('admissao', e.target.value)} /></div>
          <div className="col-span-2"><label className="label">Status</label>
            <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
              <option>Ativo</option><option>Férias</option><option>Afastado</option><option>Inativo</option>
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

export default function RH() {
  const { items: colabs, addItem, updateItem, deleteItem } = useFirestore('rh')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)

  const filtered = colabs.filter(c => c.nome.toLowerCase().includes(search.toLowerCase()) || c.cargo.toLowerCase().includes(search.toLowerCase()))

  const handleSave = async (form) => {
    if (modal === 'new') await addItem(form)
    else await updateItem(modal.id, form)
    setModal(null)
  }

  const statusBadge = (s) => ({ Ativo: 'badge-green', Férias: 'badge-yellow', Afastado: 'badge-red', Inativo: 'badge-red' }[s] || 'badge-blue')

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h2 className="section-title text-xl">Recursos Humanos</h2>
          <p className="section-sub">{colabs.length} colaboradores ativos</p>
        </div>
        <button onClick={() => setModal('new')} className="btn-primary"><Plus size={16} />Novo Colaborador</button>
      </div>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input className="input pl-9" placeholder="Buscar colaborador..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      {colabs.length === 0 && <div className="card text-center py-10 text-gray-400 text-sm">Nenhum colaborador cadastrado ainda.</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(c => (
          <div key={c.id} className="card hover:border-brand-700/50 transition-all group">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 bg-emerald-700/20 rounded-xl flex items-center justify-center border border-emerald-700/30">
                <span className="text-emerald-400 font-bold">{c.nome[0]}</span>
              </div>
              <span className={statusBadge(c.status)}>{c.status}</span>
            </div>
            <p className="font-bold text-gray-800">{c.nome}</p>
            <p className="text-sm text-brand-500 font-medium">{c.cargo}</p>
            <p className="text-xs text-gray-500 mb-3">{c.dept}</p>
            <div className="pt-3 border-t border-cream-300 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Salário</p>
                <p className="text-sm font-bold text-emerald-600">{c.salario}</p>
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => setModal(c)} className="p-1.5 rounded-lg bg-cream-200 hover:bg-brand-100 text-gray-400 hover:text-brand-700 transition-all"><Edit2 size={12} /></button>
                <button onClick={() => deleteItem(c.id)} className="p-1.5 rounded-lg bg-cream-200 hover:bg-red-100 text-gray-400 hover:text-red-500 transition-all"><Trash2 size={12} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {modal && <ColabModal data={modal === 'new' ? null : modal} onClose={() => setModal(null)} onSave={handleSave} />}
    </div>
  )
}
