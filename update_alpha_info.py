import re

file = 'src/components/rh/RHFolhaPagamento.jsx'
with open(file, 'r', encoding='utf-8') as f:
    text = f.read()

logic_old = """const condo = condominios.find(c => c.nome === colabInfo?.condominio)
                  const empNome = colabInfo?.condominio ? colabInfo.condominio : 'ALPHA GESTÃO CONDOMINIAL'
                  const empCnpj = condo?.cnpj || (colabInfo?.condominio ? 'CNPJ não cadastrado' : '00.000.000/0001-00')
                  return (
                    <>
                      <h1 className="text-xl font-bold uppercase">{empNome}</h1>
                      <p className="text-sm">CNPJ: {empCnpj}</p>
                    </>
                  )"""

logic_new = """const condo = condominios.find(c => c.nome === colabInfo?.condominio)
                  const empNome = colabInfo?.condominio ? colabInfo.condominio : 'ALPHA SOLUÇÕES CONDOMINIAIS LTDA'
                  const empCnpj = condo?.cnpj || (colabInfo?.condominio ? 'CNPJ não cadastrado' : '66.643.272/0001-18')
                  const empEnd = condo?.endereco || (colabInfo?.condominio ? '' : 'RUA SEVERINO NICOLAU DE MELO 420, OCEANIA')
                  return (
                    <>
                      <h1 className="text-xl font-bold uppercase">{empNome}</h1>
                      <p className="text-sm">CNPJ: {empCnpj}</p>
                      {empEnd && <p className="text-xs text-gray-500">{empEnd}</p>}
                    </>
                  )"""

if "ALPHA GESTÃO CONDOMINIAL" in text:
    text = text.replace(logic_old, logic_new)
    
with open(file, 'w', encoding='utf-8') as f:
    f.write(text)
