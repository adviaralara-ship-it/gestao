import React, { useState } from 'react'
import { FileText, Download, PieChart as PieChartIcon, BarChart3 } from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from 'recharts'

export default function DRE({ lancamentos, condoFilter }) {
  const hoje = new Date()
  const [mesFiltro, setMesFiltro] = useState(`${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}`)

  const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  // Filtrar apenas recebidos e pagos do mês para o DRE efetivo
  const lancamentosMes = lancamentos.filter(t => t.data?.startsWith(mesFiltro))
  const receitas = lancamentosMes.filter(t => t.tipo === 'Receita' && t.status === 'Recebido')
  const despesas = lancamentosMes.filter(t => t.tipo === 'Despesa' && t.status === 'Pago')

  const totalReceitas = receitas.reduce((acc, c) => acc + Number(c.valor || 0), 0)
  const totalDespesas = despesas.reduce((acc, c) => acc + Number(c.valor || 0), 0)
  const resultadoOperacional = totalReceitas - totalDespesas

  // Agrupar despesas por categoria
  const gruposDespesas = despesas.reduce((acc, t) => {
    const cat = t.categoria || 'Outras Despesas'
    acc[cat] = (acc[cat] || 0) + Number(t.valor || 0)
    return acc
  }, {})
  const maioresDespesas = Object.entries(gruposDespesas).sort((a,b) => b[1] - a[1])

  const chartDataPie = [
    { name: 'Receitas', value: totalReceitas },
    { name: 'Despesas', value: totalDespesas }
  ]
  const COLORS = ['#10b981', '#ef4444'] // emerald-500, red-500

  const chartDataBar = maioresDespesas.slice(0,5).map(d => ({
    name: d[0],
    Valor: d[1]
  }))

  const exportPDF = () => {
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text(`Demonstrativo de Resultado do Exercício (DRE)`, 14, 20)
    doc.setFontSize(12)
    doc.text(`Período: ${mesFiltro}`, 14, 28)
    doc.text(`Condomínio: ${condoFilter}`, 14, 34)

    autoTable(doc, {
      startY: 35,
      head: [['Descrição', 'Valor (R$)']],
      body: [
        ['RECEITA OPERACIONAL BRUTA', fmt(totalReceitas)],
        ...receitas.map(r => [`   ${r.descricao}`, fmt(r.valor)]),
        ['', ''],
        ['CUSTOS / DESPESAS OPERACIONAIS', fmt(totalDespesas)],
        ...maioresDespesas.map(d => [`   ${d[0]}`, fmt(d[1])]),
        ['', ''],
        ['RESULTADO OPERACIONAL LÍQUIDO', fmt(resultadoOperacional)]
      ],
      theme: 'grid',
      headStyles: { fillColor: [45, 48, 69] },
      columnStyles: { 1: { halign: 'right' } }
    })
    doc.save(`DRE_${mesFiltro}.pdf`)
  }

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-gray-800">DRE - Demonstrativo de Resultado</h3>
          <p className="text-sm text-gray-500">Resumo financeiro consolidado do mês</p>
        </div>
        <div className="flex gap-2">
          <input type="month" className="input" value={mesFiltro} onChange={e => setMesFiltro(e.target.value)} />
          <button onClick={exportPDF} className="btn-secondary flex items-center gap-2"><Download size={16}/> Exportar PDF</button>
        </div>
      </div>

      <div className="card max-w-4xl mx-auto w-full bg-white shadow-sm border border-cream-300 p-8">
        <div className="border-b-2 border-gray-800 pb-4 mb-6">
          <h1 className="text-2xl font-black text-center text-gray-800 uppercase tracking-widest">DRE</h1>
          <p className="text-center text-brand-600 uppercase font-bold mt-1">{condoFilter === 'Todos' ? 'Consolidado (Todos os Condomínios)' : condoFilter}</p>
          <p className="text-center text-gray-500 uppercase font-semibold mt-1">Competência: {mesFiltro.split('-').reverse().join('/')}</p>
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-cream-50 p-4 rounded-xl border border-cream-200 flex flex-col items-center">
            <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><PieChartIcon size={16}/> Receitas x Despesas</h4>
            <div className="w-full h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartDataPie} innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value" stroke="none">
                    {chartDataPie.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value) => `R$ ${fmt(value)}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="bg-cream-50 p-4 rounded-xl border border-cream-200 flex flex-col items-center">
            <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><BarChart3 size={16}/> Maiores Despesas</h4>
            <div className="w-full h-48">
              {chartDataBar.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartDataBar} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} tick={{fontSize: 11, fill:'#6b7280'}} />
                    <Tooltip cursor={{fill: '#f3f4f6'}} formatter={(value) => `R$ ${fmt(value)}`} />
                    <Bar dataKey="Valor" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-gray-400 mt-10">Sem despesas no período</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {/* Receitas */}
          <div className="flex justify-between bg-emerald-50 text-emerald-800 font-bold p-3 rounded uppercase text-sm border-l-4 border-emerald-500">
            <span>1. Receita Bruta</span>
            <span>R$ {fmt(totalReceitas)}</span>
          </div>
          <div className="pl-6 flex flex-col gap-1 mb-4">
            {receitas.map((r, i) => (
              <div key={i} className="flex justify-between text-sm text-gray-600 border-b border-gray-100 py-1">
                <span>{r.descricao} <span className="text-xs text-gray-400">({r.categoria})</span></span>
                <span>R$ {fmt(r.valor)}</span>
              </div>
            ))}
            {receitas.length === 0 && <p className="text-sm text-gray-400 italic">Sem receitas no período</p>}
          </div>

          {/* Despesas */}
          <div className="flex justify-between bg-red-50 text-red-800 font-bold p-3 rounded uppercase text-sm border-l-4 border-red-500">
            <span>2. Despesas Operacionais</span>
            <span>- R$ {fmt(totalDespesas)}</span>
          </div>
          <div className="pl-6 flex flex-col gap-1 mb-6">
            {maioresDespesas.map((d, i) => (
              <div key={i} className="flex justify-between text-sm text-gray-600 border-b border-gray-100 py-1">
                <span>{d[0]}</span>
                <span>R$ {fmt(d[1])}</span>
              </div>
            ))}
            {maioresDespesas.length === 0 && <p className="text-sm text-gray-400 italic">Sem despesas no período</p>}
          </div>

          {/* Resultado */}
          <div className={`flex justify-between font-black p-4 rounded uppercase text-lg ${resultadoOperacional >= 0 ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
            <span>(=) Resultado do Exercício</span>
            <span>R$ {fmt(resultadoOperacional)}</span>
          </div>
        </div>

        <div className="mt-8 bg-cream-50 p-4 rounded-xl border border-cream-200">
          <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><FileText size={18} className="text-brand-600"/> Análise Gerencial</h4>
          <p className="text-sm text-gray-600">
            Neste período, {condoFilter === 'Todos' ? 'o consolidado' : 'o condomínio'} apresentou um <b>{resultadoOperacional >= 0 ? 'Superávit' : 'Déficit'}</b> de R$ {fmt(resultadoOperacional)}.
            {resultadoOperacional < 0 && " É necessário atenção para reduzir custos operacionais ou revisar a taxa de arrecadação."}
            {resultadoOperacional > 0 && " O resultado positivo pode ser alocado para a Reserva de Emergência ou benfeitorias."}
          </p>
          {maioresDespesas.length > 0 && (
             <p className="text-sm text-gray-600 mt-2">
               O maior grupo de despesa foi <b>{maioresDespesas[0][0]}</b>, representando {((maioresDespesas[0][1]/totalDespesas)*100).toFixed(1)}% dos custos totais.
             </p>
          )}
        </div>
      </div>
    </div>
  )
}
