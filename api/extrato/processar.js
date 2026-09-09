// api/extrato/processar.js
// Endpoint seguro para processar extratos bancários OFX/CSV e efetuar conciliação automática

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

// Helper para parsear arquivo OFX em texto
function parseOFX(data) {
  const transactions = [];
  const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
  let match;

  while ((match = stmtTrnRegex.exec(data)) !== null) {
    const trn = match[1];
    const type = (trn.match(/<TRNTYPE>(.*?)(?:<|\r|\n)/) || [])[1];
    const dateStr = (trn.match(/<DTPOSTED>(.*?)(?:<|\r|\n)/) || [])[1];
    const amountStr = (trn.match(/<TRNAMT>(.*?)(?:<|\r|\n)/) || [])[1];
    let memo = (trn.match(/<MEMO>(.*?)(?:<|\r|\n)/) || [])[1] || '';
    if (!memo) memo = (trn.match(/<NAME>(.*?)(?:<|\r|\n)/) || [])[1] || '';
    const fitid = (trn.match(/<FITID>(.*?)(?:<|\r|\n)/) || [])[1] || '';

    let date = '';
    if (dateStr && dateStr.length >= 8) {
      date = `${dateStr.substring(0,4)}-${dateStr.substring(4,6)}-${dateStr.substring(6,8)}`;
    }

    if (amountStr) {
      transactions.push({
        fitid: fitid.trim() || `tx_${Math.random().toString(36).substr(2, 9)}`,
        type: type ? type.trim() : (parseFloat(amountStr) >= 0 ? 'CREDIT' : 'DEBIT'),
        date,
        amount: parseFloat(amountStr),
        description: memo.trim()
      });
    }
  }

  return transactions;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { ofxText, ofxBase64, condominio = 'Todos', origem = 'Email alphaadmsc@gmail.com' } = req.body;

    let rawContent = ofxText;
    if (!rawContent && ofxBase64) {
      rawContent = Buffer.from(ofxBase64, 'base64').toString('utf-8');
    }

    if (!rawContent) {
      return res.status(400).json({ error: 'Conteúdo do extrato OFX não fornecido.' });
    }

    const transactions = parseOFX(rawContent);
    if (transactions.length === 0) {
      return res.status(400).json({ error: 'Nenhuma transação válida encontrada no arquivo OFX.' });
    }

    // 1. Busca boletos em aberto e lançamentos existentes
    const [boletosSnap, lancamentosSnap] = await Promise.all([
      db.collection('boletos').where('status', '!=', 'Pago').get(),
      db.collection('financeiro_lancamentos').get()
    ]);

    const boletosPendentes = boletosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const lancamentosExistentes = lancamentosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    let conciliadosCount = 0;
    let despesasLancadas = 0;
    const resultados = [];

    for (const tx of transactions) {
      const isCredit = tx.amount > 0;
      const txValorAbs = Math.abs(tx.amount);

      // Verifica se essa transação já foi processada anteriormente pelo fitid ou descrição/valor/data
      const jaExiste = lancamentosExistentes.some(l => 
        (l.fitid && l.fitid === tx.fitid) ||
        (l.data === tx.date && Math.abs(Number(l.valor) - txValorAbs) < 0.01 && l.descricao === tx.description)
      );

      if (jaExiste) {
        resultados.push({ ...tx, status: 'Ja_Existente' });
        continue;
      }

      if (isCredit) {
        // Tenta encontrar boleto pendente compatível por valor
        const boletoMatch = boletosPendentes.find(b => 
          !b._conciliadoTemp &&
          Math.abs(Number(b.valor) - txValorAbs) < 0.05
        );

        if (boletoMatch) {
          boletoMatch._conciliadoTemp = true; // evita dar baixa no mesmo boleto duas vezes

          // 1. Atualiza boleto para Pago
          await db.collection('boletos').doc(boletoMatch.id).update({
            status: 'Pago',
            dataPagamento: tx.date || new Date().toISOString().split('T')[0],
            metodoPagamento: 'Pix/Extrato Automático',
            fitid: tx.fitid
          });

          // 2. Cria lançamento financeiro de Receita
          await db.collection('financeiro_lancamentos').add({
            descricao: `Recebimento Cota: ${boletoMatch.morador || 'Morador'} - ${boletoMatch.unidade || boletoMatch.apt || ''} (${boletoMatch.condominio || 'Condomínio'})`,
            tipo: 'Receita',
            categoria: 'Taxa Condominial',
            valor: txValorAbs,
            data: tx.date || new Date().toISOString().split('T')[0],
            status: 'Recebido',
            condominio: boletoMatch.condominio || condominio || 'Todos',
            fitid: tx.fitid,
            origem: 'Conciliação Automática OFX',
            _createdAt: admin.firestore.FieldValue.serverTimestamp()
          });

          conciliadosCount++;
          resultados.push({ ...tx, status: 'Conciliado_Boleto', boleto: boletoMatch.morador });
        } else {
          // Receita avulsa não vinculada a boleto
          await db.collection('financeiro_lancamentos').add({
            descricao: tx.description || 'Receita Bancária / Pix Recebido',
            tipo: 'Receita',
            categoria: 'Outras Receitas',
            valor: txValorAbs,
            data: tx.date || new Date().toISOString().split('T')[0],
            status: 'Recebido',
            condominio: condominio || 'Todos',
            fitid: tx.fitid,
            origem: 'Extrato OFX Automático',
            _createdAt: admin.firestore.FieldValue.serverTimestamp()
          });

          conciliadosCount++;
          resultados.push({ ...tx, status: 'Lancado_Receita_Avulsa' });
        }
      } else {
        // Débito / Despesa bancária
        await db.collection('financeiro_lancamentos').add({
          descricao: tx.description || 'Débito Bancário / Pagamento',
          tipo: 'Despesa',
          categoria: 'Despesas Operacionais',
          valor: txValorAbs,
          data: tx.date || new Date().toISOString().split('T')[0],
          status: 'Pago',
          condominio: condominio || 'Todos',
          fitid: tx.fitid,
          origem: 'Extrato OFX Automático',
          _createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        despesasLancadas++;
        resultados.push({ ...tx, status: 'Lancado_Despesa' });
      }
    }

    // Grava registro no histórico de extratos
    await db.collection('extratos_historico').add({
      dataProcessamento: new Date().toISOString(),
      origem,
      totalTransacoes: transactions.length,
      conciliados: conciliadosCount,
      despesas: despesasLancadas,
      condominio,
      _createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Grava notificação no Sininho
    await db.collection('notificacoes').add({
      titulo: '📊 Extrato Bancário Conciliado',
      text: `🎉 Extrato (${origem}) processado: ${conciliadosCount} boletos/receitas conciliados e ${despesasLancadas} despesas lançadas.`,
      time: new Date().toISOString(),
      tipo: 'conciliacao_extrato',
      condominio: condominio || 'Todos',
      lida: false,
      link: '/financeiro',
      _createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.status(200).json({
      success: true,
      message: `Extrato processado com sucesso! ${conciliadosCount} recebimentos conciliados e ${despesasLancadas} despesas registradas.`,
      totalTransacoes: transactions.length,
      conciliadosCount,
      despesasLancadas,
      resultados
    });

  } catch (error) {
    console.error('Erro ao processar extrato OFX:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
