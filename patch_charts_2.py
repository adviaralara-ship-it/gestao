import re

file_dash = 'src/pages/Dashboard.jsx'
with open(file_dash, 'r', encoding='utf-8') as f:
    text_dash = f.read()

old_bars = """<Bar dataKey="receitas" name="Receitas" fill="#10b981" radius={[4,4,0,0]} barSize={32}/>
                <Bar dataKey="despesas" name="Despesas" fill="#ef4444" radius={[4,4,0,0]} barSize={32}/>"""
new_bars = """<Bar dataKey="receitas" name="Receitas" fill="#10b981" radius={[4,4,0,0]} barSize={32} onClick={(data) => navigate(`/financeiro?tab=Historico&mes=${data.sortKey}&tipo=Receita`)} className="cursor-pointer hover:opacity-80 transition-opacity" />
                <Bar dataKey="despesas" name="Despesas" fill="#ef4444" radius={[4,4,0,0]} barSize={32} onClick={(data) => navigate(`/financeiro?tab=Historico&mes=${data.sortKey}&tipo=Despesa`)} className="cursor-pointer hover:opacity-80 transition-opacity" />"""

if old_bars in text_dash:
    text_dash = text_dash.replace(old_bars, new_bars)

# also fix Pie chart
old_pie = """<Pie data={adimplenciaData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} stroke="none">"""
new_pie = """<Pie data={adimplenciaData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} stroke="none" onClick={(data) => navigate(`/financeiro?tab=Historico&mes=${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}&tipo=Receita`)} className="cursor-pointer hover:opacity-80 transition-opacity">"""

if old_pie in text_dash:
    text_dash = text_dash.replace(old_pie, new_pie)

with open(file_dash, 'w', encoding='utf-8') as f:
    f.write(text_dash)
