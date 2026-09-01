import React, { useState, useEffect } from 'react'
import { Shield, Target, AlertTriangle, Save, Calculator, DollarSign, Wallet, ArrowRight } from 'lucide-react'
import { useFirestore } from '../../hooks/useFirestore'
import { CurrencyInput } from '../../utils/currency'

export default function ReservaEmergencia({ lancamentos }) {
  const { items: configs, updateItem, addItem } = useFirestore('financeiro_config')
  const [saldoReal, setSaldoReal] = useState(0)
  const [editando, setEditando] = useState(false)
  const [inputSaldo, setInputSaldo] = useState('')
  const [mostrarDivisao, setMostrarDivisao] = useState(false)

  const configDoc = configs.find(c => c.id === 'caixa_alpha')

  useEffect(() => {
    if (configDoc && configDoc.saldo_real !== undefined) {
      setSaldoReal(Number(configDoc.saldo_real))
    }
  }, [configDoc])

  const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  // Pegar receitas e despesas da Alpha
  const alphaLancs = lancamentos.filter(l => l.condominio === 'Alpha Soluções (Uso Interno)')
  const totalReceitas = alphaLancs.filter(l => l.tipo === 'Receita').reduce((a, b) => a + Number(b.valor || 0), 0)
  const totalDespesas = alphaLancs.filter(l => l.tipo === 'Despesa').reduce((a, b) => a + Number(b.valor || 0), 0)
  const lucroMensal = totalReceitas - totalDespesas

  // Divisão por 4
  const cotaParte = lucroMensal > 0 ? lucroMensal / 4 : 0

  const salvarSaldo = async () => {
    const val = typeof inputSaldo === 'number' ? inputSaldo : (Number(String(inputSaldo).replace(/\./g, '').replace(',', '.')) || 0)
    if (val >= 0) {
      if (configDoc) {
        await updateItem('caixa_alpha', { saldo_real: val })
      } else {
        await addItem({ id: 'caixa_alpha', saldo_real: val })
      }
      setSaldoReal(val)
      setEditando(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Wallet size={24} className="text-brand-600"/> Caixa Corporativo (Alpha)</h3>
          <p className="text-sm text-gray-500">Gestão do patrimônio da empresa e distribuição de lucros</p>
        </div>
        {!editando && (
          <button onClick={() => { setInputSaldo(saldoReal); setEditando(true) }} className="btn-secondary text-sm">Atualizar Saldo Real</button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Saldo Real Editável */}
        <div className="card text-center py-8 col-span-1 md:col-span-3 bg-gradient-to-br from-brand-600 to-brand-800 text-white border-0 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10"><Shield size={120} /></div>
          <h4 className="text-brand-100 uppercase tracking-widest text-xs font-bold mb-4 relative z-10">Saldo Real na Conta da Alpha</h4>
          {editando ? (
            <div className="flex justify-center items-center gap-2 max-w-sm mx-auto relative z-10">
              <CurrencyInput className="text-center text-xl font-bold text-gray-800" value={inputSaldo} onChange={v => setInputSaldo(v)} autoFocus />
              <button onClick={salvarSaldo} className="btn-primary bg-white text-brand-700 hover:bg-cream-100 flex items-center gap-2"><Save size={16}/> Salvar</button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3 text-5xl font-black text-white relative z-10">
              R$ {fmt(saldoReal)}
            </div>
          )}
          <p className="text-sm text-brand-200 mt-4 relative z-10">Este é o patrimônio acumulado da empresa.</p>
        </div>

        {/* Resumo Operacional */}
        <div className="card border-l-4 border-emerald-500">
          <p className="text-sm text-gray-500 font-semibold mb-1">Receitas da Alpha</p>
          <p className="text-2xl font-black text-emerald-600">R$ {fmt(totalReceitas)}</p>
          <p className="text-xs text-gray-400 mt-2">Honorários e entradas lançadas</p>
        </div>
        
        <div className="card border-l-4 border-red-500">
          <p className="text-sm text-gray-500 font-semibold mb-1">Despesas da Alpha</p>
          <p className="text-2xl font-black text-red-500">R$ {fmt(totalDespesas)}</p>
          <p className="text-xs text-gray-400 mt-2">Custos operacionais e impostos</p>
        </div>

        <div className="card border-l-4 border-brand-500 bg-brand-50">
          <p className="text-sm text-brand-700 font-semibold mb-1">Lucro Líquido</p>
          <p className="text-2xl font-black text-brand-600">R$ {fmt(lucroMensal)}</p>
          <p className="text-xs text-brand-500 mt-2">Disponível para divisão</p>
        </div>
      </div>

      <div className="card">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h4 className="font-bold text-gray-800 flex items-center gap-2"><Calculator size={18} className="text-purple-600"/> Distribuição de Lucros</h4>
            <p className="text-sm text-gray-500 mt-1">Simule a divisão do Lucro Líquido em 4 partes (Sócias + Fundo Alpha).</p>
          </div>
          <button onClick={() => setMostrarDivisao(!mostrarDivisao)} className="btn-primary bg-purple-600 hover:bg-purple-700 shadow-purple-500/30">
            {mostrarDivisao ? 'Ocultar Simulação' : 'Simular Divisão'}
          </button>
        </div>

        {mostrarDivisao && (
          <div className="animate-fade-in">
            {lucroMensal <= 0 ? (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl text-center text-sm font-semibold flex items-center justify-center gap-2">
                <AlertTriangle size={18} /> Não há lucro líquido para distribuir neste momento.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { nome: 'Sócia 1', icon: '👩🏻‍💼', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
                  { nome: 'Sócia 2', icon: '👩🏼‍💼', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
                  { nome: 'Sócia 3', icon: '👩🏽‍💼', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
                  { nome: 'Fundo Alpha (Caixa)', icon: '🏢', color: 'text-brand-700', bg: 'bg-brand-50', border: 'border-brand-200' },
                ].map((s, i) => (
                  <div key={i} className={`border ${s.border} ${s.bg} rounded-xl p-4 text-center relative overflow-hidden group`}>
                    <div className="text-3xl mb-2">{s.icon}</div>
                    <p className={`text-sm font-bold ${s.color} mb-1`}>{s.nome}</p>
                    <p className={`text-xl font-black ${s.color}`}>R$ {fmt(cotaParte)}</p>
                    <div className="text-[10px] uppercase font-bold text-gray-400 mt-3 tracking-widest">25% da cota</div>
                    
                    {s.nome === 'Fundo Alpha (Caixa)' && (
                      <div className="absolute inset-0 bg-brand-600 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity p-4 cursor-pointer" onClick={() => {
                        setInputSaldo(saldoReal + cotaParte)
                        setEditando(true)
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}>
                        <ArrowRight size={24} className="mb-2" />
                        <span className="text-xs font-bold text-center">Adicionar ao Saldo Real</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {lucroMensal > 0 && (
              <p className="text-xs text-gray-400 text-center mt-6">
                * A simulação é apenas visual. Para efetivar, você deve realizar as transferências bancárias e lançar os pagamentos no Histórico Financeiro como despesas.
              </p>
            )}
          </div>
        )}
      </div>

    </div>
  )
}
