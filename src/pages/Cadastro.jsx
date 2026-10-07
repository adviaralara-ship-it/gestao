import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Shield, User, Lock, Mail, ArrowRight, CheckCircle, Phone, Building, DoorOpen, Layers, Check, Smartphone, Clock, ShieldAlert } from 'lucide-react'
import { collection, addDoc, serverTimestamp, getDocs, updateDoc, doc, query, where } from 'firebase/firestore'
import { db, secondaryAuth } from '../firebase'
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import { sindicoPerms, porteiroPerms, moradorPerms, conselhoPerms, allModulesPerms } from '../context/AuthContext'
import { useFirestore } from '../hooks/useFirestore'
import { dispararAlarmeSeguranca } from '../utils/alarmeService'
import TurnstileWidget from '../components/TurnstileWidget'

const ROLES_QUE_EXIGEM_APROVACAO = ['Administrador', 'Síndico', 'Subsíndico']

const rolesOptions = [
  { value: 'Morador',     label: 'Morador' },
  { value: 'Síndico',    label: 'Síndico (Requer autorização da Administradora)' },
  { value: 'Subsíndico', label: 'Subsíndico (Requer autorização da Administradora)' },
  { value: 'Administrador', label: 'Administrador (Requer autorização da Administradora)' },
  { value: 'Conselheiro',label: 'Conselheiro' },
  { value: 'Porteiro',   label: 'Porteiro' },
]

const needsLocation = ['Morador','Síndico','Subsíndico','Conselheiro','Porteiro']
const addToMoradores = ['Morador','Síndico','Subsíndico','Conselheiro']

// Módulos de acesso que o morador recebe automaticamente (Portal do Morador)
const modulosMorador = [
  { icon: '🏠', label: 'Meu Painel & Avisos' },
  { icon: '🤖', label: 'Alpha IA (Concierge)' },
  { icon: '💰', label: 'Minha Situação Financeira (Boletos da Unidade)' },
  { icon: '📄', label: 'Documentos do Condomínio (Públicos)' },
  { icon: '📢', label: 'Mural & Comunicados' },
  { icon: '🔧', label: 'Minhas Solicitações (Abertura e Acompanhamento)' },
  { icon: '🏊', label: 'Reservas de Espaços' },
  { icon: '🗳️', label: 'Assembleias & Votação' },
  { icon: '🚗', label: 'Cadastro de Veículos' },
  { icon: '👥', label: 'Autorização de Visitantes' },
  { icon: '📹', label: 'Câmeras de Segurança' },
  { icon: '📊', label: 'Prestação de Contas' },
]

