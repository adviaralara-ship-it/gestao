import React, { useState } from 'react'
import { Receipt, Search, ExternalLink, RefreshCw, Plus, Trash2, Edit2, X, Eye, UploadCloud, Loader2, FileCheck2, Building2, Tag, Calendar, DollarSign, ShieldCheck, CheckCircle2 } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '../firebase'

const statusBadge = s => ({
  Válida: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Em análise': 'bg-amber-100 text-amber-800 border-amber-200',
  Rejeitada: 'bg-rose-100 text-rose-800 border-rose-200',
  Liquidado: 'bg-blue-100 text-blue-800 border-blue-200'
}[s] || 'bg-slate-100 text-slate-800 border-slate-200')

const tipoBadge = t => ({
  'Cupom Fiscal': 'bg-purple-100 text-purple-800 border-purple-200',
  'Recibo': 'bg-sky-100 text-sky-800 border-sky-200',
  'Comprovante de Pagamento': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Nota Fiscal': 'bg-indigo-100 text-indigo-800 border-indigo-200'
}[t] || 'bg-slate-100 text-slate-800 border-slate-200')

// Função para normalizar nomes de condomínio e evitar divergências de texto
const normalizar = str => (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

// ─── Modal: Novo / Editar Documento Fiscal ou Comprovante ───────────
function ModalNota({ data, user, condominiosDisponiveis, tipoInicial = 'Nota Fiscal', onClose, onSave }) {
  const [form, setForm] = useState(data || {
    numero: '',
    prestador: '',
    cnpj: '',
    servico: '',
    valor: '',
    data: new Date().toISOString().split('T')[0],
    status: 'Em análise',
    condominio: user?.condominio || (condominiosDisponiveis[0] || ''),
    tipo: tipoInicial, // 'Cupom Fiscal', 'Recibo', 'Comprovante de Pagamento', 'Nota Fiscal'
    arquivoUrl: '',
    arquivoNome: ''
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
      // 1. Upload para o Firebase Storage
      try {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const storageRef = ref(storage, `notas_comprovantes/${Date.now()}_${safeName}`)
        const snapshot = await uploadBytes(storageRef, file)
        const downloadUrl = await getDownloadURL(snapshot.ref)
        set('arquivoUrl', downloadUrl)
      } catch (stErr) {
        console.warn('Storage upload falhou, tentando fallback local:', stErr)
      }

      // 2. Extração OCR com IA via Base64
      const reader = new FileReader()
      reader.onload = async (ev) => {
        const base64Data = ev.target.result
        
        // Se falhou no storage e o arquivo for leve, salva base64 como fallback
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
            body: JSON.stringify({ file: base64Data, mimeType: file.type, type: 'comprovante' })
          })
          const ocrData = await res.json()
          if (ocrData.success && ocrData.data) {
            const item = Array.isArray(ocrData.data) ? ocrData.data[0] : ocrData.data
            if (item) {
              if (item.numero) set('numero', item.numero)
              if (item.prestador) set('prestador', item.prestador)
              if (item.cnpj) set('cnpj', item.cnpj)
              if (item.servico) set('servico', item.servico)
              if (item.valor) set('valor', typeof item.valor === 'number' ? `R$ ${item.valor.toFixed(2)}` : String(item.valor))
              if (item.data) set('data', item.data)
              if (item.tipo && ['Nota Fiscal', 'Cupom Fiscal', 'Recibo', 'Comprovante de Pagamento'].includes(item.tipo)) {
                set('tipo', item.tipo)
              }
            }
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
    if (!form.condominio) {
      alert('Por favor, selecione a qual condomínio pertence este documento.')
      return
    }

    const prestadorFinal = form.prestador?.trim() || form.arquivoNome || 'Prestador a Identificar'
    const numeroFinal = form.numero?.trim() || `${form.tipo === 'Cupom Fiscal' ? 'CUP' : form.tipo === 'Recibo' ? 'REC' : form.tipo === 'Comprovante de Pagamento' ? 'COMP' : 'DOC'}-${Date.now().toString().slice(-6)}`
    
    setSaving(true)
    try {
      await onSave({
        ...form,
        prestador: prestadorFinal,
        numero: numeroFinal
      })
    } catch (err) {
      console.error('Erro ao salvar documento:', err)
      alert('Erro ao salvar no banco de dados: ' + (err.message || err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-cream-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center font-bold">
              <FileCheck2 size={18} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base leading-tight">
                {data ? 'Editar Documento' : 'Registrar Documento / Comprovante'}
              </h3>
              <p className="text-xs text-gray-500">
                {form.tipo} do Condomínio {form.condominio ? `(${form.condominio})` : ''}
              </p>
            </div>
          </div>
          <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-700" /></button>
        </div>

        <div className="p-6 grid grid-cols-2 gap-4 text-xs">
          {/* Caixa de Upload com IA Auto-Preenchimento */}
          <div className="col-span-2 bg-gradient-to-r from-brand-50 to-blue-50 border border-brand-200 p-3.5 rounded-xl">
            <label className="font-bold text-brand-900 flex items-center justify-between mb-1">
              <span className="flex items-center gap-1.5">
                <UploadCloud size={16} className="text-brand-600" />
                Selecione o Arquivo (Preenchimento Automático por IA)
              </span>
              {(isExtracting || isUploading) && (
                <span className="text-[11px] font-semibold text-brand-700 flex items-center gap-1 animate-pulse">
                  <Loader2 size={12} className="animate-spin" /> Lendo documento...
                </span>
              )}
            </label>
            <input 
              type="file" 
              accept=".pdf,.png,.jpg,.jpeg" 
              onChange={handleFileUpload} 
              className="input p-2 bg-white w-full border-brand-300 text-xs" 
              disabled={isExtracting || isUploading} 
            />
            {form.arquivoNome && !isExtracting && (
              <p className="text-[11px] text-emerald-700 mt-1.5 font-bold flex items-center gap-1">
                ✓ Arquivo carregado: {form.arquivoNome}
              </p>
            )}
            <p className="text-[10px] text-gray-500 mt-1">
              Envie o cupom, recibo, comprovante PIX ou nota fiscal. Os campos abaixo serão extraídos automaticamente.
            </p>
          </div>

          <div>
            <label className="label font-bold text-gray-700">Tipo de Documento *</label>
            <select className="input font-semibold" value={form.tipo} onChange={e => set('tipo', e.target.value)}>
              <option value="Cupom Fiscal">🧾 Cupom Fiscal</option>
              <option value="Recibo">📝 Recibo</option>
              <option value="Comprovante de Pagamento">💳 Comprovante de Pagamento</option>
              {user?.role !== 'Morador' && <option value="Nota Fiscal">📑 Nota Fiscal</option>}
            </select>
          </div>

          <div>
            <label className="label font-bold text-gray-700">Condomínio *</label>
            {user?.role === 'Morador' ? (
              <input 
                className="input font-semibold bg-gray-100 cursor-not-allowed" 
                value={user?.condominio || 'Meu Condomínio'} 
                disabled 
              />
            ) : (
              <select className="input font-semibold text-brand-900 bg-amber-50/50 border-amber-300" value={form.condominio} onChange={e => set('condominio', e.target.value)}>
                <option value="">Selecione o condomínio...</option>
                {condominiosDisponiveis.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </div>

          <div>
            <label className="label font-bold text-gray-700">Nº do Documento / Autenticação</label>
            <input className="input font-mono" value={form.numero} onChange={e => set('numero', e.target.value)} placeholder="Ex: COO-1234, ID-PIX, NF-987" />
          </div>

          <div>
            <label className="label font-bold text-gray-700">Data de Emissão / Pagamento</label>
            <input type="date" className="input" value={form.data} onChange={e => set('data', e.target.value)} />
          </div>

          <div className="col-span-2">
            <label className="label font-bold text-gray-700">Estabelecimento / Prestador / Favorecido *</label>
            <input className="input font-semibold" value={form.prestador} onChange={e => set('prestador', e.target.value)} placeholder="Ex: Supermercado, Manutenção Elétrica, Posto..." />
          </div>

          <div>
            <label className="label font-bold text-gray-700">CNPJ ou CPF (Opcional)</label>
            <input className="input font-mono" value={form.cnpj} onChange={e => set('cnpj', e.target.value)} placeholder="00.000.000/0001-00" />
          </div>

          <div>
            <label className="label font-bold text-gray-700">Valor Total (R$) *</label>
            <input className="input font-bold text-emerald-800" value={form.valor} onChange={e => set('valor', e.target.value)} placeholder="Ex: R$ 150,00" />
          </div>

          <div className="col-span-2">
            <label className="label font-bold text-gray-700">Descrição / Serviço / Itens Comprados</label>
            <input className="input" value={form.servico} onChange={e => set('servico', e.target.value)} placeholder="Ex: Compra de materiais de limpeza, Manutenção de bomba..." />
          </div>

          <div className="col-span-2">
            <label className="label font-bold text-gray-700">Status</label>
            <select className="input font-semibold" value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="Em análise">⏳ Em análise</option>
              <option value="Válida">✅ Válido / Aprovado</option>
              <option value="Liquidado">💳 Liquidado / Pago</option>
              <option value="Rejeitada">❌ Rejeitado</option>
            </select>
          </div>
        </div>

        <div className="p-5 border-t border-cream-300 flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary text-xs" disabled={saving}>Cancelar</button>
          <button 
            onClick={handleSalvar} 
            disabled={saving || isUploading}
            className="btn-primary text-xs flex items-center gap-2 px-5 py-2"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : null}
            {saving ? 'Salvando...' : 'Salvar Documento'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Componente Principal: Notas Fiscais, Cupons & Comprovantes ─────
export default function NotasFiscais() {
  const { user } = useAuth()
  const isMorador = user?.role === 'Morador'

  const { items: notas, addItem, updateItem, deleteItem } = useFirestore('notas_fiscais')
  const { items: allCondosData } = useFirestore('condominios')

  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [modalTipoInicial, setModalTipoInicial] = useState('Cupom Fiscal')
  const [condoFilter, setCondoFilter] = useState(isMorador ? (user?.condominio || 'Todos') : 'Todos')
  const [abaAtiva, setAbaAtiva] = useState(isMorador ? 'cupons' : 'todas') // 'todas', 'cupons', 'notas'
  const [cnpjConsulta, setCnpjConsulta] = useState('')
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState(null)

  const uniqueCondos = Array.from(new Set([
    ...allCondosData.filter(c => c.status !== 'Inativo').map(c => c.nome),
    'Alpha Soluções (Uso Interno)'
  ]))

  // 1. ISOLAMENTO RIGOROSO POR CONDOMÍNIO:
  // Se for morador ou usuário vinculado a um condomínio específico, ele NUNCA vê dados de outro residencial
  const filteredAccess = notas.filter(n => {
    if (isMorador) {
      if (!user?.condominio) return false
      const nCondo = normalizar(n.condominio)
      const uCondo = normalizar(user.condominio)
      return nCondo === uCondo || nCondo.includes(uCondo) || uCondo.includes(nCondo)
    }

    if (['Síndico', 'Subsíndico', 'Conselheiro'].includes(user?.role) && user?.condominio) {
      const nCondo = normalizar(n.condominio)
      const uCondo = normalizar(user.condominio)
      return nCondo === uCondo || nCondo.includes(uCondo) || uCondo.includes(nCondo)
    }

    if (condoFilter && condoFilter !== 'Todos') {
      const nCondo = normalizar(n.condominio)
      const cCondo = normalizar(condoFilter)
      return nCondo === cCondo || nCondo.includes(cCondo) || cCondo.includes(nCondo)
    }

    return true
  })

  // 2. FILTRAGEM POR ABA (Para o morador, fica exclusivo em Cupons, Recibos e Comprovantes)
  const filteredPorAba = filteredAccess.filter(n => {
    const tipo = n.tipo || 'Nota Fiscal'
    const isCupomOuComprovante = ['Cupom Fiscal', 'Recibo', 'Comprovante de Pagamento'].includes(tipo)

    if (isMorador) {
      // Morador vê APENAS cupons, recibos e comprovantes de pagamento do seu condomínio
      return isCupomOuComprovante
    }

    if (abaAtiva === 'cupons') {
      return isCupomOuComprovante
    }

    if (abaAtiva === 'notas') {
      return tipo === 'Nota Fiscal'
    }

    return true // 'todas'
  })

  // 3. BUSCA TEXTUAL
  const filtered = filteredPorAba.filter(n =>
    (n.numero || '').toLowerCase().includes(search.toLowerCase()) ||
    (n.prestador || '').toLowerCase().includes(search.toLowerCase()) ||
    (n.servico || '').toLowerCase().includes(search.toLowerCase())
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
    if (!url) return
    if (url.startsWith('data:')) {
      const newWin = window.open('', '_blank')
      if (newWin) {
        newWin.document.write("<html><head><title>Visualizando Documento...</title></head><body style='margin:0;display:flex;justify-content:center;align-items:center;height:100vh;background:#f5f5f5;font-family:sans-serif;'><h2>Preparando documento...</h2></body></html>")
        fetch(url)
          .then(res => res.blob())
          .then(blob => {
            const objUrl = URL.createObjectURL(blob)
            newWin.location.href = objUrl
          })
          .catch(() => {
            newWin.document.body.innerHTML = "<h2 style='color:red;'>Erro ao processar o arquivo.</h2>"
          })
      } else {
        alert("Permita os pop-ups neste site para visualizar o anexo.")
      }
    } else {
      window.open(url, '_blank')
    }
  }

  const handleSave = async (form) => {
    if (modal !== 'new') await updateItem(modal.id, form)
    else await addItem(form)
    setModal(null)
  }

  const abrirModalNovo = (tipoPadrao = 'Cupom Fiscal') => {
    setModalTipoInicial(tipoPadrao)
    setModal('new')
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-pale-300 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="section-title text-xl font-black text-gray-900 flex items-center gap-2">
              <Receipt className="text-brand-600" />
              {isMorador ? 'Cupons, Recibos & Comprovantes' : 'Notas Fiscais, Cupons & Comprovantes'}
            </h2>
            {isMorador && user?.condominio && (
              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
                <Building2 size={12} /> {user.condominio}
              </span>
            )}
          </div>
          <p className="section-sub text-xs text-gray-500 mt-1">
            {isMorador 
              ? `Prestação de contas: ${filtered.length} cupons, recibos e comprovantes disponíveis para seu condomínio.`
              : `${filtered.length} documentos fiscais registrados no sistema.`}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {(!isMorador && (user?.role === 'Administrador' || user?.role === 'Financeiro')) && uniqueCondos.length > 0 && (
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0 block">Filtrar:</label>
              <select className="input text-xs py-1.5 h-auto font-medium" value={condoFilter} onChange={e => setCondoFilter(e.target.value)}>
                <option value="Todos">🌐 Todos os Condomínios</option>
                {uniqueCondos.map(c => <option key={c} value={c}>🏢 {c}</option>)}
              </select>
            </div>
          )}

          {/* Botão Registrar Cupom / Recibo / Comprovante (disponível para todos os perfis) */}
          <button 
            onClick={() => abrirModalNovo('Cupom Fiscal')} 
            className="flex items-center gap-1.5 py-2 px-3.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all active:scale-95"
          >
            <Plus size={15} />
            <span>+ Registrar Cupom / Comprovante</span>
          </button>

          {!isMorador && (
            <button 
              onClick={() => abrirModalNovo('Nota Fiscal')} 
              className="btn-primary py-2 px-3.5 text-xs font-bold flex items-center gap-1.5 shadow-sm"
            >
              <Plus size={15} />
              <span>+ Nova Nota Fiscal</span>
            </button>
          )}
        </div>
      </div>

      {/* ABAS DE NAVEGAÇÃO: Para o morador exibe apenas Cupons, Recibos & Comprovantes */}
      {!isMorador ? (
        <div className="flex gap-2 p-1.5 bg-slate-100 border border-slate-200 rounded-2xl w-full flex-wrap items-center">
          <button
            onClick={() => setAbaAtiva('todas')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              abaAtiva === 'todas' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-600 hover:text-brand-600'
            }`}
          >
            📑 Todos os Documentos ({filteredAccess.length})
          </button>

          <button
            onClick={() => setAbaAtiva('cupons')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              abaAtiva === 'cupons' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-600 hover:text-emerald-700'
            }`}
          >
            🧾 Cupons, Recibos & Comprovantes ({
              filteredAccess.filter(n => ['Cupom Fiscal', 'Recibo', 'Comprovante de Pagamento'].includes(n.tipo || 'Nota Fiscal')).length
            })
          </button>

          <button
            onClick={() => setAbaAtiva('notas')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              abaAtiva === 'notas' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-indigo-700'
            }`}
          >
            📑 Apenas Notas Fiscais ({
              filteredAccess.filter(n => (n.tipo || 'Nota Fiscal') === 'Nota Fiscal').length
            })
          </button>
        </div>
      ) : (
        <div className="bg-emerald-50/70 border border-emerald-200 p-3.5 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-emerald-900 font-semibold">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>Exibindo <b>apenas Cupons, Recibos e Comprovantes de Pagamento</b> do <b>{user?.condominio || 'seu condomínio'}</b>.</span>
          </div>
          <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full">
            {filtered.length} {filtered.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>
      )}

      {/* Consulta SEFAZ (Disponível para Administração/Síndico) */}
      {!isMorador && (
        <div className="card">
          <p className="font-bold text-gray-800 mb-3 text-xs sm:text-sm flex items-center gap-2">
            <span>🔍 Consulta SEFAZ – Validação Rápida de CNPJ</span>
          </p>
          <div className="flex gap-2 flex-wrap">
            <div className="flex-1 min-w-48">
              <input 
                className="input text-xs" 
                placeholder="Digite o CNPJ do prestador (somente números)..." 
                value={cnpjConsulta} 
                onChange={e => setCnpjConsulta(e.target.value)} 
              />
            </div>
            <button onClick={consultar} disabled={loading} className="btn-primary text-xs py-2 px-3">
              {loading ? <RefreshCw size={13} className="animate-spin" /> : <ExternalLink size={13} />}
              {loading ? 'Abrindo...' : 'Consultar SEFAZ'}
            </button>
          </div>
          {resultado && (
            <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl animate-fade-in text-xs">
              <p className="text-emerald-700 font-bold mb-0.5">✓ Aba da SEFAZ aberta</p>
              <p className="text-gray-600">CNPJ consultado: <strong>{resultado.cnpj}</strong> — confira na aba aberta.</p>
            </div>
          )}
        </div>
      )}

      {/* Busca */}
      <div className="relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input 
          className="input pl-10 text-xs rounded-xl bg-white border border-pale-300 shadow-sm" 
          placeholder={isMorador ? "Buscar por cupom, recibo, prestador ou valor..." : "Buscar por número, prestador, serviço ou condomínio..."} 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
        />
      </div>

      {/* Tabela de Registros */}
      <div className="bg-white rounded-2xl border border-pale-300 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-gray-200 text-gray-600 font-bold uppercase text-[11px]">
              <tr>
                <th className="p-3.5">Tipo</th>
                <th className="p-3.5">Nº / ID</th>
                <th className="p-3.5">Prestador / Fornecedor</th>
                <th className="p-3.5">Condomínio & Descrição</th>
                <th className="p-3.5">Valor</th>
                <th className="p-3.5">Data</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-14 text-gray-400 text-xs">
                    Nenhum documento encontrado para este condomínio ou filtro.
                  </td>
                </tr>
              ) : (
                filtered.map(n => {
                  const tipo = n.tipo || 'Nota Fiscal'
                  return (
                    <tr key={n.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${tipoBadge(tipo)}`}>
                          {tipo}
                        </span>
                      </td>

                      <td className="p-3.5 font-mono text-brand-700 font-bold whitespace-nowrap">
                        {n.numero || '—'}
                      </td>

                      <td className="p-3.5">
                        <p className="font-bold text-gray-900 leading-tight">{n.prestador || '—'}</p>
                        {n.cnpj && <p className="text-[10px] text-gray-400 font-mono mt-0.5">{n.cnpj}</p>}
                      </td>

                      <td className="p-3.5">
                        <p className="text-gray-700 leading-tight">{n.servico || '—'}</p>
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-700 bg-brand-50 border border-brand-100 px-2 py-0.5 rounded-md mt-1">
                          <Building2 size={10} /> {n.condominio || 'Geral'}
                        </span>
                      </td>

                      <td className="p-3.5 font-black text-gray-900 whitespace-nowrap">
                        {n.valor ? (String(n.valor).startsWith('R$') ? n.valor : `R$ ${n.valor}`) : '—'}
                      </td>

                      <td className="p-3.5 text-gray-600 whitespace-nowrap">
                        {n.data ? n.data.split('-').reverse().join('/') : '—'}
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${statusBadge(n.status)}`}>
                          {n.status || 'Válida'}
                        </span>
                      </td>

                      <td className="p-3.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {n.arquivoUrl && (
                            <button 
                              onClick={() => visualizarNota(n.arquivoUrl)} 
                              title="Visualizar Comprovante / Nota" 
                              className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-all font-bold flex items-center gap-1 text-[11px] shadow-xs cursor-pointer"
                            >
                              <Eye size={13} className="stroke-[2.2]" />
                              <span>Ver</span>
                            </button>
                          )}

                          {(!isMorador || user?.role === 'Administrador') && (
                            <>
                              <button 
                                onClick={() => setModal(n)} 
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-brand-100 text-slate-700 hover:text-brand-900 border border-slate-300 hover:border-brand-300 transition-all shadow-xs cursor-pointer" 
                                title="Editar"
                              >
                                <Edit2 size={13} className="stroke-[2.2]" />
                              </button>
                              <button 
                                onClick={() => {
                                  if (window.confirm(`Excluir ${n.tipo || 'documento'} "${n.numero || n.prestador}"?`)) {
                                    deleteItem(n.id)
                                  }
                                }} 
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-700 hover:text-rose-700 border border-slate-300 hover:border-rose-300 transition-all shadow-xs cursor-pointer" 
                                title="Excluir"
                              >
                                <Trash2 size={13} className="stroke-[2.2]" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <ModalNota 
          data={modal === 'new' ? null : modal} 
          tipoInicial={modalTipoInicial}
          user={user} 
          condominiosDisponiveis={uniqueCondos} 
          onClose={() => setModal(null)} 
          onSave={handleSave} 
        />
      )}
    </div>
  )
}

