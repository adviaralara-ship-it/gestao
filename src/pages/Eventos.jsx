import React, { useState, useEffect } from 'react'
import { CalendarCheck, Users, QrCode, Scan, Plus, Trash2, CheckCircle, X, Share2, Upload, Bell, Copy } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'
import { QRCodeCanvas } from 'qrcode.react'
import { Html5QrcodeScanner } from 'html5-qrcode'

function Scanner({ onScan, onClose }) {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false)
    scanner.render((decodedText) => {
      scanner.clear()
      onScan(decodedText)
    }, (err) => {
      // ignore
    })

    return () => {
      scanner.clear().catch(e => console.error("Failed to clear scanner", e))
    }
  }, [onScan])

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-sm w-full p-4 relative">
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-500 hover:text-red-500 z-10 p-2">
          <X size={24} />
        </button>
        <h3 className="text-lg font-bold text-center mb-4">Escaneie o QR Code</h3>
        <div id="reader" className="w-full"></div>
        <p className="text-xs text-gray-400 mt-4 text-center">Se a câmera não abrir, clique no cadeado 🔒 na barra de endereços do seu navegador e permita o uso da Câmera.</p>
      </div>
    </div>
  )
}

function ModalEvento({ data, condominios, onClose, onSave }) {
  const [form, setForm] = useState(data || { nome: '', data: '', local: '', condominio: '' })
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex justify-between">
          <h3 className="font-bold text-gray-800">{data ? 'Editar Evento' : 'Novo Evento'}</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Nome do Evento</label>
            <input className="input" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} />
          </div>
          <div className="col-span-2">
            <label className="label">Condomínio</label>
            <select className="input" value={form.condominio} onChange={e => setForm({...form, condominio: e.target.value})}>
              <option value="">Selecione...</option>
              {condominios.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div><label className="label">Data</label><input type="date" className="input" value={form.data} onChange={e => setForm({...form, data: e.target.value})} /></div>
          <div><label className="label">Local</label><input className="input" value={form.local} onChange={e => setForm({...form, local: e.target.value})} placeholder="Ex: Salão de Festas" /></div>
        </div>
        <div className="p-6 border-t flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={() => onSave(form)} className="btn-primary">Salvar</button>
        </div>
      </div>
    </div>
  )
}

