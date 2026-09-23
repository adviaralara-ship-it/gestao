import { useEffect, useRef } from 'react'
import { collection, getDocs, doc, updateDoc, addDoc, serverTimestamp, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'

const LOCK_TAREFAS_KEY = 'alpha_tarefas_lembrete_last_check'

/**
 * Função centralizada para verificar e disparar lembretes automáticos de tarefas do dia (D-0)
 */
export async function verificarEDispararLembretesTarefas(isManual = false) {
  try {
    const hoje = new Date()
    const ano = hoje.getFullYear()
    const mes = String(hoje.getMonth() + 1).padStart(2, '0')
    const dia = String(hoje.getDate()).padStart(2, '0')
    const hojeStr = `${ano}-${mes}-${dia}`
    const dataFmt = `${dia}/${mes}/${ano}`

    // Intervalo de segurança para verificação em background (1 hora)
    if (!isManual) {
      const lastCheck = Number(localStorage.getItem(LOCK_TAREFAS_KEY) || 0)
      const now = Date.now()
      if (now - lastCheck < 60 * 60 * 1000) {
        return { success: true, disparos: 0, ignoradoPorIntervalo: true }
      }
      localStorage.setItem(LOCK_TAREFAS_KEY, String(now))
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
      return { success: true, totalTarefas: 0, message: 'Nenhuma tarefa agendada para hoje.' }
    }

    // Verifica tarefas que ainda não receberam lembrete hoje
    const tarefasPendentesLembrete = tarefasHoje.filter(t => t.lembreteHojeEnviado !== hojeStr)

    if (tarefasPendentesLembrete.length === 0 && !isManual) {
      return { success: true, totalTarefas: tarefasHoje.length, message: 'Lembretes de hoje já foram disparados.' }
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

    msgTexto += `🔗 *Acesse o painel de Tarefas:* https://alpha-solucoes-condominiais.vercel.app/tarefas`

    // 4. Telefones destinatários (Administradores / Financeiro / WhatsApp Master)
    const telefonesDestino = new Set()
    telefonesDestino.add('558396885931') // WhatsApp Oficial Alpha Soluções

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
        await fetch('/api/whatsapp-send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            number: numero,
            text: msgTexto,
            instance: 'InstanciaAlpha'
          })
        })
      } catch (errSend) {
        console.warn('Erro ao enviar WhatsApp de tarefas para:', numero, errSend)
      }
    }

    // 6. Grava notificação no sistema (Sininho)
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

    // 7. Marca as tarefas como lembradas hoje
    for (const t of tarefasHoje) {
      try {
        await updateDoc(doc(db, 'tarefas', t.id), {
          lembreteHojeEnviado: hojeStr,
          dataUltimoLembrete: new Date().toISOString()
        })
      } catch (e) {}
    }

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
 * Hook do React para disparar automaticamente ao carregar telas de gestão
 */
export function useTarefasAutoReminder() {
  const { user } = useAuth()
  const hasTriggeredRef = useRef(false)

  useEffect(() => {
    if (!user || hasTriggeredRef.current) return
    const isMaster = user.role === 'Administrador' || user.role === 'Financeiro' || user.role === 'Síndico'
    if (!isMaster) return

    hasTriggeredRef.current = true

    // Executa em background após 3 segundos
    const timer = setTimeout(() => {
      verificarEDispararLembretesTarefas(false).catch(e => console.warn('Lembrete de tarefas bg:', e))
    }, 3000)

    return () => clearTimeout(timer)
  }, [user])
}
