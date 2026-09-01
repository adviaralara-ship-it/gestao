import React, { useState, useRef, useEffect } from 'react'
import { UserCog, Plus, Search, Edit2, Trash2, Briefcase, FileText, Loader2, MapPin, Clock, CheckSquare, CheckCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useFirestore } from '../../hooks/useFirestore'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { storage, db } from '../../firebase'
import { CurrencyInput } from '../../utils/currency'

function ColabModal({ data, condominios = [], onClose, onSave }) {
  const [form, setForm] = useState(data || { 
    nome: '', cargo: '', dept: '', salario: '', admissao: '', nascimento: '', status: 'Ativo', condominio: '',
    telefone: '', vencimentoFerias: '', vencimentoASO: ''
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">{data ? 'Editar Colaborador' : 'Novo Colaborador'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
          <div className="col-span-2"><label className="label">Nome Completo</label><input className="input" value={form.nome} onChange={e => set('nome', e.target.value)} /></div>
          <div className="col-span-2">
            <label className="label">Condomínio / Empresa (Para Folha)</label>
            <select className="input" value={form.condominio || ''} onChange={e => set('condominio', e.target.value)}>
              <option value="">ALPHA GESTÃO CONDOMINIAL (Interno)</option>
              {condominios.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
            </select>
          </div>
          <div><label className="label">Cargo</label><input className="input" value={form.cargo} onChange={e => set('cargo', e.target.value)} /></div>
          <div><label className="label">Departamento</label><input className="input" value={form.dept} onChange={e => set('dept', e.target.value)} /></div>
          <div><label className="label">Salário Base</label><CurrencyInput value={form.salario} onChange={v => set('salario', v)} placeholder="0,00" /></div>
          <div><label className="label">Data Admissão</label><input type="date" className="input" value={form.admissao} onChange={e => set('admissao', e.target.value)} /></div>
          <div className="col-span-2"><label className="label">Data de Nascimento</label><input type="date" className="input" value={form.nascimento || ''} onChange={e => set('nascimento', e.target.value)} /></div>
          
          <div className="col-span-2"><hr className="border-cream-300 my-2" /></div>
          
          <div className="col-span-2"><label className="label">Telefone / WhatsApp (com DDD)</label><input className="input" placeholder="Ex: 11999999999" value={form.telefone || ''} onChange={e => set('telefone', e.target.value)} /></div>
          <div><label className="label">Limite para Férias</label><input type="date" className="input" value={form.vencimentoFerias || ''} onChange={e => set('vencimentoFerias', e.target.value)} /></div>
          <div><label className="label">Vencimento do Exame ASO</label><input type="date" className="input" value={form.vencimentoASO || ''} onChange={e => set('vencimentoASO', e.target.value)} /></div>

          <div className="col-span-2"><label className="label">Status</label>
            <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
              <option>Ativo</option><option>Em Experiência</option><option>Férias</option><option>Afastado</option><option>Inativo</option>
            </select>
          </div>
        </div>
        <div className="p-6 border-t border-cream-300 flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={() => onSave(form)} className="btn-primary">Salvar</button>
        </div>
      </div>
    </div>
  )
}

function PontoModal({ data, onClose }) {
  const [pontos, setPontos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPontos = async () => {
      try {
        const q = query(collection(db, 'pontos'), where('colabId', '==', data.id))
        const snap = await getDocs(q)
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.dataISO) - new Date(a.dataISO))
        setPontos(list)
      } catch(err) {
        alert('Erro ao buscar pontos: ' + err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchPontos()
  }, [data])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">Extrato de Ponto (REP-P) - {data.nome}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {loading ? <p className="text-center text-gray-500 py-10">Carregando registros...</p> : 
           pontos.length === 0 ? <p className="text-center text-gray-500 py-10">Nenhum ponto registrado.</p> :
           <div className="space-y-4">
             {pontos.map(p => (
               <div key={p.id} className="flex gap-4 p-4 border border-cream-300 rounded-xl bg-cream-50 items-center">
                 {(p.photoBase64 || p.photoUrl) && <img src={p.photoBase64 || p.photoUrl} alt="Selfie" className="w-16 h-16 rounded-xl object-cover" />}
                 <div className="flex-1">
                   <div className="flex items-center gap-2 mb-1">
                     <span className={`px-2 py-0.5 rounded text-xs font-bold ${p.tipo === 'Entrada' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{p.tipo}</span>
                     <span className="text-sm font-bold text-gray-800">{new Date(p.dataISO).toLocaleString()}</span>
                   </div>
                   {p.location && (
                     <a href={`https://maps.google.com/?q=${p.location.lat},${p.location.lng}`} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                       <MapPin size={12}/> Ver localização no mapa
                     </a>
                   )}
                 </div>
               </div>
             ))}
           </div>
          }
        </div>
      </div>
    </div>
  )
}

