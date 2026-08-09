import React, { useState } from 'react'
import { Plus, Trash2, Mail, Phone, Video, Download, Briefcase, FileText, CheckCircle2, Copy } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'

const COLUMNS = [
  { id: 'Novo', title: 'Novos Currículos', color: 'border-blue-500', bg: 'bg-blue-50' },
  { id: 'Entrevista', title: 'Entrevista', color: 'border-yellow-500', bg: 'bg-yellow-50' },
  { id: 'Teste Prático', title: 'Teste Prático', color: 'border-purple-500', bg: 'bg-purple-50' },
  { id: 'Aprovado', title: 'Aprovados', color: 'border-emerald-500', bg: 'bg-emerald-50' },
  { id: 'Reprovado', title: 'Reprovados', color: 'border-red-500', bg: 'bg-red-50' }
]

function ModalVaga({ data, onClose, onSave }) {
  const [form, setForm] = useState(data || { 
    titulo: '', descricao: '', cargaHoraria: '', salario: '', local: '', status: 'Aberta'
  })

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-xl" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300">
          <h3 className="font-bold text-gray-800">{data ? 'Editar Vaga' : 'Nova Vaga Pública'}</h3>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="label">Título da Vaga</label>
            <input required className="input" value={form.titulo} onChange={e => setForm({...form, titulo: e.target.value})} placeholder="Ex: Porteiro Diurno" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Local / Condomínio</label>
              <input required className="input" value={form.local} onChange={e => setForm({...form, local: e.target.value})} placeholder="Bloco A, Portaria Principal..." />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                <option>Aberta</option>
                <option>Fechada</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Carga Horária</label>
              <input className="input" value={form.cargaHoraria} onChange={e => setForm({...form, cargaHoraria: e.target.value})} placeholder="Ex: 12x36" />
            </div>
            <div>
              <label className="label">Salário (Opcional)</label>
              <input className="input" value={form.salario} onChange={e => setForm({...form, salario: e.target.value})} placeholder="Ex: R$ 2.000,00" />
            </div>
          </div>
          <div>
            <label className="label">Descrição e Requisitos</label>
            <textarea required className="input min-h-[100px] resize-none" value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} placeholder="Descreva as atividades, benefícios e requisitos..."/>
          </div>
        </div>
        <div className="p-6 border-t border-cream-300 flex justify-end gap-3 bg-cream-50 rounded-b-2xl">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={() => { onSave(form); onClose() }} disabled={!form.titulo || !form.descricao} className="btn-primary">Salvar Vaga</button>
        </div>
      </div>
    </div>
  )
}

