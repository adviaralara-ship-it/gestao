import React, { useState } from 'react'
import { Users, Plus, Shield, Edit2, Trash2, Eye, EyeOff, KeyRound, Building, Layers, DoorOpen, Phone } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { allModulesPerms, sindicoPerms, financeiroPerms, porteiroPerms, moradorPerms, portariaRemotaPerms } from '../context/AuthContext'
import { enviarEmail } from '../emailjs.config'
import { secondaryAuth } from '../firebase'
import { createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth'

const MORADOR_ROLES = ['Morador', 'Síndico', 'Subsíndico', 'Conselheiro']

const roles = ['Administrador', 'Síndico', 'Subsíndico', 'Morador', 'Porteiro', 'Financeiro', 'Portaria Remota']

const roleColors = {
  Administrador: 'badge-red',
  Síndico: 'badge-purple',
  Subsíndico: 'badge-blue',
  Morador: 'badge-green',
  Porteiro: 'badge-yellow',
  Financeiro: 'badge-blue'
}

import { CheckSquare as CheckIcon } from 'lucide-react'

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
  { id: 'propostas', label: 'Gerar Propostas' }
]

function Modal({ data, onClose, onSave }) {
  const getDefaultPerms = (r) => {
    if (r === 'Administrador') return allModulesPerms
    if (r === 'Síndico') return sindicoPerms
    if (r === 'Morador') return moradorPerms
    if (r === 'Porteiro') return porteiroPerms
    if (r === 'Financeiro') return financeiroPerms
    if (r === 'Portaria Remota') return portariaRemotaPerms
    return moradorPerms // Others default to morador
  }

  const needsLocation = ['Morador', 'Síndico', 'Subsíndico', 'Conselheiro']

  const [form, setForm] = useState(
    data || { nome: '', email: '', senha: '', telefone: '', condominio: '', bloco: '', unidade: '', role: 'Morador', status: 'Ativo', permissoes: getDefaultPerms('Morador') }
  )

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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-3xl" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">{isEdit ? 'Editar Usuário' : 'Novo Usuário'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-lg">✕</button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto">
          <div className="flex flex-col gap-4">
            <h4 className="font-bold text-sm text-brand-700 mb-2 border-b border-cream-300 pb-2">Dados do Usuário</h4>
            <div>
              <label className="label">Nome Completo</label>
              <input className="input" value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Nome do usuário" />
            </div>
            <div>
              <label className="label">E-mail (usado para login)</label>
              <input type="email" className="input" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@exemplo.com" />
            </div>
            {!isEdit ? (
              <div>
                <label className="label">Senha</label>
                <div className="relative">
                  <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showSenha ? 'text' : 'password'}
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
            ) : (
              <div>
                <label className="label">Redefinir Senha</label>
                <div className="p-3 bg-cream-50 border border-cream-300 rounded-xl flex items-center justify-between">
                  <span className="text-sm text-gray-500 font-medium truncate mr-2">Senha protegida</span>
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Perfil Base</label>
                <select className="input" value={form.role} onChange={handleRoleChange}>
                  {roles.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
                  <option>Ativo</option><option>Inativo</option>
                </select>
              </div>
            </div>

            {/* Telefone */}
            <div>
              <label className="label">Telefone / WhatsApp</label>
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-9" value={form.telefone || ''} onChange={e => set('telefone', e.target.value)} placeholder="(00) 00000-0000" />
              </div>
            </div>

            {/* Localização */}
            {requiresLocation && (
              <div className="flex flex-col gap-3 p-3 bg-cream-50 border border-cream-300 rounded-xl">
                <p className="text-xs font-bold text-brand-700 flex items-center gap-1"><Building size={12} /> Condomínio / Unidade</p>
                <div>
                  <label className="label">Nome do Condomínio</label>
                  <div className="relative">
                    <Building size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input className="input pl-9" value={form.condominio || ''} onChange={e => set('condominio', e.target.value)} placeholder="Ex: Residencial das Flores" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Bloco / Torre</label>
                    <div className="relative">
                      <Layers size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input className="input pl-9" value={form.bloco || ''} onChange={e => set('bloco', e.target.value)} placeholder="Ex: A, B, 1" />
                    </div>
                  </div>
                  <div>
                    <label className="label">Unidade / Apto</label>
                    <div className="relative">
                      <DoorOpen size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input className="input pl-9" value={form.unidade || ''} onChange={e => set('unidade', e.target.value)} placeholder="Ex: 204" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!isEdit && (
              <div className="p-3 mt-2 bg-pale-100 border border-brand-200 rounded-xl text-xs text-brand-700">
                ℹ️ Após salvar, o usuário poderá fazer login com o e-mail e senha cadastrados aqui.
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <h4 className="font-bold text-sm text-brand-700 mb-2 border-b border-cream-300 pb-2">Permissões de Acesso (Módulos permitidos)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {allModules.map(m => {
                const checked = (form.permissoes || []).includes(m.id)
                return (
                  <label key={m.id} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${checked ? 'border-brand-500 bg-brand-50' : 'border-cream-300 hover:bg-cream-100'}`}>
                    <input type="checkbox" className="hidden" checked={checked} onChange={() => togglePermission(m.id)} />
                    <div className={`w-4 h-4 min-w-4 rounded border flex items-center justify-center transition-colors ${checked ? 'bg-brand-600 border-brand-600' : 'bg-white border-gray-300'}`}>
                      {checked && <CheckIcon size={12} className="text-white" />}
                    </div>
                    <span className="text-xs font-semibold text-gray-700 select-none truncate" title={m.label}>{m.label}</span>
                  </label>
                )
              })}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-cream-300 flex gap-3 justify-end bg-gray-50 rounded-b-3xl">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button
            onClick={() => {
              if (!form.nome || !form.email) return alert('Preencha nome e e-mail.')
              if (!isEdit && !form.senha) return alert('Defina uma senha para o novo usuário.')
              onSave(form)
            }}
            className="btn-primary"
          >
            Salvar Usuário
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Usuarios() {
  const { items: users, addItem, updateItem, deleteItem } = useFirestore('usuarios')
  const [modal, setModal] = useState(null)

  const handleSave = async (form) => {
    if (modal === 'new') {
      try {
        await createUserWithEmailAndPassword(secondaryAuth, form.email, form.senha)
        await signOut(secondaryAuth)
      } catch (err) {
        if (err.code !== 'auth/email-already-in-use') {
          alert('Erro ao criar acesso (Auth): ' + err.message)
          return
        }
      }

      const novo = {
        ...form,
        ativo: form.status === 'Ativo',
        _createdAt: new Date().toISOString()
      }
      await addItem(novo)

      // Se o perfil é do tipo morador, também inserir na coleção moradores
      if (MORADOR_ROLES.includes(form.role)) {
        await addDoc(collection(db, 'moradores'), {
          nome: form.nome,
          email: form.email,
          tel: form.telefone || '',
          condominio: form.condominio || '',
          bloco: form.bloco || '',
          apt: form.unidade || '',
          cpf: '',
          status: form.role === 'Morador' ? 'Proprietário' : form.role,
          origem: 'admin',
          _createdAt: serverTimestamp()
        })
      }

      // Dispara o e-mail de boas-vindas / validação
      await enviarEmail(
        form.email,
        form.nome,
        'Sua conta foi criada no Alpha Gestão Condominial',
        `Olá ${form.nome},<br><br>Seu acesso ao sistema foi criado com sucesso.<br><br><b>Login:</b> ${form.email}<br><b>Senha provisória:</b> ${form.senha}<br><br>Acesse o painel para validar seus dados e alterar sua senha.`
      )
    } else {
      const updated = {
        ...form,
        ativo: form.status === 'Ativo',
      }
      // Se não digitou senha nova, remove a chave para não sobrescrever a antiga
      if (!updated.senha && modal.senha) updated.senha = modal.senha
      
      await updateItem(modal.id, updated)
    }
    setModal(null)
  }

  const handleDelete = async (id) => {
    if (window.confirm('Deseja realmente excluir este usuário?')) {
      await deleteItem(id)
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h2 className="section-title text-xl">Usuários & Acessos</h2>
          <p className="section-sub">{users.length} usuários cadastrados</p>
        </div>
        <button onClick={() => setModal('new')} className="btn-primary">
          <Plus size={16} />Novo Usuário
        </button>
      </div>

      {/* Info box */}
      <div className="p-4 bg-pale-100 border border-brand-300 rounded-xl text-sm text-brand-800 flex items-start gap-2">
        <Shield size={16} className="mt-0.5 min-w-4" />
        <div>
          <p className="font-semibold mb-0.5">Como funciona o acesso</p>
          <p className="text-xs text-brand-700">Cada usuário cadastrado aqui recebe um <strong>e-mail e senha próprios</strong> para fazer login no sistema. O perfil determina o nível de acesso.</p>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
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
              {users.map(u => (
                <tr key={u.id} className="table-row">
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-brand-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                        {u.nome?.[0] || 'U'}
                      </div>
                      <p className="font-semibold text-gray-800 text-sm">{u.nome}</p>
                    </div>
                  </td>
                  <td className="table-cell text-gray-500 text-xs font-mono">{u.email}</td>
                  <td className="table-cell">
                    <span className={roleColors[u.role] || 'badge-blue'}>
                      <Shield size={10} className="mr-1" />{u.role}
                    </span>
                  </td>
                  <td className="table-cell text-gray-700 text-xs">
                    {u.condominio ? (
                      <span className="flex items-center gap-1"><Building size={10} className="text-brand-400" />{u.condominio}</span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="table-cell text-gray-700 text-xs">
                    {u.bloco || u.unidade ? (
                      <span>{u.bloco ? `Bl.${u.bloco} ` : ''}{u.unidade ? `Apt ${u.unidade}` : ''}</span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="table-cell text-gray-500 text-xs">{u.telefone || <span className="text-gray-300">—</span>}</td>
                  <td className="table-cell">
                    <span className={(u.ativo !== false && u.status !== 'Inativo') ? 'badge-green' : 'badge-red'}>{(u.ativo !== false && u.status !== 'Inativo') ? 'Ativo' : 'Pendente/Inativo'}</span>
                  </td>
                  <td className="table-cell">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setModal({ ...u, status: (u.ativo !== false && u.status !== 'Inativo') ? 'Ativo' : 'Inativo' })}
                        className="p-1.5 rounded-lg bg-cream-200 hover:bg-brand-100 text-gray-500 hover:text-brand-700 transition-all"
                        title="Editar usuário"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => handleDelete(u.id)}
                        className="p-1.5 rounded-lg bg-cream-200 hover:bg-red-100 text-gray-500 hover:text-red-600 transition-all"
                        title="Excluir usuário"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <Modal
          data={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
