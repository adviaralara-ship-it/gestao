export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { number, text, instance = 'InstanciaAlpha', mediaUrl, fileName, caption } = req.body;

  if (!number || (!text && !mediaUrl)) {
    return res.status(400).json({ error: 'Número e mensagem/mídia são obrigatórios.' });
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

    if (mediaUrl) {
      endpoint = `${EVOLUTION_URL}/message/sendMedia/${instance}`;
      payload = {
        number: finalNumber,
        mediatype: 'document',
        mimetype: 'application/pdf',
        caption: text || caption || '',
        media: mediaUrl,
        fileName: fileName || 'documento.pdf'
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
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Erro ao enviar WhatsApp Evolution:', error);
    return res.status(500).json({ error: 'Falha ao enviar mensagem via WhatsApp' });
  }
}
