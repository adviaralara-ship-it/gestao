import React, { useState } from 'react'
import { AlertTriangle, Plus, Search, Edit2, Trash2, DollarSign, X, CheckCircle2, Clock, Wrench, Sparkles, Bot, Loader2, MapPin, Calendar, UserCheck } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { notificarAdm } from '../emailjs.config'
import { useAuth } from '../context/AuthContext'
import { format } from 'date-fns'

const CATEGORIAS_SOLICITACAO = [
  'Manutenção',
  'Vazamento',
  'Elétrica',
  'Hidráulica',
  'Elevador',
  'Segurança',
  'Limpeza',
  'Área comum',
  'Barulho',
  'Obra',
  'Sugestão',
  'Reclamação',
  'Outros'
]

const STATUS_FLUXO = [
  'Aberta',
  'Em análise',
  'Em andamento',
  'Resolvida'
]

function Modal({ data, user, onClose, onSave }) {
  const [form, setForm] = useState(data || {
    titulo: '',
    descricao: '',
    local: '',
    apt: user?.apt || user?.unidade || '',
    condominio: user?.condominio || '',
    categoria: 'Manutenção',
    prioridade: 'Média',
    status: 'Aberta',
    responsavel: 'Administração',
    previsao: '',
    visibilidade: 'Público',
    infracao: false,
    foto: ''
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

  const isMorador = user?.role === 'Morador'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-xl" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between">
          <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
            <Wrench className="text-brand-600" size={20} />
            {data ? 'Editar Solicitação' : 'Nova Solicitação do Morador'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-lg">✕</button>
        </div>
        <div className="p-6 flex flex-col gap-4 text-xs">
          <div>
            <label className="label font-bold text-gray-700">Assunto / Título da Solicitação *</label>
            <input
              className="input font-medium"
              value={form.titulo}
              onChange={e => set('titulo', e.target.value)}
              placeholder="Ex: Vazamento no corredor do 3º andar, Lâmpada queimada na garagem..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label font-bold text-gray-700">Categoria *</label>
              <select className="input font-bold" value={form.categoria} onChange={e => set('categoria', e.target.value)}>
                {CATEGORIAS_SOLICITACAO.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="label font-bold text-gray-700">Local / Onde ocorreu *</label>
              <input
                className="input font-medium"
                value={form.local}
                onChange={e => set('local', e.target.value)}
                placeholder="Ex: Corredor do Bloco B, Garagem vaga 42..."
              />
            </div>
          </div>

          <div>
            <label className="label font-bold text-gray-700">Descrição Detalhada *</label>
            <textarea
              className="input resize-none min-h-[90px] font-medium"
              value={form.descricao}
              onChange={e => set('descricao', e.target.value)}
              placeholder="Descreva com detalhes a situação observada..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label font-bold text-gray-700">Unidade / Apto</label>
              <input className="input font-medium" value={form.apt} onChange={e => set('apt', e.target.value)} disabled={isMorador} />
            </div>

            <div>
              <label className="label font-bold text-gray-700">Prioridade</label>
              <select className="input font-bold" value={form.prioridade} onChange={e => set('prioridade', e.target.value)}>
                <option value="Baixa">🟢 Baixa</option>
                <option value="Média">🟡 Média</option>
                <option value="Alta">🔴 Alta / Urgente</option>
              </select>
            </div>
          </div>

          {!isMorador && (
            <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-gray-200">
              <div>
                <label className="label font-bold text-gray-700">Status</label>
                <select className="input font-bold" value={form.status} onChange={e => set('status', e.target.value)}>
                  {STATUS_FLUXO.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="label font-bold text-gray-700">Responsável</label>
                <input className="input font-medium" value={form.responsavel} onChange={e => set('responsavel', e.target.value)} placeholder="Ex: Síndico, Zelador, Manutenção..." />
              </div>

              <div>
                <label className="label font-bold text-gray-700">Previsão</label>
                <input type="date" className="input font-medium" value={form.previsao} onChange={e => set('previsao', e.target.value)} />
              </div>
            </div>
          )}

          <div>
            <label className="label font-bold text-gray-700">Foto / Evidência (Opcional)</label>
            {form.foto ? (
              <div className="relative w-32 h-32 rounded-xl border border-cream-300 overflow-hidden group">
                <img src={form.foto} alt="Evidência" className="w-full h-full object-cover" />
                <button type="button" onClick={() => set('foto', '')} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-90 hover:opacity-100 transition-all">
                  <X size={12} />
                </button>
              </div>
            ) : (
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImage}
                className="input text-xs file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
              />
            )}
          </div>
        </div>
        <div className="p-6 border-t border-cream-300 flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary text-xs">Cancelar</button>
          <button onClick={() => {
            if (!form.titulo.trim() || !form.descricao.trim()) {
              alert('Por favor, preencha o assunto e a descrição.')
              return
            }
            onSave(form)
          }} className="btn-primary text-xs flex items-center gap-1.5 px-5">
            Salvar Solicitação
          </button>
        </div>
      </div>
    </div>
  )
}

const statusBadge = s => {
  switch (s) {
    case 'Aberta': return 'bg-amber-100 text-amber-800 border-amber-200'
    case 'Em análise': return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'Em andamento': return 'bg-purple-100 text-purple-800 border-purple-200'
    case 'Resolvida': return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    default: return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

const prioBadge = p => {
  switch (p) {
    case 'Alta': return 'bg-rose-100 text-rose-800'
    case 'Média': return 'bg-amber-100 text-amber-800'
    default: return 'bg-emerald-100 text-emerald-800'
  }
}

export default function Ocorrencias() {
  const { user } = useAuth()
  const { items: allOcorrencias, addItem, updateItem, deleteItem } = useFirestore('ocorrencias')
  const [modal, setModal] = useState(null)
  const [search, setSearch] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('Todos')
  const [filtroCategoria, setFiltroCategoria] = useState('Todos')

  const isMorador = user?.role === 'Morador'

  const ocorrencias = allOcorrencias.filter(o => {
    // Se for morador, vê as ocorrências da unidade/apt dele ou que ele abriu
    if (isMorador) {
      const matchApt = o.apt === user?.apt || o.apt === user?.unidade
      const matchAutor = o.autor === user?.nome || o.nome_morador === user?.nome || o.uid === user?.uid
      return matchApt || matchAutor
    }
    if (user?.role === 'Síndico' || user?.role === 'Subsíndico') {
      return !o.condominio || o.condominio === user?.condominio
    }
    return true
  }).filter(o => {
    const matchBusca = (o.titulo || '').toLowerCase().includes(search.toLowerCase()) ||
                       (o.descricao || '').toLowerCase().includes(search.toLowerCase()) ||
                       (o.local || '').toLowerCase().includes(search.toLowerCase()) ||
                       (o.apt || '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = filtroStatus === 'Todos' || o.status === filtroStatus
    const matchCat = filtroCategoria === 'Todos' || o.categoria === filtroCategoria
    return matchBusca && matchStatus && matchCat
  }).sort((a, b) => new Date(b.data || b._createdAt || 0) - new Date(a.data || a._createdAt || 0))

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-7xl mx-auto w-full pb-12">
      <div className="page-header flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="section-title text-2xl font-black text-gray-900 flex items-center gap-2">
            <AlertTriangle className="text-brand-600" /> {isMorador ? 'Minhas Solicitações & Ocorrências' : 'Gestão de Solicitações & Ocorrências'}
          </h2>
          <p className="text-gray-500 font-medium text-xs md:text-sm mt-0.5">
            {isMorador ? 'Abra chamados de manutenção, vazamentos, segurança ou sugestões e acompanhe em tempo real.' : 'Acompanhe e responda às solicitações de manutenção e regras dos moradores.'}
          </p>
        </div>
        <button
          onClick={() => setModal({})}
          className="btn-primary flex items-center gap-1.5 shadow-md px-5 py-2.5"
        >
          <Plus size={18} /> Nova Solicitação
        </button>
      </div>

      {/* Filtros e Busca */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-10 text-sm bg-white"
            placeholder="Buscar por assunto, local ou número..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select
          className="input text-xs py-2 w-full md:w-auto font-bold"
          value={filtroStatus}
          onChange={e => setFiltroStatus(e.target.value)}
        >
          <option value="Todos">Todos os Status</option>
          {STATUS_FLUXO.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select
          className="input text-xs py-2 w-full md:w-auto font-bold"
          value={filtroCategoria}
          onChange={e => setFiltroCategoria(e.target.value)}
        >
          <option value="Todos">Todas as Categorias</option>
          {CATEGORIAS_SOLICITACAO.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Lista de Solicitações / Ocorrências */}
      {ocorrencias.length === 0 ? (
        <div className="card text-center py-16 text-gray-400 text-sm border border-pale-300 shadow-sm flex flex-col items-center">
          <Wrench size={32} className="text-gray-300 mb-2" />
          <p className="font-bold text-gray-700">Nenhuma solicitação encontrada.</p>
          <p className="text-xs text-gray-400 mt-0.5">Clique em "+ Nova Solicitação" para abrir um chamado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ocorrencias.map((oc, index) => (
            <div key={oc.id || index} className="bg-white p-5 rounded-2xl border border-pale-300 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <span className="text-[11px] font-mono text-gray-400 font-bold">#{oc.id?.slice(-4) || String(index + 1).padStart(3, '0')}</span>
                    <h3 className="font-black text-gray-900 text-base leading-tight mt-0.5">{oc.titulo}</h3>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${statusBadge(oc.status || 'Aberta')}`}>
                    {oc.status || 'Aberta'}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500 font-semibold mb-3">
                  <span className="bg-slate-100 text-gray-700 px-2 py-0.5 rounded-md">{oc.categoria || 'Geral'}</span>
                  {oc.local && (
                    <span className="flex items-center gap-1 text-gray-600"><MapPin size={12} /> {oc.local}</span>
                  )}
                  <span>•</span>
                  <span>Apto {oc.apt || '—'}</span>
                  <span>•</span>
                  <span>{oc.data || format(new Date(), 'dd/MM/yyyy')}</span>
                </div>

                <p className="text-gray-700 text-xs leading-relaxed mb-4 whitespace-pre-line bg-slate-50 p-3 rounded-xl border border-gray-100">
                  {oc.descricao}
                </p>

                {/* Bloco de Acompanhamento / Timeline */}
                <div className="grid grid-cols-2 gap-2 text-[11px] bg-brand-50/40 p-2.5 rounded-xl border border-brand-100 text-brand-900">
                  <div>
                    <span className="text-gray-500 font-medium">Responsável:</span>
                    <p className="font-bold text-gray-900">{oc.responsavel || 'Administração'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 font-medium">Previsão:</span>
                    <p className="font-bold text-gray-900">{oc.previsao ? format(new Date(oc.previsao + 'T12:00:00'), 'dd/MM/yyyy') : 'A definir'}</p>
                  </div>
                </div>

                {oc.foto && (
                  <div className="mt-3">
                    <img src={oc.foto} alt="Evidência" className="w-full h-36 object-cover rounded-xl border border-gray-200" />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-gray-100">
                <button
                  onClick={() => setModal(oc)}
                  className="btn-secondary py-1.5 px-3 text-xs font-bold flex items-center gap-1"
                >
                  <Edit2 size={13} /> {isMorador ? 'Ver Detalhes' : 'Editar / Atualizar Status'}
                </button>
                {!isMorador && (
                  <button
                    onClick={() => {
                      if (window.confirm('Excluir esta solicitação?')) deleteItem(oc.id)
                    }}
                    className="p-1.5 rounded-lg bg-gray-100 hover:bg-red-100 text-gray-400 hover:text-red-600 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal
          data={modal.id ? modal : null}
          user={user}
          onClose={() => setModal(null)}
          onSave={async (formData) => {
            if (modal.id) {
              await updateItem(modal.id, formData)
            } else {
              await addItem({
                ...formData,
                autor: user?.nome || 'Morador',
                nome_morador: user?.nome || 'Morador',
                uid: user?.uid || user?.id || '',
                data: format(new Date(), 'yyyy-MM-dd'),
                _createdAt: serverTimestamp()
              })
              
              await addDoc(collection(db, 'notificacoes'), {
                text: `Nova Solicitação: "${formData.titulo}" pelo Apt ${formData.apt} (${formData.condominio})`,
                time: new Date().toISOString(),
                tipo: 'ocorrencia',
                lida: false,
                condominio: formData.condominio,
                _createdAt: serverTimestamp()
              })
            }
            setModal(null)
          }}
        />
      )}
    </div>
  )
}
