import { applyCors, verifyUserAuth } from '../_middleware/auth.js';
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

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, POST, OPTIONS')) return;

  const user = await verifyUserAuth(req, res);
  if (!user || user.role !== 'Administrador') {
    return res.status(403).json({ error: 'Acesso restrito a Administradores do sistema.' });
  }

  // GET: Listar backups dos últimos 7+ dias disponíveis para restauração ou download
  if (req.method === 'GET') {
    try {
      const snap = await db.collection('backups_sistema')
        .orderBy('dataCriacao', 'desc')
        .limit(30)
        .get();

      const backups = snap.docs.map(d => {
        const item = d.data();
        return {
          id: d.id,
          dataCriacao: item.dataCriacao,
          dataRef: item.dataRef,
          totalDocumentos: item.totalDocumentos,
          colecoes: item.colecoes || []
        };
      });

      return res.status(200).json({ success: true, backups });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // POST: Restaurar backup para ambiente de teste ou coleção isolada
  if (req.method === 'POST') {
    const { backupId, modo = 'teste', colecoesAlvo = [] } = req.body || {};

    if (!backupId) {
      return res.status(400).json({ error: 'backupId é obrigatório para iniciar a restauração.' });
    }

    try {
      const backupDoc = await db.collection('backups_sistema').doc(backupId).get();
      if (!backupDoc.exists) {
        return res.status(404).json({ error: 'Arquivo de backup não encontrado no cofre.' });
      }

      const backupData = backupDoc.data();
      const dados = backupData.dados || {};
      let restaurados = 0;

      // Se for modo teste, restaura com prefixo 'teste_' para não afetar os dados reais de produção
      const prefixo = modo === 'teste' ? 'teste_' : '';

      for (const [coluna, listaRegistros] of Object.entries(dados)) {
        if (colecoesAlvo.length > 0 && !colecoesAlvo.includes(coluna)) continue;

        const nomeColecaoDestino = `${prefixo}${coluna}`;
        const batch = db.batch();
        let batchCount = 0;

        for (const item of listaRegistros) {
          const { _id, ...resto } = item;
          const docDestino = db.collection(nomeColecaoDestino).doc(_id || undefined);
          batch.set(docDestino, {
            ...resto,
            _restauradoEm: new Date().toISOString(),
            _ambienteOrigem: backupData.dataRef
          });
          batchCount++;
          restaurados++;

          if (batchCount >= 450) {
            await batch.commit();
            batchCount = 0;
          }
        }

        if (batchCount > 0) {
          await batch.commit();
        }
      }

      return res.status(200).json({
        success: true,
        mensagem: `Restauração concluída com sucesso em ambiente de ${modo.toUpperCase()}. ${restaurados} registros recriados.`,
        modo,
        prefixo,
        totalRestaurado: restaurados,
        tempoEstimadoGasto: 'Cerca de 10 a 25 segundos'
      });
    } catch (err) {
      console.error('[Restore Engine] Erro:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
