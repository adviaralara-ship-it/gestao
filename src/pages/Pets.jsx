import React, { useState } from 'react'
import { Plus, Search, Filter, PawPrint } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'

function PetModal({ data, onClose, onSave, isMorador, currentUser }) {
  const [form, setForm] = useState(data||{
    nome:'', tipo:'Cachorro', raca:'', porte:'Médio',
    condominio: isMorador ? currentUser.condominio : '',
    apt: isMorador ? currentUser.unidade : '',
    bloco: isMorador ? currentUser.bloco : '',
    dono: isMorador ? currentUser.nome : '',
    foto: ''
  })
  const set = (k,v) => setForm(f=>({...f,[k]:v}))
  
  const handleImage = (e) => {
    const file = e.target.files[0]
    if(!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_WIDTH = 400
        const scaleSize = MAX_WIDTH / img.width
        canvas.width = MAX_WIDTH
        canvas.height = img.height * scaleSize
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const base64 = canvas.toDataURL('image/jpeg', 0.8)
        set('foto', base64)
      }
      img.src = event.target.result
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e=>e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">{data?'Editar Pet':'Novo Pet'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className="label">Nome do Pet</label><input className="input" value={form.nome} onChange={e=>set('nome',e.target.value)}/></div>
          
          <div><label className="label">Tipo</label>
            <select className="input" value={form.tipo} onChange={e=>set('tipo',e.target.value)}>
              <option>Cachorro</option><option>Gato</option><option>Pássaro</option><option>Outro</option>
            </select>
          </div>
          <div><label className="label">Porte</label>
            <select className="input" value={form.porte} onChange={e=>set('porte',e.target.value)}>
              <option>Pequeno</option><option>Médio</option><option>Grande</option>
            </select>
          </div>
          
          <div className="col-span-2"><label className="label">Raça / Cor</label><input className="input" value={form.raca} onChange={e=>set('raca',e.target.value)}/></div>

          {!isMorador && (
            <>
              <div className="col-span-2"><label className="label">Dono Responsável</label><input className="input" value={form.dono} onChange={e=>set('dono',e.target.value)}/></div>
              <div><label className="label">Condomínio</label><input className="input" value={form.condominio} onChange={e=>set('condominio',e.target.value)}/></div>
              <div><label className="label">Apartamento / Bloco</label><input className="input" value={`${form.apt} ${form.bloco}`.trim()} onChange={e=>set('apt',e.target.value)}/></div>
            </>
          )}

          <div className="col-span-2 border-t border-cream-200 mt-2 pt-4">
            <label className="label text-brand-700">Foto do Pet</label>
            <p className="text-xs text-gray-500 mb-3">Tire uma foto para ajudar na identificação caso o pet escape.</p>
            {form.foto ? (
              <div className="flex items-center gap-4">
                <img src={form.foto} alt="Pet" className="w-24 h-24 object-cover rounded-xl border border-brand-200 shadow-md" />
                <button onClick={()=>set('foto','')} className="btn-secondary text-red-500 hover:text-red-600 text-xs py-1 px-3">Remover Foto</button>
              </div>
            ) : (
              <input type="file" accept="image/*" onChange={handleImage} className="input text-sm file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100" />
            )}
          </div>
        </div>
        <div className="p-6 border-t border-cream-300 flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={()=>onSave(form)} className="btn-primary">Salvar Pet</button>
        </div>
      </div>
    </div>
  )
}

export default function Pets() {
  const { items: pets, addItem, updateItem, deleteItem } = useFirestore('pets')
  const { user } = useAuth()
  const isMorador = user?.role === 'Morador'
  
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)

  const filtered = pets.filter(p=>{
    if (isMorador) {
       return p.condominio === user.condominio && p.apt === user.unidade && p.bloco === user.bloco
    }
    return p.nome?.toLowerCase().includes(search.toLowerCase()) || p.dono?.toLowerCase().includes(search.toLowerCase()) || p.apt?.includes(search)
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
          <h2 className="section-title text-xl flex items-center gap-2"><PawPrint size={22} className="text-brand-600"/> Meus Pets</h2>
          <p className="section-sub">{isMorador ? 'Cadastre seus pets para controle da portaria' : `${pets.length} pets cadastrados`}</p>
        </div>
        <button onClick={()=>setModal('new')} className="btn-primary"><Plus size={16}/>{isMorador ? 'Adicionar Pet' : 'Novo Pet'}</button>
      </div>

      {!isMorador && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
            <input className="input pl-9" placeholder="Buscar por nome, dono ou apartamento..." value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <PawPrint size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 font-semibold mb-2">Nenhum pet cadastrado.</p>
          <p className="text-sm text-gray-400">Clique em "Adicionar Pet" para começar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p=>(
            <div key={p.id} className="card p-0 overflow-hidden flex flex-col group border border-cream-200 shadow-sm hover:shadow-md transition-all">
              <div className="p-4 flex gap-4">
                <div className="w-20 h-20 bg-cream-100 rounded-xl overflow-hidden shrink-0 flex items-center justify-center">
                  {p.foto ? <img src={p.foto} alt={p.nome} className="w-full h-full object-cover"/> : <PawPrint size={32} className="text-gray-300"/>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-gray-800 truncate text-lg">{p.nome}</h3>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={()=>setModal(p)} className="p-1.5 text-gray-400 hover:text-brand-600 rounded-lg hover:bg-brand-50"><Filter size={14}/></button>
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-brand-600 mt-0.5">{p.tipo} • {p.porte}</p>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-1 truncate" title={p.raca}>{p.raca || 'Sem raça definida'}</p>
                </div>
              </div>
              <div className="bg-gray-50/50 p-3 px-4 border-t border-cream-100 text-xs text-gray-600 flex justify-between items-center">
                <span className="font-semibold text-gray-700">Dono: {p.dono || 'Não informado'}</span>
                {!isMorador && <span className="text-[10px] bg-white border border-gray-200 px-2 py-0.5 rounded-full">Apt {p.apt} {p.bloco}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && <PetModal data={modal==='new'?null:modal} onClose={()=>setModal(null)} onSave={handleSave} isMorador={isMorador} currentUser={user}/>}
    </div>
  )
}
