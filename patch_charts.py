import re

# 1. Update Dashboard.jsx
file_dash = 'src/pages/Dashboard.jsx'
with open(file_dash, 'r', encoding='utf-8') as f:
    text_dash = f.read()

# Add useNavigate
if 'useNavigate' not in text_dash:
    text_dash = text_dash.replace("import { Link } from 'react-router-dom'", "import { Link, useNavigate } from 'react-router-dom'")

# Add const navigate inside Dashboard
if 'const navigate = useNavigate()' not in text_dash:
    text_dash = text_dash.replace("export default function Dashboard() {", "export default function Dashboard() {\n  const navigate = useNavigate()")

# Add onClick to Bars
old_bars = """<Bar dataKey="receitas" fill="#10B981" radius={[4,4,0,0]} name="Receitas" />
                <Bar dataKey="despesas" fill="#EF4444" radius={[4,4,0,0]} name="Despesas" />"""
new_bars = """<Bar dataKey="receitas" fill="#10B981" radius={[4,4,0,0]} name="Receitas" onClick={(data) => navigate(`/financeiro?tab=Historico&mes=${data.sortKey}&tipo=Receita`)} className="cursor-pointer hover:opacity-80 transition-opacity" />
                <Bar dataKey="despesas" fill="#EF4444" radius={[4,4,0,0]} name="Despesas" onClick={(data) => navigate(`/financeiro?tab=Historico&mes=${data.sortKey}&tipo=Despesa`)} className="cursor-pointer hover:opacity-80 transition-opacity" />"""
text_dash = text_dash.replace(old_bars, new_bars)

with open(file_dash, 'w', encoding='utf-8') as f:
    f.write(text_dash)


# 2. Update Financeiro.jsx
file_fin = 'src/pages/Financeiro.jsx'
with open(file_fin, 'r', encoding='utf-8') as f:
    text_fin = f.read()

# Replace activeTab initialization
old_tab = "const [activeTab, setActiveTab] = useState(isMorador ? 'Historico' : 'Dashboard')"
new_tab = """const searchParams = new URLSearchParams(window.location.search)
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || (isMorador ? 'Historico' : 'Dashboard'))"""

if old_tab in text_fin:
    text_fin = text_fin.replace(old_tab, new_tab)

with open(file_fin, 'w', encoding='utf-8') as f:
    f.write(text_fin)


# 3. Update Historico.jsx
file_hist = 'src/pages/financeiro/Historico.jsx'
with open(file_hist, 'r', encoding='utf-8') as f:
    text_hist = f.read()

old_state = """const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('Todos')
  const [mesFiltro, setMesFiltro] = useState('')"""
new_state = """const searchParams = new URLSearchParams(window.location.search)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState(searchParams.get('tipo') || 'Todos')
  const [mesFiltro, setMesFiltro] = useState(searchParams.get('mes') || '')"""

if old_state in text_hist:
    text_hist = text_hist.replace(old_state, new_state)

with open(file_hist, 'w', encoding='utf-8') as f:
    f.write(text_hist)
