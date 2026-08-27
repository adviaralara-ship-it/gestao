import React, { useState } from 'react'
import { Plus, Search, Shield, CheckCircle2, XCircle, Clock, AlertTriangle, QrCode, X, User, Camera } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, query, where, getDocs } from 'firebase/firestore'
import { db } from '../firebase'

export default function Portaria() {
  const { user } = useAuth()
  const { items: visitantes, addItem: addVisit, updateItem: updateVisit, deleteItem: delVisit } = useFirestore('portaria_visitantes')
  const { items: manutencoes, addItem: addManut, updateItem: updateManut } = useFirestore('portaria_manutencoes')
  const [tab, setTab] = useState('visitantes')
  const [search, setSearch] = useState('')
  const [showScanner, setShowScanner] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [fotoModal, setFotoModal] = useState(null)

  // Formulário manual de entrada
  const [form, setForm] = useState({
    nome: '', destino: '', tipo: 'Visitante', autorizadoPor: '', doc: '', placa: '', condominio: user?.condominio || ''
  })

  const registrarEntrada = async () => {
    if (!form.nome.trim() || !form.destino.trim()) {
      alert('Preencha Nome e Destino.')
      return
    }
    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    await addVisit({
      ...form,
      entrada: hora,
      saida: '—',
      data: new Date().toLocaleDateString('pt-BR'),
      status: 'No local',
      autorizado: true,
      condominio: user?.condominio || form.condominio || ''
    })
    setForm({ nome: '', destino: '', tipo: 'Visitante', autorizadoPor: '', doc: '', placa: '', condominio: user?.condominio || '' })
  }

  const registrarSaida = async (id) => {
    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    await updateVisit(id, { saida: hora, status: 'Saiu' })
  }

  const toggleAutorizacao = async (id, liberado) => {
    await updateVisit(id, { autorizado: liberado, status: liberado ? 'No local' : 'Barrado' })
    if (!liberado) {
      await addDoc(collection(db, 'notificacoes'), {
        text: `⛔ Acesso negado na portaria para: ${visitantes.find(v => v.id === id)?.nome || ''}`,
        time: new Date().toISOString(), tipo: 'portaria', lida: false, _createdAt: serverTimestamp()
      })
    }
  }

  // Effect para Scanner de QR Code
  React.useEffect(() => {
    let scanner = null
    if (showScanner) {
      scanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false)
      scanner.render((text) => {
        scanner.clear()
        setShowScanner(false)
        handleQRScanned(text)
      }, (err) => {
        // ignore scan errors
      })
    }
    return () => {
      if (scanner) {
        scanner.clear().catch(e => console.error("Failed to clear scanner", e))
      }
    }
  }, [showScanner])

  const handleQRScanned = async (text) => {
    try {
      setScanResult({ type: 'loading', msg: 'Verificando dados do QR Code...' })
      
      let cleanId = text.trim()

      // Extrai ID se for URL
      if (cleanId.includes('/visitantes/valida/')) {
        cleanId = cleanId.split('/visitantes/valida/')[1].split('?')[0].split('#')[0].trim()
      } else if (cleanId.includes('/eventos/valida/')) {
        cleanId = cleanId.split('/eventos/valida/')[1].split('?')[0].split('#')[0].trim()
      } else if (cleanId.includes('/valida-convidado/')) {
        cleanId = cleanId.split('/valida-convidado/')[1].split('?')[0].split('#')[0].trim()
      }

      const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

      // 1. TENTA BUSCAR EM 'visitantes'
      try {
        const visRef = doc(db, 'visitantes', cleanId)
        const snap = await getDoc(visRef)
        if (snap.exists()) {
          const vis = snap.data()
          if (vis.status === 'Cancelado') {
            setScanResult({ type: 'error', msg: '⛔ Atenção: Este convite foi CANCELADO pelo morador.' })
            return
          }
          if (vis.status === 'Acessou' && vis.entradaRegistrada) {
            setScanResult({ type: 'error', msg: `⚠️ Atenção: Entrada de ${vis.nome} já foi registrada anteriormente.` })
            return
          }

          // Registra entrada na portaria
          await addVisit({
            nome: vis.nome || 'Visitante (QR Code)',
            destino: `${vis.moradorNome ? 'Morador: ' + vis.moradorNome : ''} ${vis.apt ? '(Apt ' + vis.apt + ')' : ''}`.trim() || 'Unidade Residencial',
            tipo: 'Visitante',
            autorizadoPor: vis.moradorNome ? `${vis.moradorNome} (QR Code)` : 'Morador',
            entrada: hora,
            saida: '—',
            data: new Date().toLocaleDateString('pt-BR'),
            status: 'No local',
            autorizado: true,
            foto: vis.foto || null,
            doc: vis.documento || '',
            condominio: vis.condominio || user?.condominio || ''
          })

          await updateDoc(visRef, { status: 'Acessou', entradaRegistrada: new Date().toISOString() })
          setScanResult({
            type: 'success',
            msg: `✅ Entrada de ${vis.nome} LIBERADA com sucesso! Destino: ${vis.moradorNome || 'Morador'} (Apt ${vis.apt || '—'})`,
            foto: vis.foto || null
          })
          return
        }
      } catch (err) {
        console.error("Erro ao buscar em visitantes:", err)
      }

      // 2. TENTA BUSCAR EM 'eventos_convidados'
      try {
        const evRef = doc(db, 'eventos_convidados', cleanId)
        const evSnap = await getDoc(evRef)
        if (evSnap.exists()) {
          const conv = evSnap.data()
          if (conv.checkin) {
            setScanResult({ type: 'error', msg: `⚠️ Check-in de ${conv.nome} já realizado.` })
            return
          }

          let eventoNome = 'Evento do Condomínio'
          if (conv.eventoId) {
            try {
              const eSnap = await getDoc(doc(db, 'eventos', conv.eventoId))
              if (eSnap.exists()) eventoNome = eSnap.data().nome || eventoNome
            } catch(e) {}
          }

          await addVisit({
            nome: conv.nome || 'Convidado (QR Code)',
            destino: `Evento: ${eventoNome}`,
            tipo: 'Visitante',
            autorizadoPor: 'QR Code de Evento',
            entrada: hora,
            saida: '—',
            data: new Date().toLocaleDateString('pt-BR'),
            status: 'No local',
            autorizado: true,
            foto: conv.foto || null,
            condominio: user?.condominio || ''
          })

          await updateDoc(evRef, { checkin: true, checkinAt: new Date().toISOString() })
          setScanResult({
            type: 'success',
            msg: `✅ Entrada de ${conv.nome} LIBERADA para o evento "${eventoNome}"!`,
            foto: conv.foto || null
          })
          return
        }
      } catch (err) {
        console.error("Erro ao buscar em eventos_convidados:", err)
      }

      // 3. BUSCA POR CÓDIGO (ex: EVT-...)
      try {
        const qEvt = query(collection(db, 'eventos_convidados'), where('codigo', '==', cleanId))
        const qSnap = await getDocs(qEvt)
        if (!qSnap.empty) {
          const docFound = qSnap.docs[0]
          const conv = docFound.data()
          if (conv.checkin) {
            setScanResult({ type: 'error', msg: `⚠️ Check-in de ${conv.nome} já foi realizado.` })
            return
          }

          await addVisit({
            nome: conv.nome,
            destino: 'Evento do Condomínio',
            tipo: 'Visitante',
            autorizadoPor: 'QR Code de Evento',
            entrada: hora,
            saida: '—',
            data: new Date().toLocaleDateString('pt-BR'),
            status: 'No local',
            autorizado: true,
            foto: conv.foto || null,
            condominio: user?.condominio || ''
          })

          await updateDoc(doc(db, 'eventos_convidados', docFound.id), { checkin: true, checkinAt: new Date().toISOString() })
          setScanResult({
            type: 'success',
            msg: `✅ Entrada de ${conv.nome} LIBERADA com sucesso!`,
            foto: conv.foto || null
          })
          return
        }
      } catch (e) {}

      setScanResult({ type: 'error', msg: '❌ QR Code não encontrado ou inválido no sistema.' })
    } catch (err) {
      console.error(err)
      setScanResult({ type: 'error', msg: 'Erro ao processar o QR Code.' })
    }
  }

  const visitFiltrados = visitantes.filter(v =>
    v.nome?.toLowerCase().includes(search.toLowerCase()) ||
    v.destino?.toLowerCase().includes(search.toLowerCase()) ||
    v.autorizadoPor?.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => new Date(b._createdAt || 0) - new Date(a._createdAt || 0))

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-7xl mx-auto pb-12">
      <div className="page-header">
        <div>
          <h2 className="section-title text-xl">Portaria & Controle de Acesso</h2>
          <p className="section-sub">Recepção de visitantes, leitura de QR Code, biometria facial e rondas</p>
        </div>
      </div>

      <div className="flex gap-2">
        {['visitantes', 'manutenção'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-xl text-sm font-bold capitalize transition-all ${
              tab === t ? 'bg-brand-600 text-white shadow-md' : 'bg-white text-gray-600 hover:text-brand-700 border border-cream-400'
            }`}
          >
            {t === 'visitantes' ? '👥 Visitantes & Entradas' : '🔧 Manutenções & Rondas'}
          </button>
        ))}
      </div>

      {tab === 'visitantes' && (
        <>
          {/* Card de Registro Rápido e Leitor QR Code */}
          <div className="bg-white p-6 rounded-2xl border border-pale-300 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <p className="font-black text-gray-900 text-base flex items-center gap-2">
                🚪 Registrar Entrada de Visitante / Prestador
              </p>
              <button
                onClick={() => { setScanResult(null); setShowScanner(true); }}
                className="btn-primary py-2.5 px-4 text-xs font-black bg-emerald-600 hover:bg-emerald-500 flex items-center gap-2 shadow-md"
              >
                <QrCode size={16} /> Ler QR Code na Câmera
              </button>
            </div>

            {/* Resultado do Scan */}
            {scanResult && (
              <div className={`p-4 rounded-xl mb-4 border flex items-center justify-between gap-3 ${
                scanResult.type === 'success' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' :
                scanResult.type === 'error' ? 'bg-rose-50 border-rose-300 text-rose-900' :
                'bg-blue-50 border-blue-300 text-blue-900'
              }`}>
                <div className="flex items-center gap-3">
                  {scanResult.foto && (
                    <img src={scanResult.foto} alt="Visitante" className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500 shadow-sm" />
                  )}
                  <div>
                    <p className="text-sm font-black">{scanResult.msg}</p>
                    <p className="text-xs opacity-75 mt-0.5">Validação de entrada em tempo real</p>
                  </div>
                </div>
                <button onClick={() => setScanResult(null)} className="p-1 rounded-lg hover:bg-black/10 text-gray-600">
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Modal do Scanner */}
            {showScanner && (
              <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                <div className="bg-white p-6 rounded-3xl max-w-sm w-full relative">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                      <QrCode size={18} className="text-brand-600" /> Aponte para o QR Code
                    </h3>
                    <button onClick={() => setShowScanner(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
                      <X size={20} />
                    </button>
                  </div>
                  <div id="qr-reader" className="overflow-hidden rounded-2xl border border-gray-200"></div>
                  <p className="text-xs text-gray-400 text-center mt-3">Aponte a câmera para o QR Code do visitante ou convite.</p>
                </div>
              </div>
            )}

            {/* Formulário de Registro Manual */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="label">Nome do Visitante *</label>
                <input className="input w-full" placeholder="Nome completo" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
              </div>
              <div>
                <label className="label">Destino / Apartamento *</label>
                <input className="input w-full" placeholder="Ex: Bloco B Apt 103" value={form.destino} onChange={e => setForm(f => ({ ...f, destino: e.target.value }))} />
              </div>
              <div>
                <label className="label">Tipo de Acesso</label>
                <select className="input w-full" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                  <option>Visitante</option>
                  <option>Prestador de Serviço</option>
                  <option>Entrega / Delivery</option>
                  <option>Corretor / Mudança</option>
                </select>
              </div>
              <div>
                <label className="label">Autorizado Por</label>
                <input className="input w-full" placeholder="Nome do morador / Portaria" value={form.autorizadoPor} onChange={e => setForm(f => ({ ...f, autorizadoPor: e.target.value }))} />
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button onClick={registrarEntrada} className="btn-primary py-2 px-5 text-xs font-bold flex items-center gap-1.5 shadow-sm">
                <Plus size={15} /> Registrar Entrada Manual
              </button>
            </div>
          </div>

          {/* Lista de Registros de Acesso */}
          <div className="bg-white rounded-2xl border border-pale-300 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative w-full sm:max-w-xs">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-9 w-full text-xs" placeholder="Buscar por visitante ou destino..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <span className="text-xs font-bold text-gray-500">{visitFiltrados.length} registros hoje</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-gray-200">
                  <tr>
                    {['Visitante', 'Destino', 'Tipo', 'Autorizado Por', 'Entrada', 'Saída', 'Status', 'Ações'].map(h => (
                      <th key={h} className="table-head text-[11px] font-black text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visitFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-gray-400 text-xs font-medium">
                        Nenhum visitante registrado no momento.
                      </td>
                    </tr>
                  ) : (
                    visitFiltrados.map(v => (
                      <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="table-cell">
                          <div className="flex items-center gap-2.5">
                            {v.foto ? (
                              <img
                                onClick={() => setFotoModal(v.foto)}
                                src={v.foto}
                                alt={v.nome}
                                className="w-8 h-8 rounded-full object-cover border-2 border-emerald-400 cursor-pointer hover:scale-110 transition-transform shadow-sm"
                                title="Ver Foto Facial"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-slate-100 border border-gray-200 flex items-center justify-center text-gray-400">
                                <User size={15} />
                              </div>
                            )}
                            <div>
                              <p className="font-bold text-gray-900 text-xs">{v.nome}</p>
                              {v.doc && <p className="text-[10px] text-gray-400 font-mono">Doc: {v.doc}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="table-cell text-xs font-bold text-gray-700">{v.destino}</td>
                        <td className="table-cell">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                            {v.tipo}
                          </span>
                        </td>
                        <td className="table-cell text-xs text-gray-600">{v.autorizadoPor || '—'}</td>
                        <td className="table-cell text-xs font-bold text-emerald-700">{v.entrada || '—'}</td>
                        <td className="table-cell text-xs font-bold text-gray-500">{v.saida || '—'}</td>
                        <td className="table-cell">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase ${
                            v.status === 'No local' ? 'bg-emerald-100 text-emerald-800' :
                            v.status === 'Saiu' ? 'bg-slate-100 text-slate-700' :
                            'bg-rose-100 text-rose-800'
                          }`}>
                            {v.status || 'Ativo'}
                          </span>
                        </td>
                        <td className="table-cell">
                          <div className="flex items-center gap-1.5">
                            {v.status === 'No local' && (
                              <button
                                onClick={() => registrarSaida(v.id)}
                                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold transition-all"
                              >
                                Registrar Saída
                              </button>
                            )}
                            <button
                              onClick={() => delVisit(v.id)}
                              className="p-1 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                              title="Excluir"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal de Foto Ampliada */}
      {fotoModal && (
        <div className="modal-overlay" onClick={() => setFotoModal(null)}>
          <div className="relative p-2 animate-fade-in text-center" onClick={e => e.stopPropagation()}>
            <button onClick={() => setFotoModal(null)} className="absolute -top-3 -right-3 bg-white rounded-full p-2 shadow-lg text-gray-600 hover:text-rose-600 z-10">
              <X size={18} />
            </button>
            <img src={fotoModal} alt="Biometria Facial" className="max-w-[90vw] max-h-[80vh] rounded-3xl shadow-2xl border-4 border-white object-contain" />
            <p className="text-white text-xs font-bold mt-2">Biometria Facial / Foto do Visitante</p>
          </div>
        </div>
      )}
    </div>
  )
}
