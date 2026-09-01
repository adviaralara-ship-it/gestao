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

  const cleanNumber = String(number).replace(/\D/g, '');
  const finalNumber = cleanNumber.startsWith('55') ? cleanNumber : `55${cleanNumber}`;

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
      let mediaData = mediaUrl;

      if (mediaBase64) {
        // Se vier com prefixo data:application/pdf;base64, extrair apenas a string base64 pura
        if (mediaBase64.includes(',')) {
          mediaData = mediaBase64.split(',')[1];
        } else {
          mediaData = mediaBase64;
        }
      }

      payload = {
        number: finalNumber,
        mediatype: 'document',
        mimetype: 'application/pdf',
        caption: text || caption || '',
        media: mediaData,
        fileName: fileName || 'Boleto_Condominial.pdf'
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
