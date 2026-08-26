import re

file_mural = 'src/pages/Mural.jsx'
with open(file_mural, 'r', encoding='utf-8') as f:
    text_mural = f.read()

# Add Volume2, VolumeX, Loader2 to lucide imports
if 'Volume2' not in text_mural:
    text_mural = text_mural.replace(
        "User, Search } from 'lucide-react'",
        "User, Search, Volume2, VolumeX, Loader2 } from 'lucide-react'"
    )

# Add states for Audio
new_state = """
  const [audioTocandoId, setAudioTocandoId] = useState(null)
  const [audioObj, setAudioObj] = useState(null)
  const [carregandoAudioId, setCarregandoAudioId] = useState(null)

  const toggleAudio = (id, texto) => {
    // Se já estiver tocando ESSE áudio, pausa e cancela
    if (audioTocandoId === id && audioObj) {
      audioObj.pause()
      setAudioObj(null)
      setAudioTocandoId(null)
      return
    }
    // Se estiver tocando OUTRO, pausa
    if (audioObj) {
      audioObj.pause()
      setAudioObj(null)
    }

    setCarregandoAudioId(id)
    const textoCodificado = encodeURIComponent(texto)
    const novoAudio = new Audio(`/api/gerar-audio?texto=${textoCodificado}`)
    
    novoAudio.oncanplaythrough = () => {
      setCarregandoAudioId(null)
      setAudioTocandoId(id)
      novoAudio.play().catch(e => {
        console.error("Erro ao tocar:", e)
        setAudioTocandoId(null)
      })
    }
    novoAudio.onended = () => {
      setAudioTocandoId(null)
      setAudioObj(null)
    }
    novoAudio.onerror = () => {
      console.error("Erro de áudio")
      setCarregandoAudioId(null)
      setAudioTocandoId(null)
    }
    setAudioObj(novoAudio)
  }

  // Cleanup na desmontagem
  useEffect(() => {
    return () => {
      if (audioObj) audioObj.pause()
    }
  }, [audioObj])
"""

if 'const toggleAudio' not in text_mural:
    text_mural = text_mural.replace(
        "const [curtidas, setCurtidas] = useState({})",
        "const [curtidas, setCurtidas] = useState({})\n" + new_state
    )

# Add the 'Ouvir' button to the post interaction bar
old_btn = """              <button className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-brand-600 transition-colors">
                <Share2 size={18} /> Compartilhar
              </button>"""

new_btn = old_btn + """
              <button 
                onClick={() => toggleAudio(post.id, post.texto)} 
                disabled={carregandoAudioId === post.id}
                className={`flex items-center gap-1.5 text-sm font-semibold transition-colors ${audioTocandoId === post.id ? 'text-brand-600' : 'text-gray-500 hover:text-brand-600'}`}>
                {carregandoAudioId === post.id ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : audioTocandoId === post.id ? (
                  <VolumeX size={18} />
                ) : (
                  <Volume2 size={18} />
                )}
                {carregandoAudioId === post.id ? 'Gerando Voz...' : audioTocandoId === post.id ? 'Parar' : 'Ouvir'}
              </button>"""

if 'toggleAudio(post.id' not in text_mural:
    text_mural = text_mural.replace(old_btn, new_btn)

with open(file_mural, 'w', encoding='utf-8') as f:
    f.write(text_mural)
