from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from gtts import gTTS
import io

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
            tts = gTTS(text=texto, lang='pt', tld='com.br')
            fp = io.BytesIO()
            tts.write_to_fp(fp)
            fp.seek(0)
            audio_data = fp.read()
            
            self.send_response(200)
            self.send_header('Content-type', 'audio/mpeg')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(audio_data)
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(str(e).encode('utf-8'))
