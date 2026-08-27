import React, { useState, useMemo } from 'react'
import { Plus, Search, Filter, Handshake, FileText, ChevronRight, Eye, Pencil, Trash2, Check, X, Building, DollarSign, Calendar } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'
import { format } from 'date-fns'

export default function Mediacao() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { items: mediacoes, add: addMediacao, update: updateMediacao, remove: removeMediacao } = useFirestore('mediacoes')
  const { items: condominios } = useFirestore('condominios')

  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('Todos')
  const [modalEdicaoAberto, setModalEdicaoAberto] = useState(false)
  const [mediacaoEmEdicao, setMediacaoEmEdicao] = useState(null)

  // Filtragem
  const mediacoesFiltradas = useMemo(() => {
    return mediacoes.filter(m => {
      const matchBusca = (m.condominio || '').toLowerCase().includes(busca.toLowerCase()) ||
                          (m.unidade || '').toLowerCase().includes(busca.toLowerCase()) ||
                          (m.morador || '').toLowerCase().includes(busca.toLowerCase()) ||
                          (m.assunto || '').toLowerCase().includes(busca.toLowerCase())
      const matchTipo = filtroTipo === 'Todos' || m.tipo === filtroTipo
      return matchBusca && matchTipo
    })
  }, [mediacoes, busca, filtroTipo])

  const handleDelete = async (id) => {
    if (window.confirm('Tem certeza que deseja apagar permanentemente esta mediação?')) {
      try {
        await removeMediacao(id)
        alert('Mediação excluída com sucesso.')
      } catch (err) {
        console.error(err)
        alert('Erro ao excluir mediação.')
      }
    }
  }

  const handleSalvarEdicao = async () => {
    if (!mediacaoEmEdicao?.condominio || !mediacaoEmEdicao?.unidade) {
      alert('Por favor, informe o condomínio e a unidade.')
      return
    }

    try {
      await updateMediacao(mediacaoEmEdicao.id, {
        ...mediacaoEmEdicao,
        valor: parseFloat(mediacaoEmEdicao.valor) || 0,
        updatedAt: new Date().toISOString()
      })
      setModalEdicaoAberto(false)
      setMediacaoEmEdicao(null)
      alert('Mediação atualizada com sucesso!')
    } catch (err) {
      console.error(err)
      alert('Erro ao salvar alterações da mediação.')
    }
  }

  return (
    <div className="p-4 md:p-6 h-full flex flex-col gap-6 max-w-7xl mx-auto w-full animate-fade-in pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <Handshake className="text-brand-600" />
            Mediação & ODR
          </h1>
          <p className="text-gray-500 font-medium text-xs md:text-sm mt-0.5">
            Resolução online de conflitos, acordos extrajudiciais e termos de conciliação.
          </p>
        </div>
        <button 
          onClick={() => navigate('/mediacao/nova')}
          className="btn-primary flex items-center gap-2 px-4 py-2.5 shadow-md">
          <Plus size={18} />
          Nova Mediação
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Buscar mediação por unidade, morador ou condomínio..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="input pl-10 text-sm bg-white"
          />
        </div>

        <select
          className="input text-xs py-2 w-full md:w-auto"
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value)}
        >
          <option value="Todos">Todos os Tipos</option>
          <option value="Financeira">Financeira</option>
          <option value="Comportamental">Comportamental</option>
          <option value="Estrutural">Estrutural</option>
          <option value="Outros">Outros</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-pale-300 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#2d3045] text-white border-b border-gray-200">
                <th className="p-3.5 font-bold">Condomínio / Unidade</th>
                <th className="p-3.5 font-bold">Tipo</th>
                <th className="p-3.5 font-bold">Assunto / Motivo</th>
                <th className="p-3.5 font-bold text-right">Valor Envolvido</th>
                <th className="p-3.5 font-bold text-center">Status</th>
                <th className="p-3.5 font-bold text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {mediacoesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400 font-medium">
                    Nenhuma mediação cadastrada no momento. Clique em "+ Nova Mediação" para iniciar um acordo.
                  </td>
                </tr>
              ) : (
                mediacoesFiltradas.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5">
                      <p className="font-black text-gray-900">{m.condominio || 'Geral'}</p>
                      <p className="text-gray-500 font-semibold">{m.unidade || m.apt || 'Apto/Unidade'}</p>
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] ${m.tipo === 'Financeira' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {m.tipo || 'Geral'}
                      </span>
                    </td>
                    <td className="p-3.5 font-medium text-gray-700 max-w-xs truncate">
                      {m.assunto || m.descricao || 'Acordo / Mediação'}
                    </td>
                    <td className="p-3.5 text-right font-black text-gray-900">
                      {m.valor > 0 ? `R$ ${(parseFloat(m.valor) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td className="p-3.5 text-center whitespace-nowrap">
                      <span className="text-[10px] font-bold text-gray-700 bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-md">
                        {m.status || 'Em Negociação'}
                      </span>
                    </td>
                    <td className="p-3.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button 
                          onClick={() => window.open(`/mediacao/sala/${m.id}`, '_blank')} 
                          className="p-1.5 text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" 
                          title="Visualizar Sala do Morador"
                        >
                          <Eye size={16} />
                        </button>
                        <button 
                          onClick={() => {
                            setMediacaoEmEdicao({ ...m })
                            setModalEdicaoAberto(true)
                          }}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" 
                          title="Editar Mediação / Termos"
                        >
                          <Pencil size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(m.id)} 
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
                          title="Apagar Mediação Permanentemente"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Edição de Termos e Mediação */}
      {modalEdicaoAberto && mediacaoEmEdicao && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl flex flex-col gap-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                <Handshake className="text-brand-600" size={20} />
                Editar Mediação & Termos do Acordo
              </h3>
              <button onClick={() => setModalEdicaoAberto(false)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="label font-bold text-gray-700">Condomínio</label>
                <input
                  type="text"
                  className="input font-medium"
                  value={mediacaoEmEdicao.condominio || ''}
                  onChange={e => setMediacaoEmEdicao({ ...mediacaoEmEdicao, condominio: e.target.value })}
                />
              </div>

              <div>
                <label className="label font-bold text-gray-700">Unidade / Apto</label>
                <input
                  type="text"
                  className="input font-medium"
                  value={mediacaoEmEdicao.unidade || mediacaoEmEdicao.apt || ''}
                  onChange={e => setMediacaoEmEdicao({ ...mediacaoEmEdicao, unidade: e.target.value })}
                />
              </div>

              <div>
                <label className="label font-bold text-gray-700">Tipo de Mediação</label>
                <select
                  className="input font-medium"
                  value={mediacaoEmEdicao.tipo || 'Financeira'}
                  onChange={e => setMediacaoEmEdicao({ ...mediacaoEmEdicao, tipo: e.target.value })}
                >
                  <option value="Financeira">Financeira (Dívidas / Acordos)</option>
                  <option value="Comportamental">Comportamental (Ruídos / Convivência)</option>
                  <option value="Estrutural">Estrutural (Obras / Vistorias)</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>

              <div>
                <label className="label font-bold text-gray-700">Valor Envolvido (R$)</label>
                <input
                  type="number"
                  className="input font-medium"
                  value={mediacaoEmEdicao.valor || 0}
                  onChange={e => setMediacaoEmEdicao({ ...mediacaoEmEdicao, valor: e.target.value })}
                />
              </div>

              <div className="md:col-span-2">
                <label className="label font-bold text-gray-700">Status da Mediação</label>
                <select
                  className="input font-medium"
                  value={mediacaoEmEdicao.status || 'Em Negociação'}
                  onChange={e => setMediacaoEmEdicao({ ...mediacaoEmEdicao, status: e.target.value })}
                >
                  <option value="Em Negociação">Em Negociação</option>
                  <option value="Aguardando Assinatura">Aguardando Assinatura</option>
                  <option value="Acordo Homologado">Acordo Homologado</option>
                  <option value="Cancelado / Sem Acordo">Cancelado / Sem Acordo</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="label font-bold text-gray-700">Termos do Acordo / Proposta de Mediação</label>
                <textarea
                  rows={4}
                  className="input font-medium resize-none"
                  placeholder="Descreva as condições acordadas, datas de pagamento, obrigações das partes..."
                  value={mediacaoEmEdicao.termos || mediacaoEmEdicao.descricao || ''}
                  onChange={e => setMediacaoEmEdicao({ ...mediacaoEmEdicao, termos: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-200">
              <button onClick={() => setModalEdicaoAberto(false)} className="btn-secondary text-xs">
                Cancelar
              </button>
              <button onClick={handleSalvarEdicao} className="btn-primary text-xs flex items-center gap-1.5 px-5">
                <Check size={16} /> Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
