import React, { useState } from 'react'
import { Users, Clock, Calculator, BookOpen, FileDown } from 'lucide-react'
import RHColaboradores from '../components/rh/RHColaboradores'
import RHGestaoPonto from '../components/rh/RHGestaoPonto'
import RHFolhaPagamento from '../components/rh/RHFolhaPagamento'
import RHConvencoesIA from '../components/rh/RHConvencoesIA'
import RHExportacaoContabil from '../components/rh/RHExportacaoContabil'

export default function RH() {
  const [activeTab, setActiveTab] = useState('colaboradores')

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h2 className="section-title text-xl">Recursos Humanos (DP)</h2>
          <p className="section-sub">Gestão de colaboradores, ponto eletrônico e folha de pagamento</p>
        </div>
      </div>

      <div className="flex gap-2 p-1 bg-cream-200/50 border border-cream-300 rounded-xl w-fit">
        <button 
          onClick={() => setActiveTab('colaboradores')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'colaboradores' ? 'bg-white shadow-sm text-brand-700' : 'text-gray-500 hover:text-brand-600 hover:bg-white/50'}`}
        >
          <Users size={16} /> Colaboradores
        </button>
        <button 
          onClick={() => setActiveTab('ponto')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'ponto' ? 'bg-white shadow-sm text-brand-700' : 'text-gray-500 hover:text-brand-600 hover:bg-white/50'}`}
        >
          <Clock size={16} /> Gestão de Ponto
        </button>
        <button 
          onClick={() => setActiveTab('folha')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'folha' ? 'bg-white shadow-sm text-brand-700' : 'text-gray-500 hover:text-brand-600 hover:bg-white/50'}`}
        >
          <Calculator size={16} /> Folha de Pagamento
        </button>
        <button 
          onClick={() => setActiveTab('exportacao')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'exportacao' ? 'bg-white shadow-sm text-brand-700' : 'text-gray-500 hover:text-brand-600 hover:bg-white/50'}`}
        >
          <FileDown size={16} /> Exportação Contábil
        </button>
      </div>

      <div className="mt-2">
        {activeTab === 'colaboradores' && <RHColaboradores />}
        {activeTab === 'ponto' && <RHGestaoPonto />}
        {activeTab === 'folha' && <RHFolhaPagamento />}
        {activeTab === 'exportacao' && <RHExportacaoContabil />}
      </div>
    </div>
  )
}
