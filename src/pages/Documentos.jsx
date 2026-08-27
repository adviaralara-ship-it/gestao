import React, { useState, useRef } from 'react'
import { FolderOpen, Plus, Download, Trash2, FileText, Image, Upload, Search, Lock, Users, Eye } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'

const categories = ['Convenção & Regimento', 'Atas de Assembleia', 'Prestação de Contas', 'Contratos', 'Boletos', 'Editais de Convocação', 'Regulamentos', 'Outros']

const fileIcon = (tipo) => tipo === 'img' ? <Image size={16} className="text-purple-500" /> : <FileText size={16} className="text-red-500" />

function Modal({ onClose, onSave, condominios }) {
  const [arquivo, setArquivo] = useState(null)
  const [categoria, setCategoria] = useState('Convenção & Regimento')
  const [morador, setMorador] = useState('Condomínio')
  const [condominio, setCondominio] = useState('Todos')
  const [visibilidade, setVisibilidade] = useState('Moradores') // 'Moradores' ou 'Privado'
  const [nome, setNome] = useState('')
  const inputRef = useRef()

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setArquivo(file)
    setNome(file.name)
  }

  const handleSave = () => {
    if (!arquivo) return alert('Selecione um arquivo.')
    if (arquivo.size > 1048487) return alert('O arquivo deve ter no máximo 1 MB para ser salvo no banco de dados.')

    const tipo = arquivo.type.startsWith('image/') ? 'img' : 'pdf'

    const reader = new FileReader()
    reader.onload = (e) => {
      const base64Url = e.target.result
      onSave({
        id: Date.now(),
        nome: nome || arquivo.name,
        categoria,
        morador,
        visibilidade,
        tamanho: arquivo.size > 1024 * 1024
          ? `${(arquivo.size / 1024 / 1024).toFixed(1)} MB`
          : `${Math.round(arquivo.size / 1024)} KB`,
        data: new Date().toLocaleDateString('pt-BR'),
        tipo,
        url: base64Url,
        condominio: condominio
      })
    }
    reader.readAsDataURL(arquivo)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">Adicionar Documento</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-lg">✕</button>
        </div>
        <div className="p-6 flex flex-col gap-4 text-xs">
          {/* Upload area */}
          <div
            onClick={() => inputRef.current.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${arquivo ? 'border-brand-500 bg-pale-100' : 'border-cream-400 hover:border-brand-400'}`}
          >
            <input ref={inputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.docx,.doc,.xlsx" onChange={handleFile} />
            {arquivo ? (
              <div>
                <div className="text-2xl mb-1">{arquivo.type.startsWith('image/') ? '🖼️' : '📄'}</div>
                <p className="text-sm font-semibold text-brand-700">{arquivo.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{arquivo.size > 1024 * 1024 ? `${(arquivo.size / 1024 / 1024).toFixed(1)} MB` : `${Math.round(arquivo.size / 1024)} KB`}</p>
                <p className="text-xs text-brand-500 mt-1">Clique para trocar o arquivo</p>
              </div>
            ) : (
              <div>
                <Upload size={22} className="text-gray-400 mx-auto mb-1" />
                <p className="text-sm font-semibold text-gray-600">Clique para selecionar o arquivo</p>
                <p className="text-xs text-gray-400 mt-0.5">PDF, JPG, PNG, DOCX, XLSX (máx. 1 MB)</p>
              </div>
            )}
          </div>

          <div>
            <label className="label font-bold text-gray-700">Nome do Documento</label>
            <input className="input" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Convenção Condominial Registrada 2026" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label font-bold text-gray-700">Categoria</label>
              <select className="input" value={categoria} onChange={e => setCategoria(e.target.value)}>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label font-bold text-gray-700">Condomínio</label>
              <select className="input" value={condominio} onChange={e=>setCondominio(e.target.value)}>
                <option value="Todos">Todos os Condomínios</option>
                {condominios.map(c=>(<option key={c.id || c.nome} value={c.nome}>{c.nome}</option>))}
              </select>
            </div>

            <div>
              <label className="label font-bold text-gray-700">Permissão de Acesso</label>
              <select className="input font-bold" value={visibilidade} onChange={e => setVisibilidade(e.target.value)}>
                <option value="Moradores">👥 Disponível aos Moradores (Público)</option>
                <option value="Privado">🔒 Privado (Apenas Gestão / Síndico)</option>
              </select>
            </div>

            <div>
              <label className="label font-bold text-gray-700">Morador / Área</label>
              <input className="input" placeholder="Ex: Geral ou Bloco A" value={morador} onChange={e => setMorador(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="p-6 border-t border-cream-300 flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary text-xs">Cancelar</button>
          <button onClick={handleSave} className="btn-primary text-xs flex items-center gap-1.5"><Upload size={14} /> Enviar Documento</button>
        </div>
      </div>
    </div>
  )
}

export default function Documentos() {
  const { user } = useAuth()
  const { items: docs, addItem: addDoc, deleteItem: delDoc } = useFirestore('documentos')
  const { items: allCondominios } = useFirestore('condominios')
  const { items: moradores } = useFirestore('moradores')
  const condominios = allCondominios.filter(c => c.status !== 'Inativo')
  const [modal, setModal] = useState(false)
  const [catFilter, setCatFilter] = useState('Todos')
  const [search, setSearch] = useState('')

  const isMorador = user?.role === 'Morador'

  const filtered = docs
    .filter(d => {
      // Se for morador, só pode ver documentos do condomínio dele e que NÃO sejam privados
      if (isMorador) {
        if (d.visibilidade === 'Privado') return false
        if (d.condominio && d.condominio !== 'Todos' && user?.condominio && d.condominio !== user.condominio) return false
      } else if (user?.role === 'Síndico' || user?.role === 'Subsíndico') {
        if (d.condominio && d.condominio !== 'Todos' && user?.condominio && d.condominio !== user.condominio) return false
      }
      return true
    })
    .filter(d => catFilter === 'Todos' || d.categoria === catFilter)
    .filter(d => d.nome?.toLowerCase().includes(search.toLowerCase()) || d.morador?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-7xl mx-auto w-full pb-12">
      <div className="page-header flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="section-title text-2xl font-black text-gray-900 flex items-center gap-2">
            <FolderOpen className="text-brand-600" /> Documentos do Condomínio
          </h2>
          <p className="text-gray-500 font-medium text-xs md:text-sm mt-0.5">
            {isMorador ? 'Consulte convenções, regimentos internos, atas e informativos públicos do condomínio.' : 'Gerencie atas, convenções, contratos e documentos oficiais com controle de privacidade.'}
          </p>
        </div>
        {!isMorador && (
          <button onClick={() => setModal(true)} className="btn-primary flex items-center gap-1.5 shadow-md">
            <Plus size={16} /> Adicionar Documento
          </button>
        )}
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input pl-10 text-sm bg-white" placeholder="Buscar documento por título ou categoria..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="flex gap-2 flex-wrap">
        {['Todos', ...categories].map(c => (
          <button
            key={c}
            onClick={() => setCatFilter(c)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${catFilter === c ? 'bg-brand-600 text-white shadow-md' : 'bg-white text-gray-600 hover:text-brand-700 border border-pale-300'}`}
          >
            {c}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-16 text-gray-400 text-sm border border-pale-300 shadow-sm">
          {docs.length === 0 ? 'Nenhum documento cadastrado no momento.' : 'Nenhum documento encontrado com estes filtros.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(doc => (
            <div key={doc.id} className="bg-white p-4 rounded-2xl border border-pale-300 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-pale-100 rounded-xl flex items-center justify-center shrink-0">
                  {fileIcon(doc.tipo)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-sm truncate" title={doc.nome}>{doc.nome}</p>
                  <p className="text-xs font-semibold text-brand-600 mt-0.5">{doc.categoria} · <span className="text-gray-400">{doc.tamanho}</span></p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-gray-400">{doc.data}</span>
                    {doc.visibilidade === 'Privado' ? (
                      <span className="text-[9px] font-black bg-rose-100 text-rose-700 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Lock size={10} /> Privado
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Users size={10} /> Moradores
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
                <a
                  href={doc.url}
                  download={doc.nome}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary flex-1 justify-center py-1.5 text-xs font-bold flex items-center gap-1"
                >
                  <Download size={13} /> Visualizar / Baixar
                </a>
                {!isMorador && (
                  <button
                    onClick={() => {
                      if (window.confirm(`Excluir o documento "${doc.nome}"?`)) delDoc(doc.id)
                    }}
                    className="p-1.5 rounded-lg bg-gray-100 hover:bg-red-100 text-gray-400 hover:text-red-600 transition-all"
                    title="Excluir documento"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal
          condominios={condominios}
          onClose={() => setModal(false)}
          onSave={async (doc) => { 
            await addDoc(doc)
            
            if (doc.categoria === 'Atas de Assembleia' || doc.categoria === 'Convenção & Regimento') {
              let targetEmails = null
              if (doc.condominio && doc.condominio !== 'Todos') {
                targetEmails = moradores.filter(m => m.condominio === doc.condominio && m.email).map(m => m.email)
                if (targetEmails.length === 0) targetEmails = ['dummy@local.host']
              }
              
              fetch('/api/onesignal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  title: 'Novo Documento Disponível', 
                  message: `O documento "${doc.nome}" já está disponível para visualização no Portal.`,
                  targetUserIds: targetEmails,
                  targetUrl: window.location.origin + '/documentos'
                })
              }).catch(e => console.error("Push erro", e))
            }
            
            setModal(false) 
          }}
        />
      )}
    </div>
  )
}
