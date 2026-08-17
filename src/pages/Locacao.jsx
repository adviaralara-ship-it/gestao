import React, { useState } from 'react'
import { Building, Home, Search, Plus, DollarSign, Edit2, Trash2, X, AlertTriangle, FileText } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'

function LocacaoModal({ data, onClose, onSave, condominios }) {
  const [form, setForm] = useState(data || {
    tipo_imovel: 'Condomínio', // Condomínio ou Avulso
    endereco: '', apt: '', condominio: '',
    proprietario: '', inquilino: '',
    valor_aluguel: '', taxa_adm: '10', vencimento: '',
    inicio_contrato: '', fim_contrato: '', status: 'Ativo'
  })
  
  const set = (k, v) => setForm({ ...form, [k]: v })

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex justify-between items-center bg-cream-50 rounded-t-2xl">
          <h3 className="font-bold text-gray-800 text-lg">{data ? 'Editar Contrato' : 'Novo Contrato de Locação'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors"><X size={20}/></button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
          <div className="col-span-2">
            <label className="label">Tipo do Imóvel</label>
            <div className="flex gap-6 mt-1">
              <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-xl flex-1 hover:border-brand-500 transition-colors">
                <input type="radio" name="tipo_imovel" checked={form.tipo_imovel === 'Condomínio'} onChange={() => set('tipo_imovel', 'Condomínio')} className="text-brand-600 focus:ring-brand-500 w-4 h-4"/>
                <span className="text-sm font-medium text-gray-700 flex items-center gap-2"><Building size={16} className="text-brand-600"/> Gestão Alpha (Condomínio)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-xl flex-1 hover:border-brand-500 transition-colors">
                <input type="radio" name="tipo_imovel" checked={form.tipo_imovel === 'Avulso'} onChange={() => set('tipo_imovel', 'Avulso')} className="text-brand-600 focus:ring-brand-500 w-4 h-4"/>
                <span className="text-sm font-medium text-gray-700 flex items-center gap-2"><Home size={16} className="text-gray-500"/> Imóvel Avulso (Rua/Casa)</span>
              </label>
            </div>
          </div>
          
          {form.tipo_imovel === 'Condomínio' ? (
            <>
              <div><label className="label">Condomínio</label>
                <select className="input" value={form.condominio} onChange={e => set('condominio', e.target.value)}>
                  <option value="">Selecione...</option>
                  {condominios.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                </select>
              </div>
              <div><label className="label">Apt / Unidade</label><input className="input" value={form.apt} onChange={e => set('apt', e.target.value)} placeholder="Ex: 104 Bloco B" /></div>
            </>
          ) : (
            <div className="col-span-2"><label className="label">Endereço Completo</label><input className="input" value={form.endereco} onChange={e => set('endereco', e.target.value)} placeholder="Rua, Número, Bairro, Cidade..." /></div>
          )}

          <div className="col-span-2 md:col-span-1"><label className="label">Proprietário (Locador)</label><input className="input" value={form.proprietario} onChange={e => set('proprietario', e.target.value)} placeholder="Nome do proprietário" /></div>
          <div className="col-span-2 md:col-span-1"><label className="label">Inquilino (Locatário)</label><input className="input" value={form.inquilino} onChange={e => set('inquilino', e.target.value)} placeholder="Nome do inquilino" /></div>
          
          <div><label className="label">Valor do Aluguel (R$)</label><input type="number" className="input" value={form.valor_aluguel} onChange={e => set('valor_aluguel', e.target.value)} placeholder="Ex: 1500.00" /></div>
          <div><label className="label">Taxa Adm. (%)</label><input type="number" className="input" value={form.taxa_adm} onChange={e => set('taxa_adm', e.target.value)} placeholder="Ex: 10" /></div>
          
          <div><label className="label">Início do Contrato</label><input type="date" className="input" value={form.inicio_contrato} onChange={e => set('inicio_contrato', e.target.value)} /></div>
          <div><label className="label">Fim do Contrato</label><input type="date" className="input" value={form.fim_contrato} onChange={e => set('fim_contrato', e.target.value)} /></div>
          
          <div><label className="label">Dia de Vencimento</label><input type="number" max="31" min="1" className="input" value={form.vencimento} onChange={e => set('vencimento', e.target.value)} placeholder="Ex: 10" /></div>
          <div><label className="label">Status</label>
            <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
              <option>Ativo</option><option>Encerrado</option><option>Inadimplente</option>
            </select>
          </div>
        </div>
        <div className="p-6 border-t border-cream-300 flex justify-end gap-3 bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={() => onSave(form)} className="btn-primary">Salvar Contrato</button>
        </div>
      </div>
    </div>
  )
}

function RepasseModal({ data, onClose, onSave }) {
  const [form, setForm] = useState(data || {
    contratoId: '', proprietario: '', inquilino: '', mes_ref: '', 
    valor_recebido: '', valor_repasse: '', taxa_retida: '', status: 'Pendente'
  })
  
  const set = (k, v) => setForm({ ...form, [k]: v })

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex justify-between items-center bg-cream-50 rounded-t-2xl">
          <h3 className="font-bold text-gray-800 text-lg">{data.id ? 'Editar Repasse' : 'Registrar Repasse'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors"><X size={20}/></button>
        </div>
        <div className="p-6 space-y-4">
          <div><label className="label">Mês de Referência</label><input className="input" value={form.mes_ref} onChange={e => set('mes_ref', e.target.value)} placeholder="Ex: 08/2026" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Recebido (Inquilino)</label><input type="number" className="input" value={form.valor_recebido} onChange={e => set('valor_recebido', e.target.value)} /></div>
            <div><label className="label">Taxa Retida (R$)</label><input type="number" className="input" value={form.taxa_retida} onChange={e => set('taxa_retida', e.target.value)} /></div>
            <div><label className="label">Valor a Repassar</label><input type="number" className="input font-bold text-brand-700" value={form.valor_repasse} onChange={e => set('valor_repasse', e.target.value)} /></div>
            <div><label className="label">Status do Repasse</label>
              <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
                <option>Pendente</option><option>Realizado</option>
              </select>
            </div>
          </div>
        </div>
        <div className="p-6 border-t border-cream-300 flex justify-end gap-3 bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={() => onSave(form)} className="btn-primary">Salvar Repasse</button>
        </div>
      </div>
    </div>
  )
}

export default function Locacao() {
  const { user } = useAuth()
  const { items: contratos, addItem: addContrato, updateItem: updateContrato, deleteItem: deleteContrato } = useFirestore('locacao_contratos')
  const { items: repasses, addItem: addRepasse, updateItem: updateRepasse, deleteItem: deleteRepasse } = useFirestore('locacao_repasses')
  const { items: condominios } = useFirestore('condominios')

  const [activeTab, setActiveTab] = useState('contratos')
  const [showContratoModal, setShowContratoModal] = useState(false)
  const [showRepasseModal, setShowRepasseModal] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('Todos')

  const todayDate = new Date().getDate();
  const getVencimentoStatus = (diaStr) => {
    const dia = parseInt(diaStr, 10);
    if (!dia) return null;
    let dif = dia - todayDate;
    if (dif < 0 && dif > -20) return { text: `Atrasado há ${-dif} dia(s)`, color: 'text-red-600', bg: 'bg-red-100' };
    if (dif >= 0 && dif <= 5) return { text: dif === 0 ? 'Vence HOJE' : `Vence em ${dif} dia(s)`, color: 'text-orange-600', bg: 'bg-orange-100' };
    return null;
  }

  const handleSaveContrato = async (form) => {
    if (form.id) {
      await updateContrato(form.id, form)
    } else {
      await addContrato(form)
    }
    setShowContratoModal(false)
  }

  const handleSaveRepasse = async (form) => {
    if (form.id) {
      await updateRepasse(form.id, form)
    } else {
      await addRepasse(form)
    }
    setShowRepasseModal(false)
  }

  const handleCreateRepasse = (contrato) => {
    const v = Number(contrato.valor_aluguel) || 0
    const t = Number(contrato.taxa_adm) || 0
    const tx = (v * t) / 100
    const rep = v - tx
    
    setShowRepasseModal({
      contratoId: contrato.id, 
      proprietario: contrato.proprietario, 
      inquilino: contrato.inquilino,
      mes_ref: new Date().toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' }),
      valor_recebido: v.toFixed(2), 
      taxa_retida: tx.toFixed(2), 
      valor_repasse: rep.toFixed(2), 
      status: 'Pendente'
    })
  }

  const delContrato = async (id) => {
    if (window.confirm('Excluir este contrato permanentemente?')) {
      await deleteContrato(id)
    }
  }
  
  const delRepasse = async (id) => {
    if (window.confirm('Excluir este repasse permanentemente?')) {
      await deleteRepasse(id)
    }
  }

  const stats = {
    ativos: contratos.filter(c => c.status === 'Ativo').length,
    inadimplentes: contratos.filter(c => c.status === 'Inadimplente').length,
    repPendentes: repasses.filter(r => r.status === 'Pendente').length,
    totalRepassar: repasses.filter(r => r.status === 'Pendente').reduce((acc, r) => acc + Number(r.valor_repasse||0), 0)
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 page-header">
        <div>
          <h2 className="section-title text-xl">Módulo de Locação</h2>
          <p className="section-sub">Gestão de aluguéis avulsos e em condomínios da Alpha.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card flex items-center gap-4">
          <div className="p-4 bg-brand-50 text-brand-600 rounded-xl"><Building size={24}/></div>
          <div><p className="text-sm text-gray-500 font-medium">Contratos Ativos</p><h3 className="text-3xl font-bold text-gray-800">{stats.ativos}</h3></div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-4 bg-red-50 text-red-500 rounded-xl"><AlertTriangle size={24}/></div>
          <div><p className="text-sm text-gray-500 font-medium">Inadimplentes</p><h3 className="text-3xl font-bold text-gray-800">{stats.inadimplentes}</h3></div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-4 bg-yellow-50 text-yellow-600 rounded-xl"><DollarSign size={24}/></div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Repasses Pendentes</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-3xl font-bold text-gray-800">{stats.repPendentes}</h3>
              {stats.totalRepassar > 0 && <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">R$ {stats.totalRepassar.toFixed(2)}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="card p-0 overflow-hidden flex flex-col">
        <div className="flex border-b border-cream-300 bg-cream-50">
          <button onClick={() => setActiveTab('contratos')} className={`px-6 py-4 font-semibold flex items-center gap-2 transition-colors ${activeTab === 'contratos' ? 'text-brand-600 border-b-2 border-brand-600 bg-white' : 'text-gray-500 hover:text-gray-800 hover:bg-cream-100'}`}><FileText size={18}/> Contratos de Locação</button>
          <button onClick={() => setActiveTab('repasses')} className={`px-6 py-4 font-semibold flex items-center gap-2 transition-colors ${activeTab === 'repasses' ? 'text-brand-600 border-b-2 border-brand-600 bg-white' : 'text-gray-500 hover:text-gray-800 hover:bg-cream-100'}`}><DollarSign size={18}/> Controle de Repasses</button>
        </div>

        <div className="p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input type="text" placeholder={activeTab === 'contratos' ? "Buscar inquilino ou locador..." : "Buscar proprietário..."} value={search} onChange={e => setSearch(e.target.value)} className="input pl-9 w-full sm:w-72" />
              </div>
              <select className="input w-full sm:w-auto" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="Todos">Todos os Status</option>
                <option value="Ativo">Ativos</option>
                <option value="Inadimplente">Inadimplentes</option>
                <option value="Vencendo">Vencendo em Breve / Atrasados</option>
              </select>
            </div>
            {activeTab === 'contratos' && <button onClick={() => setShowContratoModal(true)} className="btn-primary whitespace-nowrap"><Plus size={16}/> Novo Contrato</button>}
            {activeTab === 'repasses' && <button onClick={() => setShowRepasseModal(true)} className="btn-primary whitespace-nowrap"><Plus size={16}/> Novo Repasse Manual</button>}
          </div>

          <div className="overflow-x-auto">
            {activeTab === 'contratos' ? (
              <table className="w-full text-left">
                <thead className="bg-cream-50">
                  <tr>
                    <th className="table-head">Imóvel / Tipo</th>
                    <th className="table-head">Locador / Locatário</th>
                    <th className="table-head">Venc. / Aluguel</th>
                    <th className="table-head">Status</th>
                    <th className="table-head text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {contratos.filter(c => {
                    const matchBusca = (c.proprietario||'').toLowerCase().includes(search.toLowerCase()) || (c.inquilino||'').toLowerCase().includes(search.toLowerCase())
                    if (!matchBusca) return false;
                    if (filterStatus === 'Todos') return true;
                    if (filterStatus === 'Vencendo') {
                      const vStatus = getVencimentoStatus(c.vencimento);
                      return vStatus !== null && c.status === 'Ativo';
                    }
                    return c.status === filterStatus;
                  }).map(c => {
                    const vStatus = c.status === 'Ativo' ? getVencimentoStatus(c.vencimento) : null;
                    return (
                    <tr key={c.id} className="table-row hover:bg-cream-50">
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl ${c.tipo_imovel === 'Avulso' ? 'bg-gray-100 text-gray-500' : 'bg-brand-50 text-brand-600'}`}>
                            {c.tipo_imovel === 'Avulso' ? <Home size={18} /> : <Building size={18} />}
                          </div>
                          <div>
                            <p className="font-bold text-gray-800 text-sm">{c.tipo_imovel === 'Condomínio' ? c.condominio : 'Imóvel Avulso'}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{c.tipo_imovel === 'Avulso' ? c.endereco : `Apt/Unidade ${c.apt}`}</p>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell">
                        <p className="text-sm font-semibold text-brand-700">L: {c.proprietario}</p>
                        <p className="text-xs font-medium text-gray-600 mt-0.5">I: {c.inquilino}</p>
                      </td>
                      <td className="table-cell">
                        <p className="text-sm font-bold text-gray-800">R$ {Number(c.valor_aluguel||0).toFixed(2)}</p>
                        <p className="text-xs text-gray-500 font-medium mt-0.5">Dia {c.vencimento} • Taxa {c.taxa_adm}%</p>
                        {vStatus && <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${vStatus.bg} ${vStatus.color}`}>{vStatus.text}</span>}
                      </td>
                      <td className="table-cell">
                        <span className={`px-2 py-1 rounded-md text-xs font-bold border ${c.status === 'Ativo' ? 'bg-green-50 text-green-700 border-green-200' : c.status === 'Encerrado' ? 'bg-gray-100 text-gray-600 border-gray-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{c.status}</span>
                      </td>
                      <td className="table-cell text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handleCreateRepasse(c)} className="p-1.5 bg-yellow-50 text-yellow-600 rounded-lg hover:bg-yellow-100 border border-yellow-200 transition-colors" title="Gerar Repasse"><DollarSign size={14}/></button>
                          <button onClick={() => setShowContratoModal(c)} className="p-1.5 bg-cream-100 text-brand-600 rounded-lg hover:bg-brand-100 transition-colors" title="Editar"><Edit2 size={14}/></button>
                          <button onClick={() => delContrato(c.id)} className="p-1.5 bg-cream-100 text-red-500 rounded-lg hover:bg-red-50 transition-colors" title="Excluir"><Trash2 size={14}/></button>
                        </div>
                      </td>
                    </tr>
                  )})}
                  {contratos.length === 0 && <tr><td colSpan="5" className="py-12 text-center text-gray-400 text-sm">Nenhum contrato encontrado.</td></tr>}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-cream-50">
                  <tr>
                    <th className="table-head">Mês Ref.</th>
                    <th className="table-head">Proprietário (Locador)</th>
                    <th className="table-head">Recebido / Taxa Adm</th>
                    <th className="table-head">Valor do Repasse</th>
                    <th className="table-head">Status</th>
                    <th className="table-head text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {repasses.filter(r => (r.proprietario||'').toLowerCase().includes(search.toLowerCase())).map(r => (
                    <tr key={r.id} className="table-row hover:bg-cream-50">
                      <td className="table-cell font-bold text-gray-700">{r.mes_ref}</td>
                      <td className="table-cell">
                        <p className="text-sm font-semibold text-gray-800">{r.proprietario}</p>
                        <p className="text-[11px] text-gray-500 uppercase tracking-wide mt-0.5">Ref: {r.inquilino}</p>
                      </td>
                      <td className="table-cell text-sm">
                        <p className="text-gray-800 font-medium">Rec: R$ {Number(r.valor_recebido||0).toFixed(2)}</p>
                        <p className="text-red-500 text-xs font-semibold mt-0.5">Taxa: R$ {Number(r.taxa_retida||0).toFixed(2)}</p>
                      </td>
                      <td className="table-cell font-bold text-emerald-600 text-lg">R$ {Number(r.valor_repasse||0).toFixed(2)}</td>
                      <td className="table-cell">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${r.status === 'Realizado' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>{r.status}</span>
                      </td>
                      <td className="table-cell text-right">
                        <div className="flex justify-end gap-2 items-center">
                          {r.status === 'Pendente' && <button onClick={() => handleSaveRepasse({ ...r, status: 'Realizado' })} className="px-3 py-1 bg-emerald-50 text-emerald-600 font-bold text-xs rounded-lg hover:bg-emerald-100 border border-emerald-200 transition-colors uppercase tracking-wider">Marcar Pago</button>}
                          <button onClick={() => setShowRepasseModal(r)} className="p-1.5 text-gray-400 hover:text-brand-600 bg-cream-100 hover:bg-brand-50 rounded-lg transition-colors"><Edit2 size={14}/></button>
                          <button onClick={() => delRepasse(r.id)} className="p-1.5 text-gray-400 hover:text-red-600 bg-cream-100 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {repasses.length === 0 && <tr><td colSpan="6" className="py-12 text-center text-gray-400 text-sm">Nenhum repasse registrado.</td></tr>}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
      
      {showContratoModal && <LocacaoModal data={showContratoModal !== true ? showContratoModal : null} onClose={() => setShowContratoModal(false)} onSave={handleSaveContrato} condominios={condominios} />}
      {showRepasseModal && <RepasseModal data={showRepasseModal !== true ? showRepasseModal : null} onClose={() => setShowRepasseModal(false)} onSave={handleSaveRepasse} />}
    </div>
  )
}
