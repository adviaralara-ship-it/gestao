import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { FileText, Plus, Download, DollarSign, Printer, CheckCircle2, Clock, AlertCircle, Trash2, Edit2, X, MessageSquare, Sparkles, Check, TrendingUp, Bell, Building, Upload, Copy, Share2, QrCode, Package, Send, Users, Loader2 } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { notificarAdm, enviarEmail } from '../emailjs.config'
import RepassesAlphaModal from '../components/RepassesAlphaModal'
import ModalImportarBoletosPDF from '../components/ModalImportarBoletosPDF'
import { CurrencyInput, maskCurrency, parseCurrency } from '../utils/currency'
import { enviarBoletoWhatsAppAuto } from '../utils/whatsappAutomacao'

const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function statusBadge(status) {
  if (status === 'Pago') return 'badge-green'
  if (status === 'Vencido') return 'badge-red'
  return 'badge-yellow'
}

function statusIcon(status) {
  if (status === 'Pago') return <CheckCircle2 size={11} className="text-green-600" />
  if (status === 'Vencido') return <AlertCircle size={11} className="text-red-600" />
  return <Clock size={11} className="text-amber-600" />
}


function gerarLinhaDigitavel(apt, valor, venc) {
  const r = () => Math.floor(Math.random() * 9)
  return `34191.${r()}${r()}${r()}${r()}${r()} ${r()}${r()}${r()}${r()}${r()}.${r()}${r()}${r()}${r()}${r()}${r()} ${r()}${r()}${r()}${r()}${r()}.${r()}${r()}${r()}${r()}${r()}${r()} ${r()} ${(venc||'').replace(/\//g,'')}${String(Math.round((valor||0)*100)).padStart(10,'0')}`
}

