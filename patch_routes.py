import re
import os

file_app = 'src/App.jsx'
with open(file_app, 'r', encoding='utf-8') as f:
    text_app = f.read()

if 'import PlanoContas' not in text_app:
    text_app = text_app.replace(
        "import Visitantes from './pages/Visitantes'",
        "import Visitantes from './pages/Visitantes'\nimport PlanoContas from './pages/PlanoContas'"
    )

if 'path="/plano-contas"' not in text_app:
    text_app = text_app.replace(
        '<Route path="/boletos" element={<Boletos />} />',
        '<Route path="/plano-contas" element={<PlanoContas />} />\n          <Route path="/boletos" element={<Boletos />} />'
    )

with open(file_app, 'w', encoding='utf-8') as f:
    f.write(text_app)

file_nav = 'src/utils/navData.js'
with open(file_nav, 'r', encoding='utf-8') as f:
    text_nav = f.read()

if '/plano-contas' not in text_nav:
    text_nav = text_nav.replace(
        "{ to: '/financeiro', label: 'Receitas & Despesas', icon: CreditCard },",
        "{ to: '/financeiro', label: 'Receitas & Despesas', icon: CreditCard },\n      { to: '/plano-contas', label: 'Previsão & Plano de Contas', icon: PieChart },"
    )

with open(file_nav, 'w', encoding='utf-8') as f:
    f.write(text_nav)
