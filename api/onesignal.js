export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { title, message, targetUrl, targetUserId, targetUserIds } = req.body;

  const APP_ID = '94fc5c63-540e-479f-8866-ecc43fc7915c';
  const REST_API_KEY = 'os_v2_app_st6fyy2ubzdz7cdg5tcd7r4rlqyemd4wtcyelffedyy5zqcxuu5pm2dgtwynijdzfsfnnhqvcjds5cmycjnavbxipsea5ls4c3j4nsa';

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
    // Para OneSignal V1 API, usamos include_external_user_ids para external_id
    payload.include_external_user_ids = [targetUserId];
    payload.channel_for_external_user_ids = 'push';
  } else {
    // Comunicado para todos
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
