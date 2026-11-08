/**
 * src/utils/aiClient.js
 * Cliente seguro de Inteligência Artificial (Google Gemini)
 * Elimina credenciais hardcoded e centraliza modelos e chamadas resilientes.
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { sanitizeUserPrompt } from './promptSecurity'

// Obtenção estrita da chave via variáveis de ambiente
export function getGeminiApiKey() {
  const envKey = import.meta.env?.VITE_GEMINI_API_KEY || ''
  return String(envKey).trim()
}

export const CANONICAL_GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-1.5-flash',
  'gemini-2.0-flash'
]

/**
 * Cria instância autenticada do GoogleGenerativeAI
 * Lança erro explícito se a chave não estiver configurada no .env
 */
export function getGenAIClient() {
  const key = getGeminiApiKey()
  if (!key) {
    throw new Error('Chave VITE_GEMINI_API_KEY não configurada nas variáveis de ambiente (.env).')
  }
  return new GoogleGenerativeAI(key)
}

/**
 * Executa geração de conteúdo com fallback resiliente de modelos e sanitização de prompt.
 * 
 * @param {string} prompt - Prompt seguro a ser enviado
 * @param {object} [options] - Opções de geração (temperatura, maxTokens)
 * @returns {Promise<string>} Resposta gerada pela IA
 */
export async function generateSecureContent(prompt, options = {}) {
  const genAI = getGenAIClient()
  let lastError = null

  for (const modelName of CANONICAL_GEMINI_MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: options.temperature ?? 0.4,
          maxOutputTokens: options.maxTokens ?? 2048,
          ...options.generationConfig
        }
      })

      const result = await model.generateContent(prompt)
      const text = result?.response?.text()
      if (text) {
        return text
      }
    } catch (err) {
      lastError = err
      console.warn(`Tentativa com modelo ${modelName} falhou:`, err.message)
    }
  }

  throw new Error(`Falha na geração de conteúdo com todos os modelos disponíveis: ${lastError?.message || 'Erro desconhecido'}`)
}

export default {
  getGeminiApiKey,
  getGenAIClient,
  generateSecureContent,
  CANONICAL_GEMINI_MODELS
}
