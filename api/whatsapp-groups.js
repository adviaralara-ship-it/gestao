import { applyCors, verifyUserAuth } from './_middleware/auth.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Autenticação obrigatória
  const user = await verifyUserAuth(req, res);
  if (!user) return;

  const instance = req.query?.instance || 'InstanciaAlpha';
  const EVOLUTION_URL = process.env.EVOLUTION_URL || 'https://runningfly-evolution.cloudfy.live';
  const API_KEY = process.env.EVOLUTION_API_KEY || 'WHNRTDYyTpv4ze45wUUU5qN9ri3da1Oy';

  try {
    const response = await fetch(`${EVOLUTION_URL}/group/fetchAllGroups/${instance}?getParticipants=false`, {
      method: 'GET',
      headers: {
        'apikey': API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const raw = await response.json();
      const groups = Array.isArray(raw)
        ? raw.map(g => ({ id: g.id, subject: g.subject || g.name || 'Grupo sem nome' }))
        : [];
      return res.status(200).json({ success: true, groups });
    } else {
      const err = await response.text();
      return res.status(response.status).json({ success: false, error: 'Falha ao buscar grupos na Evolution API.', details: err });
    }
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || 'Erro de conexão com o servidor WhatsApp' });
  }
}
