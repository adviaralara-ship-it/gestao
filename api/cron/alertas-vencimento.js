// api/cron/alertas-vencimento.js
// Cron job executado diariamente para alertar agenda, contas a pagar e manutenções do dia.

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { applyCors, verifyCronAuth } from '../_middleware/auth.js';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'AIzaSyDj6CNYCaNSWv_tQYVjCdqFElcuG9lA1LE',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'alphaadmsc-fdc4e.firebaseapp.com',
  projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'alphaadmsc-fdc4e',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'alphaadmsc-fdc4e.appspot.com',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '30408137815',
  appId: process.env.VITE_FIREBASE_APP_ID || '1:30408137815:web:fb091176b6d5f756088277'
};

const EVOLUTION_URL = process.env.EVOLUTION_URL || 'https://runningfly-evolution.cloudfy.live';
const API_KEY = process.env.EVOLUTION_API_KEY || 'WHNRTDYyTpv4ze45wUUU5qN9ri3da1Oy';
const INSTANCE = 'InstanciaAlpha';

const isAlphaInterno = (condo) => {
  if (!condo) return true;
  const c = String(condo).toLowerCase().trim();
  return c.includes('alpha') || c === 'interno' || c === 'administração' || c === 'administracao' || c === 'matriz' || c.includes('uso interno');
};

