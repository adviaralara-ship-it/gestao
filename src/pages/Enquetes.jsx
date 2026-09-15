import React, { useState } from 'react'
import {
  PieChart, ListChecks, Plus, Trash2, CheckCircle2, AlertCircle,
  BarChart3, Clock, X, ExternalLink, Share2, MessageCircle
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

  // Auto encerra votações cuja data limite já passou (visualmente)
  const viewEnquetes = enquetes.map(e => ({
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
            
            // Computa percentuais
            const contagem = e.opcoes.map((_, i) => Object.values(e.votos || {}).filter(v => v === i).length)

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
                  {(!jaVotou && e.status === 'Aberta') ? (
                     <div className="flex flex-col gap-3">
                       <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Escolha sua opção:</p>
                       {e.opcoes.map((opcao, i) => (
                         <button key={i} onClick={() => handleVotar(e, i)} className="w-full text-left p-3 rounded-xl border border-cream-300 bg-white hover:border-brand-400 hover:shadow-sm transition-all text-sm font-medium text-gray-700">
                           {opcao}
                         </button>
                       ))}
                     </div>
                  ) : (
                     <div className="flex flex-col gap-4">
                       <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex justify-between">
                         <span>Resultados Parciais</span>
                         <span className="flex items-center gap-1 text-brand-600"><BarChart3 size={12}/> {totalVotos} votos</span>
                       </p>
                       
                       <div className="flex flex-col gap-3">
                         {e.opcoes.map((opcao, i) => {
                           const votosCrt = contagem[i]
                           const pct = totalVotos === 0 ? 0 : Math.round((votosCrt / totalVotos) * 100)
                           const isVencedor = pct > 0 && pct === Math.max(...contagem.map((v,j) => totalVotos ? Math.round((v/totalVotos)*100) : 0))

                           return (
                             <div key={i} className="relative">
                               <div className="flex justify-between text-xs font-semibold mb-1 relative z-10 px-1">
                                 <span className={isVencedor ? 'text-gray-800' : 'text-gray-500'}>
                                   {opcao} {jaVotou && e.votos[user.id] === i && ' (Seu Voto)'}
                                 </span>
                                 <span className={isVencedor ? 'text-brand-700 font-bold' : 'text-gray-400'}>{pct}%</span>
                               </div>
                               <div className="w-full bg-cream-300 rounded-full h-2">
                                 <div className={`h-2 rounded-full transition-all duration-1000 ${isVencedor ? 'bg-brand-500' : 'bg-gray-400'}`} style={{ width: `${pct}%` }} />
                               </div>
                             </div>
                           )
                         })}
                       </div>
                       
                       {jaVotou && <div className="mt-2 p-3 bg-emerald-50 rounded-lg border border-emerald-100 flex items-center justify-center gap-2 text-emerald-700 text-sm font-medium"><CheckCircle2 size={16}/> Voto computado com sucesso!</div>}
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
  const isAdmin = user?.role === 'Administrador'
  const [form, setForm] = useState(data.id ? data : { pergunta: '', dataFim: '', opcoes: ['', ''], condominio: isAdmin ? 'Todos' : (user?.condominio || '') })

  const addOpcao = () => setForm(f => ({ ...f, opcoes: [...f.opcoes, ''] }))
  const updateOpcao = (i, val) => {
    const newOp = [...form.opcoes]
    newOp[i] = val
    setForm(f => ({ ...f, opcoes: newOp }))
  }
  const removeOpcao = (i) => setForm(f => ({ ...f, opcoes: f.opcoes.filter((_, idx) => idx !== i) }))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">Criar Nova Enquete</h3>
          <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-700" /></button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          {isAdmin ? (
            <div><label className="label">Condomínio *</label><select className="input w-full" value={form.condominio || 'Todos'} onChange={e => setForm(f => ({ ...f, condominio: e.target.value }))}><option value="Todos">Todos os Condomínios</option>{condominios.map(c => (<option key={c.id} value={c.nome}>{c.nome}</option>))}</select></div>
          ) : (
            <div><label className="label">Condomínio</label><input className="input w-full" value={form.condominio || user?.condominio || ''} disabled /></div>
          )}
          <div><label className="label">Pergunta em pauta *</label><textarea className="input w-full min-h-[80px]" value={form.pergunta} onChange={e => setForm(f => ({ ...f, pergunta: e.target.value }))} placeholder="Insira o tema da votação..." autoFocus /></div>
          <div><label className="label">Data de Encerramento *</label><input type="date" className="input w-full" value={form.dataFim} onChange={e => setForm(f => ({ ...f, dataFim: e.target.value }))} /></div>
          
          <div className="border-t border-cream-300 pt-4 mt-2">
            <label className="label mb-2">Opções de Voto</label>
            <div className="flex flex-col gap-2">
              {form.opcoes.map((op, i) => (
                <div key={i} className="flex gap-2">
                  <input className="input flex-1" value={op} onChange={e => updateOpcao(i, e.target.value)} placeholder={`Opção ${i+1}`} />
                  {form.opcoes.length > 2 && <button onClick={() => removeOpcao(i)} className="btn-secondary px-2 text-red-500 hover:bg-red-50 hover:border-red-200"><X size={14}/></button>}
                </div>
              ))}
            </div>
            <button onClick={addOpcao} className="text-sm font-semibold text-brand-600 mt-3 hover:underline">+ Adicionar Opção</button>
          </div>
        </div>
        <div className="p-6 border-t border-cream-300 flex gap-3 justify-end bg-gray-50/50 rounded-b-2xl">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={() => { 
            if(!form.pergunta || !form.dataFim || form.opcoes.some(v => !v.trim())) return alert('Preecha pergunta, encerramento e todos os campos de opção.')
            if(isAdmin && !form.condominio) return alert('Selecione o condomínio da enquete.')
            onSave(form) 
          }} className="btn-primary">Criar Votação</button>
        </div>
      </div>
    </div>
  )
}
