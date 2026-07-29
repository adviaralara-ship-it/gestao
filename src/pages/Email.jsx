import React from 'react'
import { Mail, ExternalLink, ShieldCheck } from 'lucide-react'

export default function Email() {
  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] gap-4 animate-fade-in">
      <div className="page-header shrink-0">
        <div>
          <h2 className="section-title">Caixa de E-mail (Alpha)</h2>
          <p className="section-sub">Acesse os e-mails administrativos</p>
        </div>
        <a 
          href="https://mail.google.com" 
          target="_blank" 
          rel="noopener noreferrer"
          className="btn-primary"
        >
          <ExternalLink size={16} /> Abrir E-mail
        </a>
      </div>

      <div className="flex-1 bg-white rounded-3xl border border-cream-300 shadow-sm overflow-hidden flex flex-col items-center justify-center p-8 text-center relative">
         <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-brand-50 to-transparent"></div>
         
         <div className="w-20 h-20 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center mb-6 relative z-10 shadow-inner">
            <Mail size={40} />
         </div>
         <h3 className="text-2xl font-bold text-gray-800 mb-3 relative z-10">Acesso Seguro ao Webmail</h3>
         
         <p className="text-gray-500 max-w-md mb-8 relative z-10">
           Por questões rigorosas de segurança (política anti-fraude dos provedores), a caixa de e-mails deve ser aberta em uma janela dedicada e protegida pelo navegador.
         </p>
         
         <div className="flex flex-col gap-3 relative z-10 w-full max-w-xs">
           <a 
            href="https://mail.google.com/mail/u/0/#inbox" 
            target="_blank" 
            rel="noopener noreferrer"
            className="btn-primary w-full justify-center py-3 text-base shadow-md hover:shadow-lg transition-all"
          >
            <Mail size={18} className="mr-2" /> Acessar Gmail (Google)
          </a>
          
          <a 
            href="https://webmail.hostgator.com.br/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="btn-secondary w-full justify-center py-3 text-base bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-all"
          >
            <ExternalLink size={18} className="mr-2" /> Outro Webmail (HostGator/etc)
          </a>
         </div>

         <div className="mt-12 flex items-center gap-2 text-xs text-brand-600 font-semibold bg-brand-50 px-4 py-2 rounded-full relative z-10">
           <ShieldCheck size={14} /> Conexão Criptografada e Segura
         </div>
      </div>
    </div>
  )
}
