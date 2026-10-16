// api/extrato/processar.js
import admin from 'firebase-admin';
import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';
import { applyCors, verifyUserAuth } from '../_middleware/auth.js';

function getDb() {
  if (!admin.apps.length) {
    try {
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        admin.initializeApp({
          credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
        });
      } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
          })
        });
      } else {
        admin.initializeApp();
      }
    } catch (e) {
      console.warn('Firebase Admin fallback init:', e.message);
    }
  }
  return admin.firestore();
}

const GMAIL_USER = process.env.GMAIL_USER || 'alphaadmsc@gmail.com';

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

// Executa conciliação das transações no Firestore
async function conciliarTransacoes(transactions, origem = 'OFX', condominio = 'Todos') {
  const db = getDb();
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

    const jaExiste = lancamentosExistentes.some(l => 
      (l.fitid && l.fitid === tx.fitid) ||
      (l.data === tx.date && Math.abs(Number(l.valor) - txValorAbs) < 0.01 && l.descricao === tx.description)
    );

    if (jaExiste) {
      resultados.push({ ...tx, status: 'Ja_Existente' });
      continue;
    }

    if (isCredit) {
      const boletoMatch = boletosPendentes.find(b => 
        !b._conciliadoTemp &&
        Math.abs(Number(b.valor) - txValorAbs) < 0.05
      );

      if (boletoMatch) {
        boletoMatch._conciliadoTemp = true;

        await db.collection('boletos').doc(boletoMatch.id).update({
          status: 'Pago',
          dataPagamento: tx.date || new Date().toISOString().slice(0, 10),
          valorPago: txValorAbs,
          fitid: tx.fitid,
          conciliadoAuto: true,
          origemConciliacao: origem,
          _updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        await db.collection('financeiro_lancamentos').add({
          descricao: `Boleto Conciliado: ${boletoMatch.morador || 'Morador'} (${boletoMatch.competencia || 'Ref'})`,
          tipo: 'Receita',
          categoria: 'Taxa Condominial',
          valor: txValorAbs,
          data: tx.date || new Date().toISOString().slice(0, 10),
          status: 'Recebido',
          condominio: boletoMatch.condominio || condominio || 'Todos',
          boletoId: boletoMatch.id,
          fitid: tx.fitid,
          origem,
          _createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        conciliadosCount++;
        resultados.push({ ...tx, status: 'Conciliado_Receita', boleto: boletoMatch.morador });
      } else {
        await db.collection('financeiro_lancamentos').add({
          descricao: tx.description || 'Crédito em Conta não Identificado',
          tipo: 'Receita',
          categoria: 'Receitas Diversas',
          valor: txValorAbs,
          data: tx.date || new Date().toISOString().slice(0, 10),
          status: 'Recebido',
          condominio: condominio || 'Todos',
          fitid: tx.fitid,
          origem,
          _createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        conciliadosCount++;
        resultados.push({ ...tx, status: 'Lancado_Receita_Avulsa' });
      }
    } else {
      let categoria = 'Despesas Bancárias';
      const descLower = (tx.description || '').toLowerCase();

      if (descLower.includes('tarifa') || descLower.includes('taxa') || descLower.includes('manut') || descLower.includes('iof') || descLower.includes('mensalidade')) {
        categoria = 'Tarifas Bancárias';
      } else if (descLower.includes('copel') || descLower.includes('enel') || descLower.includes('luz') || descLower.includes('energia')) {
        categoria = 'Energia Elétrica';
      } else if (descLower.includes('sanepar') || descLower.includes('sabesp') || descLower.includes('agua') || descLower.includes('água')) {
        categoria = 'Água e Esgoto';
      } else if (descLower.includes('seguro')) {
        categoria = 'Seguros';
      }

      await db.collection('financeiro_lancamentos').add({
        descricao: tx.description || 'Débito Bancário',
        tipo: 'Despesa',
        categoria,
        valor: txValorAbs,
        data: tx.date || new Date().toISOString().slice(0, 10),
        status: 'Pago',
        condominio: condominio || 'Todos',
        fitid: tx.fitid,
        origem,
        _createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      despesasLancadas++;
      resultados.push({ ...tx, status: 'Lancado_Despesa' });
    }
  }

  return { conciliadosCount, despesasLancadas, resultados };
}

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, POST, OPTIONS')) return;

  // Autenticação obrigatória
  const user = await verifyUserAuth(req, res);
  if (!user) return;

  const rawPass = process.env.GMAIL_APP_PASSWORD || 'pognicpypmgbxmrw';
  const effectivePass = rawPass.replace(/[^a-zA-Z0-9]/g, '');

  // 1. MÉTODO GET: Listar e Ler E-mails da Caixa de Entrada (Webmail Alpha)
  if (req.method === 'GET') {
    if (!effectivePass) {
      return res.status(400).json({ error: 'Senha de aplicativo do Gmail não configurada no servidor.' });
    }

    let connection;
    try {
      const config = {
        imap: {
          user: GMAIL_USER,
          password: effectivePass,
          host: 'imap.gmail.com',
          port: 993,
          tls: true,
          authTimeout: 10000
        }
      };

      connection = await imaps.connect(config);
      await connection.openBox('INBOX');

      const delay = 30 * 24 * 3600 * 1000;
      const sinceDate = new Date(Date.now() - delay);
      const searchCriteria = [
        ['SINCE', sinceDate.toISOString().slice(0, 10)]
      ];

      const fetchOptions = {
        bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', 'TEXT', ''],
        struct: true,
        markSeen: false
      };

      const messages = await connection.search(searchCriteria, fetchOptions);

      messages.sort((a, b) => {
        const dateA = new Date(a.attributes?.date || 0);
        const dateB = new Date(b.attributes?.date || 0);
        return dateB - dateA;
      });

      const recentMessages = messages.slice(0, 35);
      const emailList = [];

      for (const item of recentMessages) {
        const all = item.parts.find(part => part.which === '');
        if (!all || !all.body) continue;

        const parsed = await simpleParser(all.body);

        const attachmentsInfo = (parsed.attachments || []).map(att => ({
          filename: att.filename || 'anexo',
          contentType: att.contentType,
          size: att.size,
          contentBase64: att.content ? att.content.toString('base64') : null
        }));

        emailList.push({
          uid: item.attributes?.uid || Math.random().toString(36).substring(7),
          seqNo: item.seqNo,
          date: parsed.date ? parsed.date.toISOString() : new Date().toISOString(),
          from: parsed.from ? (parsed.from.text || parsed.from.value?.[0]?.address || '') : '',
          to: parsed.to ? (parsed.to.text || '') : '',
          subject: parsed.subject || '(Sem assunto)',
          text: parsed.text ? parsed.text.slice(0, 300) : '',
          html: parsed.html || (parsed.text ? `<pre style="font-family:inherit;white-space:pre-wrap;">${parsed.text}</pre>` : ''),
          hasAttachments: attachmentsInfo.length > 0,
          attachments: attachmentsInfo
        });
      }

      connection.end();

      return res.status(200).json({
        success: true,
        total: emailList.length,
        emails: emailList
      });

    } catch (err) {
      if (connection) {
        try { connection.end(); } catch (e) {}
      }
      console.error('Erro ao buscar e-mails via IMAP:', err);
      return res.status(500).json({
        success: false,
        error: 'Falha ao conectar na caixa de entrada do Gmail: ' + err.message
      });
    }
  }

  // 2. MÉTODO POST: Envio de e-mail OU Processamento de Extrato OFX
  if (req.method === 'POST') {
    const { action, to, subject, html, text, cc, bcc, attachments, ofxText, ofxBase64, appPassword, condominio = 'Todos' } = req.body || {};
    const passToUse = (appPassword || effectivePass);

    // SUB-CASO A: Enviar E-mail (Webmail Alpha)
    if (action === 'enviar-email' || (to && (html || text))) {
      if (!passToUse) {
        return res.status(400).json({ error: 'Senha de aplicativo do Gmail não configurada no servidor.' });
      }

      try {
        const transporter = nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 465,
          secure: true,
          auth: {
            user: GMAIL_USER,
            pass: passToUse
          }
        });

        const formattedAttachments = (attachments || []).map(att => ({
          filename: att.filename,
          content: Buffer.from(att.base64, 'base64'),
          contentType: att.contentType
        }));

        const mailOptions = {
          from: `"Alpha Soluções Condominiais" <${GMAIL_USER}>`,
          to,
          subject: subject || 'Sem Assunto',
          text: text || '',
          html: html || (text ? text.replace(/\n/g, '<br/>') : ''),
          cc,
          bcc,
          attachments: formattedAttachments
        };

        const info = await transporter.sendMail(mailOptions);

        return res.status(200).json({
          success: true,
          messageId: info.messageId,
          response: info.response
        });
      } catch (err) {
        console.error('Erro ao enviar e-mail via SMTP:', err);
        return res.status(500).json({
          success: false,
          error: 'Falha ao enviar e-mail pelo Gmail: ' + err.message
        });
      }
    }

    // SUB-CASO B: Sincronização direta com o Gmail para Extratos OFX
    if (action === 'sincronizar-gmail' || (!ofxText && !ofxBase64)) {
      if (!passToUse) {
        return res.status(400).json({ error: 'Senha de aplicativo do Gmail não configurada no servidor.' });
      }

      let connection;
      try {
        const config = {
          imap: {
            user: GMAIL_USER,
            password: passToUse,
            host: 'imap.gmail.com',
            port: 993,
            tls: true,
            authTimeout: 10000
          }
        };

        connection = await imaps.connect(config);
        await connection.openBox('INBOX');

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

        for (const item of messages) {
          const all = item.parts.find(part => part.which === '');
          if (!all || !all.body) continue;

          const parsed = await simpleParser(all.body);
          const subj = parsed.subject || '';
          const from = parsed.from ? parsed.from.text : '';

          if (parsed.attachments && parsed.attachments.length > 0) {
            for (const att of parsed.attachments) {
              const filename = (att.filename || '').toLowerCase();
              if (filename.endsWith('.ofx') || filename.includes('extrato')) {
                totalAnexosEncontrados++;
                const ofxContent = att.content.toString('utf-8');
                const txs = parseOFX(ofxContent);

                if (txs.length > 0) {
                  const concResult = await conciliarTransacoes(txs, `Gmail (${filename})`, condominio);
                  totalConciliados += concResult.conciliadosCount;
                  totalDespesas += concResult.despesasLancadas;

                  extratosProcessados.push({
                    arquivo: filename,
                    assunto: subj,
                    remetente: from,
                    transacoes: txs.length,
                    conciliados: concResult.conciliadosCount,
                    despesas: concResult.despesasLancadas
                  });
                }
              }
            }
          }
        }

        connection.end();

        const db = getDb();
        if (totalConciliados > 0 || totalDespesas > 0) {
          await db.collection('notificacoes').add({
            titulo: '📬 Robô do Gmail: Extratos Conciliados',
            text: `🎉 Sincronização do Gmail (${GMAIL_USER}) concluiu com ${totalConciliados} boletos conciliados e ${totalDespesas} despesas registradas.`,
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
      } catch (err) {
        if (connection) connection.end();
        console.error('Erro na conexão IMAP do Gmail:', err);
        return res.status(200).json({ 
          success: false, 
          error: `Falha na conexão com Gmail: ${err.message || 'Verifique as configurações do IMAP.'}`
        });
      }
    }

    // SUB-CASO C: Processamento de texto/base64 de OFX direto
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

    const { conciliadosCount, despesasLancadas, resultados } = await conciliarTransacoes(transactions, 'Extrato OFX Manual', condominio);

    const db = getDb();
    await db.collection('notificacoes').add({
      titulo: '📊 Extrato Bancário Conciliado',
      text: `🎉 Extrato processado: ${conciliadosCount} boletos/receitas conciliados e ${despesasLancadas} despesas lançadas.`,
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
}
