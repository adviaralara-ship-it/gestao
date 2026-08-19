import React, { useState } from 'react'
import { Plus, Search, Filter, Handshake, FileText, ChevronRight, Eye, Pencil, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function Mediacao() {
  const navigate = useNavigate()
  const [mediacoes, setMediacoes] = useState([
    { id: '1', condominio: 'Residencial Flores', unidade: 'Apto 101', tipo: 'Financeira', status: 'Aguardando Assinatura', valor: 2500, data: '2026-08-15' },
    { id: '2', condominio: 'Condomínio Central', unidade: 'Apto 304', tipo: 'Comportamental', status: 'Em Negociação', valor: 0, data: '2026-08-18' },
  ])

  const handleDelete = (id) => {
    if(window.confirm('Tem certeza que deseja apagar esta mediação?')) {
      setMediacoes(mediacoes.filter(m => m.id !== id))
    }
  }

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Handshake className="text-brand-600" />
            Mediação & ODR
          </h1>
          <p className="text-gray-500">Resolução online de conflitos e acordos extrajudiciais</p>
        </div>
        <button 
          onClick={() => navigate('/mediacao/nova')}
          className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors font-medium">
          <Plus size={20} />
          Nova Mediação
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Buscar mediação por unidade ou condomínio..."
            className="w-full pl-10 pr-4 py-2 border border-pale-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-white border border-pale-300 rounded-lg text-gray-700 hover:bg-pale-100">
          <Filter size={20} />
          Filtros
        </button>
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-pale-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-pale-100 border-b border-pale-200 text-gray-600 text-sm">
                <th className="p-4 font-semibold">Condomínio / Unidade</th>
                <th className="p-4 font-semibold">Tipo</th>
                <th className="p-4 font-semibold">Valor Envolvido</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {mediacoes.map(m => (
                <tr key={m.id} className="border-b border-pale-100 hover:bg-pale-50 transition-colors">
                  <td className="p-4">
                    <p className="font-medium text-gray-800">{m.condominio}</p>
                    <p className="text-sm text-gray-500">{m.unidade}</p>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${m.tipo === 'Financeira' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                      {m.tipo}
                    </span>
                  </td>
                  <td className="p-4 text-gray-700 font-medium">
                    {m.valor > 0 ? `R$ ${m.valor.toFixed(2)}` : '-'}
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded-md">{m.status}</span>
                  </td>
                  <td className="p-4 text-right flex justify-end gap-2">
                    <button className="text-gray-500 hover:text-brand-600 p-2 rounded hover:bg-brand-50 transition-colors" title="Visualizar Sala do Morador">
                      <Eye size={18} />
                    </button>
                    <button className="text-gray-500 hover:text-blue-600 p-2 rounded hover:bg-blue-50 transition-colors" title="Editar Mediação">
                      <Pencil size={18} />
                    </button>
                    <button onClick={() => handleDelete(m.id)} className="text-gray-500 hover:text-red-600 p-2 rounded hover:bg-red-50 transition-colors" title="Apagar Mediação">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
