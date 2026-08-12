import React, { useEffect, useState } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { CheckCircle, XCircle } from 'lucide-react'
import { db } from '../firebase'
import { doc, getDoc, updateDoc } from 'firebase/firestore'

export default function Totem() {
  const [scanResult, setScanResult] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const scanner = new Html5QrcodeScanner('reader', {
      qrbox: { width: 250, height: 250 },
      fps: 5,
    })

    scanner.render(success, error)

    async function success(result) {
      scanner.pause()
      setLoading(true)

      try {
        let docId = result
        if (result.includes('/valida/')) {
          docId = result.split('/valida/')[1]
        }
        
        const vRef = doc(db, 'visitantes', docId)
        const vSnap = await getDoc(vRef)
        
        if (vSnap.exists()) {
          const dados = vSnap.data()
          if (dados.status === 'Autorizado' || dados.status === 'Pendente') {
            await updateDoc(vRef, { status: 'Acessou', dataAcesso: new Date().toISOString() })
            setScanResult({ type: 'success', msg: \Acesso Liberado! Bem-vindo(a), \\ })
          } else {
            setScanResult({ type: 'error', msg: \Status inválido ou já acessou.\ })
          }
        } else {
          const cRef = doc(db, 'convidados', docId)
          const cSnap = await getDoc(cRef)
          if (cSnap.exists()) {
            const dados = cSnap.data()
            if (dados.status !== 'Acessou') {
              await updateDoc(cRef, { status: 'Acessou', dataAcesso: new Date().toISOString() })
              setScanResult({ type: 'success', msg: \Acesso Liberado! Bem-vindo(a), \\ })
            } else {
              setScanResult({ type: 'error', msg: \Convidado já acessou anteriormente.\ })
            }
          } else {
            setScanResult({ type: 'error', msg: \QR Code não encontrado no sistema.\ })
          }
        }
      } catch (err) {
        console.error(err)
        setScanResult({ type: 'error', msg: 'Erro ao validar QR Code.' })
      }
      setLoading(false)
      
      setTimeout(() => {
        setScanResult(null)
        scanner.resume()
      }, 4000)
    }

    function error(err) {}

    return () => {
      scanner.clear().catch(error => console.error('Failed to clear scanner.', error))
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl overflow-hidden w-full max-w-md text-center p-8">
        
        <img src="/logo.png" alt="Logo" className="h-16 mx-auto mb-6" />
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Totem de Autoatendimento</h1>
        <p className="text-sm text-gray-500 mb-8">Aproxime o seu QR Code da câmera para liberar o acesso</p>

        <div className="mx-auto border-4 border-gray-100 rounded-xl overflow-hidden shadow-inner mb-6 relative">
          <div id="reader" className="w-full"></div>
          {loading && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-500 border-t-transparent"></div>
            </div>
          )}
        </div>

        <div className="h-24 flex items-center justify-center">
          {scanResult && (
            <div className={\lex flex-col items-center gap-2 p-4 rounded-xl w-full animate-fade-in \\}>
              {scanResult.type === 'success' ? <CheckCircle size={32} /> : <XCircle size={32} />}
              <span className="font-bold text-lg">{scanResult.msg}</span>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
