// api/manutencoes/lembretes.js
// Endpoint de Cron para verificação e disparo automático de lembretes D-1 e D-0 de manutenções

import admin from 'firebase-admin';
import { applyCors, verifyCronAuth } from '../_middleware/auth.js';

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

const EVOLUTION_URL = process.env.EVOLUTION_URL || 'https://runningfly-evolution.cloudfy.live';
const API_KEY = process.env.EVOLUTION_API_KEY || 'WHNRTDYyTpv4ze45wUUU5qN9ri3da1Oy';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, POST, OPTIONS')) return;

  // Validação obrigatória de autorização para execução de cron
  if (!verifyCronAuth(req, res)) return;

  try {
    const hoje = new Date();
    // Obtém data no fuso de Brasília
    const brDateStr = hoje.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const [d, m, y] = brDateStr.split('/');
    const hojeStr = `${y}-${m}-${d}`;
    const hojeDate = new Date(Number(y), Number(m) - 1, Number(d));

    const [manutencoesSnap, usuariosSnap] = await Promise.all([
      db.collection('manutencoes').get(),
      db.collection('usuarios').get()
    ]);

    const manutencoes = manutencoesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const usuarios = usuariosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    let disparos = 0;

    for (const manu of manutencoes) {
      if (!manu.dataPrevista || manu.status === 'Concluída') continue;

      const partes = manu.dataPrevista.split('-');
      if (partes.length !== 3) continue;

      const prevDate = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
      const diffTime = prevDate.getTime() - hojeDate.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      const dataFmt = `${partes[2]}/${partes[1]}/${partes[0]}`;
      const custoFmt = manu.custoEstimado ? Number(manu.custoEstimado).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00';

      // Telefones destinatários
      const telefonesDestino = new Set();
      telefonesDestino.add('558396885931');
      telefonesDestino.add('5583996806325'); // 83 99680-6325
      telefonesDestino.add('5583999797285'); // 83 99979-7285
      telefonesDestino.add('5583998350321'); // 83 99835-0321
      telefonesDestino.add('5583998468997'); // 83 99846-8997

      usuarios.forEach(u => {
        const isAdm = u.role === 'Administrador' || u.role === 'Financeiro';
        const isSindicoDesteCondo = u.role === 'Síndico' && (!manu.condominio || u.condominio === manu.condominio);
        if (isAdm || isSindicoDesteCondo) {
          const rawTel = u.tel || u.telefone || u.whatsapp || u.celular || '';
          const cleanTel = String(rawTel).replace(/\D/g, '');
          if (cleanTel.length >= 8) {
            telefonesDestino.add(cleanTel.length <= 11 ? `55${cleanTel}` : cleanTel);
          }
        }
      });

      // CASO 1: Lembrete de Véspera (1 dia antes / D-1) - Apenas Sininho do sistema
      if (diffDays === 1 && manu.notifD1 !== hojeStr) {
        // Grava no Sininho
        await db.collection('notificacoes').add({
          text: `⚠️ LEMBRETE DE VÉSPERA: Manutenção "${manu.titulo}" agendada para AMANHÃ (${dataFmt}) no ${manu.condominio || 'Condomínio'}.`,
          titulo: `⚠️ Lembrete Amanhã: ${manu.titulo}`,
          time: new Date().toISOString(),
          tipo: 'manutencao_vespera',
          condominio: manu.condominio || 'Todos',
          lida: false,
          link: '/manutencoes',
          _createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        await db.collection('manutencoes').doc(manu.id).update({
          notifD1: hojeStr,
          lembreteVesperaEnviadoEm: hojeStr
        });
      }

      // CASO 2: Lembrete do Dia (Hoje / D-0)
      if (diffDays === 0 && manu.notifD0 !== hojeStr) {
        // Grava no Sininho
        await db.collection('notificacoes').add({
          text: `🚨 MANUTENÇÃO HOJE: "${manu.titulo}" está programada para execução HOJE (${dataFmt}) no ${manu.condominio || 'Condomínio'}.`,
          titulo: `🚨 Manutenção Hoje: ${manu.titulo}`,
          time: new Date().toISOString(),
          tipo: 'manutencao_hoje',
          condominio: manu.condominio || 'Todos',
          lida: false,
          link: '/manutencoes',
          _createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // WhatsApp D-0
        const msgWhats = `🚨 *ATENÇÃO - MANUTENÇÃO PROGRAMADA PARA HOJE!*\n\n🏢 *Condomínio:* ${manu.condominio || 'Todos / Geral'}\n🛠️ *Serviço:* ${manu.titulo}\n📅 *Data:* HOJE (${dataFmt})\n👷 *Prestador / Empresa:* ${manu.fornecedor || 'A definir'}\n💰 *Custo Previsto:* R$ ${custoFmt}\n📌 *Status:* ${manu.status || 'Agendada'}${manu.descricao ? `\n📝 *Observações:* ${manu.descricao}` : ''}\n\n🔔 *Lembrete automático da Alpha Gestão. Favor acompanhar a execução do serviço.*\n🔗 *Acesse o painel:* https://alpha-solucoes-condominiais.vercel.app/manutencoes`;

        for (const numero of telefonesDestino) {
          try {
            await fetch(`${EVOLUTION_URL}/message/sendText/InstanciaAlpha`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'apikey': API_KEY },
              body: JSON.stringify({ number: numero, text: msgWhats })
            });
          } catch(e) {}
        }

        await db.collection('manutencoes').doc(manu.id).update({
          notifD0: hojeStr,
          lembreteHojeEnviadoEm: hojeStr
        });

        disparos++;
      }
    }

    return res.status(200).json({
      success: true,
      message: `Verificação concluída. ${disparos} lembretes disparados.`,
      disparos
    });
  } catch (error) {
    console.error('Erro na rota de lembretes automáticos:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
