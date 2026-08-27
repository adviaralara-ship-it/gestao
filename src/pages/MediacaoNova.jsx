import React, { useState, useEffect, useMemo } from 'react'
import { ArrowLeft, Save, FileText, Calculator, FileCheck, DollarSign, Download, Check, Sparkles, User, Building, Calendar } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { jsPDF } from 'jspdf'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'
import { format, addMonths } from 'date-fns'

export default function MediacaoNova() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { add: addMediacao } = useFirestore('mediacoes')
  const { items: condominios } = useFirestore('condominios')
  
  // Estados da Calculadora
  const [condominio, setCondominio] = useState(user?.condominio || (condominios[0]?.nome || ''))
  const [unidade, setUnidade] = useState('')
  const [morador, setMorador] = useState('')
  const [cpfMorador, setCpfMorador] = useState('')
  const [valorOriginal, setValorOriginal] = useState(0)
  const [descontoPorcentagem, setDescontoPorcentagem] = useState(0)
  const [honorarios, setHonorarios] = useState(0)
  const [parcelas, setParcelas] = useState(1)
  const [primeiroVencimento, setPrimeiroVencimento] = useState(format(addMonths(new Date(), 1), 'yyyy-MM-dd'))

  // Cálculos em tempo real
  const vOriginal = parseFloat(valorOriginal) || 0
  const pDesconto = parseFloat(descontoPorcentagem) || 0
  const vHonorarios = parseFloat(honorarios) || 0
  const nParcelas = parseInt(parcelas) || 1

  const valorDescontoReal = (vOriginal * pDesconto) / 100
  const valorFinal = (vOriginal - valorDescontoReal) + vHonorarios
  const valorParcela = nParcelas > 0 ? valorFinal / nParcelas : 0

  // Formatador de Moeda Brasileira
  const formatBRL = (val) => {
    return (Number(val) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  // Gerador automático do Termo em Português do Brasil com formatação perfeita
  const gerarTextoTermo = (condo, unid, morad, cpf, vFin, parc, vParc, hon, desc, vOrig, venc) => {
    const dataVencFormatada = venc ? format(new Date(venc + 'T12:00:00'), 'dd/MM/yyyy') : '__/__/____'
    const dataHojeExtenso = format(new Date(), "dd 'de' MMMM 'de' yyyy")

    return `TERMO DE CONFISSÃO DE DÍVIDA E ACORDO EXTRAJUDICIAL

Pelo presente instrumento particular de Acordo Extrajudicial e Mediação Condominial, de um lado:

CREDOR: CONDOMÍNIO ${condo ? condo.toUpperCase() : '________________________'}, devidamente representado por seu(sua) Síndico(a) em exercício.

DEVEDOR(A): Sr.(a) ${morad ? morad.toUpperCase() : '________________________'}, inscrito(a) no CPF sob o nº ${cpf || '________________________'}, proprietário(a) / responsável pela UNIDADE / APARTAMENTO ${unid || '_____'}.

As partes acima qualificadas têm, entre si, justo e acordado o presente Termo de Resolução de Conflito (ODR), mediante as seguintes cláusulas:

CLÁUSULA PRIMEIRA - DO RECONHECIMENTO E CONFISSÃO DA DÍVIDA
O(A) DEVEDOR(A) reconhece expressamente e confessa de forma irrevogável e irretratável ser devedor(a) da quantia original de R$ ${formatBRL(vOrig)} referente a cotas condominiais e encargos em atraso.
Com a aplicação do desconto concedido de R$ ${formatBRL(desc)} (${pDesconto}%) e acréscimo dos honorários de mediação de R$ ${formatBRL(hon)}, o saldo total consolidado e renegociado a ser pago é de R$ ${formatBRL(vFin)}.

CLÁUSULA SEGUNDA - DA FORMA DE PAGAMENTO E PARCELAMENTO
O saldo devedor acordado de R$ ${formatBRL(vFin)} será quitado em ${parc} parcela(s) mensais e consecutivas no valor de R$ ${formatBRL(vParc)} cada.
O primeiro vencimento dar-se-á em ${dataVencFormatada}, e as demais parcelas vencerão no mesmo dia dos meses subsequentes.

CLÁUSULA TERCEIRA - DA CLÁUSULA PENAL E INADIMPLEMENTO
O atraso no pagamento de qualquer das parcelas implicará no vencimento antecipado de toda a dívida restante, incidindo multa moratória de 20% (vinte por cento) sobre o saldo devedor, juros legais de 1% ao mês e correção monetária até a data da efetiva quitação.

CLÁUSULA QUARTA - DOS HONORÁRIOS DE MEDIAÇÃO
Fica pactuado o valor de R$ ${formatBRL(hon)} a título de honorários da plataforma/mediação, já devidamente englobados no saldo total confessado.

CLÁUSULA QUINTA - DO TÍTULO EXECUTIVO EXTRAJUDICIAL
O presente acordo possui força de TÍTULO EXECUTIVO EXTRAJUDICIAL, nos termos expressos do Art. 784, inciso III, do Código de Processo Civil Brasileiro (Lei nº 13.105/2015).

Local e Data: ${condo || 'Condomínio'}, ${dataHojeExtenso}.


_____________________________________________
SÍNDICO(A) / ADMINISTRAÇÃO (CREDOR)


_____________________________________________
DEVEDOR(A) / CONDÔMINO(A)


_____________________________________________
MEDIADOR / TESTEMUNHA 1


_____________________________________________
TESTEMUNHA 2`
  }

  // Estado do Termo
  const [termoEditavel, setTermoEditavel] = useState('')
  const [editadoManualmente, setEditadoManualmente] = useState(false)

  // Atualização automática do termo enquanto o usuário preenche a calculadora
  useEffect(() => {
    if (!editadoManualmente) {
      const textoAtualizado = gerarTextoTermo(
        condominio,
        unidade,
        morador,
        cpfMorador,
        valorFinal,
        nParcelas,
        valorParcela,
        vHonorarios,
        valorDescontoReal,
        vOriginal,
        primeiroVencimento
      )
      setTermoEditavel(textoAtualizado)
    }
  }, [condominio, unidade, morador, cpfMorador, valorOriginal, descontoPorcentagem, honorarios, parcelas, primeiroVencimento, editadoManualmente])

  const handleForcarAtualizacao = () => {
    setEditadoManualmente(false)
    const textoAtualizado = gerarTextoTermo(
      condominio,
      unidade,
      morador,
      cpfMorador,
      valorFinal,
      nParcelas,
      valorParcela,
      vHonorarios,
      valorDescontoReal,
      vOriginal,
      primeiroVencimento
    )
    setTermoEditavel(textoAtualizado)
  }

  const handleGerarPDF = () => {
    const doc = new jsPDF()
    const margin = 15
    const maxLineWidth = 180
    
    doc.setFont("helvetica", "normal")
    doc.setFontSize(10)
    
    const textLines = doc.splitTextToSize(termoEditavel, maxLineWidth)
    doc.text(textLines, margin, 20)
    
    const nomeArquivo = condominio && unidade ? `Termo_Acordo_${condominio}_${unidade}.pdf` : 'Termo_Acordo_Confissao_Divida.pdf'
    doc.save(nomeArquivo)
  }

  const handleSalvar = async () => {
    if (!condominio || !unidade) {
      alert('Por favor, preencha ao menos o Condomínio e a Unidade/Apto.')
      return
    }

    try {
      await addMediacao({
        condominio: condominio,
        unidade: unidade,
        morador: morador || 'Morador Responsável',
        cpf: cpfMorador || '',
        tipo: 'Financeira',
        status: 'Aguardando Assinatura',
        valorOriginal: vOriginal,
        desconto: valorDescontoReal,
        descontoPercentual: pDesconto,
        honorarios: vHonorarios,
        parcelas: nParcelas,
        valorParcela: valorParcela,
        valor: valorFinal,
        primeiroVencimento: primeiroVencimento,
        termos: termoEditavel,
        data: format(new Date(), 'yyyy-MM-dd'),
        createdAt: new Date().toISOString()
      })

      alert('✅ Acordo de Mediação salvo com sucesso na base de dados!')
      navigate('/mediacao')
    } catch (e) {
      console.error(e)
      alert('Erro ao salvar mediação.')
    }
  }

  return (
    <div className="p-4 md:p-6 h-full flex flex-col bg-slate-50 animate-fade-in max-w-7xl mx-auto w-full pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/mediacao')} className="p-2 text-gray-500 hover:text-brand-600 hover:bg-white rounded-lg transition-colors border border-pale-300 shadow-sm">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
              Nova Mediação & Termo de Acordo
            </h1>
            <p className="text-gray-500 font-medium text-xs md:text-sm">
              Calculadora dinâmica de renegociação e geração automática de Termo de Confissão de Dívida.
            </p>
          </div>
        </div>

        <button
          onClick={handleSalvar}
          className="btn-primary flex items-center gap-2 px-6 py-2.5 shadow-lg shadow-brand-700/20 font-bold"
        >
          <Save size={18} />
          Salvar Acordo
        </button>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        {/* Lado Esquerdo: Calculadora */}
        <div className="xl:w-1/3 bg-white p-5 rounded-2xl shadow-sm border border-pale-300 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Calculator className="text-brand-600" size={20} />
              Calculadora do Acordo
            </h2>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
              Auto-Sincronizado
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="label font-bold text-gray-700">Condomínio *</label>
              <input
                type="text"
                className="input font-medium"
                value={condominio}
                onChange={e => { setCondominio(e.target.value); setEditadoManualmente(false); }}
                placeholder="Ex: Residencial Flores"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label font-bold text-gray-700">Unidade / Apto *</label>
                <input
                  type="text"
                  className="input font-medium"
                  value={unidade}
                  onChange={e => { setUnidade(e.target.value); setEditadoManualmente(false); }}
                  placeholder="Ex: Apto 302"
                />
              </div>

              <div>
                <label className="label font-bold text-gray-700">Nome do Morador</label>
                <input
                  type="text"
                  className="input font-medium"
                  value={morador}
                  onChange={e => { setMorador(e.target.value); setEditadoManualmente(false); }}
                  placeholder="Ex: João da Silva"
                />
              </div>
            </div>

            <div>
              <label className="label font-bold text-gray-700">CPF do Morador</label>
              <input
                type="text"
                className="input font-medium"
                value={cpfMorador}
                onChange={e => { setCpfMorador(e.target.value); setEditadoManualmente(false); }}
                placeholder="000.000.000-00"
              />
            </div>
            
            <div className="pt-2 border-t border-gray-100">
              <label className="label font-bold text-gray-700">Valor Original da Dívida (R$) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">R$</span>
                <input
                  type="number"
                  step="0.01"
                  className="input pl-8 font-bold text-gray-900"
                  value={valorOriginal || ''}
                  onChange={e => { setValorOriginal(e.target.value); setEditadoManualmente(false); }}
                  placeholder="0,00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label font-bold text-emerald-800">Desconto (%)</label>
                <div className="relative">
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600 font-bold">%</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="input pr-7 text-emerald-700 font-bold bg-emerald-50/40 border-emerald-300"
                    value={descontoPorcentagem || ''}
                    onChange={e => { setDescontoPorcentagem(e.target.value); setEditadoManualmente(false); }}
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <label className="label font-bold text-brand-800">Honorários ODR (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input font-bold text-brand-700 bg-brand-50/40 border-brand-300"
                  value={honorarios || ''}
                  onChange={e => { setHonorarios(e.target.value); setEditadoManualmente(false); }}
                  placeholder="0,00"
                />
              </div>
            </div>

            {valorDescontoReal > 0 && (
              <div className="text-xs text-emerald-700 bg-emerald-50 p-2.5 rounded-xl text-center border border-emerald-200 font-semibold">
                Desconto financeiro aplicado: <b className="font-black">R$ {formatBRL(valorDescontoReal)}</b>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
              <div>
                <label className="label font-bold text-gray-700">Parcelas</label>
                <select
                  className="input font-bold"
                  value={parcelas}
                  onChange={e => { setParcelas(e.target.value); setEditadoManualmente(false); }}
                >
                  {[1, 2, 3, 4, 5, 6, 8, 10, 12, 18, 24, 36, 48].map(n => (
                    <option key={n} value={n}>{n}x</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label font-bold text-gray-700">1º Vencimento</label>
                <input
                  type="date"
                  className="input font-medium"
                  value={primeiroVencimento}
                  onChange={e => { setPrimeiroVencimento(e.target.value); setEditadoManualmente(false); }}
                />
              </div>
            </div>

            {/* Quadro Resumo */}
            <div className="bg-slate-50 p-4 rounded-xl border border-gray-200 mt-2">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600 font-bold">Valor Total Acordado:</span>
                <span className="text-lg font-black text-gray-900">R$ {formatBRL(valorFinal)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500">Valor de Cada Parcela ({parcelas}x):</span>
                <span className="font-black text-brand-700 text-sm">R$ {formatBRL(valorParcela)}</span>
              </div>
            </div>

            {editadoManualmente && (
              <button
                type="button"
                onClick={handleForcarAtualizacao}
                className="w-full mt-2 bg-gray-800 hover:bg-gray-900 text-white py-2 rounded-xl transition-colors flex items-center justify-center gap-1.5 font-bold text-xs"
              >
                <Sparkles size={14} />
                Regerar Termo com Valores da Calculadora
              </button>
            )}
          </div>
        </div>

        {/* Lado Direito: Termo Formatado */}
        <div className="xl:w-2/3 bg-white rounded-2xl shadow-sm border border-pale-300 flex flex-col overflow-hidden">
          <div className="bg-slate-50 p-4 border-b border-pale-200 flex justify-between items-center">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <FileText className="text-brand-600" size={18} />
              Termo de Confissão de Dívida & Acordo (Editável)
            </h2>
            <button
              onClick={handleGerarPDF}
              className="text-xs bg-white border border-pale-300 text-gray-700 px-3.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5 font-bold shadow-sm"
            >
              <Download size={14} />
              Exportar para PDF
            </button>
          </div>
          
          <div className="p-4 flex-1">
            <textarea 
              className="w-full h-full min-h-[560px] p-6 border border-gray-200 focus:ring-2 focus:ring-brand-500 resize-none font-mono text-xs text-gray-900 leading-relaxed bg-slate-50/50 rounded-xl shadow-inner outline-none"
              value={termoEditavel}
              onChange={e => {
                setTermoEditavel(e.target.value)
                setEditadoManualmente(true)
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
