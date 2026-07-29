import { GoogleGenerativeAI } from '@google/generative-ai';

// A chave foi fornecida pelo usuário no chat
const API_KEY = 'AQ.Ab8RN6KqertMDuONt55SmWpseAN6pPPfTQUI_zPLwqYbhKHpXg';
const genAI = new GoogleGenerativeAI(API_KEY);

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Permitir imagens maiores
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { file, mimeType, type } = req.body; // file is base64
    
    if (!file || !mimeType) {
      return res.status(400).json({ error: 'File and mimeType are required' });
    }

    // Remover o prefixo do base64 se existir (ex: data:image/jpeg;base64,...)
    const base64Data = file.split(',')[1] || file;

    // Dependendo do tipo (notafiscal ou despesa), o prompt muda levemente
    let prompt = "";
    if (type === 'notafiscal') {
      prompt = `Extraia as seguintes informações desta nota fiscal ou recibo e retorne APENAS um JSON válido, sem formatação markdown extra:
      {
        "numero": "número da nota ou recibo (se houver, senao vazio)",
        "prestador": "nome do fornecedor ou prestador de serviço",
        "cnpj": "CNPJ do prestador (formatado xx.xxx.xxx/xxxx-xx, ou vazio se não tiver)",
        "servico": "descrição curta do serviço ou produto",
        "valor": "valor total formatado (ex: R$ 1.500,00)",
        "data": "data de emissão no formato YYYY-MM-DD"
      }`;
    } else {
      prompt = `Extraia as seguintes informações desta conta, boleto, recibo ou despesa e retorne APENAS um JSON válido, sem formatação markdown extra:
      {
        "descricao": "descrição curta da despesa/conta/receita",
        "fornecedor": "nome do fornecedor ou pagador",
        "valor": "valor total (apenas número, ex: 150.50)",
        "vencimento": "data de vencimento ou emissão no formato YYYY-MM-DD"
      }`;
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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
    
    // Limpar o texto para garantir que seja JSON (remover blocos de código markdown)
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const data = JSON.parse(text);

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error in OCR extraction:', error);
    return res.status(500).json({ error: 'Falha na extração de dados', details: error.message });
  }
}
