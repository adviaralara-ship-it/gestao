import React, { useState, useRef } from 'react'
import { QrCode as QrIcon, Search, Plus, Trash2, ShieldCheck, Clock, Share2, X, CheckSquare, Camera, Copy, Check, User } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'

const statusBadge = s => ({ 'Autorizado': 'badge-green', 'Pendente': 'badge-yellow', 'Expirado': 'badge-red', 'Acessou': 'badge-blue' }[s] || 'badge-blue')

export default function Visitantes() {
  const { user } = useAuth()
  const isAdminOrSindico = ['Administrador', 'Síndico', 'Porteiro'].includes(user?.role)
  const { items: visitantes, addItem, deleteItem, updateItem } = useFirestore('visitantes')
  
  const [modal, setModal] = useState(false)
  const [busca, setBusca] = useState('')

  // O morador só vê os convidados DELE
  const meusVisitantes = isAdminOrSindico 
    ? visitantes 
    : visitantes.filter(v => v.moradorId === user?.id || v.moradorId === user?.uid || (v.moradorNome || '').toLowerCase() === (user?.nome || '').toLowerCase() || (user?.apt && v.apt === user.apt))
  
  const filtrados = meusVisitantes.filter(v => 
    v.nome?.toLowerCase().includes(busca.toLowerCase()) || 
    (v.moradorNome || '').toLowerCase().includes(busca.toLowerCase()) ||
    (v.condominio || '').toLowerCase().includes(busca.toLowerCase())
  ).sort((a,b) => new Date(b.dataVisita || 0) - new Date(a.dataVisita || 0))

  const handleSave = async (form) => {
    if (form.id) {
      await updateItem(form.id, form)
    } else {
      await addItem({ 
        ...form, 
        moradorId: user?.uid || user?.id || 'morador_id',
        moradorNome: form.moradorNome || user?.nome || 'Morador',
        apt: form.apt || user?.apt || user?.unidade || '',
        condominio: form.condominio || user?.condominio || '',
        status: 'Autorizado',
        _createdAt: new Date().toISOString()
      })
    }
    setModal(false)
  }

  const gerarConvite = (vis) => {
    setModal({ type: 'convite', data: vis })
  }

  const marcarEntrada = async (vis) => {
    if (confirm(`Confirmar entrada de ${vis.nome}?`)) {
      await updateItem(vis.id, { entradaRegistrada: new Date().toISOString(), status: 'Acessou' })
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h2 className="section-title text-xl">Autorização de Visitantes & Convidados</h2>
          <p className="section-sub">Pré-autorização, geração de QR Code e reconhecimento facial na portaria</p>
        </div>
        {!['Porteiro'].includes(user?.role) && (
          <button onClick={() => setModal({ type: 'form', data: { moradorNome: user?.nome, apt: user?.apt || user?.unidade, condominio: user?.condominio } })} className="btn-primary">
            <Plus size={16} /> Novo Convite
          </button>
        )}
      </div>

      <div className="card p-0 flex-1 flex flex-col overflow-hidden min-h-[400px]">
        <div className="p-4 border-b border-cream-300 flex items-center justify-between gap-4">
          <div className="relative w-full sm:max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" className="input pl-9 w-full text-sm" placeholder="Buscar visitante ou morador..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          <span className="text-xs font-medium text-gray-500">{filtrados.length} autorizações</span>
        </div>

        <div className="flex-1 overflow-x-auto">
          <table className="w-full">
            <thead className="bg-cream-100 border-b border-cream-400">
              <tr>{['Visitante', 'Data da Visita', 'Documento / Placa', 'Status', 'Ações'].map(h => <th key={h} className="table-head">{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtrados.length === 0
                ? <tr><td colSpan={5} className="text-center py-12 text-gray-400 text-sm">Nenhum visitante cadastrado no momento.</td></tr>
                : filtrados.map(v => (
                  <tr key={v.id} className="table-row">
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        {v.foto ? (
                          <img onClick={() => setModal({ type: 'foto', data: v.foto })} src={v.foto} alt={v.nome} className="w-9 h-9 rounded-full object-cover border-2 border-emerald-400 cursor-pointer hover:scale-110 hover:shadow-md transition-all" title="Ver Biometria Facial" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-slate-100 border border-gray-300 flex items-center justify-center text-gray-400 text-xs font-bold">
                            <User size={16} />
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-gray-800">{v.nome}</p>
                          <p className="text-xs text-brand-600 font-semibold">Anfitrião: {v.moradorNome} {v.apt ? `(Apt ${v.apt})` : ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell text-sm text-gray-600">
                      <span className="flex items-center gap-1.5"><Clock size={13} className="text-gray-400"/> {v.dataVisita ? new Date(v.dataVisita + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</span>
                    </td>
                    <td className="table-cell text-xs text-gray-500 uppercase font-mono">{v.documento || '—'}</td>
                    <td className="table-cell"><span className={`${statusBadge(v.status)} flex items-center gap-1 w-fit`}>{v.status}</span></td>
                    <td className="table-cell">
                      <div className="flex gap-1.5 flex-wrap">
                        <button onClick={() => gerarConvite(v)} className="btn-secondary py-1 px-2.5 text-xs text-brand-700 bg-brand-50 border-brand-200 hover:bg-brand-100" title="Ver e Enviar Convite">
                          <QrIcon size={13} /> Convite QR
                        </button>
                        {isAdminOrSindico && v.status === 'Autorizado' && (
                           <button onClick={() => marcarEntrada(v)} className="btn-success py-1 px-2.5 text-xs"><CheckSquare size={13} /> Liberar</button>
                        )}
                        <button onClick={() => deleteItem(v.id)} className="p-1.5 rounded-lg bg-cream-100 hover:bg-red-100 text-gray-400 hover:text-red-500 transition-all"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {modal?.type === 'form' && <ModalVisitanteForm data={modal.data} currentUser={user} onClose={() => setModal(false)} onSave={handleSave} />}
      {modal?.type === 'convite' && <ModalConviteQr data={modal.data} onClose={() => setModal(false)} />}
      
      {modal?.type === 'foto' && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="relative p-2 animate-fade-in text-center" onClick={e => e.stopPropagation()}>
            <button onClick={() => setModal(false)} className="absolute -top-4 -right-4 bg-white rounded-full p-2 shadow-lg text-gray-500 hover:text-red-500 z-10"><X size={20} /></button>
            <img src={modal.data} alt="Biometria Facial" className="max-w-[90vw] max-h-[80vh] rounded-2xl shadow-2xl border-4 border-white object-contain" />
            <p className="text-white text-xs font-bold mt-2">Biometria Facial / Foto Registrada</p>
          </div>
        </div>
      )}
    </div>
  )
}

function ModalVisitanteForm({ data, currentUser, onClose, onSave }) {
  const [form, setForm] = useState(data || { 
    nome: '', 
    dataVisita: new Date().toISOString().split('T')[0], 
    documento: '', 
    moradorNome: currentUser?.nome || '', 
    apt: currentUser?.apt || currentUser?.unidade || '',
    condominio: currentUser?.condominio || '',
    foto: null
  })
  const fileInputRef = useRef(null)

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const maxDim = 320
        let w = img.width
        let h = img.height
        if (w > h) {
          if (w > maxDim) { h = Math.round((h * maxDim) / w); w = maxDim }
        } else {
          if (h > maxDim) { w = Math.round((h * maxDim) / h); h = maxDim }
        }
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)
        const base64 = canvas.toDataURL('image/jpeg', 0.7)
        setForm(f => ({ ...f, foto: base64 }))
      }
      img.src = event.target.result
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between">
          <h3 className="font-bold text-gray-800 text-lg">Novo Convite de Visitante</h3>
          <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-700" /></button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div className="bg-brand-50 border border-brand-200 p-3.5 rounded-xl text-xs text-brand-800">
            Gera um link com <b>QR Code individual</b> para o visitante apresentar na portaria e liberar a entrada rapidamente.
          </div>

          {/* Foto opcional do visitante já no cadastro */}
          <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-gray-200">
            {form.foto ? (
              <div className="relative">
                <img src={form.foto} alt="Prévia" className="w-14 h-14 rounded-full object-cover border-2 border-brand-500" />
                <button onClick={() => setForm(f => ({ ...f, foto: null }))} className="absolute -top-1 -right-1 bg-rose-500 text-white rounded-full p-0.5" title="Remover">
                  <X size={12} />
                </button>
              </div>
            ) : (
              <div onClick={() => fileInputRef.current?.click()} className="w-14 h-14 rounded-full bg-white border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:border-brand-500 hover:text-brand-600 transition-colors">
                <Camera size={18} />
                <span className="text-[8px] font-bold mt-0.5">Foto</span>
              </div>
            )}
            <div className="flex-1">
              <p className="text-xs font-bold text-gray-800">Foto do Visitante (Opcional)</p>
              <p className="text-[11px] text-gray-500">Tire ou envie uma foto para o porteiro identificar o visitante.</p>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs font-bold text-brand-600 hover:text-brand-800 mt-1 flex items-center gap-1">
                📸 {form.foto ? 'Trocar Foto' : 'Adicionar Foto'}
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handlePhotoUpload} />
          </div>

          <div>
            <label className="label">Nome do Visitante / Convidado *</label>
            <input className="input w-full" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Maria Oliveira" autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Data Prevista *</label>
              <input type="date" className="input w-full" value={form.dataVisita} onChange={e => setForm(f => ({ ...f, dataVisita: e.target.value }))} />
            </div>
            <div>
              <label className="label">Documento ou Placa (Opcional)</label>
              <input className="input w-full" value={form.documento} autoCapitalize="characters" onChange={e => setForm(f => ({ ...f, documento: e.target.value.toUpperCase() }))} placeholder="RG / CPF / Placa" />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-gray-200">
            <div>
              <label className="label text-[11px]">Morador Anfitrião</label>
              <input className="input w-full py-1.5 text-xs bg-white" value={form.moradorNome} onChange={e => setForm(f => ({ ...f, moradorNome: e.target.value }))} placeholder="Nome do morador" />
            </div>
            <div>
              <label className="label text-[11px]">Unidade / Apt</label>
              <input className="input w-full py-1.5 text-xs bg-white" value={form.apt} onChange={e => setForm(f => ({ ...f, apt: e.target.value }))} placeholder="Ex: Apt 103" />
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-cream-300 flex gap-3 justify-end bg-gray-50/60 rounded-b-2xl">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={() => { if(!form.nome || !form.dataVisita) return alert('Por favor, preencha o Nome e a Data.'); onSave(form) }} className="btn-primary">
            Gerar QR Code de Acesso
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalConviteQr({ data, onClose }) {
  const [copied, setCopied] = useState(false)
  const checkInUrl = `https://alpha-solucoes-condominiais.vercel.app/visitantes/valida/${data.id}`
  const dataFormatada = data.dataVisita ? new Date(data.dataVisita + 'T12:00:00').toLocaleDateString('pt-BR') : 'Data agendada'
  const nomeCondo = data.condominio || 'Condomínio'

  // Mensagem solicitada pelo usuário
  const mensagemWhatsApp = `Alpha Soluções Condominiais\nOlá ${data.nome}, você foi convidado para o ${nomeCondo}!\n\nAcesse o link abaixo para visualizar seu QR Code de Acesso.\nApresente-o na portaria no dia ${dataFormatada}.\n\n🎟️ Ver Convite: ${checkInUrl}\n\nAnfitrião: ${data.moradorNome || 'Morador'} ${data.apt ? `(Apt ${data.apt})` : ''}`

  const shareWts = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(mensagemWhatsApp)}`, '_blank')
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(checkInUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch(e) {
      prompt("Copie o link do convite:", checkInUrl)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-sm text-center" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-brand-700 to-indigo-800 p-6 rounded-t-2xl text-white relative">
          <button onClick={onClose} className="absolute right-4 top-4 text-white/70 hover:text-white"><X size={18} /></button>
          <ShieldCheck size={36} className="mx-auto mb-2 text-emerald-300" />
          <h3 className="font-black text-xl mb-0.5">Passe de Entrada</h3>
          <p className="text-brand-200 text-xs">{nomeCondo}</p>
        </div>
        
        <div className="p-6">
          <div className="mb-4">
            {data.foto ? (
              <img src={data.foto} alt={data.nome} className="w-16 h-16 rounded-full object-cover border-2 border-emerald-500 mx-auto mb-2 shadow-sm" />
            ) : null}
            <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Convidado</p>
            <p className="text-lg font-black text-gray-900">{data.nome}</p>
          </div>

          <div className="bg-white border-2 border-slate-200 rounded-2xl p-3 inline-block mb-4 shadow-sm">
            <QRCodeSVG value={checkInUrl} size={150} level="H" includeMargin={false} />
          </div>
          
          <p className="text-xs text-gray-500 font-medium">Apresente este QR Code na portaria.</p>
          <p className="text-[10px] text-gray-400 font-mono mt-0.5">ID: {data.id}</p>

          <div className="flex justify-center gap-6 mt-4 pt-4 border-t border-gray-100 text-left">
            <div>
              <p className="text-[10px] text-gray-400 uppercase font-bold">Data da Visita</p>
              <p className="text-xs font-bold text-gray-800">{dataFormatada}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase font-bold">Anfitrião</p>
              <p className="text-xs font-bold text-gray-800">{data.moradorNome} {data.apt ? `(${data.apt})` : ''}</p>
            </div>
          </div>
        </div>
        
        <div className="p-4 border-t border-cream-300 bg-gray-50 flex flex-col gap-2 rounded-b-2xl">
          <button onClick={shareWts} className="btn-success w-full justify-center py-2.5 text-xs font-black shadow-md">
            <Share2 size={16} /> Compartilhar no WhatsApp
          </button>

          <button onClick={handleCopyLink} className="btn-secondary w-full justify-center py-2 text-xs font-bold text-gray-700 bg-white">
            {copied ? <><Check size={14} className="text-emerald-600" /> Link Copiado!</> : <><Copy size={14} /> Copiar Link do Convite</>}
          </button>
        </div>
      </div>
    </div>
  )
}
