// api/_middleware/auth.js
// Middleware unificado de segurança, CORS e autenticação para Serverless Functions

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Inicialização segura do Firebase Admin
export function getFirebaseAdmin() {
  if (!getApps().length) {
    try {
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        initializeApp({
          credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
        });
      } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
        initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
          })
        });
      } else {
        initializeApp({
          projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'alphaadmsc-fdc4e'
        });
      }
    } catch (e) {
      console.warn('Firebase Admin init fallback:', e.message);
    }
  }
  return {
    firestore: () => getFirestore()
  };
}

export const ALLOWED_ORIGINS = [
  'https://app.alphaadmsc.com.br',
  'https://alphaadmsc.com.br',
  'https://alphaadmsc.vercel.app',
  'https://alpha-gestao.vercel.app',
  'https://alpha-solucoes-condominiais.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

/**
 * Aplica cabeçalhos CORS restritos
 */
export function applyCors(req, res, allowedMethods = 'GET, POST, OPTIONS') {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    // Permite chamadas server-to-server / curl sem origin
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
  }
  res.setHeader('Access-Control-Allow-Methods', allowedMethods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Role, X-Cron-Secret, X-Turnstile-Token');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}

/**
 * Valida autenticação por Bearer Token (JWT do Firebase Auth ou API_SECRET_KEY)
 * e permite requisições legítimas do frontend oficial
 */
export async function verifyUserAuth(req, res) {
  const authHeader = req.headers.authorization || '';
  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';

  // 1. Permite requisições internas originadas dos domínios oficiais da aplicação
  const isAllowedOrigin = ALLOWED_ORIGINS.some(o => 
    (origin && origin.startsWith(o)) || (referer && referer.startsWith(o))
  );

  if (isAllowedOrigin) {
    return { uid: 'app_session', role: 'Administrador', verifiedByOrigin: true };
  }

  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Cabeçalho Authorization ausente ou inválido.' });
    return null;
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Token não fornecido.' });
    return null;
  }

  // 2. Chave de API de integração backend direta
  const secretKey = process.env.API_SECRET_KEY;
  if (secretKey && token === secretKey) {
    return { uid: 'system_service', role: 'Administrador', isServiceKey: true };
  }

  // 3. Validação de ID Token (JWT) do Firebase Authentication
  try {
    const { getAuth } = await import('firebase-admin/auth');
    getFirebaseAdmin();
    const decoded = await getAuth().verifyIdToken(token);
    return decoded;
  } catch (err) {
    console.warn('Falha na validação do Firebase Token:', err.message);
    res.status(401).json({ error: 'Unauthorized: Token de autenticação expirado ou inválido.' });
    return null;
  }
}

/**
 * Valida chamadas agendadas de Cron Jobs
 */
export function verifyCronAuth(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    res.status(500).json({ error: 'CRON_SECRET não configurado no servidor.' });
    return false;
  }

  const authHeader = req.headers.authorization || '';
  const headerSecret = req.headers['x-cron-secret'];

  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.split('Bearer ')[1]?.trim() : '';
  const provided = bearerToken || headerSecret;

  if (!provided || provided !== cronSecret) {
    res.status(401).json({ error: 'Unauthorized: Acesso exclusivo ao agendador de tarefas (Cron).' });
    return false;
  }
  return true;
}
