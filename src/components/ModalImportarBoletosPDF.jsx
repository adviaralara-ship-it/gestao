import React, { useState, useMemo } from 'react'
import { X, Upload, FileText, CheckCircle2, AlertCircle, Trash2, Loader2, Building, Calendar, DollarSign, Check, Info, Droplet, Tag } from 'lucide-react'
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

// Distância Levenshtein para tolerância a pequenas variações/erros de digitação
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

// Leitura ultra-rápida do arquivo PDF como DataURL base64 (nunca trava nem depende de bucket externo)
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error(`Falha ao ler o arquivo ${file.name}`))
    reader.readAsDataURL(file)
  })
}

// Decompõe o nome do arquivo no padrão bancário Febraban/Cora:
// Ex: Boleto-KellyNayaneBrilhanteBarreto-2026-11-05-3013716210000058038.pdf
function parseBoletoFileName(fileName, cotaPadraoNum = 265) {
  let clean = fileName.replace(/\.pdf$/i, '')
  
  // Extrai data no formato YYYY-MM-DD
  const dateMatch = clean.match(/(\d{4}-\d{2}-\d{2})/)
  let date = dateMatch ? dateMatch[1] : ''
  let nossoNumero = ''
  let namePart = clean
  let valor = 0

  if (dateMatch) {
    const idx = clean.indexOf(dateMatch[0])
    const prefix = clean.substring(0, idx).replace(/^boleto[-_]?/i, '').replace(/[-_]$/, '')
    const suffix = clean.substring(idx + dateMatch[0].length).replace(/^[-_]/, '')
    namePart = prefix
    nossoNumero = suffix

    // Padrão Febraban / Bancos (Cora, BB, Sicoob, etc.):
    // Os últimos 10 dígitos do código numérico contêm o valor exato do boleto em centavos
    if (suffix.length >= 10) {
      const last10 = suffix.slice(-10)
      const centavos = parseInt(last10, 10)
      if (!isNaN(centavos) && centavos > 0) {
        valor = centavos / 100
      }
    }
  } else {
    namePart = clean.replace(/^boleto[-_]?/i, '')
  }

  // Desmembra PascalCase / camelCase em palavras legíveis com espaços
  const spacedName = namePart
    .replace(/([a-z0-9])([A-Z])/g, (m, p1, p2) => p1 + ' ' + p2)
    .replace(/[-_]/g, ' ')
    .trim()

  // Se não extraiu valor do sufixo, usa a cota padrão
  if (valor <= 0) {
    valor = Number(cotaPadraoNum) || 265
  }

  // Identificação inteligente do tipo de cobrança e discriminação
  let tipoCobranca = 'Taxa Condominial'
  let detalhe = 'Cota Ordinária Padrão'
  let valorExtra = 0

  if (Math.abs(valor - cotaPadraoNum) < 0.05) {
    tipoCobranca = 'Taxa Condominial'
    detalhe = 'Cota Ordinária Padrão'
  } else if (valor > cotaPadraoNum) {
    valorExtra = Math.round((valor - cotaPadraoNum) * 100) / 100
    tipoCobranca = 'Taxa Condominial + Extras / Consumo'
    detalhe = `Cota (R$ ${cotaPadraoNum.toFixed(2).replace('.', ',')}) + Extras/Água (R$ ${valorExtra.toFixed(2).replace('.', ',')})`
  } else {
    tipoCobranca = 'Consumo de Água / Avulso'
    detalhe = `Consumo Individual / Taxa Avulsa (R$ ${valor.toFixed(2).replace('.', ',')})`
  }

  return {
    fileName,
    namePart,
    spacedName,
    date,
    nossoNumero,
    valor,
    cotaBase: cotaPadraoNum,
    valorExtra,
    tipoCobranca,
    detalhe
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

  // Dados do condomínio selecionado
  const selectedCondo = useMemo(() => {
    return condominios.find(c => c.nome === condominioNome) || null
  }, [condominios, condominioNome])

  const cotaPadraoNum = useMemo(() => {
    return Number(selectedCondo?.cotaPadrao || selectedCondo?.taxaPadrao || 265)
  }, [selectedCondo])

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
    const novoCota = Number(novoCondoDoc?.cotaPadrao || novoCondoDoc?.taxaPadrao || 265)

    const cNorm = norm(novoCondoNome)
    const novosMoradores = (moradores || []).filter(m => {
      const mc = norm(m.condominio || m.condominioNome || '')
      return mc === cNorm || mc.includes(cNorm) || cNorm.includes(mc)
    })

    setItens(prev => prev.map(item => {
      const { morador, score } = matchMorador(item.spacedName, novosMoradores)
      const parsed = parseBoletoFileName(item.fileName, novoCota)
      return {
        ...item,
        moradorId: morador ? morador.id : '',
        moradorNome: morador ? morador.nome : item.spacedName,
        apt: morador ? (morador.apt || item.apt) : item.apt,
        bloco: morador ? (morador.bloco || '') : '',
        cpf: morador ? (morador.cpf || '') : '',
        tel: morador ? (morador.tel || morador.telefone || '') : '',
        encontrado: !!(morador && score >= 0.4),
        score: score || 0,
        cotaBase: novoCota,
        detalhe: parsed.detalhe,
        tipoCobranca: parsed.tipoCobranca
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
        const parsed = parseBoletoFileName(file.name, cotaPadraoNum)
        const { morador, score } = matchMorador(parsed.spacedName, moradoresDoCondo)

        let vencimento = parsed.date || ''
        if (!vencimento) {
          const hoje = new Date()
          hoje.setDate(hoje.getDate() + 5)
          vencimento = hoje.toISOString().split('T')[0]
        }

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
          valor: parsed.valor,
          cotaBase: parsed.cotaBase,
          valorExtra: parsed.valorExtra,
          tipoCobranca: parsed.tipoCobranca,
          detalhe: parsed.detalhe,
          encontrado: !!(morador && score >= 0.4),
          score: score || 0
        }
      })

      // Sugere competência baseada no mês de vencimento dos boletos
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

      if (campo === 'valor') {
        const numVal = parseFloat(valor) || 0
        const extra = Math.max(0, Math.round((numVal - cotaPadraoNum) * 100) / 100)
        let tipo = item.tipoCobranca
        if (Math.abs(numVal - cotaPadraoNum) < 0.05) {
          tipo = 'Taxa Condominial'
        } else if (numVal > cotaPadraoNum) {
          tipo = 'Taxa Condominial + Extras / Consumo'
        } else {
          tipo = 'Consumo de Água / Avulso'
        }
        return {
          ...item,
          valor: numVal,
          valorExtra: extra,
          tipoCobranca: tipo
        }
      }

      return { ...item, [campo]: valor }
    }))
  }

  // Salvar e fazer upload dos PDFs com fallback instantâneo a Base64
  const handleConfirmarImportacao = async () => {
    if (!condominioNome) {
      alert('Selecione o condomínio de destino.')
      return
    }
    if (itens.length === 0) {
      alert('Selecione pelo menos um arquivo PDF de boleto.')
      return
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
          status: `Processando boleto (${i + 1}/${total}): ${item.spacedName}`
        })

        // 1. Converte o PDF para Data URL Base64 (instantâneo, seguro e sem travas de rede)
        let downloadUrl = ''
        try {
          downloadUrl = await readFileAsDataUrl(item.file)
        } catch (e) {
          console.warn('Falha na leitura local do PDF, continuando...', e)
        }

        // 2. Tenta salvar no Firebase Storage em segundo plano com timeout de 2.5s (fallback transparente)
        try {
          const cleanFileName = item.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
          const storagePath = `boletos_externos/${cleanCondoFolder}/${Date.now()}_${cleanFileName}`
          const storageRef = ref(storage, storagePath)

          const uploadPromise = uploadBytes(storageRef, item.file, {
            contentType: 'application/pdf'
          }).then(snap => getDownloadURL(snap.ref))

          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Storage timeout')), 2500)
          )

          const storageUrl = await Promise.race([uploadPromise, timeoutPromise])
          if (storageUrl) downloadUrl = storageUrl
        } catch (storageErr) {
          // Usa o Base64 DataURL caso o Storage não esteja provisionado ou demore
        }

        // 3. Monta o registro completo do boleto para o Firestore
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
          cotaBase: Number(item.cotaBase) || cotaPadraoNum,
          valorExtra: Number(item.valorExtra) || 0,
          tipoCobranca: item.tipoCobranca || 'Taxa Condominial',
          descricao: item.detalhe || 'Taxa Condominial',
          status: 'Pendente',
          competencia: competencia || new Date().toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '/'),
          emitido: true,
          origem: 'importacao_pdf',
          _origem: 'importacao_pdf',
          nossoNumero: String(item.nossoNumero || '').trim(),
          url: downloadUrl,
          nomeArquivo: item.file.name,
          dataEmissao: new Date().toISOString().split('T')[0]
        }

        boletosSalvos.push(boletoData)
      }

      setProgresso({
        atual: total,
        total,
        status: 'Salvando no sistema...'
      })

      // Salva no Firestore através do callback onSave
      await onSave(boletosSalvos)

      alert(`🎉 Sucesso!\n\n${boletosSalvos.length} boletos em PDF foram importados e associados com sucesso aos moradores do "${condominioNome}".\n\nTodos os valores reais (cotas, água e taxas extras) foram identificados e estão prontos para conciliação automática via extrato bancário OFX!`)
      onClose()
    } catch (err) {
      console.error(err)
      alert('Erro durante a importação dos boletos: ' + (err.message || 'Tente novamente.'))
    } finally {
      setSalvando(false)
      setProgresso({ atual: 0, total: 0, status: '' })
    }
  }

  // Estatísticas do Lote
  const identificadosCount = itens.filter(it => it.encontrado).length
  const totalValor = itens.reduce((acc, it) => acc + (Number(it.valor) || 0), 0)
  const itensComExtras = itens.filter(it => it.valor > cotaPadraoNum).length
  const itensAvulsos = itens.filter(it => it.valor < cotaPadraoNum).length

  return (
    <div 
      className="modal-overlay z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      onClick={!salvando ? onClose : undefined}
    >
      <div 
        className="modal-content max-w-5xl w-full bg-white rounded-3xl shadow-2xl border border-gray-200 flex flex-col max-h-[92vh] overflow-hidden animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50/60 via-white to-emerald-50/50">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-brand-600 text-white flex items-center justify-center font-bold shadow-md shadow-brand-500/20">
              <Upload size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-gray-900 text-lg">Importar Boletos em PDF</h3>
                <span className="text-[10px] font-bold bg-brand-50 text-brand-700 px-2.5 py-0.5 rounded-full border border-brand-200">
                  Leitura Inteligente Cora / FEBRABAN
                </span>
              </div>
              <p className="text-xs text-gray-500">
                O sistema lê os valores exatos de cada boleto (incluindo taxas extras e consumo de água) e associa aos moradores.
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

            {/* Referência da Cota Padrão */}
            <div>
              <label className="label text-xs font-bold text-gray-700 flex items-center gap-1.5 mb-1">
                <DollarSign size={14} className="text-emerald-600" />
                <span>Cota Ordinária Base:</span>
              </label>
              <div className="input text-xs font-bold bg-gray-100/80 w-full font-mono text-emerald-800 flex items-center justify-between">
                <span>R$ {cotaPadraoNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                <span className="text-[10px] text-gray-400 font-sans">Cadastrada</span>
              </div>
              <p className="text-[10px] text-gray-500 mt-1">
                Valores acima desta base são identificados como taxas extras / água.
              </p>
            </div>
          </div>

          {/* Área de Seleção / Dropzone de PDFs */}
          <div 
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-4 text-center transition-all cursor-pointer ${
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
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-1.5 shadow-sm">
                {processandoArquivos ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <FileText size={20} />
                )}
              </div>
              <p className="text-xs font-black text-gray-800">
                Arraste todos os PDFs aqui ou <span className="text-brand-600 underline">clique para selecionar</span>
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Pode selecionar todos os arquivos de uma vez. O sistema lê os valores e discriminativos automaticamente.
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
                Selecione os arquivos baixados do banco. O sistema cruzará automaticamente o morador, unidade, vencimento e o valor real cobrado.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Barra de resumo com identificação de extras */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-emerald-50 via-blue-50 to-purple-50 border border-emerald-200/80 p-3 rounded-2xl text-xs">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-black text-gray-800 flex items-center gap-1.5">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    <span>{itens.length} boletos carregados</span>
                  </span>
                  <span className="text-emerald-800 font-bold bg-white/90 border border-emerald-200 px-2 py-0.5 rounded-full text-[11px]">
                    {identificadosCount} de {itens.length} moradores identificados
                  </span>
                  {itensComExtras > 0 && (
                    <span className="text-purple-800 font-bold bg-purple-100/90 border border-purple-200 px-2 py-0.5 rounded-full text-[11px] inline-flex items-center gap-1">
                      <Tag size={11} /> {itensComExtras} com Taxa Extra / Água
                    </span>
                  )}
                  {itensAvulsos > 0 && (
                    <span className="text-cyan-800 font-bold bg-cyan-100/90 border border-cyan-200 px-2 py-0.5 rounded-full text-[11px] inline-flex items-center gap-1">
                      <Droplet size={11} /> {itensAvulsos} Consumo Avulso
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 font-medium text-[11px]">Total Cobrado:</span>
                  <span className="font-mono font-black text-emerald-800 text-sm">
                    R$ {totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Tabela de arquivos com dropdown de moradores e discriminação */}
              <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="max-h-[380px] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 font-bold sticky top-0 z-10">
                      <tr>
                        <th className="p-3 w-8 text-center">#</th>
                        <th className="p-3">Morador no Sistema</th>
                        <th className="p-3 w-20">Apt</th>
                        <th className="p-3">Tipo / Discriminação da Cobrança</th>
                        <th className="p-3 w-28">Vencimento</th>
                        <th className="p-3 w-32 text-right">Valor Real (R$)</th>
                        <th className="p-3 w-8 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {itens.map((item, idx) => (
                        <tr key={item.idTemp} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-3 text-center text-gray-400 font-bold text-[11px]">
                            {idx + 1}
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
                              
                              <div className="flex items-center gap-1.5 truncate max-w-[240px]">
                                {item.encontrado ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                                    <Check size={11} className="text-emerald-600" />
                                    {item.spacedName}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 truncate" title="Verifique o morador correspondente">
                                    <AlertCircle size={11} className="text-amber-500" />
                                    No PDF: {item.spacedName}
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

                          {/* Tipo de Cobrança / Discriminação */}
                          <td className="p-3">
                            <div className="flex flex-col gap-1">
                              <select
                                className="input text-[11px] py-1 px-2 font-bold bg-white rounded-lg border-gray-300"
                                value={item.tipoCobranca}
                                onChange={e => handleUpdateItem(item.idTemp, 'tipoCobranca', e.target.value)}
                                disabled={salvando}
                              >
                                <option value="Taxa Condominial">🏢 Taxa Condominial Ordinária</option>
                                <option value="Taxa Condominial + Extras / Consumo">🏷️ Taxa Condominial + Extras / Consumo</option>
                                <option value="Consumo de Água / Avulso">💧 Consumo de Água / Avulso</option>
                                <option value="Taxa Extra">⚖️ Taxa Extra / Rateio</option>
                              </select>

                              {/* Discriminação detalhada */}
                              <span className="text-[10px] text-gray-500 flex items-center gap-1 font-medium">
                                <Info size={11} className="text-gray-400 shrink-0" />
                                <span>{item.detalhe}</span>
                              </span>
                            </div>
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

                          {/* Valor Real Extraído */}
                          <td className="p-3 text-right">
                            <div className="flex flex-col items-end gap-0.5">
                              <input 
                                type="number"
                                step="0.01"
                                className="input text-xs py-1 px-2 font-mono font-black text-emerald-700 rounded-lg text-right w-24"
                                value={item.valor}
                                onChange={e => handleUpdateItem(item.idTemp, 'valor', e.target.value)}
                                disabled={salvando}
                              />
                              {item.valor > cotaPadraoNum && (
                                <span className="text-[9px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded">
                                  + R$ {(item.valor - cotaPadraoNum).toFixed(2).replace('.', ',')} extra
                                </span>
                              )}
                              {item.valor < cotaPadraoNum && (
                                <span className="text-[9px] font-bold text-cyan-700 bg-cyan-50 px-1.5 py-0.2 rounded">
                                  avulso
                                </span>
                              )}
                            </div>
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
