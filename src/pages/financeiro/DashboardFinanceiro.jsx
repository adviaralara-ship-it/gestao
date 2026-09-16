import React, { useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Wallet, TrendingUp, TrendingDown, DollarSign, Activity, AlertTriangle, ShieldCheck } from 'lucide-react'
import MonthRangeFilter from '../../components/MonthRangeFilter'

export default function DashboardFinanceiro({ lancamentos = [], contas = [] }) {
  const hoje = new Date()
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}`
  const [mesDe, setMesDe] = useState(mesAtual)
  const [mesAte, setMesAte] = useState(mesAtual)

  const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  // 1. Saldo em Caixa Total Acumulado (Entradas reais liquidadas menos saídas pagas de todo o histórico da entidade)
  const totalRecebidoHistorico = lancamentos
    .filter(t => t.tipo === 'Receita' && (t.status === 'Recebido' || t.status === 'Pago'))
    .reduce((acc, c) => acc + Number(c.valor || 0), 0)

  const totalPagoHistorico = lancamentos
    .filter(t => t.tipo === 'Despesa' && (t.status === 'Pago' || t.status === 'Liquidado' || t.pago))
    .reduce((acc, c) => acc + Number(c.valor || 0), 0)

  // Saldo real em caixa: diferença de entradas e saídas liquidadas (se houver contas cadastradas, somam-se)
  const saldoContasBancarias = contas.reduce((acc, c) => acc + Number(c.saldo || 0), 0)
  const saldoCaixa = (totalRecebidoHistorico - totalPagoHistorico) + saldoContasBancarias

  // 2. Filtragem estrita dos lançamentos pelo período selecionado (Mês Selecionado)
  const lancamentosPeriodo = lancamentos.filter(t => {
    if (!t.data) return false
    const mes = t.data.substring(0, 7)
    if (mesDe && mesAte) return mes >= mesDe && mes <= mesAte
    if (mesDe) return mes >= mesDe
    if (mesAte) return mes <= mesAte
    return true
  })

  // 3. Contas a Pagar e a Receber estritamente do mês/período selecionado
  const pagarPendenteMes = lancamentosPeriodo
    .filter(t => t.tipo === 'Despesa' && (t.status === 'Pendente' || t.status === 'Aguardando Aprovação'))
    .reduce((acc, c) => acc + Number(c.valor || 0), 0)

  const receberPendenteMes = lancamentosPeriodo
    .filter(t => t.tipo === 'Receita' && (t.status === 'Pendente' || t.status === 'Vencido'))
    .reduce((acc, c) => acc + Number(c.valor || 0), 0)

  const despesasPagasMes = lancamentosPeriodo
    .filter(t => t.tipo === 'Despesa' && (t.status === 'Pago' || t.status === 'Liquidado' || t.pago))
    .reduce((acc, c) => acc + Number(c.valor || 0), 0)

  const receitasRecebidasMes = lancamentosPeriodo
    .filter(t => t.tipo === 'Receita' && (t.status === 'Recebido' || t.status === 'Pago'))
    .reduce((acc, c) => acc + Number(c.valor || 0), 0)

  // Saldo Real do Mês (Entradas liquidadas - Despesas pagas no mês)
  const saldoLiquidoMes = receitasRecebidasMes - despesasPagasMes

  // 4. Capital de Giro Operacional do Mês = Recursos Disponíveis / Saúde do Mês:
  // Saldo em Caixa Acumulado + A Receber do Mês - A Pagar do Mês
  const capitalDeGiro = saldoCaixa + receberPendenteMes - pagarPendenteMes

  const lucroMes = receitasRecebidasMes - despesasPagasMes

  // Margem de Lucro = (Lucro Líquido / Receitas) * 100
  const margemLucro = receitasRecebidasMes > 0 ? (lucroMes / receitasRecebidasMes) * 100 : 0
  const margemContribuicao = receitasRecebidasMes > 0 ? ((receitasRecebidasMes - despesasPagasMes) / receitasRecebidasMes) * 100 : 0

  // Gráfico de Despesas (Pie)
  const despesasPorCategoria = lancamentosPeriodo.filter(t => t.tipo === 'Despesa').reduce((acc, t) => {
    acc[t.categoria || 'Outros'] = (acc[t.categoria || 'Outros'] || 0) + Number(t.valor || 0)
    return acc
  }, {})
  const chartDataDespesas = Object.entries(despesasPorCategoria).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value)
  const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e']

  // Gráfico de Inadimplência / Arrecadação
  const inadimplenciaData = [
    { name: 'Recebimentos', Recebido: receitasRecebidasMes, Pendente: receberPendenteMes }
  ]

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <MonthRangeFilter mesDe={mesDe} setMesDe={setMesDe} mesAte={mesAte} setMesAte={setMesAte} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Saldo em Caixa */}
        <div className="card border-l-4 border-l-blue-500">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><Wallet size={18} /></div>
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Saldo em Caixa</p>
          </div>
          <p className="text-3xl font-black text-gray-800">R$ {fmt(saldoCaixa)}</p>
          <p className="text-xs text-gray-400 mt-1">Total acumulado em caixa</p>
        </div>

        {/* Capital de Giro */}
        <div className={`card border-l-4 ${capitalDeGiro >= 0 ? 'border-l-emerald-500' : 'border-l-red-500'}`}>
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 rounded-lg ${capitalDeGiro >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
              <Activity size={18} />
            </div>
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Capital de Giro</p>
          </div>
          <p className={`text-3xl font-black ${capitalDeGiro >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>R$ {fmt(capitalDeGiro)}</p>
          <p className="text-xs text-gray-400 mt-1">Saúde e cobertura do mês</p>
        </div>

        {/* A Receber do Mês */}
        <div className="card border-l-4 border-l-orange-500">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-orange-100 rounded-lg text-orange-600"><AlertTriangle size={18} /></div>
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">A Receber (Mês)</p>
          </div>
          <p className="text-3xl font-black text-orange-500">R$ {fmt(receberPendenteMes)}</p>
          <p className="text-xs text-gray-400 mt-1">Receitas pendentes no período</p>
        </div>

        {/* Contas a Pagar do Mês */}
        <div className="card border-l-4 border-l-red-500">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-red-100 rounded-lg text-red-600"><TrendingDown size={18} /></div>
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">A Pagar (Mês)</p>
          </div>
          <p className="text-3xl font-black text-red-500">R$ {fmt(pagarPendenteMes)}</p>
          <p className="text-xs text-gray-400 mt-1">Compromissos pendentes no período</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><TrendingUp size={18} className="text-emerald-500"/> Margens Operacionais do Mês</h3>
          <div className="flex gap-6">
            <div className="flex-1 bg-cream-50 p-4 rounded-xl border border-cream-200 text-center">
              <p className="text-sm text-gray-500 font-medium mb-1">Margem de Lucro</p>
              <p className={`text-3xl font-black ${margemLucro >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{margemLucro.toFixed(1)}%</p>
            </div>
            <div className="flex-1 bg-cream-50 p-4 rounded-xl border border-cream-200 text-center">
              <p className="text-sm text-gray-500 font-medium mb-1">M. de Contribuição</p>
              <p className={`text-3xl font-black ${margemContribuicao >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{margemContribuicao.toFixed(1)}%</p>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="font-bold text-gray-800 mb-4">Inadimplência do Mês (Realizado vs Pendente)</h3>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={inadimplenciaData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" hide />
                <RechartsTooltip formatter={(value) => `R$ ${fmt(value)}`} />
                <Legend />
                <Bar dataKey="Recebido" fill="#10b981" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Pendente" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">Distribuição de Despesas do Mês</h3>
        {chartDataDespesas.length > 0 ? (
          <div className="h-64 flex justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartDataDespesas} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {chartDataDespesas.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <RechartsTooltip formatter={(value) => `R$ ${fmt(value)}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-gray-400 text-sm text-center py-10">Nenhuma despesa registrada no mês.</p>
        )}
      </div>

    </div>
  )
}
