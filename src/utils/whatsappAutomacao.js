import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from '../firebase'
import { gerarBoletoPdfBlob } from './boletoPdf'

/**
 * Envia um boleto em PDF diretamente via WhatsApp para o morador
 * @param {Object} boleto - Dados do boleto
 * @param {Object} morador - Dados do morador (deve conter telefone)
 * @param {Object} condoDoc - Dados do condomínio
 * @param {string} customMsg - Mensagem personalizada (opcional)
 */
export async function enviarBoletoWhatsAppAuto(boleto, morador, condoDoc, customMsg = null) {
  const rawTel = morador?.tel || morador?.telefone || morador?.whatsapp || morador?.celular || morador?.fone || morador?.contato || morador?.numero || ''
  const tel = String(rawTel).replace(/\D/g, '')

  if (!tel || tel.length < 8) {
    return { success: false, error: 'Morador não possui telefone/WhatsApp válido cadastrado' }
  }

  try {
    // 1. Gera o Blob do PDF
    const pdfBlob = await gerarBoletoPdfBlob(boleto, condoDoc)
    const fileName = `Boleto_${(boleto.morador || 'Morador').replace(/[^a-zA-Z0-9]/g, '_')}_${(boleto.competencia || 'Mes').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`

    // 2. Upload temporário no Storage
    const uploadedFileRef = ref(storage, `whatsapp_docs/${Date.now()}_${fileName}`)
    const snap = await uploadBytes(uploadedFileRef, pdfBlob)
    const mediaUrl = await getDownloadURL(snap.ref)

    // 3. Monta o texto padrão amigável caso não tenha customizado
    const valorFmt = Number(boleto.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
    const vencFmt = boleto.vencimento ? (boleto.vencimento.includes('-') ? boleto.vencimento.split('-').reverse().join('/') : boleto.vencimento) : '—'
    
    const textoFinal = customMsg || `Olá *${boleto.morador}* (Apt *${boleto.apt || '—'}*)!\n\nSegue em anexo o seu *Boleto Condominial* referente a *${boleto.competencia || 'Mês Vigente'}* do *${condoDoc?.nome || boleto.condominio || 'seu condomínio'}*.\n\n💰 *Valor:* R$ ${valorFmt}\n📅 *Vencimento:* ${vencFmt}\n\nVocê pode efetuar o pagamento diretamente escaneando o *QR Code* no arquivo PDF anexo ou pelo *PIX Copia e Cola*.\n\nAtenciosamente,\n*Alpha Soluções Condominiais*`

    // 4. Envia para a API da Evolution
    const res = await fetch('/api/whatsapp-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        number: tel,
        text: textoFinal,
        mediaUrl: mediaUrl,
        fileName: fileName,
        instance: 'InstanciaAlpha'
      })
    })

    const data = await res.json()

    // 5. Limpeza automática do Storage em 20s
    setTimeout(async () => {
      try {
        await deleteObject(uploadedFileRef)
      } catch(e) {}
    }, 20000)

    return data
  } catch (err) {
    console.error('Erro no envio automático de boleto via WhatsApp:', err)
    return { success: false, error: err.message || 'Erro de conexão com o WhatsApp' }
  }
}
