import { applyCors, verifyCronAuth, verifyUserAuth } from '../_middleware/auth.js';
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

// Coleções essenciais do sistema para backup diário
const COLECOES_BACKUP = [
  'usuarios',
  'condominios',
  'moradores',
  'financeiro',
  'boletos',
  'notas_fiscais',
  'documentos',
  'manutencoes',
  'demandas_cotacao',
  'propostas_fornecedores',
  'mediacoes',
  'enquetes',
  'classificados',
  'tarefas',
  'ocorrencias',
  'prestadores'
];

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, POST, OPTIONS')) return;

  // Permitir execução via Cron diário com token ou via requisição de Administrador autenticado
  const isCron = req.headers.authorization === `Bearer ${process.env.CRON_SECRET}` ||
                 req.query.key === process.env.CRON_SECRET;
  
  if (!isCron) {
    const user = await verifyUserAuth(req, res);
    if (!user || user.role !== 'Administrador') {
      return res.status(403).json({ error: 'Acesso restrito a Administradores ou Cron do sistema.' });
    }
  }

  try {
    const dataHoraIso = new Date().toISOString();
    const dataRef = dataHoraIso.split('T')[0]; // YYYY-MM-DD
    const snapshotDados = {};
    let totalDocumentos = 0;

    // 1. Extração estruturada de todas as coleções
    for (const colName of COLECOES_BACKUP) {
      const snap = await db.collection(colName).get();
      snapshotDados[colName] = snap.docs.map(doc => ({
        _id: doc.id,
        ...doc.data()
      }));
      totalDocumentos += snap.size;
    }

    const payloadBackup = {
      dataCriacao: dataHoraIso,
      dataRef,
      versao: '2.0',
      totalDocumentos,
      colecoes: Object.keys(snapshotDados),
      dados: snapshotDados
    };

    // 2. Armazenar no cofre de backups externos
    // Salva na coleção dedicada 'backups_sistema' com identificador diário
    const backupDocId = `backup_${dataRef}_${Date.now()}`;
    await db.collection('backups_sistema').doc(backupDocId).set(payloadBackup);

    // 3. Política de Retenção: Garantir histórico de pelo menos 7 dias (exclui backups com mais de 30 dias para otimização)
    const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const backupsAntigos = await db.collection('backups_sistema')
      .where('dataCriacao', '<', trintaDiasAtras)
      .get();

    for (const doc of backupsAntigos.docs) {
      await doc.ref.delete();
    }

    // Retorno para download direto se solicitado pelo painel
    if (req.query.download === 'true') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="backup_alpha_${dataRef}.json"`);
      return res.status(200).send(JSON.stringify(payloadBackup, null, 2));
    }

    return res.status(200).json({
      success: true,
      mensagem: `Backup diário concluído com sucesso. ${totalDocumentos} documentos preservados em cofre seguro.`,
      backupId: backupDocId,
      dataRef,
      totalDocumentos,
      colecoes: COLECOES_BACKUP
    });
  } catch (error) {
    console.error('[Backup Engine] Erro:', error);
    return res.status(500).json({ error: error.message });
  }
}
