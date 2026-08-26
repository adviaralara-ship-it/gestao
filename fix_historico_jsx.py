import re

file = 'src/pages/financeiro/Historico.jsx'
with open(file, 'r', encoding='utf-8') as f:
    text = f.read()

# Fix the JSX fragment
text = text.replace(
    "{!isMorador && <button onClick={() => setModalLanc(t)}",
    "{!isMorador && <><button onClick={() => setModalLanc(t)}"
)
text = text.replace(
    "<Trash2 size={14} /></button>}",
    "<Trash2 size={14} /></button></>}"
)

with open(file, 'w', encoding='utf-8') as f:
    f.write(text)
