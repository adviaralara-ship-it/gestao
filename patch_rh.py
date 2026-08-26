import re

file_colab = 'src/components/rh/RHColaboradores.jsx'
with open(file_colab, 'r', encoding='utf-8') as f:
    text_colab = f.read()

# 1. Update RHColaboradores
if 'condominios' not in text_colab:
    text_colab = text_colab.replace(
        "const { items: colabs, addItem, updateItem, deleteItem } = useFirestore('rh')",
        "const { items: colabs, addItem, updateItem, deleteItem } = useFirestore('rh')\n  const { items: condominios } = useFirestore('condominios')"
    )

if 'condominios={condominios}' not in text_colab:
    text_colab = text_colab.replace(
        "<ColabModal data={modal === 'new' ? null : modal} onClose={() => setModal(null)} onSave={handleSave} />",
        "<ColabModal data={modal === 'new' ? null : modal} condominios={condominios} onClose={() => setModal(null)} onSave={handleSave} />"
    )

# 2. Update ColabModal inside RHColaboradores
text_colab = text_colab.replace("function ColabModal({ data, onClose, onSave }) {", "function ColabModal({ data, condominios = [], onClose, onSave }) {")

# Add condominio field to form state
text_colab = text_colab.replace(
    "nascimento: '', status: 'Ativo',",
    "nascimento: '', status: 'Ativo', condominio: '',"
)

# Add dropdown in the form layout
dropdown = """<div className="col-span-2">
            <label className="label">Condomínio / Empresa (Para Folha)</label>
            <select className="input" value={form.condominio || ''} onChange={e => set('condominio', e.target.value)}>
              <option value="">ALPHA GESTÃO CONDOMINIAL (Interno)</option>
              {condominios.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
            </select>
          </div>"""

# Insert dropdown after Nome Completo
text_colab = text_colab.replace(
    "onChange={e => set('nome', e.target.value)} /></div>",
    "onChange={e => set('nome', e.target.value)} /></div>\n          " + dropdown
)

with open(file_colab, 'w', encoding='utf-8') as f:
    f.write(text_colab)


# 3. Update RHFolhaPagamento
file_folha = 'src/components/rh/RHFolhaPagamento.jsx'
with open(file_folha, 'r', encoding='utf-8') as f:
    text_folha = f.read()

# Fetch condominios
if 'condominios' not in text_folha:
    text_folha = text_folha.replace(
        "const [colabs, setColabs] = useState([])",
        "const [colabs, setColabs] = useState([])\n  const [condominios, setCondominios] = useState([])"
    )
    
    fetch_condos = """const snapCondos = await getDocs(query(collection(db, 'condominios')))
      setCondominios(snapCondos.docs.map(d => ({ id: d.id, ...d.data() })))"""
      
    text_folha = text_folha.replace(
        "const snap = await getDocs(query(collection(db, 'rh')))",
        fetch_condos + "\n      const snap = await getDocs(query(collection(db, 'rh')))"
    )

# Replace hardcoded Alpha with logic
logic = """
                {(() => {
                  const condo = condominios.find(c => c.nome === activeColab?.condominio)
                  const empNome = activeColab?.condominio ? activeColab.condominio : 'ALPHA GESTÃO CONDOMINIAL'
                  const empCnpj = condo?.cnpj || (activeColab?.condominio ? 'CNPJ não cadastrado' : '00.000.000/0001-00')
                  return (
                    <>
                      <h1 className="text-xl font-bold uppercase">{empNome}</h1>
                      <p className="text-sm">CNPJ: {empCnpj}</p>
                    </>
                  )
                })()}
"""

text_folha = re.sub(
    r'<h1 className="text-xl font-bold uppercase">Alpha Gest.*?</h1>\s*<p className="text-sm">CNPJ: 00\.000\.000/0001-00</p>',
    logic.strip(),
    text_folha,
    flags=re.IGNORECASE | re.DOTALL
)

with open(file_folha, 'w', encoding='utf-8') as f:
    f.write(text_folha)

