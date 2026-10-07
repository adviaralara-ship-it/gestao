import React, { useState } from 'react'
import { Users, Plus, Search, Edit2, Trash2, Phone, Mail, Filter, PawPrint, Home, UserCheck, LayoutGrid, Table as TableIcon, X, Upload, FileSpreadsheet, Share2, Copy, Check, MessageSquare, CheckCircle2, AlertCircle, CheckSquare, Square, Send, Loader2 } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'
import { collection, query, where, getDocs, deleteDoc, doc, updateDoc, setDoc, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

function MoradorModal({ data, onClose, onSave, isMorador, currentUser, initialApt, initialBloco, initialCondo, condominiosList = [] }) {
  const [form, setForm] = useState(() => (data ? { ...data } : {
    nome: '',
    cpf: '',
    apt: initialApt || (isMorador ? (currentUser?.unidade || currentUser?.apt) : ''),
    bloco: initialBloco || (isMorador ? currentUser?.bloco : ''),
    tel: '',
    email: '',
    status: isMorador ? 'Dependente' : 'Proprietário',
    condominio: initialCondo || (isMorador ? currentUser?.condominio : (condominiosList[0]?.nome || '')),
    fotoRosto: ''
  }))

  React.useEffect(() => {
    if (data) {
      setForm({
        ...data,
        nome: data.nome || '',
        cpf: data.cpf || '',
        apt: data.apt || data.unidade || '',
        bloco: data.bloco || '',
        tel: data.tel || data.telefone || '',
        email: data.email || '',
        status: data.status || data.statusMorador || (isMorador ? 'Dependente' : 'Proprietário'),
        condominio: data.condominio || initialCondo || '',
        fotoRosto: data.fotoRosto || data.foto || ''
      })
    } else {
      setForm({
        nome: '',
        cpf: '',
        apt: initialApt || (isMorador ? (currentUser?.unidade || currentUser?.apt) : ''),
        bloco: initialBloco || (isMorador ? currentUser?.bloco : ''),
        tel: '',
        email: '',
        status: isMorador ? 'Dependente' : 'Proprietário',
        condominio: initialCondo || (isMorador ? currentUser?.condominio : (condominiosList[0]?.nome || '')),
        fotoRosto: ''
      })
    }
  }, [data, initialApt, initialBloco, initialCondo])

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
    <div className="modal-overlay z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white max-w-lg w-full rounded-3xl shadow-2xl border border-gray-200 flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-4 sm:p-5 border-b border-cream-300 flex items-center justify-between gap-3 bg-gradient-to-r from-cream-100 to-white shrink-0">
          <h3 className="font-bold text-gray-900 text-base sm:text-lg min-w-0 flex-1 truncate">{data ? 'Editar Membro da Família' : 'Novo Morador / Familiar'}</h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors cursor-pointer" title="Fechar"><X size={20} strokeWidth={2.5} /></button>
        </div>
        <div className="p-5 sm:p-6 grid grid-cols-2 gap-4 overflow-y-auto flex-1">
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
            <label className="label">Condomínio *</label>
            <input
              list="lista-condos-morador"
              className="input uppercase font-bold"
              value={form.condominio}
              onChange={e => set('condominio', e.target.value.toUpperCase())}
              disabled={isMorador}
              placeholder="SELECIONE OU DIGITE O CONDOMÍNIO"
            />
            <datalist id="lista-condos-morador">
              {condominiosList.map(c => (
                <option key={c.id || c.nome} value={c.nome} />
              ))}
            </datalist>
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

        {/* Rodapé fixo - Sempre visível */}
        <div className="p-4 sm:p-5 border-t border-gray-200 flex gap-3 justify-end bg-gray-50 shrink-0">
          <button onClick={onClose} className="btn-secondary px-5 py-2 text-xs font-bold">Cancelar</button>
          <button onClick={() => onSave(form)} className="btn-primary bg-brand-600 hover:bg-brand-500 text-white font-black text-xs py-2.5 px-6 rounded-xl shadow-md cursor-pointer">
            💾 Salvar Morador
          </button>
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

    // Procura a linha de cabeçalho nas primeiras 5 linhas
    let headerIdx = -1
    let bestSep = '\t'
    let colApt = -1, colNome = -1, colTel = -1, colDdd = -1, colBloco = -1, colEmail = -1, colCpf = -1, colInquilino = -1

    for (let i = 0; i < Math.min(lines.length, 5); i++) {
      const lineLower = lines[i].toLowerCase()
      if (lineLower.includes('unidade') || lineLower.includes('apt') || lineLower.includes('apartamento') || lineLower.includes('morador') || lineLower.includes('moradores')) {
        headerIdx = i
        // Detecta melhor separador nesta linha de cabeçalho
        const seps = ['\t', ';', ',']
        let maxS = 0
        for (const s of seps) {
          const count = lines[i].split(s).length
          if (count > maxS) {
            maxS = count
            bestSep = s
          }
        }
        break
      }
    }

    let startIdx = 0
    if (headerIdx !== -1) {
      startIdx = headerIdx + 1
      const headers = lines[headerIdx].split(bestSep).map(h => h.trim().toLowerCase().replace(/["']/g, ''))
      headers.forEach((h, idx) => {
        if (h.includes('unidade') || h.includes('apt') || h.includes('apartamento') || h.includes('numero') || h.includes('num')) {
          if (colApt === -1) colApt = idx
        } else if (h.includes('morador') || h.includes('moradores') || h.includes('responsavel') || h.includes('proprietario') || h.includes('nome')) {
          if (colNome === -1) colNome = idx
        } else if (h === 'ddd' || h.includes('ddd')) {
          colDdd = idx
        } else if (h.includes('tel') || h.includes('telefone') || h.includes('whats') || h.includes('cel') || h.includes('fone')) {
          if (colTel === -1) colTel = idx
        } else if (h.includes('bloco') || h.includes('torre') || h.includes('quadra')) {
          if (colBloco === -1) colBloco = idx
        } else if (h.includes('email') || h.includes('e-mail')) {
          if (colEmail === -1) colEmail = idx
        } else if (h.includes('cpf') || h.includes('cnpj') || h.includes('doc')) {
          if (colCpf === -1) colCpf = idx
        } else if (h.includes('inquilino')) {
          colInquilino = idx
        }
      })
    } else {
      // Se não achou linha com cabeçalho explícito, detecta separador na primeira linha
      const seps = ['\t', ';', ',']
      let maxS = 0
      for (const s of seps) {
        const count = lines[0].split(s).length
        if (count > maxS) {
          maxS = count
          bestSep = s
        }
      }
    }

    const parsed = []

    for (let i = startIdx; i < lines.length; i++) {
      let line = lines[i]
      if (!line) continue

      let apt = ''
      let nome = ''
      let tel = ''
      let ddd = ''
      let bloco = ''
      let email = ''
      let cpf = ''
      let statusMorador = 'Proprietário'

      // ── PADRÃO 1: Linha textual rotulada (Ex: "Unidade: 101 Morador: Fulano") ──
      const cleanLine = line.replace(/^\s*\d+[\s.)-]+\s*/i, '').trim()

      if (/unidade|apartamento|morador|responsavel|bloco/i.test(cleanLine) && cleanLine.includes(':')) {
        const mBloco = cleanLine.match(/(?:bloco|bl\.?|torre|quadra)\s*[:=-]?\s*([a-zA-Z0-9]+)/i)
        if (mBloco) bloco = mBloco[1]

        const mApt = cleanLine.match(/(?:unidade|apartamento|apto?\.?|apt\.?)\s*[:=-]?\s*([a-zA-Z0-9-]+)/i)
        if (mApt) apt = mApt[1]

        const mCpf = cleanLine.match(/(?:cpf|doc(?:umento)?)\s*[:=-]?\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{11})/i) 
          || cleanLine.match(/\b(\d{3}\.\d{3}\.\d{3}-\d{2})\b/)
        if (mCpf) cpf = mCpf[1].replace(/\D/g, '')

        const mEmail = cleanLine.match(/(?:email|e-mail)\s*[:=-]?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i)
          || cleanLine.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/)
        if (mEmail) email = mEmail[1].trim().toLowerCase()

        const mTel = cleanLine.match(/(?:tel|telefone|cel|celular|whats|whatsapp|fone)\s*[:=-]?\s*([\d()\s+-]{8,20})/i)
          || cleanLine.match(/(?:\(?\d{2}\)?\s*(?:9\s*)?\d{4}[-\s]?\d{4})/)
        if (mTel) tel = mTel[1].trim()

        const mNome = cleanLine.match(/(?:morador(?:\(a\))?|nome|respons[aá]vel|propriet[aá]rio)\s*(?:\(a\))?\s*[:=-]?\s*([^,\n;]+)/i)
        if (mNome) {
          nome = mNome[1]
            .replace(/(?:telefone|tel|cel|whats|whatsapp|fone|cpf|email|e-mail|bloco|torre|quadra)\s*[:=-]?.*$/i, '')
            .trim()
        }
      }

      // ── PADRÃO 2: Colunas delimitadas por Tabulação (\t), Ponto e Vírgula (;) ou Vírgula (,) ──
      if (!apt && !nome) {
        const parts = line.split(bestSep).map(p => p.trim().replace(/^["']|["']$/g, ''))
        if (parts.length === 0 || (parts.length === 1 && !parts[0])) continue

        // Se encontrou cabeçalho
        if (colApt !== -1 || colNome !== -1) {
          if (colApt !== -1 && parts[colApt]) apt = parts[colApt]
          if (colNome !== -1 && parts[colNome]) nome = parts[colNome]
          if (colTel !== -1 && parts[colTel]) tel = parts[colTel]
          if (colDdd !== -1 && parts[colDdd]) ddd = parts[colDdd]
          if (colBloco !== -1 && parts[colBloco]) bloco = parts[colBloco]
          if (colEmail !== -1 && parts[colEmail]) email = parts[colEmail]
          if (colCpf !== -1 && parts[colCpf]) cpf = parts[colCpf]
          if (colInquilino !== -1 && parts[colInquilino]) {
            const inqVal = parts[colInquilino].toLowerCase()
            if (inqVal.includes('sim') || inqVal.includes('inquilino') || inqVal === 'x') {
              statusMorador = 'Inquilino'
            }
          }
        }

        // Complemento Semântico inteligente: se faltou algum campo (como CPF, Email, Tel ou DDD),
        // varre os tokens não-vazios da linha para encontrar os dados pelo padrão de formato
        const nonBlank = parts.filter(Boolean)
        for (const tok of nonBlank) {
          const t = tok.trim()
          if (!t) continue

          // E-mail
          if (t.includes('@') && !email) {
            email = t.replace(/;+$/, '').toLowerCase()
            continue
          }

          // CPF / CNPJ formatado ou 11 dígitos com pontuação
          if ((/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(t) || /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(t) || (/^\d{11}$/.test(t) && !t.startsWith('9') && !tel)) && !cpf) {
            cpf = t.replace(/\D/g, '')
            continue
          }

          // DDI (55)
          if (t === '55') continue

          // DDD (ex: 83, 21, 11)
          if (/^\d{2}$/.test(t) && !ddd) {
            ddd = t
            continue
          }

          // Telefone (8 a 11 dígitos)
          if (/^\d{8,11}$/.test(t.replace(/\D/g, '')) && !tel && t !== cpf) {
            tel = t
            continue
          }

          // Se ainda não temos apt, tenta detectar se é número da unidade
          if (!apt && (/^\d{1,5}[a-zA-Z]?$/.test(t) || /^(apt|ap|unid|unidade)\s*\d+/i.test(t))) {
            apt = t.replace(/^(apt|ap|unid|unidade)\s*/i, '')
            continue
          }

          // Se ainda não temos nome
          if (!nome && /[a-zA-Z]{3,}/.test(t) && !t.includes('@') && !/^(apt|unidade|bloco)/i.test(t)) {
            nome = t.replace(/;+$/, '').trim().toUpperCase()
            continue
          }
        }
      }

      // Limpeza de campos
      apt = String(apt || '')
        .replace(/^(unidade|apartamento|apt|ap)\s*[:=-]?\s*/i, '')
        .replace(/;+$/, '')
        .trim()

      nome = String(nome || '')
        .replace(/^(morador(?:\(a\))?|nome)\s*(?:\(a\))?\s*[:=-]?\s*/i, '')
        .replace(/^[0-9]+[\s.)-]+\s*/, '')
        .replace(/;+$/, '')
        .trim()
        .toUpperCase()

      // Se tiver DDD separado e telefone, unifica
      let telFinal = tel ? String(tel).replace(/;+$/, '').trim() : ''
      if (ddd && telFinal && !telFinal.startsWith(ddd) && telFinal.replace(/\D/g, '').length <= 9) {
        telFinal = `(${ddd.replace(/\D/g, '')}) ${telFinal}`
      }

      bloco = String(bloco || '').replace(/^(bloco|bl\.?|torre)\s*[:=-]?\s*/i, '').replace(/;+$/, '').trim().toUpperCase()
      email = String(email || '').replace(/;+$/, '').trim().toLowerCase()
      cpf = String(cpf || '').replace(/\D/g, '')

      // Apenas adiciona se for uma unidade válida (número ou código de apto)
      if (apt && apt.toLowerCase() !== 'unidade' && apt.toLowerCase() !== 'apt') {
        parsed.push({
          apt,
          bloco,
          nome: nome || `MORADOR APT ${apt}`,
          tel: telFinal,
          email,
          cpf,
          status: statusMorador,
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
  const { items: moradoresRaw, addItem, updateItem, deleteItem } = useFirestore('moradores')
  const { items: usuarios = [] } = useFirestore('usuarios')
  const { items: allCondominios } = useFirestore('condominios')
  const { items: pets, addItem: addPet } = useFirestore('pets')
  const { user } = useAuth()
  const isMorador = user?.role === 'Morador'

  // Sincroniza e mescla automaticamente moradores com contas criadas em usuários (perfil Morador/Síndico/etc.)
  const moradores = React.useMemo(() => {
    const lista = [...moradoresRaw]
    const emailsExistentes = new Set(lista.map(m => (m.email || '').toLowerCase().trim()).filter(Boolean))
    const telefonesExistentes = new Set(lista.map(m => String(m.tel || '').replace(/\D/g, '')).filter(Boolean))

    usuarios.forEach(u => {
      const uEmail = (u.email || '').toLowerCase().trim()
      const uTel = String(u.telefone || u.tel || '').replace(/\D/g, '')
      const uRole = u.role || 'Morador'

      // Considera usuários com perfil de morador ou que possuam condomínio e unidade preenchidos
      const isPerfilMorador = ['Morador', 'Proprietário', 'Inquilino', 'Dependente', 'Síndico', 'Subsíndico', 'Conselheiro'].includes(uRole)
      const temLocalizacao = u.condominio && (u.unidade || u.apt)

      if (isPerfilMorador || temLocalizacao) {
        const jaCadastrado = (uEmail && emailsExistentes.has(uEmail)) || (uTel && telefonesExistentes.has(uTel))
        if (!jaCadastrado) {
          // Extrai o apartamento limpando prefixos como "Apt", "APTO."
          const aptLimpo = String(u.unidade || u.apt || '')
            .replace(/^(apto\.?|apt\.?|unidade|bl\.?\s*\d+\s*apt\.?)\s*/i, '')
            .trim()

          lista.push({
            id: `usr_${u.id}`,
            nome: u.nome || 'Morador',
            email: u.email || '',
            tel: u.telefone || u.tel || '',
            condominio: u.condominio || '',
            bloco: u.bloco || '',
            apt: aptLimpo || u.unidade || u.apt || '1',
            cpf: u.cpf || '',
            status: u.statusMorador || (uRole === 'Morador' ? 'Proprietário' : uRole),
            fotoRosto: u.foto || u.fotoRosto || '',
            origem: 'usuario-sincronizado',
            cadastroCompleto: true
          })
        }
      }
    })

    return lista
  }, [moradoresRaw, usuarios])

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

  // Função universal de normalização e comparação de condomínios
  const normalizarNomeCondo = (nome) => {
    return String(nome || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/^(residencial|condominio|edificio|ed\.)\s+/i, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .trim()
      .toLowerCase()
  }

  const condoMatch = (c1, c2) => {
    if (!c1 || !c2) return false
    if (c1 === 'Todos' || c2 === 'Todos') return true
    const n1 = normalizarNomeCondo(c1)
    const n2 = normalizarNomeCondo(c2)
    if (!n1 || !n2) return false
    return n1 === n2 || n1.includes(n2) || n2.includes(n1)
  }

  // Identifica o nome canônico do condomínio baseado no cadastro oficial
  const getNomeCanonicoCondo = (nomeOriginal) => {
    if (!nomeOriginal) return 'Sem Condomínio'
    const oficial = allCondominios.find(c => condoMatch(c.nome, nomeOriginal))
    return oficial?.nome || nomeOriginal.trim().toUpperCase()
  }

  // Lista unificada e desduplicada de condomínios
  const condominiosUnicos = React.useMemo(() => {
    const mapaCanonico = new Map() // normKey -> nomeOficial
    allCondominios.forEach(c => {
      if (c.nome) {
        const norm = normalizarNomeCondo(c.nome)
        if (!mapaCanonico.has(norm)) mapaCanonico.set(norm, c.nome)
      }
    })
    moradores.forEach(m => {
      if (m.condominio) {
        const norm = normalizarNomeCondo(m.condominio)
        if (!mapaCanonico.has(norm)) {
          mapaCanonico.set(norm, m.condominio.trim().toUpperCase())
        }
      }
    })
    const lista = Array.from(mapaCanonico.values()).sort((a, b) => a.localeCompare(b))
    return ['Todos', ...lista]
  }, [allCondominios, moradores])

  const aptsUnicos = ['Todos', ...Array.from(new Set(moradores.filter(m => filtroCondominio === 'Todos' || condoMatch(m.condominio, filtroCondominio)).map(m => m.apt).filter(Boolean))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))]

  const filtered = moradores.filter(m => {
    if (isMorador) {
      const uApt = String(user?.unidade || user?.apt || '').replace(/\D/g, '')
      const mApt = String(m.apt || '').replace(/\D/g, '')
      const matchApt = uApt && mApt && uApt === mApt
      const matchCondo = !user?.condominio || condoMatch(m.condominio, user?.condominio)
      return matchApt && matchCondo
    }
    const okSearch = m.nome?.toLowerCase().includes(search.toLowerCase()) || m.apt?.includes(search) || m.email?.includes(search)
    const okCondo = filtroCondominio === 'Todos' || condoMatch(m.condominio, filtroCondominio)
    const okApt = filtroApt === 'Todos' || m.apt === filtroApt
    return okSearch && okCondo && okApt
  })

  const unidadesMap = {}
  filtered.forEach(m => {
    const condo = getNomeCanonicoCondo(m.condominio)
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
    const condo = getNomeCanonicoCondo(p.condominio)
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
    if (modal === 'new') {
      await addItem(form)
    } else {
      const modalId = String(modal.id || '')
      if (modalId.startsWith('usr_')) {
        const uId = modalId.replace(/^usr_/, '')
        // Atualiza na coleção de usuários
        await updateDoc(doc(db, 'usuarios', uId), {
          nome: form.nome || '',
          cpf: form.cpf || '',
          telefone: form.tel || '',
          tel: form.tel || '',
          email: form.email || '',
          statusMorador: form.status || 'Proprietário',
          condominio: form.condominio || '',
          unidade: form.apt || '',
          apt: form.apt || '',
          bloco: form.bloco || '',
          foto: form.fotoRosto || '',
          fotoRosto: form.fotoRosto || ''
        }).catch(err => console.warn('Erro ao atualizar usuario:', err))

        // Também salva/atualiza na coleção de moradores para garantir persistência total
        const moradorExistente = moradoresRaw.find(m => 
          (form.email && (m.email || '').toLowerCase() === form.email.toLowerCase()) ||
          (m.condominio === form.condominio && m.apt === form.apt && (m.bloco || '') === (form.bloco || ''))
        )
        if (moradorExistente) {
          await updateItem(moradorExistente.id, form)
        } else {
          await addItem({ ...form, idOriginalUsuario: uId })
        }
      } else {
        await updateItem(modal.id, form)
        // Se houver usuário correspondente por e-mail, atualiza também
        if (form.email) {
          try {
            const qU = query(collection(db, 'usuarios'), where('email', '==', form.email.toLowerCase().trim()))
            const sU = await getDocs(qU)
            sU.forEach(async d => {
              await updateDoc(d.ref, {
                nome: form.nome || '',
                cpf: form.cpf || '',
                telefone: form.tel || '',
                tel: form.tel || '',
                condominio: form.condominio || '',
                unidade: form.apt || '',
                bloco: form.bloco || ''
              })
            })
          } catch(e) {}
        }
      }
    }
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
        cadastroCompleto: Boolean(existente?.cadastroCompleto || item.cpf),
        _updatedAt: new Date().toISOString()
      }

      if (existente) {
        if (String(existente.id).startsWith('usr_')) {
          const uId = String(existente.id).replace(/^usr_/, '')
          await updateDoc(doc(db, 'usuarios', uId), {
            nome: item.nome || existente.nome,
            cpf: item.cpf || existente.cpf || '',
            telefone: item.tel || existente.tel || '',
            tel: item.tel || existente.tel || '',
            email: item.email || existente.email || '',
            condominio: nomeCondo,
            unidade: item.apt,
            bloco: item.bloco || ''
          }).catch(e => console.warn(e))

          // Também grava na coleção moradores para persistência garantida
          const moradorColecao = moradoresRaw.find(m => m.id === existente.id)
          if (moradorColecao) {
            await updateItem(moradorColecao.id, {
              ...moradorColecao,
              ...dadosParaSalvar
            })
          } else {
            await addItem({
              ...dadosParaSalvar,
              idOriginalUsuario: uId,
              _createdAt: new Date().toISOString()
            })
          }
        } else {
          await updateItem(existente.id, {
            ...existente,
            ...dadosParaSalvar,
            nome: item.nome || existente.nome,
            tel: item.tel || existente.tel,
            email: item.email || existente.email || '',
            cpf: item.cpf || existente.cpf || ''
          })
        }
        atualizados++
      } else {
        await addItem({
          ...dadosParaSalvar,
          _createdAt: new Date().toISOString()
        })
        cadastrados++
      }

      // Sincroniza criação em usuarios e permissoes
      const emailFinal = (item.email || existente?.email || '').toLowerCase().trim()
      const telFinal = item.tel || existente?.tel || ''
      const nomeFinal = item.nome || existente?.nome || 'MORADOR'

      const moradorPerms = [
        'dashboard',
        'boletos',
        'assembleias',
        'reservas',
        'veiculos',
        'cameras',
        'regime',
        'documentos',
        'comunicacao'
      ]

      try {
        let usuarioExistenteDoc = null
        if (emailFinal) {
          const qU = query(collection(db, 'usuarios'), where('email', '==', emailFinal))
          const sU = await getDocs(qU)
          if (!sU.empty) usuarioExistenteDoc = sU.docs[0]
        }

        if (!usuarioExistenteDoc) {
          const sTodosU = await getDocs(collection(db, 'usuarios'))
          const achado = sTodosU.docs.find(d => {
            const dt = d.data()
            const matchCondo = String(dt.condominio || '').trim().toLowerCase() === String(nomeCondo).trim().toLowerCase()
            const matchApt = String(dt.unidade || dt.apt || '').trim().toLowerCase() === String(item.apt).trim().toLowerCase()
            const matchBloco = String(dt.bloco || '').trim().toLowerCase() === String(item.bloco || '').trim().toLowerCase()
            return matchCondo && matchApt && matchBloco
          })
          if (achado) usuarioExistenteDoc = achado
        }

        if (usuarioExistenteDoc) {
          await updateDoc(usuarioExistenteDoc.ref, {
            nome: nomeFinal,
            telefone: telFinal,
            tel: telFinal,
            condominio: nomeCondo,
            unidade: item.apt,
            apt: item.apt,
            bloco: item.bloco || '',
            role: 'Morador',
            statusMorador: item.status || 'Proprietário',
            permissoes: moradorPerms,
            ativo: true,
            status: 'Ativo'
          })
        } else {
          // Cria novo registro de usuário para aparecer na tela de Usuários & Permissões
          const userEmailParaSalvar = emailFinal || `morador_${String(nomeCondo).toLowerCase().replace(/[^a-z0-9]/g, '')}_${String(item.apt).replace(/[^a-z0-9]/g, '')}@alpha.local`
          await addDoc(collection(db, 'usuarios'), {
            nome: nomeFinal,
            email: userEmailParaSalvar,
            telefone: telFinal,
            tel: telFinal,
            condominio: nomeCondo,
            unidade: item.apt,
            apt: item.apt,
            bloco: item.bloco || '',
            role: 'Morador',
            statusMorador: item.status || 'Proprietário',
            permissoes: moradorPerms,
            ativo: true,
            status: 'Ativo',
            pendenteAprovacao: false,
            origem: 'importacao-arquivo',
            _createdAt: serverTimestamp()
          })
        }
      } catch (errSyncUser) {
        console.warn('Erro ao sincronizar morador com coleção usuarios:', nomeFinal, errSyncUser)
      }
    }

    setFiltroCondominio(nomeCondo)
    alert(`🎉 Importação Concluída com Sucesso!\n\n🏢 Condomínio: ${nomeCondo}\n✅ ${cadastrados} novas unidades cadastradas\n🔄 ${atualizados} unidades atualizadas.\n\nAgora você já pode copiar os links ou convidar os moradores pelo WhatsApp!`)
  }

  const handleDeleteMorador = async (m) => {
    if (!window.confirm(`Deseja realmente remover o morador "${m.nome}"?`)) return
    try {
      if (String(m.id).startsWith('usr_')) {
        const uId = String(m.id).replace(/^usr_/, '')
        await deleteDoc(doc(db, 'usuarios', uId))
      } else {
        await deleteItem(m.id)
      }
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
        if (String(m.id).startsWith('usr_')) {
          const uId = String(m.id).replace(/^usr_/, '')
          await deleteDoc(doc(db, 'usuarios', uId)).catch(() => {})
        } else {
          await deleteItem(m.id)
        }
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
                  🏢 {c} <span className="ml-1 text-brand-600 font-bold">({moradores.filter(m => condoMatch(m.condominio, c)).length} pessoas)</span>
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
          initialCondo={targetUnidade?.condominio || (filtroCondominio !== 'Todos' ? filtroCondominio : (allCondominios[0]?.nome || ''))}
          condominiosList={allCondominios}
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

