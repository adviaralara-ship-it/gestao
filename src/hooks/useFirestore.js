import { useState, useEffect } from 'react'
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { encryptData, decryptData } from '../utils/crypto'
import { dispararAlarmeSeguranca } from '../utils/alarmeService'

const requestLocks = {} // Para Throttling local (Antiscraping)
const SENSITIVE_FIELDS = ['cpf', 'documento', 'rg']

const processOutgoingData = (data) => {
  const result = { ...data }
  for (const field of SENSITIVE_FIELDS) {
    if (result[field]) result[field] = encryptData(result[field])
  }
  return result
}

const processIncomingData = (data) => {
  const result = { ...data }
  for (const field of SENSITIVE_FIELDS) {
    if (result[field]) result[field] = decryptData(result[field])
  }
  return result
}

// ─── Toast global de erro (visível para o usuário) ─────────────────
function showToast(msg, type = 'error') {
  const el = document.createElement('div')
  el.textContent = msg
  el.style.cssText = `
    position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
    background:${type === 'error' ? '#dc2626' : '#16a34a'};
    color:white; padding:12px 20px; border-radius:12px; font-size:13px;
    font-weight:600; z-index:99999; box-shadow:0 4px 20px rgba(0,0,0,0.2);
    max-width:90vw; text-align:center; pointer-events:none;
    animation: fadein 0.3s ease;
  `
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 4000)
}

/**
 * useFirestore — hook universal para ler e escrever em uma coleção do Firestore.
 * Todos os dados são sincronizados em tempo real entre dispositivos.
 */
export function useFirestore(colName) {
  const { user } = useAuth() || {}
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    const unsub = onSnapshot(
      collection(db, colName),
      (snap) => {
        let docs = snap.docs.map(d => processIncomingData({ ...d.data(), id: d.id }))
        
        // Aplica o filtro de multi-tenancy (separa os dados por condomínio)
        if (user && user.role !== 'Administrador' && user.condominio) {
          docs = docs.filter(d => {
            // Se for a coleção de condomínios, o campo a verificar é "nome"
            if (colName === 'condominios') return d.nome === user.condominio;
            // Para notificações e outras globais sem vínculo, podemos exibir para todos,
            // mas o ideal é que notificações também tivessem condomínio. Por ora, exibe as que são do condomínio ou globais (sem condomínio definido).
            return !d.condominio || d.condominio === user.condominio;
          })
        }

        docs.sort((a, b) => {
          const ta = a._createdAt?.seconds ?? 0
          const tb = b._createdAt?.seconds ?? 0
          return ta - tb
        })

        // ALARME: Consulta ou leitura massiva (> 500 registros de uma vez)
        if (docs.length >= 500) {
          const lastReportKey = `last_alarm_read_${colName}`
          const lastReport = Number(sessionStorage.getItem(lastReportKey) || 0)
          // Notifica no máximo a cada 10 minutos por coleção para não sobrecarregar
          if (Date.now() - lastReport > 10 * 60 * 1000) {
            sessionStorage.setItem(lastReportKey, Date.now())
            dispararAlarmeSeguranca({
              tipo: 'CONSULTA_MASSIVA',
              titulo: 'Consulta / Exportação Massiva de Dados (> 500 registros)',
              detalhes: `O usuário "${user?.nome || 'Anônimo'}" (${user?.email || 'N/A'}) consultou ou carregou ${docs.length} registros da coleção "${colName}".`,
              userEmail: user?.email,
              metadata: {
                colecao: colName,
                quantidade: docs.length,
                usuario: user?.nome,
                perfil: user?.role
              }
            }).catch(() => {})
          }
        }

        setItems(docs)
        setLoading(false)
        setError(null)
      },
      (err) => {
        console.error(`[Firestore] Erro ao ler "${colName}":`, err)
        setLoading(false)
        setError(err.message)
        if (err.code === 'permission-denied') {
          showToast('⚠️ Permissão negada no banco de dados. Verifique as regras do Firestore.', 'error')
        } else if (err.code === 'unavailable') {
          showToast('📡 Sem conexão com o banco de dados. Verifique sua internet.', 'error')
        } else {
          showToast(`❌ Erro ao carregar "${colName}": ${err.message}`, 'error')
        }
      }
    )

    return unsub
  }, [colName])

  const logAudit = async (action, docId = null) => {
    if (!['moradores', 'usuarios'].includes(colName)) return
    try {
      await addDoc(collection(db, 'auditoria'), {
        colName,
        action,
        docId,
        userEmail: user?.email || 'Desconhecido',
        userName: user?.nome || 'Desconhecido',
        timestamp: serverTimestamp()
      })
    } catch (e) {
      console.warn('[Auditoria] Falha ao registrar log:', e)
    }
  }

  const checkThrottle = (skip = false) => {
    // Disabled aggressive throttling to prevent user errors
  }

