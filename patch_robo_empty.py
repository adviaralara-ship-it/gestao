import re

file_dash = 'src/pages/Dashboard.jsx'
with open(file_dash, 'r', encoding='utf-8') as f:
    text_dash = f.read()

old_robo_header = "{(user?.role === 'Administrador' || user?.role === 'Síndico') && roboAlertas.length > 0 && ("
new_robo_header = "{(user?.role === 'Administrador' || user?.role === 'Síndico') && ("

if old_robo_header in text_dash:
    text_dash = text_dash.replace(old_robo_header, new_robo_header)

old_robo_body = """          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roboAlertas.map(a => ("""

new_robo_body = """          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roboAlertas.length === 0 ? (
              <div className="col-span-full py-6 flex flex-col items-center justify-center text-orange-400 opacity-80">
                <Shield size={32} className="mb-2 text-orange-300" />
                <p className="text-sm font-medium">Tudo em dia!</p>
                <p className="text-xs">Nenhum seguro ou mandato vencendo nos próximos 30 dias.</p>
              </div>
            ) : roboAlertas.map(a => ("""

if old_robo_body in text_dash:
    text_dash = text_dash.replace(old_robo_body, new_robo_body)

with open(file_dash, 'w', encoding='utf-8') as f:
    f.write(text_dash)
