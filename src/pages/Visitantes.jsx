import React, { useState } from 'react'
import { QrCode as QrIcon, Search, Plus, Trash2, ShieldCheck, Clock, Share2, X, CheckSquare } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'

const statusBadge = s => ({ 'Autorizado': 'badge-green', 'Pendente': 'badge-yellow', 'Expirado': 'badge-red' }[s] || 'badge-blue')

export default function Visitantes() {
  const { user } = useAuth()
  const isAdminOrSindico = ['Administrador', 'Síndico', 'Porteiro'].includes(user?.role)
  const { items: visitantes, addItem, deleteItem, updateItem } = useFirestore('visitantes')
  
  const [modal, setModal] = useState(false)
  const [busca, setBusca] = useState('')

  // O morador só vê os convidados DELE (baseado no nome do usuário ou e-mail, num app real)
  // Para fins visuais, se for Admin/Porteiro, vê todos.
  const meusVisitantes = isAdminOrSindico ? visitantes : visitantes.filter(v => v.moradorId === user?.id || v.moradorNome === user?.nome)
  
  const filtrados = meusVisitantes.filter(v => 
    v.nome.toLowerCase().includes(busca.toLowerCase()) || 
    (v.moradorNome || '').toLowerCase().includes(busca.toLowerCase())
  ).sort((a,b) => new Date(b.dataVisita) - new Date(a.dataVisita))

  const handleSave = async (form) => {
    if (form.id) {
      await updateItem(form.id, form)
    } else {
      await addItem({ 
        ...form, 
        moradorId: user?.id || 'id_mock',
        moradorNome: form.moradorNome || user?.nome || 'Morador Teste',
        status: 'Autorizado',
        _createdAt: new Date().toISOString(),
        condominio: user?.condominio || ''
      })
    }
    setModal(false)
  }

  const gerarConvite = (vis) => {
    // Simula a geração do Card do MyCond com botão de compartilhar via WhatsApp
    setModal({ type: 'convite', data: vis })
  }

  const marcarEntrada = async (vis) => {
    // Simula o porteiro clicando para marcar que o visitante deu entrada
    if (confirm(`Confirmar entrada de ${vis.nome}?`)) {
      await updateItem(vis.id, { entradaRegistrada: new Date().toISOString(), status: 'Acessou' })
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h2 className="section-title text-xl">Controle de Visitantes</h2>
          <p className="section-sub">Pré-autorização e geração de QR Code para convidados</p>
        </div>
        {!['Porteiro'].includes(user?.role) && (
          <button onClick={() => setModal({ type: 'form', data: {} })} className="btn-primary">
            <Plus size={16} />Novo Convite
          </button>
        )}
      </div>

      <div className="card p-0 flex-1 flex flex-col overflow-hidden min-h-[400px]">
        <div className="p-4 border-b border-cream-300 flex items-center justify-between gap-4">
          <div className="relative w-full sm:max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" className="input pl-9 w-full text-sm" placeholder="Buscar visitante..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          <span className="text-xs font-medium text-gray-500">{filtrados.length} autorizações</span>
        </div>

        <div className="flex-1 overflow-x-auto">
          <table className="w-full">
            <thead className="bg-cream-100 border-b border-cream-400">
              <tr>{['Visitante', 'Data da Visita', 'Documento/Placa', 'Status', 'Ações'].map(h => <th key={h} className="table-head">{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtrados.length === 0
                ? <tr><td colSpan={5} className="text-center py-12 text-gray-400 text-sm">Nenhum visitante encontrado.</td></tr>
                : filtrados.map(v => (
                  <tr key={v.id} className="table-row">
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        {v.foto && (
                          <img onClick={() => setModal({ type: 'foto', data: v.foto })} src={v.foto} alt="Bio" className="w-8 h-8 rounded-full object-cover border border-brand-200 cursor-pointer hover:scale-110 hover:shadow-md transition-all" title="Ver Biometria" />
                        )}
                        <div>
                          <p className="font-bold text-gray-800">{v.nome}</p>
                          {isAdminOrSindico && <p className="text-xs text-brand-600 font-semibold uppercase">Res: {v.moradorNome} {v.apt ? `(${v.apt})` : ''}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="table-cell text-sm text-gray-600">
                      <span className="flex items-center gap-1.5"><Clock size={13} className="text-gray-400"/> {new Date(v.dataVisita + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                    </td>
                    <td className="table-cell text-xs text-gray-500 uppercase">{v.documento || 'ND'}</td>
                    <td className="table-cell"><span className={`${statusBadge(v.status)} flex items-center gap-1 w-fit`}>{v.status}</span></td>
                    <td className="table-cell">
                      <div className="flex gap-1.5 flex-wrap">
                        {v.status === 'Autorizado' && (
                          <button onClick={() => gerarConvite(v)} className="btn-secondary py-1 px-2.5 text-xs text-brand-700 bg-brand-50 border-brand-200 hover:bg-brand-100" title="Ver Convite">
                            <QrIcon size={13} />Convite
                          </button>
                        )}
                        {isAdminOrSindico && v.status === 'Autorizado' && (
                           <button onClick={() => marcarEntrada(v)} className="btn-success py-1 px-2.5 text-xs"><CheckSquare size={13} />Liberar</button>
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

      {modal?.type === 'form' && <ModalVisitanteForm data={modal.data} onClose={() => setModal(false)} onSave={handleSave} />}
      {modal?.type === 'convite' && <ModalConviteQr data={modal.data} onClose={() => setModal(false)} />}
      
      {modal?.type === 'foto' && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="relative p-2 animate-fade-in" onClick={e => e.stopPropagation()}>
            <button onClick={() => setModal(false)} className="absolute -top-4 -right-4 bg-white rounded-full p-2 shadow-lg text-gray-500 hover:text-red-500 z-10"><X size={20} /></button>
            <img src={modal.data} alt="Biometria Ampliada" className="max-w-[90vw] max-h-[80vh] rounded-2xl shadow-2xl border-4 border-white object-contain" />
          </div>
        </div>
      )}
    </div>
  )
}

function ModalVisitanteForm({ data, onClose, onSave }) {
  const [form, setForm] = useState(data || { nome: '', dataVisita: '', documento: '', moradorNome: '', apt: '' })

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">Emissão de Convite</h3>
          <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-700" /></button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div className="bg-brand-50 border border-brand-100 p-3 rounded-lg text-xs text-brand-700 mb-2">
            Este ingresso virtual permitirá o acesso rápido do visitante na portaria durante a data selecionada.
          </div>
          <div><label className="label">Nome do Convidado *</label><input className="input w-full" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome completo" autoFocus /></div>
          <div><label className="label">Data Prevista *</label><input type="date" className="input w-full" value={form.dataVisita} onChange={e => setForm(f => ({ ...f, dataVisita: e.target.value }))} /></div>
          <div><label className="label">Documento ou Placa (Opcional)</label><input className="input w-full" value={form.documento} autoCapitalize="characters" onChange={e => setForm(f => ({ ...f, documento: e.target.value.toUpperCase() }))} placeholder="RG, CPF ou Placa do Carro" /></div>
          
          {/* Se for admin, pode preencher de qual morador é */}
          <div className="border-t border-cream-300 pt-4 mt-2">
            <p className="text-xs text-gray-400 font-medium uppercase mb-2">Apenas Administrativo</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label text-[10px]">Morador Anfitrião</label><input className="input w-full py-1.5 text-xs" value={form.moradorNome} onChange={e => setForm(f => ({ ...f, moradorNome: e.target.value }))} placeholder="Morador" /></div>
              <div><label className="label text-[10px]">Unidade / Apt</label><input className="input w-full py-1.5 text-xs" value={form.apt} onChange={e => setForm(f => ({ ...f, apt: e.target.value }))} placeholder="Unidade" /></div>
            </div>
          </div>

        </div>
        <div className="p-6 border-t border-cream-300 flex gap-3 justify-end bg-gray-50/50 rounded-b-2xl">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={() => { if(!form.nome || !form.dataVisita) return alert('Preecha Nome e Data'); onSave(form) }} className="btn-primary">Gerar QR Code</button>
        </div>
      </div>
    </div>
  )
}

function ModalConviteQr({ data, onClose }) {
  const checkInUrl = `https://alpha-solucoes-condominiais.vercel.app/visitantes/valida/${data.id}`

  const shareWts = () => {
    const text = `*Alpha Condomínios*\nOlá ${data.nome}, você foi convidado!\n\nAcesse o link abaixo para visualizar seu *QR Code de Acesso*.\nApresente-o na portaria no dia *${new Date(data.dataVisita + 'T12:00:00').toLocaleDateString('pt-BR')}*.\n\n🎟️ Ver Convite: ${checkInUrl}\n\nAnfitrião: ${data.moradorNome} ${data.apt ? `(Apt ${data.apt})` : ''}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-sm text-center" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-br from-brand-600 to-indigo-700 p-6 rounded-t-2xl text-white relative">
          <button onClick={onClose} className="absolute right-4 top-4 text-white/50 hover:text-white"><X size={18} /></button>
          <ShieldCheck size={40} className="mx-auto mb-3 text-brand-200" />
          <h3 className="font-black text-xl mb-1">Convite Virtual</h3>
          <p className="text-brand-200 text-sm">Passe Livre na Portaria</p>
        </div>
        
        <div className="p-8">
          <div className="bg-white border-2 border-dashed border-cream-500 rounded-lg p-3 inline-block mb-6 shadow-sm">
            <QRCodeSVG value={checkInUrl} size={150} level="H" includeMargin={false} />
          </div>
          
          <p className="text-xs text-gray-400 uppercase tracking-widest font-bold mb-1">Convidado</p>
          <p className="text-lg font-bold text-gray-800">{data.nome}</p>
          
          <div className="flex justify-center gap-6 mt-6 pt-6 border-t border-cream-300">
            <div>
              <p className="text-xs text-gray-400 uppercase font-semibold">Data</p>
              <p className="text-sm font-bold text-gray-700">{new Date(data.dataVisita + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
            </div>
            {data.documento && (
              <div>
                 <p className="text-xs text-gray-400 uppercase font-semibold">Doc/Placa</p>
                 <p className="text-sm font-bold text-gray-700 uppercase">{data.documento}</p>
              </div>
            )}
          </div>
        </div>
        
        <div className="p-4 border-t border-cream-300 bg-gray-50/50 rounded-b-2xl">
          <button onClick={shareWts} className="btn-success w-full justify-center">
            <Share2 size={16} /> Compartilhar no WhatsApp
          </button>
        </div>
      </div>
    </div>
  )
}
