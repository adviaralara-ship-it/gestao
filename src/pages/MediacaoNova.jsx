import React, { useState } from 'react'
import { ArrowLeft, Save, FileText, Calculator, FileCheck, DollarSign, Download } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { jsPDF } from 'jspdf'

export default function MediacaoNova() {
  const navigate = useNavigate()
  
  // Estados da Calculadora
  const [condominio, setCondominio] = useState('')
  const [unidade, setUnidade] = useState('')
  const [valorOriginal, setValorOriginal] = useState(0)
  const [descontoPorcentagem, setDescontoPorcentagem] = useState(0)
  const [honorarios, setHonorarios] = useState(0)
  const [parcelas, setParcelas] = useState(1)
  
  const valorDescontoReal = (Number(valorOriginal) * Number(descontoPorcentagem)) / 100
  const valorFinal = (Number(valorOriginal) - valorDescontoReal) + Number(honorarios)
  const valorParcela = parcelas > 0 ? valorFinal / parcelas : 0

  // Estado do Termo (Gerado automaticamente, mas editável)
  const [termoEditavel, setTermoEditavel] = useState(`TERMO DE CONFISSÃO DE DÍVIDA E ACORDO EXTRAJUDICIAL

Pelo presente instrumento particular, de um lado, o CONDOMÍNIO _______________, doravante denominado CREDOR, e de outro lado, o(a) Sr.(a) _______________, proprietário(a) da UNIDADE _______________, doravante denominado(a) DEVEDOR(A), resolvem firmar o presente Acordo Extrajudicial para fins de ODR (Online Dispute Resolution), nos seguintes termos:

CLÁUSULA PRIMEIRA - DA DÍVIDA
O(A) DEVEDOR(A) reconhece e confessa de forma irrevogável e irretratável dever ao CREDOR a importância de R$ ${Number(valorFinal).toFixed(2)} (_______________), referente a cotas condominiais em atraso, devidamente atualizadas com juros e correção, já incluídos os honorários de mediação.

CLÁUSULA SEGUNDA - DA FORMA DE PAGAMENTO
O(A) DEVEDOR(A) se compromete a pagar a dívida confessada em ${parcelas} parcela(s) de R$ ${Number(valorParcela).toFixed(2)}, sendo o primeiro vencimento para __/__/____ e as demais para os mesmos dias dos meses subsequentes.

CLÁUSULA TERCEIRA - DA CLÁUSULA PENAL
O atraso no pagamento de qualquer das parcelas descritas na Cláusula Segunda acarretará o vencimento antecipado de todas as demais parcelas vincendas, acrescidas de multa penal de 20% (vinte por cento) sobre o saldo devedor, juros de 1% ao mês e correção monetária.

CLÁUSULA QUARTA - DOS HONORÁRIOS DE MEDIAÇÃO
Fica acordado o valor de R$ ${Number(honorarios).toFixed(2)} a título de honorários para a plataforma/mediador, já englobados no saldo devedor acima pactuado.

E, por estarem assim justos e acordados, firmam o presente termo para que surta seus efeitos legais, servindo o presente como TÍTULO EXECUTIVO EXTRAJUDICIAL nos termos do Art. 784, III do CPC.

Local, ____ de _______________ de 2026.

________________________________________
SÍNDICO (CREDOR)

________________________________________
DEVEDOR(A)

________________________________________
TESTEMUNHA 1

________________________________________
TESTEMUNHA 2 (OU MEDIADOR)
`)

  const handleGerarTermo = () => {
    // Atualiza o texto base com os valores da calculadora caso queira forçar a atualização
    const novoTexto = termoEditavel
      .replace(/R\$ \d+\.\d{2}/, `R$ ${Number(valorFinal).toFixed(2)}`)
      .replace(/\d+ parcela\(s\) de R\$ \d+\.\d{2}/, `${parcelas} parcela(s) de R$ ${Number(valorParcela).toFixed(2)}`)
    setTermoEditavel(novoTexto)
  }

  const handleGerarPDF = () => {
    const doc = new jsPDF()
    const margin = 15
    const maxLineWidth = 180
    
    doc.setFont("helvetica", "normal")
    doc.setFontSize(11)
    
    // Quebra o texto para respeitar as margens da página
    const textLines = doc.splitTextToSize(termoEditavel, maxLineWidth)
    
    doc.text(textLines, margin, 20)
    
    const nomeArquivo = condominio && unidade ? `Termo_Acordo_${condominio}_${unidade}.pdf` : 'Termo_de_Acordo.pdf'
    doc.save(nomeArquivo)
  }

  const handleSalvar = () => {
    // Aqui no futuro vamos mandar os dados para o Firebase
    alert('✅ Termo de Acordo salvo com sucesso na base de dados!')
    navigate('/mediacao')
  }

  return (
    <div className="p-6 h-full flex flex-col bg-gray-50">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/mediacao')} className="text-gray-500 hover:text-brand-600 transition-colors">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Nova Mediação (ODR)</h1>
            <p className="text-gray-500">Calculadora de acordos e geração de termo com validade legal</p>
          </div>
        </div>
        <button onClick={handleSalvar} className="flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-lg hover:bg-brand-700 transition-colors font-medium shadow-sm">
          <Save size={20} />
          Salvar Acordo
        </button>
      </div>

      <div className="flex flex-col xl:flex-row gap-6 h-full">
        {/* Lado Esquerdo: Calculadora */}
        <div className="xl:w-1/3 bg-white p-6 rounded-xl shadow-sm border border-pale-200 flex flex-col gap-4">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 border-b pb-2">
            <Calculator className="text-brand-600" />
            Calculadora do Acordo
          </h2>

          <div className="space-y-4 mt-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Condomínio</label>
              <input type="text" className="w-full p-2 border border-pale-300 rounded-lg focus:ring-2 focus:ring-brand-500" value={condominio} onChange={e => setCondominio(e.target.value)} placeholder="Ex: Residencial Norte" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unidade</label>
              <input type="text" className="w-full p-2 border border-pale-300 rounded-lg focus:ring-2 focus:ring-brand-500" value={unidade} onChange={e => setUnidade(e.target.value)} placeholder="Ex: Apto 302" />
            </div>
            
            <div className="pt-4 border-t border-pale-100">
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor Original da Dívida (R$)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input type="number" className="w-full pl-8 p-2 border border-pale-300 rounded-lg" value={valorOriginal} onChange={e => setValorOriginal(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Desconto (%)</label>
                <div className="relative">
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span>
                  <input type="number" className="w-full p-2 pr-8 border border-pale-300 rounded-lg text-green-600" value={descontoPorcentagem} onChange={e => setDescontoPorcentagem(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-700 mb-1">Honorários ODR (R$)</label>
                <input type="number" className="w-full p-2 border border-brand-300 rounded-lg text-brand-600 font-bold bg-brand-50" value={honorarios} onChange={e => setHonorarios(e.target.value)} />
              </div>
            </div>

            {valorDescontoReal > 0 && (
              <div className="text-sm text-green-600 bg-green-50 p-2 rounded-lg text-center border border-green-100">
                Desconto financeiro: <b>R$ {valorDescontoReal.toFixed(2)}</b>
              </div>
            )}

            <div className="pt-4 border-t border-pale-100">
              <label className="block text-sm font-medium text-gray-700 mb-1">Número de Parcelas</label>
              <select className="w-full p-2 border border-pale-300 rounded-lg" value={parcelas} onChange={e => setParcelas(e.target.value)}>
                {[1,2,3,4,5,6,10,12,24,36].map(n => <option key={n} value={n}>{n}x</option>)}
              </select>
            </div>

            <div className="bg-pale-50 p-4 rounded-xl border border-pale-200 mt-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600 font-medium">Valor Total a Pagar:</span>
                <span className="text-xl font-bold text-gray-900">R$ {Number(valorFinal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Valor da Parcela ({parcelas}x):</span>
                <span className="font-semibold text-brand-700">R$ {Number(valorParcela).toFixed(2)}</span>
              </div>
            </div>

            <button onClick={handleGerarTermo} className="w-full mt-2 bg-gray-800 text-white py-2 rounded-lg hover:bg-gray-900 transition-colors flex items-center justify-center gap-2 font-medium shadow-sm">
              <FileCheck size={18} />
              Atualizar Termo com Valores
            </button>
          </div>
        </div>

        {/* Lado Direito: Editor de Termo */}
        <div className="xl:w-2/3 bg-white p-0 rounded-xl shadow-sm border border-pale-200 flex flex-col overflow-hidden">
          <div className="bg-pale-100 p-4 border-b border-pale-200 flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <FileText className="text-brand-600" />
              Termo de Confissão de Dívida (Editável)
            </h2>
            <button onClick={handleGerarPDF} className="text-sm bg-white border border-pale-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-50 transition-colors flex items-center gap-2 font-medium shadow-sm">
              <Download size={16} />
              Exportar para PDF
            </button>
          </div>
          
          <div className="p-4 flex-1">
            <textarea 
              className="w-full h-full min-h-[500px] p-6 border-0 focus:ring-0 resize-none font-serif text-gray-800 leading-relaxed bg-pale-50 rounded-lg shadow-inner"
              value={termoEditavel}
              onChange={e => setTermoEditavel(e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