const fmtBRL = (v) => {
  return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const normalizarParaIso = (val) => {
  if (!val) return '';
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  const brMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (brMatch) {
    const dia = brMatch[1].padStart(2, '0');
    const mes = brMatch[2].padStart(2, '0');
    const ano = brMatch[3];
    return `${ano}-${mes}-${dia}`;
  }
  return '';
};

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, POST, OPTIONS')) return;

  // Validação de autorização para execução de cron
  if (!verifyCronAuth(req, res)) return;

  try {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
    const auth = getAuth(app);
    const db = getFirestore(app);

    try {
      await signInWithEmailAndPassword(auth, 'admin@alpha.com.br', 'admin123');
    } catch (authErr) {
      console.warn('Login Firebase Client fallback:', authErr.message);
    }

    // 1. Data atual no fuso de Brasília (UTC-3)
    const hoje = new Date();
    const brDateStr = hoje.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const [d, m, y] = brDateStr.split('/');
    const hojeStr = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    const dataFmt = `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;

    // 2. Buscar lançamentos financeiros, tarefas, manutenções e usuários
    const [finSnap, tarefasSnap, manuSnap, usuariosSnap] = await Promise.all([
      getDocs(collection(db, 'financeiro_lancamentos')),
      getDocs(collection(db, 'tarefas')),
      getDocs(collection(db, 'manutencoes')),
      getDocs(collection(db, 'usuarios'))
    ]);

    const lancamentos = finSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const tarefas = tarefasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const manutencoes = manuSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const usuarios = usuariosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 3. Filtrar itens de HOJE
    const tarefasHoje = tarefas.filter(t => {
      const isDone = t.coluna === 'Concluído' || t.coluna === 'concluido' || t.status === 'Concluído';
      const dtVenc = normalizarParaIso(t.vencimento || t.data);
      return dtVenc === hojeStr && !isDone;
    });

    const contasVencendoHoje = lancamentos.filter(item => {
      const isDespesa = item.tipo === 'Despesa' || (item.categoria && String(item.categoria).toLowerCase().includes('despesa'));
      if (!isDespesa) return false;
      const pago = item.status === 'Pago' || item.status === 'Liquidado' || item.pago === true;
      if (pago) return false;
      const dtVenc = normalizarParaIso(item.vencimento || item.data);
      return dtVenc === hojeStr;
    });

    const manutencoesHoje = manutencoes.filter(m => {
      const isDone = m.status === 'Concluída' || m.status === 'concluida';
      const dtPrev = normalizarParaIso(m.dataPrevista || m.data || m.proxima_data);
      return dtPrev === hojeStr && !isDone;
    });

    if (contasVencendoHoje.length === 0 && tarefasHoje.length === 0 && manutencoesHoje.length === 0) {
      return res.status(200).json({
        success: true,
        dataReferencia: hojeStr,
        message: 'Nenhuma conta, tarefa nem manutenção agendada para hoje.',
        totalContas: 0,
        totalTarefas: 0,
        totalManutencoes: 0
      });
    }

    // 4. Montar mensagem formatada
    let msgTexto = `🔔 *LEMBRETE DO DIA - ALPHA GESTÃO (${dataFmt})*\n\n`;

    // AGENDA & TAREFAS
    if (tarefasHoje.length > 0) {
      msgTexto += `📋 *AGENDA & TAREFAS DE HOJE (${tarefasHoje.length}):*\n`;
      tarefasHoje.forEach((t, i) => {
        const horaStr = t.hora ? ` às ${t.hora}` : '';
        const prioStr = t.prioridade ? ` [${t.prioridade}]` : '';
        const respStr = t.responsavel ? ` - Resp: ${t.responsavel}` : '';
        msgTexto += `  ${i + 1}. *${t.titulo}*${horaStr}${prioStr}${respStr}\n`;
        if (t.descricao && t.descricao.trim()) msgTexto += `     _${t.descricao.trim()}_\n`;
      });
      msgTexto += `\n`;
    }

    // CONTAS A PAGAR HOJE
    if (contasVencendoHoje.length > 0) {
      const contasAlphaInterno = contasVencendoHoje.filter(c => isAlphaInterno(c.condominio));
      const contasCondos = contasVencendoHoje.filter(c => !isAlphaInterno(c.condominio));

      msgTexto += `💰 *CONTAS A PAGAR VENCENDO HOJE (${contasVencendoHoje.length}):*\n`;

      if (contasAlphaInterno.length > 0) {
        const totAlpha = contasAlphaInterno.reduce((acc, c) => acc + (parseFloat(c.valor) || 0), 0);
        msgTexto += `🏢 *Alpha Interno* (R$ ${fmtBRL(totAlpha)}):\n`;
        contasAlphaInterno.forEach(c => {
          const val = parseFloat(c.valor) || 0;
          const catStr = c.categoria ? ` (${c.categoria})` : '';
          msgTexto += `  • *${c.descricao || 'Despesa'}*: R$ ${fmtBRL(val)}${catStr}\n`;
        });
      }

      if (contasCondos.length > 0) {
        const contasPorCondo = {};
        contasCondos.forEach(c => {
          const nome = c.condominio || 'Sem Condomínio';
          if (!contasPorCondo[nome]) contasPorCondo[nome] = [];
          contasPorCondo[nome].push(c);
        });

        msgTexto += `🏘️ *Condomínios Administrados:*\n`;
        Object.keys(contasPorCondo).sort().forEach(condoNome => {
          const lista = contasPorCondo[condoNome];
          const subtotal = lista.reduce((acc, c) => acc + (parseFloat(c.valor) || 0), 0);
          msgTexto += `  📍 *${condoNome.toUpperCase()}* (${lista.length} conta(s) - R$ ${fmtBRL(subtotal)}):\n`;
          lista.forEach(c => {
            const val = parseFloat(c.valor) || 0;
            const catStr = c.categoria ? ` (${c.categoria})` : '';
            msgTexto += `    - ${c.descricao || 'Despesa'}: R$ ${fmtBRL(val)}${catStr}\n`;
          });
        });
      }
      msgTexto += `\n`;
    }

    // MANUTENÇÕES HOJE
    if (manutencoesHoje.length > 0) {
      msgTexto += `🛠️ *MANUTENÇÕES PROGRAMADAS PARA HOJE (${manutencoesHoje.length}):*\n`;
      manutencoesHoje.forEach((m, i) => {
        const condoStr = m.condominio ? ` no *${m.condominio}*` : '';
        const fornStr = m.fornecedor ? ` | Prestador: ${m.fornecedor}` : '';
        const custoStr = m.custoEstimado ? ` | Prev: R$ ${fmtBRL(m.custoEstimado)}` : '';
        msgTexto += `  ${i + 1}. *${m.titulo}*${condoStr}${fornStr}${custoStr}\n`;
        if (m.descricao && m.descricao.trim()) msgTexto += `     _${m.descricao.trim()}_\n`;
      });
      msgTexto += `\n`;
    }

    msgTexto += `🔗 *Acesse o painel:* https://app.alphaadmsc.com.br`;

    // 5. Gravar notificação no Firestore (Sininho)
    try {
      await addDoc(collection(db, 'notificacoes'), {
        titulo: `Lembretes do Dia (${dataFmt})`,
        text: `Agenda: ${tarefasHoje.length} tarefa(s) | Contas: ${contasVencendoHoje.length} a pagar | Manutenções: ${manutencoesHoje.length} programadas.`,
        detalhes: msgTexto,
        time: new Date().toISOString(),
        tipo: 'lembrete_do_dia',
        condominio: 'Todos',
        lida: false,
        link: '/dashboard',
        _createdAt: serverTimestamp()
      });
    } catch(err) {
      console.warn('Erro ao salvar no Firestore:', err.message);
    }

    // 6. Destinatários do WhatsApp
    const telefonesDestino = new Set();
    telefonesDestino.add('5583996885931');
    telefonesDestino.add('5583996806325');
    telefonesDestino.add('5583999797285');
    telefonesDestino.add('5583998350321');
    telefonesDestino.add('5583998468997');

    usuarios.forEach(u => {
      const cargo = String(u.role || '').toLowerCase();
      if (cargo.includes('admin') || cargo.includes('financeiro') || cargo.includes('diretor')) {
        const rawTel = u.telefone || u.tel || u.whatsapp || u.celular || '';
        const cleanTel = String(rawTel).replace(/\D/g, '');
        if (cleanTel.length >= 8) {
          telefonesDestino.add(cleanTel.length <= 11 ? `55${cleanTel}` : cleanTel);
        }
      }
    });

    let disparos = 0;
    for (const numero of telefonesDestino) {
      try {
        const respSend = await fetch(`${EVOLUTION_URL}/message/sendText/${INSTANCE}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: API_KEY },
          body: JSON.stringify({ number: numero, text: msgTexto })
        });
        if (respSend.ok) disparos++;
      } catch (errSend) {
        console.warn('Erro envio WhatsApp:', numero, errSend.message);
      }
    }

    // 7. Atualiza marcações
    for (const t of tarefasHoje) {
      try {
        await updateDoc(doc(db, 'tarefas', t.id), {
          lembreteHojeEnviado: hojeStr,
          dataUltimoLembrete: new Date().toISOString()
        });
      } catch(e) {}
    }

    for (const m of manutencoesHoje) {
      try {
        await updateDoc(doc(db, 'manutencoes', m.id), {
          notifD0: hojeStr,
          lembreteHojeEnviadoEm: hojeStr
        });
      } catch(e) {}
    }

    return res.status(200).json({
      success: true,
      dataReferencia: hojeStr,
      totalTarefasHoje: tarefasHoje.length,
      totalContasVencendoHoje: contasVencendoHoje.length,
      totalManutencoesHoje: manutencoesHoje.length,
      disparos
    });
  } catch (error) {
    console.error('Erro no cron de lembretes diários:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
