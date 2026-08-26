import re

file_nav = 'src/utils/navData.js'
with open(file_nav, 'r', encoding='utf-8') as f:
    text_nav = f.read()

old_logic = "if (reqPerm === 'conferencias' || reqPerm === 'recrutamento') reqPerm = 'rh'"
new_logic = "if (reqPerm === 'conferencias' || reqPerm === 'recrutamento') reqPerm = 'rh'\n      if (reqPerm === 'plano-contas') reqPerm = 'financeiro'"

if old_logic in text_nav:
    text_nav = text_nav.replace(old_logic, new_logic)

with open(file_nav, 'w', encoding='utf-8') as f:
    f.write(text_nav)
