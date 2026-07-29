import CryptoJS from 'crypto-js'

const SECRET_KEY = import.meta.env.VITE_CRYPTO_SECRET || 'fallback-super-secret-key-2026'
const PREFIX = 'ENC:'

export const encryptData = (text) => {
  if (!text) return text
  // Evitar dupla criptografia
  if (typeof text === 'string' && text.startsWith(PREFIX)) return text
  try {
    const cipher = CryptoJS.AES.encrypt(String(text), SECRET_KEY).toString()
    return PREFIX + cipher
  } catch (err) {
    console.error('[Crypto] Erro na criptografia:', err)
    return text
  }
}

export const decryptData = (cipherText) => {
  if (!cipherText || typeof cipherText !== 'string') return cipherText
  if (!cipherText.startsWith(PREFIX)) return cipherText
  
  try {
    const pureCipher = cipherText.replace(PREFIX, '')
    const bytes = CryptoJS.AES.decrypt(pureCipher, SECRET_KEY)
    const originalText = bytes.toString(CryptoJS.enc.Utf8)
    return originalText || cipherText // Retorna original se falhar
  } catch (err) {
    console.error('[Crypto] Erro na descriptografia:', err)
    return cipherText
  }
}
