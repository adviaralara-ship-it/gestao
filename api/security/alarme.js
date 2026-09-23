import { applyCors, verifyUserAuth } from './_middleware/auth.js';
import { enviarAlarmeSeguranca } from './_services/emailAlerts.js';
import admin from 'firebase-admin';

if (!admin.apps.length) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
      });
    } catch (e) {
      console.warn('Falha FIREBASE_SERVICE_ACCOUNT:', e.message);
    }
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'alphaadmsc-fdc4e',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
      })
    });
  }
}

const db = admin.firestore();

// Memória local da função para controle de taxa de erros de senha (20 erros em 10 minutos)
const loginFailures = [];

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, GET, OPTIONS')) return;

  if (req.method === 'GET') {
    // Listar alarmes recentes para o painel de segurança
    try {
      const user = await verifyUserAuth(req, res);
      if (!user) return;

      const snap = await db.collection('alarmes_seguranca')
        .orderBy('timestamp', 'desc')
        .limit(50)
        .get();

      const alarmes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return res.status(200).json({ success: true, alarmes });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { tipo, titulo, detalhes, metadata = {}, userEmail } = req.body || {};
  const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'Desconhecido';

  try {
    let dispararAlerta = true;

    // 1. Regra: Mais de 20 erros de senha em 10 minutos
    if (tipo === 'ERRO_SENHA') {
      const agora = Date.now();
      const dezMinutosAtras = agora - 10 * 60 * 1000;

      // Limpar falhas antigas
      while (loginFailures.length > 0 && loginFailures[0].timestamp < dezMinutosAtras) {
        loginFailures.shift();
      }

      loginFailures.push({
        email: (userEmail || 'desconhecido').toLowerCase().trim(),
        ip: clientIp,
        timestamp: agora
      });

      // Contar total em 10 min ou no mesmo e-mail
      const totalRecente = loginFailures.length;
      const totalMesmoUsuario = loginFailures.filter(f => f.email === (userEmail || '').toLowerCase().trim()).length;

      if (totalRecente >= 20 || totalMesmoUsuario >= 20) {
        dispararAlerta = true;
      } else {
        // Registra o evento de falha mas ainda não dispara o e-mail
        dispararAlerta = false;
      }
    }

    if (dispararAlerta) {
      // Grava no Firestore na coleção de alarmes
      const registro = {
        tipo: tipo || 'COMPORTAMENTO_ESTRANHO',
        titulo: titulo || 'Alerta de Segurança',
        detalhes: detalhes || 'Atividade incomum detectada pelo sistema.',
        metadata: {
          ...metadata,
          ip: clientIp,
          usuario: userEmail || metadata.usuario || 'Não informado',
        },
        timestamp: new Date().toISOString(),
        lido: false,
        status: 'Crítico'
      };

      await db.collection('alarmes_seguranca').add(registro);

      // Envia notificação por e-mail com riqueza de detalhes
      await enviarAlarmeSeguranca({
        tipo: registro.tipo,
        titulo: registro.titulo,
        detalhes: registro.detalhes,
        metadata: registro.metadata
      });
    }

    return res.status(200).json({ success: true, disparado: dispararAlerta });
  } catch (error) {
    console.error('[API Alarme] Erro:', error);
    return res.status(500).json({ error: error.message });
  }
}
