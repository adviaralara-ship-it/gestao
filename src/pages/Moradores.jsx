import React, { useState } from 'react'
import { Users, Plus, Search, Edit2, Trash2, Phone, Mail, Filter, PawPrint, Home, UserCheck, LayoutGrid, Table as TableIcon, X, Upload, FileSpreadsheet, Share2, Copy, Check, MessageSquare, CheckCircle2, AlertCircle, CheckSquare, Square, Send, Loader2 } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'
import { collection, query, where, getDocs, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'

function MoradorModal({ data, onClose, onSave, isMorador, currentUser, initialApt, initialBloco, initialCondo }) {
  const [form, setForm] = useState(data || {
    nome: '',
    cpf: '',
    apt: initialApt || (isMorador ? (currentUser.unidade || currentUser.apt) : ''),
    bloco: initialBloco || (isMorador ? currentUser.bloco : ''),
    tel: '',
    email: '',
    status: isMorador ? 'Dependente' : 'Proprietário',
    condominio: initialCondo || (isMorador ? currentUser.condominio : ''),
    fotoRosto: ''
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleImage = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_WIDTH = 600
        const scaleSize = MAX_WIDTH / img.width
        canvas.width = MAX_WIDTH
        canvas.height = img.height * scaleSize
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const base64 = canvas.toDataURL('image/jpeg', 0.8)
        set('fotoRosto', base64)
      }
      img.src = event.target.result
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="p-4 sm:p-6 border-b border-cream-300 flex items-center justify-between gap-3">
          <h3 className="font-bold text-gray-800 text-base sm:text-lg min-w-0 flex-1 truncate">{data ? 'Editar Membro da Família' : 'Novo Morador / Familiar'}</h3>
          <button onClick={onClose} className="modal-close-btn" title="Fechar"><X size={20} strokeWidth={2.5} /></button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Nome Completo *</label>
            <input className="input uppercase" value={form.nome} onChange={e => set('nome', e.target.value.toUpperCase())} placeholder="EX: JOÃO DA SILVA" />
          </div>
          <div>
            <label className="label">CPF (Apenas números)</label>
            <input className="input" value={form.cpf || ''} onChange={e => set('cpf', e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="00000000000" />
          </div>
          <div>
            <label className="label">Grau / Vínculo *</label>
            <select className="input" value={form.status} onChange={e => set('status', e.target.value)} disabled={isMorador && form.status === 'Proprietário'}>
              {isMorador ? (
                <>
                  {form.status === 'Proprietário' && <option>Proprietário</option>}
                  <option>Dependente</option>
                  <option>Inquilino</option>
                </>
              ) : (
                <>
                  <option>Proprietário</option>
                  <option>Inquilino</option>
                  <option>Dependente</option>
                </>
              )}
            </select>
          </div>
          <div>
            <label className="label">Condomínio</label>
            <input className="input uppercase" value={form.condominio} onChange={e => set('condominio', e.target.value.toUpperCase())} disabled={isMorador} placeholder="NOME DO CONDOMÍNIO" />
          </div>
          <div>
            <label className="label">Apartamento / Unidade *</label>
            <input className="input font-bold uppercase" value={form.apt} onChange={e => set('apt', e.target.value.toUpperCase())} disabled={isMorador} placeholder="Ex: 101" />
          </div>
          <div>
            <label className="label">Bloco</label>
            <input className="input uppercase" value={form.bloco || ''} onChange={e => set('bloco', e.target.value.toUpperCase())} disabled={isMorador} placeholder="Ex: A" />
          </div>
          <div>
            <label className="label">Telefone / WhatsApp</label>
            <input className="input" value={form.tel} onChange={e => set('tel', e.target.value)} placeholder="(00) 00000-0000" />
          </div>
          <div className="col-span-2">
            <label className="label">E-mail</label>
            <input className="input" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@exemplo.com" />
          </div>

          <div className="col-span-2 border-t border-cream-200 mt-2 pt-4">
            <label className="label text-brand-700 font-bold">Reconhecimento Facial (Portaria)</label>
            <p className="text-xs text-gray-500 mb-3">Tire uma selfie bem iluminada do rosto para liberar o acesso facial na portaria/catraca.</p>
            {form.fotoRosto ? (
              <div className="flex items-center gap-4">
                <img src={form.fotoRosto} alt="Rosto" className="w-20 h-20 object-cover rounded-full border-4 border-brand-200 shadow-md" />
                <button onClick={() => set('fotoRosto', '')} className="btn-secondary text-red-500 hover:text-red-600 text-xs py-1 px-3">Remover Foto</button>
              </div>
            ) : (
              <input type="file" accept="image/*" capture="user" onChange={handleImage} className="input text-sm file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100" />
            )}
          </div>
        </div>
        <div className="p-6 border-t border-cream-300 flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={() => onSave(form)} className="btn-primary">Salvar Morador</button>
        </div>
      </div>
    </div>
  )
}

function PetModalRapido({ data, onClose, onSave, currentUser }) {
  const [form, setForm] = useState(data || {
    nome: '',
    tipo: 'Cachorro',
    raca: '',
    porte: 'Médio',
    condominio: currentUser?.condominio || '',
    apt: currentUser?.unidade || currentUser?.apt || '',
    bloco: currentUser?.bloco || '',
    dono: currentUser?.nome || '',
    foto: ''
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-4 sm:p-6 border-b border-cream-300 flex items-center justify-between gap-3">
          <h3 className="font-bold text-gray-800 text-base min-w-0 flex-1 truncate">🐾 {data ? 'Editar Pet' : 'Cadastrar Pet da Unidade'}</h3>
          <button onClick={onClose} className="modal-close-btn" title="Fechar"><X size={20} strokeWidth={2.5} /></button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Nome do Pet *</label>
            <input className="input" value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Ex: Thor, Mel..." />
          </div>
          <div>
            <label className="label">Espécie</label>
            <select className="input" value={form.tipo} onChange={e => set('tipo', e.target.value)}>
              <option>Cachorro</option>
              <option>Gato</option>
              <option>Pássaro</option>
              <option>Outro</option>
            </select>
          </div>
          <div>
            <label className="label">Porte</label>
            <select className="input" value={form.porte} onChange={e => set('porte', e.target.value)}>
              <option>Pequeno</option>
              <option>Médio</option>
              <option>Grande</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">Raça / Cor</label>
            <input className="input" value={form.raca} onChange={e => set('raca', e.target.value)} placeholder="Ex: Golden, Siamês..." />
          </div>
        </div>
        <div className="p-6 border-t border-cream-300 flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={() => onSave(form)} className="btn-primary">Salvar Pet</button>
        </div>
      </div>
    </div>
  )
}

function ModalCompartilharLink({ link, titulo, descricao, onClose }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch {
      prompt('Copie o link abaixo:', link)
    }
  }

  const handleShareWhatsApp = () => {
    const texto = `*Alpha Soluções Condominiais*\n\nOlá! Para concluir o seu cadastro de morador e ter acesso imediato ao seu apartamento, boletos e serviços, acesse o link oficial:\n\n${link}`
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank')
  }

  return (
    <div className="modal-overlay z-50 p-4" onClick={onClose}>
      <div className="modal-content max-w-lg w-full bg-white rounded-3xl p-6 shadow-2xl border border-gray-200" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between pb-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-brand-100 text-brand-700 flex items-center justify-center font-bold">
              <Share2 size={20} />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">{titulo || 'Link de Auto-Cadastro'}</h3>
              <p className="text-xs text-gray-500">{descricao || 'Envie ao morador para ele concluir os dados'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>

        <div className="py-5 flex flex-col gap-4">
          <p className="text-xs text-gray-600 leading-relaxed">
            Ao abrir este link, o morador já encontrará o condomínio e a unidade preenchidos e travados. Ele só precisará cadastrar o CPF, e-mail e senha de acesso.
          </p>

          <div className="p-3 bg-slate-50 border border-gray-200 rounded-2xl flex items-center justify-between gap-2">
            <input
              type="text"
              readOnly
              value={link}
              className="bg-transparent border-0 text-xs font-mono text-gray-700 w-full focus:outline-none select-all truncate"
            />
            <button
              onClick={handleCopy}
              className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 shrink-0 transition-all ${
                copied ? 'bg-emerald-600 text-white' : 'bg-brand-600 hover:bg-brand-500 text-white'
              }`}
            >
              {copied ? <><Check size={14} /> Copiado!</> : <><Copy size={14} /> Copiar Link</>}
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleShareWhatsApp}
              className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <MessageSquare size={16} /> Compartilhar no WhatsApp
            </button>
            <button
              onClick={handleCopy}
              className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
            >
              Copiar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ModalImportarUnidades({ condominios = [], onImport, onClose }) {
  const [condoNome, setCondoNome] = useState(condominios[0]?.nome || '')
  const [textoColado, setTextoColado] = useState('')
  const [arquivoNome, setArquivoNome] = useState('')
  const [unidadesParsed, setUnidadesParsed] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [modo, setModo] = useState('arquivo') // 'arquivo' | 'colar'

  const processarTexto = (rawText) => {
    if (!rawText || !rawText.trim()) {
      setUnidadesParsed([])
      return
    }

    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    if (lines.length === 0) {
      setUnidadesParsed([])
      return
    }

    // Tenta detectar cabeçalho na primeira linha
    let startIdx = 0
    const firstLineLower = lines[0].toLowerCase()
    let colApt = -1, colNome = -1, colTel = -1, colBloco = -1, colEmail = -1, colCpf = -1

    const separadores = [';', '\t', ',']
    let bestSep = ','
    let maxSplits = 0
    for (const sep of separadores) {
      const count = lines[0].split(sep).length
      if (count > maxSplits) {
        maxSplits = count
        bestSep = sep
      }
    }

    const headers = lines[0].split(bestSep).map(h => h.trim().toLowerCase().replace(/["']/g, ''))
    
    // Verifica se a primeira linha é cabeçalho
    const temPalavraChave = headers.some(h => 
      h.includes('apt') || h.includes('apartamento') || h.includes('unidade') || 
      h.includes('nome') || h.includes('morador') || h.includes('tel') || h.includes('bloco')
    )

    if (temPalavraChave) {
      startIdx = 1
      headers.forEach((h, idx) => {
        if (h.includes('apt') || h.includes('apartamento') || h.includes('unidade') || h.includes('numero') || h.includes('num')) {
          if (colApt === -1) colApt = idx
        } else if (h.includes('nome') || h.includes('morador') || h.includes('responsavel') || h.includes('proprietario')) {
          if (colNome === -1) colNome = idx
        } else if (h.includes('tel') || h.includes('whats') || h.includes('cel') || h.includes('fone')) {
          if (colTel === -1) colTel = idx
        } else if (h.includes('bloco') || h.includes('torre') || h.includes('quadra')) {
          if (colBloco === -1) colBloco = idx
        } else if (h.includes('email') || h.includes('e-mail')) {
          if (colEmail === -1) colEmail = idx
        } else if (h.includes('cpf') || h.includes('doc')) {
          if (colCpf === -1) colCpf = idx
        }
      })
    }

    const parsed = []

    for (let i = startIdx; i < lines.length; i++) {
      let line = lines[i]
      if (!line) continue

      let apt = ''
      let nome = ''
      let tel = ''
      let bloco = ''
      let email = ''
      let cpf = ''

      // ── PADRÃO 1: Linha textual com palavras-chave (Ex: "1. Unidade: 101 Morador(a): ANDRESSA MOREIRA" ou com "Bloco: A") ──
      // Remove numeração de lista no início como "1. ", "01 - ", "1) "
      const cleanLine = line.replace(/^\s*\d+[\s.)-]+\s*/i, '').trim()

      if (/unidade|morador|apartamento|bloco|cpf|email|e-mail|tel|cel|whats/i.test(cleanLine)) {
        // Extrai Bloco se houver: "Bloco: A", "Bl. B", "Bloco 2", "Torre: 1"
        const mBloco = cleanLine.match(/(?:bloco|bl\.?|torre|quadra)\s*[:=-]?\s*([a-zA-Z0-9]+)/i)
        if (mBloco) bloco = mBloco[1]

        // Extrai Unidade / Apartamento: "Unidade: 101", "Apt: 101", "Apartamento: 204"
        const mApt = cleanLine.match(/(?:unidade|apartamento|apto?\.?|apt\.?)\s*[:=-]?\s*([a-zA-Z0-9-]+)/i)
        if (mApt) apt = mApt[1]

        // Extrai CPF se houver (com ou sem pontuação: "CPF: 123.456.789-00" ou "12345678900")
        const mCpf = cleanLine.match(/(?:cpf|doc(?:umento)?)\s*[:=-]?\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{11})/i) 
          || cleanLine.match(/\b(\d{3}\.\d{3}\.\d{3}-\d{2})\b/)
        if (mCpf) cpf = mCpf[1].replace(/\D/g, '')

        // Extrai E-mail se houver (com "Email: xxx@xxx" ou formato de e-mail direto)
        const mEmail = cleanLine.match(/(?:email|e-mail)\s*[:=-]?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i)
          || cleanLine.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/)
        if (mEmail) email = mEmail[1].trim().toLowerCase()

        // Extrai Telefone se houver
        const mTel = cleanLine.match(/(?:tel|telefone|cel|celular|whats|whatsapp|fone)\s*[:=-]?\s*([\d()\s+-]{8,20})/i)
          || cleanLine.match(/(?:\(?\d{2}\)?\s*(?:9\s*)?\d{4}[-\s]?\d{4})/)
        if (mTel) tel = mTel[1].trim()

        // Extrai Morador: "Morador(a): NOME", "Morador: NOME", "Nome: NOME"
        const mNome = cleanLine.match(/(?:morador(?:\(a\))?|nome|respons[aá]vel|propriet[aá]rio)\s*(?:\(a\))?\s*[:=-]?\s*([^,\n;]+)/i)
        if (mNome) {
          // Remove trechos adicionais caso os outros campos venham na mesma string
          nome = mNome[1]
            .replace(/(?:telefone|tel|cel|whats|whatsapp|fone|cpf|email|e-mail|bloco|torre|quadra)\s*[:=-]?.*$/i, '')
            .trim()
        }
      }

      // ── PADRÃO 2: Colunas delimitadas por CSV / Tabela / Tabulação se não extraiu por texto ──
      if (!apt && !nome) {
        // Divide linha pelas colunas
        const parts = line.split(bestSep).map(p => p.trim().replace(/^["']|["']$/g, ''))
        if (parts.length === 0 || (parts.length === 1 && !parts[0])) continue

        if (colApt !== -1 || colNome !== -1) {
          if (colApt !== -1 && parts[colApt]) apt = parts[colApt]
          if (colNome !== -1 && parts[colNome]) nome = parts[colNome]
          if (colTel !== -1 && parts[colTel]) tel = parts[colTel]
          if (colBloco !== -1 && parts[colBloco]) bloco = parts[colBloco]
          if (colEmail !== -1 && parts[colEmail]) email = parts[colEmail]
          if (colCpf !== -1 && parts[colCpf]) cpf = parts[colCpf]
        } else {
          // Modo heurístico sem cabeçalho:
          // Padrão A: Apt, Nome, Telefone, Bloco
          if (/^(apt|ap|bl|casa)?\s*\d+[a-zA-Z]?$/i.test(parts[0]) || /^\d+$/.test(parts[0].replace(/\D/g, ''))) {
            apt = parts[0].replace(/^(apt|ap|unidade)\s*/i, '').trim()
            nome = parts[1] || `Morador Apt ${apt}`
            tel = parts[2] || ''
            bloco = parts[3] || ''
          } else {
            // Padrão B: Nome, Apt, Telefone, Bloco
            nome = parts[0]
            apt = (parts[1] || '').replace(/^(apt|ap|unidade)\s*/i, '').trim()
            tel = parts[2] || ''
            bloco = parts[3] || ''
          }
        }
      }

      // Limpeza e Normalização Final
      apt = String(apt || '')
        .replace(/^(unidade|apartamento|apt|ap)\s*[:=-]?\s*/i, '')
        .trim()

      nome = String(nome || '')
        .replace(/^(morador(?:\(a\))?|nome)\s*(?:\(a\))?\s*[:=-]?\s*/i, '')
        .replace(/^[0-9]+[\s.)-]+\s*/, '')
        .trim()
        .toUpperCase()

      bloco = String(bloco || '')
        .replace(/^(bloco|bl\.?|torre)\s*[:=-]?\s*/i, '')
        .trim()
        .toUpperCase()

      tel = String(tel || '').trim()
      cpf = String(cpf || '').replace(/\D/g, '')

      if (apt) {
        parsed.push({
          apt,
          bloco,
          nome: nome || `MORADOR APT ${apt}`,
          tel,
          email,
          cpf,
          status: 'Proprietário',
          cadastroCompleto: false
        })
      }
    }

    setUnidadesParsed(parsed)
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setArquivoNome(file.name)

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target.result
      setTextoColado(content)
      processarTexto(content)
    }
    reader.readAsText(file)
  }

  const handleImportar = async () => {
    if (!condoNome) {
      alert('Por favor, selecione o condomínio de destino.')
      return
    }
    if (unidadesParsed.length === 0) {
      alert('Nenhuma unidade/apartamento válido foi identificado para importação.')
      return
    }

    setIsSubmitting(true)
    try {
      await onImport(condoNome, unidadesParsed)
      onClose()
    } catch (err) {
      console.error(err)
      alert('Erro ao importar unidades: ' + (err.message || 'Tente novamente.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay z-50 p-4" onClick={onClose}>
      <div className="modal-content max-w-2xl w-full bg-white rounded-3xl p-0 shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        {/* Cabeçalho */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-600 text-white flex items-center justify-center font-bold">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg">Importar Lista de Apartamentos</h3>
              <p className="text-xs text-slate-400">Preenchimento automático das unidades de um condomínio</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10">
            <X size={20} />
          </button>
        </div>

        {/* Corpo com scroll */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-5 bg-slate-50">
          {/* Seletor de Condomínio */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col gap-2">
            <label className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              🏢 1. Selecione o Condomínio de Destino *
            </label>
            <select
              className="input text-xs font-bold bg-slate-50"
              value={condoNome}
              onChange={e => setCondoNome(e.target.value)}
            >
              <option value="">Selecione um condomínio cadastrado...</option>
              {condominios.map(c => (
                <option key={c.id || c.nome} value={c.nome}>
                  {c.nome} {c.unidades ? `(${c.unidades} unidades)` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Abas Arquivo vs Colar */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-900 uppercase tracking-wider">
                📄 2. Forneça os Dados das Unidades
              </label>
              <div className="flex bg-slate-100 p-0.5 rounded-lg border border-gray-200">
                <button
                  type="button"
                  onClick={() => setModo('arquivo')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                    modo === 'arquivo' ? 'bg-white text-brand-700 shadow-xs' : 'text-gray-500'
                  }`}
                >
                  Subir Arquivo (.csv / .txt)
                </button>
                <button
                  type="button"
                  onClick={() => setModo('colar')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                    modo === 'colar' ? 'bg-white text-brand-700 shadow-xs' : 'text-gray-500'
                  }`}
                >
                  Colar da Planilha
                </button>
              </div>
            </div>

            {modo === 'arquivo' ? (
              <label className="border-2 border-dashed border-brand-300 hover:border-brand-500 bg-brand-50/50 hover:bg-brand-50/80 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all">
                <Upload size={32} className="text-brand-600 mb-2" />
                <span className="text-xs font-bold text-brand-900">
                  {arquivoNome ? `Arquivo selecionado: ${arquivoNome}` : 'Clique para selecionar arquivo CSV ou TXT'}
                </span>
                <span className="text-[11px] text-gray-500 mt-1">
                  Formatos aceitos: Planilha CSV exportada do Excel, Google Planilhas ou bloco de notas
                </span>
                <input
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            ) : (
              <div>
                <textarea
                  rows={6}
                  value={textoColado}
                  onChange={e => {
                    setTextoColado(e.target.value)
                    processarTexto(e.target.value)
                  }}
                  className="input font-mono text-xs w-full p-3 bg-slate-50"
                  placeholder={`Exemplos aceitos:
1. Unidade: 101 Morador(a): ANDRESSA MARIA MOREIRA PALITOT
2. Unidade: 102 Bloco: A Morador(a): LUAN ACCIOLY MARTINS
ou colunas de planilha:
101, ANDRESSA MARIA, 83999999999, Bloco A`}
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  💡 Aceita formato de lista (ex: <i>1. Unidade: 101 Morador(a): Nome</i>) ou colunas copiadas do Excel/Google Planilhas. O sistema extrai e preenche o <b>Nome</b>, <b>Apartamento</b> e <b>Bloco</b> no lugar correto automaticamente.
                </p>
              </div>
            )}
          </div>

          {/* Pré-visualização dos dados identificados */}
          {unidadesParsed.length > 0 && (
            <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  {unidadesParsed.length} unidades identificadas com sucesso:
                </span>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                  Pronto para cadastrar
                </span>
              </div>

              <div className="max-h-48 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-xl mt-1">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 font-bold text-gray-600 sticky top-0">
                    <tr>
                      <th className="p-2">Apt</th>
                      <th className="p-2">Bloco</th>
                      <th className="p-2">Nome do Titular</th>
                      <th className="p-2">CPF</th>
                      <th className="p-2">Telefone</th>
                      <th className="p-2">E-mail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {unidadesParsed.map((u, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2 font-bold text-brand-700">{u.apt}</td>
                        <td className="p-2 text-gray-500">{u.bloco || '—'}</td>
                        <td className="p-2 font-medium text-gray-800">{u.nome}</td>
                        <td className="p-2 font-mono text-gray-600">{u.cpf || '—'}</td>
                        <td className="p-2 text-gray-500">{u.tel || '—'}</td>
                        <td className="p-2 text-gray-500 truncate max-w-[120px]">{u.email || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé com botões */}
        <div className="p-4 bg-white border-t border-gray-200 flex items-center justify-between gap-3 shrink-0">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="btn-secondary text-xs"
          >
            Cancelar
          </button>
          <button
            onClick={handleImportar}
            disabled={isSubmitting || unidadesParsed.length === 0 || !condoNome}
            className={`btn-primary text-xs font-black bg-emerald-600 hover:bg-emerald-500 shadow-md flex items-center gap-2 ${
              isSubmitting || unidadesParsed.length === 0 || !condoNome
                ? 'opacity-50 cursor-not-allowed'
                : 'cursor-pointer'
            }`}
          >
            <CheckCircle2 size={16} />
            {isSubmitting
              ? 'Importando...'
              : `Confirmar e Cadastrar ${unidadesParsed.length} Unidades`}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Moradores() {
  const { items: moradores, addItem, updateItem, deleteItem } = useFirestore('moradores')
  const { items: allCondominios } = useFirestore('condominios')
  const { items: pets, addItem: addPet } = useFirestore('pets')
  const { user } = useAuth()
  const isMorador = user?.role === 'Morador'

  const [search, setSearch] = useState('')
  const [filtroCondominio, setFiltroCondominio] = useState('Todos')
  const [filtroApt, setFiltroApt] = useState('Todos')
  const [viewMode, setViewMode] = useState('agrupado')
  const [modal, setModal] = useState(null)
  const [modalPet, setModalPet] = useState(null)
  const [modalImport, setModalImport] = useState(false)
  const [modalShareLink, setModalShareLink] = useState(null)
  const [targetUnidade, setTargetUnidade] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [modalMsgWhatsLote, setModalMsgWhatsLote] = useState(false)
  const [textoMsgLote, setTextoMsgLote] = useState('')
  const [enviandoWhatsLote, setEnviandoWhatsLote] = useState(false)

  // Lista unificada de condomínios combinando o cadastro oficial de condomínios e eventuais nomes em moradores
  const condominiosUnicos = React.useMemo(() => {
    const setC = new Set()
    allCondominios.forEach(c => { if (c.nome) setC.add(c.nome) })
    moradores.forEach(m => { if (m.condominio) setC.add(m.condominio) })
    return ['Todos', ...Array.from(setC).sort()]
  }, [allCondominios, moradores])

  const aptsUnicos = ['Todos', ...Array.from(new Set(moradores.filter(m => filtroCondominio === 'Todos' || m.condominio === filtroCondominio).map(m => m.apt).filter(Boolean))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))]

  const filtered = moradores.filter(m => {
    if (isMorador) {
      const uApt = String(user?.unidade || user?.apt || '').replace(/\D/g, '')
      const mApt = String(m.apt || '').replace(/\D/g, '')
      const matchApt = uApt && mApt && uApt === mApt
      const matchCondo = !user?.condominio || m.condominio?.toLowerCase() === user?.condominio?.toLowerCase()
      return matchApt && matchCondo
    }
    const okSearch = m.nome?.toLowerCase().includes(search.toLowerCase()) || m.apt?.includes(search) || m.email?.includes(search)
    const okCondo = filtroCondominio === 'Todos' || m.condominio === filtroCondominio
    const okApt = filtroApt === 'Todos' || m.apt === filtroApt
    return okSearch && okCondo && okApt
  })

  const unidadesMap = {}
  filtered.forEach(m => {
    const condo = m.condominio || 'Sem Condomínio'
    const bloco = m.bloco ? `Bl. ${m.bloco}` : ''
    const apt = m.apt ? `Apt ${m.apt}` : 'Sem Unidade'
    const key = `${condo}__${bloco}__${apt}`

    if (!unidadesMap[key]) {
      unidadesMap[key] = {
        condominio: condo,
        bloco: m.bloco || '',
        apt: m.apt || '',
        moradores: [],
        pets: []
      }
    }
    unidadesMap[key].moradores.push(m)
  })

  pets.forEach(p => {
    const condo = p.condominio || 'Sem Condomínio'
    const bloco = p.bloco ? `Bl. ${p.bloco}` : ''
    const apt = p.apt ? `Apt ${p.apt}` : 'Sem Unidade'
    const key = `${condo}__${bloco}__${apt}`

    if (unidadesMap[key]) {
      unidadesMap[key].pets.push(p)
    }
  })

  Object.values(unidadesMap).forEach(u => {
    u.moradores.sort((a, b) => {
      if (a.status === 'Proprietário') return -1
      if (b.status === 'Proprietário') return 1
      if (a.status === 'Inquilino') return -1
      if (b.status === 'Inquilino') return 1
      return 0
    })
  })

  const unidadesLista = Object.values(unidadesMap).sort((a, b) => {
    if (a.condominio !== b.condominio) return a.condominio.localeCompare(b.condominio)
    return a.apt.localeCompare(b.apt, undefined, { numeric: true })
  })

  const handleSave = async form => {
    if (modal === 'new') await addItem(form)
    else await updateItem(modal.id, form)
    setModal(null)
    setTargetUnidade(null)
  }

  const handleSavePet = async form => {
    if (modalPet === 'new') await addPet(form)
    setModalPet(null)
  }

  // Gera o link de auto-cadastro com pré-preenchimento
  const gerarLinkCadastro = ({ condominio = '', apt = '', bloco = '', nome = '', tel = '' }) => {
    const origin = typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : 'https://alpha-solucoes-condominiais.vercel.app'
    
    const params = new URLSearchParams()
    if (condominio) params.set('condominio', condominio)
    if (apt) params.set('apt', apt)
    if (bloco) params.set('bloco', bloco)
    if (nome) params.set('nome', nome)
    if (tel) params.set('tel', tel)

    return `${origin}/cadastro?${params.toString()}`
  }

  // Importação em lote para o condomínio selecionado
  const handleImportLote = async (nomeCondo, listaUnidades) => {
    let cadastrados = 0
    let atualizados = 0

    for (const item of listaUnidades) {
      const aptKey = String(item.apt).trim().toLowerCase()
      const blocoKey = String(item.bloco || '').trim().toLowerCase()
      const condoKey = String(nomeCondo).trim().toLowerCase()

      // Verifica se já existe um morador cadastrado para este apt e bloco neste condomínio
      const existente = moradores.find(m => {
        const mApt = String(m.apt || '').trim().toLowerCase()
        const mBloco = String(m.bloco || '').trim().toLowerCase()
        const mCondo = String(m.condominio || '').trim().toLowerCase()
        return mApt === aptKey && mBloco === blocoKey && mCondo === condoKey
      })

      const dadosParaSalvar = {
        condominio: nomeCondo,
        apt: item.apt,
        bloco: item.bloco || '',
        nome: item.nome,
        tel: item.tel || '',
        email: item.email || '',
        cpf: item.cpf || '',
        status: item.status || 'Proprietário',
        cadastroCompleto: Boolean(existente?.cadastroCompleto),
        _updatedAt: new Date().toISOString()
      }

      if (existente) {
        await updateItem(existente.id, {
          ...existente,
          ...dadosParaSalvar,
          nome: item.nome || existente.nome,
          tel: item.tel || existente.tel
        })
        atualizados++
      } else {
        await addItem({
          ...dadosParaSalvar,
          _createdAt: new Date().toISOString()
        })
        cadastrados++
      }
    }

    setFiltroCondominio(nomeCondo)
    alert(`🎉 Importação Concluída com Sucesso!\n\n🏢 Condomínio: ${nomeCondo}\n✅ ${cadastrados} novas unidades cadastradas\n🔄 ${atualizados} unidades atualizadas.\n\nAgora você já pode copiar os links ou convidar os moradores pelo WhatsApp!`)
  }

  const handleDeleteMorador = async (m) => {
    if (!window.confirm(`Deseja realmente remover o morador "${m.nome}"?`)) return
    try {
      await deleteItem(m.id)
      // Sincroniza e remove usuário vinculado se houver, evitando resquícios
      if (m.email) {
        const qU = query(collection(db, 'usuarios'), where('email', '==', m.email.toLowerCase().trim()))
        const sU = await getDocs(qU)
        sU.forEach(async d => await deleteDoc(d.ref))
      }
    } catch (err) {
      console.warn('Aviso ao sincronizar exclusão com usuários:', err)
    }
  }

  const toggleSelectMorador = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const toggleSelectAll = () => {
    const todosFiltradosIds = filtered.map(m => m.id)
    const todosJaSelecionados = todosFiltradosIds.length > 0 && todosFiltradosIds.every(id => selectedIds.includes(id))
    if (todosJaSelecionados) {
      setSelectedIds(prev => prev.filter(id => !todosFiltradosIds.includes(id)))
    } else {
      setSelectedIds(Array.from(new Set([...selectedIds, ...todosFiltradosIds])))
    }
  }

  const handleDeleteLote = async () => {
    if (selectedIds.length === 0) return
    const total = selectedIds.length
    const condoNomeAviso = filtroCondominio !== 'Todos' ? ` do condomínio "${filtroCondominio}"` : ''
    if (!window.confirm(`⚠️ Atenção: Deseja realmente EXCLUIR os ${total} moradores selecionados${condoNomeAviso}? Esta ação não pode ser desfeita.`)) {
      return
    }

    try {
      const moradoresParaExcluir = moradores.filter(m => selectedIds.includes(m.id))
      for (const m of moradoresParaExcluir) {
        await deleteItem(m.id)
        if (m.email) {
          try {
            const qU = query(collection(db, 'usuarios'), where('email', '==', m.email.toLowerCase().trim()))
            const sU = await getDocs(qU)
            sU.forEach(async d => await deleteDoc(d.ref))
          } catch(e) {}
        }
      }
      setSelectedIds([])
      alert(`✅ ${total} morador(es) foram excluídos com sucesso.`)
    } catch (err) {
      console.error('Erro na exclusão em lote:', err)
      alert('Erro ao excluir alguns moradores. Tente novamente.')
    }
  }

  const handleEnviarWhatsLote = async () => {
    if (!textoMsgLote?.trim()) {
      alert('Por favor, digite o texto da mensagem a ser enviada.')
      return
    }
    const selecionadosDocs = moradores.filter(m => selectedIds.includes(m.id))
    const comTelefone = selecionadosDocs.filter(m => {
      const num = String(m.tel || m.telefone || '').replace(/\D/g, '')
      return num.length >= 8
    })

    if (comTelefone.length === 0) {
      alert('Nenhum dos moradores selecionados possui telefone válido cadastrado.')
      return
    }

    setEnviandoWhatsLote(true)
    let enviados = 0

    for (const m of comTelefone) {
      const rawTel = String(m.tel || m.telefone || '').replace(/\D/g, '')
      const foneWhats = rawTel.length <= 11 ? `55${rawTel}` : rawTel
      
      const msgPersonalizada = textoMsgLote
        .replace(/\{nome\}/gi, m.nome || '')
        .replace(/\{apartamento\}/gi, m.apt || '')
        .replace(/\{condominio\}/gi, m.condominio || '')

      try {
        await fetch('/api/whatsapp-send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            number: foneWhats,
            text: msgPersonalizada,
            instance: 'InstanciaAlpha'
          })
        })
        enviados++
      } catch (err) {
        console.warn(`Falha no envio WhatsApp para ${m.nome}:`, err)
      }
    }

    setEnviandoWhatsLote(false)
    setModalMsgWhatsLote(false)
    setTextoMsgLote('')
    alert(`🎉 Disparo via WhatsApp concluído!\n\n✅ ${enviados} de ${comTelefone.length} moradores com telefone receberam a mensagem com sucesso.`)
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="section-title text-xl">{isMorador ? 'Minha Unidade & Família' : 'Gestão de Moradores por Unidade'}</h2>
          <p className="section-sub">
            {isMorador
              ? `Unidade Apt ${user?.unidade || user?.apt || '—'} • ${user?.condominio || 'Condomínio'}`
              : `${moradores.length} moradores cadastrados em ${unidadesLista.length} apartamentos`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!isMorador && (
            <div className="flex bg-slate-100 p-1 rounded-xl border border-gray-200">
              <button
                onClick={() => setViewMode('agrupado')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${viewMode === 'agrupado' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
              >
                <LayoutGrid size={14} /> Por Apartamento
              </button>
              <button
                onClick={() => setViewMode('tabela')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${viewMode === 'tabela' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
              >
                <TableIcon size={14} /> Tabela Geral
              </button>
            </div>
          )}
          {!isMorador && (
            <>
              <button
                onClick={() => setModalImport(true)}
                className="btn-secondary text-xs font-black flex items-center gap-1.5 bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100 shadow-sm"
                title="Importar lista de apartamentos e moradores via arquivo ou planilha"
              >
                <FileSpreadsheet size={15} className="text-emerald-700" /> Importar Lista (.CSV)
              </button>

              <button
                onClick={() => {
                  const cNome = filtroCondominio !== 'Todos' ? filtroCondominio : (allCondominios[0]?.nome || '')
                  const link = gerarLinkCadastro({ condominio: cNome })
                  setModalShareLink({
                    link,
                    titulo: `Link de Auto-Cadastro ${cNome ? `• ${cNome}` : ''}`,
                    descricao: 'Envie para os moradores entrarem e completarem o cadastro na unidade deles'
                  })
                }}
                className="btn-secondary text-xs font-bold flex items-center gap-1.5 bg-white text-gray-700 border-gray-300 hover:bg-slate-50 shadow-sm"
                title="Copiar link geral de cadastro para enviar aos moradores"
              >
                <Share2 size={14} className="text-brand-600" /> Link Geral de Cadastro
              </button>
            </>
          )}

          <button
            onClick={() => {
              setTargetUnidade(null)
              setModal('new')
            }}
            className="btn-primary text-xs font-black flex items-center gap-1.5 shadow-sm"
          >
            <Plus size={16} /> {isMorador ? 'Adicionar Familiar' : 'Novo Morador'}
          </button>
          {isMorador && (
            <button
              onClick={() => setModalPet('new')}
              className="btn-secondary text-xs font-bold flex items-center gap-1.5 bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 shadow-sm"
            >
              <PawPrint size={15} className="text-amber-600" /> Cadastrar Pet
            </button>
          )}
        </div>
      </div>

      {/* Filtros para o Administrador */}
      {!isMorador && (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input className="input pl-9 text-xs" placeholder="Buscar por nome, apartamento, e-mail..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="relative sm:w-64">
              <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select className="input pl-9 text-xs font-bold" value={filtroCondominio} onChange={e => { setFiltroCondominio(e.target.value); setFiltroApt('Todos') }}>
                {condominiosUnicos.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="relative sm:w-48">
              <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select className="input pl-9 text-xs font-bold" value={filtroApt} onChange={e => setFiltroApt(e.target.value)}>
                {aptsUnicos.map(a => <option key={a} value={a}>{a === 'Todos' ? 'Todos os Aptos' : `Apt ${a}`}</option>)}
              </select>
            </div>
          </div>

          {/* Atalhos rápidos de condomínio */}
          {filtroCondominio === 'Todos' && condominiosUnicos.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
              {condominiosUnicos.filter(c => c !== 'Todos').map(c => (
                <button
                  key={c}
                  onClick={() => setFiltroCondominio(c)}
                  className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-700 hover:border-brand-500 hover:text-brand-700 whitespace-nowrap transition-all shrink-0 shadow-sm"
                >
                  🏢 {c} <span className="ml-1 text-brand-600 font-bold">({moradores.filter(m => m.condominio === c).length} pessoas)</span>
                </button>
              ))}
            </div>
          )}

          {/* Barra de Ações em Lote para o Condomínio Selecionado */}
          <div className="bg-white p-3 sm:p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleSelectAll}
                className="btn-secondary text-xs font-bold flex items-center gap-2 py-1.5 px-3 bg-slate-50 hover:bg-slate-100 border-gray-300 shadow-xs cursor-pointer"
                title="Selecionar ou desmarcar todos os moradores listados"
              >
                {filtered.length > 0 && filtered.every(m => selectedIds.includes(m.id)) ? (
                  <>
                    <CheckSquare size={16} className="text-brand-600" />
                    <span>Desmarcar Todos ({filtered.length})</span>
                  </>
                ) : (
                  <>
                    <Square size={16} className="text-gray-400" />
                    <span>Selecionar Todos {filtroCondominio !== 'Todos' ? `de "${filtroCondominio}"` : ''} ({filtered.length})</span>
                  </>
                )}
              </button>
              {selectedIds.length > 0 && (
                <span className="text-xs font-bold text-brand-800 bg-brand-50 border border-brand-200 px-2.5 py-1 rounded-lg">
                  {selectedIds.length} selecionado(s)
                </span>
              )}
            </div>

            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => {
                    const condoNome = filtroCondominio !== 'Todos' ? filtroCondominio : 'do Condomínio'
                    setTextoMsgLote(`Olá {nome}! Comunicado importante da administração do ${condoNome}.\n\n`)
                    setModalMsgWhatsLote(true)
                  }}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  title="Enviar mensagem no WhatsApp para os moradores selecionados"
                >
                  <MessageSquare size={14} />
                  <span>Enviar WhatsApp ({selectedIds.length})</span>
                </button>

                <button
                  onClick={handleDeleteLote}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  title="Excluir moradores selecionados"
                >
                  <Trash2 size={14} />
                  <span>Excluir Selecionados ({selectedIds.length})</span>
                </button>

                <button
                  onClick={() => setSelectedIds([])}
                  className="px-2.5 py-1.5 text-gray-500 hover:text-gray-800 text-xs font-bold bg-white border border-gray-300 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── VISUALIZAÇÃO AGRUPADA POR APARTAMENTO (PADRÃO ADM E MORADOR) ── */}
      {viewMode === 'agrupado' || isMorador ? (
        <div className="flex flex-col gap-4">
          {unidadesLista.length === 0 ? (
            <div className="card text-center py-12 text-gray-400 text-sm">
              <Home size={32} className="mx-auto mb-2 opacity-40" />
              Nenhum morador ou apartamento encontrado com os filtros selecionados.
            </div>
          ) : (
            unidadesLista.map(u => {
              const titulares = u.moradores.filter(m => m.status === 'Proprietário' || m.status === 'Inquilino')
              const dependentes = u.moradores.filter(m => m.status === 'Dependente')

              return (
                <div key={`${u.condominio}_${u.bloco}_${u.apt}`} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden transition-all hover:border-brand-300">
                  {/* Cabeçalho da Unidade */}
                  <div className="p-4 bg-slate-50 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-brand-700 text-white flex items-center justify-center font-black text-sm shadow-sm">
                        {u.apt ? u.apt.slice(0, 4) : '🏠'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-black text-slate-900 text-base">
                            Apt {u.apt} {u.bloco ? `• Bloco ${u.bloco}` : ''}
                          </h3>
                          <span className="text-xs font-bold text-gray-500 bg-white border border-gray-300 px-2 py-0.5 rounded-md">
                            🏢 {u.condominio}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          <b>{u.moradores.length}</b> morador(es) ({titulares.length} responsável, {dependentes.length} dependente) • <b>{u.pets.length}</b> pet(s)
                        </p>
                      </div>
                    </div>

                    {!isMorador && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => {
                            const titular = titulares[0] || u.moradores[0]
                            const link = gerarLinkCadastro({
                              condominio: u.condominio,
                              apt: u.apt,
                              bloco: u.bloco,
                              nome: titular?.nome || '',
                              tel: titular?.tel || ''
                            })
                            setModalShareLink({
                              link,
                              titulo: `Link do Apt ${u.apt} ${u.bloco ? `• Bloco ${u.bloco}` : ''}`,
                              descricao: `Condomínio ${u.condominio} • Envie para o morador acessar e completar os dados`
                            })
                          }}
                          className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-gray-700 border border-gray-300 rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm shrink-0"
                          title="Copiar link exclusivo deste apartamento"
                        >
                          <Share2 size={13} className="text-brand-600" /> Link deste Apt
                        </button>

                        <button
                          onClick={() => {
                            setTargetUnidade(u)
                            setModal('new')
                          }}
                          className="px-3 py-1.5 bg-white hover:bg-brand-50 text-brand-700 border border-brand-200 rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm shrink-0"
                        >
                          <Plus size={14} /> Adicionar Membro
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Corpo: Membros da Família */}
                  <div className="p-4 divide-y divide-gray-100">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pb-3">
                      {u.moradores.map(m => {
                        const linkIndividual = gerarLinkCadastro({
                          condominio: u.condominio,
                          apt: u.apt,
                          bloco: u.bloco,
                          nome: m.nome,
                          tel: m.tel
                        })

                        const rawTel = String(m.tel || '').replace(/\D/g, '')
                        const temWhats = rawTel.length >= 8

                        const handleWhatsConvite = () => {
                          const msg = `*Alpha Soluções Condominiais*\n\nOlá *${m.nome}*!\n\nVocê foi pré-cadastrado no condomínio *${u.condominio}*, na unidade *Apt ${u.apt}*.\n\nPara concluir seu cadastro e ter acesso imediato à sua área do morador, boletos e solicitações, clique no link seguro abaixo:\n\n${linkIndividual}`
                          const foneWhats = rawTel.length <= 11 ? `55${rawTel}` : rawTel
                          window.open(`https://wa.me/${foneWhats}?text=${encodeURIComponent(msg)}`, '_blank')
                        }

                        const isSelected = selectedIds.includes(m.id)

                        return (
                          <div key={m.id} className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${isSelected ? 'bg-brand-50/50 border-brand-300' : 'bg-slate-50/60 hover:bg-slate-50 border-gray-200'}`}>
                            <div className="flex items-center gap-3 min-w-0">
                              {!isMorador && (
                                <button
                                  onClick={() => toggleSelectMorador(m.id)}
                                  className="text-gray-400 hover:text-brand-600 transition-colors cursor-pointer shrink-0"
                                  title={isSelected ? "Desmarcar morador" : "Selecionar morador"}
                                >
                                  {isSelected ? <CheckSquare size={17} className="text-brand-600" /> : <Square size={17} className="text-gray-400" />}
                                </button>
                              )}
                              {m.fotoRosto ? (
                                <img
                                  src={m.fotoRosto}
                                  alt={m.nome}
                                  className="w-10 h-10 rounded-full object-cover shadow-sm border border-brand-300 shrink-0 cursor-pointer"
                                  onClick={() => window.open(m.fotoRosto, '_blank')}
                                  title="Ver foto facial"
                                />
                              ) : (
                                <div className="w-10 h-10 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center text-sm font-black shrink-0">
                                  {m.nome?.[0] || '?'}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="font-bold text-gray-900 text-xs truncate">{m.nome}</p>
                                </div>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${m.status === 'Proprietário' ? 'bg-blue-100 text-blue-800' : m.status === 'Inquilino' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'}`}>
                                    {m.status}
                                  </span>
                                  {m.cpf ? (
                                    <span className="text-[10px] text-gray-400 font-mono">CPF: {m.cpf}</span>
                                  ) : (
                                    <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1 rounded">Pré-cadastro</span>
                                  )}
                                </div>
                                {m.tel && <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-1"><Phone size={10} /> {m.tel}</p>}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {!isMorador && temWhats && (
                                <button
                                  onClick={handleWhatsConvite}
                                  className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-sm"
                                  title="Enviar convite e link de cadastro pelo WhatsApp"
                                >
                                  <MessageSquare size={13} />
                                </button>
                              )}
                              {!isMorador && (
                                <button
                                  onClick={() => {
                                    setModalShareLink({
                                      link: linkIndividual,
                                      titulo: `Link de ${m.nome}`,
                                      descricao: `Apt ${u.apt} • Condomínio ${u.condominio}`
                                    })
                                  }}
                                  className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-gray-500 hover:text-brand-700 border border-gray-200 shadow-sm"
                                  title="Copiar link pré-configurado deste morador"
                                >
                                  <Share2 size={12} />
                                </button>
                              )}
                              <button onClick={() => setModal(m)} className="p-1.5 rounded-lg bg-white hover:bg-brand-100 text-gray-400 hover:text-brand-700 border border-gray-200 shadow-sm" title="Editar"><Edit2 size={12} /></button>
                              {(!isMorador || m.status !== 'Proprietário') && (
                                <button onClick={() => handleDeleteMorador(m)} className="p-1.5 rounded-lg bg-white hover:bg-red-100 text-gray-400 hover:text-red-500 border border-gray-200 shadow-sm" title="Remover"><Trash2 size={12} /></button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Pets do Apartamento */}
                    {u.pets.length > 0 && (
                      <div className="pt-3 flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-amber-900 flex items-center gap-1 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                          <PawPrint size={14} className="text-amber-600" /> Pets da Unidade ({u.pets.length}):
                        </span>
                        {u.pets.map(p => (
                          <span key={p.id} className="text-xs bg-slate-100 text-slate-800 font-bold pl-2.5 pr-1.5 py-1 rounded-lg border border-slate-200 flex items-center gap-2">
                            <span>🐾 <b>{p.nome}</b> ({p.tipo || 'Pet'} • {p.raca || p.porte || 'Médio'})</span>
                            <button
                              onClick={() => {
                                if (window.confirm(`Deseja realmente excluir o pet "${p.nome}"?`)) {
                                  deletePet(p.id)
                                }
                              }}
                              className="p-1 hover:bg-red-100 text-gray-400 hover:text-red-600 rounded-md transition-colors"
                              title={`Excluir pet ${p.nome}`}
                            >
                              <Trash2 size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      ) : (
        /* ── VISUALIZAÇÃO EM TABELA CLÁSSICA (ADM) ── */
        <div className="card p-0 overflow-hidden">
          <div className="p-3 border-b border-cream-200 bg-cream-50 flex items-center justify-between">
            <p className="text-xs text-gray-500">{filtered.length} morador(es) {filtroCondominio !== 'Todos' ? `em "${filtroCondominio}"` : ''}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-cream-100 border-b border-cream-400">
                <tr>
                  <th className="table-head w-10 text-center">
                    <button
                      onClick={toggleSelectAll}
                      className="text-gray-500 hover:text-brand-600 cursor-pointer"
                      title="Selecionar / Desmarcar todos"
                    >
                      {filtered.length > 0 && filtered.every(m => selectedIds.includes(m.id)) ? (
                        <CheckSquare size={16} className="text-brand-600" />
                      ) : (
                        <Square size={16} className="text-gray-400" />
                      )}
                    </button>
                  </th>
                  {['Morador', 'Condomínio', 'Unidade', 'Contato', 'Status', 'Ações'].map(h => <th key={h} className="table-head">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200">
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-400 text-sm">Nenhum morador encontrado.</td></tr>
                ) : (
                  filtered.map(m => {
                    const isSelected = selectedIds.includes(m.id)
                    return (
                    <tr key={m.id} className={`transition-colors ${isSelected ? 'bg-brand-50/60' : 'hover:bg-cream-50'}`}>
                      <td className="table-cell text-center w-10">
                        <button
                          onClick={() => toggleSelectMorador(m.id)}
                          className="text-gray-400 hover:text-brand-600 cursor-pointer"
                          title={isSelected ? "Desmarcar" : "Selecionar"}
                        >
                          {isSelected ? <CheckSquare size={16} className="text-brand-600" /> : <Square size={16} className="text-gray-400" />}
                        </button>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          {m.fotoRosto ? (
                            <img src={m.fotoRosto} alt="Foto" className="w-8 h-8 rounded-full object-cover shadow-sm border border-brand-200" onClick={() => window.open(m.fotoRosto, '_blank')} title="Ver foto" style={{ cursor: 'pointer' }} />
                          ) : (
                            <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 text-xs font-bold">{m.nome?.[0] || '?'}</div>
                          )}
                          <div>
                            <p className="font-semibold text-gray-800 text-sm">{m.nome}</p>
                            <p className="text-xs text-gray-500 font-mono">{m.cpf}</p>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell"><p className="text-xs font-medium text-gray-700">{m.condominio || '—'}</p></td>
                      <td className="table-cell"><p className="font-bold text-gray-800">Apt {m.apt} {m.bloco ? `– Bl. ${m.bloco}` : ''}</p></td>
                      <td className="table-cell">
                        <p className="flex items-center gap-1 text-xs"><Phone size={10} className="text-gray-500" />{m.tel || '—'}</p>
                        <p className="flex items-center gap-1 text-xs text-gray-400"><Mail size={10} className="text-gray-500" />{m.email || '—'}</p>
                      </td>
                      <td className="table-cell"><span className={m.status === 'Proprietário' ? 'badge-blue' : m.status === 'Inquilino' ? 'badge-green' : 'badge-purple'}>{m.status}</span></td>
                      <td className="table-cell">
                        <div className="flex gap-2">
                          <button onClick={() => setModal(m)} className="p-1.5 rounded-lg bg-cream-200 hover:bg-brand-100 text-gray-400 hover:text-brand-700 transition-all"><Edit2 size={12} /></button>
                          <button onClick={() => handleDeleteMorador(m)} className="p-1.5 rounded-lg bg-cream-200 hover:bg-red-100 text-gray-400 hover:text-red-500 transition-all" title="Remover"><Trash2 size={12} /></button>
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
      )}

      {modal && (
        <MoradorModal
          data={modal === 'new' ? null : modal}
          onClose={() => { setModal(null); setTargetUnidade(null) }}
          onSave={handleSave}
          isMorador={isMorador}
          currentUser={user}
          initialApt={targetUnidade?.apt}
          initialBloco={targetUnidade?.bloco}
          initialCondo={targetUnidade?.condominio}
        />
      )}

      {modalPet && (
        <PetModalRapido
          data={null}
          onClose={() => setModalPet(null)}
          onSave={handleSavePet}
          currentUser={user}
        />
      )}

      {modalImport && (
        <ModalImportarUnidades
          condominios={allCondominios}
          onImport={handleImportLote}
          onClose={() => setModalImport(false)}
        />
      )}

      {modalShareLink && (
        <ModalCompartilharLink
          link={modalShareLink.link}
          titulo={modalShareLink.titulo}
          descricao={modalShareLink.descricao}
          onClose={() => setModalShareLink(null)}
        />
      )}

      {/* Modal para Envio de Mensagem WhatsApp em Lote */}
      {modalMsgWhatsLote && (
        <div className="modal-overlay" onClick={() => !enviandoWhatsLote && setModalMsgWhatsLote(false)}>
          <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="p-4 sm:p-6 border-b border-gray-200 flex items-center justify-between gap-3 bg-emerald-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <MessageSquare size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                    Enviar WhatsApp em Lote
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    Disparo para {selectedIds.length} morador(es) selecionado(s) {filtroCondominio !== 'Todos' ? `de ${filtroCondominio}` : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => !enviandoWhatsLote && setModalMsgWhatsLote(false)}
                className="text-gray-400 hover:text-gray-700 p-1"
                disabled={enviandoWhatsLote}
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 space-y-1">
                <p className="font-bold">💡 Dica de Personalização Automática:</p>
                <p>Você pode usar as tags no seu texto: <b>{'{nome}'}</b> (nome do morador), <b>{'{apartamento}'}</b> (número do apto) e <b>{'{condominio}'}</b> (nome do condomínio).</p>
              </div>

              <div>
                <label className="label text-xs font-bold text-gray-700">Mensagem do WhatsApp *</label>
                <textarea
                  className="input min-h-[140px] resize-none text-xs"
                  placeholder="Escreva a mensagem aqui..."
                  value={textoMsgLote}
                  onChange={e => setTextoMsgLote(e.target.value)}
                  disabled={enviandoWhatsLote}
                />
              </div>

              <div className="text-[11px] text-gray-500 flex items-center justify-between">
                <span>Total de moradores na fila: <b>{selectedIds.length}</b></span>
                <span>Com telefone cadastrado: <b>{moradores.filter(m => selectedIds.includes(m.id) && String(m.tel || m.telefone || '').replace(/\D/g, '').length >= 8).length}</b></span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-gray-200 flex items-center justify-end gap-2">
              <button
                onClick={() => setModalMsgWhatsLote(false)}
                disabled={enviandoWhatsLote}
                className="btn-secondary text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={handleEnviarWhatsLote}
                disabled={enviandoWhatsLote || !textoMsgLote?.trim()}
                className="btn-primary text-xs font-black bg-emerald-600 hover:bg-emerald-500 flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {enviandoWhatsLote ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Disparando mensagens...</span>
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    <span>Confirmar e Disparar WhatsApp</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

