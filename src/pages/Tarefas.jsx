import React, { useState, useMemo } from 'react'
import emailjs from '@emailjs/browser'
import {
  CheckSquare, Plus, Trash2, Edit2, Calendar, User, X,
  LayoutGrid, List, Mail, Link2, Filter, Download, Clock,
  AlertTriangle, Send, Inbox, CheckCircle, Eye, ChevronLeft, ChevronRight, CalendarDays, Bell
} from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { EMAILJS_CONFIG } from '../emailjs.config'
import { useTarefasAutoReminder, verificarEDispararLembretesTarefas } from '../hooks/useTarefasAutoReminder'

// ─── Inicializa EmailJS se configurado ──────────────────────────────
if (EMAILJS_CONFIG.ATIVO) {
  emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY)
}

const COLUNAS = ['A Fazer', 'Em Andamento', 'Concluído']
const PRIORIDADES = ['Alta', 'Média', 'Baixa']

const prioColors = {
  Alta: 'bg-red-100 text-red-700 border border-red-200',
  Média: 'bg-amber-100 text-amber-700 border border-amber-200',
  Baixa: 'bg-green-100 text-green-700 border border-green-200',
}
const colColors = {
  'A Fazer': 'bg-slate-50 border-slate-200',
  'Em Andamento': 'bg-blue-50 border-blue-200',
  'Concluído': 'bg-emerald-50 border-emerald-200',
}
const colHeaderColors = {
  'A Fazer': 'bg-slate-200 text-slate-800',
  'Em Andamento': 'bg-blue-200 text-blue-900',
  'Concluído': 'bg-emerald-200 text-emerald-900',
}
const colDots = {
  'A Fazer': 'bg-slate-500',
  'Em Andamento': 'bg-blue-500',
  'Concluído': 'bg-emerald-500',
}

function hoje() { return new Date().toISOString().split('T')[0] }

