import React, { useState, useMemo } from 'react'
import { Radar, AlertTriangle, ShieldCheck, Activity, Users, MapPin, TrendingDown } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts'

export default function RadarConviver() {
  const { user } = useAuth()
  const { items: ocorrencias } = useFirestore('ocorrencias')
  const [condominioFiltro, setCondominioFiltro] = useState(user?.condominio || '')

  const condominios = useMemo(() => {
    return [...new Set(ocorrencias.map(o => o.condominio).filter(Boolean))]
  }, [ocorrencias])

  // Processamento dos dados
  const stats = useMemo(() => {
    const list = ocorrencias.filter(o => 
      (!condominioFiltro || o.condominio === condominioFiltro) &&
      ['Perturbação', 'Conduta', 'Outros', 'Barulho', 'Animais', 'Garagem'].includes(o.categoria)
    )

    const total = list.length
    const encerradas = list.filter(o => o.stepConviver === 'Encerrar' || o.status === 'Resolvida').length
    
    // Contagem por Categoria
    const categoriasCount = {}
    list.forEach(o => {
      categoriasCount[o.categoria] = (categoriasCount[o.categoria] || 0) + 1
    })

    const chartData = Object.keys(categoriasCount).map(k => ({
      name: k,
      value: categoriasCount[k]
    })).sort((a, b) => b.value - a.value)

    // Identificar Recorrência (Mesmo Apartamento repetindo Categoria)
    const aptos = {}
    list.forEach(o => {
      if(!o.apt) return
      const k = `${o.apt}-${o.categoria}`
      aptos[k] = (aptos[k] || 0) + 1
    })

    const recorrentes = Object.keys(aptos)
      .map(k => ({ apt: k.split('-')[0], cat: k.split('-')[1], count: aptos[k] }))
      .filter(a => a.count > 1)
      .sort((a,b) => b.count - a.count)

    // Calculo básico do Índice Geral
    let indiceGeral = 'Bom'
    if (total > 0 && (total - encerradas) / total > 0.5) indiceGeral = 'Atenção'
    if (recorrentes.length > 5) indiceGeral = 'Crítico'

    return { total, encerradas, acompanhamento: total - encerradas, chartData, recorrentes, indiceGeral }
  }, [ocorrencias, condominioFiltro])

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ffc658']

  return (
    <div className="p-6 max-w-6xl mx-auto flex flex-col gap-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Radar className="text-brand-600" /> Radar de Convivência
          </h1>
          <p className="text-gray-500 text-sm mt-1">Relatório de Saúde da Convivência</p>
        </div>

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
      </div>

      {!condominioFiltro ? (
        <div className="card p-12 text-center text-gray-500 flex flex-col items-center">
          <Activity size={48} className="mb-4 text-gray-300"/>
          Selecione um condomínio no filtro acima para visualizar o relatório de saúde.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card Resumo */}
          <div className="card p-6 md:col-span-3 flex justify-between items-center bg-brand-50 border-brand-200">
            <div>
              <div className="text-sm text-gray-600 font-bold uppercase tracking-wider">Índice Geral de Convivência</div>
              <div className={`text-4xl font-black flex items-center gap-2 mt-1 ${
                stats.indiceGeral === 'Bom' ? 'text-green-600' : stats.indiceGeral === 'Atenção' ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {stats.indiceGeral === 'Bom' && '🟢 BOM'}
                {stats.indiceGeral === 'Atenção' && '🟡 ATENÇÃO'}
                {stats.indiceGeral === 'Crítico' && '🔴 CRÍTICO'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">Total de Ocorrências</div>
              <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
            </div>
          </div>

          {/* Cards Menores */}
          <div className="card p-6 border-l-4 border-l-green-500">
            <div className="text-gray-500 text-sm font-bold">Casos Resolvidos</div>
            <div className="text-3xl font-black text-gray-800 mt-2">{stats.encerradas}</div>
          </div>
          <div className="card p-6 border-l-4 border-l-yellow-500">
            <div className="text-gray-500 text-sm font-bold">Em Acompanhamento / Mediação</div>
            <div className="text-3xl font-black text-gray-800 mt-2">{stats.acompanhamento}</div>
          </div>
          <div className="card p-6 border-l-4 border-l-red-500">
            <div className="text-gray-500 text-sm font-bold">Conflitos Recorrentes</div>
            <div className="text-3xl font-black text-gray-800 mt-2">{stats.recorrentes.length}</div>
          </div>

          {/* Gráfico de Causas */}
          <div className="card p-6 md:col-span-2">
            <h3 className="font-bold text-gray-800 mb-4">Principais Causas</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.chartData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Lista de Recorrentes */}
          <div className="card p-6 bg-red-50 border-red-100">
            <h3 className="font-bold text-red-800 mb-4 flex items-center gap-2">
              <AlertTriangle size={18}/> Alerta de Recorrência
            </h3>
            {stats.recorrentes.length === 0 ? (
              <p className="text-sm text-gray-600">Nenhum conflito recorrente detectado.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {stats.recorrentes.map((r, i) => (
                  <li key={i} className="flex justify-between items-center bg-white p-3 rounded shadow-sm">
                    <div>
                      <div className="font-bold text-gray-800">Apt {r.apt}</div>
                      <div className="text-xs text-gray-500">{r.cat}</div>
                    </div>
                    <span className="badge-red">{r.count} ocorrências</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>
      )}
    </div>
  )
}
