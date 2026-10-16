import React, { useState, useEffect } from 'react'
import { 
  Mail, ExternalLink, RefreshCw, Send, Paperclip, Search, 
  Inbox, AlertCircle, CheckCircle2, ChevronRight, User, Calendar, X, Download
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Email() {
  const { user } = useAuth()
  const [emails, setEmails] = useState([])
  const [selectedEmail, setSelectedEmail] = useState(null)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  
  // Modal de Novo E-mail
  const [modalOpen, setModalOpen] = useState(false)
  const [toInput, setToInput] = useState('')
  const [subjectInput, setSubjectInput] = useState('')
  const [messageInput, setMessageInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sendSuccess, setSendSuccess] = useState('')

  const fetchEmails = async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      let token = ''
      if (user && typeof user.getIdToken === 'function') {
        token = await user.getIdToken()
      }

      const headers = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch('/api/email/inbox', { headers })
      const data = await res.json()

      if (data.success && Array.isArray(data.emails)) {
        setEmails(data.emails)
        if (data.emails.length > 0 && !selectedEmail) {
          setSelectedEmail(data.emails[0])
        }
      } else {
        setErrorMsg(data.error || 'Não foi possível carregar as mensagens.')
      }
    } catch (err) {
      console.error('Erro ao buscar e-mails:', err)
      setErrorMsg('Falha de conexão com o servidor de e-mail.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEmails()
  }, [])

  const handleSendEmail = async (e) => {
    e.preventDefault()
    if (!toInput || !messageInput) {
      alert('Preencha o destinatário e a mensagem.')
      return
    }

    setSending(true)
    setSendSuccess('')
    try {
      let token = ''
      if (user && typeof user.getIdToken === 'function') {
        token = await user.getIdToken()
      }

      const headers = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          to: toInput,
          subject: subjectInput || '(Sem assunto)',
          text: messageInput
        })
      })

      const data = await res.json()
      if (data.success) {
        setSendSuccess('E-mail enviado com sucesso!')
        setTimeout(() => {
          setModalOpen(false)
          setToInput('')
          setSubjectInput('')
          setMessageInput('')
          setSendSuccess('')
        }, 1200)
      } else {
        alert('Erro ao enviar e-mail: ' + (data.error || 'Falha no envio.'))
      }
    } catch (err) {
      console.error('Erro ao enviar e-mail:', err)
      alert('Erro ao conectar com o serviço de envio.')
    } finally {
      setSending(false)
    }
  }

  const downloadAttachment = (att) => {
    if (!att.contentBase64) return
    const linkSource = `data:${att.contentType || 'application/octet-stream'};base64,${att.contentBase64}`
    const downloadLink = document.createElement('a')
    downloadLink.href = linkSource
    downloadLink.download = att.filename || 'anexo'
    downloadLink.click()
  }

  const filteredEmails = emails.filter(em => {
    const q = searchTerm.toLowerCase()
    return (
      (em.subject && em.subject.toLowerCase().includes(q)) ||
      (em.from && em.from.toLowerCase().includes(q)) ||
      (em.text && em.text.toLowerCase().includes(q))
    )
  })

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)] gap-4 animate-fade-in">
      {/* Header */}
      <div className="page-header shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="section-title flex items-center gap-2">
            <Mail className="text-brand-600" /> Caixa de E-mail (Alpha)
          </h2>
          <p className="section-sub">
            alphaadmsc@gmail.com • Caixa de Entrada e envios integrados
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setModalOpen(true)}
            className="btn-primary bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs py-2 px-3.5 rounded-xl flex items-center gap-2 shadow-sm"
          >
            <Send size={15} /> Novo E-mail
          </button>

          <button 
            onClick={fetchEmails} 
            disabled={loading}
            className="p-2 border border-cream-300 hover:bg-cream-100 rounded-xl text-gray-700 text-xs font-semibold flex items-center gap-1.5 transition-all"
            title="Atualizar Caixa de Entrada"
          >
            <RefreshCw size={15} className={loading ? "animate-spin text-brand-600" : ""} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>

          <a 
            href="https://mail.google.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="p-2 border border-cream-300 hover:bg-cream-100 rounded-xl text-gray-600 text-xs flex items-center gap-1"
            title="Abrir no Gmail Web"
          >
            <ExternalLink size={15} />
          </a>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0 text-amber-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Interface Master-Detail */}
      <div className="flex-1 bg-white rounded-2xl border border-cream-300 shadow-sm overflow-hidden flex flex-col md:flex-row">
        
        {/* Coluna Esquerda: Lista de Mensagens */}
        <div className="w-full md:w-2/5 border-r border-cream-200 flex flex-col h-full bg-cream-50/20">
          {/* Busca na caixa */}
          <div className="p-3 border-b border-cream-200 bg-white">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Pesquisar remetente, assunto..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-cream-50/60 border border-cream-200 rounded-xl focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* Lista com scroll */}
          <div className="flex-1 overflow-y-auto divide-y divide-cream-100">
            {loading && emails.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-xs flex flex-col items-center gap-2">
                <RefreshCw size={24} className="animate-spin text-brand-600" />
                <span>Carregando e-mails do Gmail...</span>
              </div>
            ) : filteredEmails.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-xs flex flex-col items-center gap-2">
                <Inbox size={28} className="text-gray-300" />
                <span>Nenhum e-mail encontrado na caixa.</span>
              </div>
            ) : (
              filteredEmails.map((em) => {
                const isSelected = selectedEmail?.uid === em.uid
                const dateObj = new Date(em.date)
                const dateFmt = !isNaN(dateObj) 
                  ? dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                  : ''

                return (
                  <div
                    key={em.uid}
                    onClick={() => setSelectedEmail(em)}
                    className={`p-3.5 cursor-pointer transition-colors text-left flex flex-col gap-1 ${
                      isSelected ? 'bg-brand-50/80 border-l-4 border-brand-600' : 'hover:bg-cream-100/60'
                    }`}
                  >
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-semibold text-xs text-gray-900 truncate">
                        {em.from.split('<')[0].replace(/"/g, '') || em.from}
                      </span>
                      <span className="text-[10px] text-gray-400 shrink-0">{dateFmt}</span>
                    </div>

                    <p className="text-xs font-medium text-gray-800 truncate">
                      {em.subject}
                    </p>

                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-[11px] text-gray-500 line-clamp-1">
                        {em.text || 'Mensagem sem prévia de texto'}
                      </p>
                      {em.hasAttachments && (
                        <Paperclip size={12} className="text-brand-600 shrink-0 ml-1" />
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Coluna Direita: Visualizador do E-mail Selecionado */}
        <div className="flex-1 flex flex-col h-full bg-white overflow-hidden">
          {selectedEmail ? (
            <div className="flex-1 flex flex-col h-full overflow-y-auto">
              {/* Header do E-mail */}
              <div className="p-5 border-b border-cream-200 bg-cream-50/30">
                <h3 className="text-base font-bold text-gray-900 mb-2">
                  {selectedEmail.subject}
                </h3>

                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-xs">
                  <div className="flex items-center gap-2 text-gray-700">
                    <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center shrink-0">
                      <User size={15} />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{selectedEmail.from}</p>
                      <p className="text-[11px] text-gray-500">Para: {selectedEmail.to || 'alphaadmsc@gmail.com'}</p>
                    </div>
                  </div>

                  <span className="text-[11px] text-gray-400 flex items-center gap-1">
                    <Calendar size={13} />
                    {new Date(selectedEmail.date).toLocaleString('pt-BR')}
                  </span>
                </div>

                {/* Anexos se houver */}
                {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-cream-200/80 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold text-gray-600 flex items-center gap-1">
                      <Paperclip size={12} /> {selectedEmail.attachments.length} Anexo(s):
                    </span>
                    {selectedEmail.attachments.map((att, i) => (
                      <button
                        key={i}
                        onClick={() => downloadAttachment(att)}
                        className="px-2.5 py-1 bg-white border border-brand-200 hover:bg-brand-50 text-brand-700 rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-xs transition-colors"
                        title="Baixar anexo"
                      >
                        <Download size={12} />
                        <span className="truncate max-w-[150px]">{att.filename}</span>
                        {att.size && (
                          <span className="text-[10px] text-gray-400">
                            ({(att.size / 1024).toFixed(0)} KB)
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Corpo do E-mail */}
              <div className="p-6 flex-1 overflow-y-auto text-sm text-gray-800 leading-relaxed">
                {selectedEmail.html ? (
                  <div 
                    className="prose prose-sm max-w-none break-words"
                    dangerouslySetInnerHTML={{ __html: selectedEmail.html }}
                  />
                ) : (
                  <pre className="whitespace-pre-wrap font-sans text-xs text-gray-700">
                    {selectedEmail.text}
                  </pre>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400">
              <Mail size={40} className="text-gray-300 mb-2" />
              <p className="text-sm">Selecione um e-mail na lista para visualizar o conteúdo.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Escrever Novo E-mail */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-cream-300 shadow-xl w-full max-w-xl overflow-hidden flex flex-col animate-scale-up">
            <div className="p-4 border-b border-cream-200 flex justify-between items-center bg-cream-50/50">
              <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <Send size={16} className="text-brand-600" /> Novo E-mail Administrativo
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
                  placeholder="exemplo@email.com"
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
                  rows={8}
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
                  {sending ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" /> Enviando...
                    </>
                  ) : (
                    <>
                      <Send size={14} /> Enviar Mensagem
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
