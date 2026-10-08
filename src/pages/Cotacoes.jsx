import React, { useState, useMemo, useEffect } from 'react'
import {
  FileSpreadsheet, Plus, Search, Filter, Download, Eye, Edit3, Trash2,
  CheckCircle2, XCircle, Clock, AlertTriangle, ArrowRight, TrendingUp, TrendingDown,
  Building2, Users, DollarSign, Calculator, Award, ShieldCheck, FileText,
  ChevronRight, Calendar, ArrowUpDown, HelpCircle, Layers, Check, Share2,
  FileCheck, ThumbsUp, ThumbsDown, MessageSquare, Paperclip, Sparkles, ExternalLink
} from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format, parseISO } from 'date-fns'

// Categorias padrão
const CATEGORIAS = [
  'Manutenção', 'Obras', 'Limpeza', 'Segurança', 'Elevadores',
  'Jardinagem', 'Elétrica', 'Hidráulica', 'Pintura', 'Equipamentos',
  'Materiais', 'Serviços', 'Tecnologia', 'Administrativo', 'Outros'
]

// Status possíveis do fluxo
const STATUS_LIST = [
  'Rascunho', 'Solicitada', 'Aguardando propostas', 'Em análise',
  'Aguardando aprovação', 'Aprovada', 'Contratada', 'Concluída',
  'Reprovada', 'Cancelada', 'Vencida'
]

// Cores para os status
const STATUS_COLORS = {
  'Rascunho': 'bg-gray-100 text-gray-700 border-gray-300',
  'Solicitada': 'bg-blue-50 text-blue-700 border-blue-200',
  'Aguardando propostas': 'bg-amber-50 text-amber-700 border-amber-200',
  'Em análise': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Aguardando aprovação': 'bg-purple-50 text-purple-700 border-purple-200',
  'Aprovada': 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold',
  'Contratada': 'bg-teal-50 text-teal-700 border-teal-300 font-bold',
  'Concluída': 'bg-green-100 text-green-800 border-green-300 font-bold',
  'Reprovada': 'bg-rose-50 text-rose-700 border-rose-200',
  'Cancelada': 'bg-gray-200 text-gray-600 border-gray-300',
  'Vencida': 'bg-red-50 text-red-700 border-red-200',
}

