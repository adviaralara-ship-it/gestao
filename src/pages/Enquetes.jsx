import React, { useState } from 'react'
import { PieChart, ListChecks, Plus, Trash2, CheckCircle2, AlertCircle, BarChart3, Clock, X } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'

const statusBadge = s => ({ 'Aberta': 'badge-green', 'Encerrada': 'badge-red' }[s] || 'badge-blue')

export default function Enquetes() {
  const { user } = useAuth()
  const isAdminOrSindico = ['Administrador', 'Síndico'].includes(user?.role)
  const { items: enquetes, addItem, deleteItem, updateItem } = useFirestore('enquetes')
  
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
      await addItem({ 
        ...form, 
        status: 'Aberta',
        votos: {}, // mapa de userId -> opcaoIndex
        _createdAt: new Date().toISOString()
      })
    }
    setModal(false)
  }

  const handleVotar = async (enquete, opcaoIndex) => {
    if (enquete.status === 'Encerrada') return alert('Esta enquete já foi encerrada.')
    const confirmacao = confirm(`Confirmar voto em: "${enquete.opcoes[opcaoIndex]}"? Esta ação não pode ser desfeita.`)
    if (!confirmacao) return
    
    const novosVotos = { ...enquete.votos, [user.id]: opcaoIndex }
    await updateItem(enquete.id, { votos: novosVotos })
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
              </div>
            )
          })}
        </div>
      )}

      {modal && <ModalEnqueteForm data={modal} onClose={() => setModal(false)} onSave={handleSave} />}
    </div>
  )
}

function ModalEnqueteForm({ data, onClose, onSave }) {
  const [form, setForm] = useState(data.id ? data : { pergunta: '', dataFim: '', opcoes: ['', ''] })

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
            onSave(form) 
          }} className="btn-primary">Criar Votação</button>
        </div>
      </div>
    </div>
  )
}