export function formatPixKey(key) {
  if (!key) return ""
  let k = String(key).trim()

  // E-mail
  if (k.includes('@')) {
    return k.toLowerCase().trim()
  }

  // Chave Aleatória (UUID)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (uuidRegex.test(k)) {
    return k.toLowerCase().trim()
  }

  const digits = k.replace(/\D/g, '')

  // CNPJ (14 dígitos)
  if (digits.length === 14) {
    return digits
  }

  // CPF (11 dígitos)
  if (digits.length === 11 && !k.includes('(') && !k.startsWith('+55')) {
    // Se for CPF (começa sem parênteses de DDD)
    return digits
  }

  // Telefone / Celular com DDD (10 ou 11 dígitos) -> BACEN exige +55
  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`
  }

  if (digits.length === 12 || digits.length === 13) {
    if (digits.startsWith('55')) {
      return `+${digits}`
    }
  }

  return k
}

function generateStaticPix(chavePixRaw, valor, nome = "Condominio", cidade = "Sao Paulo") {
  const chavePix = formatPixKey(chavePixRaw)
  if (!chavePix) return ""
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
  const merchantName = formatLength("59", (nome || "Condominio").substring(0, 25).normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  const merchantCity = formatLength("60", (cidade || "Sao Paulo").substring(0, 15).normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
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
  const chavePixFinal = condominio?.chave_pix || condominio?.chavePix || boleto.chave_pix || '66.643.272/0001-18'
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

  const moradorDoc = (boleto.moradorId && moradores.find(m => m.id === boleto.moradorId))
    || moradores.find(m => (m.nome && boleto.morador && m.nome.trim().toLowerCase() === boleto.morador.trim().toLowerCase()) || (m.apt && boleto.apt && String(m.apt).trim() === String(boleto.apt).trim()))
    || {}
  const cnpjCondoStr = condominio?.cnpj || boleto.cnpjCondominio || boleto.cnpj || ''
  const cpfMoradorStr = boleto.cpf || moradorDoc?.cpf || moradorDoc?.documento || ''

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
              ${cnpjCondoStr ? `<p style="margin: 2px 0 0; color: #475569; font-family: monospace; font-size: 10px; font-weight: bold;">CNPJ: ${cnpjCondoStr}</p>` : ''}
              <p style="margin: 4px 0 0; color: #047857; font-weight: bold; font-family: monospace; font-size: 10px;">Chave PIX: ${chavePixFinal}</p>
            </div>
            <div>
              <span style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase;">Pagador / Morador</span>
              <p style="margin: 4px 0 0; font-weight: 900; font-size: 13px; color: #0f172a;">${boleto.morador || 'Morador'}</p>
              <p style="margin: 2px 0 0; color: #334155; font-weight: bold; font-size: 11px;">Unidade: ${boleto.apt ? 'Apt ' + boleto.apt : '—'}</p>
              ${cpfMoradorStr ? `<p style="margin: 2px 0 0; color: #475569; font-family: monospace; font-size: 10px; font-weight: bold;">CPF: ${cpfMoradorStr}</p>` : ''}
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
            {boleto.url && (
              <button 
                onClick={() => {
                  if (boleto.url.startsWith('data:')) {
                    const link = document.createElement('a')
                    link.href = boleto.url
                    link.download = boleto.nomeArquivo || `Boleto-${boleto.morador || 'Morador'}.pdf`
                    document.body.appendChild(link)
                    link.click()
                    document.body.removeChild(link)
                  } else {
                    window.open(boleto.url, '_blank')
                  }
                }}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm"
                title="Abrir o PDF original emitido pelo banco"
              >
                <FileText size={14} /> PDF Banco
              </button>
            )}
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
              {cnpjCondoStr && <p className="text-[10px] text-slate-600 font-mono font-bold mt-0.5">CNPJ: {cnpjCondoStr}</p>}
              <p className="text-emerald-700 font-mono text-[10px] font-bold mt-1 break-all">Chave PIX: {chavePixFinal}</p>
            </div>

            <div className="min-w-0">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Pagador / Morador</span>
              <p className="font-bold text-slate-900 text-xs leading-snug break-words">{boleto.morador}</p>
              <p className="text-slate-800 font-bold text-[11px] mt-0.5">Unidade: {boleto.apt ? `Apt ${boleto.apt}` : '—'}</p>
              {cpfMoradorStr && <p className="text-[10px] text-slate-600 font-mono font-bold mt-0.5">CPF: {cpfMoradorStr}</p>}
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

                const descPrincipal = boleto.tipoCobranca 
                  ? `${boleto.tipoCobranca} (${boleto.competencia || 'Mês Atual'})`
                  : `Taxa Condominial Ordinária (${boleto.competencia || 'Mês Atual'})`

                if (taxaEmissao > 0) {
                  return (
                    <>
                      <div className="py-1 flex justify-between items-center">
                        <span className="text-gray-700 font-medium">{descPrincipal}</span>
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
                      <span className="text-gray-700 font-medium">{descPrincipal}</span>
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

function ModalBoleto({ data, onClose, onSave, moradores = [], condominios = [], initialCondo = '' }) {
  const condominiosValidos = (condominios || []).filter(c => c && c.nome && c.nome.trim())
  const condPadrao = data?.condominio || initialCondo || (condominiosValidos[0]?.nome || '')

  const [form, setForm] = useState(data || { 
    morador: '', 
    tipoMorador: 'Proprietário',
    tipoCobranca: 'Taxa Condominial', 
    apt: '', 
    bloco: '',
    vencimento: '', 
    valor: '', 
    status: 'Pendente', 
    competencia: '', 
    condominio: condPadrao,
    chave_pix: '',
    emitido: false, 
    linha: '', 
    url: '', 
    pix_emv: '', 
    invoice_id: '' 
  })
  
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Atualiza chave pix ao trocar condomínio se não tiver preenchida
  useEffect(() => {
    if (!form.condominio) return
    const cDoc = condominiosValidos.find(c => c.nome === form.condominio)
    if (cDoc?.chave_pix && !form.chave_pix) {
      setForm(f => ({ ...f, chave_pix: cDoc.chave_pix }))
    }
  }, [form.condominio, condominiosValidos])

  // Normalização para comparar nomes de condomínio sem estresse de acentos ou espaços
  const normalize = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()

  // Moradores filtrados pelo condomínio selecionado
  const moradoresDoCondo = moradores.filter(m => {
    if (!form.condominio) return true
    const cForm = normalize(form.condominio)
    const cM = normalize(m.condominio)
    const cMN = normalize(m.condominioNome)
    return cM === cForm || cMN === cForm || (cM && cForm && (cM.includes(cForm) || cForm.includes(cM)))
  })

  // Permite selecionar qualquer morador daquele condomínio (Proprietários, Inquilinos e outros)
  const moradoresOpcoes = moradoresDoCondo.length > 0 ? moradoresDoCondo : moradores

  const handleMoradorChange = (e) => {
    const nome = e.target.value
    const mor = moradoresOpcoes.find(m => m.nome === nome)
    if (mor) {
      const vinculo = mor.status || mor.tipo || mor.tipoMorador || 'Proprietário'
      const condoNomeMor = mor.condominio || form.condominio || ''
      const cDoc = condominiosValidos.find(c => c.nome === condoNomeMor)
      setForm(f => ({ 
        ...f, 
        morador: nome, 
        tipoMorador: vinculo,
        apt: mor.apt || mor.unidade || '', 
        bloco: mor.bloco || f.bloco || '',
        condominio: condoNomeMor,
        chave_pix: f.chave_pix || cDoc?.chave_pix || ''
      }))
    } else {
      set('morador', nome)
    }
  }

  const handleCondoChange = (e) => {
    const novoCondo = e.target.value
    const cDoc = condominiosValidos.find(c => c.nome === novoCondo)
    setForm(f => ({
      ...f,
      condominio: novoCondo,
      morador: '',
      apt: '',
      bloco: '',
      chave_pix: cDoc?.chave_pix || f.chave_pix || ''
    }))
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-xl w-full" onClick={e=>e.stopPropagation()}>
        <div className="p-5 sm:p-6 border-b border-cream-300 flex items-center justify-between">
          <div>
            <h3 className="font-black text-gray-900 text-base sm:text-lg">
              {data ? 'Editar Cobrança / Boleto' : 'Nova Cobrança / Boleto Individual'}
            </h3>
            <p className="text-xs text-gray-500">Emita taxa condominial, água ou energia para Proprietário ou Inquilino</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-700"><X size={20}/></button>
        </div>

        <div className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* 1. SELEÇÃO DO CONDOMÍNIO */}
          <div className="sm:col-span-2">
            <label className="label text-xs font-black">1. Condomínio *</label>
            {condominiosValidos.length > 0 ? (
              <select className="input font-bold text-xs bg-slate-50" value={form.condominio} onChange={handleCondoChange}>
                <option value="">Selecione o Condomínio...</option>
                {condominiosValidos.map(c => (
                  <option key={c.id || c.nome} value={c.nome}>{c.nome}</option>
                ))}
              </select>
            ) : (
              <input 
                className="input text-xs font-bold uppercase" 
                value={form.condominio || ''} 
                onChange={e => set('condominio', e.target.value)} 
                placeholder="Digite o nome do condomínio" 
              />
            )}
          </div>

          {/* 2. MORADOR RESPONSÁVEL (COM DISTINÇÃO CLARA DE INQUILINO / PROPRIETÁRIO) */}
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="label text-xs font-black mb-0">2. Pagador / Morador Responsável *</label>
              {form.tipoMorador && (
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                  form.tipoMorador === 'Inquilino' ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-blue-100 text-blue-900 border border-blue-200'
                }`}>
                  {form.tipoMorador === 'Inquilino' ? '🔑 Inquilino' : '🏠 Proprietário'}
                </span>
              )}
            </div>
            <select className="input text-xs font-semibold" value={form.morador} onChange={handleMoradorChange}>
               <option value="">Selecione quem vai pagar (Proprietário ou Inquilino)...</option>
               {moradoresOpcoes.map(m => {
                 const vinculo = m.status || m.tipo || m.tipoMorador || 'Morador'
                 const ehInquilino = vinculo.toLowerCase().includes('inquilino')
                 return (
                   <option key={m.id} value={m.nome}>
                     {ehInquilino ? '🔑 [INQUILINO] ' : '🏠 '} 
                     {m.nome} — Apt {m.apt || m.unidade || '—'} {m.bloco ? `(Bloco ${m.bloco})` : ''} • {vinculo}
                   </option>
                 )
               })}
            </select>
            <p className="text-[10px] text-gray-500 mt-1">
              Listando moradores cadastrados {form.condominio ? `no ${form.condominio}` : ''}. Inquilinos identificados com 🔑.
            </p>
          </div>

          {/* 3. TIPO / FINALIDADE DA COBRANÇA */}
          <div className="sm:col-span-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <label className="label text-xs font-black text-slate-900 mb-1">3. Tipo de Cobrança / Finalidade</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'Taxa Condominial', label: '🏢 Condomínio', cor: 'border-blue-400 text-blue-900 bg-blue-50' },
                { id: 'Consumo de Água', label: '💧 Água', cor: 'border-cyan-400 text-cyan-900 bg-cyan-50' },
                { id: 'Consumo de Energia', label: '⚡ Energia', cor: 'border-amber-400 text-amber-900 bg-amber-50' },
                { id: 'Outros / Rateio', label: '🏷️ Outros', cor: 'border-purple-400 text-purple-900 bg-purple-50' },
              ].map(tipo => {
                const ativo = (form.tipoCobranca || 'Taxa Condominial') === tipo.id
                return (
                  <button
                    type="button"
                    key={tipo.id}
                    onClick={() => set('tipoCobranca', tipo.id)}
                    className={`py-2 px-2 text-xs font-bold rounded-xl border text-center transition-all cursor-pointer ${
                      ativo ? `${tipo.cor} font-black shadow-xs ring-2 ring-brand-500` : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {tipo.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* DADOS DA UNIDADE */}
          <div>
            <label className="label text-xs font-black">Unidade / Apartamento *</label>
            <input className="input text-xs font-bold uppercase" value={form.apt} onChange={e=>set('apt', e.target.value.toUpperCase())} placeholder="Ex: 101" />
          </div>
          <div>
            <label className="label text-xs font-black">Bloco (Opcional)</label>
            <input className="input text-xs uppercase" value={form.bloco || ''} onChange={e=>set('bloco', e.target.value.toUpperCase())} placeholder="Ex: A" />
          </div>

          {/* COMPETÊNCIA E VENCIMENTO */}
          <div>
            <label className="label text-xs font-black">Competência *</label>
            <input className="input text-xs font-bold" value={form.competencia} onChange={e=>set('competencia', e.target.value)} placeholder="Ex: Out/2026" />
          </div>
          <div>
            <label className="label text-xs font-black">Data de Vencimento *</label>
            <input type="date" className="input text-xs font-bold" value={form.vencimento} onChange={e=>set('vencimento', e.target.value)} />
          </div>

          {/* VALOR E STATUS */}
          <div>
            <label className="label text-xs font-black">Valor a Pagar (R$) *</label>
            <CurrencyInput value={form.valor} onChange={v=>set('valor', v)} placeholder="0,00" />
          </div>
          <div>
            <label className="label text-xs font-black">Status do Boleto</label>
            <select className="input text-xs font-bold" value={form.status} onChange={e=>set('status', e.target.value)}>
              <option>Pendente</option>
              <option>Pago</option>
              <option>Vencido</option>
            </select>
          </div>

          {/* CHAVE PIX */}
          <div className="sm:col-span-2">
            <label className="label text-xs font-black">Chave PIX para Recebimento (do Condomínio)</label>
            <input className="input text-xs font-mono" value={form.chave_pix || ''} onChange={e=>set('chave_pix', e.target.value)} placeholder="CNPJ, E-mail, Celular ou Aleatória" />
          </div>

          {/* BOLETO EXTERNO OPCIONAL */}
          <div className="sm:col-span-2 mt-1 pt-3 border-t border-cream-200">
             <label className="flex items-center gap-2 cursor-pointer mb-2">
               <input type="checkbox" checked={form.emitido} onChange={e=>set('emitido', e.target.checked)} className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 w-4 h-4" />
               <span className="font-bold text-gray-700 text-xs">Boleto gerado externamente (Link em PDF ou Copia e Cola)</span>
             </label>
             
             {form.emitido && (
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 p-3 rounded-xl border border-cream-200">
                  <div>
                    <label className="label text-[10px]">Link do Boleto PDF (Opcional)</label>
                    <input className="input text-xs" value={form.url} onChange={e=>set('url', e.target.value)} placeholder="https://..." />
                  </div>
                  <div>
                    <label className="label text-[10px]">PIX Copia e Cola (Opcional)</label>
                    <input className="input text-xs" value={form.pix_emv} onChange={e=>set('pix_emv', e.target.value)} placeholder="0002012658..." />
                  </div>
               </div>
             )}
          </div>
        </div>

        <div className="p-4 sm:p-6 border-t border-cream-300 flex gap-3 justify-end bg-slate-50 rounded-b-3xl">
          <button onClick={onClose} className="btn-secondary text-xs">Cancelar</button>
          <button 
            onClick={() => {
              if (!form.morador || form.valor === undefined || form.valor === null || form.valor === '') {
                alert("Por favor, preencha o Morador Responsável e o Valor.")
                return
              }
              onSave(form)
            }} 
            className="btn-primary text-xs font-black"
          >
            Salvar e Gerar Boleto
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalFundo({ condo, onClose, onSave }) {
  const [fundoReserva, setFundoReserva] = useState(condo?.fundoReserva || '')
  const [fundoMeta, setFundoMeta] = useState(condo?.fundoMeta || '')

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-cream-300 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">Editar Fundo de Reserva - {condo?.nome || 'Condomínio'}</h3>
          <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-700"/></button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div>
            <label className="label">Saldo Atual do Fundo (R$)</label>
            <CurrencyInput value={fundoReserva} onChange={v => setFundoReserva(v)} placeholder="0,00" />
          </div>
          <div>
            <label className="label">Meta Anual (R$)</label>
            <CurrencyInput value={fundoMeta} onChange={v => setFundoMeta(v)} placeholder="0,00" />
          </div>
        </div>
        <div className="p-5 border-t border-cream-300 flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={() => onSave({ 
            fundoReserva: typeof fundoReserva === 'number' ? fundoReserva : (parseFloat(String(fundoReserva||'').replace(/\./g,'').replace(',','.'))||0), 
            fundoMeta: typeof fundoMeta === 'number' ? fundoMeta : (parseFloat(String(fundoMeta||'').replace(/\./g,'').replace(',','.'))||0) 
          })} className="btn-primary">Salvar</button>
        </div>
      </div>
    </div>
  )
}

function ModalGerarLote({ condominios, moradores, allBoletos = [], initialCondo = '', onClose, onSave }) {
  const condominiosValidos = (condominios || []).filter(c => c && c.nome && c.nome.trim())
  const initialSelectedCondo = (initialCondo && condominiosValidos.find(c => c.nome === initialCondo)) || condominiosValidos[0] || null
  const initialCondoName = initialSelectedCondo?.nome || ''

  const [condoNome, setCondoNome] = useState(initialCondoName)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const condoSelecionado = condominiosValidos.find(c => c.nome === condoNome) || initialSelectedCondo

  const [valorStr, setValorStr] = useState(() => {
    if (initialSelectedCondo?.cotaPadrao !== undefined && Number(initialSelectedCondo.cotaPadrao) > 0) {
      return Number(initialSelectedCondo.cotaPadrao)
    }
    return 450.00
  })
  const [competencia, setCompetencia] = useState(() => {
    const d = new Date()
    return d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '/')
  })
  const [vencimento, setVencimento] = useState(() => {
    const d = new Date()
    d.setDate(10)
    return d.toISOString().split('T')[0]
  })
  
  const [chavePix, setChavePix] = useState(initialSelectedCondo?.chave_pix || '')
  const [discriminarTaxa, setDiscriminarTaxa] = useState(Boolean(initialSelectedCondo?.discriminarTaxa))
  const [taxaStr, setTaxaStr] = useState(initialSelectedCondo?.taxaEmissao !== undefined && Number(initialSelectedCondo.taxaEmissao) > 0 ? Number(initialSelectedCondo.taxaEmissao) : 3.50)
  const [nomeTaxa, setNomeTaxa] = useState(initialSelectedCondo?.nomeTaxa || 'Serviço de Cobrança Digital')
  const [valoresCustom, setValoresCustom] = useState({})
  const [enviarWhatsAppAuto, setEnviarWhatsAppAuto] = useState(true)
  const [buscaNome, setBuscaNome] = useState('')

  useEffect(() => {
    if (!condoNome) return
    const c = (condominios || []).find(item => item && item.nome === condoNome)
    if (c) {
      if (c.chave_pix) setChavePix(c.chave_pix)
      if (c.cotaPadrao !== undefined && Number(c.cotaPadrao) > 0) setValorStr(Number(c.cotaPadrao))
      if (c.discriminarTaxa !== undefined) setDiscriminarTaxa(Boolean(c.discriminarTaxa))
      if (c.taxaEmissao !== undefined && Number(c.taxaEmissao) > 0) {
        setTaxaStr(Number(c.taxaEmissao))
      } else {
        setTaxaStr(3.50)
      }
      if (c.nomeTaxa) {
        const n = c.nomeTaxa.includes('Processamento') || c.nomeTaxa.includes('Tarifa') ? 'Serviço de Cobrança Digital' : c.nomeTaxa
        setNomeTaxa(n)
      }
    }
  }, [condoNome, condominios])

  const normalizeCondo = (s) => (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^(residencial|condominio|edificio|ed\.)\s+/i, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .trim()
    .toLowerCase()

  // Agrupa moradores, síndicos e dependentes por Unidade / Apartamento do condomínio selecionado
  const todosDoCondo = React.useMemo(() => {
    if (!condoNome || condoNome === 'Todos') return moradores

    const cTarget = normalizeCondo(condoNome)
    const condoObj = condominiosValidos.find(c => c.nome === condoNome) || (condominios || []).find(c => c.nome === condoNome)
    const targetId = condoObj?.id || ''

    return moradores.filter(m => {
      // 1. Verificação por ID direto do condomínio
      if (targetId && (m.condominioId === targetId || m.condominio === targetId)) {
        return true
      }
      // 2. Verificação por nome do condomínio
      const cM = normalizeCondo(m.condominio)
      const cMN = normalizeCondo(m.condominioNome)
      if (cM === cTarget || cMN === cTarget) return true
      if (cM && cTarget && (cM.includes(cTarget) || cTarget.includes(cM))) return true
      if (cMN && cTarget && (cMN.includes(cTarget) || cTarget.includes(cMN))) return true
      return false
    })
  }, [condoNome, moradores, condominios, condominiosValidos])

  // Agrupamento por Apartamento com priorização estrita de PROPRIETÁRIO / TITULAR
  const unidadesAgrupadas = React.useMemo(() => {
    const map = new Map()

    todosDoCondo.forEach(m => {
      // Normaliza número do apartamento (ex: "101", "101-A", "ADM")
      const aptKey = String(m.apt || m.unidade || (m.status === 'Síndico' || m.tipo === 'Síndico' ? 'ADM' : 'Sem Apt'))
        .replace(/^(apto\.?|apt\.?|unidade)\s*/i, '')
        .trim()

      if (!map.has(aptKey)) {
        map.set(aptKey, {
          apt: aptKey,
          bloco: m.bloco || '',
          titular: null,
          moradores: []
        })
      }
      const entry = map.get(aptKey)
      entry.moradores.push(m)
      if (m.bloco && !entry.bloco) entry.bloco = m.bloco
    })

    // Define o titular de cada apartamento seguindo estritamente a hierarquia:
    // 1º Proprietário (ou Morador titular)
    // 2º Síndico / Subsíndico
    // 3º Inquilino
    // 4º Dependentes
    map.forEach(entry => {
      const getScore = (m) => {
        const vinculo = String(m.status || m.tipo || m.tipoMorador || '').toLowerCase().trim()
        if (vinculo === 'proprietario' || vinculo === 'proprietário') return 100
        if (vinculo === 'morador' || vinculo === 'titular') return 90
        if (vinculo.includes('sindico') || vinculo.includes('síndico')) return 85
        if (vinculo.includes('inquilino')) return 50
        if (vinculo.includes('dependente')) return 10
        return 30
      }

      // Ordena os membros da unidade pela pontuação mais alta para eleger o titular do boleto
      const ordenados = [...entry.moradores].sort((a, b) => getScore(b) - getScore(a))
      entry.titular = ordenados[0] || null
    })

    return Array.from(map.values()).sort((a, b) => 
      a.apt.localeCompare(b.apt, undefined, { numeric: true })
    )
  }, [todosDoCondo])

  // Estado de seleção de contatos para envio de WhatsApp (guarda IDs de cada pessoa)
  const [selecionados, setSelecionados] = useState(() => todosDoCondo.map(m => m.id))

  useEffect(() => {
    setSelecionados(todosDoCondo.map(m => m.id))
  }, [condoNome, moradores.length])

  const toggleContato = (id) => {
    setSelecionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const toggleUnidadeInteira = (unidade) => {
    const idsUnidade = unidade.moradores.map(m => m.id)
    const todosMarcados = idsUnidade.every(id => selecionados.includes(id))

    if (todosMarcados) {
      setSelecionados(prev => prev.filter(id => !idsUnidade.includes(id)))
    } else {
      setSelecionados(prev => Array.from(new Set([...prev, ...idsUnidade])))
    }
  }

  const handleCustomValChange = (aptKey, val) => {
    setValoresCustom(prev => ({ ...prev, [aptKey]: val }))
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

  // Filtragem na busca
  const unidadesVisiveis = unidadesAgrupadas.filter(u => {
    if (!buscaNome) return true
    const q = buscaNome.toLowerCase()
    const matchApt = u.apt.toLowerCase().includes(q)
    const matchMoradores = u.moradores.some(m => 
      (m.nome || '').toLowerCase().includes(q) || 
      String(m.tel || m.telefone || m.whatsapp || '').includes(q)
    )
    return matchApt || matchMoradores
  })

  // Quantas unidades têm pelo menos 1 pessoa selecionada
  const unidadesSelecionadas = unidadesAgrupadas.filter(u => 
    u.moradores.some(m => selecionados.includes(m.id))
  )

  const handleGerar = async () => {
    if (isSubmitting) return

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
    if (unidadesSelecionadas.length === 0) {
      alert("Selecione pelo menos uma unidade/morador para gerar os boletos.")
      return
    }

    // Verifica se já existem boletos gerados para o condomínio e competência selecionados
    const compNormalizada = (competencia || '').trim().toLowerCase()
    const cTarget = normalizeCondo(condoNome)
    const boletosExistentes = (allBoletos || []).filter(b => {
      const bCondo = normalizeCondo(b.condominio)
      const bComp = (b.competencia || '').trim().toLowerCase()
      return bCondo === cTarget && bComp === compNormalizada
    })

    const aptsDuplicados = []
    unidadesSelecionadas.forEach(u => {
      const aptKey = String(u.apt).trim().toLowerCase()
      const jaExiste = boletosExistentes.some(b => String(b.apt || b.unidade || '').trim().toLowerCase() === aptKey)
      if (jaExiste) {
        aptsDuplicados.push(u.apt)
      }
    })

    if (aptsDuplicados.length > 0) {
      const msgDuplicados = `⚠️ Atenção! Já existem boletos gerados para a competência "${competencia}" no condomínio "${condoNome}" para os seguintes apartamentos:\n\n${aptsDuplicados.map(a => `• Apt ${a}`).join('\n')}\n\nDeseja continuar mesmo assim e sobrescrever/gerar novamente?`
      if (!window.confirm(msgDuplicados)) {
        return
      }
    }

    setIsSubmitting(true)

    try {
      // Gera 1 único boleto contábil por unidade no nome do Titular, incluindo a lista de todos os contatos selecionados para envio
      const listaParaCriar = unidadesSelecionadas.map(u => {
        const titular = u.titular || u.moradores[0]
        const valUnidadeRaw = valoresCustom[u.apt] !== undefined ? valoresCustom[u.apt] : valorStr
        const valFinal = typeof valUnidadeRaw === 'number' ? valUnidadeRaw : (parseFloat(String(valUnidadeRaw || '').replace(/\./g, '').replace(',', '.')) || valorPadraoNum)

        // Contatos selecionados desta unidade que receberão o WhatsApp
        const contatosEnvio = u.moradores
          .filter(m => selecionados.includes(m.id))
          .map(m => ({
            moradorId: m.id,
            nome: m.nome,
            tel: m.tel || m.telefone || m.whatsapp || m.celular || m.fone || '',
            vinculo: m.status || m.tipo || 'Morador'
          }))
          .filter(c => c.tel && c.tel.replace(/\D/g, '').length >= 8)

        return {
          moradorId: titular?.id || '',
          morador: titular?.nome || `Morador Apt ${u.apt}`,
          cpf: titular?.cpf || '',
          telefone: titular?.tel || titular?.telefone || titular?.whatsapp || '',
          email: titular?.email || '',
          apt: u.apt,
          bloco: u.bloco || titular?.bloco || '',
          condominio: condoNome,
          cnpjCondominio: condoSelecionado?.cnpj || '',
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
          linha: gerarLinhaDigitavel(u.apt, valFinal, vencimento),
          pix_emv: generateStaticPix(chavePix, valFinal, condoNome, "BR"),
          contatosEnvio: contatosEnvio,
          _createdAt: new Date().toISOString()
        }
      })

      await onSave(listaParaCriar, enviarWhatsAppAuto)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay z-50 p-2 sm:p-4 flex items-center justify-center" onClick={onClose}>
      <div className="modal-content max-w-5xl w-full p-0 flex flex-col max-h-[94vh] overflow-hidden bg-white rounded-3xl shadow-2xl border border-gray-200" onClick={e => e.stopPropagation()}>
        
        {/* Cabeçalho */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-black text-base sm:text-lg flex items-center gap-2">
              📦 Gerar Boletos do Mês por Unidade
            </h3>
            <p className="text-[11px] sm:text-xs text-gray-400">
              Gera 1 boleto oficial no nome do Titular e envia via WhatsApp para o titular e dependentes selecionados
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Corpo em 2 Colunas */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 sm:p-5 overflow-y-auto flex-1 bg-slate-50">
          
          {/* Coluna Esquerda: Parâmetros */}
          <div className="lg:col-span-5 flex flex-col gap-3">
            
            {/* Condomínio e PIX */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col gap-3">
              <div>
                <label className="label text-xs font-black">Condomínio *</label>
                <select className="input text-xs font-bold w-full bg-slate-50" value={condoNome} onChange={e => setCondoNome(e.target.value)}>
                  {condominiosValidos.length === 0 && <option value="">Nenhum condomínio cadastrado</option>}
                  {condominiosValidos.map(c => <option key={c.id || c.nome} value={c.nome}>{c.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="label text-xs font-black">Chave PIX de Recebimento</label>
                <input className="input text-xs w-full bg-slate-50" value={chavePix} onChange={e => setChavePix(e.target.value)} placeholder="CNPJ, E-mail ou Celular" />
              </div>
            </div>

            {/* Valores e Datas */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label text-xs font-black">Valor Padrão da Cota por Apt (R$) *</label>
                <CurrencyInput value={valorStr} onChange={v => setValorStr(v)} placeholder="0,00" />
              </div>
              <div>
                <label className="label text-xs font-black">Competência *</label>
                <input className="input text-xs font-bold w-full bg-slate-50" value={competencia} onChange={e => setCompetencia(e.target.value)} placeholder="Ex: Set/2026" />
              </div>
              <div>
                <label className="label text-xs font-black">Vencimento *</label>
                <input type="date" className="input text-xs font-bold w-full bg-slate-50" value={vencimento} onChange={e => setVencimento(e.target.value)} />
              </div>
            </div>

            {/* Serviço de Cobrança Digital */}
            <div 
              onClick={handleToggleTaxa}
              className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer select-none shadow-sm flex flex-col gap-2 ${
                discriminarTaxa 
                  ? 'bg-brand-50/90 border-brand-500 ring-2 ring-brand-200' 
                  : 'bg-white border-gray-200 hover:border-brand-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    id="check-taxa-lote"
                    checked={discriminarTaxa}
                    onChange={handleToggleTaxa}
                    onClick={e => e.stopPropagation()}
                    className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500 cursor-pointer shrink-0"
                  />
                  <span className="text-xs font-black text-gray-900">
                    Serviço de Cobrança Digital (R$ {taxaStr !== '' && taxaStr !== undefined && taxaStr !== null ? maskCurrency(taxaStr) : '3,50'})
                  </span>
                </div>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${discriminarTaxa ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                  {discriminarTaxa ? 'Ativado' : 'Desativado'}
                </span>
              </div>

              {discriminarTaxa && (
                <div 
                  onClick={e => e.stopPropagation()} 
                  className="grid grid-cols-2 gap-2 mt-1 bg-white p-2.5 rounded-xl border border-brand-200 shadow-inner"
                >
                  <div>
                    <label className="label text-[9px] font-black">Taxa (R$)</label>
                    <CurrencyInput value={taxaStr} onChange={v => setTaxaStr(v)} placeholder="3,50" />
                  </div>
                  <div>
                    <label className="label text-[9px] font-black">Texto no Boleto</label>
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

            {/* Disparo WhatsApp */}
            <div 
              onClick={() => setEnviarWhatsAppAuto(p => !p)}
              className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer select-none shadow-sm flex flex-col gap-1.5 ${
                enviarWhatsAppAuto 
                  ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-200' 
                  : 'bg-white border-gray-200 hover:border-emerald-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    id="check-whatsapp-auto"
                    checked={enviarWhatsAppAuto}
                    onChange={() => setEnviarWhatsAppAuto(p => !p)}
                    onClick={e => e.stopPropagation()}
                    className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500 cursor-pointer shrink-0"
                  />
                  <span className="text-xs font-black text-emerald-950">
                    🚀 Enviar boletos no WhatsApp de todos selecionados
                  </span>
                </div>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${enviarWhatsAppAuto ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                  {enviarWhatsAppAuto ? 'Ativado' : 'Desativado'}
                </span>
              </div>
            </div>

          </div>

          {/* Coluna Direita: Unidades & Contatos */}
          <div className="lg:col-span-7 flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden min-h-[440px]">
            
            {/* Topo da lista */}
            <div className="p-3 bg-slate-100 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-black text-gray-900 block">
                  🏢 {unidadesSelecionadas.length} de {unidadesAgrupadas.length} Unidades ({selecionados.length} destinatários)
                </span>
                <span className="text-[10px] text-gray-500">
                  O boleto é gerado no nome do Titular e disparado para os números marcados
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setSelecionados(todosDoCondo.map(m => m.id))}
                  className="text-[10px] font-bold px-2 py-1 bg-white border border-gray-300 rounded-lg hover:bg-slate-50 text-gray-700"
                >
                  Marcar Todos
                </button>
                <button
                  type="button"
                  onClick={() => setSelecionados(todosDoCondo.filter(m => m.status !== 'Dependente' && m.tipo !== 'Dependente').map(m => m.id))}
                  className="text-[10px] font-bold px-2 py-1 bg-white border border-brand-300 rounded-lg hover:bg-brand-50 text-brand-700"
                >
                  Apenas Titulares
                </button>
                <button
                  type="button"
                  onClick={() => setSelecionados([])}
                  className="text-[10px] font-bold px-2 py-1 bg-white border border-gray-300 rounded-lg hover:bg-red-50 text-red-600"
                >
                  Limpar
                </button>
              </div>
            </div>

            {/* Busca */}
            <div className="p-2.5 bg-slate-50 border-b border-gray-200">
              <input
                type="text"
                className="input text-xs py-1 px-2.5 bg-white w-full"
                placeholder="🔍 Buscar por morador, apartamento ou telefone..."
                value={buscaNome}
                onChange={e => setBuscaNome(e.target.value)}
              />
            </div>

            {/* Lista Agrupada por Apartamento */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-200 max-h-[380px]">
              {unidadesVisiveis.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400">
                  Nenhuma unidade encontrada para este condomínio.
                </div>
              ) : (
                unidadesVisiveis.map(u => {
                  const titular = u.titular || u.moradores[0]
                  const temSelecionadoNaUnidade = u.moradores.some(m => selecionados.includes(m.id))

                  return (
                    <div key={u.apt} className={`p-3.5 flex flex-col gap-2 transition-all ${temSelecionadoNaUnidade ? 'bg-slate-50/50' : 'opacity-60 bg-white'}`}>
                      
                      {/* Linha do Apartamento e Titular */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            type="button"
                            onClick={() => toggleUnidadeInteira(u)}
                            className="text-xs font-black text-slate-900 bg-slate-200 hover:bg-slate-300 px-2.5 py-1 rounded-lg border border-slate-300 shrink-0"
                            title="Marcar/Desmarcar todos desta unidade"
                          >
                            🏢 Apt {u.apt} {u.bloco ? `(${u.bloco})` : ''}
                          </button>
                          <span className="text-xs font-bold text-gray-800 truncate">
                            Titular do Boleto: <strong>{titular?.nome || 'Não definido'}</strong>
                          </span>
                        </div>

                        {/* Valor individual se quiser customizar */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] text-gray-500 font-bold hidden sm:inline">Valor Apt:</span>
                          <div className="w-24">
                            <CurrencyInput
                              value={valoresCustom[u.apt] !== undefined ? valoresCustom[u.apt] : valorStr}
                              onChange={v => handleCustomValChange(u.apt, v)}
                              placeholder="0,00"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Lista de Contatos/Dependentes para Envio de WhatsApp */}
                      <div className="pl-3 sm:pl-4 border-l-2 border-emerald-300 ml-2 flex flex-col gap-1.5">
                        <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                          📲 Contatos para envio do WhatsApp desta unidade:
                        </span>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {u.moradores.map(m => {
                            const isSel = selecionados.includes(m.id)
                            const isDep = m.status === 'Dependente' || m.tipo === 'Dependente' || m.tipoMorador === 'Dependente'
                            const rawTel = m.tel || m.telefone || m.whatsapp || m.celular || m.fone || ''
                            const temWhats = rawTel && rawTel.replace(/\D/g, '').length >= 8

                            return (
                              <label
                                key={m.id}
                                className={`flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer transition-all select-none ${
                                  isSel 
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold shadow-xs' 
                                    : 'bg-white border-gray-200 text-gray-500 hover:bg-slate-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSel}
                                  onChange={() => toggleContato(m.id)}
                                  className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500 cursor-pointer shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1 truncate">
                                    <span className="truncate">{m.nome}</span>
                                    <span className={`text-[8px] font-black uppercase px-1 py-0.2 rounded ${
                                      isDep ? 'bg-purple-100 text-purple-700' :
                                      (m.status === 'Síndico' || m.tipo === 'Síndico') ? 'bg-amber-100 text-amber-800' :
                                      'bg-blue-100 text-blue-700'
                                    }`}>
                                      {m.status || (isDep ? 'Dependente' : 'Titular')}
                                    </span>
                                  </div>
                                  <span className="text-[10px] font-mono text-gray-500 block truncate">
                                    📞 {rawTel || 'Sem WhatsApp'}
                                  </span>
                                </div>
                              </label>
                            )
                          })}
                        </div>
                      </div>

                    </div>
                  )
                })
              )}
            </div>
          </div>

        </div>

        {/* Rodapé com botão de ação */}
        <div className="p-4 sm:p-5 border-t border-gray-200 bg-white flex items-center justify-between gap-3 shrink-0">
          <button onClick={onClose} disabled={isSubmitting} className="btn-secondary text-xs">Cancelar</button>
          <button
            onClick={handleGerar}
            disabled={isSubmitting}
            className={`btn-primary text-xs font-black bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-700/20 py-2.5 px-5 flex items-center gap-2 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <CheckCircle2 size={16} /> {isSubmitting ? 'Processando...' : `Gerar ${unidadesSelecionadas.length} ${unidadesSelecionadas.length === 1 ? 'Boleto' : 'Boletos'} (${selecionados.length} envios de WhatsApp)`}
          </button>
        </div>

      </div>
    </div>
  )
}

function ModalNotificarVencimento({ boletosPendentes, moradores, condominios, onClose, onEnviarLote }) {
  const [selecionadosIds, setSelecionadosIds] = useState(() => boletosPendentes.map(b => b.id))
  const [busca, setBusca] = useState('')
  const [tipoTemplate, setTipoTemplate] = useState('cobranca') // 'cobranca', 'vencendo', 'hoje', 'vencido', 'custom'
  const [mensagemPersonalizada, setMensagemPersonalizada] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [progresso, setProgresso] = useState(null)

  // Mensagens modelo pré-configuradas com variáveis inteligentes
  const templates = {
    cobranca: `*Alpha Soluções Condominiais*\nOlá *{morador}* (Apt *{apt}*)!\n\nSegue a sua cobrança referente a *{competencia}* do *{condominio}*:\n\n📋 *Discriminação:* {tipoCobranca}\n💰 *Valor:* R$ {valor}\n📅 *Vencimento:* {vencimento}\n\n💠 *PIX Copia e Cola:*\n\`\`\`{pix}\`\`\`\n\nAbra o aplicativo do seu banco, escolha a opção PIX Copia e Cola e cole o código acima para pagamento instantâneo. O boleto oficial em PDF segue em anexo.\n\nQualquer dúvida estamos à disposição!\n*Alpha Soluções Condominiais*`,
    vencendo: `Olá *{morador}* (Apt *{apt}*)!\n\nPassando para lembrar que o seu *Boleto Condominial* referente a *{competencia}* do *{condominio}* está próximo do vencimento em *{vencimento}*.\n\n💰 *Valor:* R$ {valor}\n\nSegue o boleto oficial em anexo com o QR Code PIX para sua comodidade. Evite multas pagando em dia!\n\nAtenciosamente,\n*Alpha Soluções Condominiais*`,
    hoje: `🔴 *Seu Boleto Condominial Vence HOJE*\n\nOlá *{morador}* (Apt *{apt}*)!\n\nLembramos que a taxa de condomínio referente a *{competencia}* do *{condominio}* vence *hoje* ({vencimento}).\n\n💰 *Valor:* R$ {valor}\n\nEfetue o pagamento via PIX no documento em anexo para evitar a incidência de juros e encargos.\n\nAtenciosamente,\n*Alpha Soluções Condominiais*`,
    vencido: `Prezado(a) *{morador}* (Apt *{apt}*),\n\nIdentificamos que o boleto condominial referente a *{competencia}* do *{condominio}* encontra-se em aberto (venceu em {vencimento}).\n\n💰 *Valor:* R$ {valor}\n\nPara facilitar a regularização, segue em anexo o documento oficial com o *QR Code PIX*. Caso já tenha efetuado o pagamento, por favor desconsidere este aviso.\n\nAtenciosamente,\n*Alpha Soluções Condominiais*`,
    custom: `Olá *{morador}* (Apt *{apt}*)!\n\nSegue em anexo o seu boleto de *{competencia}* do *{condominio}* com vencimento em *{vencimento}*, no valor de R$ {valor}.\n\nAtenciosamente,\n*Alpha Soluções Condominiais*`
  }

  const textoBase = tipoTemplate === 'custom' ? (mensagemPersonalizada || templates.custom) : templates[tipoTemplate]

  // Boletos filtrados por busca
  const boletosFiltrados = boletosPendentes.filter(b => {
    if (!busca) return true
    const s = busca.toLowerCase()
    return (b.morador || '').toLowerCase().includes(s) ||
           String(b.apt || '').toLowerCase().includes(s) ||
           (b.condominio || '').toLowerCase().includes(s)
  })

  const toggleSelect = (id) => {
    setSelecionadosIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const toggleTodos = () => {
    if (selecionadosIds.length === boletosFiltrados.length) {
      setSelecionadosIds([])
    } else {
      setSelecionadosIds(boletosFiltrados.map(b => b.id))
    }
  }

  const getMsgFormatadaParaBoleto = (b, moradorDoc) => {
    const condoDoc = (condominios || []).find(c => c.nome === (b.condominio || moradorDoc?.condominio))
    const chavePix = condoDoc?.chave_pix || 'alpha.solucoes@condominios.com.br'
    const pixStr = b.pix_emv || generateStaticPix(chavePix, b.valor, condoDoc?.nome || "Alpha Solucoes", "BR")
    const valorFmt = Number(b.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
    const vencFmt = b.vencimento ? (b.vencimento.includes('-') ? b.vencimento.split('-').reverse().join('/') : b.vencimento) : '—'
    const tipoCobrancaStr = b.tipoCobranca ? `${b.tipoCobranca} (${b.competencia || 'Mês Vigente'})` : (b.descricao || 'Taxa Condominial')

    return (textoBase || '')
      .replace(/{morador}/g, b.morador || 'Morador')
      .replace(/{apt}/g, b.apt || '—')
      .replace(/{condominio}/g, condoDoc?.nome || b.condominio || 'Condomínio')
      .replace(/{competencia}/g, b.competencia || 'Mês Vigente')
      .replace(/{vencimento}/g, vencFmt)
      .replace(/{valor}/g, valorFmt)
      .replace(/{tipoCobranca}/g, tipoCobrancaStr)
      .replace(/{pix}/g, pixStr)
  }

  const abrirWhatsWebSingle = (b, moradorDoc) => {
    const msg = getMsgFormatadaParaBoleto(b, moradorDoc)
    let rawTel = b.tel || b.telefone || b.whatsapp || moradorDoc?.tel || moradorDoc?.telefone || moradorDoc?.whatsapp || moradorDoc?.celular || ''
    let cleanTel = String(rawTel).replace(/\D/g, '')

    if (!cleanTel || cleanTel.length < 8) {
      const promptTel = window.prompt(`Informe o WhatsApp com DDD para ${b.morador}:`, cleanTel)
      if (promptTel) cleanTel = String(promptTel).replace(/\D/g, '')
    }

    if (cleanTel && !cleanTel.startsWith('55') && cleanTel.length >= 10) {
      cleanTel = `55${cleanTel}`
    }

    const waUrl = cleanTel ? `https://wa.me/${cleanTel}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(waUrl, '_blank')
  }

  const handleAbrirWhatsWebLote = () => {
    const listaParaEnviar = boletosPendentes.filter(b => selecionadosIds.includes(b.id))
    if (listaParaEnviar.length === 0) {
      alert('Selecione ao menos um morador.')
      return
    }

    if (listaParaEnviar.length > 5) {
      const confirm = window.confirm(`Você selecionou ${listaParaEnviar.length} moradores. O navegador abrirá as conversas do WhatsApp Web sequencialmente. Deseja continuar?`)
      if (!confirm) return
    }

    listaParaEnviar.forEach((b, idx) => {
      setTimeout(() => {
        const moradorDoc = (moradores || []).find(m => 
          (m.id && b.moradorId && m.id === b.moradorId) ||
          (m.nome && b.morador && m.nome.trim().toLowerCase() === b.morador.trim().toLowerCase()) ||
          (m.apt && b.apt && String(m.apt).trim() === String(b.apt).trim())
        )
        abrirWhatsWebSingle(b, moradorDoc)
      }, idx * 700)
    })
  }

  const handleDisparar = async () => {
    const listaParaEnviar = boletosPendentes.filter(b => selecionadosIds.includes(b.id))
    if (listaParaEnviar.length === 0) {
      alert('Selecione ao menos um morador para disparar.')
      return
    }

    setEnviando(true)
    try {
      await onEnviarLote(listaParaEnviar, textoBase, (prog) => {
        setProgresso(prog)
      })
      onClose()
    } catch (err) {
      console.error(err)
      alert('Erro durante o envio: ' + err.message)
    } finally {
      setEnviando(false)
      setProgresso(null)
    }
  }

  return (
    <div className="modal-overlay z-50" onClick={!enviando ? onClose : undefined}>
      <div className="modal-content max-w-3xl w-full p-0 flex flex-col max-h-[92vh] overflow-hidden rounded-3xl shadow-2xl bg-white" onClick={e => e.stopPropagation()}>
        
        {/* Cabeçalho */}
        <div className="p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-400 flex items-center justify-center">
              <MessageSquare size={22} />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg flex items-center gap-2">
                Enviar Boletos via WhatsApp
                <span className="bg-emerald-500 text-slate-950 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">Mensagem + PIX + PDF</span>
              </h3>
              <p className="text-xs text-slate-300">
                Selecione os moradores para os quais deseja enviar a mensagem de cobrança com os dados de pagamento.
              </p>
            </div>
          </div>
          {!enviando && (
            <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-xl">
              <X size={20} />
            </button>
          )}
        </div>

        {/* Corpo */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-5">
          
          {/* Seletor de Modelo de Mensagem */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-gray-200 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-black text-gray-800 uppercase flex items-center gap-1.5">
                <Sparkles size={14} className="text-emerald-600" />
                Finalidade / Modelo da Mensagem:
              </label>
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-200 flex-wrap">
                <button
                  type="button"
                  onClick={() => setTipoTemplate('cobranca')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                    tipoTemplate === 'cobranca' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  📨 Envio de Cobrança
                </button>
                <button
                  type="button"
                  onClick={() => setTipoTemplate('vencendo')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                    tipoTemplate === 'vencendo' ? 'bg-amber-500 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  ⏳ Vencendo em Breve
                </button>
                <button
                  type="button"
                  onClick={() => setTipoTemplate('hoje')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                    tipoTemplate === 'hoje' ? 'bg-rose-500 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  🔴 Vence Hoje
                </button>
                <button
                  type="button"
                  onClick={() => setTipoTemplate('vencido')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                    tipoTemplate === 'vencido' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  ⚠️ Em Atraso
                </button>
                <button
                  type="button"
                  onClick={() => setTipoTemplate('custom')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                    tipoTemplate === 'custom' ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  ✏️ Personalizar
                </button>
              </div>
            </div>

            {tipoTemplate === 'custom' ? (
              <textarea
                className="input text-xs min-h-[90px] font-mono leading-relaxed"
                value={mensagemPersonalizada}
                onChange={e => setMensagemPersonalizada(e.target.value)}
                placeholder="Digite a mensagem. Variáveis disponíveis: {morador}, {apt}, {condominio}, {competencia}, {vencimento}, {valor}, {tipoCobranca}, {pix}"
              />
            ) : (
              <div className="bg-white p-3 rounded-xl border border-gray-200 text-xs text-gray-700 whitespace-pre-line leading-relaxed font-sans">
                {textoBase}
              </div>
            )}
            <p className="text-[11px] text-gray-500">
              💡 <b>Nota:</b> O arquivo PDF com o código de barras e o QR Code PIX acompanha o envio pelo WhatsApp.
            </p>
          </div>

          {/* Lista de Moradores com Checkbox e Ação Individual */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-gray-800 uppercase">
                  Moradores Selecionáveis ({boletosFiltrados.length})
                </span>
                <span className="text-xs font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  {selecionadosIds.length} marcado(s)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Buscar morador, apt..."
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  className="input text-xs py-1.5 px-3 w-48 sm:w-56"
                />
                <button
                  type="button"
                  onClick={toggleTodos}
                  className="text-xs font-bold text-brand-600 hover:text-brand-800 underline cursor-pointer shrink-0"
                >
                  {selecionadosIds.length === boletosFiltrados.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                </button>
              </div>
            </div>

            <div className="border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100 max-h-[320px] overflow-y-auto bg-white">
              {boletosFiltrados.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400">
                  Nenhum morador pendente encontrado com os filtros atuais.
                </div>
              ) : (
                boletosFiltrados.map(b => {
                  const isSel = selecionadosIds.includes(b.id)
                  const moradorDoc = (moradores || []).find(m => 
                    (m.id && b.moradorId && m.id === b.moradorId) ||
                    (m.nome && b.morador && m.nome.trim().toLowerCase() === b.morador.trim().toLowerCase()) ||
                    (m.apt && b.apt && String(m.apt).trim() === String(b.apt).trim() && (!b.condominio || m.condominio === b.condominio))
                  )
                  const rawTel = moradorDoc?.tel || moradorDoc?.telefone || moradorDoc?.whatsapp || b.telefone || b.tel || ''
                  const temTel = !!rawTel && String(rawTel).replace(/\D/g, '').length >= 8

                  const d = b.vencimento ? Math.round((new Date(b.vencimento + 'T12:00:00') - new Date()) / 86400000) : null
                  const labelVenc = d === null ? '' : d < 0 ? `Vencido há ${Math.abs(d)} dia(s)` : d === 0 ? 'Vence HOJE' : `Vence em ${d} dia(s)`
                  const corVenc = d === null ? 'text-gray-500' : d < 0 ? 'text-purple-600 font-bold' : d === 0 ? 'text-rose-600 font-bold' : 'text-amber-700 font-bold'

                  return (
                    <div
                      key={b.id}
                      onClick={() => toggleSelect(b.id)}
                      className={`p-3.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                        isSel ? 'bg-emerald-50/50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => {}} // tratado no onClick do container
                          className="w-4 h-4 rounded text-emerald-600 border-gray-300 focus:ring-emerald-500 cursor-pointer shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs text-gray-900 truncate">{b.morador}</span>
                            <span className="text-[11px] font-black text-brand-700 bg-brand-50 px-1.5 py-0.2 rounded border border-brand-200">
                              {b.apt ? `Apt ${b.apt}` : '—'}
                            </span>
                            <span className="text-[10px] text-gray-500 truncate max-w-[140px]">
                              • {b.condominio || 'Geral'}
                            </span>
                            {b.tipoCobranca && b.tipoCobranca !== 'Taxa Condominial' && (
                              <span className="text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200 px-1 rounded">
                                {b.tipoCobranca}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                            <span className={`text-[10px] ${corVenc}`}>
                              📅 Venc: {b.vencimento || '—'} {labelVenc ? `(${labelVenc})` : ''}
                            </span>
                            <span className="text-gray-300">•</span>
                            <span className={temTel ? 'text-emerald-700 font-semibold' : 'text-rose-600 font-bold'}>
                              {temTel ? `📞 ${rawTel}` : '⚠️ Sem WhatsApp cadastrado'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <span className="font-mono font-black text-xs text-gray-900 block">
                            R$ {Number(b.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-100/70 px-1.5 py-0.2 rounded">
                            {b.competencia || 'Mês Atual'}
                          </span>
                        </div>

                        {/* Botão de Envio Manual Imediato via WhatsApp Web */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            abrirWhatsWebSingle(b, moradorDoc)
                          }}
                          className="p-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-[11px] font-bold flex items-center gap-1 shadow-2xs transition-colors"
                          title="Abrir diretamente no WhatsApp Web para enviar agora"
                        >
                          <MessageSquare size={13} className="text-emerald-600" />
                          <span className="hidden sm:inline">WhatsApp</span>
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Barra de Progresso durante o envio */}
          {progresso && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col gap-2 animate-fade-in">
              <div className="flex items-center justify-between text-xs font-black text-emerald-950">
                <span>Enviando boleto para: {progresso.morador}...</span>
                <span>{progresso.atual} de {progresso.total}</span>
              </div>
              <div className="w-full bg-emerald-200/60 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-emerald-600 h-full transition-all duration-300"
                  style={{ width: `${(progresso.atual / progresso.total) * 100}%` }}
                />
              </div>
            </div>
          )}

        </div>

        {/* Rodapé com Envio Manual ou Automático */}
        <div className="p-4 bg-slate-50 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={enviando}
            className="btn-secondary text-xs"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Opção 1: Enviar Manual no WhatsApp Web */}
            <button
              type="button"
              onClick={handleAbrirWhatsWebLote}
              disabled={enviando || selecionadosIds.length === 0}
              className="btn-secondary bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-bold flex items-center gap-1.5 py-2 px-3.5 shadow-2xs cursor-pointer"
              title="Abre as conversas dos moradores selecionados no WhatsApp Web para você clicar e enviar manualmente"
            >
              <MessageSquare size={14} className="text-emerald-600" />
              <span>Enviar Manual (WhatsApp Web)</span>
            </button>

            {/* Opção 2: Disparo Automático pelo Robô */}
            <button
              type="button"
              onClick={handleDisparar}
              disabled={enviando || selecionadosIds.length === 0}
              className="btn-primary bg-emerald-600 hover:bg-emerald-500 text-xs font-black flex items-center gap-2 py-2 px-4 shadow-md shadow-emerald-700/20 disabled:opacity-50 cursor-pointer"
              title="Dispara automaticamente pelo robô da Alpha com o PDF anexo para todos os selecionados"
            >
              <Send size={14} />
              <span>
                {enviando 
                  ? 'Disparando...' 
                  : `Disparar Automático (${selecionadosIds.length})`
                }
              </span>
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

function ModalImportarPlanilha({ condominios, moradores, initialCondo = '', onClose, onSave }) {
  const [condominio, setCondominio] = useState(() => {
    if (initialCondo && initialCondo !== 'Todos') return initialCondo
    return condominios[0]?.nome || ''
  })
  const [competencia, setCompetencia] = useState(() => {
    return new Date().toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '/')
  })
  const [parsedBoletos, setParsedBoletos] = useState([])
  const [nomeArquivo, setNomeArquivo] = useState('')
  const [processando, setProcessando] = useState(false)
  const [salvando, setSalvando] = useState(false)

  // Moradores filtrados pelo condomínio selecionado
  const moradoresDoCondo = React.useMemo(() => {
    if (!condominio) return []
    const cNorm = String(condominio).trim().toLowerCase()
    return (moradores || []).filter(m => {
      const mc = String(m.condominio || '').trim().toLowerCase()
      return mc === cNorm || mc.includes(cNorm) || cNorm.includes(mc)
    })
  }, [moradores, condominio])

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setNomeArquivo(file.name)
    setProcessando(true)

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target.result
        const lines = text.split(/\r?\n/).filter(l => l.trim() !== '')
        if (lines.length < 2) {
          alert('A planilha parece estar vazia ou sem cabeçalho.')
          setProcessando(false)
          return
        }

        const headers = lines[0].toLowerCase().split(/[;,]/).map(h => h.trim())
        const getIdx = (keywords) => headers.findIndex(h => keywords.some(k => h.includes(k)))

        const idxMorador = getIdx(['nome', 'morador', 'pagador', 'sacado', 'cliente'])
        const idxApt = getIdx(['apt', 'unidade', 'lote', 'apto', 'casa', 'sala'])
        const idxBloco = getIdx(['bloco', 'torre', 'bl'])
        const idxCpf = getIdx(['cpf', 'cnpj', 'documento', 'doc'])
        const idxVencimento = getIdx(['venc', 'data', 'vencimento'])
        const idxValor = getIdx(['valor', 'total', 'cota', 'taxa'])
        const idxLink = getIdx(['link', 'url', 'pdf', 'arquivo'])
        const idxPix = getIdx(['pix', 'emv', 'copia'])
        const idxLinha = getIdx(['linha', 'digitavel', 'codigo', 'barras', 'barcode'])

        if (idxValor === -1) {
          alert("Não conseguimos identificar a coluna de 'Valor' na planilha.")
          setProcessando(false)
          return
        }

        const normStr = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

        const lista = []
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(/[;,]/).map(c => c.trim().replace(/^"|"$/g, ''))
          let valorBruto = idxValor !== -1 ? cols[idxValor] || '0' : '0'
          let valor = parseFloat(valorBruto.replace(/\./g, '').replace(',', '.')) || 0
          if (isNaN(valor)) valor = parseFloat(valorBruto.replace(',', '.')) || 0
          if (valor <= 0) continue

          const rawNome = idxMorador !== -1 ? (cols[idxMorador] || '') : ''
          const rawApt = idxApt !== -1 ? (cols[idxApt] || '') : ''
          const rawBloco = idxBloco !== -1 ? (cols[idxBloco] || '') : ''
          const rawCpf = idxCpf !== -1 ? (cols[idxCpf] || '') : ''
          const aptDigits = String(rawApt).replace(/\D/g, '')

          // 1º Cruzamento: Unidade/Apt no condomínio selecionado
          let moradorEncontrado = null
          if (aptDigits) {
            moradorEncontrado = moradoresDoCondo.find(m => {
              const mAptDigits = String(m.apt || m.unidade || '').replace(/\D/g, '')
              const matchBloco = rawBloco ? normStr(m.bloco) === normStr(rawBloco) : true
              return mAptDigits === aptDigits && matchBloco
            })
          }

          // 2º Cruzamento: CPF
          if (!moradorEncontrado && rawCpf) {
            const cleanCpf = rawCpf.replace(/\D/g, '')
            if (cleanCpf) {
              moradorEncontrado = moradoresDoCondo.find(m => String(m.cpf || '').replace(/\D/g, '') === cleanCpf)
            }
          }

          // 3º Cruzamento: Nome aproximado
          if (!moradorEncontrado && rawNome) {
            const nNorm = normStr(rawNome)
            moradorEncontrado = moradoresDoCondo.find(m => {
              const mnNorm = normStr(m.nome)
              return mnNorm === nNorm || mnNorm.includes(nNorm) || nNorm.includes(mnNorm)
            })
          }

          let venc = idxVencimento !== -1 ? (cols[idxVencimento] || '') : ''
          if (venc && venc.includes('/')) {
            const parts = venc.split('/')
            if (parts.length === 3) venc = `${parts[2]}-${parts[1]}-${parts[0]}`
          }

          const finalNome = moradorEncontrado?.nome || rawNome || `Morador Apt ${rawApt || i}`
          const finalApt = moradorEncontrado?.apt || rawApt || '1'
          const finalBloco = moradorEncontrado?.bloco || rawBloco || ''
          const finalCpf = moradorEncontrado?.cpf || rawCpf || ''
          const finalTel = moradorEncontrado?.tel || moradorEncontrado?.telefone || ''

          lista.push({
            idTemp: `imp_${i}`,
            morador: finalNome,
            apt: finalApt,
            bloco: finalBloco,
            cpf: finalCpf,
            tel: finalTel,
            valor,
            vencimento: venc,
            competencia,
            condominio,
            url: idxLink !== -1 ? (cols[idxLink] || '') : '',
            pix_emv: idxPix !== -1 ? (cols[idxPix] || '') : '',
            linha: idxLinha !== -1 ? (cols[idxLinha] || '') : '',
            encontradoNoSistema: !!moradorEncontrado,
            moradorId: moradorEncontrado?.id || null
          })
        }

        setParsedBoletos(lista)
      } catch (err) {
        console.error(err)
        alert('Erro ao ler a planilha: ' + err.message)
      } finally {
        setProcessando(false)
      }
    }
    reader.readAsText(file)
  }

  const handleConfirmar = async () => {
    if (!condominio) {
      alert('Selecione o condomínio.')
      return
    }
    if (parsedBoletos.length === 0) {
      alert('Nenhum boleto válido carregado da planilha.')
      return
    }

    setSalvando(true)
    try {
      await onSave(parsedBoletos.map(b => ({
        ...b,
        condominio,
        competencia,
        status: 'Pendente',
        emitido: true,
        tipoCobranca: 'Taxa Condominial',
        _origem: 'importacao_planilha'
      })))
      onClose()
    } catch(err) {
      console.error(err)
      alert('Erro ao salvar os boletos: ' + err.message)
    } finally {
      setSalvando(false)
    }
  }

  const identificados = parsedBoletos.filter(b => b.encontradoNoSistema).length

  return (
    <div className="modal-overlay z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div className="modal-content max-w-2xl w-full bg-white rounded-3xl shadow-2xl border border-gray-200 flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {/* Cabeçalho */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-cream-100 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-600 text-white flex items-center justify-center font-bold shadow-md">
              <Upload size={20} />
            </div>
            <div>
              <h3 className="font-black text-gray-900 text-base">Importar Boletos Externos (Planilha)</h3>
              <p className="text-xs text-gray-500">Cadastre os boletos do seu banco para conciliação automática</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        {/* Configurações da Importação */}
        <div className="p-5 border-b border-gray-100 bg-slate-50/50 flex flex-col gap-4 shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label text-xs font-bold text-gray-700">🏢 Condomínio de Destino (Obrigatório):</label>
              <select 
                className="input text-xs font-bold bg-white"
                value={condominio} 
                onChange={e => setCondominio(e.target.value)}
              >
                {condominios.map(c => (
                  <option key={c.id || c.nome} value={c.nome}>
                    {c.nome}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-gray-500 mt-1">Os boletos pertencerão exclusivamente a este residencial.</p>
            </div>

            <div>
              <label className="label text-xs font-bold text-gray-700">📅 Mês / Competência:</label>
              <input 
                type="text" 
                className="input text-xs font-bold bg-white" 
                value={competencia} 
                onChange={e => setCompetencia(e.target.value)} 
                placeholder="out/2026"
              />
              <p className="text-[10px] text-gray-500 mt-1">Referência contábil da cobrança.</p>
            </div>
          </div>

          <div>
            <label className="label text-xs font-bold text-gray-700">📁 Selecione a Planilha (.CSV):</label>
            <div className="flex items-center gap-3">
              <label className="btn-secondary text-xs cursor-pointer flex items-center gap-2 bg-white border border-gray-300 hover:border-brand-500 py-2.5 px-4 shadow-sm">
                <Upload size={14} className="text-brand-600" />
                <span>{nomeArquivo || 'Escolher Arquivo CSV'}</span>
                <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFileChange} />
              </label>
              {processando && <span className="text-xs text-brand-600 font-bold animate-pulse">Cruzando dados com o condomínio...</span>}
            </div>
          </div>
        </div>

        {/* Pré-visualização com Identificação dos Moradores */}
        <div className="flex-1 overflow-y-auto p-5">
          {parsedBoletos.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center text-gray-400">
              <FileText size={40} className="stroke-1 text-gray-300 mb-2" />
              <p className="text-xs font-bold text-gray-600">Nenhum arquivo carregado ainda</p>
              <p className="text-[11px] text-gray-400 max-w-sm mt-1">
                Suba o CSV do banco. O sistema cruzará automaticamente a Unidade/Apartamento e CPF com os moradores cadastrados no condomínio selecionado.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-xs">
                <div className="flex items-center gap-2 text-emerald-900 font-bold">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>{parsedBoletos.length} boletos identificados na planilha</span>
                </div>
                <span className="text-emerald-800 font-bold bg-emerald-100 px-2.5 py-0.5 rounded-full text-[11px]">
                  {identificados} de {parsedBoletos.length} vinculados ao cadastro
                </span>
              </div>

              <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold">
                    <tr>
                      <th className="p-2.5">Unidade / Apt</th>
                      <th className="p-2.5">Morador Identificado</th>
                      <th className="p-2.5">Valor (R$)</th>
                      <th className="p-2.5">Vencimento</th>
                      <th className="p-2.5 text-right">Status do Vínculo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {parsedBoletos.map(b => (
                      <tr key={b.idTemp} className="hover:bg-gray-50/60">
                        <td className="p-2.5 font-black text-gray-800">
                          Apt {b.apt} {b.bloco ? `(${b.bloco})` : ''}
                        </td>
                        <td className="p-2.5 font-bold text-gray-700">
                          {b.morador}
                        </td>
                        <td className="p-2.5 font-mono font-bold text-emerald-700">
                          R$ {Number(b.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-2.5 text-gray-500">
                          {b.vencimento ? b.vencimento.split('-').reverse().join('/') : '—'}
                        </td>
                        <td className="p-2.5 text-right">
                          {b.encontradoNoSistema ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                              <Check size={11} /> Vinculado ao Sistema
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md" title="Será cadastrado com os dados da planilha">
                              Novo Registro
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <button onClick={onClose} disabled={salvando} className="btn-secondary text-xs">
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={salvando || parsedBoletos.length === 0}
            className={`btn-primary text-xs font-black bg-emerald-600 hover:bg-emerald-500 shadow-md py-2.5 px-5 flex items-center gap-2 ${salvando || parsedBoletos.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <CheckCircle2 size={16} />
            {salvando ? 'Importando Boletos...' : `Confirmar Importação de ${parsedBoletos.length} Boletos`}
          </button>
        </div>

      </div>
    </div>
  )
}

export default function Boletos() {
  const location = useLocation()
  const { user } = useAuth()
  const { items: allBoletos, addItem, updateItem, deleteItem } = useFirestore('boletos')
  const { items: allLancamentos, addItem: addFinanceiroLancamento, updateItem: updateFinanceiroLancamento, deleteItem: deleteFinanceiroLancamento } = useFirestore('financeiro_lancamentos')
  const { items: allCondominios, updateItem: updateCondominio } = useFirestore('condominios')
  const { items: allMoradoresDocs } = useFirestore('moradores')
  const { items: allUsuariosDocs } = useFirestore('usuarios')

  // Unificação automática e resiliente de moradores cadastrados diretamente + usuários registrados na plataforma
  const moradores = React.useMemo(() => {
    const lista = [...allMoradoresDocs]
    const idsDocExistentes = new Set(lista.map(m => m.idOriginalUsuario || m.id).filter(Boolean))
    const emailsExistentes = new Set(lista.map(m => (m.email || '').toLowerCase().trim()).filter(Boolean))
    const cpfsExistentes = new Set(lista.map(m => String(m.cpf || '').replace(/\D/g, '')).filter(Boolean))

    ;(allUsuariosDocs || []).forEach(u => {
      const uId = u.id
      const uEmail = (u.email || '').toLowerCase().trim()
      const uCpf = String(u.cpf || '').replace(/\D/g, '')
      const uRole = u.role || 'Morador'

      // Considera perfis de morador, síndico, ou qualquer usuário com condomínio vinculado
      const isPerfilResidencial = ['Morador', 'Proprietário', 'Inquilino', 'Dependente', 'Síndico', 'Subsíndico', 'Conselheiro', 'Portaria'].includes(uRole)
      const temCondominio = Boolean(u.condominio || u.condominioNome || u.condominioId)

      if (isPerfilResidencial || temCondominio) {
        // Validação anti-duplicação precisa por ID do documento, e-mail ou CPF (NUNCA por telefone compartilhado de recado/família)
        const jaCadastrado = (uId && idsDocExistentes.has(uId)) ||
                             (uEmail && emailsExistentes.has(uEmail)) ||
                             (uCpf && cpfsExistentes.has(uCpf))

        if (!jaCadastrado) {
          const rawApt = String(u.unidade || u.apt || '').trim()
          const aptLimpo = rawApt.replace(/^(apto\.?|apt\.?|unidade|bl\.?\s*\d+\s*apt\.?)\s*/i, '').trim()

          lista.push({
            id: `usr_${u.id}`,
            idOriginalUsuario: u.id,
            nome: u.nome || (uRole === 'Síndico' ? 'Síndico' : 'Morador'),
            email: u.email || '',
            tel: u.telefone || u.tel || u.whatsapp || u.celular || '',
            condominio: u.condominio || u.condominioNome || '',
            condominioId: u.condominioId || '',
            bloco: u.bloco || '',
            apt: aptLimpo || rawApt || (uRole === 'Síndico' ? 'ADM' : '1'),
            cpf: u.cpf || '',
            status: u.statusMorador || (uRole === 'Morador' ? 'Proprietário' : uRole),
            tipo: uRole,
            fotoRosto: u.foto || u.fotoRosto || '',
            origem: 'usuario-sincronizado'
          })
        }
      }
    })

    return lista
  }, [allMoradoresDocs, allUsuariosDocs])

  const [tab, setTab] = useState('boletos')
  const [condoFilter, setCondoFilter] = useState(() => {
    if (user?.role !== 'Administrador' && user?.condominio) return user.condominio
    return location.state?.condominio || 'Todos'
  })
  const [competenciaFilter, setCompetenciaFilter] = useState(() => {
    if (location.state?.competencia) return location.state.competencia
    const d = new Date()
    return d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '/')
  })

  // Sincronizar se navegar novamente para esta página com novo estado
  useEffect(() => {
    if (user?.role !== 'Administrador' && user?.condominio) {
      setCondoFilter(user.condominio)
    } else if (location.state?.condominio) {
      setCondoFilter(location.state.condominio)
    }
    if (location.state?.competencia) {
      setCompetenciaFilter(location.state.competencia)
    }
  }, [location.state, user])
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [viewing, setViewing] = useState(null)
  const [modal, setModal] = useState(null)
  const [modalLote, setModalLote] = useState(false)
  const [modalImportarPlanilha, setModalImportarPlanilha] = useState(false)
  const [modalImportarPDF, setModalImportarPDF] = useState(false)
  const [modalNotificarVencimento, setModalNotificarVencimento] = useState(false)
  const [condoFundoEdit, setCondoFundoEdit] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [downloadingLote, setDownloadingLote] = useState(false)
  const [showRepasses, setShowRepasses] = useState(false)
  const [progressoLote, setProgressoLote] = useState(null)

  const handleSaveLote = async (lista, dispararWhatsApp = false) => {
    if (!lista || lista.length === 0) return
    let criados = 0
    let enviadosWhats = 0
    let falhasWhats = 0

    try {
      // 1. Salva todos os boletos primeiro no Firestore (com validação anti-duplicidade)
      const boletosSalvos = []
      for (let i = 0; i < lista.length; i++) {
        try {
          const b = lista[i]
          
          // Verifica se já existe um boleto com mesmo condomínio, apartamento e competência
          const bApt = String(b.apt || b.unidade || '').trim().toLowerCase()
          const bComp = (b.competencia || '').trim().toLowerCase()
          const bCondo = (b.condominio || '').trim().toLowerCase()

          const jaExiste = (allBoletos || []).find(existente => {
            const eApt = String(existente.apt || existente.unidade || '').trim().toLowerCase()
            const eComp = (existente.competencia || '').trim().toLowerCase()
            const eCondo = (existente.condominio || '').trim().toLowerCase()
            return eApt === bApt && eComp === bComp && eCondo === bCondo
          })

          if (jaExiste) {
            // Se já existe, atualiza o boleto existente em vez de duplicar
            await updateItem(jaExiste.id, {
              ...jaExiste,
              valor: b.valor,
              valorOriginal: b.valorOriginal,
              vencimento: b.vencimento,
              chave_pix: b.chave_pix,
              linha: b.linha,
              pix_emv: b.pix_emv,
              contatosEnvio: b.contatosEnvio,
              discriminarTaxa: b.discriminarTaxa,
              taxaEmissao: b.taxaEmissao,
              nomeTaxa: b.nomeTaxa
            })
            boletosSalvos.push({ ...jaExiste, ...b })
            criados++
          } else {
            const docRef = await addItem(b)
            const novoBoleto = { ...b, id: docRef?.id || b.id }
            boletosSalvos.push(novoBoleto)
            criados++
          }
        } catch (errDb) {
          console.error('Erro ao gravar boleto no banco:', errDb)
        }
      }

      // 2. Se for disparar WhatsApp, processa os envios de forma controlada
      if (dispararWhatsApp && boletosSalvos.length > 0) {
        let totalEnvios = 0
        boletosSalvos.forEach(b => {
          const dests = b.contatosEnvio && b.contatosEnvio.length > 0 ? b.contatosEnvio : [{ nome: b.morador, tel: b.telefone }]
          totalEnvios += dests.length
        })

        if (totalEnvios > 0) {
          setProgressoLote({ total: totalEnvios, atual: 0, morador: 'Iniciando disparos no WhatsApp...' })
        }

        let contadorEnvio = 0
        for (const b of boletosSalvos) {
          const condoDoc = (allCondominios || []).find(c => c && c.nome === b.condominio)
          const destinatarios = (b.contatosEnvio && b.contatosEnvio.length > 0) 
            ? b.contatosEnvio 
            : [{ nome: b.morador, tel: b.telefone, vinculo: 'Titular' }]

          for (const dest of destinatarios) {
            contadorEnvio++
            setProgressoLote({ total: totalEnvios, atual: contadorEnvio, morador: `${dest.nome} (Apt ${b.apt})` })

            const moradorEnvioDoc = {
              nome: dest.nome,
              tel: dest.tel,
              apt: b.apt,
              condominio: b.condominio,
              cpf: b.cpf
            }

            try {
              const res = await enviarBoletoWhatsAppAuto(b, moradorEnvioDoc, condoDoc)
              if (res && res.success) {
                enviadosWhats++
              } else {
                falhasWhats++
              }
            } catch (errW) {
              console.error('Erro individual WhatsApp:', errW)
              falhasWhats++
            }
          }
        }
      }
    } catch(err) {
      console.error('Erro geral ao processar lote:', err)
      alert('Ocorreu um erro ao processar os boletos: ' + (err.message || 'Tente novamente.'))
    } finally {
      setProgressoLote(null)
      setModalLote(false)
    }
    
    if (dispararWhatsApp) {
      if (enviadosWhats > 0) {
        alert(`🎉 Geração & Disparo Concluídos!\n\n📄 ${criados} boletos gerados oficialmente no nome dos titulares.\n📲 ${enviadosWhats} envios de PDF entregues no WhatsApp (titulares e dependentes selecionados)!\n${falhasWhats > 0 ? `⚠️ ${falhasWhats} envios pendentes/sem número.` : ''}`)
      } else {
        alert(`📄 ${criados} boletos gerados com sucesso!\n⚠️ O envio automático via WhatsApp não foi concluído para ${falhasWhats} contatos (verifique se possuem DDD e número válido).`)
      }
    } else {
      alert(`🎉 Sucesso! ${criados} boletos PIX foram gerados com sucesso no nome dos titulares!`)
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

  // Função utilitária para normalizar strings de competência (ex: "out/2026", "out/ 2026", "out. 2026", "outubro/2026")
  const normalizeComp = (str) => {
    return String(str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[.\s-]+/g, '/')
      .replace(/\/+/g, '/')
      .trim()
  }

  // Lista única de competências presentes nos boletos para o filtro de mês
  const uniqueCompetencias = React.useMemo(() => {
    const mapComp = new Map()
    const mesAtual = new Date().toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '/')
    mapComp.set(normalizeComp(mesAtual), mesAtual)

    allBoletos.forEach(b => {
      const c = (b.competencia || '').trim()
      if (c) {
        const norm = normalizeComp(c)
        if (!mapComp.has(norm)) {
          mapComp.set(norm, c)
        }
      }
    })
    return Array.from(mapComp.values())
  }, [allBoletos])

  const boletosFiltradosPorCondo = allBoletos.filter(b => {
    // Ignorar boletos cancelados ou excluídos
    if (b.status === 'Cancelado' || b.status === 'Excluído' || b.status === 'Excluido' || b.excluido || b.deletado) {
      return false
    }

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

      if (!(matchEmail || matchApt || matchNome)) return false
    } else if (user?.role !== 'Administrador') {
       // Não administradores (Síndico, Subsíndico, Conselheiro, Porteiro etc.) só veem estritamente seu condomínio
       const moradorDoc = (moradores || []).find(m => m && m.nome && b?.morador && m.nome.trim().toLowerCase() === String(b.morador).trim().toLowerCase());
       const bCondo = (b.condominio || moradorDoc?.condominio || '').trim().toLowerCase();
       const uCondo = (user?.condominio || '').trim().toLowerCase();
       if (!uCondo || !bCondo) return false;
       if (bCondo !== uCondo && !bCondo.includes(uCondo) && !uCondo.includes(bCondo)) return false;
    } else if (condoFilter && condoFilter !== 'Todos') {
       const moradorDoc = (moradores || []).find(m => m && m.nome && b?.morador && m.nome.trim().toLowerCase() === String(b.morador).trim().toLowerCase());
       const bCondo = (b.condominio || moradorDoc?.condominio || '').trim().toLowerCase();
       const filtroNorm = String(condoFilter).trim().toLowerCase();
       if (bCondo !== filtroNorm && !bCondo.includes(filtroNorm) && !filtroNorm.includes(bCondo)) return false;
    }

    // Filtro por mês/competência: se um mês específico estiver selecionado, apenas os boletos daquele mês aparecem
    if (competenciaFilter && competenciaFilter !== 'Todas') {
      const bCompNorm = normalizeComp(b.competencia)
      const filtroCompNorm = normalizeComp(competenciaFilter)
      if (bCompNorm !== filtroCompNorm) {
        return false
      }
    }

    return true;
  })

  const pago     = boletosFiltradosPorCondo.filter(b=>b.status==='Pago').length
  const pendente = boletosFiltradosPorCondo.filter(b=>b.status==='Pendente').length
  const vencido  = boletosFiltradosPorCondo.filter(b=>b.status==='Vencido').length

  const boletos = (boletosFiltradosPorCondo || []).filter(b => {
    if (!b) return false
    if (statusFilter === 'Todos') return true
    if (statusFilter === 'Pago') return b.status === 'Pago'
    if (statusFilter === 'Pendente') return b.status === 'Pendente'
    if (statusFilter === 'Vencido') return b.status === 'Vencido'
    if (statusFilter === 'OFX') return b.status === 'Pago' && b.metodoBaixa === 'Extrato OFX'
    return true
  })

  const condominios = allCondominios.filter(c => {
    if (user?.role !== 'Administrador') {
      const uCondo = (user?.condominio || '').toLowerCase().trim()
      const cNome = (c.nome || '').toLowerCase().trim()
      return uCondo && (cNome === uCondo || cNome.includes(uCondo) || uCondo.includes(cNome))
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
      
      const moradorDoc = (moradores || []).find(m => m && m.nome && b?.morador && m.nome.trim().toLowerCase() === String(b.morador).trim().toLowerCase());
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
      const mor = (moradores || []).find(m => m && m.nome && b?.morador && m.nome.trim().toLowerCase() === String(b.morador).trim().toLowerCase())
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
        const mor = (moradores || []).find(m => m && m.nome && b?.morador && m.nome.trim().toLowerCase() === String(b.morador).trim().toLowerCase())
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
    const mor = (moradores || []).find(m => 
      (m.id && b.moradorId && m.id === b.moradorId) ||
      (m && m.nome && b?.morador && m.nome.trim().toLowerCase() === String(b.morador).trim().toLowerCase()) ||
      (m.apt && b.apt && String(m.apt).trim() === String(b.apt).trim() && (!b.condominio || m.condominio === b.condominio))
    )
    const condoDoc = allCondominios.find(c => c.nome === (b.condominio || mor?.condominio))
    const chavePix = condoDoc?.chave_pix || 'alpha.solucoes@condominios.com.br'
    const pix = b.pix_emv || generateStaticPix(chavePix, b.valor, condoDoc?.nome || "Alpha Solucoes", "BR")
    const valorFormatado = Number(b.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
    const dataVenc = b.vencimento ? (b.vencimento.includes('-') ? b.vencimento.split('-').reverse().join('/') : b.vencimento) : '—'

    let rawTel = b.tel || b.telefone || b.whatsapp || mor?.tel || mor?.telefone || mor?.whatsapp || mor?.celular || ''
    let cleanTel = String(rawTel).replace(/\D/g, '')

    if (!cleanTel || cleanTel.length < 8) {
      const promptTel = window.prompt(`Informe o WhatsApp com DDD para ${b.morador}:`, cleanTel)
      if (promptTel) cleanTel = String(promptTel).replace(/\D/g, '')
    }

    if (cleanTel && !cleanTel.startsWith('55') && cleanTel.length >= 10) {
      cleanTel = `55${cleanTel}`
    }

    const tipoDesc = b.tipoCobranca ? `${b.tipoCobranca} (${b.competencia || 'Mês Vigente'})` : (b.competencia || 'Taxa Condominial')
    const msg = `*Alpha Soluções Condominiais*\nOlá *${b.morador}* (Apt ${b.apt}), segue sua fatura referente a *${tipoDesc}*:\n\n💰 *Valor:* R$ ${valorFormatado}\n📅 *Vencimento:* ${dataVenc}\n\n💠 *PIX Copia e Cola:*\n\`\`\`${pix}\`\`\`\n\nAbra o aplicativo do seu banco, escolha *PIX Copia e Cola* e cole o código acima para efetuar o pagamento.`
    const waUrl = cleanTel ? `https://wa.me/${cleanTel}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(waUrl, '_blank')
  }

  const handleDispararNotificacoesVencimento = async (lista, textoTemplate, onProgresso) => {
    let enviados = 0
    let falhas = 0

    for (let i = 0; i < lista.length; i++) {
      const b = lista[i]
      if (onProgresso) {
        onProgresso({ total: lista.length, atual: i + 1, morador: `${b.morador} (Apt ${b.apt || '—'})` })
      }

      const moradorDoc = (moradores || []).find(m => 
        (m.id && b.moradorId && m.id === b.moradorId) ||
        (m.nome && b.morador && m.nome.trim().toLowerCase() === b.morador.trim().toLowerCase()) ||
        (m.apt && b.apt && String(m.apt).trim() === String(b.apt).trim() && (!b.condominio || m.condominio === b.condominio))
      ) || {
        nome: b.morador,
        tel: b.telefone || b.tel || '',
        apt: b.apt,
        condominio: b.condominio
      }

      const condoDoc = allCondominios.find(c => c.nome === (b.condominio || moradorDoc?.condominio))
      const valorFmt = Number(b.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
      const vencFmt = b.vencimento ? (b.vencimento.includes('-') ? b.vencimento.split('-').reverse().join('/') : b.vencimento) : '—'
      const tipoCobrancaStr = b.tipoCobranca ? `${b.tipoCobranca} (${b.competencia || 'Mês Vigente'})` : (b.descricao || 'Taxa Condominial')
      const chavePix = condoDoc?.chave_pix || 'alpha.solucoes@condominios.com.br'
      const pixStr = b.pix_emv || generateStaticPix(chavePix, b.valor, condoDoc?.nome || "Alpha Solucoes", "BR")

      // Substitui variáveis do template
      const msgPersonalizada = (textoTemplate || '')
        .replace(/{morador}/g, b.morador || 'Morador')
        .replace(/{apt}/g, b.apt || '—')
        .replace(/{condominio}/g, condoDoc?.nome || b.condominio || 'Condomínio')
        .replace(/{competencia}/g, b.competencia || 'Mês Vigente')
        .replace(/{vencimento}/g, vencFmt)
        .replace(/{valor}/g, valorFmt)
        .replace(/{tipoCobranca}/g, tipoCobrancaStr)
        .replace(/{pix}/g, pixStr)

      try {
        const res = await enviarBoletoWhatsAppAuto(b, moradorDoc, condoDoc, msgPersonalizada)
        if (res && res.success) {
          enviados++
          // Atualiza flags no boleto
          await updateItem(b.id, {
            ultimoAvisoWhatsEm: new Date().toISOString()
          })
        } else {
          console.warn(`Falha no envio para ${b.morador}:`, res?.error)
          falhas++
        }
      } catch (err) {
        console.error(`Erro ao disparar para ${b.morador}:`, err)
        falhas++
      }

      // Intervalo de segurança anti-bloqueio entre envios
      if (i < lista.length - 1) {
        await new Promise(r => setTimeout(r, 1200))
      }
    }

    if (enviados > 0) {
      alert(`🎉 Disparo de Vencimento Concluído!\n\n📲 ${enviados} moradores notificados no WhatsApp com a mensagem e o boleto em PDF anexado!\n${falhas > 0 ? `⚠️ ${falhas} envios não puderam ser entregues (morador sem número de WhatsApp cadastrado ou erro na rota).` : ''}`)
    } else {
      alert(`⚠️ Nenhum disparo pôde ser concluído.\n\nVerifique se os moradores selecionados possuem o número de WhatsApp/celular cadastrado no sistema.`)
    }
  }

  const [loadingBoletoId, setLoadingBoletoId] = useState(null)

  const marcarPago = async b => {
    try {
      setLoadingBoletoId(b.id)
      const novoStatus = b.status === 'Pago' ? 'Pendente' : 'Pago'
      await updateItem(b.id, { ...b, status: novoStatus })

      // Sincronização automática com financeiro_lancamentos (Zero digitação manual)
      if (novoStatus === 'Pago') {
        const jaExiste = (allLancamentos || []).find(l => l.boletoId === b.id || (l.fitid && l.fitid === b.id))
        if (!jaExiste) {
          await addFinanceiroLancamento({
            descricao: `Recebimento Cota: ${b.morador || 'Morador'} - Apt ${b.apt || ''}`,
            tipo: 'Receita',
            categoria: 'Taxa Condominial',
            valor: Number(b.valor || 0),
            data: new Date().toISOString().split('T')[0],
            status: 'Recebido',
            condominio: b.condominio || 'Alpha Condomínios',
            boletoId: b.id
          })
        } else {
          await updateFinanceiroLancamento(jaExiste.id, { ...jaExiste, status: 'Recebido' })
        }
      } else {
        const jaExiste = (allLancamentos || []).find(l => l.boletoId === b.id)
        if (jaExiste) {
          await updateFinanceiroLancamento(jaExiste.id, { ...jaExiste, status: 'Pendente' })
        }
      }
    } catch (err) {
      console.error('Erro ao alternar status do boleto:', err)
      alert('Erro ao alternar status: ' + (err.message || 'Tente novamente'))
    } finally {
      setLoadingBoletoId(null)
    }
  }
  const handleSaveBoleto = async form => {
    const val = Number(form.valor) || 0
    const mor = (moradores || []).find(m => m && m.nome && form?.morador && m.nome.trim().toLowerCase() === String(form.morador).trim().toLowerCase())
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
    const rotuloTipo = clean.tipoCobranca || 'Taxa Condominial'
    const rotuloVinculo = clean.tipoMorador ? ` (${clean.tipoMorador})` : ''
    alert(`🎉 Cobrança / Boleto Salvo com Sucesso!\n\n📋 Cobrança: ${rotuloTipo}\n👤 Pagador: ${clean.morador}${rotuloVinculo} (Apt ${clean.apt || '—'})\n🏢 Condomínio: ${clean.condominio}\n💰 Valor: R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)
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
      const mor = (moradores || []).find(m => m && m.nome && b?.morador && m.nome.trim().toLowerCase() === String(b.morador).trim().toLowerCase())
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

  const handleSaveImportarPlanilha = async (lista) => {
    if (!lista || lista.length === 0) return
    let adicionados = 0

    try {
      for (const item of lista) {
        const val = Number(item.valor) || 0
        const condoDoc = allCondominios.find(c => c.nome === item.condominio)
        const chavePix = condoDoc?.chave_pix || 'alpha.solucoes@condominios.com.br'

        const boletoSalvar = {
          morador: item.morador,
          apt: item.apt,
          bloco: item.bloco || '',
          condominio: item.condominio,
          cpf: item.cpf || '',
          tel: item.tel || '',
          vencimento: item.vencimento,
          valor: val,
          status: 'Pendente',
          competencia: item.competencia || new Date().toLocaleDateString('pt-BR', {month:'short', year:'numeric'}).replace('.','/'),
          emitido: true,
          url: item.url || '',
          pix_emv: item.pix_emv || generateStaticPix(chavePix, val, item.condominio, "BR"),
          linha: item.linha || gerarLinhaDigitavel(item.apt || '1', val, item.vencimento),
          tipoCobranca: 'Taxa Condominial',
          _origem: 'importacao_planilha'
        }

        await addItem(boletoSalvar)
        adicionados++
      }

      alert(`🎉 Sucesso! ${adicionados} boletos foram importados para o condomínio "${lista[0]?.condominio}" e já estão disponíveis no sistema prontos para conciliação!`)
    } catch(err) {
      console.error(err)
      alert('Erro ao salvar os boletos da planilha: ' + (err.message || 'Tente novamente.'))
    }
  }

  const handleSaveImportarPDF = async (lista) => {
    if (!lista || lista.length === 0) return
    let adicionados = 0
    try {
      for (const item of lista) {
        await addItem(item)
        adicionados++
      }
    } catch(err) {
      console.error('Erro ao registrar boletos importados em PDF:', err)
      throw err
    }
  }

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
            const checknum = getTag('CHECKNUM');
            const refnum = getTag('REFNUM');
            const fitid = getTag('FITID');
            const trnFull = (trn + ' ' + memo + ' ' + checknum + ' ' + refnum + ' ' + fitid).toLowerCase();

            // Apenas entradas de dinheiro / créditos recebidos
            if (valor > 0 || trnType.toUpperCase() === 'CREDIT' || trnType.toUpperCase() === 'DEP') {
              const absValor = Math.abs(valor);

              // 1º Nível: Cruzamento de alta fidelidade por Nosso Número
              let boletoMatch = pendentes.find(b => {
                if (!b.nossoNumero) return false;
                const nNum = String(b.nossoNumero).trim().toLowerCase();
                return nNum.length >= 6 && trnFull.includes(nNum);
              });

              // 2º Nível: Cruzamento por Valor + (Nome do Morador ou Apartamento ou Nosso Número)
              if (!boletoMatch) {
                boletoMatch = pendentes.find(b => {
                  const mesmoValor = Math.abs(Number(b.valor) - absValor) < 0.1;
                  if (!mesmoValor) return false;

                  const moradorNome = (b.morador || '').toLowerCase().trim();
                  const aptNumero = String(b.apt || '').trim();
                  const nNum = String(b.nossoNumero || '').trim().toLowerCase();

                  if (nNum && nNum.length >= 6 && memo.includes(nNum)) return true;
                  if (moradorNome && memo.includes(moradorNome)) return true;

                  // Primeiro e último nome
                  const partes = moradorNome.split(/\s+/).filter(p => p.length > 2);
                  if (partes.length >= 2 && memo.includes(partes[0]) && memo.includes(partes[partes.length - 1])) {
                    return true;
                  }

                  // Apartamento citado no memo do extrato
                  if (aptNumero && (
                    memo.includes(`apt ${aptNumero}`) ||
                    memo.includes(`apto ${aptNumero}`) ||
                    memo.includes(`ap ${aptNumero}`) ||
                    memo.includes(` ${aptNumero} `)
                  )) {
                    return true;
                  }

                  return pendentes.length === 1;
                });
              }

              // 3º Nível: Correspondência unívoca por valor
              if (!boletoMatch) {
                const candidatosValor = pendentes.filter(b => Math.abs(Number(b.valor) - absValor) < 0.05);
                if (candidatosValor.length === 1) {
                  boletoMatch = candidatosValor[0];
                }
              }

              if (boletoMatch) {
                await updateItem(boletoMatch.id, { ...boletoMatch, status: 'Pago' });
                const jaExiste = (allLancamentos || []).find(l => l.boletoId === boletoMatch.id || (l.fitid && l.fitid === boletoMatch.id))
                if (!jaExiste) {
                  await addFinanceiroLancamento({
                    descricao: `Recebimento Cota (OFX): ${boletoMatch.morador || 'Morador'} - Apt ${boletoMatch.apt || ''}`,
                    tipo: 'Receita',
                    categoria: 'Taxa Condominial',
                    valor: Number(boletoMatch.valor || 0),
                    data: new Date().toISOString().split('T')[0],
                    status: 'Recebido',
                    condominio: boletoMatch.condominio || 'Alpha Condomínios',
                    boletoId: boletoMatch.id
                  })
                } else {
                  await updateFinanceiroLancamento(jaExiste.id, { ...jaExiste, status: 'Recebido' })
                }
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
            const lineRaw = lines[i].toLowerCase();
            const cols = lines[i].split(/[;,]/).map(c => c.trim().replace(/^"|"$/g, ''));
            const nome = idxMorador !== -1 ? cols[idxMorador] : '';
            let valorBruto = cols[idxValor] || '0';
            let valorLido = parseFloat(valorBruto.replace(/\./g, '').replace(',', '.')) || 0;
            if (isNaN(valorLido)) valorLido = parseFloat(valorBruto.replace(',', '.')) || 0;

            if (valorLido <= 0) continue;

            // 1º Match por Nosso Número
            let boletoMatch = pendentes.find(b => {
              if (!b.nossoNumero) return false;
              const nNum = String(b.nossoNumero).trim().toLowerCase();
              return nNum.length >= 6 && lineRaw.includes(nNum);
            });

            // 2º Match por valor + nome
            if (!boletoMatch) {
              boletoMatch = pendentes.find(b => {
                const mesmoValor = Math.abs(Number(b.valor) - valorLido) < 0.1;
                const matchNome = nome ? (b.morador.toLowerCase().includes(nome.toLowerCase()) || nome.toLowerCase().includes(b.morador.toLowerCase())) : true;
                return mesmoValor && matchNome;
              });
            }

            if (boletoMatch) {
              await updateItem(boletoMatch.id, { ...boletoMatch, status: 'Pago' });
              const jaExiste = (allLancamentos || []).find(l => l.boletoId === boletoMatch.id || (l.fitid && l.fitid === boletoMatch.id))
              if (!jaExiste) {
                await addFinanceiroLancamento({
                  descricao: `Recebimento Cota (CSV): ${boletoMatch.morador || 'Morador'} - Apt ${boletoMatch.apt || ''}`,
                  tipo: 'Receita',
                  categoria: 'Taxa Condominial',
                  valor: Number(boletoMatch.valor || 0),
                  data: new Date().toISOString().split('T')[0],
                  status: 'Recebido',
                  condominio: boletoMatch.condominio || 'Alpha Condomínios',
                  boletoId: boletoMatch.id
                })
              } else {
                await updateFinanceiroLancamento(jaExiste.id, { ...jaExiste, status: 'Recebido' })
              }
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
                <button 
                  onClick={()=>setModalImportarPDF(true)} 
                  className="btn-secondary text-sm flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-900 font-bold shadow-sm"
                  title="Importar boletos emitidos em PDF e associar automaticamente aos moradores"
                >
                  <FileText size={14} className="text-indigo-600" />
                  <span>Importar Boletos em PDF</span>
                </button>
                <button 
                  onClick={()=>setModalImportarPlanilha(true)} 
                  className="btn-secondary text-sm flex items-center gap-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold"
                >
                  <Upload size={14} className="text-brand-600" />
                  <span>Importar Planilha (CSV)</span>
                </button>
                <button
                  onClick={() => setModalNotificarVencimento(true)}
                  className="btn-secondary text-sm flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 font-black shadow-sm"
                  title="Enviar cobrança ou aviso no WhatsApp com o boleto em PDF para moradores"
                >
                  <MessageSquare size={15} className="text-emerald-600" />
                  <span>Enviar Boletos no WhatsApp</span>
                </button>
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
          {(user?.role === 'Administrador' || user?.role === 'Financeiro') && (
            <button
              onClick={() => setShowRepasses(true)}
              className="px-3.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 rounded-lg text-xs font-black flex items-center gap-1.5 shadow-sm transition-all"
            >
              <DollarSign size={14} className="text-amber-800" />
              <span>💼 Fechamento & Repasses Alpha</span>
            </button>
          )}
          {(user?.role === 'Administrador' || user?.role === 'Financeiro') ? (
            uniqueCondos.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0 block">Condomínio:</label>
                <select className="input text-sm py-1.5 h-auto w-44" value={condoFilter} onChange={e=>setCondoFilter(e.target.value)}>
                  <option value="Todos">Todos os Condomínios</option>
                  {uniqueCondos.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )
          ) : user?.condominio ? (
            <div className="flex items-center gap-1.5 bg-brand-50 border border-brand-200 px-3 py-1.5 rounded-lg text-xs font-bold text-brand-900">
              <Building size={14} className="text-brand-600" />
              <span>Condomínio: {user.condominio}</span>
            </div>
          ) : null}
          {tab === 'boletos' && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0 block">Mês / Competência:</label>
              <select 
                className="input text-sm py-1.5 h-auto w-40 font-semibold" 
                value={competenciaFilter} 
                onChange={e => setCompetenciaFilter(e.target.value)}
              >
                <option value="Todas">📅 Todos os Meses</option>
                {uniqueCompetencias.map(comp => (
                  <option key={comp} value={comp}>
                    {comp}
                  </option>
                ))}
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
            <div className="card bg-amber-50 border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
              <div className="flex items-start gap-3">
                <Bell size={20} className="text-amber-600 mt-0.5 shrink-0"/>
                <div>
                  <p className="font-bold text-amber-900 text-sm">⚠️ Boletos vencendo em breve</p>
                  <div className="mt-1 flex flex-col gap-0.5">
                    {boletos.filter(b=>{ if(b.status==='Pago'||!b.vencimento)return false; const d=Math.round((new Date(b.vencimento+'T12:00:00')-new Date())/86400000); return d>=0&&d<=5 }).map(b=>{
                      const d=Math.round((new Date(b.vencimento+'T12:00:00')-new Date())/86400000)
                      return (
                        <p key={b.id} className="text-xs text-amber-800">
                          <b>{b.morador}</b> – Apt {b.apt} – R$ {fmt(b.valor)} – <span className={d===0?'text-rose-600 font-black':'font-bold'}>{d===0?'Vence HOJE':`Vence em ${d} dia(s)`}</span>
                        </p>
                      )
                    })}
                  </div>
                </div>
              </div>

              {(user?.role === 'Administrador' || user?.role === 'Financeiro' || user?.role === 'Síndico') && (
                <button
                  onClick={() => setModalNotificarVencimento(true)}
                  className="btn-primary bg-emerald-600 hover:bg-emerald-500 text-xs font-black px-4 py-2 flex items-center gap-1.5 shadow-md self-start sm:self-center shrink-0 cursor-pointer"
                >
                  <Send size={14} />
                  <span>Disparar Aviso no WhatsApp</span>
                </button>
              )}
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
                        onClick={() => {
                          const selecionadosPendentes = boletos.filter(b => selectedIds.includes(b.id) && b.status !== 'Pago')
                          if (selecionadosPendentes.length === 0) {
                            alert('Todos os boletos selecionados já constam como Pagos.')
                            return
                          }
                          setModalNotificarVencimento(true)
                        }}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                        title="Enviar cobrança ou aviso no WhatsApp dos moradores selecionados"
                      >
                        <MessageSquare size={14} /> Enviar Boleto no WhatsApp ({selectedIds.length})
                      </button>
                      <button
                        onClick={async () => {
                          if (window.confirm(`⚠️ Tem certeza que deseja EXCLUIR os ${selectedIds.length} boletos selecionados? Esta ação não pode ser desfeita.`)) {
                            const total = selectedIds.length
                            for (const id of selectedIds) {
                              try {
                                await deleteItem(id)
                                // Remove lançamentos vinculados em financeiro_lancamentos
                                const lances = (allLancamentos || []).filter(l => l.boletoId === id || l.boleto_id === id)
                                for (const lan of lances) {
                                  if (lan.id) await deleteFinanceiroLancamento(lan.id)
                                }
                              } catch(e) {
                                console.warn("Erro ao excluir boleto/lançamento:", e)
                              }
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
                    <th className="table-head">Competência</th>
                    <th className="table-head">Vencimento</th>
                    <th className="table-head">Valor</th>
                    <th className="table-head">Status</th>
                    <th className="table-head">Emitido</th>
                    <th className="table-head">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-200">
                  {boletos.length === 0 ? (
                    <tr><td colSpan={(user?.role === 'Administrador' || user?.role === 'Financeiro' || user?.role === 'Síndico') ? 10 : 9} className="text-center py-10 text-gray-400">Nenhum boleto encontrado.</td></tr>
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
                        <td className="table-cell font-medium text-gray-800">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-gray-900">{b.morador}</span>
                              {b.tipoMorador === 'Inquilino' && (
                                <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-black uppercase px-1.5 py-0.2 rounded-md">
                                  🔑 Inquilino
                                </span>
                              )}
                            </div>
                            {b.tipoCobranca && b.tipoCobranca !== 'Taxa Condominial' && (
                              <span className={`text-[10px] font-black uppercase px-1.5 py-0.2 rounded-md w-fit inline-flex items-center gap-1 ${
                                b.tipoCobranca.includes('Água') ? 'bg-cyan-100 text-cyan-900 border border-cyan-300' :
                                b.tipoCobranca.includes('Energia') ? 'bg-amber-100 text-amber-950 border border-amber-300' :
                                'bg-purple-100 text-purple-900 border border-purple-200'
                              }`}>
                                {b.tipoCobranca.includes('Água') ? '💧' : b.tipoCobranca.includes('Energia') ? '⚡' : '🏷️'} {b.tipoCobranca}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="table-cell text-gray-500 font-bold">{b.apt ? `Apt ${b.apt}` : '—'}</td>
                        <td className="table-cell">
                          <span className="bg-slate-100 text-slate-800 text-[11px] font-bold px-2 py-0.5 rounded-lg border border-slate-200 inline-block truncate max-w-[150px]">
                            {b.condominio || 'Alpha Condomínios'}
                          </span>
                        </td>
                        <td className="table-cell">
                          <span className="font-semibold text-xs text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md border border-brand-200">
                            {b.competencia || '—'}
                          </span>
                        </td>
                        <td className="table-cell text-gray-500">{b.vencimento}</td>
                        <td className="table-cell font-bold text-gray-800">R$ {fmt(b.valor)}</td>
                        <td className="table-cell">
                          <button
                            type="button"
                            onClick={() => marcarPago(b)}
                            disabled={loadingBoletoId === b.id}
                            title={b.status === 'Pago' ? '1-Clique: Marcar como Pendente' : '1-Clique: Marcar como Pago'}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase transition-all shadow-xs cursor-pointer select-none active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${
                              b.status === 'Pago'
                                ? 'bg-emerald-500 hover:bg-emerald-600 text-white border border-emerald-600 shadow-emerald-200'
                                : 'bg-amber-100 hover:bg-emerald-100 text-amber-800 hover:text-emerald-800 border border-amber-300 hover:border-emerald-300'
                            }`}
                          >
                            {loadingBoletoId === b.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : b.status === 'Pago' ? (
                              <CheckCircle2 size={12} className="stroke-[2.5]" />
                            ) : (
                              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                            )}
                            {b.status || 'Pendente'}
                          </button>
                        </td>
                        <td className="table-cell">{b.emitido?<span className="badge-green flex items-center gap-1 w-fit"><CheckCircle2 size={11}/>Sim</span>:<span className="badge-yellow">Não</span>}</td>
                        <td className="table-cell">
                          <div className="flex gap-1.5 flex-wrap items-center">
                            <button onClick={()=>setViewing(b)} className="btn-secondary py-1 px-2.5 text-xs text-brand-700 bg-brand-50 border-brand-200 hover:bg-brand-100 flex items-center gap-1 font-bold">
                              <QrCode size={12}/> Ver Boleto PIX
                            </button>

                            <button onClick={()=>setViewing(b)} className="btn-secondary py-1 px-2.5 text-xs text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100 flex items-center gap-1 font-bold">
                              <Download size={12}/> Baixar PDF
                            </button>

                            {b.url && (
                              <button 
                                onClick={() => {
                                  if (b.url.startsWith('data:')) {
                                    const link = document.createElement('a')
                                    link.href = b.url
                                    link.download = b.nomeArquivo || `Boleto-${b.morador || 'Morador'}.pdf`
                                    document.body.appendChild(link)
                                    link.click()
                                    document.body.removeChild(link)
                                  } else {
                                    window.open(b.url, '_blank')
                                  }
                                }} 
                                className="btn-secondary py-1 px-2.5 text-xs text-rose-700 bg-rose-50 border-rose-200 hover:bg-rose-100 flex items-center gap-1 font-bold shadow-xs"
                                title="Abrir ou baixar o PDF original emitido pelo banco"
                              >
                                <FileText size={12} className="text-rose-600" /> PDF Banco
                              </button>
                            )}

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
                                <button 
                                  onClick={()=>marcarPago(b)} 
                                  disabled={loadingBoletoId === b.id}
                                  title={b.status === 'Pago' ? 'Marcar como Pendente' : 'Marcar como Pago'} 
                                  className={`py-1 px-2.5 text-xs rounded-xl flex items-center gap-1 font-bold transition-all cursor-pointer border active:scale-95 disabled:opacity-50 ${
                                    b.status === 'Pago'
                                      ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border-emerald-300'
                                      : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-700 shadow-xs'
                                  }`}
                                >
                                  {loadingBoletoId === b.id ? (
                                    <Loader2 size={12} className="animate-spin" />
                                  ) : (
                                    <CheckCircle2 size={12}/>
                                  )}
                                  {b.status === 'Pago' ? 'Pago' : 'Marcar Pago'}
                                </button>
                                <button onClick={()=>setModal(b)} title="Editar Boleto" className="p-1.5 rounded-lg bg-slate-100 hover:bg-brand-100 text-slate-700 hover:text-brand-900 border border-slate-300 hover:border-brand-300 transition-all shadow-xs"><Edit2 size={13} className="stroke-[2.2]"/></button>
                                <button 
                                  onClick={async () => {
                                    if (window.confirm(`Deseja realmente excluir o boleto de ${b.morador} (Apt ${b.apt}) no valor de R$ ${fmt(b.valor)}?`)) {
                                      try {
                                        await deleteItem(b.id)
                                        const lances = (allLancamentos || []).filter(l => l.boletoId === b.id || l.boleto_id === b.id)
                                        for (const lan of lances) {
                                          if (lan.id) await deleteFinanceiroLancamento(lan.id)
                                        }
                                      } catch(e) {
                                        console.warn("Erro ao excluir boleto:", e)
                                      }
                                    }
                                  }} 
                                  title="Excluir Boleto" 
                                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-red-100 text-slate-700 hover:text-red-700 transition-all border border-slate-300 hover:border-red-300 shadow-xs"
                                >
                                  <Trash2 size={13} className="stroke-[2.2]"/>
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
      {modal&&<ModalBoleto data={modal==='new'?null:modal} onClose={()=>setModal(null)} onSave={handleSaveBoleto} moradores={moradores} condominios={condominios} initialCondo={user?.role !== 'Administrador' ? user?.condominio : (condoFilter !== 'Todos' ? condoFilter : '')}/>}
      {modalLote&&<ModalGerarLote condominios={condominios} moradores={moradores} allBoletos={allBoletos} initialCondo={user?.role !== 'Administrador' ? user?.condominio : (condoFilter !== 'Todos' ? condoFilter : '')} onClose={()=>setModalLote(false)} onSave={handleSaveLote}/>}
      {modalImportarPlanilha&&<ModalImportarPlanilha condominios={condominios} moradores={moradores} initialCondo={user?.role !== 'Administrador' ? user?.condominio : (condoFilter !== 'Todos' ? condoFilter : '')} onClose={()=>setModalImportarPlanilha(false)} onSave={handleSaveImportarPlanilha}/>}
      {modalImportarPDF && (
        <ModalImportarBoletosPDF
          condominios={condominios}
          moradores={moradores}
          initialCondo={user?.role !== 'Administrador' ? user?.condominio : (condoFilter !== 'Todos' ? condoFilter : '')}
          onClose={() => setModalImportarPDF(false)}
          onSave={handleSaveImportarPDF}
        />
      )}
      {modalNotificarVencimento && (
        <ModalNotificarVencimento
          boletosPendentes={(() => {
            // Se houver boletos selecionados pelo checkbox na tabela, prioriza os selecionados pendentes
            if (selectedIds.length > 0) {
              const selecionados = boletos.filter(b => selectedIds.includes(b.id) && b.status !== 'Pago')
              if (selecionados.length > 0) return selecionados
            }
            // Caso contrário, pega todos os boletos que ainda não foram pagos (filtrados pelo condomínio/mês atual)
            return boletosFiltradosPorCondo.filter(b => b.status !== 'Pago')
          })()}
          moradores={moradores}
          condominios={allCondominios}
          onClose={() => setModalNotificarVencimento(false)}
          onEnviarLote={handleDispararNotificacoesVencimento}
        />
      )}
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
