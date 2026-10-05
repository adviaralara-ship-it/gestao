import { useEffect, useRef } from 'react'
import { collection, getDocs, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'

const LOCK_STORAGE_KEY = 'alpha_manu_lembretes_last_check'

// Função centralizada para verificar e disparar lembretes automáticos de manutenção (D-1 e D-0)
export async function verificarEDispararLembretesManutencao(isManual = false) {
  try {
    const hoje = new Date()
    const ano = hoje.getFullYear()
    const mes = String(hoje.getMonth() + 1).padStart(2, '0')
    const dia = String(hoje.getDate()).padStart(2, '0')
    const hojeStr = `${ano}-${mes}-${dia}`
    const hojeDate = new Date(ano, hoje.getMonth(), hoje.getDate())

    // Verificação de intervalo (apenas se for execução automática em background)
    if (!isManual) {
      const lastCheck = Number(localStorage.getItem(LOCK_STORAGE_KEY) || 0)
      const now = Date.now()
      // Não reexecutar automaticamente com menos de 2 horas de intervalo
      if (now - lastCheck < 2 * 60 * 60 * 1000) {
        return { success: true, disparos: 0, ignoradoPorIntervalo: true }
      }
      localStorage.setItem(LOCK_STORAGE_KEY, String(now))
    }

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
      telefonesDestino.add('5583996806325') // 83 99680-6325
      telefonesDestino.add('5583999797285') // 83 99979-7285
      telefonesDestino.add('5583998350321') // 83 99835-0321
      telefonesDestino.add('5583998468997') // 83 99846-8997

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
      const jaEnviouD1 = m.notifD1 === hojeStr || m.lembreteVesperaEnviadoEm === hojeStr
      if (diffDays === 1 && !jaEnviouD1) {
        // 1. Atualiza flag no Firestore ANTES do envio para evitar disparos duplicados em concorrência
        try {
          await updateDoc(doc(db, 'manutencoes', m.id), {
            notifD1: hojeStr,
            lembreteVesperaEnviadoEm: hojeStr
          })
        } catch (errUpd) {
          console.warn('Permissão insuficiente ou falha ao atualizar flag notifD1:', errUpd)
          continue // Se não conseguiu marcar no banco, não dispara o WhatsApp para evitar repetição
        }

        // 2. Grava no Sininho
        try {
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
        } catch(e) {}

        // 3. Mensagem de WhatsApp D-1
        const tipoLabel = m.tipo || 'Manutenção Preventiva'
        const msgWhats = `⚠️ *LEMBRETE - ${tipoLabel.toUpperCase()} AMANHÃ!*\n\n🏢 *Condomínio:* ${m.condominio || 'Todos / Geral'}\n🛠️ *Serviço:* ${m.titulo}\n📅 *Data Prevista:* Amanhã (${dataFmt})\n👷 *Prestador / Empresa:* ${m.fornecedor || 'A definir'}\n💰 *Custo Previsto:* R$ ${custoFmt}\n📌 *Status:* ${m.status || 'Agendada'}${m.descricao ? `\n📝 *Observações:* ${m.descricao}` : ''}\n\n🔔 *Lembrete automático enviado 1 dia antes pela Alpha Gestão.*\n🔗 *Acesse o painel:* https://alpha-solucoes-condominiais.vercel.app/manutencoes`

        for (const numero of telefonesDestino) {
          try {
            fetch('/api/whatsapp-send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ number: numero, text: msgWhats, instance: 'InstanciaAlpha' })
            }).catch(e => console.warn('Erro envio WhatsApp lembrete D-1:', e))
          } catch(e) {}
        }

        disparosRealizados++
      }

      // CASO 2: Lembrete do Dia (Hoje / D-0)
      const jaEnviouD0 = m.notifD0 === hojeStr || m.lembreteHojeEnviadoEm === hojeStr
      if (diffDays === 0 && !jaEnviouD0) {
        // 1. Atualiza flag no Firestore ANTES do envio para evitar disparos duplicados em concorrência
        try {
          await updateDoc(doc(db, 'manutencoes', m.id), {
            notifD0: hojeStr,
            lembreteHojeEnviadoEm: hojeStr
          })
        } catch (errUpd) {
          console.warn('Permissão insuficiente ou falha ao atualizar flag notifD0:', errUpd)
          continue // Se não conseguiu marcar no banco, não dispara o WhatsApp
        }

        // 2. Grava no Sininho
        try {
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
        } catch(e) {}

        // 3. Mensagem de WhatsApp D-0
        const tipoLabel = m.tipo || 'Manutenção Preventiva'
        const msgWhats = `🚨 *ATENÇÃO - ${tipoLabel.toUpperCase()} HOJE!*\n\n🏢 *Condomínio:* ${m.condominio || 'Todos / Geral'}\n🛠️ *Serviço:* ${m.titulo}\n📅 *Data:* HOJE (${dataFmt})\n👷 *Prestador / Empresa:* ${m.fornecedor || 'A definir'}\n💰 *Custo Previsto:* R$ ${custoFmt}\n📌 *Status:* ${m.status || 'Agendada'}${m.descricao ? `\n📝 *Observações:* ${m.descricao}` : ''}\n\n🔔 *Lembrete automático da Alpha Gestão. Favor acompanhar a execução do serviço.*\n🔗 *Acesse o painel:* https://alpha-solucoes-condominiais.vercel.app/manutencoes`

        for (const numero of telefonesDestino) {
          try {
            fetch('/api/whatsapp-send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ number: numero, text: msgWhats, instance: 'InstanciaAlpha' })
            }).catch(e => console.warn('Erro envio WhatsApp lembrete D-0:', e))
          } catch(e) {}
        }

        disparosRealizados++
      }
    }

    return { success: true, disparos: disparosRealizados }
  } catch (error) {
    console.error('Erro ao verificar lembretes automáticos de manutenção:', error)
    return { success: false, error: error.message }
  }
}

// Hook React para manter verificação automática ativa em background no Layout apenas para Administradores
export function useMaintenanceAutoReminder() {
  const { user } = useAuth()
  const hasRun = useRef(false)

  useEffect(() => {
    // Executa apenas se o usuário for Administrador ou Financeiro
    if (!user || (user.role !== 'Administrador' && user.role !== 'Financeiro')) {
      return
    }

    if (!hasRun.current) {
      hasRun.current = true
      // Espera 3 segundos após o carregamento para não travar a inicialização
      const t = setTimeout(() => {
        verificarEDispararLembretesManutencao(false)
      }, 3000)
      return () => clearTimeout(t)
    }
  }, [user])
}
