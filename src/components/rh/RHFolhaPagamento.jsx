import React, { useState, useEffect, useRef } from 'react'
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useFirestore } from '../../hooks/useFirestore'
import { Search, Loader2, Plus, Trash2, Printer, CheckCircle } from 'lucide-react'

// Utilidades de Cálculo (Tabelas 2024/2025/2026 Brasil)
const calcularINSS = (bruto) => {
  let inss = 0
  if (bruto <= 1412.00) inss = bruto * 0.075
  else if (bruto <= 2666.68) inss = (1412.00 * 0.075) + ((bruto - 1412.00) * 0.09)
  else if (bruto <= 4000.03) inss = (1412.00 * 0.075) + ((2666.68 - 1412.00) * 0.09) + ((bruto - 2666.68) * 0.12)
  else if (bruto <= 7786.02) inss = (1412.00 * 0.075) + ((2666.68 - 1412.00) * 0.09) + ((4000.03 - 2666.68) * 0.12) + ((bruto - 4000.03) * 0.14)
  else inss = (1412.00 * 0.075) + ((2666.68 - 1412.00) * 0.09) + ((4000.03 - 2666.68) * 0.12) + ((7786.02 - 4000.03) * 0.14)
  return inss
}

const calcularIRRF = (baseCalculo) => {
  // Base de Cálculo = Bruto - INSS - (Dependentes * 189.59)
  if (baseCalculo <= 2259.20) return 0
  if (baseCalculo <= 2826.65) return (baseCalculo * 0.075) - 169.44
  if (baseCalculo <= 3751.05) return (baseCalculo * 0.15) - 381.44
  if (baseCalculo <= 4664.68) return (baseCalculo * 0.225) - 662.77
  return (baseCalculo * 0.275) - 896.00
}

