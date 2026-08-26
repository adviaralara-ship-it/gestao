import re

file_nav = 'src/utils/navData.js'
with open(file_nav, 'r', encoding='utf-8') as f:
    text_nav = f.read()

# Add Bot to imports
if 'Bot' not in text_nav:
    text_nav = text_nav.replace(
        "import { LayoutDashboard, Users",
        "import { LayoutDashboard, Users, Bot"
    )
    if 'Bot' not in text_nav:
        text_nav = text_nav.replace(
            "const { LayoutDashboard, Users",
            "const { LayoutDashboard, Users, Bot"
        )
        # Se for import de lucide-react direto
        text_nav = re.sub(r'(import \{[^}]*)( \})( from \'lucide-react\')', r'\1, Bot\2\3', text_nav)

if '/alpha-ai' not in text_nav:
    text_nav = text_nav.replace(
        "{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },",
        "{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },\n      { to: '/alpha-ai', label: 'Alpha IA', icon: Bot },"
    )

with open(file_nav, 'w', encoding='utf-8') as f:
    f.write(text_nav)
