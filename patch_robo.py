import re

# 1. Update Condominios.jsx to add mandatoFim
file_condo = 'src/pages/Condominios.jsx'
with open(file_condo, 'r', encoding='utf-8') as f:
    text_condo = f.read()

old_state = "const [form, setForm] = useState(data || { nome:'', endereco:'', unidades:'', sindico:'', cnpj:'', status:'Ativo', fundoReserva:'', fundoMeta:'' })"
new_state = "const [form, setForm] = useState(data || { nome:'', endereco:'', unidades:'', sindico:'', mandatoFim:'', cnpj:'', status:'Ativo', fundoReserva:'', fundoMeta:'' })"

if old_state in text_condo:
    text_condo = text_condo.replace(old_state, new_state)

old_inputs = "['unidades','Nº de Unidades'],['chave_pix','Chave PIX (E-mail, CNPJ ou Celular)']].map(([k,l])=>("
new_inputs = "['mandatoFim','Fim do Mandato (Síndico)'],['unidades','Nº de Unidades'],['chave_pix','Chave PIX (E-mail, CNPJ ou Celular)']].map(([k,l])=>("

if old_inputs in text_condo:
    text_condo = text_condo.replace(old_inputs, new_inputs)
    
# for mandatoFim, we need it to be a date input. map currently uses a standard text input.
# I will just replace the mapping function to check if k is 'mandatoFim'
old_map = "            <div key={k}><label className=\"label\">{l}</label><input className=\"input\" value={form[k]} onChange={e=>set(k,e.target.value)} placeholder={l}/></div>"
new_map = "            <div key={k}><label className=\"label\">{l}</label><input type={k==='mandatoFim'?'date':'text'} className=\"input\" value={form[k]||''} onChange={e=>set(k,e.target.value)} placeholder={l}/></div>"

if old_map in text_condo:
    text_condo = text_condo.replace(old_map, new_map)

with open(file_condo, 'w', encoding='utf-8') as f:
    f.write(text_condo)


# 2. Update Dashboard.jsx
file_dash = 'src/pages/Dashboard.jsx'
with open(file_dash, 'r', encoding='utf-8') as f:
    text_dash = f.read()

# Add apolices and condominios hooks
if "const { items: apolices } = useFirestore('apolices')" not in text_dash:
    text_dash = text_dash.replace(
        "const { items: assembleias }  = useFirestore('assembleias')",
        "const { items: assembleias }  = useFirestore('assembleias')\n  const { items: apolices }  = useFirestore('apolices')\n  const { items: condominios }  = useFirestore('condominios')"
    )

# Add Shield and Bot to lucide-react imports
if 'Bot' not in text_dash:
    text_dash = text_dash.replace(
        "FileText, Bell, Clock, DoorOpen } from 'lucide-react'",
        "FileText, Bell, Clock, DoorOpen, Bot, Shield } from 'lucide-react'"
    )

# Add useMemo for roboAlertas
robo_memo = """
  const roboAlertas = useMemo(() => {
    const alertas = []
    const hoje = new Date()
    hoje.setHours(0,0,0,0)

    apolices.forEach(a => {
      if(a.vigencia_fim && a.status !== 'Cancelada') {
        const fim = new Date(a.vigencia_fim + 'T12:00:00Z')
        const diff = Math.ceil((fim - hoje) / (1000 * 60 * 60 * 24))
        if (diff <= 30 && diff >= -30) {
          alertas.push({ id: a.id, tipo: 'Seguro/Apólice', desc: a.seguradora, dias: diff, icon: Shield, color: diff < 0 ? 'text-red-500 bg-red-50 border-red-100' : 'text-orange-500 bg-orange-50 border-orange-100' })
        }
      }
    })

    condominios.forEach(c => {
      if(c.mandatoFim && c.status === 'Ativo') {
        const fim = new Date(c.mandatoFim + 'T12:00:00Z')
        const diff = Math.ceil((fim - hoje) / (1000 * 60 * 60 * 24))
        if (diff <= 30 && diff >= -30) {
          alertas.push({ id: c.id, tipo: 'Fim de Mandato', desc: `${c.sindico} (${c.nome})`, dias: diff, icon: Users, color: diff < 0 ? 'text-red-500 bg-red-50 border-red-100' : 'text-orange-500 bg-orange-50 border-orange-100' })
        }
      }
    })

    return alertas.sort((a,b) => a.dias - b.dias)
  }, [apolices, condominios])
"""
if 'const roboAlertas' not in text_dash:
    text_dash = text_dash.replace(
        "const visRecentes = visitantes",
        robo_memo + "\n  const visRecentes = visitantes"
    )

# Insert the HTML block for Robô
robo_html = """
      {/* Robô de Vencimentos */}
      {(user?.role === 'Administrador' || user?.role === 'Síndico') && roboAlertas.length > 0 && (
        <div className="card border-orange-200 bg-gradient-to-r from-orange-50/50 to-white">
          <div className="flex items-center gap-2 mb-4">
            <Bot size={20} className="text-orange-500" />
            <p className="section-title text-orange-800 m-0">Robô de Vencimentos (Alertas Automáticos)</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roboAlertas.map(a => (
              <div key={a.id + a.tipo} className={`flex items-start gap-3 p-3 rounded-xl border ${a.color} transition-all hover:scale-[1.02]`}>
                <div className="p-2 bg-white rounded-lg shadow-sm"><a.icon size={16}/></div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider opacity-80">{a.tipo}</p>
                  <p className="text-sm font-bold mt-0.5">{a.desc}</p>
                  <p className="text-xs mt-1 font-medium">{a.dias < 0 ? `Venceu há ${Math.abs(a.dias)} dias!` : a.dias === 0 ? 'Vence HOJE!' : `Vence em ${a.dias} dias`}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
"""
if 'Robô de Vencimentos' not in text_dash:
    text_dash = text_dash.replace(
        "{/* Divulgação do App + Portaria */}",
        robo_html + "\n\n      {/* Divulgação do App + Portaria */}"
    )

with open(file_dash, 'w', encoding='utf-8') as f:
    f.write(text_dash)
