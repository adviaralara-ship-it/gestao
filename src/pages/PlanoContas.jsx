import React, { useState, useMemo, useEffect } from 'react'
import { Target, Plus, Search, Edit2, Trash2, ArrowRight, Save, PieChart, TrendingUp, Calculator, AlertTriangle, FileText, Building, Users } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { db } from '../firebase'

const DEFAULT_CONTAS = [
  { id: '1', nome: 'Receitas Ordinárias', tipo: 'Receita', participacaoOrcamento: true, isDefault: true },
  { id: '2', nome: 'Receitas Extraordinárias', tipo: 'Receita', participacaoOrcamento: false, isDefault: true },
  { id: '3', nome: 'Despesas Pessoal', tipo: 'Despesa', participacaoOrcamento: true, isDefault: true },
  { id: '4', nome: 'Despesas Consumo (Água, Luz)', tipo: 'Despesa', participacaoOrcamento: true, isDefault: true },
  { id: '5', nome: 'Despesas Manutenção', tipo: 'Despesa', participacaoOrcamento: true, isDefault: true },
  { id: '6', nome: 'Despesas Administrativas', tipo: 'Despesa', participacaoOrcamento: true, isDefault: true }
]

export default function PlanoContas() {
  const { user } = useAuth()
  const { items: customContas } = useFirestore('plano_contas')
  const { items: despesas } = useFirestore('financeiro_despesas')
  const { items: receitas } = useFirestore('financeiro_receitas')
  const { items: condominiosList } = useFirestore('condominios')
  const { items: moradoresList } = useFirestore('moradores')
  
  const [activeTab, setActiveTab] = useState('plano')
  const [anoBase, setAnoBase] = useState(new Date().getFullYear().toString())
  const [filtroCondominio, setFiltroCondominio] = useState(user?.role === 'Síndico' || user?.role === 'Morador' ? user?.condominio : 'Alpha Soluções')
  
  // Combina as contas padrão com as personalizadas
  const contas = useMemo(() => {
    return [...DEFAULT_CONTAS, ...customContas.map(c => ({...c, isDefault: false}))]
  }, [customContas])

  const [formConta, setFormConta] = useState({ nome: '', tipo: 'Despesa', participacaoOrcamento: true })
  const [isModalOpen, setIsModalOpen] = useState(false)

  // SIMULADOR STATES
  const [metaArrecadacao, setMetaArrecadacao] = useState(0)
  const [tipoRateio, setTipoRateio] = useState('Fração Ideal')
  const [isentarTerreo, setIsentarTerreo] = useState(true)
  const [custoElevador, setCustoElevador] = useState(0)
  const [fractions, setFractions] = useState({})

  const handleSalvarConta = async () => {
    if(!formConta.nome) return alert('Preencha o nome')
    try {
      await addDoc(collection(db, 'plano_contas'), {
        ...formConta,
        condominio: user?.condominio || 'Alpha',
        createdAt: new Date().toISOString()
      })
      setIsModalOpen(false)
      setFormConta({ nome: '', tipo: 'Despesa', participacaoOrcamento: true })
    } catch(e) {
      console.error(e)
      alert('Erro ao salvar conta')
    }
  }

  const handleExcluirConta = async (id, isDefault) => {
    if(isDefault) return alert('Contas padrão não podem ser excluídas')
    if(!confirm('Tem certeza?')) return
    await deleteDoc(doc(db, 'plano_contas', id))
  }

  // Lógica de Previsto x Realizado
  const balancoOrcamentario = useMemo(() => {
    const balanco = contas.filter(c => c.participacaoOrcamento).map(c => ({
      ...c, previsto: 0, realizado: 0
    }))

    const despesasFiltradas = filtroCondominio === 'Todos' 
      ? despesas : despesas.filter(d => d.condominio === filtroCondominio || (!d.condominio && filtroCondominio === 'Alpha Soluções'))
    const receitasFiltradas = filtroCondominio === 'Todos'
      ? receitas : receitas.filter(r => r.condominio === filtroCondominio || (!r.condominio && filtroCondominio === 'Alpha Soluções'))

    despesasFiltradas.forEach(d => {
      const data = new Date(d.data_vencimento || d.data_pagamento)
      if(data.getFullYear().toString() === anoBase) {
        const cat = balanco.find(b => b.tipo === 'Despesa' && (b.nome === d.categoria || d.categoria?.includes(b.nome)))
        if(cat) cat.realizado += Number(d.valor || 0)
      }
    })
    receitasFiltradas.forEach(r => {
      const data = new Date(r.data_vencimento || r.data_pagamento)
      if(data.getFullYear().toString() === anoBase) {
        const cat = balanco.find(b => b.tipo === 'Receita' && (b.nome === r.categoria || r.categoria?.includes(b.nome)))
        if(cat) cat.realizado += Number(r.valor || 0)
      }
    })
    return balanco
  }, [contas, despesas, receitas, anoBase, filtroCondominio])

  // Quando mudar o filtro ou o balanço, podemos pré-preencher a Meta do Simulador
  useEffect(() => {
    const totalDespesas = balancoOrcamentario.filter(b => b.tipo === 'Despesa').reduce((acc, curr) => acc + curr.realizado, 0)
    // Transforma anual em meta mensal sugerida (Total Despesas Anual / 12)
    setMetaArrecadacao(totalDespesas > 0 ? (totalDespesas / 12).toFixed(2) : 0)
  }, [balancoOrcamentario])

  // Lógica das Unidades (Agrupa moradores por Apartamento)
  const unidadesMapeadas = useMemo(() => {
    const moradoresDoCondominio = filtroCondominio === 'Todos' ? moradoresList : moradoresList.filter(m => m.condominio === filtroCondominio)
    const unidades = {}
    moradoresDoCondominio.forEach(m => {
        if(!m.apt) return // ignora se não tiver apto
        const key = `${m.bloco ? m.bloco + ' - ' : ''}Apt ${m.apt}`
        if (!unidades[key]) {
            // Verifica heurística básica de Térreo (ex: apto < 100, ou que comece com T)
            const isT = String(m.apt).toLowerCase().includes('térreo') || String(m.apt).toLowerCase().includes('terreo') || (!isNaN(m.apt) && parseInt(m.apt) < 100 && parseInt(m.apt) > 0)
            unidades[key] = {
                key,
                apt: m.apt,
                bloco: m.bloco || '',
                titular: m.nome,
                isTerreo: isT
            }
        }
    })
    return Object.values(unidades).sort((a,b) => a.key.localeCompare(b.key))
  }, [moradoresList, filtroCondominio])

  // Lógica do Motor de Rateio
  const rateioCalculado = useMemo(() => {
    if (unidadesMapeadas.length === 0) return []
    
    const totalUnidades = unidadesMapeadas.length
    let total = parseFloat(metaArrecadacao) || 0
    let elevador = parseFloat(custoElevador) || 0

    if (elevador > total) elevador = total
    const valorComum = total - elevador

    const unidadesNãoIsentas = unidadesMapeadas.filter(u => !isentarTerreo || !u.isTerreo)
    const totalNãoIsentas = unidadesNãoIsentas.length || 1

    return unidadesMapeadas.map(u => {
        let taxaComum = 0
        let taxaElevador = 0

        const defaultFracao = 100 / totalUnidades
        const myFraction = fractions[u.key] !== undefined ? parseFloat(fractions[u.key]) : defaultFracao

        if (tipoRateio === 'Cota Igual') {
            taxaComum = valorComum / totalUnidades
        } else {
            taxaComum = valorComum * (myFraction / 100)
        }

        if (isentarTerreo && u.isTerreo) {
            taxaElevador = 0
        } else {
            if (tipoRateio === 'Cota Igual') {
                taxaElevador = elevador / (isentarTerreo ? totalNãoIsentas : totalUnidades)
            } else {
                // Soma frações apenas das não isentas para recalibrar a fatia do elevador
                let totalFracoesAtivas = 0
                const ativos = isentarTerreo ? unidadesNãoIsentas : unidadesMapeadas
                ativos.forEach(ativa => {
                  totalFracoesAtivas += (fractions[ativa.key] !== undefined ? parseFloat(fractions[ativa.key]) : defaultFracao)
                })
                taxaElevador = elevador * (myFraction / (totalFracoesAtivas || 100))
            }
        }

        return {
            ...u,
            fracaoReal: myFraction,
            taxaComum,
            taxaElevador,
            totalMensal: taxaComum + taxaElevador
        }
    })
  }, [unidadesMapeadas, metaArrecadacao, tipoRateio, isentarTerreo, custoElevador, fractions])

  const handleFractionChange = (key, val) => {
    setFractions(prev => ({...prev, [key]: val}))
  }

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col h-full animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-700 flex items-center gap-2">
            <Target className="text-brand-600" />
            Previsão Orçamentária & Plano de Contas
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Modele o orçamento anual, defina o plano de contas e simule rateios automáticos
          </p>
        </div>
        
        <div className="flex flex-col items-end gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-cream-200 shadow-sm">
            <Building size={16} className="text-brand-500" />
            <select 
              className="bg-transparent border-none text-sm font-bold text-gray-700 focus:ring-0 cursor-pointer outline-none"
              value={filtroCondominio}
              onChange={e => setFiltroCondominio(e.target.value)}
            >
              <option value="Todos">Visão Global (Todos)</option>
              <option value="Alpha Soluções">Matriz: Alpha Soluções</option>
              {condominiosList.map(c => (
                <option key={c.id} value={c.nome}>{c.nome}</option>
              ))}
            </select>
          </div>

          <div className="flex bg-white rounded-lg p-1 shadow-sm border border-cream-200">
            <button onClick={() => setActiveTab('plano')} className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${activeTab==='plano'?'bg-brand-50 text-brand-700':'text-gray-500 hover:text-gray-700'}`}>Plano de Contas</button>
            <button onClick={() => setActiveTab('previsto')} className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${activeTab==='previsto'?'bg-brand-50 text-brand-700':'text-gray-500 hover:text-gray-700'}`}>Previsto x Realizado</button>
            <button onClick={() => setActiveTab('simulador')} className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${activeTab==='simulador'?'bg-brand-50 text-brand-700':'text-gray-500 hover:text-gray-700'}`}>Simulador de Rateio</button>
          </div>
        </div>
      </div>

      {activeTab === 'plano' && (
        <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-6">
          {/* ...mesmo código do plano... */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-gray-800">Modelo Contábil</h2>
            <button onClick={() => setIsModalOpen(true)} className="btn-primary">
              <Plus size={16} /> Nova Conta
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {['Receita', 'Despesa'].map(tipo => (
              <div key={tipo}>
                <h3 className={`font-bold mb-4 flex items-center gap-2 ${tipo === 'Receita' ? 'text-green-600' : 'text-red-600'}`}>
                  {tipo === 'Receita' ? <TrendingUp size={18}/> : <PieChart size={18}/>}
                  Grupo de {tipo}s
                </h3>
                <div className="flex flex-col gap-3">
                  {contas.filter(c => c.tipo === tipo).map(conta => (
                    <div key={conta.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-cream-100">
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">{conta.nome}</p>
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          {conta.participacaoOrcamento ? <span className="text-blue-600 font-medium">● Participa da Previsão</span> : <span className="text-gray-400">○ Não participa da Previsão</span>}
                          {conta.isDefault && <span className="ml-2 bg-gray-200 text-gray-600 px-2 py-0.5 rounded text-[10px]">Padrão</span>}
                        </p>
                      </div>
                      {!conta.isDefault && (
                        <button onClick={() => handleExcluirConta(conta.id, conta.isDefault)} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'previsto' && (
        <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-6">
          {/* ...mesmo código do balanço... */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <FileText size={20} className="text-gray-400"/>
              Balanço Anual: {anoBase}
            </h2>
            <select className="input w-32" value={anoBase} onChange={e => setAnoBase(e.target.value)}>
              {[2023, 2024, 2025, 2026, 2027].map(a => <option key={a}>{a}</option>)}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-cream-200 bg-gray-50">
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase">Conta / Categoria</th>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase">Tipo</th>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase text-right">Realizado (R$)</th>
                </tr>
              </thead>
              <tbody>
                {balancoOrcamentario.length === 0 ? (
                  <tr><td colSpan="3" className="p-8 text-center text-gray-400">Nenhum dado encontrado para o período.</td></tr>
                ) : (
                  balancoOrcamentario.map((b, i) => (
                    <tr key={i} className="border-b border-cream-100 hover:bg-gray-50/50">
                      <td className="p-4 font-medium text-gray-700">{b.nome}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${b.tipo==='Receita'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{b.tipo}</span>
                      </td>
                      <td className="p-4 text-right font-semibold text-gray-800">
                        R$ {b.realizado.toLocaleString('pt-BR', {minimumFractionDigits:2})}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'simulador' && (
        <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-6">
          <div className="flex flex-col mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-2 flex items-center gap-2">
              <Calculator size={24} className="text-blue-600"/>
              Motor de Rateio e Fração Ideal
            </h2>
            <p className="text-gray-500 text-sm">Simule as cotas condominiais configurando o regime de rateio e as isenções. A meta mensal sugerida baseia-se na média do Balanço do ano selecionado.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 bg-blue-50/50 p-6 rounded-xl border border-blue-100">
            <div>
              <label className="label text-blue-900">Meta Mensal a Ratear (R$)</label>
              <input type="number" className="input bg-white" value={metaArrecadacao} onChange={e => setMetaArrecadacao(e.target.value)} />
            </div>
            <div>
              <label className="label text-blue-900">Tipo de Rateio</label>
              <select className="input bg-white" value={tipoRateio} onChange={e => setTipoRateio(e.target.value)}>
                <option value="Fração Ideal">Fração Ideal</option>
                <option value="Cota Igual">Cota Igualitária</option>
              </select>
            </div>
            <div>
              <label className="label text-blue-900">Custo Elevador / Manutenção (R$)</label>
              <input type="number" className="input bg-white" value={custoElevador} onChange={e => setCustoElevador(e.target.value)} />
            </div>
            <div className="flex items-center pt-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-gray-700">
                <input type="checkbox" className="w-5 h-5 text-blue-600 rounded" checked={isentarTerreo} onChange={e => setIsentarTerreo(e.target.checked)} />
                Isentar aptos Térreo do Elevador
              </label>
            </div>
          </div>

          {unidadesMapeadas.length === 0 ? (
            <div className="text-center p-12 bg-gray-50 rounded-xl border border-cream-100">
              <Users size={32} className="mx-auto text-gray-300 mb-2"/>
              <p className="text-gray-500 font-medium">Nenhuma unidade/morador cadastrado neste condomínio.</p>
              <p className="text-xs text-gray-400 mt-1">O motor agrupa automaticamente as unidades com base no cadastro de Moradores.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-cream-200 rounded-xl shadow-sm">
              <table className="w-full text-left border-collapse bg-white">
                <thead>
                  <tr className="bg-gray-100 border-b border-cream-200">
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase">Unidade</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase">Morador Principal</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase text-center">Fração Ideal (%)</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase text-right">Tx Comum</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase text-right">Tx Elevador</th>
                    <th className="p-4 text-xs font-bold text-brand-700 uppercase text-right">Cota Mensal</th>
                  </tr>
                </thead>
                <tbody>
                  {rateioCalculado.map((u, i) => (
                    <tr key={u.key} className="border-b border-cream-100 hover:bg-blue-50/30 transition-colors">
                      <td className="p-4 font-bold text-gray-800">
                        {u.key} 
                        {u.isTerreo && <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded uppercase">Térreo</span>}
                      </td>
                      <td className="p-4 text-sm text-gray-600">{u.titular}</td>
                      <td className="p-4 text-center">
                        {tipoRateio === 'Cota Igual' ? (
                          <span className="text-gray-400 text-xs">N/A</span>
                        ) : (
                          <div className="flex justify-center items-center gap-1">
                            <input 
                              type="number" 
                              step="0.01" 
                              className="w-20 p-1 text-center border border-cream-200 rounded text-sm bg-gray-50 focus:bg-white"
                              value={u.fracaoReal.toFixed(2)}
                              onChange={e => handleFractionChange(u.key, e.target.value)}
                            />
                            <span className="text-xs text-gray-400">%</span>
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-right text-sm text-gray-500">
                        R$ {u.taxaComum.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}
                      </td>
                      <td className="p-4 text-right text-sm text-gray-500">
                        R$ {u.taxaElevador.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}
                      </td>
                      <td className="p-4 text-right font-bold text-brand-700 text-base">
                        R$ {u.totalMensal.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-bold border-t-2 border-cream-200">
                    <td className="p-4 text-right" colSpan="3">Total Simulação:</td>
                    <td className="p-4 text-right text-gray-600">
                      R$ {rateioCalculado.reduce((a,b)=>a+b.taxaComum,0).toLocaleString('pt-BR', {minimumFractionDigits:2})}
                    </td>
                    <td className="p-4 text-right text-gray-600">
                      R$ {rateioCalculado.reduce((a,b)=>a+b.taxaElevador,0).toLocaleString('pt-BR', {minimumFractionDigits:2})}
                    </td>
                    <td className="p-4 text-right text-brand-800 text-lg">
                      R$ {rateioCalculado.reduce((a,b)=>a+b.totalMensal,0).toLocaleString('pt-BR', {minimumFractionDigits:2})}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            {/* Modal de Nova Conta */}
            <div className="p-6 border-b border-cream-300">
              <h3 className="font-bold text-gray-800">Nova Conta Contábil</h3>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div>
                <label className="label">Nome da Conta</label>
                <input className="input" value={formConta.nome} onChange={e => setFormConta({...formConta, nome: e.target.value})} placeholder="Ex: Fundo de Reserva, Manutenção..."/>
              </div>
              <div>
                <label className="label">Tipo</label>
                <select className="input" value={formConta.tipo} onChange={e => setFormConta({...formConta, tipo: e.target.value})}>
                  <option value="Despesa">Despesa</option>
                  <option value="Receita">Receita</option>
                </select>
              </div>
              <label className="flex items-center gap-3 p-3 border border-cream-200 rounded-lg cursor-pointer hover:bg-gray-50 mt-2">
                <input type="checkbox" checked={formConta.participacaoOrcamento} onChange={e => setFormConta({...formConta, participacaoOrcamento: e.target.checked})} className="w-5 h-5 text-brand-600 rounded"/>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-gray-700">Participa da Previsão Orçamentária</span>
                  <span className="text-xs text-gray-500">Valores desta conta impactam a taxa condominial.</span>
                </div>
              </label>
            </div>
            <div className="p-6 border-t border-cream-300 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSalvarConta} className="btn-primary"><Save size={16}/> Salvar Conta</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
