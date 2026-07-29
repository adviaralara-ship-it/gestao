import React, { useState } from 'react'
import { Building2, Plus, Search, Edit2, Trash2, Home, DollarSign, TrendingUp } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'

const parseBR = v => parseFloat((v||'').toString().replace(/\./g,'').replace(',','.')) || 0
const fmtBR   = v => Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})

function fmtInput(v, setter) {
  const nums = v.replace(/\D/g,'')
  if (!nums) { setter(''); return }
  const n = parseInt(nums,10)/100
  setter(n.toLocaleString('pt-BR',{minimumFractionDigits:2}))
}

function CondoModal({ data, onClose, onSave }) {
  const [form, setForm] = useState(data || { nome:'', endereco:'', unidades:'', sindico:'', cnpj:'', status:'Ativo', fundoReserva:'', fundoMeta:'' })
  const [fundoStr, setFundoStr] = useState(data?.fundoReserva ? fmtBR(data.fundoReserva) : '')
  const [metaStr,  setMetaStr]  = useState(data?.fundoMeta    ? fmtBR(data.fundoMeta)    : '')
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e=>e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">{data?'Editar Condomínio':'Novo Condomínio'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          {[['nome','Nome do Condomínio'],['endereco','Endereço Completo'],['sindico','Nome do Síndico'],['cnpj','CNPJ'],['unidades','Nº de Unidades']].map(([k,l])=>(
            <div key={k}><label className="label">{l}</label><input className="input" value={form[k]} onChange={e=>set(k,e.target.value)} placeholder={l}/></div>
          ))}
          <div><label className="label">Status</label>
            <select className="input" value={form.status} onChange={e=>set('status',e.target.value)}>
              <option>Ativo</option><option>Manutenção</option><option>Inativo</option>
            </select>
          </div>
          {/* Fundo de Reserva */}
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col gap-3">
            <p className="text-xs font-bold text-emerald-800 flex items-center gap-1.5"><DollarSign size={13}/>Fundo de Reserva</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Saldo Atual (R$)</label>
                <input className="input" value={fundoStr} inputMode="numeric" placeholder="0,00"
                  onChange={e=>fmtInput(e.target.value,setFundoStr)}/>
              </div>
              <div><label className="label">Meta Anual (R$)</label>
                <input className="input" value={metaStr} inputMode="numeric" placeholder="0,00"
                  onChange={e=>fmtInput(e.target.value,setMetaStr)}/>
              </div>
            </div>
          </div>
        </div>
        <div className="p-6 border-t border-cream-300 flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={()=>onSave({
            ...form,
            unidades:Number(form.unidades)||0,
            fundoReserva:parseBR(fundoStr),
            fundoMeta:parseBR(metaStr)
          })} className="btn-primary">Salvar</button>
        </div>
      </div>
    </div>
  )
}

export default function Condominios() {
  const { items: condos, addItem, updateItem, deleteItem } = useFirestore('condominios')
  const [search, setSearch] = useState('')
  const [modal,  setModal]  = useState(null)

  const filtered = condos.filter(c=>c.nome?.toLowerCase().includes(search.toLowerCase())||c.endereco?.toLowerCase().includes(search.toLowerCase()))

  const handleSave = async form => {
    if (modal==='new') await addItem(form)
    else await updateItem(modal.id,form)
    setModal(null)
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h2 className="section-title text-xl">Condomínios &amp; Unidades</h2>
          <p className="section-sub">{condos.length} condomínios cadastrados</p>
        </div>
        <button onClick={()=>setModal('new')} className="btn-primary"><Plus size={16}/>Novo Condomínio</button>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
        <input className="input pl-9" placeholder="Buscar condomínio..." value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>

      {filtered.length===0&&<div className="card text-center py-10 text-gray-400 text-sm">Nenhum condomínio cadastrado ainda.</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(c=>{
          const saldo = Number(c.fundoReserva||0)
          const meta  = Number(c.fundoMeta||0)
          const pct   = meta>0 ? Math.min((saldo/meta)*100,100) : 0
          return (
            <div key={c.id} className="card hover:border-brand-700/50 transition-all group flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 bg-brand-700/30 rounded-xl flex items-center justify-center"><Building2 size={18} className="text-brand-400"/></div>
                <span className={c.status==='Ativo'?'badge-green':c.status==='Manutenção'?'badge-yellow':'badge-red'}>{c.status}</span>
              </div>
              <div>
                <h3 className="font-bold text-gray-800 mb-0.5">{c.nome}</h3>
                <p className="text-xs text-gray-500">{c.endereco}</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1"><Home size={12}/>{c.unidades} unidades</span>
              </div>

              {/* Fundo de Reserva */}
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-emerald-800 flex items-center gap-1"><TrendingUp size={11}/>Fundo de Reserva</span>
                  <span className="text-xs font-black text-emerald-700">R$ {fmtBR(saldo)}</span>
                </div>
                {meta>0?(
                  <>
                    <div className="w-full bg-emerald-100 rounded-full h-1.5 overflow-hidden">
                      <div className="h-1.5 bg-emerald-500 rounded-full transition-all" style={{width:`${pct}%`}}/>
                    </div>
                    <p className="text-[10px] text-emerald-600 mt-1 text-right">{pct.toFixed(1)}% · Meta: R$ {fmtBR(meta)}</p>
                  </>
                ):(
                  <p className="text-[10px] text-emerald-600">Meta não definida</p>
                )}
              </div>

              <div className="pt-2 border-t border-cream-300 flex items-center justify-between">
                <div><p className="text-xs text-gray-500">Síndico</p><p className="text-xs font-semibold text-gray-600">{c.sindico}</p></div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={()=>setModal(c)} className="p-1.5 rounded-lg bg-cream-200 hover:bg-brand-100 text-gray-400 hover:text-brand-700 transition-all"><Edit2 size={13}/></button>
                  <button onClick={()=>deleteItem(c.id)} className="p-1.5 rounded-lg bg-cream-200 hover:bg-red-100 text-gray-400 hover:text-red-500 transition-all"><Trash2 size={13}/></button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {modal&&<CondoModal data={modal==='new'?null:modal} onClose={()=>setModal(null)} onSave={handleSave}/>}
    </div>
  )
}
