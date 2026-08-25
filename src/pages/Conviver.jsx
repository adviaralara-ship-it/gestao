import React, { useState, useMemo } from 'react'
import { HeartHandshake, Search, Filter, AlertTriangle, ShieldCheck, CheckCircle2 } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'

export default function Conviver() {
  const { user } = useAuth()
  const { items: ocorrencias, updateItem } = useFirestore('ocorrencias')
  const [condominioFiltro, setCondominioFiltro] = useState(user?.condominio || '')
  
  // Condomínios disponíveis no BD
  const condominios = useMemo(() => {
    const list = ocorrencias.map(o => o.condominio).filter(Boolean)
    return [...new Set(list)]
  }, [ocorrencias])

  // Filtragem (só mostra níveis 2 e 3 para conviver)
  const tasks = ocorrencias.filter(o => {
    const matchCondominio = !condominioFiltro || o.condominio === condominioFiltro
    // Vamos considerar que o Método Conviver cuida de todos os casos de convivência
    const matchTipo = ['Perturbação', 'Conduta', 'Outros', 'Barulho', 'Animais', 'Garagem'].includes(o.categoria)
    return matchCondominio && matchTipo
  })

  // Etapas do Método Conviver
  const colunas = [
    { id: 'Receber', titulo: '📥 Receber' },
    { id: 'Analisar', titulo: '🔎 Analisar' },
    { id: 'Ouvir', titulo: '👂 Ouvir' },
    { id: 'Orientar', titulo: '🧭 Orientar' },
    { id: 'Mediar', titulo: '🤝 Mediar' },
    { id: 'Acordo', titulo: '📝 Acordo' },
    { id: 'Acompanhar', titulo: '👀 Acompanhar' },
    { id: 'Encerrar', titulo: '✅ Encerrar' },
  ]

  const moveTask = async (id, stepId) => {
    await updateItem(id, { stepConviver: stepId })
  }

  const getCol = (task) => task.stepConviver || 'Receber'

  return (
    <div className="flex flex-col h-full bg-cream-50">
      <div className="p-6 pb-2">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <HeartHandshake className="text-brand-600" /> Método CONVIVER+
        </h1>
        <p className="text-gray-500 text-sm mt-1">Gestão Inteligente de Conflitos e Convivência</p>
        
        {/* Filtros */}
        {user?.role !== 'Morador' && (
          <div className="mt-4 flex gap-4">
            <select 
              className="input max-w-xs" 
              value={condominioFiltro} 
              onChange={e => setCondominioFiltro(e.target.value)}
            >
              <option value="">Todos os Condomínios</option>
              {condominios.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Quadro Kanban */}
      <div className="flex-1 overflow-x-auto p-6 flex gap-4 items-start">
        {colunas.map(col => {
          const items = tasks.filter(t => getCol(t) === col.id)
          return (
            <div key={col.id} className="min-w-[280px] bg-gray-100 rounded-lg flex flex-col max-h-full">
              <div className="p-3 border-b border-gray-200 bg-gray-50 rounded-t-lg flex justify-between items-center">
                <span className="font-bold text-gray-700 text-sm">{col.titulo}</span>
                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{items.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
                {items.map(t => (
                  <div key={t.id} className="bg-white p-3 rounded shadow-sm border border-gray-200 text-sm flex flex-col gap-2">
                    <div className="font-bold text-gray-800">{t.titulo}</div>
                    <div className="text-xs text-gray-500 line-clamp-2">{t.descricao}</div>
                    
                    <div className="flex flex-wrap gap-1 mt-1">
                      <span className="badge-blue text-[10px]">{t.categoria}</span>
                      <span className="badge-yellow text-[10px]">Apt {t.apt}</span>
                    </div>

                    {/* Botões de Ação para avançar etapa */}
                    <div className="mt-2 pt-2 border-t border-gray-100 flex gap-2 overflow-x-auto">
                      {colunas.map(c => (
                        c.id !== col.id && (
                          <button 
                            key={c.id} 
                            onClick={() => moveTask(t.id, c.id)}
                            className="text-[10px] px-2 py-1 bg-gray-100 hover:bg-brand-50 hover:text-brand-700 rounded transition-colors whitespace-nowrap"
                          >
                            Para {c.titulo.split(' ')[1]}
                          </button>
                        )
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