export default function RHFolhaPagamento() {
  const [colabs, setColabs] = useState([])
  const [selectedColab, setSelectedColab] = useState('')
  const [mesAno, setMesAno] = useState(new Date().toISOString().substring(0, 7))
  
  const [loading, setLoading] = useState(false)
  const [fechamentoPonto, setFechamentoPonto] = useState(null)
  
  // Eventos Manuais
  const [proventos, setProventos] = useState([])
  const [descontos, setDescontos] = useState([])
  
  // UI States
  const [novoProvento, setNovoProvento] = useState({ desc: 'Horas Extras', valor: '' })
  const [novoDesconto, setNovoDesconto] = useState({ desc: 'Plano de Saúde', valor: '' })
  const [vtAtivo, setVtAtivo] = useState(true) // Desconto padrão 6%
  const [insalubridade, setInsalubridade] = useState(false)
  
  // Folha Salva
  const [folhaSalva, setFolhaSalva] = useState(null)

  const printRef = useRef()

  useEffect(() => {
    const fetchColabs = async () => {
      const snap = await getDocs(query(collection(db, 'rh')))
      setColabs(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => a.nome.localeCompare(b.nome)))
    }
    fetchColabs()
  }, [])

  useEffect(() => {
    if (!selectedColab || !mesAno) return
    const carregarPonto = async () => {
      setLoading(true)
      try {
        const q = query(collection(db, 'fechamento_ponto'), where('colabId', '==', selectedColab), where('mesAno', '==', mesAno))
        const snap = await getDocs(q)
        if (!snap.empty) {
          const docData = snap.docs[0].data()
          setFechamentoPonto({ id: snap.docs[0].id, ...docData })
        } else {
          setFechamentoPonto(null)
        }
        
        // Verifica se a folha já foi salva
        const qFolha = query(collection(db, 'folhas_pagamento'), where('colabId', '==', selectedColab), where('mesAno', '==', mesAno))
        const snapFolha = await getDocs(qFolha)
        if (!snapFolha.empty) {
          setFolhaSalva({ id: snapFolha.docs[0].id, ...snapFolha.docs[0].data() })
        } else {
          setFolhaSalva(null)
        }
        
      } catch(err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    carregarPonto()
  }, [selectedColab, mesAno])

  const colabInfo = colabs.find(c => c.id === selectedColab)
  const salarioBase = fechamentoPonto ? fechamentoPonto.salarioBase : (colabInfo ? parseFloat(colabInfo.salario.replace(/[^\d,]/g, '').replace(',', '.')) || 0 : 0)

  // -- Dinâmica de Cálculos --
  let totalProventosManuais = proventos.reduce((acc, p) => acc + (parseFloat(p.valor) || 0), 0)
  let totalDescontosManuais = descontos.reduce((acc, d) => acc + (parseFloat(d.valor) || 0), 0)

  // Calcula Insalubridade Automática (ex: 20% do salário mínimo, vou usar 1412.00) se marcado
  const valorInsalubridade = insalubridade ? (1412.00 * 0.20) : 0
  
  const salarioBruto = salarioBase + totalProventosManuais + valorInsalubridade

  // Calcula VT (Até 6% do salário base, caso o desconto manual não estoure)
  const valorVT = vtAtivo ? (salarioBase * 0.06) : 0

  // Calcula Impostos
  const valorINSS = calcularINSS(salarioBruto)
  const baseIRRF = salarioBruto - valorINSS
  const valorIRRF = calcularIRRF(baseIRRF)

  const totalProventos = salarioBruto
  const totalDescontos = totalDescontosManuais + valorVT + valorINSS + valorIRRF
  const salarioLiquido = totalProventos - totalDescontos

  // Patronal
  const fgts = salarioBruto * 0.08
  const inssPatronal = salarioBruto * 0.20

  const handleSalvarFolha = async () => {
    try {
      const folha = {
        colabId: selectedColab,
        colabNome: colabInfo.nome,
        mesAno,
        salarioBase,
        proventos: [
          ...proventos,
          ...(insalubridade ? [{ desc: 'Insalubridade (20% SM)', valor: valorInsalubridade }] : [])
        ],
        descontos: [
          ...descontos,
          ...(vtAtivo ? [{ desc: 'Vale Transporte (6%)', valor: valorVT }] : []),
          { desc: 'INSS', valor: valorINSS },
          { desc: 'IRRF', valor: valorIRRF }
        ],
        salarioBruto,
        totalDescontos,
        salarioLiquido,
        fgts,
        inssPatronal,
        fechadoEm: new Date().toISOString()
      }
      
      const refDoc = await addDoc(collection(db, 'folhas_pagamento'), folha)
      setFolhaSalva({ id: refDoc.id, ...folha })
      alert('Folha salva com sucesso!')
    } catch(err) {
      alert('Erro ao salvar folha: ' + err.message)
    }
  }

  const addProvento = () => {
    if(!novoProvento.valor || parseFloat(novoProvento.valor) <= 0) return
    setProventos([...proventos, { desc: novoProvento.desc, valor: parseFloat(novoProvento.valor) }])
    setNovoProvento({ desc: 'Horas Extras', valor: '' })
  }

  const addDesconto = () => {
    if(!novoDesconto.valor || parseFloat(novoDesconto.valor) <= 0) return
    setDescontos([...descontos, { desc: novoDesconto.desc, valor: parseFloat(novoDesconto.valor) }])
    setNovoDesconto({ desc: 'Plano de Saúde', valor: '' })
  }

  const handlePrint = () => {
    const printContent = printRef.current.innerHTML
    const originalContent = document.body.innerHTML
    document.body.innerHTML = printContent
    window.print()
    document.body.innerHTML = originalContent
    window.location.reload()
  }

  return (
    <div className="card p-6 min-h-[600px]">
      <div className="flex flex-col md:flex-row gap-4 mb-6 pb-6 border-b border-cream-300">
        <div className="flex-1">
          <label className="label">Colaborador</label>
          <select className="input" value={selectedColab} onChange={e => setSelectedColab(e.target.value)}>
            <option value="">Selecione um colaborador...</option>
            {colabs.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div className="w-full md:w-48">
          <label className="label">Competência</label>
          <input type="month" className="input" value={mesAno} onChange={e => setMesAno(e.target.value)} />
        </div>
      </div>

      {!selectedColab ? (
        <div className="text-center py-10 text-gray-400">
          <p>Selecione um colaborador e a competência (mês) para processar a folha.</p>
        </div>
      ) : loading ? (
        <div className="text-center py-10"><Loader2 size={32} className="animate-spin text-brand-500 mx-auto" /></div>
      ) : !fechamentoPonto && !folhaSalva ? (
        <div className="text-center py-10 text-orange-600 bg-orange-50 border border-orange-200 rounded-xl">
          <p className="font-bold">Atenção!</p>
          <p>O Ponto Eletrônico de {mesAno} não foi fechado para este colaborador na aba "Gestão de Ponto".</p>
          <p className="text-sm mt-2 opacity-80">Você pode processar a folha mesmo assim, mas as faltas não serão calculadas automaticamente.</p>
        </div>
      ) : folhaSalva ? (
        <div className="animate-fade-in space-y-6">
          <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl">
            <div className="flex items-center gap-3">
              <CheckCircle size={24} className="text-emerald-600" />
              <div>
                <p className="font-bold">Folha Processada e Salva!</p>
                <p className="text-sm">Processado em {new Date(folhaSalva.fechadoEm).toLocaleString()}</p>
              </div>
            </div>
            <button onClick={handlePrint} className="btn-primary bg-emerald-600 hover:bg-emerald-700 flex items-center gap-2">
              <Printer size={16} /> Imprimir Holerite
            </button>
          </div>

          {/* O Holerite Invisível (Só aparece na impressão) e visível como preview */}
          <div ref={printRef} className="border border-gray-300 bg-white p-8 rounded-xl shadow-sm text-black font-sans max-w-3xl mx-auto">
            {/* Header Holerite */}
            <div className="border-b-2 border-black pb-4 mb-4 flex justify-between">
              <div>
                <h1 className="text-xl font-bold uppercase">Alpha Gestão Condominial</h1>
                <p className="text-sm">CNPJ: 00.000.000/0001-00</p>
              </div>
              <div className="text-right">
                <h2 className="text-xl font-bold uppercase">Recibo de Pagamento</h2>
                <p className="text-sm">Competência: <b>{folhaSalva.mesAno.split('-').reverse().join('/')}</b></p>
              </div>
            </div>
            
            <div className="grid grid-cols-4 gap-4 mb-6 border border-black p-2">
              <div className="col-span-1 border-r border-black"><span className="text-xs text-gray-500 block">Código</span> 00{selectedColab.substring(0,4)}</div>
              <div className="col-span-2 border-r border-black"><span className="text-xs text-gray-500 block">Nome do Funcionário</span> <b>{folhaSalva.colabNome}</b></div>
              <div className="col-span-1"><span className="text-xs text-gray-500 block">Cargo</span> {colabInfo?.cargo}</div>
            </div>

            {/* Tabela */}
            <table className="w-full border-collapse border border-black text-sm mb-6">
              <thead>
                <tr className="border-b border-black">
                  <th className="border-r border-black p-2 text-left w-12">Cód.</th>
                  <th className="border-r border-black p-2 text-left">Descrição</th>
                  <th className="border-r border-black p-2 text-right w-24">Vencimentos</th>
                  <th className="p-2 text-right w-24">Descontos</th>
                </tr>
              </thead>
              <tbody>
                <tr className="align-top h-48">
                  <td className="border-r border-black p-2 font-mono">
                    001<br/>
                    {folhaSalva.proventos.map((_, i) => <div key={i}>0{10+i}</div>)}
                    <br/>
                    {folhaSalva.descontos.map((_, i) => <div key={i}>1{10+i}</div>)}
                  </td>
                  <td className="border-r border-black p-2">
                    Salário Base<br/>
                    {folhaSalva.proventos.map((p, i) => <div key={i}>{p.desc}</div>)}
                    <br/>
                    {folhaSalva.descontos.map((d, i) => <div key={i}>{d.desc}</div>)}
                  </td>
                  <td className="border-r border-black p-2 text-right">
                    {folhaSalva.salarioBase.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}<br/>
                    {folhaSalva.proventos.map((p, i) => <div key={i}>{p.valor.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</div>)}
                    <br/>
                    {folhaSalva.descontos.map((_, i) => <div key={i}>&nbsp;</div>)}
                  </td>
                  <td className="p-2 text-right">
                    &nbsp;<br/>
                    {folhaSalva.proventos.map((_, i) => <div key={i}>&nbsp;</div>)}
                    <br/>
                    {folhaSalva.descontos.map((d, i) => <div key={i}>{d.valor.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</div>)}
                  </td>
                </tr>
                <tr className="border-t border-black bg-gray-50">
                  <td colSpan="2" className="border-r border-black p-2 text-right font-bold">TOTAIS</td>
                  <td className="border-r border-black p-2 text-right font-bold">{folhaSalva.salarioBruto.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</td>
                  <td className="p-2 text-right font-bold">{folhaSalva.totalDescontos.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</td>
                </tr>
              </tbody>
            </table>

            <div className="flex justify-end items-center gap-4 mb-6">
              <div className="text-right">
                <span className="text-xs text-gray-500 uppercase tracking-widest block">Líquido a Receber</span>
                <div className="text-2xl font-bold bg-gray-200 px-4 py-2 border border-black inline-block mt-1">
                  {folhaSalva.salarioLiquido.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}
                </div>
              </div>
            </div>

            {/* Rodapé Infos Extras */}
            <div className="grid grid-cols-4 gap-2 text-xs border border-black bg-gray-50">
              <div className="p-2 border-r border-black text-center">Salário Base<br/><b>{folhaSalva.salarioBase.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</b></div>
              <div className="p-2 border-r border-black text-center">Base INSS<br/><b>{folhaSalva.salarioBruto.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</b></div>
              <div className="p-2 border-r border-black text-center">Base FGTS<br/><b>{folhaSalva.salarioBruto.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</b></div>
              <div className="p-2 text-center">FGTS do Mês<br/><b>{folhaSalva.fgts.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</b></div>
            </div>
            
            <div className="mt-8 text-xs text-center border-t border-gray-400 pt-2 w-2/3 mx-auto">
              Assinatura do Funcionário
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          
          {/* Lançamentos Manuais */}
          <div className="lg:col-span-2 space-y-6">
            <div className="p-5 border border-cream-300 rounded-xl bg-white shadow-sm">
              <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">Proventos (Vencimentos)</h3>
              
              <div className="flex items-center gap-3 mb-4 bg-brand-50 p-3 rounded-lg border border-brand-100">
                <input type="checkbox" className="w-4 h-4 rounded text-brand-600" checked={insalubridade} onChange={e => setInsalubridade(e.target.checked)} />
                <label className="text-sm font-bold text-brand-800 cursor-pointer">Adicionar Insalubridade (Automático: 20% SM)</label>
              </div>

              {proventos.map((p, i) => (
                <div key={i} className="flex justify-between items-center bg-gray-50 p-2 rounded-lg mb-2">
                  <span className="text-sm text-gray-700">{p.desc}</span>
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-emerald-600">+ R$ {p.valor.toFixed(2)}</span>
                    <button onClick={() => setProventos(proventos.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600"><Trash2 size={14}/></button>
                  </div>
                </div>
              ))}
              <div className="flex gap-2 mt-3">
                <select className="input flex-1" value={novoProvento.desc} onChange={e => setNovoProvento({...novoProvento, desc: e.target.value})}>
                  <option>Horas Extras</option>
                  <option>Adicional Noturno</option>
                  <option>Periculosidade</option>
                  <option>Comissão</option>
                  <option>Gratificação</option>
                  <option>Bonificação</option>
                  <option>DSR</option>
                </select>
                <input type="number" placeholder="Valor (R$)" className="input w-32" value={novoProvento.valor} onChange={e => setNovoProvento({...novoProvento, valor: e.target.value})} />
                <button onClick={addProvento} className="btn-secondary bg-cream-200"><Plus size={16}/></button>
              </div>
            </div>

            <div className="p-5 border border-cream-300 rounded-xl bg-white shadow-sm">
              <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">Descontos</h3>
              
              <div className="flex items-center gap-3 mb-4 bg-red-50 p-3 rounded-lg border border-red-100">
                <input type="checkbox" className="w-4 h-4 rounded text-red-600" checked={vtAtivo} onChange={e => setVtAtivo(e.target.checked)} />
                <label className="text-sm font-bold text-red-800 cursor-pointer">Desconto de Vale Transporte (Automático: 6% Base)</label>
              </div>

              {descontos.map((d, i) => (
                <div key={i} className="flex justify-between items-center bg-gray-50 p-2 rounded-lg mb-2">
                  <span className="text-sm text-gray-700">{d.desc}</span>
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-red-600">- R$ {d.valor.toFixed(2)}</span>
                    <button onClick={() => setDescontos(descontos.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600"><Trash2 size={14}/></button>
                  </div>
                </div>
              ))}
              <div className="flex gap-2 mt-3">
                <select className="input flex-1" value={novoDesconto.desc} onChange={e => setNovoDesconto({...novoDesconto, desc: e.target.value})}>
                  <option>Plano de Saúde</option>
                  <option>Vale Alimentação</option>
                  <option>Faltas</option>
                  <option>Atrasos</option>
                  <option>Pensão Alimentícia</option>
                  <option>Empréstimo Consignado</option>
                </select>
                <input type="number" placeholder="Valor (R$)" className="input w-32" value={novoDesconto.valor} onChange={e => setNovoDesconto({...novoDesconto, valor: e.target.value})} />
                <button onClick={addDesconto} className="btn-secondary bg-cream-200"><Plus size={16}/></button>
              </div>
            </div>
          </div>

          {/* Resumo da Folha (Painel Flutuante / Fixo) */}
          <div className="bg-brand-900 text-white p-6 rounded-2xl shadow-xl h-fit sticky top-6">
            <h3 className="text-lg font-bold mb-4 border-b border-brand-700 pb-2">Resumo da Folha</h3>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-brand-100">
                <span>Salário Base:</span>
                <span>R$ {salarioBase.toFixed(2)}</span>
              </div>
              
              {insalubridade && (
                <div className="flex justify-between text-emerald-300">
                  <span>+ Insalubridade (20% SM):</span>
                  <span>R$ {valorInsalubridade.toFixed(2)}</span>
                </div>
              )}
              {totalProventosManuais > 0 && (
                <div className="flex justify-between text-emerald-300">
                  <span>+ Proventos Avulsos:</span>
                  <span>R$ {totalProventosManuais.toFixed(2)}</span>
                </div>
              )}

              <div className="border-t border-brand-700/50 my-2 pt-2 flex justify-between font-bold text-white">
                <span>Salário Bruto:</span>
                <span>R$ {salarioBruto.toFixed(2)}</span>
              </div>

              {/* Impostos e Descontos */}
              {vtAtivo && (
                <div className="flex justify-between text-red-300">
                  <span>- Vale Transporte (6%):</span>
                  <span>R$ {valorVT.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-red-300">
                <span>- INSS (Progressivo):</span>
                <span>R$ {valorINSS.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-red-300">
                <span>- IRRF (Progressivo):</span>
                <span>R$ {valorIRRF.toFixed(2)}</span>
              </div>
              {totalDescontosManuais > 0 && (
                <div className="flex justify-between text-red-300">
                  <span>- Descontos Avulsos:</span>
                  <span>R$ {totalDescontosManuais.toFixed(2)}</span>
                </div>
              )}

              <div className="border-t border-brand-700/50 my-2 pt-2 flex justify-between text-red-200">
                <span>Total de Descontos:</span>
                <span>R$ {totalDescontos.toFixed(2)}</span>
              </div>

              {/* LÍQUIDO */}
              <div className="mt-4 pt-4 border-t-2 border-brand-600">
                <span className="block text-brand-200 text-xs uppercase tracking-wider mb-1">Líquido a Receber</span>
                <span className="block text-3xl font-black text-white">R$ {salarioLiquido.toFixed(2)}</span>
              </div>
            </div>

            <div className="mt-6 bg-brand-950 p-3 rounded-xl text-xs text-brand-300/80">
              <p className="font-bold mb-1 text-brand-200">Custos Patronais (Empresa):</p>
              <div className="flex justify-between"><span>FGTS (8%):</span><span>R$ {fgts.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>INSS Patronal (20%):</span><span>R$ {inssPatronal.toFixed(2)}</span></div>
            </div>

            <button onClick={handleSalvarFolha} className="w-full mt-6 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg hover:shadow-xl">
              Aprovar & Gerar Holerite
            </button>
          </div>

        </div>
      )}
    </div>
  )
}