const cleanFirestorePayload = (obj) => {
  if (!obj || typeof obj !== 'object') return obj
  const res = Array.isArray(obj) ? [] : {}
  for (const key of Object.keys(obj)) {
    const val = obj[key]
    if (val === undefined) continue
    // Se for string base64 maior que 200KB, não salva no doc Firestore para não estourar o limite rígido de 1MB
    if (typeof val === 'string' && val.startsWith('data:') && val.length > 200000) {
      console.warn(`[Firestore] Campo "${key}" com Base64 muito grande (${val.length} bytes) ignorado para evitar estouro de 1MB.`)
      continue
    }
    if (val && typeof val === 'object' && !(val instanceof Date) && typeof val.toDate !== 'function' && !val._seconds) {
      res[key] = cleanFirestorePayload(val)
    } else {
      res[key] = val
    }
  }
  return res
}

  const addItem = async (data, skipThrottle = false) => {
    try {
      checkThrottle(skipThrottle)
      const { id: _ignore, ...clean } = data
      const sanitized = cleanFirestorePayload(processOutgoingData(clean))
      const docRef = await addDoc(collection(db, colName), {
        ...sanitized,
        _createdAt: serverTimestamp()
      })
      await logAudit('CREATE', docRef.id)
      return docRef
    } catch (err) {
      console.error(`[Firestore] Erro ao adicionar em "${colName}":`, err)
      if (err.code === 'permission-denied') {
        showToast('⚠️ Sem permissão para salvar. Verifique as regras do Firebase.', 'error')
      } else {
        showToast(`❌ Erro ao salvar: ${err.message}`, 'error')
      }
      throw err
    }
  }

  const updateItem = async (id, data, skipThrottle = false) => {
    try {
      checkThrottle(skipThrottle)
      const { id: _ignore, _createdAt: _ts, ...clean } = data
      const sanitized = cleanFirestorePayload(processOutgoingData(clean))
      await updateDoc(doc(db, colName, id), sanitized)
      await logAudit('UPDATE', id)
    } catch (err) {
      console.error(`[Firestore] Erro ao atualizar "${colName}/${id}":`, err)
      showToast(`❌ Erro ao atualizar: ${err.message}`, 'error')
      throw err
    }
  }

  const deleteItem = async (id, skipThrottle = false) => {
    try {
      checkThrottle(skipThrottle)
      await deleteDoc(doc(db, colName, id))
      await logAudit('DELETE', id)

      // ALARME: Rastreio de Apagamento em Massa
      // Monitora se mais de 10 exclusões ocorreram nos últimos 5 minutos
      const delHistory = JSON.parse(sessionStorage.getItem('delete_history') || '[]')
      const fiveMinAgo = Date.now() - 5 * 60 * 1000
      const recentDels = delHistory.filter(ts => ts > fiveMinAgo)
      recentDels.push(Date.now())
      sessionStorage.setItem('delete_history', JSON.stringify(recentDels))

      if (recentDels.length >= 10) {
        const lastDelAlarm = Number(sessionStorage.getItem('last_alarm_mass_del') || 0)
        if (Date.now() - lastDelAlarm > 5 * 60 * 1000) {
          sessionStorage.setItem('last_alarm_mass_del', Date.now())
          dispararAlarmeSeguranca({
            tipo: 'APAGAMENTO_MASSA',
            titulo: 'Apagamento em Massa Detectado',
            detalhes: `Detectado apagamento sequencial de ${recentDels.length} registros na coleção "${colName}" pelo usuário "${user?.nome || 'Anônimo'}" (${user?.email || 'N/A'}).`,
            userEmail: user?.email,
            metadata: {
              colecao: colName,
              quantidade: recentDels.length,
              usuario: user?.nome,
              perfil: user?.role
            }
          }).catch(() => {})
        }
      }
    } catch (err) {
      console.error(`[Firestore] Erro ao excluir "${colName}/${id}":`, err)
      if (err.code === 'permission-denied') {
        showToast('⚠️ Sem permissão para excluir. Verifique as regras do Firebase.', 'error')
      } else {
        showToast(`❌ Erro ao excluir: ${err.message}`, 'error')
      }
      throw err
    }
  }

  return { items, loading, error, addItem, updateItem, deleteItem }
}
