import React, { useState } from 'react'
import {
  PieChart, ListChecks, Plus, Trash2, CheckCircle2, AlertCircle,
  BarChart3, Clock, X, ExternalLink, Share2, MessageCircle, Users, ChevronDown, ChevronUp
} from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'
import { enviarEnqueteWhatsAppGrupo } from '../utils/whatsappAutomacao'

const statusBadge = s => ({ 'Aberta': 'badge-green', 'Encerrada': 'badge-red' }[s] || 'badge-blue')

export default function Enquetes() {
  const { user } = useAuth()
  const isAdminOrSindico = ['Administrador', 'Síndico'].includes(user?.role)
  const { items: enquetes, addItem, deleteItem, updateItem } = useFirestore('enquetes')
  const { items: condominios } = useFirestore('condominios')
  
  const [modal, setModal] = useState(false)
  const [verDetalhesId, setVerDetalhesId] = useState(null)
  const [condoFiltro, setCondoFiltro] = useState(user?.condominio || 'Todos')

  // Auto encerra votações cuja data limite já passou e filtra por condomínio
  const viewEnquetes = enquetes
    .filter(e => {
      if (condoFiltro && condoFiltro !== 'Todos') {
        const cEnquete = String(e.condominio || '').trim().toLowerCase()
        const cAlvo = String(condoFiltro).trim().toLowerCase()
        return cEnquete === cAlvo || cEnquete === 'todos' || !cEnquete
      }
      return true
    })
    .map(e => ({
      ...e,
      status: new Date(e.dataFim + 'T23:59:59') < new Date() ? 'Encerrada' : e.status
    })).sort((a,b) => new Date(b._createdAt) - new Date(a._createdAt))

  const handleSave = async (form) => {
    if (form.id) {
      await updateItem(form.id, form)
    } else {
      const docCriado = await addItem({ 
        ...form, 
        condominio: form.condominio || user?.condominio || '',
        criadoPor: user?.nome || user?.email || '',
        status: 'Aberta',
        votos: {}, // mapa de userId -> opcaoIndex
        votosDetalhes: {},
        _createdAt: new Date().toISOString()
      })
      const novoId = docCriado?.id || ''
      const enqueteCompleta = { ...form, id: novoId }

      try {
        const alvo = form.condominio || user?.condominio || ''
        const alvos = alvo === 'Todos'
          ? condominios.filter(c => c.grupoWhatsapp)
          : condominios.filter(c => (alvo ? c.nome === alvo : true) && c.grupoWhatsapp)
        for (const condoDoc of alvos) {
          enviarEnqueteWhatsAppGrupo(enqueteCompleta, condoDoc).catch(e => console.warn('Falha no disparo WhatsApp da enquete:', e))
        }
      } catch (e) { console.warn('Falha no disparo WhatsApp da enquete:', e) }
    }
    setModal(false)
  }

  const handleReenviarWhatsApp = async (enquete) => {
    const alvo = enquete.condominio || user?.condominio || ''
    const alvos = alvo === 'Todos'
      ? condominios.filter(c => c.grupoWhatsapp)
      : condominios.filter(c => (alvo ? c.nome === alvo : true) && c.grupoWhatsapp)

    if (alvos.length === 0) {
      alert('Nenhum condomínio com grupo de WhatsApp configurado para esta enquete.')
      return
    }

    if (!confirm(`Deseja disparar o link oficial desta enquete para o WhatsApp do condomínio?`)) return

    let enviados = 0
    for (const c of alvos) {
      const res = await enviarEnqueteWhatsAppGrupo(enquete, c)
      if (res?.success) enviados++
    }
    alert(`Link disparado com sucesso para ${enviados} condomínio(s)!`)
  }

  const handleCopiarLink = (enqueteId) => {
    const url = `${window.location.origin}/votacao/${enqueteId}`
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url)
      alert('Link público da enquete copiado para a área de transferência:\n' + url)
    } else {
      prompt('Copie o link público:', url)
    }
  }

  const handleVotar = async (enquete, opcaoIndex) => {
    if (enquete.status === 'Encerrada') return alert('Esta enquete já foi encerrada.')
    const confirmacao = confirm(`Confirmar voto em: "${enquete.opcoes[opcaoIndex]}"? Esta ação não pode ser desfeita.`)
    if (!confirmacao) return
    
    const novosVotos = { ...enquete.votos, [user.id]: opcaoIndex }
    const novosDetalhes = {
      ...(enquete.votosDetalhes || {}),
      [user.id]: {
        opcaoIndex,
        opcaoTexto: enquete.opcoes[opcaoIndex],
        nome: user?.nome || user?.email || 'Morador',
        unidade: user?.unidade || user?.apartamento || '',
        dataVoto: new Date().toISOString()
      }
    }
    await updateItem(enquete.id, { votos: novosVotos, votosDetalhes: novosDetalhes })
  }

  const encerrar = async (enquete) => {
    if (confirm('Encerrar votação agora? Acesso a novos votos será bloqueado.')) {
      await updateItem(enquete.id, { status: 'Encerrada' })
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h2 className="section-title text-xl">Enquetes e Votações</h2>
          <p className="section-sub">Participe das decisões do condomínio online</p>
        </div>
        {isAdminOrSindico && (
          <button onClick={() => setModal({})} className="btn-primary">
            <Plus size={16} />Nova Enquete
          </button>
        )}
      </div>

      {/* Barra de Filtro de Condomínio */}
      <div className="card p-3.5 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-2.5">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Filtrar por Condomínio:</label>
          <select 
            value={condoFiltro} 
            onChange={e => setCondoFiltro(e.target.value)}
            className="input py-1.5 px-3 text-sm font-semibold w-auto min-w-[220px]"
          >
            <option value="Todos">Todos os Condomínios (Geral)</option>
            {condominios.map(c => (
              <option key={c.id} value={c.nome}>{c.nome}</option>
            ))}
          </select>
        </div>
        <span className="text-xs text-gray-400 font-medium">
          Exibindo {viewEnquetes.length} enquete(s) {condoFiltro !== 'Todos' ? `em ${condoFiltro}` : ''}
        </span>
      </div>

      {viewEnquetes.length === 0 ? (
        <div className="card text-center py-20">
          <ListChecks size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">Nenhuma enquete ativa no momento.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {viewEnquetes.map(e => {
            const totalVotos = Object.keys(e.votos || {}).length
            const jaVotou = e.votos && e.votos[user?.id] !== undefined
            const meuVoto = jaVotou ? e.opcoes[e.votos[user.id]] : null
            
            // Computa contagem de votos por opcao
            const contagem = e.opcoes.map((_, i) => Object.values(e.votos || {}).filter(v => v === i).length)
            
            // Lista detalhada de moradores que votaram
            const listaVotantes = Object.values(e.votosDetalhes || {})
            const mostrandoDetalhes = verDetalhesId === e.id

            return (
              <div key={e.id} className="card p-0 overflow-hidden flex flex-col">
                <div className="p-5 border-b border-cream-200">
                  <div className="flex justify-between items-start mb-2">
                    <span className={`${statusBadge(e.status)} mb-2`}>{e.status}</span>
                    <div className="flex gap-2">
                      {isAdminOrSindico && e.status === 'Aberta' && (
                        <button onClick={() => encerrar(e)} className="text-gray-400 hover:text-red-500 transition-colors" title="Forçar Encerramento"><AlertCircle size={16} /></button>
                      )}
                      {isAdminOrSindico && (
                        <button onClick={() => deleteItem(e.id)} className="text-gray-400 hover:text-red-500 transition-colors" title="Excluir"><Trash2 size={16} /></button>
                      )}
                    </div>
                  </div>
                  <h3 className="font-bold text-lg text-gray-800 leading-tight mb-2">{e.pergunta}</h3>
                  <p className="text-sm text-gray-500 flex items-center gap-1.5"><Clock size={13}/> Votação até {new Date(e.dataFim + 'T23:59:59').toLocaleDateString('pt-BR')}</p>
                </div>
                
                <div className="p-5 flex-1 bg-gray-50/50">
                  {/* Para quem é Admin/Síndico OU se já votou OU se tem votos registrados: Exibe Parciais e Apuração */}
                  {(isAdminOrSindico || jaVotou || totalVotos > 0 || e.status === 'Encerrada') ? (
                     <div className="flex flex-col gap-4">
                       <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex justify-between items-center">
                         <span>Resultados em Tempo Real</span>
                         <span className="flex items-center gap-1 text-brand-600 font-bold bg-brand-50 px-2 py-0.5 rounded-md">
                           <BarChart3 size={13}/> {totalVotos} {totalVotos === 1 ? 'voto' : 'votos'}
                         </span>
                       </p>
                       
                       <div className="flex flex-col gap-3">
                         {e.opcoes.map((opcao, i) => {
                           const votosCrt = contagem[i] || 0
                           const pct = totalVotos === 0 ? 0 : Math.round((votosCrt / totalVotos) * 100)
                           const isVencedor = pct > 0 && votosCrt === Math.max(...contagem)

                           return (
                             <div key={i} className="relative">
                               <div className="flex justify-between text-xs font-semibold mb-1 relative z-10 px-1">
                                 <span className={isVencedor ? 'text-gray-800 font-bold' : 'text-gray-600'}>
                                   {opcao} {jaVotou && e.votos[user?.id] === i && ' (Seu Voto)'}
                                 </span>
                                 <span className={isVencedor ? 'text-brand-700 font-bold' : 'text-gray-400'}>
                                   {pct}% ({votosCrt})
                                 </span>
                               </div>
                               <div className="w-full bg-cream-300 rounded-full h-2.5 overflow-hidden">
                                 <div className={`h-2.5 rounded-full transition-all duration-1000 ${isVencedor ? 'bg-brand-500' : 'bg-gray-400'}`} style={{ width: `${pct}%` }} />
                               </div>
                             </div>
                           )
                         })}
                       </div>

                       {/* Se o usuário logado ainda não votou e a enquete está aberta, permite que ele vote também pelo painel */}
                       {!jaVotou && e.status === 'Aberta' && (
                         <div className="mt-2 pt-3 border-t border-cream-200">
                           <p className="text-xs font-semibold text-gray-500 mb-2">Selecione para registrar seu voto:</p>
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                             {e.opcoes.map((opcao, i) => (
                               <button key={i} onClick={() => handleVotar(e, i)} className="text-left px-3 py-2 rounded-lg border border-cream-300 bg-white hover:border-brand-500 hover:bg-brand-50/30 text-xs font-medium text-gray-700 transition-all">
                                 {opcao}
                               </button>
                             ))}
                           </div>
                         </div>
                       )}

                       {/* Lista de Votos Nominais para Síndico e Administrador */}
                       {isAdminOrSindico && totalVotos > 0 && (
                         <div className="mt-2 pt-2 border-t border-cream-200">
                           <button
                             onClick={() => setVerDetalhesId(mostrandoDetalhes ? null : e.id)}
                             className="flex items-center justify-between w-full text-xs font-bold text-gray-600 hover:text-brand-600 py-1 transition-colors"
                           >
                             <span className="flex items-center gap-1.5">
                               <Users size={13} /> {listaVotantes.length} morador(es) identificado(s)
                             </span>
                             {mostrandoDetalhes ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                           </button>

                           {mostrandoDetalhes && (
                             <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-1">
                               {listaVotantes.map((v, idx) => (
                                 <div key={idx} className="flex items-center justify-between text-[11px] bg-white p-2 rounded-lg border border-cream-200 shadow-xs">
                                   <div>
                                     <span className="font-bold text-gray-800">{v.nome}</span>
                                     {v.unidade && <span className="text-gray-400 ml-1">({v.unidade})</span>}
                                   </div>
                                   <span className="font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded">
                                     {v.opcaoTexto || e.opcoes[v.opcaoIndex]}
                                   </span>
                                 </div>
                               ))}
                             </div>
                           )}
                         </div>
                       )}
                       
                       {jaVotou && <div className="mt-1 p-2 bg-emerald-50 rounded-lg border border-emerald-100 flex items-center justify-center gap-2 text-emerald-700 text-xs font-medium"><CheckCircle2 size={14}/> Seu voto está computado!</div>}
                     </div>
                  ) : (
                     /* Caso seja um morador comum que ainda não votou e a enquete está aberta sem votos */
                     <div className="flex flex-col gap-3">
                       <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Escolha sua opção:</p>
                       {e.opcoes.map((opcao, i) => (
                         <button key={i} onClick={() => handleVotar(e, i)} className="w-full text-left p-3 rounded-xl border border-cream-300 bg-white hover:border-brand-400 hover:shadow-sm transition-all text-sm font-medium text-gray-700">
                           {opcao}
                         </button>
                       ))}
                     </div>
                  )}
                </div>

                {/* Rodapé do Card com Ações Públicas e Compartilhamento */}
                <div className="px-5 py-3 bg-gray-50 border-t border-cream-200 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-gray-400 truncate">
                    Condomínio: {e.condominio || 'Geral'}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleCopiarLink(e.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 hover:border-brand-400 text-gray-700 text-xs font-semibold transition-all shadow-xs"
                      title="Copiar link público para compartilhar"
                    >
                      <Share2 size={13} className="text-brand-600" />
                      <span className="hidden sm:inline">Copiar Link</span>
                    </button>
                    <a
                      href={`/votacao/${e.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 hover:border-brand-400 text-gray-700 text-xs font-semibold transition-all shadow-xs"
                      title="Abrir tela pública de votação (Aba Independente)"
                    >
                      <ExternalLink size={13} className="text-brand-600" />
                      <span className="hidden sm:inline">Abrir</span>
                    </a>
                    {isAdminOrSindico && (
                      <button
                        onClick={() => handleReenviarWhatsApp(e)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-all shadow-xs"
                        title="Disparar link desta enquete no grupo do WhatsApp"
                      >
                        <MessageCircle size={13} />
                        <span className="hidden sm:inline">WhatsApp</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal && <ModalEnqueteForm data={modal} user={user} condominios={condominios} onClose={() => setModal(false)} onSave={handleSave} />}
    </div>
  )
}

function ModalEnqueteForm({ data, user, condominios = [], onClose, onSave }) {
  const canSelectCondo = user?.role === 'Administrador' || !user?.condominio || condominios.length > 1
  const [form, setForm] = useState({
    id: data.id || null,
    pergunta: data.pergunta || '',
    condominio: data.condominio || user?.condominio || (condominios[0]?.nome || 'Todos'),
    dataFim: data.dataFim || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    opcoes: data.opcoes || ['CONCORDO', 'NÃO CONCORDO']
  })

  const addOpcao = () => setForm({ ...form, opcoes: [...form.opcoes, ''] })
  const removeOpcao = i => setForm({ ...form, opcoes: form.opcoes.filter((_, idx) => idx !== i) })
  const updateOpcao = (val, i) => {
    const novas = [...form.opcoes]
    novas[i] = val
    setForm({ ...form, opcoes: novas })
  }

  const submit = e => {
    e.preventDefault()
    if (!form.pergunta.trim()) return alert('Informe a pergunta da enquete.')
    if (form.opcoes.filter(o => o.trim()).length < 2) return alert('Informe ao menos duas opções.')
    onSave(form)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl animate-scale-up">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg text-gray-800">{form.id ? 'Editar Enquete' : 'Nova Enquete'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Condomínio</label>
            {canSelectCondo ? (
              <select
                className="input-field"
                value={form.condominio}
                onChange={e => setForm({ ...form, condominio: e.target.value })}
              >
                <option value="Todos">Todos os Condomínios (Geral)</option>
                {condominios.map(c => (
                  <option key={c.id} value={c.nome}>{c.nome}</option>
                ))}
              </select>
            ) : (
              <input type="text" className="input-field bg-gray-100" value={form.condominio} disabled />
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Pergunta / Assunto</label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Ex: Aprovação da pintura das faixas da garagem?"
              value={form.pergunta}
              onChange={e => setForm({ ...form, pergunta: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Data Limite de Votação</label>
            <input 
              type="date" 
              className="input-field" 
              value={form.dataFim}
              onChange={e => setForm({ ...form, dataFim: e.target.value })}
              required
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-gray-600">Opções de Voto</label>
              <button type="button" onClick={addOpcao} className="text-xs text-brand-600 font-semibold hover:underline">+ Adicionar Opção</button>
            </div>
            <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1">
              {form.opcoes.map((opcao, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input 
                    type="text" 
                    className="input-field flex-1" 
                    placeholder={`Opção ${i + 1}`}
                    value={opcao}
                    onChange={e => updateOpcao(e.target.value, i)}
                    required
                  />
                  {form.opcoes.length > 2 && (
                    <button type="button" onClick={() => removeOpcao(i)} className="text-red-400 hover:text-red-600">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary">Salvar Enquete</button>
          </div>
        </form>
      </div>
    </div>
  )
}
