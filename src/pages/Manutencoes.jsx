import React, { useState } from 'react'
import { Wrench, Plus, CheckCircle, Clock, Trash2, Calendar, AlertCircle } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'

function ModalManutencao({ data, condominios, onClose, onSave }) {
  const [form, setForm] = useState(data || {
    titulo: '', fornecedor: '', dataPrevista: '', custoEstimado: '', recorrencia: 'Nenhuma', status: 'Agendada', descricao: '', condominio: ''
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">{data ? 'Editar Manutenção' : 'Agendar Manutenção'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Título / Serviço</label>
            <input className="input" value={form.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Ex: Recarga de Extintores" autoFocus />
          </div>
          <div className="col-span-2">
            <label className="label">Condomínio</label>
            <select className="input" value={form.condominio || ''} onChange={e => set('condominio', e.target.value)}>
              <option value="">Todos / Geral</option>
              {condominios?.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">Fornecedor / Prestador</label>
            <input className="input" value={form.fornecedor} onChange={e => set('fornecedor', e.target.value)} placeholder="Ex: SegurFogo Ltda" />
          </div>
          <div>
            <label className="label">Data Prevista</label>
            <input type="date" className="input" value={form.dataPrevista} onChange={e => set('dataPrevista', e.target.value)} />
          </div>
          <div>
            <label className="label">Custo Estimado (R$)</label>
            <input type="number" min="0" step="0.01" className="input" value={form.custoEstimado} onChange={e => set('custoEstimado', e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <label className="label">Recorrência</label>
            <select className="input" value={form.recorrencia} onChange={e => set('recorrencia', e.target.value)}>
              <option>Nenhuma</option>
              <option>Mensal</option>
              <option>Semestral</option>
              <option>Anual</option>
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
              <option>Agendada</option>
              <option>Em Andamento</option>
              <option>Concluída</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">Observações</label>
            <textarea className="input min-h-[80px]" value={form.descricao} onChange={e => set('descricao', e.target.value)} />
          </div>
        </div>
        <div className="p-6 border-t border-cream-300 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={() => { if (!form.titulo || !form.dataPrevista) return; onSave(form) }} className="btn-primary">Salvar</button>
        </div>
      </div>
    </div>
  )
}

export default function Manutencoes() {
  const { user } = useAuth()
  const isAdminOrSindico = ['Administrador', 'Síndico'].includes(user?.role)
  const { items: manutencoes, addItem, updateItem, deleteItem } = useFirestore('manutencoes')
  const { items: condominios } = useFirestore('condominios')
  
  const [modal, setModal] = useState(null)
  
  // Atualiza visualmente para "Atrasada" se a data passou e não está concluída
  const hojeStr = new Date().toISOString().split('T')[0]
  const viewManutencoes = manutencoes.map(m => {
    let statusVisual = m.status
    if (m.status !== 'Concluída' && m.dataPrevista < hojeStr) {
      statusVisual = 'Atrasada'
    }
    return { ...m, statusVisual }
  }).sort((a,b) => new Date(a.dataPrevista) - new Date(b.dataPrevista))

  const handleSave = async (form) => {
    if (form.id) {
      await updateItem(form.id, form)
    } else {
      await addItem(form)
    }
    setModal(null)
  }

  const getStatusStyle = (status) => {
    switch (status) {
      case 'Concluída': return 'text-emerald-700 bg-emerald-50 border-emerald-200'
      case 'Atrasada': return 'text-red-700 bg-red-50 border-red-200'
      case 'Em Andamento': return 'text-amber-700 bg-amber-50 border-amber-200'
      default: return 'text-blue-700 bg-blue-50 border-blue-200'
    }
  }

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-bold text-gray-800 text-sm mb-1">Gestão de Manutenção Preventiva</p>
          <p className="text-xs text-gray-500">Acompanhe as vistorias, recargas e obras do condomínio</p>
        </div>
        {isAdminOrSindico && (
          <button onClick={() => setModal({})} className="btn-primary py-1 px-3 text-xs">
            <Plus size={14} /> Agendar Manutenção
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {viewManutencoes.length === 0 && (
          <div className="col-span-full card text-center py-12 text-gray-500">
            <Wrench size={40} className="mx-auto mb-3 text-cream-400" />
            <p>Nenhuma manutenção agendada.</p>
          </div>
        )}

        {viewManutencoes.map(m => (
          <div key={m.id} className="card p-5 hover:border-brand-300 transition-all group flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-3">
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase border ${getStatusStyle(m.statusVisual)}`}>
                  {m.statusVisual}
                </span>
                {isAdminOrSindico && (
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setModal(m)} className="text-gray-400 hover:text-brand-600"><Wrench size={14}/></button>
                    <button onClick={() => deleteItem(m.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={14}/></button>
                  </div>
                )}
              </div>
              <h3 className="font-bold text-gray-800 text-lg leading-tight mb-1">{m.titulo}</h3>
              <p className="text-sm text-gray-500 mb-2">{m.fornecedor || 'Fornecedor a definir'}</p>
              <div className="mb-4">
                <span className="inline-block px-2 py-1 bg-cream-200 text-gray-600 rounded text-[10px] uppercase font-bold">
                  {m.condominio ? `🏢 ${m.condominio}` : '🌐 Todos / Geral'}
                </span>
              </div>
            </div>
            
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 flex flex-col gap-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500 flex items-center gap-1.5"><Calendar size={14}/> Prevista para</span>
                <span className={`font-semibold ${m.statusVisual === 'Atrasada' ? 'text-red-600' : 'text-gray-700'}`}>
                  {m.dataPrevista.split('-').reverse().join('/')}
                </span>
              </div>
              {m.custoEstimado && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 flex items-center gap-1.5"><AlertCircle size={14}/> Custo</span>
                  <span className="font-semibold text-gray-700">R$ {Number(m.custoEstimado).toLocaleString('pt-BR', {minimumFractionDigits:2})}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {modal && <ModalManutencao data={modal.id ? modal : null} condominios={condominios} onClose={() => setModal(null)} onSave={handleSave} />}
    </div>
  )
}
