import React, { useState, useEffect } from 'react'
import { Wrench, Plus, CheckCircle, Clock, Trash2, Calendar, AlertCircle, ShoppingBag, ExternalLink, Briefcase, FileText, Printer } from 'lucide-react'
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
            <input className="input" value={form.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Ex: Limpeza de Caixa D'água" autoFocus />
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

function ModalDemanda({ data, condominios, onClose, onSave }) {
  const [form, setForm] = useState(data || {
    titulo: '', categoria: 'Manutenção', descricao: '', prazoLimite: '', condominio: '', status: 'Aberta'
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">{data ? 'Editar Cotação' : 'Nova Demanda de Cotação'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Título da Demanda</label>
            <input className="input" value={form.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Ex: Orçamento para pintura da fachada" autoFocus />
          </div>
          <div className="col-span-2">
            <label className="label">Condomínio</label>
            <select className="input" value={form.condominio || ''} onChange={e => set('condominio', e.target.value)}>
              <option value="">Selecione um condomínio...</option>
              {condominios?.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Categoria</label>
            <select className="input" value={form.categoria} onChange={e => set('categoria', e.target.value)}>
              <option>Manutenção</option>
              <option>Obras</option>
              <option>Limpeza / Conservação</option>
              <option>Segurança</option>
              <option>Outros</option>
            </select>
          </div>
          <div>
            <label className="label">Prazo Limite p/ Envio</label>
            <input type="date" className="input" value={form.prazoLimite} onChange={e => set('prazoLimite', e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="label">Status da Demanda</label>
            <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
              <option>Aberta</option>
              <option>Fechada</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">Descrição Detalhada do Escopo</label>
            <textarea className="input min-h-[120px]" value={form.descricao} onChange={e => set('descricao', e.target.value)} placeholder="Explique aos fornecedores exatamente o que você precisa que seja feito para eles orçarem..." />
          </div>
        </div>
        <div className="p-6 border-t border-cream-300 flex justify-between items-center gap-3">
          <p className="text-[10px] text-gray-400 max-w-[200px]">Ao salvar, esta demanda ficará pública no Portal de Fornecedores.</p>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary">Cancelar</button>
            <button onClick={() => { if (!form.titulo || !form.condominio) { alert('Preencha título e condomínio'); return; } onSave(form) }} className="btn-primary">Publicar Demanda</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ModalProposta({ proposta, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content md:max-w-xl" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between bg-brand-50">
          <h3 className="font-bold text-brand-900 flex items-center gap-2"><Briefcase size={18}/> Detalhes da Proposta Comercial</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div className="bg-white border border-cream-200 p-4 rounded-xl shadow-sm">
            <p className="text-xs font-bold text-gray-500 uppercase">Referente à Demanda:</p>
            <p className="font-bold text-gray-800">{proposta.demandaTitulo}</p>
            <p className="text-sm text-brand-600">{proposta.condominio}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase">Empresa</p>
              <p className="font-semibold text-gray-800">{proposta.empresa}</p>
              <p className="text-xs text-gray-500">CNPJ: {proposta.cnpj || 'Não inf.'}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase">Contato</p>
              <p className="font-semibold text-gray-800">{proposta.contato}</p>
              <p className="text-xs text-brand-600 font-bold">{proposta.telefone}</p>
            </div>
            <div className="col-span-2 mt-2">
              <p className="text-xs font-bold text-gray-500 uppercase">Valor Ofertado</p>
              <p className="text-2xl font-black text-emerald-600">R$ {Number(proposta.valor).toLocaleString('pt-BR', {minimumFractionDigits:2})}</p>
            </div>
            <div className="col-span-2 mt-2">
              <p className="text-xs font-bold text-gray-500 uppercase mb-1">Resumo / Descrição Técnica</p>
              <div className="bg-cream-50 p-4 rounded-xl border border-cream-200 text-sm text-gray-700 whitespace-pre-wrap">
                {proposta.propostaTexto}
              </div>
            </div>
          </div>
        </div>
        <div className="p-6 border-t border-cream-300 flex justify-end gap-3 bg-gray-50">
          <button onClick={onClose} className="btn-secondary">Fechar</button>
          <a href={`https://wa.me/${proposta.telefone.replace(/\D/g, '')}?text=Olá!%20Vimos%20sua%20proposta%20no%20Portal%20da%20Alpha%20Gestão.`} target="_blank" rel="noreferrer" className="btn-primary bg-green-500 hover:bg-green-600 border-none">
            Chamar no WhatsApp
          </a>
        </div>
      </div>
    </div>
  )
}

export default function Manutencoes() {
  const { user } = useAuth()
  const isMorador = user?.role === 'Morador'
  const isAdminOrSindico = ['Administrador', 'Síndico'].includes(user?.role)
  
  const [tab, setTab] = useState('cronograma') // cronograma, cotacoes
  
  const { items: manutencoes, addItem, updateItem, deleteItem } = useFirestore('manutencoes')
  const { items: demandas, addItem: addDemanda, updateItem: updateDemanda, deleteItem: delDemanda } = useFirestore('demandas_cotacao')
  const { items: propostas, deleteItem: delProposta } = useFirestore('propostas_fornecedores')
  const { items: condominios } = useFirestore('condominios')
  
  const [modalManu, setModalManu] = useState(null)
  const [modalDemanda, setModalDemanda] = useState(null)
  const [modalProposta, setModalProposta] = useState(null)
  
  const [condoFiltro, setCondoFiltro] = useState(isMorador ? user?.condominio : 'Todos')

  // Cronograma Visuals
  const hojeStr = new Date().toISOString().split('T')[0]
  const viewManutencoes = manutencoes
    .filter(m => {
      if (isMorador && user?.condominio && m.condominio !== user.condominio) return false
      if (!isMorador && condoFiltro !== 'Todos' && m.condominio !== condoFiltro) return false
      return true
    })
    .map(m => {
      let statusVisual = m.status
      if (m.status !== 'Concluída' && m.dataPrevista < hojeStr) {
        statusVisual = 'Atrasada'
      }
      return { ...m, statusVisual }
    }).sort((a,b) => new Date(a.dataPrevista) - new Date(b.dataPrevista))

  const handleSaveManu = async (form) => {
    if (form.id) await updateItem(form.id, form)
    else await addItem(form)
    setModalManu(null)
  }

  const handleSaveDemanda = async (form) => {
    if (form.id) await updateItem(form.id, form)
    else await addDemanda(form)
    setModalDemanda(null)
  }

  const getStatusStyle = (status) => {
    switch (status) {
      case 'Concluída': return 'text-emerald-700 bg-emerald-50 border-emerald-200'
      case 'Atrasada': return 'text-red-700 bg-red-50 border-red-200'
      case 'Em Andamento': return 'text-amber-700 bg-amber-50 border-amber-200'
      default: return 'text-blue-700 bg-blue-50 border-blue-200'
    }
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in w-full h-full print:bg-white print:p-0">
      <div className="page-header print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="section-title text-xl flex items-center gap-2"><Wrench className="text-brand-600"/> Manutenção Inteligente e Compras</h2>
          <p className="section-sub">Controle o cronograma de ativos e receba propostas de fornecedores pelo Portal Público.</p>
        </div>
        <div className="flex items-center gap-3">
          {!isMorador && (
            <select
              className="input py-2 text-xs font-bold text-gray-800 bg-white border-gray-300 rounded-xl"
              value={condoFiltro}
              onChange={e => setCondoFiltro(e.target.value)}
            >
              <option value="Todos">🏢 Todos os Condomínios</option>
              {condominios.map(c => (
                <option key={c.id || c.nome} value={c.nome}>{c.nome}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="flex gap-2 border-b border-cream-300 pb-2 print:hidden">
        <button onClick={() => setTab('cronograma')} className={`px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${tab==='cronograma'?'bg-brand-600 text-white shadow-md':'bg-white text-gray-500 hover:text-brand-700 border border-cream-400'}`}>
          <Calendar size={16}/> Cronograma Preventivo
        </button>
        <button onClick={() => setTab('cotacoes')} className={`px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${tab==='cotacoes'?'bg-brand-600 text-white shadow-md':'bg-white text-gray-500 hover:text-brand-700 border border-cream-400'}`}>
          <ShoppingBag size={16}/> Central de Cotações / Licitações
        </button>
      </div>

      {/* Relatório de Impressão (Visível apenas na impressão) */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-black text-center mb-2">Relatório de Manutenções Preventivas</h1>
        <p className="text-center text-gray-500 mb-6">Gerado em: {new Date().toLocaleDateString('pt-BR')}</p>
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="border border-gray-300 p-4 rounded text-center">
            <p className="text-sm text-gray-500 uppercase">Total Agendadas</p>
            <p className="text-2xl font-bold">{viewManutencoes.length}</p>
          </div>
          <div className="border border-gray-300 p-4 rounded text-center">
            <p className="text-sm text-gray-500 uppercase">Em Atraso</p>
            <p className="text-2xl font-bold text-red-600">{viewManutencoes.filter(m=>m.statusVisual==='Atrasada').length}</p>
          </div>
          <div className="border border-gray-300 p-4 rounded text-center">
            <p className="text-sm text-gray-500 uppercase">Custo Previsto Global</p>
            <p className="text-2xl font-bold text-emerald-600">R$ {viewManutencoes.reduce((acc, m) => acc + (Number(m.custoEstimado)||0), 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</p>
          </div>
        </div>
      </div>

      {tab === 'cronograma' && (
        <>
          <div className="flex justify-between items-center print:hidden">
            <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-cream-200 shadow-sm">
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold">Total Previsto</p>
                <p className="text-lg font-black text-brand-700">R$ {viewManutencoes.reduce((acc, m) => acc + (Number(m.custoEstimado)||0), 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</p>
              </div>
              <div className="w-px h-8 bg-cream-200"></div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold">Atrasadas</p>
                <p className="text-lg font-black text-red-600">{viewManutencoes.filter(m=>m.statusVisual==='Atrasada').length}</p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button onClick={handlePrint} className="btn-secondary py-2 px-4 text-sm bg-white border-cream-300">
                <Printer size={16} /> Gerar PDF / Relatório
              </button>
              {isAdminOrSindico && (
                <button onClick={() => setModalManu({})} className="btn-primary py-2 px-4 text-sm">
                  <Plus size={16} /> Agendar Manutenção
                </button>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 print:grid-cols-2 print:gap-4">
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
                        <button onClick={() => setModalManu(m)} className="text-gray-400 hover:text-brand-600"><Wrench size={14}/></button>
                        <button onClick={() => deleteItem(m.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={14}/></button>
                      </div>
                    )}
                  </div>
                  <h3 className="font-bold text-gray-800 text-lg leading-tight mb-1">{m.titulo}</h3>
                  <p className="text-sm text-gray-500 mb-2">{m.fornecedor || 'Fornecedor a definir'}</p>
                  <div className="mb-4 flex flex-wrap gap-1">
                    <span className="inline-block px-2 py-1 bg-cream-200 text-gray-600 rounded text-[10px] uppercase font-bold">
                      {m.condominio ? `🏢 ${m.condominio}` : '🌐 Todos / Geral'}
                    </span>
                    {m.recorrencia !== 'Nenhuma' && (
                      <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded text-[10px] uppercase font-bold flex items-center gap-1">
                        <Clock size={10}/> {m.recorrencia}
                      </span>
                    )}
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
                      <span className="text-gray-500 flex items-center gap-1.5"><AlertCircle size={14}/> Custo Previsto</span>
                      <span className="font-semibold text-gray-700">R$ {Number(m.custoEstimado).toLocaleString('pt-BR', {minimumFractionDigits:2})}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'cotacoes' && (
        <div className="flex flex-col gap-6">
          <div className="card bg-brand-900 text-white flex flex-col md:flex-row items-center justify-between gap-4 p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4"></div>
            <div className="relative z-10">
              <h3 className="text-xl font-bold mb-1">Mural de Licitações Público</h3>
              <p className="text-brand-200 text-sm max-w-2xl">
                Crie demandas de serviços ou materiais (ex: Limpeza de Caixa D'água, Pintura) e deixe os fornecedores da região enviarem as propostas diretamente pelo portal online.
              </p>
            </div>
            <div className="relative z-10 flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <a href="/fornecedores" target="_blank" rel="noreferrer" className="btn-secondary bg-white/10 border-white/20 text-white hover:bg-white/20 whitespace-nowrap">
                <ExternalLink size={14}/> Ver Portal
              </a>
              {isAdminOrSindico && (
                <button onClick={() => setModalDemanda({})} className="btn-primary bg-emerald-500 hover:bg-emerald-600 border-none whitespace-nowrap">
                  <Plus size={16}/> Abrir Demanda
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Coluna 1: Demandas Abertas */}
            <div className="card p-0 overflow-hidden flex flex-col shadow-sm">
              <div className="p-4 border-b border-cream-300 bg-cream-50 flex items-center justify-between">
                <h3 className="font-bold text-gray-800 flex items-center gap-2"><Briefcase size={16}/> Demandas Criadas</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar max-h-[500px] flex flex-col gap-3">
                {demandas.length === 0 && <p className="text-sm text-gray-400 text-center py-6">Nenhuma demanda criada.</p>}
                {demandas.map(d => (
                  <div key={d.id} className="border border-cream-200 rounded-xl p-4 bg-white hover:border-brand-300 transition-all group">
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${d.status==='Aberta'?'bg-emerald-100 text-emerald-700':'bg-gray-200 text-gray-600'}`}>{d.status}</span>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setModalDemanda(d)} className="text-gray-400 hover:text-brand-600"><Wrench size={14}/></button>
                        <button onClick={() => {if(window.confirm('Excluir demanda?')) delDemanda(d.id)}} className="text-gray-400 hover:text-red-600"><Trash2 size={14}/></button>
                      </div>
                    </div>
                    <h4 className="font-bold text-gray-800 text-sm mb-1">{d.titulo}</h4>
                    <p className="text-[11px] text-brand-600 font-medium mb-2">🏢 {d.condominio}</p>
                    <p className="text-xs text-gray-500 line-clamp-2">{d.descricao}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Coluna 2: Propostas Recebidas */}
            <div className="card p-0 overflow-hidden flex flex-col shadow-sm border-brand-200 border-2">
              <div className="p-4 border-b border-brand-200 bg-brand-50 flex items-center justify-between">
                <h3 className="font-bold text-brand-900 flex items-center gap-2"><FileText size={16}/> Orçamentos Recebidos</h3>
                <span className="bg-brand-600 text-white text-xs font-bold px-2 py-1 rounded-full">{propostas.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar max-h-[500px] flex flex-col gap-3">
                {propostas.length === 0 && <p className="text-sm text-gray-400 text-center py-6">Nenhuma proposta recebida dos fornecedores ainda.</p>}
                {propostas.map(p => (
                  <div key={p.id} className="border border-cream-200 rounded-xl p-4 bg-white hover:shadow-md transition-all cursor-pointer relative" onClick={() => setModalProposta(p)}>
                    <button onClick={(e) => {e.stopPropagation(); delProposta(p.id)}} className="absolute top-4 right-4 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={14}/></button>
                    <p className="text-[10px] text-gray-400 font-bold uppercase mb-1 line-clamp-1 pr-6">Ref: {p.demandaTitulo}</p>
                    <h4 className="font-bold text-gray-800 mb-1">{p.empresa}</h4>
                    <p className="text-xs text-gray-500 mb-3">{p.contato} • {p.telefone}</p>
                    <div className="flex items-center justify-between bg-emerald-50 text-emerald-700 px-3 py-2 rounded-lg border border-emerald-100">
                      <span className="text-xs font-bold">Valor Ofertado</span>
                      <span className="font-black">R$ {Number(p.valor).toLocaleString('pt-BR', {minimumFractionDigits:2})}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {modalManu && <ModalManutencao data={modalManu.id ? modalManu : null} condominios={condominios} onClose={() => setModalManu(null)} onSave={handleSaveManu} />}
      {modalDemanda && <ModalDemanda data={modalDemanda.id ? modalDemanda : null} condominios={condominios} onClose={() => setModalDemanda(null)} onSave={handleSaveDemanda} />}
      {modalProposta && <ModalProposta proposta={modalProposta} onClose={() => setModalProposta(null)} />}
    </div>
  )
}
