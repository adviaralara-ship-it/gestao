import re

file_app = 'src/App.jsx'
with open(file_app, 'r', encoding='utf-8') as f:
    text_app = f.read()

old_route = '<Route path="boletos" element={<AuthorizedRoute module="boletos"><Boletos /></AuthorizedRoute>} />'
new_route = '<Route path="plano-contas" element={<AuthorizedRoute module="financeiro"><PlanoContas /></AuthorizedRoute>} />\n          <Route path="boletos" element={<AuthorizedRoute module="boletos"><Boletos /></AuthorizedRoute>} />'

if old_route in text_app and 'path="plano-contas"' not in text_app:
    text_app = text_app.replace(old_route, new_route)

with open(file_app, 'w', encoding='utf-8') as f:
    f.write(text_app)
