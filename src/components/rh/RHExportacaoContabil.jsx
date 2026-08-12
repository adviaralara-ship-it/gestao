import React, { useState } from 'react'
import { FileDown, Download, CheckCircle, Mail, AlertTriangle, Calendar, FileText } from 'lucide-react'

export default function RHExportacaoContabil() {
  const [mes, setMes] = useState('2026-08')
  const [condominio, setCondominio] = useState('Todos')
  const [status, setStatus] = useState('idle')

  const handleExport = (type) => {
    setStatus('loading')
    setTimeout(() => {
      setStatus('done')
      setTimeout(() => setStatus('idle'), 3000)
    }, 1500)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-cream-200 p-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-brand-50 text-brand-600 rounded-xl">
          <FileDown size={24} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-800">Exportação para Contabilidade</h3>
          <p className="text-sm text-gray-500">Gere os arquivos mensais para envio ao escritório contábil e eSocial</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">Mês de Competência</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-3 text-gray-400" size={18}/>
            <input 
              type="month" 
              value={mes}
              onChange={e => setMes(e.target.value)}
              className="input-field pl-10 w-full"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">Condomínio</label>
          <select value={condominio} onChange={e => setCondominio(e.target.value)} className="input-field w-full">
            <option value="Todos">Todos os Condomínios</option>
            <option value="Residencial Alpha">Residencial Alpha</option>
            <option value="Condomínio Beta">Condomínio Beta</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Folha de Pagamento */}
        <div className="border border-cream-300 rounded-xl p-5 hover:border-brand-400 transition-colors bg-gray-50 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-brand-500"></div>
          <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
            <FileText size={18} className="text-brand-600"/> 
            Fechamento de Ponto
          </h4>
          <p className="text-xs text-gray-500 mb-6">
            Exporta faltas, horas extras, adicionais noturnos e atrasos em formato CSV (compatível com Domínio, Alterdata e Fortes).
          </p>
          <button 
            onClick={() => handleExport('ponto')}
            disabled={status === 'loading'}
            className="w-full btn-primary flex items-center justify-center gap-2 py-2"
          >
            {status === 'loading' ? <RefreshCw className="animate-spin" size={18}/> : <Download size={18}/>}
            Baixar Arquivo CSV
          </button>
        </div>

        {/* Admissões e Rescisões */}
        <div className="border border-cream-300 rounded-xl p-5 hover:border-brand-400 transition-colors bg-gray-50 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-yellow-500"></div>
          <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
            <Users size={18} className="text-yellow-600"/> 
            Admissões / Demissões
          </h4>
          <p className="text-xs text-gray-500 mb-6">
            Dados cadastrais, dependentes e documentos de novos funcionários ou rescisões do período.
          </p>
          <button 
            onClick={() => handleExport('admissao')}
            disabled={status === 'loading'}
            className="w-full bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border border-yellow-200 font-bold rounded-lg flex items-center justify-center gap-2 py-2 transition-colors"
          >
            {status === 'loading' ? <RefreshCw className="animate-spin" size={18}/> : <Download size={18}/>}
            Baixar Relatório (PDF)
          </button>
        </div>

        {/* Envio Direto */}
        <div className="border border-cream-300 rounded-xl p-5 hover:border-brand-400 transition-colors bg-brand-50 relative overflow-hidden flex flex-col justify-between">
          <div>
            <h4 className="font-bold text-brand-800 mb-2 flex items-center gap-2">
              <Mail size={18}/> 
              Envio Direto à Contabilidade
            </h4>
            <p className="text-xs text-brand-600 mb-4">
              Dispara todos os arquivos do mês ({mes}) diretamente para o e-mail do escritório de contabilidade configurado.
            </p>
          </div>
          <button 
            onClick={() => handleExport('email')}
            disabled={status === 'loading'}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg flex items-center justify-center gap-2 py-2 transition-colors shadow-md"
          >
            {status === 'loading' ? <RefreshCw className="animate-spin" size={18}/> : <Mail size={18}/>}
            Enviar por E-mail
          </button>
        </div>
      </div>

      {status === 'done' && (
        <div className="mt-6 bg-green-50 text-green-700 p-4 rounded-lg flex items-start gap-3 border border-green-200 animate-fade-in">
          <CheckCircle size={20} className="mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-bold">Ação concluída com sucesso!</h4>
            <p className="text-sm">Os arquivos foram gerados e estão prontos para processamento no eSocial pelo seu contador.</p>
          </div>
        </div>
      )}

      <div className="mt-8 bg-blue-50 text-blue-800 p-4 rounded-lg flex items-start gap-3 border border-blue-200">
        <AlertTriangle size={20} className="mt-0.5 flex-shrink-0" />
        <div>
          <h4 className="font-bold text-sm mb-1">Como funciona essa integração?</h4>
          <p className="text-xs leading-relaxed">
            Neste modelo, o Sistema Alpha cuida da gestão inteligente do dia a dia (registro de ponto facial, atestados, faltas e controle operacional). 
            No fim do mês, você usa esta tela para exportar o resumo consolidado.<br/><br/>
            A sua contabilidade parceira vai receber esses arquivos, importar no sistema contábil deles e cuidar de toda a burocracia do <strong>eSocial, guias de FGTS e INSS</strong>. Assim, você foca na operação sem se preocupar com as instabilidades e multas do governo.
          </p>
        </div>
      </div>
    </div>
  )
}
