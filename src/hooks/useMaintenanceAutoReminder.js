import { useEffect, useRef } from 'react'
import { collection, getDocs, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

// Função centralizada para verificar e disparar lembretes automáticos de manutenção (D-1 e D-0)
export async function verificarEDispararLembretesManutencao() {
  try {
    const hoje = new Date()
    const ano = hoje.getFullYear()
    const mes = String(hoje.getMonth() + 1).padStart(2, '0')
    const dia = String(hoje.getDate()).padStart(2, '0')
    const hojeStr = `${ano}-${mes}-${dia}`
    const hojeDate = new Date(ano, hoje.getMonth(), hoje.getDate())

    // 1. Busca manutenções e usuários do Firestore
    const [manutencoesSnap, usuariosSnap] = await Promise.all([
      getDocs(collection(db, 'manutencoes')),
      getDocs(collection(db, 'usuarios'))
    ])

    const manutencoes = manutencoesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    const usuarios = usuariosSnap.docs.map(d => ({ id: d.id, ...d.data() }))

    let disparosRealizados = 0

    for (const m of manutencoes) {
      if (!m.dataPrevista || m.status === 'Concluída') continue

      // Calcula diferença em dias (prevista - hoje)
      const partes = m.dataPrevista.split('-')
      if (partes.length !== 3) continue
      const prevDate = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]))
      const diffTime = prevDate.getTime() - hojeDate.getTime()
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

      const dataFmt = `${partes[2]}/${partes[1]}/${partes[0]}`
      const custoFmt = m.custoEstimado ? Number(m.custoEstimado).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'

      // Lista de telefones destinatários para esta manutenção
      const telefonesDestino = new Set()
      telefonesDestino.add('558396885931') // WhatsApp oficial Alpha Gestão

      usuarios.forEach(u => {
        const isAdm = u.role === 'Administrador' || u.role === 'Financeiro'
        const isSindicoDesteCondo = u.role === 'Síndico' && (!m.condominio || u.condominio === m.condominio)
        if (isAdm || isSindicoDesteCondo) {
          const rawTel = u.tel || u.telefone || u.whatsapp || u.celular || ''
          const cleanTel = String(rawTel).replace(/\D/g, '')
          if (cleanTel.length >= 8) {
            telefonesDestino.add(cleanTel.length <= 11 ? `55${cleanTel}` : cleanTel)
          }
        }
      })

      // CASO 1: Lembrete de Véspera (1 dia antes / D-1)
      if (diffDays === 1 && m.notifD1 !== hojeStr) {
        // Grava no Sininho
        await addDoc(collection(db, 'notificacoes'), {
          text: `⚠️ LEMBRETE DE VÉSPERA: Manutenção "${m.titulo}" agendada para AMANHÃ (${dataFmt}) no ${m.condominio || 'Condomínio'}.`,
          titulo: `⚠️ Lembrete Amanhã: ${m.titulo}`,
          time: new Date().toISOString(),
          tipo: 'manutencao_vespera',
          condominio: m.condominio || 'Todos',
          lida: false,
          link: '/manutencoes',
          _createdAt: serverTimestamp()
        })

        // Mensagem de WhatsApp D-1
        const msgWhats = `⚠️ *LEMBRETE PREVENTIVO - MANUTENÇÃO AMANHÃ!*\n\n🏢 *Condomínio:* ${m.condominio || 'Todos / Geral'}\n🛠️ *Serviço:* ${m.titulo}\n📅 *Data Prevista:* Amanhã (${dataFmt})\n👷 *Prestador / Empresa:* ${m.fornecedor || 'A definir'}\n💰 *Custo Previsto:* R$ ${custoFmt}\n📌 *Status:* ${m.status || 'Agendada'}${m.descricao ? `\n📝 *Observações:* ${m.descricao}` : ''}\n\n🔔 *Lembrete automático enviado 1 dia antes pela Alpha Gestão.*\n🔗 *Acesse o painel:* https://alpha-solucoes-condominiais.vercel.app/manutencoes`

        for (const numero of telefonesDestino) {
          try {
            fetch('/api/whatsapp-send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ number: numero, text: msgWhats, instance: 'InstanciaAlpha' })
            }).catch(e => console.warn('Erro envio WhatsApp lembrete D-1:', e))
          } catch(e) {}
        }

        // Atualiza flag no Firestore para não reenviar no mesmo dia
        await updateDoc(doc(db, 'manutencoes', m.id), {
          notifD1: hojeStr,
          lembreteVesperaEnviadoEm: hojeStr
        })

        disparosRealizados++
      }

      // CASO 2: Lembrete do Dia (Hoje / D-0)
      if (diffDays === 0 && m.notifD0 !== hojeStr) {
        // Grava no Sininho
        await addDoc(collection(db, 'notificacoes'), {
          text: `🚨 MANUTENÇÃO HOJE: "${m.titulo}" está programada para execução HOJE (${dataFmt}) no ${m.condominio || 'Condomínio'}.`,
          titulo: `🚨 Manutenção Hoje: ${m.titulo}`,
          time: new Date().toISOString(),
          tipo: 'manutencao_hoje',
          condominio: m.condominio || 'Todos',
          lida: false,
          link: '/manutencoes',
          _createdAt: serverTimestamp()
        })

        // Mensagem de WhatsApp D-0
        const msgWhats = `🚨 *ATENÇÃO - MANUTENÇÃO PROGRAMADA PARA HOJE!*\n\n🏢 *Condomínio:* ${m.condominio || 'Todos / Geral'}\n🛠️ *Serviço:* ${m.titulo}\n📅 *Data:* HOJE (${dataFmt})\n👷 *Prestador / Empresa:* ${m.fornecedor || 'A definir'}\n💰 *Custo Previsto:* R$ ${custoFmt}\n📌 *Status:* ${m.status || 'Agendada'}${m.descricao ? `\n📝 *Observações:* ${m.descricao}` : ''}\n\n🔔 *Lembrete automático da Alpha Gestão. Favor acompanhar a execução do serviço.*\n🔗 *Acesse o painel:* https://alpha-solucoes-condominiais.vercel.app/manutencoes`

        for (const numero of telefonesDestino) {
          try {
            fetch('/api/whatsapp-send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ number: numero, text: msgWhats, instance: 'InstanciaAlpha' })
            }).catch(e => console.warn('Erro envio WhatsApp lembrete D-0:', e))
          } catch(e) {}
        }

        // Atualiza flag no Firestore para não reenviar no mesmo dia
        await updateDoc(doc(db, 'manutencoes', m.id), {
          notifD0: hojeStr,
          lembreteHojeEnviadoEm: hojeStr
        })

        disparosRealizados++
      }
    }

    return { success: true, disparos: disparosRealizados }
  } catch (error) {
    console.error('Erro ao verificar lembretes automáticos de manutenção:', error)
    return { success: false, error: error.message }
  }
}

// Hook React para manter verificação automática ativa em background no Layout
export function useMaintenanceAutoReminder() {
  const hasRun = useRef(false)

  useEffect(() => {
    // Executa uma vez ao carregar a aplicação
    if (!hasRun.current) {
      hasRun.current = true
      verificarEDispararLembretesManutencao()
    }

    // Intervalo de verificação a cada 30 minutos em background
    const timer = setInterval(() => {
      verificarEDispararLembretesManutencao()
    }, 30 * 60 * 1000)

    return () => clearInterval(timer)
  }, [])
}
