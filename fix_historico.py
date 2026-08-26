import re

file = 'src/pages/financeiro/Historico.jsx'
with open(file, 'r', encoding='utf-8') as f:
    text = f.read()

# Fix imports
text = re.sub(
    r"import React from 'react'\nimport \{ useAuth \} from '\.\./\.\./context/AuthContext', \{ useState \} from 'react'",
    "import React, { useState } from 'react'\nimport { useAuth } from '../../context/AuthContext'",
    text
)

# Fix declaration
text = re.sub(
    r"export default function Historico\(\{\n  const \{ user \} = useAuth\(\)\n  const isMorador = user\?\.role === 'Morador'\n lancamentos, setModalLanc, deleteLancamento \}\) \{",
    "export default function Historico({ lancamentos, setModalLanc, deleteLancamento }) {\n  const { user } = useAuth()\n  const isMorador = user?.role === 'Morador'",
    text
)

with open(file, 'w', encoding='utf-8') as f:
    f.write(text)
