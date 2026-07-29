import React, { useState } from 'react'
import { Calculator, CheckCircle2, Droplet, ArrowRight, Save } from 'lucide-react'
import { useFirestore } from '../../hooks/useFirestore'

export default function RateioAgua({ lancamentos }) {
  const { addItem: addLancamento } = useFirestore('financeiro_lancamentos')
  const { items: condominios } = useFirestore('condominios')
  
  const [valorTotal, setValorTotal] = useState('')
  const [quantidadeAptos, setQuantidadeAptos] = useState('')
  const [condominio, setCondominio] = useState('')
  const [vencimento, setVencimento] = useState('')
  const [gerado, setGerado] = useState(false)
  const [simulacao, setSimulacao] = useState(null)

  const handleSimular = () => {
    if (!valorTotal || !quantidadeAptos) return
    const vTotal = Number(valorTotal.replace(',', '.'))
    const qtd = Number(quantidadeAptos)
    if (qtd <= 0 || vTotal <= 0) return

    const cota = vTotal / qtd
    setSimulacao({ vTotal, qtd, cota, condominio })
    setGerado(false)
  }

  const handleGerarLancamentos = async () => {
    if (!simulacao || !vencimento) return alert('Defina a data de vencimento primeiro.')

    for (let i = 1; i <= simulacao.qtd; i++) {
      await addLancamento({
        descricao: `Rateio de Água - Cota ${i}/${simulacao.qtd}${simulacao.condominio ? ` - ${simulacao.condominio}` : ''}`,
        tipo: 'Receita',
        categoria: 'Taxa de Água',
        valor: simulacao.cota,
        data: vencimento,
        condominio: simulacao.condominio || '',
        status: 'Pendente'
      })
    }
    setGerado(true)
  }

  const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Droplet className="text-blue-500" size={24}/> Rateio de Água</h3>
          <p className="text-sm text-gray-500">Divida a conta da concessionária entre os moradores</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card bg-white shadow-sm border border-cream-300 flex flex-col gap-5">
          <h4 className="font-bold text-gray-700 flex items-center gap-2"><Calculator size={18}/> Calculadora</h4>
          
          <div>
            <label className="label">Valor Total da Fatura (R$)</label>
            <input 
              type="number" 
              min="0" step="0.01" 
              className="input w-full text-lg font-semibold" 
              value={valorTotal} 
              onChange={e => setValorTotal(e.target.value)} 
              placeholder="Ex: 1500.00" 
            />
          </div>

          <div>
            <label className="label">Quantidade de Apartamentos para Rateio</label>
            <input 
              type="number" 
              min="1" 
              className="input w-full" 
              value={quantidadeAptos} 
              onChange={e => setQuantidadeAptos(e.target.value)} 
              placeholder="Ex: 10" 
            />
          </div>

          <div>
            <label className="label">Condomínio (Opcional)</label>
            <select className="input w-full" value={condominio} onChange={e => setCondominio(e.target.value)}>
              <option value="">Todos / Nenhum específico</option>
              {condominios.map(c => (
                <option key={c.id} value={c.nome}>{c.nome}</option>
              ))}
            </select>
          </div>

          <button 
            onClick={handleSimular} 
            disabled={!valorTotal || !quantidadeAptos}
            className="btn-primary mt-2 flex justify-center py-3 text-base"
          >
            Simular Divisão
          </button>
        </div>

        {simulacao && (
          <div className="card bg-blue-50/50 border border-blue-100 flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-blue-800 mb-4 flex items-center gap-2">Resumo do Rateio</h4>
              
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center py-2 border-b border-blue-200/50">
                  <span className="text-gray-600">Valor Total</span>
                  <span className="font-bold text-gray-800">R$ {fmt(simulacao.vTotal)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-blue-200/50">
                  <span className="text-gray-600">Unidades Rateadas</span>
                  <span className="font-bold text-gray-800">{simulacao.qtd} aptos</span>
                </div>
                {simulacao.condominio && (
                  <div className="flex justify-between items-center py-2 border-b border-blue-200/50">
                    <span className="text-gray-600">Condomínio</span>
                    <span className="font-bold text-gray-800">{simulacao.condominio}</span>
                  </div>
                )}
                <div className="flex justify-between items-center py-3 bg-blue-100 rounded-lg px-4 mt-2">
                  <span className="text-blue-900 font-bold uppercase text-sm">Valor por Apartamento</span>
                  <span className="font-black text-blue-700 text-xl">R$ {fmt(simulacao.cota)}</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-blue-200/50 flex flex-col gap-4">
              {!gerado ? (
                <>
                  <div>
                    <label className="label text-blue-900">Vencimento das Cotas</label>
                    <input type="date" className="input w-full border-blue-200 focus:border-blue-500" value={vencimento} onChange={e => setVencimento(e.target.value)} />
                  </div>
                  <button onClick={handleGerarLancamentos} className="w-full bg-blue-600 text-white hover:bg-blue-700 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30 transition-all">
                    <Save size={18}/> Lançar Contas a Receber
                  </button>
                </>
              ) : (
                <div className="bg-emerald-100 border border-emerald-200 rounded-xl p-4 flex flex-col items-center justify-center text-emerald-700 gap-2">
                  <CheckCircle2 size={32} />
                  <p className="font-bold text-center">Lançamentos gerados com sucesso!</p>
                  <p className="text-sm text-center">Foram criadas {simulacao.qtd} contas a receber no módulo financeiro.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
