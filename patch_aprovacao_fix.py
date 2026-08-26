import re

# 1. Patch Financeiro.jsx
file_fin = 'src/pages/Financeiro.jsx'
with open(file_fin, 'r', encoding='utf-8') as f:
    text_fin = f.read()

# Add Aguardando Aprovação to the modal status select
if '<option>Aguardando Aprovação</option>' not in text_fin:
    text_fin = text_fin.replace(
        '<option>Recebido</option><option>Pago</option><option>Pendente</option>',
        '<option>Recebido</option><option>Pago</option><option>Pendente</option><option>Aguardando Aprovação</option>'
    )

# Pass updateLancamento to Historico
if 'updateLancamento={updateLancamento}' not in text_fin:
    text_fin = text_fin.replace(
        'deleteLancamento={deleteLancamento}',
        'deleteLancamento={deleteLancamento}\n          updateLancamento={updateLancamento}'
    )

with open(file_fin, 'w', encoding='utf-8') as f:
    f.write(text_fin)


# 2. Patch Historico.jsx
file_hist = 'src/pages/financeiro/Historico.jsx'
with open(file_hist, 'r', encoding='utf-8') as f:
    text_hist = f.read()

# Add CheckCircle2 to imports
if 'CheckCircle2' not in text_hist:
    text_hist = text_hist.replace(
        "import { Edit2, Trash2, FileText } from 'lucide-react'",
        "import { Edit2, Trash2, FileText, CheckCircle2 } from 'lucide-react'"
    )

# Add updateLancamento to props safely
text_hist = re.sub(
    r'export default function Historico\(\{ lancamentos, setModalLanc, deleteLancamento \}\) \{',
    r'export default function Historico({ lancamentos, setModalLanc, deleteLancamento, updateLancamento }) {',
    text_hist
)

# Add statusBadge logic
old_badge = "const statusBadge = (s) => ({ Recebido: 'badge-green', Pago: 'badge-blue', Pendente: 'badge-yellow' }[s] || 'badge-blue')"
new_badge = "const statusBadge = (s) => ({ Recebido: 'badge-green', Pago: 'badge-blue', Pendente: 'badge-yellow', 'Aguardando Aprovação': 'bg-orange-100 text-orange-800 px-2 py-0.5 rounded text-[10px] font-bold border border-orange-200' }[s] || 'badge-blue')"
if old_badge in text_hist:
    text_hist = text_hist.replace(old_badge, new_badge)

# Add Approve button
old_buttons = """{!isMorador && <><button onClick={() => setModalLanc(t)} title="Editar" className="p-1.5 rounded-lg bg-cream-100 hover:bg-brand-100 text-gray-400 hover:text-brand-600 transition-all"><Edit2 size={14} /></button>
                        <button onClick={() => deleteLancamento(t.id)} title="Excluir" className="p-1.5 rounded-lg bg-cream-100 hover:bg-red-100 text-gray-400 hover:text-red-500 transition-all"><Trash2 size={14} /></button></>}"""

new_buttons = """{!isMorador && (
                          <>
                            {t.status === 'Aguardando Aprovação' && (user?.role === 'Síndico' || user?.role === 'Administrador') && (
                              <button onClick={() => { if(window.confirm('Confirma a aprovação desta despesa? O status mudará para Pendente.')) updateLancamento(t.id, { ...t, status: 'Pendente' }) }} title="Aprovar Despesa" className="p-1.5 rounded-lg bg-orange-100 hover:bg-emerald-100 text-orange-600 hover:text-emerald-600 border border-transparent hover:border-emerald-200 transition-all">
                                <CheckCircle2 size={14} />
                              </button>
                            )}
                            <button onClick={() => setModalLanc(t)} title="Editar" className="p-1.5 rounded-lg bg-cream-100 hover:bg-brand-100 text-gray-400 hover:text-brand-600 transition-all"><Edit2 size={14} /></button>
                            <button onClick={() => deleteLancamento(t.id)} title="Excluir" className="p-1.5 rounded-lg bg-cream-100 hover:bg-red-100 text-gray-400 hover:text-red-500 transition-all"><Trash2 size={14} /></button>
                          </>
                        )}"""

if old_buttons in text_hist:
    text_hist = text_hist.replace(old_buttons, new_buttons)

with open(file_hist, 'w', encoding='utf-8') as f:
    f.write(text_hist)

