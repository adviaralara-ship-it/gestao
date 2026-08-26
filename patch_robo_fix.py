import re

file_dash = 'src/pages/Dashboard.jsx'
with open(file_dash, 'r', encoding='utf-8') as f:
    text_dash = f.read()

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

if 'const roboAlertas = useMemo' not in text_dash:
    text_dash = text_dash.replace(
        "const visRecentes = [...visitantes]",
        robo_memo + "\n  const visRecentes = [...visitantes]"
    )

with open(file_dash, 'w', encoding='utf-8') as f:
    f.write(text_dash)
