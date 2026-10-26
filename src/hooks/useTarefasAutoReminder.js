import { useEffect, useRef } from 'react'
import { collection, getDocs, doc, getDoc, setDoc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { enviarMensagemWhatsApp } from '../utils/whatsappAutomacao'

const LOCK_TAREFAS_KEY = 'alpha_tarefas_lembrete_last_date'

/**
 * Função centralizada para verificar e disparar lembretes de tarefas do dia (D-0)
 * Protegida contra disparos múltiplos com trava global no Firestore
 */
export async function verificarEDispararLembretesTarefas(isManual = false) {
  try {
    const hoje = new Date()
    const ano = hoje.getFullYear()
    const mes = String(hoje.getMonth() + 1).padStart(2, '0')
    const dia = String(hoje.getDate()).padStart(2, '0')
    const hojeStr = `${ano}-${mes}-${dia}`
    const dataFmt = `${dia}/${mes}/${ano}`

    // Trava de segurança para verificação em background
    if (!isManual) {
      try {
        const lastSentDate = localStorage.getItem(LOCK_TAREFAS_KEY)
        if (lastSentDate === hojeStr) {
          return { success: true, disparos: 0, ignoradoPorIntervalo: true, message: 'Lembretes de tarefas já processados hoje neste dispositivo.' }
        }
      } catch (e) {}

      // 1. Checa se o lembrete diário global (que já engloba tarefas/agenda) já foi disparado hoje
      try {
        const lockDiarioRef = doc(db, 'travas_sistema', `lembrete_diario_${hojeStr}`)
        const lockDiarioSnap = await getDoc(lockDiarioRef)
        if (lockDiarioSnap.exists()) {
          try { localStorage.setItem(LOCK_TAREFAS_KEY, hojeStr) } catch (e) {}
          return { success: true, totalTarefas: 0, ignoradoPorTrava: true, message: 'Agenda de hoje já inclusa no lembrete diário unificado.' }
        }
      } catch (errCheck) {
        console.warn('Aviso ao checar trava diária global:', errCheck)
      }

      // 2. Checa se o lembrete específico de tarefas já foi disparado hoje
      try {
        const lockTarefasRef = doc(db, 'travas_sistema', `lembrete_tarefas_${hojeStr}`)
        const lockTarefasSnap = await getDoc(lockTarefasRef)
        if (lockTarefasSnap.exists()) {
          try { localStorage.setItem(LOCK_TAREFAS_KEY, hojeStr) } catch (e) {}
          return { success: true, totalTarefas: 0, ignoradoPorTrava: true, message: 'Lembrete de tarefas já foi disparado hoje.' }
        }
      } catch (errCheck) {
        console.warn('Aviso ao checar trava de tarefas:', errCheck)
      }
    }

    // 1. Busca tarefas e usuários
    const [tarefasSnap, usuariosSnap] = await Promise.all([
      getDocs(collection(db, 'tarefas')),
      getDocs(collection(db, 'usuarios'))
    ])

    const tarefas = tarefasSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    const usuarios = usuariosSnap.docs.map(d => ({ id: d.id, ...d.data() }))

    // 2. Filtra tarefas que vencem HOJE e não foram concluídas
    const tarefasHoje = tarefas.filter(t => {
      const venc = t.vencimento || t.data || ''
      const isConcluido = t.coluna === 'Concluído' || t.coluna === 'concluido' || t.status === 'Concluído'
      return venc.startsWith(hojeStr) && !isConcluido
    })

    if (tarefasHoje.length === 0) {
      if (!isManual) {
        try {
          await setDoc(doc(db, 'travas_sistema', `lembrete_tarefas_${hojeStr}`), {
            dataReferencia: hojeStr,
            enviadoEm: serverTimestamp(),
            origem: 'sem_tarefas_hoje'
          }, { merge: true })
          localStorage.setItem(LOCK_TAREFAS_KEY, hojeStr)
        } catch (e) {}
      }
      return { success: true, totalTarefas: 0, message: 'Nenhuma tarefa agendada para hoje.' }
    }

    // Verifica tarefas que ainda não receberam lembrete hoje
    const tarefasPendentesLembrete = tarefasHoje.filter(t => t.lembreteHojeEnviado !== hojeStr)

    if (tarefasPendentesLembrete.length === 0 && !isManual) {
      try { localStorage.setItem(LOCK_TAREFAS_KEY, hojeStr) } catch (e) {}
      return { success: true, totalTarefas: tarefasHoje.length, message: 'Lembretes de hoje já foram disparados.' }
    }

    // Registra a trava no Firestore ANTES do envio para evitar corridas
    if (!isManual) {
      try {
        await setDoc(doc(db, 'travas_sistema', `lembrete_tarefas_${hojeStr}`), {
          dataReferencia: hojeStr,
          enviadoEm: serverTimestamp(),
          origem: 'frontend_tarefas',
          totalTarefas: tarefasHoje.length
        }, { merge: true })
        localStorage.setItem(LOCK_TAREFAS_KEY, hojeStr)
      } catch (e) {}
    }

    // 3. Montar mensagem formatada do WhatsApp
    let msgTexto = `📋 *LEMBRETE DE TAREFAS & AGENDA DE HOJE (${dataFmt})*\n\n`
    msgTexto += `Olá! Você tem *${tarefasHoje.length} tarefa(s)* agendada(s) para hoje:\n\n`

    tarefasHoje.forEach((t, i) => {
      const horaStr = t.hora ? ` às ${t.hora}` : ''
      const prioStr = t.prioridade ? ` [${t.prioridade}]` : ''
      msgTexto += `${i + 1}. *${t.titulo}*${horaStr}${prioStr}\n`
      if (t.descricao) msgTexto += `   📝 ${t.descricao.trim()}\n`
      if (t.responsavel) msgTexto += `   👤 Resp: ${t.responsavel}\n`
      msgTexto += `\n`
    })

    msgTexto += `🔗 *Acesse o painel de Tarefas:* https://app.alphaadmsc.com.br/tarefas`

    // 4. Telefones destinatários (Administradores / Financeiro / WhatsApp Master)
    const telefonesDestino = new Set()
    telefonesDestino.add('5583996885931') // WhatsApp Oficial Alpha Soluções
    telefonesDestino.add('5583996806325') // 83 99680-6325
    telefonesDestino.add('5583999797285') // 83 99979-7285
    telefonesDestino.add('5583998350321') // 83 99835-0321
    telefonesDestino.add('5583998468997') // 83 99846-8997

    usuarios.forEach(u => {
      const role = String(u.role || '').toLowerCase()
      if (role.includes('admin') || role.includes('financeiro') || role.includes('síndico') || role.includes('sindico')) {
        const rawTel = u.tel || u.telefone || u.whatsapp || u.celular || ''
        const cleanTel = String(rawTel).replace(/\D/g, '')
        if (cleanTel.length >= 8) {
          telefonesDestino.add(cleanTel.length <= 11 ? `55${cleanTel}` : cleanTel)
        }
      }
    })

    // 5. Dispara WhatsApp para cada destinatário
    for (const numero of telefonesDestino) {
      try {
        await enviarMensagemWhatsApp({
          number: numero,
          text: msgTexto,
          instance: 'InstanciaAlpha'
        })
      } catch (errSend) {
        console.warn('Erro ao enviar WhatsApp de tarefas para:', numero, errSend)
      }
    }

    // 6. Grava notificação no sistema (Sininho)
    try {
      await addDoc(collection(db, 'notificacoes'), {
        titulo: `Agenda de Hoje: ${tarefasHoje.length} tarefa(s)`,
        text: `Você tem ${tarefasHoje.length} compromisso(s) agendado(s) para hoje (${dataFmt}).`,
        detalhes: msgTexto,
        time: new Date().toISOString(),
        tipo: 'tarefas_agenda',
        condominio: 'Todos',
        lida: false,
        link: '/tarefas',
        _createdAt: serverTimestamp()
      })
    } catch (e) {}

    // 7. Marca as tarefas como lembradas hoje
    for (const t of tarefasHoje) {
      try {
        await updateDoc(doc(db, 'tarefas', t.id), {
          lembreteHojeEnviado: hojeStr,
          dataUltimoLembrete: new Date().toISOString()
        })
      } catch (e) {}
    }

    try { localStorage.setItem(LOCK_TAREFAS_KEY, hojeStr) } catch (e) {}

    return {
      success: true,
      totalTarefas: tarefasHoje.length,
      disparos: telefonesDestino.size,
      message: `${tarefasHoje.length} tarefa(s) de hoje notificadas com sucesso!`
    }

  } catch (error) {
    console.error('Erro na rotina de lembretes de tarefas:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Hook do React para sincronização na tela de Tarefas
 * Nota: O disparo automático geral é unificado no useDailyAutoReminder do Layout,
 * evitando mensagens duplicadas para a equipe.
 */
export function useTarefasAutoReminder() {
  // Mantido como hook passivo para compatibilidade com Tarefas.jsx
  // O lembrete oficial do dia roda centralizado via useDailyAutoReminder no Layout.
}
