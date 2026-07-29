import React, { useState } from 'react'
import { Shield, AlertCircle, Plus, Trash2, Search } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'

function ModalSinistro({ sinistros, onClose, onSave }) {
  const [form, setForm] = useState({ descricao: '', data: '', valor: '', status: 'Aberto' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const jaExiste = sinistros.some(s =>
    s.descricao?.toLowerCase().trim() === form.descricao.toLowerCase().trim() && s.data === form.data
  )

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">Registrar Sinistro</h3>
          <button onClick={onClose} className="text-gray-400 text-lg hover:text-gray-700">✕</button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div><label className="label">Descrição</label><input className="input" value={form.descricao} onChange={e => set('descricao', e.target.value)} placeholder="Ex: Dano elétrico – Bomba" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Data</label><input type="date" className="input" value={form.data} onChange={e => set('data', e.target.value)} /></div>
            <div><label className="label">Valor estimado</label><input className="input" placeholder="R$ 0,00" value={form.valor} onChange={e => set('valor', e.target.value)} /></div>
          </div>
          <div><label className="label">Status</label>
            <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
              <option>Aberto</option><option>Em análise</option><option>Indenizado</option><option>Recusado</option>
            </select>
          </div>
          {jaExiste && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-700 flex items-center gap-2">
              <AlertCircle size={14} />
              ⚠️ Sinistro com mesma descrição e data já registrado. Verifique antes de prosseguir.
            </div>
          )}
        </div>
        <div className="p-6 border-t border-cream-300 flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button
            onClick={() => { if (!form.descricao || !form.data) return; onSave(form) }}
            className="btn-primary"
          ><AlertCircle size={14} />Registrar</button>
        </div>
      </div>
    </div>
  )
}

