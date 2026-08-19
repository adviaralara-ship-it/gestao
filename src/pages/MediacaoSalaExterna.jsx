import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle, Download, Scale, UserCheck, ShieldCheck } from 'lucide-react'

export default function MediacaoSalaExterna() {
  const { id } = useParams()
  
  // Estado simulado do acordo (no futuro vira do Firebase via ID)
  const [acordo] = useState({
    condominio: 'Residencial Flores',
    unidade: 'Apto 101',
    valorTotal: 2500,
    parcelas: 5,
    valorParcela: 500,
    status: 'Aguardando Assinatura',
    termoTexto: `TERMO DE CONFISSÃO DE DÍVIDA E ACORDO EXTRAJUDICIAL

Pelo presente instrumento particular, de um lado, o CONDOMÍNIO Residencial Flores, doravante denominado CREDOR, e de outro lado, o proprietário da UNIDADE Apto 101, doravante denominado DEVEDOR, resolvem firmar o presente Acordo Extrajudicial.

CLÁUSULA PRIMEIRA - DA DÍVIDA
O DEVEDOR reconhece e confessa dever ao CREDOR a importância de R$ 2500.00, já incluídos os honorários de mediação.

CLÁUSULA SEGUNDA - DA FORMA DE PAGAMENTO
O DEVEDOR se compromete a pagar a dívida em 5 parcela(s) de R$ 500.00.

E, por estarem assim justos e acordados, firmam o presente termo.
`
  })

  const [aceito, setAceito] = useState(false)

  const handleAceitar = () => {
    setAceito(true)
    alert('✅ Acordo aceito digitalmente com sucesso! Uma cópia será enviada ao seu e-mail.')
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden">
        
        {/* Header do Acordo */}
        <div className="bg-brand-600 p-6 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-sm">
            <Scale className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Sala de Mediação (ODR)</h1>
          <p className="text-brand-100 text-sm">Resolução Online de Conflitos</p>
        </div>

        {/* Resumo Financeiro */}
        <div className="p-6 border-b border-gray-100 bg-gray-50">
          <div className="flex justify-between items-center mb-4">
            <div>
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Condomínio</p>
              <p className="text-gray-900 font-bold">{acordo.condominio}</p>
              <p className="text-gray-600 text-sm">{acordo.unidade}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Valor Total</p>
              <p className="text-2xl font-black text-brand-700">R$ {acordo.valorTotal.toFixed(2)}</p>
              <p className="text-gray-600 text-sm">Em {acordo.parcelas}x de R$ {acordo.valorParcela.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Documento */}
        <div className="p-6">
          <h2 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
            <ShieldCheck className="text-green-600" size={18} />
            Termo de Confissão de Dívida
          </h2>
          
          <div className="bg-pale-50 border border-pale-200 rounded-xl p-4 h-64 overflow-y-auto mb-6 shadow-inner text-sm text-gray-700 font-serif leading-relaxed">
            {acordo.termoTexto.split('\n').map((linha, index) => (
              <p key={index} className="mb-2">{linha}</p>
            ))}
          </div>

          {/* Ações */}
          {!aceito ? (
            <div className="space-y-3">
              <button 
                onClick={handleAceitar}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-green-600/30 transition-all flex justify-center items-center gap-2"
              >
                <UserCheck size={20} />
                Aceitar e Assinar Digitalmente
              </button>
              
              <button className="w-full bg-white border-2 border-gray-200 hover:bg-gray-50 text-gray-700 font-bold py-3 rounded-xl transition-all flex justify-center items-center gap-2">
                <Download size={20} />
                Baixar Minuta em PDF
              </button>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 p-4 rounded-xl flex items-center gap-3 animate-fade-in">
              <CheckCircle className="text-green-600 shrink-0" size={32} />
              <div>
                <h3 className="font-bold text-green-900">Assinatura Confirmada</h3>
                <p className="text-green-700 text-sm">O termo tem validade legal (Art. 784, III do CPC). Uma cópia foi enviada para o seu síndico.</p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
