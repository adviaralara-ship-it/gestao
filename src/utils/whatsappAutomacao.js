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

    // 3. Envia diretamente via API em Base64 com timeout de 15 segundos
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    const res = await fetch('/api/whatsapp-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        number: tel,
        text: textoFinal,
        mediaBase64: base64Data,
        fileName: fileName,
        instance: 'InstanciaAlpha'
      }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)
    const data = await res.json()
    return data
  } catch (err) {
    console.error('Erro no envio de boleto via WhatsApp:', err)
    return { success: false, error: err.message || 'Tempo limite esgotado no envio' }
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
  const linkEnquetes = (typeof window !== 'undefined' && window.location?.origin)
    ? `${window.location.origin}/enquetes`
    : 'https://alpha-solucoes-condominiais.vercel.app/enquetes'
  const textoFinal = `\u{1F4CA} *NOVA ENQUETE NO CONDOMINIO!*\n\n\u{1F3E2} *Condominio:* ${condoDoc?.nome || '—'}\n\u2753 *Pergunta:* ${pergunta}\n\n\u{1F5F3}\uFE0F *Opcoes de voto:*\n${listaOpcoes}\n\n\u23F0 *Votacao ate:* ${dataFmt}\n\n\u{1F449} *Vote pelo sistema (registro oficial):*\n${linkEnquetes}\n\n_Respostas neste grupo NAO sao computadas. O voto valido e apenas pelo link acima._\n\nAtenciosamente,\n*Alpha Solucoes Condominiais*`
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)
    const res = await fetch('/api/whatsapp-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: grupo, text: textoFinal, instance: 'InstanciaAlpha' }),
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    const data = await res.json()
    return data
  } catch (err) {
    console.error('Erro no envio de enquete via WhatsApp:', err)
    return { success: false, error: err.message || 'Tempo limite esgotado no envio' }
  }
}
