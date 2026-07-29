import React, { useState, useRef } from 'react'
import { FolderOpen, Plus, Download, Trash2, FileText, Image, Upload, Search } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'

const categories = ['Contratos', 'Atas', 'Boletos', 'Documentos Pessoais', 'Regulamentos', 'Outros']

const fileIcon = (tipo) => tipo === 'img' ? <Image size={16} className="text-purple-500" /> : <FileText size={16} className="text-red-500" />

function Modal({ onClose, onSave, condominios }) {
  const [arquivo, setArquivo] = useState(null)
  const [categoria, setCategoria] = useState('Contratos')
  const [morador, setMorador] = useState('Condomínio')
  const [condominio, setCondominio] = useState('Todos')
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
    // Firebase Firestore tem limite de 1MB por documento.
    if (arquivo.size > 1048487) return alert('O arquivo deve ter no máximo 1 MB para ser salvo nesta versão gratuita do banco de dados.')

    const tipo = arquivo.type.startsWith('image/') ? 'img' : 'pdf'

    // Converte o arquivo para Base64 para salvar direto como string no Firestore
    const reader = new FileReader()
    reader.onload = (e) => {
      const base64Url = e.target.result
      onSave({
        id: Date.now(),
        nome: nome || arquivo.name,
        categoria,
        morador,
        tamanho: arquivo.size > 1024 * 1024
          ? `${(arquivo.size / 1024 / 1024).toFixed(1)} MB`
          : `${Math.round(arquivo.size / 1024)} KB`,
        data: new Date().toLocaleDateString('pt-BR'),
        tipo,
        url: base64Url, // string longa em base64
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
        <div className="p-6 flex flex-col gap-4">
          {/* Upload area */}
          <div
            onClick={() => inputRef.current.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${arquivo ? 'border-brand-500 bg-pale-100' : 'border-cream-400 hover:border-brand-400'}`}
          >
            <input ref={inputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.docx,.doc,.xlsx" onChange={handleFile} />
            {arquivo ? (
              <div>
                <div className="text-2xl mb-2">{arquivo.type.startsWith('image/') ? '🖼️' : '📄'}</div>
                <p className="text-sm font-semibold text-brand-700">{arquivo.name}</p>
                <p className="text-xs text-gray-400 mt-1">{arquivo.size > 1024 * 1024 ? `${(arquivo.size / 1024 / 1024).toFixed(1)} MB` : `${Math.round(arquivo.size / 1024)} KB`}</p>
                <p className="text-xs text-brand-500 mt-2">Clique para trocar o arquivo</p>
              </div>
            ) : (
              <div>
                <Upload size={24} className="text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Clique para selecionar o arquivo</p>
                <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG, DOCX, XLSX (máx. 1 MB)</p>
              </div>
            )}
          </div>

          <div><label className="label">Nome do Documento</label><input className="input" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome descritivo do arquivo" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Categoria</label>
              <select className="input" value={categoria} onChange={e => setCategoria(e.target.value)}>
                {categories.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div><label className="label">Condomínio</label>
              <select className="input" value={condominio} onChange={e=>setCondominio(e.target.value)}>
                <option value="Todos">Todos os Condomínios</option>
                {condominios.map(c=>(<option key={c.id} value={c.nome}>{c.nome}</option>))}
              </select>
            </div>
            <div className="col-span-2"><label className="label">Morador / Área</label><input className="input" placeholder="Nome ou 'Condomínio'" value={morador} onChange={e => setMorador(e.target.value)} /></div>
          </div>
        </div>
        <div className="p-6 border-t border-cream-300 flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleSave} className="btn-primary"><Upload size={14} />Enviar</button>
        </div>
      </div>
    </div>
  )
}

export default function Documentos() {
  const { items: docs, addItem: addDoc, deleteItem: delDoc } = useFirestore('documentos')
  const { items: allCondominios } = useFirestore('condominios')
  const { items: moradores } = useFirestore('moradores')
  const condominios = allCondominios.filter(c => c.status !== 'Inativo')
  const [modal, setModal] = useState(false)
  const [catFilter, setCatFilter] = useState('Todos')
  const [search, setSearch] = useState('')

  const filtered = docs
    .filter(d => catFilter === 'Todos' || d.categoria === catFilter)
    .filter(d => d.nome.toLowerCase().includes(search.toLowerCase()) || d.morador.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="page-header">
        <div><h2 className="section-title text-xl">Documentos & Arquivos</h2><p className="section-sub">{docs.length} documentos armazenados</p></div>
        <button onClick={() => setModal(true)} className="btn-primary"><Plus size={16} />Adicionar</button>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input pl-9" placeholder="Buscar por nome ou morador..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="flex gap-2 flex-wrap">
        {['Todos', ...categories].map(c => (
          <button key={c} onClick={() => setCatFilter(c)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${catFilter === c ? 'bg-brand-600 text-white' : 'bg-white text-gray-500 hover:text-brand-700 border border-cream-400'}`}>{c}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-12 text-gray-400 text-sm">
          {docs.length === 0 ? 'Nenhum documento adicionado. Clique em "Adicionar" para enviar.' : 'Nenhum documento encontrado.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(doc => (
            <div key={doc.id} className="card hover:border-brand-300 transition-all group">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-cream-200 rounded-xl flex items-center justify-center min-w-10">
                  {fileIcon(doc.tipo)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm truncate">{doc.nome}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{doc.categoria} · {doc.tamanho}</p>
                  <p className="text-xs text-gray-300 mt-0.5">{doc.morador} · {doc.data}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3 pt-3 border-t border-cream-300 opacity-0 group-hover:opacity-100 transition-opacity">
                <a href={doc.url} download={doc.nome} target="_blank" rel="noreferrer" className="btn-secondary flex-1 justify-center py-1.5 text-xs"><Download size={11} />Baixar</a>
                <button onClick={() => delDoc(doc.id)} className="p-1.5 rounded-lg bg-cream-200 hover:bg-red-100 text-gray-400 hover:text-red-500 transition-all"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {modal && <Modal condominios={condominios} onClose={() => setModal(false)} onSave={async (doc) => { 
        await addDoc(doc); 
        
        // Se for Ata, dispara Push
        if (doc.categoria === 'Atas') {
          let targetEmails = null;
          if (doc.condominio && doc.condominio !== 'Todos') {
            targetEmails = moradores.filter(m => m.condominio === doc.condominio && m.email).map(m => m.email);
            if (targetEmails.length === 0) targetEmails = ['dummy_para_nao_enviar_para_todos@local.host'];
          }
          
          fetch('/api/onesignal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              title: 'Nova Ata Disponível', 
              message: `A ata "${doc.nome}" já está disponível para visualização.`,
              targetUserIds: targetEmails,
              targetUrl: window.location.origin + '/documentos'
            })
          }).catch(e => console.error("Push erro", e))
        }
        
        setModal(false) 
      }} />}
    </div>
  )
}
