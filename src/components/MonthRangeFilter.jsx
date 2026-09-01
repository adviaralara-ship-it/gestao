import React from 'react'
import { Calendar, X, RotateCcw } from 'lucide-react'

export default function MonthRangeFilter({ 
  mesDe, 
  setMesDe, 
  mesAte, 
  setMesAte,
  className = ''
}) {
  const hoje = new Date()
  const mesAtualStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`

  const setPeriodoRapido = (tipo) => {
    const d = new Date()
    const ano = d.getFullYear()

    if (tipo === 'atual') {
      setMesDe(mesAtualStr)
      setMesAte(mesAtualStr)
    } else if (tipo === '3meses') {
      const dInicio = new Date()
      dInicio.setMonth(dInicio.getMonth() - 2)
      const mesInicioStr = `${dInicio.getFullYear()}-${String(dInicio.getMonth() + 1).padStart(2, '0')}`
      setMesDe(mesInicioStr)
      setMesAte(mesAtualStr)
    } else if (tipo === '6meses') {
      const dInicio = new Date()
      dInicio.setMonth(dInicio.getMonth() - 5)
      const mesInicioStr = `${dInicio.getFullYear()}-${String(dInicio.getMonth() + 1).padStart(2, '0')}`
      setMesDe(mesInicioStr)
      setMesAte(mesAtualStr)
    } else if (tipo === 'ano') {
      setMesDe(`${ano}-01`)
      setMesAte(`${ano}-12`)
    } else if (tipo === 'todos') {
      setMesDe('')
      setMesAte('')
    }
  }

  const hasFilter = Boolean(mesDe || mesAte)

  return (
    <div className={`flex flex-wrap items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs ${className}`}>
      <div className="flex items-center gap-1.5 text-slate-700 font-bold shrink-0">
        <Calendar size={15} className="text-brand-600" />
        <span>Período:</span>
      </div>

      {/* Input De */}
      <div className="flex items-center gap-1">
        <span className="text-gray-500 font-medium">De:</span>
        <input
          type="month"
          className="input py-1 px-2 text-xs font-bold text-slate-800 bg-white border-slate-300 rounded-lg shadow-sm focus:ring-brand-500"
          value={mesDe}
          onChange={e => setMesDe(e.target.value)}
        />
      </div>

      {/* Input Até */}
      <div className="flex items-center gap-1">
        <span className="text-gray-500 font-medium">Até:</span>
        <input
          type="month"
          className="input py-1 px-2 text-xs font-bold text-slate-800 bg-white border-slate-300 rounded-lg shadow-sm focus:ring-brand-500"
          value={mesAte}
          onChange={e => setMesAte(e.target.value)}
        />
      </div>

      {/* Botões Rápidos */}
      <div className="flex items-center gap-1 flex-wrap">
        <button
          type="button"
          onClick={() => setPeriodoRapido('atual')}
          className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all ${mesDe === mesAtualStr && mesAte === mesAtualStr ? 'bg-brand-600 text-white' : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'}`}
        >
          Este Mês
        </button>
        <button
          type="button"
          onClick={() => setPeriodoRapido('3meses')}
          className="px-2 py-1 bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-md text-[11px] font-bold transition-all"
        >
          Últimos 3 Meses
        </button>
        <button
          type="button"
          onClick={() => setPeriodoRapido('6meses')}
          className="px-2 py-1 bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-md text-[11px] font-bold transition-all"
        >
          Últimos 6 Meses
        </button>
        <button
          type="button"
          onClick={() => setPeriodoRapido('ano')}
          className="px-2 py-1 bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-md text-[11px] font-bold transition-all"
        >
          Este Ano
        </button>
        {hasFilter && (
          <button
            type="button"
            onClick={() => setPeriodoRapido('todos')}
            className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md text-[11px] font-bold flex items-center gap-1 transition-all"
            title="Limpar filtro de período"
          >
            <X size={12} /> Limpar
          </button>
        )}
      </div>
    </div>
  )
}
