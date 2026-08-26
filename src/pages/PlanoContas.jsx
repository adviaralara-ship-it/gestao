import React, { useState, useMemo } from 'react'
import { Target, Plus, Search, Edit2, Trash2, ArrowRight, Save, PieChart, TrendingUp, Calculator, AlertTriangle, FileText } from 'lucide-react'
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
  
  const [activeTab, setActiveTab] = useState('plano')
  const [anoBase, setAnoBase] = useState(new Date().getFullYear().toString())
  
  // Combina as contas padrão com as personalizadas
  const contas = useMemo(() => {
    return [...DEFAULT_CONTAS, ...customContas.map(c => ({...c, isDefault: false}))]
  }, [customContas])

  const [formConta, setFormConta] = useState({ nome: '', tipo: 'Despesa', participacaoOrcamento: true })
  const [isModalOpen, setIsModalOpen] = useState(false)

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
    // Inicializa o balanço baseado no plano de contas que participam do orçamento
    const balanco = contas.filter(c => c.participacaoOrcamento).map(c => ({
      ...c,
      previsto: 0, // Poderíamos ter um cadastro de meta anual por conta futuramente
      realizado: 0
    }))

    // Soma o realizado
    despesas.forEach(d => {
      const data = new Date(d.data_vencimento || d.data_pagamento)
      if(data.getFullYear().toString() === anoBase) {
        // Tenta achar a categoria, fallback pra Outros
        const cat = balanco.find(b => b.tipo === 'Despesa' && (b.nome === d.categoria || d.categoria?.includes(b.nome)))
        if(cat) cat.realizado += Number(d.valor || 0)
      }
    })

    receitas.forEach(r => {
      const data = new Date(r.data_vencimento || r.data_pagamento)
      if(data.getFullYear().toString() === anoBase) {
        const cat = balanco.find(b => b.tipo === 'Receita' && (b.nome === r.categoria || r.categoria?.includes(b.nome)))
        if(cat) cat.realizado += Number(r.valor || 0)
      }
    })

    return balanco
  }, [contas, despesas, receitas, anoBase])

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
        <div className="flex bg-white rounded-lg p-1 shadow-sm border border-cream-200">
          <button onClick={() => setActiveTab('plano')} className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${activeTab==='plano'?'bg-brand-50 text-brand-700':'text-gray-500 hover:text-gray-700'}`}>Plano de Contas</button>
          <button onClick={() => setActiveTab('previsto')} className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${activeTab==='previsto'?'bg-brand-50 text-brand-700':'text-gray-500 hover:text-gray-700'}`}>Previsto x Realizado</button>
          <button onClick={() => setActiveTab('simulador')} className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${activeTab==='simulador'?'bg-brand-50 text-brand-700':'text-gray-500 hover:text-gray-700'}`}>Simulador de Rateio</button>
        </div>
      </div>

      {activeTab === 'plano' && (
        <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-6">
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
        <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-6 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
            <Calculator size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Simulador de Rateio & Fração Ideal</h2>
          <p className="text-gray-500 max-w-lg mb-6">
            O fechamento do orçamento anual impactará diretamente no valor a ser arrecadado no próximo ano. Aqui você poderá simular as cotas condominiais baseadas no Previsto x Realizado, considerando Rateio de Elevador e fundos específicos.
          </p>
          <div className="bg-amber-50 text-amber-700 border border-amber-200 p-4 rounded-xl flex items-start gap-3 text-left max-w-lg">
            <AlertTriangle className="shrink-0 mt-0.5" size={18} />
            <p className="text-sm">
              <strong>Módulo em construção:</strong> Esta simulação inteligente baseada em frações ideais estará disponível na próxima atualização do sistema Alpha.
            </p>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-cream-300">
              <h3 className="font-bold text-gray-800">Nova Conta Contábil</h3>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div>
                <label className="label">Nome da Conta</label>
                <input className="input" value={formConta.nome} onChange={e => setFormConta({...formConta, nome: e.target.value})} placeholder="Ex: Fundo de Reserva, Manutenção de Elevadores..."/>
              </div>
              <div>
                <label className="label">Tipo</label>
                <select className="input" value={formConta.tipo} onChange={e => setFormConta({...formConta, tipo: e.target.value})}>
                  <option value="Despesa">Despesa</option>
                  <option value="Receita">Receita</option>
                </select>
              </div>
              <label className="flex items-center gap-3 p-3 border border-cream-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors mt-2">
                <input type="checkbox" checked={formConta.participacaoOrcamento} onChange={e => setFormConta({...formConta, participacaoOrcamento: e.target.checked})} className="w-5 h-5 text-brand-600 rounded focus:ring-brand-500"/>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-gray-700">Participa da Previsão Orçamentária</span>
                  <span className="text-xs text-gray-500">Valores desta conta serão contabilizados no balanço e impactam a taxa condominial.</span>
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
