import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle, Download, Scale, UserCheck, ShieldCheck, Loader2 } from 'lucide-react'
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { jsPDF } from 'jspdf'

export default function MediacaoSalaExterna() {
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [acordo, setAcordo] = useState(null)
  const [aceito, setAceito] = useState(false)

  useEffect(() => {
    async function carregarMediacao() {
      if (!id) {
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
        } else {
          // Fallback caso ID não exista
          setAcordo({
            condominio: 'Residencial Alpha',
            unidade: 'Unidade Condominial',
            valor: 2500,
            parcelas: 5,
            valorParcela: 500,
            status: 'Aguardando Assinatura',
            termos: 'Termo de Acordo em elaboração.'
          })
        }
      } catch (err) {
        console.error("Erro ao carregar mediação:", err)
      } finally {
        setLoading(false)
      }
    }
    carregarMediacao()
  }, [id])

  const handleAceitar = async () => {
    setAceito(true)
    if (id && acordo?.id) {
      try {
        const docRef = doc(db, 'mediacoes', id)
        await updateDoc(docRef, {
          status: 'Acordo Homologado',
          aceitoDigitalmente: true,
          dataAssinaturaMorador: serverTimestamp()
        })
      } catch (err) {
        console.error("Erro ao registrar assinatura:", err)
      }
    }
    alert('✅ Acordo aceito digitalmente com sucesso! Uma cópia foi registrada no sistema.')
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
          <p className="text-sm font-bold">Carregando sala de mediação...</p>
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

      </div>
    </div>
  )
}
