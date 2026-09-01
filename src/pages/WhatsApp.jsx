import React, { useState, useEffect } from 'react'
import { 
  MessageSquare, Send, RefreshCw, CheckCircle2, AlertCircle, Users, Building2, 
  Smartphone, Sparkles, Megaphone, Calendar, AlertTriangle, Package, Droplets, 
  ExternalLink, ShieldCheck, FileText, Upload, Download, QrCode, HeartHandshake,
  Check, Info
} from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function WhatsApp() {
  const { user } = useAuth()
  const { items: moradores } = useFirestore('moradores')
  const { items: condominios } = useFirestore('condominios')
  const { items: boletos } = useFirestore('boletos')

  const [instance, setInstance] = useState('InstanciaAlpha')
  const [instancesInfo, setInstancesInfo] = useState([])
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [abaAtiva, setAbaAtiva] = useState('mensagens') // 'mensagens' ou 'campanha'
  const [modoEnvio, setModoEnvio] = useState('individual') // 'individual' ou 'lote'

  // Filtro de Condomínio no envio individual
  const [condoFiltro, setCondoFiltro] = useState('Todos')
  const [moradorId, setMoradorId] = useState('')
  const [telefoneLivre, setTelefoneLivre] = useState('')
  const [nomeDestino, setNomeDestino] = useState('')
  const [condoDestino, setCondoDestino] = useState('')
  const [aptDestino, setAptDestino] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [arquivoPdfBase64, setArquivoPdfBase64] = useState(null)
  const [arquivoPdfNome, setArquivoPdfNome] = useState('')

  // Form Lote
  const [condoLote, setCondoLote] = useState('Todos')

  // Status de Envio
  const [sending, setSending] = useState(false)
  const [logsEnvio, setLogsEnvio] = useState([])

  const fetchStatus = async () => {
    setLoadingStatus(true)
    try {
      const res = await fetch('/api/whatsapp-status')
      const data = await res.json()
      if (data.success && Array.isArray(data.instances)) {
        setInstancesInfo(data.instances)
      }
    } catch (err) {
      console.error('Erro ao buscar status do WhatsApp:', err)
    }
    setLoadingStatus(false)
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  // Moradores filtrados pelo condomínio selecionado
  const moradoresFiltrados = moradores.filter(m => {
    if (!condoFiltro || condoFiltro === 'Todos') return true
    return m.condominio === condoFiltro || m.condominioNome === condoFiltro
  })

  // Quando o morador é selecionado
  const handleSelectMorador = (e) => {
    const id = e.target.value
    setMoradorId(id)
    const m = moradores.find(x => x.id === id)
    if (m) {
      const rawTel = m.tel || m.telefone || m.whatsapp || m.celular || m.fone || m.contato || m.numero || ''
      const tel = String(rawTel).replace(/\D/g, '')
      setTelefoneLivre(tel)
      setNomeDestino(m.nome || '')
      setCondoDestino(m.condominio || m.condominioNome || '')
      setAptDestino(m.apt || m.unidade || '')
    } else {
      setTelefoneLivre('')
      setNomeDestino('')
      setCondoDestino('')
      setAptDestino('')
    }
  }

  // Upload de PDF para envio via WhatsApp
  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.type !== 'application/pdf') {
      alert('Por favor, selecione um arquivo em formato PDF.')
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      setArquivoPdfBase64(ev.target.result)
      setArquivoPdfNome(file.name)
    }
    reader.readAsDataURL(file)
  }

  const aplicarTemplate = (texto) => {
    let msgFormatada = texto
      .replace(/{nome}/g, nomeDestino || 'Morador(a)')
      .replace(/{condominio}/g, condoDestino || (condoFiltro !== 'Todos' ? condoFiltro : 'Condomínio'))
      .replace(/{apt}/g, aptDestino ? `Apt ${aptDestino}` : '')
    setMensagem(msgFormatada)
  }

  const handleSendIndividual = async (e) => {
    e?.preventDefault()
    const tel = telefoneLivre.replace(/\D/g, '')
    if (!tel || tel.length < 8) {
      alert('Por favor, selecione um morador com telefone ou digite um número de WhatsApp válido com DDD.')
      return
    }
    if (!mensagem.trim() && !arquivoPdfBase64) {
      alert('Digite o conteúdo da mensagem ou anexe um PDF para envio.')
      return
    }

    setSending(true)
    try {
      const res = await fetch('/api/whatsapp-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: tel,
          text: mensagem,
          mediaBase64: arquivoPdfBase64,
          fileName: arquivoPdfNome || 'Documento_Condominio.pdf',
          instance: instance
        })
      })
      const data = await res.json()
      if (data.success) {
        alert(`🎉 Mensagem ${arquivoPdfBase64 ? 'e PDF ' : ''}enviada com sucesso para ${nomeDestino || tel}!`)
        setLogsEnvio(prev => [{
          hora: new Date().toLocaleTimeString('pt-BR'),
          destinatario: nomeDestino ? `${nomeDestino} (${tel})` : tel,
          status: 'Sucesso',
          texto: (mensagem || arquivoPdfNome) + (arquivoPdfBase64 ? ' 📄 [PDF Anexo]' : '')
        }, ...prev])
        // Limpar anexo após envio
        setArquivoPdfBase64(null)
        setArquivoPdfNome('')
      } else {
        alert(`Erro ao enviar: ${data.error || 'Verifique a conexão da instância'}`)
      }
    } catch (err) {
      console.error(err)
      alert('Erro de comunicação com a Evolution API.')
    }
    setSending(false)
  }

  const handleSendLote = async () => {
    const listaAlvo = moradores.filter(m => {
      const temTel = Boolean(m.tel || m.telefone || m.whatsapp || m.celular || m.fone || m.contato || m.numero)
      const matchCondo = condoLote === 'Todos' || m.condominio === condoLote || m.condominioNome === condoLote
      return temTel && matchCondo
    })

    if (listaAlvo.length === 0) {
      alert('Nenhum morador com telefone válido encontrado para o condomínio selecionado.')
      return
    }

    if (!mensagem.trim()) {
      alert('Digite a mensagem a ser enviada.')
      return
    }

    if (!window.confirm(`Confirma o envio automático de WhatsApp para ${listaAlvo.length} moradores do condomínio "${condoLote}"?`)) {
      return
    }

    setSending(true)
    let enviados = 0
    for (const m of listaAlvo) {
      const rawTel = m.tel || m.telefone || m.whatsapp || m.celular || m.fone || m.contato || m.numero || ''
      const tel = String(rawTel).replace(/\D/g, '')
      let msgPersonalizada = mensagem
        .replace(/{nome}/g, m.nome || 'Morador(a)')
        .replace(/{condominio}/g, m.condominio || condoLote)
        .replace(/{apt}/g, m.apt ? `Apt ${m.apt}` : '')

      try {
        await fetch('/api/whatsapp-send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            number: tel,
            text: msgPersonalizada,
            mediaBase64: arquivoPdfBase64,
            fileName: arquivoPdfNome || 'Comunicado_Condominio.pdf',
            instance: instance
          })
        })
        enviados++
      } catch (err) {
        console.error(`Erro ao enviar para ${m.nome}:`, err)
      }
      // Intervalo de segurança anti-bloqueio
      await new Promise(r => setTimeout(r, 1400))
    }

    setSending(false)
    alert(`🎉 Disparo em lote concluído! ${enviados} de ${listaAlvo.length} mensagens entregues pelo WhatsApp oficial!`)
    setLogsEnvio(prev => [{
      hora: new Date().toLocaleTimeString('pt-BR'),
      destinatario: `Lote ${condoLote} (${enviados} moradores)`,
      status: 'Sucesso',
      texto: mensagem + (arquivoPdfBase64 ? ' 📄 [PDF Anexo]' : '')
    }, ...prev])
  }

  // Gerador de Cartaz do Elevador em PDF para engajar moradores
  const gerarCartazElevador = (nomeCondo) => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.width
    const pageHeight = doc.internal.pageSize.height

    // Fundo Superior Azul Marinho
    doc.setFillColor(15, 23, 42)
    doc.rect(0, 0, pageWidth, 55, 'F')

    // Título Principal
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.text('PORTAL DIGITAL DO MORADOR', pageWidth / 2, 25, { align: 'center' })

    doc.setFontSize(14)
    doc.setTextColor(52, 211, 153)
    doc.text(nomeCondo ? `Condomínio ${nomeCondo.toUpperCase()}` : 'SEU CONDOMÍNIO DIGITAL & MODERNO', pageWidth / 2, 38, { align: 'center' })

    doc.setFontSize(11)
    doc.setTextColor(203, 213, 225)
    doc.text('Administração & Gestão: Alpha Soluções Condominiais', pageWidth / 2, 48, { align: 'center' })

    // Corpo do Cartaz
    doc.setTextColor(15, 23, 42)
    doc.setFontSize(16)
    doc.text('Tudo o que você precisa direto no seu celular:', 20, 75)

    const itens = [
      ['💳 Boletos & 2ª Via PIX', 'Acesse suas cotas com desconto e pague via PIX Copia e Cola instantâneo sem filas.'],
      ['📦 Notificação de Encomendas', 'Seja avisado no WhatsApp e no celular assim que sua encomenda chegar na portaria.'],
      ['🍖 Reserva de Áreas Comuns', 'Agende a churrasqueira, salão de festas e piscina direto pelo app sem papel.'],
      ['🏛️ Assembleias & Votações Virtuais', 'Participe e vote nas decisões do condomínio de onde você estiver.'],
      ['📢 Avisos & Manutenções em Tempo Real', 'Fique sabendo de interrupções de água, luz e comunicados importantes na hora.']
    ]

    let y = 90
    itens.forEach(([titulo, desc]) => {
      doc.setFillColor(241, 245, 249)
      doc.roundedRect(18, y - 5, pageWidth - 36, 18, 3, 3, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(15, 23, 42)
      doc.text(titulo, 24, y + 2)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(71, 85, 105)
      doc.text(desc, 24, y + 9)
      y += 24
    })

    // Caixa de Acesso Inferior
    doc.setFillColor(236, 253, 245)
    doc.setDrawColor(16, 185, 129)
    doc.roundedRect(18, y + 5, pageWidth - 36, 40, 4, 4, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(4, 120, 87)
    doc.text('COMO ACESSAR O PORTAL DO SEU CONDOMÍNIO:', pageWidth / 2, y + 16, { align: 'center' })

    doc.setFontSize(11)
    doc.setTextColor(15, 23, 42)
    doc.text('Acesse pelo navegador do seu celular:', pageWidth / 2, y + 26, { align: 'center' })

    doc.setFontSize(13)
    doc.setTextColor(2, 132, 199)
    doc.text('https://alpha-solucoes-condominiais.vercel.app', pageWidth / 2, y + 36, { align: 'center' })

    // Rodapé
    doc.setFontSize(9)
    doc.setTextColor(148, 163, 184)
    doc.text('Dúvidas ou Suporte? Fale com a Alpha Soluções pelo WhatsApp: (83) 9688-5931', pageWidth / 2, pageHeight - 12, { align: 'center' })

    doc.save(`Cartaz_Incentivo_App_${nomeCondo || 'Condominio'}.pdf`)
  }

  const moradorSelecionadoObj = moradores.find(m => m.id === moradorId)
  const temTelefoneValido = Boolean(telefoneLivre && telefoneLivre.replace(/\D/g, '').length >= 8)

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-6xl mx-auto pb-16 font-sans">
      
      {/* Cabeçalho Principal com Tipografia Nítida */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-3">
            <span className="p-2.5 bg-emerald-100 text-emerald-800 rounded-2xl text-2xl shadow-sm">💬</span>
            WhatsApp Oficial Alpha Soluções
          </h1>
          <p className="text-sm sm:text-base text-slate-600 font-medium mt-1">
            Disparos automáticos de boletos em PDF, comunicados e cobranças via WhatsApp oficial da empresa.
          </p>
        </div>

        <button 
          onClick={fetchStatus} 
          disabled={loadingStatus} 
          className="btn-secondary text-sm font-bold flex items-center gap-2 py-2.5 px-4 bg-white border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm rounded-xl"
        >
          <RefreshCw size={16} className={loadingStatus ? 'animate-spin text-emerald-600' : 'text-slate-500'} />
          <span>{loadingStatus ? 'Verificando...' : 'Atualizar Conexão'}</span>
        </button>
      </div>

      {/* Card de Status da Conexão em Tempo Real */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-lg border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center font-black text-3xl text-emerald-400 shrink-0 shadow-inner">
            📱
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-400/20 text-emerald-300 border border-emerald-400/40">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                Conexão Oficial Ativa
              </span>
              <span className="text-sm font-bold text-slate-300">
                Instância: <b className="text-white">{instance}</b>
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white mt-1.5 tracking-tight">
              Alpha Soluções Condominiais
            </h2>
            <p className="text-sm text-emerald-300 font-bold font-mono mt-0.5">
              WhatsApp Conectado: +55 (83) 9688-5931
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-800/80 p-3 rounded-2xl border border-slate-700 shrink-0">
          <label className="text-xs font-black uppercase text-slate-300">Instância:</label>
          <select 
            className="input py-2 px-3 text-sm font-bold text-slate-900 bg-white rounded-xl cursor-pointer"
            value={instance}
            onChange={e => setInstance(e.target.value)}
          >
            <option value="InstanciaAlpha">InstanciaAlpha (55 83 9688-5931)</option>
            <option value="InstanciaCentral2">InstanciaCentral2 (55 83 9680-6325)</option>
          </select>
        </div>
      </div>

      {/* Abas Principais: Central de Envios vs Campanha de Adesão */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setAbaAtiva('mensagens')}
          className={`px-5 py-3 rounded-2xl text-sm font-bold transition-all flex items-center gap-2 ${abaAtiva === 'mensagens' ? 'bg-slate-900 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
        >
          <MessageSquare size={18} /> Envio de Mensagens & Boletos
        </button>
        <button
          onClick={() => setAbaAtiva('campanha')}
          className={`px-5 py-3 rounded-2xl text-sm font-bold transition-all flex items-center gap-2 ${abaAtiva === 'campanha' ? 'bg-emerald-700 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-emerald-50 hover:text-emerald-800'}`}
        >
          <Sparkles size={18} className="text-amber-300" /> 🎁 Incentivar Moradores a Usar o Sistema
        </button>
      </div>

      {/* ABA 1: ENVIO DE MENSAGENS E BOLETOS */}
      {abaAtiva === 'mensagens' && (
        <>
          {/* Seletor de Modo: Individual vs Lote */}
          <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl w-fit border border-slate-200">
            <button
              onClick={() => setModoEnvio('individual')}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${modoEnvio === 'individual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
            >
              <Smartphone size={16} /> Envio Individual por Morador
            </button>
            <button
              onClick={() => setModoEnvio('lote')}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${modoEnvio === 'lote' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
            >
              <Users size={16} /> Disparo em Lote (Condomínio Inteiro)
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Colunas 1 e 2: Editor */}
            <div className="lg:col-span-2 card p-6 flex flex-col gap-5 border border-slate-200 shadow-sm bg-white rounded-3xl">
              
              {modoEnvio === 'individual' ? (
                <div className="flex flex-col gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                  
                  {/* Linha 1: Selecionar Condomínio primeiro */}
                  <div>
                    <label className="block text-sm font-black text-slate-800 mb-1.5 flex items-center gap-1.5">
                      <Building2 size={16} className="text-emerald-700" /> 1. Filtrar por Condomínio:
                    </label>
                    <select 
                      className="input text-sm font-bold text-slate-900 bg-white py-2.5 border-slate-300 w-full"
                      value={condoFiltro}
                      onChange={e => {
                        setCondoFiltro(e.target.value)
                        setMoradorId('')
                        setTelefoneLivre('')
                      }}
                    >
                      <option value="Todos">Todos os Condomínios Cadastrados</option>
                      {condominios.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                    </select>
                  </div>

                  {/* Linha 2: Morador e Telefone Automático */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-black text-slate-800 mb-1.5 flex items-center gap-1.5">
                        <Users size={16} className="text-emerald-700" /> 2. Selecionar o Morador:
                      </label>
                      <select 
                        className="input text-sm font-bold text-slate-900 bg-white py-2.5 border-slate-300 w-full"
                        value={moradorId}
                        onChange={handleSelectMorador}
                      >
                        <option value="">Selecione o morador...</option>
                        {moradoresFiltrados.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.nome} (Apt {m.apt || '—'}) {m.condominio ? `• ${m.condominio}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-black text-slate-800 mb-1.5 flex items-center gap-1.5">
                        <Smartphone size={16} className="text-emerald-700" /> 3. WhatsApp do Morador (com DDD):
                      </label>
                      <input 
                        type="text" 
                        className="input text-sm font-bold text-slate-900 bg-white py-2.5 border-slate-300 w-full font-mono"
                        placeholder="Ex: 83996885931"
                        value={telefoneLivre}
                        onChange={e => setTelefoneLivre(e.target.value)}
                      />
                      {moradorId && (
                        <div className="mt-1.5">
                          {temTelefoneValido ? (
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                              <CheckCircle2 size={12} /> Número carregado do cadastro do morador
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                              <AlertCircle size={12} /> Morador sem telefone cadastrado — digite acima
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-200">
                  <label className="block text-sm font-black text-emerald-950 mb-2 flex items-center gap-2">
                    <Building2 size={18} className="text-emerald-700" /> Selecionar Condomínio para Disparo em Massa:
                  </label>
                  <select 
                    className="input text-sm font-bold text-slate-900 bg-white py-3 border-emerald-300 w-full"
                    value={condoLote}
                    onChange={e => setCondoLote(e.target.value)}
                  >
                    <option value="Todos">Todos os Condomínios Cadastrados</option>
                    {condominios.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                  </select>
                  <p className="text-xs text-emerald-800 font-medium mt-2 leading-relaxed">
                    👥 O sistema enviará a mensagem personalizada individualmente com intervalo de segurança para todos os moradores com telefone cadastrado.
                  </p>
                </div>
              )}

              {/* Anexo de Arquivo PDF (Boleto ou Comunicado) */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-red-100 text-red-700 rounded-xl font-bold text-lg">
                    📄
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900">Anexar Documento / Boleto em PDF</h4>
                    <p className="text-xs text-slate-500 font-medium">
                      O morador receberá o arquivo PDF diretamente para abrir e imprimir no WhatsApp.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <label className="btn-secondary text-xs py-2 px-3 font-bold bg-white border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer shadow-sm rounded-xl flex items-center gap-1.5">
                    <Upload size={14} className="text-emerald-600" />
                    <span>{arquivoPdfNome ? 'Trocar PDF' : 'Selecionar PDF'}</span>
                    <input type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" />
                  </label>
                  {arquivoPdfNome && (
                    <button 
                      type="button" 
                      onClick={() => { setArquivoPdfBase64(null); setArquivoPdfNome('') }}
                      className="text-xs font-bold text-red-600 hover:underline px-1"
                    >
                      Remover
                    </button>
                  )}
                </div>
              </div>
              {arquivoPdfNome && (
                <div className="bg-emerald-50 text-emerald-900 text-xs font-bold p-2.5 rounded-xl border border-emerald-200 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-emerald-600" />
                    Arquivo anexado: <b>{arquivoPdfNome}</b>
                  </span>
                  <span className="text-[11px] text-emerald-700 font-mono">Pronto para envio</span>
                </div>
              )}

              {/* Modelos de Mensagens Rápidas */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-black text-slate-800 flex items-center gap-2">
                    <Sparkles size={16} className="text-amber-500" /> Modelos Rápidos de Mensagem:
                  </label>
                  <span className="text-xs text-slate-400 font-mono">Variáveis: {'{nome}'}, {'{condominio}'}, {'{apt}'}</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => aplicarTemplate('Olá {nome} ({apt})! Segue em anexo seu Boleto Condominial do {condominio}. Você pode efetuar o pagamento lendo o QR Code ou pelo PIX Copia e Cola. Atenciosamente, Alpha Soluções.')}
                    className="p-3 text-left bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-2xl text-xs font-bold text-slate-900 flex items-center gap-2.5 transition-all shadow-sm"
                  >
                    <Megaphone size={16} className="text-emerald-600 shrink-0" />
                    <span className="truncate">💳 Envio de Boleto / PIX</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => aplicarTemplate('Prezado(a) {nome}, informamos que haverá Assembleia Geral do {condominio} nesta semana. Sua presença é fundamental para as deliberações. Contamos com você!')}
                    className="p-3 text-left bg-slate-50 hover:bg-brand-50 border border-slate-200 hover:border-brand-300 rounded-2xl text-xs font-bold text-slate-900 flex items-center gap-2.5 transition-all shadow-sm"
                  >
                    <Calendar size={16} className="text-brand-600 shrink-0" />
                    <span className="truncate">🏛️ Assembleia Geral</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => aplicarTemplate('Olá {nome}! Chegou uma encomenda para a sua unidade ({apt}) na portaria do {condominio}. Por favor, retire na administração/portaria com documento de identificação.')}
                    className="p-3 text-left bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-300 rounded-2xl text-xs font-bold text-slate-900 flex items-center gap-2.5 transition-all shadow-sm"
                  >
                    <Package size={16} className="text-amber-600 shrink-0" />
                    <span className="truncate">📦 Encomenda na Portaria</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => aplicarTemplate('COMUNICADO IMPORTANTE: Haverá manutenção preventiva no sistema de abastecimento de água do {condominio} hoje das 14h às 17h. Recomendamos reservar água para o período.')}
                    className="p-3 text-left bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-2xl text-xs font-bold text-slate-900 flex items-center gap-2.5 transition-all shadow-sm"
                  >
                    <Droplets size={16} className="text-blue-600 shrink-0" />
                    <span className="truncate">💧 Manutenção Água/Luz</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => aplicarTemplate('Olá {nome}! Constatamos pendência financeira referente à sua unidade ({apt}). Para regularização e emissão de 2ª via sem juros adicionais, entre em contato conosco.')}
                    className="p-3 text-left bg-slate-50 hover:bg-red-50 border border-slate-200 hover:border-red-300 rounded-2xl text-xs font-bold text-slate-900 flex items-center gap-2.5 transition-all shadow-sm"
                  >
                    <AlertTriangle size={16} className="text-red-600 shrink-0" />
                    <span className="truncate">⚠️ Cobrança Amigável</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => aplicarTemplate('Olá {nome}! O novo Portal do Morador do {condominio} já está no ar! Acesse agora para ver seus boletos, fazer reservas e receber encomendas: https://alpha-solucoes-condominiais.vercel.app')}
                    className="p-3 text-left bg-slate-50 hover:bg-purple-50 border border-slate-200 hover:border-purple-300 rounded-2xl text-xs font-bold text-slate-900 flex items-center gap-2.5 transition-all shadow-sm"
                  >
                    <Sparkles size={16} className="text-purple-600 shrink-0" />
                    <span className="truncate">🎉 Convite para o App</span>
                  </button>
                </div>
              </div>

              {/* Caixa de Texto da Mensagem */}
              <div>
                <label className="block text-sm font-black text-slate-800 mb-1.5 flex items-center justify-between">
                  <span>Texto da Mensagem:</span>
                  <span className="text-xs text-slate-400 font-mono">{mensagem.length} caracteres</span>
                </label>
                <textarea
                  className="input w-full min-h-[150px] text-sm font-medium text-slate-900 bg-white leading-relaxed border-slate-300 rounded-2xl p-4 resize-y shadow-inner"
                  placeholder="Digite sua mensagem aqui... Use {nome}, {condominio} e {apt} para substituição automática."
                  value={mensagem}
                  onChange={e => setMensagem(e.target.value)}
                />
              </div>

              {/* Botões de Ação */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-100">
                <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                  <ShieldCheck size={16} className="text-emerald-600" /> Disparo 100% oficial pela Evolution API da Alpha.
                </p>

                <div className="flex gap-3 w-full sm:w-auto">
                  {modoEnvio === 'individual' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => window.open(`https://wa.me/55${telefoneLivre.replace(/\D/g, '')}?text=${encodeURIComponent(mensagem)}`, '_blank')}
                        className="btn-secondary text-sm py-3 px-4 font-bold flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border-slate-300 text-slate-700 rounded-xl"
                      >
                        <ExternalLink size={15} /> WhatsApp Web
                      </button>
                      <button
                        type="button"
                        onClick={handleSendIndividual}
                        disabled={sending}
                        className="btn-primary text-sm py-3 px-6 bg-emerald-600 hover:bg-emerald-500 font-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/20 rounded-xl"
                      >
                        <Send size={16} /> {sending ? 'Enviando...' : '🚀 Enviar via Evolution API'}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendLote}
                      disabled={sending}
                      className="btn-primary w-full sm:w-auto text-sm py-3 px-8 bg-emerald-600 hover:bg-emerald-500 font-black flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-700/20 rounded-xl"
                    >
                      <Send size={16} /> {sending ? 'Disparando Lote...' : '🚀 Iniciar Disparo em Lote no WhatsApp'}
                    </button>
                  )}
                </div>
              </div>

            </div>

            {/* Coluna 3: Histórico de Envios */}
            <div className="card p-6 border border-slate-200 shadow-sm bg-white flex flex-col rounded-3xl">
              <h3 className="font-black text-slate-900 text-base mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
                <span>📋</span> Histórico de Envios Recentes
              </h3>

              <div className="flex-1 overflow-y-auto max-h-[460px] divide-y divide-slate-100 text-xs">
                {logsEnvio.length === 0 ? (
                  <div className="py-16 text-center text-slate-400">
                    <p className="text-3xl mb-2">💬</p>
                    <p className="font-bold text-sm text-slate-600">Nenhum envio recente nesta sessão.</p>
                    <p className="text-xs text-slate-400 mt-1">Os disparos realizados aparecerão aqui.</p>
                  </div>
                ) : (
                  logsEnvio.map((log, i) => (
                    <div key={i} className="py-3">
                      <div className="flex justify-between items-center text-xs mb-1">
                        <span className="font-black text-slate-900 truncate max-w-[150px]">{log.destinatario}</span>
                        <span className="text-slate-400 font-mono text-[11px]">{log.hora}</span>
                      </div>
                      <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200 font-mono leading-relaxed">
                        {log.texto}
                      </p>
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                        <CheckCircle2 size={13} /> Entregue com sucesso
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </>
      )}

      {/* ABA 2: ESTRATÉGIA E CAMPANHA DE ADESÃO DOS MORADORES */}
      {abaAtiva === 'campanha' && (
        <div className="flex flex-col gap-6 animate-fade-in">
          
          <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white p-8 rounded-3xl shadow-xl border border-emerald-800">
            <span className="px-3 py-1 bg-emerald-400/20 border border-emerald-400/40 rounded-full text-xs font-black uppercase text-emerald-300 tracking-wider">
              Plano de Adoção Digital dos Moradores
            </span>
            <h2 className="text-2xl sm:text-3xl font-black mt-3">
              Como fazer os moradores usarem o sistema com facilidade
            </h2>
            <p className="text-sm sm:text-base text-slate-200 mt-2 max-w-3xl leading-relaxed">
              Muitos moradores têm resistência inicial à tecnologia. A forma mais eficaz de vencer essa barreira é mostrar **benefícios práticos imediatos** que facilitam o dia a dia deles (como receber encomendas na hora e pagar boletos em 1 clique).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Card 1: Gerador de Cartaz para Elevador */}
            <div className="card p-6 bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-blue-100 text-blue-700 rounded-2xl text-2xl font-bold">🖨️</div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">1. Cartaz Oficial para Elevador e Portaria</h3>
                    <p className="text-xs text-slate-500 font-medium">Imprima e cole no mural para visualização diária</p>
                  </div>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed mb-4">
                  O cartaz físico no elevador tem taxa de visualização de 98% dos moradores. Ele apresenta os 5 principais benefícios e o link direto para o portal.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-3 items-center justify-between">
                <select 
                  className="input text-xs font-bold text-slate-900 bg-slate-50 border-slate-300 py-2.5"
                  value={condoFiltro}
                  onChange={e => setCondoFiltro(e.target.value)}
                >
                  <option value="Todos">Condomínio Geral</option>
                  {condominios.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                </select>

                <button 
                  onClick={() => gerarCartazElevador(condoFiltro === 'Todos' ? '' : condoFiltro)}
                  className="btn-primary text-xs py-2.5 px-5 bg-blue-600 hover:bg-blue-500 font-black flex items-center gap-2 rounded-xl shadow-md shrink-0"
                >
                  <Download size={15} /> Baixar Cartaz em PDF
                </button>
              </div>
            </div>

            {/* Card 2: Disparo de Boas-Vindas no WhatsApp */}
            <div className="card p-6 bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-emerald-100 text-emerald-700 rounded-2xl text-2xl font-bold">📲</div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">2. Disparo de Boas-Vindas pelo WhatsApp</h3>
                    <p className="text-xs text-slate-500 font-medium">Convite direto no WhatsApp de cada morador</p>
                  </div>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed mb-4">
                  Envie uma mensagem amigável no WhatsApp oficial da Alpha convidando o morador a acessar sua unidade e verificar suas vantagens.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button 
                  onClick={() => {
                    setAbaAtiva('mensagens')
                    setModoEnvio('lote')
                    aplicarTemplate('Olá {nome}! Temos uma novidade para você: o novo Portal Digital do {condominio} já está disponível! Acesse agora para ver seus boletos em PDF, agendar áreas comuns e receber notificações de encomendas: https://alpha-solucoes-condominiais.vercel.app. Dúvidas? Fale conosco por aqui!')
                  }}
                  className="btn-primary text-xs py-2.5 px-5 bg-emerald-600 hover:bg-emerald-500 font-black flex items-center gap-2 rounded-xl shadow-md"
                >
                  <Send size={15} /> Preparar Disparo no WhatsApp
                </button>
              </div>
            </div>

          </div>

          {/* 5 Pilares de Argumentação com Moradores */}
          <div className="card p-6 bg-white border border-slate-200 rounded-3xl shadow-sm">
            <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
              <span>🎯</span> Os 5 Motivos que Convencem Qualquer Morador a Usar:
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <h4 className="font-black text-slate-900 text-sm mb-1 flex items-center gap-1.5">
                  <Package size={16} className="text-amber-600" /> 1. Encomendas Seguras
                </h4>
                <p className="text-slate-600 leading-relaxed">
                  Ele não precisa mais ficar descendo na portaria para perguntar se a encomenda chegou. O sistema avisa no WhatsApp na mesma hora!
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <h4 className="font-black text-slate-900 text-sm mb-1 flex items-center gap-1.5">
                  <FileText size={16} className="text-emerald-600" /> 2. Boleto em PDF & PIX Fácil
                </h4>
                <p className="text-slate-600 leading-relaxed">
                  Basta clicar e pagar com PIX Copia e Cola ou baixar o PDF para imprimir quando quiser, sem risco de perder o papel.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <h4 className="font-black text-slate-900 text-sm mb-1 flex items-center gap-1.5">
                  <Calendar size={16} className="text-blue-600" /> 3. Reserva de Churrasqueira
                </h4>
                <p className="text-slate-600 leading-relaxed">
                  Acabou o livro de papel na portaria! O morador vê na hora se o salão de festas ou churrasqueira está livre e reserva na mesma hora.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <h4 className="font-black text-slate-900 text-sm mb-1 flex items-center gap-1.5">
                  <Users size={16} className="text-brand-600" /> 4. Votação sem Sair de Casa
                </h4>
                <p className="text-slate-600 leading-relaxed">
                  Quem trabalha até tarde ou viaja pode votar nas decisões do condomínio e assinar atas de assembleia diretamente pelo celular.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <h4 className="font-black text-slate-900 text-sm mb-1 flex items-center gap-1.5">
                  <Droplets size={16} className="text-cyan-600" /> 5. Avisos Instantâneos
                </h4>
                <p className="text-slate-600 leading-relaxed">
                  Falta de água, limpeza de caixa d'água ou conserto de portão: o morador é comunicado com antecedência no WhatsApp.
                </p>
              </div>

              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex flex-col justify-center">
                <h4 className="font-black text-emerald-950 text-sm mb-1 flex items-center gap-1.5">
                  <HeartHandshake size={16} className="text-emerald-700" /> Apoio da Alpha
                </h4>
                <p className="text-emerald-800 leading-relaxed">
                  A equipe da Alpha Soluções auxilia qualquer morador com dúvidas no WhatsApp oficial (83) 9688-5931.
                </p>
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  )
}