function GerenciarConvidados({ evento, convidados, addConvidado, updateConvidado, deleteConvidado, onVoltar, addNotificacao }) {
  const [nome, setNome] = useState('')
  const [qrModal, setQrModal] = useState(null)
  
  const handleAdd = () => {
    if (!nome.trim()) return
    addConvidado({ nome, eventoId: evento.id, checkin: false, codigo: `EVT-${evento.id}-${Date.now()}` })
    setNome('')
  }

  const handleImport = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target.result
      const names = text.split('\n').map(line => line.split(',')[0].trim()).filter(n => n.length > 0)
      if (names.length > 0) {
        if (window.confirm(`Foram encontrados ${names.length} nomes no arquivo. Deseja importar todos?`)) {
          names.forEach((n, idx) => {
             addConvidado({ nome: n, eventoId: evento.id, checkin: false, codigo: `EVT-${evento.id}-${Date.now()}-${idx}` })
          })
          alert('Convidados importados com sucesso!')
        }
      } else {
        alert('Nenhum nome válido encontrado no arquivo.')
      }
      e.target.value = ''
    }
    reader.readAsText(file)
  }

  const checkInUrl = qrModal ? `https://alpha-solucoes-condominiais.vercel.app/eventos/valida/${qrModal.id}` : ''

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(checkInUrl)
      alert("Link copiado! Cole no WhatsApp ou envie para o convidado.")
    } catch(e) {
      prompt("Copie este link manualmente:", checkInUrl)
    }
  }

  const sendWhatsApp = () => {
    const msg = encodeURIComponent(`Olá *${qrModal.nome}*! Seu convite para o evento *${evento.nome}* está confirmado. ✅ Por favor, apresente seu QR Code.\n\n🎟️ Link: ${checkInUrl}`)
    window.open(`https://wa.me/?text=${msg}`, '_blank')
  }

  const sendPushToResident = () => {
    if (addNotificacao) {
      addNotificacao({
        tipo: 'evento',
        text: `O passe de entrada para o convidado ${qrModal.nome} (${evento.nome}) foi gerado. Código: ${qrModal.codigo}`,
        condominio: evento.condominio,
        lida: false,
        time: new Date().toISOString()
      })
      alert('Moradores notificados via Push (na Central de Notificações)!')
    }
  }

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <button onClick={onVoltar} className="btn-secondary py-1 px-3">Voltar</button>
        <div>
          <h2 className="text-xl font-bold text-gray-800">Convidados - {evento.nome}</h2>
          <p className="text-sm text-gray-500">{evento.data ? evento.data.split('-').reverse().join('/') : ''} | {evento.local}</p>
        </div>
      </div>

      <div className="card">
        <h4 className="font-bold text-gray-700 mb-4">Adicionar Convidado</h4>
        <div className="flex gap-2">
          <input className="input flex-1" placeholder="Nome do Convidado" value={nome} onChange={e => setNome(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
          <button onClick={handleAdd} className="btn-primary whitespace-nowrap"><Plus size={18}/> Adicionar</button>
          <label className="btn-secondary whitespace-nowrap cursor-pointer flex items-center gap-1 border-brand-200 text-brand-700 bg-brand-50 hover:bg-brand-100 px-3">
            <Upload size={18}/> Importar Lista (.txt/.csv)
            <input type="file" accept=".txt,.csv" className="hidden" onChange={handleImport} />
          </label>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead className="bg-cream-100 border-b">
            <tr>
              <th className="table-head">Nome</th>
              <th className="table-head text-center">Check-in</th>
              <th className="table-head">Ações</th>
            </tr>
          </thead>
          <tbody>
            {convidados.length === 0 ? (
              <tr><td colSpan={3} className="text-center py-8 text-gray-400">Nenhum convidado na lista</td></tr>
            ) : convidados.map(c => (
              <tr key={c.id} className="border-b border-cream-100">
                <td className="table-cell font-medium">
                  <div className="flex items-center gap-3">
                    {c.foto && (
                      <img src={c.foto} alt="Bio" className="w-8 h-8 rounded-full object-cover border border-gray-200" title="Biometria Cadastrada" />
                    )}
                    <span>{c.nome}</span>
                  </div>
                </td>
                <td className="table-cell text-center">
                  {c.checkin ? (
                    <span className="badge-green inline-flex items-center gap-1"><CheckCircle size={12}/> Realizado</span>
                  ) : (
                    <span className="badge-yellow">Pendente</span>
                  )}
                </td>
                <td className="table-cell">
                  <div className="flex gap-2">
                    <button onClick={() => setQrModal(c)} className="btn-secondary py-1 px-2 text-xs flex items-center gap-1"><QrCode size={12}/> Gerar QR</button>
                    {!c.checkin && (
                       <button onClick={() => updateConvidado(c.id, { checkin: true })} className="btn-secondary py-1 px-2 text-xs flex items-center gap-1"><CheckCircle size={12}/> Marcar Chegada</button>
                    )}
                    <button onClick={() => deleteConvidado(c.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={14}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {qrModal && (
        <div className="modal-overlay" onClick={() => setQrModal(null)}>
          <div className="bg-white p-8 rounded-xl shadow-2xl text-center max-w-sm w-full relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setQrModal(null)} className="absolute top-3 right-3 text-gray-400 hover:text-gray-700">
              <X size={20} />
            </button>
            <div id="qr-ticket-content" className="p-4 bg-white">
              <h3 className="font-bold text-xl text-gray-800 mb-2">Passe de Entrada</h3>
              <p className="text-gray-500 mb-2">{evento.nome}</p>
              <p className="font-bold text-brand-700 mb-6 uppercase tracking-wider">{qrModal.nome}</p>
              <div className="bg-white p-4 border rounded-xl inline-block shadow-sm">
                <QRCodeCanvas value={qrModal.codigo} size={200} />
              </div>
              <p className="text-xs text-gray-400 mt-6">Apresente este QR Code na portaria.</p>
              <p className="text-[10px] text-gray-300 mt-1">{qrModal.codigo}</p>
            </div>
            <div className="mt-6 flex flex-col gap-2">
              <button onClick={sendWhatsApp} className="btn-secondary w-full flex items-center justify-center gap-2 py-3 bg-[#25D366] hover:bg-[#128C7E] text-white border-transparent shadow-sm">
                <Share2 size={18} /> Compartilhar no WhatsApp
              </button>
              <button onClick={copyLink} className="btn-primary w-full flex items-center justify-center gap-2 py-3 bg-white border-cream-400 text-gray-700 hover:bg-cream-100 shadow-sm">
                <Copy size={18} /> Copiar Link do Convite
              </button>
              <button onClick={sendPushToResident} className="btn-secondary w-full flex items-center justify-center gap-2 py-3 text-brand-600 bg-brand-50 border-brand-200 hover:bg-brand-100">
                <Bell size={18} /> Enviar Push para o Morador
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Eventos() {
  const { user } = useAuth()
  const { items: allEventos, addItem: addEvento, updateItem: updateEvento, deleteItem: deleteEvento } = useFirestore('eventos')
  const { items: allConvidados, addItem: addConvidado, updateItem: updateConvidado, deleteItem: deleteConvidado } = useFirestore('eventos_convidados')
  const { items: condominiosList } = useFirestore('condominios')
  const { addItem: addNotificacao } = useFirestore('notificacoes')

  const [modalEvento, setModalEvento] = useState(null)
  const [gerenciando, setGerenciando] = useState(null)
  const [scannerOpen, setScannerOpen] = useState(false)

  const isMorador = user?.role === 'Morador'
  const isPortaria = user?.role === 'Portaria'

  const condominios = condominiosList.filter(c => c.status !== 'Inativo').map(c => c.nome)

  const eventosFiltrados = allEventos.filter(e => {
    if (isMorador || isPortaria) return e.condominio === user?.condominio
    return true
  }).sort((a,b) => new Date(b.data) - new Date(a.data))

  const handleSaveEvento = async (form) => {
    if (form.id) await updateEvento(form.id, form)
    else await addEvento({ ...form, criadorId: user?.id || 'admin' })
    setModalEvento(null)
  }

  const handleScan = (codigoLido) => {
    setScannerOpen(false)
    const convidadoEncontrado = allConvidados.find(c => c.codigo === codigoLido)
    if (convidadoEncontrado) {
      if (convidadoEncontrado.checkin) {
        alert(`O check-in de ${convidadoEncontrado.nome} JÁ FOI REALIZADO anteriormente!`)
      } else {
        updateConvidado(convidadoEncontrado.id, { checkin: true, dataCheckin: new Date().toISOString() })
        alert(`✅ Check-in de ${convidadoEncontrado.nome} realizado com sucesso!`)
      }
    } else {
      alert("❌ QR Code inválido ou não encontrado no sistema!")
    }
  }

  if (gerenciando) {
    const convidadosDoEvento = allConvidados.filter(c => c.eventoId === gerenciando.id)
    return <GerenciarConvidados 
             evento={gerenciando} 
             convidados={convidadosDoEvento}
             addConvidado={addConvidado}
             updateConvidado={updateConvidado}
             deleteConvidado={deleteConvidado}
             onVoltar={() => setGerenciando(null)}
             addNotificacao={addNotificacao}
           />
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="section-title text-2xl">Eventos & Check-in</h2>
          <p className="section-sub">Gestão de convidados e acesso por QR Code</p>
        </div>
        <div className="flex gap-2">
          {(user?.role === 'Administrador' || user?.role === 'Portaria' || user?.role === 'Síndico') && (
            <button onClick={() => setScannerOpen(true)} className="btn-secondary bg-brand-50 border-brand-200 text-brand-700 flex items-center gap-2">
              <Scan size={18} /> Escanear QR Code
            </button>
          )}
          {!isPortaria && (
            <button onClick={() => setModalEvento({ condominio: user?.condominio || '' })} className="btn-primary flex items-center gap-2">
              <Plus size={18} /> Criar Evento
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {eventosFiltrados.length === 0 ? (
          <div className="col-span-full card text-center py-10 text-gray-400">
            Nenhum evento criado no momento.
          </div>
        ) : eventosFiltrados.map(e => {
          const totalConvidados = allConvidados.filter(c => c.eventoId === e.id).length
          const checkinsRealizados = allConvidados.filter(c => c.eventoId === e.id && c.checkin).length
          
          return (
            <div key={e.id} className="card hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10"><CalendarCheck size={64}/></div>
              <h3 className="font-bold text-lg text-gray-800 mb-1">{e.nome}</h3>
              <p className="text-sm text-brand-600 font-semibold mb-3">{e.data ? e.data.split('-').reverse().join('/') : ''} • {e.local}</p>
              
              <div className="flex items-center gap-4 mt-4 text-sm text-gray-600 bg-cream-50 p-3 rounded-lg border border-cream-100">
                <div className="flex-1">
                  <p className="text-xs uppercase font-bold text-gray-400 mb-1">Convidados</p>
                  <p className="font-bold flex items-center gap-2"><Users size={14}/> {totalConvidados}</p>
                </div>
                <div className="flex-1">
                  <p className="text-xs uppercase font-bold text-gray-400 mb-1">Check-ins</p>
                  <p className="font-bold text-emerald-600 flex items-center gap-2"><CheckCircle size={14}/> {checkinsRealizados}</p>
                </div>
              </div>

              <div className="flex gap-2 mt-4 pt-4 border-t border-cream-200">
                <button onClick={() => setGerenciando(e)} className="btn-primary flex-1 py-2 text-sm justify-center">Gerenciar Lista</button>
                {(user?.role === 'Administrador' || user?.id === e.criadorId) && (
                  <>
                    <button onClick={() => setModalEvento(e)} className="btn-secondary py-2 px-3"><QrCode size={16} className="opacity-0 w-0" style={{display:'none'}}/> Editar</button>
                    <button onClick={() => deleteEvento(e.id)} className="btn-secondary text-red-500 py-2 px-3 border-red-200 hover:bg-red-50"><Trash2 size={16}/></button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {modalEvento && <ModalEvento data={modalEvento.id ? modalEvento : null} condominios={condominios} onClose={() => setModalEvento(null)} onSave={handleSaveEvento} />}
      {scannerOpen && <Scanner onScan={handleScan} onClose={() => setScannerOpen(false)} />}
    </div>
  )
}
