// api/manutencoes/lembretes.js
// Endpoint de Cron para verificação e disparo automático de lembretes D-1 e D-0 de manutenções

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

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, POST, OPTIONS')) return;

  // Validação obrigatória de autorização para execução de cron
  if (!verifyCronAuth(req, res)) return;

  try {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
    const auth = getAuth(app);
    const db = getFirestore(app);

    try {
      await signInWithEmailAndPassword(auth, 'admin@alpha.com.br', 'admin123');
    } catch (authErr) {
      console.warn('Login Firebase fallback:', authErr.message);
    }

    const hoje = new Date();
    const brDateStr = hoje.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const [d, m, y] = brDateStr.split('/');
    const hojeStr = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    const hojeDate = new Date(Number(y), Number(m) - 1, Number(d));

    const [manutencoesSnap, usuariosSnap] = await Promise.all([
      getDocs(collection(db, 'manutencoes')),
      getDocs(collection(db, 'usuarios'))
    ]);

    const manutencoes = manutencoesSnap.docs.map(dDoc => ({ id: dDoc.id, ...dDoc.data() }));
    const usuarios = usuariosSnap.docs.map(dDoc => ({ id: dDoc.id, ...dDoc.data() }));

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

      const telefonesDestino = new Set();
      telefonesDestino.add('5583996885931');
      telefonesDestino.add('5583996806325');
      telefonesDestino.add('5583999797285');
      telefonesDestino.add('5583998350321');
      telefonesDestino.add('5583998468997');

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

      // CASO 1: Lembrete de Véspera (D-1)
      if (diffDays === 1 && manu.notifD1 !== hojeStr) {
        await addDoc(collection(db, 'notificacoes'), {
          text: `⚠️ LEMBRETE DE VÉSPERA: Manutenção "${manu.titulo}" agendada para AMANHÃ (${dataFmt}) no ${manu.condominio || 'Condomínio'}.`,
          titulo: `⚠️ Lembrete Amanhã: ${manu.titulo}`,
          time: new Date().toISOString(),
          tipo: 'manutencao_vespera',
          condominio: manu.condominio || 'Todos',
          lida: false,
          link: '/manutencoes',
          _createdAt: serverTimestamp()
        });

        await updateDoc(doc(db, 'manutencoes', manu.id), {
          notifD1: hojeStr,
          lembreteVesperaEnviadoEm: hojeStr
        });
      }

      // CASO 2: Lembrete do Dia (Hoje / D-0)
      if (diffDays === 0 && manu.notifD0 !== hojeStr) {
        await addDoc(collection(db, 'notificacoes'), {
          text: `🚨 MANUTENÇÃO HOJE: "${manu.titulo}" está programada para execução HOJE (${dataFmt}) no ${manu.condominio || 'Condomínio'}.`,
          titulo: `🚨 Manutenção Hoje: ${manu.titulo}`,
          time: new Date().toISOString(),
          tipo: 'manutencao_hoje',
          condominio: manu.condominio || 'Todos',
          lida: false,
          link: '/manutencoes',
          _createdAt: serverTimestamp()
        });

        const msgWhats = `🚨 *ATENÇÃO - MANUTENÇÃO PROGRAMADA PARA HOJE!*\n\n🏢 *Condomínio:* ${manu.condominio || 'Todos / Geral'}\n🛠️ *Serviço:* ${manu.titulo}\n📅 *Data:* HOJE (${dataFmt})\n👷 *Prestador / Empresa:* ${manu.fornecedor || 'A definir'}\n💰 *Custo Previsto:* R$ ${custoFmt}\n📌 *Status:* ${manu.status || 'Agendada'}${manu.descricao ? `\n📝 *Observações:* ${manu.descricao}` : ''}\n\n🔔 *Lembrete automático da Alpha Gestão.*\n🔗 *Acesse o painel:* https://app.alphaadmsc.com.br/manutencoes`;

        for (const numero of telefonesDestino) {
          try {
            await fetch(`${EVOLUTION_URL}/message/sendText/${INSTANCE}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', apikey: API_KEY },
              body: JSON.stringify({ number: numero, text: msgWhats })
            });
          } catch(e) {}
        }

        await updateDoc(doc(db, 'manutencoes', manu.id), {
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
}
