import React, { useState, useRef } from 'react'
import { Video, Copy, CheckCircle, Plus, Users, Clock, AlertCircle, FileText, Download } from 'lucide-react'
import { jsPDF } from 'jspdf'
import { gerarAtaPorAudio } from '../utils/aiTranscricao'

export default function Conferencias() {
  const [roomName, setRoomName] = useState('')
  const [inRoom, setInRoom] = useState(false)
  const [copied, setCopied] = useState(false)

  // Estados de Gravação
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState(null)
  const [videoRecorder, setVideoRecorder] = useState(null)
  const [modoGravacao, setModoGravacao] = useState('audio') // 'audio' ou 'video'
  const audioChunks = useRef([])
  const videoChunks = useRef([])
  const [transcricaoPronta, setTranscricaoPronta] = useState(false)
  const [summary, setSummary] = useState('')

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: modoGravacao === 'video' 
      })
      
      const audioStream = new MediaStream(stream.getAudioTracks())
      const aRecorder = new MediaRecorder(audioStream)
      audioChunks.current = []
      aRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.current.push(e.data) }
      
      let vRecorder = null
      if (modoGravacao === 'video') {
        vRecorder = new MediaRecorder(stream)
        videoChunks.current = []
        vRecorder.ondataavailable = e => { if (e.data.size > 0) videoChunks.current.push(e.data) }
        
        vRecorder.onstop = () => {
          const videoBlob = new Blob(videoChunks.current, { type: 'video/webm' })
          const url = URL.createObjectURL(videoBlob)
          const a = document.createElement('a')
          a.style.display = 'none'
          a.href = url
          a.download = `Gravacao_Video_${roomName}.webm`
          document.body.appendChild(a)
          a.click()
          URL.revokeObjectURL(url)
        }
      }

      aRecorder.onstop = async () => {
        setIsTranscribing(true)
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' })
        try {
          const texto = await gerarAtaPorAudio(audioBlob, 'reuniao', `Reunião Alpha RH (${roomName})`)
          setSummary(texto)
        } catch (error) {
          alert("Erro ao transcrever: " + error.message)
        } finally {
          setIsTranscribing(false)
          stream.getTracks().forEach(track => track.stop())
        }
      }

      aRecorder.start()
      if (vRecorder) vRecorder.start()
      setMediaRecorder(aRecorder)
      setVideoRecorder(vRecorder)
      setIsRecording(true)
      setSummary('')
    } catch (e) {
      alert("Permissão de microfone/câmera negada ou não disponível.")
    }
  }

  const stopRecording = () => {
    if (videoRecorder && videoRecorder.state !== 'inactive') {
      videoRecorder.stop()
    }
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
      setIsRecording(false)
    }
  }

  const gerarPdfResumo = () => {
    if (!summary) return
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.width
    doc.setFontSize(16)
    doc.text(`Resumo: ${roomName}`, pageWidth / 2, 20, { align: 'center' })
    doc.setFontSize(10)
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth / 2, 28, { align: 'center' })
    doc.setFontSize(12)
    const textLines = doc.splitTextToSize(summary, pageWidth - 30)
    doc.text(textLines, 15, 45)
    doc.save(`Resumo_${roomName}_${new Date().getTime()}.pdf`)
  }

  const generateRoom = () => {
    const randomId = Math.random().toString(36).substring(2, 10)
    setRoomName(`alpha-rh-${randomId}`)
  }

  const handleCopyLink = () => {
    if (!roomName) return
    navigator.clipboard.writeText(`https://meet.jit.si/${roomName}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleJoin = () => {
    if (roomName) setInRoom(true)
  }

  if (inRoom) {
    return (
      <div className="h-[80vh] flex flex-col gap-4 animate-fade-in">
        <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-cream-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center text-brand-600">
              <Video size={20} />
            </div>
            <div>
              <h2 className="font-bold text-gray-800">Sala de Conferência Ativa</h2>
              <p className="text-xs text-gray-500">ID da Sala: {roomName}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {!isRecording && !isTranscribing && !summary && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-lg border border-cream-200">
                  <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <input type="radio" name="modo_conf" checked={modoGravacao === 'audio'} onChange={() => setModoGravacao('audio')} className="text-brand-600"/> Somente Áudio
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <input type="radio" name="modo_conf" checked={modoGravacao === 'video'} onChange={() => setModoGravacao('video')} className="text-brand-600"/> Vídeo + Áudio
                  </label>
                </div>
                <button onClick={startRecording} className="btn-primary py-2 text-sm bg-brand-600 hover:bg-brand-700 border-none">
                  <FileText size={16}/> Gravar Resumo com IA
                </button>
              </div>
            )}

            {isRecording && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-red-600 font-bold text-sm animate-pulse">
                  <span className="w-3 h-3 bg-red-600 rounded-full"></span> 
                  {modoGravacao === 'video' ? 'Gravando Vídeo...' : 'Gravando Áudio...'}
                </div>
                <button onClick={stopRecording} className="btn-secondary py-2 text-sm border-red-200 text-red-700 bg-white hover:bg-red-50">
                  Parar e Gerar Resumo
                </button>
              </div>
            )}

            {isTranscribing && (
              <div className="flex items-center gap-2 text-brand-700 text-sm font-bold">
                <div className="w-5 h-5 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
                Gerando Resumo...
              </div>
            )}

            {summary && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-emerald-600 font-bold flex items-center gap-1"><CheckCircle size={16}/> Resumo Pronto</span>
                <button onClick={() => setSummary('')} className="text-xs text-gray-400 hover:text-gray-700 underline">Novo</button>
              </div>
            )}

            <button onClick={() => setInRoom(false)} className="btn-secondary border-red-200 text-red-600 hover:bg-red-50 ml-2">
              Sair da Sala
            </button>
          </div>
        </div>

        {summary && (
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-brand-200 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex-1 max-h-32 overflow-y-auto custom-scrollbar pr-4 text-sm text-gray-700 whitespace-pre-wrap">
              {summary}
            </div>
            <button onClick={gerarPdfResumo} className="btn-primary shrink-0 bg-emerald-600 hover:bg-emerald-700 border-none">
              <Download size={16}/> Baixar PDF
            </button>
          </div>
        )}
        
        <div className="flex-1 bg-gray-900 rounded-2xl overflow-hidden shadow-lg border border-gray-800">
          <iframe 
            src={`https://meet.jit.si/${roomName}`} 
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            className="w-full h-full border-0"
            title="Sala de Conferência Alpha"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h2 className="section-title text-xl">Sala de Conferências</h2>
          <p className="section-sub">Videoconferência para reuniões, recrutamento e alinhamentos.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-brand-100 text-brand-600 rounded-xl">
                <Video size={24} />
              </div>
              <div>
                <h3 className="font-bold text-gray-800 text-lg">Nova Sala de Vídeo</h3>
                <p className="text-sm text-gray-500">Gere um link único para a conferência online.</p>
              </div>
            </div>

            <div className="bg-cream-50 p-6 rounded-2xl border border-cream-200 mb-6 text-center">
              {roomName ? (
                <div className="space-y-4">
                  <p className="text-sm font-medium text-gray-600 mb-2">Link da sua sala gerado com sucesso:</p>
                  <div className="flex items-center justify-center gap-2 max-w-md mx-auto">
                    <input 
                      readOnly 
                      value={`https://meet.jit.si/${roomName}`}
                      className="input bg-white font-mono text-sm flex-1"
                    />
                    <button 
                      onClick={handleCopyLink}
                      className="p-3 bg-white border border-cream-300 rounded-xl hover:bg-cream-50 transition-colors text-brand-600 flex-shrink-0"
                      title="Copiar Link"
                    >
                      {copied ? <CheckCircle size={20} className="text-green-500"/> : <Copy size={20}/>}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Envie este link para os participantes acessarem (pelo celular ou computador).</p>
                </div>
              ) : (
                <div className="py-8">
                  <p className="text-gray-500 mb-4">Nenhuma sala gerada no momento.</p>
                  <button onClick={generateRoom} className="btn-primary mx-auto">
                    <Plus size={16} /> Gerar Nova Sala
                  </button>
                </div>
              )}
            </div>

            {roomName && (
              <div className="flex justify-end gap-3 pt-4 border-t border-cream-200">
                <button onClick={() => setRoomName('')} className="btn-secondary">Cancelar</button>
                <button onClick={handleJoin} className="btn-primary">Entrar na Sala Agora</button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card bg-gradient-to-br from-gray-800 to-gray-900 text-white border-0 shadow-xl">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <AlertCircle size={18} className="text-brand-400" /> 
              Vantagens da Sala
            </h3>
            <ul className="space-y-3 text-sm text-gray-300">
              <li className="flex items-start gap-2">
                <Clock size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                <span>Sem limite de tempo nas ligações. Pode fazer reuniões longas.</span>
              </li>
              <li className="flex items-start gap-2">
                <Users size={16} className="text-blue-400 mt-0.5 shrink-0" />
                <span>Permite até 100 participantes na mesma sala.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle size={16} className="text-brand-400 mt-0.5 shrink-0" />
                <span>Os convidados não precisam baixar aplicativo nem criar conta.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
