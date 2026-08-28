import React, { useState, useEffect, useRef } from 'react'
import { Briefcase, Plus, Search, Edit2, Trash2, Star, QrCode, Printer, CheckCircle2, Clock, MapPin, Building2, User, Camera, Calendar, FileText, Phone, Mail, ChevronRight } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { QRCodeSVG } from 'qrcode.react'

function Modal({ data, onClose, onSave, condominios }) {
  const [form, setForm] = useState(data || {
    nome: '',
    servico: '',
    contato: '',
    email: '',
    valor: '',
    condominio: 'Todos',
    avaliacao: 5,
    status: 'Ativo'
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">{data ? 'Editar Fornecedor / Prestador' : 'Novo Fornecedor / Prestador'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Nome do Prestador / Razão Social *</label>
            <input className="input" value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Ex: Alpha Elevadores / João Piscineiro" required />
          </div>
          <div className="col-span-2">
            <label className="label">Serviço Prestado *</label>
            <input className="input" value={form.servico} onChange={e => set('servico', e.target.value)} placeholder="Ex: Manutenção de Bombas e Elevadores" required />
          </div>
          <div>
            <label className="label">Telefone / WhatsApp</label>
            <input className="input" value={form.contato} onChange={e => set('contato', e.target.value)} placeholder="(00) 00000-0000" />
          </div>
          <div>
            <label className="label">E-mail</label>
            <input className="input" value={form.email} onChange={e => set('email', e.target.value)} placeholder="contato@empresa.com" />
          </div>
          <div>
            <label className="label">Valor Médio / Contrato</label>
            <input className="input" value={form.valor} onChange={e => set('valor', e.target.value)} placeholder="Ex: R$ 450,00/mês ou R$ 150/visita" />
          </div>
          <div>
            <label className="label">Condomínio Principal</label>
            <select className="input" value={form.condominio || 'Todos'} onChange={e => set('condominio', e.target.value)}>
              <option value="Todos">Todos os Condomínios</option>
              {condominios.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
              <option>Ativo</option>
              <option>Eventual</option>
              <option>Inativo</option>
            </select>
          </div>
          <div>
            <label className="label">Avaliação do Serviço</label>
            <select className="input font-bold text-amber-600" value={form.avaliacao} onChange={e => set('avaliacao', Number(e.target.value))}>
              <option value={5}>⭐⭐⭐⭐⭐ (5 estrelas - Excelente)</option>
              <option value={4}>⭐⭐⭐⭐ (4 estrelas - Bom)</option>
              <option value={3}>⭐⭐⭐ (3 estrelas - Regular)</option>
            </select>
          </div>
        </div>
        <div className="p-6 border-t border-cream-300 flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={() => onSave(form)} className="btn-primary">Salvar Prestador</button>
        </div>
      </div>
    </div>
  )
}

function ModalPlacaQRCode({ condo, onClose }) {
  const urlCheckin = `https://alpha-solucoes-condominiais.vercel.app/checkin-prestador?condo=${encodeURIComponent(condo || '')}`

  const handleImprimir = () => {
    window.print()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-xl" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-cream-300 flex items-center justify-between no-print">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <QrCode size={18} className="text-brand-600" /> Placa de Check-in para Imprimir
          </h3>
          <div className="flex items-center gap-2">
            <button onClick={handleImprimir} className="btn-primary py-1.5 px-3 text-xs font-black bg-brand-700 hover:bg-brand-600 flex items-center gap-1.5 shadow-sm">
              <Printer size={14} /> Imprimir Placa
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1">✕</button>
          </div>
        </div>

        {/* ÁREA DA PLACA A4 IMPRIMÍVEL */}
        <div className="p-8 text-center bg-white border-4 border-brand-800 rounded-3xl m-4 space-y-6 shadow-md print:m-0 print:border-8">
          <div className="space-y-1">
            <span className="text-[11px] font-black uppercase tracking-widest text-brand-700 bg-brand-50 px-3 py-1 rounded-full border border-brand-200">
              Alpha Soluções Condominiais
            </span>
            <h2 className="text-2xl font-black text-slate-900 mt-2">
              {condo || 'Condomínio'}
            </h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
              Controle de Entrada & Saída de Terceirizados
            </p>
          </div>

          <div className="p-4 bg-slate-50 border-2 border-dashed border-brand-300 rounded-3xl w-fit mx-auto shadow-inner">
            <QRCodeSVG value={urlCheckin} size={220} level="H" includeMargin={true} />
          </div>

          <div className="space-y-2 max-w-sm mx-auto">
            <h4 className="font-black text-slate-900 text-sm">
              📲 PRESTADOR / TERCEIRIZADO:
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              1. Aponte a câmera do seu celular para este QR Code.<br />
              2. Registre sua <b>Entrada</b> ao iniciar o trabalho.<br />
              3. Ao terminar, aponte novamente e registre sua <b>Saída com foto</b>.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-200 text-[10px] text-slate-400 font-medium flex items-center justify-between">
            <span>Registro Oficial com Horário e GPS</span>
            <span>Alpha ADM</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Prestadores() {
  const { items: prestadores, addItem, updateItem, deleteItem } = useFirestore('prestadores')
  const { items: atendimentos } = useFirestore('prestadores_atendimentos')
  const { items: condominios } = useFirestore('condominios')

  const [activeTab, setActiveTab] = useState('cadastro') // 'cadastro' | 'atendimentos'
  const [search, setSearch] = useState('')
  const [filtroCondo, setFiltroCondo] = useState('Todos')
  const [modal, setModal] = useState(null)
  const [modalPlaca, setModalPlaca] = useState(false)

  const filteredPrestadores = prestadores.filter(i => {
    const matchSearch = i.nome.toLowerCase().includes(search.toLowerCase()) || i.servico.toLowerCase().includes(search.toLowerCase())
    const matchCondo = filtroCondo === 'Todos' || !i.condominio || i.condominio === 'Todos' || i.condominio === filtroCondo
    return matchSearch && matchCondo
  })

  const filteredAtendimentos = atendimentos.filter(a => {
    const matchSearch = (a.nome || '').toLowerCase().includes(search.toLowerCase()) || (a.servico || '').toLowerCase().includes(search.toLowerCase()) || (a.empresa || '').toLowerCase().includes(search.toLowerCase())
    const matchCondo = filtroCondo === 'Todos' || a.condominio === filtroCondo
    return matchSearch && matchCondo
  }).sort((a, b) => new Date(b.entradaISO || 0) - new Date(a.entradaISO || 0))

  const handleSave = async (form) => {
    if (modal === 'new') await addItem(form)
    else await updateItem(modal.id, form)
    setModal(null)
  }

  const emAndamentoCount = atendimentos.filter(a => a.status === 'Em Andamento').length

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="section-title text-xl">Fornecedores & Prestadores Terceirizados</h2>
          <p className="section-sub">Cadastro de parceiros, emissão de placas QR Code e registro de presença em tempo real</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setModalPlaca(true)}
            className="btn-secondary py-2.5 px-3.5 text-xs font-black bg-indigo-50 text-indigo-900 border-indigo-300 hover:bg-indigo-100 flex items-center gap-1.5 shadow-sm"
          >
            <QrCode size={16} className="text-indigo-600" /> Imprimir Placa QR Code
          </button>
          <button
            onClick={() => setModal('new')}
            className="btn-primary py-2.5 px-4 text-xs font-black flex items-center gap-1.5 shadow-md"
          >
            <Plus size={16} /> Novo Prestador
          </button>
        </div>
      </div>

      {/* Abas de Navegação */}
      <div className="flex gap-2 p-1 bg-cream-200/50 border border-cream-300 rounded-xl w-fit flex-wrap">
        <button
          onClick={() => setActiveTab('cadastro')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${activeTab === 'cadastro' ? 'bg-white shadow-sm text-brand-700' : 'text-gray-500 hover:text-brand-600 hover:bg-white/50'}`}
        >
          <Briefcase size={16} /> Fornecedores Cadastrados ({prestadores.length})
        </button>
        <button
          onClick={() => setActiveTab('atendimentos')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all relative ${activeTab === 'atendimentos' ? 'bg-white shadow-sm text-brand-700' : 'text-gray-500 hover:text-brand-600 hover:bg-white/50'}`}
        >
          <Clock size={16} /> Presença & Check-in QR Code
          {emAndamentoCount > 0 && (
            <span className="bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
              {emAndamentoCount} no local
            </span>
          )}
        </button>
      </div>

      {/* Barra de Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            className="input pl-9 text-xs"
            placeholder={activeTab === 'cadastro' ? "Buscar por prestador, serviço ou empresa..." : "Buscar por nome do terceirizado, empresa ou serviço..."}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="relative sm:w-64">
          <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <select
            className="input pl-9 text-xs font-bold"
            value={filtroCondo}
            onChange={e => setFiltroCondo(e.target.value)}
          >
            <option value="Todos">Todos os Condomínios</option>
            {condominios.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
          </select>
        </div>
      </div>

      {/* ABA 1: FORNECEDORES CADASTRADOS */}
      {activeTab === 'cadastro' && (
        prestadores.length === 0 ? (
          <div className="card text-center py-12 text-gray-400 text-sm">
            <Briefcase size={36} className="mx-auto mb-2 opacity-30 text-gray-400" />
            Nenhum fornecedor ou prestador cadastrado ainda.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPrestadores.map(item => (
              <div key={item.id} className="card hover:border-brand-300 transition-all group flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center border border-amber-200 text-amber-700 font-black text-sm">
                      {item.nome?.[0] || 'P'}
                    </div>
                    <span className={item.status === 'Ativo' ? 'badge-green' : item.status === 'Eventual' ? 'badge-yellow' : 'badge-red'}>
                      {item.status}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-900 text-base">{item.nome}</h3>
                  <p className="text-xs font-semibold text-brand-600 mb-1">{item.servico}</p>
                  
                  <div className="flex gap-0.5 mb-3">
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star key={s} size={12} className={s <= (item.avaliacao || 5) ? 'text-amber-400 fill-amber-400' : 'text-gray-300'} />
                    ))}
                  </div>

                  <div className="space-y-1 text-xs text-gray-500 pt-2 border-t border-gray-100">
                    {item.contato && <p className="flex items-center gap-1.5"><Phone size={12} className="text-gray-400" /> {item.contato}</p>}
                    {item.email && <p className="flex items-center gap-1.5"><Mail size={12} className="text-gray-400" /> {item.email}</p>}
                    <p className="flex items-center gap-1.5 font-bold text-gray-700">🏢 {item.condominio || 'Todos os Condomínios'}</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-cream-300 flex items-center justify-between mt-4">
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Valor / Custo</p>
                    <p className="text-xs font-black text-emerald-700">{item.valor || 'A combinar'}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => setModal(item)} className="p-1.5 rounded-lg bg-cream-200 hover:bg-brand-100 text-gray-400 hover:text-brand-700 transition-all"><Edit2 size={13} /></button>
                    <button onClick={() => { if (window.confirm(`Deseja remover ${item.nome}?`)) deleteItem(item.id) }} className="p-1.5 rounded-lg bg-cream-200 hover:bg-red-100 text-gray-400 hover:text-red-500 transition-all"><Trash2 size={13} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ABA 2: HISTÓRICO & PRESENÇA DE TERCEIRIZADOS (CHECK-IN QR CODE) */}
      {activeTab === 'atendimentos' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-blue-900">
            <div className="flex items-center gap-3">
              <QrCode size={24} className="text-blue-600 shrink-0" />
              <div>
                <p className="font-bold">Como funciona a comprovação de terceirizados?</p>
                <p className="text-blue-700 mt-0.5">
                  O prestador (limpeza, piscina, elevador, etc.) aponta a câmera para a placa QR Code do condomínio ao chegar e ao sair, registrando horários, duração e fotos do serviço realizado.
                </p>
              </div>
            </div>
            <button
              onClick={() => setModalPlaca(true)}
              className="btn-primary py-1.5 px-3 text-xs font-black bg-blue-700 hover:bg-blue-600 shrink-0 whitespace-nowrap"
            >
              Ver Placa QR Code
            </button>
          </div>

          {filteredAtendimentos.length === 0 ? (
            <div className="card text-center py-12 text-gray-400 text-sm">
              <Clock size={36} className="mx-auto mb-2 opacity-30 text-gray-400" />
              Nenhum registro de check-in de terceirizados encontrado.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAtendimentos.map(atend => {
                const emAndamento = atend.status === 'Em Andamento'

                return (
                  <div
                    key={atend.id}
                    className={`p-4 rounded-2xl border transition-all ${emAndamento ? 'bg-white border-emerald-400 shadow-sm' : 'bg-slate-50 border-gray-200'}`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start gap-3.5">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-sm ${emAndamento ? 'bg-emerald-600 text-white animate-pulse' : 'bg-slate-700 text-white'}`}>
                          {emAndamento ? '🟢' : '✓'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-black text-gray-900 text-base">{atend.nome}</h4>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${emAndamento ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-200 text-slate-800'}`}>
                              {atend.status}
                            </span>
                            <span className="text-xs font-bold text-gray-600 bg-white border border-gray-200 px-2 py-0.5 rounded-md">
                              🏢 {atend.condominio}
                            </span>
                          </div>

                          <p className="text-xs font-semibold text-brand-700 mt-0.5">
                            {atend.servico} • {atend.empresa || 'Autônomo'} {atend.telefone ? `• 📞 ${atend.telefone}` : ''}
                          </p>

                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-600 flex-wrap">
                            <span className="bg-white px-2 py-1 rounded border border-gray-200 font-bold">
                              📅 Data: {atend.entradaData || 'Hoje'}
                            </span>
                            <span className="bg-white px-2 py-1 rounded border border-gray-200 font-bold text-emerald-700">
                              🟢 Entrada: {atend.entradaHora}
                            </span>
                            {atend.saidaHora && (
                              <span className="bg-white px-2 py-1 rounded border border-gray-200 font-bold text-rose-700">
                                🔴 Saída: {atend.saidaHora}
                              </span>
                            )}
                            {atend.duracao && (
                              <span className="bg-amber-100 text-amber-900 px-2 py-1 rounded font-black border border-amber-300">
                                ⏳ Tempo Total: {atend.duracao}
                              </span>
                            )}
                          </div>

                          {/* Fotos de Comprovação */}
                          {(atend.fotoEntrada || atend.fotoSaida) && (
                            <div className="flex items-center gap-3 mt-3">
                              {atend.fotoEntrada && (
                                <div>
                                  <span className="text-[10px] text-gray-400 font-bold block mb-1">Foto Entrada</span>
                                  <img src={atend.fotoEntrada} alt="Entrada" className="w-14 h-14 object-cover rounded-xl border border-gray-300 shadow-sm cursor-pointer" onClick={() => window.open(atend.fotoEntrada, '_blank')} />
                                </div>
                              )}
                              {atend.fotoSaida && (
                                <div>
                                  <span className="text-[10px] text-gray-400 font-bold block mb-1">Foto Conclusão</span>
                                  <img src={atend.fotoSaida} alt="Saída" className="w-14 h-14 object-cover rounded-xl border border-gray-300 shadow-sm cursor-pointer" onClick={() => window.open(atend.fotoSaida, '_blank')} />
                                </div>
                              )}
                            </div>
                          )}

                          {atend.observacoesSaida && (
                            <p className="mt-2 text-xs bg-white p-2 rounded-lg border border-gray-200 text-gray-700">
                              <b>Relato do serviço:</b> {atend.observacoesSaida}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {modal && <Modal data={modal === 'new' ? null : modal} onClose={() => setModal(null)} onSave={handleSave} condominios={condominios} />}
      {modalPlaca && <ModalPlacaQRCode condo={filtroCondo === 'Todos' ? (condominios[0]?.nome || 'Alpha Condomínios') : filtroCondo} onClose={() => setModalPlaca(false)} />}
    </div>
  )
}
