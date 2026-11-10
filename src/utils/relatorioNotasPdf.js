import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

// Helper para converter qualquer valor para número
export function parseValorNumerico(v) {
  if (typeof v === 'number') return v
  if (!v) return 0
  const cleanStr = String(v)
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  return parseFloat(cleanStr) || 0
}

export function formatarMoeda(val) {
  const n = parseValorNumerico(val)
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatarDataPtBr(dStr) {
  if (!dStr) return '-'
  try {
    const [ano, mes, dia] = String(dStr).split('T')[0].split('-')
    if (ano && mes && dia) return `${dia}/${mes}/${ano}`
    return String(dStr)
  } catch {
    return String(dStr)
  }
}

/**
 * Filtra a lista de notas/comprovantes de acordo com os critérios
 */
export function filtrarDocumentosNotas(documentos = [], {
  filtroCondominio = 'Todos',
  tipoDocumento = 'todos',
  modoPeriodo = 'todos', // 'todos' | 'mes' | 'custom'
  mesRef = '', // 'YYYY-MM'
  dataInicio = '',
  dataFim = '',
  filtroStatus = 'todos' // 'todos' | 'valida_liquidada' | 'analise'
} = {}) {
  return documentos.filter(doc => {
    // 1. Condomínio
    if (filtroCondominio && filtroCondominio !== 'Todos') {
      const docCondo = (doc.condominio || '').toLowerCase().trim()
      const targetCondo = filtroCondominio.toLowerCase().trim()
      if (docCondo !== targetCondo && !docCondo.includes(targetCondo) && !targetCondo.includes(docCondo)) {
        return false
      }
    }

    // 2. Tipo de Documento
    const tipo = doc.tipo || 'Nota Fiscal'
    if (tipoDocumento !== 'todos') {
      if (tipo !== tipoDocumento) return false
    }

    // 3. Período
    const docData = (doc.data || '').split('T')[0]
    if (modoPeriodo === 'mes' && mesRef) {
      if (!docData.startsWith(mesRef)) return false
    } else if (modoPeriodo === 'custom') {
      if (dataInicio && docData < dataInicio) return false
      if (dataFim && docData > dataFim) return false
    }

    // 4. Status
    const st = (doc.status || '').toLowerCase()
    if (filtroStatus === 'valida_liquidada') {
      if (st !== 'válida' && st !== 'valida' && st !== 'liquidado') return false
    } else if (filtroStatus === 'analise') {
      if (!st.includes('análise') && !st.includes('analise')) return false
    }

    return true
  })
}

/**
 * Exporta os documentos filtrados em formato CSV (com BOM UTF-8 para Excel)
 */
export function exportarPlanilhaNotasCsv(documentos = [], nomeArquivo = 'relatorio_comprovantes.csv') {
  const cabecalho = ['Tipo', 'Numero/ID', 'Prestador/Favorecido', 'CNPJ/CPF', 'Condominio', 'Data', 'Status', 'Valor (R$)', 'Descricao/Servico']
  
  const linhas = documentos.map(d => [
    `"${(d.tipo || 'Nota Fiscal').replace(/"/g, '""')}"`,
    `"${(d.numero || '-').replace(/"/g, '""')}"`,
    `"${(d.prestador || '-').replace(/"/g, '""')}"`,
    `"${(d.cnpj || '-').replace(/"/g, '""')}"`,
    `"${(d.condominio || '-').replace(/"/g, '""')}"`,
    `"${formatarDataPtBr(d.data)}"`,
    `"${(d.status || 'Em análise').replace(/"/g, '""')}"`,
    `"${parseValorNumerico(d.valor).toFixed(2).replace('.', ',')}"`,
    `"${(d.servico || '-').replace(/"/g, '""')}"`
  ])

  const csvContent = '\uFEFF' + [cabecalho.join(';'), ...linhas.map(l => l.join(';'))].join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo.endsWith('.csv') ? nomeArquivo : `${nomeArquivo}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Gera o Relatório Oficial em PDF de Notas Fiscais e Comprovantes
 */
export function gerarRelatorioNotasPDF(documentosFiltrados = [], {
  condominio = 'Todos os Condomínios',
  tipoDocumento = 'todos',
  periodoDescricao = 'Histórico Completo',
  usuarioEmissor = 'Administração Alpha'
} = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  // 1. Métricas e Totalizadores
  let totalGeral = 0
  let totalNotas = 0
  let qtdNotas = 0
  let totalCupons = 0
  let qtdCupons = 0
  let totalRecibos = 0
  let qtdRecibos = 0
  let totalComprovantes = 0
  let qtdComprovantes = 0

  documentosFiltrados.forEach(d => {
    const val = parseValorNumerico(d.valor)
    totalGeral += val
    const t = d.tipo || 'Nota Fiscal'
    if (t === 'Nota Fiscal') {
      totalNotas += val
      qtdNotas++
    } else if (t === 'Cupom Fiscal') {
      totalCupons += val
      qtdCupons++
    } else if (t === 'Recibo') {
      totalRecibos += val
      qtdRecibos++
    } else if (t === 'Comprovante de Pagamento') {
      totalComprovantes += val
      qtdComprovantes++
    }
  })

  // ─── CABEÇALHO EDITORIAL ALPHA (Azul-marinho #233044) ─────────────
  doc.setFillColor(35, 48, 68) // #233044
  doc.rect(0, 0, pageWidth, 28, 'F')

  // Faixa de destaque Verde-sálvia (#6E8B85)
  doc.setFillColor(110, 139, 133)
  doc.rect(0, 28, pageWidth, 2, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(255, 255, 255)
  doc.text('ALPHA SOLUÇÕES CONDOMINIAIS', 14, 12)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(220, 232, 227)
  const subtituloTipo = tipoDocumento === 'todos' 
    ? 'Relatório de Notas Fiscais, Cupons, Recibos & Comprovantes'
    : `Relatório Consolidado de ${tipoDocumento}s`
  doc.text(subtituloTipo, 14, 18)

  doc.setFontSize(8)
  doc.setTextColor(200, 215, 210)
  const agoraFmt = new Date().toLocaleString('pt-BR')
  doc.text(`Emissão: ${agoraFmt} | Emissor: ${usuarioEmissor}`, 14, 24)

  // ─── QUADRO DE METADADOS DO RELATÓRIO ──────────────────────────────
  let curY = 36
  doc.setFillColor(247, 247, 242) // Off-white editorial
  doc.setDrawColor(215, 225, 220)
  doc.roundedRect(14, curY, pageWidth - 28, 18, 2, 2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(35, 48, 68)
  doc.text('Condomínio:', 18, curY + 6)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(70, 80, 95)
  doc.text(String(condominio || 'Todos'), 38, curY + 6)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(35, 48, 68)
  doc.text('Período de Referência:', 18, curY + 12)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(70, 80, 95)
  doc.text(String(periodoDescricao), 52, curY + 12)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(35, 48, 68)
  doc.text('Total de Registros:', pageWidth - 70, curY + 6)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(70, 80, 95)
  doc.text(`${documentosFiltrados.length} documento(s)`, pageWidth - 42, curY + 6)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(35, 48, 68)
  doc.text('Valor Consolidado:', pageWidth - 70, curY + 12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(16, 120, 80)
  doc.text(formatarMoeda(totalGeral), pageWidth - 42, curY + 12)

  // ─── CARDS DE RESUMO POR CATEGORIA (Se relatório for geral) ───────
  curY = 58
  if (tipoDocumento === 'todos') {
    const cardWidth = (pageWidth - 28 - 9) / 4
    const cards = [
      { label: 'Notas Fiscais', qtd: qtdNotas, total: totalNotas, bg: [238, 242, 255], border: [199, 210, 254], text: [49, 46, 129] },
      { label: 'Cupons Fiscais', qtd: qtdCupons, total: totalCupons, bg: [245, 243, 255], border: [221, 214, 254], text: [76, 29, 149] },
      { label: 'Recibos', qtd: qtdRecibos, total: totalRecibos, bg: [240, 249, 255], border: [186, 230, 253], text: [12, 74, 110] },
      { label: 'Comprovantes PIX/Ted', qtd: qtdComprovantes, total: totalComprovantes, bg: [236, 253, 245], border: [167, 243, 208], text: [6, 78, 59] }
    ]

    cards.forEach((c, idx) => {
      const cX = 14 + idx * (cardWidth + 3)
      doc.setFillColor(c.bg[0], c.bg[1], c.bg[2])
      doc.setDrawColor(c.border[0], c.border[1], c.border[2])
      doc.roundedRect(cX, curY, cardWidth, 16, 1.5, 1.5, 'FD')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(c.text[0], c.text[1], c.text[2])
      doc.text(c.label.toUpperCase(), cX + 3, curY + 4.5)

      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text(formatarMoeda(c.total), cX + 3, curY + 9.5)

      doc.setFontSize(6.5)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 110, 120)
      doc.text(`${c.qtd} documento(s)`, cX + 3, curY + 13.5)
    })
    curY += 21
  }

  // ─── TABELA DE DOCUMENTOS DETALHADA ────────────────────────────────
  const tableData = documentosFiltrados.map(d => {
    return [
      formatarDataPtBr(d.data),
      d.tipo || 'Nota Fiscal',
      d.numero || '-',
      d.prestador || '-',
      d.cnpj || '-',
      d.servico || d.arquivoNome || '-',
      d.status || 'Em análise',
      formatarMoeda(d.valor)
    ]
  })

  if (tableData.length === 0) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.setTextColor(120)
    doc.text('Nenhum documento registrado com os filtros selecionados.', 14, curY + 8)
  } else {
    autoTable(doc, {
      startY: curY,
      head: [['Data', 'Tipo', 'Nº / ID', 'Prestador / Favorecido', 'CNPJ/CPF', 'Descrição / Serviço', 'Status', 'Valor (R$)']],
      body: tableData,
      foot: [[
        { content: 'TOTAL CONSOLIDADO', colSpan: 7, styles: { halign: 'right', fontStyle: 'bold', textColor: [35, 48, 68] } },
        { content: formatarMoeda(totalGeral), styles: { halign: 'right', fontStyle: 'bold', textColor: [16, 120, 80] } }
      ]],
      theme: 'striped',
      headStyles: {
        fillColor: [35, 48, 68],
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: 'bold',
        halign: 'center'
      },
      footStyles: {
        fillColor: [240, 245, 242],
        fontSize: 8,
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 7,
        cellPadding: 2,
        valign: 'middle',
        overflow: 'linebreak'
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 16 }, // Data
        1: { halign: 'center', cellWidth: 20, fontStyle: 'bold' }, // Tipo
        2: { halign: 'center', cellWidth: 18 }, // Nº
        3: { halign: 'left', cellWidth: 34, fontStyle: 'bold' }, // Prestador
        4: { halign: 'center', cellWidth: 22 }, // CNPJ
        5: { halign: 'left' }, // Serviço / Descrição
        6: { halign: 'center', cellWidth: 18 }, // Status
        7: { halign: 'right', cellWidth: 22, fontStyle: 'bold', textColor: [35, 48, 68] } // Valor
      },
      didDrawPage: () => {
        // Cabeçalho repetido em páginas extras
      }
    })
  }

  // ─── RODAPÉ E ASSINATURAS ──────────────────────────────────────────
  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(140)

    // Linha fina separadora
    doc.setDrawColor(220, 225, 230)
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12)

    doc.text('Alpha Soluções Condominiais — Sistema de Gestão & Transparência Financeira', 14, pageHeight - 7)
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - 14, pageHeight - 7, { align: 'right' })
  }

  // Salva o PDF no navegador
  const nomeCondoLimpo = (condominio || 'Geral').replace(/[^a-zA-Z0-9]/g, '_')
  const nomeArquivo = `Relatorio_Comprovantes_${nomeCondoLimpo}_${Date.now()}.pdf`
  doc.save(nomeArquivo)
  return doc
}
