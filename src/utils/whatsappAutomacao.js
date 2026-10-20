import { gerarBoletoPdfBase64 } from './boletoPdf'

/**
 * Envia um boleto em PDF diretamente via WhatsApp para o morador utilizando Base64 direto
 * @param {Object} boleto - Dados do boleto
 * @param {Object} morador - Dados do morador (deve conter telefone)
 * @param {Object} condoDoc - Dados do condomínio
 * @param {string} customMsg - Mensagem personalizada (opcional)
 */
export async function enviarBoletoWhatsAppAuto(boleto, morador, condoDoc, customMsg = null) {
  const rawTel = morador?.tel || morador?.telefone || morador?.whatsapp || morador?.celular || morador?.fone || morador?.contato || morador?.numero || boleto?.telefone || boleto?.tel || boleto?.whatsapp || boleto?.celular || ''
  const tel = String(rawTel).replace(/\D/g, '')

  if (!tel || tel.length < 8) {
    return { success: false, error: 'Morador não possui telefone/WhatsApp válido cadastrado no sistema.' }
  }

  try {
    // 1. Gera o Base64 do PDF em alta resolução
    const base64Data = await gerarBoletoPdfBase64(boleto, condoDoc)
    const fileName = `Boleto_${(boleto.morador || 'Morador').replace(/[^a-zA-Z0-9]/g, '_')}_${(boleto.competencia || 'Mes').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`

    // 2. Monta o texto amigável
    const valorFmt = Number(boleto.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
    const vencFmt = boleto.vencimento ? (boleto.vencimento.includes('-') ? boleto.vencimento.split('-').reverse().join('/') : boleto.vencimento) : '—'
    
    const textoFinal = customMsg || `Olá *${boleto.morador}* (Apt *${boleto.apt || '—'}*)!\n\nSegue em anexo o seu *Boleto Condominial* referente a *${boleto.competencia || 'Mês Vigente'}* do *${condoDoc?.nome || boleto.condominio || 'seu condomínio'}*.\n\n💰 *Valor:* R$ ${valorFmt}\n📅 *Vencimento:* ${vencFmt}\n\nVocê pode efetuar o pagamento via *PIX Instantâneo* escaneando o *QR Code* no PDF ou pelo *PIX Copia e Cola*.\n\nAtenciosamente,\n*Alpha Soluções Condominiais*`

    // 3. Envia via API serverless ou fallback direto na Evolution API com timeout de 20 segundos
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 20000)

    const finalNumber = tel.startsWith('55') ? tel : `55${tel}`
    let data = null

    try {
      const res = await fetch('/api/whatsapp-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: finalNumber,
          text: textoFinal,
          mediaBase64: base64Data,
          fileName: fileName,
          instance: 'InstanciaAlpha'
        }),
        signal: controller.signal
      })

      if (res.ok) {
        data = await res.json()
      } else {
        const errJson = await res.json().catch(() => ({}))
        console.warn('Rota /api/whatsapp-send retornou status', res.status, errJson)
      }
    } catch (routeErr) {
      console.warn('Falha ao chamar /api/whatsapp-send, acionando fallback direto Evolution:', routeErr)
    } finally {
      clearTimeout(timeoutId)
    }

    // Fallback direto Evolution API (caso a serverless na Vercel não tenha credencial ou dê 401/500)
    if (!data || !data.success) {
      try {
        const EVOLUTION_URL = 'https://runningfly-evolution.cloudfy.live'
        const API_KEY = 'WHNRTDYyTpv4ze45wUUU5qN9ri3da1Oy'
        const rawMedia = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data

        const resDirect = await fetch(`${EVOLUTION_URL}/message/sendMedia/InstanciaAlpha`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': API_KEY
          },
          body: JSON.stringify({
            number: finalNumber,
            mediatype: 'document',
            mimetype: 'application/pdf',
            caption: textoFinal,
            media: rawMedia.replace(/\s+/g, ''),
            fileName: fileName
          })
        })

        if (resDirect.ok) {
          const directData = await resDirect.json()
          return { success: true, data: directData }
        } else {
          const directErr = await resDirect.json().catch(() => ({}))
          return { success: false, error: directErr?.response?.message || directErr?.message || 'Falha no envio via Evolution API' }
        }
      } catch (errDirect) {
        console.error('Erro no fallback Evolution:', errDirect)
        return { success: false, error: errDirect.message || 'Erro de conexão com o WhatsApp' }
      }
    }

    return data
  } catch (err) {
    console.error('Erro no envio de boleto via WhatsApp:', err)
    return { success: false, error: err.message || 'Tempo limite esgotado no envio' }
  }
}

