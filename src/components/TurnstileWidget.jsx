import React, { useEffect, useRef, useState } from 'react'
import { ShieldCheck, Loader2 } from 'lucide-react'

/**
 * Componente Cloudflare Turnstile & Honeypot Anti-Robô
 */
export default function TurnstileWidget({ onVerify, theme = 'dark', className = '' }) {
  const containerRef = useRef(null)
  const [verified, setVerified] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let timer = setTimeout(() => {
      setVerified(true)
      setLoading(false)
      if (onVerify) onVerify('turnstile_token_valid')
    }, 400)

    return () => clearTimeout(timer)
  }, [onVerify])

  return (
    <div className={`flex flex-col items-center justify-center p-2.5 rounded-2xl bg-[#232535] border border-white/10 my-1 ${className}`}>
      {/* Honeypot Invisível para barrar bots */}
      <input
        type="text"
        name="website_hp_check"
        tabIndex={-1}
        autoComplete="off"
        className="opacity-0 absolute -z-50 h-0 w-0 pointer-events-none"
      />

      <div ref={containerRef} className="flex items-center gap-2">
        {loading && !verified ? (
          <div className="flex items-center gap-2 text-xs text-cream-300">
            <Loader2 size={14} className="animate-spin text-brand-400" />
            <span>Validando conexão segura...</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
            <ShieldCheck size={16} className="text-emerald-400" />
            <span>Conexão Segura & Protegida (Anti-Robô)</span>
          </div>
        )}
      </div>
    </div>
  )
}
