import re

file_path = 'src/pages/financeiro/Historico.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

# Add imports
if 'jspdf' not in text:
    text = text.replace("import { Search, Edit2, Trash2 }", "import { Search, Edit2, Trash2, Download } from 'lucide-react'\nimport { jsPDF } from 'jspdf'\nimport autoTable from 'jspdf-autotable'")

# Add gerarBalancete function
func = """
  const gerarBalancete = () => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.width
    
    doc.setFontSize(20)
    doc.setTextColor(3, 22, 56)
    doc.text('Balancete Discriminado de Transparencia', pageWidth / 2, 20, { align: 'center' })
    
    doc.setFontSize(14)
    doc.setTextColor(100)
    doc.text(`Mes de Referencia: ${mesFiltro ? mesFiltro.split('-').reverse().join('/') : 'Historico Geral'}`, pageWidth / 2, 30, { align: 'center' })
    
    doc.setFontSize(12)
    doc.setTextColor(50)
    doc.text(`Total Arrecadado (Receitas): R$ ${fmt(totalReceitas)}`, 14, 50)
    doc.text(`Total Gasto (Despesas): R$ ${fmt(totalDespesas)}`, 14, 60)
    // PROPOSITALMENTE NÃO MOSTRAR SALDO FINAL AQUI
    
    const tableData = filtered.map(t => [
      t.data ? t.data.split('-').reverse().join('/') : '-',
      t.descricao + (t.condominio ? ` (${t.condominio})` : ''),
      t.categoria || '-',
      t.tipo,
      `R$ ${fmt(t.valor)}`
    ])

    autoTable(doc, {
      startY: 75,
      head: [['Data', 'Descricao', 'Categoria', 'Tipo', 'Valor']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [3, 22, 56] },
      didParseCell: function(data) {
        if (data.section === 'body' && data.column.index === 3) {
          if (data.cell.raw === 'Receita') data.cell.styles.textColor = [0, 150, 0]
          if (data.cell.raw === 'Despesa') data.cell.styles.textColor = [200, 0, 0]
        }
      }
    })
    
    doc.save(`Balancete_Transparencia_${mesFiltro || 'Geral'}.pdf`)
  }
"""

if 'gerarBalancete' not in text:
    text = text.replace("return (", func + "\n  return (")

# Add button
btn_code = """
          <button onClick={gerarBalancete} className="px-4 py-2 rounded-xl text-sm font-medium bg-brand-600 text-white flex items-center gap-2 hover:bg-brand-700 transition-all ml-4">
            <Download size={16} /> Balancete PDF
          </button>
        </div>
"""

text = text.replace("</div>\n      </div>\n\n      <div className=\"card p-0", btn_code + "\n      </div>\n\n      <div className=\"card p-0")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(text)

