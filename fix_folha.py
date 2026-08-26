import re

file = 'src/components/rh/RHFolhaPagamento.jsx'
with open(file, 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('activeColab', 'colabInfo')

with open(file, 'w', encoding='utf-8') as f:
    f.write(text)
