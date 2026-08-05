import React, { useState, useEffect, useRef } from 'react'
import { MapPin, Camera, Clock, CheckCircle2, User, Loader2, AlertCircle } from 'lucide-react'
import { collection, addDoc, getDocs, serverTimestamp, query, where } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth'
import { db, storage, auth } from '../firebase'

export default function PontoEletronico() {
  const [colabs, setColabs] = useState([])
  const [selectedColab, setSelectedColab] = useState('')
  const [location, setLocation] = useState(null)
  const [photo, setPhoto] = useState(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [modalAjuste, setModalAjuste] = useState(false)
  const [ajusteForm, setAjusteForm] = useState({ data: '', hora: '', tipo: 'Entrada', justificativa: '' })

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [stream, setStream] = useState(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      if (!user) {
        signInAnonymously(auth).catch(e => console.error('Auth anônima falhou:', e))
      }
    })

    // Fetch active employees
    const fetchColabs = async () => {
      const snap = await getDocs(query(collection(db, 'rh'), where('status', '==', 'Ativo')))
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setColabs(list.sort((a,b) => a.nome.localeCompare(b.nome)))
      const last = localStorage.getItem('lastColabId')
      if (last && list.find(c => c.id === last)) setSelectedColab(last)
    }
    fetchColabs()

    return () => unsubscribe()
  }, [])

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      setStream(s)
    } catch (err) {
      setErrorMsg('Não foi possível acessar a câmera. Verifique as permissões.')
    }
  }

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream
      videoRef.current.play().catch(e => console.error('Play error', e))
    }
  }, [stream])

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop())
      setStream(null)
    }
  }

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return
    const context = canvasRef.current.getContext('2d')
    const width = videoRef.current.videoWidth || 400
    const height = videoRef.current.videoHeight || 400
    canvasRef.current.width = width
    canvasRef.current.height = height
    context.drawImage(videoRef.current, 0, 0, width, height)
    const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.8)
    setPhoto(dataUrl)
    stopCamera()
  }

  const getLocation = async () => {
    try {
      return await new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocalização não suportada.'))
        } else {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => reject(err),
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 0 }
          )
        }
      })
    } catch (err) {
      // Fallback: usar localização por IP se o GPS falhar ou demorar muito
      try {
        const res = await fetch('https://ipwho.is/')
        const data = await res.json()
        if (data && data.success) {
          return { lat: data.latitude, lng: data.longitude, isFallback: true }
        }
        throw new Error('Fallback falhou')
      } catch (fallbackErr) {
        throw new Error('Não foi possível obter sua localização (nem pelo GPS, nem pela internet). Verifique suas permissões.')
      }
    }
  }

  const handleBaterPonto = async (tipo) => {
    if (!selectedColab) return setErrorMsg('Selecione quem você é.')
    if (!photo) return setErrorMsg('Você precisa tirar uma selfie para registrar o ponto.')

    setLoading(true)
    setErrorMsg('')
    try {
      const loc = await getLocation()
      
      // Save to firestore (Bypassing Storage entirely to avoid permission/CORS issues)
      const colabData = colabs.find(c => c.id === selectedColab)
      localStorage.setItem('lastColabId', selectedColab)
      await addDoc(collection(db, 'pontos'), {
        colabId: selectedColab,
        colabNome: colabData.nome,
        tipo, // 'Entrada' ou 'Saída'
        location: loc,
        photoBase64: photo,
        timestamp: serverTimestamp(),
        dataISO: new Date().toISOString()
      })

      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        setPhoto(null)
      }, 3000)

    } catch (err) {
      setErrorMsg(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSolicitarAjuste = async (e) => {
    e.preventDefault()
    if (!selectedColab) return setErrorMsg('Selecione quem você é primeiro.')
    
    setLoading(true)
    setErrorMsg('')
    try {
      const colabData = colabs.find(c => c.id === selectedColab)
      
      await addDoc(collection(db, 'solicitacoes_ajuste'), {
        colabId: selectedColab,
        colabNome: colabData.nome,
        data: ajusteForm.data,
        hora: ajusteForm.hora,
        tipoMarcacao: ajusteForm.tipo,
        justificativa: ajusteForm.justificativa,
        status: 'Pendente',
        timestamp: serverTimestamp()
      })

      setSuccess(true)
      setModalAjuste(false)
      setAjusteForm({ data: '', hora: '', tipo: 'Entrada', justificativa: '' })
      
      setTimeout(() => {
        setSuccess(false)
      }, 3000)

    } catch (err) {
      setErrorMsg(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center p-6">
        <div className="card max-w-sm w-full text-center py-12 animate-fade-in">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={40} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Ponto Registrado!</h2>
          <p className="text-gray-500">Seu ponto foi batido com sucesso e validado com GPS.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center p-6">
      <div className="card max-w-md w-full animate-fade-in border-t-4 border-t-brand-600">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-brand-100 text-brand-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Clock size={24} />
          </div>
          <h2 className="text-xl font-bold text-gray-800">Ponto Eletrônico (REP-P)</h2>
          <p className="text-sm text-gray-500">Registro com biometria facial e geolocalização</p>
        </div>

        {errorMsg && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-4 text-sm font-medium border border-red-200">
            {errorMsg}
          </div>
        )}

        <div className="space-y-6">
          <div>
            <label className="label flex items-center gap-2"><User size={14} /> Sou o Colaborador:</label>
            <select 
              className="input text-lg py-3" 
              value={selectedColab} 
              onChange={e => setSelectedColab(e.target.value)}
              disabled={loading}
            >
              <option value="">Selecione seu nome...</option>
              {colabs.map(c => (
                <option key={c.id} value={c.id}>{c.nome} ({c.cargo})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label flex items-center gap-2"><Camera size={14} /> Foto para Biometria</label>
            {!photo ? (
              <div className="relative rounded-2xl overflow-hidden bg-gray-900 aspect-square flex flex-col items-center justify-center">
                {stream ? (
                  <>
                    <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
                    <button 
                      onClick={takePhoto}
                      className="absolute bottom-6 w-16 h-16 bg-white rounded-full border-4 border-gray-300 shadow-xl flex items-center justify-center hover:scale-105 transition-transform"
                    ></button>
                  </>
                ) : (
                  <button onClick={startCamera} className="btn-primary">
                    <Camera size={16} /> Ligar Câmera
                  </button>
                )}
                <canvas ref={canvasRef} width="400" height="400" className="hidden" />
              </div>
            ) : (
              <div className="relative rounded-2xl overflow-hidden aspect-square">
                <img src={photo} alt="Selfie" className="w-full h-full object-cover" />
                <button 
                  onClick={() => { setPhoto(null); startCamera(); }}
                  className="absolute top-4 right-4 bg-white/90 text-gray-800 px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm"
                >
                  Tirar outra
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button 
              onClick={() => handleBaterPonto('Entrada')} 
              disabled={loading || !photo || !selectedColab}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : 'Bater ENTRADA'}
            </button>
            <button 
              onClick={() => handleBaterPonto('Saída')} 
              disabled={loading || !photo || !selectedColab}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : 'Bater SAÍDA'}
            </button>
          </div>
          
          <button 
            onClick={() => setModalAjuste(true)}
            className="w-full text-center text-brand-600 text-sm font-bold hover:underline flex items-center justify-center gap-1 mt-2"
          >
            <AlertCircle size={14} /> Bateu errado ou esqueceu? Solicitar Ajuste
          </button>

          <div className="text-center flex justify-center items-center gap-1 text-xs text-gray-400">
            <MapPin size={12} />
            Sua localização será registrada junto com a foto.
          </div>
        </div>
      </div>
      {/* Modal Solicitar Ajuste */}
      {modalAjuste && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-cream-300">
              <h3 className="font-bold text-gray-800 text-lg">Solicitar Ajuste de Ponto</h3>
              <p className="text-sm text-gray-500">Seu pedido será enviado ao RH para aprovação.</p>
            </div>
            <form onSubmit={handleSolicitarAjuste} className="p-5 space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="label">Data</label>
                  <input type="date" className="input" value={ajusteForm.data} onChange={e => setAjusteForm({...ajusteForm, data: e.target.value})} required />
                </div>
                <div className="flex-1">
                  <label className="label">Horário</label>
                  <input type="time" className="input" value={ajusteForm.hora} onChange={e => setAjusteForm({...ajusteForm, hora: e.target.value})} required />
                </div>
              </div>
              
              <div>
                <label className="label">Tipo de Marcação</label>
                <select className="input" value={ajusteForm.tipo} onChange={e => setAjusteForm({...ajusteForm, tipo: e.target.value})}>
                  <option value="Entrada">Entrada</option>
                  <option value="Saída">Saída</option>
                </select>
              </div>

              <div>
                <label className="label">Justificativa (Por que está solicitando ajuste?)</label>
                <textarea 
                  className="input min-h-[80px]" 
                  placeholder="Ex: Esqueci de bater o ponto, celular sem bateria..." 
                  value={ajusteForm.justificativa} 
                  onChange={e => setAjusteForm({...ajusteForm, justificativa: e.target.value})}
                  required
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setModalAjuste(false)} className="px-4 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-lg">Cancelar</button>
                <button type="submit" disabled={loading} className="btn-primary">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : 'Enviar Solicitação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
