export default async function handler(req, res) {
  const instance = req.query.instance || 'InstanciaAlpha';
  const EVOLUTION_URL = 'https://spiritualmacaw-evolution.cloudfy.live';
  const API_KEY = 'Q1CguwvCa34nqB1936dHekPICikeSCHb';

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
