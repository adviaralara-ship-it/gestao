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
  const API_KEY = process.env.EVOLUTION_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: 'Chave da Evolution API não configurada no servidor.' });
  }

  try {
    const response = await fetch(`${EVOLUTION_URL}/instance/fetchInstances`, {
      method: 'GET',
      headers: { 'apikey': API_KEY }
    });
    const instances = await response.json();
    return res.status(200).json({ success: true, instances });
  } catch (error) {
    console.error('Erro ao consultar status da Evolution API:', error);
    return res.status(500).json({ error: 'Erro ao consultar status' });
  }
}
