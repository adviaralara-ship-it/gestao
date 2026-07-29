import React, { useState } from 'react'
import { UploadCloud, CheckCircle, ArrowRightCircle, Check, Search } from 'lucide-react'

export default function Conciliacao({ lancamentos, setModalLanc, updateLancamento }) {
  const [ofxItems, setOfxItems] = useState([])
  const [conciliadosIds, setConciliadosIds] = useState([])
  const [matchModal, setMatchModal] = useState(null) // para conciliar receitas
  const [buscaReceita, setBuscaReceita] = useState('')

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const data = event.target.result
      const transactions = []
      const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g
      let match
      while ((match = stmtTrnRegex.exec(data)) !== null) {
        const trn = match[1]
        const type = (trn.match(/<TRNTYPE>(.*?)(?:<|\r|\n)/) || [])[1]
        const dateStr = (trn.match(/<DTPOSTED>(.*?)(?:<|\r|\n)/) || [])[1]
        const amount = (trn.match(/<TRNAMT>(.*?)(?:<|\r|\n)/) || [])[1]
        let memo = (trn.match(/<MEMO>(.*?)(?:<|\r|\n)/) || [])[1] || ''
        if (!memo) memo = (trn.match(/<NAME>(.*?)(?:<|\r|\n)/) || [])[1] || ''
        
        let date = ''
        if (dateStr && dateStr.length >= 8) {
           date = `${dateStr.substring(0,4)}-${dateStr.substring(4,6)}-${dateStr.substring(6,8)}`
        }
        
        transactions.push({
          id: Math.random().toString(36).substr(2, 9),
          type,
          date,
          amount: parseFloat(amount),
          description: memo.trim()
        })
      }
      setOfxItems(transactions)
      setConciliadosIds([]) // reseta os conciliados desta sessão
    }
    reader.readAsText(file)
  }

  const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const handleLancarDespesa = (ofx) => {
    setModalLanc({
      descricao: ofx.description,
      tipo: 'Despesa',
      categoria: 'A Classificar',
      valor: Math.abs(ofx.amount),
      data: ofx.date,
      status: 'Pago',
      _ofxId: ofx.id // para marcar como conciliado depois
    })
    // A marcação de conciliação ocorrerá caso a gente consiga interceptar o salvar.
    // Como simplificação, marcaremos agora na interface que já foi tratado.
    setConciliadosIds(prev => [...prev, ofx.id])
  }

  const handleAbrirMatch = (ofx) => {
    setMatchModal(ofx)
    setBuscaReceita('')
  }

  const handleVincular = async (lancamentoSistema, ofx) => {
    await updateLancamento(lancamentoSistema.id, { ...lancamentoSistema, status: 'Recebido' })
    setConciliadosIds(prev => [...prev, ofx.id])
    setMatchModal(null)
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-gray-800">Conciliação Bancária</h3>
          <p className="text-sm text-gray-500">Faça o upload do arquivo OFX do seu banco para conciliar boletos e despesas.</p>
        </div>
      </div>

      {!ofxItems.length && (
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-10 flex flex-col items-center justify-center bg-gray-50 hover:bg-cream-50 transition-colors">
          <UploadCloud size={48} className="text-gray-400 mb-4" />
          <h4 className="font-bold text-gray-700 mb-2">Importar Extrato OFX</h4>
          <p className="text-sm text-gray-500 mb-4 text-center max-w-md">Selecione o arquivo .ofx baixado do Internet Banking para sincronizar os dados automaticamente com o sistema.</p>
          <label className="btn-primary cursor-pointer">
            Selecionar Arquivo
            <input type="file" accept=".ofx" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>
      )}

      {ofxItems.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex gap-4">
              <div className="text-sm">
                <p className="text-gray-500">Transações Lidas</p>
                <p className="font-bold text-lg text-brand-600">{ofxItems.length}</p>
              </div>
              <div className="text-sm">
                <p className="text-gray-500">Conciliadas</p>
                <p className="font-bold text-lg text-emerald-600">{conciliadosIds.length}</p>
              </div>
            </div>
            <button onClick={() => setOfxItems([])} className="btn-secondary text-sm">Limpar e Importar Outro</button>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-cream-100 border-b border-cream-200 text-sm">
                <tr>
                  <th className="p-3 font-semibold text-gray-600">Data</th>
                  <th className="p-3 font-semibold text-gray-600">Histórico do Banco (Memo)</th>
                  <th className="p-3 font-semibold text-gray-600">Valor (R$)</th>
                  <th className="p-3 font-semibold text-gray-600 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ofxItems.map(ofx => {
                  const isExpense = ofx.amount < 0
                  const isConciliado = conciliadosIds.includes(ofx.id)
                  
                  return (
                    <tr key={ofx.id} className={`hover:bg-gray-50 transition-colors ${isConciliado ? 'opacity-50' : ''}`}>
                      <td className="p-3 text-sm text-gray-600">{ofx.date ? ofx.date.split('-').reverse().join('/') : '-'}</td>
                      <td className="p-3 text-sm font-medium text-gray-800">{ofx.description}</td>
                      <td className={`p-3 text-sm font-bold ${isExpense ? 'text-red-500' : 'text-emerald-600'}`}>
                        {isExpense ? '' : '+'} {fmt(ofx.amount)}
                      </td>
                      <td className="p-3 text-right">
                        {isConciliado ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-xs bg-emerald-50 px-2 py-1 rounded">
                            <CheckCircle size={14} /> Conciliado
                          </span>
                        ) : isExpense ? (
                          <button onClick={() => handleLancarDespesa(ofx)} className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1 ml-auto">
                            <ArrowRightCircle size={14} /> Lançar Despesa
                          </button>
                        ) : (
                          <button onClick={() => handleAbrirMatch(ofx)} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1 ml-auto border-emerald-600 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700">
                            <Check size={14} /> Conciliar Boleto
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {matchModal && (
        <div className="modal-overlay" onClick={() => setMatchModal(null)}>
          <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-cream-300 flex items-center justify-between">
              <h3 className="font-bold text-gray-800">Conciliar Recebimento</h3>
              <button onClick={() => setMatchModal(null)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <div className="p-4 bg-emerald-50 border-b border-emerald-100 flex justify-between items-center">
              <div>
                <p className="text-xs text-emerald-800 uppercase font-bold">Entrada no Extrato (OFX)</p>
                <p className="text-sm font-medium text-emerald-900">{matchModal.description}</p>
              </div>
              <p className="font-black text-emerald-700 text-lg">R$ {fmt(matchModal.amount)}</p>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <p className="text-sm text-gray-600">Selecione abaixo a "Conta a Receber" pendente no sistema que corresponde a esta entrada:</p>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-9" placeholder="Buscar por apartamento, nome ou valor..." value={buscaReceita} onChange={e => setBuscaReceita(e.target.value)} />
              </div>
              
              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-2">
                {lancamentos
                  .filter(l => l.tipo === 'Receita' && l.status === 'Pendente')
                  .filter(l => (l.descricao||'').toLowerCase().includes(buscaReceita.toLowerCase()) || String(l.valor).includes(buscaReceita))
                  // Opcional: ordenar pelos valores mais próximos ao valor do OFX
                  .sort((a,b) => Math.abs(a.valor - matchModal.amount) - Math.abs(b.valor - matchModal.amount))
                  .map(l => (
                    <div key={l.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-brand-500 hover:bg-brand-50 transition-all cursor-pointer" onClick={() => handleVincular(l, matchModal)}>
                      <div>
                        <p className="text-sm font-bold text-gray-800">{l.descricao}</p>
                        <p className="text-xs text-gray-500">Venc: {l.data ? l.data.split('-').reverse().join('/') : '-'} | {l.categoria}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className={`font-bold ${l.valor === matchModal.amount ? 'text-emerald-600' : 'text-gray-700'}`}>R$ {fmt(l.valor)}</p>
                        <button className="px-2 py-1 bg-brand-600 text-white rounded text-xs font-medium hover:bg-brand-700">Vincular</button>
                      </div>
                    </div>
                  ))}
                  {lancamentos.filter(l => l.tipo === 'Receita' && l.status === 'Pendente').length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">Nenhuma receita pendente encontrada no sistema.</p>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
