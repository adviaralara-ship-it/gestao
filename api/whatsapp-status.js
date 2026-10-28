import { applyCors, verifyUserAuth } from './_middleware/auth.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, POST, OPTIONS')) return;

  // Autenticação obrigatória
  const user = await verifyUserAuth(req, res);
  if (!user) return;

  const instance = req.query?.instance || req.body?.instance || 'InstanciaAlpha';
  const EVOLUTION_URL = process.env.EVOLUTION_URL || 'https://runningfly-evolution.cloudfy.live';
  const API_KEY = process.env.EVOLUTION_API_KEY || 'WHNRTDYyTpv4ze45wUUU5qN9ri3da1Oy';

  if (!API_KEY) {
    return res.status(500).json({ error: 'Chave da Evolution API não configurada no servidor.' });
  }

  // --- POST: Ações de reconexão e reinicialização ---
  if (req.method === 'POST') {
    const { action } = req.body || {};

    if (action === 'reconnect') {
      try {
        // 1. Deleta instância travada se existir
        try {
          await fetch(`${EVOLUTION_URL}/instance/delete/${instance}`, {
            method: 'DELETE',
            headers: { 'apikey': API_KEY }
          });
        } catch (eDel) {}

        // Aguarda 1 segundo
        await new Promise(r => setTimeout(r, 1000));

        // 2. Cria nova instância limpa gerando QR Code novo
        const createRes = await fetch(`${EVOLUTION_URL}/instance/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': API_KEY
          },
          body: JSON.stringify({
            instanceName: instance,
            integration: 'WHATSAPP-BAILEYS',
            qrcode: true
          })
        });

        const createData = await createRes.json();
        return res.status(200).json({
          success: true,
          message: 'Nova sessão gerada. Escaneie o QR Code no seu WhatsApp.',
          instance: createData?.instance,
          qrcode: createData?.qrcode?.base64,
          pairingCode: createData?.qrcode?.pairingCode,
          code: createData?.qrcode?.code
        });
      } catch (errRec) {
        return res.status(500).json({ success: false, error: 'Falha ao recriar instância: ' + errRec.message });
      }
    }

    if (action === 'restart') {
      try {
        const restartRes = await fetch(`${EVOLUTION_URL}/instance/restart/${instance}`, {
          method: 'POST',
          headers: { 'apikey': API_KEY }
        });
        const restartData = await restartRes.json();
        return res.status(200).json({ success: true, data: restartData });
      } catch (errRest) {
        return res.status(500).json({ success: false, error: errRest.message });
      }
    }

    return res.status(400).json({ error: 'Ação inválida.' });
  }

  // --- GET: Consulta de status detalhado ---
  if (req.method === 'GET') {
    try {
      const response = await fetch(`${EVOLUTION_URL}/instance/fetchInstances`, {
        method: 'GET',
        headers: { 'apikey': API_KEY }
      });
      const instances = await response.json();

      // Testa se o socket do Baileys está realmente comunicando
      let isHealthy = false;
      let healthDetail = 'Instância offline ou não encontrada';

      try {
        const checkRes = await fetch(`${EVOLUTION_URL}/chat/whatsappNumbers/${instance}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': API_KEY
          },
          body: JSON.stringify({ numbers: ['5583996885931'] })
        });
        if (checkRes.ok) {
          isHealthy = true;
          healthDetail = 'Conexão ativa e operando normalmente';
        } else {
          const checkData = await checkRes.json().catch(() => ({}));
          healthDetail = checkData?.response?.message || checkData?.output?.payload?.message || 'Conexão interrompida (Connection Closed)';
        }
      } catch (errHealth) {
        healthDetail = errHealth.message;
      }

      return res.status(200).json({
        success: true,
        instances,
        isHealthy,
        healthDetail
      });
    } catch (error) {
      console.error('Erro ao consultar status da Evolution API:', error);
      return res.status(500).json({ error: 'Erro ao consultar status' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
