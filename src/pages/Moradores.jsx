import React, { useState } from 'react'
import { Users, Plus, Search, Edit2, Trash2, Phone, Mail, Filter } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'

function MoradorModal({ data, onClose, onSave, isMorador, currentUser }) {
  const [form, setForm] = useState(data||{
    nome:'',cpf:'',
    apt: isMorador ? currentUser.unidade : '',
    bloco: isMorador ? currentUser.bloco : '',
    tel:'',email:'',
    status: isMorador ? 'Dependente' : 'Proprietário',
    condominio: isMorador ? currentUser.condominio : '',
    fotoRosto: ''
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
        const MAX_WIDTH = 600
        const scaleSize = MAX_WIDTH / img.width
        canvas.width = MAX_WIDTH
        canvas.height = img.height * scaleSize
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const base64 = canvas.toDataURL('image/jpeg', 0.8)
        set('fotoRosto', base64)
      }
      img.src = event.target.result
    }
    reader.readAsDataURL(file)
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e=>e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">{data?'Editar Morador':'Novo Morador'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className="label">Nome Completo</label><input className="input" value={form.nome} onChange={e=>set('nome',e.target.value)}/></div>
          <div><label className="label">CPF (Apenas números)</label><input className="input" value={form.cpf||''} onChange={e=>set('cpf',e.target.value.replace(/\\D/g,'').slice(0,11))} placeholder="00000000000"/></div>
          <div><label className="label">Condomínio</label><input className="input" value={form.condominio} onChange={e=>set('condominio',e.target.value)} disabled={isMorador}/></div>
          <div><label className="label">Apartamento</label><input className="input" value={form.apt} onChange={e=>set('apt',e.target.value)} disabled={isMorador}/></div>
          <div><label className="label">Bloco</label><input className="input" value={form.bloco} onChange={e=>set('bloco',e.target.value)} disabled={isMorador}/></div>
          <div><label className="label">Telefone</label><input className="input" value={form.tel} onChange={e=>set('tel',e.target.value)}/></div>
          <div><label className="label">E-mail</label><input className="input" value={form.email} onChange={e=>set('email',e.target.value)}/></div>
          <div className="col-span-2"><label className="label">Status</label>
            <select className="input" value={form.status} onChange={e=>set('status',e.target.value)} disabled={isMorador && form.status==='Proprietário'}>
              {isMorador ? (
                <>
                  {form.status === 'Proprietário' && <option>Proprietário</option>}
                  <option>Dependente</option>
                  <option>Inquilino</option>
                </>
              ) : (
                <><option>Proprietário</option><option>Inquilino</option><option>Dependente</option></>
              )}
            </select>
          </div>
          
          <div className="col-span-2 border-t border-cream-200 mt-2 pt-4">
            <label className="label text-brand-700">Reconhecimento Facial (Portaria)</label>
            <p className="text-xs text-gray-500 mb-3">Tire uma selfie bem iluminada do rosto para liberar o acesso facial na catraca.</p>
            {form.fotoRosto ? (
              <div className="flex items-center gap-4">
                <img src={form.fotoRosto} alt="Rosto" className="w-24 h-24 object-cover rounded-full border-4 border-brand-200 shadow-md" />
                <button onClick={()=>set('fotoRosto','')} className="btn-secondary text-red-500 hover:text-red-600 text-xs py-1 px-3">Remover Foto</button>
              </div>
            ) : (
              <input type="file" accept="image/*" capture="user" onChange={handleImage} className="input text-sm file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100" />
            )}
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

export default function Moradores() {
  const { items: moradores, addItem, updateItem, deleteItem } = useFirestore('moradores')
  const { user } = useAuth()
  const isMorador = user?.role === 'Morador'
  
  const [search,       setSearch]       = useState('')
  const [filtroCondominio, setFiltroCondominio] = useState('Todos')
  const [filtroApt, setFiltroApt] = useState('Todos')
  const [modal,        setModal]        = useState(null)

  // Lista de condomínios únicos para o filtro
  const condominiosUnicos = ['Todos', ...Array.from(new Set(moradores.map(m=>m.condominio).filter(Boolean))).sort()]
  const aptsUnicos = ['Todos', ...Array.from(new Set(moradores.filter(m => filtroCondominio === 'Todos' || m.condominio === filtroCondominio).map(m=>m.apt).filter(Boolean))).sort((a,b) => a.localeCompare(b, undefined, {numeric: true}))]

  const filtered = moradores.filter(m=>{
    if (isMorador) {
       return m.condominio === user.condominio && m.bloco === user.bloco && m.apt === user.unidade
    }
    const okSearch = m.nome?.toLowerCase().includes(search.toLowerCase())||m.apt?.includes(search)||m.email?.includes(search)
    const okCondo  = filtroCondominio==='Todos'||m.condominio===filtroCondominio
    const okApt    = filtroApt==='Todos'||m.apt===filtroApt
    return okSearch&&okCondo&&okApt
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
          <h2 className="section-title text-xl">{isMorador ? 'Minha Unidade' : 'Moradores'}</h2>
          <p className="section-sub">{isMorador ? 'Gerencie os membros da sua família' : `${moradores.length} moradores cadastrados`}</p>
        </div>
        <button onClick={()=>setModal('new')} className="btn-primary"><Plus size={16}/>{isMorador ? 'Adicionar Familiar' : 'Novo Morador'}</button>
      </div>

      {/* Filtros */}
      {!isMorador && (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
              <input className="input pl-9" placeholder="Buscar por nome, apt ou email..." value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            <div className="relative sm:w-64">
              <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
              <select className="input pl-9" value={filtroCondominio} onChange={e=>{setFiltroCondominio(e.target.value); setFiltroApt('Todos')}}>
                {condominiosUnicos.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="relative sm:w-48">
              <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
              <select className="input pl-9" value={filtroApt} onChange={e=>setFiltroApt(e.target.value)}>
                {aptsUnicos.map(a=><option key={a} value={a}>{a==='Todos'?'Todos os Aptos':`Apt ${a}`}</option>)}
              </select>
            </div>
          </div>

          {/* Estatísticas rápidas por condomínio */}
          {filtroCondominio==='Todos'&&condominiosUnicos.length>1&&(
            <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
              {condominiosUnicos.filter(c=>c!=='Todos').map(c=>(
                <button key={c} onClick={()=>setFiltroCondominio(c)}
                  className="px-3 py-1.5 bg-white border border-cream-400 rounded-xl text-xs font-medium text-gray-600 hover:border-brand-400 hover:text-brand-700 whitespace-nowrap transition-all shrink-0">
                  🏢 {c} <span className="ml-1 text-brand-600 font-bold">({moradores.filter(m=>m.condominio===c).length})</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {moradores.length===0
        ? <div className="card text-center py-10 text-gray-400 text-sm">Nenhum morador cadastrado ainda.</div>
        : (
          <div className="card p-0 overflow-hidden">
            <div className="p-3 border-b border-cream-200 bg-cream-50 flex items-center justify-between">
              <p className="text-xs text-gray-500">{filtered.length} morador(es) {filtroCondominio!=='Todos'?`em "${filtroCondominio}"`:''}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-cream-100 border-b border-cream-400">
                  <tr>{['Morador','Condomínio','Unidade','Contato','Status','Ações'].map(h=><th key={h} className="table-head">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {filtered.length===0
                    ? <tr><td colSpan={6} className="text-center py-8 text-gray-400 text-sm">Nenhum morador encontrado com os filtros selecionados.</td></tr>
                    : filtered.map(m=>(
                      <tr key={m.id} className="table-row">
                        <td className="table-cell">
                          <div className="flex items-center gap-3">
                            {m.fotoRosto ? (
                              <img src={m.fotoRosto} alt="Foto" className="w-8 h-8 rounded-full object-cover shadow-sm border border-brand-200" onClick={()=>window.open(m.fotoRosto,'_blank')} title="Ver foto em tamanho real" style={{cursor: 'pointer'}} />
                            ) : (
                              <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 text-sm font-bold">{m.nome?.[0]||'?'}</div>
                            )}
                            <div>
                              <p className="font-semibold text-gray-800 text-sm">{m.nome}</p>
                              <p className="text-xs text-gray-500">{m.cpf}</p>
                            </div>
                          </div>
                        </td>
                        <td className="table-cell"><p className="text-xs font-medium text-gray-700">{m.condominio||'—'}</p></td>
                        <td className="table-cell"><p className="font-semibold text-gray-800">Apt {m.apt} {m.bloco?`– Bl. ${m.bloco}`:''}</p></td>
                        <td className="table-cell">
                          <p className="flex items-center gap-1 text-xs"><Phone size={10} className="text-gray-500"/>{m.tel||'—'}</p>
                          <p className="flex items-center gap-1 text-xs text-gray-400"><Mail size={10} className="text-gray-500"/>{m.email||'—'}</p>
                        </td>
                        <td className="table-cell"><span className={m.status==='Proprietário'?'badge-blue':'badge-purple'}>{m.status}</span></td>
                        <td className="table-cell">
                          <div className="flex gap-2">
                            {(!isMorador || m.status !== 'Proprietário') && (
                              <>
                                <button onClick={()=>setModal(m)} className="p-1.5 rounded-lg bg-cream-200 hover:bg-brand-100 text-gray-400 hover:text-brand-700 transition-all"><Edit2 size={12}/></button>
                                <button onClick={()=>deleteItem(m.id)} className="p-1.5 rounded-lg bg-cream-200 hover:bg-red-100 text-gray-400 hover:text-red-500 transition-all"><Trash2 size={12}/></button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      }
      {modal&&<MoradorModal data={modal==='new'?null:modal} onClose={()=>setModal(null)} onSave={handleSave} isMorador={isMorador} currentUser={user} />}
    </div>
  )
}
