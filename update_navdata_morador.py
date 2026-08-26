import re

file = 'src/utils/navData.js'
with open(file, 'r', encoding='utf-8') as f:
    text = f.read()

old_rule = "if ((reqPerm === 'financeiro' || reqPerm === 'manutencoes') && user?.role === 'Morador') return true"
new_rule = """const moradorAdminTabs = ['seguro', 'regime', 'documentos', 'comunicacao', 'mural', 'enquetes', 'classificados', 'relatorios']
      if (user?.role === 'Morador' && (reqPerm === 'financeiro' || reqPerm === 'manutencoes' || moradorAdminTabs.includes(reqPerm))) return true"""

if old_rule in text:
    text = text.replace(old_rule, new_rule)
    with open(file, 'w', encoding='utf-8') as f:
        f.write(text)
    print("Updated")
else:
    print("Not found")
