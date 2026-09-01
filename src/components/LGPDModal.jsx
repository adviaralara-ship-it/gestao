import React, { useState, useEffect } from 'react'
import { ShieldCheck, Lock, FileText, CheckCircle2, X } from 'lucide-react'

export default function LGPDModal({ isOpen, onClose }) {
  if (!isOpen) return null

  return (
    <div className="modal-overlay z-50 p-4" onClick={onClose}>
      <div 
        className="modal-content max-w-2xl w-full bg-white rounded-3xl shadow-2xl p-0 overflow-hidden flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Topo */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Política de Privacidade & Proteção de Dados</h3>
              <p className="text-xs text-gray-400">Conformidade com a LGPD (Lei nº 13.709/2018) e CDC</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700 leading-relaxed">
          <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200 flex items-start gap-2.5">
            <Lock size={18} className="text-emerald-700 shrink-0 mt-0.5" />
            <p className="text-emerald-950 font-medium">
              A <b>Alpha Soluções Condominiais LTDA</b> preza pela total privacidade, transparência e segurança de todos os condôminos, proprietários, inquilinos e parceiros comerciais.
            </p>
          </div>

          <h4 className="font-bold text-slate-900 text-sm">1. Finalidade do Tratamento de Dados</h4>
          <p>
            Os dados cadastrais coletados (como Nome, Unidade, Bloco, E-mail, Telefone/WhatsApp e Histórico de Cotas) são tratados estritamente para as seguintes finalidades operacionais:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li>Emissão e envio de faturas e boletos de taxas condominiais ordinárias e extraordinárias;</li>
            <li>Envio de comunicados urgentes sobre manutenções, interrupções de água/luz e assembleias;</li>
            <li>Controle de acesso à portaria, encomendas e reservas de áreas comuns;</li>
            <li>Cumprimento de obrigações legais e regulatórias da administração condominial.</li>
          </ul>

          <h4 className="font-bold text-slate-900 text-sm">2. Segurança e Não Compartilhamento</h4>
          <p>
            Os dados são armazenados em infraestrutura de nuvem segura com <b>criptografia ponta a ponta (TLS 1.3 / SSL)</b> e banco de dados protegido pelo Google Firebase. Em nenhuma hipótese a Alpha Soluções vende, comercializa ou compartilha informações de moradores com empresas terceiras de publicidade ou telemarketing.
          </p>

          <h4 className="font-bold text-slate-900 text-sm">3. Direitos do Titular de Dados (LGPD)</h4>
          <p>
            Conforme previsto no Art. 18 da LGPD, todo morador tem o direito de solicitar a qualquer momento a confirmação, retificação, atualização ou exclusão de dados não obrigatórios por lei, diretamente pelo aplicativo ou através do suporte da administração.
          </p>

          <h4 className="font-bold text-slate-900 text-sm">4. Canais de Contato & Encarregado (DPO)</h4>
          <p>
            Para dúvidas ou solicitações referentes à privacidade e proteção de dados, entre em contato com nossa assessoria através do e-mail oficial: <b>iaralara1812@gmail.com</b> ou WhatsApp: <b>(83) 9688-5931</b>.
          </p>
        </div>

        {/* Rodapé */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-gray-500 font-medium">Alpha Soluções Condominiais • CNPJ: 66.643.272/0001-18</span>
          <button onClick={onClose} className="btn-primary text-xs font-bold bg-slate-900 hover:bg-slate-800">
            Entendi e Concordo
          </button>
        </div>
      </div>
    </div>
  )
}
