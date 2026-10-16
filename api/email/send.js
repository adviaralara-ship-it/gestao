// api/email/send.js
import nodemailer from 'nodemailer';
import { applyCors, verifyUserAuth } from '../_middleware/auth.js';

const GMAIL_USER = process.env.GMAIL_USER || 'alphaadmsc@gmail.com';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // Autenticação obrigatória (usuário logado no sistema)
  const user = await verifyUserAuth(req, res);
  if (!user) return;

  const rawPass = process.env.GMAIL_APP_PASSWORD || '';
  const effectivePass = rawPass.replace(/[^a-zA-Z0-9]/g, '');

  if (!effectivePass) {
    return res.status(400).json({ 
      error: 'Senha de aplicativo do Gmail não configurada no servidor (GMAIL_APP_PASSWORD).' 
    });
  }

  const { to, subject, html, text, cc, bcc, attachments } = req.body || {};

  if (!to || (!html && !text)) {
    return res.status(400).json({ error: 'Destinatário (to) e mensagem (html/text) são obrigatórios.' });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // SSL
      auth: {
        user: GMAIL_USER,
        pass: effectivePass
      }
    });

    // Formata anexos se fornecidos em Base64
    const formattedAttachments = (attachments || []).map(att => ({
      filename: att.filename,
      content: Buffer.from(att.base64, 'base64'),
      contentType: att.contentType
    }));

    const mailOptions = {
      from: `"Alpha Soluções Condominiais" <${GMAIL_USER}>`,
      to,
      subject: subject || 'Sem Assunto',
      text: text || '',
      html: html || (text ? text.replace(/\n/g, '<br/>') : ''),
      cc,
      bcc,
      attachments: formattedAttachments
    };

    const info = await transporter.sendMail(mailOptions);

    return res.status(200).json({
      success: true,
      messageId: info.messageId,
      response: info.response
    });

  } catch (err) {
    console.error('Erro ao enviar e-mail via SMTP:', err);
    return res.status(500).json({
      success: false,
      error: 'Falha ao enviar e-mail pelo Gmail: ' + err.message
    });
  }
}
