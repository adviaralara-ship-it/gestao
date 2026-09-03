import React, { useState, useEffect } from 'react'
import { Download, X, Smartphone, Share2, PlusSquare } from 'lucide-react'

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [showIOSInstructions, setShowIOSInstructions] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // 1. Verifica se já está rodando como PWA instalado (Standalone)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
    if (isStandalone) {
      setInstalled(true)
      return
    }

    // 2. Verifica se o usuário já dispensou nas últimas 24 horas
    const dismissedAt = localStorage.getItem('alpha_pwa_dismissed_time')
    const now = Date.now()
    if (dismissedAt && (now - Number(dismissedAt)) < 24 * 60 * 60 * 1000) {
      return
    }

    // 3. Detecta iOS (iPhone / iPad no Safari)
    const userAgent = window.navigator.userAgent.toLowerCase()
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent)
    const isSafari = /safari/.test(userAgent) && !/chrome|crios|fxios|opr\//.test(userAgent)

    if (isIosDevice && isSafari && !isStandalone) {
      setIsIOS(true)
      const timer = setTimeout(() => {
        setShowPrompt(true)
      }, 2500)
      return () => clearTimeout(timer)
    }

    // 4. Captura o evento nativo do Android / Chrome (beforeinstallprompt)
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setTimeout(() => {
        setShowPrompt(true)
      }, 2000)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    window.addEventListener('appinstalled', () => {
      setInstalled(true)
      setShowPrompt(false)
      setDeferredPrompt(null)
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSInstructions(true)
      return
    }

    if (!deferredPrompt) {
      alert('Para adicionar à tela inicial:\n\n1. Toque nos 3 pontinhos (⋮) do seu navegador.\n2. Escolha "Adicionar à tela inicial" ou "Instalar aplicativo".')
      return
    }

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setInstalled(true)
      setShowPrompt(false)
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    setShowIOSInstructions(false)
    localStorage.setItem('alpha_pwa_dismissed_time', Date.now().toString())
  }

  if (!showPrompt || installed) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4 flex justify-center animate-fade-in pointer-events-none">
      <div className="bg-slate-900 text-white rounded-3xl p-4 sm:p-5 shadow-2xl border-2 border-brand-400/30 max-w-md w-full pointer-events-auto flex flex-col gap-3.5 backdrop-blur-xl bg-slate-900/95">
        
        {/* Cabeçalho */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-brand-600/30 border border-brand-400/40 flex items-center justify-center shrink-0 shadow-inner">
              <img src="/logo-alpha.png" alt="Alpha" className="w-8 h-8 object-contain rounded-lg" onError={(e) => { e.target.style.display = 'none' }} />
            </div>
            <div className="min-w-0">
              <h4 className="font-black text-sm sm:text-base text-white truncate flex items-center gap-1.5">
                Adicionar à Tela Inicial 📲
              </h4>
              <p className="text-[11px] text-gray-300">Acesse boletos, reservas e avisos como um aplicativo!</p>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors shrink-0"
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Instruções para iPhone / iOS */}
        {showIOSInstructions ? (
          <div className="bg-slate-800/90 rounded-2xl p-3 text-xs text-gray-200 flex flex-col gap-2 border border-slate-700">
            <p className="font-bold text-brand-300">Como adicionar no seu iPhone:</p>
            <ol className="space-y-1.5 text-[11px] list-decimal list-inside text-gray-300">
              <li>Toque no botão de <b>Compartilhar</b> <Share2 className="inline w-3.5 h-3.5 text-blue-400" /> na barra inferior do Safari.</li>
              <li>Role para baixo e toque em <b>"Adicionar à Tela de Início"</b> <PlusSquare className="inline w-3.5 h-3.5 text-brand-400" />.</li>
              <li>Toque em <b>Adicionar</b> no canto superior direito.</li>
            </ol>
            <button
              onClick={handleDismiss}
              className="mt-1 w-full py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-bold text-xs transition-all text-center cursor-pointer"
            >
              Entendido, já adicionei! ✓
            </button>
          </div>
        ) : (
          /* Botões de Ação para Android e outros */
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleDismiss}
              className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-gray-300 text-xs font-bold transition-all text-center cursor-pointer"
            >
              Agora não
            </button>
            <button
              onClick={handleInstallClick}
              className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
            >
              <Download size={14} strokeWidth={2.5} />
              {isIOS ? 'Ver como Adicionar' : 'Adicionar ao Celular'}
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
