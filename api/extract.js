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
      prompt = `Você é um engenheiro e especialista em compras/orçamentos para condomínios.
Analise com atenção a proposta comercial, orçamento ou cotação em anexo.
Extraia todas as informações do orçamento e retorne um único objeto JSON estruturado (sem markdown, apenas JSON puro):

{
  "empresa": "Nome da Empresa ou Prestador / Razão Social ou Nome Fantasia",
  "numero": "Número ou Código do Orçamento se houver (ex: Orçamento nº 260910-002/01)",
  "grupo": "Área ou Objeto do orçamento para agrupar comparativos (ex: PORTA DE ENTRADA, COBERTURA / TELHADO, PINTURA, INTERFONIA, BOMBAS, etc.)",
  "tipoServico": "Resumo objetivo do serviço ou escopo (ex: Fornecimento e instalação de porta de giro, 1 folha, com fechadura)",
  "materiais": "Especificações detalhadas dos materiais, modelos, marcas, medidas (ex: Porta 1,00 x 2,25 m; linha Santa Marina Temperado; vidro incolor 8mm; perfil alumínio RAL 9003)",
  "valor": 0.00,
  "condicaoPagamento": "Condições de pagamento (ex: À vista com 5% desc; 50% entrada + 50% entrega; 12x no cartão com juros)",
  "prazo": "Prazo de execução ou entrega (ex: 15 dias úteis)",
  "garantia": "Tempo de garantia informado (ex: 1 ano para esquadria, 6 meses para fechadura)",
  "observacoes": "Observações relevantes, o que está incluso e o que NÃO está incluso, taxas extras, etc.",
  "telefone": "Telefone ou WhatsApp do prestador/vendedor se houver",
  "email": "E-mail do prestador se houver",
  "analiseIA": "Breve parecer técnico sintético (1 ou 2 frases) avaliando custo-benefício, completude dos materiais e segurança técnica"
}

Observação sobre "valor": retorne um número float com ponto (ex: 2100.00), convertendo vírgulas brasileiras para ponto.
Se algum campo não for identificado no arquivo, use vazio ("").`;
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
