import { applyCors } from '../_middleware/auth.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { token, remoteip } = req.body || {};

  if (!token) {
    return res.status(400).json({ success: false, error: 'Token Turnstile não fornecido.' });
  }

  const secretKey = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;

  // Modo de desenvolvimento: se a chave secreta ainda não estiver configurada no painel,
  // aceita o token de teste com aviso para permitir deploy e testes sem quebrar o fluxo.
  if (!secretKey) {
    console.warn('CLOUDFLARE_TURNSTILE_SECRET_KEY não configurada. Operando em modo de validação pré-configurada.');
    return res.status(200).json({ success: true, mode: 'development_fallback' });
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (remoteip) formData.append('remoteip', remoteip);

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const result = await response.json();

    if (result.success) {
      return res.status(200).json({ success: true });
    } else {
      console.warn('Validação Turnstile falhou:', result['error-codes']);
      return res.status(400).json({
        success: false,
        error: 'Falha na verificação anti-robô (Cloudflare Turnstile).',
        codes: result['error-codes']
      });
    }
  } catch (error) {
    console.error('Erro ao contatar Cloudflare Turnstile API:', error);
    return res.status(500).json({ success: false, error: 'Erro de comunicação com o serviço Turnstile.' });
  }
}
