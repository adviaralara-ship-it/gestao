import { applyCors, verifyUserAuth } from './_middleware/auth.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

// Prevenção contra SSRF em URLs externas
function isSafeUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host.endsWith('.local') ||
      host === '127.0.0.1' ||
      host === '169.254.169.254' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Autenticação obrigatória
  const user = await verifyUserAuth(req, res);
  if (!user) return;

  const { number, text, instance = 'InstanciaAlpha', mediaBase64, mediaUrl, fileName, caption } = req.body || {};

  if (!number || (!text && !mediaBase64 && !mediaUrl)) {
    return res.status(400).json({ error: 'Número e mensagem ou documento são obrigatórios.' });
  }

  const rawNumber = String(number).trim();
  const isGroupJid = rawNumber.includes('@g.us');
  const cleanNumber = isGroupJid ? rawNumber : rawNumber.replace(/\D/g, '');
  const finalNumber = isGroupJid ? cleanNumber : (cleanNumber.startsWith('55') ? cleanNumber : `55${cleanNumber}`);

  const EVOLUTION_URL = process.env.EVOLUTION_URL || 'https://runningfly-evolution.cloudfy.live';
  const API_KEY = process.env.EVOLUTION_API_KEY || 'WHNRTDYyTpv4ze45wUUU5qN9ri3da1Oy';

  if (!API_KEY) {
    return res.status(500).json({ error: 'Chave da Evolution API (EVOLUTION_API_KEY) não configurada no servidor.' });
  }

  try {
    let endpoint = `${EVOLUTION_URL}/message/sendText/${instance}`;
    let payload = {
      number: finalNumber,
      text: text || caption || ''
    };

    const evolutionHeaders = {
      'Content-Type': 'application/json',
      'apikey': API_KEY,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    };

    if (mediaBase64 || mediaUrl) {
      endpoint = `${EVOLUTION_URL}/message/sendMedia/${instance}`;
      let mediaData = '';

      if (mediaBase64) {
        const raw = mediaBase64.includes(',') ? mediaBase64.split(',')[1] : mediaBase64;
        mediaData = raw.replace(/\s+/g, '');
      } else if (mediaUrl) {
        if (!isSafeUrl(mediaUrl)) {
          return res.status(400).json({ error: 'URL de mídia inválida ou não permitida (SSRF protection).' });
        }
        try {
          const resp = await fetch(mediaUrl);
          if (resp.ok) {
            const buf = await resp.arrayBuffer();
            mediaData = Buffer.from(buf).toString('base64');
          } else {
            mediaData = mediaUrl;
          }
        } catch (fetchErr) {
          console.warn('Falha ao converter mediaUrl em buffer base64, usando URL direta:', fetchErr);
          mediaData = mediaUrl;
        }
      }

      payload = {
        number: finalNumber,
        mediatype: 'document',
        mimetype: 'application/pdf',
        caption: text || caption || '',
        media: mediaData,
        fileName: fileName || 'Documento_Condominial.pdf'
      };
    }

    let response = await fetch(endpoint, {
      method: 'POST',
      headers: evolutionHeaders,
      body: JSON.stringify(payload)
    });

    let data = await response.json();
    if (!response.ok) {
      console.warn('Falha no envio pela instância primária:', instance, data, 'Tentando InstanciaCentral2...');
      const fallbackInstance = instance === 'InstanciaAlpha' ? 'InstanciaCentral2' : 'InstanciaAlpha';
      const fallbackEndpoint = endpoint.replace(`/${instance}`, `/${fallbackInstance}`);
      try {
        const respFb = await fetch(fallbackEndpoint, {
          method: 'POST',
          headers: evolutionHeaders,
          body: JSON.stringify(payload)
        });
        if (respFb.ok) {
          data = await respFb.json();
          return res.status(200).json({ success: true, data, fallbackUsed: fallbackInstance });
        }
      } catch (errFb) {
        console.warn('Fallback também falhou:', errFb);
      }
      return res.status(response.status).json({ success: false, error: data?.response?.message || data?.message || 'Erro no envio pela Evolution API' });
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Erro ao enviar WhatsApp Evolution:', error);
    return res.status(500).json({ success: false, error: error.message || 'Falha de comunicação com o servidor' });
  }
}
