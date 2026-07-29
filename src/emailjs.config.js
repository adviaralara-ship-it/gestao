/**
 * Configuração do EmailJS — Alpha Soluções Condominiais
 *
 * Para ativar o envio real pelo alphaadmsc@gmail.com:
 * 1. Acesse https://dashboard.emailjs.com
 * 2. Em "Email Services" → Add Service → Gmail → conecte alphaadmsc@gmail.com
 *    → copie o Service ID gerado (ex: service_abc123)
 * 3. Em "Email Templates" → Create Template com as variáveis abaixo
 *    → copie o Template ID (ex: template_xyz789)
 * 4. Em "Account" → API Keys → copie a Public Key
 * 5. Cole os valores abaixo e troque ATIVO para true
 *
 * Variáveis do template:
 *   {{para_email}}  → email do destinatário
 *   {{para_nome}}   → nome do destinatário
 *   {{assunto}}     → assunto do e-mail
 *   {{mensagem}}    → corpo da mensagem (HTML permitido)
 *   {{de_nome}}     → Alpha Admin SC
 *
 * Plano gratuito: 200 e-mails/mês ✅
 */

export const EMAILJS_CONFIG = {
  SERVICE_ID:  'service_alphaadmsc',   // ← cole aqui o Service ID do EmailJS
  TEMPLATE_ID: 'template_alpha_notif', // ← cole aqui o Template ID
  PUBLIC_KEY:  'vL-m2KCi--CtV8d6Z',   // ← Public Key da conta alphaadmsc@gmail.com
  ATIVO: false,                        // ← troque para true depois de configurar
  EMAIL_ADM: 'alphaadmsc@gmail.com',  // e-mail que recebe todas as notificações ADM
}

/**
 * Envia e-mail via EmailJS.
 * Se ATIVO=false, apenas loga no console (modo demonstração).
 *
 * @param {string} paraEmail   - destinatário
 * @param {string} paraNome    - nome do destinatário
 * @param {string} assunto     - assunto
 * @param {string} mensagem    - corpo da mensagem
 */
export async function enviarEmail(paraEmail, paraNome, assunto, mensagem) {
  if (!EMAILJS_CONFIG.ATIVO) {
    console.info('[EmailJS DEMO] Simulando envio para:', paraEmail, '|', assunto)
    return { status: 200, text: 'demo' }
  }
  try {
    // EmailJS CDN carregado dinamicamente para não precisar de dependência extra
    if (!window.emailjs) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script')
        s.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js'
        s.onload = resolve; s.onerror = reject
        document.head.appendChild(s)
      })
      window.emailjs.init({ publicKey: EMAILJS_CONFIG.PUBLIC_KEY })
    }
    return await window.emailjs.send(
      EMAILJS_CONFIG.SERVICE_ID,
      EMAILJS_CONFIG.TEMPLATE_ID,
      {
        para_email: paraEmail,
        para_nome:  paraNome,
        assunto,
        mensagem,
        de_nome:    'Alpha Admin SC',
      }
    )
  } catch (err) {
    console.error('[EmailJS] Erro ao enviar:', err)
    return null
  }
}

/**
 * Atalho: envia notificação para o e-mail da administração
 */
export async function notificarAdm(assunto, mensagem) {
  return enviarEmail(EMAILJS_CONFIG.EMAIL_ADM, 'Administração', assunto, mensagem)
}
