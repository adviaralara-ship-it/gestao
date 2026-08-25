import re

def fix_ocorrencias_filter():
    file_path = 'src/pages/Ocorrencias.jsx'
    with open(file_path, 'r', encoding='utf-8') as f:
        text = f.read()

    # Update filter logic
    old_filter = "if (user?.role === 'Morador' && i.uid !== user?.uid) {\n      return false\n    }"
    new_filter = """if (user?.role === 'Morador') {
      const userId = user?.uid || user?.id;
      const isOwner = (i.uid && i.uid === userId) || (i.nome_morador === user?.nome);
      if (!isOwner) return false;
    }"""
    text = text.replace(old_filter, new_filter)

    # Rename title
    text = text.replace("Ocorrências & Solicitações", "Solicitações")

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(text)

def fix_navData():
    file_path = 'src/utils/navData.js'
    with open(file_path, 'r', encoding='utf-8') as f:
        text = f.read()

    text = text.replace("'Ocorrências & Solicitações'", "'Solicitações'")
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(text)

def fix_header():
    file_path = 'src/components/Header.jsx'
    with open(file_path, 'r', encoding='utf-8') as f:
        text = f.read()

    text = text.replace("'/ocorrencias':'Ocorrências'", "'/ocorrencias':'Solicitações'")

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(text)

fix_ocorrencias_filter()
fix_navData()
fix_header()
