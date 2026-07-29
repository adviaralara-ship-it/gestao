// api/boletos/inadimplentes.js
// Endpoint para buscar boletos inadimplentes

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

// ─── Roles com permissão de acessar dados financeiros ─────────────────────
const ROLES_FINANCEIRO = ['Administrador', 'Financeiro'];

// ─── Domínios permitidos (CORS restrito) ──────────────────────────────────
const ALLOWED_ORIGINS = [
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

  const token = authHeader.split('Bearer ')[1];
  if (token !== process.env.API_SECRET_KEY) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // ─── Validação de escopo/role (CVE-08) ──────────────────────────────────
  const userRole = req.headers['x-user-role'] || '';
  if (!ROLES_FINANCEIRO.includes(userRole)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Acesso negado: apenas Administradores e Financeiro podem visualizar inadimplentes.'
    });
  }

  try {
    const hoje = new Date();

    const snapshot = await db.collection('boletos').get();
    const inadimplentes = [];

    snapshot.forEach(doc => {
      const boleto = doc.data();
      boleto.id = doc.id;

      if (boleto.data_vencimento && !boleto.pago) {
        const vencimento = boleto.data_vencimento.toDate ?
          boleto.data_vencimento.toDate() : new Date(boleto.data_vencimento);

        if (vencimento < hoje) {
          const diasAtraso = Math.floor((hoje - vencimento) / (1000 * 60 * 60 * 24));

          inadimplentes.push({
            ...boleto,
            dias_atraso: diasAtraso,
            telefone: boleto.telefone_condomino || boleto.telefone || ''
          });
        }
      }
    });

    return res.status(200).json({ boletos: inadimplentes });

  } catch (error) {
    console.error('Erro:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' }); // não expõe detalhes do erro
  }
};