function dtBR(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function vencStatus(venc, coluna) {
  if (!venc) return null
  if (coluna === 'Concluído' || coluna === 'concluido' || coluna === 'Finalizado') return 'done'
  if (venc < hoje()) return 'overdue'
  if (venc === hoje()) return 'today'
  const diff = Math.ceil((new Date(venc) - new Date(hoje())) / 86400000)
  if (diff <= 2) return 'soon'
  return 'ok'
}

function VencBadge({ venc, coluna }) {
  if (coluna === 'Concluído' || coluna === 'concluido' || coluna === 'Finalizado') {
    return venc ? (
      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
        ✓ Concluída ({dtBR(venc)})
      </span>
    ) : (
      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
        ✓ Concluída
      </span>
    )
  }
  const s = vencStatus(venc, coluna)
  if (!s) return null
  const cfg = {
    overdue: { cls: 'bg-red-100 text-red-700 border border-red-200', txt: '⚠️ Atrasada' },
    today: { cls: 'bg-amber-100 text-amber-700 border border-amber-200', txt: '🔥 Vence hoje' },
    soon: { cls: 'bg-orange-100 text-orange-700 border border-orange-200', txt: `📅 ${dtBR(venc)}` },
    ok: { cls: 'bg-slate-100 text-gray-600 border border-slate-200', txt: `📅 ${dtBR(venc)}` },
    done: { cls: 'bg-emerald-100 text-emerald-800 border border-emerald-200', txt: `✓ Concluída (${dtBR(venc)})` },
  }[s]
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.cls}`}>{cfg.txt}</span>
}

function exportarICS(tarefa) {
  const dtStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const dtStart = tarefa.vencimento ? tarefa.vencimento.replace(/-/g, '') : dtStamp.split('T')[0]
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AlphaAdmSC//PT', 'BEGIN:VEVENT',
    `UID:${tarefa.id}@alphaadmsc`, `DTSTAMP:${dtStamp}`, `DTSTART;VALUE=DATE:${dtStart}`,
    `SUMMARY:${tarefa.titulo}`, `DESCRIPTION:${(tarefa.descricao || '').replace(/\n/g, '\\n')}`,
    'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
  a.download = `${tarefa.titulo.replace(/\s+/g, '_')}.ics`; a.click()
}

// ─── Modal: Compor E-mail ─────────────────────────────────────────────
function EmailModal({ tarefa, onClose, onSent }) {
  const [form, setForm] = useState({
    para_email: tarefa?.email || '',
    para_nome: tarefa?.responsavel || '',
    assunto: tarefa ? `Tarefa: ${tarefa.titulo}` : '',
    mensagem: tarefa
      ? `Olá ${tarefa.responsavel || ''},\n\nSeguem as informações da tarefa:\n\n📋 Título: ${tarefa.titulo}\n⚡ Prioridade: ${tarefa.prioridade}\n📅 Vencimento: ${dtBR(tarefa.vencimento) || 'Não definido'}\n\n${tarefa.descricao ? `Descrição:\n${tarefa.descricao}` : ''}\n\nAtenciosamente,\nAlpha Admin SC`
      : '',
    de_nome: 'Alpha Admin SC',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')

  const handleEnviar = async () => {
    if (!form.para_email || !form.assunto) { setStatus('❌ Preencha o e-mail e o assunto.'); return }
    setLoading(true)
    setStatus('')

    const registro = {
      para_email: form.para_email,
      para_nome: form.para_nome,
      assunto: form.assunto,
      mensagem: form.mensagem,
      de_nome: form.de_nome,
      tarefaId: tarefa?.id || '',
      tarefaTitulo: tarefa?.titulo || '',
      enviadoEm: new Date().toISOString(),
      metodo: EMAILJS_CONFIG.ATIVO ? 'EmailJS' : 'mailto',
    }

    if (EMAILJS_CONFIG.ATIVO) {
      try {
        await emailjs.send(EMAILJS_CONFIG.SERVICE_ID, EMAILJS_CONFIG.TEMPLATE_ID, form)
        setStatus('✅ E-mail enviado com sucesso!')
        setTimeout(() => { onSent(registro); onClose() }, 1200)
      } catch (e) {
        setStatus('❌ Erro ao enviar. Verifique a configuração do EmailJS.')
      }
    } else {
      // Fallback mailto
      const assunto = encodeURIComponent(form.assunto)
      const corpo = encodeURIComponent(form.mensagem)
      window.open(`mailto:${form.para_email}?subject=${assunto}&body=${corpo}`, '_blank')
      setStatus('📬 App de e-mail aberto! (EmailJS não configurado ainda)')
      setTimeout(() => { onSent(registro); onClose() }, 1200)
    }
    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail size={18} className="text-brand-500" />
            <h3 className="font-bold text-gray-800">Compor E-mail</h3>
            {EMAILJS_CONFIG.ATIVO
              ? <span className="badge-green text-xs">EmailJS Ativo</span>
              : <span className="badge-yellow text-xs">Modo mailto</span>
            }
          </div>
          <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-700" /></button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Para (e-mail) *</label><input type="email" className="input" value={form.para_email} onChange={e => set('para_email', e.target.value)} placeholder="destinatario@email.com" /></div>
            <div><label className="label">Nome do destinatário</label><input className="input" value={form.para_nome} onChange={e => set('para_nome', e.target.value)} placeholder="Nome" /></div>
          </div>
          <div><label className="label">Assunto *</label><input className="input" value={form.assunto} onChange={e => set('assunto', e.target.value)} /></div>
          <div><label className="label">Mensagem</label><textarea className="input resize-none min-h-[160px]" value={form.mensagem} onChange={e => set('mensagem', e.target.value)} /></div>
          {!EMAILJS_CONFIG.ATIVO && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-700">
              ⚠️ <strong>EmailJS não configurado.</strong> O e-mail será aberto no seu app padrão, mas será registrado no histórico.
              <a href="https://www.emailjs.com" target="_blank" rel="noreferrer" className="ml-1 underline">Configurar EmailJS →</a>
            </div>
          )}
          {status && <p className="text-sm font-medium text-center">{status}</p>}
        </div>
        <div className="p-6 border-t border-cream-300 flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleEnviar} disabled={loading} className="btn-primary">
            <Send size={14} />{loading ? 'Enviando...' : 'Enviar E-mail'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal: Visualizar e-mail enviado ───────────────────────────────
function VisualizarEmailModal({ email, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">E-mail enviado</h3>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <div className="p-6 flex flex-col gap-3">
          <div className="bg-cream-50 rounded-xl p-4 text-sm space-y-2">
            <p><span className="font-medium text-gray-500">Para:</span> {email.para_nome ? `${email.para_nome} <${email.para_email}>` : email.para_email}</p>
            <p><span className="font-medium text-gray-500">Assunto:</span> {email.assunto}</p>
            <p className="text-xs text-gray-400">{new Date(email.enviadoEm).toLocaleString('pt-BR')}</p>
          </div>
          <div className="bg-white border border-cream-300 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap">{email.mensagem}</div>
          {email.tarefaTitulo && <p className="text-xs text-gray-400">Tarefa relacionada: {email.tarefaTitulo}</p>}
        </div>
        <div className="p-6 border-t border-cream-300">
          <button onClick={onClose} className="btn-secondary w-full justify-center">Fechar</button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal: Criar/Editar Tarefa ──────────────────────────────────────
function CardModal({ data, onClose, onSave, onEmail }) {
  const [form, setForm] = useState(data || { titulo: '', descricao: '', responsavel: '', email: '', vencimento: '', prioridade: 'Média', coluna: 'A Fazer', tags: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">{data?.id ? 'Editar Tarefa' : 'Nova Tarefa'}</h3>
          <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-700" /></button>
        </div>
        <div className="p-6 flex flex-col gap-4 max-h-[60vh] overflow-y-auto">
          <div><label className="label">Título *</label><input className="input" value={form.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Ex: Revisar balanço do mês" autoFocus /></div>
          <div><label className="label">Descrição</label><textarea className="input resize-none min-h-[80px]" value={form.descricao} onChange={e => set('descricao', e.target.value)} placeholder="Detalhes, links, observações..." /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Responsável</label><input className="input" value={form.responsavel} onChange={e => set('responsavel', e.target.value)} placeholder="Nome" /></div>
            <div><label className="label">E-mail do responsável</label><input type="email" className="input" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@exemplo.com" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Vencimento</label><input type="date" className="input" value={form.vencimento} onChange={e => set('vencimento', e.target.value)} /></div>
            <div><label className="label">Prioridade</label>
              <select className="input" value={form.prioridade} onChange={e => set('prioridade', e.target.value)}>
                {PRIORIDADES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Coluna</label>
              <select className="input" value={form.coluna} onChange={e => set('coluna', e.target.value)}>
                {COLUNAS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div><label className="label">Tags (vírgula)</label><input className="input" value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="reunião, financeiro..." /></div>
          </div>
        </div>
        <div className="p-6 border-t border-cream-300 flex gap-2 items-center">
          {form.id && (
            <div className="flex gap-2">
              <button onClick={() => onEmail(form)} title="Enviar e-mail sobre esta tarefa" className="p-2 rounded-lg bg-cream-100 hover:bg-blue-100 text-gray-500 hover:text-blue-600 transition-all"><Mail size={14} /></button>
              <button onClick={() => exportarICS(form)} title="Google Calendar" className="p-2 rounded-lg bg-cream-100 hover:bg-indigo-100 text-gray-500 hover:text-indigo-600 transition-all"><Calendar size={14} /></button>
            </div>
          )}
          <div className="flex gap-3 ml-auto">
            <button onClick={onClose} className="btn-secondary">Cancelar</button>
            <button onClick={() => { if (!form.titulo) return; onSave(form) }} className="btn-primary"><CheckSquare size={14} />Salvar</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Vista Kanban ────────────────────────────────────────────────────
function KanbanView({ tarefas, onEdit, onDelete, onMove, onAdd, onEmail }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {COLUNAS.map(col => {
        const cards = tarefas.filter(t => t.coluna === col)
        return (
          <div key={col} className={`rounded-2xl border ${colColors[col]} p-4 flex flex-col gap-3 min-h-[280px]`}>
            <div className={`flex items-center justify-between px-3 py-2 rounded-xl ${colHeaderColors[col]}`}>
              <div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${colDots[col]}`} /><span className="font-bold text-sm">{col}</span></div>
              <span className="w-6 h-6 rounded-full bg-white/70 flex items-center justify-center text-xs font-bold">{cards.length}</span>
            </div>
            {cards.map(t => (
              <div key={t.id} className="bg-white rounded-xl border border-cream-300 p-4 shadow-sm hover:shadow-md transition-all group cursor-pointer" onClick={() => onEdit(t)}>
                <div className="flex items-start justify-between mb-2">
                  <p className="font-semibold text-gray-800 text-sm leading-snug flex-1">{t.titulo}</p>
                  <button onClick={e => { e.stopPropagation(); onDelete(t.id) }} className="p-1 rounded hover:bg-red-100 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all ml-1"><Trash2 size={11} /></button>
                </div>
                {t.descricao && <p className="text-xs text-gray-500 mb-2 line-clamp-2">{t.descricao}</p>}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${prioColors[t.prioridade]}`}>{t.prioridade}</span>
                  <VencBadge venc={t.vencimento} coluna={t.coluna} />
                  {t.responsavel && <span className="text-xs text-gray-500 flex items-center gap-1 bg-cream-100 px-2 py-0.5 rounded-full"><User size={9} />{t.responsavel}</span>}
                </div>
                {t.tags && <div className="flex flex-wrap gap-1 mb-2">{t.tags.split(',').map(g => g.trim()).filter(Boolean).map(g => <span key={g} className="text-xs bg-brand-50 text-brand-600 px-2 py-0.5 rounded-full border border-brand-100">#{g}</span>)}</div>}
                <div className="flex gap-1 flex-wrap">
                  {COLUNAS.filter(c => c !== col).map(c => (
                    <button key={c} onClick={e => { e.stopPropagation(); onMove(t.id, c) }} className="text-xs px-2 py-0.5 rounded-lg bg-cream-100 hover:bg-brand-100 text-gray-500 hover:text-brand-700 transition-all border border-cream-300">→ {c}</button>
                  ))}
                  <button onClick={e => { e.stopPropagation(); onEmail(t) }} title="Enviar e-mail" className="text-xs px-2 py-0.5 rounded-lg bg-cream-100 hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition-all border border-cream-300"><Mail size={10} /></button>
                  <button onClick={e => { e.stopPropagation(); exportarICS(t) }} title="Google Calendar" className="text-xs px-2 py-0.5 rounded-lg bg-cream-100 hover:bg-indigo-100 text-gray-400 hover:text-indigo-600 transition-all border border-cream-300"><Calendar size={10} /></button>
                </div>
              </div>
            ))}
            <button onClick={() => onAdd(col)} className="flex items-center gap-2 text-sm text-gray-400 hover:text-brand-600 p-2 rounded-xl hover:bg-white/70 transition-all mt-auto"><Plus size={14} />Adicionar tarefa</button>
          </div>
        )
      })}
    </div>
  )
}

// ─── Vista Agenda ────────────────────────────────────────────────────
function AgendaView({ tarefas, onEdit, onDelete, onEmail }) {
  const agrupadas = useMemo(() => {
    const hj = hoje(); const grupos = {}
    const semData = tarefas.filter(t => !t.vencimento && t.coluna !== 'Concluído')
    if (semData.length) grupos['Sem data definida'] = semData
    tarefas.filter(t => t.vencimento && t.coluna !== 'Concluído').forEach(t => {
      const label = t.vencimento < hj ? '⚠️ Atrasadas' : t.vencimento === hj ? '🔥 Hoje'
        : `📅 ${new Date(t.vencimento + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}`
      if (!grupos[label]) grupos[label] = []
      grupos[label].push(t)
    })
    const done = tarefas.filter(t => t.coluna === 'Concluído')
    if (done.length) grupos['✅ Concluídas'] = done
    return grupos
  }, [tarefas])

  return (
    <div className="flex flex-col gap-6">
      {Object.entries(agrupadas).map(([grupo, items]) => (
        <div key={grupo}>
          <p className="font-bold text-gray-700 text-sm mb-3 capitalize">{grupo}</p>
          <div className="flex flex-col gap-2">
            {items.map(t => (
              <div key={t.id} className={`card flex items-center justify-between hover:border-brand-300 transition-all group cursor-pointer ${t.coluna === 'Concluído' ? 'opacity-60' : ''}`} onClick={() => onEdit(t)}>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-2 h-10 rounded-full flex-shrink-0 ${vencStatus(t.vencimento) === 'overdue' ? 'bg-red-400' : vencStatus(t.vencimento) === 'today' ? 'bg-amber-400' : colDots[t.coluna]}`} />
                  <div className="min-w-0">
                    <p className={`font-semibold text-sm ${t.coluna === 'Concluído' ? 'line-through text-gray-400' : 'text-gray-800'}`}>{t.titulo}</p>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${prioColors[t.prioridade]}`}>{t.prioridade}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full text-gray-500 bg-cream-100">{t.coluna}</span>
                      {t.responsavel && <span className="text-xs text-gray-400 flex items-center gap-1"><User size={9} />{t.responsavel}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-3">
                  <button onClick={e => { e.stopPropagation(); onEmail(t) }} className="p-1.5 rounded-lg bg-cream-100 hover:bg-blue-100 text-gray-400 hover:text-blue-600"><Mail size={12} /></button>
                  <button onClick={e => { e.stopPropagation(); exportarICS(t) }} className="p-1.5 rounded-lg bg-cream-100 hover:bg-indigo-100 text-gray-400 hover:text-indigo-600"><Calendar size={12} /></button>
                  <button onClick={e => { e.stopPropagation(); onDelete(t.id) }} className="p-1.5 rounded-lg bg-cream-100 hover:bg-red-100 text-gray-400 hover:text-red-500"><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {tarefas.length === 0 && <div className="card text-center py-12 text-gray-400 text-sm">Nenhuma tarefa encontrada.</div>}
    </div>
  )
}

// ─── Vista Calendário ──────────────────────────────────────────────────
function CalendarView({ tarefas, onEdit, onDelete, onAdd, onEmail }) {
  const [currentDate, setCurrentDate] = useState(new Date())

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = new Date(year, month, 1).getDay()

  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  return (
    <div className="card p-0 overflow-hidden shadow-sm">
      <div className="flex justify-between items-center p-4 border-b border-cream-300 bg-cream-50">
        <button onClick={prevMonth} className="btn-secondary px-3 py-1.5"><ChevronLeft size={16} /> Anterior</button>
        <h3 className="font-black text-xl text-brand-900 capitalize">{monthNames[month]} {year}</h3>
        <button onClick={nextMonth} className="btn-secondary px-3 py-1.5">Próximo <ChevronRight size={16} /></button>
      </div>

      <div className="grid grid-cols-7 border-b border-cream-300 bg-white">
        {weekDays.map(w => <div key={w} className="py-3 text-center text-xs font-black text-brand-800 uppercase tracking-wider">{w}</div>)}
      </div>

      <div className="grid grid-cols-7 bg-cream-200 gap-px">
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="bg-cream-50/50 min-h-[120px] p-2"></div>
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const d = i + 1;
          const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

          // Filtrar tarefas daquele dia
          const dayTasks = tarefas.filter(t => t.vencimento === dayStr)
          const isToday = dayStr === todayStr;

          return (
            <div
              key={d}
              onClick={() => onAdd('A Fazer', dayStr)}
              className={`bg-white min-h-[120px] p-2 transition-all hover:bg-brand-50 cursor-pointer group flex flex-col gap-1.5 relative ${isToday ? 'bg-blue-50/30' : ''}`}
            >
              <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full transition-all ${isToday ? 'bg-brand-600 text-white ring-4 ring-brand-100' : 'text-gray-400 group-hover:text-brand-600 group-hover:bg-brand-100'}`}>{d}</span>

              <div className="flex flex-col gap-1.5 mt-1 flex-1 overflow-y-auto custom-scrollbar pr-1 max-h-[100px]">
                {dayTasks.map(t => (
                  <div
                    key={t.id}
                    onClick={(e) => { e.stopPropagation(); onEdit(t); }}
                    className={`text-[10px] px-2 py-1.5 rounded-md border cursor-pointer hover:shadow-sm transition-all flex flex-col gap-1
                      ${t.coluna === 'Concluído' ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800 opacity-60 line-through' :
                        t.coluna === 'Em Andamento' ? 'bg-blue-50/80 border-blue-200 text-blue-800' :
                          'bg-slate-50/80 border-slate-300 text-slate-800 font-medium'}`}
                    title={t.titulo}
                  >
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${colDots[t.coluna]}`} />
                      <span className="truncate">{t.titulo}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Vista Histórico de E-mails ──────────────────────────────────────
function EmailsView({ emails, onDelete, onVisualizar }) {
  return (
    <div className="flex flex-col gap-3">
      {emails.length === 0
        ? <div className="card text-center py-12 text-gray-400 text-sm">
          <Mail size={32} className="mx-auto mb-3 opacity-30" />
          Nenhum e-mail enviado ainda. Use o botão ✉️ em qualquer tarefa para enviar.
        </div>
        : emails.slice().reverse().map(em => (
          <div key={em.id} className="card hover:border-brand-300 transition-all group">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 bg-blue-100 border border-blue-200 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Mail size={16} className="text-blue-500" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800 text-sm truncate">{em.assunto}</p>
                  <p className="text-xs text-gray-500 truncate">
                    Para: {em.para_nome ? `${em.para_nome} <${em.para_email}>` : em.para_email}
                    {em.tarefaTitulo && <span className="ml-2 text-brand-500">· {em.tarefaTitulo}</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                <span className="text-xs text-gray-400">{em.enviadoEm ? new Date(em.enviadoEm).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${em.metodo === 'EmailJS' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{em.metodo}</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => onVisualizar(em)} className="p-1.5 rounded-lg bg-cream-100 hover:bg-brand-100 text-gray-400 hover:text-brand-600"><Eye size={12} /></button>
                  <button onClick={() => onDelete(em.id)} className="p-1.5 rounded-lg bg-cream-100 hover:bg-red-100 text-gray-400 hover:text-red-500"><Trash2 size={12} /></button>
                </div>
              </div>
            </div>
          </div>
        ))
      }
    </div>
  )
}

// ─── Componente Principal ─────────────────────────────────────────────
export default function Tarefas() {
  useTarefasAutoReminder()
  const { items: tarefas, addItem, updateItem, deleteItem } = useFirestore('tarefas')
  const { items: notificacoes, deleteItem: delNotif } = useFirestore('notificacoes')
  const { items: emails, addItem: addEmail, deleteItem: delEmail } = useFirestore('emails_enviados')

  const [tab, setTab] = useState('kanban') // 'kanban' | 'agenda' | 'emails'
  const [cardModal, setCardModal] = useState(null)
  const [emailModal, setEmailModal] = useState(null)
  const [vizModal, setVizModal] = useState(null)
  const [filtroPrio, setFiltroPrio] = useState('')
  const [filtroResp, setFiltroResp] = useState('')
  const [enviandoLembretes, setEnviandoLembretes] = useState(false)

  // Unifica as tarefas com os agendamentos comerciais recebidos pelo robô da Alpha
  const todasTarefas = useMemo(() => {
    const agendamentos = (notificacoes || [])
      .filter(n => n.tipo === 'agendamento_comercial')
      .map(n => ({
        id: n.id,
        isNotif: true,
        titulo: n.titulo || 'Nova Reunião Comercial Agendada',
        descricao: n.descricao || n.mensagem || '',
        responsavel: n.responsavel || 'Equipe Alpha',
        vencimento: n.vencimento || (n.criadoEm ? n.criadoEm.split('T')[0] : hoje()),
        prioridade: n.prioridade || 'Alta',
        coluna: n.coluna || 'A Fazer',
        tags: n.tags || 'reunião, comercial, prospecção'
      }))

    return [...tarefas, ...agendamentos]
  }, [tarefas, notificacoes])

  const tarefasFiltradas = useMemo(() => todasTarefas.filter(t => {
    if (filtroPrio && t.prioridade !== filtroPrio) return false
    if (filtroResp && !t.responsavel?.toLowerCase().includes(filtroResp.toLowerCase())) return false
    return true
  }), [todasTarefas, filtroPrio, filtroResp])

  const stats = {
    total: todasTarefas.length,
    concluidas: todasTarefas.filter(t => t.coluna === 'Concluído').length,
    atrasadas: todasTarefas.filter(t => t.vencimento && t.vencimento < hoje() && t.coluna !== 'Concluído').length,
    hoje: todasTarefas.filter(t => t.vencimento === hoje() && t.coluna !== 'Concluído').length,
  }

  const handleSaveCard = async (form) => {
    if (cardModal?.id) {
      if (cardModal.isNotif) await updateItem(cardModal.id, form) // se for notif salva ou atualiza
      else await updateItem(cardModal.id, form)
    } else {
      await addItem(form)
    }
    setCardModal(null)
  }

  const handleDeleteTarefa = async (id) => {
    const item = todasTarefas.find(t => t.id === id)
    if (item?.isNotif) await delNotif(id)
    else await deleteItem(id)
  }

  const handleMoveTarefa = async (id, col) => {
    const item = todasTarefas.find(t => t.id === id)
    if (item?.isNotif) await delNotif(id) // ou move
    else await updateItem(id, { coluna: col })
  }

  const exportarCSV = () => {
    const csv = ['Título,Prioridade,Status,Responsável,Vencimento,Descrição',
      ...tarefas.map(t => `"${t.titulo}","${t.prioridade}","${t.coluna}","${t.responsavel || ''}","${dtBR(t.vencimento)}","${(t.descricao || '').replace(/"/g, "'")}"`)
    ].join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'tarefas.csv'; a.click()
  }

  const TABS = [
    { id: 'kanban', label: 'Kanban', icon: LayoutGrid },
    { id: 'agenda', label: 'Agenda', icon: List },
    { id: 'calendario', label: 'Calendário', icon: CalendarDays },
    { id: 'emails', label: `E-mails (${emails.length})`, icon: Inbox },
  ]

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="section-title text-xl">Tarefas & Agenda</h2>
          <p className="section-sub">{stats.total} tarefas · {stats.concluidas} concluídas · {emails.length} e-mails enviados</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button 
            onClick={async () => {
              setEnviandoLembretes(true)
              const res = await verificarEDispararLembretesTarefas(true)
              setEnviandoLembretes(false)
              if (res?.success) alert(res.message || 'Lembrete enviado com sucesso!')
              else alert('Aviso: ' + (res?.message || res?.error))
            }} 
            disabled={enviandoLembretes}
            className="btn-secondary gap-1.5 text-sm bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold"
            title="Disparar lembrete das tarefas de hoje pelo WhatsApp"
          >
            <Bell size={14} className="text-emerald-600" />
            {enviandoLembretes ? 'Enviando...' : 'Lembrete no WhatsApp'}
          </button>
          <button onClick={() => setEmailModal({})} className="btn-secondary gap-1.5 text-sm"><Mail size={14} />Novo E-mail</button>
          <button onClick={exportarCSV} className="btn-secondary gap-1.5 text-sm py-2 px-3"><Download size={14} /></button>
          <button onClick={() => setCardModal({ coluna: 'A Fazer', titulo: '', descricao: '', responsavel: '', email: '', vencimento: '', prioridade: 'Média', tags: '' })} className="btn-primary"><Plus size={16} />Nova Tarefa</button>
        </div>
      </div>

      {/* Alertas de atraso */}
      {(stats.atrasadas > 0 || stats.hoje > 0) && (
        <div className="flex gap-3 flex-wrap">
          {stats.atrasadas > 0 && <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-xl text-sm font-medium"><AlertTriangle size={14} />{stats.atrasadas} tarefa{stats.atrasadas > 1 ? 's atrasadas' : ' atrasada'}</div>}
          {stats.hoje > 0 && <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 rounded-xl text-sm font-medium"><Clock size={14} />{stats.hoje} vence{stats.hoje > 1 ? 'm' : ''} hoje</div>}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 items-center flex-wrap">
        <div className="flex rounded-xl border border-cream-400 overflow-hidden">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)} className={`px-4 py-2 text-sm font-medium flex items-center gap-1.5 transition-all ${tab === id ? 'bg-brand-600 text-white' : 'text-gray-500 hover:text-brand-600 bg-white'}`}>
              <Icon size={14} />{label}
            </button>
          ))}
        </div>

        {/* Filtros (Kanban/Agenda) */}
        {tab !== 'emails' && (
          <>
            <select value={filtroPrio} onChange={e => setFiltroPrio(e.target.value)} className="input py-2 text-sm w-auto">
              <option value="">Todas as prioridades</option>
              {PRIORIDADES.map(p => <option key={p}>{p}</option>)}
            </select>
            <input value={filtroResp} onChange={e => setFiltroResp(e.target.value)} placeholder="Filtrar por responsável..." className="input py-2 text-sm w-44" />
            {(filtroPrio || filtroResp) && <button onClick={() => { setFiltroPrio(''); setFiltroResp('') }} className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1"><X size={12} />Limpar</button>}
          </>
        )}

        {/* Integrações rápidas */}
        <div className="flex gap-2 ml-auto flex-wrap">
          <a href="https://calendar.google.com" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white border border-cream-400 rounded-full text-gray-500 hover:text-brand-600 hover:border-brand-300 transition-all"><Calendar size={12} />G. Calendar</a>
          <a href="https://trello.com" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white border border-cream-400 rounded-full text-gray-500 hover:text-brand-600 hover:border-brand-300 transition-all"><Link2 size={12} />Trello</a>
        </div>
      </div>

      {/* Vistas */}
      {tab === 'kanban' && <KanbanView tarefas={tarefasFiltradas} onEdit={setCardModal} onDelete={handleDeleteTarefa} onMove={handleMoveTarefa} onAdd={(col, data = '') => setCardModal({ coluna: col, titulo: '', descricao: '', responsavel: '', email: '', vencimento: data, prioridade: 'Média', tags: '' })} onEmail={t => setEmailModal(t)} />}

      {tab === 'agenda' && <AgendaView tarefas={tarefasFiltradas} onEdit={setCardModal} onDelete={handleDeleteTarefa} onEmail={t => setEmailModal(t)} />}

      {tab === 'calendario' && <CalendarView tarefas={tarefasFiltradas} onEdit={setCardModal} onDelete={handleDeleteTarefa} onAdd={(col, data) => setCardModal({ coluna: col, titulo: '', descricao: '', responsavel: '', email: '', vencimento: data, prioridade: 'Média', tags: '' })} onEmail={t => setEmailModal(t)} />}

      {tab === 'emails' && <EmailsView emails={emails} onDelete={delEmail} onVisualizar={setVizModal} />}

      {/* Modais */}
      {cardModal && <CardModal data={cardModal?.titulo !== undefined ? cardModal : null} onClose={() => setCardModal(null)} onSave={handleSaveCard} onEmail={t => { setCardModal(null); setEmailModal(t) }} />}
      {emailModal !== null && <EmailModal tarefa={Object.keys(emailModal).length > 0 ? emailModal : null} onClose={() => setEmailModal(null)} onSent={async reg => await addEmail(reg)} />}
      {vizModal && <VisualizarEmailModal email={vizModal} onClose={() => setVizModal(null)} />}
    </div>
  )
}
