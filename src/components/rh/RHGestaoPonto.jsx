import React, { useState, useEffect } from 'react'
import { collection, query, where, getDocs, updateDoc, doc, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore'
import { useFirestore } from '../../hooks/useFirestore'
import { db } from '../../firebase'
import { Calendar, Search, Loader2, Save, AlertTriangle, Plus, Edit2, Trash2 } from 'lucide-react'

export default function RHGestaoPonto() {
  const [colabs, setColabs] = useState([])
  const [selectedColab, setSelectedColab] = useState('')
  const [mesAno, setMesAno] = useState(new Date().toISOString().substring(0, 7)) // YYYY-MM
  const [pontos, setPontos] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Para dias de folga/falta/ajuste
  const [modalAjuste, setModalAjuste] = useState(null)
  
  // Para edição de registro individual
  const [modalEditarRegistro, setModalEditarRegistro] = useState(null)
  const [editHora, setEditHora] = useState('')
  
  // Seleção múltipla para exclusão
  const [selectedDays, setSelectedDays] = useState([])

  useEffect(() => {
    const fetchColabs = async () => {
      const snap = await getDocs(query(collection(db, 'rh'), where('status', '==', 'Ativo')))
      setColabs(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => a.nome.localeCompare(b.nome)))
    }
    fetchColabs()
  }, [])

  useEffect(() => {
    if (!selectedColab || !mesAno) return
    const fetchPontos = async () => {
      setLoading(true)
      try {
        const q = query(collection(db, 'pontos'), where('colabId', '==', selectedColab))
        const snap = await getDocs(q)
        
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .filter(p => p.dataISO && p.dataISO.startsWith(mesAno) && !p.deletado)
          .sort((a,b) => new Date(a.dataISO) - new Date(b.dataISO))
        
        setPontos(list)
        setSelectedDays([])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchPontos()
  }, [selectedColab, mesAno])

  const agruparPorDia = () => {
    const dias = {}
    
    // Pega quantos dias tem o mês selecionado
    const [ano, mes] = mesAno.split('-')
    const numDias = new Date(ano, mes, 0).getDate()
    
    // Inicializa todos os dias do mês
    for(let i=1; i<=numDias; i++) {
      const dayStr = i.toString().padStart(2, '0')
      const dataFormatada = `${ano}-${mes}-${dayStr}`
      dias[dataFormatada] = {
        registros: [],
        status: 'Sem registro', // 'Normal', 'Folga', 'Falta', 'Atestado'
        ajusteDocId: null
      }
    }

    pontos.forEach(p => {
      if(!p.dataISO) return
      const dia = p.dataISO.split('T')[0]
      if (dias[dia]) {
        if (p.isAjuste) {
          dias[dia].status = p.ajusteTipo
          dias[dia].ajusteDocId = p.id
        } else {
          dias[dia].registros.push(p)
          if(dias[dia].status === 'Sem registro') dias[dia].status = 'Normal'
        }
      }
    })
    
    return dias
  }

  const dias = agruparPorDia()
  
  // Calcula previa de horas para exibir na tabela
  let prevTrabalhadosMin = 0
  let prevEsperadosMin = 0
  
  Object.keys(dias).forEach(d => {
    const dia = dias[d]
    let minDia = 0
    let espDia = 0
    
    if (dia.status === 'Normal') {
       espDia = 8 * 60
       const regs = dia.registros.sort((a,b) => new Date(a.dataISO) - new Date(b.dataISO))
       let entradaTemp = null
       regs.forEach(r => {
         if (r.tipo === 'Entrada') {
           entradaTemp = new Date(r.dataISO)
         } else if (r.tipo === 'Saída' && entradaTemp) {
           minDia += (new Date(r.dataISO) - entradaTemp) / 1000 / 60
           entradaTemp = null
         }
       })
    } else if (dia.status === 'Falta') {
       espDia = 8 * 60
    }
    
    dia.minTrabalhados = minDia
    dia.minEsperados = espDia
    dia.saldoMinutos = minDia - espDia
    
    prevTrabalhadosMin += minDia
    prevEsperadosMin += espDia
  })
  
  const totalSaldoHorasPrev = ((prevTrabalhadosMin - prevEsperadosMin) / 60).toFixed(2)

  const handleSalvarAjuste = async (e) => {
    e.preventDefault()
    setSaving(true)
    const { dataIso, tipo, hora, marcacaoTipo, horaE1, horaS1, horaE2, horaS2 } = modalAjuste
    try {
      const colabInfo = colabs.find(c => c.id === selectedColab)
      const loc = { lat: 0, lng: 0, isFallback: true }
      
      const criarPonto = async (hhmm, pTipo) => {
         const [y, m, d] = dataIso.split('-')
         const [hh, mm] = hhmm.split(':')
         const localDate = new Date(y, m - 1, d, hh, mm, 0)
         const dataFinalISO = localDate.toISOString()
         
         const docRef = await addDoc(collection(db, 'pontos'), {
            colabId: selectedColab,
            colabNome: colabInfo.nome,
            tipo: pTipo,
            location: loc,
            photoBase64: null,
            timestamp: serverTimestamp(),
            dataISO: dataFinalISO,
            isAjuste: false,
            ajusteTipo: null,
            manual: true
         })
         
         return {
            id: docRef.id,
            colabId: selectedColab,
            dataISO: dataFinalISO,
            tipo: pTipo,
            isAjuste: false,
            ajusteTipo: null,
            manual: true
         }
      }

      if (tipo === 'Dia Completo') {
         const novosPontos = []
         if (horaE1) novosPontos.push(await criarPonto(horaE1, 'Entrada'))
         if (horaS1) novosPontos.push(await criarPonto(horaS1, 'Saída'))
         if (horaE2) novosPontos.push(await criarPonto(horaE2, 'Entrada'))
         if (horaS2) novosPontos.push(await criarPonto(horaS2, 'Saída'))
         setPontos(prev => [...prev, ...novosPontos])
      } else if (tipo === 'Marcacao') {
         const novoPonto = await criarPonto(hora || '08:00', marcacaoTipo || 'Entrada')
         setPontos(prev => [...prev, novoPonto])
      } else {
         const dataFinalISO = `${dataIso}T12:00:00.000Z`
         const docRef = await addDoc(collection(db, 'pontos'), {
            colabId: selectedColab,
            colabNome: colabInfo.nome,
            tipo: 'Ajuste',
            location: loc,
            photoBase64: null,
            timestamp: serverTimestamp(),
            dataISO: dataFinalISO,
            isAjuste: true,
            ajusteTipo: tipo,
            manual: true
         })
         
         setPontos(prev => [...prev, {
            id: docRef.id,
            colabId: selectedColab,
            dataISO: dataFinalISO,
            tipo: 'Ajuste',
            isAjuste: true,
            ajusteTipo: tipo,
            manual: true
         }])
      }
      
      setModalAjuste(null)
    } catch(err) {
      alert('Erro ao salvar ajuste: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleEditarRegistro = async (e, acao) => {
    e.preventDefault()
    if (!modalEditarRegistro) return
    setSaving(true)
    try {
      if (acao === 'excluir') {
        if(!window.confirm('Tem certeza que deseja excluir esta marcação?')) {
          setSaving(false)
          return
        }
        await updateDoc(doc(db, 'pontos', modalEditarRegistro.id), {
          deletado: true,
          atualizadoEm: serverTimestamp()
        })
        setPontos(prev => prev.filter(p => p.id !== modalEditarRegistro.id))
      } else {
        const [y, m, d] = modalEditarRegistro.dataISO.split('T')[0].split('-')
        const [hh, mm] = editHora.split(':')
        const newLocalDate = new Date(y, m - 1, d, hh, mm, 0)
        const newDataISO = newLocalDate.toISOString()
        
        await updateDoc(doc(db, 'pontos', modalEditarRegistro.id), {
          dataISO: newDataISO,
          atualizadoEm: serverTimestamp(),
          editadoManualmente: true
        })
        
        setPontos(prev => prev.map(p => p.id === modalEditarRegistro.id ? { ...p, dataISO: newDataISO } : p))
      }
      setModalEditarRegistro(null)
    } catch(err) {
      alert('Erro ao editar registro: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleExcluirSelecionados = async () => {
    if (selectedDays.length === 0) return
    if (!window.confirm(`Tem certeza que deseja excluir TODOS os registros dos ${selectedDays.length} dias selecionados?`)) return
    
    setSaving(true)
    try {
      const idsParaDeletar = pontos
        .filter(p => p.dataISO && selectedDays.includes(p.dataISO.split('T')[0]))
        .map(p => p.id)
        
      for (const id of idsParaDeletar) {
         await updateDoc(doc(db, 'pontos', id), {
            deletado: true,
            atualizadoEm: serverTimestamp()
         })
      }
      
      setPontos(prev => prev.filter(p => !idsParaDeletar.includes(p.id)))
      setSelectedDays([])
    } catch(err) {
      alert('Erro ao excluir selecionados: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleFecharPonto = async () => {
    if(!window.confirm(`Tem certeza que deseja FECHAR O PONTO de ${mesAno} para este colaborador?\nIsso consolidará os dados para a Folha de Pagamento.`)) return
    
    setSaving(true)
    try {
      // Aqui calcularíamos total de horas e salvaríamos na coleção 'fechamento_ponto'
      // Simplificação para MVP:
      
      let diasTrabalhados = 0
      let faltas = 0
      let folgas = 0
      let minutosTrabalhadosTotal = 0
      let minutosEsperadosTotal = 0
      
      Object.keys(dias).forEach(d => {
        const dia = dias[d]
        if(dia.status === 'Normal') diasTrabalhados++
        if(dia.status === 'Falta') faltas++
        if(dia.status === 'Folga') folgas++

        // Para os cálculos de horas (assumindo 8h/dia padrão para dias normais ou faltas)
        if (dia.status === 'Normal') {
           minutosEsperadosTotal += 8 * 60 // 8 horas esperadas
           
           const regs = dia.registros.sort((a,b) => new Date(a.dataISO) - new Date(b.dataISO))
           let entradaTemp = null
           
           regs.forEach(r => {
             if (r.tipo === 'Entrada') {
               entradaTemp = new Date(r.dataISO)
             } else if (r.tipo === 'Saída' && entradaTemp) {
               const saidaDate = new Date(r.dataISO)
               const diffMs = saidaDate - entradaTemp
               minutosTrabalhadosTotal += (diffMs / 1000 / 60) // converte ms para minutos
               entradaTemp = null
             }
           })
        } else if (dia.status === 'Falta') {
           minutosEsperadosTotal += 8 * 60 // Deveria ter trabalhado 8h e não trabalhou
        }
      })

      const colabInfo = colabs.find(c => c.id === selectedColab)

      const saldoMinutos = minutosTrabalhadosTotal - minutosEsperadosTotal
      const horasTrabalhadas = (minutosTrabalhadosTotal / 60).toFixed(2)
      const saldoHoras = (saldoMinutos / 60).toFixed(2) // Banco de horas (pode ser negativo)

      await addDoc(collection(db, 'fechamento_ponto'), {
        colabId: selectedColab,
        colabNome: colabInfo.nome,
        mesAno,
        diasTrabalhados,
        faltas,
        folgas,
        salarioBase: parseFloat(colabInfo.salario.replace(/[^\d,]/g, '').replace(',', '.')) || 0,
        fechadoEm: new Date().toISOString(),
        horasTrabalhadas,
        saldoHoras,
        minutosTrabalhadosTotal,
        minutosEsperadosTotal
      })
      
      alert('Ponto fechado com sucesso! Agora você pode gerar a Folha de Pagamento.')
    } catch (err) {
      alert('Erro ao fechar ponto: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card p-6 min-h-[500px]">
      <div className="flex flex-col md:flex-row gap-4 mb-6 pb-6 border-b border-cream-300">
        <div className="flex-1">
          <label className="label">Colaborador</label>
          <select className="input" value={selectedColab} onChange={e => setSelectedColab(e.target.value)}>
            <option value="">Selecione um colaborador...</option>
            {colabs.map(c => <option key={c.id} value={c.id}>{c.nome} ({c.cargo})</option>)}
          </select>
        </div>
        <div className="w-full md:w-48">
          <label className="label">Período (Mês/Ano)</label>
          <input type="month" className="input" value={mesAno} onChange={e => setMesAno(e.target.value)} />
        </div>
      </div>

      {!selectedColab ? (
        <div className="text-center py-10 text-gray-400 flex flex-col items-center">
          <Search size={40} className="mb-2 opacity-20" />
          <p>Selecione um colaborador para ver o espelho de ponto.</p>
        </div>
      ) : loading ? (
        <div className="text-center py-10 text-gray-400 flex flex-col items-center">
          <Loader2 size={32} className="animate-spin mb-2 text-brand-500" />
          <p>Carregando registros...</p>
        </div>
      ) : (
        <div>
          <div className="flex justify-between items-end mb-4">
            <h3 className="font-bold text-gray-800">Espelho de Ponto: {mesAno.split('-').reverse().join('/')}</h3>
            <div className="flex gap-2">
              {selectedDays.length > 0 && (
                <button onClick={handleExcluirSelecionados} disabled={saving} className="btn-secondary text-red-600 border-red-200 bg-red-50 hover:bg-red-100 flex items-center gap-2">
                  <Trash2 size={16} /> Excluir {selectedDays.length} Dias
                </button>
              )}
              <button onClick={handleFecharPonto} disabled={saving} className="btn-primary">
                <Save size={16} /> Fechar Ponto
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-cream-100 text-brand-700">
                <tr>
                  <th className="p-3 rounded-tl-lg w-10">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded text-brand-600"
                      checked={Object.keys(dias).length > 0 && selectedDays.length === Object.keys(dias).length}
                      onChange={e => {
                        if (e.target.checked) setSelectedDays(Object.keys(dias))
                        else setSelectedDays([])
                      }}
                    />
                  </th>
                  <th className="p-3">Data</th>
                  <th className="p-3">Registros (Entrada/Saída)</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-center">Saldo Diário</th>
                  <th className="p-3 rounded-tr-lg text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(dias).map(dataISO => {
                  const dia = dias[dataISO]
                  const objDate = new Date(dataISO + 'T12:00:00')
                  const diaStr = objDate.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
                  const isFds = objDate.getDay() === 0 || objDate.getDay() === 6
                  
                  return (
                    <tr key={dataISO} className={`border-b border-cream-200 ${isFds ? 'bg-cream-50' : ''} ${selectedDays.includes(dataISO) ? 'bg-red-50' : ''}`}>
                      <td className="p-3">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded text-brand-600"
                          checked={selectedDays.includes(dataISO)}
                          onChange={e => {
                            if (e.target.checked) setSelectedDays([...selectedDays, dataISO])
                            else setSelectedDays(selectedDays.filter(d => d !== dataISO))
                          }}
                        />
                      </td>
                      <td className="p-3 font-medium text-gray-700 capitalize">{diaStr}</td>
                      <td className="p-3">
                        {dia.registros.length > 0 ? (
                          <div className="flex gap-2 flex-wrap">
                            {dia.registros.map(r => (
                              <span key={r.id} className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${r.tipo === 'Entrada' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                {new Date(r.dataISO).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                                <button onClick={() => {
                                  setModalEditarRegistro(r)
                                  setEditHora(new Date(r.dataISO).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}))
                                }} className="hover:opacity-70 ml-1">
                                  <Edit2 size={12} />
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : <span className="text-gray-400 text-xs">—</span>}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          dia.status === 'Normal' ? 'bg-emerald-50 text-emerald-600' :
                          dia.status === 'Folga' ? 'bg-blue-50 text-blue-600' :
                          dia.status === 'Falta' ? 'bg-red-50 text-red-600' :
                          dia.status === 'Atestado' ? 'bg-purple-50 text-purple-600' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {dia.status}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                          {dia.status === 'Normal' || dia.status === 'Falta' ? (
                            <span className={`font-bold text-sm ${dia.saldoMinutos > 0 ? 'text-emerald-600' : dia.saldoMinutos < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                              {dia.saldoMinutos > 0 ? '+' : ''}{(dia.saldoMinutos / 60).toFixed(2)}h
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                      </td>
                      <td className="p-3 text-right">
                        <button 
                          onClick={() => setModalAjuste({ dataIso: dataISO, tipo: 'Folga' })}
                          className="text-xs text-brand-600 font-bold hover:underline"
                        >
                          Ajustar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-cream-100/50">
                <tr>
                  <td colSpan="4" className="p-4 text-right font-bold text-brand-800">Saldo Total de Horas Previsto no Mês:</td>
                  <td className="p-4 text-center">
                    <span className={`font-black text-lg px-3 py-1 rounded-xl ${totalSaldoHorasPrev > 0 ? 'bg-emerald-100 text-emerald-700' : totalSaldoHorasPrev < 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                      {totalSaldoHorasPrev > 0 ? '+' : ''}{totalSaldoHorasPrev}h
                    </span>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Modal Ajuste */}
      {modalAjuste && (
        <div className="modal-overlay" onClick={() => setModalAjuste(null)}>
          <div className="modal-content max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-cream-300">
              <h3 className="font-bold text-gray-800">Ajuste Manual: {new Date(modalAjuste.dataIso+'T12:00:00').toLocaleDateString('pt-BR')}</h3>
            </div>
            <form onSubmit={handleSalvarAjuste} className="p-5">
              <div className="mb-4">
                <label className="label">Status do Dia / Ajuste</label>
                <select 
                  className="input" 
                  value={modalAjuste.tipo} 
                  onChange={e => setModalAjuste({...modalAjuste, tipo: e.target.value})}
                >
                  <option value="Folga">Folga (DSR)</option>
                  <option value="Falta">Falta Injustificada</option>
                  <option value="Atestado">Atestado Médico</option>
                  <option value="Marcacao">1 Marcação Manual</option>
                  <option value="Dia Completo">Dia Completo (4 Marcações)</option>
                </select>
              </div>
              {modalAjuste.tipo === 'Dia Completo' && (
                <div className="mb-4 grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div>
                    <label className="label text-emerald-700">Entrada 1</label>
                    <input type="time" className="input bg-white" value={modalAjuste.horaE1 || ''} onChange={e => setModalAjuste({...modalAjuste, horaE1: e.target.value})} />
                  </div>
                  <div>
                    <label className="label text-red-700">Saída 1</label>
                    <input type="time" className="input bg-white" value={modalAjuste.horaS1 || ''} onChange={e => setModalAjuste({...modalAjuste, horaS1: e.target.value})} />
                  </div>
                  <div>
                    <label className="label text-emerald-700">Entrada 2</label>
                    <input type="time" className="input bg-white" value={modalAjuste.horaE2 || ''} onChange={e => setModalAjuste({...modalAjuste, horaE2: e.target.value})} />
                  </div>
                  <div>
                    <label className="label text-red-700">Saída 2</label>
                    <input type="time" className="input bg-white" value={modalAjuste.horaS2 || ''} onChange={e => setModalAjuste({...modalAjuste, horaS2: e.target.value})} />
                  </div>
                  <p className="col-span-2 text-xs text-gray-500 mt-2 text-center">Deixe em branco os horários que não quiser preencher.</p>
                </div>
              )}
              {modalAjuste.tipo === 'Marcacao' && (
                <div className="mb-4 flex gap-4">
                  <div className="flex-1">
                    <label className="label">Tipo</label>
                    <select className="input" value={modalAjuste.marcacaoTipo || 'Entrada'} onChange={e => setModalAjuste({...modalAjuste, marcacaoTipo: e.target.value})}>
                      <option value="Entrada">Entrada</option>
                      <option value="Saída">Saída</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="label">Horário</label>
                    <input type="time" className="input" value={modalAjuste.hora || '08:00'} onChange={e => setModalAjuste({...modalAjuste, hora: e.target.value})} required />
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModalAjuste(null)} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Editar Registro Individual */}
      {modalEditarRegistro && (
        <div className="modal-overlay" onClick={() => setModalEditarRegistro(null)}>
          <div className="modal-content max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-cream-300 flex justify-between items-center">
              <h3 className="font-bold text-gray-800">Editar Marcação</h3>
              <span className={`px-2 py-1 rounded text-xs font-bold ${modalEditarRegistro.tipo === 'Entrada' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                {modalEditarRegistro.tipo}
              </span>
            </div>
            <form onSubmit={e => handleEditarRegistro(e, 'salvar')} className="p-5">
              <div className="mb-4">
                <label className="label">Horário Registrado</label>
                <input type="time" className="input" value={editHora} onChange={e => setEditHora(e.target.value)} required />
              </div>
              <div className="flex justify-between items-center pt-2 mt-4 border-t border-cream-200">
                <button type="button" onClick={e => handleEditarRegistro(e, 'excluir')} disabled={saving} className="text-red-500 hover:text-red-700 flex items-center gap-1 text-sm font-bold">
                  <Trash2 size={16} /> Excluir
                </button>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setModalEditarRegistro(null)} className="btn-secondary">Cancelar</button>
                  <button type="submit" disabled={saving} className="btn-primary">
                    {saving ? <Loader2 size={16} className="animate-spin" /> : 'Salvar'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
