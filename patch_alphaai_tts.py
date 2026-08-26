import re

file_alpha = 'src/components/AlphaAI.jsx'
with open(file_alpha, 'r', encoding='utf-8') as f:
    text_alpha = f.read()

old_speak = """    const handleSpeak = () => {
      if (isPlaying) {
        window.speechSynthesis.cancel()
        setIsPlaying(false)
        return
      }
      
      const cleanText = text.replace(/\[.*?\]/g, '').replace(/\*/g, '')
      const utterance = new SpeechSynthesisUtterance(cleanText)
      utterance.lang = 'pt-BR'
      utterance.pitch = 1.1 // Voz um pouco mais animada
      utterance.rate = 1.05
      
      utterance.onend = () => setIsPlaying(false)
      
      setIsPlaying(true)
      window.speechSynthesis.speak(utterance)
    }"""

new_speak = """    const handleSpeak = () => {
      if (window.alphaAudio) {
        window.alphaAudio.pause()
        window.alphaAudio = null
      }
      if (isPlaying) {
        setIsPlaying(false)
        return
      }
      
      const cleanText = text.replace(/\[.*?\]/g, '').replace(/\\*/g, '')
      const encodedText = encodeURIComponent(cleanText)
      
      setIsPlaying(true)
      const audio = new Audio(`/api/gerar-audio?texto=${encodedText}`)
      window.alphaAudio = audio
      
      audio.onended = () => setIsPlaying(false)
      audio.onerror = () => {
         console.error("Erro no audio")
         setIsPlaying(false)
      }
      
      audio.play().catch(e => {
        console.error("Erro ao tocar:", e)
        setIsPlaying(false)
      })
    }"""

if 'window.speechSynthesis' in text_alpha:
    text_alpha = text_alpha.replace(old_speak, new_speak)

with open(file_alpha, 'w', encoding='utf-8') as f:
    f.write(text_alpha)
