import re

file_com = 'src/pages/Comunicacao.jsx'
with open(file_com, 'r', encoding='utf-8') as f:
    text_com = f.read()

# The user's image shows:
# <div><label className="label">Mensagem</label><textarea className="input resize-none min-h-[120px]" value={form.texto} onChange={e=>set('texto',e.target.value)} placeholder="Escreva a mensagem aqui..."/></div>

old_textarea = """<div><label className="label">Mensagem</label><textarea className="input resize-none min-h-[120px]" value={form.texto} onChange={e=>set('texto',e.target.value)} placeholder="Escreva a mensagem aqui..."/></div>"""

new_textarea = """<div>
            <div className="flex items-center justify-between mb-1">
              <label className="label m-0">Mensagem</label>
              <button onClick={redigirComIA} disabled={gerandoIA} type="button" className="flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 px-3 py-1 rounded-full transition-colors disabled:opacity-50">
                {gerandoIA ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12}/>}
                {gerandoIA ? 'Escrevendo...' : 'Redigir com IA'}
              </button>
            </div>
            <textarea className="input resize-none min-h-[120px]" value={form.texto} onChange={e=>set('texto',e.target.value)} placeholder="Escreva o comunicado detalhado aqui ou clique em 'Redigir com IA' para expandir o seu rascunho..."/>
          </div>"""

if old_textarea in text_com:
    text_com = text_com.replace(old_textarea, new_textarea)

with open(file_com, 'w', encoding='utf-8') as f:
    f.write(text_com)
