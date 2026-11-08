/**
 * src/utils/sanitize.js
 * Sanitizador centralizado contra Cross-Site Scripting (XSS)
 * Baseado no DOMPurify com allowlist estrita de tags e atributos.
 */

import DOMPurify from 'dompurify'

// Configuração segura padrão do DOMPurify
const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    'b', 'i', 'em', 'strong', 'u', 'p', 'br', 'span', 'div',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'blockquote', 'hr',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'a', 'img'
  ],
  ALLOWED_ATTR: [
    'href', 'title', 'target', 'rel',
    'src', 'alt', 'width', 'height',
    'class', 'style', 'id'
  ],
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  FORCE_BODY: false,
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false
}

/**
 * Sanitiza fragmento de HTML antes de renderizar via dangerouslySetInnerHTML
 * Remove scripts, event handlers (onload, onerror), iframes arbitrários e javascript: URIs.
 * 
 * @param {string} dirtyHtml - HTML potencialmente inseguro
 * @param {object} [customConfig] - Configurações extras de allowlist
 * @returns {string} HTML sanitizado e seguro
 */
export function sanitizeHtml(dirtyHtml, customConfig = {}) {
  if (!dirtyHtml || typeof dirtyHtml !== 'string') {
    return ''
  }

  const config = { ...SANITIZE_CONFIG, ...customConfig }
  const clean = DOMPurify.sanitize(dirtyHtml, config)

  return clean
}

/**
 * Escapa texto puro convertendo caracteres especiais em entidades HTML
 * Previne injeção ao interpolar strings em templates HTML.
 * 
 * @param {string} text - Texto a ser escapado
 * @returns {string} Texto seguro
 */
export function escapeHtml(text) {
  if (text === null || text === undefined) return ''
  const str = String(text)
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export default sanitizeHtml
