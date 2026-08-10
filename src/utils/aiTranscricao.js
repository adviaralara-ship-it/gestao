import { GoogleGenerativeAI } from '@google/generative-ai'

// Mesmo modelo/chave usada no AlphaAI
const API_KEY = "AQ.Ab8RN6Ik8r-5xXO62z8qMO7Ne9Qxf8jUNTLpuWN4Ou2SPJAhXA"
const genAI = new GoogleGenerativeAI(API_KEY)
// Para áudio, o gemini-flash-latest é excelente e rápido
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" })

/**
 * Converte um Blob de áudio para uma string Base64 limpa
 * (remove o prefixo "data:audio/webm;base64,")
 */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(blob)
    reader.onloadend = () => {
      const base64data = reader.result
      const base64String = base64data.split(',')[1] // Pega só a parte do código
      resolve(base64String)
    }
    reader.onerror = reject
  })
}

/**
 * Envia o áudio para a IA e pede a Ata ou Resumo
 * @param {Blob} audioBlob Arquivo de áudio gravado
 * @param {string} tipo 'assembleia' ou 'reuniao'
 * @param {string} contexto Informações extras (título da reunião, pauta)
 */
export async function gerarAtaPorAudio(audioBlob, tipo, contexto) {
  try {
    const base64Audio = await blobToBase64(audioBlob)
    const mimeType = audioBlob.type || 'audio/webm'

    let prompt = ''
    if (tipo === 'assembleia') {
      prompt = `
Você é o Assistente Virtual de um condomínio.
Aqui está a gravação de áudio de uma Assembleia. O contexto é: ${contexto}.
Por favor, escute a gravação e redija a ATA OFICIAL DA ASSEMBLEIA, incluindo:
- Data e contexto.
- Principais pontos discutidos.
- Decisões tomadas e resultados de votações (se mencionado).
- Formatação clara, profissional e pronta para o síndico assinar.
Se o áudio estiver vazio ou inaudível, avise amigavelmente.
      `
    } else {
      prompt = `
Você é um Assistente Executivo.
Aqui está a gravação de áudio de uma reunião/conferência. O contexto é: ${contexto}.
Por favor, gere um RESUMO EXECUTIVO desta reunião contendo:
- Tópicos abordados.
- Próximos passos (Action Items).
- Formatação em tópicos limpa e direta.
Se o áudio estiver vazio ou inaudível, avise amigavelmente.
      `
    }

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: mimeType,
          data: base64Audio
        }
      }
    ])

    return result.response.text()
  } catch (error) {
    console.error("Erro na geração de ata por áudio:", error)
    throw new Error("Não foi possível gerar a transcrição no momento.")
  }
}

/**
 * Envia um documento (imagem/pdf) para a IA extrair os dados do candidato
 */
export async function extrairDadosCandidato(file) {
  try {
    const base64File = await blobToBase64(file)
    const mimeType = file.type || 'image/jpeg'

    const prompt = `
Você é um sistema extrator de dados de RH. O documento fornecido é um documento de identificação (RG, CNH, ou CPF).
Sua tarefa é extrair os seguintes campos:
- nomeCompleto
- nomeMae (se houver, senão retorne null)
- dataNascimento (no formato YYYY-MM-DD, ex: 1990-05-25)

Responda APENAS com um objeto JSON válido, sem markdown, sem explicações extras.
Exemplo:
{"nomeCompleto": "João da Silva", "nomeMae": "Maria da Silva", "dataNascimento": "1990-05-25"}
    `

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: mimeType,
          data: base64File
        }
      }
    ])

    const text = result.response.text()
    // Limpar markdown de json se a IA teimar em colocar
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim()
    return JSON.parse(cleanJson)
  } catch (error) {
    console.error("Erro ao extrair dados do documento:", error)
    throw new Error("Não foi possível extrair os dados.")
  }
}
