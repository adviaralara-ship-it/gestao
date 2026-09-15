export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { number, text, instance = 'InstanciaAlpha', mediaBase64, mediaUrl, fileName, caption } = req.body;

  if (!number || (!text && !mediaBase64 && !mediaUrl)) {
    return res.status(400).json({ error: 'Número e mensagem ou documento PDF são obrigatórios.' });
  }

  // Suporte a JID de grupo do WhatsApp (ex: 120363012345678901@g.us):
  // grupos nao devem ser limpos/prefixados como numeros de telefone comuns.
  const rawNumber = String(number).trim();
  const isGroupJid = rawNumber.includes('@g.us');
  const cleanNumber = isGroupJid ? rawNumber : rawNumber.replace(/\D/g, '');
  const finalNumber = isGroupJid ? cleanNumber : (cleanNumber.startsWith('55') ? cleanNumber : `55${cleanNumber}`);

  const EVOLUTION_URL = 'https://spiritualmacaw-evolution.cloudfy.live';
  const API_KEY = 'Q1CguwvCa34nqB1936dHekPICikeSCHb';

  try {
    let endpoint = `${EVOLUTION_URL}/message/sendText/${instance}`;
    let payload = {
      number: finalNumber,
      text: text || caption || ''
    };

    if (mediaBase64 || mediaUrl) {
      endpoint = `${EVOLUTION_URL}/message/sendMedia/${instance}`;
      let mediaData = '';

      if (mediaBase64) {
        // Se vier com prefixo data:application/pdf;base64, extrair apenas a string base64 pura
        const raw = mediaBase64.includes(',') ? mediaBase64.split(',')[1] : mediaBase64;
        mediaData = raw.replace(/\s+/g, '');
      } else if (mediaUrl) {
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

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': API_KEY
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Erro retornado pela Evolution API:', data);
      return res.status(response.status).json({ success: false, error: data?.response?.message || data?.message || 'Erro no envio pela Evolution API' });
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Erro ao enviar WhatsApp Evolution:', error);
    return res.status(500).json({ success: false, error: error.message || 'Falha de comunicação com o servidor' });
  }
}
