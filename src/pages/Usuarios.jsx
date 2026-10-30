import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Plus, Shield, Edit2, Trash2, Eye, EyeOff, KeyRound, Building, Layers, DoorOpen, Phone, Search, CheckSquare, ShieldAlert, CheckCircle2, Clock, Mail } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { collection, addDoc, serverTimestamp, query, where, getDocs, deleteDoc } from 'firebase/firestore'
import { db, secondaryAuth } from '../firebase'
import { enviarEmail } from '../emailjs.config'
import { createUserWithEmailAndPassword, signOut, sendPasswordResetEmail, sendEmailVerification } from 'firebase/auth'
import { dispararAlarmeSeguranca } from '../utils/alarmeService'
import { useAuth } from '../context/AuthContext'

const MORADOR_ROLES = ['Morador', 'Síndico', 'Subsíndico', 'Conselheiro']

const roles = ['Administrador', 'Síndico', 'Subsíndico', 'Morador', 'Porteiro', 'Financeiro', 'Portaria Remota', 'Conselheiro']

const roleColors = {
  Administrador: 'badge-red',
  Síndico: 'badge-purple',
  Subsíndico: 'badge-blue',
  Conselheiro: 'badge-purple',
  Morador: 'badge-green',
  Porteiro: 'badge-yellow',
  Financeiro: 'badge-blue',
  'Portaria Remota': 'badge-yellow'
}

const allModules = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'condominios', label: 'Condomínios' },
  { id: 'moradores', label: 'Moradores' },
  { id: 'rh', label: 'Recursos Humanos' },
  { id: 'prestadores', label: 'Prestadores' },
  { id: 'usuarios', label: 'Usuários' },
  { id: 'financeiro', label: 'Receitas & Despesas' },
  { id: 'boletos', label: 'Boletos & Fundo' },
  { id: 'notas-fiscais', label: 'Notas Fiscais' },
  { id: 'assembleias', label: 'Assembleias & Atas' },
  { id: 'reservas', label: 'Reservas' },
  { id: 'eventos', label: 'Eventos & Check-in' },
  { id: 'portaria', label: 'Portaria & Manutenção' },
  { id: 'veiculos', label: 'Veículos & Garagem' },
  { id: 'cameras', label: 'Câmeras' },
  { id: 'seguro', label: 'Seguro' },
  { id: 'regime', label: 'Regime Interno/Externo' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'comunicacao', label: 'Comunicação' },
  { id: 'tarefas', label: 'Tarefas & Agenda' },
  { id: 'calculadora', label: 'Calculadora (Comercial)' },
  { id: 'propostas', label: 'Gerar Propostas' },
  { id: 'seguranca', label: 'Segurança & Backups' }
]

const getDefaultPerms = (r) => {
  if (r === 'Administrador') {
    return allModules.map(m => m.id)
  }
  if (r === 'Síndico' || r === 'Subsíndico') {
    return ['dashboard', 'moradores', 'pets', 'prestadores', 'usuarios', 'financeiro', 'boletos', 'notas-fiscais', 'assembleias', 'reservas', 'eventos', 'portaria', 'veiculos', 'cameras', 'seguro', 'regime', 'documentos', 'comunicacao', 'calculadora', 'cotacoes', 'relatorios']
  }
  if (r === 'Morador') {
    return ['dashboard', 'boletos', 'notas-fiscais', 'assembleias', 'reservas', 'veiculos', 'cameras', 'regime', 'documentos', 'comunicacao']
  }
  if (r === 'Porteiro') {
    return ['dashboard', 'moradores', 'portaria', 'veiculos', 'comunicacao', 'reservas', 'eventos', 'cameras']
  }
  if (r === 'Financeiro') {
    return ['dashboard', 'condominios', 'prestadores', 'financeiro', 'boletos', 'notas-fiscais', 'documentos', 'calculadora']
  }
  if (r === 'Conselheiro') {
    return ['dashboard', 'financeiro', 'boletos', 'notas-fiscais', 'documentos', 'regime', 'seguro', 'assembleias', 'cotacoes', 'relatorios']
  }
  if (r === 'Portaria Remota') {
    return ['dashboard', 'portaria', 'veiculos', 'cameras', 'reservas']
  }
  return ['dashboard', 'boletos', 'documentos']
}

