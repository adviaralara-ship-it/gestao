import React, { useState, useEffect, useMemo } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { 
  Wrench, Plus, CheckCircle, CheckCircle2, Clock, Trash2, Calendar, AlertCircle, 
  ShoppingBag, ExternalLink, Briefcase, FileText, Printer, Bell, RefreshCw, Check,
  Send, CheckSquare, Square, Share2, ThumbsUp, X, Calculator, MessageSquare
} from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'
import { CurrencyInput } from '../utils/currency'
import { verificarEDispararLembretesManutencao } from '../hooks/useMaintenanceAutoReminder'
import { enviarMensagemWhatsApp, enviarManutencaoWhatsAppGrupo } from '../utils/whatsappAutomacao'
import OrcamentosComparativo from './OrcamentosComparativo'
import SimulacaoRateio from './SimulacaoRateio'

export function calcularProximaData(dataIsoStr, mesesAdicionar) {
  if (!dataIsoStr) return ''
  const parts = String(dataIsoStr).split('-').map(Number)
  if (parts.length !== 3 || isNaN(parts[0])) return dataIsoStr
  const ano = parts[0], mes = parts[1], dia = parts[2]
  const targetMonth = mes - 1 + mesesAdicionar
  const dt = new Date(ano, targetMonth, 1)
  const maxDays = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate()
  const safeDay = Math.min(dia, maxDays)
  dt.setDate(safeDay)
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const d = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function ModalManutencao({ data, condominios, onClose, onSave }) {
  const [form, setForm] = useState(data || {
    titulo: '',
    tipo: 'Manutenção Preventiva',
    fornecedor: '',
    dataPrevista: '',
    custoEstimado: '',
    recorrencia: 'Nenhuma',
    status: 'Agendada',
    descricao: '',
    condominio: '',
    qtdCiclos: 4,
    notificarGrupoAgora: true,
    gerarCiclosFuturos: true
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const selectedCondo = condominios?.find(c => c.nome === form.condominio)
  const temGrupo = Boolean(selectedCondo?.grupoWhatsapp)

  const handleRecorrenciaChange = (novaRec) => {
    let ciclosDefault = 4
    if (novaRec === 'Semestral') ciclosDefault = 4
    else if (novaRec === 'Mensal') ciclosDefault = 12
    else if (novaRec === 'Trimestral') ciclosDefault = 4
    else if (novaRec === 'Anual') ciclosDefault = 3
    setForm(f => ({ ...f, recorrencia: novaRec, qtdCiclos: ciclosDefault }))
  }

  const previewCiclos = useMemo(() => {
    if (!form.dataPrevista || !form.recorrencia || form.recorrencia === 'Nenhuma') return []
    const total = Number(form.qtdCiclos || (form.recorrencia === 'Semestral' ? 4 : form.recorrencia === 'Mensal' ? 12 : form.recorrencia === 'Trimestral' ? 4 : 3))
    const intervalo = form.recorrencia === 'Mensal' ? 1 : form.recorrencia === 'Trimestral' ? 3 : form.recorrencia === 'Semestral' ? 6 : 12
    const list = []
    for (let i = 0; i < total; i++) {
      const dt = calcularProximaData(form.dataPrevista, i * intervalo)
      const dataBr = dt.split('-').reverse().join('/')
      list.push({ ciclo: i + 1, dataIso: dt, dataBr, ehInicial: i === 0 })
    }
    return list
  }, [form.dataPrevista, form.recorrencia, form.qtdCiclos])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">{data ? 'Editar Manutenção / Visita' : 'Agendar Manutenção ou Visita'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Título / Serviço</label>
            <input className="input" value={form.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Ex: Limpeza de Caixa D'água, Vistoria de Bombas..." autoFocus />
          </div>
          <div>
            <label className="label">Natureza / Categoria</label>
            <select className="input font-bold bg-amber-50/70 border-amber-300 text-gray-900" value={form.tipo || 'Manutenção Preventiva'} onChange={e => set('tipo', e.target.value)}>
              <option value="Manutenção Preventiva">🔧 Manutenção Preventiva</option>
              <option value="Visita Técnica">📋 Visita Técnica</option>
              <option value="Manutenção Corretiva">🚨 Manutenção Corretiva</option>
            </select>
          </div>
          <div>
            <label className="label">Condomínio</label>
            <select className="input" value={form.condominio || ''} onChange={e => set('condominio', e.target.value)}>
              <option value="">Todos / Geral</option>
              {condominios?.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">Fornecedor / Prestador Responsável</label>
            <input className="input" value={form.fornecedor} onChange={e => set('fornecedor', e.target.value)} placeholder="Ex: SegurFogo Ltda, Eng. Carlos..." />
          </div>
          <div>
            <label className="label">Data Prevista</label>
            <input type="date" className="input" value={form.dataPrevista} onChange={e => set('dataPrevista', e.target.value)} />
          </div>
          <div>
            <label className="label">Custo Estimado (R$)</label>
            <CurrencyInput value={form.custoEstimado} onChange={v => set('custoEstimado', v)} placeholder="0,00" />
          </div>
          <div>
            <label className="label">Recorrência</label>
            <select className="input font-semibold" value={form.recorrencia || 'Nenhuma'} onChange={e => handleRecorrenciaChange(e.target.value)}>
              <option value="Nenhuma">Nenhuma (Avulsa)</option>
              <option value="Mensal">Mensal (a cada 1 mês)</option>
              <option value="Trimestral">Trimestral (a cada 3 meses)</option>
              <option value="Semestral">Semestral (a cada 6 meses)</option>
              <option value="Anual">Anual (a cada 1 ano)</option>
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
              <option>Agendada</option>
              <option>Em Andamento</option>
              <option>Concluída</option>
            </select>
          </div>

          {/* CRONOGRAMA DE CICLOS FUTUROS (QUANDO HOUVER RECORRÊNCIA) */}
          {form.recorrencia && form.recorrencia !== 'Nenhuma' && (
            <div className="col-span-2 bg-blue-50/70 border border-blue-200 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-black text-blue-950 flex items-center gap-1.5">
                    <Clock size={14} className="text-blue-600" /> Cronograma de Recorrência ({form.recorrencia})
                  </p>
                  <p className="text-[11px] text-blue-700">
                    O sistema registrará automaticamente os ciclos futuros no cronograma do condomínio.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-blue-900 whitespace-nowrap">Qtd. de Ciclos:</label>
                  <select
                    className="input py-1 px-2.5 text-xs bg-white border-blue-300 font-bold"
                    value={form.qtdCiclos || (form.recorrencia === 'Semestral' ? 4 : form.recorrencia === 'Mensal' ? 12 : form.recorrencia === 'Trimestral' ? 4 : 3)}
                    onChange={e => set('qtdCiclos', Number(e.target.value))}
                  >
                    {form.recorrencia === 'Semestral' && (
                      <>
                        <option value={2}>2 semestres (1 ano)</option>
                        <option value={4}>4 semestres (2 anos - Recomendado)</option>
                        <option value={6}>6 semestres (3 anos)</option>
                        <option value={8}>8 semestres (4 anos)</option>
                      </>
                    )}
                    {form.recorrencia === 'Mensal' && (
                      <>
                        <option value={6}>6 meses</option>
                        <option value={12}>12 meses (1 ano - Recomendado)</option>
                        <option value={24}>24 meses (2 anos)</option>
                      </>
                    )}
                    {form.recorrencia === 'Trimestral' && (
                      <>
                        <option value={4}>4 trimestres (1 ano - Recomendado)</option>
                        <option value={8}>8 trimestres (2 anos)</option>
                      </>
                    )}
                    {form.recorrencia === 'Anual' && (
                      <>
                        <option value={2}>2 anos</option>
                        <option value={3}>3 anos (Recomendado)</option>
                        <option value={5}>5 anos</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {previewCiclos.length > 0 && (
                <div className="bg-white rounded-lg p-2.5 border border-blue-100 flex flex-col gap-1.5 text-xs">
                  <span className="font-bold text-gray-600 text-[11px]">
                    📅 Cronograma que será registrado no sistema ({previewCiclos.length} manutenções):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {previewCiclos.map(c => (
                      <span
                        key={c.ciclo}
                        className={`px-2 py-1 rounded-md font-semibold text-[11px] flex items-center gap-1 ${c.ehInicial ? 'bg-blue-600 text-white shadow-xs' : 'bg-blue-50 text-blue-900 border border-blue-200'}`}
                      >
                        {c.ehInicial ? '1º (Inicial):' : `${c.ciclo}º:`} {c.dataBr}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* NOTIFICAR GRUPO DE WHATSAPP DO CONDOMÍNIO */}
          <div className="col-span-2 bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                checked={form.notificarGrupoAgora !== false}
                onChange={e => set('notificarGrupoAgora', e.target.checked)}
              />
              <span className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                <MessageSquare size={14} className="text-emerald-700" />
                Notificar grupo de WhatsApp do condomínio avisando sobre esta manutenção
              </span>
            </label>
            <div className="text-[11px] text-emerald-800 pl-6">
              {form.condominio ? (
                temGrupo ? (
                  <span className="text-emerald-700 font-medium">
                    ✅ Grupo conectado: <b>{selectedCondo.nome}</b>. Uma mensagem oficial da Alpha será disparada para os moradores avisando sobre o serviço.
                  </span>
                ) : (
                  <span className="text-amber-800 font-medium">
                    ⚠️ O condomínio <b>{form.condominio}</b> ainda não possui grupo de WhatsApp vinculado. O aviso será enviado para o síndico e administradora.
                  </span>
                )
              ) : (
                <span className="text-gray-600">
                  ℹ️ Selecione um condomínio acima para enviar o comunicado direto no grupo de WhatsApp correspondente.
                </span>
              )}
            </div>
          </div>

          <div className="col-span-2">
            <label className="label">Observações / Orientações</label>
            <textarea className="input min-h-[80px]" value={form.descricao} onChange={e => set('descricao', e.target.value)} placeholder="Ex: Informações para os moradores, desligamento de bomba, etc..." />
          </div>
        </div>
        <div className="p-6 border-t border-cream-300 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={() => { if (!form.titulo || !form.dataPrevista) return; onSave(form) }} className="btn-primary">Salvar Agendamento</button>
        </div>
      </div>
    </div>
  )
}

function ModalDemanda({ data, condominios, onClose, onSave }) {
  const [form, setForm] = useState(data || {
    titulo: '', categoria: 'Manutenção', descricao: '', prazoLimite: '', condominio: '', status: 'Aberta'
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">{data ? 'Editar Cotação' : 'Nova Demanda de Cotação'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Título da Demanda</label>
            <input className="input" value={form.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Ex: Orçamento para pintura da fachada" autoFocus />
          </div>
          <div className="col-span-2">
            <label className="label">Condomínio</label>
            <select className="input" value={form.condominio || ''} onChange={e => set('condominio', e.target.value)}>
              <option value="">Selecione um condomínio...</option>
              {condominios?.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Categoria</label>
            <select className="input" value={form.categoria} onChange={e => set('categoria', e.target.value)}>
              <option>Manutenção</option>
              <option>Obras</option>
              <option>Limpeza / Conservação</option>
              <option>Segurança</option>
              <option>Outros</option>
            </select>
          </div>
          <div>
            <label className="label">Prazo Limite p/ Envio</label>
            <input type="date" className="input" value={form.prazoLimite} onChange={e => set('prazoLimite', e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="label">Status da Demanda</label>
            <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
              <option>Aberta</option>
              <option>Fechada</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">Descrição Detalhada do Escopo</label>
            <textarea className="input min-h-[120px]" value={form.descricao} onChange={e => set('descricao', e.target.value)} placeholder="Explique aos fornecedores exatamente o que você precisa que seja feito para eles orçarem..." />
          </div>
        </div>
        <div className="p-6 border-t border-cream-300 flex justify-between items-center gap-3">
          <p className="text-[10px] text-gray-400 max-w-[200px]">Ao salvar, esta demanda ficará pública no Portal de Fornecedores.</p>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary">Cancelar</button>
            <button onClick={() => { if (!form.titulo || !form.condominio) { alert('Preencha título e condomínio'); return; } onSave(form) }} className="btn-primary">Publicar Demanda</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ModalProposta({ proposta, onClose, onAprovar }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content md:max-w-xl" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between bg-brand-50">
          <h3 className="font-bold text-brand-900 flex items-center gap-2"><Briefcase size={18}/> Detalhes da Proposta Comercial</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div className="bg-white border border-cream-200 p-4 rounded-xl shadow-sm">
            <p className="text-xs font-bold text-gray-500 uppercase">Referente à Demanda:</p>
            <p className="font-bold text-gray-800">{proposta.demandaTitulo}</p>
            <p className="text-sm text-brand-600">{proposta.condominio}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase">Empresa</p>
              <p className="font-semibold text-gray-800">{proposta.empresa}</p>
              <p className="text-xs text-gray-500">CNPJ: {proposta.cnpj || 'Não inf.'}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase">Contato</p>
              <p className="font-semibold text-gray-800">{proposta.contato}</p>
              <p className="text-xs text-brand-600 font-bold">{proposta.telefone}</p>
            </div>
            <div className="col-span-2 mt-2">
              <p className="text-xs font-bold text-gray-500 uppercase">Valor Ofertado</p>
              <p className="text-2xl font-black text-emerald-600">R$ {Number(proposta.valor).toLocaleString('pt-BR', {minimumFractionDigits:2})}</p>
            </div>
            <div className="col-span-2 mt-2">
              <p className="text-xs font-bold text-gray-500 uppercase mb-1">Resumo / Descrição Técnica</p>
              <div className="bg-cream-50 p-4 rounded-xl border border-cream-200 text-sm text-gray-700 whitespace-pre-wrap">
                {proposta.propostaTexto}
              </div>
            </div>
          </div>
        </div>
        <div className="p-6 border-t border-cream-300 flex flex-wrap justify-between items-center gap-3 bg-gray-50">
          <button onClick={() => onAprovar(proposta)} className="btn-primary bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 text-xs py-2">
            <Send size={14} /> Enviar p/ Aprovação
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary text-xs py-2">Fechar</button>
            <a href={`https://wa.me/${proposta.telefone.replace(/\D/g, '')}?text=Olá!%20Vimos%20sua%20proposta%20no%20Portal%20da%20Alpha%20Gestão.`} target="_blank" rel="noreferrer" className="btn-primary bg-green-500 hover:bg-green-600 border-none text-xs py-2 flex items-center gap-1">
              WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

function ModalEnviarAprovacao({ selecionadas, condominios, onClose, onConfirm }) {
  const [destinatario, setDestinatario] = useState('Síndico e Conselho')
  const [condoDestino, setCondoDestino] = useState(selecionadas[0]?.condominio || '')
  const [mensagemExtra, setMensagemExtra] = useState('')
  const [telefoneWhats, setTelefoneWhats] = useState('')
  const [enviando, setEnviando] = useState(false)

  const handleEnviar = async () => {
    setEnviando(true)
    try {
      await onConfirm({
        destinatario,
        condoDestino,
        mensagemExtra,
        telefoneWhats,
        propostas: selecionadas
      })
    } finally {
      setEnviando(false)
    }
  }

  const gerarTextoCompartilhamento = () => {
    let txt = `📋 *SOLICITAÇÃO DE APROVAÇÃO DE ORÇAMENTO*\n`
    txt += `🏢 *Condomínio:* ${condoDestino || 'Geral'}\n`
    txt += `🎯 *Destinatário:* ${destinatario}\n\n`
    txt += `Segue(m) o(s) orçamento(s) selecionado(s) para análise e aprovação:\n\n`
    selecionadas.forEach((p, idx) => {
      txt += `*${idx + 1}. ${p.empresa}*\n`
      txt += `• Demanda: ${p.demandaTitulo || 'Serviço'}\n`
      txt += `• Valor: R$ ${Number(p.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`
      txt += `• Contato: ${p.contato || ''} (${p.telefone || ''})\n\n`
    })
    if (mensagemExtra) {
      txt += `📝 *Observações:* ${mensagemExtra}\n\n`
    }
    txt += `Por favor, avalie e nos retorne com a aprovação. Obrigado!`
    return txt
  }

  const enviarWhatsAppDireto = () => {
    const texto = gerarTextoCompartilhamento()
    const num = telefoneWhats.replace(/\D/g, '')
    const url = num ? `https://wa.me/55${num}?text=${encodeURIComponent(texto)}` : `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`
    window.open(url, '_blank')
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content md:max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between bg-brand-50">
          <h3 className="font-bold text-brand-900 flex items-center gap-2">
            <Send size={18} /> Enviar Orçamentos para Aprovação ({selecionadas.length})
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-900">
            <p className="font-bold mb-1">Você está enviando {selecionadas.length} proposta(s) selecionada(s):</p>
            <ul className="list-disc pl-4 space-y-0.5">
              {selecionadas.map(p => (
                <li key={p.id}>
                  <strong>{p.empresa}</strong> — R$ {Number(p.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ({p.demandaTitulo})
                </li>
              ))}
            </ul>
          </div>

          <div>
            <label className="label">Quem deve aprovar?</label>
            <select className="input w-full" value={destinatario} onChange={e => setDestinatario(e.target.value)}>
              <option>Síndico e Conselho Consultivo</option>
              <option>Apenas o Síndico</option>
              <option>Comissão de Obras</option>
              <option>Diretoria / Administradora</option>
            </select>
          </div>

          <div>
            <label className="label">Condomínio Vinculado</label>
            <select className="input w-full" value={condoDestino} onChange={e => setCondoDestino(e.target.value)}>
              <option value="">Geral / Sem condomínio</option>
              {condominios?.map(c => <option key={c.id || c.nome} value={c.nome}>{c.nome}</option>)}
            </select>
          </div>

          <div>
            <label className="label">WhatsApp para envio rápido (opcional)</label>
            <div className="flex gap-2">
              <input
                className="input flex-1"
                placeholder="(DDD) 99999-9999 do Síndico / Aprovador"
                value={telefoneWhats}
                onChange={e => setTelefoneWhats(e.target.value)}
              />
              <button
                type="button"
                onClick={enviarWhatsAppDireto}
                className="btn-success py-2 px-3 text-xs whitespace-nowrap"
                title="Abre o WhatsApp com o texto pronto"
              >
                Abrir WhatsApp
              </button>
            </div>
          </div>

          <div>
            <label className="label">Parecer / Mensagem de Orientação</label>
            <textarea
              className="input w-full min-h-[80px] text-xs"
              placeholder="Ex: Recomendamos a empresa X pelo menor prazo e referências apresentadas..."
              value={mensagemExtra}
              onChange={e => setMensagemExtra(e.target.value)}
            />
          </div>
        </div>

        <div className="p-6 border-t border-cream-300 flex justify-end gap-3 bg-gray-50">
          <button onClick={onClose} className="btn-secondary" disabled={enviando}>Cancelar</button>
          <button onClick={handleEnviar} className="btn-primary flex items-center gap-1.5" disabled={enviando}>
            <CheckCircle size={16} /> {enviando ? 'Gravando...' : 'Confirmar Envio'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Manutencoes() {
  const { user } = useAuth()
  const isMorador = user?.role === 'Morador'
  const isAdminOrSindico = ['Administrador', 'Síndico', 'Subsíndico'].includes(user?.role)
  
  const [tab, setTab] = useState('cronograma') // cronograma, cotacoes
  
  const { items: manutencoes, addItem, updateItem, deleteItem } = useFirestore('manutencoes')

  const handleConcluirRapido = async (m) => {
    const quem = window.prompt(`Confirmar conclusão da manutenção "${m.titulo}"?\n\nInforme quem conferiu ou realizou o serviço:`, user?.nome || 'Administração Alpha')
    if (quem === null) return
    try {
      const hojeIso = new Date().toISOString().split('T')[0]
      await updateItem(m.id, {
        status: 'Concluída',
        dataConclusao: hojeIso,
        concluidoPor: quem.trim() || user?.nome || 'Administração Alpha',
        concluidoEm: new Date().toISOString()
      })
      alert(`✅ Manutenção "${m.titulo}" marcada como Concluída com sucesso!`)
    } catch(err) {
      console.error(err)
      alert('Erro ao marcar manutenção como concluída: ' + err.message)
    }
  }
  const { items: demandas, addItem: addDemanda, updateItem: updateDemanda, deleteItem: delDemanda } = useFirestore('demandas_cotacao')
  const { items: propostas, updateItem: updateProposta, deleteItem: delProposta } = useFirestore('propostas_fornecedores')
  const { addItem: addNotificacao } = useFirestore('notificacoes')
  const { items: condominios } = useFirestore('condominios')
  const { items: allUsuarios } = useFirestore('usuarios')
  
  const [modalManu, setModalManu] = useState(null)
  const [modalDemanda, setModalDemanda] = useState(null)
  const [modalProposta, setModalProposta] = useState(null)
  const [modalAprovacao, setModalAprovacao] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  
  // Estado para seleção múltipla de propostas para aprovação
  const [selectedPropostasIds, setSelectedPropostasIds] = useState([])
  
  const [condoFiltro, setCondoFiltro] = useState(() => {
    if (user?.role !== 'Administrador' && user?.condominio) return user.condominio
    return 'Todos'
  })

  useEffect(() => {
    if (user?.role !== 'Administrador' && user?.condominio) {
      setCondoFiltro(user.condominio)
    }
  }, [user])

  // Cronograma Visuals
  const hojeStr = new Date().toISOString().split('T')[0]
  const isAdm = user?.role === 'Administrador'
  const meuCondo = (user?.condominio || '').trim().toLowerCase()

  const viewManutencoes = manutencoes
    .filter(m => {
      if (!isAdm) {
        if (!meuCondo) return false
        const mCondo = (m.condominio || '').trim().toLowerCase()
        if (!mCondo || (mCondo !== meuCondo && !mCondo.includes(meuCondo) && !meuCondo.includes(mCondo))) return false
        return true
      }
      if (condoFiltro !== 'Todos' && m.condominio && m.condominio !== condoFiltro) return false
      return true
    })
    .map(m => {
      let statusVisual = m.status
      if (m.status !== 'Concluída' && m.dataPrevista < hojeStr) {
        statusVisual = 'Atrasada'
      }
      return { ...m, statusVisual }
    }).sort((a,b) => new Date(a.dataPrevista) - new Date(b.dataPrevista))

  // Função para identificar se é Visita Técnica (pelo tipo explícito ou palavra-chave no título)
  const isVisita = (m) => {
    const t = (m.tipo || '').toLowerCase()
    const tit = (m.titulo || '').toLowerCase()
    const desc = (m.descricao || '').toLowerCase()
    return t.includes('visita') || tit.includes('visita') || desc.includes('visita') || tit.includes('vistoria') || desc.includes('vistoria')
  }

  // Divisão estrita para não misturar preventivas com visitas técnicas
  const viewPreventivas = viewManutencoes.filter(m => !isVisita(m))
  const viewVisitas = viewManutencoes.filter(m => isVisita(m))

  const handleVerificarLembretes = async () => {
    setIsChecking(true)
    try {
      const res = await verificarEDispararLembretesManutencao(true)
      if (res?.success) {
        if (res.disparos > 0) {
          alert(`🔔 Verificação concluída!\n\nForam disparados ${res.disparos} lembretes automáticos de manutenção (WhatsApp e Sininho).`)
        } else {
          alert('✅ Verificação concluída!\n\nTodos os lembretes de manutenções já estão em dia para a data de hoje.')
        }
      } else {
        alert('Aviso na verificação: ' + (res?.error || 'Não foi possível verificar.'))
      }
    } catch(err) {
      console.error(err)
      alert('Erro ao verificar lembretes: ' + err.message)
    } finally {
      setIsChecking(false)
    }
  }

  const handleSaveManu = async (form) => {
    try {
      const isNew = !form.id
      const totalCiclos = form.recorrencia && form.recorrencia !== 'Nenhuma'
        ? Number(form.qtdCiclos || (form.recorrencia === 'Semestral' ? 4 : form.recorrencia === 'Mensal' ? 12 : form.recorrencia === 'Trimestral' ? 4 : 3))
        : 1

      const mesesIntervalo = form.recorrencia === 'Mensal' ? 1 : form.recorrencia === 'Trimestral' ? 3 : form.recorrencia === 'Semestral' ? 6 : 12

      let docIdPrincipal = form.id || null

      if (isNew) {
        if (form.recorrencia && form.recorrencia !== 'Nenhuma' && totalCiclos > 1) {
          const grupoRecorrenciaId = 'rec_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6)

          for (let i = 0; i < totalCiclos; i++) {
            const dataCiclo = calcularProximaData(form.dataPrevista, i * mesesIntervalo)
            const itemCiclo = {
              titulo: form.titulo,
              tipo: form.tipo || 'Manutenção Preventiva',
              condominio: form.condominio || '',
              fornecedor: form.fornecedor || '',
              dataPrevista: dataCiclo,
              custoEstimado: form.custoEstimado || '',
              recorrencia: form.recorrencia,
              status: i === 0 ? (form.status || 'Agendada') : 'Agendada',
              descricao: form.descricao || '',
              grupoRecorrenciaId,
              cicloNumero: i + 1,
              totalCiclos,
              origemRecorrente: true
            }
            const docRef = await addItem(itemCiclo, true)
            if (i === 0 && docRef?.id) docIdPrincipal = docRef.id
          }
        } else {
          const { qtdCiclos, notificarGrupoAgora, gerarCiclosFuturos, ...dadosLimpos } = form
          const docRef = await addItem(dadosLimpos)
          if (docRef?.id) docIdPrincipal = docRef.id
        }
      } else {
        // Se mudou a data, reseta as flags para disparar na nova véspera/dia
        const existing = manutencoes.find(m => m.id === form.id)
        const toUpdate = { ...form }
        delete toUpdate.qtdCiclos
        delete toUpdate.notificarGrupoAgora
        delete toUpdate.gerarCiclosFuturos
        if (existing && existing.dataPrevista !== form.dataPrevista) {
          delete toUpdate.notifD1
          delete toUpdate.notifD0
          delete toUpdate.lembreteVesperaEnviadoEm
          delete toUpdate.lembreteHojeEnviadoEm
        }
        await updateItem(form.id, toUpdate)
      }

      const dataFmt = form.dataPrevista ? (form.dataPrevista.includes('-') ? form.dataPrevista.split('-').reverse().join('/') : form.dataPrevista) : 'A definir'
      const tipoLabel = form.tipo || 'Manutenção'
      const hojeIso = new Date().toISOString().split('T')[0]
      const ehParaHoje = form.dataPrevista && form.dataPrevista.startsWith(hojeIso)

      // 1. Gravar notificação no Sininho
      if (isNew) {
        try {
          await addDoc(collection(db, 'notificacoes'), {
            text: `🔧 ${tipoLabel.toUpperCase()} AGENDADA: "${form.titulo}" no ${form.condominio || 'Condomínio'} para ${dataFmt} (Prestador: ${form.fornecedor || 'A definir'})${form.recorrencia !== 'Nenhuma' && totalCiclos > 1 ? ` — ${totalCiclos} ciclos programados no sistema` : ''}`,
            titulo: `🔧 ${tipoLabel}: ${form.titulo}`,
            time: new Date().toISOString(),
            tipo: 'manutencao',
            condominio: form.condominio || 'Todos',
            lida: false,
            link: '/manutencoes',
            _createdAt: serverTimestamp()
          })
        } catch(e) {}
      }

      // 2. DISPARO PARA O GRUPO DE WHATSAPP DO CONDOMÍNIO
      let notificouGrupo = false
      if (form.condominio && (form.notificarGrupoAgora !== false || ehParaHoje)) {
        const condoDoc = condominios.find(c => c.nome === form.condominio)
        if (condoDoc?.grupoWhatsapp) {
          try {
            await enviarManutencaoWhatsAppGrupo({
              ...form,
              id: docIdPrincipal || form.id,
              totalCiclos,
              cicloNumero: 1
            }, condoDoc, ehParaHoje)
            notificouGrupo = true
          } catch(errGrupo) {
            console.warn('Falha no envio de comunicado para grupo:', errGrupo)
          }
        }
      }

      // 3. Disparo para os números de WhatsApp dos Administradores e Síndico APENAS se for agendamento para HOJE
      if (ehParaHoje) {
        const telefonesDestino = new Set()
        telefonesDestino.add('558396885931') // Número oficial padrão da Alpha
        telefonesDestino.add('5583996806325') // 83 99680-6325
        telefonesDestino.add('5583999797285') // 83 99979-7285
        telefonesDestino.add('5583998350321') // 83 99835-0321
        telefonesDestino.add('5583998468997') // 83 99846-8997

        if (allUsuarios && allUsuarios.length > 0) {
          allUsuarios.forEach(u => {
            const isAdmRole = u.role === 'Administrador' || u.role === 'Financeiro'
            const isSindicoDesteCondo = u.role === 'Síndico' && (!form.condominio || u.condominio === form.condominio)
            
            if (isAdmRole || isSindicoDesteCondo) {
              const rawTel = u.tel || u.telefone || u.whatsapp || u.celular || ''
              const cleanTel = String(rawTel).replace(/\D/g, '')
              if (cleanTel.length >= 8) {
                telefonesDestino.add(cleanTel.length <= 11 ? `55${cleanTel}` : cleanTel)
              }
            }
          })
        }

        const custoFmt = form.custoEstimado ? Number(form.custoEstimado).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'
        const msgWhats = `🚨 *${tipoLabel.toUpperCase()} HOJE - ALPHA GESTÃO*\n\n🏢 *Condomínio:* ${form.condominio || 'Todos / Geral'}\n🛠️ *Serviço:* ${form.titulo}\n📅 *Data:* HOJE (${dataFmt})\n👷 *Prestador / Empresa:* ${form.fornecedor || 'Não informado'}\n💰 *Custo Previsto:* R$ ${custoFmt}\n🔄 *Recorrência:* ${form.recorrencia || 'Nenhuma'}\n📌 *Status:* ${form.status || 'Agendada'}${form.descricao ? `\n📝 *Observações:* ${form.descricao}` : ''}\n\n✅ *Dar baixa / Concluir serviço:*\n👉 https://app.alphaadmsc.com.br/concluir/manutencao/${docIdPrincipal || form.id || ''}\n\n🔗 *Acesse o cronograma completo:* https://app.alphaadmsc.com.br/manutencoes`

        for (const numero of telefonesDestino) {
          try {
            await enviarMensagemWhatsApp({
              number: numero,
              text: msgWhats,
              instance: 'InstanciaAlpha'
            })
          } catch(e) {}
        }
      }

      let msgFinal = isNew
        ? `🎉 Agendamento salvo com sucesso!\n\n`
        : `🎉 Agendamento atualizado com sucesso!\n\n`

      if (isNew && totalCiclos > 1) {
        msgFinal += `🔄 Foram registrados ${totalCiclos} ciclos de ${form.recorrencia.toLowerCase()} no cronograma.\n`
      }
      if (notificouGrupo) {
        msgFinal += `📲 Comunicado enviado para o grupo de WhatsApp do condomínio "${form.condominio}".\n`
      } else if (form.condominio && form.notificarGrupoAgora) {
        msgFinal += `ℹ️ Grupo do WhatsApp não vinculado para o condomínio "${form.condominio}".\n`
      }
      msgFinal += ehParaHoje
        ? `📲 Disparo de WhatsApp enviado para Administradores e Síndico (execução hoje).`
        : `⏰ Lembretes automáticos programados para a véspera e dia da execução.`

      alert(msgFinal)
    } catch(err) {
      console.error('Erro ao salvar manutenção:', err)
      alert('Erro ao salvar: ' + err.message)
    } finally {
      setModalManu(null)
    }
  }

  const handleNotificarGrupo = async (m) => {
    if (!m.condominio) {
      alert('Esta manutenção não possui condomínio vinculado. Edite o item e selecione um condomínio.')
      return
    }
    const condoDoc = condominios.find(c => c.nome === m.condominio)
    const grupoId = String(condoDoc?.grupoWhatsapp || '').trim()
    if (!grupoId) {
      alert(`O condomínio "${m.condominio}" ainda não possui grupo de WhatsApp vinculado.\n\nPara vincular o grupo, acesse o menu Condomínios > Editar Condomínio > Grupo de WhatsApp.`)
      return
    }

    const dataFmt = m.dataPrevista ? (m.dataPrevista.includes('-') ? m.dataPrevista.split('-').reverse().join('/') : m.dataPrevista) : 'A definir'
    const hojeIso = new Date().toISOString().split('T')[0]
    const ehHoje = m.dataPrevista && m.dataPrevista.startsWith(hojeIso)

    if (!window.confirm(`Deseja enviar este comunicado agora para o grupo de WhatsApp do condomínio "${m.condominio}"?`)) {
      return
    }

    try {
      const res = await enviarManutencaoWhatsAppGrupo(m, condoDoc, ehHoje)
      if (res && res.success !== false) {
        alert(`🎉 Comunicado enviado com sucesso para o grupo de WhatsApp do condomínio "${m.condominio}"!`)
      } else {
        alert(`⚠️ O envio retornou aviso: ${res?.error || 'Verifique a conexão da instância no WhatsApp'}`)
      }
    } catch (err) {
      alert(`Erro ao enviar mensagem para o grupo: ${err.message}`)
    }
  }

  const handleGerarCiclosFuturos = async (m) => {
    if (!m.recorrencia || m.recorrencia === 'Nenhuma') {
      alert('Esta manutenção não possui recorrência configurada.')
      return
    }
    const mesesIntervalo = m.recorrencia === 'Semestral' ? 6 : m.recorrencia === 'Mensal' ? 1 : m.recorrencia === 'Trimestral' ? 3 : 12
    const totalNovosCiclos = m.recorrencia === 'Semestral' ? 3 : m.recorrencia === 'Mensal' ? 11 : m.recorrencia === 'Trimestral' ? 3 : 2

    const dataOrigem = m.dataPrevista || new Date().toISOString().split('T')[0]
    const confirmMsg = `Deseja gerar os próximos ${totalNovosCiclos} ciclos ${m.recorrencia.toLowerCase()}s para "${m.titulo}" (${m.condominio || 'Geral'})?\n\nIsso criará as manutenções futuras no cronograma com intervalo de ${mesesIntervalo} meses.`
    if (!window.confirm(confirmMsg)) return

    try {
      const idGrupo = m.grupoRecorrenciaId || ('rec_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6))
      
      await updateItem(m.id, {
        grupoRecorrenciaId: idGrupo,
        cicloNumero: 1,
        totalCiclos: totalNovosCiclos + 1,
        origemRecorrente: true
      })

      for (let i = 1; i <= totalNovosCiclos; i++) {
        const novaData = calcularProximaData(dataOrigem, i * mesesIntervalo)
        await addItem({
          titulo: m.titulo,
          tipo: m.tipo || 'Manutenção Preventiva',
          condominio: m.condominio || '',
          fornecedor: m.fornecedor || '',
          dataPrevista: novaData,
          custoEstimado: m.custoEstimado || '',
          recorrencia: m.recorrencia,
          status: 'Agendada',
          descricao: m.descricao || '',
          grupoRecorrenciaId: idGrupo,
          cicloNumero: i + 1,
          totalCiclos: totalNovosCiclos + 1,
          origemRecorrente: true
        }, true)
      }
      alert(`🎉 ${totalNovosCiclos} ciclos futuros foram gerados com sucesso e já estão no cronograma!`)
    } catch (err) {
      alert('Erro ao gerar ciclos futuros: ' + err.message)
    }
  }

  const handleSaveDemanda = async (form) => {
    if (form.id) await updateItem(form.id, form)
    else await addDemanda(form)
    setModalDemanda(null)
  }

  const getStatusStyle = (status) => {
    switch (status) {
      case 'Concluída': return 'text-emerald-700 bg-emerald-50 border-emerald-200'
      case 'Atrasada': return 'text-red-700 bg-red-50 border-red-200'
      case 'Em Andamento': return 'text-amber-700 bg-amber-50 border-amber-200'
      default: return 'text-blue-700 bg-blue-50 border-blue-200'
    }
  }

  const handleConfirmarAprovacao = async ({ destinatario, condoDestino, mensagemExtra, telefoneWhats, propostas: listaPropostas }) => {
    try {
      // 1. Marcar status de aprovação nas propostas
      for (const p of listaPropostas) {
        await updateProposta(p.id, {
          statusAprovacao: 'Enviado para Aprovação',
          destinatarioAprovacao: destinatario,
          enviadoAprovacaoEm: new Date().toISOString()
        })
      }

      // 2. Criar notificação interna no sininho
      await addNotificacao({
        titulo: `📋 Orçamento(s) enviado(s) para Aprovação (${destinatario})`,
        mensagem: `${listaPropostas.length} proposta(s) de fornecedor foram encaminhadas para aprovação do ${destinatario} no condomínio ${condoDestino || 'Geral'}.`,
        tipo: 'cotacao',
        condominio: condoDestino || '',
        lida: false,
        _createdAt: new Date().toISOString()
      })

      // 3. Notificar via WhatsApp se houver telefone ou administradores
      const telefonesAlvo = new Set()
      telefonesAlvo.add('558396885931')
      telefonesAlvo.add('5583996806325')
      telefonesAlvo.add('5583999797285')
      telefonesAlvo.add('5583998350321')
      telefonesAlvo.add('5583998468997')
      if (telefoneWhats) {
        const limpo = telefoneWhats.replace(/\D/g, '')
        if (limpo.length >= 8) telefonesAlvo.add(limpo.length <= 11 ? `55${limpo}` : limpo)
      }

      allUsuarios?.forEach(u => {
        if (['Administrador', 'Síndico'].includes(u.role) && (!condoDestino || !u.condominio || u.condominio === condoDestino)) {
          const rawTel = u.tel || u.telefone || u.whatsapp || u.celular || ''
          const limpo = String(rawTel).replace(/\D/g, '')
          if (limpo.length >= 8) telefonesAlvo.add(limpo.length <= 11 ? `55${limpo}` : limpo)
        }
      })

      let txt = `📋 *SOLICITAÇÃO DE APROVAÇÃO DE ORÇAMENTO*\n`
      txt += `🏢 *Condomínio:* ${condoDestino || 'Geral'}\n`
      txt += `🎯 *Aprovador Designado:* ${destinatario}\n\n`
      txt += `Segue(m) o(s) orçamento(s) selecionado(s) para análise:\n\n`
      listaPropostas.forEach((p, idx) => {
        txt += `*${idx + 1}. ${p.empresa}*\n`
        txt += `• Demanda: ${p.demandaTitulo || 'Serviço'}\n`
        txt += `• Valor: R$ ${Number(p.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`
        txt += `• Contato: ${p.contato || ''} (${p.telefone || ''})\n\n`
      })
      if (mensagemExtra) txt += `📝 *Observação:* ${mensagemExtra}\n\n`
      txt += `🔗 Acesse para revisar: https://alpha-solucoes-condominiais.vercel.app/manutencoes`

      for (const num of telefonesAlvo) {
        try {
          fetch('/api/whatsapp-send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ number: num, text: txt, instance: 'InstanciaAlpha' })
          }).catch(e => console.warn(e))
        } catch(e) {}
      }

      alert(`✅ Sucesso!\n\n${listaPropostas.length} orçamento(s) enviado(s) para aprovação de "${destinatario}".`)
      setSelectedPropostasIds([])
      setModalAprovacao(false)
    } catch (err) {
      console.error('Erro ao enviar aprovação:', err)
      alert('Erro ao processar envio: ' + err.message)
    }
  }

  const toggleSelectProposta = (id) => {
    setSelectedPropostasIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  const propostasFiltradas = propostas.filter(p => {
    if (condoFiltro !== 'Todos' && p.condominio && p.condominio !== condoFiltro) return false
    return true
  })

  const propostasSelecionadas = propostas.filter(p => selectedPropostasIds.includes(p.id))

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in w-full h-full print:bg-white print:p-0">
      <div className="page-header print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="section-title text-xl flex items-center gap-2"><Wrench className="text-brand-600"/> Manutenção Inteligente e Compras</h2>
          <p className="section-sub">Controle o cronograma de ativos, envie lembretes automáticos e receba propostas de fornecedores.</p>
        </div>
        <div className="flex items-center gap-3">
          {isAdm && (
            <select
              className="input py-2 text-xs font-bold text-gray-800 bg-white border-gray-300 rounded-xl"
              value={condoFiltro}
              onChange={e => setCondoFiltro(e.target.value)}
            >
              <option value="Todos">🏢 Todos os Condomínios</option>
              {condominios.map(c => (
                <option key={c.id || c.nome} value={c.nome}>{c.nome}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="flex gap-2 border-b border-cream-300 pb-2 print:hidden flex-wrap">
        <button 
          onClick={() => setTab('cronograma')} 
          className={`px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${tab==='cronograma'?'bg-brand-600 text-white shadow-md':'bg-white text-gray-600 hover:text-brand-700 border border-cream-400'}`}
        >
          <Calendar size={16}/> 🔧 Cronograma Preventivo ({viewPreventivas.length})
        </button>
        <button 
          onClick={() => setTab('visitas')} 
          className={`px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${tab==='visitas'?'bg-purple-600 text-white shadow-md':'bg-white text-gray-600 hover:text-purple-700 border border-cream-400'}`}
        >
          <Briefcase size={16}/> 📋 Visitas Técnicas ({viewVisitas.length})
        </button>
        <button 
          onClick={() => setTab('cotacoes')} 
          className={`px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${tab==='cotacoes'?'bg-brand-600 text-white shadow-md':'bg-white text-gray-600 hover:text-brand-700 border border-cream-400'}`}
        >
          <ShoppingBag size={16}/> Central de Cotações / Licitações
        </button>
        <button 
          onClick={() => setTab('orcamentos')} 
          className={`px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${tab==='orcamentos'?'bg-emerald-600 text-white shadow-md':'bg-white text-gray-600 hover:text-emerald-700 border border-cream-400'}`}
        >
          <FileText size={16}/> 📑 Orçamentos & Comparativo (IA)
        </button>
        <button 
          onClick={() => setTab('rateio')} 
          className={`px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${tab==='rateio'?'bg-indigo-600 text-white shadow-md':'bg-white text-gray-600 hover:text-indigo-700 border border-cream-400'}`}
        >
          <Calculator size={16}/> 💰 Simulação de Rateio
        </button>
      </div>

      {/* Relatório de Impressão (Visível apenas na impressão) */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-black text-center mb-2">Relatório de Manutenções &amp; Visitas Técnicas</h1>
        <p className="text-center text-gray-500 mb-6">Gerado em: {new Date().toLocaleDateString('pt-BR')}</p>
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="border border-gray-300 p-4 rounded text-center">
            <p className="text-sm text-gray-500 uppercase">Total Geral</p>
            <p className="text-2xl font-bold">{viewManutencoes.length}</p>
          </div>
          <div className="border border-gray-300 p-4 rounded text-center">
            <p className="text-sm text-gray-500 uppercase">Em Atraso</p>
            <p className="text-2xl font-bold text-red-600">{viewManutencoes.filter(m=>m.statusVisual==='Atrasada').length}</p>
          </div>
          <div className="border border-gray-300 p-4 rounded text-center">
            <p className="text-sm text-gray-500 uppercase">Custo Previsto Global</p>
            <p className="text-2xl font-bold text-emerald-600">R$ {viewManutencoes.reduce((acc, m) => acc + (Number(m.custoEstimado)||0), 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</p>
          </div>
        </div>
      </div>

      {/* ABA 1: CRONOGRAMA PREVENTIVO */}
      {tab === 'cronograma' && (
        <>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 print:hidden">
            <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-cream-200 shadow-sm">
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold">Total Preventivas</p>
                <p className="text-lg font-black text-brand-700">R$ {viewPreventivas.reduce((acc, m) => acc + (Number(m.custoEstimado)||0), 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</p>
              </div>
              <div className="w-px h-8 bg-cream-200"></div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold">Atrasadas</p>
                <p className="text-lg font-black text-red-600">{viewPreventivas.filter(m=>m.statusVisual==='Atrasada').length}</p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <button 
                onClick={handleVerificarLembretes} 
                disabled={isChecking}
                className="btn-secondary py-2 px-3.5 text-xs bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 flex items-center gap-1.5 shadow-sm font-bold"
                title="Verifica agendamentos de hoje e amanhã e envia lembretes automáticos"
              >
                <RefreshCw size={14} className={isChecking ? "animate-spin text-amber-600" : "text-amber-600"} />
                {isChecking ? 'Verificando...' : 'Verificar Lembretes'}
              </button>
              <button onClick={handlePrint} className="btn-secondary py-2 px-3.5 text-xs bg-white border-cream-300 flex items-center gap-1.5">
                <Printer size={14} /> Relatório PDF
              </button>
              {isAdminOrSindico && (
                <button 
                  onClick={() => setModalManu({ tipo: 'Manutenção Preventiva', condominio: condoFiltro !== 'Todos' ? condoFiltro : '' })} 
                  className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5 shadow-sm bg-brand-600 hover:bg-brand-700 cursor-pointer"
                >
                  <Plus size={15} /> + Agendar Manutenção Preventiva
                </button>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 print:grid-cols-2 print:gap-4">
            {viewPreventivas.length === 0 && (
              <div className="col-span-full card text-center py-12 text-gray-500 bg-white rounded-2xl border border-dashed border-gray-200">
                <Wrench size={40} className="mx-auto mb-3 text-cream-400" />
                <p className="font-semibold text-gray-600">Nenhuma manutenção preventiva encontrada.</p>
                <p className="text-xs text-gray-400 mt-1">As visitas técnicas estão separadas na aba "Visitas Técnicas".</p>
              </div>
            )}
            {viewPreventivas.map(m => (
              <div key={m.id} className="card p-5 hover:border-brand-300 transition-all group flex flex-col justify-between shadow-sm">
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase border ${getStatusStyle(m.statusVisual)}`}>
                      {m.statusVisual}
                    </span>
                    {isAdminOrSindico && (
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setModalManu(m)} className="text-gray-400 hover:text-brand-600 cursor-pointer" title="Editar"><Wrench size={14}/></button>
                        <button onClick={() => { if (window.confirm(`Excluir manutenção "${m.titulo}"?`)) deleteItem(m.id) }} className="text-gray-400 hover:text-red-600 cursor-pointer" title="Excluir"><Trash2 size={14}/></button>
                      </div>
                    )}
                  </div>
                  <h3 className="font-bold text-gray-800 text-lg leading-tight mb-1">{m.titulo}</h3>
                  <p className="text-sm text-gray-500 mb-2">{m.fornecedor || 'Fornecedor a definir'}</p>
                  <div className="mb-4 flex flex-wrap gap-1">
                    <span className="inline-block px-2 py-1 rounded text-[10px] uppercase font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      🔧 Manut. Preventiva
                    </span>
                    <span className="inline-block px-2 py-1 bg-cream-200 text-gray-600 rounded text-[10px] uppercase font-bold">
                      {m.condominio ? `🏢 ${m.condominio}` : '🌐 Todos / Geral'}
                    </span>
                    {m.recorrencia && m.recorrencia !== 'Nenhuma' && (
                      <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded text-[10px] uppercase font-bold flex items-center gap-1">
                        <Clock size={10}/> {m.recorrencia} {m.cicloNumero && m.totalCiclos ? `(${m.cicloNumero}/${m.totalCiclos})` : ''}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 flex flex-col gap-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500 flex items-center gap-1.5"><Calendar size={14}/> Prevista para</span>
                    <span className={`font-semibold ${m.statusVisual === 'Atrasada' ? 'text-red-600' : 'text-gray-700'}`}>
                      {m.dataPrevista ? m.dataPrevista.split('-').reverse().join('/') : 'A definir'}
                    </span>
                  </div>
                  {m.custoEstimado && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 flex items-center gap-1.5"><AlertCircle size={14}/> Custo Previsto</span>
                      <span className="font-semibold text-gray-700">R$ {Number(m.custoEstimado).toLocaleString('pt-BR', {minimumFractionDigits:2})}</span>
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5 mt-2">
                    {m.status !== 'Concluída' && (
                      <button
                        type="button"
                        onClick={() => handleConcluirRapido(m)}
                        className="w-full btn-secondary text-xs font-bold py-1.5 flex items-center justify-center gap-1.5 bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 transition-all cursor-pointer shadow-sm"
                        title="Marcar como concluída rapidamente"
                      >
                        <CheckCircle2 size={13} className="text-emerald-600" /> Marcar como Concluída
                      </button>
                    )}

                    {m.condominio && (
                      <button
                        type="button"
                        onClick={() => handleNotificarGrupo(m)}
                        className="w-full btn-secondary text-xs font-bold py-1.5 flex items-center justify-center gap-1.5 bg-white text-emerald-800 border border-emerald-300 hover:bg-emerald-50 transition-all cursor-pointer shadow-xs"
                        title={`Enviar aviso desta manutenção diretamente para o grupo do WhatsApp do condomínio ${m.condominio}`}
                      >
                        <MessageSquare size={13} className="text-emerald-600" /> Avisar Grupo no WhatsApp
                      </button>
                    )}

                    {m.recorrencia && m.recorrencia !== 'Nenhuma' && (!m.totalCiclos || m.totalCiclos <= 1) && (
                      <button
                        type="button"
                        onClick={() => handleGerarCiclosFuturos(m)}
                        className="w-full btn-secondary text-xs font-bold py-1.5 flex items-center justify-center gap-1.5 bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 transition-all cursor-pointer shadow-xs"
                        title={`Gerar os próximos ciclos futuros de ${m.recorrencia.toLowerCase()} no cronograma`}
                      >
                        <RefreshCw size={12} className="text-blue-600" /> Gerar Próximos Ciclos ({m.recorrencia})
                      </button>
                    )}
                  </div>

                  {/* Badges de Lembretes Automáticos */}
                  {(m.notifD1 || m.notifD0) && (
                    <div className="flex flex-col gap-1 mt-1 pt-2 border-t border-gray-200 text-[10px]">
                      {m.notifD1 && (
                        <span className="inline-flex items-center gap-1 text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-semibold">
                          <Check size={11} className="text-amber-600" /> Lembrete 1 dia antes enviado ({m.notifD1.split('-').reverse().join('/')})
                        </span>
                      )}
                      {m.notifD0 && (
                        <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                          <Check size={11} className="text-emerald-600" /> Lembrete do dia enviado ({m.notifD0.split('-').reverse().join('/')})
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ABA 2: VISITAS TÉCNICAS (TOTALMENTE SEPARADAS) */}
      {tab === 'visitas' && (
        <>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 print:hidden">
            <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-cream-200 shadow-sm">
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold">Total Visitas Técnicas</p>
                <p className="text-lg font-black text-purple-700">R$ {viewVisitas.reduce((acc, m) => acc + (Number(m.custoEstimado)||0), 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</p>
              </div>
              <div className="w-px h-8 bg-cream-200"></div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold">Atrasadas</p>
                <p className="text-lg font-black text-red-600">{viewVisitas.filter(m=>m.statusVisual==='Atrasada').length}</p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <button 
                onClick={handleVerificarLembretes} 
                disabled={isChecking}
                className="btn-secondary py-2 px-3.5 text-xs bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 flex items-center gap-1.5 shadow-sm font-bold"
                title="Verifica agendamentos de hoje e amanhã e envia lembretes automáticos"
              >
                <RefreshCw size={14} className={isChecking ? "animate-spin text-amber-600" : "text-amber-600"} />
                {isChecking ? 'Verificando...' : 'Verificar Lembretes'}
              </button>
              <button onClick={handlePrint} className="btn-secondary py-2 px-3.5 text-xs bg-white border-cream-300 flex items-center gap-1.5">
                <Printer size={14} /> Relatório PDF
              </button>
              {isAdminOrSindico && (
                <button 
                  onClick={() => setModalManu({ tipo: 'Visita Técnica', condominio: condoFiltro !== 'Todos' ? condoFiltro : '' })} 
                  className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5 shadow-sm bg-purple-600 hover:bg-purple-700 cursor-pointer"
                >
                  <Plus size={15} /> + Agendar Visita Técnica
                </button>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 print:grid-cols-2 print:gap-4">
            {viewVisitas.length === 0 && (
              <div className="col-span-full card text-center py-12 text-gray-500 bg-white rounded-2xl border border-dashed border-gray-200">
                <Briefcase size={40} className="mx-auto mb-3 text-purple-300" />
                <p className="font-semibold text-gray-600">Nenhuma visita técnica ou vistoria agendada.</p>
                <p className="text-xs text-gray-400 mt-1">Clique no botão acima para agendar uma nova visita técnica.</p>
              </div>
            )}
            {viewVisitas.map(m => (
              <div key={m.id} className="card p-5 border-purple-100 hover:border-purple-300 transition-all group flex flex-col justify-between shadow-sm">
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase border ${getStatusStyle(m.statusVisual)}`}>
                      {m.statusVisual}
                    </span>
                    {isAdminOrSindico && (
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setModalManu(m)} className="text-gray-400 hover:text-purple-600 cursor-pointer" title="Editar"><Wrench size={14}/></button>
                        <button onClick={() => { if (window.confirm(`Excluir visita "${m.titulo}"?`)) deleteItem(m.id) }} className="text-gray-400 hover:text-red-600 cursor-pointer" title="Excluir"><Trash2 size={14}/></button>
                      </div>
                    )}
                  </div>
                  <h3 className="font-bold text-gray-800 text-lg leading-tight mb-1">{m.titulo}</h3>
                  <p className="text-sm text-gray-500 mb-2">{m.fornecedor || 'Técnico / Empresa a definir'}</p>
                  <div className="mb-4 flex flex-wrap gap-1">
                    <span className="inline-block px-2 py-1 rounded text-[10px] uppercase font-bold bg-purple-100 text-purple-800 border border-purple-200">
                      📋 Visita Técnica
                    </span>
                    <span className="inline-block px-2 py-1 bg-cream-200 text-gray-600 rounded text-[10px] uppercase font-bold">
                      {m.condominio ? `🏢 ${m.condominio}` : '🌐 Todos / Geral'}
                    </span>
                  </div>
                </div>
                
                <div className="bg-purple-50/50 p-3 rounded-lg border border-purple-100 flex flex-col gap-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500 flex items-center gap-1.5"><Calendar size={14}/> Prevista para</span>
                    <span className={`font-semibold ${m.statusVisual === 'Atrasada' ? 'text-red-600' : 'text-gray-700'}`}>
                      {m.dataPrevista ? m.dataPrevista.split('-').reverse().join('/') : 'A definir'}
                    </span>
                  </div>
                  {m.custoEstimado && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 flex items-center gap-1.5"><AlertCircle size={14}/> Custo Previsto</span>
                      <span className="font-semibold text-gray-700">R$ {Number(m.custoEstimado).toLocaleString('pt-BR', {minimumFractionDigits:2})}</span>
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5 mt-2">
                    {m.status !== 'Concluída' && (
                      <button
                        type="button"
                        onClick={() => handleConcluirRapido(m)}
                        className="w-full btn-secondary text-xs font-bold py-1.5 flex items-center justify-center gap-1.5 bg-purple-50 text-purple-800 border-purple-300 hover:bg-purple-100 transition-all cursor-pointer shadow-sm"
                        title="Marcar visita técnica como concluída"
                      >
                        <CheckCircle2 size={13} className="text-purple-600" /> Marcar como Concluída
                      </button>
                    )}

                    {m.condominio && (
                      <button
                        type="button"
                        onClick={() => handleNotificarGrupo(m)}
                        className="w-full btn-secondary text-xs font-bold py-1.5 flex items-center justify-center gap-1.5 bg-white text-purple-800 border border-purple-200 hover:bg-purple-50 transition-all cursor-pointer shadow-xs"
                        title={`Enviar aviso desta visita técnica para o grupo de WhatsApp do condomínio ${m.condominio}`}
                      >
                        <MessageSquare size={13} className="text-purple-600" /> Avisar Grupo no WhatsApp
                      </button>
                    )}
                  </div>

                  {/* Badges de Lembretes Automáticos */}
                  {(m.notifD1 || m.notifD0) && (
                    <div className="flex flex-col gap-1 mt-1 pt-2 border-t border-purple-100 text-[10px]">
                      {m.notifD1 && (
                        <span className="inline-flex items-center gap-1 text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-semibold">
                          <Check size={11} className="text-amber-600" /> Lembrete 1 dia antes enviado ({m.notifD1.split('-').reverse().join('/')})
                        </span>
                      )}
                      {m.notifD0 && (
                        <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                          <Check size={11} className="text-emerald-600" /> Lembrete do dia enviado ({m.notifD0.split('-').reverse().join('/')})
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'cotacoes' && (
        <div className="flex flex-col gap-6">
          <div className="card bg-brand-900 text-white flex flex-col md:flex-row items-center justify-between gap-4 p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4"></div>
            <div className="relative z-10">
              <h3 className="text-xl font-bold mb-1">Mural de Licitações e Orçamentos</h3>
              <p className="text-brand-200 text-sm max-w-2xl">
                Crie demandas de serviços ou materiais, receba orçamentos de fornecedores e selecione os melhores para enviar diretamente para aprovação do Síndico ou Conselho.
              </p>
            </div>
            <div className="relative z-10 flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <a href="/fornecedores" target="_blank" rel="noreferrer" className="btn-secondary bg-white/10 border-white/20 text-white hover:bg-white/20 whitespace-nowrap">
                <ExternalLink size={14}/> Ver Portal
              </a>
              {isAdminOrSindico && (
                <button onClick={() => setModalDemanda({})} className="btn-primary bg-emerald-500 hover:bg-emerald-600 border-none whitespace-nowrap">
                  <Plus size={16}/> Abrir Demanda
                </button>
              )}
            </div>
          </div>

          {/* Barra de Ações para Orçamentos Selecionados */}
          {selectedPropostasIds.length > 0 && (
            <div className="bg-brand-50 border-2 border-brand-400 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-md animate-fade-in">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-brand-600 text-white font-bold flex items-center justify-center text-sm">
                  {selectedPropostasIds.length}
                </span>
                <div>
                  <h4 className="font-bold text-brand-900 text-sm">
                    {selectedPropostasIds.length} orçamento(s) selecionado(s)
                  </h4>
                  <p className="text-xs text-brand-700">
                    Total: R$ {propostasSelecionadas.reduce((acc, p) => acc + (Number(p.valor) || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedPropostasIds([])}
                  className="btn-secondary py-1.5 px-3 text-xs"
                >
                  Desmarcar Todos
                </button>
                <button
                  onClick={() => setModalAprovacao(true)}
                  className="btn-primary py-1.5 px-4 text-xs bg-emerald-600 hover:bg-emerald-700 border-none flex items-center gap-1.5 shadow-sm"
                >
                  <Send size={14} /> Enviar para Aprovação
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Coluna 1: Demandas Abertas */}
            <div className="card p-0 overflow-hidden flex flex-col shadow-sm">
              <div className="p-4 border-b border-cream-300 bg-cream-50 flex items-center justify-between">
                <h3 className="font-bold text-gray-800 flex items-center gap-2"><Briefcase size={16}/> Demandas Criadas</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar max-h-[500px] flex flex-col gap-3">
                {demandas.length === 0 && <p className="text-sm text-gray-400 text-center py-6">Nenhuma demanda criada.</p>}
                {demandas.map(d => (
                  <div key={d.id} className="border border-cream-200 rounded-xl p-4 bg-white hover:border-brand-300 transition-all group">
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${d.status==='Aberta'?'bg-emerald-100 text-emerald-700':'bg-gray-200 text-gray-600'}`}>{d.status}</span>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setModalDemanda(d)} className="text-gray-400 hover:text-brand-600"><Wrench size={14}/></button>
                        <button onClick={() => {if(window.confirm('Excluir demanda?')) delDemanda(d.id)}} className="text-gray-400 hover:text-red-600"><Trash2 size={14}/></button>
                      </div>
                    </div>
                    <h4 className="font-bold text-gray-800 text-sm mb-1">{d.titulo}</h4>
                    <p className="text-[11px] text-brand-600 font-medium mb-2">🏢 {d.condominio}</p>
                    <p className="text-xs text-gray-500 line-clamp-2">{d.descricao}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Coluna 2: Propostas Recebidas com Seleção */}
            <div className="card p-0 overflow-hidden flex flex-col shadow-sm border-brand-200 border-2">
              <div className="p-4 border-b border-brand-200 bg-brand-50 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-brand-900 flex items-center gap-2"><FileText size={16}/> Orçamentos Recebidos</h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">Marque os orçamentos que deseja submeter à aprovação</p>
                </div>
                <div className="flex items-center gap-2">
                  {propostasFiltradas.length > 0 && (
                    <button
                      onClick={() => {
                        if (selectedPropostasIds.length === propostasFiltradas.length) {
                          setSelectedPropostasIds([])
                        } else {
                          setSelectedPropostasIds(propostasFiltradas.map(p => p.id))
                        }
                      }}
                      className="text-xs font-bold text-brand-600 hover:text-brand-800 underline flex items-center gap-1"
                    >
                      {selectedPropostasIds.length === propostasFiltradas.length ? 'Desmarcar' : 'Selecionar Todos'}
                    </button>
                  )}
                  <span className="bg-brand-600 text-white text-xs font-bold px-2 py-1 rounded-full">{propostasFiltradas.length}</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar max-h-[500px] flex flex-col gap-3">
                {propostasFiltradas.length === 0 && <p className="text-sm text-gray-400 text-center py-6">Nenhuma proposta recebida dos fornecedores ainda.</p>}
                {propostasFiltradas.map(p => {
                  const isSelected = selectedPropostasIds.includes(p.id)
                  return (
                    <div 
                      key={p.id} 
                      className={`border-2 rounded-xl p-4 bg-white transition-all cursor-pointer relative ${isSelected ? 'border-brand-600 bg-brand-50/30 shadow-md' : 'border-cream-200 hover:shadow-md'}`}
                      onClick={() => toggleSelectProposta(p.id)}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // tratado no onClick do container
                            className="w-4 h-4 text-brand-600 rounded cursor-pointer"
                          />
                          <p className="text-[10px] text-gray-400 font-bold uppercase truncate max-w-[200px]">Ref: {p.demandaTitulo}</p>
                        </div>
                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          <button onClick={() => setModalProposta(p)} className="text-xs text-brand-600 font-semibold hover:underline">
                            Ver detalhes
                          </button>
                          <button onClick={() => { if (window.confirm('Excluir proposta?')) delProposta(p.id) }} className="text-gray-300 hover:text-red-500 transition-colors">
                            <Trash2 size={14}/>
                          </button>
                        </div>
                      </div>

                      <h4 className="font-bold text-gray-800 mb-0.5">{p.empresa}</h4>
                      <p className="text-xs text-gray-500 mb-2">{p.contato} • {p.telefone}</p>

                      <div className="flex items-center justify-between bg-emerald-50 text-emerald-700 px-3 py-2 rounded-lg border border-emerald-100">
                        <span className="text-xs font-bold">Valor Ofertado</span>
                        <span className="font-black">R$ {Number(p.valor).toLocaleString('pt-BR', {minimumFractionDigits:2})}</span>
                      </div>

                      {p.statusAprovacao && (
                        <div className="mt-2 pt-2 border-t border-cream-200 flex items-center justify-between text-[11px]">
                          <span className="text-purple-700 font-bold bg-purple-50 px-2 py-0.5 rounded border border-purple-200 flex items-center gap-1">
                            <ThumbsUp size={11} /> {p.statusAprovacao}
                          </span>
                          <span className="text-gray-400 text-[10px]">{p.destinatarioAprovacao}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'orcamentos' && (
        <div className="bg-white rounded-2xl shadow-sm border border-cream-300 p-4 sm:p-6">
          <OrcamentosComparativo condominios={condominios} condoFiltro={condoFiltro} />
        </div>
      )}

      {tab === 'rateio' && (
        <div className="bg-white rounded-2xl shadow-sm border border-cream-300 p-4 sm:p-6">
          <SimulacaoRateio condominios={condominios} condoFiltro={condoFiltro} />
        </div>
      )}

      {modalManu && <ModalManutencao data={modalManu.id ? modalManu : null} condominios={condominios} onClose={() => setModalManu(null)} onSave={handleSaveManu} />}
      {modalDemanda && <ModalDemanda data={modalDemanda.id ? modalDemanda : null} condominios={condominios} onClose={() => setModalDemanda(null)} onSave={handleSaveDemanda} />}
      {modalProposta && (
        <ModalProposta 
          proposta={modalProposta} 
          onClose={() => setModalProposta(null)} 
          onAprovar={(prop) => {
            setSelectedPropostasIds([prop.id])
            setModalProposta(null)
            setModalAprovacao(true)
          }}
        />
      )}
      {modalAprovacao && (
        <ModalEnviarAprovacao
          selecionadas={propostasSelecionadas}
          condominios={condominios}
          onClose={() => setModalAprovacao(false)}
          onConfirm={handleConfirmarAprovacao}
        />
      )}
    </div>
  )
}
