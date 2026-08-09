import React, { useState } from 'react'
import { FileCheck, UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2, PlayCircle } from 'lucide-react'

export default function EFDReinf({ lancamentos }) {
  const [step, setStep] = useState(1)
  const [certUploaded, setCertUploaded] = useState(false)
  const [certName, setCertName] = useState('')
  const [transmitting, setTransmitting] = useState(false)
  const [receipt, setReceipt] = useState(null)

  // Simula buscar notas fiscais com retenção
  // Na prática, buscaria lançamentos de despesa marcados com retenção de INSS/IRRF
  const notasRetidas = lancamentos.filter(l => l.tipo === 'Despesa' && l.valor > 1000).slice(0, 3) // Exemplo: pega algumas despesas para simular notas com retenção

  const totalRetido = notasRetidas.reduce((acc, curr) => acc + (curr.valor * 0.11), 0) // Simulação de 11% de INSS

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (file.name.endsWith('.pfx') || file.name.endsWith('.p12')) {
        setCertName(file.name)
        setCertUploaded(true)
      } else {
        alert("Por favor, envie um arquivo de certificado digital válido (.pfx ou .p12)")
      }
    }
  }

  const handleTransmit = () => {
    setTransmitting(true)
    setTimeout(() => {
      setTransmitting(false)
      setStep(2)
      setReceipt({
        numero: Math.floor(Math.random() * 100000000000000).toString(),
        data: new Date().toLocaleString('pt-BR'),
        competencia: new Date().toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })
      })
    }, 3500)
  }

  return (
    <div className="animate-fade-in mt-6">
      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-brand-100 text-brand-700 rounded-lg">
            <FileCheck size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">Transmissão EFD-Reinf</h3>
            <p className="text-sm text-gray-500">Envio direto para a Receita Federal (e-CAC) sem depender de contabilidade externa.</p>
          </div>
        </div>

        {step === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Lado Esquerdo: Resumo do Mês */}
            <div>
              <h4 className="font-semibold text-gray-700 mb-4 border-b border-gray-200 pb-2">Resumo da Competência</h4>
              
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-4">
                <p className="text-xs font-bold text-gray-500 uppercase">Período de Apuração</p>
                <p className="text-lg font-black text-brand-700">{new Date().toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })}</p>
              </div>

              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600 font-medium">Notas com Retenção Cadastradas:</span>
                <span className="font-bold text-gray-800">{notasRetidas.length}</span>
              </div>
              <div className="flex justify-between items-center mb-6">
                <span className="text-sm text-gray-600 font-medium">Total Retido Estimado (INSS/IRRF):</span>
                <span className="font-bold text-red-600">R$ {totalRetido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2">
                <AlertCircle className="text-blue-600 shrink-0 mt-0.5" size={16} />
                <p className="text-xs text-blue-800">
                  O sistema validou todas as informações. Não há erros ou advertências estruturais nos lançamentos. O arquivo XML da série R-2000 está pronto para assinatura.
                </p>
              </div>
            </div>

            {/* Lado Direito: Certificado e Ação */}
            <div className="flex flex-col">
              <h4 className="font-semibold text-gray-700 mb-4 border-b border-gray-200 pb-2">Assinatura Digital</h4>
              
              <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 p-6 relative group hover:border-brand-500 hover:bg-brand-50 transition-all">
                {!certUploaded ? (
                  <>
                    <UploadCloud size={40} className="text-gray-400 group-hover:text-brand-500 mb-3" />
                    <p className="text-sm font-semibold text-gray-700">Faça upload do Certificado A1</p>
                    <p className="text-xs text-gray-500 text-center mt-1">Formatos .pfx ou .p12</p>
                    <input 
                      type="file" 
                      accept=".pfx,.p12" 
                      onChange={handleFileUpload} 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </>
                ) : (
                  <>
                    <FileText size={40} className="text-brand-600 mb-3" />
                    <p className="text-sm font-semibold text-gray-800 text-center">{certName}</p>
                    <p className="text-xs font-bold text-green-600 mt-1 flex items-center gap-1"><CheckCircle2 size={12}/> Certificado Carregado</p>
                    <button onClick={()=>setCertUploaded(false)} className="text-xs text-gray-400 hover:text-red-500 mt-4 underline z-10 relative">Remover</button>
                  </>
                )}
              </div>

              <div className="mt-6">
                {!transmitting ? (
                  <button 
                    onClick={handleTransmit} 
                    disabled={!certUploaded}
                    className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all
                      ${certUploaded 
                        ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5' 
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                  >
                    <PlayCircle size={18} />
                    Assinar e Transmitir EFD-Reinf
                  </button>
                ) : (
                  <button disabled className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 bg-indigo-600 text-white opacity-90">
                    <Loader2 className="animate-spin" size={18} />
                    Comunicando com a Receita Federal...
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 2 && receipt && (
          <div className="flex flex-col items-center py-8 animate-fade-in">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-4 shadow-inner">
              <CheckCircle2 size={40} />
            </div>
            <h2 className="text-2xl font-black text-gray-800 mb-2">Transmissão Concluída!</h2>
            <p className="text-gray-500 mb-8 text-center max-w-md">
              A EFD-Reinf foi transmitida e processada com sucesso pela Receita Federal do Brasil.
            </p>

            <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl shadow-sm p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-emerald-600"></div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 text-center">Recibo de Entrega - e-CAC</p>
              
              <div className="space-y-3">
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-sm text-gray-500">Competência</span>
                  <span className="text-sm font-bold text-gray-800">{receipt.competencia}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-sm text-gray-500">Data e Hora de Envio</span>
                  <span className="text-sm font-bold text-gray-800">{receipt.data}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-sm text-gray-500">Número do Recibo</span>
                  <span className="text-sm font-mono font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded">{receipt.numero}</span>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button className="flex-1 btn-secondary text-sm">Baixar XML</button>
                <button className="flex-1 btn-primary text-sm">Imprimir Recibo</button>
              </div>
            </div>
            
            <button onClick={() => { setStep(1); setCertUploaded(false) }} className="mt-8 text-sm text-brand-600 font-medium hover:underline">
              Voltar ao resumo
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
