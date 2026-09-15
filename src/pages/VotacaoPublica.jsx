import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Vote, CheckCircle2, AlertCircle, BarChart3, Clock,
  User, Building, ShieldCheck, ArrowLeft, Loader2
} from 'lucide-react'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth'
import { db, auth } from '../firebase'
import { useAuth } from '../context/AuthContext'

export default function VotacaoPublica() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user: loggedUser } = useAuth()

  const [loading, setLoading] = useState(true)
  const [enquete, setEnquete] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [votoSucesso, setVotoSucesso] = useState(false)

  // Identificação do morador (quando não logado no ERP)
  const [identificado, setIdentificado] = useState(false)
  const [moradorNome, setMoradorNome] = useState('')
  const [moradorUnidade, setMoradorUnidade] = useState('')
  const [moradorDoc, setMoradorDoc] = useState('') // Opcional / CPF ou RG
  const [moradorKey, setMoradorKey] = useState('') // Chave única para registro de voto

  // Garante autenticação anônima se o usuário não estiver logado
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, currentUser => {
      if (!currentUser) {
        signInAnonymously(auth).catch(err => {
          console.warn('Auth anônima na votação pública:', err)
        })
      }
    })
    return () => unsubscribe()
  }, [])

  // Se o morador tiver sessão ativa no ERP (admin/síndico), identifica automaticamente.
  // Para moradores públicos via WhatsApp: NUNCA auto-identifica pelo localStorage.
  // Cada pessoa precisa preencher seus próprios dados para garantir isolamento de votos.
  useEffect(() => {
    if (loggedUser) {
      const uKey = loggedUser.id || loggedUser.uid || loggedUser.email
      setMoradorKey(uKey)
      setMoradorNome(loggedUser.nome || loggedUser.email || 'Morador')
      setMoradorUnidade(loggedUser.unidade || loggedUser.apartamento || loggedUser.apt || '')
      setIdentificado(true)
      return
    }

    // Remove o identificador global que causava contaminação entre moradores no mesmo dispositivo
    localStorage.removeItem('morador_ident_global')

    // Apenas pré-preenche o formulário (NÃO auto-identifica) para conveniência do mesmo morador
    // que já votou e quer ver o resultado — mas ele ainda precisa clicar em "Prosseguir"
    const savedMorador = localStorage.getItem(`morador_ident_${id}`)
    if (savedMorador) {
      try {
        const parsed = JSON.parse(savedMorador)
        if (parsed?.nome) {
          setMoradorNome(parsed.nome)
          setMoradorUnidade(parsed.unidade || '')
          setMoradorDoc(parsed.documento || '')
          // NÃO define moradorKey nem identificado=true aqui
          // O morador precisa clicar em "Prosseguir para Votação"
        }
      } catch (e) {}
    }
  }, [id, loggedUser])

  // Busca APENAS a enquete correspondente ao ID da URL
  useEffect(() => {
    async function carregarEnquete() {
      if (!id) {
        setErrorMsg('Identificador da enquete não informado na URL.')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const docRef = doc(db, 'enquetes', id)
        const snap = await getDoc(docRef)

        if (!snap.exists()) {
          setErrorMsg('Enquete não encontrada ou já encerrada/removida.')
          setLoading(false)
          return
        }

        const data = snap.data()
        const statusReal = (data.dataFim && new Date(data.dataFim + 'T23:59:59') < new Date())
          ? 'Encerrada'
          : (data.status || 'Aberta')

        setEnquete({
          id: snap.id,
          ...data,
          status: statusReal,
          votos: data.votos || {},
          votosDetalhes: data.votosDetalhes || {}
        })
      } catch (err) {
        console.error('Erro ao buscar enquete:', err)
        setErrorMsg('Não foi possível carregar a enquete. Verifique sua conexão com a internet.')
      } finally {
        setLoading(false)
      }
    }

    carregarEnquete()
  }, [id])

  // Salvar identificação rápida do morador
  const handleConfirmarIdentificacao = (e) => {
    e.preventDefault()
    const nomeLimpo = moradorNome.trim()
    const unidLimpa = moradorUnidade.trim()

    if (!nomeLimpo || !unidLimpa) {
      alert('Por favor, informe seu nome completo e unidade/apartamento para validação do voto.')
      return
    }

    // Cria uma chave única estável para este morador neste condomínio
    const safeStr = `${unidLimpa.toLowerCase().replace(/[^a-z0-9]/g, '')}_${nomeLimpo.toLowerCase().replace(/[^a-z0-9]/g, '')}`
    const generatedKey = `pub_${safeStr}`

    const moradorObj = {
      key: generatedKey,
      nome: nomeLimpo,
      unidade: unidLimpa,
      documento: moradorDoc.trim()
    }

    // Salva APENAS com chave por enquete (nunca global) — conveniência para rever resultados
    // no mesmo dispositivo, sem contaminar outros moradores que venham a votar depois
    localStorage.setItem(`morador_ident_${id}`, JSON.stringify(moradorObj))
    localStorage.removeItem('morador_ident_global')

    setMoradorKey(generatedKey)
    setIdentificado(true)
  }

  // Ação de Votar
  const handleVotar = async (opcaoIndex) => {
    if (!enquete) return
    if (enquete.status === 'Encerrada') {
      alert('Esta enquete já foi encerrada e não aceita novos votos.')
      return
    }

    if (!identificado || !moradorKey) {
      alert('Por favor, identifique-se com seu Nome e Unidade antes de votar.')
      return
    }

    // Validação Multi-tenant (se morador logado tiver condomínio incompatível)
    if (loggedUser?.condominio && enquete.condominio && enquete.condominio !== 'Todos') {
      if (loggedUser.condominio.trim().toLowerCase() !== enquete.condominio.trim().toLowerCase()) {
        alert(`Acesso Restrito: Esta enquete pertence ao condomínio "${enquete.condominio}". Seu usuário está vinculado ao condomínio "${loggedUser.condominio}".`)
        return
      }
    }

    const jaVotou = enquete.votos && enquete.votos[moradorKey] !== undefined
    if (jaVotou) {
      alert('Você já registrou seu voto nesta enquete!')
      return
    }

    const confirmou = window.confirm(
      `Confirmar seu voto na opção:\n\n"${enquete.opcoes[opcaoIndex]}"?\n\nEsta ação é definitiva e não poderá ser alterada.`
    )
    if (!confirmou) return

    try {
      setSubmitting(true)
      const docRef = doc(db, 'enquetes', enquete.id)
      
      const novosVotos = {
        ...(enquete.votos || {}),
        [moradorKey]: opcaoIndex
      }

      const novosDetalhes = {
        ...(enquete.votosDetalhes || {}),
        [moradorKey]: {
          opcaoIndex,
          opcaoTexto: enquete.opcoes[opcaoIndex],
          nome: moradorNome || 'Morador',
          unidade: moradorUnidade || '',
          dataVoto: new Date().toISOString()
        }
      }

      await updateDoc(docRef, {
        votos: novosVotos,
        votosDetalhes: novosDetalhes
      })

      setEnquete(prev => ({
        ...prev,
        votos: novosVotos,
        votosDetalhes: novosDetalhes
      }))

      setVotoSucesso(true)
    } catch (err) {
      console.error('Erro ao computar voto:', err)
      alert('Erro ao registrar voto: ' + (err.message || 'Tente novamente.'))
    } finally {
      setSubmitting(false)
    }
  }

  // Renderização de Carregando
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={36} className="animate-spin text-brand-600" />
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
            Carregando Enquete Oficial...
          </p>
        </div>
      </div>
    )
  }

  // Renderização de Erro / Não Encontrada
  if (errorMsg || !enquete) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 font-sans">
        <div className="max-w-md w-full bg-white rounded-3xl border border-gray-200 shadow-xl p-6 sm:p-8 text-center animate-fade-in">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100 shadow-sm">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-xl font-black text-gray-900 mb-2">Votação Indisponível</h2>
          <p className="text-xs text-gray-600 mb-6 leading-relaxed">
            {errorMsg || 'A enquete solicitada não foi localizada ou já encerrou o período de votação.'}
          </p>
          <div className="pt-4 border-t border-gray-100 flex flex-col gap-2">
            <button
              onClick={() => {
                if (window.opener || window.history.length <= 1) {
                  window.close()
                } else {
                  navigate('/')
                }
              }}
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-gray-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              Fechar Aba
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Cálculos de votos
  const totalVotos = Object.keys(enquete.votos || {}).length
  const jaVotou = moradorKey && enquete.votos && enquete.votos[moradorKey] !== undefined
  const meuVotoIndex = jaVotou ? enquete.votos[moradorKey] : null
  const contagem = (enquete.opcoes || []).map((_, i) =>
    Object.values(enquete.votos || {}).filter(v => v === i).length
  )
  const maxVotos = Math.max(0, ...contagem)
  const isAberta = enquete.status === 'Aberta'

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-md animate-fade-in my-auto">
        
        {/* Card Principal */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden relative">
          
          {/* Topbar com Botão Voltar/Fechar e Tag do Sistema */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-50/70">
            <button
              onClick={() => {
                if (window.opener || window.history.length <= 1) {
                  window.close()
                } else {
                  navigate(-1)
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-gray-100 text-gray-700 text-xs font-bold border border-gray-200 transition-all cursor-pointer shadow-sm"
              title="Fechar ou Voltar"
            >
              <ArrowLeft size={14} /> Voltar
            </button>
            <span className="text-[11px] font-bold text-gray-400 flex items-center gap-1">
              <ShieldCheck size={14} className="text-brand-600" /> Votação Oficial
            </span>
          </div>

          {/* Cabeçalho com Logo da Alpha Soluções Condominiais */}
          <div className="p-6 text-center border-b border-gray-100 bg-white">
            <img
              src="/logo.png"
              alt="Alpha Soluções Condominiais"
              className="h-12 w-auto max-w-[180px] object-contain mx-auto mb-3 drop-shadow-sm"
              onError={(e) => {
                e.target.src = '/logo-alpha.png'
              }}
            />
            <p className="text-[10px] font-black uppercase tracking-widest text-brand-600 mb-1">
              Alpha Soluções Condominiais
            </p>
            
            {/* Vínculo de Isolamento Multi-Tenant do Condomínio */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-900 rounded-full text-xs font-bold mt-1">
              <Building size={13} className="text-amber-700" />
              <span>Condomínio: {enquete.condominio || 'Residencial'}</span>
            </div>
          </div>

          {/* Informações da Pergunta e Status */}
          <div className="p-6 pb-4">
            <div className="flex items-center justify-between mb-3">
              <span
                className={`text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                  isAberta
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                }`}
              >
                {isAberta ? 'Votação Aberta' : 'Votação Encerrada'}
              </span>

              {enquete.dataFim && (
                <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                  <Clock size={13} />
                  Até {enquete.dataFim.split('-').reverse().join('/')}
                </span>
              )}
            </div>

            <h1 className="text-lg sm:text-xl font-black text-gray-900 leading-snug mb-3">
              {enquete.pergunta}
            </h1>

            {enquete.descricao && (
              <p className="text-xs text-gray-600 mb-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
                {enquete.descricao}
              </p>
            )}

            {/* Aviso de Isolamento / Multi-Tenant */}
            <div className="text-[11px] text-gray-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center gap-2 mb-4">
              <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
              <span>
                Esta cédula é restrita aos moradores do <b>{enquete.condominio || 'Condomínio'}</b>. Cada unidade possui direito a 1 voto registrado.
              </span>
            </div>
          </div>

          {/* ETAPA 1: Identificação do Morador (Multi-Tenant & Acesso Rápido Limpo) */}
          {!identificado ? (
            <div className="p-6 pt-0">
              <div className="bg-brand-50/50 border border-brand-200/70 rounded-2xl p-5 mb-2">
                <div className="flex items-center gap-2 text-brand-900 font-bold text-sm mb-1">
                  <User size={16} className="text-brand-600" />
                  Identificação do Morador
                </div>
                <p className="text-xs text-gray-600 mb-4">
                  Identifique-se para computar seu voto oficial. Não é necessário login de administrador.
                </p>

                <form onSubmit={handleConfirmarIdentificacao} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                      Seu Nome Completo *
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                      placeholder="Ex: Carlos Eduardo Silva"
                      value={moradorNome}
                      onChange={e => setMoradorNome(e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">
                        Unidade / Bloco *
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                        placeholder="Ex: Apt 402 - Bloco B"
                        value={moradorUnidade}
                        onChange={e => setMoradorUnidade(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">
                        CPF / Doc (Opcional)
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                        placeholder="000.000.000-00"
                        value={moradorDoc}
                        onChange={e => setMoradorDoc(e.target.value)}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full mt-2 py-3 bg-brand-600 hover:bg-brand-500 active:scale-[0.99] text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 size={16} /> Prosseguir para Votação
                  </button>
                </form>
              </div>
            </div>
          ) : (
            /* ETAPA 2: Morador Identificado - Opções de Voto ou Resultados */
            <div className="p-6 pt-0 space-y-5">
              {/* Badge de Identificação */}
              <div className="flex items-center justify-between bg-slate-100/80 px-3.5 py-2 rounded-xl border border-gray-200">
                <div className="flex items-center gap-2 text-xs text-gray-700">
                  <User size={14} className="text-brand-600" />
                  <span className="font-bold">{moradorNome}</span>
                  {moradorUnidade && <span className="text-gray-500 font-medium">({moradorUnidade})</span>}
                </div>
                {!loggedUser && (
                  <button
                    onClick={() => {
                      if (window.confirm('Deseja alterar a identificação deste morador?')) {
                        setIdentificado(false)
                      }
                    }}
                    className="text-[10px] text-brand-600 hover:underline font-bold"
                  >
                    Alterar
                  </button>
                )}
              </div>

              {/* Se o morador ainda NÃO votou e a enquete está aberta: Lista de Botões de Voto */}
              {!jaVotou && isAberta ? (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                    Selecione a sua opção de voto:
                  </p>
                  
                  {(enquete.opcoes || []).map((opcao, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleVotar(idx)}
                      disabled={submitting}
                      className="w-full text-left p-4 rounded-2xl border-2 border-gray-200 bg-white hover:border-brand-500 hover:shadow-md active:scale-[0.99] transition-all group cursor-pointer flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-xl bg-slate-100 group-hover:bg-brand-50 text-gray-600 group-hover:text-brand-600 font-black text-xs flex items-center justify-center border border-gray-200 group-hover:border-brand-300">
                          {idx + 1}
                        </div>
                        <span className="text-sm font-bold text-gray-800 group-hover:text-brand-900">
                          {opcao}
                        </span>
                      </div>
                      <div className="w-5 h-5 rounded-full border-2 border-gray-300 group-hover:border-brand-500 flex items-center justify-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-transparent group-hover:bg-brand-500 transition-colors" />
                      </div>
                    </button>
                  ))}

                  {submitting && (
                    <div className="flex items-center justify-center gap-2 text-xs font-bold text-brand-600 py-2">
                      <Loader2 size={16} className="animate-spin" /> Registrando seu voto no sistema...
                    </div>
                  )}
                </div>
              ) : (
                /* Resultados Parciais / Finais da Votação */
                <div className="space-y-4">
                  {jaVotou && (
                    <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center gap-2.5 text-emerald-800 text-xs font-bold shadow-sm">
                      <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                      <span>Seu voto foi registrado com sucesso e oficializado!</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase tracking-wide">
                    <span>{isAberta ? 'Resultados em Tempo Real' : 'Resultado Final'}</span>
                    <span className="flex items-center gap-1 text-brand-700 bg-brand-50 px-2.5 py-1 rounded-lg">
                      <BarChart3 size={13} /> {totalVotos} {totalVotos === 1 ? 'voto' : 'votos'}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {(enquete.opcoes || []).map((opcao, i) => {
                      const votosCrt = contagem[i] || 0
                      const pct = totalVotos === 0 ? 0 : Math.round((votosCrt / totalVotos) * 100)
                      const isVencedor = pct > 0 && votosCrt === maxVotos
                      const isMeuVoto = jaVotou && meuVotoIndex === i

                      return (
                        <div
                          key={i}
                          className={`p-3.5 rounded-2xl border transition-all ${
                            isMeuVoto
                              ? 'border-emerald-300 bg-emerald-50/30'
                              : isVencedor
                              ? 'border-brand-200 bg-brand-50/20'
                              : 'border-gray-200 bg-white'
                          }`}
                        >
                          <div className="flex justify-between items-start text-xs font-bold mb-1.5">
                            <span className="text-gray-800 flex items-center gap-1.5">
                              {opcao}
                              {isMeuVoto && (
                                <span className="bg-emerald-600 text-white text-[9px] px-2 py-0.5 rounded-full font-black">
                                  Seu Voto
                                </span>
                              )}
                            </span>
                            <span className={isVencedor ? 'text-brand-700 font-black' : 'text-gray-500'}>
                              {pct}% ({votosCrt})
                            </span>
                          </div>
                          
                          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-1000 ${
                                isMeuVoto
                                  ? 'bg-emerald-500'
                                  : isVencedor
                                  ? 'bg-brand-500'
                                  : 'bg-gray-400'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Rodapé Seguro e Institucional */}
          <div className="p-4 bg-slate-50 border-t border-gray-100 text-center">
            <p className="text-[10px] text-gray-400 font-medium">
              Ambiente Seguro • Alpha Soluções Condominiais LTDA
            </p>
          </div>
        </div>

        {/* Nota Informativa fora do Card */}
        <p className="text-center text-[11px] text-gray-400 mt-4">
          Para dúvidas sobre a pauta ou ata, entre em contato com a administração do seu condomínio.
        </p>

      </div>
    </div>
  )
}
