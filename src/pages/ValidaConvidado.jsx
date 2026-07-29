import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { ShieldCheck, Calendar, MapPin, CheckCircle, XCircle, ArrowLeft } from 'lucide-react'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { Camera as CameraIcon } from 'lucide-react'

export default function ValidaConvidado() {
  const { id } = useParams()
  const [convidado, setConvidado] = useState(null)
  const [evento, setEvento] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCamera, setShowCamera] = useState(false)
  const [stream, setStream] = useState(null)
  const videoRef = React.useRef(null)

  useEffect(() => {
    async function loadDados() {
      try {
        const docRef = doc(db, 'eventos_convidados', id)
        const snap = await getDoc(docRef)
        if (snap.exists()) {
          const conv = { id: snap.id, ...snap.data() }
          setConvidado(conv)
          // buscar evento
          const evRef = doc(db, 'eventos', conv.eventoId)
          const evSnap = await getDoc(evRef)
          if (evSnap.exists()) {
            setEvento({ id: evSnap.id, ...evSnap.data() })
          } else {
             setError('Evento não encontrado.')
          }
        } else {
          setError('Convite não encontrado ou inválido.')
        }
      } catch (err) {
        setError('Erro ao ler convite. Tente novamente.')
      }
      setLoading(false)
    }
    loadDados()
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-50 flex items-center justify-center p-4">
        <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full mx-auto"></div>
      </div>
    )
  }

  if (error || !convidado || !evento) {
    return (
      <div className="min-h-screen bg-brand-50 flex flex-col items-center justify-center p-4">
        <XCircle size={64} className="text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-800 text-center mb-2">{error}</h2>
        <Link to="/login" className="btn-primary mt-6"><ArrowLeft size={16} /> Voltar ao Início</Link>
      </div>
    )
  }

  const { nome, codigo, checkin } = convidado
  
  let validadeMsg = checkin ? 'Entrada Já Registrada' : 'Válido para o Evento'
  let isValid = !checkin

  const openCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      setStream(mediaStream)
      setShowCamera(true)
    } catch (err) {
      alert('Não foi possível acessar a câmera. Verifique as permissões do navegador.')
    }
  }

  useEffect(() => {
    if (showCamera && videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [showCamera, stream])

  const closeCamera = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop())
      setStream(null)
    }
    setShowCamera(false)
  }

  const capturePhoto = async () => {
    if (!videoRef.current) return
    const canvas = document.createElement('canvas')
    canvas.width = 300
    canvas.height = 300
    const ctx = canvas.getContext('2d')
    const video = videoRef.current
    const size = Math.min(video.videoWidth, video.videoHeight)
    const x = (video.videoWidth - size) / 2
    const y = (video.videoHeight - size) / 2
    ctx.drawImage(video, x, y, size, size, 0, 0, 300, 300)
    
    const base64Photo = canvas.toDataURL('image/jpeg', 0.6)
    closeCamera()
    
    try {
      setLoading(true)
      await updateDoc(doc(db, 'eventos_convidados', id), { foto: base64Photo })
      setConvidado(prev => ({ ...prev, foto: base64Photo }))
      setLoading(false)
    } catch (err) {
      alert('Erro ao salvar a foto.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-900 to-brand-700 flex flex-col items-center p-4 sm:p-8 font-sans">
      
      <div className="flex-1 w-full max-w-sm flex items-center justify-center animate-fade-in mt-4">
        <div className="bg-white rounded-3xl w-full shadow-2xl overflow-hidden relative">
          
          {/* Header */}
          <div className={`p-8 pb-10 text-center text-white relative ${isValid ? 'bg-gradient-to-br from-emerald-500 to-emerald-600' : 'bg-gradient-to-br from-gray-600 to-gray-700'}`}>
            <ShieldCheck size={48} className={`mx-auto mb-4 ${isValid ? 'text-emerald-100' : 'text-gray-300'}`} />
            <p className="text-sm font-bold uppercase tracking-widest text-white/80 mb-1">Passe de Evento</p>
            <h1 className="text-3xl font-black mb-1">Alpha Condomínios</h1>
          </div>

          {/* Ticket recortes */}
          <div className="relative h-px bg-transparent flex items-center">
            <div className="absolute left-[-16px] w-[32px] h-[32px] bg-brand-800 rounded-full"></div>
            <div className="w-full border-t-[3px] border-dashed border-gray-300 relative top-[-1px]"></div>
            <div className="absolute right-[-16px] w-[32px] h-[32px] bg-brand-800 rounded-full"></div>
          </div>

          <div className="p-8 pt-6">
            <div className="text-center mb-6 border-b border-gray-100 pb-6">
               <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Convidado</p>
               <h2 className="text-2xl font-black text-gray-800">{nome}</h2>
            </div>
            
            <div className="flex flex-col gap-4 mb-8">
              <div className="flex gap-3 items-center text-gray-600">
                <Calendar size={20} className="text-brand-500" />
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Evento / Data</p>
                  <p className="text-sm font-semibold">{evento.nome} {evento.data ? `• ${evento.data.split('-').reverse().join('/')}` : ''}</p>
                </div>
              </div>

              <div className="flex gap-3 items-center text-gray-600">
                <MapPin size={20} className="text-brand-500" />
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Local</p>
                  <p className="text-sm font-semibold">{evento.local || evento.condominio}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <div className={`p-4 rounded-2xl mb-4 border-2 shadow-sm ${isValid ? 'bg-white border-emerald-100' : 'bg-gray-50 border-gray-200 opacity-60'}`}>
                <QRCodeSVG 
                  value={codigo} 
                  size={180} 
                  level="H" 
                  includeMargin={false} 
                  fgColor={isValid ? "#111827" : "#6b7280"}
                />
              </div>

              <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${isValid ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                {isValid ? <CheckCircle size={18} /> : <XCircle size={18} />}
                <p className="text-sm font-bold">{validadeMsg}</p>
              </div>
            </div>

            {/* Secao de Biometria */}
            <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col items-center">
              {convidado.foto ? (
                <div className="flex flex-col items-center">
                  <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-brand-100 mb-2 shadow-sm">
                    <img src={convidado.foto} alt="Biometria" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex items-center gap-1 text-emerald-600">
                    <CheckCircle size={14} />
                    <p className="text-xs font-bold uppercase tracking-wider">Biometria Registrada</p>
                  </div>
                </div>
              ) : (
                <div className="text-center w-full">
                  <p className="text-xs text-gray-500 mb-3">Acelere sua entrada na portaria:</p>
                  <button onClick={openCamera} className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all">
                    <CameraIcon size={18} />
                    Registrar Biometria Facial
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
      
      {showCamera && (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4">
          <div className="relative w-full max-w-sm aspect-square bg-gray-900 rounded-3xl overflow-hidden mb-6 shadow-2xl border-2 border-white/20">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover"></video>
            <div className="absolute inset-0 border-4 border-dashed border-white/30 rounded-3xl pointer-events-none opacity-50 m-8"></div>
          </div>
          <p className="text-white mb-8 text-center text-sm">Posicione seu rosto no centro e certifique-se de estar em um local iluminado.</p>
          <div className="flex gap-4 w-full max-w-sm">
            <button onClick={closeCamera} className="flex-1 py-4 bg-gray-800 text-white rounded-xl font-bold">Cancelar</button>
            <button onClick={capturePhoto} className="flex-1 py-4 bg-brand-500 text-white rounded-xl font-bold">Tirar Foto</button>
          </div>
        </div>
      )}
      
      <p className="text-brand-200/50 text-xs mt-8 mb-4">Apresente esta tela na portaria do condomínio.</p>
    </div>
  )
}
