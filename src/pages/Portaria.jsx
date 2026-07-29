import React, { useState } from 'react'
import { DoorOpen, Plus, Trash2, Search, CheckCircle2, XCircle, ShieldAlert } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { notificarAdm } from '../emailjs.config'
import { useAuth } from '../context/AuthContext'
import Manutencoes from './Manutencoes'

const tipoBadge  = t=>({Visitante:'badge-blue',Entrega:'badge-yellow','Serviço':'badge-purple'}[t]||'badge-blue')
const statusBadge2 = s=>({'No local':'badge-green',Saiu:'badge-blue',Aguardando:'badge-yellow'}[s]||'badge-blue')

export default function Portaria() {
  const { user } = useAuth()
  const { items: visitantes, addItem: addVisit, deleteItem: delVisit, updateItem: updVisit } = useFirestore('portaria_visitantes')
  const [tab,    setTab]    = useState('visitantes')
  const [form,   setForm]   = useState({ nome:'', destino:'', tipo:'Visitante', autorizadoPor:'' })
  const [search, setSearch] = useState('')

  const registrarEntrada = async () => {
    if (!form.nome) {
      alert('Por favor, preencha o nome do visitante.')
      return
    }
    try {
      const hora = new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})
      const entry = {
        ...form, entrada:hora, saida:'—',
        data:new Date().toLocaleDateString('pt-BR'),
        status:'Aguardando', autorizado:null,
        condominio: user?.condominio || ''
      }
      await addVisit(entry)

      // Se for prestador de serviço → notificar ADM
      if (form.tipo==='Serviço') {
        const msg = `🔨 Prestador de serviço na portaria: "${form.nome}" → ${form.destino}. Verifique se foi contratado pela administração.`
        await addDoc(collection(db,'notificacoes'),{
          text:msg, time:new Date().toISOString(), tipo:'prestador', lida:false, _createdAt:serverTimestamp()
        })
        notificarAdm('🔨 Prestador de Serviço na Portaria', msg)
      }
      setForm({ nome:'', destino:'', tipo:'Visitante', autorizadoPor:'' })
    } catch (error) {
      console.error(error)
      alert('Erro ao registrar entrada: ' + error.message)
    }
  }

  const registrarSaida = async id => {
    const hora = new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})
    await updVisit(id,{saida:hora,status:'Saiu'})
  }

  const confirmarLiberacao = async (id, liberado) => {
    await updVisit(id,{autorizado:liberado, status: liberado ? 'No local' : 'Negado'})
    if (!liberado) {
      await addDoc(collection(db,'notificacoes'),{
        text:`⛔ Acesso negado na portaria para: ${visitantes.find(v=>v.id===id)?.nome||''}`,
        time:new Date().toISOString(), tipo:'portaria', lida:false, _createdAt:serverTimestamp()
      })
    }
  }

  const visitFiltrados = visitantes.filter(v=>v.nome?.toLowerCase().includes(search.toLowerCase())||v.destino?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="page-header">
        <div><h2 className="section-title text-xl">Portaria &amp; Manutenção</h2><p className="section-sub">Controle de acesso e ordens de serviço</p></div>
      </div>

      <div className="flex gap-2">
        {['visitantes','manutenção'].map(t=>(
          <button key={t} onClick={()=>setTab(t)} className={`px-5 py-2 rounded-lg text-sm font-medium capitalize transition-all ${tab===t?'bg-brand-600 text-white':'bg-white text-gray-500 hover:text-brand-700 border border-cream-400'}`}>{t}</button>
        ))}
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
        <input className="input pl-9" placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>

      {tab==='visitantes' && (
        <>
          <div className="card">
            <p className="font-bold text-gray-800 text-sm mb-4">🚪 Registrar Entrada</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div><label className="label">Nome</label><input className="input" placeholder="Nome do visitante" value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))}/></div>
              <div><label className="label">Destino</label><input className="input" placeholder="Apt 000-X" value={form.destino} onChange={e=>setForm(f=>({...f,destino:e.target.value}))}/></div>
              <div><label className="label">Tipo</label>
                <select className="input" value={form.tipo} onChange={e=>setForm(f=>({...f,tipo:e.target.value}))}>
                  <option>Visitante</option><option>Entrega</option><option>Serviço</option>
                </select>
              </div>
              <div><label className="label">Autorizado por</label><input className="input" placeholder="Nome do morador/porteiro" value={form.autorizadoPor} onChange={e=>setForm(f=>({...f,autorizadoPor:e.target.value}))}/></div>
            </div>
            <div className="mt-3">
              <button onClick={registrarEntrada} className="btn-primary"><Plus size={14}/>Registrar Entrada</button>
            </div>
            {form.tipo==='Serviço' && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2">
                <ShieldAlert size={15} className="text-amber-600 shrink-0"/>
                <p className="text-xs text-amber-800">Prestador de serviço: uma notificação será enviada aos administradores para verificação.</p>
              </div>
            )}
          </div>

          {visitFiltrados.length===0
            ? <div className="card text-center py-10 text-gray-400 text-sm">Nenhuma entrada registrada ainda.</div>
            : (
              <div className="card p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-cream-100 border-b border-cream-400">
                      <tr>{['Nome','Destino','Tipo','Entrada','Saída','Status','Autorizado?','Ações'].map(h=><th key={h} className="table-head">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {visitFiltrados.map(v=>(
                        <tr key={v.id} className="table-row">
                          <td className="table-cell font-medium text-gray-800">{v.nome}</td>
                          <td className="table-cell text-gray-500">{v.destino}</td>
                          <td className="table-cell"><span className={tipoBadge(v.tipo)}>{v.tipo}</span></td>
                          <td className="table-cell text-gray-500">{v.entrada}</td>
                          <td className="table-cell text-gray-500">{v.saida}</td>
                          <td className="table-cell"><span className={statusBadge2(v.status)}>{v.status}</span></td>
                          <td className="table-cell">
                            {v.autorizado===null||v.autorizado===undefined ? (
                              <div className="flex gap-1">
                                <button onClick={()=>confirmarLiberacao(v.id,true)} className="flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-200 transition-all"><CheckCircle2 size={11}/>Sim</button>
                                <button onClick={()=>confirmarLiberacao(v.id,false)} className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-600 rounded-lg text-xs font-medium hover:bg-red-200 transition-all"><XCircle size={11}/>Não</button>
                              </div>
                            ) : (
                              <span className={v.autorizado?'badge-green':'badge-red'}>{v.autorizado?'✓ Liberado':'✗ Negado'}</span>
                            )}
                          </td>
                          <td className="table-cell">
                            <div className="flex gap-2">
                              {v.status==='No local'&&<button onClick={()=>registrarSaida(v.id)} className="btn-secondary py-1 px-2.5 text-xs">Saída</button>}
                              <button onClick={()=>delVisit(v.id)} className="p-1.5 rounded-lg bg-cream-200 hover:bg-red-100 text-gray-400 hover:text-red-500 transition-all"><Trash2 size={12}/></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
        </>
      )}

      {tab==='manutenção' && (
        <Manutencoes />
      )}
    </div>
  )
}