function OnboardingModal({ data, onClose, updateItem }) {
  const [tasks, setTasks] = useState(data.onboarding || {
    contrato: false, email: false, exame: false, uniforme: false, epi: false
  })

  const toggleTask = (k) => {
    setTasks(t => ({ ...t, [k]: !t[k] }))
  }

  const handleSave = async () => {
    await updateItem(data.id, { onboarding: tasks })
    onClose()
  }

  const taskLabels = {
    contrato: 'Contrato Assinado',
    email: 'E-mail Corporativo Criado',
    exame: 'Exame Admissional (ASO)',
    uniforme: 'Uniforme Entregue',
    epi: 'EPIs Entregues'
  }

  const total = Object.keys(tasks).length
  const completed = Object.values(tasks).filter(Boolean).length
  const percent = Math.round((completed / total) * 100) || 0

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">Checklist de Onboarding</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-brand-50 rounded-xl p-4 flex items-center justify-between border border-brand-100">
            <div>
              <p className="font-bold text-brand-800">{data.nome}</p>
              <p className="text-sm text-brand-600">Progresso de Integração</p>
            </div>
            <div className="text-2xl font-bold text-brand-600">{percent}%</div>
          </div>
          
          <div className="w-full bg-cream-200 rounded-full h-2.5 mb-6">
            <div className="bg-brand-500 h-2.5 rounded-full transition-all" style={{ width: `${percent}%` }}></div>
          </div>

          <div className="space-y-3">
            {Object.keys(tasks).map(k => (
              <label key={k} className="flex items-center gap-3 p-3 border border-cream-200 rounded-lg cursor-pointer hover:bg-cream-50 transition-colors">
                <input 
                  type="checkbox" 
                  checked={tasks[k]}
                  onChange={() => toggleTask(k)}
                  className="w-5 h-5 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                <span className={`text-sm font-medium ${tasks[k] ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                  {taskLabels[k]}
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="p-6 border-t border-cream-300 flex justify-end gap-3 bg-cream-50 rounded-b-2xl">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleSave} className="btn-primary">Salvar Progresso</button>
        </div>
      </div>
    </div>
  )
}

export default function RHColaboradores() {
  const { items: colabs, addItem, updateItem, deleteItem } = useFirestore('rh')
  const { items: condominios } = useFirestore('condominios')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [pontoModal, setPontoModal] = useState(null)
  const [onboardingModal, setOnboardingModal] = useState(null)

  const [uploading, setUploading] = useState(null)
  const fileInputRef = useRef({})

  const handleUploadHolerite = async (e, colab) => {
    const file = e.target.files[0]
    if (!file) return
    
    if (!colab.telefone) {
      alert('Este funcionário não tem telefone cadastrado. Edite o perfil e adicione o WhatsApp com DDD primeiro.')
      return
    }

    setUploading(colab.id)
    try {
      const storageRef = ref(storage, `holerites/${colab.id}/${Date.now()}_${file.name}`)
      const uploadTask = uploadBytesResumable(storageRef, file)
      
      uploadTask.on('state_changed', 
        () => {}, 
        (error) => {
          alert('Erro ao fazer upload: ' + error.message)
          setUploading(null)
        }, 
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
          const msg = `Olá ${colab.nome.split(' ')[0]}, segue o link seguro para download do seu holerite deste mês:\n\n${downloadURL}`
          const url = `https://wa.me/55${colab.telefone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`
          window.open(url, '_blank')
          setUploading(null)
          e.target.value = null
        }
      )
    } catch (err) {
      alert('Erro geral: ' + err.message)
      setUploading(null)
    }
  }

  const filtered = colabs.filter(c => c.nome.toLowerCase().includes(search.toLowerCase()) || c.cargo.toLowerCase().includes(search.toLowerCase()))

  const handleSave = async (form) => {
    if (modal === 'new') await addItem(form)
    else await updateItem(modal.id, form)
    setModal(null)
  }

  const statusBadge = (s) => ({ Ativo: 'badge-green', Férias: 'badge-yellow', Afastado: 'badge-red', Inativo: 'badge-red', 'Em Experiência': 'badge-blue' }[s] || 'badge-blue')

  const calculateAlerts = () => {
    const alerts = []
    const today = new Date()
    colabs.forEach(c => {
      if (c.status === 'Inativo' || !c.nome) return
      
      if (c.vencimentoFerias) {
        const diff = Math.ceil((new Date(c.vencimentoFerias) - today) / (1000 * 60 * 60 * 24))
        if (diff <= 30 && diff >= 0) alerts.push({ id: c.id+'-ferias', text: `Férias de ${c.nome} vencem em ${diff} dias`, type: diff <= 15 ? 'red' : 'yellow' })
        else if (diff < 0) alerts.push({ id: c.id+'-ferias', text: `Férias de ${c.nome} estão vencidas há ${Math.abs(diff)} dias!`, type: 'red' })
      }
      
      if (c.vencimentoASO) {
        const diff = Math.ceil((new Date(c.vencimentoASO) - today) / (1000 * 60 * 60 * 24))
        if (diff <= 30 && diff >= 0) alerts.push({ id: c.id+'-aso', text: `Exame ASO de ${c.nome} vence em ${diff} dias`, type: diff <= 15 ? 'red' : 'yellow' })
        else if (diff < 0) alerts.push({ id: c.id+'-aso', text: `Exame ASO de ${c.nome} vencido há ${Math.abs(diff)} dias!`, type: 'red' })
      }
      
      if (c.vencimentoExperiencia && c.status === 'Em Experiência') {
        const diff = Math.ceil((new Date(c.vencimentoExperiencia) - today) / (1000 * 60 * 60 * 24))
        if (diff <= 10 && diff >= 0) alerts.push({ id: c.id+'-exp', text: `Experiência de ${c.nome} vence em ${diff} dias`, type: diff <= 5 ? 'red' : 'yellow' })
        else if (diff < 0) alerts.push({ id: c.id+'-exp', text: `Experiência de ${c.nome} venceu há ${Math.abs(diff)} dias!`, type: 'red' })
      }
    })
    return alerts
  }

  const getBirthdays = () => {
    const bdays = []
    const today = new Date()
    const currentMonth = today.getMonth() + 1
    const currentDay = today.getDate()
    
    colabs.forEach(c => {
      if (c.status === 'Inativo' || !c.nome || !c.nascimento) return
      
      const [year, month, day] = c.nascimento.split('-')
      if (parseInt(month) === currentMonth) {
        const diff = parseInt(day) - currentDay
        if (diff >= 0 && diff <= 15) {
          bdays.push({ id: c.id, nome: c.nome, dias: diff, date: `${day}/${month}` })
        }
      }
    })
    return bdays.sort((a,b) => a.dias - b.dias)
  }

  const alerts = calculateAlerts()
  const birthdays = getBirthdays()

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-cream-200 mb-4 shadow-sm">
        <p className="text-sm font-bold text-gray-600">{colabs.length} colaboradores ativos</p>
        <div className="flex gap-3">
          <button onClick={() => window.open('/ponto', '_blank')} className="btn-secondary flex items-center gap-2 border-brand-500 text-brand-600 hover:bg-brand-50">
            <Clock size={16} /> Relógio de Ponto (Totem)
          </button>
          <button onClick={() => setModal('new')} className="btn-primary"><Plus size={16} />Novo Colaborador</button>
        </div>
      </div>

      {birthdays.length > 0 && (
        <div className="card border-l-4 border-l-pink-500 bg-pink-50/50">
          <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse"></span>
            Mural de Aniversariantes
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {birthdays.map(b => (
              <div key={`bday-${b.id}`} className="p-3 rounded-lg border bg-pink-50 border-pink-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-pink-700 text-sm">🎉 {b.nome}</div>
                  <div className="text-xs text-pink-600/80">{b.dias === 0 ? 'É HOJE!' : `Faltam ${b.dias} dias (${b.date})`}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {alerts.length > 0 && (
        <div className="card border-l-4 border-l-brand-500 bg-brand-50/50">
          <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse"></span>
            Semáforo de Vencimentos (RH Inteligente)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {alerts.map(a => (
              <div key={a.id} className={`p-3 rounded-lg border flex items-center gap-3 text-sm font-medium ${
                a.type === 'red' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-yellow-50 border-yellow-200 text-yellow-700'
              }`}>
                <span className={`w-3 h-3 rounded-full ${a.type === 'red' ? 'bg-red-500' : 'bg-yellow-500'}`}></span>
                {a.text}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input className="input pl-9" placeholder="Buscar colaborador..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      {colabs.length === 0 && <div className="card text-center py-10 text-gray-400 text-sm">Nenhum colaborador cadastrado ainda.</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(c => (
          <div key={c.id} className="card hover:border-brand-700/50 transition-all group">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 bg-emerald-700/20 rounded-xl flex items-center justify-center border border-emerald-700/30">
                <span className="text-emerald-400 font-bold">{c.nome[0]}</span>
              </div>
              <span className={statusBadge(c.status)}>{c.status}</span>
            </div>
            <p className="font-bold text-gray-800">{c.nome}</p>
            <p className="text-sm text-brand-500 font-medium">{c.cargo}</p>
            <p className="text-xs text-gray-500 mb-3">{c.dept}</p>
            <div className="pt-3 border-t border-cream-300 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Salário</p>
                <p className="text-sm font-bold text-emerald-600">{c.salario}</p>
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                
                <button 
                  onClick={() => setOnboardingModal(c)} 
                  title="Checklist de Onboarding"
                  className="p-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-600 transition-all">
                  <CheckSquare size={12} />
                </button>
                <button 
                  onClick={() => setPontoModal(c)} 
                  title="Ver Folha de Ponto"
                  className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-all">
                  <Clock size={12} />
                </button>

                <input 
                  type="file" 
                  accept=".pdf" 
                  className="hidden" 
                  ref={el => fileInputRef.current[c.id] = el}
                  onChange={e => handleUploadHolerite(e, c)}
                />
                <button 
                  onClick={() => fileInputRef.current[c.id]?.click()} 
                  title="Enviar Holerite via WhatsApp"
                  className="p-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 transition-all relative">
                  {uploading === c.id ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                </button>

                <button onClick={() => setModal(c)} className="p-1.5 rounded-lg bg-cream-200 hover:bg-brand-100 text-gray-400 hover:text-brand-700 transition-all"><Edit2 size={12} /></button>
                <button onClick={() => deleteItem(c.id)} className="p-1.5 rounded-lg bg-cream-200 hover:bg-red-100 text-gray-400 hover:text-red-500 transition-all"><Trash2 size={12} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {modal && <ColabModal data={modal === 'new' ? null : modal} condominios={condominios} onClose={() => setModal(null)} onSave={handleSave} />}
      {pontoModal && <PontoModal data={pontoModal} onClose={() => setPontoModal(null)} />}
      {onboardingModal && <OnboardingModal data={onboardingModal} onClose={() => setOnboardingModal(null)} updateItem={updateItem} />}
    </div>
  )
}
