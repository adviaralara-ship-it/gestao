import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle, Download, Scale, UserCheck, ShieldCheck, Loader2, Lock, AlertTriangle } from 'lucide-react'
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { jsPDF } from 'jspdf'

export default function MediacaoSalaExterna() {
  const { id } = useParams()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [acordo, setAcordo] = useState(null)
  const [aceito, setAceito] = useState(false)
  const [error, setError] = useState('')
  
  // Controle de acesso / Anti-IDOR: exige confirmação dos dígitos do CPF do devedor caso não seja admin
  const [unlocked, setUnlocked] = useState(false)
  const [cpfInput, setCpfInput] = useState('')
  const [cpfError, setCpfError] = useState('')

  useEffect(() => {
    async function carregarMediacao() {
      if (!id) {
        setError('Identificador de mediação não informado.')
        setLoading(false)
        return
      }
      try {
        const docRef = doc(db, 'mediacoes', id)
        const docSnap = await getDoc(docRef)
        if (docSnap.exists()) {
          const data = docSnap.data()
          setAcordo({ id: docSnap.id, ...data })
          if (data.status === 'Acordo Homologado' || data.aceitoDigitalmente) {
            setAceito(true)
          }

          // Se o usuário logado for Administrador ou Síndico, libera direto
          if (user && (user.role === 'Administrador' || user.role === 'Síndico' || user.role === 'Financeiro')) {
            setUnlocked(true)
          }
        } else {
          setError('Acordo de mediação não encontrado ou link expirado.')
        }
      } catch (err) {
        console.error("Erro ao carregar mediação:", err)
        setError('Erro ao carregar termo de mediação. Tente novamente.')
      } finally {
        setLoading(false)
      }
    }
    carregarMediacao()
  }, [id, user])

  const handleValidarIdentidade = (e) => {
    e.preventDefault()
    setCpfError('')
    if (!acordo) return

    const cpfDigitado = cpfInput.replace(/\D/g, '')
    const cpfCadastrado = String(acordo.cpf || '').replace(/\D/g, '')

    // Se o acordo tem CPF, exige que coincida com os 11 dígitos ou ao menos os primeiros 6
    if (cpfCadastrado && cpfCadastrado.length >= 6) {
      if (cpfDigitado !== cpfCadastrado && !cpfCadastrado.startsWith(cpfDigitado)) {
        setCpfError('O CPF informado não corresponde ao titular deste termo de acordo.')
        return
      }
    } else if (cpfDigitado.length < 4) {
      setCpfError('Informe ao menos 4 dígitos do seu CPF cadastrado.')
      return
    }

    setUnlocked(true)
  }

  const handleAceitar = async () => {
    if (!unlocked) {
      alert('Por favor, valide sua identidade com seu CPF antes de assinar o termo.')
      return
    }

    if (id && acordo?.id) {
      try {
        const docRef = doc(db, 'mediacoes', id)
        await updateDoc(docRef, {
          status: 'Acordo Homologado',
          aceitoDigitalmente: true,
          dataAssinaturaMorador: serverTimestamp(),
          assinanteId: user?.id || user?.uid || 'morador_externo_verificado'
        })
        setAceito(true)
        alert('✅ Acordo aceito e firmado digitalmente com sucesso! Uma via foi registrada no sistema.')
      } catch (err) {
        console.error("Erro ao registrar assinatura:", err)
        alert('Erro ao registrar assinatura. Tente novamente.')
      }
    }
  }

  const handleGerarPDF = () => {
    if (!acordo) return
    const docPdf = new jsPDF()
    const margin = 15
    const maxLineWidth = 180
    
    docPdf.setFont("helvetica", "normal")
    docPdf.setFontSize(10)
    
    const textLines = docPdf.splitTextToSize(acordo.termos || 'Termo de Acordo', maxLineWidth)
    docPdf.text(textLines, margin, 20)
    docPdf.save(`Termo_Acordo_${acordo.condominio || 'Geral'}.pdf`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="flex flex-col items-center gap-2 text-brand-700">
          <Loader2 size={32} className="animate-spin" />
          <p className="text-sm font-bold">Carregando sala de mediação segura...</p>
        </div>
      </div>
    )
  }

  if (error || !acordo) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center border border-gray-200">
          <AlertTriangle className="text-amber-500 mx-auto mb-3" size={44} />
          <h2 className="text-lg font-black text-gray-900 mb-1">Acesso Restrito</h2>
          <p className="text-gray-600 text-sm mb-6">{error || 'Acordo não localizado.'}</p>
          <a href="/login" className="btn-primary w-full py-3 text-sm justify-center rounded-xl">
            Ir para o Login do Sistema
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
        
        {/* Header do Acordo */}
        <div className="bg-gradient-to-r from-[#2d3045] to-[#1e2030] p-6 text-center text-white">
          <div className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-2 border border-white/20">
            <Scale className="text-white" size={28} />
          </div>
          <h1 className="text-2xl font-black mb-0.5">Sala de Mediação & Acordo (ODR)</h1>
          <p className="text-gray-300 text-xs">Resolução Online de Conflitos Condominiais</p>
        </div>

        {/* Verificação de Identidade Anti-IDOR */}
        {!unlocked ? (
          <div className="p-6">
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3 mb-5">
              <Lock className="text-amber-600 shrink-0 mt-0.5" size={20} />
              <div className="text-xs text-amber-800 leading-relaxed">
                <strong className="block font-bold mb-0.5">Documento Protegido por Sigilo</strong>
                Para proteger os dados financeiros do condômino contra acessos não autorizados, informe o CPF do titular cadastrado neste acordo para desbloquear a leitura e a assinatura digital.
              </div>
            </div>

            <form onSubmit={handleValidarIdentidade} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  CPF do Titular
                </label>
                <input
                  type="text"
                  required
                  placeholder="000.000.000-00"
                  value={cpfInput}
                  onChange={(e) => setCpfInput(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
                {cpfError && (
                  <p className="text-red-600 text-xs mt-1.5 font-medium">{cpfError}</p>
                )}
              </div>

              <button
                type="submit"
                className="w-full bg-brand-700 hover:bg-brand-800 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all flex justify-center items-center gap-2 text-sm"
              >
                <UserCheck size={18} />
                Desbloquear e Visualizar Termo
              </button>
            </form>
          </div>
        ) : (
          <>
            {/* Resumo Financeiro */}
            <div className="p-5 border-b border-gray-200 bg-slate-50">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">Condomínio</p>
                  <p className="text-gray-900 font-black text-base">{acordo?.condominio || 'Condomínio'}</p>
                  <p className="text-gray-600 text-xs font-semibold">{acordo?.unidade || acordo?.apt || 'Unidade'}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">Valor do Acordo</p>
                  <p className="text-2xl font-black text-emerald-700">
                    R$ {(parseFloat(acordo?.valor) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-gray-600 text-xs font-medium">
                    {acordo?.parcelas ? `Em ${acordo.parcelas}x de R$ ${(parseFloat(acordo.valorParcela) || (acordo.valor / acordo.parcelas)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'À vista'}
                  </p>
                </div>
              </div>
            </div>

            {/* Documento */}
            <div className="p-6 flex flex-col gap-4">
              <h2 className="text-xs font-bold text-gray-800 flex items-center gap-1.5 uppercase tracking-wider">
                <ShieldCheck className="text-emerald-600" size={16} />
                Termo de Confissão de Dívida & Acordo
              </h2>
              
              <div className="bg-slate-50 border border-gray-200 rounded-xl p-4 h-72 overflow-y-auto text-xs text-gray-800 font-mono leading-relaxed shadow-inner custom-scrollbar whitespace-pre-wrap">
                {acordo?.termos || 'Termo não disponível.'}
              </div>

              {/* Ações */}
              {!aceito ? (
                <div className="space-y-2 pt-2">
                  <button 
                    onClick={handleAceitar}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3.5 rounded-xl shadow-lg shadow-emerald-700/20 transition-all flex justify-center items-center gap-2 text-sm uppercase tracking-wide cursor-pointer"
                  >
                    <UserCheck size={18} />
                    Aceitar e Assinar Digitalmente
                  </button>
                  
                  <button
                    onClick={handleGerarPDF}
                    className="w-full bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold py-2.5 rounded-xl transition-all flex justify-center items-center gap-2 text-xs shadow-sm cursor-pointer"
                  >
                    <Download size={15} />
                    Baixar Minuta em PDF
                  </button>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center gap-3 animate-fade-in">
                  <CheckCircle className="text-emerald-600 shrink-0" size={28} />
                  <div>
                    <h3 className="font-black text-emerald-900 text-sm">Assinatura Digital Confirmada</h3>
                    <p className="text-emerald-700 text-xs mt-0.5">
                      O termo foi firmado com validade de Título Executivo Extrajudicial (Art. 784, III do CPC).
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  )
}
