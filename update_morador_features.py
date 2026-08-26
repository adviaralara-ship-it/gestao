import os
import re

def update_navData():
    file = 'src/utils/navData.js'
    with open(file, 'r', encoding='utf-8') as f:
        text = f.read()

    # Enable financeiro and manutencoes for Morador
    old_rule = "if (reqPerm === 'pets') return true"
    new_rule = """if (reqPerm === 'pets') return true
      if ((reqPerm === 'financeiro' || reqPerm === 'manutencoes') && user?.role === 'Morador') return true"""
    if "reqPerm === 'financeiro'" not in text:
        text = text.replace(old_rule, new_rule)

    with open(file, 'w', encoding='utf-8') as f:
        f.write(text)

def update_Financeiro():
    file = 'src/pages/Financeiro.jsx'
    with open(file, 'r', encoding='utf-8') as f:
        text = f.read()
    
    # 1. Update initial activeTab for Morador
    if "const [activeTab, setActiveTab] = useState('Dashboard')" in text:
        text = text.replace(
            "const [activeTab, setActiveTab] = useState('Dashboard')",
            "const [activeTab, setActiveTab] = useState(isMorador ? 'Historico' : 'Dashboard')"
        )

    # 2. Allow Moradores to see the tabs bar but ONLY the Historico tab
    tab_rule_old = "{!isMorador && ("
    if tab_rule_old in text:
        # HACK: Replace the specific block hiding tabs from Morador
        text = text.replace("{!isMorador && (\n        <div className=\"flex gap-2 mb-6 overflow-x-auto custom-scrollbar pb-2\">",
                            "<div className=\"flex gap-2 mb-6 overflow-x-auto custom-scrollbar pb-2\">")
        # And we need to remove the closing brace of that condition. It's tricky to regex, let's just adjust the tabs array instead.
        
    # Better approach: Just modify the `tabs` array directly so Moradores only have 'Historico'
    tabs_decl_old = "const tabs = [\n    { id: 'Dashboard', label: 'Visão Geral', icon: LayoutDashboard },"
    tabs_decl_new = """let tabs = [
    { id: 'Dashboard', label: 'Visão Geral', icon: LayoutDashboard },"""
    
    if "const tabs = [" in text:
        text = text.replace("const tabs = [", "let tabs = [")
    
    # Let's completely rewrite the tabs filtering logic near line 250
    # Search for: `if (user?.role === 'Administrador' || user?.role === 'Financeiro') {`
    injection = """
  if (isMorador) {
    tabs = [{ id: 'Historico', label: 'Histórico (Todos)', icon: FileText }]
  }
"""
    if "if (isMorador) {\n    tabs = [{" not in text:
        text = text.replace("if (user?.role === 'Administrador' || user?.role === 'Financeiro') {", injection + "\n  if (user?.role === 'Administrador' || user?.role === 'Financeiro') {")

    # Remove the `{!isMorador && (` that wraps the tabs mapping in the return
    text = re.sub(r'\{!isMorador && \(\s*(<div className="flex gap-2 mb-6 overflow-x-auto custom-scrollbar pb-2">[\s\S]*?</div>)\s*\)\}', r'\1', text)

    with open(file, 'w', encoding='utf-8') as f:
        f.write(text)

def update_Historico():
    file = 'src/pages/financeiro/Historico.jsx'
    with open(file, 'r', encoding='utf-8') as f:
        text = f.read()

    # Import useAuth
    if "useAuth" not in text:
        text = text.replace("import React", "import React from 'react'\nimport { useAuth } from '../../context/AuthContext'")
        text = text.replace("export default function Historico({", "export default function Historico({\n  const { user } = useAuth()\n  const isMorador = user?.role === 'Morador'\n")

    # Hide edit and delete buttons
    text = text.replace("<button onClick={() => setModalLanc(t)} title=\"Editar\"", "{!isMorador && <button onClick={() => setModalLanc(t)} title=\"Editar\"")
    text = text.replace("<Trash2 size={14} /></button>", "<Trash2 size={14} /></button>}")

    with open(file, 'w', encoding='utf-8') as f:
        f.write(text)

def update_Manutencoes():
    file = 'src/pages/Manutencoes.jsx'
    with open(file, 'r', encoding='utf-8') as f:
        text = f.read()

    if "const isMorador = user?.role === 'Morador'" not in text:
        text = text.replace("const { user } = useAuth()", "const { user } = useAuth()\n  const isMorador = user?.role === 'Morador'")

    # Hide "+ Agendar"
    text = text.replace("<button onClick={() => setModal('new')}", "{!isMorador && <button onClick={() => setModal('new')}")
    text = text.replace("<Plus size={16} /> Agendar Manutenção\n          </button>", "<Plus size={16} /> Agendar Manutenção\n          </button>}")

    # Hide edit/delete
    text = text.replace("<button onClick={() => setModal(m)} className=\"p-1.5", "{!isMorador && <><button onClick={() => setModal(m)} className=\"p-1.5")
    text = text.replace("<Trash2 size={14} /></button>\n                    </div>", "<Trash2 size={14} /></button></>}\n                    </div>")

    # Add cron logic for notifications inside Manutencoes component (since we fetch items here anyway)
    cron_logic = """
  // CRON NOTIFICAÇÕES (Executa apenas se Admin/Síndico abrir a tela)
  React.useEffect(() => {
    if (user?.role !== 'Administrador' && user?.role !== 'Síndico') return;
    
    const checkAndNotify = async () => {
      const { collection, getDocs, doc, setDoc } = await import('firebase/firestore')
      const { db } = await import('../firebase')
      
      const hoje = new Date()
      hoje.setHours(0,0,0,0)

      items.forEach(async (m) => {
        if (m.status === 'Concluída') return;
        if (!m.data_agendada) return;

        const dataManut = new Date(m.data_agendada + 'T12:00:00Z')
        const diffTime = dataManut - hoje
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

        let type = null
        if (diffDays === 3) type = '3d'
        else if (diffDays === 1) type = '1d'

        if (type) {
          const notifId = `notif_manut_${m.id}_${type}`
          const text = `[${m.condominio}] Lembrete: Manutenção preventiva de '${m.titulo}' agendada para ${type === '1d' ? 'AMANHÃ' : 'daqui a 3 dias'}.`
          
          try {
            await setDoc(doc(db, 'notificacoes', notifId), {
              text,
              time: new Date().toISOString(),
              tipo: 'manutencao',
              lida: false,
              condominio: m.condominio,
              _createdAt: new Date()
            }, { merge: true })
          } catch (e) {
            console.error(e)
          }
        }
      })
    }
    if (items.length > 0) checkAndNotify();
  }, [items, user])
"""
    if "CRON NOTIFICAÇÕES" not in text:
        text = text.replace("const handleSave = async form => {", cron_logic + "\n  const handleSave = async form => {")

    with open(file, 'w', encoding='utf-8') as f:
        f.write(text)

update_navData()
update_Financeiro()
update_Historico()
update_Manutencoes()