export default function Cadastro() {
  const [searchParams] = useSearchParams()
  const { items: condominiosList } = useFirestore('condominios')
  
  const paramCondo = searchParams.get('condominio') || searchParams.get('condo') || ''
  const paramApt = searchParams.get('apt') || searchParams.get('unidade') || ''
  const paramBloco = searchParams.get('bloco') || ''
  const paramNome = searchParams.get('nome') || ''
  const paramTel = searchParams.get('tel') || searchParams.get('telefone') || searchParams.get('whatsapp') || ''
  const paramEmail = searchParams.get('email') || ''
  const paramVinculo = searchParams.get('vinculo') || searchParams.get('status') || searchParams.get('tipo') || ''

  const [form, setForm] = useState({
    nome: paramNome,
    email: paramEmail,
    telefone: paramTel,
    cpf: '',
    senha: '',
    confirmar: '',
    condominio: paramCondo,
    bloco: paramBloco,
    unidade: paramApt,
    role: 'Morador',
    statusMorador: paramVinculo || 'Proprietário'
  })

  // Se parâmetros forem carregados via link
  useEffect(() => {
    if (paramCondo || paramApt || paramNome || paramTel || paramEmail || paramVinculo) {
      setForm(prev => ({
        ...prev,
        condominio: paramCondo || prev.condominio,
        unidade: paramApt || prev.unidade,
        bloco: paramBloco || prev.bloco,
        nome: paramNome || prev.nome,
        telefone: paramTel || prev.telefone,
        email: paramEmail || prev.email,
        statusMorador: paramVinculo || prev.statusMorador
      }))
    }
  }, [paramCondo, paramApt, paramBloco, paramNome, paramTel, paramEmail, paramVinculo])

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [registeredRole, setRegisteredRole] = useState('Morador')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [error, setError]     = useState('')
  const set = (k,v) => setForm(f=>({...f,[k]:v}))
  const requiresLocation = needsLocation.includes(form.role)
  const requiresApproval = ROLES_QUE_EXIGEM_APROVACAO.includes(form.role)

  const handleSubmit = async () => {
    setError('')
    if (!turnstileToken) { setError('Por favor, aguarde ou complete a verificação anti-robô (Cloudflare Turnstile).'); return }
    if (!form.nome||!form.email||!form.senha||!form.telefone||!form.cpf) { setError('Preencha todos os campos obrigatórios.'); return }
    if (form.telefone.replace(/\D/g, '').length < 10) { setError('Informe um telefone válido com DDD.'); return }
    if (form.cpf.replace(/\D/g, '').length !== 11) { setError('Informe um CPF válido com 11 dígitos.'); return }
    if (form.senha!==form.confirmar)          { setError('As senhas não coincidem.'); return }
    if (form.senha.length<6)                  { setError('A senha deve ter pelo menos 6 caracteres.'); return }
    if (requiresLocation&&!form.condominio)   { setError('Informe o nome do condomínio.'); return }
    if (requiresLocation&&form.role!=='Porteiro'&&!form.unidade) { setError('Informe a unidade / apartamento.'); return }

    setLoading(true)
    try {
      const emailClean = form.email.toLowerCase().trim()

      // 1. Cria conta no Firebase Authentication
      try {
        await createUserWithEmailAndPassword(secondaryAuth, emailClean, form.senha)
        await signOut(secondaryAuth)
      } catch (authErr) {
        if (authErr.code === 'auth/email-already-in-use') {
          setError('Este e-mail já possui uma conta no sistema. Faça login ou solicite recuperação de senha.')
          setLoading(false)
          return
        } else if (authErr.code === 'auth/weak-password') {
          setError('A senha deve ter pelo menos 6 caracteres.')
          setLoading(false)
          return
        } else if (authErr.code === 'auth/invalid-email') {
          setError('O endereço de e-mail informado é inválido.')
          setLoading(false)
          return
        } else {
          console.warn('Aviso Auth:', authErr)
        }
      }

      const normalizeStr = (s) => (s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/^(residencial|condominio|edificio|ed\.)\s+/i, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .trim()
        .toLowerCase()

      const foundCondo = condominiosList.find(c => {
        const cNome = normalizeStr(c.nome)
        const fNome = normalizeStr(form.condominio)
        return cNome === fNome || (cNome && fNome && (cNome.includes(fNome) || fNome.includes(cNome)))
      })

      const finalCondoNome = foundCondo ? foundCondo.nome : (form.condominio ? form.condominio.trim().toUpperCase() : '')

      const localInfo = requiresLocation
        ? { condominio: finalCondoNome, bloco: form.bloco.trim(), unidade: form.unidade.trim() }
        : { condominio: form.role === 'Administrador' ? 'ALPHA' : '', bloco: '', unidade: '' }

      const isGestao = ROLES_QUE_EXIGEM_APROVACAO.includes(form.role)

      const rolePerms = form.role === 'Administrador' ? allModulesPerms :
                        form.role === 'Síndico' || form.role === 'Subsíndico' ? sindicoPerms : 
                        form.role === 'Conselheiro' || form.role === 'Conselho' ? conselhoPerms :
                        form.role === 'Porteiro' ? porteiroPerms : moradorPerms

      // 2. Registra na coleção de usuários
      // 🔒 SEGURANÇA: Se o usuário tentar se cadastrar como Administrador, Síndico ou Subsíndico,
      // ele é salvo automaticamente com 'ativo: false' e 'status: Pendente'.
      // O acesso só é liberado quando uma administradora autorizar no painel.
      await addDoc(collection(db, 'usuarios'), {
        nome: form.nome.trim(),
        email: emailClean,
        telefone: form.telefone.trim(),
        cpf: form.cpf.replace(/\D/g, ''),
        senha: form.senha,
        ...localInfo,
        condominio: form.role === 'Administrador' ? 'ALPHA' : localInfo.condominio,
        role: form.role,
        statusMorador: form.role === 'Morador' ? (form.statusMorador || 'Proprietário') : form.role,
        permissoes: rolePerms,
        ativo: !isGestao,
        status: isGestao ? 'Pendente' : 'Ativo',
        pendenteAprovacao: isGestao,
        origem: 'auto-cadastro',
        _createdAt: serverTimestamp()
      })

      // 3. Registra ou atualiza na coleção de moradores caso se aplique
      if (addToMoradores.includes(form.role)) {
        try {
          const mCondo = (localInfo.condominio || '').trim().toLowerCase()
          const mApt = (localInfo.unidade || '').trim().toLowerCase()
          const finalStatus = form.role === 'Morador' ? (form.statusMorador || 'Proprietário') : form.role
          const mSnap = await getDocs(collection(db, 'moradores'))
          
          const moradorExistenteDoc = mSnap.docs.find(d => {
            const data = d.data()
            const cNorm = normalizeStr(data.condominio)
            const mNorm = normalizeStr(localInfo.condominio)
            const condoBate = cNorm === mNorm || (cNorm && mNorm && (cNorm.includes(mNorm) || mNorm.includes(cNorm)))
            const a = String(data.apt || data.unidade || '').trim().toLowerCase()
            const tel = (data.tel || data.telefone || data.whatsapp || '').replace(/\D/g, '')
            const formTel = form.telefone.replace(/\D/g, '')
            
            const matchUnidade = condoBate && a === mApt
            const matchTel = tel && formTel && tel === formTel
            const matchEmail = data.email && data.email.toLowerCase().trim() === emailClean
            
            return (matchUnidade && (matchTel || matchEmail || !data.email)) || (matchTel && condoBate)
          })

          if (moradorExistenteDoc) {
            // Atualiza o morador pré-cadastrado com os dados completos fornecidos
            await updateDoc(doc(db, 'moradores', moradorExistenteDoc.id), {
              nome: form.nome.trim(),
              email: emailClean,
              tel: form.telefone.trim(),
              condominio: localInfo.condominio,
              bloco: localInfo.bloco || moradorExistenteDoc.data().bloco || '',
              apt: localInfo.unidade,
              cpf: form.cpf.replace(/\D/g, ''),
              status: finalStatus,
              statusMorador: finalStatus,
              cadastroCompleto: true,
              origem: 'auto-cadastro',
              _updatedAt: serverTimestamp()
            })
          } else {
            await addDoc(collection(db, 'moradores'), {
              nome: form.nome.trim(),
              email: emailClean,
              tel: form.telefone.trim(),
              condominio: localInfo.condominio,
              bloco: localInfo.bloco,
              apt: localInfo.unidade,
              cpf: form.cpf.replace(/\D/g, ''),
              status: finalStatus,
              statusMorador: finalStatus,
              cadastroCompleto: true,
              origem: 'auto-cadastro',
              _createdAt: serverTimestamp()
            })
          }
        } catch (errMorador) {
          console.error('Erro ao salvar morador:', errMorador)
        }
      }

      // 4. Notifica administração e dispara alarme se for perfil de gestão
      const aptLabel = localInfo.unidade
        ? ` – ${localInfo.condominio}${localInfo.bloco ? ` Bl.${localInfo.bloco}` : ''} Apt ${localInfo.unidade}` : ''

      if (isGestao) {
        dispararAlarmeSeguranca({
          tipo: 'CADASTRO_GESTAO_PENDENTE',
          titulo: `Novo cadastro de ${form.role} aguardando aprovação`,
          detalhes: `O usuário "${form.nome.trim()}" (${emailClean}) solicitou cadastro com o perfil de ${form.role}. Por segurança institucional, a conta foi criada como INATIVA e aguarda aprovação das administradoras no painel.`,
          userEmail: emailClean,
          metadata: {
            nome: form.nome.trim(),
            role: form.role,
            condominio: form.role === 'Administrador' ? 'ALPHA' : localInfo.condominio,
            status: 'Pendente'
          }
        }).catch(e => console.warn('Aviso ao disparar alarme:', e))
      }

      await addDoc(collection(db, 'notificacoes'), {
        text: isGestao
          ? `⏳ NOVO ${form.role.toUpperCase()} PENDENTE: ${form.nome.trim()} (${emailClean}) aguarda aprovação da administração no painel de Usuários.`
          : `Novo ${form.role} cadastrado no sistema – ${form.nome.trim()}${aptLabel}`,
        time: new Date().toISOString(),
        tipo: isGestao ? 'aprovacao_usuario' : 'morador',
        destinatarios: ['Administrador', 'Síndico', 'Subsíndico'],
        somenteGestao: true,
        lida: false,
        condominio: form.role === 'Administrador' ? 'ALPHA' : (localInfo.condominio || 'Alpha ADM'),
        _createdAt: serverTimestamp()
      })

      setRegisteredRole(form.role)
      setSuccess(true)
    } catch (err) {
      console.error('Erro no cadastro:', err)
      setError(err.message || 'Erro ao cadastrar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    const isGestao = ROLES_QUE_EXIGEM_APROVACAO.includes(registeredRole)

    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-50 to-cream-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 sm:p-10 max-w-md w-full text-center">
          {isGestao ? (
            <>
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock size={32} className="text-amber-600"/>
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Solicitação enviada com sucesso!</h2>
              
              <div className="mb-6 p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl text-left">
                <div className="flex items-center gap-2 mb-1.5 text-amber-900 font-bold text-xs uppercase tracking-wider">
                  <ShieldAlert size={15} className="text-amber-700 shrink-0" />
                  Autorização de Administradora Obrigatória
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Por medidas de segurança e controle patrimonial, cadastros de <b>{registeredRole}</b> são gerados <b>automaticamente inativos</b>.
                </p>
                <p className="text-xs text-amber-800 mt-2 leading-relaxed">
                  Uma das administradoras da Alpha foi notificada e precisa <b>ativar sua conta</b> no painel de controle antes que você possa fazer login.
                </p>
              </div>

              <p className="text-xs text-gray-500 mb-6">
                Assim que sua conta for autorizada, você receberá a confirmação e poderá acessar o sistema normalmente.
              </p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-emerald-500"/>
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Cadastro concluído!</h2>
              <p className="text-gray-500 text-sm mb-4">Seu cadastro foi realizado com sucesso. Você já pode fazer login usando seu e-mail e senha.</p>
              
              <div className="mb-6 p-3.5 bg-brand-50 border border-brand-200 rounded-2xl text-left flex items-start gap-2.5">
                <Smartphone size={22} className="text-brand-600 shrink-0 mt-0.5" />
                <div className="text-xs text-brand-900">
                  <p className="font-bold">📱 Acesso direto no seu Celular:</p>
                  <p className="text-[11px] text-brand-800 mt-0.5">Toque no aviso na parte inferior da tela para <b>adicionar à tela inicial</b> e abrir o sistema como um aplicativo!</p>
                </div>
              </div>
            </>
          )}

          <a href="/" className="btn-primary w-full justify-center">Ir para a Tela de Login</a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-cream-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl p-8 max-w-lg w-full">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center"><Shield size={20} className="text-white"/></div>
          <div><p className="font-bold text-gray-800">Alpha Admin SC</p><p className="text-xs text-gray-400">Cadastro de Usuário</p></div>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-1">Criar conta</h2>
        <p className="text-sm text-gray-500 mb-6">Preencha os dados abaixo para solicitar acesso ao sistema.</p>

        <div className="flex flex-col gap-4">
          {/* Perfil */}
          <div>
            <label className="label">Perfil de acesso *</label>
            <select className="input font-semibold" value={form.role} onChange={e=>set('role',e.target.value)}>
              {rolesOptions.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          {/* Tipo de Vínculo com a Unidade (quando perfil for Morador) */}
          {form.role === 'Morador' && (
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-2xl flex flex-col gap-1.5">
              <label className="label text-amber-900 font-black text-xs m-0">Tipo de Morador na Unidade *</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'Proprietário', label: 'Proprietário' },
                  { id: 'Inquilino',    label: 'Inquilino' },
                  { id: 'Dependente',   label: 'Dependente / Familiar' }
                ].map(op => (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => set('statusMorador', op.id)}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition-all border text-center ${
                      form.statusMorador === op.id
                        ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                        : 'bg-white text-gray-700 border-amber-200 hover:bg-amber-100/60'
                    }`}
                  >
                    {op.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-amber-800 mt-0.5">
                {form.statusMorador === 'Inquilino' 
                  ? '📌 Você será cadastrado oficialmente como Inquilino da unidade.' 
                  : form.statusMorador === 'Dependente'
                  ? '📌 Você será vinculado como Dependente / Familiar residente.'
                  : '📌 Você será cadastrado como Proprietário da unidade.'}
              </p>
            </div>
          )}

          {/* Nome */}
          <div>
            <label className="label">Nome completo *</label>
            <div className="relative"><User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input className="input pl-9 uppercase" value={form.nome} onChange={e=>set('nome',e.target.value.toUpperCase())} placeholder="SEU NOME COMPLETO"/>
            </div>
          </div>

          {/* Email + Telefone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="label">E-mail *</label>
              <div className="relative"><Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input type="email" className="input pl-9" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="seu@email.com"/>
              </div>
            </div>
            <div><label className="label">Telefone / WhatsApp *</label>
              <div className="relative"><Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input type="tel" className="input pl-9" value={form.telefone} onChange={e=>set('telefone',e.target.value)} placeholder="(00) 00000-0000"/>
              </div>
            </div>
          </div>

          {/* CPF */}
          <div>
            <label className="label">CPF * (Apenas números)</label>
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input type="text" className="input pl-9" value={form.cpf} onChange={e=>set('cpf',e.target.value.replace(/\D/g,'').slice(0,11))} placeholder="00000000000"/>
            </div>
          </div>

          {/* Senha */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="label">Senha *</label>
              <div className="relative"><Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input type="password" className="input pl-9" value={form.senha} onChange={e=>set('senha',e.target.value)} placeholder="Mín. 6 caracteres"/>
              </div>
            </div>
            <div><label className="label">Confirmar senha *</label>
              <div className="relative"><Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input type="password" className="input pl-9" value={form.confirmar} onChange={e=>set('confirmar',e.target.value)} placeholder="Repetir senha"/>
              </div>
            </div>
          </div>

          {/* Localização */}
          {requiresLocation && (
            <div className="flex flex-col gap-3 p-4 bg-cream-50 border border-cream-300 rounded-2xl">
              <p className="text-xs font-bold text-brand-700 flex items-center gap-1"><Building size={12}/> Dados do Condomínio</p>
              <div><label className="label">Nome do Condomínio *</label>
                <div className="relative"><Building size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                  <input list="condominios-sugestoes" className="input pl-9 uppercase" value={form.condominio} onChange={e=>set('condominio',e.target.value.toUpperCase())} placeholder="SELECIONE OU DIGITE O CONDOMÍNIO..."/>
                  <datalist id="condominios-sugestoes">
                    {condominiosList.map(c => (
                      <option key={c.id || c.nome} value={c.nome} />
                    ))}
                  </datalist>
                </div>
              </div>
              {form.role !== 'Porteiro' && (
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Bloco / Torre</label>
                    <div className="relative"><Layers size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                      <input className="input pl-9 uppercase" value={form.bloco} onChange={e=>set('bloco',e.target.value.toUpperCase())} placeholder="Ex: A, B, 1..."/>
                    </div>
                  </div>
                  <div><label className="label">Unidade / Apto *</label>
                    <div className="relative"><DoorOpen size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                      <input className="input pl-9 uppercase" value={form.unidade} onChange={e=>set('unidade',e.target.value.toUpperCase())} placeholder="Ex: 106, 101-A"/>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Módulos de acesso – sempre visíveis (fixos para morador) */}
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
            <p className="text-xs font-bold text-emerald-800 mb-3 flex items-center gap-1.5">✅ Módulos incluídos no seu acesso</p>
            <div className="grid grid-cols-2 gap-2">
              {modulosMorador.map(m=>(
                <div key={m.label} className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center shrink-0"><Check size={10} className="text-emerald-600"/></div>
                  <span className="text-xs text-emerald-900 font-medium">{m.icon} {m.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Verificação Anti-Robô (Cloudflare Turnstile) */}
          <div className="flex justify-center my-2">
            <TurnstileWidget onVerify={tok => setTurnstileToken(tok)} />
          </div>

          {error && <div className="p-3 bg-red-50 border border-red-300 rounded-xl text-sm text-red-600">{error}</div>}

          <button onClick={handleSubmit} disabled={loading} className="btn-primary w-full justify-center mt-2">
            {loading ? 'Enviando...' : <><ArrowRight size={16}/>Solicitar Cadastro</>}
          </button>
          <p className="text-center text-xs text-gray-400">Já tem conta? <a href="/" className="text-brand-600 hover:underline">Fazer login</a></p>
        </div>
      </div>
    </div>
  )
}
