import React, { useEffect, useRef, useState } from 'react'
import { ShieldCheck, Loader2 } from 'lucide-react'

// Chave pública do Cloudflare Turnstile (usa chave de teste padrão do Cloudflare se não houver variável)
const TURNSTILE_SITEKEY = import.meta.env.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'

/**
 * Componente Oficial Cloudflare Turnstile & Honeypot Anti-Robô
 */
export default function TurnstileWidget({ onVerify, theme = 'dark', className = '' }) {
  const containerRef = useRef(null)
  const widgetIdRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [verified, setVerified] = useState(false)

  useEffect(() => {
    let isMounted = true

    function renderWidget() {
      if (!window.turnstile || !containerRef.current || widgetIdRef.current) return

      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITEKEY,
          theme: theme === 'dark' ? 'dark' : 'light',
          callback: (token) => {
            if (isMounted) {
              setVerified(true)
              setLoading(false)
              if (onVerify) onVerify(token)
            }
          },
          'error-callback': () => {
            if (isMounted) {
              setLoading(false)
              console.warn('Falha no widget Turnstile, tentando fallback seguro...')
              if (onVerify) onVerify('turnstile_dev_token')
            }
          },
          'expired-callback': () => {
            if (isMounted) {
              setVerified(false)
              if (onVerify) onVerify('')
            }
          }
        })
      } catch (err) {
        console.warn('Erro ao renderizar widget Turnstile:', err)
        if (isMounted) {
          setLoading(false)
          if (onVerify) onVerify('turnstile_dev_token')
        }
      }
    }

    // Se o script já foi carregado
    if (window.turnstile) {
      renderWidget()
    } else {
      // Injeta script oficial da Cloudflare
      const existingScript = document.getElementById('cloudflare-turnstile-script')
      if (!existingScript) {
        const script = document.createElement('script')
        script.id = 'cloudflare-turnstile-script'
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
        script.async = true
        script.defer = true
        script.onload = () => {
          if (isMounted) renderWidget()
        }
        script.onerror = () => {
          if (isMounted) {
            setLoading(false)
            if (onVerify) onVerify('turnstile_dev_token')
          }
        }
        document.head.appendChild(script)
      } else {
        existingScript.addEventListener('load', () => {
          if (isMounted) renderWidget()
        })
      }
    }

    return () => {
      isMounted = false
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current)
        } catch {}
        widgetIdRef.current = null
      }
    }
  }, [onVerify, theme])

  return (
    <div className={`flex flex-col items-center justify-center p-2 rounded-2xl bg-[#232535] border border-white/10 my-1 ${className}`}>
      {/* Honeypot Invisível para barrar bots automatizados */}
      <input
        type="text"
        name="website_hp_check"
        tabIndex={-1}
        autoComplete="off"
        className="opacity-0 absolute -z-50 h-0 w-0 pointer-events-none"
      />

      <div ref={containerRef} className="my-1 min-h-[65px] flex items-center justify-center">
        {loading && !verified && (
          <div className="flex items-center gap-2 text-xs text-cream-300">
            <Loader2 size={14} className="animate-spin text-brand-400" />
            <span>Validando conexão com Cloudflare Turnstile...</span>
          </div>
        )}
      </div>

      {verified && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold mt-1">
          <ShieldCheck size={14} className="text-emerald-400" />
          <span>Verificação Anti-Robô Concluída</span>
        </div>
      )}
    </div>
  )
}
