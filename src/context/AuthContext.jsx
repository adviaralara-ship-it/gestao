import React, { createContext, useContext, useState, useEffect } from 'react'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth'
import { collection, doc, getDoc, getDocs, query, setDoc, where, updateDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'

const AuthContext = createContext(null)

// ─── Permissões por role ───────────────────────────────────────────────────
export const allModulesPerms = ['dashboard','whatsapp','email','condominios','moradores','rh','prestadores','usuarios','financeiro','boletos','notas-fiscais','assembleias','ocorrencias','reservas','eventos','portaria','veiculos','cameras','calculadora','encomendas','visitantes','enquetes','classificados','seguro','regime','documentos','comunicacao','tarefas','relatorios','propostas']
export const sindicoPerms    = ['dashboard','moradores','notas-fiscais','ocorrencias','portaria','regime','comunicacao','boletos','assembleias','reservas','eventos','seguro','documentos','relatorios','visitantes','encomendas']
export const financeiroPerms = ['dashboard','financeiro','boletos','notas-fiscais','prestadores','documentos']
export const porteiroPerms   = ['dashboard','moradores','prestadores','notas-fiscais','ocorrencias','portaria','regime','comunicacao','usuarios','assembleias','reservas','eventos','seguro','documentos','visitantes','encomendas']
export const moradorPerms    = ['dashboard','moradores','notas-fiscais','ocorrencias','regime','comunicacao','boletos','assembleias','reservas','eventos','seguro','documentos','portaria','visitantes','encomendas']

// ─── Perfis de usuários master (dados de perfil, SEM senha) ───────────────
// As senhas ficam APENAS no Firebase Authentication (servidor do Google, criptografadas)
const MASTER_PROFILES = {
  'admin@alpha.com.br':        { id: '1', nome: 'Admin Master',     role: 'Administrador', permissoes: allModulesPerms, condominio: '' },
  'master@alpha.com.br':       { id: '8', nome: 'Acesso Master',    role: 'Administrador', permissoes: allModulesPerms, condominio: '' },
  'iaralara1812@gmail.com':    { id: '2', nome: 'Iara Lara',        role: 'Administrador', permissoes: allModulesPerms, condominio: '' },
  'adviaralara@gmail.com':     { id: '7', nome: 'Iara Lara',        role: 'Administrador', permissoes: allModulesPerms, condominio: '' },
  'roberto@jardins.com.br':    { id: '3', nome: 'Roberto Souza',    role: 'Síndico',       permissoes: sindicoPerms, condominio: 'Jardins' },
  'ana@primavera.com.br':      { id: '4', nome: 'Ana Lima',         role: 'Síndico',       permissoes: sindicoPerms, condominio: 'Primavera' },
  'financeiro@alpha.com.br':   { id: '5', nome: 'Paulo Financeiro', role: 'Financeiro',    permissoes: financeiroPerms, condominio: '' },
  'portaria@jardins.com.br':   { id: '6', nome: 'João Porteiro',    role: 'Porteiro',      permissoes: porteiroPerms, condominio: 'Jardins' },
}

// ─── Senhas padrão para MIGRAÇÃO AUTOMÁTICA (primeira vez) ────────────────
// Após a migração, este objeto pode ser removido com segurança.
// As senhas originais são mantidas aqui SOMENTE para auto-criar contas no Firebase Auth.
const MIGRATION_PASSWORDS = {
  'admin@alpha.com.br':      'admin123',
  'master@alpha.com.br':     'alpha123',
  'iaralara1812@gmail.com':  'Clark1812@',
  'adviaralara@gmail.com':   'admin123',
  'roberto@jardins.com.br':  'sindico123',
  'ana@primavera.com.br':    'sindico456',
  'financeiro@alpha.com.br': 'fin123',
  'portaria@jardins.com.br': 'port123',
}

// Busca perfil do usuário no Firestore ou nos MASTER_PROFILES
async function fetchUserProfile(firebaseUser) {
  const emailLower = firebaseUser.email.toLowerCase()

  // 1. Verificar se é um usuário master
  if (MASTER_PROFILES[emailLower]) {
    return { ...MASTER_PROFILES[emailLower], email: emailLower }
  }

  // 2. Buscar no Firestore (usuários dinâmicos aprovados)
  try {
    // Tenta por UID primeiro (mais eficiente)
    const docRef = doc(db, 'usuarios', firebaseUser.uid)
    const snap = await getDoc(docRef)
    if (snap.exists()) {
      const data = snap.data()
      if (data.ativo === false) return null // conta pendente de aprovação
        let userPerms = data.permissoes || moradorPerms
        if (data.role === 'Administrador') {
          userPerms = allModulesPerms
        } else {
          // Garante que permissões novas sejam adicionadas aos antigos usuários
          const ensure = (p) => { if (!userPerms.includes(p)) userPerms.push(p) }
          ensure('dashboard') // Todos precisam do dashboard (tela mobile)
          if (data.role === 'Administrador' || data.role === 'Síndico') ensure('email')
          if (data.role === 'Síndico') {
            ensure('relatorios'); ensure('visitantes'); ensure('encomendas'); ensure('portaria'); ensure('eventos');
          } else if (data.role === 'Morador') {
            ensure('portaria'); ensure('visitantes'); ensure('encomendas'); ensure('eventos');
          } else if (data.role === 'Porteiro') {
            ensure('visitantes'); ensure('encomendas'); ensure('eventos');
          }
        }

        return {
          id: snap.id,
          nome: data.nome,
          email: data.email,
          role: data.role || 'Morador',
          permissoes: userPerms,
          condominio: data.condominio || '',
          bloco: data.bloco || '',
          unidade: data.unidade || '',
        }
    }

    // Fallback: busca por email
    const q = query(collection(db, 'usuarios'), where('email', '==', emailLower), where('ativo', '==', true))
    const qSnap = await getDocs(q)
    if (!qSnap.empty) {
      const d = qSnap.docs[0]
      const data = d.data()
      let userPerms = data.permissoes || moradorPerms
      if (data.role === 'Administrador') {
        userPerms = allModulesPerms
      } else {
        const ensure = (p) => { if (!userPerms.includes(p)) userPerms.push(p) }
        ensure('dashboard') // Todos precisam do dashboard (tela mobile)
        if (data.role === 'Administrador' || data.role === 'Síndico') ensure('email')
        if (data.role === 'Síndico') {
          ensure('relatorios'); ensure('visitantes'); ensure('encomendas'); ensure('portaria'); ensure('eventos');
        } else if (data.role === 'Morador') {
          ensure('portaria'); ensure('visitantes'); ensure('encomendas'); ensure('eventos');
        } else if (data.role === 'Porteiro') {
          ensure('visitantes'); ensure('encomendas'); ensure('eventos');
        }
      }

      return {
        id: d.id,
        nome: data.nome,
        email: data.email,
        role: data.role || 'Morador',
        permissoes: userPerms,
        condominio: data.condominio || '',
        bloco: data.bloco || '',
        unidade: data.unidade || '',
      }
    }
  } catch (e) {
    console.warn('Firestore lookup failed:', e)
  }

  return null
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined) // undefined = carregando, null = deslogado
  const [authLoading, setAuthLoading] = useState(true)

  // Observa estado do Firebase Auth (token JWT real do Google)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const profile = await fetchUserProfile(firebaseUser)
          setUser(profile) // null se conta ainda não aprovada
          if (profile?.id) {
            window.OneSignalDeferred = window.OneSignalDeferred || [];
            window.OneSignalDeferred.push(function(OneSignal) {
              OneSignal.login(profile.email).catch(e => console.warn('OneSignal login error', e));
            });
          }
        } else {
          setUser(null)
          window.OneSignalDeferred = window.OneSignalDeferred || [];
          window.OneSignalDeferred.push(function(OneSignal) {
            if (OneSignal.User) {
              OneSignal.logout().catch(e => console.warn('OneSignal logout error', e));
            }
          });
        }
      } catch (err) {
        console.error("Auth context error:", err)
      } finally {
        setAuthLoading(false)
      }
    })
    return unsubscribe
  }, [])

  const login = async (email, senha) => {
    const emailLower = email.toLowerCase().trim()

    try {
      // Tenta login normal no Firebase Auth
      const credential = await signInWithEmailAndPassword(auth, emailLower, senha)
      // Busca perfil imediatamente para evitar race condition na navegação
      const profile = await fetchUserProfile(credential.user)
      if (profile) {
        setUser(profile)
        return true
      } else {
        await signOut(auth)
        return 'Sua conta ainda está pendente de aprovação pelo administrador.'
      }
    } catch (err) {
      // Se falhou no login E é um usuário master com senha correta → migração automática
      if (
        err.code?.startsWith('auth/') &&
        MASTER_PROFILES[emailLower] &&
        MIGRATION_PASSWORDS[emailLower] === senha
      ) {
        try {
          const credential = await createUserWithEmailAndPassword(auth, emailLower, senha)
          console.info(`[Alpha] Conta migrada para Firebase Auth: ${emailLower}`)
          const profile = await fetchUserProfile(credential.user)
          if (profile) {
            setUser(profile)
            return true
          }
        } catch (createErr) {
          console.error('Falha na migração:', createErr.code, createErr.message)
        }
      }

      // Migração de usuários criados/editados pelo painel (onde a senha fica salva no Firestore)
      if (err.code?.startsWith('auth/')) {
        try {
          const q = query(collection(db, 'usuarios'), where('email', '==', emailLower), where('ativo', '==', true))
          const qSnap = await getDocs(q)
          if (!qSnap.empty) {
            const docSnap = qSnap.docs[0]
            const docData = docSnap.data()
            if (docData.senha && docData.senha === senha) {
              // Senha confere! Criar no Firebase Auth
              const credential = await createUserWithEmailAndPassword(auth, emailLower, senha)
              // Apagar a senha em texto claro por segurança
              await updateDoc(docSnap.ref, { senha: '' })
              
              const profile = await fetchUserProfile(credential.user)
              if (profile) {
                setUser(profile)
                return true
              }
            }
          } else {
            // Verifica se a conta existe mas está inativa
            const qInativo = query(collection(db, 'usuarios'), where('email', '==', emailLower), where('ativo', '==', false))
            const qInativoSnap = await getDocs(qInativo)
            if (!qInativoSnap.empty) {
              return 'Sua conta ainda está pendente de aprovação pelo administrador.'
            }
          }
        } catch (migrationErr) {
          console.warn('Erro na migração do Firestore:', migrationErr)
        }
      }

      return false
    }
  }

  const logout = async () => {
    await signOut(auth)
    setUser(null)
  }

  const resetPassword = async (email) => {
    const { sendPasswordResetEmail } = await import('firebase/auth')
    try {
      await sendPasswordResetEmail(auth, email.toLowerCase().trim())
      return true
    } catch (err) {
      console.error(err)
      return false
    }
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, resetPassword, authLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

// ─── Helpers retrocompatíveis para o módulo Usuários ────────────────────────
// Não armazenam mais senhas — apenas dados de perfil
export const getUsers = () => {
  try {
    const extra = JSON.parse(localStorage.getItem('alpha_extra_users') || '[]')
    const masterEmails = new Set(Object.keys(MASTER_PROFILES))
    // Retorna perfis master + usuários extras (sem campo senha)
    const masterList = Object.values(MASTER_PROFILES)
    const extraClean = extra
      .filter(u => !masterEmails.has(u.email?.toLowerCase()))
      .map(({ senha, ...rest }) => rest) // remove campo senha se existir
    return [...masterList, ...extraClean]
  } catch {
    return Object.values(MASTER_PROFILES)
  }
}

export const saveUsers = (users) => {
  const masterEmails = new Set(Object.keys(MASTER_PROFILES))
  // Salva apenas não-masters e NUNCA salva o campo senha
  const extra = users
    .filter(u => !masterEmails.has(u.email?.toLowerCase()))
    .map(({ senha, ...rest }) => rest)
  localStorage.setItem('alpha_extra_users', JSON.stringify(extra))
}
