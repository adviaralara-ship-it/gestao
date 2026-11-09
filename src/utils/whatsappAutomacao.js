import { gerarBoletoPdfBase64 } from './boletoPdf'
import { auth } from '../firebase'

async function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' }
  try {
    if (auth?.currentUser) {
      const token = await auth.currentUser.getIdToken(false)
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
    }
  } catch (err) {
    console.warn('[whatsappAutomacao] Falha ao obter JWT do usuário:', err?.message)
  }
  return headers
}


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
        headers: await getAuthHeaders(),
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
        return { success: false, error: errJson?.error || errJson?.message || 'Falha no envio de WhatsApp pelo servidor seguro' }
      }
    } catch (routeErr) {
      console.warn('Falha na requisição para /api/whatsapp-send:', routeErr)
      return { success: false, error: routeErr.message || 'Erro de conexão com o servidor de mensagens' }
    } finally {
      clearTimeout(timeoutId)
    }

    return data || { success: false, error: 'Resposta indefinida do servidor de WhatsApp' }
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

  // Roteamento exclusivo pelo backend serverless seguro
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 20000)
    const headers = await getAuthHeaders()
    const res = await fetch('/api/whatsapp-send', {
      method: 'POST',
      headers,
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
      return { success: false, error: data?.error || 'Erro no envio' }
    } else {
      const errJson = await res.json().catch(() => ({}))
      return { success: false, error: errJson?.error || errJson?.message || `Erro HTTP ${res.status} no servidor de mensagens` }
    }
  } catch (errServerless) {
    console.warn('Erro ao conectar com /api/whatsapp-send:', errServerless)
    return { success: false, error: errServerless.message || 'Falha de comunicação com o serviço de WhatsApp' }
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

/**
 * Gera o texto formatado para envio de agendamento ou cancelamento de reserva no grupo de WhatsApp do condomínio
 */
export function gerarTextoReservaWhatsApp(reserva, condoNome) {
  const isCancelada = reserva?.status === 'Cancelada'
  const espaco = reserva?.espaco || 'Área Comum'
  const morador = reserva?.morador || 'Morador'
  const apt = reserva?.apt ? `Apt ${reserva.apt}` : ''
  const dataFmt = reserva?.data
    ? (String(reserva.data).includes('-') ? String(reserva.data).split('-').reverse().join('/') : String(reserva.data))
    : 'A definir'
  const horario = reserva?.horario || 'Horário a combinar'
  const pessoas = reserva?.pessoas ? `${reserva.pessoas} pessoas` : 'Não informado'

  if (isCancelada) {
    return `🚫 *AVISO DE CANCELAMENTO DE RESERVA*\n\n🏢 *Condomínio:* ${condoNome || reserva?.condominio || '—'}\n🎈 *Espaço Liberado:* ${espaco}\n👤 *Morador:* ${morador} ${apt ? `(${apt})` : ''}\n🗓️ *Data:* ${dataFmt}\n⏰ *Horário:* ${horario}\n📌 *Status:* CANCELADA (Espaço disponível para novo agendamento)\n\n_Caso deseje reservar este espaço nesta data/horário, acesse o painel Alpha Gestão._\n\nAtenciosamente,\n*Alpha Soluções Condominiais*`
  }

  const status = reserva?.status || 'Pendente'
  return `📅 *NOVA RESERVA REGISTRADA!*\n\n🏢 *Condomínio:* ${condoNome || reserva?.condominio || '—'}\n🎈 *Espaço:* ${espaco}\n👤 *Morador:* ${morador} ${apt ? `(${apt})` : ''}\n🗓️ *Data:* ${dataFmt}\n⏰ *Horário:* ${horario}\n👥 *Convidados:* ${pessoas}\n📌 *Status:* ${status}\n\n_Para consultar o calendário completo de áreas comuns, acesse o painel Alpha Gestão._\n\nAtenciosamente,\n*Alpha Soluções Condominiais*`
}

/**
 * Envia notificação de reserva diretamente para o grupo de WhatsApp do condomínio
 */
export async function enviarReservaWhatsAppGrupo(reserva, condoDoc) {
  const grupo = String(condoDoc?.grupoWhatsapp || '').trim()
  if (!grupo) {
    return { success: false, error: 'Condomínio não possui o grupo de WhatsApp configurado (campo grupoWhatsapp).' }
  }

  const textoFinal = gerarTextoReservaWhatsApp(reserva, condoDoc?.nome || reserva.condominio)
  return await enviarMensagemWhatsApp({ number: grupo, text: textoFinal, instance: 'InstanciaAlpha' })
}

export async function buscarGruposWhatsApp(instance = 'InstanciaAlpha') {
  try {
    const headers = await getAuthHeaders()
    const res = await fetch(`/api/whatsapp-send?instance=${encodeURIComponent(instance)}`, {
      headers
    })
    if (res.ok) {
      const data = await res.json()
      if (data.success && Array.isArray(data.groups)) {
        return data.groups
      }
    }
  } catch (e) {
    console.warn('Erro ao consultar grupos via rota segura /api/whatsapp-send:', e)
  }

  return []
}