/**
 * Função universal para disparo de mensagens e mídias via WhatsApp (com fallback direto na Evolution API)
 */
export async function enviarMensagemWhatsApp({ number, text, mediaBase64, fileName, instance = 'InstanciaAlpha' }) {
  const rawTel = String(number || '').trim()
  const isGroupJid = rawTel.includes('@g.us')
  const cleanNumber = isGroupJid ? rawTel : rawTel.replace(/\D/g, '')
  const finalNumber = isGroupJid ? cleanNumber : (cleanNumber.startsWith('55') ? cleanNumber : `55${cleanNumber}`)

  if (!finalNumber || (!isGroupJid && finalNumber.length < 10)) {
    return { success: false, error: 'Número de WhatsApp inválido.' }
  }

  const EVOLUTION_URL = 'https://runningfly-evolution.cloudfy.live'
  const API_KEY = 'WHNRTDYyTpv4ze45wUUU5qN9ri3da1Oy'

  // 1. Tenta rota do backend serverless
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 18000)
    const res = await fetch('/api/whatsapp-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        number: finalNumber,
        text,
        mediaBase64,
        fileName,
        instance
      }),
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    if (res.ok) {
      const data = await res.json()
      if (data && data.success) return data
    }
  } catch (errServerless) {
    console.warn('Backend serverless falhou, acionando Evolution direto:', errServerless)
  }

  // 2. Fallback direto Evolution API
  try {
    if (mediaBase64) {
      const rawMedia = mediaBase64.includes(',') ? mediaBase64.split(',')[1] : mediaBase64
      const resDirect = await fetch(`${EVOLUTION_URL}/message/sendMedia/${instance}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': API_KEY
        },
        body: JSON.stringify({
          number: finalNumber,
          mediatype: 'document',
          mimetype: 'application/pdf',
          caption: text || '',
          media: rawMedia.replace(/\s+/g, ''),
          fileName: fileName || 'Documento.pdf'
        })
      })
      if (resDirect.ok) {
        const directData = await resDirect.json()
        return { success: true, data: directData }
      } else {
        const errJson = await resDirect.json().catch(() => ({}))
        return { success: false, error: errJson?.response?.message || errJson?.message || 'Falha no envio da mídia via Evolution' }
      }
    } else {
      const resDirect = await fetch(`${EVOLUTION_URL}/message/sendText/${instance}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': API_KEY
        },
        body: JSON.stringify({
          number: finalNumber,
          text: text || ''
        })
      })
      if (resDirect.ok) {
        const directData = await resDirect.json()
        return { success: true, data: directData }
      } else {
        const errJson = await resDirect.json().catch(() => ({}))
        return { success: false, error: errJson?.response?.message || errJson?.message || 'Falha no envio de texto via Evolution' }
      }
    }
  } catch (errDirect) {
    console.error('Erro na conexão direta com a Evolution API:', errDirect)
    return { success: false, error: errDirect.message || 'Erro de conexão com o WhatsApp' }
  }
}

