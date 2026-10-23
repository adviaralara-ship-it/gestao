// api/condomino/[telefone].js
// Endpoint para buscar condômino por telefone

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = admin.firestore();

// ─── Roles com permissão de buscar dados de condôminos ────────────────────
const ROLES_PERMITIDOS = ['Administrador', 'Financeiro', 'Síndico', 'Porteiro'];

// ─── Domínios permitidos (CORS restrito) ──────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://app.alphaadmsc.com.br',
  'https://alphaadmsc.com.br',
  'https://alphaadmsc.vercel.app',
  'https://alpha-gestao.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

module.exports = async (req, res) => {
  // CORS restrito — apenas origens autorizadas
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, X-User-Role');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ─── Autenticação por token ──────────────────────────────────────────────
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  const secretKey = process.env.API_SECRET_KEY;
  if (!secretKey || token !== secretKey) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // ─── Validação de escopo/role (CVE-08) ──────────────────────────────────
  const userRole = req.headers['x-user-role'] || '';
  if (!ROLES_PERMITIDOS.includes(userRole)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Acesso negado: seu perfil não tem permissão para buscar dados de condôminos.'
    });
  }

  const { telefone } = req.query;

  if (!telefone) {
    return res.status(400).json({ error: 'Telefone não fornecido' });
  }

  // Limpar telefone (apenas dígitos)
  const telefoneLimpo = telefone.replace(/\D/g, '');

  try {
    // Buscar condômino pelo telefone
    let snapshot = await db.collection('condominos')
      .where('telefone', '==', telefoneLimpo)
      .limit(1)
      .get();

    // Tenta com código do país se não encontrar
    if (snapshot.empty) {
      snapshot = await db.collection('condominos')
        .where('telefone', '==', '55' + telefoneLimpo)
        .limit(1)
        .get();
    }

    if (snapshot.empty) {
      return res.status(404).json({ error: 'Condômino não encontrado' });
    }

    const docSnap = snapshot.docs[0];
    const condomino = docSnap.data();

    // Buscar apenas débitos vencidos
    const debitosSnapshot = await db.collection('boletos')
      .where('condomino_id', '==', docSnap.id)
      .where('pago', '==', false)
      .get();

    const debitos = [];
    debitosSnapshot.forEach(d => {
      const debito = d.data();
      if (debito.data_vencimento) {
        const vencimento = debito.data_vencimento.toDate ?
          debito.data_vencimento.toDate() : new Date(debito.data_vencimento);
        if (vencimento < new Date()) {
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
    console.error('Erro:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};
