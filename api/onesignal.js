import { applyCors, verifyUserAuth } from './_middleware/auth.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Autenticação obrigatória
  const user = await verifyUserAuth(req, res);
  if (!user) return;

  const { title, message, targetUrl, targetUserId, targetUserIds } = req.body || {};

  if (!title || !message) {
    return res.status(400).json({ error: 'Título e mensagem são obrigatórios.' });
  }

  const APP_ID = process.env.ONESIGNAL_APP_ID || '94fc5c63-540e-479f-8866-ecc43fc7915c';
  const REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

  if (!REST_API_KEY) {
    return res.status(500).json({ error: 'Chave REST do OneSignal não configurada no servidor.' });
  }

  const payload = {
    app_id: APP_ID,
    contents: { en: message, pt: message },
    headings: { en: title, pt: title },
    ...(targetUrl && { url: targetUrl })
  };

  if (targetUserIds && Array.isArray(targetUserIds) && targetUserIds.length > 0) {
    payload.include_external_user_ids = targetUserIds;
    payload.channel_for_external_user_ids = 'push';
  } else if (targetUserId) {
    payload.include_external_user_ids = [targetUserId];
    payload.channel_for_external_user_ids = 'push';
  } else {
    // Comunicado geral para todos
    payload.included_segments = ['All'];
  }

  try {
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${REST_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error sending push:', error);
    return res.status(500).json({ error: 'Failed to send push notification' });
  }
}
