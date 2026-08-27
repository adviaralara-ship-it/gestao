import React, { useState, useRef } from 'react'
import { FileText, Printer, CheckCircle, Bot, Zap, Loader2, Sparkles, AlertCircle, FileEdit, Download } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Chave da API e Instância do Gemini
const API_KEY = "AQ.Ab8RN6KdJTQzq73dAmBYqMifqbyYBO58ewLnP57zgB49j1xPYA"
const genAI = new GoogleGenerativeAI(API_KEY)
const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" })

const modelos = [
  {
    id: 'ata-assembleia',
    nome: 'Ata de Assembleia Ordinária',
    campos: ['condominio', 'data', 'hora', 'sindico', 'presidente', 'secretario', 'assuntos'],
    template: (dados) => `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="text-align: center; text-transform: uppercase;">Ata de Assembleia Geral Ordinária</h2>
        <h3 style="text-align: center;">Condomínio ${dados.condominio || '[CONDOMÍNIO]'}</h3>
        <br/>
        <p>Aos <strong>${dados.data ? dados.data.split('-').reverse().join('/') : '[DATA]'}</strong>, às <strong>${dados.hora || '[HORA]'}</strong>, reuniram-se em Assembleia Geral Ordinária os condôminos do <strong>${dados.condominio || '[CONDOMÍNIO]'}</strong>, em primeira/segunda chamada.</p>
        <p>A reunião foi presidida por <strong>${dados.presidente || '[PRESIDENTE]'}</strong> e secretariada por <strong>${dados.secretario || '[SECRETÁRIO]'}</strong>.</p>
        <p>Estando presente o síndico <strong>${dados.sindico || '[SÍNDICO]'}</strong>, passou-se à ordem do dia para deliberar sobre os seguintes assuntos:</p>
        <div style="margin-left: 20px; font-style: italic;">
          ${dados.assuntos ? dados.assuntos.split('\n').map(l => `<p>- ${l}</p>`).join('') : '<p>- [ASSUNTO 1]</p><p>- [ASSUNTO 2]</p>'}
        </div>
        <p>Após amplos debates, as pautas foram aprovadas por maioria simples dos presentes.</p>
        <p>Nada mais havendo a tratar, o Presidente encerrou a sessão, da qual foi lavrada a presente ata, que lida e achada conforme, vai assinada pelo Presidente e Secretário.</p>
        <br/><br/><br/>
        <div style="display: flex; justify-content: space-around; text-align: center; margin-top: 50px;">
          <div>_________________________________<br/>${dados.presidente || '[PRESIDENTE]'}<br/>Presidente da Mesa</div>
          <div>_________________________________<br/>${dados.secretario || '[SECRETÁRIO]'}<br/>Secretário da Mesa</div>
        </div>
      </div>
    `
  },
  {
    id: 'advertencia',
    nome: 'Advertência por Infração',
    campos: ['condominio', 'morador', 'apt', 'data_infracao', 'motivo', 'sindico'],
    template: (dados) => `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="text-align: center; text-transform: uppercase;">Notificação de Advertência</h2>
        <h3 style="text-align: center;">Condomínio ${dados.condominio || '[CONDOMÍNIO]'}</h3>
        <br/><br/>
        <p><strong>Ao(À) Condômino(a):</strong> ${dados.morador || '[NOME DO MORADOR]'}</p>
        <p><strong>Unidade / Apartamento:</strong> ${dados.apt || '[UNIDADE]'}</p>
        <br/>
        <p>Prezado(a) Morador(a),</p>
        <p>Vimos por meio desta adverti-lo(a) formalmente quanto ao descumprimento das normas estabelecidas na Convenção Condominial e no Regimento Interno, ocorrido na data de <strong>${dados.data_infracao ? dados.data_infracao.split('-').reverse().join('/') : '[DATA DA INFRAÇÃO]'}</strong>, referente ao seguinte fato:</p>
        <br/>
        <div style="padding: 15px; border-left: 4px solid #c00; background: #fdf2f2; font-style: italic;">
          "${dados.motivo || '[DESCREVA A INFRAÇÃO AQUI]'}"
        </div>
        <br/>
        <p>Solicitamos a imediata cessação de tal conduta para mantermos a boa convivência e harmonia entre os moradores. Informamos que a reincidência poderá acarretar na aplicação das penalidades previstas, inclusive <strong>multa condominial</strong>.</p>
        <br/><br/>
        <p style="text-align: center;">Atenciosamente,</p>
        <div style="text-align: center; margin-top: 40px;">
          _________________________________<br/>
          <strong>${dados.sindico || 'Administração / Síndico'}</strong><br/>
          Condomínio ${dados.condominio || ''}
        </div>
      </div>
    `
  },
  {
    id: 'prestacao-servicos',
    nome: 'Contrato de Prestação de Serviços Simples',
    campos: ['condominio', 'cnpj_condominio', 'contratado', 'cnpj_cpf_contratado', 'servico', 'valor', 'prazo', 'data_assinatura'],
    template: (dados) => `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="text-align: center; text-transform: uppercase;">Contrato de Prestação de Serviços</h2>
        <br/>
        <p><strong>CONTRATANTE:</strong> Condomínio ${dados.condominio || '[CONDOMÍNIO]'}, inscrito no CNPJ sob o nº ${dados.cnpj_condominio || '[CNPJ]'}.</p>
        <p><strong>CONTRATADA:</strong> ${dados.contratado || '[NOME/RAZÃO SOCIAL]'}, inscrito(a) no CPF/CNPJ sob o nº ${dados.cnpj_cpf_contratado || '[CPF/CNPJ]'}.</p>
        <br/>
        <p>As partes acima qualificadas têm, entre si, justo e contratado o seguinte:</p>
        <p><strong>CLÁUSULA 1ª - DO OBJETO:</strong> A CONTRATADA obriga-se a prestar para o CONTRATANTE os serviços de: <em>${dados.servico || '[DESCRIÇÃO DOS SERVIÇOS]'}</em>.</p>
        <p><strong>CLÁUSULA 2ª - DO PRAZO:</strong> O prazo para a execução dos serviços será de <strong>${dados.prazo || '[DIAS]'} dias</strong> a contar da assinatura.</p>
        <p><strong>CLÁUSULA 3ª - DO PREÇO E PAGAMENTO:</strong> Pela execução dos serviços, o CONTRATANTE pagará à CONTRATADA a quantia de <strong>R$ ${dados.valor || '[VALOR]'}</strong>.</p>
        <p><strong>CLÁUSULA 4ª - DO FORO:</strong> Elegem o foro da Comarca deste condomínio para dirimir quaisquer dúvidas deste contrato.</p>
        <br/><br/>
        <p style="text-align: center;">E, por estarem justos e contratados, assinam o presente em duas vias.</p>
        <p style="text-align: center;">Data: ${dados.data_assinatura ? dados.data_assinatura.split('-').reverse().join('/') : '[DATA]'}</p>
        <br/><br/>
        <div style="display: flex; justify-content: space-around; text-align: center; margin-top: 40px;">
          <div>_________________________________<br/>CONTRATANTE</div>
          <div>_________________________________<br/>CONTRATADA</div>
        </div>
      </div>
    `
  },
  {
    id: 'locacao-espaco',
    nome: 'Termo de Locação de Espaço (Moradores)',
    campos: ['condominio', 'espaco', 'morador', 'apt', 'data_evento', 'horario_inicio', 'horario_fim', 'valor_taxa'],
    template: (dados) => `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="text-align: center; text-transform: uppercase;">Termo de Locação de Espaço Comum</h2>
        <br/><br/>
        <p>Pelo presente instrumento, o <strong>Condomínio ${dados.condominio || '[CONDOMÍNIO]'}</strong>, autoriza o(a) condômino(a) abaixo qualificado(a) a utilizar o espaço comum nas condições estipuladas a seguir e no Regimento Interno.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; border: 1px solid #ccc;"><strong>Morador Responsável:</strong></td><td style="padding: 8px; border: 1px solid #ccc;">${dados.morador || '[MORADOR]'}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ccc;"><strong>Unidade / Apt:</strong></td><td style="padding: 8px; border: 1px solid #ccc;">${dados.apt || '[UNIDADE]'}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ccc;"><strong>Espaço Locado:</strong></td><td style="padding: 8px; border: 1px solid #ccc;">${dados.espaco || '[ESPAÇO]'}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ccc;"><strong>Data do Evento:</strong></td><td style="padding: 8px; border: 1px solid #ccc;">${dados.data_evento ? dados.data_evento.split('-').reverse().join('/') : '[DATA]'}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ccc;"><strong>Horário:</strong></td><td style="padding: 8px; border: 1px solid #ccc;">Das ${dados.horario_inicio || '[INÍCIO]'} às ${dados.horario_fim || '[FIM]'}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ccc;"><strong>Taxa de Utilização:</strong></td><td style="padding: 8px; border: 1px solid #ccc;">R$ ${dados.valor_taxa || '[VALOR]'}</td></tr>
        </table>
        
        <p><strong>O LOCATÁRIO DECLARA:</strong></p>
        <p>1. Estar ciente das regras de utilização previstas na Convenção e no Regimento Interno, especialmente quanto ao limite de ruído e horário de término do evento.</p>
        <p>2. Assumir total responsabilidade civil e material por quaisquer danos causados às instalações, móveis ou equipamentos do espaço locado durante o período do evento, comprometendo-se a ressarcir o Condomínio.</p>
        <p>3. Que a limpeza do local será realizada conforme os padrões exigidos pelo Condomínio.</p>
        
        <br/><br/>
        <p style="text-align: center;">Local e Data: __________________, ${new Date().toLocaleDateString('pt-BR')}.</p>
        <br/><br/>
        <div style="text-align: center; margin-top: 40px;">
          _________________________________<br/>${dados.morador || 'Assinatura do Morador Responsável'}
        </div>
      </div>
    `
  }
]

