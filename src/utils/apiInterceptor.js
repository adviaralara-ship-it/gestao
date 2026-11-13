// src/utils/apiInterceptor.js
// Interceptor transparente de seguranca para chamadas a API interna (/api/)
// Injeta automaticamente o token JWT criptografico do Firebase Auth do usuario logado
// Garantindo que nenhuma funcionalidade do frontend quebre ao fechar os acessos da API.

import { auth } from '../firebase'

export function setupApiInterceptor() {
  if (typeof window === 'undefined' || !window.fetch) return

  const originalFetch = window.fetch
  window.fetch = async (input, init = {}) => {
    try {
      const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : '')

      // Aplica apenas para rotas internas de API do sistema
      if (url.startsWith('/api/') || url.includes('/api/')) {
        let token = null
        if (auth?.currentUser) {
          try {
            token = await auth.currentUser.getIdToken(false)
          } catch (tokErr) {
            console.warn('[apiInterceptor] Erro ao obter token do usuario:', tokErr?.message)
          }
        }

        if (token) {
          const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : {}))
          if (!headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${token}`)
          }
          init = { ...init, headers }
        }
      }
    } catch (e) {
      // Em caso de excecao no interceptor, prossegue com o fetch nativo
    }

    return originalFetch(input, init)
  }
}
