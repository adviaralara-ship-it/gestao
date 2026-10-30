import React, { useState, useMemo } from 'react'
import { X, Upload, FileText, CheckCircle2, AlertCircle, Trash2, Loader2, Building, Calendar, DollarSign, Check, RefreshCw } from 'lucide-react'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '../firebase'

// Normalização para comparação textual sem acentos, pontuação e minúsculas
function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Distância Levenshtein para tolerância a pequenos erros de digitação (ex: Brinlhante vs Brilhante)
function levenshtein(a, b) {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const matrix = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  return matrix[b.length][a.length]
}

// Decompõe o nome do arquivo no padrão bancário:
// Ex: Boleto-AndressaMariaMoreiraPalitot-2026-11-05-8013916210000058822.pdf
function parseBoletoFileName(fileName) {
  let clean = fileName.replace(/\.pdf$/i, '')
  
  // Extrai data no formato YYYY-MM-DD
  const dateMatch = clean.match(/(\d{4}-\d{2}-\d{2})/)
  let date = dateMatch ? dateMatch[1] : ''
  let nossoNumero = ''
  let namePart = clean

  if (dateMatch) {
    const idx = clean.indexOf(dateMatch[0])
    const prefix = clean.substring(0, idx).replace(/^boleto[-_]?/i, '').replace(/[-_]$/, '')
    const suffix = clean.substring(idx + dateMatch[0].length).replace(/^[-_]/, '')
    namePart = prefix
    nossoNumero = suffix
  } else {
    namePart = clean.replace(/^boleto[-_]?/i, '')
  }

  // Desmembra PascalCase / camelCase em palavras legíveis com espaços
  const spacedName = namePart
    .replace(/([a-z0-9])([A-Z])/g, (m, p1, p2) => p1 + ' ' + p2)
    .replace(/[-_]/g, ' ')
    .trim()

  return {
    fileName,
    namePart,
    spacedName,
    date,
    nossoNumero
  }
}

// Algoritmo de Matching Inteligente contra moradores do condomínio
function matchMorador(spacedName, moradores) {
  if (!moradores || moradores.length === 0) return { morador: null, score: 0 }
  const normSpaced = norm(spacedName)
  const stopWords = new Set(['de', 'da', 'do', 'dos', 'das', 'e', 's', 'a', 'o', 'em'])
  const queryTokens = normSpaced.split(' ').filter(t => t.length > 1 && !stopWords.has(t))

  let best = null
  let bestScore = 0

  for (const m of moradores) {
    const normMorador = norm(m.nome)
    if (!normMorador) continue

    // Correspondência exata direta
    if (normMorador === normSpaced) {
      return { morador: m, score: 1.0 }
    }

    const moradorTokens = normMorador.split(' ').filter(t => t.length > 1 && !stopWords.has(t))
    let matchedCount = 0

    for (const qToken of queryTokens) {
      const match = moradorTokens.some(mToken => {
        if (mToken === qToken) return true
        if (qToken.length >= 4 && (mToken.includes(qToken) || qToken.includes(mToken))) return true
        if (qToken.length >= 5 && mToken.length >= 5 && levenshtein(qToken, mToken) <= 1) return true
        return false
      })
      if (match) matchedCount++
    }

    const score = queryTokens.length > 0 ? (matchedCount / queryTokens.length) : 0
    if (score > bestScore) {
      bestScore = score
      best = m
    }
  }

  return { morador: best, score: bestScore }
}

