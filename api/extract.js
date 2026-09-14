import { GoogleGenerativeAI } from '@google/generative-ai';

// A chave deve ser fornecida pelo ambiente (Vercel Env Vars)
const API_KEY = 'AQ.Ab8RN6LisZ8KdMGE-dFm_AGrkrJiB7U5pdx8CiJZq_lqxdSz8Q';
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

    let prompt = "";
    if (type === 'notafiscal') {
      prompt = `Extraia as seguintes informações desta nota fiscal ou recibo. Se houver mais de uma nota no arquivo, retorne um ARRAY de objetos JSON. Se houver apenas uma, retorne um ARRAY com um objeto. Use APENAS o seguinte formato, sem markdown:
      [{
        "numero": "número da nota ou recibo (se houver, senao vazio)",
        "prestador": "nome do fornecedor ou prestador de serviço",
        "cnpj": "CNPJ do prestador (formatado xx.xxx.xxx/xxxx-xx, ou vazio se não tiver)",
        "servico": "descrição curta do serviço ou produto",
        "valor": "valor total formatado (ex: R$ 1.500,00)",
        "data": "data de emissão no formato YYYY-MM-DD"
      }]`;
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
    
    // Limpar o texto para garantir que seja JSON (remover blocos de código markdown)
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const data = JSON.parse(text);

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error in OCR extraction:', error);
    return res.status(500).json({ error: 'Falha na extração de dados', details: error.message });
  }
}
