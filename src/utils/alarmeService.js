// src/utils/alarmeService.js
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { enviarEmail } from '../emailjs.config'

const loginFailures = []

/**
 * Dispara alarme de segurança registrando no Firestore e despachando e-mail de alerta
 */
export async function dispararAlarmeSeguranca({ tipo, titulo, detalhes, metadata = {}, userEmail = '' }) {
  try {
    let dispararAlerta = true

    // 1. Regra: Mais de 20 erros de senha em 10 minutos
    if (tipo === 'ERRO_SENHA') {
      const agora = Date.now()
      const dezMinutosAtras = agora - 10 * 60 * 1000

      while (loginFailures.length > 0 && loginFailures[0].timestamp < dezMinutosAtras) {
        loginFailures.shift()
      }

      loginFailures.push({
        email: (userEmail || 'desconhecido').toLowerCase().trim(),
        timestamp: agora
      })

      const totalRecente = loginFailures.length
      const totalMesmoUsuario = loginFailures.filter(f => f.email === (userEmail || '').toLowerCase().trim()).length

      if (totalRecente >= 20 || totalMesmoUsuario >= 20) {
        dispararAlerta = true
      } else {
        dispararAlerta = false
      }
    }

    if (!dispararAlerta) return { disparado: false }

    const registro = {
      tipo: tipo || 'COMPORTAMENTO_ESTRANHO',
      titulo: titulo || 'Alerta de Segurança',
      detalhes: detalhes || 'Atividade anômala detectada no sistema.',
      metadata: {
        ...metadata,
        usuario: userEmail || metadata.usuario || 'Não informado',
      },
      timestamp: new Date().toISOString(),
      lido: false,
      status: 'Crítico',
      _createdAt: serverTimestamp()
    }

    // Salva no Firestore na coleção de alarmes
    await addDoc(collection(db, 'alarmes_seguranca'), registro)

    // Envia e-mail de alerta detalhado
    const corpoEmail = `
      <h3>🚨 ${registro.titulo}</h3>
      <p><b>Tipo de Alerta:</b> ${registro.tipo}</p>
      <p><b>Data e Hora:</b> ${new Date().toLocaleString('pt-BR')}</p>
      <p><b>Detalhes:</b> ${registro.detalhes}</p>
      <p><b>Usuário envolvido:</b> ${registro.metadata.usuario}</p>
      ${registro.metadata.colecao ? `<p><b>Coleção:</b> ${registro.metadata.colecao}</p>` : ''}
      ${registro.metadata.quantidade ? `<p><b>Quantidade afetada:</b> ${registro.metadata.quantidade}</p>` : ''}
    `

    await enviarEmail(
      'alphaadmsc@gmail.com',
      'Administrador Alpha',
      `[ALARME CRÍTICO] ${registro.titulo}`,
      corpoEmail
    ).catch(() => {})

    return { disparado: true }
  } catch (err) {
    console.warn('[Alarme] Falha ao registrar alerta:', err)
    return { disparado: false, error: err.message }
  }
}
