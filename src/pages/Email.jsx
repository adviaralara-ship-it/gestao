import React, { useState } from 'react'
import { Mail, ExternalLink, ShieldCheck, Send, CheckCircle2, RefreshCw, X, Landmark } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { EMAILJS_CONFIG } from '../emailjs.config'

export default function Email() {
  const { user } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)
  const [toInput, setToInput] = useState('')
  const [subjectInput, setSubjectInput] = useState('')
  const [messageInput, setMessageInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sendSuccess, setSendSuccess] = useState('')

  const handleSendEmail = async (e) => {
    e.preventDefault()
    if (!toInput || !messageInput) {
      alert('Preencha o destinatário e a mensagem.')
      return
    }

    setSending(true)
    setSendSuccess('')
    try {
      // Envio via EmailJS ou mailto com corpo formatado
      const mailtoLink = `mailto:${encodeURIComponent(toInput)}?subject=${encodeURIComponent(subjectInput || 'Contato Alpha')}&body=${encodeURIComponent(messageInput)}`
      window.open(mailtoLink, '_blank')

      setSendSuccess('Janela de envio aberta com sucesso!')
      setTimeout(() => {
        setModalOpen(false)
        setToInput('')
        setSubjectInput('')
        setMessageInput('')
        setSendSuccess('')
      }, 1500)
    } catch (err) {
      console.error(err)
      alert('Não foi possível iniciar o envio.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] gap-4 animate-fade-in">
      <div className="page-header shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="section-title flex items-center gap-2">
            <Mail className="text-brand-600" /> Caixa de E-mail (Alpha)
          </h2>
          <p className="section-sub">Acesse os e-mails administrativos e envie comunicados</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setModalOpen(true)}
            className="btn-primary bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl flex items-center gap-2 shadow-sm"
          >
            <Send size={15} /> Escrever E-mail
          </button>

          <a 
            href="https://mail.google.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="btn-secondary py-2.5 px-4 text-xs font-semibold rounded-xl flex items-center gap-1.5"
          >
            <ExternalLink size={15} /> Abrir Webmail
          </a>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-3xl border border-cream-300 shadow-sm overflow-hidden flex flex-col items-center justify-center p-8 text-center relative">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-brand-50 to-transparent"></div>
        
        <div className="w-20 h-20 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center mb-6 relative z-10 shadow-inner">
          <Mail size={40} />
        </div>
        
        <h3 className="text-2xl font-bold text-gray-800 mb-3 relative z-10">
          Acesso Seguro ao Webmail Alpha
        </h3>
        
        <p className="text-gray-500 max-w-md mb-8 relative z-10 text-sm leading-relaxed">
          Os extratos bancários enviados pelo <strong>Nubank</strong> são capturados de forma 100% automática e integrados diretamente na sua <strong>Conciliação Bancária</strong>.
        </p>
        
        <div className="flex flex-col gap-3 relative z-10 w-full max-w-xs">
          <a 
            href="https://mail.google.com/mail/u/0/#inbox" 
            target="_blank" 
            rel="noopener noreferrer"
            className="btn-primary w-full justify-center py-3 text-sm shadow-md hover:shadow-lg transition-all"
          >
            <Mail size={18} className="mr-2" /> Acessar Gmail (alphaadmsc@gmail.com)
          </a>
          
          <a 
            href="https://webmail.hostgator.com.br/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="btn-secondary w-full justify-center py-3 text-sm bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-all"
          >
            <ExternalLink size={18} className="mr-2" /> Outro Webmail (HostGator/etc)
          </a>
        </div>

        <div className="mt-10 flex items-center gap-2 text-xs text-brand-700 font-semibold bg-brand-50 px-4 py-2 rounded-full relative z-10 border border-brand-200/60">
          <ShieldCheck size={15} className="text-brand-600" /> Conexão Criptografada e Segura
        </div>
      </div>

      {/* Modal de Escrever Novo E-mail */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-cream-300 shadow-xl w-full max-w-lg overflow-hidden flex flex-col animate-scale-up">
            <div className="p-4 border-b border-cream-200 flex justify-between items-center bg-cream-50/50">
              <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <Send size={16} className="text-brand-600" /> Escrever Novo E-mail
              </h4>
              <button 
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSendEmail} className="p-5 flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Destinatário (Para):</label>
                <input 
                  type="email" 
                  required
                  value={toInput}
                  onChange={(e) => setToInput(e.target.value)}
                  placeholder="destinatario@email.com"
                  className="w-full px-3 py-2 text-xs border border-cream-300 rounded-xl focus:outline-none focus:border-brand-600"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Assunto:</label>
                <input 
                  type="text" 
                  value={subjectInput}
                  onChange={(e) => setSubjectInput(e.target.value)}
                  placeholder="Assunto da mensagem"
                  className="w-full px-3 py-2 text-xs border border-cream-300 rounded-xl focus:outline-none focus:border-brand-600"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Mensagem:</label>
                <textarea 
                  required
                  rows={6}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Escreva sua mensagem aqui..."
                  className="w-full px-3 py-2 text-xs border border-cream-300 rounded-xl focus:outline-none focus:border-brand-600 resize-none"
                />
              </div>

              {sendSuccess && (
                <div className="p-2.5 bg-emerald-50 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>{sendSuccess}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-cream-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-cream-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-cream-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={sending}
                  className="btn-primary bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs py-2 px-5 rounded-xl flex items-center gap-2 shadow-sm"
                >
                  <Send size={14} /> Enviar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
