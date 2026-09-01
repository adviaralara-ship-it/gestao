import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

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

/**
 * Gera o arquivo Blob do PDF de um boleto pronto para upload e envio via WhatsApp
 */
export async function gerarBoletoPdfBlob(b, condoDoc) {
  const chavePix = b.chave_pix || condoDoc?.chave_pix || 'alpha.solucoes@condominios.com.br'
  const pixPayload = b.pix_emv || generateStaticPix(chavePix, Number(b.valor || 0), condoDoc?.nome || b.condominio || "Alpha Solucoes", "BR")
  const linha = b.linha || gerarLinhaDigitavel(b.apt || '101', b.valor, b.vencimento)
  const valorFmt = Number(b.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
  const vencFmt = b.vencimento ? (b.vencimento.includes('-') ? b.vencimento.split('-').reverse().join('/') : b.vencimento) : '—'
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(pixPayload)}`
  const condoNomeStr = condoDoc?.nome || b.condominio || 'Condomínio Residencial'
  const enderecoStr = condoDoc?.endereco || 'Endereço Cadastrado'

  const deveDiscriminar = b.discriminarTaxa !== undefined ? b.discriminarTaxa : (condoDoc?.discriminarTaxa || false)
  const taxaEmissao = deveDiscriminar ? Number(b.taxaEmissao || condoDoc?.taxaEmissao || 0) : 0
  const valCheio = Number(b.valorOriginal || b.valor || 0)
  const cotaBase = Math.max(0, valCheio - taxaEmissao)
  const rawTaxa = b.nomeTaxa || condoDoc?.nomeTaxa || 'Serviço de Cobrança Digital'
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
          <p style="margin: 4px 0 0; color: #047857; font-weight: bold; font-family: monospace; font-size: 10px;">Chave PIX: ${chavePix}</p>
        </div>
        <div>
          <span style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase;">Pagador / Morador</span>
          <p style="margin: 4px 0 0; font-weight: 900; font-size: 13px; color: #0f172a;">${b.morador || 'Morador'}</p>
          <p style="margin: 2px 0 0; color: #334155; font-weight: bold; font-size: 11px;">Unidade: ${b.apt ? 'Apt ' + b.apt : '—'}</p>
          <p style="margin: 4px 0 0; color: #64748b; font-family: monospace; font-size: 10px;">Competência: ${b.competencia || 'Mês Vigente'}</p>
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
        <div style="background: #f1f5f9; padding: 6px 12px; font-weight: bold; font-size: 11px; color: #475569; text-transform: uppercase;">Demonstrativo de Composição da Cobrança</div>
        <div style="padding: 8px 12px; font-size: 12px;">
          ${taxaEmissao > 0 ? `
            <div style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px dashed #e2e8f0;">
              <span>Taxa Condominial Ordinária (${b.competencia || 'Mês Atual'})</span>
              <span style="font-family: monospace; font-weight: bold;">R$ ${cotaBase.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px dashed #e2e8f0; color: #0f172a; background: #f8fafc;">
              <span>${nomeTaxa}</span>
              <span style="font-family: monospace; font-weight: bold;">R$ ${taxaEmissao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
          ` : `
            <div style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px dashed #e2e8f0;">
              <span>Taxa Ordinária de Condomínio (${b.competencia || 'Mês Atual'})</span>
              <span style="font-family: monospace; font-weight: bold;">R$ ${valCheio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
          `}
          <div style="display: flex; justify-content: space-between; padding: 6px 0 2px; font-weight: 900; font-size: 13px; color: #0f172a;">
            <span>VALOR TOTAL COBRADO</span>
            <span style="font-family: monospace; color: #047857;">R$ ${valorFmt}</span>
          </div>
        </div>
      </div>

      <!-- Área Central PIX -->
      <div style="display: flex; gap: 14px; background: #f8fafc; padding: 12px; border-radius: 12px; border: 1px solid #cbd5e1; margin-bottom: 14px; align-items: center;">
        <div style="background: #ffffff; padding: 6px; border-radius: 8px; border: 1px solid #cbd5e1; text-align: center; flex-shrink: 0;">
          <img src="${qrUrl}" width="115" height="115" style="display: block;" />
          <span style="font-size: 8px; font-weight: 900; color: #047857; display: block; margin-top: 3px;">QR CODE PIX</span>
        </div>
        <div style="flex: 1; font-size: 11px;">
          <h4 style="margin: 0 0 4px; font-size: 13px; font-weight: 900; color: #0f172a;">Pague via PIX Instantâneo</h4>
          <p style="margin: 0 0 6px; color: #475569; line-height: 1.3;">Aponte a câmera do aplicativo do seu banco para o <b>QR Code</b> ao lado ou utilize o código PIX Copia e Cola abaixo.</p>
          <div style="background: #ffffff; padding: 6px 8px; border-radius: 6px; font-family: monospace; font-size: 8.5px; word-break: break-all; color: #334155; border: 1px solid #cbd5e1;">
            ${pixPayload}
          </div>
        </div>
      </div>

      <!-- Rodapé / Linha Digitável -->
      <div style="border-top: 2px solid #0f172a; padding-top: 8px; font-size: 11px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span style="font-size: 10px; color: #64748b; font-weight: bold;">Linha Digitável / Ficha de Compensação:</span>
          <span style="font-family: monospace; font-weight: bold; font-size: 11px;">${linha}</span>
        </div>
        <div style="display: flex; justify-content: space-between; color: #64748b; font-size: 9px; margin-top: 4px;">
          <span>Autenticação Mecânica • Baixa Automática Instantânea</span>
          <span>Alpha Soluções Condominiais</span>
        </div>
      </div>

    </div>
  `

  await new Promise(r => setTimeout(r, 200))
  const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
  const imgData = canvas.toDataURL('image/png')
  document.body.removeChild(container)

  const pdf = new jsPDF('p', 'mm', 'a4')
  const pdfWidth = pdf.internal.pageSize.getWidth()
  const imgHeight = (canvas.height * pdfWidth) / canvas.width
  pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, Math.min(imgHeight, 295))
  
  return pdf.output('blob')
}
