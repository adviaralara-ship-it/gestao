import React, { useState, useEffect, useMemo } from 'react'
import {
  X, Bell, CheckSquare, Square, Calendar, DollarSign, Wrench, Send,
  Building2, User, Phone, CheckCircle2, AlertTriangle, RefreshCw, Plus, Trash2, Edit3, Eye
} from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { enviarMensagemWhatsApp } from '../utils/whatsappAutomacao'
import { serverTimestamp } from 'firebase/firestore'

const fmtBRL = (v) => {
  return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const normalizarParaIso = (val) => {
  if (!val) return ''
  const s = String(val).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10)
  const brMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (brMatch) {
    const dia = brMatch[1].padStart(2, '0')
    const mes = brMatch[2].padStart(2, '0')
    const ano = brMatch[3]
    return `${ano}-${mes}-${dia}`
  }
  return ''
}

const isAlphaInterno = (condo) => {
  if (!condo) return true
  const c = String(condo).toLowerCase().trim()
  return c.includes('alpha') || c === 'interno' || c === 'administração' || c === 'administracao' || c === 'matriz' || c.includes('uso interno')
}

export default function ModalLembretesDoDia({ isOpen, onClose, initialTab = 'todas' }) {
  const { items: tarefas, updateItem: updateTarefa } = useFirestore('tarefas')
  const { items: lancamentos } = useFirestore('financeiro_lancamentos')
  const { items: manutencoes, updateItem: updateManutencao } = useFirestore('manutencoes')
  const { items: usuarios } = useFirestore('usuarios')
  const { addItem: addNotificacao } = useFirestore('notificacoes')

  // Data atual no fuso de Brasília
  const agora = new Date()
  const brDateStr = agora.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const [d, m, y] = brDateStr.split('/')
  const hojeStr = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  const dataFmt = `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`

  const [filtroData, setFiltroData] = useState('hoje') // 'hoje' | 'todos_pendentes'
  const [activeTab, setActiveTab] = useState(initialTab) // 'todas' | 'tarefas' | 'contas' | 'manutencoes'
  const [enviando, setEnviando] = useState(false)
  const [previewCustom, setPreviewCustom] = useState(false)
  const [customTexto, setCustomTexto] = useState('')

  // Itens filtrados
  const tarefasFiltradas = useMemo(() => {
    return tarefas.filter(t => {
      const isDone = t.coluna === 'Concluído' || t.coluna === 'concluido' || t.status === 'Concluído'
      if (isDone) return false
      const venc = normalizarParaIso(t.vencimento || t.data)
      if (filtroData === 'hoje') return venc === hojeStr
      return true
    })
  }, [tarefas, filtroData, hojeStr])

  const contasFiltradas = useMemo(() => {
    return lancamentos.filter(item => {
      const isDespesa = item.tipo === 'Despesa' || (item.categoria && String(item.categoria).toLowerCase().includes('despesa'))
      if (!isDespesa) return false
      const pago = item.status === 'Pago' || item.status === 'Liquidado' || item.pago === true
      if (pago) return false
      const venc = normalizarParaIso(item.vencimento || item.data)
      if (filtroData === 'hoje') return venc === hojeStr
      return true
    })
  }, [lancamentos, filtroData, hojeStr])

  const manutencoesFiltradas = useMemo(() => {
    return manutencoes.filter(m => {
      const isDone = m.status === 'Concluída' || m.status === 'concluida'
      if (isDone) return false
      const venc = normalizarParaIso(m.dataPrevista || m.data || m.proxima_data)
      if (filtroData === 'hoje') return venc === hojeStr
      return true
    })
  }, [manutencoes, filtroData, hojeStr])

  // Conjuntos de IDs selecionados
  const [selTarefas, setSelTarefas] = useState(new Set())
  const [selContas, setSelContas] = useState(new Set())
  const [selManutencoes, setSelManutencoes] = useState(new Set())

  // Telefones destinatários selecionados
  const [telefones, setTelefones] = useState([])
  const [novoNumero, setNovoNumero] = useState('')

  // Inicializa seleções quando abre o modal
  useEffect(() => {
    setSelTarefas(new Set(tarefasFiltradas.map(t => t.id)))
    setSelContas(new Set(contasFiltradas.map(c => c.id)))
    setSelManutencoes(new Set(manutencoesFiltradas.map(m => m.id)))
  }, [tarefasFiltradas.length, contasFiltradas.length, manutencoesFiltradas.length, filtroData])

  // Inicializa lista de telefones
  useEffect(() => {
    const tels = [
      { id: '1', numero: '5583996885931', nome: 'WhatsApp Oficial Alpha', selecionado: true },
      { id: '2', numero: '5583996806325', nome: 'Iara Lara (Administração)', selecionado: true },
      { id: '3', numero: '5583999797285', nome: 'Administração 2', selecionado: true },
      { id: '4', numero: '5583998350321', nome: 'Gestão / Financeiro', selecionado: true },
      { id: '5', numero: '5583998468997', nome: 'Diretoria / Coordenação', selecionado: true },
    ]

    usuarios.forEach(u => {
      const role = String(u.role || '').toLowerCase()
      if (role.includes('admin') || role.includes('financeiro')) {
        const raw = u.tel || u.telefone || u.whatsapp || u.celular || ''
        const clean = String(raw).replace(/\D/g, '')
        if (clean.length >= 8) {
          const finalNum = clean.startsWith('55') ? clean : `55${clean}`
          if (!tels.some(x => x.numero === finalNum)) {
            tels.push({ id: u.id, numero: finalNum, nome: `${u.nome || 'Usuário'} (${u.role || 'Gestor'})`, selecionado: true })
          }
        }
      }
    })

    setTelefones(tels)
  }, [usuarios.length])

  // Alternadores de seleção individual
  const toggleTarefa = (id) => {
    setSelTarefas(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleConta = (id) => {
    setSelContas(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleManutencao = (id) => {
    setSelManutencoes(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleTodos = (tipo) => {
    if (tipo === 'tarefas') {
      if (selTarefas.size === tarefasFiltradas.length) setSelTarefas(new Set())
      else setSelTarefas(new Set(tarefasFiltradas.map(t => t.id)))
    } else if (tipo === 'contas') {
      if (selContas.size === contasFiltradas.length) setSelContas(new Set())
      else setSelContas(new Set(contasFiltradas.map(c => c.id)))
    } else if (tipo === 'manutencoes') {
      if (selManutencoes.size === manutencoesFiltradas.length) setSelManutencoes(new Set())
      else setSelManutencoes(new Set(manutencoesFiltradas.map(m => m.id)))
    }
  }

  // Montagem da mensagem selecionada em tempo real
  const mensagemGerada = useMemo(() => {
    const tarSel = tarefasFiltradas.filter(t => selTarefas.has(t.id))
    const conSel = contasFiltradas.filter(c => selContas.has(c.id))
    const manSel = manutencoesFiltradas.filter(m => selManutencoes.has(m.id))

    let txt = `🔔 *LEMBRETE DO DIA - ALPHA GESTÃO (${dataFmt})*\n\n`

    // Seção Agenda
    if (tarSel.length > 0) {
      txt += `📋 *AGENDA & TAREFAS DE HOJE (${tarSel.length}):*\n`
      tarSel.forEach((t, i) => {
        const horaStr = t.hora ? ` às ${t.hora}` : ''
        const prioStr = t.prioridade ? ` [${t.prioridade}]` : ''
        const respStr = t.responsavel ? ` - Resp: ${t.responsavel}` : ''
        txt += `  ${i + 1}. *${t.titulo}*${horaStr}${prioStr}${respStr}\n`
        if (t.descricao && t.descricao.trim()) txt += `     _${t.descricao.trim()}_\n`
      })
      txt += `\n`
    }

    // Seção Contas
    if (conSel.length > 0) {
      const alphaInterno = conSel.filter(c => isAlphaInterno(c.condominio))
      const condos = conSel.filter(c => !isAlphaInterno(c.condominio))

      txt += `💰 *CONTAS A PAGAR VENCENDO HOJE (${conSel.length}):*\n`

      if (alphaInterno.length > 0) {
        const totAlpha = alphaInterno.reduce((acc, c) => acc + (parseFloat(c.valor) || 0), 0)
        txt += `🏢 *Alpha Interno* (R$ ${fmtBRL(totAlpha)}):\n`
        alphaInterno.forEach(c => {
          const val = parseFloat(c.valor) || 0
          const catStr = c.categoria ? ` (${c.categoria})` : ''
          txt += `  • *${c.descricao || 'Despesa'}*: R$ ${fmtBRL(val)}${catStr}\n`
        })
      }

      if (condos.length > 0) {
        const contasPorCondo = {}
        condos.forEach(c => {
          const nome = c.condominio || 'Sem Condomínio'
          if (!contasPorCondo[nome]) contasPorCondo[nome] = []
          contasPorCondo[nome].push(c)
        })

        txt += `🏘️ *Condomínios Administrados:*\n`
        Object.keys(contasPorCondo).sort().forEach(condoNome => {
          const lista = contasPorCondo[condoNome]
          const subtotal = lista.reduce((acc, c) => acc + (parseFloat(c.valor) || 0), 0)
          txt += `  📍 *${condoNome.toUpperCase()}* (${lista.length} conta(s) - R$ ${fmtBRL(subtotal)}):\n`
          lista.forEach(c => {
            const val = parseFloat(c.valor) || 0
            const catStr = c.categoria ? ` (${c.categoria})` : ''
            txt += `    - ${c.descricao || 'Despesa'}: R$ ${fmtBRL(val)}${catStr}\n`
          })
        })
      }
      txt += `\n`
    }

    // Seção Manutenções
    if (manSel.length > 0) {
      txt += `🛠️ *MANUTENÇÕES PROGRAMADAS PARA HOJE (${manSel.length}):*\n`
      manSel.forEach((m, i) => {
        const condoStr = m.condominio ? ` no *${m.condominio}*` : ''
        const fornStr = m.fornecedor ? ` | Prestador: ${m.fornecedor}` : ''
        const custoStr = m.custoEstimado ? ` | Prev: R$ ${fmtBRL(m.custoEstimado)}` : ''
        txt += `  ${i + 1}. *${m.titulo}*${condoStr}${fornStr}${custoStr}\n`
        if (m.descricao && m.descricao.trim()) txt += `     _${m.descricao.trim()}_\n`
      })
      txt += `\n`
    }

    txt += `🔗 *Acessar Sistema Alpha:* https://app.alphaadmsc.com.br`
    return txt
  }, [tarefasFiltradas, selTarefas, contasFiltradas, selContas, manutencoesFiltradas, selManutencoes, dataFmt])

  // Total de itens selecionados
  const totalSelecionados = selTarefas.size + selContas.size + selManutencoes.size

  // Disparar envio
  const handleDisparar = async () => {
    if (totalSelecionados === 0) {
      alert('Selecione pelo menos um item (tarefa, conta ou manutenção) para enviar o lembrete.')
      return
    }

    const destinatarios = telefones.filter(t => t.selecionado)
    if (destinatarios.length === 0) {
      alert('Selecione pelo menos um número de telefone destinatário.')
      return
    }

    const textoFinal = previewCustom && customTexto.trim() ? customTexto : mensagemGerada

    if (!window.confirm(`Deseja disparar agora o lembrete de ${totalSelecionados} item(ns) para ${destinatarios.length} número(s) no WhatsApp?`)) {
      return
    }

    setEnviando(true)

    try {
      // 1. Grava no Sininho
      try {
        await addNotificacao({
          titulo: `🔔 Lembretes Selecionados (${dataFmt})`,
          text: `Agenda: ${selTarefas.size} tarefa(s) | Contas: ${selContas.size} a pagar | Manutenções: ${selManutencoes.size} programadas.`,
          detalhes: textoFinal,
          time: new Date().toISOString(),
          tipo: 'lembrete_do_dia',
          condominio: 'Todos',
          lida: false,
          link: '/dashboard',
          _createdAt: serverTimestamp()
        })
      } catch (errNotif) {
        console.warn('Erro ao salvar no Firestore:', errNotif)
      }

      // 2. Dispara WhatsApp
      let sucessos = 0
      for (const dest of destinatarios) {
        try {
          const resp = await enviarMensagemWhatsApp({
            number: dest.numero,
            text: textoFinal,
            instance: 'InstanciaAlpha'
          })
          if (resp && resp.success) sucessos++
        } catch (err) {
          console.warn('Falha no envio para:', dest.numero, err)
        }
      }

      // 3. Atualiza status nas tarefas e manutenções selecionadas
      for (const id of selTarefas) {
        try {
          await updateTarefa(id, {
            lembreteHojeEnviado: hojeStr,
            dataUltimoLembrete: new Date().toISOString()
          })
        } catch (e) {}
      }

      for (const id of selManutencoes) {
        try {
          await updateManutencao(id, {
            notifD0: hojeStr,
            lembreteHojeEnviadoEm: hojeStr
          })
        } catch (e) {}
      }

      alert(`✅ Lembretes disparados com sucesso!\n\n📋 Tarefas: ${selTarefas.size}\n💰 Contas: ${selContas.size}\n🛠️ Manutenções: ${selManutencoes.size}\n📲 Enviado para ${sucessos} número(s) no WhatsApp.`)
      onClose()
    } catch (error) {
      alert(`Erro no disparo: ${error.message}`)
    } finally {
      setEnviando(false)
    }
  }

  const handleAddNumero = () => {
    const clean = novoNumero.replace(/\D/g, '')
    if (clean.length < 8) {
      alert('Digite um número válido com DDD.')
      return
    }
    const finalNum = clean.startsWith('55') ? clean : `55${clean}`
    setTelefones(prev => [
      ...prev,
      { id: String(Date.now()), numero: finalNum, nome: `Número Manual (${finalNum})`, selecionado: true }
    ])
    setNovoNumero('')
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-4xl p-0 overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        {/* Topo do Modal */}
        <div className="bg-gradient-to-r from-emerald-700 via-emerald-800 to-teal-900 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl shadow-inner border border-white/20">
              🔔
            </div>
            <div>
              <h3 className="text-lg font-black tracking-wide">Selecionar Lembretes de Hoje</h3>
              <p className="text-xs text-emerald-100 font-medium">
                Escolha quais tarefas, contas e manutenções serão enviadas no WhatsApp ({dataFmt})
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Barra de Filtro de Data e Abas */}
        <div className="p-3 bg-slate-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-gray-200 text-xs font-bold shadow-2xs">
            <button
              onClick={() => setActiveTab('todas')}
              className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === 'todas' ? 'bg-emerald-600 text-white shadow-xs' : 'text-gray-600 hover:text-emerald-700'}`}
            >
              Todos ({totalSelecionados})
            </button>
            <button
              onClick={() => setActiveTab('tarefas')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all ${activeTab === 'tarefas' ? 'bg-emerald-600 text-white shadow-xs' : 'text-gray-600 hover:text-emerald-700'}`}
            >
              <Calendar size={13} /> Agenda ({selTarefas.size}/{tarefasFiltradas.length})
            </button>
            <button
              onClick={() => setActiveTab('contas')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all ${activeTab === 'contas' ? 'bg-emerald-600 text-white shadow-xs' : 'text-gray-600 hover:text-emerald-700'}`}
            >
              <DollarSign size={13} /> Contas ({selContas.size}/{contasFiltradas.length})
            </button>
            <button
              onClick={() => setActiveTab('manutencoes')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all ${activeTab === 'manutencoes' ? 'bg-emerald-600 text-white shadow-xs' : 'text-gray-600 hover:text-emerald-700'}`}
            >
              <Wrench size={13} /> Manutenções ({selManutencoes.size}/{manutencoesFiltradas.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-bold">Exibir:</span>
            <select
              value={filtroData}
              onChange={e => setFiltroData(e.target.value)}
              className="input py-1 text-xs font-bold w-auto bg-white"
            >
              <option value="hoje">📅 Apenas de Hoje ({dataFmt})</option>
              <option value="todos_pendentes">⏳ Todas Pendentes / Agendadas</option>
            </select>
          </div>
        </div>

        {/* Corpo com Grid de Seleção e Prévia da Mensagem */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Coluna da Esquerda: Listas de Seleção (7 colunas) */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            {/* 1. SEÇÃO AGENDA & TAREFAS */}
            {(activeTab === 'todas' || activeTab === 'tarefas') && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-2xs">
                <div className="p-3 bg-blue-50/80 border-b border-blue-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-blue-700" />
                    <span className="text-xs font-black text-blue-900 uppercase tracking-wide">
                      Agenda & Compromissos de Hoje ({tarefasFiltradas.length})
                    </span>
                  </div>
                  <button
                    onClick={() => toggleTodos('tarefas')}
                    className="text-[11px] font-bold text-blue-700 hover:text-blue-900 underline cursor-pointer"
                  >
                    {selTarefas.size === tarefasFiltradas.length ? 'Desmarcar Todas' : 'Marcar Todas'}
                  </button>
                </div>

                <div className="p-3 flex flex-col gap-2 max-h-56 overflow-y-auto">
                  {tarefasFiltradas.length === 0 ? (
                    <p className="text-xs text-gray-400 italic py-2 text-center">Nenhuma tarefa agendada para hoje.</p>
                  ) : (
                    tarefasFiltradas.map(t => {
                      const isSel = selTarefas.has(t.id)
                      return (
                        <div
                          key={t.id}
                          onClick={() => toggleTarefa(t.id)}
                          className={`p-2.5 rounded-xl border flex items-start gap-2.5 transition-all cursor-pointer ${isSel ? 'bg-blue-50/40 border-blue-300' : 'bg-slate-50 border-gray-200 opacity-60'}`}
                        >
                          <input
                            type="checkbox"
                            checked={isSel}
                            onChange={() => {}}
                            className="w-4 h-4 rounded text-blue-600 mt-0.5 pointer-events-none"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-gray-800 leading-snug">{t.titulo}</p>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-500 flex-wrap">
                              {t.hora && <span className="bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded">⏰ {t.hora}</span>}
                              {t.prioridade && <span className="bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">{t.prioridade}</span>}
                              {t.responsavel && <span>👤 {t.responsavel}</span>}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}

            {/* 2. SEÇÃO CONTAS A PAGAR VENCENDO HOJE */}
            {(activeTab === 'todas' || activeTab === 'contas') && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-2xs">
                <div className="p-3 bg-amber-50/80 border-b border-amber-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign size={16} className="text-amber-700" />
                    <span className="text-xs font-black text-amber-900 uppercase tracking-wide">
                      Contas a Pagar Vencendo Hoje ({contasFiltradas.length})
                    </span>
                  </div>
                  <button
                    onClick={() => toggleTodos('contas')}
                    className="text-[11px] font-bold text-amber-700 hover:text-amber-900 underline cursor-pointer"
                  >
                    {selContas.size === contasFiltradas.length ? 'Desmarcar Todas' : 'Marcar Todas'}
                  </button>
                </div>

                <div className="p-3 flex flex-col gap-2 max-h-56 overflow-y-auto">
                  {contasFiltradas.length === 0 ? (
                    <p className="text-xs text-gray-400 italic py-2 text-center">Nenhuma conta a pagar vencendo hoje.</p>
                  ) : (
                    contasFiltradas.map(c => {
                      const isSel = selContas.has(c.id)
                      const isInt = isAlphaInterno(c.condominio)
                      return (
                        <div
                          key={c.id}
                          onClick={() => toggleConta(c.id)}
                          className={`p-2.5 rounded-xl border flex items-start gap-2.5 transition-all cursor-pointer ${isSel ? 'bg-amber-50/40 border-amber-300' : 'bg-slate-50 border-gray-200 opacity-60'}`}
                        >
                          <input
                            type="checkbox"
                            checked={isSel}
                            onChange={() => {}}
                            className="w-4 h-4 rounded text-amber-600 mt-0.5 pointer-events-none"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold text-gray-800 leading-snug">{c.descricao || 'Despesa'}</p>
                              <span className="text-xs font-black text-rose-600">R$ {fmtBRL(c.valor)}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-500 flex-wrap">
                              <span className={`px-1.5 py-0.5 rounded font-bold ${isInt ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                {isInt ? 'Alpha Interno' : c.condominio || 'Condomínio'}
                              </span>
                              {c.categoria && <span>📁 {c.categoria}</span>}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}

            {/* 3. SEÇÃO MANUTENÇÕES */}
            {(activeTab === 'todas' || activeTab === 'manutencoes') && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-2xs">
                <div className="p-3 bg-teal-50/80 border-b border-teal-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wrench size={16} className="text-teal-700" />
                    <span className="text-xs font-black text-teal-900 uppercase tracking-wide">
                      Manutenções Programadas para Hoje ({manutencoesFiltradas.length})
                    </span>
                  </div>
                  <button
                    onClick={() => toggleTodos('manutencoes')}
                    className="text-[11px] font-bold text-teal-700 hover:text-teal-900 underline cursor-pointer"
                  >
                    {selManutencoes.size === manutencoesFiltradas.length ? 'Desmarcar Todas' : 'Marcar Todas'}
                  </button>
                </div>

                <div className="p-3 flex flex-col gap-2 max-h-56 overflow-y-auto">
                  {manutencoesFiltradas.length === 0 ? (
                    <p className="text-xs text-gray-400 italic py-2 text-center">Nenhuma manutenção programada para hoje.</p>
                  ) : (
                    manutencoesFiltradas.map(m => {
                      const isSel = selManutencoes.has(m.id)
                      return (
                        <div
                          key={m.id}
                          onClick={() => toggleManutencao(m.id)}
                          className={`p-2.5 rounded-xl border flex items-start gap-2.5 transition-all cursor-pointer ${isSel ? 'bg-teal-50/40 border-teal-300' : 'bg-slate-50 border-gray-200 opacity-60'}`}
                        >
                          <input
                            type="checkbox"
                            checked={isSel}
                            onChange={() => {}}
                            className="w-4 h-4 rounded text-teal-600 mt-0.5 pointer-events-none"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold text-gray-800 leading-snug">{m.titulo}</p>
                              {m.custoEstimado && (
                                <span className="text-xs font-bold text-gray-700">R$ {fmtBRL(m.custoEstimado)}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-500 flex-wrap">
                              <span className="bg-teal-100 text-teal-800 font-bold px-1.5 py-0.5 rounded">
                                🏢 {m.condominio || 'Geral'}
                              </span>
                              {m.fornecedor && <span>🛠️ {m.fornecedor}</span>}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Coluna da Direita: Destinatários e Prévia da Mensagem (5 colunas) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {/* Destinatários WhatsApp */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
              <h4 className="text-xs font-black text-gray-900 uppercase tracking-wide flex items-center gap-1.5 mb-2.5">
                <Phone size={14} className="text-emerald-600" />
                Destinatários do WhatsApp
              </h4>

              <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto mb-3">
                {telefones.map(t => (
                  <label key={t.id} className="flex items-center gap-2 text-xs text-gray-700 font-medium cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg">
                    <input
                      type="checkbox"
                      checked={t.selecionado}
                      onChange={e => {
                        const checked = e.target.checked
                        setTelefones(prev => prev.map(x => x.id === t.id ? { ...x, selecionado: checked } : x))
                      }}
                      className="w-3.5 h-3.5 text-emerald-600 rounded"
                    />
                    <span className="truncate">{t.nome}</span>
                  </label>
                ))}
              </div>

              {/* Inserir número avulso */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="DDD + Número adicional"
                  value={novoNumero}
                  onChange={e => setNovoNumero(e.target.value)}
                  className="input py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddNumero}
                  className="btn-secondary py-1 px-2.5 text-xs font-bold"
                  title="Adicionar telefone"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* Prévia da Mensagem do WhatsApp */}
            <div className="bg-slate-900 text-emerald-300 p-4 rounded-2xl shadow-inner flex flex-col flex-1 min-h-[220px]">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
                <span className="text-[11px] font-bold text-gray-400 flex items-center gap-1">
                  <Eye size={12} /> Prévia da Mensagem (WhatsApp)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewCustom(!previewCustom)
                    if (!previewCustom) setCustomTexto(mensagemGerada)
                  }}
                  className="text-[10px] text-emerald-400 hover:text-emerald-200 underline font-semibold cursor-pointer"
                >
                  {previewCustom ? 'Restaurar Padrão' : 'Personalizar Texto'}
                </button>
              </div>

              {previewCustom ? (
                <textarea
                  className="w-full flex-1 bg-slate-950 text-emerald-300 p-2.5 rounded-xl text-xs font-mono resize-none border border-slate-700 outline-none"
                  value={customTexto}
                  onChange={e => setCustomTexto(e.target.value)}
                />
              ) : (
                <pre className="text-[11px] font-mono leading-relaxed whitespace-pre-wrap flex-1 overflow-y-auto max-h-60 text-slate-200">
                  {totalSelecionados === 0 ? 'Nenhum item selecionado.' : mensagemGerada}
                </pre>
              )}
            </div>
          </div>
        </div>

        {/* Rodapé do Modal com Ações */}
        <div className="p-4 bg-slate-50 border-t border-gray-200 flex items-center justify-between shrink-0">
          <div className="text-xs font-bold text-gray-600">
            Total selecionado: <span className="text-emerald-700 font-black">{totalSelecionados} item(ns)</span>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="btn-secondary py-2 px-4 text-xs font-bold">
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDisparar}
              disabled={enviando || totalSelecionados === 0}
              className="btn-primary py-2 px-5 text-xs font-black bg-emerald-600 hover:bg-emerald-500 shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Send size={15} />
              {enviando ? 'Disparando...' : 'Disparar Selecionados no WhatsApp'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
