/**
 * src/utils/aiClient.js
 * Cliente seguro de Inteligência Artificial (Google Gemini)
 * Roteia chamadas prioritariamente via backend seguro (/api/ai/chat)
 * eliminando a exposição de chaves privadas no bundle do cliente.
 */

import { auth } from '../firebase'
import { sanitizeUserPrompt } from './promptSecurity'

/**
 * Envia prompt para processamento seguro no backend
 * 
 * @param {object} params
 * @param {string} params.prompt - Entrada do usuário
 * @param {string} [params.systemPrompt] - Diretrizes de persona e regras do sistema
 * @param {Array} [params.history] - Histórico prévio de mensagens [{ role, text }]
 * @param {number} [params.temperature=0.4] - Temperatura de criatividade
 * @param {string} [params.model] - Modelo preferencial
 * @returns {Promise<string>} Resposta gerada pela IA
 */
export async function requestSecureAI({ prompt, systemPrompt, history = [], temperature = 0.4, model }) {
  const { cleanInput } = sanitizeUserPrompt(prompt, 6000)

  // 1. Obtenção do ID Token (JWT) do usuário logado
  let token = ''
  try {
    if (auth?.currentUser) {
      token = await auth.currentUser.getIdToken(false)
    }
  } catch (err) {
    console.warn('[aiClient] Falha ao obter token do usuário:', err.message)
  }

  // 2. Requisição para o endpoint serverless seguro
  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        prompt: cleanInput,
        systemPrompt,
        history,
        temperature,
        model
      })
    })

    if (res.ok) {
      const data = await res.json()
      if (data.success && data.text) {
        return data.text
      }
    } else {
      const errData = await res.json().catch(() => ({}))
      console.warn('[aiClient] Rota de backend retornou erro:', errData.message || res.status)
    }
  } catch (fetchErr) {
    console.warn('[aiClient] Erro ao conectar com /api/ai/chat:', fetchErr.message)
  }

  throw new Error('Serviço de Inteligência Artificial temporariamente indisponível. Tente novamente em instantes.')
}

/**
 * Função utilitária direta para geração de texto simples
 */
export async function generateSecureContent(prompt, options = {}) {
  return requestSecureAI({
    prompt,
    systemPrompt: options.systemPrompt,
    history: options.history || [],
    temperature: options.temperature,
    model: options.model
  })
}

export default {
  requestSecureAI,
  generateSecureContent
}
