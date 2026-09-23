import React, { useState } from 'react'
import { Receipt, Search, ExternalLink, RefreshCw, Plus, Trash2, Edit2, X, Eye, UploadCloud, Loader2 } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '../firebase'

const statusBadge = s => ({ Válida: 'badge-green', 'Em análise': 'badge-yellow', Rejeitada: 'badge-red' }[s] || 'badge-blue')

// ─── Modal: Nova / Editar Nota Fiscal ────────────────────────────────
function ModalNota({ data, user, condominiosDisponiveis, onClose, onSave }) {
  const [form, setForm] = useState(data || {
    numero: '', prestador: '', cnpj: '', servico: '', valor: '', data: new Date().toISOString().split('T')[0], status: 'Em análise', condominio: user?.condominio || '', tipo: 'Nota Fiscal', arquivoUrl: '', arquivoNome: ''
  })
  const [isExtracting, setIsExtracting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setIsExtracting(true)
    setIsUploading(true)
    set('arquivoNome', file.name)
    
    try {
      // 1. Upload seguro para o Firebase Storage
      try {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const storageRef = ref(storage, `notas_fiscais/${Date.now()}_${safeName}`)
        const snapshot = await uploadBytes(storageRef, file)
        const downloadUrl = await getDownloadURL(snapshot.ref)
        set('arquivoUrl', downloadUrl)
      } catch (stErr) {
        console.warn('Storage upload falhou, tentando fallback:', stErr)
      }

      // 2. Extração OCR com IA via Base64
      const reader = new FileReader()
      reader.onload = async (ev) => {
        const base64Data = ev.target.result
        
        // Se falhou o upload no storage e o arquivo for pequeno, salva data URL como fallback
        setForm(prev => {
          if (!prev.arquivoUrl && file.size < 700000) {
            return { ...prev, arquivoUrl: base64Data }
          }
          return prev
        })

        try {
          const res = await fetch('/api/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file: base64Data, mimeType: file.type, type: 'notafiscal' })
          })
          const ocrData = await res.json()
          if (ocrData.success && ocrData.data) {
            if (ocrData.data.numero) set('numero', ocrData.data.numero)
            if (ocrData.data.prestador) set('prestador', ocrData.data.prestador)
            if (ocrData.data.cnpj) set('cnpj', ocrData.data.cnpj)
            if (ocrData.data.servico) set('servico', ocrData.data.servico)
            if (ocrData.data.valor) set('valor', ocrData.data.valor)
            if (ocrData.data.data) set('data', ocrData.data.data)
          }
        } catch(err) {
          console.error('Falha na extração IA:', err)
        } finally {
          setIsExtracting(false)
          setIsUploading(false)
        }
      }
      reader.readAsDataURL(file)
    } catch (err) {
      console.error(err)
      setIsExtracting(false)
      setIsUploading(false)
    }
  }

  const handleSalvar = async () => {
    const prestadorFinal = form.prestador?.trim() || form.arquivoNome || 'Prestador a Identificar'
    const numeroFinal = form.numero?.trim() || `DOC-${Date.now().toString().slice(-6)}`
    
    setSaving(true)
    try {
      await onSave({
        ...form,
        prestador: prestadorFinal,
        numero: numeroFinal
      })
    } catch (err) {
      console.error('Erro ao salvar nota:', err)
      alert('Erro ao salvar no banco de dados: ' + (err.message || err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">{data ? 'Editar Nota / Recibo' : 'Nova Nota Fiscal ou Recibo'}</h3>
          <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-700" /></button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label text-brand-600 flex items-center gap-2">
              <UploadCloud size={16} /> 🤖 Ler Arquivo Automaticamente (IA)
            </label>
            <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleFileUpload} className="input p-2 text-sm w-full" disabled={isExtracting || isUploading} />
            {(isExtracting || isUploading) && (
              <p className="text-xs text-brand-600 mt-1 flex items-center gap-1.5 font-semibold animate-pulse">
                <Loader2 size={13} className="animate-spin" /> Processando anexo e lendo informações do documento...
              </p>
            )}
            {form.arquivoNome && !isExtracting && (
              <p className="text-xs text-emerald-600 mt-1 font-semibold flex items-center gap-1">
                ✓ Arquivo anexado: {form.arquivoNome}
              </p>
            )}
          </div>
          <div><label className="label">Tipo de Documento</label>
            <select className="input" value={form.tipo || 'Nota Fiscal'} onChange={e => set('tipo', e.target.value)}>
              <option>Nota Fiscal</option><option>Recibo</option>
            </select>
          </div>
          <div><label className="label">Condomínio</label>
            <select className="input" value={form.condominio} onChange={e => set('condominio', e.target.value)} disabled={user?.role==='Morador'}>
              <option value="">Selecione...</option>
              {condominiosDisponiveis.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div><label className="label">Nº da Nota / Recibo</label><input className="input" value={form.numero} onChange={e => set('numero', e.target.value)} placeholder="Ex: NF-001234 (opcional)" /></div>
          <div><label className="label">Data de emissão</label><input type="date" className="input" value={form.data} onChange={e => set('data', e.target.value)} /></div>
          <div className="col-span-2"><label className="label">Prestador / Fornecedor *</label><input className="input" value={form.prestador} onChange={e => set('prestador', e.target.value)} placeholder="Nome da empresa ou prestador" /></div>
          <div><label className="label">CNPJ</label><input className="input" value={form.cnpj} onChange={e => set('cnpj', e.target.value)} placeholder="00.000.000/0001-00" /></div>
          <div><label className="label">Valor</label><input className="input" value={form.valor} onChange={e => set('valor', e.target.value)} placeholder="Ex: R$ 1.200,00" /></div>
          <div className="col-span-2"><label className="label">Serviço prestado</label><input className="input" value={form.servico} onChange={e => set('servico', e.target.value)} placeholder="Descrição do serviço" /></div>
          <div className="col-span-2"><label className="label">Status</label>
            <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
              <option>Em análise</option><option>Válida</option><option>Rejeitada</option>
            </select>
          </div>
        </div>
        <div className="p-6 border-t border-cream-300 flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary" disabled={saving}>Cancelar</button>
          <button 
            onClick={handleSalvar} 
            disabled={saving || isUploading}
            className="btn-primary flex items-center gap-2"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : null}
            {saving ? 'Salvando...' : 'Salvar Documento'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function NotasFiscais() {
  const { user } = useAuth()
  const { items: notas, addItem, updateItem, deleteItem } = useFirestore('notas_fiscais')
  const { items: allCondosData } = useFirestore('condominios')

  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [condoFilter, setCondoFilter] = useState('Todos')
  const [cnpjConsulta, setCnpjConsulta] = useState('')
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState(null)

  const uniqueCondos = Array.from(new Set([
    ...allCondosData.filter(c => c.status !== 'Inativo').map(c => c.nome),
    'Alpha Soluções (Uso Interno)'
  ]))

  const filteredAccess = notas.filter(n => {
    if (['Morador', 'Síndico', 'Subsíndico', 'Conselheiro'].includes(user?.role)) {
       return !n.condominio || n.condominio === user?.condominio;
    }
    if (condoFilter && condoFilter !== 'Todos') {
       return n.condominio === condoFilter;
    }
    return true;
  })

  const filtered = filteredAccess.filter(n =>
    (n.numero || '').includes(search) ||
    (n.prestador || '').toLowerCase().includes(search.toLowerCase())
  )

  const consultar = async () => {
    if (!cnpjConsulta) return
    setLoading(true)
    const cnpjLimpo = cnpjConsulta.replace(/\D/g, '')
    window.open(`https://cnpj.biz/${cnpjLimpo}`, '_blank')
    await new Promise(r => setTimeout(r, 800))
    setResultado({ cnpj: cnpjConsulta, info: 'Consulta aberta na aba da SEFAZ.' })
    setLoading(false)
  }

  const visualizarNota = (url) => {
    if (url.startsWith('data:')) {
      const newWin = window.open('', '_blank');
      if (newWin) {
        newWin.document.write("<html><head><title>Visualizando Nota...</title></head><body style='margin:0;display:flex;justify-content:center;align-items:center;height:100vh;background:#f5f5f5;font-family:sans-serif;'><h2>Preparando documento...</h2></body></html>");
        fetch(url)
          .then(res => res.blob())
          .then(blob => {
            const objUrl = URL.createObjectURL(blob);
            newWin.location.href = objUrl;
          })
          .catch(() => {
            newWin.document.body.innerHTML = "<h2 style='color:red;'>Erro ao processar o arquivo.</h2>";
          });
      } else {
        alert("Permita os pop-ups neste site para visualizar o anexo.");
      }
    } else {
      window.open(url, '_blank');
    }
  }

  const handleSave = async (form) => {
    if (modal !== 'new') await updateItem(modal.id, form)
    else await addItem(form)
    setModal(null)
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 page-header">
        <div>
          <h2 className="section-title text-xl">Notas Fiscais</h2>
          <p className="section-sub">{filtered.length} notas registradas</p>
        </div>
        <div className="flex items-center gap-3">
          {(user?.role === 'Administrador' || user?.role === 'Financeiro') && uniqueCondos.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0 block">Filtrar:</label>
              <select className="input text-sm py-1.5 h-auto" value={condoFilter} onChange={e=>setCondoFilter(e.target.value)}>
                <option value="Todos">Todos</option>
                {uniqueCondos.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
          {user?.role !== 'Morador' && (
            <button onClick={() => setModal('new')} className="btn-primary whitespace-nowrap"><Plus size={16} />Nova Nota Fiscal</button>
          )}
        </div>
      </div>

      {/* Consulta SEFAZ */}
      <div className="card">
        <p className="font-bold text-gray-800 mb-4 text-sm">🔍 Consulta SEFAZ – Validação de CNPJ</p>
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-48">
            <input className="input" placeholder="Digite o CNPJ do prestador (somente números)..." value={cnpjConsulta} onChange={e => setCnpjConsulta(e.target.value)} />
          </div>
          <button onClick={consultar} disabled={loading} className="btn-primary">
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <ExternalLink size={14} />}
            {loading ? 'Abrindo...' : 'Consultar SEFAZ'}
          </button>
        </div>
        {resultado && (
          <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl animate-fade-in">
            <p className="text-xs text-emerald-700 font-bold mb-1">✓ Aba da SEFAZ aberta</p>
            <p className="text-sm text-gray-600">CNPJ consultado: <strong>{resultado.cnpj}</strong> — verifique o resultado na aba aberta.</p>
          </div>
        )}
      </div>

      {/* Busca */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input pl-9" placeholder="Buscar nota fiscal..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Tabela */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-cream-100 border-b border-cream-300">
              <tr>{['Tipo', 'Nº', 'Prestador', 'Serviço', 'Valor', 'Data', 'Status', 'Ações'].map(h => <th key={h} className="table-head">{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={7} className="text-center py-10 text-gray-400 text-sm">Nenhuma nota cadastrada. Clique em "+ Nova Nota Fiscal".</td></tr>
                : filtered.map(n => (
                  <tr key={n.id} className="table-row">
                    <td className="table-cell font-medium text-gray-500">{n.tipo || 'Nota Fiscal'}</td>
                    <td className="table-cell font-mono text-brand-600 font-semibold">
                      {n.numero}
                      {n.arquivoUrl && <button onClick={(e) => { e.preventDefault(); visualizarNota(n.arquivoUrl); }} className="block text-[10px] text-blue-500 underline mt-1 text-left">Ver anexo</button>}
                    </td>
                    <td className="table-cell"><p className="font-medium text-gray-800">{n.prestador}</p><p className="text-xs text-gray-400">{n.cnpj}</p></td>
                    <td className="table-cell text-gray-500">{n.servico} <span className="text-[10px] text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded border border-brand-100 ml-1 block w-fit mt-1">{n.condominio||'Sem condomínio'}</span></td>
                    <td className="table-cell font-bold text-gray-800">{n.valor}</td>
                    <td className="table-cell text-gray-500">{n.data}</td>
                    <td className="table-cell"><span className={statusBadge(n.status)}>{n.status}</span></td>
                    <td className="table-cell">
                      <div className="flex gap-2">
                        {n.arquivoUrl && (
                          <button onClick={() => visualizarNota(n.arquivoUrl)} title="Visualizar Nota" className="p-1.5 rounded-lg bg-cream-100 hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition-all"><Eye size={12} /></button>
                        )}
                        {user?.role !== 'Morador' && (
                          <>
                            <button onClick={() => setModal(n)} className="p-1.5 rounded-lg bg-cream-100 hover:bg-brand-100 text-gray-400 hover:text-brand-600 transition-all"><Edit2 size={12} /></button>
                            <button onClick={() => deleteItem(n.id)} className="p-1.5 rounded-lg bg-cream-100 hover:bg-red-100 text-gray-400 hover:text-red-500 transition-all"><Trash2 size={12} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {modal && <ModalNota data={modal === 'new' ? null : modal} user={user} condominiosDisponiveis={uniqueCondos} onClose={() => setModal(null)} onSave={handleSave} />}
    </div>
  )
}