export default function Cotacoes() {
  const { user } = useAuth()
  const { items: cotacoes, add: addCotacao, update: updateCotacao, remove: removeCotacao } = useFirestore('cotacoes')
  const { items: condominios } = useFirestore('condominios')
  const { items: prestadores } = useFirestore('prestadores')
  const { add: addFinanceiro } = useFirestore('financeiro_lancamentos')
  const { add: addTarefa } = useFirestore('tarefas')

  // Filtros da listagem
  const isAdm = user?.role === 'Administrador'
  const meuCondo = (user?.condominio || '').trim().toLowerCase()

  const [busca, setBusca] = useState('')
  const [filtroCondominio, setFiltroCondominio] = useState(() => {
    if (!isAdm && user?.condominio) return user.condominio
    return 'Todos'
  })

  useEffect(() => {
    if (!isAdm && user?.condominio) {
      setFiltroCondominio(user.condominio)
    }
  }, [isAdm, user])

  const [filtroStatus, setFiltroStatus] = useState('Todos')
  const [filtroCategoria, setFiltroCategoria] = useState('Todos')
  const [selecionados, setSelecionados] = useState([])

  // Modais
  const [modalNovaAberto, setModalNovaAberto] = useState(false)
  const [modalCompararAberto, setModalCompararAberto] = useState(false)
  const [modalAprovarAberto, setModalAprovarAberto] = useState(false)
  const [modalHistoricoAberto, setModalHistoricoAberto] = useState(false)
  const [cotacaoSelecionada, setCotacaoSelecionada] = useState(null)

  // Tab ativa no formulário de cotação
  const [formTab, setFormTab] = useState('dados') // 'dados', 'itens', 'fornecedores', 'criterios'

  // Estado do Formulário de Cotação
  const [form, setForm] = useState({
    numero: '',
    condominio: user?.condominio || '',
    titulo: '',
    categoria: 'Manutenção',
    tipo: 'Serviço', // 'Produto', 'Serviço', 'Produto + Serviço'
    descricao: '',
    prazoDesejado: '',
    orcamentoDisponivel: '',
    responsavel: user?.nome || 'Administrador',
    status: 'Rascunho',
    observacoes: '',
    itens: [
      { id: '1', codigo: '001', descricao: '', unidade: 'Unid', quantidade: 1, valorEstimado: 0, observacao: '' }
    ],
    fornecedores: [],
    pesosCriterios: {
      preco: 50,
      prazo: 20,
      garantia: 15,
      pagamento: 10,
      historico: 5
    },
    // Decisão / Calculadora
    fornecedorEscolhidoId: null,
    motivoEscolha: 'Menor preço',
    justificativaEscolha: '',
    calcTipo: 'Acrescimo', // 'Acrescimo', 'Margem', 'Desconto'
    calcPercentual: 0,
    valorFinalAprovado: 0,
    historico: []
  })

  // Gerar número de cotação automático
  const gerarNumeroCotacao = () => {
    const ano = new Date().getFullYear()
    const seq = String(cotacoes.length + 1).padStart(5, '0')
    return `COT-${ano}-${seq}`
  }

  // Abrir modal para nova cotação
  const handleNovaCotacao = () => {
    setForm({
      numero: gerarNumeroCotacao(),
      condominio: user?.condominio || (condominios[0]?.nome || 'Residencial Alpha'),
      titulo: '',
      categoria: 'Manutenção',
      tipo: 'Serviço',
      descricao: '',
      prazoDesejado: '',
      orcamentoDisponivel: '',
      responsavel: user?.nome || 'Administrador',
      status: 'Rascunho',
      observacoes: '',
      itens: [
        { id: '1', codigo: '001', descricao: '', unidade: 'Serviço', quantidade: 1, valorEstimado: 0, observacao: '' }
      ],
      fornecedores: [],
      pesosCriterios: { preco: 50, prazo: 20, garantia: 15, pagamento: 10, historico: 5 },
      fornecedorEscolhidoId: null,
      motivoEscolha: 'Menor preço',
      justificativaEscolha: '',
      calcTipo: 'Acrescimo',
      calcPercentual: 0,
      valorFinalAprovado: 0,
      historico: [
        { data: new Date().toISOString(), usuario: user?.nome || 'Administrador', acao: 'Cotação iniciada como Rascunho' }
      ]
    })
    setCotacaoSelecionada(null)
    setFormTab('dados')
    setModalNovaAberto(true)
  }

  // Abrir cotação para edição
  const handleEditarCotacao = (cot) => {
    setForm({
      ...cot,
      itens: cot.itens || [],
      fornecedores: cot.fornecedores || [],
      pesosCriterios: cot.pesosCriterios || { preco: 50, prazo: 20, garantia: 15, pagamento: 10, historico: 5 },
      historico: cot.historico || []
    })
    setCotacaoSelecionada(cot)
    setFormTab('dados')
    setModalNovaAberto(true)
  }

  // Salvar cotação (criação ou edição)
  const handleSalvarCotacao = async () => {
    if (!form.condominio || !form.titulo) {
      alert('Por favor, informe o Condomínio e o Título/Objeto da cotação.')
      return
    }

    const valorEstimadoTotal = form.itens.reduce((acc, it) => acc + ((parseFloat(it.quantidade) || 0) * (parseFloat(it.valorEstimado) || 0)), 0)

    const payload = {
      ...form,
      valorEstimadoTotal,
      updatedAt: new Date().toISOString()
    }

    try {
      if (cotacaoSelecionada?.id) {
        const hist = [
          ...(form.historico || []),
          { data: new Date().toISOString(), usuario: user?.nome || 'Administrador', acao: 'Cotação atualizada' }
        ]
        await updateCotacao(cotacaoSelecionada.id, { ...payload, historico: hist })
      } else {
        await addCotacao({
          ...payload,
          createdAt: new Date().toISOString()
        })
      }
      setModalNovaAberto(false)
    } catch (err) {
      console.error(err)
      alert('Erro ao salvar cotação.')
    }
  }

  // Métricas do Painel (calculadas com base nas cotações visíveis pelo perfil do usuário)
  const cotacoesPermitidas = useMemo(() => {
    return cotacoes.filter(c => {
      if (!isAdm) {
        if (!meuCondo) return false
        const cCondo = (c.condominio || '').trim().toLowerCase()
        if (!cCondo || (cCondo !== meuCondo && !cCondo.includes(meuCondo) && !meuCondo.includes(cCondo))) return false
      }
      return true
    })
  }, [cotacoes, isAdm, meuCondo])

  const metricas = useMemo(() => {
    const total = cotacoesPermitidas.length
    const emAndamento = cotacoesPermitidas.filter(c => ['Solicitada', 'Aguardando propostas', 'Em análise'].includes(c.status)).length
    const aguardandoAprovacao = cotacoesPermitidas.filter(c => c.status === 'Aguardando aprovação').length
    const aprovadas = cotacoesPermitidas.filter(c => ['Aprovada', 'Contratada', 'Concluída'].includes(c.status)).length

    // Economia gerada (diferença entre 2º menor e o menor escolhido nas aprovadas)
    let economiaTotal = 0
    let valorCotadoTotal = 0
    let totalFornecedoresCount = 0

    cotacoesPermitidas.forEach(c => {
      if (c.fornecedores && c.fornecedores.length > 0) {
        totalFornecedoresCount += c.fornecedores.length
        const valores = c.fornecedores.map(f => parseFloat(f.valorTotal) || 0).filter(v => v > 0).sort((a, b) => a - b)
        if (valores.length > 0) valorCotadoTotal += valores[0]

        if (['Aprovada', 'Contratada', 'Concluída'].includes(c.status) && valores.length >= 2) {
          const menor = valores[0]
          const segundo = valores[1]
          if (segundo > menor) economiaTotal += (segundo - menor)
        }
      }
    })

    return { total, emAndamento, aguardandoAprovacao, aprovadas, economiaTotal, valorCotadoTotal, totalFornecedoresCount }
  }, [cotacoesPermitidas])

  // Filtragem da tabela
  const cotacoesFiltradas = useMemo(() => {
    return cotacoesPermitidas.filter(c => {
      const matchBusca = (c.numero || '').toLowerCase().includes(busca.toLowerCase()) ||
                          (c.titulo || '').toLowerCase().includes(busca.toLowerCase()) ||
                          (c.descricao || '').toLowerCase().includes(busca.toLowerCase()) ||
                          (c.responsavel || '').toLowerCase().includes(busca.toLowerCase())
      const matchCondo = filtroCondominio === 'Todos' || c.condominio === filtroCondominio
      const matchStatus = filtroStatus === 'Todos' || c.status === filtroStatus
      const matchCategoria = filtroCategoria === 'Todos' || c.categoria === filtroCategoria
      return matchBusca && matchCondo && matchStatus && matchCategoria
    })
  }, [cotacoesPermitidas, busca, filtroCondominio, filtroStatus, filtroCategoria])

  // Helpers de cálculo para o comparativo
  const calcularComparativo = (cot) => {
    const fornecedores = cot?.fornecedores || []
    if (fornecedores.length === 0) return null

    // Ordenar por valor
    const comValor = fornecedores
      .map(f => ({ ...f, vTotal: parseFloat(f.valorTotal) || 0 }))
      .filter(f => f.vTotal > 0)
      .sort((a, b) => a.vTotal - b.vTotal)

    const menorOrcamento = comValor[0] || null
    const maiorOrcamento = comValor[comValor.length - 1] || null
    const segundoMenor = comValor[1] || null
    const diferencaMaiorMenor = (maiorOrcamento && menorOrcamento) ? (maiorOrcamento.vTotal - menorOrcamento.vTotal) : 0
    const economiaPotencial = (segundoMenor && menorOrcamento) ? (segundoMenor.vTotal - menorOrcamento.vTotal) : 0
    const percentualEconomia = (segundoMenor && segundoMenor.vTotal > 0 && economiaPotencial > 0)
      ? ((economiaPotencial / segundoMenor.vTotal) * 100).toFixed(2)
      : 0

    // Cálculo das Notas Ponderadas
    const pesos = cot.pesosCriterios || { preco: 50, prazo: 20, garantia: 15, pagamento: 10, historico: 5 }
    const somaPesos = (pesos.preco || 0) + (pesos.prazo || 0) + (pesos.garantia || 0) + (pesos.pagamento || 0) + (pesos.historico || 0) || 100

    const fornecedoresComNota = fornecedores.map(f => {
      const nPreco = parseFloat(f.notaPreco) || (menorOrcamento && f.vTotal > 0 ? Math.max(0, 10 - ((f.vTotal - menorOrcamento.vTotal) / menorOrcamento.vTotal * 10)) : 5)
      const nPrazo = parseFloat(f.notaPrazo) || 5
      const nGarantia = parseFloat(f.notaGarantia) || 5
      const nPagto = parseFloat(f.notaPagamento) || 5
      const nHist = parseFloat(f.notaHistorico) || 5

      const notaFinal = ((nPreco * pesos.preco) + (nPrazo * pesos.prazo) + (nGarantia * pesos.garantia) + (nPagto * pesos.pagamento) + (nHist * pesos.historico)) / somaPesos
      return {
        ...f,
        notaCalculada: Math.round(notaFinal * 10) / 10
      }
    })

    const melhorCustoBeneficio = [...fornecedoresComNota].sort((a, b) => b.notaCalculada - a.notaCalculada)[0] || null

    return {
      menorOrcamento,
      maiorOrcamento,
      segundoMenor,
      diferencaMaiorMenor,
      economiaPotencial,
      percentualEconomia,
      fornecedoresComNota,
      melhorCustoBeneficio
    }
  }

  // Calculadora Financeira (Acréscimo, Margem, Desconto)
  const calcularValorFinal = (valorBase, tipo, pct) => {
    const vBase = parseFloat(valorBase) || 0
    const p = parseFloat(pct) || 0
    if (vBase <= 0) return 0

    if (tipo === 'Margem') {
      // Preço final = Valor base ÷ (1 - margem)
      if (p >= 100) return vBase
      return vBase / (1 - (p / 100))
    } else if (tipo === 'Desconto') {
      return vBase * (1 - (p / 100))
    } else {
      // Acréscimo
      return vBase * (1 + (p / 100))
    }
  }

  // Exportar Comparativo em PDF Profissional
  const exportarComparativoPDF = (cot) => {
    const comp = calcularComparativo(cot)
    if (!comp) {
      alert('Esta cotação não possui fornecedores para gerar comparativo.')
      return
    }

    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.width

    // Topo Oficial Alpha
    doc.setFillColor(26, 43, 78)
    doc.rect(0, 0, pageWidth, 28, 'F')
    doc.setFontSize(18)
    doc.setTextColor(255, 255, 255)
    doc.text('ALPHA SOLUÇÕES CONDOMINIAIS', pageWidth / 2, 12, { align: 'center' })
    doc.setFontSize(11)
    doc.setTextColor(200, 220, 255)
    doc.text(`Mapa Comparativo de Cotação & Decisão de Compra — ${cot.numero}`, pageWidth / 2, 20, { align: 'center' })

    let startY = 36

    // Dados da Cotação
    doc.setFontSize(10)
    doc.setTextColor(50)
    doc.text(`Condomínio: ${cot.condominio} | Objeto: ${cot.titulo} | Categoria: ${cot.categoria}`, 14, startY)
    doc.text(`Responsável: ${cot.responsavel} | Data: ${cot.dataCriacao || format(new Date(), 'dd/MM/yyyy')} | Status: ${cot.status}`, 14, startY + 6)
    startY += 14

    // Tabela Comparativa de Fornecedores
    doc.setFontSize(13)
    doc.setTextColor(26, 43, 78)
    doc.text('1. Quadro Comparativo de Propostas', 14, startY)

    const tableHeaders = ['Critério / Fornecedor', ...comp.fornecedoresComNota.map(f => f.nome)]
    const rows = [
      ['Valor Total da Proposta', ...comp.fornecedoresComNota.map(f => `R$ ${(parseFloat(f.valorTotal) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }`)],
      ['Prazo de Entrega/Execução', ...comp.fornecedoresComNota.map(f => f.prazo || '-')],
      ['Garantia Oferecida', ...comp.fornecedoresComNota.map(f => f.garantia ? `${f.garantia} meses` : '-')],
      ['Condição de Pagamento', ...comp.fornecedoresComNota.map(f => f.condicaoPagamento || '-')],
      ['Pontuação Ponderada (0-100)', ...comp.fornecedoresComNota.map(f => `${f.notaCalculada} pts`)],
    ]

    autoTable(doc, {
      startY: startY + 4,
      head: [tableHeaders],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [26, 43, 78], halign: 'center' },
      styles: { fontSize: 9, halign: 'center' },
      columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } }
    })

    startY = doc.lastAutoTable.finalY + 12

    // Destaques e Inteligência
    doc.setFontSize(13)
    doc.setTextColor(26, 43, 78)
    doc.text('2. Análise Técnica & Inteligência de Compra', 14, startY)

    const menorNome = comp.menorOrcamento?.nome || 'N/A'
    const menorVal = comp.menorOrcamento ? `R$ ${comp.menorOrcamento.vTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'N/A'
    const melhorNome = comp.melhorCustoBeneficio?.nome || 'N/A'
    const economiaTxt = comp.economiaPotencial > 0 ? `R$ ${comp.economiaPotencial.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${comp.percentualEconomia}%)` : 'R$ 0,00'

    autoTable(doc, {
      startY: startY + 4,
      head: [['🏆 Menor Preço', '⭐ Melhor Custo-Benefício', '💰 Economia Potencial']],
      body: [[
        `${menorNome}\n${menorVal}`,
        `${melhorNome}\nNota: ${comp.melhorCustoBeneficio?.notaCalculada || 0} pts`,
        `${economiaTxt}\n(ref. à 2ª menor proposta)`
      ]],
      theme: 'grid',
      headStyles: { fillColor: [16, 110, 80], halign: 'center' },
      bodyStyles: { halign: 'center', fontStyle: 'bold', fontSize: 10 }
    })

    startY = doc.lastAutoTable.finalY + 12

    // Decisão e Justificativa
    if (cot.fornecedorEscolhidoId) {
      const vencedor = cot.fornecedores.find(f => f.id === cot.fornecedorEscolhidoId || f.nome === cot.fornecedorEscolhidoId)
      doc.setFontSize(13)
      doc.setTextColor(26, 43, 78)
      doc.text('3. Decisão da Escolha & Justificativa', 14, startY)

      doc.setFontSize(10)
      doc.setTextColor(40)
      doc.text(`Fornecedor Escolhido: ${vencedor?.nome || 'Não definido'}`, 14, startY + 6)
      doc.text(`Motivo da Escolha: ${cot.motivoEscolha || '-'}`, 14, startY + 12)
      doc.text(`Valor Aprovado / Final: R$ ${(parseFloat(cot.valorFinalAprovado) || parseFloat(vencedor?.valorTotal) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 14, startY + 18)
      doc.text(`Justificativa: ${cot.justificativaEscolha || 'Conforme análise técnica e orçamentos apresentados.'}`, 14, startY + 24, { maxWidth: pageWidth - 28 })
      startY += 40
    }

    // Assinaturas
    if (startY > 230) { doc.addPage(); startY = 30; }
    doc.setFontSize(9)
    doc.setTextColor(100)
    doc.text('____________________________________', 30, startY + 20)
    doc.text('Responsável pela Cotação', 40, startY + 26)

    doc.text('____________________________________', pageWidth - 100, startY + 20)
    doc.text('Síndico / Conselho Fiscal', pageWidth - 90, startY + 26)

    doc.save(`Comparativo_${cot.numero}.pdf`)
  }

  // Selecionar / desselecionar orçamento individual
  const toggleSelecionar = (id) => {
    setSelecionados(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  // Selecionar / desselecionar todos os orçamentos filtrados
  const toggleSelecionarTodos = () => {
    const idsVisiveis = cotacoesFiltradas.map(c => c.id)
    const todosSelecionados = idsVisiveis.length > 0 && idsVisiveis.every(id => selecionados.includes(id))
    if (todosSelecionados) {
      setSelecionados(prev => prev.filter(id => !idsVisiveis.includes(id)))
    } else {
      setSelecionados(prev => Array.from(new Set([...prev, ...idsVisiveis])))
    }
  }

  // Exportar relatório em PDF APENAS dos orçamentos selecionados
  const exportarSelecionadosPDF = () => {
    const itensParaExportar = cotacoes.filter(c => selecionados.includes(c.id))
    if (itensParaExportar.length === 0) {
      alert('Selecione ao menos um orçamento para exportar.')
      return
    }

    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.width

    // Topo Oficial Alpha
    doc.setFillColor(26, 43, 78)
    doc.rect(0, 0, pageWidth, 28, 'F')
    doc.setFontSize(16)
    doc.setTextColor(255, 255, 255)
    doc.text('ALPHA SOLUÇÕES CONDOMINIAIS', pageWidth / 2, 12, { align: 'center' })
    doc.setFontSize(10)
    doc.setTextColor(200, 220, 255)
    doc.text(`Relatório de Orçamentos Selecionados (${itensParaExportar.length} itens)`, pageWidth / 2, 20, { align: 'center' })

    let startY = 36
    doc.setFontSize(9)
    doc.setTextColor(80)
    doc.text(`Emitido em: ${format(new Date(), 'dd/MM/yyyy HH:mm')} | Responsável: ${user?.nome || 'Administrador'}`, 14, startY)

    const tableHeaders = ['Cotação', 'Condomínio', 'Objeto / Serviço', 'Status', 'Menor Proposta', 'Responsável']
    const rows = itensParaExportar.map(cot => {
      const comp = calcularComparativo(cot)
      const menorVal = comp?.menorOrcamento?.vTotal || cot.valorEstimadoTotal || 0
      const menorValStr = menorVal > 0 ? `R$ ${menorVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'
      return [
        cot.numero || 'COT-0000',
        cot.condominio || 'Geral',
        cot.titulo || '-',
        cot.status || 'Rascunho',
        menorValStr,
        cot.responsavel || '-'
      ]
    })

    autoTable(doc, {
      startY: startY + 4,
      head: [tableHeaders],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [26, 43, 78], halign: 'center', fontSize: 9 },
      styles: { fontSize: 8, halign: 'left' },
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'center', cellWidth: 28 },
        3: { halign: 'center', cellWidth: 28 },
        4: { halign: 'right', fontStyle: 'bold', cellWidth: 32 },
      }
    })

    const finalY = doc.lastAutoTable.finalY + 12
    if (finalY > 260) doc.addPage()

    doc.setFontSize(8)
    doc.setTextColor(120)
    doc.text(`Documento gerado automaticamente pelo Sistema de Gestão Alpha Soluções.`, 14, (finalY > 260 ? 30 : finalY))

    doc.save(`Relatorio_Orcamentos_Selecionados_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`)
  }

  // Integração: Lançar no Financeiro
  const handleLancarFinanceiro = async (cot) => {
    const vencedor = cot.fornecedores?.find(f => f.id === cot.fornecedorEscolhidoId || f.nome === cot.fornecedorEscolhidoId) || cot.fornecedores?.[0]
    const valor = parseFloat(cot.valorFinalAprovado) || parseFloat(vencedor?.valorTotal) || 0

    if (valor <= 0) {
      alert('Não há valor válido aprovado para lançar no financeiro.')
      return
    }

    if (!window.confirm(`Deseja lançar esta despesa de R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} no Financeiro para o condomínio ${cot.condominio}?`)) {
      return
    }

    try {
      await addFinanceiro({
        tipo: 'Despesa',
        categoria: cot.categoria || 'Manutenção',
        descricao: `[${cot.numero}] ${cot.titulo} - ${vencedor?.nome || 'Fornecedor'}`,
        valor: valor,
        data: format(new Date(), 'yyyy-MM-dd'),
        status: 'Pendente',
        condominio: cot.condominio,
        cotacaoNumero: cot.numero,
        cotacaoId: cot.id,
        createdAt: new Date().toISOString()
      })

      // Atualiza histórico e status da cotação
      const hist = [
        ...(cot.historico || []),
        { data: new Date().toISOString(), usuario: user?.nome || 'Administrador', acao: `Lançado no Financeiro (R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})` }
      ]
      await updateCotacao(cot.id, { status: 'Contratada', historico: hist })
      alert('Despesa lançada com sucesso no módulo Financeiro!')
    } catch (err) {
      console.error(err)
      alert('Erro ao lançar no Financeiro.')
    }
  }

  // Integração: Gerar Ordem de Serviço / Tarefa
  const handleGerarOrdemServico = async (cot) => {
    const vencedor = cot.fornecedores?.find(f => f.id === cot.fornecedorEscolhidoId || f.nome === cot.fornecedorEscolhidoId) || cot.fornecedores?.[0]

    try {
      await addTarefa({
        titulo: `[OS ${cot.numero}] ${cot.titulo}`,
        descricao: `Serviço/Produto referente à cotação ${cot.numero}.\nFornecedor: ${vencedor?.nome || 'A definir'}\nValor: R$ ${(parseFloat(cot.valorFinalAprovado) || parseFloat(vencedor?.valorTotal) || 0).toLocaleString('pt-BR')}\nPrazo: ${cot.prazoDesejado || 'A combinar'}`,
        condominio: cot.condominio,
        status: 'Pendente',
        prioridade: 'Média',
        responsavel: vencedor?.nome || cot.responsavel,
        cotacaoNumero: cot.numero,
        prazo: cot.prazoDesejado || '',
        createdAt: new Date().toISOString()
      })

      const hist = [
        ...(cot.historico || []),
        { data: new Date().toISOString(), usuario: user?.nome || 'Administrador', acao: 'Ordem de Serviço / Tarefa gerada' }
      ]
      await updateCotacao(cot.id, { historico: hist })
      alert('Ordem de Serviço gerada com sucesso no módulo de Tarefas & Agenda!')
    } catch (err) {
      console.error(err)
      alert('Erro ao gerar Ordem de Serviço.')
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-7xl mx-auto pb-12">
      {/* Topo / Header da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center border border-brand-200">
              <FileSpreadsheet className="text-brand-700" size={24} />
            </div>
            <div>
              <h2 className="section-title text-2xl font-black bg-gradient-to-r from-brand-700 to-brand-500 bg-clip-text text-transparent">
                Cotações & Comparativos
              </h2>
              <p className="text-gray-600 font-medium text-xs md:text-sm">
                Compare propostas, analise custos e tome decisões de compra com mais segurança e transparência.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleNovaCotacao}
            className="btn-primary flex items-center gap-2 px-4 py-2.5 shadow-md"
          >
            <Plus size={18} />
            <span>Nova Cotação</span>
          </button>
        </div>
      </div>

      {/* Cards Indicadores / Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="stat-card border-l-4 border-l-blue-500">
          <p className="text-xs font-semibold text-gray-500">Em Andamento</p>
          <p className="text-xl font-black text-gray-800">{metricas.emAndamento}</p>
          <p className="text-[10px] text-gray-400">Aguardando propostas</p>
        </div>

        <div className="stat-card border-l-4 border-l-purple-500">
          <p className="text-xs font-semibold text-gray-500">Aguard. Decisão</p>
          <p className="text-xl font-black text-purple-700">{metricas.aguardandoAprovacao}</p>
          <p className="text-[10px] text-gray-400">Para aprovação</p>
        </div>

        <div className="stat-card border-l-4 border-l-emerald-500">
          <p className="text-xs font-semibold text-gray-500">Aprovadas</p>
          <p className="text-xl font-black text-emerald-600">{metricas.aprovadas}</p>
          <p className="text-[10px] text-gray-400">Prontas p/ contratação</p>
        </div>

        <div className="stat-card border-l-4 border-l-amber-500">
          <p className="text-xs font-semibold text-gray-500">Economia Gerada</p>
          <p className="text-lg font-black text-amber-700">
            R$ {metricas.economiaTotal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
          </p>
          <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
            <TrendingDown size={12} /> Menor vs 2º menor
          </p>
        </div>

        <div className="stat-card border-l-4 border-l-indigo-500">
          <p className="text-xs font-semibold text-gray-500">Valor Cotado</p>
          <p className="text-lg font-black text-indigo-900">
            R$ {metricas.valorCotadoTotal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
          </p>
          <p className="text-[10px] text-gray-400">Volume total em pauta</p>
        </div>

        <div className="stat-card border-l-4 border-l-teal-500">
          <p className="text-xs font-semibold text-gray-500">Fornecedores</p>
          <p className="text-xl font-black text-teal-700">{metricas.totalFornecedoresCount}</p>
          <p className="text-[10px] text-gray-400">Propostas recebidas</p>
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="card p-4 border border-pale-300 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            className="input pl-9 text-xs"
            placeholder="Buscar por número, título, responsável..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto items-center">
          {isAdm && (
            <select
              className="input text-xs py-1.5 w-full md:w-auto"
              value={filtroCondominio}
              onChange={e => setFiltroCondominio(e.target.value)}
            >
              <option value="Todos">Todos os Condomínios</option>
              {condominios.map(c => (
                <option key={c.id || c.nome} value={c.nome}>{c.nome}</option>
              ))}
            </select>
          )}

          <select
            className="input text-xs py-1.5 w-full md:w-auto"
            value={filtroStatus}
            onChange={e => setFiltroStatus(e.target.value)}
          >
            <option value="Todos">Todos os Status</option>
            {STATUS_LIST.map(st => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>

          <select
            className="input text-xs py-1.5 w-full md:w-auto"
            value={filtroCategoria}
            onChange={e => setFiltroCategoria(e.target.value)}
          >
            <option value="Todos">Todas as Categorias</option>
            {CATEGORIAS.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {(busca || filtroCondominio !== 'Todos' || filtroStatus !== 'Todos' || filtroCategoria !== 'Todos') && (
            <button
              onClick={() => { setBusca(''); setFiltroCondominio('Todos'); setFiltroStatus('Todos'); setFiltroCategoria('Todos') }}
              className="text-xs font-bold text-rose-600 hover:text-rose-800 px-2 py-1.5"
            >
              Limpar
            </button>
          )}

          <button
            onClick={exportarSelecionadosPDF}
            disabled={selecionados.length === 0}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl transition-all shadow-sm ${
              selecionados.length > 0
                ? 'bg-brand-700 text-white hover:bg-brand-800 cursor-pointer'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
            }`}
            title="Exportar apenas os orçamentos selecionados via checkbox"
          >
            <Download size={14} />
            <span>Exportar Selecionados ({selecionados.length})</span>
          </button>
        </div>
      </div>

      {/* Tabela de Cotações */}
      <div className="card overflow-hidden p-0 border border-pale-300 shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#2d3045] text-white border-b border-gray-200">
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                    checked={cotacoesFiltradas.length > 0 && cotacoesFiltradas.every(c => selecionados.includes(c.id))}
                    onChange={toggleSelecionarTodos}
                    title="Selecionar todos"
                  />
                </th>
                <th className="py-3 px-4 font-bold">Cotação</th>
                <th className="py-3 px-4 font-bold">Condomínio</th>
                <th className="py-3 px-4 font-bold">Objeto / Serviço</th>
                <th className="py-3 px-4 font-bold text-center">Fornecedores</th>
                <th className="py-3 px-4 font-bold text-right">Menor Proposta</th>
                <th className="py-3 px-4 font-bold text-center">Status</th>
                <th className="py-3 px-4 font-bold">Responsável</th>
                <th className="py-3 px-4 font-bold text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {cotacoesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-400 font-medium">
                    Nenhuma cotação encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                cotacoesFiltradas.map(cot => {
                  const comp = calcularComparativo(cot)
                  const menorVal = comp?.menorOrcamento?.vTotal || cot.valorEstimadoTotal || 0
                  const isChecked = selecionados.includes(cot.id)

                  return (
                    <tr key={cot.id} className={`hover:bg-slate-50 transition-colors ${isChecked ? 'bg-blue-50/40' : ''}`}>
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                          checked={isChecked}
                          onChange={() => toggleSelecionar(cot.id)}
                        />
                      </td>
                      <td className="py-3 px-4 font-black text-brand-700 whitespace-nowrap">
                        {cot.numero || 'COT-2026-0000'}
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-800">
                        {cot.condominio}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-bold text-gray-900 line-clamp-1">{cot.titulo}</p>
                        <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded font-semibold">
                          {cot.categoria}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
                          {cot.fornecedores?.length || 0}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-gray-900">
                        {menorVal > 0 ? `R$ ${menorVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] border ${STATUS_COLORS[cot.status] || 'bg-gray-100 text-gray-700'}`}>
                          {cot.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                        {cot.responsavel}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => { setCotacaoSelecionada(cot); setModalCompararAberto(true) }}
                            title="Comparar Orçamentos & Decisão"
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <Calculator size={15} />
                          </button>

                          <button
                            onClick={() => handleEditarCotacao(cot)}
                            title="Editar Cotação"
                            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <Edit3 size={15} />
                          </button>

                          <button
                            onClick={() => exportarComparativoPDF(cot)}
                            title="Baixar Comparativo PDF"
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          >
                            <Download size={15} />
                          </button>

                          {cot.status === 'Aprovada' && (
                            <button
                              onClick={() => handleLancarFinanceiro(cot)}
                              title="Lançar no Financeiro"
                              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            >
                              <DollarSign size={15} />
                            </button>
                          )}

                          <button
                            onClick={() => {
                              if (window.confirm('Excluir esta cotação?')) removeCotacao(cot.id)
                            }}
                            title="Excluir"
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: CRIAÇÃO / EDIÇÃO DE COTAÇÃO                                     */}
      {/* ========================================================================= */}
      {modalNovaAberto && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-scale-in">
            {/* Cabeçalho do Modal */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-slate-50 rounded-t-2xl">
              <div>
                <span className="text-xs font-bold text-brand-600 uppercase tracking-wider">{form.numero}</span>
                <h3 className="font-bold text-lg text-gray-900">
                  {cotacaoSelecionada ? 'Editar Cotação' : 'Nova Cotação de Compra / Serviço'}
                </h3>
              </div>
              <button
                onClick={() => setModalNovaAberto(false)}
                className="p-2 text-gray-400 hover:text-gray-700 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Abas de Navegação */}
            <div className="flex border-b border-gray-200 px-4 bg-gray-50 text-xs font-bold gap-2">
              <button
                onClick={() => setFormTab('dados')}
                className={`py-3 px-3 border-b-2 transition-all ${formTab === 'dados' ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
              >
                1. Dados Gerais
              </button>
              <button
                onClick={() => setFormTab('itens')}
                className={`py-3 px-3 border-b-2 transition-all ${formTab === 'itens' ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
              >
                2. Itens & Quantidades ({form.itens.length})
              </button>
              <button
                onClick={() => setFormTab('fornecedores')}
                className={`py-3 px-3 border-b-2 transition-all ${formTab === 'fornecedores' ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
              >
                3. Fornecedores & Propostas ({form.fornecedores.length})
              </button>
              <button
                onClick={() => setFormTab('criterios')}
                className={`py-3 px-3 border-b-2 transition-all ${formTab === 'criterios' ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
              >
                4. Critérios & Pesos
              </button>
            </div>

            {/* Corpo do Formulário */}
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
              {/* TAB 1: DADOS GERAIS */}
              {formTab === 'dados' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="label font-bold text-gray-700">Condomínio *</label>
                    <select
                      className="input font-medium"
                      value={form.condominio}
                      onChange={e => setForm({ ...form, condominio: e.target.value })}
                    >
                      {condominios.map(c => (
                        <option key={c.id || c.nome} value={c.nome}>{c.nome}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label font-bold text-gray-700">Título / Objeto da Cotação *</label>
                    <input
                      type="text"
                      className="input font-medium"
                      placeholder="Ex: Pintura das áreas comuns, Troca de bomba d'água..."
                      value={form.titulo}
                      onChange={e => setForm({ ...form, titulo: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="label font-bold text-gray-700">Categoria</label>
                    <select
                      className="input font-medium"
                      value={form.categoria}
                      onChange={e => setForm({ ...form, categoria: e.target.value })}
                    >
                      {CATEGORIAS.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label font-bold text-gray-700">Tipo de Contratação</label>
                    <select
                      className="input font-medium"
                      value={form.tipo}
                      onChange={e => setForm({ ...form, tipo: e.target.value })}
                    >
                      <option value="Produto">Produto / Material</option>
                      <option value="Serviço">Serviço / Mão de Obra</option>
                      <option value="Produto + Serviço">Produto + Serviço (Completo)</option>
                    </select>
                  </div>

                  <div>
                    <label className="label font-bold text-gray-700">Prazo Desejado de Conclusão</label>
                    <input
                      type="text"
                      className="input font-medium"
                      placeholder="Ex: 30 dias, Até 15/10/2026..."
                      value={form.prazoDesejado}
                      onChange={e => setForm({ ...form, prazoDesejado: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="label font-bold text-gray-700">Orçamento Disponível Estimado (R$)</label>
                    <input
                      type="number"
                      className="input font-medium"
                      placeholder="Ex: 15000"
                      value={form.orcamentoDisponivel}
                      onChange={e => setForm({ ...form, orcamentoDisponivel: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="label font-bold text-gray-700">Status do Processo</label>
                    <select
                      className="input font-medium"
                      value={form.status}
                      onChange={e => setForm({ ...form, status: e.target.value })}
                    >
                      {STATUS_LIST.map(st => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label font-bold text-gray-700">Responsável</label>
                    <input
                      type="text"
                      className="input font-medium"
                      value={form.responsavel}
                      onChange={e => setForm({ ...form, responsavel: e.target.value })}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="label font-bold text-gray-700">Descrição Detalhada do Escopo</label>
                    <textarea
                      rows={3}
                      className="input font-medium"
                      placeholder="Detalhes sobre marcas aceitas, locais de aplicação, especificações técnicas..."
                      value={form.descricao}
                      onChange={e => setForm({ ...form, descricao: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: ITENS DA COTAÇÃO */}
              {formTab === 'itens' && (
                <div className="flex flex-col gap-4 text-xs">
                  <div className="flex items-center justify-between">
                    <p className="text-gray-600 font-medium">
                      Especifique os itens que compõem o escopo para cálculo do valor estimado total.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const novo = {
                          id: String(Date.now()),
                          codigo: String(form.itens.length + 1).padStart(3, '0'),
                          descricao: '',
                          unidade: 'Unid',
                          quantidade: 1,
                          valorEstimado: 0,
                          observacao: ''
                        }
                        setForm({ ...form, itens: [...form.itens, novo] })
                      }}
                      className="btn-secondary py-1.5 px-3 flex items-center gap-1 text-xs"
                    >
                      <Plus size={14} /> Adicionar Item
                    </button>
                  </div>

                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-gray-100 text-gray-700 font-bold border-b border-gray-200">
                        <tr>
                          <th className="p-2.5">Código</th>
                          <th className="p-2.5">Item / Descrição</th>
                          <th className="p-2.5">Unidade</th>
                          <th className="p-2.5 text-center">Qtd</th>
                          <th className="p-2.5 text-right">Valor Estimado (R$)</th>
                          <th className="p-2.5 text-right">Total Estimado</th>
                          <th className="p-2.5 text-center">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {form.itens.map((it, idx) => {
                          const subtotal = (parseFloat(it.quantidade) || 0) * (parseFloat(it.valorEstimado) || 0)
                          return (
                            <tr key={it.id || idx}>
                              <td className="p-2">
                                <input
                                  type="text"
                                  className="input py-1 px-2 text-xs w-16"
                                  value={it.codigo}
                                  onChange={e => {
                                    const novo = [...form.itens]
                                    novo[idx].codigo = e.target.value
                                    setForm({ ...form, itens: novo })
                                  }}
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="text"
                                  className="input py-1 px-2 text-xs"
                                  placeholder="Ex: Tinta acrílica fosca 18L"
                                  value={it.descricao}
                                  onChange={e => {
                                    const novo = [...form.itens]
                                    novo[idx].descricao = e.target.value
                                    setForm({ ...form, itens: novo })
                                  }}
                                />
                              </td>
                              <td className="p-2">
                                <select
                                  className="input py-1 px-2 text-xs w-24"
                                  value={it.unidade}
                                  onChange={e => {
                                    const novo = [...form.itens]
                                    novo[idx].unidade = e.target.value
                                    setForm({ ...form, itens: novo })
                                  }}
                                >
                                  <option value="Unid">Unid</option>
                                  <option value="Lata">Lata</option>
                                  <option value="M²">M²</option>
                                  <option value="Serviço">Serviço</option>
                                  <option value="Horas">Horas</option>
                                  <option value="Kg">Kg</option>
                                  <option value="Pct">Pct</option>
                                </select>
                              </td>
                              <td className="p-2 text-center">
                                <input
                                  type="number"
                                  className="input py-1 px-2 text-xs w-16 text-center"
                                  value={it.quantidade}
                                  onChange={e => {
                                    const novo = [...form.itens]
                                    novo[idx].quantidade = e.target.value
                                    setForm({ ...form, itens: novo })
                                  }}
                                />
                              </td>
                              <td className="p-2 text-right">
                                <input
                                  type="number"
                                  className="input py-1 px-2 text-xs w-24 text-right"
                                  value={it.valorEstimado}
                                  onChange={e => {
                                    const novo = [...form.itens]
                                    novo[idx].valorEstimado = e.target.value
                                    setForm({ ...form, itens: novo })
                                  }}
                                />
                              </td>
                              <td className="p-2 text-right font-bold text-gray-800">
                                R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="p-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (form.itens.length > 1) {
                                      setForm({ ...form, itens: form.itens.filter((_, i) => i !== idx) })
                                    }
                                  }}
                                  className="text-rose-500 hover:text-rose-700 p-1"
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot className="bg-gray-50 border-t border-gray-200 font-bold">
                        <tr>
                          <td colSpan={5} className="p-2.5 text-right text-gray-700">Valor Estimado Total:</td>
                          <td className="p-2.5 text-right text-brand-700 font-black">
                            R$ {form.itens.reduce((acc, it) => acc + ((parseFloat(it.quantidade) || 0) * (parseFloat(it.valorEstimado) || 0)), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: FORNECEDORES & PROPOSTAS */}
              {formTab === 'fornecedores' && (
                <div className="flex flex-col gap-4 text-xs">
                  <div className="flex items-center justify-between">
                    <p className="text-gray-600 font-medium">
                      Cadastre as empresas que enviaram propostas e anexe orçamentos.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const novoForn = {
                          id: String(Date.now()),
                          nome: '',
                          cnpj: '',
                          contato: '',
                          telefone: '',
                          email: '',
                          valorTotal: 0,
                          prazo: '30 dias',
                          garantia: 12,
                          condicaoPagamento: '30 dias',
                          validadeProposta: '',
                          anexoNome: '',
                          notaPreco: 8,
                          notaPrazo: 8,
                          notaGarantia: 8,
                          notaPagamento: 8,
                          notaHistorico: 8
                        }
                        setForm({ ...form, fornecedores: [...form.fornecedores, novoForn] })
                      }}
                      className="btn-secondary py-1.5 px-3 flex items-center gap-1 text-xs"
                    >
                      <Plus size={14} /> Adicionar Fornecedor
                    </button>
                  </div>

                  {form.fornecedores.length === 0 ? (
                    <div className="p-8 border border-dashed border-gray-300 rounded-xl text-center text-gray-400">
                      Nenhum fornecedor adicionado. Clique em "+ Adicionar Fornecedor" para cadastrar as propostas recebidas.
                    </div>
                  ) : (
                    form.fornecedores.map((f, fIdx) => (
                      <div key={f.id || fIdx} className="border border-gray-200 rounded-xl p-4 bg-slate-50/50 flex flex-col gap-3">
                        <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                          <span className="font-black text-brand-700 text-sm">Fornecedor #{fIdx + 1}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setForm({ ...form, fornecedores: form.fornecedores.filter((_, i) => i !== fIdx) })
                            }}
                            className="text-rose-500 hover:text-rose-700 font-bold"
                          >
                            Remover Fornecedor
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          <div className="md:col-span-2">
                            <label className="label font-bold text-gray-700">Razão Social / Nome Fantasia *</label>
                            <input
                              type="text"
                              className="input font-medium"
                              placeholder="Ex: Empresa Pinturas Silva Ltda"
                              value={f.nome}
                              onChange={e => {
                                const novo = [...form.fornecedores]
                                novo[fIdx].nome = e.target.value
                                setForm({ ...form, fornecedores: novo })
                              }}
                            />
                          </div>

                          <div>
                            <label className="label font-bold text-gray-700">CNPJ / CPF</label>
                            <input
                              type="text"
                              className="input font-medium"
                              placeholder="00.000.000/0001-00"
                              value={f.cnpj}
                              onChange={e => {
                                const novo = [...form.fornecedores]
                                novo[fIdx].cnpj = e.target.value
                                setForm({ ...form, fornecedores: novo })
                              }}
                            />
                          </div>

                          <div>
                            <label className="label font-bold text-emerald-800">Valor Total Proposto (R$) *</label>
                            <input
                              type="number"
                              className="input font-black text-emerald-800 bg-emerald-50/50 border-emerald-300"
                              placeholder="Ex: 14200"
                              value={f.valorTotal}
                              onChange={e => {
                                const novo = [...form.fornecedores]
                                novo[fIdx].valorTotal = e.target.value
                                setForm({ ...form, fornecedores: novo })
                              }}
                            />
                          </div>

                          <div>
                            <label className="label font-bold text-gray-700">Prazo de Entrega/Execução</label>
                            <input
                              type="text"
                              className="input font-medium"
                              placeholder="Ex: 20 dias úteis"
                              value={f.prazo}
                              onChange={e => {
                                const novo = [...form.fornecedores]
                                novo[fIdx].prazo = e.target.value
                                setForm({ ...form, fornecedores: novo })
                              }}
                            />
                          </div>

                          <div>
                            <label className="label font-bold text-gray-700">Garantia (em meses)</label>
                            <input
                              type="number"
                              className="input font-medium"
                              placeholder="Ex: 12"
                              value={f.garantia}
                              onChange={e => {
                                const novo = [...form.fornecedores]
                                novo[fIdx].garantia = e.target.value
                                setForm({ ...form, fornecedores: novo })
                              }}
                            />
                          </div>

                          <div>
                            <label className="label font-bold text-gray-700">Condições de Pagamento</label>
                            <input
                              type="text"
                              className="input font-medium"
                              placeholder="Ex: 30/60 dias, À vista c/ desc"
                              value={f.condicaoPagamento}
                              onChange={e => {
                                const novo = [...form.fornecedores]
                                novo[fIdx].condicaoPagamento = e.target.value
                                setForm({ ...form, fornecedores: novo })
                              }}
                            />
                          </div>

                          <div>
                            <label className="label font-bold text-gray-700">Contato / Comercial</label>
                            <input
                              type="text"
                              className="input font-medium"
                              placeholder="Nome do vendedor / Fone"
                              value={f.contato}
                              onChange={e => {
                                const novo = [...form.fornecedores]
                                novo[fIdx].contato = e.target.value
                                setForm({ ...form, fornecedores: novo })
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 4: CRITÉRIOS & PESOS */}
              {formTab === 'criterios' && (
                <div className="flex flex-col gap-4 text-xs">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
                    <p className="font-bold">🎯 Definição de Pesos para o Melhor Custo-Benefício</p>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      A soma dos pesos deve totalizar 100%. O sistema calculará a nota final de cada fornecedor automaticamente.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div>
                      <label className="label font-bold text-gray-700">Preço (%)</label>
                      <input
                        type="number"
                        className="input font-bold text-center"
                        value={form.pesosCriterios.preco}
                        onChange={e => setForm({ ...form, pesosCriterios: { ...form.pesosCriterios, preco: parseFloat(e.target.value) || 0 } })}
                      />
                    </div>
                    <div>
                      <label className="label font-bold text-gray-700">Prazo (%)</label>
                      <input
                        type="number"
                        className="input font-bold text-center"
                        value={form.pesosCriterios.prazo}
                        onChange={e => setForm({ ...form, pesosCriterios: { ...form.pesosCriterios, prazo: parseFloat(e.target.value) || 0 } })}
                      />
                    </div>
                    <div>
                      <label className="label font-bold text-gray-700">Garantia (%)</label>
                      <input
                        type="number"
                        className="input font-bold text-center"
                        value={form.pesosCriterios.garantia}
                        onChange={e => setForm({ ...form, pesosCriterios: { ...form.pesosCriterios, garantia: parseFloat(e.target.value) || 0 } })}
                      />
                    </div>
                    <div>
                      <label className="label font-bold text-gray-700">Cond. Pagto (%)</label>
                      <input
                        type="number"
                        className="input font-bold text-center"
                        value={form.pesosCriterios.pagamento}
                        onChange={e => setForm({ ...form, pesosCriterios: { ...form.pesosCriterios, pagamento: parseFloat(e.target.value) || 0 } })}
                      />
                    </div>
                    <div>
                      <label className="label font-bold text-gray-700">Histórico/Reputação (%)</label>
                      <input
                        type="number"
                        className="input font-bold text-center"
                        value={form.pesosCriterios.historico}
                        onChange={e => setForm({ ...form, pesosCriterios: { ...form.pesosCriterios, historico: parseFloat(e.target.value) || 0 } })}
                      />
                    </div>
                  </div>

                  {form.fornecedores.length > 0 && (
                    <div className="mt-4 border border-gray-200 rounded-xl overflow-hidden">
                      <p className="p-3 bg-gray-100 font-bold text-gray-800 border-b border-gray-200">
                        Notas Individuais dos Fornecedores (0 a 10)
                      </p>
                      <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold">
                          <tr>
                            <th className="p-2">Fornecedor</th>
                            <th className="p-2 text-center">Preço</th>
                            <th className="p-2 text-center">Prazo</th>
                            <th className="p-2 text-center">Garantia</th>
                            <th className="p-2 text-center">Cond. Pagto</th>
                            <th className="p-2 text-center">Histórico</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {form.fornecedores.map((f, fIdx) => (
                            <tr key={f.id || fIdx}>
                              <td className="p-2 font-bold text-gray-800">{f.nome || `Fornecedor ${fIdx + 1}`}</td>
                              <td className="p-2 text-center">
                                <input
                                  type="number"
                                  min={0}
                                  max={10}
                                  className="input py-1 px-2 w-16 text-center"
                                  value={f.notaPreco || 8}
                                  onChange={e => {
                                    const novo = [...form.fornecedores]
                                    novo[fIdx].notaPreco = e.target.value
                                    setForm({ ...form, fornecedores: novo })
                                  }}
                                />
                              </td>
                              <td className="p-2 text-center">
                                <input
                                  type="number"
                                  min={0}
                                  max={10}
                                  className="input py-1 px-2 w-16 text-center"
                                  value={f.notaPrazo || 8}
                                  onChange={e => {
                                    const novo = [...form.fornecedores]
                                    novo[fIdx].notaPrazo = e.target.value
                                    setForm({ ...form, fornecedores: novo })
                                  }}
                                />
                              </td>
                              <td className="p-2 text-center">
                                <input
                                  type="number"
                                  min={0}
                                  max={10}
                                  className="input py-1 px-2 w-16 text-center"
                                  value={f.notaGarantia || 8}
                                  onChange={e => {
                                    const novo = [...form.fornecedores]
                                    novo[fIdx].notaGarantia = e.target.value
                                    setForm({ ...form, fornecedores: novo })
                                  }}
                                />
                              </td>
                              <td className="p-2 text-center">
                                <input
                                  type="number"
                                  min={0}
                                  max={10}
                                  className="input py-1 px-2 w-16 text-center"
                                  value={f.notaPagamento || 8}
                                  onChange={e => {
                                    const novo = [...form.fornecedores]
                                    novo[fIdx].notaPagamento = e.target.value
                                    setForm({ ...form, fornecedores: novo })
                                  }}
                                />
                              </td>
                              <td className="p-2 text-center">
                                <input
                                  type="number"
                                  min={0}
                                  max={10}
                                  className="input py-1 px-2 w-16 text-center"
                                  value={f.notaHistorico || 8}
                                  onChange={e => {
                                    const novo = [...form.fornecedores]
                                    novo[fIdx].notaHistorico = e.target.value
                                    setForm({ ...form, fornecedores: novo })
                                  }}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Rodapé do Modal */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between rounded-b-2xl">
              <button
                type="button"
                onClick={() => setModalNovaAberto(false)}
                className="btn-secondary"
              >
                Cancelar
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSalvarCotacao}
                  className="btn-primary flex items-center gap-2 px-6"
                >
                  <Check size={16} /> Salvar Cotação
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: COMPARATIVO INTELIGENTE & DECISÃO DE COMPRA                      */}
      {/* ========================================================================= */}
      {modalCompararAberto && cotacaoSelecionada && (() => {
        const comp = calcularComparativo(cotacaoSelecionada)
        if (!comp || comp.fornecedoresComNota.length === 0) {
          return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white p-6 rounded-2xl max-w-md w-full text-center">
                <AlertTriangle size={36} className="text-amber-500 mx-auto mb-3" />
                <h3 className="font-bold text-gray-900 mb-1">Sem propostas suficientes</h3>
                <p className="text-xs text-gray-500 mb-4">Adicione fornecedores e valores na cotação para realizar o comparativo.</p>
                <button onClick={() => setModalCompararAberto(false)} className="btn-primary w-full">Fechar</button>
              </div>
            </div>
          )
        }

        const fornecedorVencedor = cotacaoSelecionada.fornecedores.find(f => f.id === cotacaoSelecionada.fornecedorEscolhidoId || f.nome === cotacaoSelecionada.fornecedorEscolhidoId) || comp.menorOrcamento
        const valorBaseCalc = parseFloat(fornecedorVencedor?.valorTotal) || 0
        const calcValorResult = calcularValorFinal(valorBaseCalc, cotacaoSelecionada.calcTipo || 'Acrescimo', cotacaoSelecionada.calcPercentual || 0)

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl animate-scale-in">
              {/* Topo */}
              <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-[#2d3045] to-[#1e2030] text-white rounded-t-2xl">
                <div>
                  <span className="text-xs font-bold text-amber-300 uppercase">{cotacaoSelecionada.numero}</span>
                  <h3 className="font-bold text-lg">{cotacaoSelecionada.titulo}</h3>
                  <p className="text-xs text-gray-300">{cotacaoSelecionada.condominio} | Categoria: {cotacaoSelecionada.categoria}</p>
                </div>
                <button onClick={() => setModalCompararAberto(false)} className="text-gray-300 hover:text-white p-2">✕</button>
              </div>

              {/* Corpo */}
              <div className="p-6 overflow-y-auto flex-1 custom-scrollbar flex flex-col gap-6 text-xs">
                {/* 1. Destaques da Análise Alpha */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/60 flex flex-col justify-between">
                    <div>
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 mb-1">
                        🏆 MENOR PREÇO
                      </span>
                      <p className="text-base font-black text-emerald-950">{comp.menorOrcamento?.nome || 'N/A'}</p>
                      <p className="text-lg font-black text-emerald-700 mt-1">
                        R$ {comp.menorOrcamento?.vTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    {comp.economiaPotencial > 0 && (
                      <p className="text-[11px] text-emerald-800 font-semibold mt-2 pt-2 border-t border-emerald-200">
                        Economia de R$ {comp.economiaPotencial.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ({comp.percentualEconomia}%) vs 2ª menor
                      </p>
                    )}
                  </div>

                  <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/60 flex flex-col justify-between">
                    <div>
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-800 mb-1">
                        ⭐ MELHOR CUSTO-BENEFÍCIO
                      </span>
                      <p className="text-base font-black text-indigo-950">{comp.melhorCustoBeneficio?.nome || 'N/A'}</p>
                      <p className="text-lg font-black text-indigo-700 mt-1">
                        Nota: {comp.melhorCustoBeneficio?.notaCalculada} / 100 pts
                      </p>
                    </div>
                    <p className="text-[11px] text-indigo-800 font-semibold mt-2 pt-2 border-t border-indigo-200">
                      Maior pontuação ponderada nos critérios estabelecidos
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 flex flex-col justify-between">
                    <div>
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 mb-1">
                        💡 RECOMENDAÇÃO ALPHA
                      </span>
                      <p className="text-xs text-amber-900 leading-relaxed">
                        {comp.menorOrcamento?.nome === comp.melhorCustoBeneficio?.nome ? (
                          `A empresa ${comp.menorOrcamento?.nome} apresentou tanto o menor preço quanto a melhor pontuação global.`
                        ) : (
                          `A empresa ${comp.menorOrcamento?.nome} tem o menor preço, enquanto ${comp.melhorCustoBeneficio?.nome} se destacou em prazo/garantia. Avalie as prioridades do condomínio.`
                        )}
                      </p>
                    </div>
                    <p className="text-[10px] text-amber-700 italic mt-2">
                      * Apoio à decisão técnica do síndico/conselho.
                    </p>
                  </div>
                </div>

                {/* 2. Tabela Comparativa Side-by-Side */}
                <div>
                  <h4 className="font-bold text-sm text-gray-900 mb-2">Mapa Comparativo de Propostas</h4>
                  <div className="border border-gray-200 rounded-xl overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-gray-100 text-gray-700 font-bold border-b border-gray-200">
                        <tr>
                          <th className="p-3">Critério</th>
                          {comp.fornecedoresComNota.map(f => (
                            <th key={f.id} className="p-3 text-center border-l border-gray-200">
                              <span className="block font-black text-gray-900">{f.nome}</span>
                              <span className="text-[10px] font-normal text-gray-500">{f.cnpj || 'CNPJ não inf.'}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        <tr>
                          <td className="p-2.5 font-bold text-gray-700 bg-gray-50">Valor Total Proposto</td>
                          {comp.fornecedoresComNota.map(f => (
                            <td key={f.id} className={`p-2.5 text-center font-black border-l border-gray-100 ${f.id === comp.menorOrcamento?.id ? 'text-emerald-700 bg-emerald-50/40' : 'text-gray-900'}`}>
                              R$ {(parseFloat(f.valorTotal) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-2.5 font-bold text-gray-700 bg-gray-50">Prazo de Execução</td>
                          {comp.fornecedoresComNota.map(f => (
                            <td key={f.id} className="p-2.5 text-center border-l border-gray-100 text-gray-800">
                              {f.prazo || '—'}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-2.5 font-bold text-gray-700 bg-gray-50">Garantia Oferecida</td>
                          {comp.fornecedoresComNota.map(f => (
                            <td key={f.id} className="p-2.5 text-center border-l border-gray-100 text-gray-800">
                              {f.garantia ? `${f.garantia} meses` : '—'}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-2.5 font-bold text-gray-700 bg-gray-50">Condição de Pagamento</td>
                          {comp.fornecedoresComNota.map(f => (
                            <td key={f.id} className="p-2.5 text-center border-l border-gray-100 text-gray-800">
                              {f.condicaoPagamento || '—'}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-2.5 font-bold text-gray-700 bg-gray-50">Pontuação Ponderada</td>
                          {comp.fornecedoresComNota.map(f => (
                            <td key={f.id} className="p-2.5 text-center border-l border-gray-100 font-bold text-brand-700">
                              {f.notaCalculada} / 100
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 3. Calculadora Financeira & Decisão de Compra */}
                <div className="p-4 border border-indigo-200 bg-indigo-50/40 rounded-xl flex flex-col gap-4">
                  <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
                    <Calculator size={18} />
                    <span>Calculadora de Compra & Ajuste Financeiro</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="label font-bold text-gray-700">Fornecedor Selecionado *</label>
                      <select
                        className="input font-bold"
                        value={cotacaoSelecionada.fornecedorEscolhidoId || comp.menorOrcamento?.id || ''}
                        onChange={e => {
                          setCotacaoSelecionada({ ...cotacaoSelecionada, fornecedorEscolhidoId: e.target.value })
                        }}
                      >
                        {comp.fornecedoresComNota.map(f => (
                          <option key={f.id} value={f.id}>{f.nome} (R$ {f.vTotal.toLocaleString('pt-BR')})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="label font-bold text-gray-700">Tipo de Ajuste</label>
                      <select
                        className="input font-medium"
                        value={cotacaoSelecionada.calcTipo || 'Acrescimo'}
                        onChange={e => setCotacaoSelecionada({ ...cotacaoSelecionada, calcTipo: e.target.value })}
                      >
                        <option value="Acrescimo">Acréscimo (+ %)</option>
                        <option value="Margem">Margem de Lucro / BDI (Base ÷ (1-Margem))</option>
                        <option value="Desconto">Desconto Negociado (- %)</option>
                      </select>
                    </div>

                    <div>
                      <label className="label font-bold text-gray-700">Percentual (%)</label>
                      <input
                        type="number"
                        className="input font-bold text-center"
                        value={cotacaoSelecionada.calcPercentual || 0}
                        onChange={e => setCotacaoSelecionada({ ...cotacaoSelecionada, calcPercentual: parseFloat(e.target.value) || 0 })}
                      />
                    </div>

                    <div>
                      <label className="label font-bold text-emerald-800">Valor Final Calculado (R$)</label>
                      <div className="input bg-emerald-50 border-emerald-300 font-black text-emerald-800 text-sm flex items-center justify-end">
                        R$ {calcValorResult.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="label font-bold text-gray-700">Motivo da Escolha *</label>
                      <select
                        className="input font-medium"
                        value={cotacaoSelecionada.motivoEscolha || 'Menor preço'}
                        onChange={e => setCotacaoSelecionada({ ...cotacaoSelecionada, motivoEscolha: e.target.value })}
                      >
                        <option value="Menor preço">Menor preço</option>
                        <option value="Melhor custo-benefício">Melhor custo-benefício</option>
                        <option value="Melhor prazo de entrega">Melhor prazo de entrega</option>
                        <option value="Maior garantia oferecida">Maior garantia oferecida</option>
                        <option value="Fornecedor homologado / Exclusivo">Fornecedor homologado / Exclusivo</option>
                        <option value="Outro">Outro motivo</option>
                      </select>
                    </div>

                    <div>
                      <label className="label font-bold text-gray-700">Justificativa da Decisão *</label>
                      <input
                        type="text"
                        className="input font-medium"
                        placeholder="Ex: Proposta com melhor equilíbrio entre preço e prazo de entrega."
                        value={cotacaoSelecionada.justificativaEscolha || ''}
                        onChange={e => setCotacaoSelecionada({ ...cotacaoSelecionada, justificativaEscolha: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Rodapé do Modal */}
              <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between rounded-b-2xl">
                <button onClick={() => exportarComparativoPDF(cotacaoSelecionada)} className="btn-secondary flex items-center gap-1.5 text-xs">
                  <Download size={15} /> Exportar Comparativo PDF
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      const hist = [
                        ...(cotacaoSelecionada.historico || []),
                        { data: new Date().toISOString(), usuario: user?.nome || 'Administrador', acao: 'Comparativo realizado e enviado para aprovação' }
                      ]
                      await updateCotacao(cotacaoSelecionada.id, {
                        ...cotacaoSelecionada,
                        status: 'Aguardando aprovação',
                        valorFinalAprovado: calcValorResult,
                        historico: hist
                      })
                      setModalCompararAberto(false)
                      alert('Cotação atualizada e enviada para aprovação do Síndico/Conselho!')
                    }}
                    className="btn-primary flex items-center gap-2 px-5"
                  >
                    <CheckCircle2 size={16} /> Salvar Decisão & Enviar p/ Aprovação
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
