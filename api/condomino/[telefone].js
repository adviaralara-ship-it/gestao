// api/condomino/[telefone].js
// Endpoint seguro para buscar condômino por telefone com RBAC e Rate Limiting

import { getFirebaseAdmin, applyCors, verifyUserAuth, requireRole } from '../_middleware/auth.js';
import { applyRateLimit } from '../_middleware/rateLimit.js';

const ROLES_PERMITIDOS = ['Administrador', 'Financeiro', 'Síndico', 'Porteiro'];

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 1. Rate Limiting por IP (20 requisições por minuto)
  if (applyRateLimit(req, res, { limit: 20, windowMs: 60 * 1000, prefix: 'condomino_busca' })) {
    return;
  }

  // 2. Autenticação obrigatória (JWT Firebase ou API Secret Key)
  const user = await verifyUserAuth(req, res);
  if (!user) return;

  // 3. Autorização estrita baseada em papéis (RBAC verificado no servidor, não por header de cliente)
  if (!requireRole(user, ROLES_PERMITIDOS, res)) {
    return;
  }

  // 4. Validação e sanitização estrita do parâmetro (Defesa contra NoSQL Injection)
  const telefoneParam = String(req.query?.telefone || '').trim();
  const telefoneLimpo = telefoneParam.replace(/\D/g, '');

  if (!/^\d{8,15}$/.test(telefoneLimpo)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Telefone inválido. O parâmetro deve conter entre 8 e 15 dígitos numéricos.'
    });
  }

  try {
    const adminInst = getFirebaseAdmin();
    const db = adminInst.firestore();

    // Busca parametrizada segura
    let snapshot = await db.collection('condominos')
      .where('telefone', '==', telefoneLimpo)
      .limit(1)
      .get();

    // Tenta com código do país (55) se não encontrar inicialmente
    if (snapshot.empty && !telefoneLimpo.startsWith('55')) {
      snapshot = await db.collection('condominos')
        .where('telefone', '==', '55' + telefoneLimpo)
        .limit(1)
        .get();
    }

    if (snapshot.empty) {
      return res.status(404).json({ error: 'NotFound', message: 'Condômino não localizado.' });
    }

    const docSnap = snapshot.docs[0];
    const condomino = docSnap.data();

    // Restrição por condomínio se o usuário for Síndico ou Porteiro
    if (user.role !== 'Administrador' && user.role !== 'Financeiro') {
      if (user.condominio && condomino.condominio && user.condominio !== condomino.condominio) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Acesso negado: Condômino pertence a outro condomínio.'
        });
      }
    }

    // Buscar débitos vencidos do condômino
    const debitosSnapshot = await db.collection('boletos')
      .where('condomino_id', '==', docSnap.id)
      .where('status', '!=', 'Pago')
      .limit(50)
      .get();

    const debitos = [];
    const agora = new Date();

    debitosSnapshot.forEach(d => {
      const debito = d.data();
      if (debito.data_vencimento || debito.vencimento) {
        const rawDate = debito.data_vencimento || debito.vencimento;
        const vencimento = rawDate.toDate ? rawDate.toDate() : new Date(rawDate);
        if (vencimento < agora) {
          debitos.push({ id: d.id, ...debito });
        }
      }
    });

    return res.status(200).json({
      id: docSnap.id,
      ...condomino,
      debitos
    });
  } catch (error) {
    console.error('Erro ao buscar condômino:', error.message);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Erro interno ao processar a consulta.' });
  }
}
