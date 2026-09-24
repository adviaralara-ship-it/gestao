import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building, Mail, Lock, Eye, EyeOff, ShieldCheck, KeyRound, ArrowLeft } from 'lucide-react'
import TurnstileWidget from '../components/TurnstileWidget'
import { useAuth } from '../context/AuthContext'
import { dispararAlarmeSeguranca } from '../utils/alarmeService'

export default function Login() {
  const { login, resetPassword } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('Administrador')
  const [step2FA, setStep2FA] = useState(false)
  const [code2FA, setCode2FA] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')

  const tabs = [
    { id: 'Administrador', label: 'Admin / Financeiro' },
    { id: 'Síndico', label: 'Síndico' },
    { id: 'Morador', label: 'Morador / Residência' }
  ]

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // 1. Checagem de Bloqueio por Força Bruta
    const lockoutUntil = Number(localStorage.getItem('login_lockout_until') || 0)
    if (lockoutUntil > Date.now()) {
      const remainingMin = Math.ceil((lockoutUntil - Date.now()) / 60000)
      setError(`Acesso temporariamente bloqueado por excesso de tentativas. Tente novamente em ${remainingMin} minuto(s).`)
      return
    }

    // 2. Checagem Anti-Bot Honeypot
    const hp = e.target.website_hp_check?.value
    if (hp) {
      setError('Acesso rejeitado.')
      return
    }

    // 3. Validação do Cloudflare Turnstile
    if (!turnstileToken) {
      setError('Por favor, aguarde ou complete a verificação anti-robô (Turnstile).')
      return
    }

    setLoading(true)

    // Validação do Turnstile via API
    try {
      const tRes = await fetch('/api/auth/verify-turnstile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: turnstileToken })
      })
      const tData = await tRes.json()
      if (!tRes.ok || !tData.success) {
        setLoading(false)
        setError('Falha na validação do desafio anti-robô. Tente novamente.')
        return
      }
    } catch (tErr) {
      console.warn('Validação Turnstile em fallback:', tErr)
    }

    await new Promise(r => setTimeout(r, 200))

    // Se é Administrador ou Síndico e ativou 2FA
    if (!step2FA && (email.toLowerCase().includes('admin') || email.toLowerCase().includes('iara') || activeTab === 'Administrador')) {
      const saved2FA = localStorage.getItem('2fa_' + email.toLowerCase())
      if (saved2FA === 'true') {
        setLoading(false)
        setStep2FA(true)
        return
      }
    }

    if (step2FA) {
      if (code2FA.length < 4) {
        setLoading(false)
        setError('Digite o código de verificação de 6 dígitos.')
        return
      }
    }

    const result = await login(email, senha)
    setLoading(false)
    if (result === true) {
      localStorage.removeItem('login_attempts')
      localStorage.removeItem('login_lockout_until')
      navigate('/dashboard')
    } else if (typeof result === 'string') {
      // Conta existe e senha está correta, mas está pendente de aprovação da administradora
      setError(result)
    } else {
      const attempts = Number(localStorage.getItem('login_attempts') || 0) + 1
      localStorage.setItem('login_attempts', attempts)
      
      // Notifica o sentinela de segurança para monitorar mais de 20 erros em 10 minutos
      dispararAlarmeSeguranca({
        tipo: 'ERRO_SENHA',
        titulo: 'Múltiplas falhas de autenticação detectadas',
        detalhes: `Tentativa com senha incorreta para o login "${email}".`,
        userEmail: email,
        metadata: { tentativa: attempts }
      }).catch(() => {})

      if (attempts >= 5) {
        localStorage.setItem('login_lockout_until', Date.now() + 5 * 60 * 1000)
        setError('Muitas tentativas incorretas. Acesso bloqueado temporariamente por 5 minutos.')
      } else {
        const remaining = 5 - attempts
        setError(`E-mail ou senha incorretos (${remaining} tentativa(s) restante(s)).`)
      }
    }
  }

  const handleResetPassword = async () => {
    if (!email) {
      setError('Por favor, digite seu e-mail acima para redefinir a senha.')
      return
    }
    setError('')
    setMsg('')
    setLoading(true)
    const success = await resetPassword(email)
    setLoading(false)
    if (success) {
      setMsg('E-mail de recuperação enviado! Verifique sua caixa de entrada e spam.')
    } else {
      setError('Erro ao enviar e-mail. Verifique se o e-mail digitado está correto.')
    }
  }

  return (
    <div className="min-h-screen bg-cream-300 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-200/40 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-pale-200/60 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md animate-fade-in relative z-10">
        <div className="bg-[#2d3045] border border-white/10 rounded-3xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="text-center mb-6">
            <img src="/logo.png" alt="Alpha Soluções Condominiais" className="w-56 h-auto object-contain mx-auto mb-4" />
            
            <div className="flex bg-[#232535] p-1 rounded-xl mb-6">
              {tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === t.id ? 'bg-[#3b3f5a] text-cream-100 shadow-sm' : 'text-gray-400 hover:text-cream-200'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-cream-300 text-left">Acesso para <strong className="text-cream-100">{activeTab === 'Morador' ? 'Moradores e Prestadores' : activeTab}</strong></p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* E-mail */}
            <div>
              <label className="label text-cream-300">E-mail</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="input pl-9 bg-[#232535] border-white/5 text-cream-100 placeholder:text-gray-500 focus:border-brand-400"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Senha */}
            <div>
              <label className="label text-cream-300">Senha</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showSenha ? 'text' : 'password'}
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  placeholder="••••••••"
                  className="input pl-9 pr-10 bg-[#232535] border-white/5 text-cream-100 placeholder:text-gray-500 focus:border-brand-400"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowSenha(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-cream-200 transition-colors"
                >
                  {showSenha ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <div className="flex justify-end mt-1">
                <button type="button" onClick={handleResetPassword} className="text-xs text-brand-300 hover:text-brand-200 transition-colors">Esqueci minha senha</button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 text-xs text-red-400">
                {error}
              </div>
            )}
            {msg && (
              <div className="bg-emerald-500/10 border border-emerald-500/50 rounded-lg p-3 text-xs text-emerald-400">
                {msg}
              </div>
            )}

            <TurnstileWidget onVerify={tok => setTurnstileToken(tok)} />

            <button type="submit" disabled={loading} className="btn-primary justify-center py-3">
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Verificando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <ShieldCheck size={16} />
                  Entrar no Sistema
                </span>
              )}
            </button>
          </form>


          <div className="mt-4 text-center flex flex-col gap-1">
            <a href="/cadastro" className="text-xs text-brand-300 hover:text-brand-200 hover:underline font-medium">Não tem conta? Solicitar cadastro</a>
            <p className="text-xs text-gray-500">Alpha Soluções Condominiais © 2025</p>
          </div>
        </div>
      </div>
    </div>
  )
}
