// api/cron/alertas-vencimento.js
// Cron job executado diariamente às 08h00 para alertar contas a pagar vencendo hoje.
// Separa em dois blocos: A) Contas "Alpha interno"; B) Contas dos condomínios (agrupadas por condomínio).

import admin from 'firebase-admin';
import { applyCors, verifyCronAuth } from '../_middleware/auth.js';

if (!admin.apps.length) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
      });
    } catch (e) {
      console.warn('Falha ao inicializar com FIREBASE_SERVICE_ACCOUNT:', e.message);
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

const EVOLUTION_URL = process.env.EVOLUTION_URL || 'https://spiritualmacaw-evolution.cloudfy.live';
const API_KEY = process.env.EVOLUTION_API_KEY || 'Q1CguwvCa34nqB1936dHekPICikeSCHb';

const isAlphaInterno = (condo) => {
  if (!condo) return true;
  const c = String(condo).toLowerCase().trim();
  return c.includes('alpha') || c === 'interno' || c === 'administração' || c === 'administracao' || c === 'matriz';
};

const fmtBRL = (v) => {
  return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, POST, OPTIONS')) return;

  // Validação obrigatória de autorização para execução de cron
  if (!verifyCronAuth(req, res)) return;

  try {
    // 1. Data atual no fuso de Brasília (UTC-3)
    const hoje = new Date();
    const brDateStr = hoje.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const [d, m, y] = brDateStr.split('/');
    const hojeStr = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    const dataFmt = `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;

    // 2. Buscar lançamentos financeiros, usuários e tarefas do dia
    const [finSnap, usuariosSnap, tarefasSnap] = await Promise.all([
      db.collection('financeiro_lancamentos').get(),
      db.collection('usuarios').get(),
      db.collection('tarefas').get()
    ]);

    const lancamentos = finSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const usuarios = usuariosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const tarefas = tarefasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Função auxiliar para normalizar qualquer data para YYYY-MM-DD
    const normalizarParaIso = (val) => {
      if (!val) return '';
      const s = String(val).trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
      const brMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (brMatch) return `${brMatch[3]}-${brMatch[2].padStart(2, '0')}-${brMatch[1].padStart(2, '0')}`;
      return '';
    };

    // 3. Filtrar contas a pagar com vencimento HOJE e pendentes
    const contasVencendoHoje = lancamentos.filter(item => {
      const isDespesa = item.tipo === 'Despesa' || (item.categoria && String(item.categoria).toLowerCase().includes('despesa'));
      if (!isDespesa) return false;

      const pago = item.status === 'Pago' || item.status === 'Liquidado' || item.pago === true;
      if (pago) return false;

      const dtVenc = item.vencimento || item.data || '';
      return normalizarParaIso(dtVenc) === hojeStr;
    });

    // Filtrar tarefas agendadas para HOJE não concluídas
    const tarefasHoje = tarefas.filter(t => {
      const isDone = t.coluna === 'Concluído' || t.coluna === 'concluido' || t.status === 'Concluído';
      const dtVenc = t.vencimento || t.data || '';
      return normalizarParaIso(dtVenc) === hojeStr && !isDone;
    });

    if (contasVencendoHoje.length === 0 && tarefasHoje.length === 0) {
      return res.status(200).json({
        success: true,
        dataReferencia: hojeStr,
        message: 'Nenhuma conta nem tarefa vencendo hoje encontrada.',
        totalContas: 0,
        totalTarefas: 0
      });
    }

    // 4. Bloco A: Alpha Interno | Bloco B: Condomínios (agrupados por condomínio)
    const contasAlphaInterno = [];
    const contasCondominiosMap = {};

    contasVencendoHoje.forEach(conta => {
      if (isAlphaInterno(conta.condominio)) {
        contasAlphaInterno.push(conta);
      } else {
        const nomeCondo = conta.condominio || 'Sem Condomínio';
        if (!contasCondominiosMap[nomeCondo]) {
          contasCondominiosMap[nomeCondo] = [];
        }
        contasCondominiosMap[nomeCondo].push(conta);
      }
    });

    // 5. Montar mensagem de notificação formatada
    let msgTexto = `🔔 *ALERTAS DE VENCIMENTO DO DIA (${dataFmt})*\n`;
    msgTexto += `Total de contas vencendo hoje: ${contasVencendoHoje.length}\n\n`;

    // BLOCO A) Alpha Interno
    msgTexto += `🏢 *BLOCO A: ALPHA INTERNO*\n`;
    if (contasAlphaInterno.length === 0) {
      msgTexto += `_Nenhuma conta da Alpha vencendo hoje._\n\n`;
    } else {
      let totalAlpha = 0;
      contasAlphaInterno.forEach(c => {
        const val = parseFloat(c.valor) || 0;
        totalAlpha += val;
        msgTexto += `• *${c.descricao || 'Despesa'}*: R$ ${fmtBRL(val)}${c.categoria ? ` (${c.categoria})` : ''}\n`;
      });
      msgTexto += `*Total Alpha:* R$ ${fmtBRL(totalAlpha)} (${contasAlphaInterno.length} contas)\n\n`;
    }

    // BLOCO B) Condomínios agrupados por condomínio
    msgTexto += `🏘️ *BLOCO B: CONTAS DOS CONDOMÍNIOS*\n`;
    const condosChaves = Object.keys(contasCondominiosMap);
    if (condosChaves.length === 0) {
      msgTexto += `_Nenhuma conta de condomínios vencendo hoje._\n\n`;
    } else {
      condosChaves.sort().forEach(nomeCondo => {
        const lista = contasCondominiosMap[nomeCondo];
        const subtotal = lista.reduce((acc, c) => acc + (parseFloat(c.valor) || 0), 0);
        msgTexto += `\n📍 *${nomeCondo.toUpperCase()}* (${lista.length} contas - R$ ${fmtBRL(subtotal)}):\n`;
        lista.forEach(c => {
          const val = parseFloat(c.valor) || 0;
          msgTexto += `  - ${c.descricao || 'Despesa'}: R$ ${fmtBRL(val)}${c.categoria ? ` (${c.categoria})` : ''}\n`;
        });
      });
      msgTexto += `\n`;
    }

    // BLOCO C) Tarefas & Agenda de Hoje
    if (tarefasHoje.length > 0) {
      msgTexto += `📋 *BLOCO C: TAREFAS & AGENDA DE HOJE*\n`;
      tarefasHoje.forEach((t, i) => {
        const horaStr = t.hora ? ` (${t.hora})` : '';
        const prioStr = t.prioridade ? ` [${t.prioridade}]` : '';
        msgTexto += `  ${i + 1}. *${t.titulo}*${horaStr}${prioStr}${t.responsavel ? ` - Resp: ${t.responsavel}` : ''}\n`;
      });
      msgTexto += `\n`;
    }

    msgTexto += `🔗 *Acesse o módulo Financeiro:* https://alpha-solucoes-condominiais.vercel.app/financeiro\n`;
    msgTexto += `🔗 *Acesse as Tarefas:* https://alpha-solucoes-condominiais.vercel.app/tarefas`;

    // 6. Gravar notificação no Firestore (sininho da plataforma)
    await db.collection('notificacoes').add({
      titulo: `Alertas de Vencimento Hoje (${contasVencendoHoje.length} contas)`,
      text: `Contas a pagar vencendo em ${dataFmt}. Alpha Interno: ${contasAlphaInterno.length} | Condomínios: ${contasVencendoHoje.length - contasAlphaInterno.length}.`,
      detalhes: msgTexto,
      time: new Date().toISOString(),
      tipo: 'alerta_vencimento',
      condominio: 'Todos',
      lida: false,
      link: '/financeiro',
      _createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // 7. Disparar via WhatsApp para Administradores / Financeiro
    const telefonesDestino = new Set();
    telefonesDestino.add('558396885931'); // WhatsApp administrativo
    telefonesDestino.add('5583996806325'); // 83 99680-6325
    telefonesDestino.add('5583999797285'); // 83 99979-7285
    telefonesDestino.add('5583998350321'); // 83 99835-0321
    telefonesDestino.add('5583998468997'); // 83 99846-8997

    usuarios.forEach(u => {
      const cargo = String(u.role || '').toLowerCase();
      if (cargo.includes('administrador') || cargo.includes('admin') || cargo.includes('financeiro') || cargo.includes('diretor')) {
        const rawTel = u.telefone || u.tel || u.whatsapp || u.celular || '';
        const cleanTel = String(rawTel).replace(/\D/g, '');
        if (cleanTel.length >= 8) {
          telefonesDestino.add(cleanTel.length <= 11 ? `55${cleanTel}` : cleanTel);
        }
      }
    });

    for (const numero of telefonesDestino) {
      try {
        await fetch(`${EVOLUTION_URL}/message/sendText/InstanciaAlpha`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: API_KEY },
          body: JSON.stringify({ number: numero, text: msgTexto })
        });
      } catch (errSend) {
        console.warn('Erro ao enviar WhatsApp para', numero, errSend.message);
      }
    }

    return res.status(200).json({
      success: true,
      dataReferencia: hojeStr,
      totalVencendoHoje: contasVencendoHoje.length,
      blocoA_AlphaInterno: contasAlphaInterno.length,
      blocoB_Condominios: contasVencendoHoje.length - contasAlphaInterno.length,
      condominiosAfetados: condosChaves
    });
  } catch (error) {
    console.error('Erro no cron de alertas de vencimento:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
