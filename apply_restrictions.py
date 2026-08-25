import re

def update_navData():
    file_path = 'src/utils/navData.js'
    with open(file_path, 'r', encoding='utf-8') as f:
        text = f.read()
    
    # Fix broken encoding text if present
    text = text.replace("Media????o", "Mediação")
    text = text.replace("Mediao", "Mediação")
    
    # Restrict Mediação to Administrador
    text = text.replace("if (reqPerm === 'pets' || reqPerm === 'mediacao') return true", "if (reqPerm === 'pets') return true")
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(text)

def update_Header():
    file_path = 'src/components/Header.jsx'
    with open(file_path, 'r', encoding='utf-8') as f:
        text = f.read()

    # Restrict ROLES_COM_NOTIF to Administrador and Síndico
    text = re.sub(
        r"const ROLES_COM_NOTIF = \['Administrador','Síndico','Financeiro','Subsíndico','Conselheiro','Morador'\]",
        "const ROLES_COM_NOTIF = ['Administrador','Síndico']",
        text
    )

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(text)

def update_Ocorrencias():
    file_path = 'src/pages/Ocorrencias.jsx'
    with open(file_path, 'r', encoding='utf-8') as f:
        text = f.read()

    # Make Morador only see their own occurrences
    filter_block = """
  const filtered = items.filter(i => {
    if (i.visibilidade === 'Apenas Adm' && user?.role !== 'Administrador') {
      return false
    }
    // Restringir morador para ver apenas as próprias ocorrências
    if (user?.role === 'Morador' && i.uid !== user?.uid) {
      return false
    }
"""
    if "i.uid !== user?.uid" not in text:
        text = text.replace("""
  const filtered = items.filter(i => {
    if (i.visibilidade === 'Apenas Adm' && user?.role !== 'Administrador') {
      return false
    }""", filter_block)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(text)

update_navData()
update_Header()
update_Ocorrencias()
