// api/backup/executar.js
// Endpoint seguro para extração completa de dados (backup) do sistema Alpha
// Utilizado para download direto pelo painel e para automações (n8n / Google Drive / Cron)

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { applyCors, verifyCronAuth, verifyUserAuth, requireRole, safeCompare } from '../_middleware/auth.js';

export const config = {
  api: {
    responseLimit: '15mb',
  },
};

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || 'AIzaSyDj6CNYCaNSWv_tQYVjCdqFElcuG9lA1LE',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'alphaadmsc-fdc4e.firebaseapp.com',
  projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'alphaadmsc-fdc4e',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'alphaadmsc-fdc4e.appspot.com',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '30408137815',
  appId: process.env.VITE_FIREBASE_APP_ID || '1:30408137815:web:fb091176b6d5f756088277'
};

const COLECOES_SISTEMA = [
  'condominios', 'moradores', 'financeiro_lancamentos', 'boletos', 
  'cotacoes', 'manutencoes', 'apolices', 'ocorrencias', 'assembleias', 
  'avisos', 'reservas', 'usuarios', 'pets', 'veiculos', 'visitantes', 
  'documentos', 'encomendas', 'tarefas'
];

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, POST, OPTIONS')) return;

  // 1. Validação de Autorização Estrita
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.split('Bearer ')[1]?.trim() : '';
  const secretKey = process.env.API_SECRET_KEY || 'Alpha_Sec_Backend_Token_2026_xK9pL2';
  const cronSecret = process.env.CRON_SECRET || 'Cron_Alpha_Auth_Secret_2026_Secure_Key';

  const isSecretKey = Boolean(token && (safeCompare(token, secretKey) || safeCompare(token, cronSecret)));
  const isQuerySecret = Boolean(req.query?.secret && safeCompare(req.query.secret, secretKey));

  let isAuthorized = isSecretKey || isQuerySecret;

  if (!isAuthorized) {
    const user = await verifyUserAuth(req, res);
    if (user && requireRole(user, ['Administrador', 'Síndico', 'Sindico', 'admin'], res)) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Acesso restrito ao cofre de segurança Alpha.' });
  }

  try {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
    const auth = getAuth(app);
    const db = getFirestore(app);

    try {
      await signInWithEmailAndPassword(auth, 'admin@alpha.com.br', 'admin123');
    } catch (e) {
      // Ignora erro se já estiver autenticado
    }

    const dadosExportados = {};
    let totalDocs = 0;

    for (const colName of COLECOES_SISTEMA) {
      try {
        const snap = await getDocs(collection(db, colName));
        dadosExportados[colName] = snap.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
        totalDocs += snap.docs.length;
      } catch (errCol) {
        console.warn(`Aviso ao exportar coleção ${colName}:`, errCol.message);
        dadosExportados[colName] = [];
      }
    }

    const agora = new Date();
    const dataIso = agora.toISOString().slice(0, 10);
    const horaIso = agora.toTimeString().slice(0, 8).replace(/:/g, '-');
    const nomeArquivo = `alpha_backup_completo_${dataIso}_${horaIso}.json`;

    // Se o pedido for para download direto no navegador
    if (req.query?.download === 'true') {
      const jsonStr = JSON.stringify(dadosExportados, null, 2);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
      return res.status(200).send(jsonStr);
    }

    // Retorno estruturado para consumo de APIs (n8n, Google Drive, integrações)
    return res.status(200).json({
      success: true,
      dataCriacao: agora.toISOString(),
      dataReferencia: agora.toLocaleDateString('pt-BR'),
      nomeArquivo,
      totalDocumentos: totalDocs,
      colecoes: Object.keys(dadosExportados),
      resumoColecoes: Object.entries(dadosExportados).map(([nome, docs]) => ({
        nome,
        total: docs.length
      })),
      payload: dadosExportados
    });
  } catch (error) {
    console.error('Erro na execução do backup do sistema:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Falha ao gerar o arquivo de backup'
    });
  }
}
