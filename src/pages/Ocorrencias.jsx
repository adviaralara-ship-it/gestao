import React, { useState } from 'react'
import { AlertTriangle, Plus, Search, Edit2, Trash2, DollarSign, X } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { notificarAdm } from '../emailjs.config'
import { useAuth } from '../context/AuthContext'

function Modal({ data, user, onClose, onSave }) {
  const [form, setForm] = useState(data||{titulo:'',descricao:'',apt:user?.apt||'',condominio:user?.condominio||'',hora:'',categoria:'Perturbação',status:'Aberta',prioridade:'Média',visibilidade:'Público',infracao:false, foto:''})
  const set = (k,v) => setForm(f=>({...f,[k]:v}))
  
  const handleImage = (e) => {
    const file = e.target.files[0]
    if(!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_WIDTH = 800
        const scaleSize = MAX_WIDTH / img.width
        canvas.width = MAX_WIDTH
        canvas.height = img.height * scaleSize
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const base64 = canvas.toDataURL('image/jpeg', 0.6)
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
          <h3 className="font-bold text-gray-800">{data?'Editar Ocorrência':'Nova Ocorrência'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div><label className="label">Título</label><input className="input" value={form.titulo} onChange={e=>set('titulo',e.target.value)}/></div>
          <div><label className="label">Descrição</label><textarea className="input resize-none min-h-[80px]" value={form.descricao} onChange={e=>set('descricao',e.target.value)}/></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Apartamento</label><input className="input" value={form.apt} onChange={e=>set('apt',e.target.value)}/></div>
            <div><label className="label">Condomínio</label><input className="input" value={form.condominio} onChange={e=>set('condominio',e.target.value)} disabled={user?.role==='Morador'}/></div>
            <div><label className="label">Categoria</label>
              <select className="input" value={form.categoria} onChange={e=>set('categoria',e.target.value)}>
                {['Perturbação','Manutenção','Conduta','Estacionamento','Segurança','Outros'].map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div><label className="label">Prioridade</label>
              <select className="input" value={form.prioridade} onChange={e=>set('prioridade',e.target.value)}>
                <option>Alta</option><option>Média</option><option>Baixa</option>
              </select>
            </div>
            <div><label className="label">Status</label>
              <select className="input" value={form.status} onChange={e=>set('status',e.target.value)}>
                <option>Aberta</option><option>Em Andamento</option><option>Resolvida</option>
              </select>
            </div>
            <div><label className="label">Visibilidade</label>
              <select className="input" value={form.visibilidade || 'Público'} onChange={e=>set('visibilidade',e.target.value)}>
                <option>Público</option><option>Apenas Adm</option>
              </select>
            </div>
            <div className="col-span-2 mt-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                <input type="checkbox" checked={form.infracao || false} onChange={e=>set('infracao',e.target.checked)} className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500" />
                Classificar como Infração (Regras do Condomínio)
              </label>
            </div>
            <div className="col-span-2">
              <label className="label">Anexar Foto / Evidência</label>
              {form.foto ? (
                <div className="relative w-32 h-32 rounded-lg border border-cream-300 overflow-hidden group">
                  <img src={form.foto} alt="Evidência" className="w-full h-full object-cover" />
                  <button onClick={()=>set('foto','')} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all"><X size={12}/></button>
                </div>
              ) : (
                <input type="file" accept="image/*" capture="environment" onChange={handleImage} className="input text-sm file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100" />
              )}
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

const statusBadge = s=>({Aberta:'badge-red','Em Andamento':'badge-yellow',Resolvida:'badge-green'}[s]||'badge-blue')
const prioBadge   = p=>({Alta:'badge-red',Média:'badge-yellow',Baixa:'badge-green'}[p]||'badge-blue')

function ModalMulta({ ocorrencia, onClose, onSave }) {
  const [valor, setValor] = useState('')
  const [dataVenc, setDataVenc] = useState('')
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-sm" onClick={e=>e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">Gerar Multa - Apt {ocorrencia.apt}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <p className="text-sm text-gray-600">Ao salvar, uma Conta a Receber será lançada no Módulo Financeiro.</p>
          <div><label className="label">Valor da Multa (R$)</label><input type="number" step="0.01" className="input" value={valor} onChange={e=>setValor(e.target.value)} placeholder="0,00" autoFocus/></div>
          <div><label className="label">Vencimento</label><input type="date" className="input" value={dataVenc} onChange={e=>setDataVenc(e.target.value)}/></div>
        </div>
        <div className="p-6 border-t border-cream-300 flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={()=>{if(!valor||!dataVenc)return; onSave(valor, dataVenc)}} className="btn-primary">Gerar Boleto/Multa</button>
        </div>
      </div>
    </div>
  )
}

export default function Ocorrencias() {
  const { user } = useAuth()
  const { items, addItem, updateItem, deleteItem } = useFirestore('ocorrencias')
  const { addItem: addLancamentoFinanceiro } = useFirestore('financeiro_lancamentos')
  const [search, setSearch] = useState('')
  const [modal,  setModal]  = useState(null)
  const [modalMulta, setModalMulta] = useState(null)

  const filtered = items.filter(i => {
    if (i.visibilidade === 'Apenas Adm' && user?.role !== 'Administrador') {
      return false
    }
    return i.titulo?.toLowerCase().includes(search.toLowerCase()) || i.categoria?.toLowerCase().includes(search.toLowerCase())
  })

  const handleSave = async form => {
    if (modal==='new') {
      const finalForm = {
        ...form,
        condominio: form.condominio || user?.condominio || '',
        nome_morador: user?.nome || 'Morador',
        uid: user?.uid || ''
      }
      await addItem(finalForm)
      // Notificação sistema
      const msg = `[${finalForm.condominio}] ⚠️ Nova ocorrência de ${finalForm.nome_morador} (Apt ${finalForm.apt}): "${finalForm.titulo}"`
      await addDoc(collection(db,'notificacoes'),{
        text:msg, time:new Date().toISOString(), tipo:'ocorrencia', lida:false, condominio: finalForm.condominio, _createdAt:serverTimestamp()
      })
      // Email ADM
      notificarAdm(`⚠️ Nova Ocorrência: ${form.titulo}`,
        `Ocorrência registrada:\n\n📋 Título: ${form.titulo}\n🏠 Apt: ${form.apt}\n📂 Categoria: ${form.categoria}\n🚨 Prioridade: ${form.prioridade}\n\nDescrição:\n${form.descricao}`)
      // WhatsApp ADM
      const wppMsg = encodeURIComponent(`⚠️ *Nova Ocorrência*\n\n*${form.titulo}*\nApt ${form.apt} · ${form.categoria} · Prioridade: ${form.prioridade}\n\n${form.descricao}`)
      window.open(`https://wa.me/?text=${wppMsg}`,'_blank')
    } else {
      await updateItem(modal.id,form)
    }
    setModal(null)
  }

  const handleGerarMulta = async (valor, dataVenc) => {
    // 1. Gera lançamento financeiro
    await addLancamentoFinanceiro({
      tipo: 'Receita',
      categoria: 'Multa',
      descricao: `Multa Infração - Apt ${modalMulta.apt} (${modalMulta.titulo})`,
      valor: Number(valor),
      data: dataVenc,
      status: 'Pendente'
    })
    // 2. Atualiza ocorrência
    await updateItem(modalMulta.id, { ...modalMulta, multaGerada: true })
    setModalMulta(null)
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="page-header">
        <div><h2 className="section-title text-xl">Ocorrências</h2><p className="section-sub">{items.filter(i=>i.status!=='Resolvida').length} ocorrências abertas</p></div>
        <button onClick={()=>setModal('new')} className="btn-primary"><Plus size={16}/>Registrar</button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {['Aberta','Em Andamento','Resolvida'].map(s=>(
          <div key={s} className="card text-center">
            <p className="text-2xl font-black text-brand-700">{items.filter(i=>i.status===s).length}</p>
            <p className="text-xs text-gray-400">{s}</p>
          </div>
        ))}
      </div>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
        <input className="input pl-9" placeholder="Buscar ocorrência..." value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>
      {items.length===0&&<div className="card text-center py-10 text-gray-400 text-sm">Nenhuma ocorrência registrada ainda.</div>}
      <div className="flex flex-col gap-3">
        {filtered.map(item=>(
          <div key={item.id} className="card hover:border-brand-700/50 transition-all group">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-bold text-gray-800 text-sm">{item.titulo}</h3>
                  <span className={statusBadge(item.status)}>{item.status}</span>
                  <span className={prioBadge(item.prioridade)}>{item.prioridade}</span>
                  {item.visibilidade === 'Apenas Adm' && (
                    <span className="badge-red border border-red-200">🔒 Interno</span>
                  )}
                  {item.infracao && (
                    <span className="badge-red bg-red-100 text-red-700 font-bold uppercase tracking-wider">Infração</span>
                  )}
                  {item.infracao && items.some(i => i.apt === item.apt && i.infracao && i.id !== item.id) && (
                    <span className="badge-red bg-red-600 text-white font-black animate-pulse">⚠️ REINCIDENTE</span>
                  )}
                  {item.multaGerada && (
                    <span className="badge-green bg-emerald-100 text-emerald-800">Multa Gerada</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mb-2">{item.descricao}</p>
                {item.foto && (
                  <div className="mb-3">
                    <img src={item.foto} alt="Evidência" className="w-24 h-24 object-cover rounded-lg border border-cream-200 cursor-pointer hover:opacity-80 transition-opacity" onClick={()=>window.open(item.foto,'_blank')}/>
                  </div>
                )}
                <div className="flex gap-3 text-xs text-gray-500">
                  <span>🏢 {item.condominio}</span>
                  <span>🏠 {item.apt}</span>
                  <span>👤 {item.nome_morador || 'Sistema'}</span>
                  <span>📂 {item.categoria}</span>
                  <span>🕐 {item.data} às {item.hora}</span>
                </div>
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity ml-3 items-center">
                {item.infracao && !item.multaGerada && user?.role !== 'Morador' && (
                  <button onClick={()=>setModalMulta(item)} title="Gerar Multa" className="p-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 transition-all flex items-center gap-1 text-xs font-bold px-2">
                    <DollarSign size={14}/> Multa
                  </button>
                )}
                {(user?.role !== 'Morador' || item.uid === user?.uid || (item.apt === user?.apt && item.condominio === user?.condominio)) && (
                  <button onClick={()=>setModal(item)} className="p-1.5 rounded-lg bg-cream-200 hover:bg-brand-100 text-gray-400 hover:text-brand-700 transition-all"><Edit2 size={12}/></button>
                )}
                {user?.role !== 'Morador' && (
                  <button onClick={()=>deleteItem(item.id)} className="p-1.5 rounded-lg bg-cream-200 hover:bg-red-100 text-gray-400 hover:text-red-500 transition-all"><Trash2 size={12}/></button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {modal&&<Modal data={modal==='new'?null:modal} user={user} onClose={()=>setModal(null)} onSave={handleSave}/>}
      {modalMulta && <ModalMulta ocorrencia={modalMulta} onClose={()=>setModalMulta(null)} onSave={handleGerarMulta}/>}
    </div>
  )
}
