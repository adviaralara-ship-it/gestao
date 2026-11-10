import React, { useState, useEffect } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { 
  Building2, CheckCircle2, XCircle, AlertTriangle, Clock, 
  ShieldCheck, Award, DollarSign, Calendar, FileText, ArrowRight, 
  Send, ThumbsUp, ThumbsDown, MessageSquare, Phone, UserCheck
} from 'lucide-react'
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { enviarMensagemWhatsApp } from '../utils/whatsappAutomacao'

export default function AprovarOrcamento() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const cIndex = searchParams.get('c') // '1', '2', '3'
  const telParam = searchParams.get('tel') || ''

  const [loading, setLoading] = useState(true)
  const [enviandoVoto, setEnviandoVoto] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(null)

  const [cotacao, setCotacao] = useState(null)
  const [condo, setCondo] = useState(null)
  const [conselheiroSelecionado, setConselheiroSelecionado] = useState(null)
  const [justificativa, setJustificativa] = useState('')

  useEffect(() => {
    carregarDados()
  }, [id])

  const carregarDados = async () => {
    try {
      setLoading(true)
      setErro('')

      if (!id) {
        setErro('Identificador do orçamento não informado.')
        return
      }

      // 1. Busca cotação na coleção cotacoes ou orcamentos_comparativos
      let cotSnap = await getDoc(doc(db, 'cotacoes', id))
      let colecaoOrigem = 'cotacoes'

      if (!cotSnap.exists()) {
        cotSnap = await getDoc(doc(db, 'orcamentos_comparativos', id))
        colecaoOrigem = 'orcamentos_comparativos'
      }

      if (!cotSnap.exists()) {
        setErro('Orçamento ou cotação não encontrada no sistema.')
        return
      }

      const cotData = { id: cotSnap.id, ...cotSnap.data(), _colecaoOrigem: colecaoOrigem }
      setCotacao(cotData)

      // 2. Busca dados do condomínio para pegar os conselheiros e alçada
      const condoNome = cotData.condominio || ''
      if (condoNome) {
        const q = query(collection(db, 'condominios'), where('nome', '==', condoNome))
        const cSnap = await getDocs(q)
        if (!cSnap.empty) {
          const cData = { id: cSnap.docs[0].id, ...cSnap.docs[0].data() }
          setCondo(cData)

          // 3. Identifica o conselheiro pelo parâmetro ?c=1,2,3 ou ?tel=...
          if (cIndex === '1' && cData.conselheiro1_nome) {
            setConselheiroSelecionado({
              indice: 1,
              nome: cData.conselheiro1_nome,
              whatsapp: cData.conselheiro1_whatsapp
            })
          } else if (cIndex === '2' && cData.conselheiro2_nome) {
            setConselheiroSelecionado({
              indice: 2,
              nome: cData.conselheiro2_nome,
              whatsapp: cData.conselheiro2_whatsapp
            })
          } else if (cIndex === '3' && cData.conselheiro3_nome) {
            setConselheiroSelecionado({
              indice: 3,
              nome: cData.conselheiro3_nome,
              whatsapp: cData.conselheiro3_whatsapp
            })
          } else if (telParam) {
            const cleanTel = telParam.replace(/\D/g, '')
            if (cData.conselheiro1_whatsapp?.includes(cleanTel)) {
              setConselheiroSelecionado({ indice: 1, nome: cData.conselheiro1_nome, whatsapp: cData.conselheiro1_whatsapp })
            } else if (cData.conselheiro2_whatsapp?.includes(cleanTel)) {
              setConselheiroSelecionado({ indice: 2, nome: cData.conselheiro2_nome, whatsapp: cData.conselheiro2_whatsapp })
            } else if (cData.conselheiro3_whatsapp?.includes(cleanTel)) {
              setConselheiroSelecionado({ indice: 3, nome: cData.conselheiro3_nome, whatsapp: cData.conselheiro3_whatsapp })
            }
          }
        }
      }
    } catch (err) {
      console.error('Erro ao carregar dados da cotação:', err)
      setErro('Falha ao carregar as informações. Tente novamente mais tarde.')
    } finally {
      setLoading(false)
    }
  }

  // Lista de conselheiros disponíveis no condomínio
  const conselheirosDisponiveis = []
  if (condo?.conselheiro1_nome) conselheirosDisponiveis.push({ indice: 1, nome: condo.conselheiro1_nome, whatsapp: condo.conselheiro1_whatsapp })
  if (condo?.conselheiro2_nome) conselheirosDisponiveis.push({ indice: 2, nome: condo.conselheiro2_nome, whatsapp: condo.conselheiro2_whatsapp })
  if (condo?.conselheiro3_nome) conselheirosDisponiveis.push({ indice: 3, nome: condo.conselheiro3_nome, whatsapp: condo.conselheiro3_whatsapp })

  // Votos já registrados
  const votos = cotacao?.votosConselho || []
  const quorum = Number(condo?.quorumConselho) || 2

  // Verifica se o conselheiro atual já votou
  const meuVoto = conselheiroSelecionado 
    ? votos.find(v => v.indice === conselheiroSelecionado.indice || v.nome === conselheiroSelecionado.nome)
    : null

  const votosAprovados = votos.filter(v => v.decisao === 'APROVADO')
  const votosRejeitados = votos.filter(v => v.decisao === 'REJEITADO')
  const atingiuQuorum = votosAprovados.length >= quorum

  // Identifica a melhor proposta ou fornecedor selecionado
  const fornecedores = cotacao?.fornecedores || []
  const vencedor = fornecedores.find(f => f.vencedor) || fornecedores[0] || null
  const valorExibicao = cotacao?.valorFinalAprovado || vencedor?.valorTotal || cotacao?.valor || 0
  const valorFmt = Number(valorExibicao || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const handleVotar = async (decisao) => {
    if (!conselheiroSelecionado) {
      alert('Por favor, identifique qual conselheiro você é antes de votar.')
      return
    }

    const confirmMsg = decisao === 'APROVADO'
      ? `Confirmar a APROVAÇÃO deste orçamento no valor de R$ ${valorFmt}?`
      : 'Deseja REJEITAR ou solicitar revisão deste orçamento?'

    if (!window.confirm(confirmMsg)) return

    try {
      setEnviandoVoto(true)
      const agora = new Date()
      const novoVoto = {
        indice: conselheiroSelecionado.indice,
        nome: conselheiroSelecionado.nome,
        whatsapp: conselheiroSelecionado.whatsapp || '',
        decisao,
        justificativa: justificativa.trim(),
        dataHora: agora.toISOString(),
        dataFmt: agora.toLocaleString('pt-BR')
      }

      // Atualiza array de votos (substitui se já existir para este conselheiro)
      const outrosVotos = votos.filter(v => v.indice !== conselheiroSelecionado.indice && v.nome !== conselheiroSelecionado.nome)
      const novosVotos = [...outrosVotos, novoVoto]
      
      const novosAprovados = novosVotos.filter(v => v.decisao === 'APROVADO')
      const vaiAtingirQuorum = novosAprovados.length >= quorum

      const updates = {
        votosConselho: novosVotos,
        ultimoVotoEm: agora.toISOString()
      }

      if (vaiAtingirQuorum) {
        updates.status = 'Aprovada pelo Conselho'
        updates.dataAprovacaoConselho = agora.toISOString()
      } else if (novosVotos.length >= 3 && novosAprovados.length < quorum) {
        updates.status = 'Rejeitada pelo Conselho'
      }

      // Salva no Firestore
      const col = cotacao._colecaoOrigem || 'cotacoes'
      await updateDoc(doc(db, col, cotacao.id), updates)

      // Atualiza estado local
      setCotacao(prev => ({ ...prev, ...updates }))
      setSucesso({
        decisao,
        atingiuQuorum: vaiAtingirQuorum,
        mensagem: decisao === 'APROVADO'
          ? (vaiAtingirQuorum 
              ? '🎉 Seu voto foi computado! O Quórum do Conselho foi atingido e o orçamento está APROVADO.' 
              : `✅ Seu voto de aprovação foi registrado com sucesso! (${novosAprovados.length}/${quorum} aprovações necessárias)`)
          : '⚠️ Seu voto de rejeição/revisão foi registrado com sucesso.'
      })

      // Se atingiu o quórum, dispara notificação no WhatsApp do Síndico do Condomínio!
      if (vaiAtingirQuorum) {
        const telSindico = condo?.sindicoTelefone || condo?.sindicoWhatsapp || ''
        if (telSindico) {
          const nomesAprovadores = novosAprovados.map(a => a.nome).join(', ')
          const msgSindico = `🏛️ *ALPHA SOLUÇÕES CONDOMINIAIS*\n*Orçamento Aprovado pelo Conselho Fiscal!*\n\nOlá, Síndico(a) *${condo.sindico || 'do Condomínio'}*!\n\nInformamos que o Conselho Fiscal do *${condo.nome}* acaba de aprovar o orçamento solicitado:\n\n📋 *Serviço:* ${cotacao.titulo || cotacao.descricao || 'Cotação #' + (cotacao.numero || '')}\n🏆 *Fornecedor Escolhido:* ${vencedor?.nome || 'Fornecedor Aprovado'}\n💰 *Valor Aprovado:* R$ ${valorFmt}\n🗳️ *Quórum:* Aprovado por *${novosAprovados.length} conselheiros* (${nomesAprovadores})\n\n✅ *Status:* Despesa formalmente autorizada para contratação e execução.\n\nAtenciosamente,\n*Alpha Soluções Condominiais*`

          enviarMensagemWhatsApp({
            number: telSindico,
            text: msgSindico,
            instance: 'InstanciaAlpha'
          }).then(res => {
            console.log('Notificação enviada ao síndico com sucesso:', res)
          }).catch(e => {
            console.warn('Aviso: falha ao disparar WhatsApp do síndico:', e)
          })
        }
      }
    } catch (err) {
      console.error('Erro ao registrar voto do conselho:', err)
      alert('Erro ao gravar o voto: ' + err.message)
    } finally {
      setEnviandoVoto(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold text-gray-700">Carregando parecer do Conselho Fiscal...</p>
      </div>
    )
  }

  if (erro) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white max-w-md w-full p-6 rounded-3xl shadow-xl border border-gray-200 text-center">
          <AlertTriangle className="text-amber-500 mx-auto mb-3" size={48} />
          <h2 className="text-lg font-black text-gray-900 mb-2">Ops! Algo deu errado</h2>
          <p className="text-xs text-gray-600 mb-6">{erro}</p>
          <a href="https://alphaadmsc.com.br" className="btn-secondary w-full py-2.5 text-xs font-bold inline-block">
            Voltar à Página Principal
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Topo institucional Alpha */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white font-black text-sm shadow-md">
              A
            </div>
            <div>
              <h1 className="font-black text-slate-900 text-sm tracking-tight">Alpha Soluções Condominiais</h1>
              <p className="text-[10px] text-purple-700 font-bold uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck size={12} /> Portal de Aprovação do Conselho Fiscal
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
            Oficial
          </span>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-3xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-5 flex-1">
        {/* Banner do Condomínio e Alçada */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 rounded-3xl shadow-lg border border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="text-purple-400" size={18} />
              <h2 className="text-base sm:text-lg font-black tracking-tight">{condo?.nome || cotacao?.condominio}</h2>
            </div>
            <p className="text-xs text-slate-300">
              Cotação nº <strong>{cotacao?.numero || cotacao?.id?.slice(0, 8)}</strong> • Parecer formal de prestadores
            </p>
          </div>
          <div className="text-left sm:text-right bg-white/10 p-3 rounded-2xl border border-white/10 shrink-0">
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">Alçada do Condomínio</span>
            <span className="text-sm font-black text-emerald-400">
              Acima de R$ {Number(condo?.limiteAlcada || 800).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Termômetro de Votação do Conselho */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck size={16} className="text-purple-600" /> Quórum de Aprovação
            </span>
            <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
              atingiuQuorum 
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                : 'bg-amber-100 text-amber-800 border border-amber-300'
            }`}>
              {atingiuQuorum ? '✅ Quórum Atingido (Aprovado)' : `Aguardando Votos (${votosAprovados.length}/${quorum})`}
            </span>
          </div>

          <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden mb-3">
            <div 
              className={`h-full transition-all duration-500 ${atingiuQuorum ? 'bg-emerald-500' : 'bg-purple-600'}`}
              style={{ width: `${Math.min(100, (votosAprovados.length / quorum) * 100)}%` }}
            />
          </div>

          {/* Votos já computados */}
          {votos.length > 0 ? (
            <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-gray-100">
              <p className="text-[11px] font-bold text-gray-500">Histórico de Votos Registrados:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {votos.map((v, i) => (
                  <div key={i} className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                    v.decisao === 'APROVADO' ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' : 'bg-rose-50/70 border-rose-200 text-rose-900'
                  }`}>
                    <div>
                      <p className="font-black">{v.nome} (Conselheiro {v.indice})</p>
                      <p className="text-[10px] opacity-75">{v.dataFmt || new Date(v.dataHora).toLocaleString('pt-BR')}</p>
                      {v.justificativa && <p className="text-[10px] mt-0.5 italic">"{v.justificativa}"</p>}
                    </div>
                    <span className="font-black text-xs shrink-0">
                      {v.decisao === 'APROVADO' ? '✅ Aprovou' : '❌ Rejeitou'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-gray-400 italic">Nenhum voto registrado até o momento.</p>
          )}
        </div>

        {/* Resumo da Despesa / Obra */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-200 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                {cotacao?.categoria || 'Manutenção & Obras'}
              </span>
              <h3 className="text-base sm:text-lg font-black text-gray-900 mt-1">
                {cotacao?.titulo || cotacao?.descricao || 'Serviço / Aquisição Condominial'}
              </h3>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] font-bold text-gray-400 block uppercase">Valor do Orçamento</span>
              <span className="text-lg sm:text-xl font-black text-slate-900">
                R$ {valorFmt}
              </span>
            </div>
          </div>

          {cotacao?.observacoes && (
            <p className="text-xs text-gray-600 bg-slate-50 p-3 rounded-xl border border-gray-100 leading-relaxed">
              <strong>Detalhes:</strong> {cotacao.observacoes}
            </p>
          )}

          {/* Melhor Proposta Recomendada */}
          {vencedor && (
            <div className="mt-2 p-4 bg-emerald-50/60 border border-emerald-300 rounded-2xl flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-emerald-900 flex items-center gap-1.5 uppercase tracking-wide">
                  <Award size={16} className="text-emerald-700" /> Proposta Vencedora / Selecionada
                </span>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                  Melhor Custo-Benefício
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-1">
                <div>
                  <h4 className="text-sm font-black text-gray-900">{vencedor.nome || vencedor.fornecedor}</h4>
                  <p className="text-xs text-gray-600">
                    Prazo: <strong>{vencedor.prazo || cotacao?.prazoDesejado || 'A combinar'}</strong> • Condição: <strong>{vencedor.condicaoPagamento || 'Boleto / Pix'}</strong>
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-base font-black text-emerald-700">
                    R$ {Number(vencedor.valorTotal || valorExibicao).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Comparativo de Outros Fornecedores Cotados */}
          {fornecedores.length > 1 && (
            <div className="mt-3">
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                Comparativo de Todas as Propostas Coletadas:
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {fornecedores.map((f, idx) => (
                  <div key={idx} className={`p-3 rounded-2xl border text-xs flex flex-col justify-between gap-2 ${
                    f.vencedor || f === vencedor ? 'bg-emerald-50/40 border-emerald-300' : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div>
                      <p className="font-black text-gray-900">{f.nome || f.fornecedor || `Fornecedor ${idx + 1}`}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">Prazo: {f.prazo || 'Padrão'}</p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-gray-200/60">
                      <span className="font-black text-sm text-gray-900">
                        R$ {Number(f.valorTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      {f.vencedor || f === vencedor ? (
                        <span className="text-[10px] font-bold text-emerald-700">★ Escolhido</span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Identificação e Área de Votação do Conselheiro */}
        <div className="bg-white p-5 rounded-3xl shadow-md border-2 border-purple-200 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h3 className="font-black text-gray-900 text-sm sm:text-base flex items-center gap-2">
                <ShieldCheck className="text-purple-700" size={18} /> Seu Parecer como Conselheiro Fiscal
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Seu voto fica gravado na ata digital e notifica o síndico automaticamente.
              </p>
            </div>
          </div>

          {/* Seleção do Conselheiro (se não veio pré-identificado) */}
          <div>
            <label className="label text-xs font-bold text-gray-700">Identificação do Conselheiro(a):</label>
            {conselheirosDisponiveis.length > 0 ? (
              <select 
                className="input text-xs font-bold text-purple-950 bg-purple-50/50 border-purple-200"
                value={conselheiroSelecionado?.indice || ''}
                onChange={e => {
                  const sel = conselheirosDisponiveis.find(c => String(c.indice) === e.target.value)
                  setConselheiroSelecionado(sel || null)
                }}
              >
                <option value="">Selecione o seu nome na lista...</option>
                {conselheirosDisponiveis.map(c => (
                  <option key={c.indice} value={c.indice}>
                    {c.nome} (Conselheiro {c.indice}) {c.whatsapp ? `• ${c.whatsapp}` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                Nenhum conselheiro cadastrado no condomínio. Cadastre em Condomínios no painel.
              </p>
            )}
          </div>

          {/* Se este conselheiro já votou */}
          {meuVoto ? (
            <div className={`p-4 rounded-2xl border flex items-center gap-3 ${
              meuVoto.decisao === 'APROVADO' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-rose-50 border-rose-300 text-rose-900'
            }`}>
              {meuVoto.decisao === 'APROVADO' ? <CheckCircle2 className="text-emerald-600 shrink-0" size={24} /> : <XCircle className="text-rose-600 shrink-0" size={24} />}
              <div>
                <p className="font-black text-sm">
                  Você já registrou seu voto como: {meuVoto.decisao === 'APROVADO' ? 'APROVADO ✅' : 'REJEITADO ❌'}
                </p>
                <p className="text-xs opacity-80 mt-0.5">
                  Registrado em {meuVoto.dataFmt || new Date(meuVoto.dataHora).toLocaleString('pt-BR')}
                </p>
                {meuVoto.justificativa && <p className="text-xs mt-1 italic">Sua observação: "{meuVoto.justificativa}"</p>}
              </div>
            </div>
          ) : (
            <>
              {/* Campo de Justificativa Opcional */}
              <div>
                <label className="label text-xs font-bold text-gray-700">Observação / Justificativa (Opcional):</label>
                <textarea 
                  className="input text-xs h-20 resize-none"
                  value={justificativa}
                  onChange={e => setJustificativa(e.target.value)}
                  placeholder="Ex: De acordo com a proposta da HidroTech por apresentar garantia de 12 meses..."
                />
              </div>

              {/* Botões de Decisão */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleVotar('APROVADO')}
                  disabled={enviandoVoto || !conselheiroSelecionado}
                  className="btn-primary bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm py-3 px-4 rounded-2xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                >
                  <CheckCircle2 size={18} />
                  {enviandoVoto ? 'Gravando Voto...' : 'Aprovar Orçamento'}
                </button>

                <button
                  type="button"
                  onClick={() => handleVotar('REJEITADO')}
                  disabled={enviandoVoto || !conselheiroSelecionado}
                  className="btn-secondary border-rose-300 text-rose-700 bg-rose-50 hover:bg-rose-100 font-bold text-sm py-3 px-4 rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                >
                  <XCircle size={18} />
                  {enviandoVoto ? 'Gravando...' : 'Rejeitar / Solicitar Revisão'}
                </button>
              </div>
            </>
          )}

          {sucesso && (
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900 font-bold flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="text-purple-600 shrink-0" size={16} />
              <span>{sucesso.mensagem}</span>
            </div>
          )}
        </div>
      </main>

      {/* Rodapé institucional */}
      <footer className="bg-white border-t border-gray-200 py-4 px-4 text-center text-xs text-gray-400">
        <p>© {new Date().getFullYear()} Alpha Soluções Condominiais • Governança, Transparência &amp; Tecnologia</p>
      </footer>
    </div>
  )
}