function ModalApolice({ onClose, onSave }) {
  const [form, setForm] = useState({
    numero: '', seguradora: '', vigencia_inicio: '', vigencia_fim: '',
    premio: '', valor_segurado: '', franquia: '', corretor: ''
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">Cadastrar Apólice</h3>
          <button onClick={onClose} className="text-gray-400 text-lg hover:text-gray-700">✕</button>
        </div>
        <div className="p-6 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Nº Apólice</label><input className="input" value={form.numero} onChange={e => set('numero', e.target.value)} /></div>
            <div><label className="label">Seguradora</label><input className="input" value={form.seguradora} onChange={e => set('seguradora', e.target.value)} /></div>
            <div><label className="label">Vigência Início</label><input type="date" className="input" value={form.vigencia_inicio} onChange={e => set('vigencia_inicio', e.target.value)} /></div>
            <div><label className="label">Vigência Fim</label><input type="date" className="input" value={form.vigencia_fim} onChange={e => set('vigencia_fim', e.target.value)} /></div>
            <div><label className="label">Prêmio Anual</label><input className="input" placeholder="R$ 0,00/ano" value={form.premio} onChange={e => set('premio', e.target.value)} /></div>
            <div><label className="label">Valor Segurado</label><input className="input" placeholder="R$ 0,00" value={form.valor_segurado} onChange={e => set('valor_segurado', e.target.value)} /></div>
            <div><label className="label">Franquia</label><input className="input" placeholder="R$ 0,00" value={form.franquia} onChange={e => set('franquia', e.target.value)} /></div>
            <div><label className="label">Corretor / Contato</label><input className="input" placeholder="Nome – (00) 00000-0000" value={form.corretor} onChange={e => set('corretor', e.target.value)} /></div>
          </div>
        </div>
        <div className="p-6 border-t border-cream-300 flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={() => { if (!form.numero || !form.seguradora) return; onSave({ ...form, status: 'Vigente', sinistros: [] }) }} className="btn-primary"><Shield size={14} />Salvar</button>
        </div>
      </div>
    </div>
  )
}

export default function Seguro() {
  const { items: apolices, addItem: addApolice, deleteItem: delApolice, updateItem: updApolice } = useFirestore('apolices')
  const [sinistroModal, setSinistroModal] = useState(null) // apolice id
  const [apoliceModal, setApoliceModal] = useState(false)
  const [search, setSearch] = useState('')

  const adicionarSinistro = async (apoliceId, sinistro) => {
    const apolice = apolices.find(a => a.id === apoliceId)
    if (!apolice) return
    const sinistrosAtual = apolice.sinistros || []
    await updApolice(apoliceId, { sinistros: [sinistro, ...sinistrosAtual] })
    setSinistroModal(null)
  }

  const removerSinistro = async (apoliceId, sinistroId) => {
    const apolice = apolices.find(a => a.id === apoliceId)
    if (!apolice) return
    await updApolice(apoliceId, { sinistros: apolice.sinistros.filter(s => s.id !== sinistroId) })
  }

  const apoliceAtual = apolices.find(a => a.id === sinistroModal)

  const filtradas = apolices.filter(a =>
    a.seguradora?.toLowerCase().includes(search.toLowerCase()) ||
    a.numero?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="page-header">
        <div><h2 className="section-title text-xl">Seguro do Condomínio</h2><p className="section-sub">Apólices e sinistros</p></div>
        <button onClick={() => setApoliceModal(true)} className="btn-primary"><Plus size={16} />Cadastrar Apólice</button>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input pl-9" placeholder="Buscar apólice..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {filtradas.length === 0
        ? <div className="card text-center py-10 text-gray-400 text-sm">Nenhuma apólice cadastrada. Clique em "Cadastrar Apólice" para começar.</div>
        : filtradas.map(a => (
          <div key={a.id} className="card">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 border border-blue-300 rounded-xl flex items-center justify-center">
                  <Shield size={22} className="text-brand-600" />
                </div>
                <div>
                  <p className="font-bold text-gray-800">{a.seguradora}</p>
                  <p className="text-xs font-mono text-brand-500">{a.numero}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <span className="badge-green">{a.status}</span>
                <button onClick={() => delApolice(a.id)} className="p-1.5 rounded-lg bg-cream-200 hover:bg-red-100 text-gray-400 hover:text-red-500 transition-all"><Trash2 size={12} /></button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {[
                { label: 'Vigência Início', val: a.vigencia_inicio },
                { label: 'Vigência Fim', val: a.vigencia_fim },
                { label: 'Prêmio Anual', val: a.premio },
                { label: 'Valor Segurado', val: a.valor_segurado },
                { label: 'Franquia', val: a.franquia },
                { label: 'Corretor', val: a.corretor },
              ].map(item => (
                <div key={item.label} className="bg-cream-100 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-0.5">{item.label}</p>
                  <p className="text-sm font-semibold text-gray-800">{item.val || '—'}</p>
                </div>
              ))}
            </div>

            <div className="border-t border-cream-300 pt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-bold text-gray-800 text-sm">Sinistros ({(a.sinistros || []).length})</p>
                <button onClick={() => setSinistroModal(a.id)} className="btn-secondary py-1.5 text-xs"><AlertCircle size={12} />Registrar Sinistro</button>
              </div>
              {(a.sinistros || []).length === 0
                ? <p className="text-xs text-gray-400">Nenhum sinistro registrado.</p>
                : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-cream-100 border-b border-cream-400">
                        <tr>{['Descrição', 'Data', 'Valor', 'Status', ''].map(h => <th key={h} className="table-head">{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {a.sinistros.map((s, i) => (
                          <tr key={s.id || i} className="table-row">
                            <td className="table-cell font-medium text-gray-800">{s.descricao}</td>
                            <td className="table-cell text-gray-500">{s.data}</td>
                            <td className="table-cell font-bold text-emerald-600">{s.valor}</td>
                            <td className="table-cell"><span className={s.status === 'Indenizado' ? 'badge-green' : s.status === 'Aberto' ? 'badge-yellow' : 'badge-blue'}>{s.status}</span></td>
                            <td className="table-cell"><button onClick={() => removerSinistro(a.id, s.id)} className="p-1 rounded hover:bg-red-100 text-gray-300 hover:text-red-500 transition-all"><Trash2 size={12} /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </div>
          </div>
        ))}

      {apoliceModal && <ModalApolice onClose={() => setApoliceModal(false)} onSave={async a => { await addApolice(a); setApoliceModal(false) }} />}
      {sinistroModal && apoliceAtual && (
        <ModalSinistro
          sinistros={apoliceAtual.sinistros || []}
          onClose={() => setSinistroModal(null)}
          onSave={s => adicionarSinistro(sinistroModal, { ...s, id: Date.now().toString() })}
        />
      )}
    </div>
  )
}
