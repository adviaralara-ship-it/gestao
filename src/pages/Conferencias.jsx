import React, { useState } from 'react'
import { Video, Copy, CheckCircle, Plus, Users, Clock, AlertCircle } from 'lucide-react'

export default function Conferencias() {
  const [roomName, setRoomName] = useState('')
  const [inRoom, setInRoom] = useState(false)
  const [copied, setCopied] = useState(false)

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
          <button onClick={() => setInRoom(false)} className="btn-secondary border-red-200 text-red-600 hover:bg-red-50">
            Sair da Sala
          </button>
        </div>
        
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
