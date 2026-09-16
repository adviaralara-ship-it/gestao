export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const instance = req.query.instance || 'InstanciaAlpha';
  const EVOLUTION_URL = 'https://spiritualmacaw-evolution.cloudfy.live';
  const API_KEY = 'Q1CguwvCa34nqB1936dHekPICikeSCHb';

  try {
    const response = await fetch(`${EVOLUTION_URL}/group/fetchAllGroups/${instance}?getParticipants=false`, {
      method: 'GET',
      headers: { 'apikey': API_KEY }
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ success: false, error: data?.message || 'Erro ao consultar grupos' });
    }

    const groups = Array.isArray(data) ? data.map(g => ({
      id: g.id,
      subject: g.subject || g.name || 'Sem título'
    })) : [];

    return res.status(200).json({ success: true, groups });
  } catch (error) {
    console.error('Erro ao consultar grupos na Evolution API:', error);
    return res.status(500).json({ success: false, error: error.message || 'Erro ao consultar grupos' });
  }
}
