import React, { useState } from 'react'
import { Car, Plus, Search, Edit2, Trash2, Filter, X } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'

function VeiculoModal({ data, onClose, onSave, isMorador, currentUser }) {
  const [form, setForm] = useState(data||{
    placa:'', modelo:'', cor:'', vaga:'',
    morador: isMorador ? currentUser.nome : '',
    apt: isMorador ? currentUser.unidade : '',
    condominio: isMorador ? currentUser.condominio : ''
  })
  
  const set = (k,v) => setForm(f=>({...f,[k]:v}))
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-lg" onClick={e=>e.stopPropagation()}>
        <div className="p-4 sm:p-6 border-b border-cream-300 flex items-center justify-between gap-3">
          <h3 className="font-bold text-gray-800 text-base sm:text-lg min-w-0 flex-1 truncate">{data?'Editar Veículo':'Novo Veículo'}</h3>
          <button onClick={onClose} className="modal-close-btn" title="Fechar"><X size={20} strokeWidth={2.5} /></button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div><label className="label">Placa</label><input className="input uppercase" placeholder="ABC-1234" value={form.placa} onChange={e=>set('placa',e.target.value.toUpperCase())}/></div>
          <div><label className="label">Modelo</label><input className="input" placeholder="Ex: Honda Civic" value={form.modelo} onChange={e=>set('modelo',e.target.value)}/></div>
          <div><label className="label">Cor</label><input className="input" placeholder="Ex: Prata" value={form.cor} onChange={e=>set('cor',e.target.value)}/></div>
          <div><label className="label">Vaga</label><input className="input" placeholder="Ex: 12A" value={form.vaga} onChange={e=>set('vaga',e.target.value)}/></div>
          
          <div className="col-span-2 border-t border-cream-200 mt-2 pt-4">
            <h4 className="text-sm font-bold text-gray-700 mb-3">Dados do Proprietário</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><label className="label">Nome do Morador</label><input className="input" value={form.morador} onChange={e=>set('morador',e.target.value)} disabled={isMorador}/></div>
              <div><label className="label">Condomínio</label><input className="input" value={form.condominio} onChange={e=>set('condominio',e.target.value)} disabled={isMorador}/></div>
              <div><label className="label">Apartamento</label><input className="input" value={form.apt} onChange={e=>set('apt',e.target.value)} disabled={isMorador}/></div>
            </div>
          </div>
        </div>
        <div className="p-6 border-t border-cream-300 flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={()=>onSave(form)} className="btn-primary">Salvar</button>
        </div>
      </div>
    </div>
  )
}

export default function Veiculos() {
  const { user } = useAuth()
  const { items, addItem, updateItem, deleteItem } = useFirestore('veiculos')
  const { items: condominios } = useFirestore('condominios')
  const isMorador = user?.role === 'Morador'
  
  const [condoFiltro, setCondoFiltro] = useState(isMorador ? user?.condominio : 'Todos')
  const [search, setSearch] = useState('')
  const [modal, setModal]   = useState(null)
  
  const filtered = items.filter(v => {
    if (isMorador && (v.condominio !== user.condominio || v.apt !== user.unidade)) return false
    if (!isMorador && condoFiltro !== 'Todos' && v.condominio !== condoFiltro) return false
    
    if (!search) return true
    const s = search.toLowerCase()
    return v.placa?.toLowerCase().includes(s) || 
           v.modelo?.toLowerCase().includes(s) || 
           v.apt?.toLowerCase().includes(s) ||
           v.morador?.toLowerCase().includes(s)
  })

  const handleSave = async form => {
    if (modal==='new') await addItem({ ...form, condominio: form.condominio || (condoFiltro !== 'Todos' ? condoFiltro : user?.condominio || '') })
    else await updateItem(modal.id, form)
    setModal(null)
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="section-title text-xl">Veículos e Garagem</h2>
          <p className="section-sub">{isMorador ? 'Gerencie os veículos da sua unidade' : `${filtered.length} veículos cadastrados`}</p>
        </div>
        <div className="flex items-center gap-3">
          {!isMorador && (
            <select
              className="input py-2 text-xs font-bold text-gray-800 bg-white border-gray-300 rounded-xl"
              value={condoFiltro}
              onChange={e => setCondoFiltro(e.target.value)}
            >
              <option value="Todos">🏢 Todos os Condomínios</option>
              {condominios.map(c => (
                <option key={c.id || c.nome} value={c.nome}>{c.nome}</option>
              ))}
            </select>
          )}
          <button onClick={()=>setModal('new')} className="btn-primary"><Plus size={16}/>Novo Veículo</button>
        </div>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
        <input className="input pl-9 uppercase" placeholder="Buscar por placa, apto ou modelo..." value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>

      {items.length===0 ? (
        <div className="card text-center py-10 text-gray-400 text-sm">Nenhum veículo cadastrado.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(v => (
            <div key={v.id} className="card hover:border-brand-300 transition-colors relative group">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                  <Car size={24}/>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h3 className="font-black text-lg text-slate-800 tracking-wider uppercase">{v.placa}</h3>
                  </div>
                  <p className="text-sm font-semibold text-brand-700">{v.modelo} <span className="text-gray-400 font-normal">· {v.cor}</span></p>
                  
                  <div className="mt-3 pt-3 border-t border-cream-200">
                    <p className="text-sm font-medium text-gray-800">{v.morador}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span>🏢 {v.condominio}</span>
                      <span>🏠 Apt {v.apt}</span>
                      {v.vaga && <span className="badge-blue bg-blue-50 text-blue-700 ml-auto border border-blue-200">Vaga {v.vaga}</span>}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={()=>setModal(v)} className="p-1.5 rounded-lg bg-cream-100 hover:bg-brand-100 text-gray-400 hover:text-brand-600 transition-all"><Edit2 size={12}/></button>
                <button onClick={()=>deleteItem(v.id)} className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 transition-all"><Trash2 size={12}/></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && <VeiculoModal data={modal==='new'?null:modal} onClose={()=>setModal(null)} onSave={handleSave} isMorador={isMorador} currentUser={user} />}
    </div>
  )
}