/**
 * Envia a notificacao de uma NOVA ENQUETE para o grupo de WhatsApp do condominio.
 * A votacao oficial continua 100% dentro do ERP (Firestore); o WhatsApp serve
 * apenas para notificar e direcionar os moradores para a pagina de enquetes.
 * @param {Object} enquete - { pergunta, opcoes: [], dataFim }
 * @param {Object} condoDoc - documento do condominio (deve conter grupoWhatsapp)
 */
export async function enviarEnqueteWhatsAppGrupo(enquete, condoDoc) {
  const grupo = String(condoDoc?.grupoWhatsapp || '').trim()
  if (!grupo) {
    return { success: false, error: 'Condominio sem grupo de WhatsApp cadastrado (campo grupoWhatsapp).' }
  }
  const pergunta = String(enquete?.pergunta || '').trim()
  const opcoes = Array.isArray(enquete?.opcoes) ? enquete.opcoes.map(o => String(o || '').trim()).filter(Boolean) : []
  if (!pergunta || opcoes.length === 0) {
    return { success: false, error: 'Enquete sem pergunta ou opcoes validas.' }
  }
  const dataFmt = enquete?.dataFim
    ? (String(enquete.dataFim).includes('-') ? String(enquete.dataFim).split('-').reverse().join('/') : String(enquete.dataFim))
    : 'a definir'
  const listaOpcoes = opcoes.map((op, i) => `${i + 1}. ${op}`).join('\n')
  const origin = (typeof window !== 'undefined' && window.location?.origin)
    ? window.location.origin
    : 'https://alpha-solucoes-condominiais.vercel.app'
  const enqueteId = enquete?.id || enquete?._id || ''
  const linkEnquetes = enqueteId ? `${origin}/votacao/${enqueteId}` : `${origin}/votacao`
  const textoFinal = `📊 *NOVA ENQUETE NO CONDOMINIO!*\n\n🏢 *Condominio:* ${condoDoc?.nome || '—'}\n❓ *Pergunta:* ${pergunta}\n\n🗳️ *Opcoes de voto:*\n${listaOpcoes}\n\n⏰ *Votacao ate:* ${dataFmt}\n\n👉 *Vote pelo sistema (registro oficial):*\n${linkEnquetes}\n\n_Respostas neste grupo NAO sao computadas. O voto valido e apenas pelo link acima._\n\nAtenciosamente,\n*Alpha Solucoes Condominiais*`
  
  return await enviarMensagemWhatsApp({ number: grupo, text: textoFinal, instance: 'InstanciaAlpha' })
}

/**
 * Consulta a lista de grupos disponíveis na InstanciaAlpha conectada.
 * Retorna [{ id: '...@g.us', subject: 'Nome do Grupo' }]
 */
export async function buscarGruposWhatsApp(instance = 'InstanciaAlpha') {
  try {
    // 1. Tenta rota serverless /api/whatsapp-groups
    const res = await fetch(`/api/whatsapp-groups?instance=${encodeURIComponent(instance)}`)
    if (res.ok) {
      const data = await res.json()
      if (data.success && Array.isArray(data.groups) && data.groups.length > 0) {
        return data.groups
      }
    }
  } catch (e) {
    console.warn('Tentando fallback direto na Evolution API para buscar grupos:', e)
  }

  // 2. Fallback direto para Evolution API
  try {
    const EVOLUTION_URL = 'https://runningfly-evolution.cloudfy.live'
    const API_KEY = 'WHNRTDYyTpv4ze45wUUU5qN9ri3da1Oy'
    const resDirect = await fetch(`${EVOLUTION_URL}/group/fetchAllGroups/${instance}?getParticipants=false`, {
      method: 'GET',
      headers: { 'apikey': API_KEY }
    })
    if (resDirect.ok) {
      const raw = await resDirect.json()
      if (Array.isArray(raw)) {
        return raw.map(g => ({
          id: g.id,
          subject: g.subject || g.name || 'Grupo sem nome'
        }))
      }
    }
  } catch (errDirect) {
    console.error('Erro no fallback da Evolution API ao listar grupos:', errDirect)
  }

  return []
}
