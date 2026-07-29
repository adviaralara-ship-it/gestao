import React, { useState } from 'react'
import { Package, Search, Plus, CheckCircle2, AlertCircle, Clock, Trash2, Edit2, X, MessageSquare } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

const statusBadge = s => ({ 'Entregue': 'badge-green', 'Aguardando Retirada': 'badge-yellow', 'Devolvido': 'badge-red' }[s] || 'badge-blue')
const statusIcon = s => s === 'Entregue' ? <CheckCircle2 size={14} className="text-emerald-500" /> : s === 'Devolvido' ? <AlertCircle size={14} className="text-red-500" /> : <Clock size={14} className="text-amber-500" />

export default function Encomendas() {
  const { user } = useAuth()
  const { items: encomendas, addItem, updateItem, deleteItem } = useFirestore('encomendas')
  const { items: moradores } = useFirestore('moradores')
  const [modal, setModal] = useState(false)
  const [busca, setBusca] = useState('')

  const aguardando = encomendas.filter(e => e.status === 'Aguardando Retirada').length
  const entregues = encomendas.filter(e => e.status === 'Entregue').length

  const handleSave = async (form) => {
    try {
      if (form.id) {
        await updateItem(form.id, { ...form })
      } else {
        await addItem({ ...form, status: 'Aguardando Retirada', dataRecebimento: new Date().toISOString(), condominio: user?.condominio || '' })
        
        // Disparar notificação automática (como se fosse push notification pro app do morador)
        await addDoc(collection(db, 'notificacoes'), {
          text: `📦 Sua encomenda (${form.descricao}) acabou de chegar na portaria!`,
          time: new Date().toISOString(),
          tipo: 'ocorrencia',
          lida: false,
          _createdAt: serverTimestamp()
        })
      }
      setModal(false)
    } catch (e) {
      console.error(e)
      alert('Erro ao salvar encomenda.')
    }
  }

  const registrarRetirada = async (enc) => {
    if (confirm(`Confirmar a retirada da encomenda de ${enc.morador}?`)) {
      await updateItem(enc.id, { status: 'Entregue', dataRetirada: new Date().toISOString() })
    }
  }

  const avisarWhats = (enc) => {
    const telDefault = '5511999999999' // mock
    const msg = `Olá ${enc.morador}, sua encomenda (${enc.descricao}) chegou na portaria do condomínio e já está disponível para retirada!`
    window.open(`https://wa.me/${telDefault}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const filtradas = encomendas.filter(e => 
    e.morador.toLowerCase().includes(busca.toLowerCase()) || 
    (e.apt || '').toLowerCase().includes(busca.toLowerCase()) ||
    (e.codigo || '').toLowerCase().includes(busca.toLowerCase())
  ).sort((a, b) => {
    if (a.status === 'Aguardando Retirada' && b.status !== 'Aguardando Retirada') return -1;
    if (b.status === 'Aguardando Retirada' && a.status !== 'Aguardando Retirada') return 1;
    return new Date(b.dataRecebimento || 0) - new Date(a.dataRecebimento || 0);
  })

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="page-header">
        <div><h2 className="section-title text-xl">Gestão de Encomendas</h2><p className="section-sub">Controle de recebimento e entrega de pacotes</p></div>
        <button onClick={() => setModal({})} className="btn-primary"><Plus size={16} />Nova Encomenda</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Registrado', val: encomendas.length, color: 'text-brand-700' },
          { label: 'Aguardando Retirada', val: aguardando, color: 'text-amber-600' },
          { label: 'Entregues (Histórico)', val: entregues, color: 'text-emerald-600' },
        ].map(s => (
          <div key={s.label} className="card text-center">
            <p className={`text-3xl font-black mb-1 ${s.color}`}>{s.val}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="card p-0 overflow-hidden flex-1 flex flex-col min-h-[400px]">
        <div className="p-4 border-b border-cream-300 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              className="input pl-9 w-full text-sm" 
              placeholder="Buscar por morador, apt ou código..." 
              value={busca} 
              onChange={e => setBusca(e.target.value)}
            />
          </div>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{filtradas.length} pacotes mapeados</span>
        </div>

        <div className="flex-1 overflow-x-auto">
          <table className="w-full">
            <thead className="bg-cream-100 border-b border-cream-400">
              <tr>{['Morador / Apt', 'Descrição / Cód.', 'Status', 'Recebimento', 'Ações'].map(h => <th key={h} className="table-head">{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtradas.length === 0
                ? <tr><td colSpan={5} className="text-center py-12 text-gray-400 text-sm">Nenhuma encomenda registrada ou encontrada na busca.</td></tr>
                : filtradas.map(e => (
                  <tr key={e.id} className="table-row">
                    <td className="table-cell">
                      <p className="font-bold text-gray-800">{e.morador}</p>
                      <p className="text-xs text-brand-600 font-semibold uppercase">{e.apt ? `Apt ${e.apt}` : 'S/ Apt'}</p>
                    </td>
                    <td className="table-cell">
                      <p className="text-gray-800 text-sm">{e.descricao}</p>
                      <p className="text-xs text-gray-400">{e.codigo || 'Sem código'}</p>
                    </td>
                    <td className="table-cell"><span className={`${statusBadge(e.status)} flex items-center gap-1 w-fit`}>{statusIcon(e.status)}{e.status}</span></td>
                    <td className="table-cell text-sm text-gray-500">{e.dataRecebimento ? new Date(e.dataRecebimento).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '--'}</td>
                    <td className="table-cell">
                      <div className="flex gap-1.5 flex-wrap">
                        {e.status === 'Aguardando Retirada' && (
                          <>
                            <button onClick={() => registrarRetirada(e)} className="btn-success py-1 px-2.5 text-xs"><CheckCircle2 size={13} />Entregar</button>
                            <button onClick={() => avisarWhats(e)} className="btn-secondary py-1 px-2.5 text-xs text-green-700 bg-green-50 border-green-200 hover:bg-green-100" title="Avisar no Whats"><MessageSquare size={13} /></button>
                          </>
                        )}
                        <button onClick={() => setModal(e)} className="p-1.5 rounded-lg bg-cream-100 hover:bg-brand-100 text-gray-400 hover:text-brand-600 transition-all"><Edit2 size={13} /></button>
                        <button onClick={() => deleteItem(e.id)} className="p-1.5 rounded-lg bg-cream-100 hover:bg-red-100 text-gray-400 hover:text-red-500 transition-all"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {modal && <ModalEncomenda data={Object.keys(modal).length ? modal : null} onClose={() => setModal(false)} onSave={handleSave} moradores={moradores} />}
    </div>
  )
}

function ModalEncomenda({ data, onClose, onSave, moradores }) {
  const [form, setForm] = useState(data || { morador: '', apt: '', descricao: '', codigo: '' })
  
  // Auto-fill apt se morador for selecionado na lista (opcional, simplificado)
  const handleMoradorChange = (val) => {
    const m = moradores.find(x => x.nome === val)
    setForm(f => ({ ...f, morador: val, apt: m?.apt || f.apt }))
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">{data ? 'Editar Encomenda' : 'Registrar Encomenda'}</h3>
          <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-700" /></button>
        </div>
        <div className="p-6 grid grid-cols-1 gap-4">
          <div>
            <label className="label">Morador Destinatário *</label>
            <input 
              list="moradores-list" 
              className="input w-full" 
              value={form.morador} 
              onChange={e => handleMoradorChange(e.target.value)} 
              placeholder="Nome do morador" 
              autoFocus 
            />
            <datalist id="moradores-list">
              {moradores.map(m => <option key={m.id} value={m.nome}>{m.apt ? `Apt ${m.apt}` : ''}</option>)}
            </datalist>
          </div>
          <div><label className="label">Unidade / Apartamento</label><input className="input w-full" value={form.apt} onChange={e => setForm(f => ({ ...f, apt: e.target.value }))} placeholder="Ex: 501-A" /></div>
          <div><label className="label">Descrição do Pacote *</label><input className="input w-full" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Caixa Mercado Livre, Envelope, etc." /></div>
          <div><label className="label">Código de Rastreio (Opcional)</label><input className="input w-full" value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} placeholder="Ex: AA123456789BR" /></div>
        </div>
        <div className="p-6 border-t border-cream-300 flex gap-3 justify-end bg-gray-50/50 rounded-b-2xl">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={() => { if(!form.morador || !form.descricao) return alert('Preecha Morador e Descrição'); onSave(form) }} className="btn-primary">Salvar e Notificar</button>
        </div>
      </div>
    </div>
  )
}
