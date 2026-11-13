import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  CheckCircle2, AlertCircle, Wrench, Calendar, Building,
  User, DollarSign, Clock, ArrowLeft, Loader2, FileText, Check, ShieldCheck
} from 'lucide-react'
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth'
import { db, auth } from '../firebase'
import { useAuth } from '../context/AuthContext'

export default function ConcluirItem() {
  const { tipo = 'manutencao', id } = useParams()
  const navigate = useNavigate()
  const { user: loggedUser } = useAuth()

  const [authReady, setAuthReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [item, setItem] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sucesso, setSucesso] = useState(false)

  // Formulário de Conclusão
  const [responsavelNome, setResponsavelNome] = useState('')
  const [valorFinal, setValorFinal] = useState('')
  const [observacoes, setObservacoes] = useState('')

  const isManutencao = tipo.toLowerCase().includes('manut')
  const colecao = isManutencao ? 'manutencoes' : 'tarefas'

  // 1. Autenticação resiliente (se não logado no ERP, usa credencial de serviço para baixa rápida)
  useEffect(() => {
    let isMounted = true

    const unsubscribe = onAuthStateChanged(auth, async currentUser => {
      if (currentUser) {
        if (isMounted) setAuthReady(true)
        return
      }

      try {
        await signInAnonymously(auth)
      } catch (errAnon) {
        console.warn('Sessão temporária anônima fallback:', errAnon?.message)
      }
      if (isMounted) setAuthReady(true)
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  // 2. Preenchimento do nome se o usuário estiver logado
  useEffect(() => {
    if (loggedUser?.nome) {
      setResponsavelNome(loggedUser.nome)
    }
  }, [loggedUser])

  // 3. Carrega os dados do item
  const carregarItem = useCallback(async () => {
    if (!id) {
      setErrorMsg('Identificador do item não informado.')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setErrorMsg('')

      const docRef = doc(db, colecao, id)
      let snap = await getDoc(docRef)

      if (!snap.exists()) {
        // Tenta na outra coleção caso tenha havido troca de rota
        const outraColecao = isManutencao ? 'tarefas' : 'manutencoes'
        const altRef = doc(db, outraColecao, id)
        const altSnap = await getDoc(altRef)
        if (altSnap.exists()) {
          snap = altSnap
        } else {
          setErrorMsg(`${isManutencao ? 'Manutenção' : 'Tarefa'} não encontrada no sistema.`)
          setLoading(false)
          return
        }
      }

      const data = snap.data()
      setItem({ id: snap.id, ...data })

      // Inicializa valor final com o custo estimado
      if (data.custoEstimado || data.valor) {
        const val = Number(data.custoEstimado || data.valor || 0)
        if (val > 0) {
          setValorFinal(val.toFixed(2).replace('.', ','))
        }
      }
    } catch (err) {
      console.error('Erro ao buscar item:', err)
      setErrorMsg('Não foi possível carregar os detalhes. Verifique sua conexão e tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [id, colecao, isManutencao])

  useEffect(() => {
    if (authReady) {
      carregarItem()
    }
  }, [authReady, carregarItem])

  // 4. Executa a baixa / conclusão
  const handleConfirmarConclusao = async (e) => {
    e.preventDefault()
    if (!item) return

    const nomeFinal = responsavelNome.trim() || loggedUser?.nome || 'Administração Alpha'

    setSubmitting(true)
    try {
      const hojeIso = new Date().toISOString().split('T')[0]
      const agoraIso = new Date().toISOString()
      const docRef = doc(db, colecao, item.id)

      let custoNumerico = null
      if (valorFinal) {
        const parsed = parseFloat(valorFinal.replace(/\./g, '').replace(',', '.'))
        if (!isNaN(parsed) && parsed >= 0) custoNumerico = parsed
      }

      const payload = isManutencao ? {
        status: 'Concluída',
        dataConclusao: hojeIso,
        concluidoEm: agoraIso,
        concluidoPor: nomeFinal,
        custoReal: custoNumerico ?? item.custoEstimado ?? 0,
        observacaoConclusao: observacoes.trim(),
        _updatedAt: serverTimestamp()
      } : {
        status: 'Concluído',
        coluna: 'Concluído',
        concluidoEm: agoraIso,
        concluidoPor: nomeFinal,
        observacaoConclusao: observacoes.trim(),
        _updatedAt: serverTimestamp()
      }

      await updateDoc(docRef, payload)

      // Registra notificação para os gestores no sistema
      try {
        await addDoc(collection(db, 'notificacoes'), {
          text: `✅ ${isManutencao ? 'Manutenção' : 'Tarefa'} concluída: "${item.titulo}" (${item.condominio || 'Condomínio'}) por ${nomeFinal}.`,
          titulo: `✅ Concluído: ${item.titulo}`,
          time: agoraIso,
          tipo: isManutencao ? 'manutencao_concluida' : 'tarefa_concluida',
          condominio: item.condominio || 'Todos',
          lida: false,
          link: isManutencao ? '/manutencoes' : '/tarefas',
          _createdAt: serverTimestamp()
        })
      } catch (errNotif) {
        console.warn('Erro ao criar notificação de conclusão:', errNotif)
      }

      setSucesso(true)
      setItem(prev => ({ ...prev, ...payload }))
    } catch (err) {
      console.error('Erro ao concluir item:', err)
      alert('Erro ao registrar a conclusão: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const isJaConcluido = item && (item.status === 'Concluída' || item.status === 'Concluído' || item.coluna === 'Concluído')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-emerald-50/40 p-4 sm:p-6 flex flex-col items-center justify-center font-sans">
      
      {/* Cabeçalho da Marca Alpha */}
      <div className="w-full max-w-lg mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo-alpha.png" alt="Alpha" className="w-9 h-9 object-contain rounded-xl shadow-sm border border-slate-200 bg-white" />
          <div>
            <h1 className="text-sm font-black text-slate-900 tracking-tight">ALPHA SOLUÇÕES CONDOMINIAIS</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Gestão e Acompanhamento Operacional</p>
          </div>
        </div>
        <span className="text-[10px] bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
          <ShieldCheck size={11} className="text-emerald-600" /> Ação Segura
        </span>
      </div>

      {/* Card Principal */}
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden transition-all">
        
        {/* Topo do Card */}
        <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-brand-900 to-slate-900 text-white relative">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full backdrop-blur-sm flex items-center gap-1 text-emerald-300">
              {isManutencao ? <Wrench size={12} /> : <FileText size={12} />}
              {isManutencao ? 'Ordem de Manutenção' : 'Tarefa Operacional'}
            </span>
            {item?.condominio && (
              <span className="text-[11px] font-bold text-slate-300 truncate">
                • {item.condominio}
              </span>
            )}
          </div>
          <h2 className="text-xl font-black text-white leading-tight">
            {loading ? 'Carregando serviço...' : item?.titulo || 'Serviço'}
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            {isManutencao ? 'Confirmação e registro de execução predial' : 'Acompanhamento e baixa de tarefa'}
          </p>
        </div>

        {/* Corpo do Card */}
        <div className="p-6">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 size={36} className="animate-spin text-brand-600" />
              <p className="text-xs font-bold text-slate-600">Carregando detalhes do serviço...</p>
            </div>
          ) : errorMsg ? (
            <div className="py-8 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-3">
                <AlertCircle size={24} />
              </div>
              <h3 className="font-bold text-slate-800 text-sm">{errorMsg}</h3>
              <p className="text-xs text-slate-500 max-w-xs mt-1">
                Verifique o link enviado pelo WhatsApp ou entre em contato com a administração.
              </p>
            </div>
          ) : sucesso || isJaConcluido ? (
            /* Estado de Concluído com Sucesso */
            <div className="py-6 flex flex-col items-center text-center animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3 shadow-inner ring-8 ring-emerald-50">
                <CheckCircle2 size={36} />
              </div>
              <span className="text-[11px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full mb-2">
                Status: Concluída
              </span>
              <h3 className="text-lg font-black text-slate-900">
                {sucesso ? '🎉 Baixa Registrada com Sucesso!' : 'Esta Manutenção Já Foi Concluída'}
              </h3>
              <p className="text-xs text-slate-600 max-w-sm mt-1 leading-relaxed">
                O registro foi atualizado no sistema Alpha e o histórico operacional do condomínio está em dia.
              </p>

              {/* Detalhes do registro */}
              <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 mt-5 text-left text-xs flex flex-col gap-2">
                <div className="flex justify-between items-center text-slate-600">
                  <span className="font-bold text-slate-500">Serviço:</span>
                  <span className="font-semibold text-slate-900">{item?.titulo}</span>
                </div>
                {item?.condominio && (
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="font-bold text-slate-500">Condomínio:</span>
                    <span className="font-semibold text-slate-900">{item?.condominio}</span>
                  </div>
                )}
                {item?.fornecedor && (
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="font-bold text-slate-500">Prestador:</span>
                    <span className="font-semibold text-slate-900">{item?.fornecedor}</span>
                  </div>
                )}
                {item?.concluidoPor && (
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="font-bold text-slate-500">Baixa realizada por:</span>
                    <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">{item?.concluidoPor}</span>
                  </div>
                )}
                {item?.custoReal > 0 && (
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="font-bold text-slate-500">Valor Final Pago:</span>
                    <span className="font-bold text-emerald-700 font-mono">
                      R$ {Number(item.custoReal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {item?.observacaoConclusao && (
                  <div className="mt-2 pt-2 border-t border-slate-200 text-slate-600">
                    <span className="font-bold text-slate-500 block mb-0.5">Observação registrada:</span>
                    <p className="italic text-slate-700 bg-white p-2 rounded border border-slate-100">{item.observacaoConclusao}</p>
                  </div>
                )}
              </div>

              <div className="mt-6 flex gap-3 w-full">
                <button
                  type="button"
                  onClick={() => navigate('/manutencoes')}
                  className="flex-1 btn-primary py-2.5 text-xs font-bold justify-center"
                >
                  Abrir Painel Completo
                </button>
              </div>
            </div>
          ) : (
            /* Formulário de Registro de Conclusão */
            <form onSubmit={handleConfirmarConclusao} className="flex flex-col gap-4">
              
              {/* Resumo do Serviço */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col gap-2.5 text-xs">
                <div className="flex items-center gap-2 text-slate-500">
                  <Building size={14} className="text-slate-400" />
                  <span className="font-bold text-slate-800">{item?.condominio || 'Condomínio'}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-500">
                  <Calendar size={14} className="text-slate-400" />
                  <span>Data Programada: <strong className="text-slate-800">{item?.dataPrevista ? item.dataPrevista.split('-').reverse().join('/') : item?.vencimento ? item.vencimento.split('-').reverse().join('/') : 'Hoje'}</strong></span>
                </div>
                {item?.fornecedor && (
                  <div className="flex items-center gap-2 text-slate-500">
                    <User size={14} className="text-slate-400" />
                    <span>Prestador: <strong className="text-slate-800">{item.fornecedor}</strong></span>
                  </div>
                )}
                {Number(item?.custoEstimado || 0) > 0 && (
                  <div className="flex items-center gap-2 text-slate-500">
                    <DollarSign size={14} className="text-slate-400" />
                    <span>Custo Previsto: <strong className="text-emerald-700 font-mono">R$ {Number(item.custoEstimado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
                  </div>
                )}
                {item?.descricao && (
                  <div className="mt-1 pt-2 border-t border-slate-200 text-slate-600">
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{item.descricao}</p>
                  </div>
                )}
              </div>

              {/* Campos para confirmação */}
              <div className="flex flex-col gap-3 pt-2">
                <div>
                  <label className="label text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>👤 Quem está confirmando a conclusão?</span>
                    <span className="text-[10px] text-slate-400 font-normal">Obrigatório</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="input text-xs"
                    placeholder="Ex: Síndico Carlos / Zelador Marcos / Prestador"
                    value={responsavelNome}
                    onChange={e => setResponsavelNome(e.target.value)}
                  />
                </div>

                {isManutencao && (
                  <div>
                    <label className="label text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span>💰 Valor Final Executado (R$)</span>
                      <span className="text-[10px] text-slate-400 font-normal">Opcional</span>
                    </label>
                    <input
                      type="text"
                      className="input text-xs font-mono font-bold text-emerald-800"
                      placeholder="0,00"
                      value={valorFinal}
                      onChange={e => setValorFinal(e.target.value)}
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">Se o valor divergir do orçado, altere acima.</p>
                  </div>
                )}

                <div>
                  <label className="label text-xs font-bold text-slate-700">
                    📝 Observações da Execução (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    className="input text-xs resize-none"
                    placeholder="Ex: Serviço executado, testado e aprovado sem pendências."
                    value={observacoes}
                    onChange={e => setObservacoes(e.target.value)}
                  />
                </div>
              </div>

              {/* Botão de Ação */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full btn-primary bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm py-3.5 rounded-2xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Registrando Baixa...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      <span>Confirmar Conclusão do Serviço</span>
                    </>
                  )}
                </button>
                <p className="text-[11px] text-center text-slate-400 mt-2">
                  A alteração será refletida em tempo real no sistema Alpha.
                </p>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Rodapé discreto */}
      <p className="text-[11px] text-slate-400 mt-6 text-center">
        Alpha Soluções Condominiais • Todos os direitos reservados
      </p>
    </div>
  )
}
