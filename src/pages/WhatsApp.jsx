import React, { useState } from 'react'
import { QrCode as QrIcon, Megaphone, Calendar, AlertTriangle } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useFirestore } from '../hooks/useFirestore'

export default function WhatsApp() {
  const { items: moradores } = useFirestore('moradores')
  const [morador, setMorador] = useState('')
  const [mensagem, setMensagem] = useState('')

  const msgClick = (text) => setMensagem(text)

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex items-center justify-between border-b border-cream-300 pb-4">
        <h2 className="text-xl font-bold text-gray-800">WhatsApp</h2>
        <span className="text-brand-600 font-bold flex items-center gap-2">WhatsApp <MessageCircleIcon /></span>
      </div>

      <div className="card max-w-4xl mx-auto w-full shadow-lg">
        {/* Caixa amarela superior - QR Code */}
        <div className="bg-amber-100/50 rounded-xl p-8 mb-8 flex flex-col items-center justify-center text-center">
          <p className="font-bold text-amber-900 mb-2 text-base tracking-wide">
            Integração com WhatsApp (Modo Demonstração)
          </p>
          <p className="text-amber-800 text-sm mb-6 max-w-md mx-auto">
            Em um sistema real com backend dedicado (ex: Z-API / Evolution), este QR Code seria gerado de forma dinâmica. Para esta versão de demonstração, o envio é feito redirecionando para o seu próprio WhatsApp Web.
          </p>
          <div className="bg-white p-4 rounded-2xl shadow-md inline-block opacity-50 pointer-events-none">
            <QRCodeSVG value="demo-qr-code" size={224} level="M" />
          </div>
        </div>

        {/* Formulário */}
        <div className="flex flex-col gap-6 px-2">
          <div>
            <label className="label text-[13px] mb-1">Selecione o Morador</label>
            <select className="input text-gray-700 w-full" value={morador} onChange={e => setMorador(e.target.value)}>
              <option value="">Selecione...</option>
              {moradores.map(m => (
                <option key={m.id} value={m.nome}>{m.nome} {m.apt ? `- Apt ${m.apt}` : ''}</option>
              ))}
              {/* Fallback de exemplo se a lista vier vazia temporariamente */}
              {moradores.length === 0 && (
                <>
                  <option value="João Paulo Ferreira">João Paulo Ferreira - Apt 101-A</option>
                  <option value="Maria Clara Santos">Maria Clara Santos - Apt 204-B</option>
                </>
              )}
            </select>
          </div>

          <div>
            <label className="label text-[13px] mb-2">Mensagens Prontas:</label>
            <div className="flex gap-2 flex-wrap">
              <button 
                onClick={() => msgClick('Olá! Gostaríamos de comunicar um novo lançamento de taxa extra correspondente a melhorias na infraestrutura do condomínio...')} 
                className="btn-secondary flex items-center gap-2 text-[13px] py-1.5 px-4 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 tracking-tight shadow-sm"
              >
                <Megaphone size={14} className="text-gray-500" /> Lançamento
              </button>
              <button 
                onClick={() => msgClick('Lembrete Automático: Teremos nossa reunião de condomínio geral (Assembleia) esta semana. Sua presença é fundamental.')} 
                className="btn-secondary flex items-center gap-2 text-[13px] py-1.5 px-4 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 tracking-tight shadow-sm"
              >
                <Calendar size={14} className="text-gray-500" /> Reunião
              </button>
              <button 
                onClick={() => msgClick('Notamos uma constância referente à emissão em aberto vinculada à sua unidade. Por favor, verifique se está tudo certo no painel financeiro.')} 
                className="btn-secondary flex items-center gap-2 text-[13px] py-1.5 px-4 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 tracking-tight shadow-sm"
              >
                <AlertTriangle size={14} className="text-gray-500" /> Cobrança
              </button>
            </div>
          </div>

          <div>
            <label className="label text-[13px] mb-1">Mensagem</label>
            <textarea 
              className="input w-full min-h-[160px] resize-none text-sm text-gray-800 focus:ring-1 focus:ring-brand-400" 
              value={mensagem} 
              onChange={e => setMensagem(e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function MessageCircleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>
    </svg>
  )
}
