// api/_middleware/auth.js
// Middleware unificado de segurança, CORS estrito, autenticação criptográfica e RBAC

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import crypto from 'crypto';

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
 * Compara duas strings em tempo constante prevenindo ataques de temporização (Timing Attacks)
 */
export function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Aplica cabeçalhos CORS estritos baseados em allowlist
 */
export function applyCors(req, res, allowedMethods = 'GET, POST, OPTIONS') {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', allowedMethods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Cron-Secret, X-Turnstile-Token');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}

/**
 * Valida autenticação estrita por Bearer Token (JWT do Firebase Auth ou API_SECRET_KEY)
 * NUNCA confia em headers de Origin/Referer para autenticação.
 */
export async function verifyUserAuth(req, res) {
  const authHeader = req.headers.authorization || '';

  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized', message: 'Cabeçalho Authorization ausente ou inválido.' });
    return null;
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    res.status(401).json({ error: 'Unauthorized', message: 'Token de autenticação não fornecido.' });
    return null;
  }

  // 1. Chave de API de integração backend direta (comparação em tempo constante)
  const secretKey = process.env.API_SECRET_KEY;
  if (secretKey && safeCompare(token, secretKey)) {
    return { uid: 'system_service', role: 'Administrador', isServiceKey: true };
  }

  // 2. Validação criptográfica do Firebase ID Token (JWT)
  try {
    const { getAuth } = await import('firebase-admin/auth');
    getFirebaseAdmin();
    const decoded = await getAuth().verifyIdToken(token);
    
    // Obtenção do perfil e role verificado diretamente no Firestore
    try {
      const db = getFirestore();
      const userDoc = await db.collection('usuarios').doc(decoded.uid).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        decoded.role = userData.role || 'Morador';
        decoded.condominio = userData.condominio || '';
      } else {
        decoded.role = decoded.role || 'Morador';
      }
    } catch (e) {
      decoded.role = decoded.role || 'Morador';
    }

    return decoded;
  } catch (err) {
    console.warn('Falha na validação do Firebase Token:', err.message);
    res.status(401).json({ error: 'Unauthorized', message: 'Token de autenticação expirado ou inválido.' });
    return null;
  }
}

/**
 * Validação de Autorização Baseada em Papéis (RBAC) no Servidor
 */
export function requireRole(user, allowedRoles, res) {
  if (!user) {
    if (res) res.status(401).json({ error: 'Unauthorized', message: 'Usuário não autenticado.' });
    return false;
  }

  const userRole = user.role || 'Morador';
  if (!allowedRoles.includes(userRole)) {
    if (res) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Acesso negado: Perfil '${userRole}' não possui privilégios para executar esta ação.`
      });
    }
    return false;
  }
  return true;
}

/**
 * Valida chamadas agendadas de Cron Jobs com segredo timing-safe
 */
export function verifyCronAuth(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    res.status(500).json({ error: 'CRON_SECRET não configurado no servidor.' });
    return false;
  }

  const authHeader = req.headers.authorization || '';
  const headerSecret = req.headers['x-cron-secret'] || '';

  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.split('Bearer ')[1]?.trim() : '';
  const provided = bearerToken || headerSecret;

  if (!provided || !safeCompare(provided, cronSecret)) {
    res.status(401).json({ error: 'Unauthorized', message: 'Acesso exclusivo ao agendador de tarefas (Cron).' });
    return false;
  }
  return true;
}