function Modal({ data, onClose, onSave, condominios = [], currentUser }) {
  const needsLocation = ['Morador', 'Síndico', 'Subsíndico', 'Conselheiro', 'Porteiro', 'Portaria Remota']
  const isAdm = currentUser?.role === 'Administrador'
  const meuCondo = currentUser?.condominio || ''

  // Se não for admin, os papéis disponíveis são restritos ao condomínio
  const availableRoles = isAdm 
    ? roles 
    : roles.filter(r => r !== 'Administrador')

  const [enviarEmailCriacao, setEnviarEmailCriacao] = useState(true)

  const [form, setForm] = useState(() => (
    data ? { 
      ...data, 
      statusMorador: data.statusMorador || 'Proprietário' 
    } : { 
      nome: '', 
      email: '', 
      senha: '', 
      telefone: '', 
      condominio: !isAdm ? meuCondo : '', 
      bloco: '', 
      unidade: '', 
      role: 'Morador', 
      statusMorador: 'Proprietário', 
      status: 'Ativo', 
      permissoes: getDefaultPerms('Morador') 
    }
  ))

  React.useEffect(() => {
    if (data) {
      setForm({
        ...data,
        nome: data.nome || '',
        email: data.email || '',
        telefone: data.telefone || data.tel || '',
        condominio: !isAdm ? meuCondo : (data.condominio || ''),
        bloco: data.bloco || '',
        unidade: data.unidade || data.apt || '',
        role: data.role || 'Morador',
        statusMorador: data.statusMorador || data.status || 'Proprietário',
        status: data.status || 'Ativo',
        permissoes: data.permissoes || getDefaultPerms(data.role || 'Morador')
      })
    } else {
      setForm({
        nome: '', 
        email: '', 
        senha: '', 
        telefone: '', 
        condominio: !isAdm ? meuCondo : '', 
        bloco: '', 
        unidade: '', 
        role: 'Morador', 
        statusMorador: 'Proprietário', 
        status: 'Ativo', 
        permissoes: getDefaultPerms('Morador')
      })
    }
  }, [data, isAdm, meuCondo])

  const requiresLocation = needsLocation.includes(form.role)
  const [showSenha, setShowSenha] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const isEdit = !!data

  const handleRoleChange = (e) => {
    const newRole = e.target.value
    setForm(f => ({ ...f, role: newRole, permissoes: getDefaultPerms(newRole) }))
  }

  const togglePermission = (moduleId) => {
    setForm(f => {
      const perms = f.permissoes || []
      if (perms.includes(moduleId)) return { ...f, permissoes: perms.filter(p => p !== moduleId) }
      else return { ...f, permissoes: [...perms, moduleId] }
    })
  }

  const selectAllPerms = () => {
    setForm(f => ({ ...f, permissoes: allModules.map(m => m.id) }))
  }

  const clearAllPerms = () => {
    setForm(f => ({ ...f, permissoes: [] }))
  }

  return (
    <div className="modal-overlay z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white max-w-3xl w-full rounded-3xl shadow-2xl border border-gray-200 flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-5 sm:p-6 border-b border-cream-300 flex items-center justify-between bg-gradient-to-r from-cream-100 to-white shrink-0">
          <div>
            <h3 className="font-black text-gray-900 text-lg">{isEdit ? 'Editar Usuário' : 'Novo Usuário'}</h3>
            <p className="text-xs text-gray-500">Preencha os dados de acesso e configure as permissões</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors cursor-pointer text-xl font-bold">✕</button>
        </div>

        <form onSubmit={e => e.preventDefault()} autoComplete="off" className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto flex-1">
          <div className="flex flex-col gap-4">
            <h4 className="font-bold text-sm text-brand-700 mb-1 border-b border-cream-300 pb-2 flex items-center gap-1.5">
              <Users size={16} /> Dados Cadastrais
            </h4>
            
            <div>
              <label className="label">Nome Completo *</label>
              <input 
                name="new_user_fullname_field"
                autoComplete="off"
                className="input uppercase" 
                value={form.nome} 
                onChange={e => set('nome', e.target.value.toUpperCase())} 
                placeholder="NOME DO USUÁRIO" 
              />
            </div>

            <div>
              <label className="label">E-mail (usado para login) *</label>
              <input 
                type="email" 
                name="new_user_email_field_custom"
                autoComplete="new-password"
                className="input" 
                value={form.email} 
                onChange={e => set('email', e.target.value.toLowerCase().trim())} 
                placeholder="usuario@email.com" 
              />
            </div>

            {!isEdit ? (
              <div className="flex flex-col gap-2">
                <label className="flex items-start gap-2.5 cursor-pointer bg-brand-50/80 hover:bg-brand-50 border border-brand-200 p-3 rounded-2xl text-xs font-bold text-brand-900 shadow-2xs transition-colors">
                  <input
                    type="checkbox"
                    checked={enviarEmailCriacao}
                    onChange={e => setEnviarEmailCriacao(e.target.checked)}
                    className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4 mt-0.5"
                  />
                  <div>
                    <span className="flex items-center gap-1.5"><Mail size={13} className="text-brand-600" /> Enviar e-mail de ativação e confirmação (Recomendado)</span>
                    <p className="text-[11px] font-normal text-brand-700 mt-0.5">
                      O morador recebe um link oficial do Google para criar a própria senha e validar seu e-mail no primeiro acesso.
                    </p>
                  </div>
                </label>

                {!enviarEmailCriacao && (
                  <div>
                    <label className="label">Senha Inicial *</label>
                    <div className="relative">
                      <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type={showSenha ? 'text' : 'password'}
                        name="new_user_password_field_custom"
                        autoComplete="new-password"
                        className="input pl-9 pr-10"
                        value={form.senha}
                        onChange={e => set('senha', e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSenha(s => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand-600 transition-colors"
                      >
                        {showSenha ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="label">Redefinir Senha</label>
                <div className="p-3 bg-cream-50 border border-cream-300 rounded-xl flex items-center justify-between">
                  <span className="text-xs text-gray-500 font-medium truncate mr-2">Senha criptografada</span>
                  <button 
                    type="button" 
                    onClick={async () => {
                      if(window.confirm('Enviar e-mail de redefinição de senha para ' + form.email + '?')) {
                        try {
                          await sendPasswordResetEmail(secondaryAuth, form.email)
                          alert('E-mail de redefinição enviado com sucesso para ' + form.email + '!')
                        } catch(err) {
                          alert('Erro ao enviar e-mail: ' + err.message)
                        }
                      }
                    }}
                    className="text-xs font-bold text-brand-600 hover:text-brand-700 bg-white border border-brand-200 px-3 py-1.5 rounded-lg shadow-sm transition-all whitespace-nowrap shrink-0">
                    Enviar Link
                  </button>
                </div>
              </div>
            )}

            <div className={`grid ${form.role === 'Morador' ? 'grid-cols-3' : 'grid-cols-2'} gap-4`}>
              <div>
                <label className="label">Perfil Base *</label>
                <select className="input font-semibold text-brand-900" value={form.role} onChange={handleRoleChange}>
                  {availableRoles.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              {form.role === 'Morador' && (
                <div>
                  <label className="label">Tipo de Vínculo</label>
                  <select 
                    className="input font-semibold text-brand-900" 
                    value={form.statusMorador || 'Proprietário'} 
                    onChange={e => set('statusMorador', e.target.value)}
                  >
                    <option value="Proprietário">Proprietário</option>
                    <option value="Inquilino">Inquilino</option>
                    <option value="Dependente">Dependente</option>
                  </select>
                </div>
              )}
              <div>
                <label className="label">Status</label>
                <select className="input font-semibold" value={form.status} onChange={e => set('status', e.target.value)}>
                  <option value="Ativo">Ativo</option>
                  <option value="Inativo">Inativo</option>
                </select>
              </div>
            </div>

            <div>
              <label className="label">Telefone / WhatsApp</label>
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="tel"
                  name="new_user_phone_field"
                  autoComplete="off"
                  className="input pl-9" 
                  value={form.telefone || ''} 
                  onChange={e => set('telefone', e.target.value)} 
                  placeholder="(00) 00000-0000" 
                />
              </div>
            </div>

            {requiresLocation && (
              <div className="flex flex-col gap-3 p-3 bg-cream-50 border border-cream-300 rounded-xl">
                <p className="text-xs font-bold text-brand-700 flex items-center gap-1"><Building size={12} /> Condomínio / Unidade</p>
                <div>
                  <label className="label">Nome do Condomínio *</label>
                  <div className="relative">
                    <Building size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    {isAdm ? (
                      <>
                        <input 
                          list="usuarios-condos-list"
                          className="input pl-9 uppercase" 
                          value={form.condominio || ''} 
                          onChange={e => set('condominio', e.target.value.toUpperCase())} 
                          placeholder="SELECIONE OU DIGITE O CONDOMÍNIO..." 
                        />
                        <datalist id="usuarios-condos-list">
                          {condominios.map(c => (
                            <option key={c.id || c.nome} value={c.nome} />
                          ))}
                        </datalist>
                      </>
                    ) : (
                      <input 
                        className="input pl-9 uppercase bg-gray-100 font-bold text-gray-800" 
                        value={meuCondo} 
                        readOnly 
                        disabled
                      />
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Bloco / Torre</label>
                    <div className="relative">
                      <Layers size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input className="input pl-9 uppercase" value={form.bloco || ''} onChange={e => set('bloco', e.target.value.toUpperCase())} placeholder="Ex: A, B, 1" />
                    </div>
                  </div>
                  <div>
                    <label className="label">Unidade / Apto *</label>
                    <div className="relative">
                      <DoorOpen size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input className="input pl-9 uppercase" value={form.unidade || ''} onChange={e => set('unidade', e.target.value.toUpperCase())} placeholder="Ex: 106, 101-A" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-cream-300 pb-2">
              <h4 className="font-bold text-sm text-brand-700 flex items-center gap-1.5">
                <Shield size={16} /> Permissões de Acesso ({form.permissoes?.length || 0})
              </h4>
              <div className="flex items-center gap-2">
                <button type="button" onClick={selectAllPerms} className="text-[11px] text-brand-600 hover:underline font-bold">Marcar todos</button>
                <span className="text-gray-300">•</span>
                <button type="button" onClick={clearAllPerms} className="text-[11px] text-gray-400 hover:text-red-500 font-bold">Limpar</button>
              </div>
            </div>

            <p className="text-[11px] text-gray-500 mb-1">
              Ao escolher o perfil <b>{form.role}</b>, os módulos abaixo foram pré-configurados. Você pode personalizar marcando ou desmarcando conforme a necessidade.
            </p>

            <div className="grid grid-cols-2 gap-2">
              {allModules.map(m => {
                const checked = (form.permissoes || []).includes(m.id)
                return (
                  <label
                    key={m.id}
                    onClick={() => togglePermission(m.id)}
                    className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-medium cursor-pointer transition-all select-none ${
                      checked
                        ? 'bg-brand-50/80 border-brand-300 text-brand-900 shadow-sm font-bold'
                        : 'bg-white border-cream-300 text-gray-500 hover:border-gray-400'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {}}
                      className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 w-3.5 h-3.5"
                    />
                    <span className="truncate">{m.label}</span>
                  </label>
                )
              })}
            </div>
          </div>
        </form>

        {/* Rodapé fixo - Sempre visível */}
        <div className="p-4 sm:p-5 border-t border-gray-200 flex gap-3 justify-end bg-gray-50 shrink-0">
          <button onClick={onClose} className="btn-secondary px-5 py-2 text-xs font-bold">Cancelar</button>
          <button
            onClick={() => {
              if (!form.nome || !form.email) {
                alert('Preencha os campos obrigatórios (Nome e E-mail).')
                return
              }
              if (!isEdit && !enviarEmailCriacao && (!form.senha || form.senha.length < 6)) {
                alert('A senha inicial deve ter no mínimo 6 caracteres.')
                return
              }
              onSave({ ...form, enviarEmailCriacao })
            }}
            className="btn-primary bg-brand-600 hover:bg-brand-500 text-white font-black text-xs py-2.5 px-6 rounded-xl shadow-md cursor-pointer"
          >
            💾 Salvar Usuário
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Usuarios() {
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const { items: usersRaw, addItem, updateItem, deleteItem } = useFirestore('usuarios')
  const { items: moradoresRaw = [] } = useFirestore('moradores')
  const { items: allCondominios } = useFirestore('condominios')
  const [modal, setModal] = useState(null)

  const isAdm = currentUser?.role === 'Administrador'
  const meuCondominio = currentUser?.condominio || ''

  // Para síndico, subsíndico, conselheiro, etc., o filtro de condomínio é restrito ao condomínio dele
  const [condoFilter, setCondoFilter] = useState(() => {
    if (!isAdm && meuCondominio) return meuCondominio
    return 'Todos'
  })

  React.useEffect(() => {
    if (!isAdm && meuCondominio && condoFilter !== meuCondominio) {
      setCondoFilter(meuCondominio)
    }
  }, [isAdm, meuCondominio])

  const [roleFilter, setRoleFilter] = useState('Todos')
  const [search, setSearch] = useState('')

  // Unifica moradores cadastrados com usuários para que todos apareçam na listagem de usuários e permissões
  const defaultMoradorPerms = [
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

  const users = React.useMemo(() => {
    const lista = [...usersRaw]
    const idsExistentes = new Set(lista.map(u => u.id).filter(Boolean))
    const emailsExistentes = new Set(lista.map(u => (u.email || '').toLowerCase().trim()).filter(Boolean))
    const phonesExistentes = new Set(lista.map(u => String(u.telefone || u.tel || '').replace(/\D/g, '')).filter(Boolean))
    const cpfsExistentes = new Set(lista.map(u => String(u.cpf || '').replace(/\D/g, '')).filter(Boolean))

    moradoresRaw.forEach(m => {
      const mId = m.id
      const mEmail = (m.email || '').toLowerCase().trim()
      const mTel = String(m.tel || m.telefone || '').replace(/\D/g, '')
      const mCpf = String(m.cpf || '').replace(/\D/g, '')

      const jaExiste = (m.idOriginalUsuario && idsExistentes.has(m.idOriginalUsuario)) ||
                       (mId && idsExistentes.has(mId)) ||
                       (mEmail && emailsExistentes.has(mEmail)) ||
                       (mCpf && cpfsExistentes.has(mCpf)) ||
                       (mTel && phonesExistentes.has(mTel) && mEmail && emailsExistentes.has(mEmail))

      if (!jaExiste) {
        lista.push({
          id: m.idOriginalUsuario || `morador_${m.id}`,
          moradorDocId: m.id,
          nome: m.nome || 'Morador',
          email: m.email || (m.cpf ? `${m.cpf.replace(/\D/g, '')}@alpha.local` : `morador_${m.id || m.apt || '1'}@alpha.local`),
          telefone: m.tel || m.telefone || '',
          tel: m.tel || m.telefone || '',
          condominio: m.condominio || '',
          bloco: m.bloco || '',
          unidade: m.apt || m.unidade || '',
          apt: m.apt || m.unidade || '',
          role: 'Morador',
          status: 'Ativo',
          ativo: true,
          statusMorador: m.statusMorador || m.status || 'Proprietário',
          permissoes: m.permissoes || defaultMoradorPerms,
          origem: 'morador-vinculado',
          _createdAt: m._createdAt || m.createdAt || new Date().toISOString()
        })
      }
    })

    return lista
  }, [usersRaw, moradoresRaw])

  const normalizeStr = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()

  const isPendente = u => u.ativo === false || u.status === 'Pendente' || u.status === 'Inativo' || u.pendenteAprovacao === true
  const pendingUsers = users.filter(u => {
    if (!isPendente(u)) return false
    if (!isAdm) {
      if (u.role === 'Administrador') return false
      if (meuCondominio) {
        const cU = normalizeStr(u.condominio)
        const cTarget = normalizeStr(meuCondominio)
        if (!cU || (cU !== cTarget && !cU.includes(cTarget) && !cTarget.includes(cU))) return false
      }
    }
    return true
  })

  const handleAprovarUsuario = async (u) => {
    if (!window.confirm(`Deseja APROVAR e liberar o acesso do usuário "${u.nome || u.email}" com perfil de "${u.role}"?`)) return
    try {
      await updateItem(u.id, {
        ...u,
        ativo: true,
        status: 'Ativo',
        pendenteAprovacao: false,
        aprovadoPor: currentUser?.nome || currentUser?.email || 'Administração',
        aprovadoEm: new Date().toISOString()
      })

      // Envia e-mail notificando o usuário que sua conta foi liberada
      if (u.email) {
        await enviarEmail(
          u.email,
          u.nome || 'Usuário',
          'Seu acesso foi APROVADO - Alpha Gestão Condominial',
          `Olá <b>${u.nome || 'Usuário'}</b>,<br><br>Seu cadastro com perfil de <b>${u.role}</b> foi analisado e <b>APROVADO</b> pela administração da Alpha ADM.<br><br>Seu acesso ao sistema já está liberado! Você já pode fazer login normalmente utilizando seu e-mail e senha cadastrados.<br><br><a href="https://alphaadmsc.vercel.app" style="display:inline-block;padding:10px 20px;background:#16a34a;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;margin-top:10px;">Acessar o Painel</a>`
        ).catch(() => {})
      }

      alert(`✅ Acesso de "${u.nome || u.email}" aprovado e liberado com sucesso!`)
    } catch (err) {
      console.error('Erro ao aprovar usuário:', err)
      alert('Erro ao ativar usuário: ' + err.message)
    }
  }

  const handleReenviarEmailAtivacao = async (u) => {
    if (!u.email) return
    if (!window.confirm(`Deseja reenviar o e-mail oficial com o link de confirmação e criação de senha para "${u.nome || u.email}"?`)) return
    try {
      await sendPasswordResetEmail(secondaryAuth, u.email.toLowerCase().trim(), {
        url: window.location.origin ? `${window.location.origin}/login` : 'https://app.alphaadmsc.com.br/login',
        handleCodeInApp: false
      })
      alert(`✅ E-mail de confirmação e ativação reenviado com sucesso para ${u.email}!`)
    } catch (err) {
      alert('Erro ao reenviar e-mail: ' + err.message)
    }
  }

  // Padronização automática: Administradores pertencem à gestão interna 'ALPHA' (sem bloco/apto)
  React.useEffect(() => {
    if (!users.length) return
    users.forEach(async u => {
      if (u.role === 'Administrador') {
        const precisaAjuste = u.condominio !== 'ALPHA' || u.bloco || u.unidade
        if (precisaAjuste) {
          try {
            await updateItem(u.id, {
              ...u,
              condominio: 'ALPHA',
              bloco: '',
              unidade: ''
            })
          } catch (e) {
            console.warn('Ajustando admin:', e)
          }
        }
      }
    })
  }, [users])

  const handleSave = async (form) => {
    const isAdm = form.role === 'Administrador'
    const nomeNorm = (form.nome || '').toUpperCase().trim()
    const condoNorm = isAdm ? 'ALPHA' : (form.condominio || '').toUpperCase().trim()
    const blocoNorm = isAdm ? '' : (form.bloco || '').toUpperCase().trim()
    const unidadeNorm = isAdm ? '' : (form.unidade || '').toUpperCase().trim()
    const emailClean = (form.email || '').toLowerCase().trim()

    if (modal === 'new') {
      const isEmailInvite = form.enviarEmailCriacao !== false || !form.senha
      const finalSenha = form.senha || (Math.random().toString(36).slice(-8) + 'Aa1!')
      let userCred = null

      try {
        userCred = await createUserWithEmailAndPassword(secondaryAuth, emailClean, finalSenha)
        if (isEmailInvite) {
          try {
            await sendPasswordResetEmail(secondaryAuth, emailClean, {
              url: window.location.origin ? `${window.location.origin}/login` : 'https://app.alphaadmsc.com.br/login',
              handleCodeInApp: false
            })
          } catch (pErr) {
            console.warn('Aviso ao enviar link de criacao de senha:', pErr)
          }
        }
        try {
          if (userCred?.user) {
            await sendEmailVerification(userCred.user, {
              url: window.location.origin ? `${window.location.origin}/login` : 'https://app.alphaadmsc.com.br/login',
              handleCodeInApp: false
            })
          }
        } catch (vErr) {
          console.warn('Aviso ao enviar confirmacao de email:', vErr)
        }
        await signOut(secondaryAuth)
      } catch (err) {
        if (err.code !== 'auth/email-already-in-use') {
          alert('Erro ao criar acesso (Auth): ' + err.message)
          return
        }
        // Se já existe no Auth, dispara link oficial do Google para redefinição/confirmação
        if (isEmailInvite) {
          await sendPasswordResetEmail(secondaryAuth, emailClean, {
            url: window.location.origin ? `${window.location.origin}/login` : 'https://app.alphaadmsc.com.br/login',
            handleCodeInApp: false
          }).catch(() => {})
        }
      }

      const { senha: _discardSenha, enviarEmailCriacao: _discardInvite, ...formSemSenha } = form

      const novo = {
        ...formSemSenha,
        nome: nomeNorm,
        condominio: condoNorm,
        bloco: blocoNorm,
        unidade: unidadeNorm,
        email: emailClean,
        ativo: form.status === 'Ativo',
        emailVerificado: false,
        pendenteAtivacaoEmail: isEmailInvite,
        _createdAt: new Date().toISOString()
      }
      await addItem(novo)

      // ALARME: Criação de qualquer usuário Administrador
      if (isAdm) {
        dispararAlarmeSeguranca({
          tipo: 'CRIACAO_ADMIN',
          titulo: 'Novo Usuário Administrador Criado',
          detalhes: `Um novo perfil com privilégios de Administrador foi criado no sistema para "${nomeNorm}" (${emailClean}).`,
          userEmail: emailClean,
          metadata: { nome: nomeNorm, perfil: 'Administrador' }
        }).catch(() => {})
      }

      // Se o perfil é do tipo morador, também inserir na coleção moradores
      if (MORADOR_ROLES.includes(form.role)) {
        await addDoc(collection(db, 'moradores'), {
          nome: nomeNorm,
          email: emailClean,
          tel: form.telefone || '',
          condominio: condoNorm,
          bloco: (form.bloco || '').toUpperCase().trim(),
          apt: (form.unidade || '').toUpperCase().trim(),
          cpf: form.cpf || '',
          status: form.role === 'Morador' ? 'Proprietário' : form.role,
          origem: 'admin',
          _createdAt: serverTimestamp()
        })
      }

      if (isEmailInvite) {
        alert(`✅ Usuário criado com sucesso!\n\nEnviamos um e-mail oficial para ${emailClean} com o link de ativação, confirmação e definição de senha.`)
      } else {
        // Dispara o e-mail de boas-vindas com a senha definida manualmente
        await enviarEmail(
          emailClean,
          nomeNorm,
          'Sua conta foi criada no Alpha Gestão Condominial',
          `Olá ${nomeNorm},<br><br>Seu acesso ao sistema foi criado com sucesso.<br><br><b>Login:</b> ${emailClean}<br><b>Senha provisória:</b> ${form.senha}<br><br>Acesse o painel para validar seus dados e alterar sua senha.`
        ).catch(() => {})
      }
    } else {
      const viraAdmin = form.role === 'Administrador' && modal.role !== 'Administrador'
      
      const { senha: _discardSenha2, ...formSemSenhaAtualizar } = form
      
      const updated = {
        ...formSemSenhaAtualizar,
        nome: nomeNorm,
        condominio: condoNorm,
        bloco: blocoNorm,
        unidade: unidadeNorm,
        email: emailClean,
        ativo: form.status === 'Ativo',
      }
      if (String(modal.id).startsWith('morador_')) {
        const docIdMorador = modal.moradorDocId || String(modal.id).replace('morador_', '')
        await updateDoc(doc(db, 'moradores', docIdMorador), {
          nome: nomeNorm,
          condominio: condoNorm,
          bloco: blocoNorm,
          apt: unidadeNorm,
          email: emailClean,
          tel: form.telefone || '',
          status: form.statusMorador || 'Proprietário',
          statusMorador: form.statusMorador || 'Proprietário'
        }).catch(() => {})
        await addItem(updated)
      } else {
        await updateItem(modal.id, updated)
        // Se for morador, sincroniza também na coleção de moradores
        if (form.role === 'Morador' && (emailClean || (condoNorm && unidadeNorm))) {
          try {
            const mSnap = await getDocs(collection(db, 'moradores'))
            const mDoc = mSnap.docs.find(d => {
              const dt = d.data()
              const matchEmail = emailClean && dt.email && dt.email.toLowerCase().trim() === emailClean
              const matchApt = condoNorm && unidadeNorm && (dt.condominio || '').trim().toUpperCase() === condoNorm && String(dt.apt || dt.unidade || '').trim() === unidadeNorm
              return matchEmail || matchApt
            })
            if (mDoc) {
              await updateDoc(mDoc.ref, {
                nome: nomeNorm,
                condominio: condoNorm,
                bloco: blocoNorm,
                apt: unidadeNorm,
                status: form.statusMorador || 'Proprietário',
                statusMorador: form.statusMorador || 'Proprietário'
              })
            }
          } catch (e) {
            console.warn('Erro ao sincronizar com moradores:', e)
          }
        }
      }

      // ALARME: Usuário comum virou Administrador
      if (viraAdmin) {
        dispararAlarmeSeguranca({
          tipo: 'ELEVACAO_ADMIN',
          titulo: 'Privilégio de Administrador Concedido a Usuário',
          detalhes: `O usuário "${nomeNorm}" (${emailClean}), anteriormente com perfil "${modal.role}", foi promovido a Administrador do sistema.`,
          userEmail: emailClean,
          metadata: { nome: nomeNorm, perfilAnterior: modal.role, novoPerfil: 'Administrador' }
        }).catch(() => {})
      }
    }
    setModal(null)
  }

  const handleDelete = async (u) => {
    if (!window.confirm(`Deseja realmente excluir o usuário "${u.nome || ''}"?`)) return
    try {
      if (u.moradorDocId) {
        await deleteDoc(doc(db, 'moradores', u.moradorDocId)).catch(() => {})
      }
      if (!String(u.id).startsWith('morador_')) {
        await deleteItem(u.id).catch(() => {})
      }
      // Se for perfil de morador ou tiver e-mail, limpa também em moradores
      if (u.email) {
        const qM = query(collection(db, 'moradores'), where('email', '==', u.email.toLowerCase().trim()))
        const sM = await getDocs(qM)
        sM.forEach(async d => await deleteDoc(d.ref))
      }
    } catch (err) {
      console.warn('Aviso ao sincronizar exclusão com moradores:', err)
    }
  }

  // Filtragem de usuários
  const filteredUsers = users.filter(u => {
    // Se o usuário logado não for Administrador, só pode ver usuários do seu próprio condomínio e NUNCA Administradores
    if (!isAdm) {
      if (u.role === 'Administrador') return false
      if (meuCondominio) {
        const cU = normalizeStr(u.condominio)
        const cTarget = normalizeStr(meuCondominio)
        if (!cU || (cU !== cTarget && !cU.includes(cTarget) && !cTarget.includes(cU))) return false
      }
    }

    // Filtro de Pendentes ou Perfil
    if (roleFilter === 'Pendentes') {
      if (!isPendente(u)) return false
    } else if (roleFilter !== 'Todos' && u.role !== roleFilter) {
      return false
    }

    // Filtro de Condomínio (apenas para Admin, que pode alternar condomínios)
    if (isAdm && condoFilter !== 'Todos') {
      const cU = normalizeStr(u.condominio)
      const cTarget = normalizeStr(condoFilter)
      if (condoFilter === 'Sem Condomínio') {
        if (u.condominio) return false
      } else {
        if (!cU || (cU !== cTarget && !cU.includes(cTarget) && !cTarget.includes(cU))) return false
      }
    }

    // Busca textual
    if (search.trim()) {
      const s = search.toLowerCase().trim()
      const matchNome = (u.nome || '').toLowerCase().includes(s)
      const matchEmail = (u.email || '').toLowerCase().includes(s)
      const matchCondo = (u.condominio || '').toLowerCase().includes(s)
      const matchApt = (u.unidade || u.apt || '').toLowerCase().includes(s)
      const matchTel = (u.telefone || '').includes(s)
      if (!matchNome && !matchEmail && !matchCondo && !matchApt && !matchTel) return false
    }

    return true
  })

  // Lista única de condomínios presentes em usuários (residentes) e na coleção condominios
  const uniqueCondoOptions = Array.from(new Set([
    ...allCondominios.map(c => c.nome).filter(Boolean),
    ...users.filter(u => u.role !== 'Administrador').map(u => u.condominio).filter(Boolean)
  ])).sort()

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="section-title text-xl flex items-center gap-2">
            <Users className="text-brand-600" size={24} /> Usuários & Acessos
          </h2>
          <p className="section-sub">
            {filteredUsers.length} de {users.length} usuários cadastrados
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdm && (
            <button 
              onClick={() => navigate('/seguranca')} 
              className="btn-secondary bg-red-50 text-red-700 border-red-200 hover:bg-red-100 flex items-center gap-1.5 font-bold shadow-xs"
              title="Acessar histórico de backups, restaurações e alarmes de segurança"
            >
              <ShieldAlert size={16} className="text-red-600" /> Segurança & Backups
            </button>
          )}
          <button onClick={() => setModal('new')} className="btn-primary">
            <Plus size={16} /> Novo Usuário
          </button>
        </div>
      </div>

      {/* Banner de Autorização de Gestores Pendentes */}
      {pendingUsers.length > 0 && (
        <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-200 text-amber-900 rounded-xl flex items-center justify-center font-bold text-lg shrink-0">
              <Clock size={22} className="text-amber-700" />
            </div>
            <div>
              <h4 className="font-bold text-amber-900 text-sm flex items-center gap-1.5">
                {pendingUsers.length} cadastro(s) aguardando autorização das Administradoras
              </h4>
              <p className="text-xs text-amber-700">
                Novos usuários cadastrados como Administrador, Síndico ou Subsíndico nascem inativos por segurança institucional. Clique em &quot;Aprovar&quot; para liberar o acesso.
              </p>
            </div>
          </div>
          <button 
            onClick={() => setRoleFilter(roleFilter === 'Pendentes' ? 'Todos' : 'Pendentes')}
            className="btn-secondary bg-amber-200 hover:bg-amber-300 text-amber-950 border-amber-400 text-xs font-bold shrink-0 self-start sm:self-auto"
          >
            {roleFilter === 'Pendentes' ? 'Mostrar Todos' : `Filtrar Pendentes (${pendingUsers.length})`}
          </button>
        </div>
      )}

      {/* Barra de Filtros Inteligentes */}
      <div className="card p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-white shadow-sm border border-cream-300">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            className="input pl-9 text-xs"
            placeholder="Buscar por nome, e-mail, telefone ou unidade..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">✕</button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdm ? (
            <div className="flex items-center gap-1.5">
              <Building size={14} className="text-brand-600 shrink-0" />
              <select
                className={`input text-xs font-bold min-w-[180px] ${condoFilter !== 'Todos' ? 'border-brand-500 bg-brand-50/40 text-brand-900 ring-1 ring-brand-300' : 'text-gray-700'}`}
                value={condoFilter}
                onChange={e => setCondoFilter(e.target.value)}
              >
                <option value="Todos">🏢 Todos os Condomínios</option>
                {uniqueCondoOptions.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
                <option value="Sem Condomínio">— Sem Condomínio Vinculado</option>
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 border border-brand-200 rounded-xl text-xs font-bold text-brand-800">
              <Building size={14} className="text-brand-600 shrink-0" />
              <span>Condomínio: {meuCondominio || 'Não definido'}</span>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <Shield size={14} className="text-purple-600 shrink-0" />
            <select
              className={`input text-xs font-bold min-w-[160px] ${roleFilter === 'Pendentes' ? 'bg-amber-100 border-amber-400 text-amber-900 font-black' : roleFilter !== 'Todos' ? 'border-brand-500 bg-brand-50/40 text-brand-900 ring-1 ring-brand-300' : 'text-gray-700'}`}
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
            >
              <option value="Todos">👤 Todos os Perfis</option>
              {pendingUsers.length > 0 && (
                <option value="Pendentes">⏳ Aguardando Aprovação ({pendingUsers.length})</option>
              )}
              {roles.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {((isAdm && condoFilter !== 'Todos') || roleFilter !== 'Todos' || search) && (
            <button
              onClick={() => {
                if (isAdm) setCondoFilter('Todos')
                setRoleFilter('Todos')
                setSearch('')
              }}
              className="text-xs font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap shadow-2xs"
              title="Limpar filtros de busca"
            >
              Limpar Filtros ✕
            </button>
          )}
        </div>
      </div>

      {/* Info box */}
      <div className="p-4 bg-pale-100 border border-brand-300 rounded-xl text-sm text-brand-800 flex items-start gap-2">
        <Shield size={16} className="mt-0.5 min-w-4 text-brand-600" />
        <div>
          <p className="font-semibold mb-0.5">Controle Zero-Trust & Governança de Acessos</p>
          <p className="text-xs text-brand-700">Novos usuários gestores são bloqueados preventivamente até a homologação de uma das administradoras. Isso impede que terceiros auto-concedam privilégios elevados.</p>
        </div>
      </div>

      {/* Tabela de Usuários */}
      <div className="card p-0 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-cream-100 border-b border-cream-400">
              <tr>
                {['Usuário', 'E-mail', 'Perfil', 'Condomínio', 'Bl/Apto', 'Telefone', 'Status', 'Ações'].map(h => (
                  <th key={h} className="table-head">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-gray-400 text-sm">
                    Nenhum usuário encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(u => (
                  <tr key={u.id} className="table-row">
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-brand-600 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm shrink-0">
                          {u.nome?.[0] || 'U'}
                        </div>
                        <p className="font-bold text-gray-800 text-sm">{u.nome}</p>
                      </div>
                    </td>
                    <td className="table-cell text-gray-500 text-xs font-mono">{u.email}</td>
                    <td className="table-cell">
                      <div className="flex flex-col gap-1 items-start">
                        <span className={roleColors[u.role] || 'badge-blue'}>
                          <Shield size={10} className="mr-1" />{u.role}
                        </span>
                        {u.role === 'Morador' && (
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border shadow-2xs ${
                            (u.statusMorador || u.status) === 'Inquilino' 
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                              : (u.statusMorador || u.status) === 'Dependente' 
                                ? 'bg-purple-50 text-purple-800 border-purple-300' 
                                : 'bg-blue-50 text-blue-800 border-blue-300'
                          }`}>
                            {u.statusMorador || (u.status === 'Inquilino' ? 'Inquilino' : 'Proprietário')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="table-cell text-gray-700 text-xs font-semibold">
                      {u.role === 'Administrador' ? (
                        <span className="flex items-center gap-1 font-black text-brand-700">
                          <Building size={12} className="text-brand-500 shrink-0" />
                          ALPHA
                        </span>
                      ) : u.condominio ? (
                        <span className="flex items-center gap-1">
                          <Building size={12} className="text-brand-500 shrink-0" />
                          {u.condominio}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="table-cell text-gray-700 text-xs">
                      {u.role === 'Administrador' ? (
                        <span className="text-gray-300">—</span>
                      ) : (u.bloco || u.unidade) ? (
                        <span className="font-medium">{u.bloco ? `Bl.${u.bloco} ` : ''}{u.unidade ? `Apt ${u.unidade}` : ''}</span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="table-cell text-gray-600 text-xs font-mono">{u.telefone || <span className="text-gray-300">—</span>}</td>
                    <td className="table-cell">
                      {isPendente(u) ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          <Clock size={11} className="text-amber-700 shrink-0" />
                          Aguardando Aprovação
                        </span>
                      ) : (
                        <span className="badge-green">
                          Ativo
                        </span>
                      )}
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1.5">
                        {isPendente(u) && (
                          <button
                            onClick={() => handleAprovarUsuario(u)}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition-all"
                            title="Aprovar e ativar este usuário imediatamente"
                          >
                            <CheckCircle2 size={13} /> Aprovar
                          </button>
                        )}
                        {u.email && (
                          <button
                            onClick={() => handleReenviarEmailAtivacao(u)}
                            className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-800 transition-all cursor-pointer shadow-2xs"
                            title="Reenviar e-mail de ativação e confirmação"
                          >
                            <Mail size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => setModal({ ...u, status: (u.ativo !== false && u.status !== 'Inativo') ? 'Ativo' : 'Inativo' })}
                          className="p-1.5 rounded-lg bg-cream-200 hover:bg-brand-100 text-gray-500 hover:text-brand-700 transition-all"
                          title="Editar usuário"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(u)}
                          className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 transition-all"
                          title="Excluir usuário"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <Modal
          data={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
          condominios={allCondominios}
          currentUser={currentUser}
        />
      )}
    </div>
  )
}
