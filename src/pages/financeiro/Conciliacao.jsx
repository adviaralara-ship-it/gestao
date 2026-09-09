import React, { useState } from 'react'
import { 
  UploadCloud, CheckCircle, ArrowRightCircle, Check, Search, 
  Sparkles, Mail, RefreshCw, AlertCircle, FileText, CheckCheck, Landmark
} from 'lucide-react'

export default function Conciliacao({ lancamentos, setModalLanc, updateLancamento }) {
  const [ofxItems, setOfxItems] = useState([])
  const [conciliadosIds, setConciliadosIds] = useState([])
  const [matchModal, setMatchModal] = useState(null)
  const [buscaReceita, setBuscaReceita] = useState('')
  const [isProcessingAuto, setIsProcessingAuto] = useState(false)
  const [rawOfxText, setRawOfxText] = useState('')
  const [resultadoAuto, setResultadoAuto] = useState(null)

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const data = event.target.result
      setRawOfxText(data)
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
        const fitid = (trn.match(/<FITID>(.*?)(?:<|\r|\n)/) || [])[1] || ''
        
        let date = ''
        if (dateStr && dateStr.length >= 8) {
           date = `${dateStr.substring(0,4)}-${dateStr.substring(4,6)}-${dateStr.substring(6,8)}`
        }
        
        if (amount) {
          transactions.push({
            id: fitid ? fitid.trim() : Math.random().toString(36).substr(2, 9),
            type,
            date,
            amount: parseFloat(amount),
            description: memo.trim()
          })
        }
      }
      setOfxItems(transactions)
      setConciliadosIds([])
      setResultadoAuto(null)
    }
    reader.readAsText(file)
  }

  const handleConciliacaoAutomatica = async () => {
    if (!rawOfxText) return
    setIsProcessingAuto(true)
    try {
      const res = await fetch('/api/extrato/processar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ofxText: rawOfxText,
          origem: 'E-mail alphaadmsc@gmail.com'
        })
      })
      const data = await res.json()
      if (data.success) {
        setResultadoAuto(data)
        // Marca todos como conciliados
        setConciliadosIds(ofxItems.map(i => i.id))
        alert(`🎉 Conciliação em Lote Concluída!\n\n✅ ${data.conciliadosCount} boletos/receitas conciliados com sucesso.\n💸 ${data.despesasLancadas} despesas bancárias registradas.`)
      } else {
        alert('Aviso: ' + (data.error || 'Erro no processamento automático.'))
      }
    } catch(err) {
      console.error(err)
      alert('Erro na conciliação automática: ' + err.message)
    } finally {
      setIsProcessingAuto(false)
    }
  }

  const [isSyncingGmail, setIsSyncingGmail] = useState(false)

  const handleSincronizarGmail = async () => {
    setIsSyncingGmail(true)
    try {
      const res = await fetch('/api/extrato/processar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sincronizar-gmail' })
      })
      const data = await res.json()
      if (data.success) {
        alert(`🤖 Robô do Gmail Concluído!\n\n📧 E-mails verificados: ${data.emailsVerificados}\n📂 Extratos OFX encontrados: ${data.anexosEncontrados}\n\n✅ ${data.totalConciliados} boletos conciliados com sucesso!\n💸 ${data.totalDespesas} despesas bancárias registradas.`)
        if (data.extratosProcessados && data.extratosProcessados.length > 0) {
          // Atualiza a tela com o resumo
          setResultadoAuto(data)
        }
      } else {
        alert('Aviso na sincronização do Gmail: ' + (data.error || 'Não foi possível conectar.'))
      }
    } catch(err) {
      console.error(err)
      alert('Erro ao sincronizar com Gmail: ' + err.message)
    } finally {
      setIsSyncingGmail(false)
    }
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
      _ofxId: ofx.id
    })
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Landmark className="text-brand-600" /> Conciliação Bancária & Extratos
          </h3>
          <p className="text-sm text-gray-500">
            Importe extratos OFX do Nubank, Cora ou outros bancos para conciliar boletos e despesas em lote.
          </p>
        </div>
      </div>

      {/* Card Guia: E-mail alphaadmsc@gmail.com */}
      <div className="bg-gradient-to-r from-brand-50 to-cream-50 border border-brand-200 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-brand-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <Mail size={22} />
          </div>
          <div>
            <h4 className="font-bold text-brand-900 text-sm">Robô Integrado com o E-mail: alphaadmsc@gmail.com</h4>
            <p className="text-xs text-gray-600 mt-0.5 max-w-xl">
              O robô conecta na caixa de entrada, detecta extratos .OFX enviados pelo <strong>Nubank PJ</strong> ou <strong>Cora</strong> e realiza a conciliação bancária automaticamente.
            </p>
          </div>
        </div>

        <button 
          onClick={handleSincronizarGmail}
          disabled={isSyncingGmail}
          className="btn-primary bg-brand-600 hover:bg-brand-700 text-white font-black text-xs py-2.5 px-4 rounded-xl flex items-center gap-2 shrink-0 shadow-md"
        >
          <RefreshCw size={15} className={isSyncingGmail ? "animate-spin" : ""} />
          {isSyncingGmail ? 'Conectando ao Gmail...' : '🤖 Sincronizar Agora com Gmail'}
        </button>
      </div>

      {!ofxItems.length && (
        <div className="border-2 border-dashed border-gray-300 rounded-2xl p-10 flex flex-col items-center justify-center bg-white hover:bg-cream-50/50 transition-colors shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-cream-100 text-brand-600 flex items-center justify-center mb-4">
            <UploadCloud size={32} />
          </div>
          <h4 className="font-bold text-gray-800 text-base mb-1">Importar Extrato OFX do Banco</h4>
          <p className="text-xs text-gray-500 mb-5 text-center max-w-md">
            Selecione o arquivo .ofx recebido em <strong>alphaadmsc@gmail.com</strong> ou exportado do Nubank/Cora para conciliar automaticamente.
          </p>
          <label className="btn-primary cursor-pointer px-6 py-2.5 text-xs font-bold shadow-md">
            Selecionar Arquivo .OFX
            <input type="file" accept=".ofx" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>
      )}

      {ofxItems.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase">Transações Lidas</p>
                <p className="font-black text-xl text-brand-700">{ofxItems.length}</p>
              </div>
              <div className="w-px h-8 bg-gray-200"></div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase">Conciliadas</p>
                <p className="font-black text-xl text-emerald-600">{conciliadosIds.length}</p>
              </div>
              <div className="w-px h-8 bg-gray-200"></div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase">Pendentes</p>
                <p className="font-black text-xl text-amber-600">{ofxItems.length - conciliadosIds.length}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button 
                onClick={handleConciliacaoAutomatica}
                disabled={isProcessingAuto}
                className="btn-primary bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-2 px-4 flex items-center gap-2 shadow-md flex-1 sm:flex-initial"
              >
                <Sparkles size={15} className={isProcessingAuto ? "animate-spin" : ""} />
                {isProcessingAuto ? 'Conciliando em Lote...' : '⚡ Conciliar Tudo Automaticamente'}
              </button>
              <button onClick={() => { setOfxItems([]); setRawOfxText(''); setResultadoAuto(null) }} className="btn-secondary text-xs py-2 px-3">
                Limpar
              </button>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-cream-100 border-b border-cream-200 text-xs font-bold">
                <tr>
                  <th className="p-3.5 text-gray-700">Data</th>
                  <th className="p-3.5 text-gray-700">Descrição / Histórico</th>
                  <th className="p-3.5 text-gray-700">Valor (R$)</th>
                  <th className="p-3.5 text-gray-700 text-right">Status / Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ofxItems.map(ofx => {
                  const isExpense = ofx.amount < 0
                  const isConciliado = conciliadosIds.includes(ofx.id)
                  
                  return (
                    <tr key={ofx.id} className={`hover:bg-gray-50/80 transition-colors ${isConciliado ? 'bg-emerald-50/30' : ''}`}>
                      <td className="p-3.5 text-xs text-gray-600 font-medium">
                        {ofx.date ? ofx.date.split('-').reverse().join('/') : '-'}
                      </td>
                      <td className="p-3.5 text-xs font-bold text-gray-800">
                        {ofx.description}
                      </td>
                      <td className={`p-3.5 text-xs font-mono font-black ${isExpense ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {isExpense ? '' : '+'} R$ {fmt(ofx.amount)}
                      </td>
                      <td className="p-3.5 text-right">
                        {isConciliado ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-xs bg-emerald-100/70 border border-emerald-200 px-2.5 py-1 rounded-md">
                            <CheckCheck size={14} /> Conciliado
                          </span>
                        ) : isExpense ? (
                          <button onClick={() => handleLancarDespesa(ofx)} className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1 ml-auto">
                            <ArrowRightCircle size={14} /> Lançar Despesa
                          </button>
                        ) : (
                          <button onClick={() => handleAbrirMatch(ofx)} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1 ml-auto border-emerald-600 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 font-bold">
                            <Check size={14} /> Vincular Boleto
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
              <p className="text-xs text-gray-600">Selecione abaixo o boleto ou conta a receber pendente no sistema que corresponde a esta entrada:</p>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-9 text-xs" placeholder="Buscar por apartamento, nome ou valor..." value={buscaReceita} onChange={e => setBuscaReceita(e.target.value)} />
              </div>
              
              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-2">
                {lancamentos
                  .filter(l => l.tipo === 'Receita' && l.status === 'Pendente')
                  .filter(l => (l.descricao||'').toLowerCase().includes(buscaReceita.toLowerCase()) || String(l.valor).includes(buscaReceita))
                  .sort((a,b) => Math.abs(a.valor - matchModal.amount) - Math.abs(b.valor - matchModal.amount))
                  .map(l => (
                    <div key={l.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-xl hover:border-brand-500 hover:bg-brand-50 transition-all cursor-pointer" onClick={() => handleVincular(l, matchModal)}>
                      <div>
                        <p className="text-xs font-bold text-gray-800">{l.descricao}</p>
                        <p className="text-[11px] text-gray-500">Venc: {l.data ? l.data.split('-').reverse().join('/') : '-'} | {l.categoria}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className={`font-mono font-bold text-xs ${l.valor === matchModal.amount ? 'text-emerald-600' : 'text-gray-700'}`}>R$ {fmt(l.valor)}</p>
                        <button className="px-2.5 py-1 bg-brand-600 text-white rounded-lg text-xs font-bold hover:bg-brand-700">Vincular</button>
                      </div>
                    </div>
                  ))}
                  {lancamentos.filter(l => l.tipo === 'Receita' && l.status === 'Pendente').length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4">Nenhuma receita pendente encontrada no sistema.</p>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
