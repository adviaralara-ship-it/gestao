import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

/**
 * Registra um log de auditoria no Firestore
 * @param {Object} user - Usuário logado que realizou a ação
 * @param {string} acao - Tipo de ação (ex: 'CRIOU', 'EDITOU', 'EXCLUIU', 'EMITIU_BOLETO')
 * @param {string} detalhe - Descrição detalhada da ação
 * @param {string} modulo - Módulo do sistema (ex: 'Financeiro', 'Boletos', 'Moradores', 'Condomínios')
 */
export async function registrarLogAuditoria(user, acao, detalhe, modulo = 'Geral') {
  try {
    await addDoc(collection(db, 'auditoria_logs'), {
      usuarioId: user?.uid || 'anonimo',
      usuarioNome: user?.displayName || user?.name || user?.email || 'Administrador',
      usuarioEmail: user?.email || '',
      usuarioRole: user?.role || 'Admin',
      acao,
      detalhe,
      modulo,
      dataHora: new Date().toISOString(),
      timestamp: serverTimestamp()
    })
  } catch (err) {
    console.warn('Falha ao registrar log de auditoria:', err)
  }
}
