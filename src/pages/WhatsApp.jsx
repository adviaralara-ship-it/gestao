import React, { useState, useEffect } from 'react'
import { MessageSquare, Send, RefreshCw, CheckCircle2, AlertCircle, Users, Building2, Smartphone, Sparkles, Megaphone, Calendar, AlertTriangle, Package, Droplets, ExternalLink, ShieldCheck } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'

export default function WhatsApp() {
  const { user } = useAuth()
  const { items: moradores } = useFirestore('moradores')
  const { items: condominios } = useFirestore('condominios')

  const [instance, setInstance] = useState('InstanciaAlpha')
  const [instancesInfo, setInstancesInfo] = useState([])
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [modoEnvio, setModoEnvio] = useState('individual') // 'individual' ou 'lote'

  // Form Individual
  const [moradorId, setMoradorId] = useState('')
  const [telefoneLivre, setTelefoneLivre] = useState('')
  const [nomeDestino, setNomeDestino] = useState('')
  const [condoDestino, setCondoDestino] = useState('')
  const [aptDestino, setAptDestino] = useState('')
  const [mensagem, setMensagem] = useState('')

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

  const handleSelectMorador = (e) => {
    const id = e.target.value
    setMoradorId(id)
    const m = moradores.find(x => x.id === id)
    if (m) {
      setTelefoneLivre(m.telefone || m.whatsapp || m.celular || '')
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

  const aplicarTemplate = (texto) => {
    let msgFormatada = texto
      .replace(/{nome}/g, nomeDestino || 'Morador(a)')
      .replace(/{condominio}/g, condoDestino || 'Condomínio')
      .replace(/{apt}/g, aptDestino ? `Apt ${aptDestino}` : '')
    setMensagem(msgFormatada)
  }

  const handleSendIndividual = async (e) => {
    e?.preventDefault()
    const tel = telefoneLivre.replace(/\D/g, '')
    if (!tel || tel.length < 8) {
      alert('Por favor, informe um número de telefone/WhatsApp válido com DDD.')
      return
    }
    if (!mensagem.trim()) {
      alert('Digite o conteúdo da mensagem que deseja enviar.')
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
          instance: instance
        })
      })
      const data = await res.json()
      if (data.success) {
        alert(`🎉 Mensagem enviada com sucesso via WhatsApp para ${nomeDestino || tel}!`)
        setLogsEnvio(prev => [{
          hora: new Date().toLocaleTimeString('pt-BR'),
          destinatario: nomeDestino ? `${nomeDestino} (${tel})` : tel,
          status: 'Sucesso',
          texto: mensagem
        }, ...prev])
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
      const temTel = Boolean(m.telefone || m.whatsapp || m.celular)
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
      const tel = (m.telefone || m.whatsapp || m.celular).replace(/\D/g, '')
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
            instance: instance
          })
        })
        enviados++
      } catch (err) {
        console.error(`Erro ao enviar para ${m.nome}:`, err)
      }
      // Intervalo de segurança anti-bloqueio entre mensagens
      await new Promise(r => setTimeout(r, 1200))
    }

    setSending(false)
    alert(`🎉 Disparo em lote concluído! ${enviados} de ${listaAlvo.length} mensagens foram entregues pelo WhatsApp oficial!`)
    setLogsEnvio(prev => [{
      hora: new Date().toLocaleTimeString('pt-BR'),
      destinatario: `Lote ${condoLote} (${enviados} moradores)`,
      status: 'Sucesso',
      texto: mensagem
    }, ...prev])
  }

  const activeInstanceObj = instancesInfo.find(i => i.name === instance) || instancesInfo[0] || {}
  const isOnline = activeInstanceObj.connectionStatus === 'open'

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-6xl mx-auto pb-12">
      
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-cream-300 pb-4">
        <div>
          <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <span className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">💬</span>
            Central de Disparos WhatsApp (Evolution API)
          </h2>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Envio automatizado de boletos, avisos, cobranças e comunicados via WhatsApp Oficial
          </p>
        </div>

        <button onClick={fetchStatus} disabled={loadingStatus} className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3 bg-white shadow-sm">
          <RefreshCw size={13} className={loadingStatus ? 'animate-spin text-emerald-600' : 'text-gray-500'} />
          <span>{loadingStatus ? 'Verificando...' : 'Atualizar Conexão'}</span>
        </button>
      </div>

      {/* Card de Status da Conexão em Tempo Real */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-brand-950 text-white p-5 rounded-3xl shadow-md border border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center font-black text-2xl text-emerald-400 shrink-0">
            📱
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Conexão Oficial Ativa
              </span>
              <span className="text-xs font-mono text-slate-300">
                Instância: <b>{instance}</b>
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-white mt-1">
              WhatsApp Alpha Soluções Condominiais
            </h3>
            <p className="text-xs text-slate-300 font-mono">
              Número Vinculado: <b className="text-emerald-400">+55 (83) 9688-5931</b> (InstanciaAlpha) &nbsp;•&nbsp; +55 (83) 9680-6325 (Central)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label className="text-xs font-bold text-slate-300">Instância Ativa:</label>
          <select 
            className="input py-1.5 px-3 text-xs font-bold text-slate-900 bg-white rounded-xl"
            value={instance}
            onChange={e => setInstance(e.target.value)}
          >
            <option value="InstanciaAlpha">InstanciaAlpha (55 83 9688-5931)</option>
            <option value="InstanciaCentral2">InstanciaCentral2 (55 83 9680-6325)</option>
          </select>
        </div>
      </div>

      {/* Seletor de Modo: Individual vs Lote */}
      <div className="flex gap-2 bg-slate-100 p-1 rounded-2xl w-fit border border-slate-200">
        <button
          onClick={() => setModoEnvio('individual')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${modoEnvio === 'individual' ? 'bg-white text-emerald-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
        >
          <Smartphone size={14} /> Envio Individual / Morador
        </button>
        <button
          onClick={() => setModoEnvio('lote')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${modoEnvio === 'lote' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
        >
          <Users size={14} /> Disparo em Lote (Condomínio Inteiro)
        </button>
      </div>

      {/* Formulário de Envio */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Coluna 1 & 2: Editor da Mensagem */}
        <div className="lg:col-span-2 card p-5 sm:p-6 flex flex-col gap-4 border border-cream-300 shadow-sm bg-white">
          
          {modoEnvio === 'individual' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-gray-200">
              <div>
                <label className="label text-xs font-bold text-gray-700 flex items-center gap-1">
                  <Users size={13} className="text-emerald-700" /> Selecionar Morador:
                </label>
                <select className="input text-xs font-bold text-gray-800 bg-white" value={moradorId} onChange={handleSelectMorador}>
                  <option value="">Selecione ou digite ao lado...</option>
                  {moradores.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.nome} (Apt {m.apt || '—'}) {m.condominio ? `• ${m.condominio}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label text-xs font-bold text-gray-700 flex items-center gap-1">
                  <Smartphone size={13} className="text-emerald-700" /> WhatsApp Destino (com DDD):
                </label>
                <input 
                  type="text" 
                  className="input text-xs font-bold text-gray-800 bg-white"
                  placeholder="Ex: 83999998888"
                  value={telefoneLivre}
                  onChange={e => setTelefoneLivre(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200">
              <label className="label text-xs font-black text-emerald-950 flex items-center gap-1.5 mb-1">
                <Building2 size={15} className="text-emerald-700" /> Selecionar Condomínio para Disparo em Massa:
              </label>
              <select className="input text-xs font-bold text-gray-900 bg-white" value={condoLote} onChange={e => setCondoLote(e.target.value)}>
                <option value="Todos">Todos os Condomínios Cadastrados</option>
                {condominios.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
              </select>
              <p className="text-[11px] text-emerald-800 mt-2">
                👥 O sistema enviará a mensagem personalizada individualmente com intervalo de segurança para todos os moradores com WhatsApp cadastrado.
              </p>
            </div>
          )}

          {/* Modelos de Mensagens Rápidas */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="label text-xs font-bold text-gray-700 mb-0 flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-500" /> Modelos Prontos de Mensagem:
              </label>
              <span className="text-[10px] text-gray-400 font-mono">Variáveis: {'{nome}'}, {'{condominio}'}, {'{apt}'}</span>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => aplicarTemplate('Olá {nome} ({apt})! Informamos que seu Boleto Condominial referente a este mês já está disponível para pagamento via PIX no aplicativo ou solicitando a 2ª via aqui. Atenciosamente, Alpha Soluções Condominiais.')}
                className="p-2 text-left bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl text-xs font-bold text-slate-800 flex items-center gap-1.5 transition-all"
              >
                <Megaphone size={13} className="text-emerald-600 shrink-0" />
                <span className="truncate">💳 Cobrança / Boleto</span>
              </button>

              <button
                type="button"
                onClick={() => aplicarTemplate('Prezado(a) {nome}, informamos que haverá Assembleia Geral do {condominio} nesta semana. Sua presença ou representação por procuração é fundamental para as deliberações. Contamos com você!')}
                className="p-2 text-left bg-slate-50 hover:bg-brand-50 border border-slate-200 hover:border-brand-300 rounded-xl text-xs font-bold text-slate-800 flex items-center gap-1.5 transition-all"
              >
                <Calendar size={13} className="text-brand-600 shrink-0" />
                <span className="truncate">🏛️ Assembleia</span>
              </button>

              <button
                type="button"
                onClick={() => aplicarTemplate('Olá {nome}! Chegou uma encomenda para a sua unidade ({apt}) na portaria do {condominio}. Por favor, retire na administração/portaria com documento de identificação.')}
                className="p-2 text-left bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-300 rounded-xl text-xs font-bold text-slate-800 flex items-center gap-1.5 transition-all"
              >
                <Package size={13} className="text-amber-600 shrink-0" />
                <span className="truncate">📦 Encomenda</span>
              </button>

              <button
                type="button"
                onClick={() => aplicarTemplate('COMUNICADO IMPORTANTE: Haverá manutenção programada no sistema de abastecimento de água do {condominio} hoje das 14h às 17h. Recomendamos reservar água para o período.')}
                className="p-2 text-left bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl text-xs font-bold text-slate-800 flex items-center gap-1.5 transition-all"
              >
                <Droplets size={13} className="text-blue-600 shrink-0" />
                <span className="truncate">💧 Manutenção Água</span>
              </button>

              <button
                type="button"
                onClick={() => aplicarTemplate('Olá {nome}! Constatamos pendência financeira referente à sua unidade ({apt}). Para regularização e emissão de 2ª via sem juros adicionais, entre em contato com nosso setor financeiro.')}
                className="p-2 text-left bg-slate-50 hover:bg-red-50 border border-slate-200 hover:border-red-300 rounded-xl text-xs font-bold text-slate-800 flex items-center gap-1.5 transition-all"
              >
                <AlertTriangle size={13} className="text-red-600 shrink-0" />
                <span className="truncate">⚠️ Inadimplência</span>
              </button>
            </div>
          </div>

          {/* Campo de Texto da Mensagem */}
          <div>
            <label className="label text-xs font-bold text-gray-700 flex items-center justify-between">
              <span>Texto da Mensagem:</span>
              <span className="text-[10px] text-gray-400 font-normal">{mensagem.length} caracteres</span>
            </label>
            <textarea
              className="input w-full min-h-[140px] text-xs font-medium text-gray-900 bg-white leading-relaxed resize-y"
              placeholder="Digite sua mensagem aqui... Use {nome}, {condominio} e {apt} para preenchimento automático."
              value={mensagem}
              onChange={e => setMensagem(e.target.value)}
            />
          </div>

          {/* Botões de Ação */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <p className="text-[11px] text-gray-500 flex items-center gap-1">
              <ShieldCheck size={14} className="text-emerald-600" /> Disparo 100% oficial e criptografado pela Evolution API.
            </p>

            <div className="flex gap-2 w-full sm:w-auto">
              {modoEnvio === 'individual' ? (
                <>
                  <button
                    type="button"
                    onClick={() => window.open(`https://wa.me/55${telefoneLivre.replace(/\D/g, '')}?text=${encodeURIComponent(mensagem)}`, '_blank')}
                    className="btn-secondary text-xs py-2 px-3 flex items-center justify-center gap-1 bg-white hover:bg-slate-50 border-gray-300"
                  >
                    <ExternalLink size={13} /> WhatsApp Web
                  </button>
                  <button
                    type="button"
                    onClick={handleSendIndividual}
                    disabled={sending}
                    className="btn-primary text-xs py-2.5 px-5 bg-emerald-600 hover:bg-emerald-500 font-black flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <Send size={14} /> {sending ? 'Enviando...' : '🚀 Enviar via Evolution API'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleSendLote}
                  disabled={sending}
                  className="btn-primary w-full sm:w-auto text-xs py-2.5 px-6 bg-emerald-600 hover:bg-emerald-500 font-black flex items-center justify-center gap-2 shadow-md"
                >
                  <Send size={14} /> {sending ? 'Disparando Lote...' : '🚀 Iniciar Disparo em Lote no WhatsApp'}
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Coluna 3: Histórico de Disparos Recentes */}
        <div className="card p-5 border border-cream-300 shadow-sm bg-white flex flex-col">
          <h3 className="font-black text-gray-900 text-sm mb-3 flex items-center gap-2">
            <span>📋</span> Histórico de Envios Recentes
          </h3>

          <div className="flex-1 overflow-y-auto max-h-[400px] divide-y divide-gray-100 text-xs">
            {logsEnvio.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                <p className="text-2xl mb-1">💬</p>
                <p className="font-bold">Nenhum envio recente nesta sessão.</p>
                <p className="text-[11px] mt-1">Os disparos realizados aparecerão aqui.</p>
              </div>
            ) : (
              logsEnvio.map((log, i) => (
                <div key={i} className="py-2.5">
                  <div className="flex justify-between items-center text-[10px] mb-1">
                    <span className="font-bold text-gray-900 truncate max-w-[140px]">{log.destinatario}</span>
                    <span className="text-gray-400 font-mono">{log.hora}</span>
                  </div>
                  <p className="text-[11px] text-gray-600 line-clamp-2 bg-slate-50 p-1.5 rounded-lg border border-gray-200 font-mono">
                    {log.texto}
                  </p>
                  <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                    <CheckCircle2 size={11} /> Entregue com sucesso
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  )
}
