import React, { useState, useRef } from 'react'
import { 
  FolderOpen, Plus, Download, Trash2, Edit2, FileText, Image, 
  Upload, Search, Lock, Users, Eye, Building2, ExternalLink, 
  Check, X, AlertCircle, Loader2, Filter
} from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'
import { storage } from '../firebase'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'

const categories = [
  'Convenção & Regimento', 
  'Atas de Assembleia', 
  'Prestação de Contas', 
  'Contratos', 
  'Boletos', 
  'Editais de Convocação', 
  'Regulamentos', 
  'Outros'
]

const fileIcon = (tipo) => tipo === 'img' 
  ? <Image size={20} className="text-purple-500" /> 
  : <FileText size={20} className="text-red-500" />

function ModalDocumento({ data, onClose, onSave, condominios }) {
  const [arquivo, setArquivo] = useState(null)
  const [categoria, setCategoria] = useState(data?.categoria || 'Contratos')
  const [morador, setMorador] = useState(data?.morador || 'Condomínio')
  const [condominio, setCondominio] = useState(data?.condominio || 'Todos')
  const [visibilidade, setVisibilidade] = useState(data?.visibilidade || 'Moradores') // 'Moradores' ou 'Privado'
  const [nome, setNome] = useState(data?.nome || '')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const inputRef = useRef()

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setArquivo(file)
    if (!nome || !data) {
      setNome(file.name.replace(/\.[^/.]+$/, ""))
    }
  }

  const handleSave = async () => {
    if (!data && !arquivo) {
      alert('Por favor, selecione um arquivo.')
      return
    }

    if (!nome.trim()) {
      alert('Por favor, informe o nome do documento.')
      return
    }

    setUploading(true)
    setUploadProgress('Processando e enviando arquivo...')

    try {
      let fileUrl = data?.url || ''
      let fileSize = data?.tamanho || ''
      let fileType = data?.tipo || 'pdf'

      // Se selecionou um novo arquivo, faz o upload no Firebase Storage
      if (arquivo) {
        fileType = arquivo.type.startsWith('image/') ? 'img' : 'pdf'
        fileSize = arquivo.size > 1024 * 1024
          ? `${(arquivo.size / 1024 / 1024).toFixed(1)} MB`
          : `${Math.round(arquivo.size / 1024)} KB`

        try {
          // Upload direto no Firebase Storage para suportar arquivos de qualquer tamanho (sem limite de 1MB)
          const safeName = arquivo.name.replace(/[^a-zA-Z0-9._-]/g, '_')
          const storagePath = `documentos/${Date.now()}_${safeName}`
          const storageRef = ref(storage, storagePath)
          
          setUploadProgress('Enviando para o Firebase Storage...')
          const snapshot = await uploadBytes(storageRef, arquivo)
          fileUrl = await getDownloadURL(snapshot.ref)
        } catch (storageErr) {
          console.warn("Storage falhou ou não configurado, tentando fallback:", storageErr)
          
          // Se o arquivo for menor que 800KB, tenta salvar via Base64 como contingência
          if (arquivo.size <= 800000) {
            fileUrl = await new Promise((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = (e) => resolve(e.target.result)
              reader.onerror = (e) => reject(e)
              reader.readAsDataURL(arquivo)
            })
          } else {
            throw new Error('Não foi possível enviar o arquivo ao armazenamento. Verifique a conexão com o Firebase Storage.')
          }
        }
      }

      await onSave({
        id: data?.id || Date.now(),
        nome: nome.trim(),
        categoria,
        morador,
        visibilidade,
        tamanho: fileSize || '1 MB',
        data: data?.data || new Date().toLocaleDateString('pt-BR'),
        tipo: fileType,
        url: fileUrl,
        condominio: condominio || 'Todos'
      })

      onClose()
    } catch (err) {
      console.error("Erro ao salvar documento:", err)
      alert(`Erro ao salvar documento: ${err.message || 'Falha no upload'}`)
    } finally {
      setUploading(false)
      setUploadProgress('')
    }
  }

  return (
    <div className="modal-overlay" onClick={uploading ? undefined : onClose}>
      <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-cream-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="text-brand-600" size={20} />
            <h3 className="font-bold text-gray-800 text-base">
              {data ? 'Editar Documento / Contrato' : 'Adicionar Documento / Contrato'}
            </h3>
          </div>
          {!uploading && (
            <button onClick={onClose} className="modal-close-btn" title="Fechar">
              <X size={20} strokeWidth={2.5} />
            </button>
          )}
        </div>

        <div className="p-6 flex flex-col gap-4 text-xs">
          {/* Upload area */}
          <div
            onClick={() => !uploading && inputRef.current.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
              uploading ? 'opacity-60 cursor-wait' : 'cursor-pointer'
            } ${
              arquivo 
                ? 'border-brand-500 bg-brand-50/50' 
                : data?.url 
                ? 'border-emerald-400 bg-emerald-50/30' 
                : 'border-cream-400 hover:border-brand-400 bg-slate-50'
            }`}
          >
            <input 
              ref={inputRef} 
              type="file" 
              className="hidden" 
              accept=".pdf,.jpg,.jpeg,.png,.docx,.doc,.xlsx,.xls,.txt" 
              onChange={handleFile} 
              disabled={uploading}
            />

            {arquivo ? (
              <div>
                <div className="text-3xl mb-1.5">{arquivo.type.startsWith('image/') ? '🖼️' : '📄'}</div>
                <p className="text-sm font-bold text-brand-800 break-all">{arquivo.name}</p>
                <p className="text-xs text-gray-500 mt-0.5 font-medium">
                  {arquivo.size > 1024 * 1024 ? `${(arquivo.size / 1024 / 1024).toFixed(1)} MB` : `${Math.round(arquivo.size / 1024)} KB`}
                </p>
                <p className="text-xs font-bold text-brand-600 mt-2 hover:underline">Clique para trocar o arquivo</p>
              </div>
            ) : data?.url ? (
              <div>
                <div className="text-3xl mb-1.5">{data.tipo === 'img' ? '🖼️' : '📄'}</div>
                <p className="text-sm font-bold text-gray-800 break-all">{data.nome}</p>
                <p className="text-xs text-emerald-700 font-bold mt-0.5">✓ Arquivo atual salvo ({data.tamanho || 'Anexado'})</p>
                <p className="text-xs font-bold text-brand-600 mt-2 hover:underline">Clique se desejar substituir por um novo arquivo</p>
              </div>
            ) : (
              <div>
                <Upload size={28} className="text-brand-500 mx-auto mb-2" />
                <p className="text-sm font-bold text-gray-700">Clique para selecionar o arquivo</p>
                <p className="text-xs text-gray-400 mt-1 font-medium">PDF, JPG, PNG, DOCX, XLSX (sem limite de tamanho)</p>
              </div>
            )}
          </div>

          {/* Nome do Documento */}
          <div>
            <label className="label font-bold text-gray-700">Nome do Documento / Contrato *</label>
            <input 
              className="input font-medium" 
              value={nome} 
              onChange={e => setNome(e.target.value)} 
              placeholder="Ex: Contrato de Prestação de Serviço DÁLIA" 
              disabled={uploading}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label font-bold text-gray-700">Categoria *</label>
              <select 
                className="input font-medium" 
                value={categoria} 
                onChange={e => setCategoria(e.target.value)}
                disabled={uploading}
              >
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="label font-black text-brand-800">Condomínio *</label>
              <select 
                className="input font-bold bg-amber-50/60 border-amber-300 text-gray-900" 
                value={condominio} 
                onChange={e => setCondominio(e.target.value)}
                disabled={uploading}
              >
                <option value="Todos">🌐 Todos os Condomínios (Geral)</option>
                {condominios.map(c => (
                  <option key={c.id || c.nome} value={c.nome}>🏢 {c.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label font-bold text-gray-700">Permissão de Acesso</label>
              <select 
                className="input font-bold" 
                value={visibilidade} 
                onChange={e => setVisibilidade(e.target.value)}
                disabled={uploading}
              >
                <option value="Moradores">👥 Disponível aos Moradores (Público)</option>
                <option value="Privado">🔒 Privado (Apenas Gestão / Síndico)</option>
              </select>
            </div>

            <div>
              <label className="label font-bold text-gray-700">Morador / Área de Referência</label>
              <input 
                className="input" 
                placeholder="Ex: Geral ou Bloco A" 
                value={morador} 
                onChange={e => setMorador(e.target.value)} 
                disabled={uploading}
              />
            </div>
          </div>

          {uploading && (
            <div className="p-3 bg-brand-50 border border-brand-200 rounded-xl flex items-center gap-2 text-brand-800 font-bold text-xs animate-pulse">
              <Loader2 size={16} className="animate-spin text-brand-600" />
              <span>{uploadProgress || 'Salvando documento com segurança...'}</span>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-cream-300 flex gap-3 justify-end bg-slate-50 rounded-b-2xl">
          <button 
            onClick={onClose} 
            className="btn-secondary text-xs" 
            disabled={uploading}
          >
            Cancelar
          </button>
          <button 
            onClick={handleSave} 
            disabled={uploading}
            className="btn-primary text-xs flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 font-black shadow-md cursor-pointer"
          >
            {uploading ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Salvando...
              </>
            ) : (
              <>
                <Upload size={14} /> {data ? 'Atualizar Documento' : 'Enviar Documento'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Documentos() {
  const { user } = useAuth()
  const { items: docs, addItem: addDoc, updateItem: editDoc, deleteItem: delDoc } = useFirestore('documentos')
  const { items: allCondominios } = useFirestore('condominios')
  const { items: moradores } = useFirestore('moradores')
  const condominios = allCondominios.filter(c => c.status !== 'Inativo')
  
  const [modal, setModal] = useState(null) // null, 'new' ou objeto do documento para editar
  const [catFilter, setCatFilter] = useState('Todos')
  const [filtroCondo, setFiltroCondo] = useState('Todos')
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
    .filter(d => filtroCondo === 'Todos' || !d.condominio || d.condominio === 'Todos' || d.condominio === filtroCondo)
    .filter(d => {
      const s = search.toLowerCase()
      return (d.nome || '').toLowerCase().includes(s) || 
             (d.morador || '').toLowerCase().includes(s) || 
             (d.categoria || '').toLowerCase().includes(s) ||
             (d.condominio || '').toLowerCase().includes(s)
    })
    .sort((a, b) => new Date(b._createdAt?.toDate?.() || 0) - new Date(a._createdAt?.toDate?.() || 0))

  const handleSaveDoc = async (docData) => {
    if (modal && modal !== 'new' && modal.id) {
      await editDoc(modal.id, docData)
    } else {
      await addDoc(docData)
      
      // Envio de notificação Push se for Ata ou Convenção
      if (docData.categoria === 'Atas de Assembleia' || docData.categoria === 'Convenção & Regimento') {
        let targetEmails = null
        if (docData.condominio && docData.condominio !== 'Todos') {
          targetEmails = moradores.filter(m => m.condominio === docData.condominio && m.email).map(m => m.email)
          if (targetEmails.length === 0) targetEmails = ['dummy@local.host']
        }
        
        fetch('/api/onesignal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            title: 'Novo Documento Disponível', 
            message: `O documento "${docData.nome}" já está disponível para visualização no Portal.`,
            targetUserIds: targetEmails,
            targetUrl: window.location.origin + '/documentos'
          })
        }).catch(e => console.error("Push erro", e))
      }
    }
  }

  const handleVisualizar = (url, nome) => {
    if (!url) return alert('Link do documento não encontrado.')
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-7xl mx-auto w-full pb-12">
      {/* Cabeçalho */}
      <div className="page-header flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-pale-300 shadow-sm">
        <div>
          <h2 className="section-title text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
            <FolderOpen className="text-brand-600" /> Documentos & Contratos do Condomínio
          </h2>
          <p className="text-gray-500 font-medium text-xs sm:text-sm mt-0.5">
            {isMorador 
              ? 'Consulte convenções, regimentos internos, atas e informativos públicos do condomínio.' 
              : 'Gerencie contratos, atas, convenções e documentos oficiais com controle de privacidade e armazenamento em nuvem.'}
          </p>
        </div>
        {!isMorador && (
          <button 
            onClick={() => setModal('new')} 
            className="btn-primary py-2.5 px-4 text-xs font-black flex items-center gap-1.5 shadow-md shadow-brand-700/20 bg-emerald-600 hover:bg-emerald-500 cursor-pointer uppercase tracking-wider"
          >
            <Plus size={16} /> + Adicionar Documento
          </button>
        )}
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-white p-4 rounded-2xl border border-pale-300 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            className="input pl-10 text-xs w-full bg-slate-50 border-gray-200" 
            placeholder="Buscar por título, contrato, categoria ou condomínio..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>

        <div className="relative sm:w-64">
          <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-600" />
          <select
            className="input pl-9 text-xs font-bold bg-amber-50/60 border-amber-200 text-gray-800"
            value={filtroCondo}
            onChange={e => setFiltroCondo(e.target.value)}
          >
            <option value="Todos">🏢 Todos os Condomínios</option>
            {condominios.map(c => (
              <option key={c.id || c.nome} value={c.nome}>🏢 {c.nome}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Categorias Pills */}
      <div className="flex gap-2 flex-wrap items-center">
        {['Todos', ...categories].map(c => (
          <button
            key={c}
            onClick={() => setCatFilter(c)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              catFilter === c 
                ? 'bg-brand-600 text-white shadow-md' 
                : 'bg-white text-gray-600 hover:text-brand-700 border border-pale-300'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Listagem de Documentos */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-pale-300 p-16 text-center text-gray-400 shadow-sm flex flex-col items-center justify-center">
          <FolderOpen size={48} className="mb-3 opacity-30 text-gray-400" />
          <h3 className="font-bold text-gray-700 text-base">Nenhum documento encontrado</h3>
          <p className="text-xs text-gray-400 mt-1 max-w-md">
            {search || filtroCondo !== 'Todos' || catFilter !== 'Todos'
              ? 'Nenhum documento corresponde aos filtros aplicados. Tente ajustar os termos de busca.'
              : 'Nenhum documento cadastrado no momento. Clique no botão acima para enviar o primeiro.'}
          </p>
          {!isMorador && (
            <button
              onClick={() => setModal('new')}
              className="btn-primary mt-4 py-2 px-4 text-xs font-bold flex items-center gap-1.5"
            >
              <Plus size={15} /> Adicionar Documento Agora
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(doc => (
            <div 
              key={doc.id} 
              className="bg-white p-5 rounded-2xl border border-pale-300 shadow-sm hover:shadow-md hover:border-brand-400 transition-all group flex flex-col justify-between"
            >
              <div>
                {/* Topo do Card */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-11 h-11 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center shrink-0">
                    {fileIcon(doc.tipo)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm truncate leading-snug group-hover:text-brand-700 transition-colors" title={doc.nome}>
                      {doc.nome}
                    </p>
                    <p className="text-xs font-semibold text-brand-600 mt-0.5">
                      {doc.categoria} · <span className="text-gray-400 font-normal">{doc.tamanho || '1 MB'}</span>
                    </p>
                  </div>
                </div>

                {/* Tags de Condomínio e Visibilidade */}
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-900 px-2 py-0.5 rounded-md border border-amber-200">
                    <Building2 size={11} className="text-amber-700" />
                    <span className="truncate max-w-[150px]">{doc.condominio || 'Todos'}</span>
                  </span>

                  {doc.visibilidade === 'Privado' ? (
                    <span className="text-[10px] font-black bg-rose-100 text-rose-700 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Lock size={10} /> Privado
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Users size={10} /> Moradores
                    </span>
                  )}

                  <span className="text-[10px] text-gray-400 ml-auto">{doc.data}</span>
                </div>
              </div>

              {/* Botões de Ação: VISUALIZAR, BAIXAR, EDITAR, EXCLUIR */}
              <div className="flex items-center gap-2 pt-3 border-t border-gray-100 mt-2">
                {/* Visualizar */}
                <button
                  onClick={() => handleVisualizar(doc.url, doc.nome)}
                  className="btn-secondary flex-1 justify-center py-2 text-xs font-bold flex items-center gap-1.5 bg-slate-50 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-300 transition-all cursor-pointer"
                  title="Visualizar documento em nova aba"
                >
                  <Eye size={14} className="text-brand-600" /> Visualizar
                </button>

                {/* Baixar */}
                <a
                  href={doc.url}
                  download={doc.nome}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-xl bg-slate-50 hover:bg-emerald-50 text-gray-500 hover:text-emerald-700 border border-gray-200 transition-all flex items-center justify-center cursor-pointer"
                  title="Baixar arquivo"
                >
                  <Download size={14} />
                </a>

                {/* Editar (Apenas Síndico / Gestão) */}
                {!isMorador && (
                  <button
                    onClick={() => setModal(doc)}
                    className="p-2 rounded-xl bg-slate-50 hover:bg-brand-50 text-gray-500 hover:text-brand-700 border border-gray-200 transition-all flex items-center justify-center cursor-pointer"
                    title="Editar informações do documento"
                  >
                    <Edit2 size={14} />
                  </button>
                )}

                {/* Excluir (Apenas Síndico / Gestão) */}
                {!isMorador && (
                  <button
                    onClick={async () => {
                      if (window.confirm(`Deseja realmente excluir o documento "${doc.nome}"?`)) {
                        await delDoc(doc.id)
                      }
                    }}
                    className="p-2 rounded-xl bg-slate-50 hover:bg-rose-50 text-gray-400 hover:text-rose-600 border border-gray-200 transition-all flex items-center justify-center cursor-pointer"
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

      {/* Modal de Adicionar / Editar Documento */}
      {modal && (
        <ModalDocumento
          data={modal === 'new' ? null : modal}
          condominios={condominios}
          onClose={() => setModal(null)}
          onSave={handleSaveDoc}
        />
      )}
    </div>
  )
}
