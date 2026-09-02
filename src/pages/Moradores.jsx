import React, { useState } from 'react'
import { Users, Plus, Search, Edit2, Trash2, Phone, Mail, Filter, PawPrint, Home, UserCheck, LayoutGrid, Table as TableIcon, X } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'
import { collection, query, where, getDocs, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'

function MoradorModal({ data, onClose, onSave, isMorador, currentUser, initialApt, initialBloco, initialCondo }) {
  const [form, setForm] = useState(data || {
    nome: '',
    cpf: '',
    apt: initialApt || (isMorador ? (currentUser.unidade || currentUser.apt) : ''),
    bloco: initialBloco || (isMorador ? currentUser.bloco : ''),
    tel: '',
    email: '',
    status: isMorador ? 'Dependente' : 'Proprietário',
    condominio: initialCondo || (isMorador ? currentUser.condominio : ''),
    fotoRosto: ''
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleImage = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_WIDTH = 600
        const scaleSize = MAX_WIDTH / img.width
        canvas.width = MAX_WIDTH
        canvas.height = img.height * scaleSize
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const base64 = canvas.toDataURL('image/jpeg', 0.8)
        set('fotoRosto', base64)
      }
      img.src = event.target.result
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="p-4 sm:p-6 border-b border-cream-300 flex items-center justify-between gap-3">
          <h3 className="font-bold text-gray-800 text-base sm:text-lg min-w-0 flex-1 truncate">{data ? 'Editar Membro da Família' : 'Novo Morador / Familiar'}</h3>
          <button onClick={onClose} className="modal-close-btn" title="Fechar"><X size={20} strokeWidth={2.5} /></button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Nome Completo *</label>
            <input className="input uppercase" value={form.nome} onChange={e => set('nome', e.target.value.toUpperCase())} placeholder="EX: JOÃO DA SILVA" />
          </div>
          <div>
            <label className="label">CPF (Apenas números)</label>
            <input className="input" value={form.cpf || ''} onChange={e => set('cpf', e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="00000000000" />
          </div>
          <div>
            <label className="label">Grau / Vínculo *</label>
            <select className="input" value={form.status} onChange={e => set('status', e.target.value)} disabled={isMorador && form.status === 'Proprietário'}>
              {isMorador ? (
                <>
                  {form.status === 'Proprietário' && <option>Proprietário</option>}
                  <option>Dependente</option>
                  <option>Inquilino</option>
                </>
              ) : (
                <>
                  <option>Proprietário</option>
                  <option>Inquilino</option>
                  <option>Dependente</option>
                </>
              )}
            </select>
          </div>
          <div>
            <label className="label">Condomínio</label>
            <input className="input uppercase" value={form.condominio} onChange={e => set('condominio', e.target.value.toUpperCase())} disabled={isMorador} placeholder="NOME DO CONDOMÍNIO" />
          </div>
          <div>
            <label className="label">Apartamento / Unidade *</label>
            <input className="input font-bold uppercase" value={form.apt} onChange={e => set('apt', e.target.value.toUpperCase())} disabled={isMorador} placeholder="Ex: 101" />
          </div>
          <div>
            <label className="label">Bloco</label>
            <input className="input uppercase" value={form.bloco || ''} onChange={e => set('bloco', e.target.value.toUpperCase())} disabled={isMorador} placeholder="Ex: A" />
          </div>
          <div>
            <label className="label">Telefone / WhatsApp</label>
            <input className="input" value={form.tel} onChange={e => set('tel', e.target.value)} placeholder="(00) 00000-0000" />
          </div>
          <div className="col-span-2">
            <label className="label">E-mail</label>
            <input className="input" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@exemplo.com" />
          </div>

          <div className="col-span-2 border-t border-cream-200 mt-2 pt-4">
            <label className="label text-brand-700 font-bold">Reconhecimento Facial (Portaria)</label>
            <p className="text-xs text-gray-500 mb-3">Tire uma selfie bem iluminada do rosto para liberar o acesso facial na portaria/catraca.</p>
            {form.fotoRosto ? (
              <div className="flex items-center gap-4">
                <img src={form.fotoRosto} alt="Rosto" className="w-20 h-20 object-cover rounded-full border-4 border-brand-200 shadow-md" />
                <button onClick={() => set('fotoRosto', '')} className="btn-secondary text-red-500 hover:text-red-600 text-xs py-1 px-3">Remover Foto</button>
              </div>
            ) : (
              <input type="file" accept="image/*" capture="user" onChange={handleImage} className="input text-sm file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100" />
            )}
          </div>
        </div>
        <div className="p-6 border-t border-cream-300 flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={() => onSave(form)} className="btn-primary">Salvar Morador</button>
        </div>
      </div>
    </div>
  )
}

function PetModalRapido({ data, onClose, onSave, currentUser }) {
  const [form, setForm] = useState(data || {
    nome: '',
    tipo: 'Cachorro',
    raca: '',
    porte: 'Médio',
    condominio: currentUser?.condominio || '',
    apt: currentUser?.unidade || currentUser?.apt || '',
    bloco: currentUser?.bloco || '',
    dono: currentUser?.nome || '',
    foto: ''
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-4 sm:p-6 border-b border-cream-300 flex items-center justify-between gap-3">
          <h3 className="font-bold text-gray-800 text-base min-w-0 flex-1 truncate">🐾 {data ? 'Editar Pet' : 'Cadastrar Pet da Unidade'}</h3>
          <button onClick={onClose} className="modal-close-btn" title="Fechar"><X size={20} strokeWidth={2.5} /></button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Nome do Pet *</label>
            <input className="input" value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Ex: Thor, Mel..." />
          </div>
          <div>
            <label className="label">Espécie</label>
            <select className="input" value={form.tipo} onChange={e => set('tipo', e.target.value)}>
              <option>Cachorro</option>
              <option>Gato</option>
              <option>Pássaro</option>
              <option>Outro</option>
            </select>
          </div>
          <div>
            <label className="label">Porte</label>
            <select className="input" value={form.porte} onChange={e => set('porte', e.target.value)}>
              <option>Pequeno</option>
              <option>Médio</option>
              <option>Grande</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">Raça / Cor</label>
            <input className="input" value={form.raca} onChange={e => set('raca', e.target.value)} placeholder="Ex: Golden, Siamês..." />
          </div>
        </div>
        <div className="p-6 border-t border-cream-300 flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={() => onSave(form)} className="btn-primary">Salvar Pet</button>
        </div>
      </div>
    </div>
  )
}

export default function Moradores() {
  const { items: moradores, addItem, updateItem, deleteItem } = useFirestore('moradores')
  const { items: pets, addItem: addPet } = useFirestore('pets')
  const { user } = useAuth()
  const isMorador = user?.role === 'Morador'

  const [search, setSearch] = useState('')
  const [filtroCondominio, setFiltroCondominio] = useState('Todos')
  const [filtroApt, setFiltroApt] = useState('Todos')
  const [viewMode, setViewMode] = useState('agrupado')
  const [modal, setModal] = useState(null)
  const [modalPet, setModalPet] = useState(null)
  const [targetUnidade, setTargetUnidade] = useState(null)

  const condominiosUnicos = ['Todos', ...Array.from(new Set(moradores.map(m => m.condominio).filter(Boolean))).sort()]
  const aptsUnicos = ['Todos', ...Array.from(new Set(moradores.filter(m => filtroCondominio === 'Todos' || m.condominio === filtroCondominio).map(m => m.apt).filter(Boolean))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))]

  const filtered = moradores.filter(m => {
    if (isMorador) {
      const uApt = String(user?.unidade || user?.apt || '').replace(/\D/g, '')
      const mApt = String(m.apt || '').replace(/\D/g, '')
      const matchApt = uApt && mApt && uApt === mApt
      const matchCondo = !user?.condominio || m.condominio?.toLowerCase() === user?.condominio?.toLowerCase()
      return matchApt && matchCondo
    }
    const okSearch = m.nome?.toLowerCase().includes(search.toLowerCase()) || m.apt?.includes(search) || m.email?.includes(search)
    const okCondo = filtroCondominio === 'Todos' || m.condominio === filtroCondominio
    const okApt = filtroApt === 'Todos' || m.apt === filtroApt
    return okSearch && okCondo && okApt
  })

  const unidadesMap = {}
  filtered.forEach(m => {
    const condo = m.condominio || 'Sem Condomínio'
    const bloco = m.bloco ? `Bl. ${m.bloco}` : ''
    const apt = m.apt ? `Apt ${m.apt}` : 'Sem Unidade'
    const key = `${condo}__${bloco}__${apt}`

    if (!unidadesMap[key]) {
      unidadesMap[key] = {
        condominio: condo,
        bloco: m.bloco || '',
        apt: m.apt || '',
        moradores: [],
        pets: []
      }
    }
    unidadesMap[key].moradores.push(m)
  })

  pets.forEach(p => {
    const condo = p.condominio || 'Sem Condomínio'
    const bloco = p.bloco ? `Bl. ${p.bloco}` : ''
    const apt = p.apt ? `Apt ${p.apt}` : 'Sem Unidade'
    const key = `${condo}__${bloco}__${apt}`

    if (unidadesMap[key]) {
      unidadesMap[key].pets.push(p)
    }
  })

  Object.values(unidadesMap).forEach(u => {
    u.moradores.sort((a, b) => {
      if (a.status === 'Proprietário') return -1
      if (b.status === 'Proprietário') return 1
      if (a.status === 'Inquilino') return -1
      if (b.status === 'Inquilino') return 1
      return 0
    })
  })

  const unidadesLista = Object.values(unidadesMap).sort((a, b) => {
    if (a.condominio !== b.condominio) return a.condominio.localeCompare(b.condominio)
    return a.apt.localeCompare(b.apt, undefined, { numeric: true })
  })

  const handleSave = async form => {
    if (modal === 'new') await addItem(form)
    else await updateItem(modal.id, form)
    setModal(null)
    setTargetUnidade(null)
  }

  const handleSavePet = async form => {
    if (modalPet === 'new') await addPet(form)
    setModalPet(null)
  }

  const handleDeleteMorador = async (m) => {
    if (!window.confirm(`Deseja realmente remover o morador "${m.nome}"?`)) return
    try {
      await deleteItem(m.id)
      // Sincroniza e remove usuário vinculado se houver, evitando resquícios
      if (m.email) {
        const qU = query(collection(db, 'usuarios'), where('email', '==', m.email.toLowerCase().trim()))
        const sU = await getDocs(qU)
        sU.forEach(async d => await deleteDoc(d.ref))
      }
    } catch (err) {
      console.warn('Aviso ao sincronizar exclusão com usuários:', err)
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="section-title text-xl">{isMorador ? 'Minha Unidade & Família' : 'Gestão de Moradores por Unidade'}</h2>
          <p className="section-sub">
            {isMorador
              ? `Unidade Apt ${user?.unidade || user?.apt || '—'} • ${user?.condominio || 'Condomínio'}`
              : `${moradores.length} moradores cadastrados em ${unidadesLista.length} apartamentos`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!isMorador && (
            <div className="flex bg-slate-100 p-1 rounded-xl border border-gray-200">
              <button
                onClick={() => setViewMode('agrupado')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${viewMode === 'agrupado' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
              >
                <LayoutGrid size={14} /> Por Apartamento
              </button>
              <button
                onClick={() => setViewMode('tabela')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${viewMode === 'tabela' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
              >
                <TableIcon size={14} /> Tabela Geral
              </button>
            </div>
          )}
          <button
            onClick={() => {
              setTargetUnidade(null)
              setModal('new')
            }}
            className="btn-primary text-xs font-black flex items-center gap-1.5 shadow-sm"
          >
            <Plus size={16} /> {isMorador ? 'Adicionar Familiar' : 'Novo Morador'}
          </button>
          {isMorador && (
            <button
              onClick={() => setModalPet('new')}
              className="btn-secondary text-xs font-bold flex items-center gap-1.5 bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 shadow-sm"
            >
              <PawPrint size={15} className="text-amber-600" /> Cadastrar Pet
            </button>
          )}
        </div>
      </div>

      {/* Filtros para o Administrador */}
      {!isMorador && (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input className="input pl-9 text-xs" placeholder="Buscar por nome, apartamento, e-mail..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="relative sm:w-64">
              <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select className="input pl-9 text-xs font-bold" value={filtroCondominio} onChange={e => { setFiltroCondominio(e.target.value); setFiltroApt('Todos') }}>
                {condominiosUnicos.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="relative sm:w-48">
              <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select className="input pl-9 text-xs font-bold" value={filtroApt} onChange={e => setFiltroApt(e.target.value)}>
                {aptsUnicos.map(a => <option key={a} value={a}>{a === 'Todos' ? 'Todos os Aptos' : `Apt ${a}`}</option>)}
              </select>
            </div>
          </div>

          {/* Atalhos rápidos de condomínio */}
          {filtroCondominio === 'Todos' && condominiosUnicos.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
              {condominiosUnicos.filter(c => c !== 'Todos').map(c => (
                <button
                  key={c}
                  onClick={() => setFiltroCondominio(c)}
                  className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-700 hover:border-brand-500 hover:text-brand-700 whitespace-nowrap transition-all shrink-0 shadow-sm"
                >
                  🏢 {c} <span className="ml-1 text-brand-600 font-bold">({moradores.filter(m => m.condominio === c).length} pessoas)</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── VISUALIZAÇÃO AGRUPADA POR APARTAMENTO (PADRÃO ADM E MORADOR) ── */}
      {viewMode === 'agrupado' || isMorador ? (
        <div className="flex flex-col gap-4">
          {unidadesLista.length === 0 ? (
            <div className="card text-center py-12 text-gray-400 text-sm">
              <Home size={32} className="mx-auto mb-2 opacity-40" />
              Nenhum morador ou apartamento encontrado com os filtros selecionados.
            </div>
          ) : (
            unidadesLista.map(u => {
              const titulares = u.moradores.filter(m => m.status === 'Proprietário' || m.status === 'Inquilino')
              const dependentes = u.moradores.filter(m => m.status === 'Dependente')

              return (
                <div key={`${u.condominio}_${u.bloco}_${u.apt}`} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden transition-all hover:border-brand-300">
                  {/* Cabeçalho da Unidade */}
                  <div className="p-4 bg-slate-50 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-brand-700 text-white flex items-center justify-center font-black text-sm shadow-sm">
                        {u.apt ? u.apt.slice(0, 4) : '🏠'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-black text-slate-900 text-base">
                            Apt {u.apt} {u.bloco ? `• Bloco ${u.bloco}` : ''}
                          </h3>
                          <span className="text-xs font-bold text-gray-500 bg-white border border-gray-300 px-2 py-0.5 rounded-md">
                            🏢 {u.condominio}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          <b>{u.moradores.length}</b> morador(es) ({titulares.length} responsável, {dependentes.length} dependente) • <b>{u.pets.length}</b> pet(s)
                        </p>
                      </div>
                    </div>

                    {!isMorador && (
                      <button
                        onClick={() => {
                          setTargetUnidade(u)
                          setModal('new')
                        }}
                        className="px-3 py-1.5 bg-white hover:bg-brand-50 text-brand-700 border border-brand-200 rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm shrink-0"
                      >
                        <Plus size={14} /> Adicionar Membro neste Apt
                      </button>
                    )}
                  </div>

                  {/* Corpo: Membros da Família */}
                  <div className="p-4 divide-y divide-gray-100">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pb-3">
                      {u.moradores.map(m => (
                        <div key={m.id} className="p-3 bg-slate-50/60 hover:bg-slate-50 rounded-xl border border-gray-200 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {m.fotoRosto ? (
                              <img
                                src={m.fotoRosto}
                                alt={m.nome}
                                className="w-10 h-10 rounded-full object-cover shadow-sm border border-brand-300 shrink-0 cursor-pointer"
                                onClick={() => window.open(m.fotoRosto, '_blank')}
                                title="Ver foto facial"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center text-sm font-black shrink-0">
                                {m.nome?.[0] || '?'}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="font-bold text-gray-900 text-xs truncate">{m.nome}</p>
                              </div>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${m.status === 'Proprietário' ? 'bg-blue-100 text-blue-800' : m.status === 'Inquilino' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'}`}>
                                  {m.status}
                                </span>
                                {m.cpf && <span className="text-[10px] text-gray-400 font-mono">CPF: {m.cpf}</span>}
                              </div>
                              {m.tel && <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-1"><Phone size={10} /> {m.tel}</p>}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => setModal(m)} className="p-1.5 rounded-lg bg-white hover:bg-brand-100 text-gray-400 hover:text-brand-700 border border-gray-200 shadow-sm" title="Editar"><Edit2 size={12} /></button>
                            {(!isMorador || m.status !== 'Proprietário') && (
                              <button onClick={() => handleDeleteMorador(m)} className="p-1.5 rounded-lg bg-white hover:bg-red-100 text-gray-400 hover:text-red-500 border border-gray-200 shadow-sm" title="Remover"><Trash2 size={12} /></button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pets do Apartamento */}
                    {u.pets.length > 0 && (
                      <div className="pt-3 flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-amber-900 flex items-center gap-1 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                          <PawPrint size={14} className="text-amber-600" /> Pets da Unidade ({u.pets.length}):
                        </span>
                        {u.pets.map(p => (
                          <span key={p.id} className="text-xs bg-slate-100 text-slate-800 font-bold pl-2.5 pr-1.5 py-1 rounded-lg border border-slate-200 flex items-center gap-2">
                            <span>🐾 <b>{p.nome}</b> ({p.tipo || 'Pet'} • {p.raca || p.porte || 'Médio'})</span>
                            <button
                              onClick={() => {
                                if (window.confirm(`Deseja realmente excluir o pet "${p.nome}"?`)) {
                                  deletePet(p.id)
                                }
                              }}
                              className="p-1 hover:bg-red-100 text-gray-400 hover:text-red-600 rounded-md transition-colors"
                              title={`Excluir pet ${p.nome}`}
                            >
                              <Trash2 size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      ) : (
        /* ── VISUALIZAÇÃO EM TABELA CLÁSSICA (ADM) ── */
        <div className="card p-0 overflow-hidden">
          <div className="p-3 border-b border-cream-200 bg-cream-50 flex items-center justify-between">
            <p className="text-xs text-gray-500">{filtered.length} morador(es) {filtroCondominio !== 'Todos' ? `em "${filtroCondominio}"` : ''}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-cream-100 border-b border-cream-400">
                <tr>{['Morador', 'Condomínio', 'Unidade', 'Contato', 'Status', 'Ações'].map(h => <th key={h} className="table-head">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-cream-200">
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-400 text-sm">Nenhum morador encontrado.</td></tr>
                ) : (
                  filtered.map(m => (
                    <tr key={m.id} className="hover:bg-cream-50 transition-colors">
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          {m.fotoRosto ? (
                            <img src={m.fotoRosto} alt="Foto" className="w-8 h-8 rounded-full object-cover shadow-sm border border-brand-200" onClick={() => window.open(m.fotoRosto, '_blank')} title="Ver foto" style={{ cursor: 'pointer' }} />
                          ) : (
                            <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 text-xs font-bold">{m.nome?.[0] || '?'}</div>
                          )}
                          <div>
                            <p className="font-semibold text-gray-800 text-sm">{m.nome}</p>
                            <p className="text-xs text-gray-500 font-mono">{m.cpf}</p>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell"><p className="text-xs font-medium text-gray-700">{m.condominio || '—'}</p></td>
                      <td className="table-cell"><p className="font-bold text-gray-800">Apt {m.apt} {m.bloco ? `– Bl. ${m.bloco}` : ''}</p></td>
                      <td className="table-cell">
                        <p className="flex items-center gap-1 text-xs"><Phone size={10} className="text-gray-500" />{m.tel || '—'}</p>
                        <p className="flex items-center gap-1 text-xs text-gray-400"><Mail size={10} className="text-gray-500" />{m.email || '—'}</p>
                      </td>
                      <td className="table-cell"><span className={m.status === 'Proprietário' ? 'badge-blue' : m.status === 'Inquilino' ? 'badge-green' : 'badge-purple'}>{m.status}</span></td>
                      <td className="table-cell">
                        <div className="flex gap-2">
                          <button onClick={() => setModal(m)} className="p-1.5 rounded-lg bg-cream-200 hover:bg-brand-100 text-gray-400 hover:text-brand-700 transition-all"><Edit2 size={12} /></button>
                          <button onClick={() => handleDeleteMorador(m)} className="p-1.5 rounded-lg bg-cream-200 hover:bg-red-100 text-gray-400 hover:text-red-500 transition-all" title="Remover"><Trash2 size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <MoradorModal
          data={modal === 'new' ? null : modal}
          onClose={() => { setModal(null); setTargetUnidade(null) }}
          onSave={handleSave}
          isMorador={isMorador}
          currentUser={user}
          initialApt={targetUnidade?.apt}
          initialBloco={targetUnidade?.bloco}
          initialCondo={targetUnidade?.condominio}
        />
      )}

      {modalPet && (
        <PetModalRapido
          data={null}
          onClose={() => setModalPet(null)}
          onSave={handleSavePet}
          currentUser={user}
        />
      )}
    </div>
  )
}