export default function GeradorContratos() {
  const { user } = useAuth()
  
  const [tab, setTab] = useState('modelos') // 'modelos' ou 'ia'
  
  // Para Modelos Prontos
  const [modeloAtivo, setModeloAtivo] = useState(modelos[0])
  const [form, setForm] = useState({})
  
  // Para Gerador com IA
  const [iaPrompt, setIaPrompt] = useState('')
  const [iaLoading, setIaLoading] = useState(false)
  const [iaDocHtml, setIaDocHtml] = useState('')
  
  const printRef = useRef()

  const handlePrint = () => {
    const printContent = printRef.current.innerHTML
    const originalContent = document.body.innerHTML
    
    document.body.innerHTML = printContent
    window.print()
    document.body.innerHTML = originalContent
    window.location.reload()
  }

  const handleCampo = (campo, valor) => {
    setForm({...form, [campo]: valor})
  }

  const getLabel = (campo) => {
    const labels = {
      condominio: 'Nome do Condomínio',
      data: 'Data da Assembleia',
      hora: 'Horário',
      sindico: 'Nome do Síndico',
      presidente: 'Presidente da Mesa',
      secretario: 'Secretário da Mesa',
      assuntos: 'Assuntos (Um por linha)',
      morador: 'Nome do Morador Infrator',
      apt: 'Apt / Unidade',
      data_infracao: 'Data da Infração',
      motivo: 'Descrição da Infração',
      cnpj_condominio: 'CNPJ do Condomínio',
      contratado: 'Nome/Empresa Contratada',
      cnpj_cpf_contratado: 'CNPJ/CPF do Contratado',
      servico: 'Descrição do Serviço',
      valor: 'Valor (R$)',
      prazo: 'Prazo (Dias)',
      data_assinatura: 'Data da Assinatura',
      espaco: 'Espaço Locado (Salão, Churrasqueira)',
      data_evento: 'Data do Evento',
      horario_inicio: 'Horário de Início',
      horario_fim: 'Horário de Término',
      valor_taxa: 'Taxa de Locação (R$)'
    }
    return labels[campo] || campo
  }
  
  const gerarComIA = async () => {
    if (!iaPrompt.trim()) return
    setIaLoading(true)
    
    try {
      const systemPrompt = `
Você é o Alpha AI, o Assistente Jurídico especialista em Direito Condominial Brasileiro.
Seu objetivo é redigir contratos, termos, atas e comunicados formais em Português do Brasil com máxima clareza e formalidade.
O usuário pedirá um tipo de documento. Você deve escrever o documento INTEIRO, pronto para ser impresso e assinado.
REGRAS DE FORMATAÇÃO:
1. A sua resposta DEVE ser EXCLUSIVAMENTE em formato HTML válido.
2. Não use marcadores Markdown (\`\`\`html) no início ou fim.
3. Use tags inline style como <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;"> no container principal.
4. Use <h2>, <h3>, <p>, <strong>, e <br/> para formatar o texto, deixando espaço para assinaturas no final usando <div> e _________________.
5. Nunca adicione comentários fora do HTML, sua resposta inteira será injetada em um documento para impressão.
`
      const chat = model.startChat({
        history: [
          { role: 'user', parts: [{ text: systemPrompt }] },
          { role: 'model', parts: [{ text: "<div style='font-family: Arial;'>Entendido. Enviarei apenas código HTML pronto para impressão.</div>" }] }
        ],
      })

      const result = await chat.sendMessage(iaPrompt)
      let aiResponse = result.response.text()
      
      // Limpeza caso a IA coloque aspas de markdown
      aiResponse = aiResponse.replace(/^\`\`\`html/gm, '').replace(/^\`\`\`/gm, '').trim()
      
      setIaDocHtml(aiResponse)
    } catch (e) {
      console.error(e)
      alert("Erro ao gerar documento com IA. Tente novamente.")
    } finally {
      setIaLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in w-full h-full print:bg-white print:p-0">
      <div className="page-header print:hidden">
        <div>
          <h2 className="section-title text-xl flex items-center gap-2"><FileText className="text-brand-600"/> Gerador de Contratos & Documentos</h2>
          <p className="section-sub">Crie atas, advertências e contratos preenchidos automaticamente ou gere textos do zero usando a IA.</p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-cream-300 pb-2 print:hidden">
        <button onClick={() => setTab('modelos')} className={`px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${tab==='modelos'?'bg-brand-600 text-white shadow-md':'bg-white text-gray-500 hover:text-brand-700 border border-cream-400'}`}>
          <FileText size={16}/> Modelos Prontos
        </button>
        <button onClick={() => setTab('ia')} className={`px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${tab==='ia'?'bg-brand-900 text-brand-200 shadow-md border-brand-800':'bg-white text-gray-500 hover:text-brand-900 border border-cream-400'}`}>
          <Bot size={16}/> Caneta Alpha AI
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 min-h-[600px] print:h-auto">
        {/* Lado Esquerdo - Formulário */}
        <div className="w-full lg:w-1/3 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2 pb-4 print:hidden">
          
          {tab === 'modelos' ? (
            <>
              <div className="bg-white p-5 rounded-xl border border-cream-300 shadow-sm shrink-0">
                <label className="label text-sm text-brand-600 font-bold mb-2">1. Escolha o Modelo</label>
                <select 
                  className="input w-full"
                  value={modeloAtivo.id}
                  onChange={e => {
                    const m = modelos.find(x => x.id === e.target.value)
                    setModeloAtivo(m)
                    setForm({})
                  }}
                >
                  {modelos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              </div>

              <div className="bg-white p-5 rounded-xl border border-cream-300 shadow-sm space-y-4 shrink-0">
                <label className="label text-sm text-brand-600 font-bold mb-2 flex justify-between items-center">
                  <span>2. Preencha os Dados</span>
                  <span className="text-[10px] text-gray-400 font-normal">Preview automático ao lado 👉</span>
                </label>
                {modeloAtivo.campos.map(campo => (
                  <div key={campo}>
                    <label className="label capitalize">{getLabel(campo)}</label>
                    {campo === 'assuntos' || campo === 'motivo' ? (
                      <textarea 
                        className="input resize-none h-24"
                        value={form[campo] || ''}
                        onChange={e => handleCampo(campo, e.target.value)}
                      />
                    ) : (
                      <input 
                        type={campo.includes('data') ? 'date' : campo === 'hora' ? 'time' : campo === 'valor' ? 'number' : 'text'}
                        step={campo === 'valor' ? '0.01' : undefined}
                        className="input"
                        value={form[campo] || ''}
                        onChange={e => handleCampo(campo, e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="bg-brand-900 p-5 rounded-xl border border-brand-800 shadow-lg shrink-0 text-white flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                  <Bot size={20} className="text-brand-300"/>
                </div>
                <div>
                  <h3 className="font-bold">Assistente Jurídico AI</h3>
                  <p className="text-[10px] text-brand-300">Geração de documentos do zero</p>
                </div>
              </div>
              
              <div className="bg-brand-800/50 p-3 rounded-lg border border-white/10 text-xs text-brand-100 flex items-start gap-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5 text-brand-300"/>
                <p>Peça para a IA redigir atas, termos ou avisos específicos. Ex: "Gere uma ata de reunião de condomínio para aprovação de contas".</p>
              </div>

              <div className="flex flex-col">
                <label className="label text-brand-300 text-xs uppercase tracking-wider mb-2 font-bold">Descreva o documento que você precisa:</label>
                <textarea 
                  rows={5}
                  className="w-full bg-brand-950 border border-brand-800 rounded-xl p-4 text-sm text-white placeholder:text-gray-500 focus:ring-2 focus:ring-brand-500 outline-none resize-none"
                  placeholder='Ex: "Gere uma ata completa de assembleia para o Condomínio Residencial Flores, realizada hoje às 19h30, com pauta sobre eleição de síndico e prestação de contas."'
                  value={iaPrompt}
                  onChange={e => setIaPrompt(e.target.value)}
                />
              </div>

              {/* Botão de Gerar com IA - Bem destacado e visível */}
              <button 
                onClick={gerarComIA} 
                disabled={!iaPrompt.trim() || iaLoading}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-black w-full flex justify-center items-center gap-2 py-3.5 rounded-xl shadow-lg shadow-emerald-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm uppercase tracking-wide cursor-pointer"
              >
                {iaLoading ? (
                  <><Loader2 size={18} className="animate-spin" /> Redigindo Documento...</>
                ) : (
                  <><Sparkles size={18} /> ✨ Gerar Documento com IA</>
                )}
              </button>
            </div>
          )}

          {/* Botão de Salvar PDF / Imprimir */}
          <div className="bg-white p-3 rounded-xl border border-cream-300 shadow-sm mt-2">
            <button onClick={handlePrint} className="btn-primary w-full flex justify-center items-center gap-2 py-3.5 text-base shadow-lg shadow-brand-500/20 hover:scale-[1.01] transition-transform">
              <Printer size={20} /> Salvar PDF / Imprimir
            </button>
          </div>
        </div>

        {/* Lado Direito - Preview */}
        <div className="w-full lg:w-2/3 h-full pb-8 print:w-full print:p-0">
          <div className="bg-gray-200 p-4 md:p-8 rounded-xl border border-cream-300 shadow-inner min-h-[600px] overflow-y-auto flex justify-center custom-scrollbar print:bg-white print:border-none print:shadow-none print:h-auto print:overflow-visible print:p-0 relative group">
            
            <div className="absolute top-4 right-4 bg-yellow-100 text-yellow-800 text-xs px-3 py-2 rounded-full font-medium shadow border border-yellow-300 print:hidden flex items-center gap-2 pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity z-10">
              <FileEdit className="w-4 h-4" />
              Clique na folha para editar o texto livremente
            </div>

            {/* Folha A4 Fake para Preview */}
            <div 
              ref={printRef}
              contentEditable={true}
              suppressContentEditableWarning={true}
              className="bg-white shadow-2xl p-10 md:p-16 print:shadow-none print:p-0 transition-all outline-none rounded-sm"
              style={{ width: '210mm', minHeight: '297mm', boxSizing: 'border-box' }}
              dangerouslySetInnerHTML={{ __html: tab === 'modelos' ? modeloAtivo.template(form) : (iaDocHtml || `<div style="font-family: Arial; color: #999; text-align: center; margin-top: 80px;"><p style="font-size: 16px;">O documento gerado pela IA aparecerá aqui.</p><p style="font-size: 12px; margin-top: 8px;">Digite o que você precisa no campo ao lado e clique em <strong>✨ Gerar Documento com IA</strong>.</p></div>`) }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
