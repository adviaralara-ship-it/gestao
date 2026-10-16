import React, { useState, useMemo, useEffect } from 'react'
import { 
  Calculator, DollarSign, Building2, Calendar, FileText, Download, 
  Plus, Trash2, Edit2, CheckCircle2, AlertTriangle, ArrowRight, 
  TrendingDown, Percent, Sparkles, Share2, HelpCircle, Eye, Info,
  Check, X
} from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'
import { CurrencyInput } from '../utils/currency'

export default function SimulacaoRateio({ condominios = [], condoFiltro = 'Todos' }) {
  const { user } = useAuth()
  const isAdm = user?.role === 'Administrador'
  const meuCondo = user?.condominio || ''

  // Coleções Firestore
  const { items: allSimulacoes, addItem, updateItem, deleteItem } = useFirestore('simulacoes_rateio')
  const { items: orcamentos = [] } = useFirestore('orcamentos_comparativos')

  // Condomínio ativo no formulário
  const condoInicial = useMemo(() => {
    if (!isAdm && meuCondo) return meuCondo
    if (condoFiltro !== 'Todos') return condoFiltro
    return condominios[0]?.nome || ''
  }, [isAdm, meuCondo, condoFiltro, condominios])

  const [condoSelecionado, setCondoSelecionado] = useState(condoInicial)

  // Encontra dados do condomínio para pegar unidades cadastradas por padrão
  const condoObj = useMemo(() => {
    return condominios.find(c => c.nome === condoSelecionado)
  }, [condominios, condoSelecionado])

  // Estado do formulário de simulação
  const [nomeObra, setNomeObra] = useState('Impermeabilização da cobertura')
  const [valorTotal, setValorTotal] = useState(12000)
  const [unidades, setUnidades] = useState(42)
  const [dataPrevista, setDataPrevista] = useState('')
  const [observacao, setObservacao] = useState('')
  const [orcamentosVinculadosIds, setOrcamentosVinculadosIds] = useState([])

  // Origem do recurso: 'caixa', 'fundo_reserva', 'rateio_puro', 'caixa_rateio'
  const [origemRecurso, setOrigemRecurso] = useState('caixa_rateio')
  const [valorCaixaUtilizado, setValorCaixaUtilizado] = useState(2000)

  // Parcelamento personalizado escolhido para a proposta oficial
  const [parcelasProposta, setParcelasProposta] = useState(3)

  // Atualiza número padrão de unidades ao trocar o condomínio
  useEffect(() => {
    if (condoObj?.unidades && !isNaN(Number(condoObj.unidades)) && Number(condoObj.unidades) > 0) {
      setUnidades(Number(condoObj.unidades))
    }
  }, [condoObj])

  // Vincula valor de orçamento caso o usuário selecione um ou mais orçamentos cadastrados
  const orcamentosDoCondo = useMemo(() => {
    return (orcamentos || []).filter(o => {
      if (!condoSelecionado) return true
      const c = (o.condominio || '').trim().toLowerCase()
      const sel = condoSelecionado.trim().toLowerCase()
      return c === sel || c.includes(sel) || sel.includes(c)
    })
  }, [orcamentos, condoSelecionado])

  // Atualizar múltiplos orçamentos selecionados
  const handleToggleOrcamento = (id) => {
    setOrcamentosVinculadosIds(prev => {
      const exists = prev.includes(id)
      const next = exists ? prev.filter(item => item !== id) : [...prev, id]

      // Recalcular soma dos orçamentos selecionados e sugerir nome da obra
      const selecionados = (orcamentos || []).filter(o => next.includes(o.id))
      if (selecionados.length > 0) {
        const total = selecionados.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0)
        setValorTotal(total)

        const nomes = selecionados.map(s => {
          if (s.empresa && s.tipoServico) return `${s.tipoServico} (${s.empresa})`
          return s.tipoServico || s.empresa || s.grupo || 'Serviço'
        })
        setNomeObra(nomes.join(' + '))

        const primeiroCondo = selecionados.find(s => s.condominio)?.condominio
        if (primeiroCondo && !condoSelecionado) {
          setCondoSelecionado(primeiroCondo)
        }
      }
      return next
    })
  }

  const handleLimparOrcamentos = () => {
    setOrcamentosVinculadosIds([])
  }

  // Cálculos dinâmicos matemáticos
  const calculos = useMemo(() => {
    const vTotal = Number(valorTotal) || 0
    let vCaixa = 0

    if (origemRecurso === 'caixa') {
      vCaixa = vTotal
    } else if (origemRecurso === 'fundo_reserva') {
      vCaixa = vTotal
    } else if (origemRecurso === 'rateio_puro') {
      vCaixa = 0
    } else if (origemRecurso === 'caixa_rateio') {
      vCaixa = Math.min(Number(valorCaixaUtilizado) || 0, vTotal)
    }

    const vRatear = Math.max(0, vTotal - vCaixa)
    const nUnidades = Math.max(1, Number(unidades) || 1)
    const valorPorUnidade = vRatear / nUnidades

    // Simulação das opções padrão de parcelas (1, 2, 3, 4, 6, 10, 12 parcelas)
    const opcoesParcelas = [1, 2, 3, 4, 6, 10, 12].map(n => {
      const valorParcela = valorPorUnidade / n
      return {
        n,
        valorParcela,
        totalRateio: vRatear,
        descricao: n === 1 ? 'À vista' : `${n} parcelas`
      }
    })

    // Parcela específica selecionada para a proposta
    const nParcelasProp = Math.max(1, Number(parcelasProposta) || 1)
    const valorParcelaEscolhida = valorPorUnidade / nParcelasProp

    // Percentual suportado pelo caixa
    const percCaixa = vTotal > 0 ? (vCaixa / vTotal) * 100 : 0
    const percRateio = 100 - percCaixa

    return {
      vTotal,
      vCaixa,
      vRatear,
      nUnidades,
      valorPorUnidade,
      opcoesParcelas,
      nParcelasProp,
      valorParcelaEscolhida,
      percCaixa,
      percRateio
    }
  }, [valorTotal, unidades, origemRecurso, valorCaixaUtilizado, parcelasProposta])

  // Salvar simulação no histórico
  const [salvando, setSalvando] = useState(false)
  const handleSalvarSimulacao = async () => {
    if (!nomeObra.trim()) {
      alert('Por favor, informe o nome da obra ou serviço.')
      return
    }
    if (calculos.vTotal <= 0) {
      alert('Informe um valor total válido para a obra.')
      return
    }

    setSalvando(true)
    try {
      await addItem({
        condominio: condoSelecionado,
        nomeObra,
        valorTotal: calculos.vTotal,
        unidades: calculos.nUnidades,
        dataPrevista,
        observacao,
        origemRecurso,
        valorCaixaUtilizado: calculos.vCaixa,
        valorRatear: calculos.vRatear,
        valorPorUnidade: calculos.valorPorUnidade,
        parcelasProposta: calculos.nParcelasProp,
        valorParcelaProposta: calculos.valorParcelaEscolhida,
        orcamentosVinculadosIds,
        orcamentoVinculadoId: orcamentosVinculadosIds[0] || '',
        criadoPor: user?.nome || 'Usuário',
        criadoEm: new Date().toISOString()
      })
      alert('✅ Simulação de rateio salva com sucesso no histórico!')
    } catch (err) {
      console.error(err)
      alert('Erro ao salvar simulação: ' + err.message)
    } finally {
      setSalvando(false)
    }
  }

  // GERAÇÃO DO RELATÓRIO PDF DA PROPOSTA DE RATEIO
  const handleGerarPdfProposta = () => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageWidth = doc.internal.pageSize.getWidth()

      // Cabeçalho institucional
      doc.setFillColor(15, 23, 42) // Slate 900
      doc.rect(0, 0, pageWidth, 28, 'F')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.setTextColor(255, 255, 255)
      doc.text('PROPOSTA DE RATEIO EXTRAORDINÁRIO', pageWidth / 2, 12, { align: 'center' })

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(203, 213, 225)
      doc.text(`Condomínio: ${condoSelecionado || 'Geral'} • Alpha Soluções Condominiais`, pageWidth / 2, 19, { align: 'center' })

      let currentY = 36

      // Quadro Resumo dos Parâmetros
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(15, 23, 42)
      doc.text('1. DADOS DA OBRA / SERVIÇO', 14, currentY)
      currentY += 4

      const tabelaDados = [
        ['Finalidade / Objeto:', nomeObra],
        ['Condomínio Beneficiado:', condoSelecionado || 'Geral'],
        ['Data Prevista / Início:', dataPrevista ? new Date(dataPrevista).toLocaleDateString('pt-BR') : 'A definir em assembleia'],
        ['Número de Unidades Participantes:', `${calculos.nUnidades} unidades`],
        ['Origem dos Recursos:', 
          origemRecurso === 'caixa' ? '100% Caixa Disponível' :
          origemRecurso === 'fundo_reserva' ? '100% Fundo de Reserva' :
          origemRecurso === 'rateio_puro' ? '100% Rateio Extraordinário entre as unidades' :
          'Misto: Utilização de Caixa + Rateio Complementar'
        ]
      ]

      autoTable(doc, {
        startY: currentY,
        body: tabelaDados,
        theme: 'plain',
        styles: { fontSize: 9.5, cellPadding: 2.5, textColor: [30, 41, 59] },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 70, textColor: [71, 85, 105] },
          1: { fontStyle: 'normal' }
        }
      })

      currentY = doc.lastAutoTable.finalY + 8

      // Quadro Financeiro / Valores
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(15, 23, 42)
      doc.text('2. PLANILHA DE CUSTOS & PARTICIPAÇÃO DO CAIXA', 14, currentY)
      currentY += 4

      const tabelaValores = [
        ['Valor Total da Obra / Serviço', `R$ ${calculos.vTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
        ['(-) Aporte / Utilização do Caixa do Condomínio', `R$ ${calculos.vCaixa.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${calculos.percCaixa.toFixed(1)}%)`],
        ['(=) Saldo Restante a Ratear entre Moradores', `R$ ${calculos.vRatear.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${calculos.percRateio.toFixed(1)}%)`],
        ['Valor Total por Unidade (Cota Única)', `R$ ${calculos.valorPorUnidade.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`]
      ]

      autoTable(doc, {
        startY: currentY,
        body: tabelaValores,
        theme: 'grid',
        headStyles: { fillColor: [226, 232, 240] },
        styles: { fontSize: 9.5, cellPadding: 3 },
        columnStyles: {
          0: { fontStyle: 'bold', textColor: [15, 23, 42] },
          1: { fontStyle: 'bold', halign: 'right', textColor: [5, 150, 105] }
        }
      })

      currentY = doc.lastAutoTable.finalY + 8

      // Proposta Recomendada em Destaque
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(15, 23, 42)
      doc.text('3. PROPOSTA RECOMENDADA PARA VOTAÇÃO', 14, currentY)
      currentY += 4

      const tabelaDestaque = [
        [
          `Opção Selecionada: Parcelamento em ${calculos.nParcelasProp}x`,
          `R$ ${calculos.valorParcelaEscolhida.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / mês por unidade`,
          `Total por unidade: R$ ${calculos.valorPorUnidade.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        ]
      ]

      autoTable(doc, {
        startY: currentY,
        body: tabelaDestaque,
        theme: 'plain',
        styles: {
          fillColor: [236, 253, 245], // Emerald suave
          textColor: [6, 95, 70],
          fontStyle: 'bold',
          fontSize: 10,
          cellPadding: 4,
          halign: 'center'
        }
      })

      currentY = doc.lastAutoTable.finalY + 8

      // Tabela de Cenários Comparativos (Alternativas)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(15, 23, 42)
      doc.text('4. CENÁRIOS COMPARATIVOS DE PARCELAMENTO (ALTERNATIVAS)', 14, currentY)
      currentY += 4

      const colunasCenarios = [
        { header: 'Forma de Pagamento', dataKey: 'forma' },
        { header: 'Qtd Parcelas', dataKey: 'parcelas' },
        { header: 'Valor Mensal por Apto', dataKey: 'valorMes' },
        { header: 'Total por Unidade', dataKey: 'totalApto' },
        { header: 'Arrecadação Mensal', dataKey: 'arrecadacao' }
      ]

      const linhasCenarios = calculos.opcoesParcelas.map(op => ({
        forma: op.descricao,
        parcelas: `${op.n}x`,
        valorMes: `R$ ${op.valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        totalApto: `R$ ${calculos.valorPorUnidade.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        arrecadacao: `R$ ${(op.valorParcela * calculos.nUnidades).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      }))

      autoTable(doc, {
        startY: currentY,
        columns: colunasCenarios,
        body: linhasCenarios,
        theme: 'grid',
        headStyles: {
          fillColor: [215, 226, 238],
          textColor: [15, 23, 42],
          fontStyle: 'bold',
          fontSize: 8.5
        },
        styles: { fontSize: 8.5, cellPadding: 2.2 },
        columnStyles: {
          0: { fontStyle: 'bold' },
          2: { fontStyle: 'bold', textColor: [16, 185, 129] },
          4: { fontStyle: 'bold' }
        }
      })

      currentY = doc.lastAutoTable.finalY + 8

      // Observações
      if (observacao) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(71, 85, 105)
        doc.text('Observações Adicionais:', 14, currentY)
        currentY += 4

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8.5)
        doc.setTextColor(100, 116, 139)
        const splitObs = doc.splitTextToSize(observacao, pageWidth - 28)
        doc.text(splitObs, 14, currentY)
        currentY += (splitObs.length * 4) + 6
      }

      // Rodapé
      doc.setFontSize(7.5)
      doc.setTextColor(148, 163, 184)
      doc.text(`Documento gerado em ${new Date().toLocaleDateString('pt-BR')} via Alpha Gestão Condominial Inteligente.`, pageWidth / 2, 287, { align: 'center' })

      const nomeArquivo = `Proposta_Rateio_${(nomeObra || 'Obra').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
      doc.save(nomeArquivo)
    } catch (err) {
      console.error(err)
      alert('Erro ao gerar relatório de proposta: ' + err.message)
    }
  }

  // Copiar resumo para WhatsApp
  const handleCopiarWhatsApp = () => {
    let txt = `🏢 *PROPOSTA DE RATEIO EXTRAORDINÁRIO*\n`
    txt += `📍 *Condomínio:* ${condoSelecionado || 'Geral'}\n`
    txt += `🛠️ *Obra / Serviço:* ${nomeObra}\n\n`
    txt += `💰 *Valor total da obra:* R$ ${calculos.vTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`
    if (calculos.vCaixa > 0) {
      txt += `🏦 *Aporte do Caixa do condomínio:* R$ ${calculos.vCaixa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`
    }
    txt += `📊 *Valor restante a ratear:* R$ ${calculos.vRatear.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`
    txt += `🚪 *Quantidade de unidades:* ${calculos.nUnidades}\n`
    txt += `💵 *Custo total por unidade:* R$ ${calculos.valorPorUnidade.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n`
    txt += `🎯 *Sugestão de Parcelamento:*\n`
    txt += `👉 *${calculos.nParcelasProp}x de R$ ${calculos.valorParcelaEscolhida.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}* por unidade\n\n`
    txt += `_Alternativas de votação:_\n`
    txt += `• À vista: R$ ${calculos.valorPorUnidade.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`
    txt += `• 2x de R$ ${(calculos.valorPorUnidade / 2).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`
    txt += `• 3x de R$ ${(calculos.valorPorUnidade / 3).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`
    txt += `• 6x de R$ ${(calculos.valorPorUnidade / 6).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`
    txt += `• 12x de R$ ${(calculos.valorPorUnidade / 12).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n`
    if (observacao) {
      txt += `📝 *Observação:* ${observacao}\n\n`
    }
    txt += `Alpha Soluções Condominiais`

    if (navigator.clipboard) {
      navigator.clipboard.writeText(txt)
      alert('📋 Texto copiado para a área de transferência! Pode colar diretamente no WhatsApp do condomínio.')
    } else {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(txt)}`, '_blank')
    }
  }

  // Filtragem do Histórico de Simulações
  const historicoFiltrado = useMemo(() => {
    return (allSimulacoes || []).filter(s => {
      if (!isAdm) {
        if (!meuCondo) return false
        const sCondo = (s.condominio || '').trim().toLowerCase()
        const uCondo = meuCondo.trim().toLowerCase()
        return sCondo === uCondo || sCondo.includes(uCondo) || uCondo.includes(sCondo)
      }
      if (condoFiltro !== 'Todos') {
        const sCondo = (s.condominio || '').trim().toLowerCase()
        const fCondo = String(condoFiltro).trim().toLowerCase()
        return sCondo === fCondo || sCondo.includes(fCondo) || fCondo.includes(sCondo)
      }
      return true
    })
  }, [allSimulacoes, isAdm, meuCondo, condoFiltro])

  return (
    <div className="flex flex-col gap-6 animate-fade-in w-full">
      {/* Banner Superior da Ferramenta */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-xl border border-slate-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-indigo-500/20 border border-indigo-400/30 px-3 py-1 rounded-full text-xs font-black text-indigo-300 mb-3">
              <Calculator size={14} className="text-indigo-400" /> Simulador Estratégico de Obras & Fechamento Financeiro
            </div>
            <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Simulação de Rateio Extraordinário
            </h3>
            <p className="text-slate-300 text-xs sm:text-sm mt-2 leading-relaxed">
              Calcule com precisão o impacto no caixa do condomínio, simule alternativas de parcelamento por unidade e gere um relatório profissional pronto para apresentar aos moradores e levar para votação em assembleia.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={handleGerarPdfProposta}
              className="btn-primary bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-5 py-3 rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] cursor-pointer"
            >
              <Download size={18} />
              <span>Gerar Proposta de Rateio (PDF)</span>
            </button>
            <button
              onClick={handleCopiarWhatsApp}
              className="btn-secondary bg-white/10 hover:bg-white/20 text-white border-white/20 font-black px-4 py-3 rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer"
              title="Copiar texto formatado para o WhatsApp"
            >
              <Share2 size={18} className="text-green-400" />
              <span>Copiar p/ WhatsApp</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid Principal: Formulário de Configuração (Esquerda) e Resultados em Tempo Real (Direita) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Painel Esquerdo: Parâmetros Editáveis (7 colunas) */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          {/* 1. Cadastro da Obra / Serviço */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h4 className="font-black text-sm sm:text-base text-gray-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-black">1</span>
                Cadastrar a Obra / Serviço
              </h4>
              <span className="text-[11px] text-gray-500 font-medium">Parâmetros Gerais</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Condomínio Selecionado */}
              <div className="sm:col-span-2">
                <label className="label text-xs font-black">Condomínio *</label>
                {isAdm ? (
                  <select
                    className="input text-xs font-bold bg-white border-brand-300 text-gray-900"
                    value={condoSelecionado}
                    onChange={e => setCondoSelecionado(e.target.value)}
                  >
                    {condominios?.map(c => (
                      <option key={c.id || c.nome} value={c.nome}>
                        🏢 {c.nome} {c.unidades ? `(${c.unidades} unidades)` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="input text-xs font-bold bg-slate-100 text-gray-800"
                    value={condoSelecionado}
                    readOnly
                  />
                )}
              </div>

              {/* Orçamentos Anexados (Importação Rápida / Múltipla Seleção) */}
              {orcamentosDoCondo.length > 0 && (
                <div className="sm:col-span-2 bg-gradient-to-r from-emerald-50/80 to-teal-50/50 border border-emerald-200 p-3.5 rounded-2xl shadow-xs">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <label className="label text-xs font-black text-emerald-950 flex items-center gap-1.5 m-0">
                      <Sparkles size={14} className="text-emerald-600" /> 
                      Importar de Orçamento(s) Cadastrado(s)
                      {orcamentosVinculadosIds.length > 0 && (
                        <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full ml-1">
                          {orcamentosVinculadosIds.length} selecionado{orcamentosVinculadosIds.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </label>

                    {orcamentosVinculadosIds.length > 0 && (
                      <button
                        type="button"
                        onClick={handleLimparOrcamentos}
                        className="text-[11px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer"
                      >
                        <X size={12} /> Limpar seleção
                      </button>
                    )}
                  </div>

                  <p className="text-[11px] text-emerald-800 mb-2.5">
                    Marque um ou mais orçamentos abaixo para <b>somar os valores automaticamente</b> e ratear entre as unidades:
                  </p>

                  <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
                    {orcamentosDoCondo.map(o => {
                      const isChecked = orcamentosVinculadosIds.includes(o.id)
                      const valFormatado = Number(o.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                      return (
                        <div
                          key={o.id}
                          onClick={() => handleToggleOrcamento(o.id)}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 text-xs ${
                            isChecked
                              ? 'bg-emerald-100/80 border-emerald-400 text-emerald-950 shadow-xs'
                              : 'bg-white hover:bg-slate-50 border-gray-200 text-gray-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}} // tratado no wrapper onClick
                              className="w-4 h-4 rounded text-emerald-600 accent-emerald-600 cursor-pointer"
                            />
                            <div className="min-w-0">
                              <span className="font-black text-gray-900 block truncate">
                                {o.empresa || 'Empresa'}
                              </span>
                              <span className="text-[11px] text-gray-500 truncate block">
                                {o.tipoServico || o.grupo || 'Serviço'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="font-mono font-black text-xs text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200">
                              R$ {valFormatado}
                            </span>
                            {isChecked && (
                              <span className="text-emerald-700">
                                <Check size={14} className="stroke-[3]" />
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {orcamentosVinculadosIds.length > 1 && (
                    <div className="mt-2.5 pt-2 border-t border-emerald-200/80 flex items-center justify-between text-xs text-emerald-900">
                      <span className="font-medium">Total somado dos {orcamentosVinculadosIds.length} orçamentos:</span>
                      <span className="font-mono font-black text-emerald-800 text-sm">
                        R$ {Number(valorTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Nome da Obra */}
              <div className="sm:col-span-2">
                <label className="label text-xs font-black">Nome da Obra / Serviço *</label>
                <input
                  className="input text-xs font-bold"
                  value={nomeObra}
                  onChange={e => setNomeObra(e.target.value)}
                  placeholder="Ex: Impermeabilização da cobertura, Pintura da Fachada..."
                />
              </div>

              {/* Valor Total da Obra */}
              <div>
                <label className="label text-xs font-black text-gray-800">Valor Total da Obra (R$) *</label>
                <CurrencyInput
                  value={valorTotal}
                  onChange={v => setValorTotal(v)}
                  placeholder="0,00"
                  className="input font-mono font-black text-sm text-gray-900 bg-slate-50"
                />
              </div>

              {/* Quantidade de Unidades */}
              <div>
                <label className="label text-xs font-black text-gray-800 flex items-center justify-between">
                  <span>Quantidade de Unidades *</span>
                  {condoObj?.unidades && (
                    <span className="text-[10px] text-indigo-600 font-bold">Cadastradas: {condoObj.unidades}</span>
                  )}
                </label>
                <input
                  type="number"
                  min="1"
                  className="input font-mono font-black text-sm text-gray-900"
                  value={unidades}
                  onChange={e => setUnidades(Math.max(1, parseInt(e.target.value) || 1))}
                  placeholder="Ex: 42"
                />
              </div>

              {/* Data Prevista */}
              <div>
                <label className="label text-xs font-black">Data Prevista de Início / Conclusão</label>
                <input
                  type="date"
                  className="input text-xs"
                  value={dataPrevista}
                  onChange={e => setDataPrevista(e.target.value)}
                />
              </div>

              {/* Parcelamento Proposto (Editável) */}
              <div>
                <label className="label text-xs font-black text-indigo-900">Parcelas Sugeridas na Proposta</label>
                <select
                  className="input text-xs font-bold bg-indigo-50/70 border-indigo-200 text-indigo-950"
                  value={parcelasProposta}
                  onChange={e => setParcelasProposta(parseInt(e.target.value) || 1)}
                >
                  <option value="1">1x (À vista)</option>
                  <option value="2">2 parcelas</option>
                  <option value="3">3 parcelas</option>
                  <option value="4">4 parcelas</option>
                  <option value="5">5 parcelas</option>
                  <option value="6">6 parcelas</option>
                  <option value="8">8 parcelas</option>
                  <option value="10">10 parcelas</option>
                  <option value="12">12 parcelas</option>
                  <option value="18">18 parcelas</option>
                  <option value="24">24 parcelas</option>
                </select>
              </div>

              {/* Observação */}
              <div className="sm:col-span-2">
                <label className="label text-xs font-black">Observações e Detalhes da Execução</label>
                <textarea
                  className="input text-xs min-h-[70px] resize-none"
                  value={observacao}
                  onChange={e => setObservacao(e.target.value)}
                  placeholder="Ex: Pagamento 50% na entrada e 50% na conclusão; Material com garantia de 5 anos..."
                />
              </div>
            </div>
          </div>

          {/* 2. Origem do Recurso & Uso do Caixa */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h4 className="font-black text-sm sm:text-base text-gray-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-black">2</span>
                Escolher a Origem do Recurso
              </h4>
              <span className="text-[11px] text-gray-500 font-medium">Estratégia Financeira</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { id: 'caixa', label: 'Caixa Disponível (100%)', desc: 'O condomínio arca com todo o valor, sem custos extras aos moradores.' },
                { id: 'fundo_reserva', label: 'Fundo de Reserva (100%)', desc: 'Utiliza as reservas acumuladas aprovadas em convenção.' },
                { id: 'rateio_puro', label: 'Rateio Extraordinário (100%)', desc: 'Todo o valor da obra é dividido integralmente entre as unidades.' },
                { id: 'caixa_rateio', label: 'Caixa + Rateio (Misto)', desc: 'O condomínio dá uma entrada com o caixa e rateia o restante.' }
              ].map(opt => {
                const ativo = origemRecurso === opt.id
                return (
                  <div
                    key={opt.id}
                    onClick={() => setOrigemRecurso(opt.id)}
                    className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col gap-1 ${
                      ativo
                        ? 'border-brand-600 bg-brand-50/40 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-black ${ativo ? 'text-brand-900' : 'text-gray-800'}`}>
                        {opt.label}
                      </span>
                      <input
                        type="radio"
                        checked={ativo}
                        onChange={() => setOrigemRecurso(opt.id)}
                        className="accent-brand-600"
                      />
                    </div>
                    <p className="text-[11px] text-gray-500 leading-tight">{opt.desc}</p>
                  </div>
                )
              })}
            </div>

            {/* O Diferencial da Alpha: Campo de Valor que o condomínio pretende utilizar do caixa */}
            {origemRecurso === 'caixa_rateio' && (
              <div className="bg-amber-50/80 border border-amber-300 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-1">
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 text-amber-950 font-black text-xs">
                    <DollarSign size={16} className="text-amber-600" />
                    <span>Valor que o condomínio pretende utilizar do caixa:</span>
                  </div>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Este valor será subtraído da obra antes de calcular a cota por unidade.
                  </p>
                </div>
                <div className="w-full sm:w-48">
                  <CurrencyInput
                    value={valorCaixaUtilizado}
                    onChange={v => setValorCaixaUtilizado(v)}
                    placeholder="0,00"
                    className="input font-mono font-black text-sm text-amber-950 bg-white border-amber-300"
                  />
                </div>
              </div>
            )}

            {/* Botão de Salvar Simulação no Histórico */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={handleSalvarSimulacao}
                disabled={salvando}
                className="btn-secondary text-xs flex items-center gap-1.5 font-bold"
              >
                <CheckCircle2 size={15} className="text-emerald-600" />
                {salvando ? 'Salvando...' : 'Salvar Simulação no Histórico'}
              </button>
            </div>
          </div>
        </div>

        {/* Painel Direito: O Diferencial da Simulação & Impacto no Caixa (5 colunas) */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          {/* Cartão de Resumo Financeiro */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h4 className="font-black text-sm sm:text-base text-gray-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-black">3</span>
                Impacto Financeiro & Rateio
              </h4>
              <span className="text-[11px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                {calculos.nUnidades} unidades
              </span>
            </div>

            {/* Destaque Principal: Valor Por Unidade */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 p-5 rounded-2xl flex flex-col gap-1 text-center">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                Valor Total por Unidade
              </span>
              <div className="text-3xl sm:text-4xl font-black text-emerald-950 font-mono my-1">
                R$ {calculos.valorPorUnidade.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-emerald-700 font-medium">
                Cálculo: R$ {calculos.vRatear.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ÷ {calculos.nUnidades} unidades
              </p>
            </div>

            {/* Destaque da Parcela Selecionada na Proposta */}
            <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-indigo-700 uppercase block">Proposta Recomendada</span>
                <span className="text-sm font-black text-indigo-950">
                  {calculos.nParcelasProp}x de R$ {calculos.valorParcelaEscolhida.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-indigo-600 block mt-0.5">por mês para cada morador</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black">
                {calculos.nParcelasProp}x
              </div>
            </div>

            {/* Tabela de Decomposição do Custo */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                <span className="text-gray-500 font-medium">Valor Total da Obra:</span>
                <span className="font-bold text-gray-900 font-mono">
                  R$ {calculos.vTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                <span className="text-amber-700 font-medium">(-) Uso do Caixa / Fundo:</span>
                <span className="font-bold text-amber-800 font-mono">
                  R$ {calculos.vCaixa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ({calculos.percCaixa.toFixed(1)}%)
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                <span className="text-emerald-700 font-bold">(=) Saldo a Ratear:</span>
                <span className="font-black text-emerald-800 font-mono">
                  R$ {calculos.vRatear.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ({calculos.percRateio.toFixed(1)}%)
                </span>
              </div>
            </div>

            {/* Barra de Progresso Visual da Participação */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-[11px] font-bold text-gray-600">
                <span>Caixa: {calculos.percCaixa.toFixed(0)}%</span>
                <span>Rateio: {calculos.percRateio.toFixed(0)}%</span>
              </div>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden flex">
                <div 
                  className="bg-amber-400 h-full transition-all duration-300" 
                  style={{ width: `${calculos.percCaixa}%` }}
                  title={`Caixa: R$ ${calculos.vCaixa.toLocaleString('pt-BR')}`}
                />
                <div 
                  className="bg-emerald-500 h-full transition-all duration-300" 
                  style={{ width: `${calculos.percRateio}%` }}
                  title={`Rateio: R$ ${calculos.vRatear.toLocaleString('pt-BR')}`}
                />
              </div>
            </div>
          </div>

          {/* Teste de Alternativas de Parcelamento (Tabela de Cenários) */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h4 className="font-black text-xs sm:text-sm text-gray-900 flex items-center gap-1.5">
                <TrendingDown size={16} className="text-indigo-600" />
                Comparativo de Alternativas para Votação
              </h4>
              <span className="text-[10px] text-gray-400">Clique para aplicar</span>
            </div>

            <div className="divide-y divide-gray-100 border border-gray-200 rounded-2xl overflow-hidden">
              {calculos.opcoesParcelas.map(op => {
                const isSelected = calculos.nParcelasProp === op.n
                return (
                  <div
                    key={op.n}
                    onClick={() => setParcelasProposta(op.n)}
                    className={`p-2.5 sm:p-3 flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected ? 'bg-indigo-50/70 font-bold' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-6 h-6 rounded-md text-[11px] font-black flex items-center justify-center ${
                        isSelected ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {op.n}x
                      </span>
                      <span className="text-xs text-gray-800">{op.descricao}</span>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-black text-emerald-700 font-mono block">
                        R$ {op.valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] text-gray-400">/ mês por apto</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Histórico de Simulações do Condomínio */}
      {historicoFiltrado.length > 0 && (
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200 shadow-sm flex flex-col gap-4 mt-2">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h4 className="font-black text-sm sm:text-base text-gray-900 flex items-center gap-2">
                <FileText size={18} className="text-brand-600" />
                Histórico de Simulações Salvas ({historicoFiltrado.length})
              </h4>
              <p className="text-xs text-gray-500">Consulte propostas anteriores ou use como base para novas votações</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {historicoFiltrado.map(sim => (
              <div
                key={sim.id}
                className="p-4 rounded-2xl border border-gray-200 hover:border-brand-400 bg-slate-50/60 transition-all flex flex-col justify-between gap-3 shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] font-black uppercase text-brand-800 bg-brand-100 px-2 py-0.5 rounded-full">
                      {sim.condominio || 'Geral'}
                    </span>
                    <button
                      onClick={() => {
                        if (window.confirm(`Excluir a simulação "${sim.nomeObra}"?`)) {
                          deleteItem(sim.id)
                        }
                      }}
                      className="text-gray-400 hover:text-rose-600 p-1"
                      title="Excluir simulação"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <h5 className="font-black text-sm text-gray-900 line-clamp-1">{sim.nomeObra}</h5>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {sim.unidades} unidades • Total: R$ {Number(sim.valorTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-gray-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-gray-400 block">Proposta</span>
                    <span className="text-xs font-black text-indigo-900">
                      {sim.parcelasProposta || 1}x de R$ {Number(sim.valorParcelaProposta || sim.valorPorUnidade || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-gray-400 block">Por Unidade</span>
                    <span className="text-xs font-black text-emerald-700">
                      R$ {Number(sim.valorPorUnidade || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1 border-t border-gray-200">
                  <span>{sim.criadoEm ? new Date(sim.criadoEm).toLocaleDateString('pt-BR') : ''}</span>
                  <button
                    onClick={() => {
                      setNomeObra(sim.nomeObra || '')
                      setValorTotal(Number(sim.valorTotal || 0))
                      setUnidades(Number(sim.unidades || 1))
                      setCondoSelecionado(sim.condominio || '')
                      setOrigemRecurso(sim.origemRecurso || 'caixa_rateio')
                      setValorCaixaUtilizado(Number(sim.valorCaixaUtilizado || 0))
                      setParcelasProposta(Number(sim.parcelasProposta || 1))
                      setObservacao(sim.observacao || '')
                      setOrcamentosVinculadosIds(sim.orcamentosVinculadosIds || (sim.orcamentoVinculadoId ? [sim.orcamentoVinculadoId] : []))
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                    className="text-brand-600 hover:text-brand-800 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    Carregar <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
