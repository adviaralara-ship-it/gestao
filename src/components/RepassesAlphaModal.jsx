import React, { useState, useEffect } from 'react'
import { X, DollarSign, Copy, Check, Download, FileText, Building2, Calendar, ShieldCheck } from 'lucide-react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export default function RepassesAlphaModal({ isOpen, onClose, condominios = [], allBoletos = [], selectedCondoName = '' }) {
  if (!isOpen) return null

  const uniqueCondoList = condominios.filter(c => c.status !== 'Inativo')
  
  const initialCondo = uniqueCondoList.find(c => 
    c.nome?.trim().toLowerCase() === selectedCondoName?.trim().toLowerCase()
  ) || uniqueCondoList[0] || {}

  const [condoId, setCondoId] = useState(initialCondo.id || '')
  
  useEffect(() => {
    if (selectedCondoName) {
      const found = uniqueCondoList.find(c => c.nome?.trim().toLowerCase() === selectedCondoName?.trim().toLowerCase())
      if (found) setCondoId(found.id)
    }
  }, [selectedCondoName, condominios.length])

  const currentCondo = condominios.find(c => c.id === condoId) || initialCondo

  // Mês de competência (lista dinâmica de todos os boletos do condomínio atual)
  const boletosDoCondominio = allBoletos.filter(b => 
    b.condominio && currentCondo?.nome && (
      b.condominio.trim().toLowerCase() === currentCondo.nome.trim().toLowerCase()
    )
  )

  const mesesDisponiveis = Array.from(new Set(boletosDoCondominio.map(b => b.competencia).filter(Boolean)))
  const [competencia, setCompetencia] = useState(mesesDisponiveis[0] || 'Todas')

  useEffect(() => {
    if (mesesDisponiveis.length > 0 && !mesesDisponiveis.includes(competencia) && competencia !== 'Todas') {
      setCompetencia(mesesDisponiveis[0])
    }
  }, [condoId, mesesDisponiveis.length])

  const [copiedKey, setCopiedKey] = useState(null)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)

  // Cálculos
  const boletosDoCondoMes = boletosDoCondominio.filter(b => 
    competencia === 'Todas' || !competencia || (
      b.competencia && b.competencia.trim().toLowerCase() === competencia.trim().toLowerCase()
    )
  )
  const totalBoletos = boletosDoCondoMes.length
  const boletosPagos = boletosDoCondoMes.filter(b => b.status === 'Pago').length

  const honorarios = Number(currentCondo.honorariosAdm || 0)
  
  // Calcula o total exato das taxas com base no valor real discriminado em cada boleto
  const totalTaxas = boletosDoCondoMes.reduce((acc, b) => {
    const deveDiscriminar = b.discriminarTaxa !== undefined ? b.discriminarTaxa : (currentCondo?.discriminarTaxa || false)
    if (!deveDiscriminar) return acc
    const taxaBoleto = Number(b.taxaEmissao !== undefined ? b.taxaEmissao : (currentCondo?.taxaEmissao || 0))
    return acc + taxaBoleto
  }, 0)

  // Taxa unitária real (média das cotas discriminadas ou padrão do condomínio)
  const boletosComTaxa = boletosDoCondoMes.filter(b => (b.discriminarTaxa !== false && Number(b.taxaEmissao || currentCondo?.taxaEmissao || 0) > 0))
  const taxaUnit = boletosComTaxa.length > 0 
    ? (totalTaxas / boletosComTaxa.length) 
    : Number(currentCondo?.taxaEmissao !== undefined ? currentCondo.taxaEmissao : 0)

  const totalGeral = honorarios + totalTaxas

  const chavePixAlpha = currentCondo.chavePixAlpha || '66.643.272/0001-18'

  const copyToClipboard = (text, keyName) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(keyName)
    setTimeout(() => setCopiedKey(null), 2500)
  }

  const handleDownloadPDF = async () => {
    try {
      setIsGeneratingPdf(true)
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pdfWidth = pdf.internal.pageSize.getWidth()

      const container = document.createElement('div')
      container.style.position = 'fixed'
      container.style.top = '-9999px'
      container.style.left = '-9999px'
      container.style.width = '780px'
      container.style.backgroundColor = '#ffffff'
      container.style.padding = '30px'
      document.body.appendChild(container)

      container.innerHTML = `
        <div style="font-family: Arial, sans-serif; color: #0f172a; padding: 24px; background: #fff; border: 1px solid #cbd5e1; border-radius: 16px;">
          
          <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 20px;">
            <div style="display: flex; align-items: center; gap: 14px;">
              <img src="/logo-alpha.png" width="56" height="56" style="object-fit: contain; border-radius: 12px;" />
              <div>
                <h2 style="margin: 0; font-size: 18px; font-weight: 900; color: #0f172a;">ALPHA SOLUÇÕES CONDOMINIAIS LTDA</h2>
                <p style="margin: 2px 0 0; font-size: 11px; color: #64748b; font-weight: bold;">CNPJ: 66.643.272/0001-18 • Gestão & Assessoria Condominial</p>
              </div>
            </div>
            <div style="text-align: right;">
              <span style="display: inline-block; background: #fef3c7; color: #92400e; border: 1px solid #fde68a; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 900; text-transform: uppercase;">
                Demonstrativo de Repasse
              </span>
              <p style="margin: 4px 0 0; font-size: 11px; color: #64748b; font-family: monospace;">Competência: ${competencia}</p>
            </div>
          </div>

          <div style="background: #f8fafc; padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0; font-size: 12px; margin-bottom: 20px;">
            <p style="margin: 0 0 4px; font-size: 10px; font-weight: bold; color: #94a3b8; text-transform: uppercase;">Condomínio Tomador dos Serviços</p>
            <h3 style="margin: 0 0 4px; font-size: 16px; font-weight: 900; color: #0f172a;">${currentCondo.nome || 'Condomínio'}</h3>
            <p style="margin: 0; color: #64748b;">${currentCondo.endereco || 'Endereço Cadastrado'} • CNPJ: ${currentCondo.cnpj || '—'} • Síndico(a): ${currentCondo.sindico || '—'}</p>
          </div>

          <div style="border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; margin-bottom: 20px;">
            <div style="background: #0f172a; color: #fff; padding: 10px 16px; font-weight: bold; font-size: 12px; display: flex; justify-content: space-between;">
              <span>DISCRIMINAÇÃO DOS SERVIÇOS PRESTADOS</span>
              <span>VALOR (R$)</span>
            </div>
            <div style="padding: 16px; font-size: 13px; display: flex; flex-col; gap: 12px;">
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #cbd5e1;">
                <div>
                  <strong style="color: #0f172a;">1. Honorários Mensais de Gestão & Administração</strong>
                  <p style="margin: 2px 0 0; font-size: 11px; color: #64748b;">Prestação de serviços de assessoria contábil, financeira e administrativa.</p>
                </div>
                <div style="font-family: monospace; font-weight: bold; font-size: 14px; color: #0f172a;">
                  R$ ${honorarios.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #cbd5e1;">
                <div>
                  <strong style="color: #0f172a;">2. Serviço de Cobrança Digital e Sistema Web/App</strong>
                  <p style="margin: 2px 0 0; font-size: 11px; color: #64748b;">Processamento e conciliação de <b>${totalBoletos} cotas/boletos</b> gerados (R$ ${taxaUnit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / unidade).</p>
                </div>
                <div style="font-family: monospace; font-weight: bold; font-size: 14px; color: #0f172a;">
                  R$ ${totalTaxas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div style="display: flex; justify-content: space-between; padding: 12px 0 4px; font-weight: 900; font-size: 16px; background: #ecfdf5; padding: 12px; border-radius: 8px; border: 1px solid #a7f3d0;">
                <span style="color: #065f46;">TOTAL LÍQUIDO A REPASSAR:</span>
                <span style="font-family: monospace; color: #047857;">R$ ${totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          <div style="background: #f8fafc; border: 1px dashed #94a3b8; border-radius: 12px; padding: 16px; margin-bottom: 24px; font-size: 12px;">
            <h4 style="margin: 0 0 8px; font-size: 13px; font-weight: 900; color: #0f172a;">💠 Dados para Transferência / Pagamento PIX</h4>
            <p style="margin: 0 0 4px; color: #475569;"><b>Beneficiário:</b> ALPHA SOLUÇÕES CONDOMINIAIS LTDA</p>
            <p style="margin: 0 0 4px; color: #475569;"><b>Chave PIX Oficial (CNPJ):</b> <span style="font-family: monospace; font-weight: bold; color: #047857;">${chavePixAlpha}</span></p>
            <p style="margin: 0; color: #64748b; font-size: 11px;">O pagamento pode ser efetuado de forma separada (Honorários / Taxas) ou no valor consolidado.</p>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; text-align: center; font-size: 11px; color: #475569;">
            <div>
              <div style="border-top: 1px solid #0f172a; padding-top: 6px; font-weight: bold; color: #0f172a;">
                ALPHA SOLUÇÕES CONDOMINIAIS LTDA
              </div>
              <span>Administradora Contratada</span>
            </div>
            <div>
              <div style="border-top: 1px solid #0f172a; padding-top: 6px; font-weight: bold; color: #0f172a;">
                ${currentCondo.sindico || 'Síndico(a) / Conselho Fiscal'}
              </div>
              <span>${currentCondo.nome || 'Condomínio'}</span>
            </div>
          </div>

        </div>
      `

      await new Promise(r => setTimeout(r, 200))
      const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
      const imgData = canvas.toDataURL('image/png')
      const imgHeight = (canvas.height * pdfWidth) / canvas.width
      const condoFmt = (currentCondo.nome || 'Condominio').replace(/\s+/g, '_')
      const compFmt = (competencia || 'Mes').replace(/\//g, '-')
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, Math.min(imgHeight, 295))
      pdf.save(`Demonstrativo_Repasse_Alpha_${condoFmt}_${compFmt}.pdf`)
      document.body.removeChild(container)
      setIsGeneratingPdf(false)
    } catch(err) {
      console.error(err)
      setIsGeneratingPdf(false)
      alert("Erro ao gerar o demonstrativo em PDF.")
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-2xl" onClick={e => e.stopPropagation()}>
        
        {/* Cabeçalho */}
        <div className="p-4 sm:p-6 border-b border-cream-300 flex items-center justify-between gap-3 bg-brand-50/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center font-black shadow-sm shrink-0">
              💼
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-gray-900 text-base sm:text-lg truncate">Demonstrativo de Repasses da Alpha</h3>
              <p className="text-xs text-gray-500 font-medium">Honorários de Gestão + Taxas de Arrecadação Digital</p>
            </div>
          </div>
          <button onClick={onClose} className="modal-close-btn" title="Fechar">✕</button>
        </div>

        <div className="p-4 sm:p-6 flex flex-col gap-5 max-h-[75vh] overflow-y-auto">
          
          {/* Seleção de Condomínio e Competência */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
            <div>
              <label className="label text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <Building2 size={13} className="text-brand-600"/> Condomínio:
              </label>
              <select className="input text-xs font-bold text-gray-900 bg-white" value={condoId} onChange={e => setCondoId(e.target.value)}>
                {uniqueCondoList.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="label text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <Calendar size={13} className="text-brand-600"/> Competência / Mês:
              </label>
              <select className="input text-xs font-bold text-gray-900 bg-white" value={competencia} onChange={e => setCompetencia(e.target.value)}>
                <option value="Todas">Todas as Competências</option>
                {mesesDisponiveis.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* Cards Discriminados */}
          <div className="flex flex-col gap-3">
            
            {/* Card 1: Honorários de Gestão */}
            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-brand-300 transition-all">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-black text-brand-700 bg-brand-50 px-2 py-0.5 rounded uppercase tracking-wider">
                    Item 1 • Contrato Mensal
                  </span>
                  <h4 className="font-black text-gray-900 text-sm mt-1">Honorários de Prestação de Serviços (Administração)</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Valor fixo de assessoria administrativa e financeira</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400 font-bold uppercase">Valor</p>
                  <p className="text-lg font-black text-gray-900 font-mono">
                    R$ {honorarios.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="text-xs text-gray-600 flex items-center gap-1.5 font-mono">
                  <span className="font-bold text-gray-400">PIX Alpha:</span> {chavePixAlpha}
                </div>
                <button
                  onClick={() => copyToClipboard(chavePixAlpha, 'honorarios')}
                  className="btn-secondary py-1.5 px-3 text-xs bg-slate-50 hover:bg-brand-50 hover:text-brand-700 border-slate-200 flex items-center justify-center gap-1 font-bold"
                >
                  {copiedKey === 'honorarios' ? <Check size={13} className="text-emerald-600"/> : <Copy size={13}/>}
                  <span>{copiedKey === 'honorarios' ? 'Chave Copiada!' : 'Copiar PIX Honorários'}</span>
                </button>
              </div>
            </div>

            {/* Card 2: Serviço de Cobrança Digital */}
            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-brand-300 transition-all">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded uppercase tracking-wider">
                    Item 2 • Cobrança Digital
                  </span>
                  <h4 className="font-black text-gray-900 text-sm mt-1">Serviço de Cobrança Digital</h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    <b>{totalBoletos} cotas geradas</b> ({boletosPagos} pagas) x R$ {taxaUnit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} por unidade
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400 font-bold uppercase">Total Serviços</p>
                  <p className="text-lg font-black text-emerald-700 font-mono">
                    R$ {totalTaxas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="text-xs text-gray-600 flex items-center gap-1.5 font-mono">
                  <span className="font-bold text-gray-400">PIX Alpha:</span> {chavePixAlpha}
                </div>
                <button
                  onClick={() => copyToClipboard(chavePixAlpha, 'taxas')}
                  className="btn-secondary py-1.5 px-3 text-xs bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 border-slate-200 flex items-center justify-center gap-1 font-bold"
                >
                  {copiedKey === 'taxas' ? <Check size={13} className="text-emerald-600"/> : <Copy size={13}/>}
                  <span>{copiedKey === 'taxas' ? 'Chave Copiada!' : 'Copiar PIX Taxas'}</span>
                </button>
              </div>
            </div>

            {/* Total Geral Consolidado */}
            <div className="p-4 bg-gradient-to-r from-brand-900 to-slate-900 text-white rounded-2xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-brand-300">
                  Total Geral a Repassar
                </span>
                <h3 className="text-2xl font-black font-mono text-emerald-400 mt-0.5">
                  R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </h3>
                <p className="text-[11px] text-slate-300">Honorários + Taxas de Arrecadação do Mês</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyToClipboard(chavePixAlpha, 'total')}
                  className="py-2.5 px-4 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center gap-1.5 shadow-sm transition-all"
                >
                  {copiedKey === 'total' ? <Check size={14}/> : <Copy size={14}/>}
                  <span>{copiedKey === 'total' ? 'Chave Copiada!' : 'Copiar PIX Consolidado'}</span>
                </button>
              </div>
            </div>

          </div>

        </div>

        {/* Rodapé */}
        <div className="p-4 sm:p-6 border-t border-cream-300 flex flex-col sm:flex-row gap-3 justify-between items-center bg-slate-50/50">
          <p className="text-xs text-gray-500 text-center sm:text-left flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-600"/> Prestação de contas 100% transparente para a pasta mensal.
          </p>
          <div className="flex gap-2 w-full sm:w-auto">
            <button onClick={onClose} className="btn-secondary flex-1 sm:flex-initial text-xs py-2 px-4">
              Fechar
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPdf}
              className="btn-primary flex-1 sm:flex-initial text-xs py-2 px-4 flex items-center justify-center gap-1.5 shadow-sm bg-brand-600 hover:bg-brand-500"
            >
              <Download size={14}/>
              <span>{isGeneratingPdf ? 'Gerando PDF...' : 'Baixar Demonstrativo (PDF)'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
