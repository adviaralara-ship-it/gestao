from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import asyncio
import edge_tts
import tempfile
import os

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urlparse(self.path)
        query = parse_qs(parsed_path.query)
        texto = query.get('texto', [''])[0]

        if not texto:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b"Texto nao fornecido")
            return

        try:
            audio_data = asyncio.run(self.generate_audio(texto))
            
            origin = self.headers.get('Origin', '')
            allowed = ['https://alphaadmsc.vercel.app', 'https://alpha-gestao.vercel.app', 'http://localhost:5173', 'http://localhost:3000']
            allow_origin = origin if origin in allowed else allowed[0]

            self.send_response(200)
            self.send_header('Content-type', 'audio/mpeg')
            self.send_header('Access-Control-Allow-Origin', allow_origin)
            self.send_header('Vary', 'Origin')
            self.end_headers()
            self.wfile.write(audio_data)
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(str(e).encode('utf-8'))

    async def generate_audio(self, texto):
        voz = "pt-BR-FranciscaNeural"
        comunicador = edge_tts.Communicate(texto, voz)
        
        temp_dir = tempfile.gettempdir()
        caminho_arquivo = os.path.join(temp_dir, f"audio_temp_{os.getpid()}.mp3")
        
        await comunicador.save(caminho_arquivo)
        
        with open(caminho_arquivo, "rb") as f:
            data = f.read()
            
        try:
            os.remove(caminho_arquivo)
        except:
            pass
            
        return data
