import { useEffect, useRef } from 'react'
import { collection, getDocs, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { enviarMensagemWhatsApp } from '../utils/whatsappAutomacao'

const LOCK_DAILY_KEY = 'alpha_daily_reminder_last_date'

const fmtBRL = (v) => {
  return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const normalizarParaIso = (val) => {
  if (!val) return ''
  const s = String(val).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10)
  const brMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (brMatch) {
    const dia = brMatch[1].padStart(2, '0')
    const mes = brMatch[2].padStart(2, '0')
    const ano = brMatch[3]
    return `${ano}-${mes}-${dia}`
  }
  return ''
}

const isAlphaInterno = (condo) => {
  if (!condo) return true
  const c = String(condo).toLowerCase().trim()
  return c.includes('alpha') || c === 'interno' || c === 'administração' || c === 'administracao' || c === 'matriz' || c.includes('uso interno')
}

/**
 * Função universal para verificar e disparar os lembretes diários:
 * - Agenda & Tarefas do dia
 * - Contas a pagar vencendo hoje
 * - Manutenções programadas para hoje
 * @param {boolean} isManual - Se true, ignora o bloqueio diário de execução única
 */
export async function verificarEDispararLembretesDoDia(isManual = false) {
  try {
    const agora = new Date()
    const brDateStr = agora.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    const [d, m, y] = brDateStr.split('/')
    const hojeStr = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    const dataFmt = `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`

    // Trava de execução diária (para não re-disparar em cada clique ou troca de tela)
    if (!isManual) {
      const lastSentDate = localStorage.getItem(LOCK_DAILY_KEY)
      if (lastSentDate === hojeStr) {
        return { success: true, ignoradoPorDia: true, hojeStr, message: 'Lembretes de hoje já foram disparados anteriormente.' }
      }
    }

    // 1. Busca dados no Firestore
    const [tarefasSnap, finSnap, manuSnap, usuariosSnap] = await Promise.all([
      getDocs(collection(db, 'tarefas')),
      getDocs(collection(db, 'financeiro_lancamentos')),
      getDocs(collection(db, 'manutencoes')),
      getDocs(collection(db, 'usuarios'))
    ])

    const tarefas = tarefasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    const lancamentos = finSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    const manutencoes = manuSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    const usuarios = usuariosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))

    // 2. Filtra Tarefas & Agenda de HOJE (não concluídas)
    const tarefasHoje = tarefas.filter(t => {
      const isDone = t.coluna === 'Concluído' || t.coluna === 'concluido' || t.status === 'Concluído'
      const venc = normalizarParaIso(t.vencimento || t.data)
      return venc === hojeStr && !isDone
    })

    // 3. Filtra Contas a Pagar Vencendo HOJE (pendentes)
    const contasVencendoHoje = lancamentos.filter(item => {
      const isDespesa = item.tipo === 'Despesa' || (item.categoria && String(item.categoria).toLowerCase().includes('despesa'))
      if (!isDespesa) return false
      const pago = item.status === 'Pago' || item.status === 'Liquidado' || item.pago === true
      if (pago) return false
      const dtVenc = normalizarParaIso(item.vencimento || item.data)
      return dtVenc === hojeStr
    })

    // 4. Filtra Manutenções Programadas para HOJE (não concluídas)
    const manutencoesHoje = manutencoes.filter(m => {
      const isDone = m.status === 'Concluída' || m.status === 'concluida'
      const dtPrev = normalizarParaIso(m.dataPrevista || m.data || m.proxima_data)
      return dtPrev === hojeStr && !isDone
    })

    // Se não há nada hoje e não foi clique manual, grava a verificação de hoje e sai
    if (tarefasHoje.length === 0 && contasVencendoHoje.length === 0 && manutencoesHoje.length === 0 && !isManual) {
      localStorage.setItem(LOCK_DAILY_KEY, hojeStr)
      return {
        success: true,
        message: 'Nenhum agendamento, conta ou manutenção com vencimento para hoje.',
        hojeStr,
        tarefasHoje: 0,
        contasHoje: 0,
        manutencoesHoje: 0
      }
    }

    // 5. Monta a Mensagem Formatada
    let msg = `🔔 *LEMBRETE DO DIA - ALPHA GESTÃO (${dataFmt})*\n\n`

    // SEÇÃO 1: Agenda & Tarefas
    if (tarefasHoje.length > 0) {
      msg += `📋 *AGENDA & COMPROMISSOS DE HOJE (${tarefasHoje.length}):*\n`
      tarefasHoje.forEach((t, i) => {
        const horaStr = t.hora ? ` às ${t.hora}` : ''
        const prioStr = t.prioridade ? ` [${t.prioridade}]` : ''
        const respStr = t.responsavel ? ` - Resp: ${t.responsavel}` : ''
        msg += `  ${i + 1}. *${t.titulo}*${horaStr}${prioStr}${respStr}\n`
        if (t.descricao && t.descricao.trim()) {
          msg += `     _${t.descricao.trim()}_\n`
        }
      })
      msg += `\n`
    } else {
      msg += `📋 *AGENDA DE HOJE:* _Nenhuma tarefa agendada para hoje._\n\n`
    }

    // SEÇÃO 2: Contas a Pagar Vencendo Hoje
    if (contasVencendoHoje.length > 0) {
      const contasAlphaInterno = contasVencendoHoje.filter(c => isAlphaInterno(c.condominio))
      const contasCondos = contasVencendoHoje.filter(c => !isAlphaInterno(c.condominio))

      msg += `💰 *CONTAS A PAGAR VENCENDO HOJE (${contasVencendoHoje.length}):*\n`

      if (contasAlphaInterno.length > 0) {
        const totAlpha = contasAlphaInterno.reduce((acc, c) => acc + (parseFloat(c.valor) || 0), 0)
        msg += `🏢 *Alpha Interno* (R$ ${fmtBRL(totAlpha)}):\n`
        contasAlphaInterno.forEach(c => {
          const val = parseFloat(c.valor) || 0
          const catStr = c.categoria ? ` (${c.categoria})` : ''
          msg += `  • *${c.descricao || 'Despesa'}*: R$ ${fmtBRL(val)}${catStr}\n`
        })
      }

      if (contasCondos.length > 0) {
        const contasPorCondo = {}
        contasCondos.forEach(c => {
          const nome = c.condominio || 'Sem Condomínio'
          if (!contasPorCondo[nome]) contasPorCondo[nome] = []
          contasPorCondo[nome].push(c)
        })

        msg += `🏘️ *Condomínios Administrados:*\n`
        Object.keys(contasPorCondo).sort().forEach(condoNome => {
          const lista = contasPorCondo[condoNome]
          const subtotal = lista.reduce((acc, c) => acc + (parseFloat(c.valor) || 0), 0)
          msg += `  📍 *${condoNome.toUpperCase()}* (${lista.length} conta(s) - R$ ${fmtBRL(subtotal)}):\n`
          lista.forEach(c => {
            const val = parseFloat(c.valor) || 0
            const catStr = c.categoria ? ` (${c.categoria})` : ''
            msg += `    - ${c.descricao || 'Despesa'}: R$ ${fmtBRL(val)}${catStr}\n`
          })
        })
      }
      msg += `\n`
    } else {
      msg += `💰 *CONTAS A PAGAR HOJE:* _Nenhuma conta com vencimento para hoje._\n\n`
    }

    // SEÇÃO 3: Manutenções Programadas para Hoje
    if (manutencoesHoje.length > 0) {
      msg += `🛠️ *MANUTENÇÕES PROGRAMADAS PARA HOJE (${manutencoesHoje.length}):*\n`
      manutencoesHoje.forEach((m, i) => {
        const condoStr = m.condominio ? ` no *${m.condominio}*` : ''
        const fornStr = m.fornecedor ? ` | Prestador: ${m.fornecedor}` : ''
        const custoStr = m.custoEstimado ? ` | Prev: R$ ${fmtBRL(m.custoEstimado)}` : ''
        msg += `  ${i + 1}. *${m.titulo}*${condoStr}${fornStr}${custoStr}\n`
        if (m.descricao && m.descricao.trim()) {
          msg += `     _${m.descricao.trim()}_\n`
        }
      })
      msg += `\n`
    } else {
      msg += `🛠️ *MANUTENÇÕES DE HOJE:* _Nenhuma manutenção agendada para hoje._\n\n`
    }

    msg += `🔗 *Acessar Sistema Alpha:* https://app.alphaadmsc.com.br`

    // 6. Grava Notificação no Firestore (Sininho)
    try {
      await addDoc(collection(db, 'notificacoes'), {
        titulo: `🔔 Lembretes de Hoje (${dataFmt})`,
        text: `Agenda: ${tarefasHoje.length} tarefa(s) | Contas: ${contasVencendoHoje.length} a pagar | Manutenções: ${manutencoesHoje.length} programadas.`,
        detalhes: msg,
        time: new Date().toISOString(),
        tipo: 'lembrete_do_dia',
        condominio: 'Todos',
        lida: false,
        link: '/dashboard',
        _createdAt: serverTimestamp()
      })
    } catch (errNotif) {
      console.warn('Falha ao registrar notificação no Firestore:', errNotif)
    }

    // 7. Lista de Telefones para Notificação via WhatsApp
    const telefonesDestino = new Set()
    telefonesDestino.add('5583996885931') // WhatsApp oficial Alpha Gestão
    telefonesDestino.add('5583996806325') // 83 99680-6325 (Iara)
    telefonesDestino.add('5583999797285') // 83 99979-7285
    telefonesDestino.add('5583998350321') // 83 99835-0321
    telefonesDestino.add('5583998468997') // 83 99846-8997

    usuarios.forEach(u => {
      const role = String(u.role || '').toLowerCase()
      if (role.includes('admin') || role.includes('financeiro') || role.includes('diretor')) {
        const rawTel = u.tel || u.telefone || u.whatsapp || u.celular || ''
        const clean = String(rawTel).replace(/\D/g, '')
        if (clean.length >= 8) {
          telefonesDestino.add(clean.startsWith('55') ? clean : `55${clean}`)
        }
      }
    })

    let disparosRealizados = 0
    for (const tel of telefonesDestino) {
      try {
        const resp = await enviarMensagemWhatsApp({
          number: tel,
          text: msg,
          instance: 'InstanciaAlpha'
        })
        if (resp && resp.success) {
          disparosRealizados++
        }
      } catch (errSend) {
        console.warn('Erro ao enviar WhatsApp:', tel, errSend)
      }
    }

    // 8. Atualiza marcas de controle no Firestore
    for (const t of tarefasHoje) {
      try {
        await updateDoc(doc(db, 'tarefas', t.id), {
          lembreteHojeEnviado: hojeStr,
          dataUltimoLembrete: new Date().toISOString()
        })
      } catch (e) {}
    }

    for (const m of manutencoesHoje) {
      try {
        await updateDoc(doc(db, 'manutencoes', m.id), {
          notifD0: hojeStr,
          lembreteHojeEnviadoEm: hojeStr
        })
      } catch (e) {}
    }

    // Marca no storage local que hoje já foi processado
    localStorage.setItem(LOCK_DAILY_KEY, hojeStr)

    return {
      success: true,
      dataReferencia: dataFmt,
      tarefasHoje: tarefasHoje.length,
      contasVencendoHoje: contasVencendoHoje.length,
      manutencoesHoje: manutencoesHoje.length,
      disparos: disparosRealizados,
      message: `Lembretes do dia enviados! (${tarefasHoje.length} tarefas, ${contasVencendoHoje.length} contas a pagar, ${manutencoesHoje.length} manutenções para ${disparosRealizados} números).`
    }
  } catch (error) {
    console.error('Erro na rotina de lembretes diários:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Hook React para execução automática silenciosa em segundo plano no carregamento do Layout
 */
export function useDailyAutoReminder() {
  const { user } = useAuth()
  const hasRunRef = useRef(false)

  useEffect(() => {
    if (!user || hasRunRef.current) return
    const role = String(user.role || '').toLowerCase()
    const isMaster = role.includes('admin') || role.includes('financeiro') || role.includes('síndico') || role.includes('sindico')
    if (!isMaster) return

    hasRunRef.current = true

    // Executa em segundo plano após 3 segundos para não atrasar a renderização da interface
    const timer = setTimeout(() => {
      verificarEDispararLembretesDoDia(false).catch(err => {
        console.warn('Lembretes diários em background:', err)
      })
    }, 3000)

    return () => clearTimeout(timer)
  }, [user])
}