function ModalDocsAdmissao({ candidato, onClose }) {
  const docs = candidato.documentosDigitais || {}
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex justify-between items-center">
          <h3 className="font-bold text-gray-800">Documentos de Admissão - {candidato.nome}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-cream-200">
            <div><span className="text-xs text-gray-500 block">Nome Completo:</span><strong className="text-sm">{candidato.dadosPessoais?.nomeCompleto}</strong></div>
            <div><span className="text-xs text-gray-500 block">Data de Nascimento:</span><strong className="text-sm">{candidato.dadosPessoais?.dataNascimento?.split('-').reverse().join('/')}</strong></div>
            <div><span className="text-xs text-gray-500 block">Nome da Mãe:</span><strong className="text-sm">{candidato.dadosPessoais?.nomeMae}</strong></div>
            <div><span className="text-xs text-gray-500 block">Estado Civil:</span><strong className="text-sm">{candidato.dadosPessoais?.estadoCivil}</strong></div>
            <div className="col-span-2"><span className="text-xs text-gray-500 block">Endereço:</span><strong className="text-sm">{candidato.dadosPessoais?.endereco}</strong></div>
          </div>
          
          <div>
            <h4 className="font-bold text-brand-900 mb-3 text-sm">Arquivos Anexados</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.keys(docs).map(key => (
                <a key={key} href={docs[key]} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center p-4 border border-cream-300 rounded-xl hover:bg-brand-50 hover:border-brand-300 transition-colors">
                  <FileText size={24} className="text-brand-500 mb-2"/>
                  <span className="text-xs font-bold text-gray-700 uppercase">{key}</span>
                </a>
              ))}
              {Object.keys(docs).length === 0 && <p className="text-xs text-gray-500">Nenhum documento anexado.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Recrutamento() {
  const { items: vagas, addItem: addVaga, updateItem: updVaga, deleteItem: delVaga } = useFirestore('vagas')
  const { items: candidatos, updateItem: updCandidato, deleteItem: delCandidato } = useFirestore('candidatos')
  
  const [tab, setTab] = useState('candidatos') // 'vagas' ou 'candidatos'
  const [modalVaga, setModalVaga] = useState(null)
  const [modalDocs, setModalDocs] = useState(null)
  const [dragging, setDragging] = useState(null)

  const handleDragStart = (e, candidato) => {
    setDragging(candidato)
    e.dataTransfer.setData('text/plain', candidato.id)
  }
  const handleDragOver = (e) => e.preventDefault()
  const handleDrop = async (e, targetStatus) => {
    e.preventDefault()
    if (!dragging) return
    if (dragging.status !== targetStatus) {
      await updCandidato(dragging.id, { status: targetStatus })
    }
    setDragging(null)
  }

  const handleCopyLink = (id) => {
    const link = `${window.location.origin}/onboarding/${id}`
    navigator.clipboard.writeText(link)
    alert("Link de admissão copiado para a área de transferência!")
  }

  return (
    <div className="flex flex-col h-full min-h-[85vh] animate-fade-in gap-6">
      <div className="page-header shrink-0">
        <div>
          <h2 className="section-title text-xl">Recrutamento & Seleção</h2>
          <p className="section-sub">Gerencie vagas públicas e candidatos pelo funil.</p>
        </div>
        <div className="flex gap-3">
          <a href="/trabalhe-conosco" target="_blank" rel="noreferrer" className="btn-secondary border-brand-200 text-brand-600 hover:bg-brand-50">
             Ver Portal Público
          </a>
          <button onClick={() => window.open('/conferencias', '_blank')} className="btn-secondary border-brand-200 text-brand-600 hover:bg-brand-50">
            <Video size={16} /> Sala de Entrevista
          </button>
        </div>
      </div>

      <div className="flex gap-2 shrink-0">
        <button onClick={() => setTab('candidatos')} className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab==='candidatos'?'bg-brand-600 text-white':'bg-white text-gray-500 border border-cream-400 hover:text-brand-700'}`}>Funil de Candidatos</button>
        <button onClick={() => setTab('vagas')} className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab==='vagas'?'bg-brand-600 text-white':'bg-white text-gray-500 border border-cream-400 hover:text-brand-700'}`}>Gerenciar Vagas</button>
      </div>

      {tab === 'vagas' && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-end">
            <button onClick={() => setModalVaga('new')} className="btn-primary"><Plus size={14}/> Nova Vaga Pública</button>
          </div>
          {vagas.length === 0 ? (
            <div className="card text-center py-10 text-gray-400 text-sm">Nenhuma vaga cadastrada.</div>
          ) : (
            vagas.map(v => (
              <div key={v.id} className="card hover:border-brand-300 transition-all flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    {v.titulo} 
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${v.status==='Aberta'?'bg-emerald-100 text-emerald-700':'bg-gray-200 text-gray-600'}`}>{v.status}</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">📍 {v.local} &nbsp;|&nbsp; 🕒 {v.cargaHoraria}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setModalVaga(v)} className="btn-secondary py-1.5 px-3 text-xs">Editar</button>
                  <button onClick={() => delVaga(v.id)} className="p-1.5 rounded-lg bg-cream-100 hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'candidatos' && (
        <div className="flex-1 overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max h-full">
            {COLUMNS.map(col => {
              const columnCandidates = candidatos.filter(c => c.status === col.id)
              return (
                <div 
                  key={col.id}
                  className={`w-[320px] flex flex-col bg-white rounded-2xl border-t-4 shadow-sm ${col.color}`}
                  onDragOver={handleDragOver}
                  onDrop={e => handleDrop(e, col.id)}
                >
                  <div className={`p-4 border-b border-cream-200 ${col.bg} rounded-t-xl flex items-center justify-between`}>
                    <h3 className="font-bold text-gray-800">{col.title}</h3>
                    <span className="bg-white text-xs font-bold px-2 py-1 rounded-full shadow-sm text-gray-600">
                      {columnCandidates.length}
                    </span>
                  </div>
                  
                  <div className="p-3 flex-1 overflow-y-auto space-y-3 min-h-[200px] bg-gray-50/50">
                    {columnCandidates.map(c => (
                      <div 
                        key={c.id} 
                        draggable
                        onDragStart={e => handleDragStart(e, c)}
                        className="bg-white border border-cream-300 p-4 rounded-xl shadow-sm cursor-grab active:cursor-grabbing hover:border-brand-300 transition-colors group relative"
                      >
                        <button 
                          onClick={() => delCandidato(c.id)}
                          className="absolute top-3 right-3 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remover"
                        >
                          <Trash2 size={14} />
                        </button>
                        <h4 className="font-bold text-gray-800 pr-6">{c.nome}</h4>
                        <p className="text-[11px] font-bold text-brand-600 mb-3 bg-brand-50 inline-block px-2 py-0.5 rounded-full">{c.vagaTitulo || c.vaga}</p>
                        
                        <div className="space-y-1.5 mb-3">
                          {c.telefone && (
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <Phone size={12} /> {c.telefone}
                            </div>
                          )}
                          {c.email && (
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <Mail size={12} /> <span className="truncate">{c.email}</span>
                            </div>
                          )}
                        </div>

                        {c.curriculoUrl && (
                          <a href={c.curriculoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-blue-600 font-bold hover:underline mb-2">
                            <Download size={12}/> Ver Currículo PDF
                          </a>
                        )}
                        
                        {col.id === 'Aprovado' && (
                          <div className="mt-4 pt-3 border-t border-cream-100 flex flex-col gap-2">
                            {c.statusOnboarding === 'Concluído' ? (
                              <button onClick={() => setModalDocs(c)} className="btn-primary py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 border-none w-full justify-center">
                                <CheckCircle2 size={14}/> Ver Docs de Admissão
                              </button>
                            ) : (
                              <button onClick={() => handleCopyLink(c.id)} className="btn-secondary py-1.5 text-xs w-full justify-center text-brand-700 bg-brand-50 border-brand-200 hover:bg-brand-100">
                                <Copy size={14}/> Copiar Link de Admissão
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    {columnCandidates.length === 0 && (
                      <div className="h-24 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-xs font-medium text-gray-400">
                        Arraste para cá
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {modalVaga && (
        <ModalVaga 
          data={modalVaga === 'new' ? null : modalVaga} 
          onClose={() => setModalVaga(null)} 
          onSave={f => modalVaga === 'new' ? addVaga(f) : updVaga(modalVaga.id, f)} 
        />
      )}
      {modalDocs && <ModalDocsAdmissao candidato={modalDocs} onClose={() => setModalDocs(null)} />}
    </div>
  )
}
