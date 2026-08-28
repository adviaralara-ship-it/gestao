import React, { useState, useEffect } from 'react'
import { collection, query, getDocs, updateDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { CheckCircle2, XCircle, Clock, Calendar, FileText, Search } from 'lucide-react'

export default function RHSolicitacoesAjuste() {
  const [solicitacoes, setSolicitacoes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('Pendente')
  const [search, setSearch] = useState('')
  const [processandoId, setProcessandoId] = useState(null)

  const fetchSolicitacoes = async () => {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, 'solicitacoes_ajuste'))
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          if (a.status === 'Pendente' && b.status !== 'Pendente') return -1
          if (b.status === 'Pendente' && a.status !== 'Pendente') return 1
          return new Date(b.createdAt?.toDate ? b.createdAt.toDate() : b.createdAt || 0) - new Date(a.createdAt?.toDate ? a.createdAt.toDate() : a.createdAt || 0)
        })
      setSolicitacoes(list)
    } catch (err) {
      console.error('Erro ao buscar solicitacoes:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSolicitacoes()
  }, [])

  const handleAprovar = async (solic) => {
    if (!window.confirm(`Deseja aprovar o ajuste de ponto de ${solic.colabNome} para ${solic.data} às ${solic.hora} (${solic.tipoMarcacao || 'Entrada'})?`)) {
      return
    }

    try {
      setProcessandoId(solic.id)

      const dataIsoFormatada = `${solic.data}T${solic.hora}:00`
      await addDoc(collection(db, 'pontos'), {
        colabId: solic.colabId,
        colabNome: solic.colabNome,
        condominio: solic.condominio || '',
        dataISO: dataIsoFormatada,
        tipo: solic.tipoMarcacao || 'Entrada',
        isAjuste: true,
        ajusteTipo: `Ajuste Aprovado pelo RH`,
        justificativa: solic.justificativa || 'Ajuste solicitado pelo colaborador e aprovado pelo RH',
        foto: '',
        endereco: 'Ajuste Manual / RH',
        aprovadoPor: 'RH Alpha',
        createdAt: serverTimestamp()
      })

      await updateDoc(doc(db, 'solicitacoes_ajuste', solic.id), {
        status: 'Aprovado',
        respondidoEm: new Date().toISOString(),
        aprovadoPor: 'RH Alpha'
      })

      alert(`✅ Sucesso! Ajuste aprovado e lançado no espelho de ponto de ${solic.colabNome}.`)
      fetchSolicitacoes()
    } catch (err) {
      console.error(err)
      alert('Erro ao aprovar solicitação: ' + err.message)
    } finally {
      setProcessandoId(null)
    }
  }

  const handleRecusar = async (solic) => {
    const motivo = prompt(`Digite o motivo da recusa do ajuste para ${solic.colabNome} (opcional):`, 'Horário divergente da escala')
    if (motivo === null) return

    try {
      setProcessandoId(solic.id)
      await updateDoc(doc(db, 'solicitacoes_ajuste', solic.id), {
        status: 'Recusado',
        motivoRecusa: motivo,
        respondidoEm: new Date().toISOString(),
        recusadoPor: 'RH Alpha'
      })

      alert(`⚠️ Solicitação de ajuste recusada.`)
      fetchSolicitacoes()
    } catch (err) {
      console.error(err)
      alert('Erro ao recusar solicitação: ' + err.message)
    } finally {
      setProcessandoId(null)
    }
  }

  const pendentesCount = solicitacoes.filter(s => s.status === 'Pendente' || !s.status).length

  const filtered = solicitacoes.filter(s => {
    const statusAtual = s.status || 'Pendente'
    const matchStatus = filtroStatus === 'Todos' || statusAtual === filtroStatus
    const matchSearch = (s.colabNome || '').toLowerCase().includes(search.toLowerCase()) ||
                        (s.justificativa || '').toLowerCase().includes(search.toLowerCase()) ||
                        (s.data || '').includes(search)
    return matchStatus && matchSearch
  })

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={() => setFiltroStatus('Pendente')}
          className={`card text-left transition-all border-2 cursor-pointer ${filtroStatus === 'Pendente' ? 'bg-amber-50 border-amber-400 shadow-sm scale-[1.01]' : 'border-transparent hover:bg-slate-50'}`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-amber-800">Pendentes de Análise</span>
            <Clock size={16} className="text-amber-600" />
          </div>
          <p className="text-3xl font-black text-amber-700">{pendentesCount}</p>
        </button>

        <button
          onClick={() => setFiltroStatus('Aprovado')}
          className={`card text-left transition-all border-2 cursor-pointer ${filtroStatus === 'Aprovado' ? 'bg-emerald-50 border-emerald-400 shadow-sm scale-[1.01]' : 'border-transparent hover:bg-slate-50'}`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-emerald-800">Ajustes Aprovados</span>
            <CheckCircle2 size={16} className="text-emerald-600" />
          </div>
          <p className="text-3xl font-black text-emerald-700">
            {solicitacoes.filter(s => s.status === 'Aprovado').length}
          </p>
        </button>

        <button
          onClick={() => setFiltroStatus('Todos')}
          className={`card text-left transition-all border-2 cursor-pointer ${filtroStatus === 'Todos' ? 'bg-brand-50 border-brand-400 shadow-sm scale-[1.01]' : 'border-transparent hover:bg-slate-50'}`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-brand-800">Total de Solicitações</span>
            <FileText size={16} className="text-brand-600" />
          </div>
          <p className="text-3xl font-black text-brand-700">{solicitacoes.length}</p>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            className="input pl-9 text-xs"
            placeholder="Buscar por colaborador, justificativa ou data..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl border border-gray-200">
          {['Pendente', 'Aprovado', 'Recusado', 'Todos'].map(st => (
            <button
              key={st}
              onClick={() => setFiltroStatus(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filtroStatus === st ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="card text-center py-12 text-gray-400">
          <Clock size={32} className="mx-auto mb-2 animate-spin text-brand-500" />
          Carregando solicitações de ajuste...
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <CheckCircle2 size={36} className="mx-auto mb-2 opacity-40 text-emerald-500" />
          <p className="font-bold text-gray-600">Nenhuma solicitação encontrada no momento.</p>
          <p className="text-xs text-gray-400 mt-1">Todas as solicitações de ajuste dos colaboradores foram processadas.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(s => {
            const status = s.status || 'Pendente'
            const isPendente = status === 'Pendente'

            return (
              <div
                key={s.id}
                className={`p-4 rounded-2xl border transition-all ${isPendente ? 'bg-white border-amber-300 shadow-sm' : 'bg-slate-50/70 border-gray-200'}`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-sm ${isPendente ? 'bg-amber-500 text-white' : status === 'Aprovado' ? 'bg-emerald-600 text-white' : 'bg-rose-500 text-white'}`}>
                      {s.colabNome?.[0] || 'C'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-black text-gray-900 text-sm">{s.colabNome}</h4>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${isPendente ? 'bg-amber-100 text-amber-800 border border-amber-300' : status === 'Aprovado' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                          {status}
                        </span>
                        {s.condominio && (
                          <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold border border-slate-200">
                            🏢 {s.condominio}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-600 flex-wrap">
                        <span className="flex items-center gap-1 font-bold text-gray-800 bg-white px-2 py-0.5 rounded border border-gray-200">
                          <Calendar size={13} className="text-brand-600" />
                          Dia: {s.data ? new Date(s.data + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                        </span>
                        <span className="flex items-center gap-1 font-bold text-gray-800 bg-white px-2 py-0.5 rounded border border-gray-200">
                          <Clock size={13} className="text-brand-600" />
                          Horário: {s.hora || '—'} ({s.tipoMarcacao || 'Entrada'})
                        </span>
                      </div>

                      {s.justificativa && (
                        <div className="mt-2 text-xs bg-amber-50/70 p-2.5 rounded-xl border border-amber-200/80 text-amber-950">
                          <span className="font-bold text-amber-900 block mb-0.5">💬 Justificativa informada:</span>
                          {s.justificativa}
                        </div>
                      )}

                      {s.motivoRecusa && (
                        <div className="mt-2 text-xs bg-rose-50 p-2 rounded-lg border border-rose-200 text-rose-800 font-bold">
                          Motivo da recusa: {s.motivoRecusa}
                        </div>
                      )}
                    </div>
                  </div>

                  {isPendente ? (
                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                      <button
                        onClick={() => handleRecusar(s)}
                        disabled={processandoId === s.id}
                        className="px-3 py-2 bg-white hover:bg-rose-50 text-rose-600 border border-rose-300 rounded-xl text-xs font-black flex items-center gap-1 shadow-sm transition-all"
                      >
                        <XCircle size={15} /> Recusar
                      </button>
                      <button
                        onClick={() => handleAprovar(s)}
                        disabled={processandoId === s.id}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md transition-all hover:scale-105"
                      >
                        <CheckCircle2 size={15} /> Aprovar Ajuste
                      </button>
                    </div>
                  ) : (
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-gray-400 font-medium">
                        Respondido em {s.respondidoEm ? new Date(s.respondidoEm).toLocaleString('pt-BR') : '—'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
