import React, { useState, useEffect } from 'react'
import { collection, query, where, getDocs, updateDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore'
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
          .filter(p => p.dataISO && p.dataISO.startsWith(mesAno))
          .sort((a,b) => new Date(a.dataISO) - new Date(b.dataISO))
        
        setPontos(list)
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

  const handleSalvarAjuste = async (e) => {
    e.preventDefault()
    setSaving(true)
    const { dataIso, tipo, hora, marcacaoTipo } = modalAjuste
    try {
      const colabInfo = colabs.find(c => c.id === selectedColab)
      const loc = { lat: 0, lng: 0, isFallback: true }
      
      let dataFinalISO
      let pontoTipo
      let isAjusteStatus = false
      let ajusteTipoVal = null
      
      if (tipo === 'Marcacao') {
         // Gambiarra rápida para salvar a hora local como se fosse UTC para não mudar de dia na exibição
         dataFinalISO = `${dataIso}T${hora || '08:00'}:00.000Z`
         pontoTipo = marcacaoTipo || 'Entrada'
      } else {
         dataFinalISO = `${dataIso}T12:00:00.000Z`
         pontoTipo = 'Ajuste'
         isAjusteStatus = true
         ajusteTipoVal = tipo
      }
      
      await addDoc(collection(db, 'pontos'), {
        colabId: selectedColab,
        colabNome: colabInfo.nome,
        tipo: pontoTipo,
        location: loc,
        photoBase64: null,
        timestamp: serverTimestamp(),
        dataISO: dataFinalISO,
        isAjuste: isAjusteStatus,
        ajusteTipo: ajusteTipoVal,
        manual: true
      })
      
      setPontos(prev => [...prev, {
        id: Date.now().toString(),
        colabId: selectedColab,
        dataISO: dataFinalISO,
        tipo: pontoTipo,
        isAjuste: isAjusteStatus,
        ajusteTipo: ajusteTipoVal,
        manual: true
      }])
      
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
          deletado: true, // Soft delete ou podemos fazer deleteDoc
          atualizadoEm: serverTimestamp()
        })
        // Atualiza estado local
        setPontos(prev => prev.filter(p => p.id !== modalEditarRegistro.id))
      } else {
        // Atualizar hora
        const oldData = new Date(modalEditarRegistro.dataISO)
        const datePart = oldData.toISOString().split('T')[0]
        const newDataISO = `${datePart}T${editHora}:00.000Z`
        
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

  const handleFecharPonto = async () => {
    if(!window.confirm(`Tem certeza que deseja FECHAR O PONTO de ${mesAno} para este colaborador?\nIsso consolidará os dados para a Folha de Pagamento.`)) return
    
    setSaving(true)
    try {
      // Aqui calcularíamos total de horas e salvaríamos na coleção 'fechamento_ponto'
      // Simplificação para MVP:
      
      let diasTrabalhados = 0
      let faltas = 0
      let folgas = 0
      
      Object.keys(dias).forEach(d => {
        if(dias[d].status === 'Normal') diasTrabalhados++
        if(dias[d].status === 'Falta') faltas++
        if(dias[d].status === 'Folga') folgas++
      })

      const colabInfo = colabs.find(c => c.id === selectedColab)

      await addDoc(collection(db, 'fechamento_ponto'), {
        colabId: selectedColab,
        colabNome: colabInfo.nome,
        mesAno: mesAno,
        diasTrabalhados,
        faltas,
        folgas,
        salarioBase: parseFloat(colabInfo.salario.replace(/[^\d,]/g, '').replace(',', '.')) || 0,
        fechadoEm: new Date().toISOString()
      })

      alert('Ponto fechado com sucesso! Os dados foram enviados para a Folha de Pagamento.')
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
            <button onClick={handleFecharPonto} disabled={saving} className="btn-primary">
              <Save size={16} /> Fechar Ponto
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-cream-100 text-brand-700">
                <tr>
                  <th className="p-3 rounded-tl-lg">Data</th>
                  <th className="p-3">Registros (Entrada/Saída)</th>
                  <th className="p-3">Status</th>
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
                    <tr key={dataISO} className={`border-b border-cream-200 ${isFds ? 'bg-cream-50' : ''}`}>
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
                  <option value="Marcacao">Adicionar Marcação Manual</option>
                </select>
              </div>
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
