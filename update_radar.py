import re

file_path = 'src/pages/RadarConviver.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

# Add imports
if 'jspdf' not in text:
    text = text.replace("import { PieChart", "import { jsPDF } from 'jspdf'\nimport autoTable from 'jspdf-autotable'\nimport { PieChart")
    text = text.replace("import { Radar, AlertTriangle, ShieldCheck, Activity, Users, MapPin, TrendingDown }", "import { Radar, AlertTriangle, ShieldCheck, Activity, Users, MapPin, TrendingDown, Download }")

# Add gerarPDFRadar function
func = """
  const gerarPDFRadar = () => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.width
    
    doc.setFontSize(20)
    doc.setTextColor(3, 22, 56)
    doc.text('Relatorio de Saude da Convivencia', pageWidth / 2, 20, { align: 'center' })
    
    doc.setFontSize(14)
    doc.setTextColor(100)
    doc.text(`Condominio: ${condominioFiltro || 'Todos'}`, pageWidth / 2, 30, { align: 'center' })
    
    doc.setFontSize(16)
    let color = [0, 128, 0]
    if (stats.indiceGeral === 'Atenção') color = [200, 150, 0]
    if (stats.indiceGeral === 'Crítico') color = [200, 0, 0]
    
    doc.setTextColor(...color)
    doc.text(`INDICE GERAL: ${stats.indiceGeral.toUpperCase()}`, pageWidth / 2, 45, { align: 'center' })
    
    doc.setTextColor(50)
    doc.setFontSize(12)
    doc.text(`Total de Ocorrencias (Historico): ${stats.total}`, 14, 65)
    doc.text(`Casos Encerrados/Resolvidos: ${stats.encerradas}`, 14, 75)
    doc.text(`Casos em Acompanhamento: ${stats.acompanhamento}`, 14, 85)
    
    autoTable(doc, {
      startY: 100,
      head: [['Categoria (Causa do Conflito)', 'Quantidade']],
      body: stats.chartData.map(d => [d.name, d.value]),
      theme: 'grid',
      headStyles: { fillColor: [3, 22, 56] }
    })
    
    if (stats.recorrentes.length > 0) {
      doc.text('Alertas de Recorrencia', 14, doc.lastAutoTable.finalY + 15)
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 20,
        head: [['Apartamento', 'Categoria Repetida', 'Quantas Vezes']],
        body: stats.recorrentes.map(r => [`Apt ${r.apt}`, r.cat, `${r.count} vezes`]),
        theme: 'striped',
        headStyles: { fillColor: [200, 50, 50] }
      })
    }
    
    doc.save(`Radar_Convivencia_${condominioFiltro.replace(/\s+/g, '_')}.pdf`)
  }
"""

if 'gerarPDFRadar' not in text:
    text = text.replace("const COLORS", func + "\n  const COLORS")

# Add button
btn_code = """
        <div className="flex gap-2">
        {user?.role !== 'Morador' && (
          <select 
            className="input w-64" 
            value={condominioFiltro} 
            onChange={e => setCondominioFiltro(e.target.value)}
          >
            <option value="">Selecione o Condomínio...</option>
            {condominios.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        {condominioFiltro && (
          <button onClick={gerarPDFRadar} className="btn btn-primary flex items-center gap-2 whitespace-nowrap">
            <Download size={16} /> Baixar Relatório
          </button>
        )}
        </div>
"""

text = re.sub(r"\{user\?\.role !== 'Morador' && \(\s*<select[\s\S]*?</select>\s*\)\}", btn_code, text)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(text)

