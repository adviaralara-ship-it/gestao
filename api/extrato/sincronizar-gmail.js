// api/extrato/sincronizar-gmail.js
// Agente autônomo para conectar no Gmail (alphaadmsc@gmail.com), ler anexos OFX do Nubank/Cora e conciliar automaticamente

const imaps = require('imap-simple');
const simpleParser = require('mailparser').simpleParser;
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

// Configuração IMAP do Gmail
const GMAIL_USER = 'alphaadmsc@gmail.com';
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD || 'rurvepcoxkovmivxo8';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const config = {
    imap: {
      user: GMAIL_USER,
      password: GMAIL_PASS.replace(/\s+/g, ''),
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      authTimeout: 10000,
      tlsOptions: { rejectUnauthorized: false }
    }
  };

  let connection;
  try {
    connection = await imaps.connect(config);
    await connection.openBox('INBOX');

    // Busca e-mails recentes (últimos 30 dias)
    const delay = 30 * 24 * 3600 * 1000;
    const yesterday = new Date(Date.now() - delay);
    const searchCriteria = [
      ['SINCE', yesterday.toISOString().slice(0, 10)]
    ];

    const fetchOptions = {
      bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', 'TEXT', ''],
      struct: true
    };

    const messages = await connection.search(searchCriteria, fetchOptions);

    let totalAnexosEncontrados = 0;
    let totalConciliados = 0;
    let totalDespesas = 0;
    const extratosProcessados = [];

    // Busca boletos e lançamentos existentes
    const [boletosSnap, lancamentosSnap] = await Promise.all([
      db.collection('boletos').where('status', '!=', 'Pago').get(),
      db.collection('financeiro_lancamentos').get()
    ]);

    const boletosPendentes = boletosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const lancamentosExistentes = lancamentosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    for (const item of messages) {
      const all = item.parts.find(part => part.which === '');
      if (!all || !all.body) continue;

      const parsed = await simpleParser(all.body);
      const subject = parsed.subject || '';
      const from = parsed.from ? parsed.from.text : '';

      // Verifica anexos OFX
      if (parsed.attachments && parsed.attachments.length > 0) {
        for (const att of parsed.attachments) {
          const filename = (att.filename || '').toLowerCase();
          if (filename.endsWith('.ofx') || filename.includes('extrato')) {
            totalAnexosEncontrados++;
            const ofxContent = att.content.toString('utf-8');
            const transactions = parseOFX(ofxContent);

            if (transactions.length > 0) {
              let conciliadosNeste = 0;
              let despesasNeste = 0;

              for (const tx of transactions) {
                const isCredit = tx.amount > 0;
                const txValorAbs = Math.abs(tx.amount);

                // Evita duplicidade
                const jaExiste = lancamentosExistentes.some(l => 
                  (l.fitid && l.fitid === tx.fitid) ||
                  (l.data === tx.date && Math.abs(Number(l.valor) - txValorAbs) < 0.01 && l.descricao === tx.description)
                );

                if (jaExiste) continue;

                if (isCredit) {
                  // Tenta cruzar com boleto pendente por valor
                  const boletoMatch = boletosPendentes.find(b => 
                    !b._conciliadoTemp &&
                    Math.abs(Number(b.valor) - txValorAbs) < 0.05
                  );

                  if (boletoMatch) {
                    boletoMatch._conciliadoTemp = true;

                    await db.collection('boletos').doc(boletoMatch.id).update({
                      status: 'Pago',
                      dataPagamento: tx.date || new Date().toISOString().split('T')[0],
                      metodoPagamento: 'Pix / Extrato Gmail',
                      fitid: tx.fitid
                    });

                    await db.collection('financeiro_lancamentos').add({
                      descricao: `Recebimento Cota: ${boletoMatch.morador || 'Morador'} - ${boletoMatch.unidade || boletoMatch.apt || ''} (${boletoMatch.condominio || 'Condomínio'})`,
                      tipo: 'Receita',
                      categoria: 'Taxa Condominial',
                      valor: txValorAbs,
                      data: tx.date || new Date().toISOString().split('T')[0],
                      status: 'Recebido',
                      condominio: boletoMatch.condominio || 'Todos',
                      fitid: tx.fitid,
                      origem: `Gmail (${filename})`,
                      _createdAt: admin.firestore.FieldValue.serverTimestamp()
                    });

                    conciliadosNeste++;
                    totalConciliados++;
                  } else {
                    await db.collection('financeiro_lancamentos').add({
                      descricao: tx.description || 'Receita Bancária / Pix Recebido',
                      tipo: 'Receita',
                      categoria: 'Outras Receitas',
                      valor: txValorAbs,
                      data: tx.date || new Date().toISOString().split('T')[0],
                      status: 'Recebido',
                      condominio: 'Todos',
                      fitid: tx.fitid,
                      origem: `Gmail (${filename})`,
                      _createdAt: admin.firestore.FieldValue.serverTimestamp()
                    });

                    conciliadosNeste++;
                    totalConciliados++;
                  }
                } else {
                  await db.collection('financeiro_lancamentos').add({
                    descricao: tx.description || 'Débito Bancário / Pagamento',
                    tipo: 'Despesa',
                    categoria: 'Despesas Operacionais',
                    valor: txValorAbs,
                    data: tx.date || new Date().toISOString().split('T')[0],
                    status: 'Pago',
                    condominio: 'Todos',
                    fitid: tx.fitid,
                    origem: `Gmail (${filename})`,
                    _createdAt: admin.firestore.FieldValue.serverTimestamp()
                  });

                  despesasNeste++;
                  totalDespesas++;
                }
              }

              extratosProcessados.push({
                arquivo: filename,
                assunto: subject,
                remetente: from,
                transacoes: transactions.length,
                conciliados: conciliadosNeste,
                despesas: despesasNeste
              });
            }
          }
        }
      }
    }

    connection.end();

    // Se houve novos lançamentos, grava notificação no Sininho
    if (totalConciliados > 0 || totalDespesas > 0) {
      await db.collection('notificacoes').add({
        titulo: '📬 Robô do Gmail: Extratos Conciliados',
        text: `🎉 O robô sincronizou o Gmail (alphaadmsc@gmail.com) e conciliou automaticamente ${totalConciliados} boletos/receitas e ${totalDespesas} despesas.`,
        time: new Date().toISOString(),
        tipo: 'conciliacao_gmail',
        condominio: 'Todos',
        lida: false,
        link: '/financeiro',
        _createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    return res.status(200).json({
      success: true,
      message: `Sincronização concluída! ${messages.length} e-mails verificados, ${totalAnexosEncontrados} extratos OFX encontrados. ${totalConciliados} recebimentos conciliados e ${totalDespesas} despesas lançadas.`,
      emailsVerificados: messages.length,
      anexosEncontrados: totalAnexosEncontrados,
      totalConciliados,
      totalDespesas,
      extratosProcessados
    });

  } catch (error) {
    if (connection) connection.end();
    console.error('Erro na sincronização do Gmail:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
