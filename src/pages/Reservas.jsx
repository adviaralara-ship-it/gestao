import React, { useState, useEffect } from 'react'
import { CalendarCheck, Plus, Search, Edit2, Trash2, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { DollarSign } from 'lucide-react'

const espacos = ['Salão de Festas','Churrasqueira','Piscina','Quadra Esportiva','Espaço Gourmet','Brinquedoteca','Coworking']
const spaceIcons = {'Salão de Festas':'🎉','Churrasqueira':'🔥','Piscina':'🏊','Quadra Esportiva':'⚽','Espaço Gourmet':'🍽️','Brinquedoteca':'🎮','Coworking':'💻'}

function Modal({ data, user, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(data)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))
  
  const parseBR = v => parseFloat(v.toString().replace(/\./g,'').replace(',','.')) || 0
  const formatInput = (val, setter) => {
    const nums = val.toString().replace(/\D/g,'')
    if (!nums) { setter(''); return }
    const n = parseInt(nums,10)/100
    setter(n.toLocaleString('pt-BR',{minimumFractionDigits:2}))
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e=>e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">{data.id?'Editar Reserva':'Nova Reserva'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div><label className="label">Espaço</label>
            <select className="input" value={form.espaco} onChange={e=>set('espaco',e.target.value)}>
              {espacos.map(e=><option key={e}>{e}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Condomínio</label><input className="input" value={form.condominio} onChange={e=>set('condominio',e.target.value)} disabled={user?.role==='Morador'}/></div>
            <div><label className="label">Morador</label><input className="input" value={form.morador} onChange={e=>set('morador',e.target.value)}/></div>
            <div><label className="label">Apartamento</label><input className="input" value={form.apt} onChange={e=>set('apt',e.target.value)}/></div>
            <div><label className="label">Data</label><input type="date" className="input" value={form.data} onChange={e=>set('data',e.target.value)}/></div>
            <div><label className="label">Nº Pessoas</label><input type="number" className="input" value={form.pessoas} onChange={e=>set('pessoas',e.target.value)}/></div>
          </div>
          <div><label className="label">Horário</label><input className="input" value={form.horario} placeholder="14:00 – 22:00" onChange={e=>set('horario',e.target.value)}/></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Status</label>
              <select className="input" value={form.status} onChange={e=>set('status',e.target.value)}>
                <option>Pendente</option><option>Confirmada</option><option>Cancelada</option>
              </select>
            </div>
            <div>
              <label className="label">Valor Cobrado (R$)</label>
              {user?.role === 'Morador' ? (
                <div className="input bg-cream-50 text-gray-500 font-medium">
                  {form.valor ? `R$ ${Number(form.valor).toLocaleString('pt-BR',{minimumFractionDigits:2})}` : 'Sob consulta'}
                </div>
              ) : (
                <input className="input" value={form.valor ? (typeof form.valor === 'string' && form.valor.includes(',') ? form.valor : Number(form.valor).toLocaleString('pt-BR',{minimumFractionDigits:2})) : ''} onChange={e=>formatInput(e.target.value, v => set('valor', v))} placeholder="0,00" />
              )}
            </div>
          </div>
        </div>
        <div className="p-6 border-t border-cream-300 flex gap-3 justify-end items-center">
          {data.id && data.status === 'Cancelada' && (
            <button onClick={() => { if(window.confirm('Excluir esta reserva?')) onDelete(data.id) }} className="btn-secondary text-red-500 mr-auto hover:bg-red-50 border-red-200"><Trash2 size={14}/> Excluir Permanente</button>
          )}
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={()=>onSave(form)} className="btn-primary">Salvar</button>
        </div>
      </div>
    </div>
  )
}

const statusBadge = s=>({Confirmada:'badge-green',Pendente:'badge-yellow',Cancelada:'badge-red',Concluída:'badge-blue'}[s]||'badge-blue')

export default function Reservas() {
  const { user } = useAuth()
  const { items, addItem, updateItem, deleteItem } = useFirestore('reservas')
  const { addItem: addBoleto } = useFirestore('boletos')
  const [modal, setModal]           = useState(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedEspaco, setSelectedEspaco] = useState('Todos')
  const [search, setSearch]         = useState('')

  const handleSave = async form => {
    if (form.status !== 'Cancelada') {
      const overlap = items.some(i => {
        if (i.id === form.id || i.espaco !== form.espaco || i.data !== form.data || i.status === 'Cancelada') return false
        
        // Verifica sobreposição de horários
        const h1 = (i.horario || '').toLowerCase().replace('as', '-').replace('às', '-')
        const h2 = (form.horario || '').toLowerCase().replace('as', '-').replace('às', '-')
        
        const parseTime = t => { const m = t.match(/(\d{1,2})[:h](\d{2})?/); return m ? parseInt(m[1])*60 + (parseInt(m[2])||0) : null }
        const times1 = h1.split('-').map(parseTime)
        const times2 = h2.split('-').map(parseTime)
        
        if (times1.length >= 2 && times2.length >= 2 && times1[0] !== null && times2[0] !== null) {
          const [start1, end1] = times1
          const [start2, end2] = times2
          return (start1 < end2 && start2 < end1) // Sobreposição
        }
        return i.horario === form.horario // Fallback para strings exatas
      })
      if (overlap) { alert('Já existe uma reserva conflitante neste horário!'); return }
    }
    if (!form.id) {
      const finalForm = {
        ...form,
        condominio: form.condominio || user?.condominio || '',
        uid: user?.uid || ''
      }
      await addItem(finalForm)
      // notificação sistema
      await addDoc(collection(db,'notificacoes'),{
        text:`[${finalForm.condominio}] Nova reserva: ${finalForm.espaco} – ${finalForm.morador} (Apt ${finalForm.apt} | ${finalForm.data})`,
        time:new Date().toISOString(),tipo:'reserva',lida:false, condominio: finalForm.condominio, _createdAt:serverTimestamp()
      })
    } else {
      await updateItem(form.id, {
         ...form,
         valor: form.valor ? (typeof form.valor === 'string' ? parseFloat(form.valor.replace(/\./g,'').replace(',','.')) : form.valor) : 0
      })
    }
    setModal(null)
  }
  
  const handleGerarCobranca = async (r) => {
    if (!r.valor || r.valor <= 0) {
      alert("Defina um valor maior que zero editando a reserva primeiro.");
      return;
    }
    if (window.confirm(`Gerar boleto de R$ ${Number(r.valor).toLocaleString('pt-BR',{minimumFractionDigits:2})} para o Apt ${r.apt}?`)) {
      await addBoleto({
        morador: r.morador,
        apt: r.apt,
        condominio: r.condominio,
        vencimento: r.data,
        valor: Number(r.valor),
        status: 'Pendente',
        emitido: false,
        competencia: r.data.substring(0,7).split('-').reverse().join('/'),
        descricao: `Reserva - ${r.espaco}`
      })
      await updateItem(r.id, { ...r, cobrancaGerada: true })
      alert("Cobrança lançada na aba Boletos com sucesso!");
    }
  }

  const prevMonth = ()=>setCurrentDate(new Date(currentDate.getFullYear(),currentDate.getMonth()-1,1))
  const nextMonth = ()=>setCurrentDate(new Date(currentDate.getFullYear(),currentDate.getMonth()+1,1))
  const year=currentDate.getFullYear(); const month=currentDate.getMonth()
  const daysInMonth=new Date(year,month+1,0).getDate(); const firstDay=new Date(year,month,1).getDay()
  const monthNames=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  const weekDays=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
  const today=new Date()
  const todayStr=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`

  const getReservationsForDay = dayStr =>
    items.filter(i=>{if(selectedEspaco!=='Todos'&&i.espaco!==selectedEspaco)return false;return i.data===dayStr})

  // Lista filtrada para a seção abaixo do calendário
  const listaFiltrada = items.filter(i=>{
    const okEspaco = selectedEspaco==='Todos'||i.espaco===selectedEspaco
    const okSearch = !search || i.morador?.toLowerCase().includes(search.toLowerCase())||i.espaco?.toLowerCase().includes(search.toLowerCase())
    return okEspaco&&okSearch
  }).sort((a,b)=>a.data>b.data?-1:1)

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="page-header">
        <div><h2 className="section-title text-xl">Calendário de Reservas</h2><p className="section-sub">{items.filter(i=>i.status==='Pendente').length} aguardando aprovação</p></div>
        <button onClick={()=>setModal({espaco:selectedEspaco==='Todos'?'Salão de Festas':selectedEspaco,condominio:user?.condominio||'',morador:user?.nome||'',apt:user?.apt||'',data:'',horario:'',pessoas:'',status:'Pendente'})} className="btn-primary"><Plus size={16}/>Nova Reserva</button>
      </div>

      {/* Filtros de espaço */}
      <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
        <button onClick={()=>setSelectedEspaco('Todos')} className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${selectedEspaco==='Todos'?'bg-brand-600 text-white shadow-md':'bg-white text-gray-500 hover:text-brand-700 border border-cream-400'}`}>Visão Geral</button>
        {espacos.map(e=>(
          <button key={e} onClick={()=>setSelectedEspaco(e)} className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2 ${selectedEspaco===e?'bg-brand-600 text-white shadow-md':'bg-white text-gray-500 hover:text-brand-700 border border-cream-400'}`}>
            <span className="text-lg">{spaceIcons[e]}</span>{e}
          </button>
        ))}
      </div>

      {/* Calendário */}
      <div className="card p-0 overflow-hidden shadow-sm">
        <div className="flex justify-between items-center p-4 border-b border-cream-300 bg-cream-50">
          <button onClick={prevMonth} className="btn-secondary px-3 py-1.5"><ChevronLeft size={16}/> Anterior</button>
          <h3 className="font-black text-xl text-brand-900 capitalize">{monthNames[month]} {year}</h3>
          <button onClick={nextMonth} className="btn-secondary px-3 py-1.5">Próximo <ChevronRight size={16}/></button>
        </div>
        <div className="grid grid-cols-7 border-b border-cream-300 bg-white">
          {weekDays.map(w=><div key={w} className="py-3 text-center text-xs font-black text-brand-800 uppercase tracking-wider">{w}</div>)}
        </div>
        <div className="grid grid-cols-7 bg-cream-200 gap-px">
          {Array.from({length:firstDay}).map((_,i)=><div key={`e${i}`} className="bg-cream-50/50 min-h-[120px] p-2"/>)}
          {Array.from({length:daysInMonth}).map((_,i)=>{
            const d=i+1
            const dayStr=`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
            const dayRes=getReservationsForDay(dayStr)
            const isToday=dayStr===todayStr
            return (
              <div key={d} onClick={()=>setModal({espaco:selectedEspaco==='Todos'?'Salão de Festas':selectedEspaco,condominio:user?.condominio||'',morador:user?.nome||'',apt:user?.apt||'',data:dayStr,horario:'',pessoas:'',status:'Pendente'})}
                className={`bg-white min-h-[120px] p-2 transition-all hover:bg-brand-50 cursor-pointer group flex flex-col gap-1.5 relative ${isToday?'bg-blue-50/30':''}`}>
                <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full transition-all ${isToday?'bg-brand-600 text-white ring-4 ring-brand-100':'text-gray-400 group-hover:text-brand-600 group-hover:bg-brand-100'}`}>{d}</span>
                <div className="flex flex-col gap-1.5 mt-1 flex-1 overflow-y-auto custom-scrollbar pr-1 max-h-[100px]">
                  {dayRes.map(res=>(
                    <div key={res.id} onClick={e=>{e.stopPropagation();setModal(res)}}
                      className={`text-[10px] px-2 py-1.5 rounded-md truncate border cursor-pointer hover:shadow-sm transition-all flex items-center justify-between gap-1 ${res.status==='Confirmada'?'bg-green-50/80 border-green-200 text-green-800':res.status==='Cancelada'?'bg-red-50/80 border-red-200 text-red-700 opacity-60':'bg-yellow-50/80 border-yellow-300 text-yellow-800 font-medium'}`}>
                      <div className="flex items-center gap-1.5 truncate"><span className="text-xs">{spaceIcons[res.espaco]}</span><span className="truncate">{selectedEspaco==='Todos'?res.espaco.split(' ')[0]:res.morador}</span></div>
                      {res.status==='Pendente'&&<span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse shrink-0"/>}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Lista de reservas com busca e opção de excluir canceladas */}
      <div className="card p-0 overflow-hidden">
        <div className="p-4 border-b border-cream-300 flex items-center gap-3">
          <Search size={14} className="text-gray-400 shrink-0"/>
          <input className="flex-1 outline-none text-sm text-gray-700 placeholder-gray-400" placeholder="Buscar reserva..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        {listaFiltrada.length===0
          ? <p className="text-center py-8 text-gray-400 text-sm">Nenhuma reserva encontrada.</p>
          : (
            <div className="divide-y divide-cream-200">
              {listaFiltrada.map(r=>(
                <div key={r.id} className="flex items-center justify-between px-4 py-3 hover:bg-cream-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{spaceIcons[r.espaco]||'📅'}</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{r.espaco} <span className="text-gray-400 font-normal">· {r.morador} (Apt {r.apt})</span></p>
                      <p className="text-xs text-gray-500">{r.data} · {r.horario}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.valor > 0 && <span className="text-xs font-bold text-gray-500 mr-2">R$ {Number(r.valor).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>}
                    <span className={statusBadge(r.status)}>{r.status}</span>
                    {r.status === 'Confirmada' && r.valor > 0 && !r.cobrancaGerada && (user?.role === 'Administrador' || user?.role === 'Financeiro') && (
                      <button onClick={()=>handleGerarCobranca(r)} title="Gerar Boleto/Pix" className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition-all flex items-center"><DollarSign size={14}/></button>
                    )}
                    {r.cobrancaGerada && <span className="badge-green text-[10px]">Cobrado</span>}
                    <button onClick={()=>setModal(r)} className="p-1.5 rounded-lg bg-cream-100 hover:bg-brand-100 text-gray-400 hover:text-brand-600 transition-all"><Edit2 size={12}/></button>
                    {r.status==='Cancelada' && (
                      <button onClick={()=>deleteItem(r.id)} className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 transition-all" title="Excluir reserva cancelada"><Trash2 size={12}/></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </div>

      {modal&&<Modal data={modal} user={user} onClose={()=>setModal(null)} onSave={handleSave} onDelete={async id => { await deleteItem(id); setModal(null) }}/>}
    </div>
  )
}
