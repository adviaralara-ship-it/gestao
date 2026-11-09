// api/ai/chat.js
// Endpoint seguro para processamento de IA (Google Gemini) no servidor
// Isola a chave GEMINI_API_KEY impedindo exposição no navegador do cliente

import { GoogleGenerativeAI } from '@google/generative-ai';
import { applyCors, verifyUserAuth } from '../_middleware/auth.js';
import { applyRateLimit } from '../_middleware/rateLimit.js';

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
};

const CANONICAL_MODELS = [
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-1.5-flash',
  'gemini-2.0-flash'
];

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 1. Rate Limiting por IP (30 requisições por minuto)
  if (applyRateLimit(req, res, { limit: 30, windowMs: 60 * 1000, prefix: 'ai_service' })) {
    return;
  }

  // 2. Autenticação obrigatória (JWT Firebase do usuário logado ou API_SECRET_KEY)
  const user = await verifyUserAuth(req, res);
  if (!user) return;

  // 3. Obtenção estrita da chave no ambiente do servidor
  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    return res.status(500).json({
      error: 'Configuration Error',
      message: 'Chave GEMINI_API_KEY não configurada no servidor (Vercel).'
    });
  }

  const { prompt, systemPrompt, history = [], model: requestedModel, temperature = 0.4, contents } = req.body || {};

  if (!prompt && (!history || history.length === 0) && !contents) {
    return res.status(400).json({ error: 'Bad Request', message: 'Prompt, histórico ou conteúdo multimídia são obrigatórios.' });
  }

  // Truncagem de segurança (Defesa contra DoS de tokens)
  const safePrompt = String(prompt || '').slice(0, 8000);

  const genAI = new GoogleGenerativeAI(apiKey);
  const modelsToTry = requestedModel ? [requestedModel, ...CANONICAL_MODELS.filter(m => m !== requestedModel)] : CANONICAL_MODELS;

  let lastError = null;

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: Math.min(Math.max(Number(temperature) || 0.4, 0), 1),
          maxOutputTokens: 2500,
        }
      });

      if (contents) {
        // Modo Multimodal (Transcrição de Áudio ou Mídia)
        const result = await model.generateContent(contents);
        const responseText = result?.response?.text();
        if (responseText) {
          return res.status(200).json({ success: true, text: responseText, modelUsed: modelName });
        }
      } else if (history && history.length > 0) {
        // Modo Chat estruturado
        const formattedHistory = [
          ...(systemPrompt ? [{ role: 'user', parts: [{ text: systemPrompt }] }, { role: 'model', parts: [{ text: 'Entendido. Responderei rigorosamente conforme as diretrizes.' }] }] : []),
          ...history.slice(-10).map(h => ({
            role: h.role === 'model' ? 'model' : 'user',
            parts: [{ text: String(h.text || h.parts?.[0]?.text || '').slice(0, 4000) }]
          }))
        ];

        const chat = model.startChat({ history: formattedHistory });
        const result = await chat.sendMessage(safePrompt);
        const responseText = result?.response?.text();

        if (responseText) {
          return res.status(200).json({ success: true, text: responseText, modelUsed: modelName });
        }
      } else {
        // Modo Geração de Conteúdo Simples (Contratos, Comunicados, Atas)
        const fullPrompt = systemPrompt ? `${systemPrompt}\n\n[SOLICITAÇÃO]:\n${safePrompt}` : safePrompt;
        const result = await model.generateContent(fullPrompt);
        const responseText = result?.response?.text();

        if (responseText) {
          return res.status(200).json({ success: true, text: responseText, modelUsed: modelName });
        }
      }
    } catch (err) {
      lastError = err;
      console.warn(`Tentativa com modelo ${modelName} falhou:`, err.message);
    }
  }

  return res.status(500).json({
    error: 'AI Generation Failed',
    message: 'Não foi possível gerar a resposta com os modelos disponíveis no momento.',
    details: lastError?.message
  });
}
