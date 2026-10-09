import React, { useState, useMemo, useRef } from 'react'
import { 
  FileText, Upload, Sparkles, Plus, Trash2, Edit2, Download, 
  CheckCircle2, AlertTriangle, ArrowRight, Eye, RefreshCw, X,
  Building2, DollarSign, Award, ThumbsUp, Calendar, Search, Loader2
} from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '../firebase'

export default function OrcamentosComparativo({ condominios = [], condoFiltro: condoFiltroProp = 'Todos' }) {
  const { user } = useAuth()
  const isAdm = user?.role === 'Administrador'
  const meuCondo = user?.condominio || ''

  const { items: allOrcamentos, addItem, updateItem, deleteItem } = useFirestore('orcamentos_comparativos')

  const [condoFiltroLocal, setCondoFiltroLocal] = useState(() => {
    if (!isAdm && meuCondo) return meuCondo
    return condoFiltroProp || 'Todos'
  })

  useEffect(() => {
    if (isAdm && condoFiltroProp) {
      setCondoFiltroLocal(condoFiltroProp)
    }
  }, [isAdm, condoFiltroProp])

  const [modalUpload, setModalUpload] = useState(false)
  const [modalVisualizar, setModalVisualizar] = useState(null)
  const [grupoFiltro, setGrupoFiltro] = useState('Todos')
  const [search, setSearch] = useState('')
  const [gerandoPdf, setGerandoPdf] = useState(false)

  // Filtragem por condomínio
  const orcamentosDoCondo = useMemo(() => {
    return (allOrcamentos || []).filter(o => {
      if (!isAdm) {
        if (!meuCondo) return true
        const ocCondo = (o.condominio || '').trim().toLowerCase()
        const uCondo = meuCondo.trim().toLowerCase()
        return !ocCondo || ocCondo === uCondo || ocCondo.includes(uCondo) || uCondo.includes(ocCondo)
      }
      if (condoFiltroLocal !== 'Todos') {
        const ocCondo = (o.condominio || '').trim().toLowerCase()
        const fCondo = String(condoFiltroLocal).trim().toLowerCase()
        return ocCondo === fCondo || ocCondo.includes(fCondo) || fCondo.includes(ocCondo)
      }
      return true
    })
  }, [allOrcamentos, isAdm, meuCondo, condoFiltroLocal])

  // Lista de grupos únicos (ex: PORTA DE ENTRADA, COBERTURA / TELHADO)
  const gruposDisponiveis = useMemo(() => {
    const setG = new Set()
    orcamentosDoCondo.forEach(o => {
      const g = (o.grupo || 'Geral').trim().toUpperCase()
      if (g) setG.add(g)
    })
    return Array.from(setG).sort()
  }, [orcamentosDoCondo])

  // Filtragem de busca e grupo
  const orcamentosFiltrados = useMemo(() => {
    return orcamentosDoCondo.filter(o => {
      const matchGrupo = grupoFiltro === 'Todos' || (o.grupo || 'Geral').trim().toUpperCase() === grupoFiltro
      const s = search.toLowerCase()
      const matchSearch = !search ||
        (o.empresa || '').toLowerCase().includes(s) ||
        (o.numero || '').toLowerCase().includes(s) ||
        (o.tipoServico || '').toLowerCase().includes(s) ||
        (o.materiais || '').toLowerCase().includes(s) ||
        (o.grupo || '').toLowerCase().includes(s)
      return matchGrupo && matchSearch
    }).sort((a, b) => (Number(a.valor) || 0) - (Number(b.valor) || 0))
  }, [orcamentosDoCondo, grupoFiltro, search])

  // Agrupamento por Objeto / Área para visualização em Quadros
  const quadrosAgrupados = useMemo(() => {
    const map = {}
    orcamentosFiltrados.forEach(o => {
      const g = (o.grupo || 'GERAL').trim().toUpperCase()
      if (!map[g]) map[g] = []
      map[g].push(o)
    })
    return Object.entries(map).map(([grupo, itens], idx) => {
      // Ordena do menor para o maior valor
      const itensOrdenados = [...itens].sort((a, b) => (Number(a.valor) || 0) - (Number(b.valor) || 0))
      const menor = itensOrdenados[0]
      return {
        numeroQuadro: idx + 1,
        grupo,
        itens: itensOrdenados,
        menorOpcao: menor
      }
    })
  }, [orcamentosFiltrados])

  // GERAÇÃO DO PDF NO ESTILO EXATO DA IMAGEM DO USUÁRIO
  const handleGerarPdfComparativo = () => {
    if (quadrosAgrupados.length === 0) {
      alert('Não há orçamentos cadastrados no filtro atual para gerar o comparativo.')
      return
    }

    setGerandoPdf(true)
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const pageWidth = doc.internal.pageSize.getWidth()
      const nomeCondoDoc = (!isAdm && meuCondo) ? meuCondo : (condoFiltro !== 'Todos' ? condoFiltro : (orcamentosFiltrados[0]?.condominio || 'Condomínio'))

      // 1. TÍTULO CENTRALIZADO
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.setTextColor(20, 20, 20)
      doc.text('QUADRO COMPARATIVO DE ORÇAMENTOS', pageWidth / 2, 16, { align: 'center' })

      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text(nomeCondoDoc, pageWidth / 2, 23, { align: 'center' })

      let currentY = 28
      let indiceGeral = 1
      const resumosMenores = []

      quadrosAgrupados.forEach((quadro) => {
        // Título do Quadro
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.setTextColor(0, 0, 0)
        doc.text(`QUADRO ${quadro.numeroQuadro} – ORÇAMENTOS DA ${quadro.grupo}`, 14, currentY)
        currentY += 2

        const colunas = [
          { header: 'Nº', dataKey: 'num' },
          { header: 'Empresa / Orçamento', dataKey: 'empresa' },
          { header: 'Tipo de serviço', dataKey: 'servico' },
          { header: 'Modelo / Materiais', dataKey: 'materiais' },
          { header: 'Valor', dataKey: 'valor' },
          { header: 'Condição de pagamento', dataKey: 'pagamento' }
        ]

        const rows = quadro.itens.map(item => {
          const numSeq = indiceGeral++
          const descEmpresa = item.numero ? `${item.numero} – ${item.empresa}` : item.empresa
          const valFmt = `R$ ${Number(item.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          return {
            num: String(numSeq),
            empresa: descEmpresa,
            servico: item.tipoServico || 'Conforme especificação',
            materiais: item.materiais || 'Conforme projeto/proposta',
            valor: valFmt,
            pagamento: item.condicaoPagamento || 'Não informada'
          }
        })

        autoTable(doc, {
          startY: currentY,
          columns: colunas,
          body: rows,
          theme: 'grid',
          headStyles: {
            fillColor: [215, 226, 238], // Azul-acinzentado claro clássico igual ao da foto
            textColor: [15, 23, 42],
            fontStyle: 'bold',
            fontSize: 9,
            halign: 'left',
            valign: 'middle',
            lineColor: [100, 116, 139],
            lineWidth: 0.2
          },
          bodyStyles: {
            textColor: [30, 41, 59],
            fontSize: 8.5,
            valign: 'middle',
            lineColor: [148, 163, 184],
            lineWidth: 0.2
          },
          columnStyles: {
            num: { cellWidth: 10, halign: 'center' },
            empresa: { cellWidth: 50 },
            servico: { cellWidth: 55 },
            materiais: { cellWidth: 70 },
            valor: { cellWidth: 32, fontStyle: 'bold' },
            pagamento: { cellWidth: 52 }
          },
          margin: { left: 14, right: 14 },
          didParseCell: (data) => {
            // Destaca a linha do menor valor com fundo suave
            if (data.section === 'body') {
              const itemOrig = quadro.itens[data.row.index]
              if (itemOrig && quadro.menorOpcao && itemOrig.id === quadro.menorOpcao.id) {
                // Leve realce para melhor opção
                data.cell.styles.fillColor = [240, 253, 244] // verde bem claro
              }
            }
          }
        })

        currentY = doc.lastAutoTable.finalY + 4

        // Observações do Quadro (se houver)
        const obsList = quadro.itens.filter(i => i.observacoes).map(i => `${i.empresa}: ${i.observacoes}`).join(' | ')
        if (obsList) {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(8)
          doc.setTextColor(30, 41, 59)
          const splitObs = doc.splitTextToSize(`Observação: ${obsList}`, pageWidth - 28)
          doc.text(splitObs, 14, currentY)
          currentY += (splitObs.length * 3.5) + 3
        } else {
          currentY += 2
        }

        // Armazena resumo do menor valor do quadro
        if (quadro.menorOpcao) {
          const valFmt = `R$ ${Number(quadro.menorOpcao.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          resumosMenores.push(`${quadro.grupo.toLowerCase()}: ${quadro.menorOpcao.empresa} (${valFmt})`)
        }
      })

      // RESUMO DOS MENORES VALORES E RECOMENDAÇÃO TÉCNICA
      if (resumosMenores.length > 0) {
        currentY += 2
        if (currentY > 175) {
          doc.addPage()
          currentY = 20
        }

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(15, 23, 42)
        const txtResumo = `Resumo dos menores valores: ${resumosMenores.join('; ')}.`
        const splitResumo = doc.splitTextToSize(txtResumo, pageWidth - 28)
        doc.text(splitResumo, 14, currentY)
        currentY += (splitResumo.length * 4) + 2

        // Parecer da Inteligência Artificial / Análise Técnica
        const analises = quadrosAgrupados.map(q => {
          if (!q.menorOpcao) return null
          return `• ${q.grupo}: Recomendada a proposta de "${q.menorOpcao.empresa}" pelo critério de menor custo atendendo o escopo (${q.menorOpcao.analiseIA || 'Excelente custo-benefício'}).`
        }).filter(Boolean)

        if (analises.length > 0) {
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(8.5)
          doc.setTextColor(5, 150, 105) // verde esmeralda
          doc.text('Análise & Recomendação Técnica (Alpha IA):', 14, currentY)
          currentY += 4

          doc.setFont('helvetica', 'normal')
          doc.setFontSize(8)
          doc.setTextColor(51, 65, 85)
          analises.forEach(an => {
            const splitAn = doc.splitTextToSize(an, pageWidth - 28)
            doc.text(splitAn, 14, currentY)
            currentY += (splitAn.length * 3.5) + 1
          })
        }
      }

      // Rodapé
      const totalPages = doc.internal.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        doc.setFontSize(7.5)
        doc.setTextColor(148, 163, 184)
        doc.text(`Alpha Soluções Condominiais • Comparativo Gerado em ${new Date().toLocaleDateString('pt-BR')} • Página ${i} de ${totalPages}`, pageWidth / 2, 202, { align: 'center' })
      }

      const nomeLimpo = `Comparativo_Orcamentos_${nomeCondoDoc.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
      doc.save(nomeLimpo)
    } catch (err) {
      console.error('Erro ao gerar PDF comparativo:', err)
      alert('Erro ao gerar PDF: ' + err.message)
    } finally {
      setGerandoPdf(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in w-full">
      {/* Banner Superior & Ações */}
      <div className="bg-gradient-to-br from-slate-900 via-brand-900 to-slate-950 text-white rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-xl border border-slate-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-brand-500/20 border border-brand-400/30 px-3 py-1 rounded-full text-xs font-black text-brand-300 mb-3">
              <Sparkles size={14} className="text-amber-400" /> Leitura Inteligente com IA & Comparativo Automático
            </div>
            <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Gestão de Orçamentos & Quadro Comparativo
            </h3>
            <p className="text-slate-300 text-xs sm:text-sm mt-2 leading-relaxed">
              Basta anexar os orçamentos e propostas (PDF ou Foto) que os fornecedores te enviaram. 
              A <strong>Alpha IA</strong> extrai automaticamente a empresa, valores, materiais e prazos, analisa qual é a melhor opção e gera o <strong>PDF Comparativo Oficial</strong> idêntico ao modelo de prestação de contas.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={() => setModalUpload(true)}
              className="btn-primary bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-5 py-3 rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] cursor-pointer"
            >
              <Upload size={18} />
              <span>+ Anexar Novo Orçamento (IA)</span>
            </button>

            <button
              onClick={handleGerarPdfComparativo}
              disabled={gerandoPdf || quadrosAgrupados.length === 0}
              className="btn-secondary bg-white/10 hover:bg-white/20 text-white border-white/20 font-black px-5 py-3 rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {gerandoPdf ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} className="text-amber-300" />}
              <span>Gerar PDF Comparativo</span>
            </button>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-white p-4 rounded-2xl border border-pale-300 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-10 text-xs w-full bg-slate-50 border-gray-200"
            placeholder="Buscar por empresa, número do orçamento, serviço ou materiais..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdm && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-gray-500">Condomínio:</span>
              <select
                className="input text-xs font-bold bg-white border-gray-300 text-gray-900 py-2"
                value={condoFiltroLocal}
                onChange={e => setCondoFiltroLocal(e.target.value)}
              >
                <option value="Todos">🏢 Todos os Condomínios</option>
                {condominios?.map(c => (
                  <option key={c.id || c.nome} value={c.nome}>{c.nome}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-gray-500">Filtrar Objeto:</span>
            <select
              className="input text-xs font-bold bg-amber-50/70 border-amber-300 text-gray-900 py-2"
              value={grupoFiltro}
              onChange={e => setGrupoFiltro(e.target.value)}
            >
              <option value="Todos">🌐 Todos os Quadros ({quadrosAgrupados.length})</option>
              {gruposDisponiveis.map(g => (
                <option key={g} value={g}>📂 {g}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Lista de Quadros Comparativos no estilo da imagem */}
      {quadrosAgrupados.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-gray-300 shadow-sm flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-2xl font-black">
            📑
          </div>
          <h4 className="text-base font-black text-gray-800">Nenhum orçamento cadastrado ainda</h4>
          <p className="text-xs text-gray-500 max-w-md">
            Clique no botão acima <strong>"+ Anexar Novo Orçamento (IA)"</strong> para fazer o upload do PDF ou foto da proposta enviada pelo fornecedor.
          </p>
          <button
            onClick={() => setModalUpload(true)}
            className="btn-primary text-xs mt-2 bg-emerald-600 hover:bg-emerald-500"
          >
            <Upload size={14} /> Anexar Orçamento Agora
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {quadrosAgrupados.map((quadro) => (
            <div key={quadro.grupo} className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Topo do Quadro */}
              <div className="p-4 sm:p-5 bg-slate-50 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-brand-600 text-white font-black text-xs flex items-center justify-center">
                    {quadro.numeroQuadro}
                  </span>
                  <div>
                    <h4 className="font-black text-sm sm:text-base text-gray-900 uppercase tracking-wide">
                      QUADRO {quadro.numeroQuadro} – ORÇAMENTOS DA {quadro.grupo}
                    </h4>
                    <p className="text-[11px] text-gray-500">
                      {quadro.itens.length} proposta{quadro.itens.length > 1 ? 's' : ''} comparada{quadro.itens.length > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                {quadro.menorOpcao && (
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                    <Award size={16} className="text-emerald-600 shrink-0" />
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-emerald-800 uppercase block">Menor Valor</span>
                      <span className="text-xs font-black text-emerald-900">
                        {quadro.menorOpcao.empresa} (R$ {Number(quadro.menorOpcao.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Tabela do Quadro no Estilo Fiel da Imagem */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#d7e2ee] text-slate-900 border-b border-slate-300 font-black">
                      <th className="p-3 text-center w-12 border-r border-slate-300">Nº</th>
                      <th className="p-3 w-48 border-r border-slate-300">Empresa / Orçamento</th>
                      <th className="p-3 w-64 border-r border-slate-300">Tipo de serviço</th>
                      <th className="p-3 border-r border-slate-300">Modelo / Materiais</th>
                      <th className="p-3 w-32 border-r border-slate-300">Valor</th>
                      <th className="p-3 w-52 border-r border-slate-300">Condição de pagamento</th>
                      <th className="p-3 w-24 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {quadro.itens.map((item, idx) => {
                      const isMenor = quadro.menorOpcao && item.id === quadro.menorOpcao.id
                      return (
                        <tr 
                          key={item.id} 
                          className={`hover:bg-slate-50 transition-colors ${
                            isMenor ? 'bg-emerald-50/40 font-semibold' : ''
                          }`}
                        >
                          <td className="p-3 text-center font-bold text-gray-500 border-r border-gray-200">
                            {idx + 1}
                          </td>
                          <td className="p-3 font-bold text-gray-900 border-r border-gray-200">
                            {item.numero ? (
                              <>
                                <span className="block text-[11px] text-gray-500 font-mono">{item.numero}</span>
                                <span>{item.empresa}</span>
                              </>
                            ) : (
                              <span>{item.empresa}</span>
                            )}
                            {isMenor && (
                              <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded ml-1.5 border border-emerald-300">
                                ⭐ Melhor Opção
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-gray-700 border-r border-gray-200">
                            {item.tipoServico || '—'}
                          </td>
                          <td className="p-3 text-gray-600 border-r border-gray-200 leading-relaxed">
                            {item.materiais || '—'}
                          </td>
                          <td className="p-3 font-mono font-black text-gray-900 text-sm border-r border-gray-200 whitespace-nowrap">
                            R$ {Number(item.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 text-gray-700 border-r border-gray-200">
                            {item.condicaoPagamento || '—'}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {item.arquivoUrl && (
                                <a
                                  href={item.arquivoUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="Ver arquivo original da proposta"
                                  className="p-1.5 rounded-lg text-brand-600 hover:bg-brand-50"
                                >
                                  <FileText size={15} />
                                </a>
                              )}
                              <button
                                onClick={() => setModalVisualizar(item)}
                                title="Ver Detalhes e Parecer da IA"
                                className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50"
                              >
                                <Eye size={15} />
                              </button>
                              <button
                                onClick={() => {
                                  if (window.confirm(`Excluir o orçamento da empresa "${item.empresa}"?`)) {
                                    deleteItem(item.id)
                                  }
                                }}
                                title="Excluir"
                                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Rodapé do Quadro com Parecer e Observações */}
              <div className="p-4 bg-slate-50 border-t border-gray-200 text-xs text-gray-700 flex flex-col gap-2">
                {quadro.itens.some(i => i.observacoes) && (
                  <p className="font-medium text-gray-600">
                    <strong>Observação:</strong> {quadro.itens.filter(i => i.observacoes).map(i => `${i.empresa}: ${i.observacoes}`).join('. ')}
                  </p>
                )}
                {quadro.menorOpcao && (
                  <p className="font-semibold text-emerald-800 bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200 flex items-center gap-2">
                    <Sparkles size={16} className="text-emerald-600 shrink-0" />
                    <span>
                      <strong>Parecer da Alpha IA ({quadro.grupo}):</strong> A proposta da empresa <u>{quadro.menorOpcao.empresa}</u> destaca-se como a melhor opção com o menor valor global (R$ {Number(quadro.menorOpcao.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}). {quadro.menorOpcao.analiseIA || ''}
                    </span>
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Anexar Novo Orçamento com Leitura por IA */}
      {modalUpload && (
        <ModalUploadOrcamento
          condominios={condominios}
          initialCondo={(!isAdm && meuCondo) ? meuCondo : (condoFiltro !== 'Todos' ? condoFiltro : '')}
          onClose={() => setModalUpload(false)}
          onSave={async (dados) => {
            await addItem(dados)
            setModalUpload(false)
          }}
        />
      )}

      {/* Modal de Detalhes / Análise da IA */}
      {modalVisualizar && (
        <ModalDetalhesOrcamento
          item={modalVisualizar}
          condominios={condominios}
          onClose={() => setModalVisualizar(null)}
          onUpdate={async (dadosAtualizados) => {
            await updateItem(modalVisualizar.id, dadosAtualizados)
            setModalVisualizar(null)
          }}
        />
      )}
    </div>
  )
}

// =========================================================================
// MODAL DE UPLOAD COM IA (OCR AUTOMÁTICO DE ORÇAMENTO)
// =========================================================================
function ModalUploadOrcamento({ condominios = [], initialCondo = '', onClose, onSave }) {
  const { user } = useAuth()
  const isAdm = user?.role === 'Administrador'
  const fileInputRef = useRef()

  const [arquivo, setArquivo] = useState(null)
  const [extraindo, setExtraindo] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [etapa, setEtapa] = useState('upload') // 'upload' ou 'revisao'

  const [form, setForm] = useState({
    condominio: initialCondo || condominios[0]?.nome || '',
    empresa: '',
    numero: '',
    grupo: 'PORTA DE ENTRADA',
    tipoServico: '',
    materiais: '',
    valor: '',
    condicaoPagamento: '',
    prazo: '',
    garantia: '',
    observacoes: '',
    telefone: '',
    email: '',
    analiseIA: '',
    arquivoUrl: ''
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setArquivo(file)
    setExtraindo(true)

    try {
      // 1. Converte para Base64
      const reader = new FileReader()
      const base64Promise = new Promise((resolve, reject) => {
        reader.onload = ev => resolve(ev.target.result)
        reader.onerror = reject
      })
      reader.readAsDataURL(file)
      const base64 = await base64Promise

      // 2. Chama a API de IA com type='orcamento' e timeout seguro de 15s
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 20000)

      let data = null
      try {
        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            file: base64,
            mimeType: file.type || 'application/pdf',
            type: 'orcamento'
          })
        })
        clearTimeout(timeoutId)
        data = await res.json()
      } catch (fErr) {
        clearTimeout(timeoutId)
        console.warn('Timeout ou falha na extração de OCR pela IA:', fErr)
      }

      if (data && data.success && data.data) {
        const d = data.data
        setForm(prev => ({
          ...prev,
          empresa: d.empresa || prev.empresa || file.name.replace(/\.[^/.]+$/, ""),
          numero: d.numero || prev.numero || '',
          grupo: d.grupo ? d.grupo.toUpperCase() : prev.grupo,
          tipoServico: d.tipoServico || prev.tipoServico || '',
          materiais: d.materiais || prev.materiais || '',
          valor: d.valor !== undefined ? String(d.valor) : prev.valor,
          condicaoPagamento: d.condicaoPagamento || prev.condicaoPagamento || '',
          prazo: d.prazo || prev.prazo || '',
          garantia: d.garantia || prev.garantia || '',
          observacoes: d.observacoes || prev.observacoes || '',
          telefone: d.telefone || prev.telefone || '',
          email: d.email || prev.email || '',
          analiseIA: d.analiseIA || prev.analiseIA || ''
        }))
        setEtapa('revisao')
      } else {
        // Se a IA não conseguir extrair todos os dados, deixa o usuário preencher
        setForm(prev => ({
          ...prev,
          empresa: file.name.replace(/\.[^/.]+$/, "")
        }))
        setEtapa('revisao')
      }
    } catch (err) {
      console.warn('Falha no OCR IA de orçamento:', err)
      setForm(prev => ({
        ...prev,
        empresa: file.name.replace(/\.[^/.]+$/, "")
      }))
      setEtapa('revisao')
    } finally {
      setExtraindo(false)
    }
  }

  const handleSalvar = async () => {
    if (!form.empresa || !form.valor) {
      alert('Por favor, informe ao menos o Nome da Empresa e o Valor do orçamento.')
      return
    }

    setSalvando(true)
    try {
      let arquivoUrl = form.arquivoUrl || ''

      // Se houver arquivo anexado, envia para o Firebase Storage com timeout ou fallback seguro
      if (arquivo && !arquivoUrl) {
        try {
          const cleanName = arquivo.name.replace(/[^a-zA-Z0-9._-]/g, '_')
          const storageRef = ref(storage, `orcamentos/${Date.now()}_${cleanName}`)
          
          // Timeout de 7s para não travar o salvamento caso Storage tenha regras restritas
          const uploadPromise = uploadBytes(storageRef, arquivo)
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout Storage')), 7000))
          
          const snap = await Promise.race([uploadPromise, timeoutPromise])
          arquivoUrl = await getDownloadURL(snap.ref)
        } catch (stErr) {
          console.warn('Falha ou timeout no Storage, tentando fallback seguro:', stErr)
          // Fallback: se for arquivo pequeno (< 800KB), salva em base64 inline para visualização garantida
          if (arquivo.size <= 850000) {
            try {
              const reader = new FileReader()
              arquivoUrl = await new Promise((res, rej) => {
                reader.onload = e => res(e.target.result)
                reader.onerror = rej
                reader.readAsDataURL(arquivo)
              })
            } catch (rErr) {
              console.warn('Erro ao ler fallback base64:', rErr)
            }
          }
        }
      }

      const valLimpo = typeof form.valor === 'number' ? form.valor : (parseFloat(String(form.valor).replace(/\./g, '').replace(',', '.')) || 0)

      await onSave({
        ...form,
        valor: valLimpo,
        arquivoUrl,
        criadoPor: user?.nome || 'Usuário',
        criadoEm: new Date().toISOString()
      })
    } catch (err) {
      console.error(err)
      alert('Erro ao salvar orçamento: ' + err.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-2xl w-full p-0 overflow-hidden rounded-3xl" onClick={e => e.stopPropagation()}>
        {/* Topo do Modal */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black">
              <Upload size={20} />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg">Anexar Orçamento com Leitura IA</h3>
              <p className="text-xs text-slate-400">Envie o PDF ou Foto da proposta e a IA preencherá automaticamente</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
          {/* Caixa de Upload Drag & Drop */}
          <div
            onClick={() => !extraindo && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
              extraindo ? 'border-amber-400 bg-amber-50/50' : 'border-gray-300 hover:border-brand-500 bg-slate-50'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              onChange={handleFileChange}
              className="hidden"
            />
            {extraindo ? (
              <div className="flex flex-col items-center gap-2 py-3">
                <Loader2 size={32} className="animate-spin text-amber-600" />
                <p className="text-xs font-black text-amber-900">Alpha IA está lendo e estruturando seu orçamento...</p>
                <p className="text-[11px] text-amber-700">Extraindo empresa, materiais, prazos e condições financeiras</p>
              </div>
            ) : arquivo ? (
              <div className="flex items-center justify-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <CheckCircle2 size={24} />
                </div>
                <div className="text-left">
                  <p className="text-xs font-black text-gray-900">{arquivo.name}</p>
                  <p className="text-[11px] text-emerald-600 font-bold">Arquivo processado com sucesso! Revise os dados abaixo:</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-2">
                <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center">
                  <Upload size={24} />
                </div>
                <p className="text-xs font-black text-gray-800">Clique para selecionar o PDF ou Foto da Proposta</p>
                <p className="text-[11px] text-gray-500">Formatos aceitos: PDF, JPEG, PNG</p>
              </div>
            )}
          </div>

          {/* Formulário de Revisão Preenchido pela IA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
            <div>
              <label className="label text-xs font-black">Condomínio *</label>
              {isAdm ? (
                <select
                  className="input text-xs font-bold bg-white border-brand-300 text-gray-900"
                  value={form.condominio}
                  onChange={e => set('condominio', e.target.value)}
                >
                  <option value="">Selecione o Condomínio...</option>
                  {condominios?.map(c => (
                    <option key={c.id || c.nome} value={c.nome}>{c.nome}</option>
                  ))}
                </select>
              ) : (
                <input
                  className="input text-xs font-bold bg-slate-100 cursor-not-allowed"
                  value={form.condominio}
                  readOnly
                />
              )}
            </div>

            <div>
              <label className="label text-xs font-black">Área / Objeto do Quadro *</label>
              <input
                className="input text-xs font-bold uppercase"
                value={form.grupo}
                onChange={e => set('grupo', e.target.value.toUpperCase())}
                placeholder="Ex: PORTA DE ENTRADA, COBERTURA / TELHADO"
              />
            </div>

            <div>
              <label className="label text-xs font-black">Empresa / Prestador *</label>
              <input
                className="input text-xs font-bold"
                value={form.empresa}
                onChange={e => set('empresa', e.target.value)}
                placeholder="Ex: EsquadriJampa ou Elite Premium"
              />
            </div>

            <div>
              <label className="label text-xs font-black">Nº do Orçamento / Código</label>
              <input
                className="input text-xs"
                value={form.numero}
                onChange={e => set('numero', e.target.value)}
                placeholder="Ex: Orçamento nº 260910-002/01"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="label text-xs font-black">Tipo de Serviço / Escopo *</label>
              <input
                className="input text-xs font-semibold"
                value={form.tipoServico}
                onChange={e => set('tipoServico', e.target.value)}
                placeholder="Ex: Fornecimento e instalação de porta de giro, 1 folha, com fechadura"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="label text-xs font-black">Modelo / Materiais &amp; Medidas</label>
              <textarea
                className="input text-xs min-h-[60px] resize-none"
                value={form.materiais}
                onChange={e => set('materiais', e.target.value)}
                placeholder="Ex: Porta 1,00 x 2,25 m; vidro temperado 8mm; perfil alumínio RAL 9003"
              />
            </div>

            <div>
              <label className="label text-xs font-black text-emerald-800">Valor Total (R$) *</label>
              <input
                type="number"
                step="0.01"
                className="input text-xs font-mono font-black text-emerald-900 bg-emerald-50/50"
                value={form.valor}
                onChange={e => set('valor', e.target.value)}
                placeholder="Ex: 2100.00"
              />
            </div>

            <div>
              <label className="label text-xs font-black">Condição de Pagamento</label>
              <input
                className="input text-xs"
                value={form.condicaoPagamento}
                onChange={e => set('condicaoPagamento', e.target.value)}
                placeholder="Ex: À vista ou 50% entrada + 50% entrega"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="label text-xs font-black">Observações Relevantes</label>
              <input
                className="input text-xs"
                value={form.observacoes}
                onChange={e => set('observacoes', e.target.value)}
                placeholder="Ex: Fechadura simples incluída. Magnética acresce R$ 1.500,00"
              />
            </div>

            {form.analiseIA && (
              <div className="sm:col-span-2 bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex items-start gap-2">
                <Sparkles size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-black text-emerald-900 uppercase">Parecer Técnico da IA:</p>
                  <p className="text-xs text-emerald-800">{form.analiseIA}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Rodapé do Modal */}
        <div className="p-4 bg-slate-50 border-t border-gray-200 flex justify-end gap-2.5">
          <button onClick={onClose} disabled={salvando} className="btn-secondary text-xs">
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={salvando || extraindo}
            className="btn-primary bg-emerald-600 hover:bg-emerald-500 text-xs flex items-center gap-1.5"
          >
            {salvando ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            <span>Salvar no Comparativo</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// =========================================================================
// MODAL DE DETALHES / VISUALIZAÇÃO DO ORÇAMENTO
// =========================================================================
function ModalDetalhesOrcamento({ item, condominios = [], onClose, onUpdate }) {
  const { user } = useAuth()
  const isAdm = user?.role === 'Administrador'
  const [salvando, setSalvando] = useState(false)
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({ ...item })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSalvarEdicao = async () => {
    setSalvando(true)
    try {
      await onUpdate(form)
      setEditando(false)
    } catch (e) {
      alert('Erro ao atualizar orçamento: ' + e.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-xl w-full p-0 overflow-hidden rounded-3xl" onClick={e => e.stopPropagation()}>
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div>
            <h3 className="font-black text-base">{form.empresa}</h3>
            <p className="text-xs text-slate-400">Área: {form.grupo || 'Geral'}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-3.5 text-xs max-h-[75vh] overflow-y-auto">
          <div>
            <label className="font-bold text-gray-500 block text-[10px] uppercase mb-1">Condomínio Vinculado</label>
            {isAdm ? (
              <select
                className="input text-xs font-bold bg-white border-brand-300 text-gray-900"
                value={form.condominio || ''}
                onChange={e => {
                  set('condominio', e.target.value)
                  setEditando(true)
                }}
              >
                <option value="">Selecione o Condomínio...</option>
                {condominios?.map(c => (
                  <option key={c.id || c.nome} value={c.nome}>{c.nome}</option>
                ))}
              </select>
            ) : (
              <p className="font-bold text-gray-800 bg-slate-100 p-2 rounded-lg">{form.condominio || 'Geral'}</p>
            )}
          </div>
          <div>
            <span className="font-bold text-gray-500 block text-[10px] uppercase">Tipo de Serviço</span>
            <p className="font-semibold text-gray-900 text-sm mt-0.5">{item.tipoServico || '—'}</p>
          </div>

          <div>
            <span className="font-bold text-gray-500 block text-[10px] uppercase">Modelo / Materiais &amp; Medidas</span>
            <p className="text-gray-700 leading-relaxed mt-0.5 bg-slate-50 p-2.5 rounded-xl border border-gray-200">
              {item.materiais || '—'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-gray-200">
            <div>
              <span className="font-bold text-gray-500 block text-[10px] uppercase">Valor Total</span>
              <p className="font-black text-emerald-700 text-base font-mono">
                R$ {Number(item.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <span className="font-bold text-gray-500 block text-[10px] uppercase">Condição de Pagamento</span>
              <p className="font-bold text-gray-800">{item.condicaoPagamento || '—'}</p>
            </div>
          </div>

          {item.observacoes && (
            <div>
              <span className="font-bold text-gray-500 block text-[10px] uppercase">Observações</span>
              <p className="text-gray-700 mt-0.5">{item.observacoes}</p>
            </div>
          )}

          {item.analiseIA && (
            <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl">
              <span className="font-black text-emerald-900 block text-[10px] uppercase flex items-center gap-1">
                <Sparkles size={12} className="text-emerald-600" /> Parecer Técnico da Alpha IA
              </span>
              <p className="text-emerald-800 mt-1 leading-relaxed">{item.analiseIA}</p>
            </div>
          )}

          {item.arquivoUrl && (
            <div className="pt-2">
              <a
                href={item.arquivoUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-primary w-full text-center flex items-center justify-center gap-2 py-2.5 bg-brand-600 hover:bg-brand-500 text-xs"
              >
                <FileText size={16} /> Abrir Documento / Proposta Original
              </a>
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-gray-200 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary text-xs">
            Fechar
          </button>
          {editando && (
            <button
              onClick={handleSalvarEdicao}
              disabled={salvando}
              className="btn-primary bg-emerald-600 hover:bg-emerald-500 text-xs flex items-center gap-1.5"
            >
              {salvando ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Salvar Alterações
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
