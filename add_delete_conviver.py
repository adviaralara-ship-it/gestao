import re

file = 'src/pages/Conviver.jsx'
with open(file, 'r', encoding='utf-8') as f:
    text = f.read()

# Add Trash2 to imports
if 'Trash2' not in text:
    text = text.replace('CheckCircle2 }', 'CheckCircle2, Trash2 }')

# Add deleteItem to useFirestore
if 'deleteItem' not in text:
    text = text.replace("updateItem } = useFirestore('ocorrencias')", "updateItem, deleteItem } = useFirestore('ocorrencias')")

# Modify the title div to include the trash icon
old_title_div = '<div className="font-bold text-gray-800">{t.titulo}</div>'
new_title_div = """<div className="flex justify-between items-start gap-2">
                      <div className="font-bold text-gray-800">{t.titulo}</div>
                      <button onClick={() => { if(window.confirm('Tem certeza que deseja apagar esta ocorrência?')) deleteItem(t.id); }} className="text-gray-300 hover:text-red-500 transition-colors p-1" title="Apagar ocorrência">
                        <Trash2 size={14} />
                      </button>
                    </div>"""

if old_title_div in text:
    text = text.replace(old_title_div, new_title_div)

with open(file, 'w', encoding='utf-8') as f:
    f.write(text)
