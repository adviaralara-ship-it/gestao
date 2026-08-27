import React, { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { ShieldCheck, Calendar, Car, MapPin, CheckCircle, XCircle, ArrowLeft, Camera, Upload, Check, RefreshCw } from 'lucide-react'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'

export default function ValidaVisitante() {
  const { id } = useParams()
  const [visitante, setVisitante] = useState(null)
  const [tipoOrigem, setTipoOrigem] = useState('visitantes') // 'visitantes' ou 'eventos_convidados'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [stream, setStream] = useState(null)
  const videoRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    async function loadConvite() {
      try {
        // 1. Tenta buscar em 'visitantes'
        const docRef = doc(db, 'visitantes', id)
        const snap = await getDoc(docRef)
        
        if (snap.exists()) {
          setVisitante({ id: snap.id, ...snap.data() })
          setTipoOrigem('visitantes')
        } else {
          // 2. Se não encontrar, tenta buscar em 'eventos_convidados'
          const evDocRef = doc(db, 'eventos_convidados', id)
          const evSnap = await getDoc(evDocRef)
          
          if (evSnap.exists()) {
            const convData = evSnap.data()
            let evNome = 'Evento do Condomínio'
            let evData = ''
            let evLocal = 'Área Comum'
            let evCondo = ''
            
            if (convData.eventoId) {
              try {
                const eSnap = await getDoc(doc(db, 'eventos', convData.eventoId))
                if (eSnap.exists()) {
                  const eData = eSnap.data()
                  evNome = eData.nome || evNome
                  evData = eData.data || evData
                  evLocal = eData.local || evLocal
                  evCondo = eData.condominio || ''
                }
              } catch(e) {}
            }

            setVisitante({
              id: evSnap.id,
              nome: convData.nome,
              moradorNome: convData.moradorNome || 'Organizador',
              apt: convData.apt || '',
              condominio: evCondo || convData.condominio || '',
              dataVisita: evData || convData.data || new Date().toISOString().split('T')[0],
              documento: convData.documento || convData.codigo || '',
              status: convData.checkin ? 'Acessou' : 'Autorizado',
              foto: convData.foto || null,
              eventoNome: evNome,
              eventoLocal: evLocal
            })
            setTipoOrigem('eventos_convidados')
          } else {
            setError('Convite não encontrado ou link expirado.')
          }
        }
      } catch (err) {
        console.error("Erro ao carregar convite:", err)
        setError('Erro ao ler convite. Tente novamente.')
      }
      setLoading(false)
    }
    loadConvite()
  }, [id])

  useEffect(() => {
    if (showCamera && videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [showCamera, stream])

  const openCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      setStream(mediaStream)
      setShowCamera(true)
    } catch (err) {
      // Fallback para abrir a câmera nativa do celular via input file
      if (fileInputRef.current) {
        fileInputRef.current.click()
      }
    }
  }

  const closeCamera = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop())
      setStream(null)
    }
    setShowCamera(false)
  }

  const savePhotoData = async (base64Photo) => {
    try {
      setUploadingPhoto(true)
      const targetCol = tipoOrigem === 'eventos_convidados' ? 'eventos_convidados' : 'visitantes'
      await updateDoc(doc(db, targetCol, id), { foto: base64Photo })
      setVisitante(prev => ({ ...prev, foto: base64Photo }))
      setUploadingPhoto(false)
    } catch (err) {
      console.error("Erro ao salvar foto:", err)
      alert('Não foi possível salvar a foto. Tente novamente.')
      setUploadingPhoto(false)
    }
  }

  const captureWebcam = async () => {
    if (!videoRef.current) return
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 320
    const ctx = canvas.getContext('2d')
    const video = videoRef.current
    const size = Math.min(video.videoWidth, video.videoHeight)
    const x = (video.videoWidth - size) / 2
    const y = (video.videoHeight - size) / 2
    ctx.drawImage(video, x, y, size, size, 0, 0, 320, 320)
    
    const base64Photo = canvas.toDataURL('image/jpeg', 0.7)
    closeCamera()
    await savePhotoData(base64Photo)
  }

  const handleFileChange = (e) => {
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
          if (h > maxDim) { w = Math.round((w * maxDim) / h); h = maxDim }
        }
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)
        const base64 = canvas.toDataURL('image/jpeg', 0.7)
        savePhotoData(base64)
      }
      img.src = event.target.result
    }
    reader.readAsDataURL(file)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
        <div className="animate-spin w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full mb-3"></div>
        <p className="text-sm font-bold text-gray-300">Carregando convite...</p>
      </div>
    )
  }

  if (error || !visitante) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white text-center">
        <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
          <XCircle size={40} />
        </div>
        <h2 className="text-xl font-bold mb-2">{error || 'Convite não encontrado.'}</h2>
        <p className="text-xs text-gray-400 max-w-xs mb-6">Verifique se o link está correto ou solicite um novo convite ao morador anfitrião.</p>
        <Link to="/" className="btn-primary py-2.5 px-6 text-sm font-bold">
          <ArrowLeft size={16} /> Voltar ao Início
        </Link>
      </div>
    )
  }

  const { nome, documento, moradorNome, apt, dataVisita, status, condominio, eventoNome } = visitante
  const dataConvite = dataVisita ? new Date(dataVisita + 'T12:00:00') : new Date()

  // Regra de Validade
  const hoje = new Date()
  hoje.setHours(0,0,0,0)
  const diaConvite = new Date(dataConvite)
  diaConvite.setHours(0,0,0,0)
  
  let validadeMsg = ''
  let isValid = false
  if (status === 'Acessou') {
    validadeMsg = 'Entrada Já Registrada'
  } else if (diaConvite.getTime() < hoje.getTime()) {
    validadeMsg = 'Convite Expirado'
  } else {
    isValid = true
    validadeMsg = diaConvite.getTime() === hoje.getTime() ? 'Válido para Hoje' : 'Válido para a Data'
  }

  const qrValue = `https://alpha-solucoes-condominiais.vercel.app/visitantes/valida/${id}`

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      
      <div className="w-full max-w-sm flex items-center justify-center animate-fade-in my-auto">
        <div className="bg-white rounded-3xl w-full shadow-2xl overflow-hidden relative border border-slate-200">
          
          {/* Header do Bilhete */}
          <div className={`p-6 text-center text-white relative ${isValid ? 'bg-gradient-to-r from-emerald-600 to-teal-700' : 'bg-gradient-to-r from-slate-700 to-gray-800'}`}>
            <ShieldCheck size={36} className="mx-auto mb-2 text-white/90" />
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-200 mb-0.5">Passe de Entrada Virtual</p>
            <h1 className="text-xl font-black">{condominio || 'Alpha Soluções Condominiais'}</h1>
            {eventoNome && (
              <p className="text-xs font-bold text-emerald-100 mt-1 bg-white/10 py-1 px-3 rounded-full inline-block">
                🎉 {eventoNome}
              </p>
            )}
          </div>

          {/* Ticket recortes visuais */}
          <div className="relative h-px bg-transparent flex items-center">
            <div className="absolute left-[-14px] w-[28px] h-[28px] bg-slate-900 rounded-full"></div>
            <div className="w-full border-t-[2px] border-dashed border-gray-300 relative top-[-1px]"></div>
            <div className="absolute right-[-14px] w-[28px] h-[28px] bg-slate-900 rounded-full"></div>
          </div>

          <div className="p-6 pt-5">
            {/* Foto do Visitante / Biometria Facial */}
            <div className="flex flex-col items-center mb-4">
              {visitante.foto ? (
                <div className="relative">
                  <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-emerald-500 shadow-md">
                    <img src={visitante.foto} alt={nome} className="w-full h-full object-cover" />
                  </div>
                  <span className="absolute bottom-0 right-0 bg-emerald-500 text-white p-1 rounded-full shadow-sm" title="Foto Registrada">
                    <Check size={14} />
                  </span>
                </div>
              ) : (
                <div className="w-20 h-20 rounded-full bg-slate-100 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400">
                  <Camera size={24} />
                  <span className="text-[9px] font-bold mt-1">Sem Foto</span>
                </div>
              )}
            </div>

            <div className="text-center mb-5 border-b border-gray-100 pb-4">
               <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Convidado(a)</p>
               <h2 className="text-xl font-black text-gray-900 leading-tight">{nome}</h2>
            </div>
            
            <div className="flex flex-col gap-3 mb-6 bg-slate-50 p-4 rounded-2xl border border-gray-200">
              <div className="flex gap-3 items-center text-gray-700">
                <Calendar size={18} className="text-brand-600 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Data Autorizada</p>
                  <p className="text-xs font-bold text-gray-900">{dataConvite.toLocaleDateString('pt-BR')}</p>
                </div>
              </div>

              <div className="flex gap-3 items-center text-gray-700">
                <MapPin size={18} className="text-brand-600 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Anfitrião / Destino</p>
                  <p className="text-xs font-bold text-gray-900">{moradorNome} {apt ? `(Apt ${apt})` : ''}</p>
                </div>
              </div>

              {documento && (
                <div className="flex gap-3 items-center text-gray-700">
                  <Car size={18} className="text-brand-600 shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Documento / Placa</p>
                    <p className="text-xs font-bold text-gray-900 uppercase">{documento}</p>
                  </div>
                </div>
              )}
            </div>

            {/* QR Code */}
            <div className="flex flex-col items-center">
              <div className={`p-4 rounded-2xl mb-3 border-2 shadow-sm ${isValid ? 'bg-white border-emerald-200' : 'bg-gray-50 border-gray-200 opacity-50'}`}>
                <QRCodeSVG 
                  value={qrValue} 
                  size={160} 
                  level="H" 
                  includeMargin={false} 
                  fgColor={isValid ? "#0f172a" : "#64748b"}
                />
              </div>

              <div className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-bold ${isValid ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                {isValid ? <CheckCircle size={15} /> : <XCircle size={15} />}
                <span>{validadeMsg}</span>
              </div>
            </div>

            {/* Botão de Câmera / Foto para a Portaria */}
            <div className="mt-6 pt-5 border-t border-gray-100 flex flex-col items-center">
              {visitante.foto ? (
                <div className="w-full text-center">
                  <p className="text-[11px] text-emerald-700 font-bold mb-2 flex items-center justify-center gap-1">
                    <CheckCircle size={13} /> Foto facial enviada para a Portaria!
                  </p>
                  <button 
                    onClick={openCamera}
                    disabled={uploadingPhoto}
                    className="text-xs font-bold text-gray-500 hover:text-brand-600 flex items-center justify-center gap-1.5 mx-auto"
                  >
                    <RefreshCw size={12} /> Tirar outra foto
                  </button>
                </div>
              ) : (
                <div className="text-center w-full">
                  <p className="text-xs text-gray-600 font-medium mb-2.5">
                    📸 <b>Envie sua foto</b> para a portaria reconhecer você e liberar a entrada sem filas:
                  </p>
                  <button
                    onClick={openCamera}
                    disabled={uploadingPhoto}
                    className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-md transition-transform hover:scale-[1.02]"
                  >
                    <Camera size={16} />
                    {uploadingPhoto ? 'Salvando Foto...' : 'Tirar Foto com a Câmera'}
                  </button>
                </div>
              )}

              {/* Input oculto para abrir a câmera nativa do celular (iOS / Android) */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

          </div>
        </div>
      </div>
      
      {/* Modal da Câmera Web */}
      {showCamera && (
        <div className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center p-4">
          <div className="relative w-full max-w-sm aspect-square bg-slate-900 rounded-3xl overflow-hidden mb-6 shadow-2xl border-2 border-white/20">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover"></video>
            <div className="absolute inset-0 border-4 border-dashed border-white/40 rounded-3xl pointer-events-none m-6"></div>
          </div>
          <p className="text-white mb-6 text-center text-xs px-4">Posicione seu rosto no centro e clique em Tirar Foto.</p>
          <div className="flex gap-3 w-full max-w-sm">
            <button onClick={closeCamera} className="flex-1 py-3.5 bg-slate-800 text-white rounded-xl font-bold text-xs">
              Cancelar
            </button>
            <button onClick={captureWebcam} className="flex-1 py-3.5 bg-emerald-600 text-white rounded-xl font-black text-xs shadow-lg">
              📸 Tirar Foto
            </button>
          </div>
        </div>
      )}
      
      <p className="text-slate-400 text-[11px] mt-6 text-center">
        Apresente este QR Code ao chegar na portaria do condomínio.
      </p>
    </div>
  )
}
