import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDj6CNYCaNSWv_tQYVjCdqFElcuG9lA1LE',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'alphaadmsc-fdc4e.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'alphaadmsc-fdc4e',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'alphaadmsc-fdc4e.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '30408137815',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:30408137815:web:fb091176b6d5f756088277'
}

export const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)
export const storage = getStorage(app)

// Secondary app to create users without signing out the current admin
export const secondaryApp = initializeApp(firebaseConfig, 'SecondaryApp')
export const secondaryAuth = getAuth(secondaryApp)

// Forçar idioma oficial para Português do Brasil em todos os e-mails e fluxos de autenticação
auth.languageCode = 'pt-BR'
secondaryAuth.languageCode = 'pt-BR'
