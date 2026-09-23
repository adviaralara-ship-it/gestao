import nodemailer from 'nodemailer';

const EMAIL_REMETENTE = 'alphaadmsc@gmail.com';
const SENHA_APP = process.env.GMAIL_APP_PASSWORD || 'pognicpypmgbxmrw';
const EMAIL_ADMIN_ALERTA = process.env.SECURITY_ALERT_EMAIL || 'alphaadmsc@gmail.com';

export async function enviarAlarmeSeguranca({ tipo, titulo, detalhes, metadata = {} }) {
  try {
    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: EMAIL_REMETENTE,
        pass: SENHA_APP,
      },
    });

    const dataHora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 20px; color: #1e293b;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 2px solid #ef4444; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.08);">
          <div style="background-color: #dc2626; color: #ffffff; padding: 18px 24px; text-align: center;">
            <h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.5px;">🚨 ALARME DE SEGURANÇA ALPHA</h1>
            <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">Comportamento Incomum Detectado no Sistema</p>
          </div>

          <div style="padding: 24px;">
            <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; margin-bottom: 20px; border-radius: 4px;">
              <p style="margin: 0; font-size: 14px; font-weight: bold; color: #991b1b;">Tipo de Alerta: ${tipo}</p>
              <p style="margin: 4px 0 0 0; font-size: 15px; font-weight: bold; color: #111827;">${titulo}</p>
            </div>

            <p style="font-size: 14px; line-height: 1.6; color: #374151; margin-bottom: 16px;">
              ${detalhes}
            </p>

            <div style="background-color: #f1f5f9; border-radius: 8px; padding: 14px; font-size: 13px; color: #475569; margin-bottom: 20px;">
              <p style="margin: 0 0 6px 0;"><strong>📅 Data e Horário (Brasília):</strong> ${dataHora}</p>
              ${metadata.ip ? `<p style="margin: 0 0 6px 0;"><strong>🌐 Endereço IP:</strong> ${metadata.ip}</p>` : ''}
              ${metadata.usuario ? `<p style="margin: 0 0 6px 0;"><strong>👤 Usuário / E-mail:</strong> ${metadata.usuario}</p>` : ''}
              ${metadata.quantidade ? `<p style="margin: 0 0 6px 0;"><strong>📊 Quantidade / Volume:</strong> ${metadata.quantidade}</p>` : ''}
              ${metadata.condominio ? `<p style="margin: 0 0 6px 0;"><strong>🏢 Condomínio:</strong> ${metadata.condominio}</p>` : ''}
            </div>

            <div style="text-align: center; margin-top: 25px;">
              <a href="https://alpha-solucoes-condominiais.vercel.app/seguranca" 
                 style="display: inline-block; background-color: #dc2626; color: #ffffff; text-decoration: none; padding: 12px 24px; font-weight: bold; font-size: 14px; border-radius: 8px; box-shadow: 0 2px 8px rgba(220,38,38,0.3);">
                Abrir Painel de Segurança e Alarmes
              </a>
            </div>
          </div>

          <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 14px 24px; text-align: center; font-size: 11px; color: #94a3b8;">
            Alpha Soluções Condominiais • Módulo de Proteção e Blindagem Automática
          </div>
        </div>
      </div>
    `;

    const info = await transporter.sendMail({
      from: `"Alpha Segurança" <${EMAIL_REMETENTE}>`,
      to: EMAIL_ADMIN_ALERTA,
      subject: `🚨 ALERTA CRÍTICO: ${titulo}`,
      html: htmlBody,
    });

    console.log('[Alarme de Segurança] E-mail enviado com sucesso:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[Alarme de Segurança] Falha ao enviar e-mail:', error);
    return { success: false, error: error.message };
  }
}