export default function ModalImportarBoletosPDF({
  condominios = [],
  moradores = [],
  initialCondo = '',
  onClose,
  onSave
}) {
  // Condomínio selecionado
  const [condominioNome, setCondominioNome] = useState(() => {
    if (initialCondo && initialCondo !== 'Todos') return initialCondo
    return condominios[0]?.nome || ''
  })

  // Dados do condomínio selecionado (para puxar cota padrão, cnpj, etc)
  const selectedCondo = useMemo(() => {
    return condominios.find(c => c.nome === condominioNome) || null
  }, [condominios, condominioNome])

  // Moradores do condomínio selecionado
  const moradoresDoCondo = useMemo(() => {
    if (!condominioNome) return []
    const cNorm = norm(condominioNome)
    return (moradores || []).filter(m => {
      const mc = norm(m.condominio || m.condominioNome || '')
      return mc === cNorm || mc.includes(cNorm) || cNorm.includes(mc)
    }).sort((a, b) => {
      const aptA = parseInt(String(a.apt).replace(/\D/g, ''), 10) || 0
      const aptB = parseInt(String(b.apt).replace(/\D/g, ''), 10) || 0
      return aptA - aptB
    })
  }, [moradores, condominioNome])

  // Valor padrão carregado do condomínio (ex: 265)
  const [valorPadrao, setValorPadrao] = useState(() => {
    const cota = selectedCondo?.cotaPadrao || selectedCondo?.taxaPadrao || 265
    return String(cota).replace('.', ',')
  })

  // Competência padrão (ex: nov/2026)
  const [competencia, setCompetencia] = useState(() => {
    return new Date().toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '/')
  })

  // Lista de arquivos processados
  const [itens, setItens] = useState([])
  const [processandoArquivos, setProcessandoArquivos] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [progresso, setProgresso] = useState({ atual: 0, total: 0, status: '' })
  const [dragOver, setDragOver] = useState(false)

  // Ao mudar de condomínio, re-avalia o matching dos arquivos já carregados
  const handleCondominioChange = (novoCondoNome) => {
    setCondominioNome(novoCondoNome)
    const novoCondoDoc = condominios.find(c => c.nome === novoCondoNome)
    const novoValor = novoCondoDoc?.cotaPadrao ? String(novoCondoDoc.cotaPadrao).replace('.', ',') : valorPadrao
    setValorPadrao(novoValor)

    // Reavalia lista de moradores do novo condomínio
    const cNorm = norm(novoCondoNome)
    const novosMoradores = (moradores || []).filter(m => {
      const mc = norm(m.condominio || m.condominioNome || '')
      return mc === cNorm || mc.includes(cNorm) || cNorm.includes(mc)
    })

    setItens(prev => prev.map(item => {
      const { morador, score } = matchMorador(item.spacedName, novosMoradores)
      if (morador && score >= 0.4) {
        return {
          ...item,
          moradorId: morador.id,
          moradorNome: morador.nome,
          apt: morador.apt || item.apt,
          bloco: morador.bloco || '',
          cpf: morador.cpf || '',
          tel: morador.tel || morador.telefone || '',
          encontrado: true,
          score
        }
      }
      return {
        ...item,
        moradorId: '',
        encontrado: false,
        score: 0
      }
    }))
  }

  // Processa a seleção de múltiplos PDFs
  const processarArquivos = (fileList) => {
    if (!fileList || fileList.length === 0) return
    const pdfFiles = Array.from(fileList).filter(f => f.name.toLowerCase().endsWith('.pdf'))
    if (pdfFiles.length === 0) {
      alert('Selecione arquivos no formato PDF (.pdf).')
      return
    }

    setProcessandoArquivos(true)

    try {
      const novosItens = pdfFiles.map((file, idx) => {
        const parsed = parseBoletoFileName(file.name)
        const { morador, score } = matchMorador(parsed.spacedName, moradoresDoCondo)

        // Se data foi extraída, define vencimento; se for nov/2026, sugere competência
        let vencimento = parsed.date || ''
        if (!vencimento) {
          const hoje = new Date()
          hoje.setDate(hoje.getDate() + 5)
          vencimento = hoje.toISOString().split('T')[0]
        }

        const valorNum = parseFloat(valorPadrao.replace(/\./g, '').replace(',', '.')) || 265

        return {
          idTemp: `pdf_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
          file,
          fileName: file.name,
          spacedName: parsed.spacedName,
          nossoNumero: parsed.nossoNumero || '',
          moradorId: morador ? morador.id : '',
          moradorNome: morador ? morador.nome : parsed.spacedName,
          apt: morador ? (morador.apt || '') : '',
          bloco: morador ? (morador.bloco || '') : '',
          cpf: morador ? (morador.cpf || '') : '',
          tel: morador ? (morador.tel || morador.telefone || '') : '',
          vencimento,
          valor: valorNum,
          encontrado: !!(morador && score >= 0.4),
          score: score || 0
        }
      })

      // Se achou uma data na maioria dos arquivos, ajusta a competência
      const dataComum = novosItens.find(it => it.vencimento)?.vencimento
      if (dataComum && dataComum.includes('-')) {
        const [ano, mes] = dataComum.split('-')
        const dataObj = new Date(parseInt(ano), parseInt(mes) - 1, 1)
        const compStr = dataObj.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '/')
        setCompetencia(compStr)
      }

      setItens(prev => [...prev, ...novosItens])
    } catch (err) {
      console.error(err)
      alert('Erro ao interpretar os arquivos PDF: ' + err.message)
    } finally {
      setProcessandoArquivos(false)
    }
  }

  // Input de arquivo nativo
  const handleFileInputChange = (e) => {
    processarArquivos(e.target.files)
    e.target.value = null
  }

  // Drag and Drop
  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files) {
      processarArquivos(e.dataTransfer.files)
    }
  }

  // Remove um arquivo individual
  const handleRemoverItem = (idTemp) => {
    setItens(prev => prev.filter(it => it.idTemp !== idTemp))
  }

  // Atualiza um campo de um item
  const handleUpdateItem = (idTemp, campo, valor) => {
    setItens(prev => prev.map(item => {
      if (item.idTemp !== idTemp) return item

      if (campo === 'moradorSelect') {
        const moradorSel = moradoresDoCondo.find(m => m.id === valor)
        if (moradorSel) {
          return {
            ...item,
            moradorId: moradorSel.id,
            moradorNome: moradorSel.nome,
            apt: moradorSel.apt || item.apt,
            bloco: moradorSel.bloco || item.bloco,
            cpf: moradorSel.cpf || item.cpf,
            tel: moradorSel.tel || moradorSel.telefone || item.tel,
            encontrado: true,
            score: 1.0
          }
        } else {
          return {
            ...item,
            moradorId: '',
            encontrado: false
          }
        }
      }

      return { ...item, [campo]: valor }
    }))
  }

  // Aplicar mesmo valor para todos os itens
  const handleAplicarValorParaTodos = () => {
    const v = parseFloat(valorPadrao.replace(/\./g, '').replace(',', '.')) || 0
    if (v <= 0) {
      alert('Informe um valor padrão válido.')
      return
    }
    setItens(prev => prev.map(it => ({ ...it, valor: v })))
  }

  // Salvar e fazer upload dos PDFs
  const handleConfirmarImportacao = async () => {
    if (!condominioNome) {
      alert('Selecione o condomínio de destino.')
      return
    }
    if (itens.length === 0) {
      alert('Selecione pelo menos um arquivo PDF de boleto.')
      return
    }

    // Validação básica se todos possuem morador ou apartamento
    const semApt = itens.filter(it => !it.apt)
    if (semApt.length > 0) {
      const confirmar = window.confirm(
        `Existem ${semApt.length} boleto(s) sem o número do apartamento preenchido. Deseja prosseguir mesmo assim?`
      )
      if (!confirmar) return
    }

    setSalvando(true)
    const boletosSalvos = []
    const total = itens.length

    try {
      const cleanCondoFolder = norm(condominioNome).replace(/\s+/g, '_')

      for (let i = 0; i < itens.length; i++) {
        const item = itens[i]
        setProgresso({
          atual: i + 1,
          total,
          status: `Enviando PDF (${i + 1}/${total}): ${item.fileName}`
        })

        // 1. Upload do PDF para o Firebase Storage
        const cleanFileName = item.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const storagePath = `boletos_externos/${cleanCondoFolder}/${Date.now()}_${cleanFileName}`
        const storageRef = ref(storage, storagePath)

        const uploadSnap = await uploadBytes(storageRef, item.file, {
          contentType: 'application/pdf'
        })
        const downloadUrl = await getDownloadURL(uploadSnap.ref)

        // 2. Monta o registro de boleto para o Firestore
        const boletoData = {
          morador: item.moradorNome || 'Morador',
          moradorId: item.moradorId || null,
          apt: String(item.apt || '').trim(),
          bloco: item.bloco || '',
          condominio: condominioNome,
          condominioId: selectedCondo?.id || '',
          cpf: item.cpf || '',
          tel: item.tel || '',
          vencimento: item.vencimento,
          valor: Number(item.valor) || 0,
          status: 'Pendente',
          competencia: competencia || new Date().toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '/'),
          emitido: true,
          origem: 'importacao_pdf',
          _origem: 'importacao_pdf',
          nossoNumero: String(item.nossoNumero || '').trim(),
          url: downloadUrl,
          nomeArquivo: item.file.name,
          tipoCobranca: 'Taxa Condominial',
          dataEmissao: new Date().toISOString().split('T')[0]
        }

        boletosSalvos.push(boletoData)
      }

      setProgresso({
        atual: total,
        total,
        status: 'Salvando boletos no sistema...'
      })

      // Salva no Firestore através do callback onSave
      await onSave(boletosSalvos)

      alert(`🎉 Sucesso!\n\n${boletosSalvos.length} boletos em PDF foram importados e associados com sucesso aos moradores do "${condominioNome}".\n\nAo exportar o extrato OFX bancário, eles serão conciliados automaticamente!`)
      onClose()
    } catch (err) {
      console.error(err)
      alert('Erro durante a importação dos boletos: ' + (err.message || 'Tente novamente.'))
    } finally {
      setSalvando(false)
      setProgresso({ atual: 0, total: 0, status: '' })
    }
  }

  // Estatísticas
  const identificadosCount = itens.filter(it => it.encontrado).length
  const totalValor = itens.reduce((acc, it) => acc + (Number(it.valor) || 0), 0)

  return (
    <div 
      className="modal-overlay z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      onClick={!salvando ? onClose : undefined}
    >
      <div 
        className="modal-content max-w-4xl w-full bg-white rounded-3xl shadow-2xl border border-gray-200 flex flex-col max-h-[92vh] overflow-hidden animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50/50 via-white to-emerald-50/40">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-brand-600 text-white flex items-center justify-center font-bold shadow-md shadow-brand-500/20">
              <Upload size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-gray-900 text-lg">Importar Boletos em PDF</h3>
                <span className="text-[10px] font-bold bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full border border-brand-200">
                  Lote Inteligente
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Selecione os PDFs baixados do banco. O sistema identifica o morador, unidade e data para conciliação OFX.
              </p>
            </div>
          </div>
          {!salvando && (
            <button 
              onClick={onClose} 
              className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Configurações Globais do Lote */}
        <div className="p-5 border-b border-gray-100 bg-slate-50/60 flex flex-col gap-4 shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Condomínio */}
            <div>
              <label className="label text-xs font-bold text-gray-700 flex items-center gap-1.5 mb-1">
                <Building size={14} className="text-brand-600" />
                <span>Condomínio de Destino:</span>
              </label>
              <select 
                className="input text-xs font-bold bg-white w-full border-gray-300 focus:border-brand-500"
                value={condominioNome} 
                onChange={e => handleCondominioChange(e.target.value)}
                disabled={salvando}
              >
                {condominios.map(c => (
                  <option key={c.id || c.nome} value={c.nome}>
                    {c.nome}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-gray-500 mt-1">
                {moradoresDoCondo.length} moradores cadastrados neste residencial.
              </p>
            </div>

            {/* Mês / Competência */}
            <div>
              <label className="label text-xs font-bold text-gray-700 flex items-center gap-1.5 mb-1">
                <Calendar size={14} className="text-brand-600" />
                <span>Mês / Competência:</span>
              </label>
              <input 
                type="text" 
                className="input text-xs font-bold bg-white w-full" 
                value={competencia} 
                onChange={e => setCompetencia(e.target.value)} 
                placeholder="nov/2026"
                disabled={salvando}
              />
              <p className="text-[10px] text-gray-500 mt-1">Referência contábil da cobrança.</p>
            </div>

            {/* Valor Padrão da Cota */}
            <div>
              <label className="label text-xs font-bold text-gray-700 flex items-center justify-between mb-1">
                <span className="flex items-center gap-1.5">
                  <DollarSign size={14} className="text-emerald-600" />
                  <span>Valor Padrão (R$):</span>
                </span>
                {itens.length > 0 && (
                  <button 
                    type="button"
                    onClick={handleAplicarValorParaTodos}
                    className="text-[10px] text-brand-600 hover:text-brand-800 font-bold underline"
                    title="Aplica este valor em todas as linhas da tabela abaixo"
                  >
                    Aplicar a todos
                  </button>
                )}
              </label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  className="input text-xs font-bold bg-white w-full font-mono text-emerald-800" 
                  value={valorPadrao} 
                  onChange={e => setValorPadrao(e.target.value)} 
                  placeholder="265,00"
                  disabled={salvando}
                />
              </div>
              <p className="text-[10px] text-gray-500 mt-1">Cota padrão de condomínio.</p>
            </div>
          </div>

          {/* Área de Seleção / Dropzone de PDFs */}
          <div 
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all cursor-pointer ${
              dragOver 
                ? 'border-brand-500 bg-brand-50/50 scale-[0.99]' 
                : 'border-gray-300 hover:border-brand-400 bg-white hover:bg-slate-50/50'
            }`}
          >
            <input 
              type="file" 
              multiple 
              accept=".pdf" 
              className="hidden" 
              id="file-input-pdf-boletos"
              onChange={handleFileInputChange}
              disabled={salvando || processandoArquivos}
            />
            <label htmlFor="file-input-pdf-boletos" className="cursor-pointer flex flex-col items-center">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2 shadow-sm">
                {processandoArquivos ? (
                  <Loader2 size={24} className="animate-spin" />
                ) : (
                  <FileText size={24} />
                )}
              </div>
              <p className="text-xs font-black text-gray-800">
                Arraste todos os PDFs aqui ou <span className="text-brand-600 underline">clique para selecionar</span>
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Pode selecionar todos os boletos de uma vez (ex: Florence com 12 arquivos)
              </p>
            </label>
          </div>
        </div>

        {/* Tabela de Pré-visualização e Vínculo */}
        <div className="flex-1 overflow-y-auto p-5">
          {itens.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center text-gray-400">
              <FileText size={48} className="stroke-1 text-gray-300 mb-2" />
              <p className="text-sm font-bold text-gray-600">Nenhum boleto em PDF carregado</p>
              <p className="text-xs text-gray-400 max-w-md mt-1">
                Selecione os arquivos baixados do banco. O sistema cruzará automaticamente o nome do arquivo com a lista de moradores de <strong className="text-gray-700">{condominioNome}</strong>.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Barra de resumo */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-emerald-50 to-blue-50 border border-emerald-200/80 p-3 rounded-2xl text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-black text-gray-800 flex items-center gap-1.5">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    <span>{itens.length} boletos carregados</span>
                  </span>
                  <span className="text-emerald-800 font-bold bg-white/80 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[11px]">
                    {identificadosCount} de {itens.length} moradores vinculados
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 font-medium text-[11px]">Total Cobrado:</span>
                  <span className="font-mono font-black text-emerald-800 text-sm">
                    R$ {totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Tabela de arquivos com dropdown de moradores */}
              <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="max-h-[380px] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 font-bold sticky top-0 z-10">
                      <tr>
                        <th className="p-3 w-10 text-center">#</th>
                        <th className="p-3">Arquivo / Nosso Nº</th>
                        <th className="p-3">Morador no Sistema (Destino)</th>
                        <th className="p-3 w-24">Apt / Unid.</th>
                        <th className="p-3 w-32">Vencimento</th>
                        <th className="p-3 w-28">Valor (R$)</th>
                        <th className="p-3 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {itens.map((item, idx) => (
                        <tr key={item.idTemp} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-3 text-center text-gray-400 font-bold text-[11px]">
                            {idx + 1}
                          </td>

                          {/* Arquivo e Nosso Número */}
                          <td className="p-3">
                            <div className="font-bold text-gray-800 truncate max-w-[220px]" title={item.fileName}>
                              {item.fileName}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {item.nossoNumero ? (
                                <span className="font-mono text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">
                                  Nº {item.nossoNumero}
                                </span>
                              ) : (
                                <span className="text-[10px] text-gray-400">Sem Nosso Nº</span>
                              )}
                            </div>
                          </td>

                          {/* Morador Selecionado / Sugerido */}
                          <td className="p-3">
                            <div className="flex flex-col gap-1">
                              <select 
                                className={`input text-xs py-1 px-2 font-bold rounded-lg ${
                                  item.encontrado 
                                    ? 'bg-emerald-50/50 border-emerald-300 text-emerald-950 focus:border-emerald-500' 
                                    : 'bg-amber-50/50 border-amber-300 text-amber-950 focus:border-amber-500'
                                }`}
                                value={item.moradorId || ''}
                                onChange={e => handleUpdateItem(item.idTemp, 'moradorSelect', e.target.value)}
                                disabled={salvando}
                              >
                                <option value="">-- Selecione o Morador --</option>
                                {moradoresDoCondo.map(m => (
                                  <option key={m.id} value={m.id}>
                                    Apt {m.apt || 'S/N'} {m.bloco ? `(${m.bloco})` : ''} - {m.nome}
                                  </option>
                                ))}
                              </select>
                              
                              {/* Status do Match */}
                              <div className="flex items-center gap-1.5">
                                {item.encontrado ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                                    <Check size={11} className="text-emerald-600" />
                                    Identificado ({Math.round((item.score || 1) * 100)}%)
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600" title="Verifique o morador correspondente">
                                    <AlertCircle size={11} className="text-amber-500" />
                                    Nome no PDF: {item.spacedName}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Apartamento */}
                          <td className="p-3">
                            <input 
                              type="text"
                              className="input text-xs py-1 px-2 font-black text-gray-800 text-center rounded-lg"
                              value={item.apt}
                              onChange={e => handleUpdateItem(item.idTemp, 'apt', e.target.value)}
                              placeholder="101"
                              disabled={salvando}
                            />
                          </td>

                          {/* Vencimento */}
                          <td className="p-3">
                            <input 
                              type="date"
                              className="input text-xs py-1 px-2 font-bold text-gray-700 rounded-lg"
                              value={item.vencimento}
                              onChange={e => handleUpdateItem(item.idTemp, 'vencimento', e.target.value)}
                              disabled={salvando}
                            />
                          </td>

                          {/* Valor */}
                          <td className="p-3">
                            <input 
                              type="number"
                              step="0.01"
                              className="input text-xs py-1 px-2 font-mono font-bold text-emerald-700 rounded-lg text-right"
                              value={item.valor}
                              onChange={e => handleUpdateItem(item.idTemp, 'valor', parseFloat(e.target.value) || 0)}
                              disabled={salvando}
                            />
                          </td>

                          {/* Remover */}
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoverItem(item.idTemp)}
                              className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Remover arquivo"
                              disabled={salvando}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Barra de Progresso Durante Upload */}
        {salvando && (
          <div className="p-4 bg-indigo-50/70 border-t border-indigo-100 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-bold text-indigo-900">
              <span className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-indigo-600" />
                <span>{progresso.status || 'Processando boletos...'}</span>
              </span>
              <span>{progresso.atual} de {progresso.total}</span>
            </div>
            <div className="w-full bg-indigo-200/60 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(progresso.atual / (progresso.total || 1)) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Rodapé com Ações */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <button 
            type="button"
            onClick={onClose} 
            disabled={salvando} 
            className="btn-secondary text-xs"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-3">
            {itens.length > 0 && (
              <span className="text-xs text-gray-500 hidden sm:inline">
                {itens.length} boleto(s) pronto(s) para importação
              </span>
            )}

            <button
              type="button"
              onClick={handleConfirmarImportacao}
              disabled={salvando || itens.length === 0}
              className="btn-primary bg-indigo-600 hover:bg-indigo-500 text-xs font-black flex items-center gap-2 py-2.5 px-5 shadow-md shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {salvando ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Importando...</span>
                </>
              ) : (
                <>
                  <Upload size={15} />
                  <span>Importar e Salvar {itens.length > 0 ? `${itens.length} Boletos` : 'Boletos'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
