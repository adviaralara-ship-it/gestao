// api/email/inbox.js
import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import { applyCors, verifyUserAuth } from '../_middleware/auth.js';

const GMAIL_USER = process.env.GMAIL_USER || 'alphaadmsc@gmail.com';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

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

  let connection;
  try {
    const config = {
      imap: {
        user: GMAIL_USER,
        password: effectivePass,
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
        authTimeout: 10000
      }
    };

    connection = await imaps.connect(config);
    await connection.openBox('INBOX');

    // Busca os e-mails mais recentes (últimos 30 dias ou últimas 30 mensagens)
    const delay = 30 * 24 * 3600 * 1000;
    const sinceDate = new Date(Date.now() - delay);
    const searchCriteria = [
      ['SINCE', sinceDate.toISOString().slice(0, 10)]
    ];

    const fetchOptions = {
      bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', 'TEXT', ''],
      struct: true,
      markSeen: false
    };

    const messages = await connection.search(searchCriteria, fetchOptions);

    // Ordena do mais recente para o mais antigo e limita em 35 para carregamento ágil
    messages.sort((a, b) => {
      const dateA = new Date(a.attributes?.date || 0);
      const dateB = new Date(b.attributes?.date || 0);
      return dateB - dateA;
    });

    const recentMessages = messages.slice(0, 35);
    const emailList = [];

    for (const item of recentMessages) {
      const all = item.parts.find(part => part.which === '');
      if (!all || !all.body) continue;

      const parsed = await simpleParser(all.body);

      const attachmentsInfo = (parsed.attachments || []).map(att => ({
        filename: att.filename || 'anexo',
        contentType: att.contentType,
        size: att.size,
        contentBase64: att.content ? att.content.toString('base64') : null
      }));

      emailList.push({
        uid: item.attributes?.uid || Math.random().toString(36).substring(7),
        seqNo: item.seqNo,
        date: parsed.date ? parsed.date.toISOString() : new Date().toISOString(),
        from: parsed.from ? (parsed.from.text || parsed.from.value?.[0]?.address || '') : '',
        to: parsed.to ? (parsed.to.text || '') : '',
        subject: parsed.subject || '(Sem assunto)',
        text: parsed.text ? parsed.text.slice(0, 300) : '',
        html: parsed.html || (parsed.text ? `<pre style="font-family:inherit;white-space:pre-wrap;">${parsed.text}</pre>` : ''),
        hasAttachments: attachmentsInfo.length > 0,
        attachments: attachmentsInfo
      });
    }

    connection.end();

    return res.status(200).json({
      success: true,
      total: emailList.length,
      emails: emailList
    });

  } catch (err) {
    if (connection) {
      try { connection.end(); } catch (e) {}
    }
    console.error('Erro ao buscar e-mails via IMAP:', err);
    return res.status(500).json({
      success: false,
      error: 'Falha ao conectar na caixa de entrada do Gmail: ' + err.message
    });
  }
}
