import { GoogleGenerativeAI } from '@google/generative-ai';
import { applyCors, verifyUserAuth } from './_middleware/auth.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Autenticação obrigatória
  const user = await verifyUserAuth(req, res);
  if (!user) return;

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Chave da API Gemini não configurada no servidor.' });
  }

  try {
    const { file, mimeType, type } = req.body;
    
    if (!file || !mimeType) {
      return res.status(400).json({ error: 'File e mimeType são obrigatórios.' });
    }

    if (!ALLOWED_MIMES.includes(mimeType)) {
      return res.status(400).json({ error: 'Tipo de arquivo não permitido para extração.' });
    }

    // Remover o prefixo do base64 se existir (ex: data:image/jpeg;base64,...)
    const base64Data = file.split(',')[1] || file;

    let prompt = "";
    if (type === 'rateio_agua') {
      prompt = `Você é um assistente especialista em leitura de contas de água (concessionárias de saneamento) e planilhas/folhas de medição de hidrômetros de condomínio.
Analise a imagem enviada.
Extraia as informações estruturadas estritamente em formato JSON, sem markdown ou explicações.

Se a imagem for uma CONTA DE ÁGUA DA CONCESSIONÁRIA:
Retorne:
{
  "tipoDocumento": "conta_concessionaria",
  "concessionaria": "Nome da concessionária (ex: Cagepa, Sabesp, Copasa, etc.)",
  "mesReferencia": "Mês de referência (ex: 2026-09 ou Setembro/2026)",
  "vencimento": "YYYY-MM-DD",
  "valorTotal": 0.00,
  "consumoTotalM3": 0,
  "leituras": []
}

Se a imagem for uma PLANILHA / TABELA DE MEDIÇÃO DE HIDRÔMETROS POR APARTAMENTO:
Retorne:
{
  "tipoDocumento": "tabela_medicao",
  "mesReferencia": "Mês/Ano se identificado",
  "valorTotal": 0.00,
  "leituras": [
    {
      "apt": "101",
      "leituraAnterior": 451.18,
      "leituraAtual": 464.51,
      "consumoM3": 13,
      "excessoM3": 3,
      "observacao": "Alugado ou vazio se não houver"
    }
  ]
}

Se encontrar números com vírgula (ex: 451,18), converta para formato numérico com ponto (451.18).
Retorne APENAS o JSON puro.`;
    } else if (type === 'notafiscal' || type === 'comprovante') {
      prompt = `Extraia as informações deste documento fiscal ou financeiro (Nota Fiscal, Cupom Fiscal / NFC-e / SAT, Recibo ou Comprovante de Pagamento / Transferência / PIX). 
Se houver mais de um no arquivo, retorne um ARRAY de objetos JSON. Se houver apenas um, retorne um ARRAY com um objeto.
Identifique o campo "tipo" com uma das opções exatas: "Nota Fiscal", "Cupom Fiscal", "Recibo", "Comprovante de Pagamento".
Use APENAS o seguinte formato JSON puro, sem markdown:
      [{
        "tipo": "Nota Fiscal ou Cupom Fiscal ou Recibo ou Comprovante de Pagamento",
        "numero": "número da nota, do cupom (COO/CCF), recibo ou id da transação/autenticação PIX",
        "prestador": "nome do estabelecimento, prestador de serviço, fornecedor ou favorecido",
        "cnpj": "CNPJ ou CPF do emissor/favorecido (formatado ou vazio se não houver)",
        "servico": "descrição do serviço, produto adquirido ou motivo do pagamento",
        "valor": "valor total formatado (ex: R$ 1.500,00)",
        "data": "data de emissão ou pagamento no formato YYYY-MM-DD"
      }]`;
    } else if (type === 'orcamento') {
      prompt = `Você é um engenheiro e especialista em compras/orçamentos para condomínios e manutenção predial.
Analise com atenção a proposta comercial, orçamento ou cotação em anexo (seja PDF de 1 ou várias páginas, imagem ou escaneamento).
Extraia todas as informações do orçamento e retorne um único objeto JSON estruturado (sem markdown, estritamente JSON puro):

{
  "empresa": "Nome da Empresa ou Prestador / Razão Social ou Nome Fantasia (ex: Elite Premium Esquadrias LTDA, Med Vidros, etc.)",
  "numero": "Número, Código ou Proposta se houver (ex: 049, Orçamento nº 260910-002/01, etc.)",
  "grupo": "Área ou Objeto do orçamento para agrupar comparativos (ex: PORTA DE ENTRADA, ESQUADRIAS, COBERTURA / TELHADO, PINTURA, INTERFONIA, BOMBAS, etc.)",
  "tipoServico": "Resumo objetivo do serviço ou escopo (ex: Esquadrias de Alumínio com Aplicação de Vidros / Porta de Giro F45º ou Instalação de Porta de Vidro Temperado 8mm com Mola)",
  "materiais": "Especificações detalhadas dos materiais, modelos, marcas, acabamentos e medidas (ex: Porta de Giro F45º Suprema 1.000 x 2.250 m, Alumínio Bronze, Vidro Temperado Bronze/Incolor 6mm ou Vidro Incolor 8mm Temperado, Ferragens, Fechadura, Mola de Piso GDS/Dorma)",
  "valor": 0.00,
  "condicaoPagamento": "Condições de pagamento (ex: 50% de entrada e 50% na entrega; Pix; Cartão em 10x; À vista com 5% desc)",
  "prazo": "Prazo de execução ou entrega (ex: 30 dias; 10 dias úteis)",
  "garantia": "Tempo de garantia informado ou validade da proposta (ex: 1 ano de garantia / Validade 10 dias)",
  "observacoes": "Observações relevantes, itens inclusos e não inclusos, modelo de mola selecionado, etc.",
  "telefone": "Telefone ou WhatsApp do prestador/vendedor (ex: (83) 98174-2932)",
  "email": "E-mail do prestador se houver (ex: elitepremiumesquadrias@hotmail.com)",
  "analiseIA": "Breve parecer técnico sintético (1 ou 2 frases) avaliando custo-benefício, completude dos materiais, acabamento e especificações técnicas"
}

Instruções cruciais sobre os dados:
1. "valor": retorne um número float com ponto (ex: 4207.50 ou 1700.00). 
   - Se o documento tiver um "TOTAL" geral explícito (como TOTAL: 4.207,50), use este valor total consolidado.
   - Se o documento apresentar itens com opções adicionais (ex: Porta 1.700,00 e opções de molas), priorize o valor principal do serviço ou o total base. Converta vírgulas brasileiras para ponto.
2. "empresa": procure pelo cabeçalho, logotipo ou rodapé com nome da empresa, razão social ou nome fantasia.
3. "materiais": detalhe os itens da obra com medidas (largura x altura), linha (ex: Suprema), cor/tratamento (ex: Bronze, Incolor), espessura do vidro e acessórios (fechadura, mola).
4. Retorne APENAS o JSON puro. Não adicione crases de markdown (\`\`\`json) e nem texto antes ou depois.`;
    } else {
      prompt = `Extraia as seguintes informações deste documento (boleto, apólice, conta, carnê). Se o arquivo for um carnê ou apólice com MÚLTIPLAS parcelas/boletos, extraia os dados de CADA UM separadamente e retorne um ARRAY de objetos JSON. Se houver apenas um pagamento, retorne um ARRAY com um único objeto. Use APENAS o formato abaixo, sem markdown:
      [{
        "descricao": "nome da empresa ou despesa (ex: Allianz Seguro SA - Parcela X/Y)",
        "fornecedor": "nome do beneficiário ou fornecedor",
        "categoria": "categoria sugerida (ex: Seguro Predial, Água & Esgoto, Energia Elétrica, Manutenção, Limpeza, etc.)",
        "valor": "valor total numérico com ponto (ex: 202.08)",
        "vencimento": "data de vencimento no formato YYYY-MM-DD",
        "linhaDigitavel": "código de barras numérico ou linha digitável completa (se houver, senao vazio)",
        "pix": "chave PIX ou código PIX (se houver, senao vazio)"
      }]`;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      }
    ]);

    const response = await result.response;
    let text = response.text();
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const data = JSON.parse(text);

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error in OCR extraction:', error);
    return res.status(500).json({ error: 'Falha na extração de dados', details: error.message });
  }
}
