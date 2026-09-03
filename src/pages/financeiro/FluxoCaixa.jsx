import React, { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts'

export default function FluxoCaixa({ lancamentos = [], contas = [] }) {
  const [visao, setVisao] = useState('Mensal')
  
  const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  // O Saldo Inicial projetado pode ser o saldo atual das contas
  const listaContas = Array.isArray(contas) ? contas : []
  const listaLancamentos = Array.isArray(lancamentos) ? lancamentos : []

  const saldoCaixaAtual = listaContas.reduce((acc, c) => acc + Number(c.saldo || 0), 0)

  // Gerar dados agrupados por mês para os últimos 3 meses e próximos 3 meses
  const mesesMap = {}
  
  listaLancamentos.forEach(t => {
    if (!t.data) return
    const mes = t.data.substring(0, 7) // Pega YYYY-MM
    if (!mesesMap[mes]) {
      mesesMap[mes] = { name: mes, Entrada: 0, Saida: 0, Projetado: 0 }
    }
    
    if (t.tipo === 'Receita') {
      if (t.status === 'Recebido') mesesMap[mes].Entrada += Number(t.valor || 0)
      if (t.status === 'Pendente') mesesMap[mes].Projetado += Number(t.valor || 0)
    }
    if (t.tipo === 'Despesa') {
      if (t.status === 'Pago') mesesMap[mes].Saida += Number(t.valor || 0)
      if (t.status === 'Pendente') mesesMap[mes].Projetado -= Number(t.valor || 0)
    }
  })

  // Transforma em array e ordena
  let dadosFluxo = Object.values(mesesMap).sort((a, b) => a.name.localeCompare(b.name))

  // Calcula o Saldo Projetado Acumulado para o gráfico
  let saldoAcumulado = saldoCaixaAtual
  dadosFluxo = dadosFluxo.map(d => {
    const variacao = (d.Entrada + Math.max(0, d.Projetado)) - (d.Saida + Math.abs(Math.min(0, d.Projetado)))
    saldoAcumulado += variacao
    return { ...d, SaldoAcumulado: saldoAcumulado }
  })

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-pale-300 shadow-sm">
        <div>
          <h3 className="text-xl font-bold text-gray-800">Fluxo de Caixa Gerencial</h3>
          <p className="text-xs sm:text-sm text-gray-500">Acompanhamento e projeção de saldos em tempo real</p>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-pale-300 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-bold text-gray-800 text-base">Projeção Mensal de Caixa</h4>
        </div>
        {dadosFluxo.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            Nenhum dado financeiro para projetar o fluxo de caixa no momento.
          </div>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dadosFluxo}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(val) => `R$ ${val/1000}k`} />
                <RechartsTooltip formatter={(value) => `R$ ${fmt(value)}`} labelStyle={{color: '#1e293b', fontWeight: 'bold'}} />
                <Legend />
                <Line type="monotone" dataKey="Entrada" stroke="#10b981" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
                <Line type="monotone" dataKey="Saida" name="Saída" stroke="#ef4444" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} />
                <Line type="monotone" dataKey="SaldoAcumulado" name="Saldo Acumulado" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {dadosFluxo.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {dadosFluxo.slice(-3).reverse().map((mes, i) => (
            <div key={i} className="bg-white p-4 rounded-2xl border border-pale-300 shadow-sm">
              <h5 className="font-bold text-gray-800 mb-2">{mes.name}</h5>
              <div className="flex justify-between text-xs sm:text-sm mb-1">
                <span className="text-gray-500">Entradas</span>
                <span className="font-semibold text-emerald-600">R$ {fmt(mes.Entrada)}</span>
              </div>
              <div className="flex justify-between text-xs sm:text-sm mb-1">
                <span className="text-gray-500">Saídas</span>
                <span className="font-semibold text-red-500">R$ {fmt(mes.Saida)}</span>
              </div>
              <div className="flex justify-between text-xs sm:text-sm pt-2 border-t border-gray-100 mt-2">
                <span className="text-gray-600 font-bold">Projetado (Pendente)</span>
                <span className={`font-black ${mes.Projetado >= 0 ? 'text-emerald-600' : 'text-orange-500'}`}>R$ {fmt(mes.Projetado)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
