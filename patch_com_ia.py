import re

file_com = 'src/pages/Comunicacao.jsx'
with open(file_com, 'r', encoding='utf-8') as f:
    text_com = f.read()

# Add Sparkles, Loader2, Bot to lucide imports
if 'Sparkles' not in text_com:
    text_com = text_com.replace(
        "ExternalLink } from 'lucide-react'",
        "ExternalLink, Sparkles, Loader2, Bot } from 'lucide-react'"
    )

# Add genAI to imports if not present (since this uses AI, we need the gemini SDK)
# Or we can just fetch our AlphaAI? No, AlphaAI is a UI component. I'll just use the GoogleGenerativeAI directly since it's used in GeradorContratos.jsx
if '@google/generative-ai' not in text_com:
    text_com = text_com.replace(
        "import { enviarEmail } from '../emailjs.config'",
        "import { enviarEmail } from '../emailjs.config'\nimport { GoogleGenerativeAI } from '@google/generative-ai'\n\nconst API_KEY = \"AQ.Ab8RN6KdJTQzq73dAmBYqMifqbyYBO58ewLnP57zgB49j1xPYA\"\nconst genAI = new GoogleGenerativeAI(API_KEY)\nconst model = genAI.getGenerativeModel({ model: \"gemini-3.5-flash\" })"
    )

new_state = """  const [gerandoIA, setGerandoIA] = useState(false)
  const redigirComIA = async () => {
    if (!form.titulo) return alert("Por favor, digite pelo menos o Título para a IA ter uma base.")
    setGerandoIA(true)
    try {
      const prompt = `Atue como um síndico/administrador profissional de condomínio. 
Escreva um comunicado ${form.tipo.toLowerCase()} com o título "${form.titulo}". 
${form.texto ? `Use o seguinte rascunho/ideia como base: ${form.texto}` : ''}
O tom deve ser respeitoso, claro, objetivo e amigável. Retorne apenas o texto final do comunicado, sem aspas, pronto para ser enviado aos ${form.destino}.`
      
      const result = await model.generateContent(prompt)
      const text = result.response.text()
      set('texto', text)
    } catch (e) {
      console.error(e)
      alert("Erro ao gerar texto com IA.")
    } finally {
      setGerandoIA(false)
    }
  }
"""

if 'const redigirComIA' not in text_com:
    text_com = text_com.replace(
        "const destinoIndividual = form.destino==='Individual'",
        "const destinoIndividual = form.destino==='Individual'\n" + new_state
    )

# Add button next to textarea label
old_textarea = """<div><label className="label">Mensagem</label>
            <textarea className="input min-h-[120px] resize-y" value={form.texto} onChange={e=>set('texto',e.target.value)} placeholder="Escreva o comunicado detalhado aqui..."></textarea>
          </div>"""

new_textarea = """<div>
            <div className="flex items-center justify-between mb-1">
              <label className="label m-0">Mensagem</label>
              <button onClick={redigirComIA} disabled={gerandoIA} type="button" className="flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 px-3 py-1 rounded-full transition-colors disabled:opacity-50">
                {gerandoIA ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12}/>}
                {gerandoIA ? 'Escrevendo...' : 'Redigir com IA'}
              </button>
            </div>
            <textarea className="input min-h-[120px] resize-y" value={form.texto} onChange={e=>set('texto',e.target.value)} placeholder="Escreva o comunicado detalhado aqui ou clique em 'Redigir com IA' para expandir o seu rascunho..."></textarea>
          </div>"""

if old_textarea in text_com:
    text_com = text_com.replace(old_textarea, new_textarea)

with open(file_com, 'w', encoding='utf-8') as f:
    f.write(text_com)
