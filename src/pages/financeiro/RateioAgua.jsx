import React, { useState, useEffect, useMemo, useRef } from 'react'
import { 
  Droplet, Upload, Camera, Sparkles, Plus, Trash2, Save, FileSpreadsheet, 
  CheckCircle2, AlertCircle, History, Calendar, Calculator, Download, ArrowRight,
  Loader2, RefreshCw, Layers, DollarSign, Eye, Building2, User
} from 'lucide-react'
import { useFirestore } from '../../hooks/useFirestore'
import { CurrencyInput, maskCurrency } from '../../utils/currency'
import { storage } from '../../firebase'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'

export default function RateioAgua({ lancamentos, condoFilter, condominiosDisponiveis = [] }) {
  const { items: condominios = [] } = useFirestore('condominios')
  const { items: allMoradoresDocs = [] } = useFirestore('moradores')
  const { items: allUsuariosDocs = [] } = useFirestore('usuarios')
  const { items: rateiosHistorico = [], addItem: addRateio, updateItem: updateRateio, deleteItem: deleteRateio } = useFirestore('rateios_agua')
  const { addItem: addLancamento } = useFirestore('financeiro_lancamentos')
  const { addItem: addBoleto } = useFirestore('boletos')

  const fileInputRef = useRef(null)

  // Mês e condomínio selecionados
  const hoje = new Date()
  const mesAtualStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  const [competencia, setCompetencia] = useState(mesAtualStr)
  
  // Normalizador de condomínio
  const normalize = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()

  const [condominio, setCondominio] = useState(() => {
    if (condoFilter && condoFilter !== 'Todos' && !condoFilter.includes('Alpha')) return condoFilter
    return condominios[0]?.nome || 'Residencial Florence'
  })

  useEffect(() => {
    if (condoFilter && condoFilter !== 'Todos' && !condoFilter.includes('Alpha')) {
      setCondominio(condoFilter)
    }
  }, [condoFilter])

  // Unificação de moradores daquele condomínio
  const moradoresDoCondo = useMemo(() => {
    const lista = [...allMoradoresDocs]
    const emailsExistentes = new Set(lista.map(m => (m.email || '').toLowerCase().trim()).filter(Boolean))
    const telefonesExistentes = new Set(lista.map(m => String(m.tel || '').replace(/\D/g, '')).filter(Boolean))

    ;(allUsuariosDocs || []).forEach(u => {
      const uEmail = (u.email || '').toLowerCase().trim()
      const uTel = String(u.telefone || u.tel || '').replace(/\D/g, '')
      const uRole = u.role || 'Morador'
      const isPerfilMorador = ['Morador', 'Proprietário', 'Inquilino', 'Dependente', 'Síndico', 'Subsíndico', 'Conselheiro'].includes(uRole)
      const temLocalizacao = u.condominio && (u.unidade || u.apt)

      if (isPerfilMorador || temLocalizacao) {
        const jaCadastrado = (uEmail && emailsExistentes.has(uEmail)) || (uTel && telefonesExistentes.has(uTel))
        if (!jaCadastrado) {
          const aptLimpo = String(u.unidade || u.apt || '').replace(/^(apto\.?|apt\.?|unidade)\s*/i, '').trim()
          lista.push({
            id: `usr_${u.id}`,
            nome: u.nome || 'Morador',
            tel: u.telefone || u.tel || '',
            condominio: u.condominio || '',
            apt: aptLimpo || '1',
            status: u.statusMorador || (uRole === 'Morador' ? 'Proprietário' : uRole)
          })
        }
      }
    })

    const cTarget = normalize(condominio)
    return lista.filter(m => {
      if (!condominio) return true
      const cM = normalize(m.condominio)
      const cMN = normalize(m.condominioNome)
      return cM === cTarget || cMN === cTarget || (cM && cTarget && (cM.includes(cTarget) || cTarget.includes(cM)))
    })
  }, [allMoradoresDocs, allUsuariosDocs, condominio])

  // Parâmetros da Conta de Água
  const [dataMedicao, setDataMedicao] = useState(() => new Date().toISOString().split('T')[0])
  const [vencimentoConta, setVencimentoConta] = useState(() => {
    const d = new Date()
    d.setDate(15)
    return d.toISOString().split('T')[0]
  })
  const [valorTotalConta, setValorTotalConta] = useState('')
  const [consumoMinimoFranquia, setConsumoMinimoFranquia] = useState('10') // m3 padrão de franquia (ex: 10m3 por apto)
  const [imagemContaUrl, setImagemContaUrl] = useState('')
  const [isOcrProcessing, setIsOcrProcessing] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [mensagemSucesso, setMensagemSucesso] = useState('')

  // Lista de linhas por apartamento
  const [linhas, setLinhas] = useState([])

  // Busca histórico do mês anterior para preenchimento da leitura anterior
  const rateioMesAnterior = useMemo(() => {
    if (!condominio || !competencia) return null
    const [ano, mesNum] = competencia.split('-').map(Number)
    const dataRef = new Date(ano, mesNum - 2, 1) // 1 mês antes
    const compAnt = `${dataRef.getFullYear()}-${String(dataRef.getMonth() + 1).padStart(2, '0')}`

    return rateiosHistorico.find(r => 
      normalize(r.condominio) === normalize(condominio) && r.competencia === compAnt
    )
  }, [rateiosHistorico, condominio, competencia])

  // Rateio gravado deste mês atual (se já existir)
  const rateioGravadoAtual = useMemo(() => {
    return rateiosHistorico.find(r => 
      normalize(r.condominio) === normalize(condominio) && r.competencia === competencia
    )
  }, [rateiosHistorico, condominio, competencia])

  // Carrega ou inicializa as linhas de apartamentos
  useEffect(() => {
    // 1. Se já existe um rateio gravado para este mês e condomínio, carrega ele
    if (rateioGravadoAtual) {
      setValorTotalConta(rateioGravadoAtual.valorTotalConta || '')
      setDataMedicao(rateioGravadoAtual.dataMedicao || new Date().toISOString().split('T')[0])
      setVencimentoConta(rateioGravadoAtual.vencimentoConta || '')
      setConsumoMinimoFranquia(rateioGravadoAtual.consumoMinimoFranquia || '10')
      setImagemContaUrl(rateioGravadoAtual.imagemContaUrl || '')
      if (Array.isArray(rateioGravadoAtual.linhas) && rateioGravadoAtual.linhas.length > 0) {
        setLinhas(rateioGravadoAtual.linhas)
        return
      }
    }

    // 2. Caso contrário, monta a grade baseada nos apartamentos cadastrados do condomínio
    const mapApts = new Map()
    moradoresDoCondo.forEach(m => {
      const aptKey = String(m.apt || m.unidade || '').replace(/^(apto\.?|apt\.?)\s*/i, '').trim()
      if (!aptKey) return
      if (!mapApts.has(aptKey)) {
        mapApts.set(aptKey, {
          apt: aptKey,
          morador: m.nome,
          vinculo: m.status || m.tipo || 'Proprietário',
          tel: m.tel || ''
        })
      }
    })

    // Lista ordenada de apartamentos
    const aptsList = Array.from(mapApts.values()).sort((a, b) => 
      a.apt.localeCompare(b.apt, undefined, { numeric: true })
    )

    // Se não tiver nenhum apartamento cadastrado ainda no condomínio, cria modelo padrão (101, 102, 201...)
    const aptsBase = aptsList.length > 0 ? aptsList : [
      { apt: '101', morador: 'Morador 101', vinculo: 'Proprietário' },
      { apt: '102', morador: 'Morador 102', vinculo: 'Proprietário' },
      { apt: '201', morador: 'Morador 201', vinculo: 'Proprietário' },
      { apt: '202', morador: 'Morador 202', vinculo: 'Proprietário' },
      { apt: '203', morador: 'Morador 203', vinculo: 'Proprietário' },
      { apt: '204', morador: 'Morador 204', vinculo: 'Proprietário' },
      { apt: '301', morador: 'Morador 301', vinculo: 'Inquilino' },
      { apt: '302', morador: 'Morador 302', vinculo: 'Proprietário' },
      { apt: '303', morador: 'Morador 303', vinculo: 'Proprietário' },
      { apt: '304', morador: 'Morador 304', vinculo: 'Proprietário' }
    ]

    // Pega leituras anteriores salvas no mês anterior (se houver)
    const leiturasMesAnteriorMap = new Map()
    if (rateioMesAnterior?.linhas) {
      rateioMesAnterior.linhas.forEach(l => {
        leiturasMesAnteriorMap.set(String(l.apt).trim(), Number(l.leituraAtual || 0))
      })
    }

    const novasLinhas = aptsBase.map(a => {
      const leituraAnt = leiturasMesAnteriorMap.get(a.apt) !== undefined 
        ? leiturasMesAnteriorMap.get(a.apt) 
        : ''

      return {
        apt: a.apt,
        morador: a.morador || '',
        vinculo: a.vinculo || 'Proprietário',
        tel: a.tel || '',
        leituraAnterior: leituraAnt,
        leituraAtual: '',
        consumoM3: 0,
        excessoM3: 0,
        observacao: a.vinculo === 'Inquilino' ? 'Alugado' : ''
      }
    })

    setLinhas(novasLinhas)
  }, [rateioGravadoAtual, moradoresDoCondo, rateioMesAnterior, condomínio])

  // Atualiza um campo de uma linha específica
  const handleUpdateLinha = (idx, campo, valor) => {
    setLinhas(prev => {
      const clone = [...prev]
      const linha = { ...clone[idx], [campo]: valor }

      // Recalcula consumo e excesso dinamicamente
      const ant = parseFloat(String(linha.leituraAnterior || '').replace(',', '.')) || 0
      const atu = parseFloat(String(linha.leituraAtual || '').replace(',', '.')) || 0
      const franq = parseFloat(String(consumoMinimoFranquia || '10').replace(',', '.')) || 10

      if (linha.leituraAtual !== '' && linha.leituraAtual !== null && !isNaN(atu)) {
        const cons = Math.max(0, Number((atu - ant).toFixed(2)))
        linha.consumoM3 = cons
        linha.excessoM3 = Math.max(0, Number((cons - franq).toFixed(2)))
      } else {
        linha.consumoM3 = 0
        linha.excessoM3 = 0
      }

      clone[idx] = linha
      return clone
    })
  }

  // Adicionar novo apartamento manualmente
  const handleAddLinha = () => {
    const proximoNum = linhas.length > 0 ? `${Number(linhas[linhas.length - 1].apt || 0) + 1 || ''}` : '101'
    setLinhas(prev => [
      ...prev,
      {
        apt: proximoNum,
        morador: '',
        vinculo: 'Proprietário',
        tel: '',
        leituraAnterior: '',
        leituraAtual: '',
        consumoM3: 0,
        excessoM3: 0,
        observacao: ''
      }
    ])
  }

  const handleRemoveLinha = (idx) => {
    setLinhas(prev => prev.filter((_, i) => i !== idx))
  }

  // Cálculos consolidados do rateio
  const totais = useMemo(() => {
    const vTotal = typeof valorTotalConta === 'number' 
      ? valorTotalConta 
      : (parseFloat(String(valorTotalConta || '').replace(/\./g, '').replace(',', '.')) || 0)

    const somaConsumoM3 = linhas.reduce((acc, l) => acc + (Number(l.consumoM3) || 0), 0)
    const somaExcessoM3 = linhas.reduce((acc, l) => acc + (Number(l.excessoM3) || 0), 0)
    const qtdUnidades = linhas.length

    // Divisão do rateio:
    // Custo por m³ real = valorTotal / consumoTotal (se consumo total > 0)
    // Se o consumo for 0, rateia por igual entre os apartamentos
    const valorPorM3 = somaConsumoM3 > 0 ? (vTotal / somaConsumoM3) : 0
    const valorCotaFixa = qtdUnidades > 0 ? (vTotal / qtdUnidades) : 0

    return {
      vTotal,
      somaConsumoM3: Number(somaConsumoM3.toFixed(2)),
      somaExcessoM3: Number(somaExcessoM3.toFixed(2)),
      qtdUnidades,
      valorPorM3,
      valorCotaFixa
    }
  }, [valorTotalConta, linhas])

  // Upload e Processamento Inteligente com OCR da Conta de Água ou Planilha
  const handleUploadConta = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setIsOcrProcessing(true)
    try {
      // 1. Upload da imagem para o Firebase Storage
      let urlArmazenada = ''
      try {
        const storageRef = ref(storage, `contas_agua/${Date.now()}_${file.name}`)
        const snap = await uploadBytes(storageRef, file)
        urlArmazenada = await getDownloadURL(snap.ref)
        setImagemContaUrl(urlArmazenada)
      } catch (errStorage) {
        console.warn('Falha no upload do Storage, prosseguindo com base64 direto:', errStorage)
      }

      // 2. Converte para Base64 para análise visual da IA
      const reader = new FileReader()
      reader.onload = async (ev) => {
        try {
          const base64 = ev.target.result
          const res = await fetch('/api/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              file: base64,
              mimeType: file.type || 'image/jpeg',
              type: 'rateio_agua'
            })
          })

          const dataRes = await res.json()
          if (dataRes && dataRes.success && dataRes.data) {
            const extraido = dataRes.data

            // Se extraiu valor total da fatura
            if (extraido.valorTotal && Number(extraido.valorTotal) > 0) {
              setValorTotalConta(Number(extraido.valorTotal))
            }
            if (extraido.vencimento) {
              setVencimentoConta(extraido.vencimento)
            }

            // Se extraiu leituras por apartamento da planilha
            if (Array.isArray(extraido.leituras) && extraido.leituras.length > 0) {
              const mapaLidas = new Map()
              extraido.leituras.forEach(l => {
                const k = String(l.apt || '').trim()
                if (k) mapaLidas.set(k, l)
              })

              setLinhas(prev => {
                return prev.map(item => {
                  const lida = mapaLidas.get(String(item.apt).trim())
                  if (!lida) return item
                  const ant = lida.leituraAnterior !== undefined ? lida.leituraAnterior : item.leituraAnterior
                  const atu = lida.leituraAtual !== undefined ? lida.leituraAtual : item.leituraAtual
                  const cons = lida.consumoM3 !== undefined ? lida.consumoM3 : Math.max(0, Number((atu - ant).toFixed(2)))
                  const exc = lida.excessoM3 !== undefined ? lida.excessoM3 : 0
                  return {
                    ...item,
                    leituraAnterior: ant,
                    leituraAtual: atu,
                    consumoM3: cons,
                    excessoM3: exc,
                    observacao: lida.observacao || item.observacao
                  }
                })
              })

              alert(`✅ Extração visual concluída!\n\nIdentificamos ${extraido.leituras.length} leituras de hidrômetros e aplicamos os valores na tabela com sucesso.`)
            } else if (extraido.valorTotal) {
              alert(`✅ Conta de água identificada!\nValor Total: R$ ${maskCurrency(extraido.valorTotal)}\nVencimento: ${extraido.vencimento || 'Identificado'}`)
            }
          } else {
            alert('A imagem foi anexada. Você pode digitar ou conferir os valores diretamente na tabela abaixo.')
          }
        } catch (ocrErr) {
          console.warn('Erro ao processar OCR da imagem:', ocrErr)
          alert('Imagem anexada com sucesso. Preencha os campos para conferir o rateio.')
        } finally {
          setIsOcrProcessing(false)
        }
      }
      reader.readAsDataURL(file)
    } catch (err) {
      console.error(err)
      setIsOcrProcessing(false)
      alert(`Erro no upload: ${err.message}`)
    }
  }

  // Salvar no Banco de Dados (coleção rateios_agua) para o histórico e relatórios
  const handleSalvarRateio = async () => {
    if (!condominio) return alert('Selecione o condomínio.')
    if (linhas.length === 0) return alert('Insira pelo menos 1 unidade para o rateio.')

    setSalvando(true)
    try {
      // Calcula o valor a pagar de cada apartamento
      const linhasCalculadas = linhas.map(l => {
        let valorApto = 0
        if (totais.somaConsumoM3 > 0) {
          valorApto = Number(((Number(l.consumoM3) || 0) * totais.valorPorM3).toFixed(2))
        } else {
          valorApto = Number(totais.valorCotaFixa.toFixed(2))
        }

        return {
          ...l,
          valorRateio: valorApto
        }
      })

      const dadosParaSalvar = {
        condominio,
        competencia,
        dataMedicao,
        vencimentoConta,
        valorTotalConta: totais.vTotal,
        consumoTotalM3: totais.somaConsumoM3,
        excessoTotalM3: totais.somaExcessoM3,
        consumoMinimoFranquia: Number(consumoMinimoFranquia) || 10,
        imagemContaUrl,
        qtdUnidades: linhas.length,
        linhas: linhasCalculadas,
        _updatedAt: new Date().toISOString()
      }

      if (rateioGravadoAtual?.id) {
        await updateRateio(rateioGravadoAtual.id, dadosParaSalvar)
      } else {
        await addRateio({
          ...dadosParaSalvar,
          _createdAt: new Date().toISOString()
        })
      }

      setMensagemSucesso(`✅ Medição e Rateio de Água do ${condominio} (${competencia}) salvos com sucesso!`)
      setTimeout(() => setMensagemSucesso(''), 5000)
    } catch (err) {
      console.error(err)
      alert(`Erro ao salvar medição: ${err.message}`)
    } finally {
      setSalvando(false)
    }
  }

  // Gerar Lançamentos no Financeiro ou Boletos Individuais de Água
  const handleGerarBoletosAgua = async () => {
    if (totais.vTotal <= 0) return alert('Informe o valor total da fatura antes de gerar as cobranças.')
    if (!vencimentoConta) return alert('Defina a data de vencimento das cotas.')

    if (!window.confirm(`Deseja gerar os boletos/lançamentos de água para as ${linhas.length} unidades do ${condominio} referente à competência ${competencia}?`)) {
      return
    }

    setSalvando(true)
    try {
      let gerados = 0
      for (const l of linhas) {
        let valApto = totais.somaConsumoM3 > 0 
          ? Number(((Number(l.consumoM3) || 0) * totais.valorPorM3).toFixed(2))
          : Number(totais.valorCotaFixa.toFixed(2))

        if (valApto <= 0) continue

        // 1. Cria cobrança no contas a receber / boletos
        await addBoleto({
          morador: l.morador || `Morador Apt ${l.apt}`,
          apt: l.apt,
          condominio,
          tipoCobranca: 'Consumo de Água',
          tipoMorador: l.vinculo || 'Proprietário',
          competencia,
          vencimento: vencimentoConta,
          valor: valApto,
          status: 'Pendente',
          emitido: true,
          observacao: `Consumo: ${l.consumoM3} m³ | Excesso: ${l.excessoM3} m³`,
          _createdAt: new Date().toISOString()
        })

        // 2. Lança no financeiro geral como receita prevista
        await addLancamento({
          descricao: `Rateio de Água - Apt ${l.apt} (${l.morador || l.vinculo}) - ${l.consumoM3} m³`,
          tipo: 'Receita',
          categoria: 'Taxa de Água',
          valor: valApto,
          data: vencimentoConta,
          condominio,
          status: 'Pendente'
        })

        gerados++
      }

      alert(`🎉 Sucesso! Foram geradas ${gerados} cobranças individuais de água no módulo de Boletos e Contas a Receber.`)
    } catch (err) {
      console.error(err)
      alert(`Erro ao gerar cobranças: ${err.message}`)
    } finally {
      setSalvando(false)
    }
  }

  const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-7xl mx-auto pb-10">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-pale-300 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-cyan-100 text-cyan-700 flex items-center justify-center shrink-0">
            <Droplet size={26} className="fill-cyan-500 text-cyan-700" />
          </div>
          <div>
            <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
              Rateio Individual de Água por Hidrômetro
            </h3>
            <p className="text-xs text-gray-500 font-medium">
              Leituras mensais, cálculo automático de excesso por unidade e prestação de contas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isOcrProcessing}
            className="flex items-center gap-2 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer disabled:opacity-50"
            title="Importar foto da conta da concessionária ou planilha de medição"
          >
            {isOcrProcessing ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {isOcrProcessing ? 'Lendo Imagem com IA...' : 'Ler Conta / Planilha por Imagem'}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleUploadConta}
            accept="image/*,application/pdf"
            className="hidden"
          />

          <button
            onClick={handleSalvarRateio}
            disabled={salvando}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {salvando ? 'Salvando...' : 'Gravar Medição no Histórico'}
          </button>
        </div>
      </div>

      {mensagemSucesso && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-xs animate-fade-in">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>{mensagemSucesso}</span>
        </div>
      )}

      {/* Painel de Filtros e Parâmetros */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-5 rounded-2xl border border-pale-300 shadow-sm">
        <div>
          <label className="label text-xs font-black">Condomínio *</label>
          <select 
            className="input text-xs font-bold w-full bg-slate-50" 
            value={condominio} 
            onChange={e => setCondominio(e.target.value)}
          >
            {condominios.map(c => (
              <option key={c.id || c.nome} value={c.nome}>🏢 {c.nome}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label text-xs font-black">Mês de Referência (Competência) *</label>
          <input 
            type="month" 
            className="input text-xs font-bold w-full bg-slate-50" 
            value={competencia} 
            onChange={e => setCompetencia(e.target.value)} 
          />
        </div>

        <div>
          <label className="label text-xs font-black">Valor Total da Conta de Água (R$) *</label>
          <CurrencyInput 
            value={valorTotalConta} 
            onChange={v => setValorTotalConta(v)} 
            placeholder="0,00" 
          />
        </div>

        <div>
          <label className="label text-xs font-black">Vencimento da Cobrança *</label>
          <input 
            type="date" 
            className="input text-xs font-bold w-full bg-slate-50" 
            value={vencimentoConta} 
            onChange={e => setVencimentoConta(e.target.value)} 
          />
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="card bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-gray-500 uppercase">Valor da Fatura</span>
          <span className="text-xl sm:text-2xl font-black text-blue-700 mt-1">R$ {fmt(totais.vTotal)}</span>
          <span className="text-[10px] text-gray-400 mt-0.5">Conta Concessionária</span>
        </div>

        <div className="card bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-gray-500 uppercase">Consumo Total Medido</span>
          <span className="text-xl sm:text-2xl font-black text-cyan-700 mt-1">{totais.somaConsumoM3} m³</span>
          <span className="text-[10px] text-gray-400 mt-0.5">Soma dos hidrômetros</span>
        </div>

        <div className="card bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-gray-500 uppercase">Excesso Total</span>
          <span className="text-xl sm:text-2xl font-black text-amber-600 mt-1">{totais.somaExcessoM3} m³</span>
          <span className="text-[10px] text-gray-400 mt-0.5">Acima de {consumoMinimoFranquia} m³</span>
        </div>

        <div className="card bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-gray-500 uppercase">Custo Médio por m³</span>
          <span className="text-xl sm:text-2xl font-black text-emerald-700 mt-1">R$ {fmt(totais.valorPorM3)}</span>
          <span className="text-[10px] text-gray-400 mt-0.5">Base de cálculo individual</span>
        </div>
      </div>

      {/* Tabela de Medição e Rateio (Espelhada na sua planilha) */}
      <div className="bg-white rounded-2xl border border-pale-300 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 bg-slate-50 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
              <FileSpreadsheet size={16} className="text-cyan-600" />
              Medições por Hidrômetro & Valor Rateado — {condominio} ({competencia})
            </h4>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Digite a <b>Leitura Atual</b>. O sistema calcula automaticamente o consumo (m³), excesso e o valor em R$ para cada morador/inquilino.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAddLinha}
              className="text-xs font-bold px-3 py-1.5 bg-white border border-gray-300 hover:bg-slate-50 text-gray-700 rounded-xl flex items-center gap-1 shadow-2xs"
            >
              <Plus size={14} /> Adicionar Unidade
            </button>
            <button
              onClick={handleGerarBoletosAgua}
              className="text-xs font-black px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl flex items-center gap-1.5 shadow-sm"
              title="Gera boletos individuais de água no módulo de cobranças"
            >
              <ArrowRight size={14} /> Emitir Cobranças de Água
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 border-b border-gray-200 text-gray-600 font-bold uppercase text-[10px]">
              <tr>
                <th className="p-3 text-center w-12">Data</th>
                <th className="p-3 text-center w-20">Apto</th>
                <th className="p-3">Morador / Responsável</th>
                <th className="p-3 text-center">Vínculo</th>
                <th className="p-3 text-right">Leitura Anterior (m³)</th>
                <th className="p-3 text-right">Leitura Atual (m³)</th>
                <th className="p-3 text-center">Consumo (m³)</th>
                <th className="p-3 text-center">Excesso (m³)</th>
                <th className="p-3 text-right font-black text-emerald-800">Valor a Pagar (R$)</th>
                <th className="p-3 text-center">Observação</th>
                <th className="p-3 text-center w-10">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {linhas.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-gray-400">
                    Nenhum apartamento encontrado para este condomínio. Clique em "Adicionar Unidade".
                  </td>
                </tr>
              ) : (
                linhas.map((l, idx) => {
                  const valorApto = totais.somaConsumoM3 > 0 
                    ? ((Number(l.consumoM3) || 0) * totais.valorPorM3) 
                    : totais.valorCotaFixa

                  const ehAlugado = String(l.observacao || l.vinculo || '').toLowerCase().includes('inquilino') || 
                                    String(l.observacao || '').toLowerCase().includes('alug')

                  return (
                    <tr 
                      key={idx} 
                      className={`hover:bg-slate-50/80 transition-colors ${ehAlugado ? 'bg-amber-50/30' : ''}`}
                    >
                      <td className="p-2.5 text-center text-gray-500 whitespace-nowrap">
                        {dataMedicao ? dataMedicao.split('-').reverse().join('/') : '—'}
                      </td>

                      <td className="p-2.5 text-center">
                        <input
                          type="text"
                          value={l.apt}
                          onChange={e => handleUpdateLinha(idx, 'apt', e.target.value)}
                          className="input text-xs font-black text-center py-1 px-1.5 w-16 bg-white border-gray-300"
                        />
                      </td>

                      <td className="p-2.5">
                        <input
                          type="text"
                          value={l.morador}
                          onChange={e => handleUpdateLinha(idx, 'morador', e.target.value)}
                          placeholder="Nome do morador"
                          className="input text-xs py-1 px-2 w-full bg-white border-gray-300"
                        />
                      </td>

                      <td className="p-2.5 text-center">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                          l.vinculo === 'Inquilino' 
                            ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                            : 'bg-blue-100 text-blue-900 border border-blue-200'
                        }`}>
                          {l.vinculo || 'Proprietário'}
                        </span>
                      </td>

                      <td className="p-2.5 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={l.leituraAnterior}
                          onChange={e => handleUpdateLinha(idx, 'leituraAnterior', e.target.value)}
                          placeholder="0,00"
                          className="input text-xs text-right py-1 px-2 w-24 bg-white border-gray-300 font-mono"
                        />
                      </td>

                      <td className="p-2.5 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={l.leituraAtual}
                          onChange={e => handleUpdateLinha(idx, 'leituraAtual', e.target.value)}
                          placeholder="0,00"
                          className="input text-xs text-right py-1 px-2 w-24 bg-cyan-50 border-cyan-300 font-black text-cyan-900 font-mono"
                        />
                      </td>

                      <td className="p-2.5 text-center font-black text-blue-800 text-xs">
                        {l.consumoM3 || 0}
                      </td>

                      <td className="p-2.5 text-center font-bold text-amber-700 text-xs">
                        {l.excessoM3 || 0}
                      </td>

                      <td className="p-2.5 text-right font-black text-emerald-700 text-xs font-mono">
                        R$ {fmt(valorApto)}
                      </td>

                      <td className="p-2.5 text-center">
                        <input
                          type="text"
                          value={l.observacao || ''}
                          onChange={e => handleUpdateLinha(idx, 'observacao', e.target.value)}
                          placeholder="Ex: Alugado"
                          className="input text-[11px] py-1 px-1.5 w-24 text-center bg-white border-gray-300 font-bold"
                        />
                      </td>

                      <td className="p-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveLinha(idx)}
                          className="p-1 text-gray-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                          title="Excluir linha"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            {linhas.length > 0 && (
              <tfoot className="bg-slate-100 font-black text-xs text-slate-900 border-t-2 border-slate-300">
                <tr>
                  <td colSpan={6} className="p-3 text-right uppercase tracking-wider">
                    Total Geral:
                  </td>
                  <td className="p-3 text-center text-blue-900 font-black">
                    {totais.somaConsumoM3} m³
                  </td>
                  <td className="p-3 text-center text-amber-800 font-black">
                    {totais.somaExcessoM3} m³
                  </td>
                  <td className="p-3 text-right text-emerald-800 font-mono font-black">
                    R$ {fmt(totais.vTotal)}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Histórico Gravado dos Meses Anteriores */}
      {rateiosHistorico.length > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-pale-300 shadow-sm flex flex-col gap-3">
          <h4 className="font-black text-gray-900 text-sm flex items-center gap-2">
            <History size={16} className="text-gray-500" />
            Histórico de Rateios Gravados por Mês
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {rateiosHistorico.map(r => (
              <div 
                key={r.id} 
                className="p-3.5 rounded-xl border border-gray-200 bg-slate-50/70 hover:bg-slate-100 transition-all flex items-center justify-between gap-3 cursor-pointer"
                onClick={() => {
                  setCondominio(r.condominio)
                  setCompetencia(r.competencia)
                  setValorTotalConta(r.valorTotalConta || '')
                  setVencimentoConta(r.vencimentoConta || '')
                  if (Array.isArray(r.linhas)) setLinhas(r.linhas)
                }}
              >
                <div>
                  <span className="text-xs font-black text-gray-900 block truncate max-w-[160px]">{r.condominio}</span>
                  <span className="text-[11px] font-bold text-brand-600 block">{r.competencia}</span>
                  <span className="text-[10px] text-gray-500">{r.qtdUnidades || 0} unidades • {r.consumoTotalM3 || 0} m³</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black text-emerald-700 font-mono block">R$ {fmt(r.valorTotalConta)}</span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation()
                      if (window.confirm(`Excluir rateio de água de ${r.condominio} (${r.competencia})?`)) {
                        deleteRateio(r.id)
                      }
                    }} 
                    className="text-[10px] text-red-500 hover:text-red-700 font-bold mt-1 inline-block"
                  >
                    Excluir
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
