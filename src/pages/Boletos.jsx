import React, { useState, useEffect } from 'react'
import { FileText, Plus, Download, DollarSign, Printer, CheckCircle2, Clock, AlertCircle, Trash2, Edit2, X, MessageSquare, Sparkles, Check, TrendingUp, Bell, Building, Upload, Copy, Share2, QrCode, Package } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { notificarAdm, enviarEmail } from '../emailjs.config'
import RepassesAlphaModal from '../components/RepassesAlphaModal'
import { CurrencyInput, maskCurrency, parseCurrency } from '../utils/currency'
import { enviarBoletoWhatsAppAuto } from '../utils/whatsappAutomacao'

function gerarLinhaDigitavel(apt, valor, venc) {
  const r = () => Math.floor(Math.random() * 9)
  return `34191.${r()}${r()}${r()}${r()}${r()} ${r()}${r()}${r()}${r()}${r()}.${r()}${r()}${r()}${r()}${r()}${r()} ${r()}${r()}${r()}${r()}${r()}.${r()}${r()}${r()}${r()}${r()}${r()} ${r()} ${(venc||'').replace(/\//g,'')}${String(Math.round((valor||0)*100)).padStart(10,'0')}`
}

function generateStaticPix(chavePix, valor, nome = "Condominio", cidade = "Sao Paulo") {
  if (!chavePix) return "";
  const formatLength = (id, value) => {
    const v = String(value);
    return id + String(v.length).padStart(2, '0') + v;
  };
  const payloadFormat = formatLength("00", "01");
  const merchantAccount = formatLength("26", formatLength("00", "br.gov.bcb.pix") + formatLength("01", chavePix));
  const merchantCategory = formatLength("52", "0000");
  const currency = formatLength("53", "986");
  const amount = valor ? formatLength("54", Number(valor).toFixed(2)) : "";
  const country = formatLength("58", "BR");
  const merchantName = formatLength("59", nome.substring(0, 25).normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  const merchantCity = formatLength("60", cidade.substring(0, 15).normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  const additionalData = formatLength("62", formatLength("05", "***"));
  const payload = payloadFormat + merchantAccount + merchantCategory + currency + amount + country + merchantName + merchantCity + additionalData + "6304";
  
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= (payload.charCodeAt(i) << 8);
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) crc = (crc << 1) ^ 0x1021;
      else crc = (crc << 1);
    }
  }
  return payload + (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

function BoletoPrintModal({ boleto, condominio, moradores = [], onClose }) {
  const [copied, setCopied] = useState(false)
  const chavePixFinal = boleto.chave_pix || condominio?.chave_pix || 'alpha.solucoes@condominios.com.br'
  const nomeCondo = condominio?.nome || boleto.condominio || "Condominio Residencial"
  // Sempre gera o PIX com o valor atualizado do boleto para garantir que qualquer alteração de valor seja refletida
  const pixFinal = generateStaticPix(chavePixFinal, Number(boleto.valor || 0), nomeCondo, "BR")
  const linhaDigitavel = boleto.linha || gerarLinhaDigitavel(boleto.apt, boleto.valor, boleto.vencimento)
  const valorFormatado = Number(boleto.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
  const dataVencFormatada = boleto.vencimento ? (boleto.vencimento.includes('-') ? boleto.vencimento.split('-').reverse().join('/') : boleto.vencimento) : '—'

  const handleCopyPix = async () => {
    try {
      await navigator.clipboard.writeText(pixFinal)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch(e) {
      prompt("Copie o código PIX Copia e Cola abaixo:", pixFinal)
    }
  }

  const [downloading, setDownloading] = useState(false)

  const handleDownloadPDF = async () => {
    try {
      setDownloading(true)
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(pixFinal)}`
      const vencFmt = dataVencFormatada || '—'
      const valorFmt = valorFormatado || '0,00'
      const condoNomeStr = condominio?.nome || boleto.condominio || 'Condomínio Residencial'
      const enderecoStr = condominio?.endereco || 'Endereço Cadastrado'

      const deveDiscriminar = boleto.discriminarTaxa !== undefined ? boleto.discriminarTaxa : (condominio?.discriminarTaxa || false)
      const taxaEmissao = deveDiscriminar ? Number(boleto.taxaEmissao || condominio?.taxaEmissao || 3.50) : 0
      const valCheio = Number(boleto.valorOriginal || boleto.valor || 0)
      const cotaBase = Math.max(0, valCheio - taxaEmissao)
      const rawTaxa = boleto.nomeTaxa || condominio?.nomeTaxa || 'Serviço de Cobrança Digital'
      const nomeTaxa = (rawTaxa.includes('Processamento') || rawTaxa.includes('Tarifa')) ? 'Serviço de Cobrança Digital' : rawTaxa

      const container = document.createElement('div')
      container.style.position = 'fixed'
      container.style.top = '-9999px'
      container.style.left = '-9999px'
      container.style.width = '780px'
      container.style.backgroundColor = '#ffffff'
      container.style.padding = '20px'
      document.body.appendChild(container)

      container.innerHTML = `
        <div style="font-family: Arial, Helvetica, sans-serif; color: #0f172a; padding: 24px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 16px; width: 740px; box-sizing: border-box;">
          
          <!-- Cabeçalho Oficial com Logo -->
          <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 14px;">
              <img src="/logo-alpha.png" width="52" height="52" style="object-fit: contain; border-radius: 10px; border: 1px solid #e2e8f0;" />
              <div>
                <h2 style="margin: 0; font-size: 16px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">ALPHA SOLUÇÕES CONDOMINIAIS LTDA</h2>
                <p style="margin: 3px 0 0; font-size: 11px; color: #475569; font-weight: bold;">Gestão & Assessoria Condominial</p>
                <p style="margin: 2px 0 0; font-size: 10px; color: #64748b; font-family: monospace; font-weight: bold;">CNPJ: 66.643.272/0001-18</p>
              </div>
            </div>
            <div style="text-align: right;">
              <span style="display: inline-block; background: #dcfce7; color: #166534; border: 1px solid #86efac; padding: 4px 12px; border-radius: 9999px; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;">FATURA / BOLETO PIX</span>
              <p style="margin: 4px 0 0; font-size: 10px; color: #94a3b8; font-family: monospace;">Recibo do Sacado</p>
            </div>
          </div>

          <!-- Dados em 3 colunas -->
          <div style="display: grid; grid-template-columns: 1fr 1fr 1.1fr; gap: 12px; background: #f8fafc; padding: 14px; border-radius: 12px; border: 1px solid #e2e8f0; font-size: 12px; margin-bottom: 14px;">
            <div>
              <span style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase;">Condomínio Beneficiário</span>
              <p style="margin: 4px 0 0; font-weight: 900; font-size: 13px; color: #0f172a;">${condoNomeStr}</p>
              <p style="margin: 2px 0 0; color: #64748b; font-size: 11px;">${enderecoStr}</p>
              <p style="margin: 4px 0 0; color: #047857; font-weight: bold; font-family: monospace; font-size: 10px;">Chave PIX: ${chavePixFinal}</p>
            </div>
            <div>
              <span style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase;">Pagador / Morador</span>
              <p style="margin: 4px 0 0; font-weight: 900; font-size: 13px; color: #0f172a;">${boleto.morador || 'Morador'}</p>
              <p style="margin: 2px 0 0; color: #334155; font-weight: bold; font-size: 11px;">Unidade: ${boleto.apt ? 'Apt ' + boleto.apt : '—'}</p>
              <p style="margin: 4px 0 0; color: #64748b; font-family: monospace; font-size: 10px;">Competência: ${boleto.competencia || 'Mês Vigente'}</p>
            </div>
            <div style="background: #ecfdf5; padding: 12px; border-radius: 10px; border: 1px solid #a7f3d0; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <span style="font-size: 10px; font-weight: 900; color: #065f46; text-transform: uppercase;">Data de Vencimento</span>
                <p style="margin: 2px 0 0; font-weight: 900; font-size: 13px; color: #0f172a;">${vencFmt}</p>
              </div>
              <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #a7f3d0;">
                <span style="font-size: 10px; font-weight: 900; color: #065f46; text-transform: uppercase;">Total a Pagar</span>
                <p style="margin: 2px 0 0; font-weight: 900; font-size: 18px; color: #047857; font-family: monospace;">R$ ${valorFmt}</p>
              </div>
            </div>
          </div>

          <!-- Composição da Taxa -->
          <div style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 14px;">
            <div style="background: #f1f5f9; padding: 7px 12px; font-weight: bold; font-size: 11px; color: #334155; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">Demonstrativo de Composição da Cobrança</div>
            <div style="padding: 10px 14px; font-size: 12px;">
              ${taxaEmissao > 0 ? `
                <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #e2e8f0;">
                  <span style="color: #334155;">Taxa Condominial Ordinária (${boleto.competencia || 'Mês Atual'})</span>
                  <span style="font-family: monospace; font-weight: bold; color: #0f172a;">R$ ${cotaBase.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #e2e8f0; color: #0f172a; background: #f0fdf4; padding: 4px 8px; border-radius: 6px; margin: 3px 0;">
                  <span style="font-weight: bold;">${nomeTaxa}</span>
                  <span style="font-family: monospace; font-weight: bold;">R$ ${taxaEmissao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              ` : `
                <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #e2e8f0;">
                  <span style="color: #334155;">Taxa Ordinária de Condomínio (${boleto.competencia || 'Mês Atual'})</span>
                  <span style="font-family: monospace; font-weight: bold; color: #0f172a;">R$ ${valCheio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              `}
              ${boleto.multa > 0 ? `
                <div style="display: flex; justify-content: space-between; padding: 4px 0; color: #92400e;">
                  <span>Multa por Atraso (2%)</span>
                  <span style="font-family: monospace; font-weight: bold;">+ R$ ${Number(boleto.multa).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              ` : ''}
              ${boleto.juros > 0 ? `
                <div style="display: flex; justify-content: space-between; padding: 4px 0; color: #92400e;">
                  <span>Juros de Mora (1% a.m.)</span>
                  <span style="font-family: monospace; font-weight: bold;">+ R$ ${Number(boleto.juros).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              ` : ''}
              <div style="display: flex; justify-content: space-between; padding: 7px 8px 0; font-weight: 900; font-size: 13px; background: #f8fafc; border-radius: 8px; margin-top: 4px;">
                <span>VALOR TOTAL COBRADO</span>
                <span style="font-family: monospace; color: #047857; font-size: 15px;">R$ ${valorFmt}</span>
              </div>
            </div>
          </div>

          <!-- Área PIX & QR Code -->
          <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 12px; padding: 12px; display: flex; align-items: center; gap: 16px; margin-bottom: 14px;">
            <div style="display: flex; flex-direction: column; align-items: center; shrink-0;">
              <img src="${qrUrl}" width="105" height="105" style="background: #fff; padding: 4px; border: 1px solid #86efac; border-radius: 10px;" />
              <span style="font-size: 9px; font-weight: 900; color: #166534; background: #dcfce7; padding: 2px 8px; border-radius: 9999px; margin-top: 4px; text-transform: uppercase;">QR Code PIX</span>
            </div>
            <div style="flex: 1; min-width: 0;">
              <h4 style="margin: 0 0 4px; font-size: 13px; font-weight: 900; color: #0f172a;">Pague via PIX Instantâneo</h4>
              <p style="margin: 0 0 8px; font-size: 11px; color: #475569; line-height: 1.4;">
                Aponte a câmera do aplicativo do seu banco para o <b>QR Code</b> ao lado ou utilize a chave <b>PIX Copia e Cola</b>:
              </p>
              <div style="font-family: monospace; font-size: 9px; color: #334155; background: #ffffff; padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 8px; word-break: break-all; max-height: 42px; overflow: hidden; line-height: 1.3;">
                ${pixFinal}
              </div>
            </div>
          </div>

          <!-- Linha Digitável e Código de Barras -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px;">
            <div style="display: flex; justify-content: space-between; font-size: 10px; color: #475569; margin-bottom: 6px;">
              <span style="font-weight: bold;">Linha Digitável / Ficha de Compensação:</span>
              <span style="font-family: monospace; font-weight: bold; color: #0f172a; font-size: 11px;">${linhaDigitavel}</span>
            </div>
            <div style="display: flex; justify-content: center; gap: 1px; height: 26px; margin: 4px 0;">
              ${Array.from({ length: 65 }).map((_, i) => `<div style="background: #0f172a; width: ${i % 3 === 0 ? '2.5px' : i % 5 === 0 ? '3.5px' : '1.2px'}; height: 100%;"></div>`).join('')}
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 8px; color: #94a3b8; margin-top: 4px;">
              <span>Autenticação Mecânica &nbsp;•&nbsp; Baixa Automática Instantânea</span>
              <span>Alpha Soluções Condominiais</span>
            </div>
          </div>

        </div>
      `

      await new Promise(r => setTimeout(r, 250))

      const canvas = await html2canvas(container, { 
        scale: 2, 
        useCORS: true, 
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: 780,
        windowWidth: 780
      })

      document.body.removeChild(container)

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pdfWidth = 210
      const margin = 8
      const printWidth = pdfWidth - (margin * 2) // 194mm
      const imgHeight = (canvas.height * printWidth) / canvas.width
      
      const maxAllowedHeight = 280
      const finalH = imgHeight > maxAllowedHeight ? maxAllowedHeight : imgHeight
      const finalW = imgHeight > maxAllowedHeight ? (canvas.width * finalH) / canvas.height : printWidth
      const finalMarginX = (pdfWidth - finalW) / 2
      
      const condoFmt = (condominio?.nome || boleto.condominio || 'Condominio').replace(/\s+/g, '_')
      const moradorFmt = (boleto.morador || 'Morador').replace(/\s+/g, '_')
      const aptFmt = boleto.apt ? `_Apt${boleto.apt}` : ''
      const compFmt = (boleto.competencia || 'Mes').replace(/\//g, '-')
      
      pdf.addImage(imgData, 'PNG', finalMarginX, margin, finalW, finalH)
      pdf.save(`Boleto-PIX_${condoFmt}_${moradorFmt}${aptFmt}_${compFmt}.pdf`)
      setDownloading(false)
    } catch(err) {
      console.error('Erro na captura do PDF:', err)
      window.print()
      setDownloading(false)
    }
  }

  const [enviandoDirectWhats, setEnviandoDirectWhats] = useState(false)

  const shareWhatsAppDirect = async () => {
    setEnviandoDirectWhats(true)
    try {
      const moradorDoc = (boleto.moradorId && moradores.find(m => m.id === boleto.moradorId))
        || moradores.find(m => (m.nome && boleto.morador && m.nome.trim().toLowerCase() === boleto.morador.trim().toLowerCase()) || (m.apt && boleto.apt && String(m.apt).trim() === String(boleto.apt).trim()))
        || { nome: boleto.morador, tel: boleto.telefone || boleto.tel || '' }

      const res = await enviarBoletoWhatsAppAuto(boleto, moradorDoc, condominio)
      if (res.success) {
        alert(`🎉 Boleto em PDF enviado com sucesso diretamente no WhatsApp de ${boleto.morador}!`)
      } else {
        // Se falhar por falta de telefone ou conexão, oferece abrir via WhatsApp Web
        if (window.confirm(`Envio direto automático: ${res.error}.\n\nDeseja abrir o WhatsApp Web para enviar manualmente?`)) {
          shareWhatsAppWeb()
        }
      }
    } catch(e) {
      console.error(e)
      alert('Erro ao processar envio de WhatsApp.')
    }
    setEnviandoDirectWhats(false)
  }

  const shareWhatsAppWeb = () => {
    const msg = `*Alpha Soluções Condominiais*\nOlá *${boleto.morador}* (Apt ${boleto.apt}), segue sua fatura condominial referente a *${boleto.competencia || 'Mês Atual'}*:\n\n💰 *Valor:* R$ ${valorFormatado}\n📅 *Vencimento:* ${dataVencFormatada}\n\n💠 *PIX Copia e Cola:*\n\`\`\`${pixFinal}\`\`\`\n\nAbra o aplicativo do seu banco, escolha *PIX Copia e Cola* e cole o código acima para efetuar o pagamento instantâneo.`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-3xl w-[95vw] sm:w-full p-0 flex flex-col max-h-[92vh] overflow-hidden bg-slate-100 rounded-3xl shadow-2xl" onClick={e => e.stopPropagation()}>
        
        {/* Barra superior de ações */}
        <div className="p-3 sm:p-4 bg-slate-900 text-white flex items-center justify-between print:hidden shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 font-mono text-xs sm:text-sm font-bold">💠 Boleto PIX Condominial</span>
            <span className="text-xs text-gray-400 truncate max-w-[140px] sm:max-w-none">• {condominio?.nome || 'Condomínio'}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button 
              onClick={shareWhatsAppDirect} 
              disabled={enviandoDirectWhats} 
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all"
              title="Disparar PDF e Mensagem automaticamente pelo WhatsApp da Alpha"
            >
              <Share2 size={14} /> {enviandoDirectWhats ? 'Disparando...' : 'Enviar WhatsApp'}
            </button>
            <button onClick={handleDownloadPDF} disabled={downloading} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm">
              <Download size={14} /> {downloading ? 'Gerando...' : 'Baixar PDF'}
            </button>
            <button onClick={() => window.print()} className="hidden sm:flex px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-black items-center gap-1.5 shadow-sm">
              <Printer size={14} /> Imprimir
            </button>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white rounded-lg"><X size={18} /></button>
          </div>
        </div>

        {/* Corpo do Boleto / Fatura (Formatado para tela) */}
        <div 
          id="boleto-print-area" 
          style={{ 
            fontFamily: 'Arial, Helvetica, sans-serif', 
            color: '#0f172a', 
            lineHeight: 1.35,
            width: '100%',
            maxWidth: '740px',
            backgroundColor: '#ffffff'
          }} 
          className="p-5 sm:p-6 text-slate-900 overflow-y-auto flex-1 mx-auto"
        >
          
          {/* Cabeçalho Bancário Oficial com Logo da Alpha */}
          <div className="border-b-2 border-slate-900 pb-2.5 mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <img src="/logo-alpha.png" alt="Alpha Soluções" className="w-12 h-12 object-contain rounded-xl shadow-sm shrink-0 border border-gray-200" />
              <div>
                <h2 className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-tight">
                  ALPHA SOLUÇÕES CONDOMINIAIS LTDA
                </h2>
                <p className="text-[11px] text-gray-600 font-bold mt-0.5">
                  Gestão & Assessoria Condominial &nbsp;•&nbsp; CNPJ: 66.643.272/0001-18
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="inline-block bg-emerald-100 text-emerald-950 border border-emerald-400 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider">
                FATURA / BOLETO PIX
              </span>
              <p className="text-[10px] text-gray-400 font-mono mt-0.5">Recibo do Sacado</p>
            </div>
          </div>

          {/* Dados do Condomínio e Morador em 3 colunas balanceadas */}
          <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-2xl border border-gray-200 text-xs mb-3">
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Condomínio Beneficiário</span>
              <p className="font-bold text-slate-900 text-xs leading-snug break-words">{condominio?.nome || boleto.condominio || 'Condomínio Residencial'}</p>
              <p className="text-[10px] text-gray-600 mt-0.5 leading-snug break-words">{condominio?.endereco || 'Endereço Cadastrado'}</p>
              <p className="text-emerald-700 font-mono text-[10px] font-bold mt-1 break-all">Chave PIX: {chavePixFinal}</p>
            </div>

            <div className="min-w-0">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Pagador / Morador</span>
              <p className="font-bold text-slate-900 text-xs leading-snug break-words">{boleto.morador}</p>
              <p className="text-slate-800 font-bold text-[11px] mt-0.5">Unidade: {boleto.apt ? `Apt ${boleto.apt}` : '—'}</p>
              <p className="text-gray-500 font-mono text-[10px] mt-0.5">Competência: {boleto.competencia || 'Mês Vigente'}</p>
            </div>

            <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-300 flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-black text-emerald-800 uppercase tracking-wider block">Data de Vencimento</span>
                <p className="text-xs font-black text-emerald-950 mt-0.5">{dataVencFormatada}</p>
              </div>
              <div className="mt-1.5 pt-1.5 border-t border-emerald-200/60">
                <span className="text-[9px] font-black text-emerald-800 uppercase tracking-wider block">Total a Pagar</span>
                <p className="text-base font-black text-emerald-700 font-mono">R$ {valorFormatado}</p>
              </div>
            </div>
          </div>

          {/* Demonstrativo da Taxa Condominial */}
          <div className="border border-gray-200 rounded-2xl overflow-hidden mb-3">
            <div className="bg-slate-100 py-1.5 px-3 font-bold text-xs text-gray-800 border-b border-gray-200 flex justify-between items-center">
              <span>Demonstrativo de Composição da Cobrança</span>
              {boleto.multa > 0 && <span className="text-[9px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-bold">2ª Via com Acréscimos</span>}
            </div>
            <div className="p-2.5 divide-y divide-gray-100 text-xs">
              {(() => {
                const deveDiscriminar = boleto.discriminarTaxa !== undefined ? boleto.discriminarTaxa : (condominio?.discriminarTaxa || false)
                const taxaEmissao = deveDiscriminar ? Number(boleto.taxaEmissao || condominio?.taxaEmissao || 3.50) : 0
                const valCheio = Number(boleto.valorOriginal || boleto.valor || 0)
                const cotaBase = Math.max(0, valCheio - taxaEmissao)
                const rawTaxa = boleto.nomeTaxa || condominio?.nomeTaxa || 'Serviço de Cobrança Digital'
                const nomeTaxa = (rawTaxa.includes('Processamento') || rawTaxa.includes('Tarifa')) ? 'Serviço de Cobrança Digital' : rawTaxa

                if (taxaEmissao > 0) {
                  return (
                    <>
                      <div className="py-1 flex justify-between items-center">
                        <span className="text-gray-700 font-medium">Taxa Condominial Ordinária ({boleto.competencia || 'Mês Atual'})</span>
                        <span className="font-bold text-gray-900 font-mono">R$ {cotaBase.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="py-1 flex justify-between items-center text-brand-900 bg-brand-50/70 px-2 rounded-lg">
                        <span className="font-medium">{nomeTaxa}</span>
                        <span className="font-bold font-mono">R$ {taxaEmissao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </>
                  )
                } else {
                  return (
                    <div className="py-1 flex justify-between items-center">
                      <span className="text-gray-700 font-medium">Taxa Ordinária de Condomínio ({boleto.competencia || 'Mês Atual'})</span>
                      <span className="font-bold text-gray-900 font-mono">R$ {valCheio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )
                }
              })()}
              {boleto.multa > 0 && (
                <div className="py-1 flex justify-between items-center text-amber-800">
                  <span className="font-medium">Multa por Atraso (2%)</span>
                  <span className="font-bold font-mono">+ R$ {Number(boleto.multa).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              {boleto.juros > 0 && (
                <div className="py-1 flex justify-between items-center text-amber-800">
                  <span className="font-medium">Juros de Mora (1% a.m.)</span>
                  <span className="font-bold font-mono">+ R$ {Number(boleto.juros).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="py-1.5 flex justify-between items-center font-bold text-xs sm:text-sm bg-slate-50 px-2.5 rounded-lg mt-1 text-slate-900">
                <span>VALOR TOTAL COBRADO</span>
                <span className="text-emerald-700 font-mono text-sm sm:text-base font-black">R$ {valorFormatado}</span>
              </div>
            </div>
          </div>

          {/* ÁREA CENTRAL PIX & QR CODE */}
          <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-slate-50 p-3 rounded-2xl border border-emerald-300 shadow-sm flex items-center gap-4 mb-3">
            
            {/* QR Code */}
            <div className="flex flex-col items-center shrink-0">
              <div className="bg-white p-1.5 rounded-xl border border-emerald-400 shadow-sm">
                <QRCodeSVG value={pixFinal} size={95} level="M" includeMargin={false} />
              </div>
              <span className="text-[8px] font-black uppercase text-emerald-800 mt-1 bg-emerald-100 px-2 py-0.5 rounded-full">
                QR CODE PIX
              </span>
            </div>

            {/* Instruções e Copia e Cola */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <QrCode size={15} className="text-emerald-700 shrink-0" />
                <h4 className="font-bold text-gray-900 text-xs sm:text-sm">Pague via PIX Instantâneo</h4>
              </div>
              <p className="text-[11px] text-gray-600 leading-tight mb-2">
                Aponte a câmera do aplicativo do seu banco para o <b>QR Code</b> ao lado ou utilize o código <b>PIX Copia e Cola</b> abaixo.
              </p>

              {/* Botão Copiar Pix Compacto */}
              <div className="flex gap-2 items-center">
                <button
                  onClick={handleCopyPix}
                  className="py-1 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-[10px] flex items-center gap-1 shadow-sm transition-all active:scale-95 shrink-0 print:hidden"
                >
                  {copied ? <><Check size={12} /> Copiado!</> : <><Copy size={12} /> Copiar Código PIX</>}
                </button>
                <div className="text-[9px] text-gray-600 font-mono bg-white/95 px-2 py-1 rounded-lg border border-gray-300 truncate flex-1 select-all">
                  {pixFinal}
                </div>
              </div>
            </div>
          </div>

          {/* Linha Digitável e Código de Barras Tradicional */}
          <div className="p-2.5 bg-slate-50 rounded-2xl border border-gray-200">
            <div className="flex items-center justify-between text-[10px] text-gray-700 mb-1">
              <span className="font-bold">Linha Digitável / Ficha de Compensação:</span>
              <span className="font-mono font-bold text-slate-900 text-xs">{linhaDigitavel}</span>
            </div>
            <div className="flex justify-center my-1">
              <div className="flex gap-px h-6 w-full max-w-xs justify-center">
                {Array.from({ length: 65 }).map((_, i) => (
                  <div key={i} className="bg-gray-900" style={{ width: (i % 3 === 0 ? 2.5 : i % 5 === 0 ? 3.5 : 1.2) }} />
                ))}
              </div>
            </div>
            <div className="flex justify-between items-center text-[8px] text-gray-500 mt-0.5">
              <span>Autenticação Mecânica &nbsp;•&nbsp; Baixa Automática Instantânea</span>
              <span>Alpha Soluções Condominiais</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

function ModalBoleto({ data, onClose, onSave, moradores = [] }) {
  const [form, setForm] = useState(data || { morador:'', apt:'', vencimento:'', valor:'', status:'Pendente', competencia:'', emitido:false, linha:'', url:'', pix_emv:'', invoice_id:'' })
  const set = (k,v) => setForm(f=>({...f,[k]:v}))
  
  const handleMoradorChange = (e) => {
    const nome = e.target.value
    const mor = moradores.find(m => m.nome === nome)
    if (mor) {
      setForm(f => ({ ...f, morador: nome, apt: mor.apt, condominio: mor.condominio || '' }))
    } else {
      set('morador', nome)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e=>e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">{data?'Editar Boleto':'Novo Boleto'}</h3>
          <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-700"/></button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Morador Responsável (Titular/Inquilino)</label>
            <select className="input" value={form.morador} onChange={handleMoradorChange}>
               <option value="">Selecione um morador cadastrado...</option>
               {moradores.filter(m => m.status !== 'Dependente' && m.tipo !== 'Dependente').map(m => (
                 <option key={m.id} value={m.nome}>{m.nome} (Apt {m.apt || m.unidade || '—'}) {m.status ? `• ${m.status}` : ''}</option>
               ))}
            </select>
          </div>
          <div><label className="label">Unidade / Apt.</label><input className="input" value={form.apt} onChange={e=>set('apt',e.target.value)} placeholder="Ex: 101-A"/></div>
          <div><label className="label">Competência</label><input className="input" value={form.competencia} onChange={e=>set('competencia',e.target.value)} placeholder="Ex: Mar/2025"/></div>
          <div><label className="label">Vencimento</label><input type="date" className="input" value={form.vencimento} onChange={e=>set('vencimento',e.target.value)}/></div>
          <div><label className="label">Valor</label><CurrencyInput value={form.valor} onChange={v=>set('valor',v)} placeholder="0,00"/></div>
          <div className="col-span-2"><label className="label">Status</label>
            <select className="input" value={form.status} onChange={e=>set('status',e.target.value)}>
              <option>Pendente</option><option>Pago</option><option>Vencido</option>
            </select>
          </div>

          <div>
            <label className="label">Condomínio</label>
            <input className="input" value={form.condominio || ''} onChange={e=>set('condominio',e.target.value)} placeholder="Nome do condomínio"/>
          </div>
          <div>
            <label className="label">Chave PIX para Recebimento</label>
            <input className="input" value={form.chave_pix || ''} onChange={e=>set('chave_pix',e.target.value)} placeholder="CNPJ, E-mail, Celular ou Aleatória"/>
          </div>

          <div className="col-span-2 mt-2 pt-4 border-t border-cream-200">
             <label className="flex items-center gap-2 cursor-pointer mb-3">
               <input type="checkbox" checked={form.emitido} onChange={e=>set('emitido', e.target.checked)} className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 w-4 h-4"/>
               <span className="font-bold text-gray-700 text-sm">Boleto gerado externamente (Sem API)</span>
             </label>
             
             {form.emitido && (
               <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-cream-200">
                  <div>
                    <label className="label text-xs">Link do Boleto PDF (Opcional)</label>
                    <input className="input text-xs" value={form.url} onChange={e=>set('url',e.target.value)} placeholder="https://..."/>
                  </div>
                  <div>
                    <label className="label text-xs">PIX Copia e Cola (Opcional)</label>
                    <input className="input text-xs" value={form.pix_emv} onChange={e=>set('pix_emv',e.target.value)} placeholder="0002012658..."/>
                  </div>
               </div>
             )}
          </div>
        </div>
        <div className="p-6 border-t border-cream-300 flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={()=>{if(!form.morador || form.valor === undefined || form.valor === null || form.valor === '') return; onSave(form)}} className="btn-primary">Salvar</button>
        </div>
      </div>
    </div>
  )
}

function ModalGerarLote({ condominios, moradores, initialCondo = '', onClose, onSave }) {
  const condominiosValidos = condominios.filter(c => c && c.nome && c.nome.trim())
  const [condoNome, setCondoNome] = useState(() => {
    if (initialCondo && condominiosValidos.some(c => c.nome === initialCondo)) return initialCondo
    return condominiosValidos[0]?.nome || ''
  })
  const [valorStr, setValorStr] = useState('450,00')
  const [competencia, setCompetencia] = useState(() => {
    const d = new Date()
    return d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '/')
  })
  const [vencimento, setVencimento] = useState(() => {
    const d = new Date()
    d.setDate(10)
    return d.toISOString().split('T')[0]
  })
  
  const condoSelecionado = condominiosValidos.find(c => c.nome === condoNome)
  const [chavePix, setChavePix] = useState(condoSelecionado?.chave_pix || '')
  const [discriminarTaxa, setDiscriminarTaxa] = useState(false)
  const [taxaStr, setTaxaStr] = useState('3,50')
  const [nomeTaxa, setNomeTaxa] = useState('Serviço de Cobrança Digital')
  const [valoresCustom, setValoresCustom] = useState({})
  const [enviarWhatsAppAuto, setEnviarWhatsAppAuto] = useState(true)

  // Dispara apenas quando o usuário TROCA o condomínio no select
  useEffect(() => {
    if (!condoNome) return
    const c = condominios.find(item => item && item.nome === condoNome)
    if (c) {
      if (c.chave_pix) setChavePix(c.chave_pix)
      if (c.discriminarTaxa !== undefined) setDiscriminarTaxa(Boolean(c.discriminarTaxa))
      if (c.taxaEmissao && Number(c.taxaEmissao) > 0) {
        setTaxaStr(String(c.taxaEmissao).replace('.', ','))
      } else {
        setTaxaStr('3,50')
      }
      if (c.nomeTaxa) {
        const n = c.nomeTaxa.includes('Processamento') || c.nomeTaxa.includes('Tarifa') ? 'Serviço de Cobrança Digital' : c.nomeTaxa
        setNomeTaxa(n)
      }
    }
  }, [condoNome])

  // Moradores filtrados estritamente pelo condomínio selecionado
  const normalizeCondo = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()

  const moradoresDoCondo = moradores.filter(m => {
    if (!condoNome) return false
    const cM = normalizeCondo(m.condominio)
    const cMN = normalizeCondo(m.condominioNome)
    const cTarget = normalizeCondo(condoNome)

    const matchCondo = cM === cTarget || cMN === cTarget || (cM && cTarget && (cM.includes(cTarget) || cTarget.includes(cM)))
    const isDependente = m.status === 'Dependente' || m.tipo === 'Dependente' || m.tipoMorador === 'Dependente' || (m.parentesco && m.parentesco !== 'Titular')
    return matchCondo && !isDependente
  })
  
  const [selecionados, setSelecionados] = useState(() => moradoresDoCondo.map(m => m.id))

  useEffect(() => {
    setSelecionados(moradoresDoCondo.map(m => m.id))
  }, [condoNome, moradores.length])

  const toggleMorador = (id) => {
    setSelecionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const toggleTodos = () => {
    if (selecionados.length === moradoresDoCondo.length) {
      setSelecionados([])
    } else {
      setSelecionados(moradoresDoCondo.map(m => m.id))
    }
  }

  const handleCustomValChange = (id, val) => {
    setValoresCustom(prev => ({ ...prev, [id]: val }))
  }

  const handleToggleTaxa = () => {
    setDiscriminarTaxa(prev => {
      const next = !prev
      if (next && (!taxaStr || taxaStr === '0,00' || taxaStr === '0')) {
        setTaxaStr('3,50')
      }
      return next
    })
  }

  const handleGerar = () => {
    const valorPadraoNum = typeof valorStr === 'number' ? valorStr : (parseFloat(String(valorStr || '').replace(/\./g, '').replace(',', '.')) || 0)
    let taxaNum = typeof taxaStr === 'number' ? taxaStr : (parseFloat(String(taxaStr || '').replace(/\./g, '').replace(',', '.')) || 3.50)
    if (taxaNum <= 0 && discriminarTaxa) taxaNum = 3.50
    
    if (valorPadraoNum < 0) {
      alert("Por favor, informe um valor válido para a taxa condominial.")
      return
    }
    if (!vencimento) {
      alert("Informe a data de vencimento.")
      return
    }
    if (selecionados.length === 0) {
      alert("Selecione pelo menos um morador.")
      return
    }

    const listaParaCriar = moradoresDoCondo
      .filter(m => selecionados.includes(m.id))
      .map(m => {
        const valMoradorRaw = valoresCustom[m.id] !== undefined ? valoresCustom[m.id] : valorStr
        const valFinal = typeof valMoradorRaw === 'number' ? valMoradorRaw : (parseFloat(String(valMoradorRaw || '').replace(/\./g, '').replace(',', '.')) || valorPadraoNum)
        const rawTel = m.tel || m.telefone || m.whatsapp || m.celular || m.fone || m.contato || m.numero || ''

        return {
          moradorId: m.id,
          morador: m.nome,
          telefone: rawTel,
          email: m.email || '',
          apt: m.apt || m.unidade || '',
          condominio: condoNome,
          competencia,
          vencimento,
          valor: valFinal,
          valorOriginal: valFinal,
          chave_pix: chavePix,
          status: 'Pendente',
          emitido: true,
          discriminarTaxa: Boolean(discriminarTaxa),
          taxaEmissao: discriminarTaxa ? taxaNum : 0,
          nomeTaxa: nomeTaxa || 'Serviço de Cobrança Digital',
          linha: gerarLinhaDigitavel(m.apt || '101', valFinal, vencimento),
          pix_emv: generateStaticPix(chavePix, valFinal, condoNome, "BR"),
          _createdAt: new Date().toISOString()
        }
      })

    onSave(listaParaCriar, enviarWhatsAppAuto)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-2xl w-[95vw] sm:w-full p-0 flex flex-col max-h-[92vh] overflow-hidden bg-white rounded-3xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-black text-base sm:text-lg flex items-center gap-2">
              📦 Gerar Boletos do Mês em Lote
            </h3>
            <p className="text-[11px] sm:text-xs text-gray-400">Emissão em massa com QR Code PIX individual e valores editáveis por morador</p>
          </div>
          <button onClick={onClose}><X size={20} className="text-gray-400 hover:text-white" /></button>
        </div>

        <div className="p-4 sm:p-6 flex flex-col gap-4 overflow-y-auto flex-1">
          {/* Seleção do Condomínio */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 sm:p-4 rounded-2xl border border-gray-200">
            <div>
              <label className="label text-xs font-black">Condomínio *</label>
              <select className="input text-xs font-bold w-full bg-white" value={condoNome} onChange={e => setCondoNome(e.target.value)}>
                {condominiosValidos.length === 0 && <option value="">Nenhum condomínio cadastrado</option>}
                {condominiosValidos.map(c => <option key={c.id || c.nome} value={c.nome}>{c.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="label text-xs font-black">Chave PIX de Recebimento</label>
              <input className="input text-xs w-full bg-white" value={chavePix} onChange={e => setChavePix(e.target.value)} placeholder="CNPJ, E-mail ou Celular" />
            </div>
          </div>

          {/* Dados da Cobrança */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label text-xs font-black">Valor Padrão da Cota (R$) *</label>
              <CurrencyInput value={valorStr} onChange={v => setValorStr(v)} placeholder="0,00" />
            </div>
            <div>
              <label className="label text-xs font-black">Competência *</label>
              <input className="input text-xs font-bold w-full" value={competencia} onChange={e => setCompetencia(e.target.value)} placeholder="Ex: Set/2026" />
            </div>
            <div>
              <label className="label text-xs font-black">Data de Vencimento *</label>
              <input type="date" className="input text-xs font-bold w-full" value={vencimento} onChange={e => setVencimento(e.target.value)} />
            </div>
          </div>

          {/* Opção de Taxa Discriminada (CLICÁVEL EM QUALQUER LUGAR DO CARD) */}
          <div 
            onClick={handleToggleTaxa}
            className={`p-4 rounded-2xl border-2 transition-all cursor-pointer select-none shadow-sm flex flex-col gap-2 ${
              discriminarTaxa 
                ? 'bg-brand-50/90 border-brand-500 ring-2 ring-brand-200' 
                : 'bg-slate-50/90 border-slate-300 hover:border-brand-300 hover:bg-slate-100/80'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="check-taxa-lote"
                  checked={discriminarTaxa}
                  onChange={handleToggleTaxa}
                  onClick={e => e.stopPropagation()}
                  className="w-5 h-5 text-brand-600 rounded border-gray-300 focus:ring-brand-500 cursor-pointer shrink-0"
                />
                <span className="text-xs sm:text-sm font-black text-gray-900">
                  Serviço de Cobrança Digital (R$ {taxaStr && taxaStr !== '0,00' && taxaStr !== '0' ? maskCurrency(taxaStr) : '3,50'})
                </span>
              </div>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${discriminarTaxa ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {discriminarTaxa ? 'Ativado' : 'Desativado'}
              </span>
            </div>

            <p className="text-[11px] text-gray-600 ml-8 leading-relaxed">
              Marque para discriminar o <b>Serviço de Cobrança Digital</b> no demonstrativo do boleto.
            </p>

            {discriminarTaxa && (
              <div 
                onClick={e => e.stopPropagation()} 
                className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 ml-0 sm:ml-8 bg-white p-3.5 rounded-xl border border-brand-200 animate-fade-in shadow-inner"
              >
                <div>
                  <label className="label text-[10px] font-black text-brand-950">Valor do Serviço por Boleto (R$)</label>
                  <CurrencyInput 
                    value={taxaStr || '3,50'} 
                    onChange={v => setTaxaStr(v || '3,50')} 
                    placeholder="3,50" 
                  />
                </div>
                <div>
                  <label className="label text-[10px] font-black text-brand-950">Descrição no Boleto</label>
                  <input 
                    className="input text-xs text-gray-900 font-bold bg-slate-50" 
                    value={nomeTaxa} 
                    onChange={e => setNomeTaxa(e.target.value)} 
                    placeholder="Serviço de Cobrança Digital" 
                  />
                </div>
              </div>
            )}
          </div>

          {/* Opção de Disparo Automático por WhatsApp */}
          <div 
            onClick={() => setEnviarWhatsAppAuto(p => !p)}
            className={`p-4 rounded-2xl border-2 transition-all cursor-pointer select-none shadow-sm flex flex-col gap-1.5 ${
              enviarWhatsAppAuto 
                ? 'bg-emerald-50/90 border-emerald-500 ring-2 ring-emerald-200' 
                : 'bg-slate-50 border-slate-300 hover:border-emerald-300'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="check-whatsapp-auto"
                  checked={enviarWhatsAppAuto}
                  onChange={() => setEnviarWhatsAppAuto(p => !p)}
                  onClick={e => e.stopPropagation()}
                  className="w-5 h-5 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500 cursor-pointer shrink-0"
                />
                <span className="text-xs sm:text-sm font-black text-emerald-950 flex items-center gap-1.5">
                  🚀 Disparar boletos automaticamente via WhatsApp ao gerar
                </span>
              </div>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${enviarWhatsAppAuto ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {enviarWhatsAppAuto ? 'Ativado' : 'Desativado'}
              </span>
            </div>
            <p className="text-[11px] text-emerald-800 ml-8 leading-relaxed">
              O sistema gera o <b>PDF oficial</b> e entrega instantaneamente no WhatsApp de cada morador com QR Code PIX!
            </p>
          </div>

          {/* Lista de Moradores */}
          <div className="border border-gray-200 rounded-2xl overflow-hidden mt-1">
            <div className="p-3 bg-slate-100 border-b border-gray-200 flex items-center justify-between">
              <span className="text-xs font-black text-gray-800">
                👥 Moradores ({selecionados.length} de {moradoresDoCondo.length} selecionados)
              </span>
              <button onClick={toggleTodos} className="text-xs font-bold text-brand-600 hover:text-brand-800">
                {selecionados.length === moradoresDoCondo.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto divide-y divide-gray-100">
              {moradoresDoCondo.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400">
                  Nenhum morador titular cadastrado para este condomínio.
                </div>
              ) : (
                moradoresDoCondo.map(m => {
                  const isSel = selecionados.includes(m.id)
                  const rawTel = m.tel || m.telefone || m.whatsapp || m.celular || m.fone || ''
                  const temWhats = rawTel && rawTel.replace(/\D/g, '').length >= 10

                  return (
                    <div 
                      key={m.id} 
                      onClick={() => toggleMorador(m.id)}
                      className={`p-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 transition-colors ${isSel ? 'bg-brand-50/30' : 'opacity-60'}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => {}}
                          onClick={e => { e.stopPropagation(); toggleMorador(m.id); }}
                          className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500 cursor-pointer"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-900 truncate">
                            {m.nome} <span className="text-gray-400 font-normal">(Apt {m.apt || m.unidade || '—'})</span>
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-gray-500 font-mono">{rawTel || 'Sem WhatsApp'}</span>
                            {temWhats ? (
                              <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.2 rounded">WhatsApp ✓</span>
                            ) : (
                              <span className="text-[9px] text-amber-600 font-bold bg-amber-50 px-1.5 py-0.2 rounded">Sem número</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                        <label className="text-[10px] text-gray-500 font-bold hidden sm:inline">Valor (R$):</label>
                        <div className="w-24">
                          <CurrencyInput
                            value={valoresCustom[m.id] !== undefined ? valoresCustom[m.id] : valorStr}
                            onChange={v => handleCustomValChange(m.id, v)}
                            placeholder="0,00"
                          />
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 border-t border-gray-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
          <button onClick={onClose} className="btn-secondary text-xs">Cancelar</button>
          <button
            onClick={handleGerar}
            className="btn-primary text-xs font-black bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-700/20 py-2.5 px-5 flex items-center gap-2 cursor-pointer"
          >
            <CheckCircle2 size={16} /> Gerar {selecionados.length} {selecionados.length === 1 ? 'Boleto' : 'Boletos'} {enviarWhatsAppAuto ? 'e Enviar WhatsApp' : ''}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Boletos() {
  const { user } = useAuth()
  const { items: allBoletos, addItem, updateItem, deleteItem } = useFirestore('boletos')
  const { items: allCondominios, updateItem: updateCondominio } = useFirestore('condominios')
  const { items: allMoradoresDocs } = useFirestore('moradores')
  const { items: allUsuariosDocs } = useFirestore('usuarios')

  // Fonte oficial de moradores do condomínio para emissão de boletos: coleção 'moradores'
  const moradores = allMoradoresDocs

  const [tab, setTab] = useState('boletos')
  const [condoFilter, setCondoFilter] = useState('Todos')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [viewing, setViewing] = useState(null)
  const [modal, setModal] = useState(null)
  const [modalLote, setModalLote] = useState(false)
  const [condoFundoEdit, setCondoFundoEdit] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [downloadingLote, setDownloadingLote] = useState(false)
  const [showRepasses, setShowRepasses] = useState(false)
  const [progressoLote, setProgressoLote] = useState(null)

  const handleSaveLote = async (lista, dispararWhatsApp = false) => {
    let criados = 0
    let enviadosWhats = 0
    let falhasWhats = 0

    try {
      if (dispararWhatsApp) {
        setProgressoLote({ total: lista.length, atual: 0, morador: 'Iniciando gravação no sistema...' })
      }

      for (let i = 0; i < lista.length; i++) {
        const b = lista[i]
        const docRef = await addItem(b)
        const novoBoleto = { ...b, id: docRef?.id || b.id }
        criados++

        if (dispararWhatsApp) {
          setProgressoLote({ total: lista.length, atual: i + 1, morador: b.morador })
          const moradorDoc = (b.moradorId && moradores.find(m => m.id === b.moradorId))
            || moradores.find(m => (m.nome && b.morador && m.nome.trim().toLowerCase() === b.morador.trim().toLowerCase()) || (m.apt && b.apt && String(m.apt).trim() === String(b.apt).trim()))
            || { nome: b.morador, tel: b.telefone, apt: b.apt, condominio: b.condominio }
          const condoDoc = allCondominios.find(c => c.nome === b.condominio)
          
          try {
            const res = await enviarBoletoWhatsAppAuto(novoBoleto, moradorDoc, condoDoc)
            if (res.success) {
              enviadosWhats++
            } else {
              console.warn('Falha envio WhatsApp:', b.morador, res.error)
              falhasWhats++
            }
          } catch (err) {
            console.error('Erro individual WhatsApp:', err)
            falhasWhats++
          }
        }
      }
    } catch(err) {
      console.error('Erro geral ao processar lote:', err)
    } finally {
      setProgressoLote(null)
      setModalLote(false)
    }
    
    if (dispararWhatsApp) {
      if (enviadosWhats > 0) {
        alert(`🎉 Geração & Disparo Concluídos!\n\n📄 ${criados} boletos gerados no sistema.\n📲 ${enviadosWhats} boletos em PDF entregues com sucesso via WhatsApp oficial!\n${falhasWhats > 0 ? `⚠️ ${falhasWhats} envios pendentes/sem contato.` : ''}`)
      } else {
        alert(`📄 ${criados} boletos gerados com sucesso!\n⚠️ O envio automático via WhatsApp não foi concluído para ${falhasWhats} moradores (verifique se o morador possui DDD e número válido cadastrado).`)
      }
    } else {
      alert(`🎉 Sucesso! ${criados} boletos PIX foram gerados com sucesso para os moradores selecionados!`)
    }
  }

  const handleDownloadPDFLote = async (boletosParaBaixar) => {
    if (!boletosParaBaixar || boletosParaBaixar.length === 0) {
      alert("Selecione pelo menos um boleto para baixar.")
      return
    }

    try {
      setDownloadingLote(true)
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pdfWidth = pdf.internal.pageSize.getWidth()

      const container = document.createElement('div')
      container.style.position = 'fixed'
      container.style.top = '-9999px'
      container.style.left = '-9999px'
      container.style.width = '780px'
      container.style.backgroundColor = '#ffffff'
      container.style.padding = '20px'
      document.body.appendChild(container)

      for (let i = 0; i < boletosParaBaixar.length; i++) {
        const b = boletosParaBaixar[i]
        const condoDoc = allCondominios.find(c => c.nome === b.condominio) || allCondominios[0]
        const chavePix = b.chave_pix || condoDoc?.chave_pix || 'alpha.solucoes@condominios.com.br'
        const pixPayload = generateStaticPix(chavePix, Number(b.valor || 0), condoDoc?.nome || b.condominio || "Alpha Solucoes", "BR")
        const linha = b.linha || gerarLinhaDigitavel(b.apt, b.valor, b.vencimento)
        const valorFmt = Number(b.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
        const vencFmt = b.vencimento ? (b.vencimento.includes('-') ? b.vencimento.split('-').reverse().join('/') : b.vencimento) : '—'
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(pixPayload)}`

        container.innerHTML = `
          <div style="font-family: Arial, sans-serif; color: #0f172a; padding: 24px; background: #fff; border: 1px solid #cbd5e1; border-radius: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <img src="/logo-alpha.png" width="48" height="48" style="object-fit: contain; border-radius: 10px;" />
                <div>
                  <h2 style="margin: 0; font-size: 17px; font-weight: 900; color: #0f172a;">ALPHA SOLUÇÕES CONDOMINIAIS LTDA</h2>
                  <p style="margin: 2px 0 0; font-size: 11px; color: #64748b; font-weight: bold;">Gestão & Administração de Condomínios</p>
                  <p style="margin: 2px 0 0; font-size: 10px; color: #64748b; font-family: monospace; font-weight: bold;">CNPJ: 66.643.272/0001-18</p>
                </div>
              </div>
              <div style="text-align: right;">
                <span style="display: inline-block; background: #dcfce7; color: #166534; border: 1px solid #86efac; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 900; text-transform: uppercase;">Fatura / Boleto PIX</span>
                <p style="margin: 4px 0 0; font-size: 11px; color: #94a3b8; font-family: monospace;">Recibo do Sacado</p>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; background: #f8fafc; padding: 14px; border-radius: 12px; border: 1px solid #e2e8f0; font-size: 12px; margin-bottom: 16px;">
              <div>
                <span style="font-size: 10px; font-weight: bold; color: #94a3b8; text-transform: uppercase;">Condomínio Beneficiário</span>
                <p style="margin: 4px 0 0; font-weight: 900; font-size: 13px; color: #0f172a;">${b.condominio || condoDoc?.nome || 'Condomínio Residencial'}</p>
                <p style="margin: 2px 0 0; color: #64748b;">${condoDoc?.endereco || 'Endereço Cadastrado'}</p>
                <p style="margin: 4px 0 0; color: #047857; font-weight: bold; font-family: monospace;">Chave Pix: ${chavePix}</p>
              </div>
              <div>
                <span style="font-size: 10px; font-weight: bold; color: #94a3b8; text-transform: uppercase;">Pagador / Morador</span>
                <p style="margin: 4px 0 0; font-weight: 900; font-size: 13px; color: #0f172a;">${b.morador}</p>
                <p style="margin: 2px 0 0; color: #334155; font-weight: bold;">Unidade: ${b.apt ? 'Apt ' + b.apt : '—'}</p>
                <p style="margin: 4px 0 0; color: #64748b; font-family: monospace;">Competência: ${b.competencia || 'Mês Vigente'}</p>
              </div>
              <div style="background: #ecfdf5; padding: 10px; border-radius: 10px; border: 1px solid #a7f3d0;">
                <div>
                  <span style="font-size: 10px; font-weight: bold; color: #065f46; text-transform: uppercase;">Vencimento</span>
                  <p style="margin: 2px 0 0; font-weight: 900; font-size: 14px; color: #0f172a;">${vencFmt}</p>
                </div>
                <div style="margin-top: 8px;">
                  <span style="font-size: 10px; font-weight: bold; color: #065f46; text-transform: uppercase;">Valor Total a Pagar</span>
                  <p style="margin: 2px 0 0; font-weight: 900; font-size: 18px; color: #047857;">R$ ${valorFmt}</p>
                </div>
              </div>
            </div>

            <div style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 16px;">
              <div style="background: #f1f5f9; padding: 8px 12px; font-weight: bold; font-size: 11px; color: #475569; text-transform: uppercase;">Composição da Taxa Condominial</div>
              <div style="padding: 10px 14px; font-size: 12px;">
                ${(() => {
                  const deveDiscriminar = b.discriminarTaxa !== undefined ? b.discriminarTaxa : (condoDoc?.discriminarTaxa || false)
                  const taxaEmissao = deveDiscriminar ? Number(b.taxaEmissao || condoDoc?.taxaEmissao || 3.50) : 0
                  const valCheio = Number(b.valor || 0)
                  const cotaBase = Math.max(0, valCheio - taxaEmissao)
                  const nomeTaxa = b.nomeTaxa || condoDoc?.nomeTaxa || 'Tarifa de Processamento Digital e Sistema'

                  if (taxaEmissao > 0) {
                    return `
                      <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #e2e8f0;">
                        <span>Taxa Condominial Ordinária (${b.competencia || 'Mês Atual'})</span>
                        <span style="font-family: monospace; font-weight: bold;">R$ ${cotaBase.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #e2e8f0; color: #475569;">
                        <span>${nomeTaxa}</span>
                        <span style="font-family: monospace; font-weight: bold;">R$ ${taxaEmissao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    `
                  } else {
                    return `
                      <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #e2e8f0;">
                        <span>Taxa Ordinária de Condomínio (${b.competencia || 'Mês Atual'})</span>
                        <span style="font-family: monospace; font-weight: bold;">R$ ${valCheio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    `
                  }
                })()}
                <div style="display: flex; justify-content: space-between; padding: 6px 0 0; font-weight: 900; font-size: 13px;">
                  <span>TOTAL LIQUIDO</span>
                  <span style="font-family: monospace; color: #047857;">R$ ${valorFmt}</span>
                </div>
              </div>
            </div>

            <div style="display: flex; gap: 16px; background: #f8fafc; padding: 14px; border-radius: 12px; border: 2px dashed #94a3b8; margin-bottom: 16px; align-items: center;">
              <div style="background: #fff; padding: 8px; border-radius: 10px; border: 1px solid #cbd5e1; text-align: center;">
                <img src="${qrUrl}" width="125" height="125" style="display: block;" />
                <span style="font-size: 9px; font-weight: bold; color: #047857; display: block; margin-top: 4px;">PAGAMENTO INSTANTÂNEO</span>
              </div>
              <div style="flex: 1; font-size: 11px;">
                <h4 style="margin: 0 0 6px; font-size: 13px; font-weight: 900; color: #0f172a;">💠 Instruções de Pagamento via PIX</h4>
                <p style="margin: 0 0 8px; color: #475569; line-height: 1.4;">1. Abra o aplicativo do seu banco no celular.<br/>2. Escolha a opção <b>PIX</b> e aponte a câmera para o <b>QR Code</b> ou utilize a chave copia e cola.<br/>3. A compensação é <b>imediata</b> (24h por dia, 7 dias por semana).</p>
                <div style="background: #e2e8f0; padding: 8px; border-radius: 8px; font-family: monospace; font-size: 9px; word-break: break-all; color: #1e293b;">
                  ${pixPayload}
                </div>
              </div>
            </div>

            <div style="border-top: 2px solid #0f172a; padding-top: 10px; font-size: 11px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span style="font-weight: 900; color: #1e3a8a; font-size: 13px;">ALPHA 001-9</span>
                <span style="font-family: monospace; font-weight: bold; font-size: 12px; letter-spacing: 1px;">${linha}</span>
              </div>
              <div style="display: flex; justify-content: space-between; color: #64748b; font-size: 10px;">
                <span>Autenticação Mecânica / Ficha de Compensação</span>
                <span>Alpha Soluções Condominiais • Suporte: contato@alphasolucoes.com.br</span>
              </div>
            </div>
          </div>
        `

        await new Promise(r => setTimeout(r, 200))
        const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
        const imgData = canvas.toDataURL('image/png')
        if (i > 0) pdf.addPage()
        const imgHeight = (canvas.height * pdfWidth) / canvas.width
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, Math.min(imgHeight, 295))
      }

      document.body.removeChild(container)
      const condoNome = condoFilter && condoFilter !== 'Todos' ? condoFilter.replace(/\s+/g, '_') : 'Condominio'
      pdf.save(`Boletos_${condoNome}_Lote_${boletosParaBaixar.length}_faturas.pdf`)
      setDownloadingLote(false)
      alert(`🎉 Download concluído! Arquivo PDF consolidado com ${boletosParaBaixar.length} boletos gerado com sucesso!`)
    } catch(err) {
      console.error(err)
      setDownloadingLote(false)
      alert('Erro ao gerar o arquivo PDF consolidado.')
    }
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === boletos.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(boletos.map(b => b.id))
    }
  }

  const toggleSelectBoleto = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(x => x !== id))
    } else {
      setSelectedIds([...selectedIds, id])
    }
  }

  const boletosFiltradosPorCondo = allBoletos.filter(b => {
    if (user?.role === 'Morador') {
      const uNome = (user?.nome || '').toLowerCase().trim()
      const uAptDigits = String(user?.apt || user?.unidade || '').replace(/\D/g, '')
      const uEmail = (user?.email || '').toLowerCase().trim()
      const bMorador = (b.morador || '').toLowerCase().trim()
      const bAptDigits = String(b.apt || b.unidade || '').replace(/\D/g, '')
      const bEmail = (b.email || '').toLowerCase().trim()

      const matchEmail = uEmail && bEmail && uEmail === bEmail
      const matchApt = uAptDigits && bAptDigits && uAptDigits === bAptDigits
      const matchNome = uNome && bMorador && (uNome === bMorador || uNome.includes(bMorador) || bMorador.includes(uNome))

      return matchEmail || matchApt || matchNome
    }

    if (['Síndico', 'Subsíndico', 'Conselheiro'].includes(user?.role)) {
       const moradorDoc = moradores.find(m => m.nome === b.morador);
       const bCondo = b.condominio || moradorDoc?.condominio;
       return !bCondo || bCondo === user?.condominio;
    }
    if (condoFilter && condoFilter !== 'Todos') {
       const moradorDoc = moradores.find(m => m.nome === b.morador);
       const bCondo = b.condominio || moradorDoc?.condominio;
       return bCondo === condoFilter;
    }
    return true;
  })

  const pago     = boletosFiltradosPorCondo.filter(b=>b.status==='Pago').length
  const pendente = boletosFiltradosPorCondo.filter(b=>b.status==='Pendente').length
  const vencido  = boletosFiltradosPorCondo.filter(b=>b.status==='Vencido').length

  const boletos = boletosFiltradosPorCondo.filter(b => {
    if (statusFilter === 'Todos') return true
    if (statusFilter === 'Pago') return b.status === 'Pago'
    if (statusFilter === 'Pendente') return b.status === 'Pendente'
    if (statusFilter === 'Vencido') return b.status === 'Vencido'
    if (statusFilter === 'OFX') return b.status === 'Pago' && b.metodoBaixa === 'Extrato OFX'
    return true
  })

  const condominios = allCondominios.filter(c => {
    if (user?.role === 'Morador') {
      const uCondo = (user?.condominio || '').toLowerCase().trim()
      const cNome = (c.nome || '').toLowerCase().trim()
      return !uCondo || cNome === uCondo || cNome.includes(uCondo) || uCondo.includes(cNome)
    }
    if (['Síndico', 'Subsíndico', 'Conselheiro'].includes(user?.role)) {
      const uCondo = (user?.condominio || '').toLowerCase().trim()
      const cNome = (c.nome || '').toLowerCase().trim()
      return !uCondo || cNome === uCondo || cNome.includes(uCondo) || uCondo.includes(cNome)
    }
    if (condoFilter && condoFilter !== 'Todos') return c.nome === condoFilter;
    return true;
  })

  const uniqueCondos = Array.from(new Set(allCondominios.map(c=>c.nome).filter(Boolean)))

  // ── Alertas de vencimento ao carregar ────────────────────────────────────
  useEffect(() => {
    if (!boletos.length) return
    const hoje = new Date(); hoje.setHours(0,0,0,0)
    boletos.forEach(async b => {
      if (b.status === 'Pago' || !b.vencimento) return
      const venc = new Date(b.vencimento + 'T12:00:00')
      const diff = Math.round((venc - hoje) / 86400000)
      
      const moradorDoc = moradores.find(m => m.nome === b.morador);
      const bCondo = b.condominio || moradorDoc?.condominio || '';

      if (diff === 5 && !b.notif5d) {
        const msg = `Boleto vencendo em 5 dias – ${b.morador} (Apt ${b.apt}), R$ ${fmt(b.valor)}, venc. ${b.vencimento}`
        await addDoc(collection(db,'notificacoes'),{text:msg,time:new Date().toISOString(),tipo:'boleto',lida:false,_createdAt:serverTimestamp(), condominio: bCondo, moradorNome: b.morador})
        await updateItem(b.id, { notif5d: true })
        notificarAdm('⚠️ Boleto vencendo em 5 dias',msg)
        fetch('/api/onesignal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: '⚠️ Boleto Vencendo em 5 Dias', message: msg, targetUrl: '/boletos' })
        }).catch(() => {})
      } else if (diff === 0 && !b.notif0d) {
        const msg = `🔴 VENCE HOJE – Boleto ${b.morador} (Apt ${b.apt}), R$ ${fmt(b.valor)}`
        await addDoc(collection(db,'notificacoes'),{text:msg,time:new Date().toISOString(),tipo:'boleto',lida:false,_createdAt:serverTimestamp(), condominio: bCondo, moradorNome: b.morador})
        await updateItem(b.id, { notif0d: true })
        notificarAdm('🔴 Boleto vence HOJE',msg)
        fetch('/api/onesignal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: '🔴 Boleto Vence HOJE', message: msg, targetUrl: '/boletos' })
        }).catch(() => {})
      } else if (diff < 0 && !b.notifAtraso && b.status !== 'Vencido') {
        // Marca o boleto como vencido automaticamente no sistema também
        const msg = `⛔ BOLETO ATRASADO – Boleto ${b.morador} (Apt ${b.apt}), R$ ${fmt(b.valor)} vencido em ${b.vencimento}`
        await addDoc(collection(db,'notificacoes'),{text:msg,time:new Date().toISOString(),tipo:'boleto',lida:false,_createdAt:serverTimestamp(), condominio: bCondo, moradorNome: b.morador})
        await updateItem(b.id, { status: 'Vencido', notifAtraso: true })
        notificarAdm('⛔ Boleto Atrasado',msg)
        fetch('/api/onesignal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: '⛔ Boleto em Atraso', message: msg, targetUrl: '/boletos' })
        }).catch(() => {})
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boletos.length])

  const emitirBoleto = async b => {
    try {
      const mor = moradores.find(m => m.nome === b.morador)
      const condoDoc = allCondominios.find(c => c.nome === (b.condominio || mor?.condominio))
      const chavePix = condoDoc?.chave_pix || 'alpha.solucoes@condominios.com.br'
      
      const linha = b.linha || gerarLinhaDigitavel(b.apt, b.valor, b.vencimento)
      const pix = b.pix_emv || generateStaticPix(chavePix, b.valor, condoDoc?.nome || "Alpha Solucoes", "BR")

      // Tenta chamar a API do Cora se houver credenciais
      let emitiuCora = false
      try {
        const res = await fetch('/api/cora/emitir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome: b.morador,
            cpf: mor?.cpf || '000.000.000-00',
            email: mor?.email || '',
            valor: b.valor,
            vencimento: b.vencimento,
            descricao: `Taxa de Condomínio - ${b.competencia || 'Mês'}`
          })
        })
        const data = await res.json()
        if (data.success) {
          await updateItem(b.id, {
            ...b, emitido: true, linha: data.barcode || linha, url: data.url || '', pix_emv: data.pix_emv || pix, invoice_id: data.invoice_id || ''
          })
          emitiuCora = true
        }
      } catch(e) {}

      if (!emitiuCora) {
        // Ativa como Boleto / Fatura PIX Oficial da Alpha
        await updateItem(b.id, {
          ...b, emitido: true, linha, pix_emv: pix
        })
      }

      setViewing({ ...b, emitido: true, linha, pix_emv: pix })
      alert("✅ Boleto PIX gerado com sucesso! Já está pronto para visualização, impressão e envio por WhatsApp.")
    } catch (err) {
      console.error(err)
      alert("Falha ao gerar boleto. Tente novamente.")
    }
  }
  
  const emitirLote = async () => {
    for (const b of boletos) {
      if (!b.emitido) {
        const mor = moradores.find(m => m.nome === b.morador)
        const condoDoc = allCondominios.find(c => c.nome === (b.condominio || mor?.condominio))
        const chavePix = condoDoc?.chave_pix || 'alpha.solucoes@condominios.com.br'
        const linha = b.linha || gerarLinhaDigitavel(b.apt, b.valor, b.vencimento)
        const pix = b.pix_emv || generateStaticPix(chavePix, b.valor, condoDoc?.nome || "Alpha Solucoes", "BR")
        await updateItem(b.id, { ...b, emitido: true, linha, pix_emv: pix })
      }
    }
    alert("✅ Todos os boletos foram ativados como Boleto PIX Oficial com sucesso!")
  }

  const enviarWhats = b => {
    const mor = moradores.find(m => m.nome === b.morador)
    const condoDoc = allCondominios.find(c => c.nome === (b.condominio || mor?.condominio))
    const chavePix = condoDoc?.chave_pix || 'alpha.solucoes@condominios.com.br'
    const pix = b.pix_emv || generateStaticPix(chavePix, b.valor, condoDoc?.nome || "Alpha Solucoes", "BR")
    const valorFormatado = Number(b.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
    const dataVenc = b.vencimento ? (b.vencimento.includes('-') ? b.vencimento.split('-').reverse().join('/') : b.vencimento) : '—'

    const msg = `*Alpha Soluções Condominiais*\nOlá *${b.morador}* (Apt ${b.apt}), segue sua fatura referente a *${b.competencia || 'Taxa Condominial'}*:\n\n💰 *Valor:* R$ ${valorFormatado}\n📅 *Vencimento:* ${dataVenc}\n\n💠 *PIX Copia e Cola:*\n\`\`\`${pix}\`\`\`\n\nAbra o aplicativo do seu banco, escolha *PIX Copia e Cola* e cole o código acima para efetuar o pagamento.`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }
  const marcarPago  = async b => updateItem(b.id,{...b,status:'Pago'})
  
  const handleSaveBoleto = async form => {
    const val = Number(form.valor) || 0
    const mor = moradores.find(m => m.nome === form.morador)
    const condoDoc = allCondominios.find(c => c.nome === (form.condominio || mor?.condominio))
    const chavePix = form.chave_pix || condoDoc?.chave_pix || 'alpha.solucoes@condominios.com.br'
    const condoFinal = form.condominio || condoDoc?.nome || mor?.condominio || "Alpha Condomínios"
    
    const clean = {
      ...form,
      valor: val,
      condominio: condoFinal,
      linha: form.linha || gerarLinhaDigitavel(form.apt || '101', val, form.vencimento),
      pix_emv: generateStaticPix(chavePix, val, condoFinal, "BR"),
      emitido: true
    }
    if (modal !== 'new') await updateItem(modal.id, clean); else await addItem(clean)
    setModal(null)
    alert(`🎉 Boleto Salvo com Sucesso!\n\n👤 Morador: ${clean.morador} (Apt ${clean.apt || '—'})\n🏢 Condomínio: ${clean.condominio}\n💰 Valor: R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)
  }
  
  const gerarSegundaVia = async b => {
    const valorBase = Number(b.valorOriginal || b.valor || 0)
    const hoje = new Date()
    const hojeStr = hoje.toISOString().split('T')[0]
    
    let diasAtraso = 1
    if (b.vencimento) {
      const dataVenc = new Date(b.vencimento + 'T12:00:00')
      diasAtraso = Math.max(1, Math.floor((hoje - dataVenc) / 86400000))
    }

    // Multa padrão de 2% (Art. 1336 Código Civil)
    const multa = Number((valorBase * 0.02).toFixed(2))
    // Juros de mora de 1% ao mês (0,033% ao dia de atraso)
    const juros = Number((valorBase * (0.01 / 30) * diasAtraso).toFixed(2))
    const novoValor = Number((valorBase + multa + juros).toFixed(2))

    const msgConfirm = `📄 EMISSÃO DE 2ª VIA ATUALIZADA\n\n` +
      `👤 Morador: ${b.morador} (Apt ${b.apt})\n` +
      `📅 Vencimento Original: ${b.vencimento}\n` +
      `⏳ Dias em Atraso: ${diasAtraso} dia(s)\n\n` +
      `💵 Valor Original: R$ ${valorBase.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
      `📌 Multa por Atraso (2%): R$ ${multa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
      `📈 Juros de Mora (1% a.m.): R$ ${juros.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💰 NOVO VALOR TOTAL: R$ ${novoValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
      `📅 Novo Vencimento: HOJE\n\n` +
      `Deseja gerar a 2ª via com o novo QR Code PIX atualizado agora?`

    if (window.confirm(msgConfirm)) {
      const mor = moradores.find(m => m.nome === b.morador)
      const condoDoc = allCondominios.find(c => c.nome === (b.condominio || mor?.condominio))
      const chavePix = b.chave_pix || condoDoc?.chave_pix || 'alpha.solucoes@condominios.com.br'
      const condoFinal = b.condominio || condoDoc?.nome || "Alpha Condomínios"

      const boletoAtualizado = {
        ...b,
        vencimento: hojeStr,
        valorOriginal: valorBase,
        valor: novoValor,
        multa: multa,
        juros: juros,
        diasAtraso: diasAtraso,
        status: 'Pendente',
        emitido: true,
        notifAtraso: false,
        linha: gerarLinhaDigitavel(b.apt, novoValor, hojeStr),
        pix_emv: generateStaticPix(chavePix, novoValor, condoFinal, "BR")
      }

      await updateItem(b.id, boletoAtualizado)
      setViewing(boletoAtualizado)
      alert(`🎉 2ª Via Gerada com Sucesso!\n\nNovo Valor: R$ ${novoValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\nNovo Vencimento: HOJE\n\nO QR Code PIX já foi atualizado com o valor corrigido para pagamento imediato.`)
    }
  }
  
  const handleSaveFundo = async form => {
    await updateCondominio(condoFundoEdit.id, form)
    setCondoFundoEdit(null)
  }

  const handleCSVImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
        if (lines.length < 2) {
          alert('A planilha parece estar vazia ou sem cabeçalho.');
          return;
        }

        const headers = lines[0].toLowerCase().split(/[;,]/).map(h => h.trim());
        const getIdx = (keywords) => headers.findIndex(h => keywords.some(k => h.includes(k)));

        const idxMorador = getIdx(['nome', 'morador', 'pagador', 'sacado', 'cliente']);
        const idxApt = getIdx(['apt', 'unidade', 'lote']);
        const idxVencimento = getIdx(['venc', 'data']);
        const idxValor = getIdx(['valor', 'total']);
        const idxLink = getIdx(['link', 'url', 'pdf']);
        const idxPix = getIdx(['pix']);
        
        if (idxMorador === -1 || idxValor === -1) {
          alert("Não conseguimos identificar as colunas 'Nome' e 'Valor' na sua planilha. Verifique se estão presentes.");
          return;
        }

        let added = 0;
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(/[;,]/).map(c => c.trim().replace(/^"|"$/g, ''));
          const nome = cols[idxMorador];
          if (!nome) continue;

          let valorBruto = cols[idxValor] || '0';
          let valor = parseFloat(valorBruto.replace(/\./g, '').replace(',', '.')) || 0;
          if (isNaN(valor)) valor = parseFloat(valorBruto.replace(',', '.')) || 0;

          const moradorDb = moradores.find(m => m.nome.toLowerCase() === nome.toLowerCase());
          const apt = (idxApt !== -1 ? cols[idxApt] : '') || moradorDb?.apt || '';
          
          let venc = idxVencimento !== -1 ? cols[idxVencimento] : '';
          if (venc && venc.includes('/')) {
             const parts = venc.split('/');
             if (parts.length === 3) venc = `${parts[2]}-${parts[1]}-${parts[0]}`;
          }

          const link = idxLink !== -1 ? cols[idxLink] : '';
          const pix = idxPix !== -1 ? cols[idxPix] : '';

          const boleto = {
            morador: nome,
            apt: apt,
            condominio: moradorDb?.condominio || '',
            vencimento: venc,
            valor: valor,
            status: 'Pendente',
            competencia: new Date().toLocaleDateString('pt-BR', {month:'short', year:'numeric'}).replace('.','/'),
            emitido: true,
            url: link,
            pix_emv: pix,
            linha: ''
          };
          
          await addItem(boleto);
          added++;
        }
        alert(`Sucesso! ${added} boletos importados com sucesso.`);
      } catch (err) {
        console.error(err);
        alert('Erro ao processar a planilha. Verifique o formato CSV (separado por vírgula ou ponto e vírgula).');
      }
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  const handleReconciliationExtrato = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const fileName = file.name.toLowerCase();
        let baixados = 0;
        const pendentes = allBoletos.filter(b => b.status === 'Pendente');

        if (fileName.endsWith('.ofx')) {
          // Parser nativo de arquivo bancário OFX (Padrão Bancos Brasileiros)
          const transacoes = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || [];
          if (transacoes.length === 0) {
            alert('Nenhuma transação encontrada no arquivo OFX. Verifique se é um extrato de conta corrente válido.');
            return;
          }

          for (const trn of transacoes) {
            const getTag = (tag) => {
              const m = trn.match(new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i'));
              return m ? m[1].trim() : '';
            };

            const trnType = getTag('TRNTYPE');
            const trnAmtStr = getTag('TRNAMT').replace(',', '.');
            const valor = parseFloat(trnAmtStr);
            const memo = (getTag('MEMO') + ' ' + getTag('NAME')).toLowerCase();

            // Apenas entradas de dinheiro / créditos recebidos
            if (valor > 0 || trnType.toUpperCase() === 'CREDIT' || trnType.toUpperCase() === 'DEP') {
              const absValor = Math.abs(valor);

              // Tenta casar com o boleto pendente por valor e/ou nome do morador
              const boletoMatch = pendentes.find(b => {
                const mesmoValor = Math.abs(Number(b.valor) - absValor) < 0.1;
                const moradorNome = (b.morador || '').toLowerCase().trim();
                const aptNumero = String(b.apt || '').trim();
                const matchTexto = memo.includes(moradorNome) || (aptNumero && memo.includes(aptNumero));
                return mesmoValor && (matchTexto || pendentes.length === 1);
              }) || pendentes.find(b => Math.abs(Number(b.valor) - absValor) < 0.05);

              if (boletoMatch) {
                await updateItem(boletoMatch.id, { ...boletoMatch, status: 'Pago' });
                pendentes.splice(pendentes.indexOf(boletoMatch), 1);
                baixados++;
              }
            }
          }

          alert(`🎉 Conciliação OFX Concluída com Sucesso!\n\n${baixados} boletos foram identificados no extrato bancário e marcados como PAGOS automaticamente.`);
        } else {
          // Parser CSV
          const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
          if (lines.length < 2) {
            alert('A planilha parece estar vazia ou sem cabeçalho.');
            return;
          }

          const headers = lines[0].toLowerCase().split(/[;,]/).map(h => h.trim());
          const getIdx = (keywords) => headers.findIndex(h => keywords.some(k => h.includes(k)));

          const idxMorador = getIdx(['nome', 'morador', 'pagador', 'sacado', 'cliente', 'descricao', 'historico']);
          const idxValor = getIdx(['valor', 'total', 'recebido', 'pago', 'credito']);
          
          if (idxValor === -1) {
            alert("Não conseguimos identificar a coluna de 'Valor' na sua planilha. Verifique se está presente.");
            return;
          }

          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(/[;,]/).map(c => c.trim().replace(/^"|"$/g, ''));
            const nome = idxMorador !== -1 ? cols[idxMorador] : '';
            let valorBruto = cols[idxValor] || '0';
            let valorLido = parseFloat(valorBruto.replace(/\./g, '').replace(',', '.')) || 0;
            if (isNaN(valorLido)) valorLido = parseFloat(valorBruto.replace(',', '.')) || 0;

            if (valorLido <= 0) continue;

            const boletoMatch = pendentes.find(b => {
              const mesmoValor = Math.abs(Number(b.valor) - valorLido) < 0.1;
              const matchNome = nome ? (b.morador.toLowerCase().includes(nome.toLowerCase()) || nome.toLowerCase().includes(b.morador.toLowerCase())) : true;
              return mesmoValor && matchNome;
            });

            if (boletoMatch) {
              await updateItem(boletoMatch.id, { ...boletoMatch, status: 'Pago' });
              pendentes.splice(pendentes.indexOf(boletoMatch), 1);
              baixados++;
            }
          }
          alert(`🎉 Conciliação CSV Concluída!\n\n${baixados} boletos foram encontrados na planilha e marcados como Pagos automaticamente.`);
        }
      } catch (err) {
        console.error(err);
        alert('Erro ao processar o extrato. Verifique se o arquivo OFX ou CSV é válido.');
      }
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h2 className="section-title text-xl">
            {user?.role === 'Morador' || user?.role === 'Síndico' ? 'Boletos' : 'Boletos & Fundo de Reserva'}
          </h2>
          <p className="section-sub">Emissão e acompanhamento de cobranças</p>
        </div>
        {tab==='boletos' && user?.role !== 'Morador' && (
          <div className="flex gap-2 flex-wrap items-center">
            <button onClick={()=>setShowRepasses(true)} className="btn-secondary text-sm flex items-center gap-1.5 bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 font-bold shadow-sm">
              <DollarSign size={15} className="text-amber-700"/> Fechamento & Repasses Alpha
            </button>
            {user?.role !== 'Morador' && (
              <>
                <button onClick={()=>setModalLote(true)} className="btn-primary bg-emerald-600 hover:bg-emerald-500 text-sm font-black flex items-center gap-1.5 shadow-md">
                  <Package size={15}/> Gerar Boletos do Mês (Lote)
                </button>
                <label className="btn-secondary text-sm cursor-pointer flex items-center gap-1.5 bg-white border border-gray-300 hover:bg-gray-50">
                  <Clock size={14} className="text-brand-600" />
                  <span>Conciliar Extrato (OFX / CSV)</span>
                  <input type="file" accept=".ofx,.csv,.txt" className="hidden" onChange={handleReconciliationExtrato}/>
                </label>
                <label className="btn-secondary text-sm cursor-pointer flex items-center gap-1.5 bg-white border border-gray-300 hover:bg-gray-50">
                  <Upload size={14}/>
                  <span>Importar Planilha (CSV)</span>
                  <input type="file" accept=".csv,.txt" className="hidden" onChange={handleCSVImport}/>
                </label>
                <button onClick={()=>setModal('new')} className="btn-primary text-sm flex items-center gap-1"><Plus size={14}/> Novo Individual</button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {/* Tabs */}
        <div className="flex gap-2">
          {[{id:'boletos',label:'📄 Boletos'},{id:'fundo',label:'💰 Fundo de Reserva'}]
            .filter(t => t.id === 'boletos' || (user?.role !== 'Morador' && user?.role !== 'Síndico'))
            .map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab===t.id?'bg-brand-600 text-white shadow-md':'bg-white text-gray-500 hover:text-brand-700 border border-cream-400'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Filtro ADM e Botão Repasses */}
        <div className="w-full sm:w-auto flex flex-wrap items-center gap-2">
          {user?.role !== 'Morador' && (
            <button
              onClick={() => setShowRepasses(true)}
              className="px-3.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 rounded-lg text-xs font-black flex items-center gap-1.5 shadow-sm transition-all"
            >
              <DollarSign size={14} className="text-amber-800" />
              <span>💼 Fechamento & Repasses Alpha</span>
            </button>
          )}
          {(user?.role === 'Administrador' || user?.role === 'Financeiro') && uniqueCondos.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0 block">Filtrar:</label>
              <select className="input text-sm py-1.5 h-auto w-44" value={condoFilter} onChange={e=>setCondoFilter(e.target.value)}>
                <option value="Todos">Todos os Condomínios</option>
                {uniqueCondos.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ── ABA BOLETOS ─────────────────────────────────────────────── */}
      {tab==='boletos' && (
        <>
          {/* Banner de Chave PIX Ativa do Condomínio Selecionado */}
          {condoFilter !== 'Todos' && (
            <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-lg">
                  💠
                </div>
                <div>
                  <p className="text-xs font-black text-emerald-900">
                    Chave PIX de Recebimento do Condomínio: <span className="underline">{condoFilter}</span>
                  </p>
                  <p className="text-xs text-emerald-700 font-mono font-bold mt-0.5">
                    {allCondominios.find(c => c.nome === condoFilter)?.chave_pix || '⚠️ Nenhuma chave cadastrada — Clique ao lado para definir'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  const condoDoc = allCondominios.find(c => c.nome === condoFilter)
                  if (!condoDoc) return
                  const novaChave = prompt(`Digite a Chave PIX do condomínio "${condoFilter}" (CNPJ, E-mail, Celular ou Aleatória):`, condoDoc.chave_pix || '')
                  if (novaChave !== null) {
                    updateCondominio(condoDoc.id, { chave_pix: novaChave.trim() })
                    alert(`✅ Chave PIX do condomínio "${condoFilter}" atualizada com sucesso!`)
                  }
                }}
                className="btn-secondary py-2 px-3 text-xs bg-white text-emerald-900 font-black border-emerald-300 hover:bg-emerald-100 shrink-0 shadow-sm flex items-center gap-1.5"
              >
                ✏️ Alterar Chave PIX do Condomínio
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {[
              { id: 'Todos', label: 'Todos os Boletos', val: boletosFiltradosPorCondo.length, color: 'text-brand-700', bg: 'bg-brand-50 border-brand-400' },
              { id: 'Pago', label: 'Pagos / Conciliados', val: pago, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-400' },
              { id: 'Pendente', label: 'Pendentes', val: pendente, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-400' },
              { id: 'Vencido', label: 'Vencidos', val: vencido, color: 'text-red-600', bg: 'bg-red-50 border-red-400' },
            ].map(s => {
              const active = statusFilter === s.id
              return (
                <button
                  key={s.id}
                  onClick={() => setStatusFilter(s.id)}
                  className={`card text-center transition-all cursor-pointer border-2 ${active ? `${s.bg} shadow-md scale-[1.02]` : 'hover:bg-slate-50 border-transparent'}`}
                >
                  <p className={`text-2xl sm:text-3xl font-black mb-1 ${s.color}`}>{s.val}</p>
                  <p className="text-xs font-bold text-gray-600">{s.label}</p>
                  {active && <span className="text-[10px] font-black uppercase text-brand-600 mt-1 block">● Exibindo Agora</span>}
                </button>
              )
            })}
          </div>

          {/* Aviso boletos próximos do vencimento */}
          {boletos.filter(b=>{ if(b.status==='Pago'||!b.vencimento)return false; const d=Math.round((new Date(b.vencimento+'T12:00:00')-new Date())/86400000); return d>=0&&d<=5 }).length > 0 && (
            <div className="card bg-amber-50 border-amber-200 flex items-start gap-3">
              <Bell size={18} className="text-amber-600 mt-0.5 shrink-0"/>
              <div>
                <p className="font-bold text-amber-800 text-sm">⚠️ Boletos vencendo em breve</p>
                {boletos.filter(b=>{ if(b.status==='Pago'||!b.vencimento)return false; const d=Math.round((new Date(b.vencimento+'T12:00:00')-new Date())/86400000); return d>=0&&d<=5 }).map(b=>{
                  const d=Math.round((new Date(b.vencimento+'T12:00:00')-new Date())/86400000)
                  return <p key={b.id} className="text-xs text-amber-700">{b.morador} – Apt {b.apt} – R$ {fmt(b.valor)} – {d===0?'Vence HOJE':`Vence em ${d} dia(s)`}</p>
                })}
              </div>
            </div>
          )}

          <div className="card p-0 overflow-hidden">
            <div className="p-4 border-b border-cream-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <p className="font-bold text-gray-800 text-sm">Boletos cadastrados</p>
                <span className="text-xs text-gray-400 font-medium">({boletos.length} no total • {selectedIds.length} selecionados)</span>
              </div>

              {/* Ações em Lote */}
              {(user?.role === 'Administrador' || user?.role === 'Financeiro' || user?.role === 'Síndico') && boletos.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      const lista = selectedIds.length > 0 ? boletos.filter(b => selectedIds.includes(b.id)) : boletos
                      handleDownloadPDFLote(lista)
                    }}
                    disabled={downloadingLote}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <Download size={14} />
                    {downloadingLote
                      ? 'Compilando PDF...'
                      : selectedIds.length > 0
                        ? `Baixar Selecionados (${selectedIds.length}) em PDF`
                        : `Baixar Todos (${boletos.length}) em PDF`
                    }
                  </button>

                  {selectedIds.length > 0 && (
                    <>
                      <button
                        onClick={async () => {
                          if (window.confirm(`⚠️ Tem certeza que deseja EXCLUIR os ${selectedIds.length} boletos selecionados? Esta ação não pode ser desfeita.`)) {
                            const total = selectedIds.length
                            for (const id of selectedIds) {
                              await deleteItem(id)
                            }
                            setSelectedIds([])
                            alert(`✅ ${total} boletos foram excluídos com sucesso.`)
                          }
                        }}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
                      >
                        <Trash2 size={14} /> Excluir ({selectedIds.length})
                      </button>

                      <button
                        onClick={() => setSelectedIds([])}
                        className="px-2.5 py-1.5 text-gray-500 hover:text-gray-800 text-xs font-bold bg-white border border-gray-300 rounded-xl"
                      >
                        Desmarcar
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-cream-100 border-b border-cream-400">
                  <tr>
                    {(user?.role === 'Administrador' || user?.role === 'Financeiro' || user?.role === 'Síndico') && (
                      <th className="table-head w-10 text-center">
                        <input
                          type="checkbox"
                          checked={boletos.length > 0 && selectedIds.length === boletos.length}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 rounded text-brand-600 border-gray-300 focus:ring-brand-500"
                        />
                      </th>
                    )}
                    <th className="table-head">Morador</th>
                    <th className="table-head">Apt/Unidade</th>
                    <th className="table-head">Condomínio</th>
                    <th className="table-head">Vencimento</th>
                    <th className="table-head">Valor</th>
                    <th className="table-head">Status</th>
                    <th className="table-head">Emitido</th>
                    <th className="table-head">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-200">
                  {boletos.length === 0 ? (
                    <tr><td colSpan={(user?.role === 'Administrador' || user?.role === 'Financeiro' || user?.role === 'Síndico') ? 9 : 8} className="text-center py-10 text-gray-400">Nenhum boleto encontrado.</td></tr>
                  ) : (
                    boletos.map(b => (
                      <tr key={b.id} className={`hover:bg-cream-50 transition-colors ${selectedIds.includes(b.id) ? 'bg-indigo-50/40' : ''}`}>
                        {(user?.role === 'Administrador' || user?.role === 'Financeiro' || user?.role === 'Síndico') && (
                          <td className="table-cell text-center">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(b.id)}
                              onChange={() => toggleSelectBoleto(b.id)}
                              className="w-4 h-4 rounded text-brand-600 border-gray-300 focus:ring-brand-500"
                            />
                          </td>
                        )}
                        <td className="table-cell font-medium text-gray-800">{b.morador}</td>
                        <td className="table-cell text-gray-500 font-bold">{b.apt ? `Apt ${b.apt}` : '—'}</td>
                        <td className="table-cell">
                          <span className="bg-slate-100 text-slate-800 text-[11px] font-bold px-2 py-0.5 rounded-lg border border-slate-200 inline-block truncate max-w-[150px]">
                            {b.condominio || 'Alpha Condomínios'}
                          </span>
                        </td>
                        <td className="table-cell text-gray-500">{b.vencimento}</td>
                        <td className="table-cell font-bold text-gray-800">R$ {fmt(b.valor)}</td>
                        <td className="table-cell"><span className={`${statusBadge(b.status)} flex items-center gap-1 w-fit`}>{statusIcon(b.status)}{b.status}</span></td>
                        <td className="table-cell">{b.emitido?<span className="badge-green flex items-center gap-1 w-fit"><CheckCircle2 size={11}/>Sim</span>:<span className="badge-yellow">Não</span>}</td>
                        <td className="table-cell">
                          <div className="flex gap-1.5 flex-wrap items-center">
                            <button onClick={()=>setViewing(b)} className="btn-secondary py-1 px-2.5 text-xs text-brand-700 bg-brand-50 border-brand-200 hover:bg-brand-100 flex items-center gap-1 font-bold">
                              <QrCode size={12}/> Ver Boleto PIX
                            </button>

                            <button onClick={()=>setViewing(b)} className="btn-secondary py-1 px-2.5 text-xs text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100 flex items-center gap-1 font-bold">
                              <Download size={12}/> Baixar PDF
                            </button>

                            {(user?.role === 'Administrador' || user?.role === 'Financeiro') && !b.emitido && (
                              <button onClick={()=>emitirBoleto(b)} className="btn-primary py-1 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-500 flex items-center gap-1">
                                <FileText size={11}/>Gerar PIX
                              </button>
                            )}
                            
                            {/* Botão de 2ª Via para Boletos Vencidos */}
                            {b.status === 'Vencido' && (
                              <button onClick={() => gerarSegundaVia(b)} className="btn-primary py-1 px-2.5 text-xs bg-orange-500 hover:bg-orange-600 border-orange-600">
                                <FileText size={11}/> 2ª Via
                              </button>
                            )}
                            
                            {(user?.role === 'Administrador' || user?.role === 'Financeiro' || user?.role === 'Síndico') && (
                              <>
                                <button onClick={()=>enviarWhats(b)} className="btn-secondary py-1 px-2 text-xs text-green-700 bg-green-50 border-green-200 hover:bg-green-100 flex items-center gap-1"><MessageSquare size={11}/>Whats</button>
                                {b.status !== 'Pago' && <button onClick={()=>marcarPago(b)} className="btn-success py-1 px-2 text-xs flex items-center gap-1"><CheckCircle2 size={11}/>Pago</button>}
                                <button onClick={()=>setModal(b)} title="Editar Boleto" className="p-1.5 rounded-lg bg-cream-100 hover:bg-brand-100 text-gray-400 hover:text-brand-600 transition-all"><Edit2 size={12}/></button>
                                <button 
                                  onClick={() => {
                                    if (window.confirm(`Deseja realmente excluir o boleto de ${b.morador} (Apt ${b.apt}) no valor de R$ ${fmt(b.valor)}?`)) {
                                      deleteItem(b.id)
                                    }
                                  }} 
                                  title="Excluir Boleto" 
                                  className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-700 transition-all border border-red-200"
                                >
                                  <Trash2 size={12}/>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── ABA FUNDO DE RESERVA ─────────────────────────────────────── */}
      {tab==='fundo' && (
        <div className="flex flex-col gap-4">
          <p className="text-gray-500 text-sm mb-2">Fundos de reserva divididos por condomínio (os mesmos que você cadastra na página de Condomínios).</p>
          
          {condominios.length === 0 ? (
            <div className="card text-center py-10 text-gray-400 text-sm">
              Nenhum condomínio cadastrado. Vá até a aba "Condomínios" para registrar os blocos/condomínios primeiro.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {condominios.map(c => {
                const fundoSaldo = Number(c.fundoReserva||0)
                const fundoMeta  = Number(c.fundoMeta||0)
                const pct = fundoMeta>0 ? Math.min((fundoSaldo/fundoMeta)*100, 100) : 0

                return (
                  <div key={c.id} className="card flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><Building size={16}/></div>
                          <div>
                            <p className="font-bold text-gray-800">{c.nome}</p>
                            <p className="text-xs text-gray-500">{c.unidades} unidades</p>
                          </div>
                        </div>
                        {user?.role !== 'Morador' && (
                          <button onClick={()=>setCondoFundoEdit(c)} className="btn-secondary text-xs py-1.5 px-2.5"><Edit2 size={12}/>Editar Fundo</button>
                        )}
                      </div>
                      
                      <div className="bg-cream-50 p-4 rounded-xl border border-cream-200">
                        <div className="flex justify-between items-end mb-2">
                          <div>
                            <p className="text-xs text-gray-500 mb-0.5">Saldo Atual</p>
                            <p className="text-xl font-black text-emerald-600">R$ {fmt(fundoSaldo)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-400 mb-0.5">Meta Anual</p>
                            <p className="text-sm font-bold text-brand-700">R$ {fmt(fundoMeta)}</p>
                          </div>
                        </div>
                        
                        {fundoMeta > 0 ? (
                          <div className="mt-4">
                            <div className="w-full bg-cream-300 rounded-full h-2 overflow-hidden mb-1">
                              <div className="h-2 bg-gradient-to-r from-brand-500 to-emerald-500 rounded-full transition-all" style={{width:`${pct}%`}}/>
                            </div>
                            <div className="flex justify-between items-center text-[10px] text-gray-500 font-medium">
                              <span>{pct.toFixed(1)}% alcançado</span>
                              <span>Falta R$ {fmt(Math.max(fundoMeta-fundoSaldo,0))}</span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 mt-2">Nenhuma meta anual definida para este condomínio.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Vitrine Premium */}
          <div className="card bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 relative overflow-hidden mt-2">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"/>
            <div className="relative z-10">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold mb-3 uppercase tracking-widest">
                <Sparkles size={14}/> Em Breve / Premium
              </div>
              <h3 className="text-lg font-black text-amber-900 mb-2">Automação Financeira Completa</h3>
              <p className="text-sm text-amber-800 mb-4">Integração bancária oficial com conciliação automática e baixa de inadimplentes.</p>
              <div className="grid grid-cols-2 gap-y-2 gap-x-6">
                {["Emissão automática de boletos","Baixa automática de inadimplentes","Conciliação bancária","Pagamentos rápidos e seguros"].map((item,i)=>(
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0"><Check size={10} className="text-amber-700"/></div>
                    <span className="text-xs font-semibold text-amber-900/80">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {progressoLote && (
        <div className="modal-overlay z-50">
          <div className="modal-content max-w-md w-full bg-white p-6 rounded-3xl shadow-2xl border border-emerald-200 text-center flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center animate-bounce">
              <MessageSquare size={32} />
            </div>
            <div>
              <h3 className="font-black text-lg text-slate-900">Disparando Boletos via WhatsApp</h3>
              <p className="text-xs text-gray-500 mt-1">
                Processando e entregando o PDF oficial para <b>{progressoLote.morador}</b>...
              </p>
            </div>
            
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
              <div 
                className="h-full bg-emerald-600 transition-all duration-300"
                style={{ width: `${(progressoLote.atual / progressoLote.total) * 100}%` }}
              />
            </div>
            
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              {progressoLote.atual} de {progressoLote.total} boletos enviados
            </span>
          </div>
        </div>
      )}

      {viewing && <BoletoPrintModal boleto={viewing} condominio={allCondominios.find(c=>c.nome===(viewing.condominio || moradores.find(m=>m.nome===viewing.morador)?.condominio))} moradores={moradores} onClose={()=>setViewing(null)}/>}
      {modal&&<ModalBoleto data={modal==='new'?null:modal} onClose={()=>setModal(null)} onSave={handleSaveBoleto} moradores={moradores}/>}
      {modalLote&&<ModalGerarLote condominios={allCondominios} moradores={moradores} initialCondo={condoFilter !== 'Todos' ? condoFilter : ''} onClose={()=>setModalLote(false)} onSave={handleSaveLote}/>}
      {condoFundoEdit&&<ModalFundo condo={condoFundoEdit} onClose={()=>setCondoFundoEdit(null)} onSave={handleSaveFundo}/>}
      <RepassesAlphaModal
        isOpen={showRepasses}
        onClose={()=>setShowRepasses(false)}
        condominios={allCondominios}
        allBoletos={allBoletos}
        selectedCondoName={condoFilter !== 'Todos' ? condoFilter : ''}
      />
    </div>
  )
}
