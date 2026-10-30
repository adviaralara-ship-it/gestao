import React, { useState, useEffect } from 'react'
import { Building2, Plus, Search, Edit2, Trash2, Home, DollarSign, TrendingUp, Share2, MessageSquare } from 'lucide-react'
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore'
import { db } from '../firebase'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'
import { CurrencyInput } from '../utils/currency'
import { buscarGruposWhatsApp } from '../utils/whatsappAutomacao'

const parseBR = v => typeof v === 'number' ? v : (parseFloat((v||'').toString().replace(/\./g,'').replace(',','.')) || 0)
const fmtBR   = v => Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})

function CondoModal({ data, onClose, onSave, isAdm }) {
  const [form, setForm] = useState(() => (data ? { ...data } : {
    nome:'', endereco:'', unidades:'', sindico:'', mandatoFim:'', cnpj:'', status:'Ativo', fundoReserva:'', fundoMeta:'',
    honorariosAdm: '', chavePixAlpha: '66.643.272/0001-18', discriminarTaxa: false, taxaEmissao: '3.50', nomeTaxa: 'Serviço de Cobrança Digital', cotaPadrao: '', grupoWhatsapp: ''
  }))
  const [fundoStr, setFundoStr] = useState(data?.fundoReserva || '')
  const [metaStr,  setMetaStr]  = useState(data?.fundoMeta || '')
  const [honorariosStr, setHonorariosStr] = useState(data?.honorariosAdm || '')
  const [taxaStr, setTaxaStr] = useState(data?.taxaEmissao !== undefined ? data.taxaEmissao : 3.50)
  const [cotaStr, setCotaStr] = useState(data?.cotaPadrao !== undefined ? data.cotaPadrao : '')
  const [gruposDisponiveis, setGruposDisponiveis] = useState([])
  const [carregandoGrupos, setCarregandoGrupos] = useState(false)

  const handleCarregarGrupos = async () => {
    setCarregandoGrupos(true)
    try {
      const list = await buscarGruposWhatsApp()
      if (list && list.length > 0) {
        setGruposDisponiveis(list)
      } else {
        alert('Nenhum grupo encontrado na instância do WhatsApp ou a instância ainda está inicializando.')
      }
    } catch (err) {
      alert(`Erro ao buscar grupos do WhatsApp: ${err.message}`)
    } finally {
      setCarregandoGrupos(false)
    }
  }

  useEffect(() => {
    if (data) {
      setForm({ ...data })
      setFundoStr(data.fundoReserva || '')
      setMetaStr(data.fundoMeta || '')
      setHonorariosStr(data.honorariosAdm || '')
      setTaxaStr(data.taxaEmissao !== undefined ? data.taxaEmissao : 3.50)
      setCotaStr(data.cotaPadrao !== undefined ? data.cotaPadrao : '')
    } else {
      setForm({
        nome:'', endereco:'', unidades:'', sindico:'', mandatoFim:'', cnpj:'', status:'Ativo', fundoReserva:'', fundoMeta:'',
        honorariosAdm: '', chavePixAlpha: '66.643.272/0001-18', discriminarTaxa: false, taxaEmissao: '3.50', nomeTaxa: 'Serviço de Cobrança Digital', cotaPadrao: '', grupoWhatsapp: ''
      })
      setFundoStr('')
      setMetaStr('')
      setHonorariosStr('')
      setTaxaStr(3.50)
      setCotaStr('')
    }
  }, [data])

  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  return (
    <div className="modal-overlay z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white max-w-xl w-full rounded-3xl shadow-2xl border border-gray-200 flex flex-col max-h-[90vh] overflow-hidden" onClick={e=>e.stopPropagation()}>
        <div className="p-4 sm:p-5 border-b border-cream-300 flex items-center justify-between gap-3 bg-gradient-to-r from-cream-100 to-white shrink-0">
          <h3 className="font-black text-gray-900 text-base sm:text-lg min-w-0 flex-1 truncate">{data?'Editar Condomínio':'Novo Condomínio'}</h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors cursor-pointer" title="Fechar">✕</button>
        </div>
        <div className="p-5 sm:p-6 flex flex-col gap-4 overflow-y-auto flex-1">
          {[['nome','Nome do Condomínio'],['endereco','Endereço Completo'],['sindico','Nome do Síndico'],['cnpj','CNPJ'],['mandatoFim','Fim do Mandato (Síndico)'],['unidades','Nº de Unidades'],['chave_pix','Chave PIX do Condomínio (Para onde vão as cotas)']].map(([k,l])=>(
            <div key={k}><label className="label">{l}</label><input type={k==='mandatoFim'?'date':'text'} className={`input ${k==='nome'?'uppercase font-bold':''}`} value={form[k]||''} onChange={e=>set(k, k==='nome'?e.target.value.toUpperCase():e.target.value)} placeholder={l}/></div>
          ))}

          {/* Grupo de WhatsApp do Condomínio */}
          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <label className="label text-xs font-black text-emerald-900 flex items-center gap-1.5 m-0">
                <MessageSquare size={14} className="text-emerald-700"/> Grupo de WhatsApp do Residencial
              </label>
              <button
                type="button"
                onClick={handleCarregarGrupos}
                disabled={carregandoGrupos}
                className="text-[11px] font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                title="Carregar grupos direto da instância do WhatsApp conectada"
              >
                {carregandoGrupos ? 'Buscando grupos...' : '🔄 Carregar Grupos Conectados'}
              </button>
            </div>
            <p className="text-[11px] text-emerald-800/80 leading-relaxed">
              Este ID é utilizado para enviar notificações automáticas de novas reservas de áreas comuns, comunicados e enquetes para os moradores no grupo do condomínio.
            </p>
            {gruposDisponiveis.length > 0 && (
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Selecionar grupo da lista conectada:</label>
                <select
                  className="input text-xs font-semibold mt-1"
                  value={form.grupoWhatsapp || ''}
                  onChange={e => set('grupoWhatsapp', e.target.value)}
                >
                  <option value="">Selecione o grupo correspondente...</option>
                  {gruposDisponiveis.map(g => (
                    <option key={g.id} value={g.id}>{g.subject} ({g.id})</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">ID do Grupo (JID @g.us):</label>
              <input
                type="text"
                className="input font-mono text-xs mt-1"
                value={form.grupoWhatsapp || ''}
                onChange={e => set('grupoWhatsapp', e.target.value)}
                placeholder="ex: 120363012345678901@g.us"
              />
            </div>
          </div>

          <div><label className="label">Status</label>
            <select className="input" value={form.status} onChange={e=>set('status',e.target.value)}>
              <option>Ativo</option><option>Manutenção</option><option>Inativo</option>
            </select>
          </div>

          {/* Seção Cota Condominial / Valor Padrão do Boleto */}
          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="label text-xs font-black text-emerald-900 flex items-center gap-1.5 m-0">
                <DollarSign size={14} className="text-emerald-700"/> Valor Padrão da Cota por Apartamento (R$)
              </label>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">Boleto Mensal</span>
            </div>
            <p className="text-[11px] text-emerald-800/80 leading-relaxed">
              Defina o valor base do boleto deste condomínio. Ao gerar os boletos em lote, este valor será preenchido automaticamente.
            </p>
            <div className="mt-1">
              <CurrencyInput value={cotaStr} onChange={v => setCotaStr(v)} placeholder="Ex: 450,00" />
            </div>
          </div>

          {/* Seção de Remuneração e Taxas da Alpha (Exclusivo Administrador) */}
          {isAdm && (
            <div className="p-4 bg-brand-50/70 border border-brand-200 rounded-2xl flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black text-brand-900 flex items-center gap-1.5 uppercase tracking-wide">
                  <DollarSign size={14} className="text-brand-600"/> Remuneração da Administradora (Alpha)
                </p>
                <span className="text-[10px] font-bold text-brand-700 bg-brand-100 px-2 py-0.5 rounded-md">Contrato</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Honorários de Administração (R$)</label>
                  <CurrencyInput value={honorariosStr} onChange={v => setHonorariosStr(v)} placeholder="Ex: 900,00" />
                </div>
                <div>
                  <label className="label">Chave PIX da Alpha (Para receber)</label>
                  <input className="input font-mono text-xs" value={form.chavePixAlpha || ''} onChange={e=>set('chavePixAlpha',e.target.value)} placeholder="CNPJ ou Chave PIX da Alpha"/>
                </div>
              </div>

              {/* Controle de discriminação da Taxa de Emissão */}
              <div className="mt-2 pt-3 border-t border-brand-200/60 flex flex-col gap-2.5">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.discriminarTaxa || false}
                    onChange={e => set('discriminarTaxa', e.target.checked)}
                    className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500 cursor-pointer"
                  />
                  <span className="text-xs font-black text-gray-800">
                    Serviço de Cobrança Digital no Boleto e Relatórios
                  </span>
                </label>
                <p className="text-[11px] text-gray-500 ml-6.5 leading-relaxed">
                  Marque se este condomínio já possui o Serviço de Cobrança Digital no contrato. Se desmarcado, a cota sairá sem discriminar o serviço.
                </p>

                {form.discriminarTaxa && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1 ml-6.5 bg-white p-3 rounded-xl border border-brand-200">
                    <div>
                      <label className="label">Valor do Serviço por Unidade (R$)</label>
                      <CurrencyInput value={taxaStr} onChange={v => setTaxaStr(v)} placeholder="3,50" />
                    </div>
                    <div>
                      <label className="label">Descrição no Boleto</label>
                      <input className="input text-xs" value={form.nomeTaxa || 'Serviço de Cobrança Digital'} onChange={e=>set('nomeTaxa', e.target.value)} placeholder="Serviço de Cobrança Digital"/>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Fundo de Reserva */}
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col gap-3">
            <p className="text-xs font-bold text-emerald-800 flex items-center gap-1.5"><DollarSign size={13}/>Fundo de Reserva</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Saldo Atual (R$)</label>
                <CurrencyInput value={fundoStr} onChange={v => setFundoStr(v)} placeholder="0,00" />
              </div>
              <div><label className="label">Meta Anual (R$)</label>
                <CurrencyInput value={metaStr} onChange={v => setMetaStr(v)} placeholder="0,00" />
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé fixo - Sempre visível */}
        <div className="p-4 sm:p-5 border-t border-gray-200 flex gap-3 justify-end bg-gray-50 shrink-0">
          <button onClick={onClose} className="btn-secondary px-5 py-2 text-xs font-bold">Cancelar</button>
          <button onClick={()=>onSave({
            ...form,
            nome: (form.nome || '').trim(),
            unidades:Number(form.unidades)||0,
            cotaPadrao: parseBR(cotaStr),
            honorariosAdm: parseBR(honorariosStr),
            taxaEmissao: form.discriminarTaxa ? parseBR(taxaStr) : 0,
            fundoReserva:parseBR(fundoStr),
            fundoMeta:parseBR(metaStr)
          })} className="btn-primary bg-brand-600 hover:bg-brand-500 text-white font-black text-xs py-2.5 px-6 rounded-xl shadow-md cursor-pointer">
            💾 Salvar Alterações
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Condominios() {
  const { items: condos, addItem, updateItem, deleteItem } = useFirestore('condominios')
  const { user } = useAuth()
  const isAdm = user?.role === 'Administrador'
  const meuCondominio = user?.condominio || ''
  const [search, setSearch] = useState('')
  const [modal,  setModal]  = useState(null)
  const [salvando, setSalvando] = useState(false)

  const normalizarNomeCondo = (nome) => {
    return String(nome || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/^(residencial|condominio|edificio|ed\.)\s+/i, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .trim()
      .toLowerCase()
  }

  const condoMatch = (c1, c2) => {
    if (!c1 || !c2) return false
    const n1 = normalizarNomeCondo(c1)
    const n2 = normalizarNomeCondo(c2)
    return n1 === n2 || n1.includes(n2) || n2.includes(n1)
  }

  const filtered = condos.filter(c => {
    if (!isAdm && meuCondominio) {
      if (!condoMatch(c.nome, meuCondominio)) return false
    }
    return c.nome?.toLowerCase().includes(search.toLowerCase()) || c.endereco?.toLowerCase().includes(search.toLowerCase())
  })

  const handleSave = async form => {
    try {
      setSalvando(true)
      if (modal === 'new') {
        await addItem(form)
      } else {
        const nomeAntigo = modal?.nome
        const nomeNovo = form.nome
        await updateItem(modal.id, form)

        // Se o nome do condomínio mudou (ex: de Florense para Florence), atualiza registros relacionados em cascata
        if (nomeAntigo && nomeNovo && nomeAntigo !== nomeNovo) {
          try {
            const colecoesParaAtualizar = ['moradores', 'usuarios', 'boletos', 'comunicacao', 'financeiro_lancamentos']
            for (const col of colecoesParaAtualizar) {
              const snap = await getDocs(query(collection(db, col), where('condominio', '==', nomeAntigo)))
              if (!snap.empty) {
                const batch = writeBatch(db)
                snap.docs.forEach(d => {
                  batch.update(doc(db, col, d.id), { condominio: nomeNovo })
                })
                await batch.commit()
              }
            }
          } catch(errCascade) {
            console.warn('Erro ao atualizar dados em cascata:', errCascade)
          }
        }
      }
      setModal(null)
      alert(`✅ Condomínio "${form.nome}" salvo com sucesso!`)
    } catch(err) {
      console.error(err)
      alert('Erro ao salvar o condomínio: ' + err.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h2 className="section-title text-xl">Condomínios &amp; Unidades</h2>
          <p className="section-sub">{filtered.length} de {condos.length} condomínios cadastrados</p>
        </div>
        {isAdm && (
          <button onClick={()=>setModal('new')} className="btn-primary font-bold shadow-md">
            <Plus size={16}/>Novo Condomínio
          </button>
        )}
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
        <input className="input pl-9" placeholder="Buscar condomínio..." value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>

      {filtered.length===0&&<div className="card text-center py-10 text-gray-400 text-sm">Nenhum condomínio cadastrado ainda.</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(c=>{
          const saldo = Number(c.fundoReserva||0)
          const meta  = Number(c.fundoMeta||0)
          const pct   = meta>0 ? Math.min((saldo/meta)*100,100) : 0
          return (
            <div key={c.id} className="card hover:border-brand-700/50 transition-all group flex flex-col gap-3 shadow-sm bg-white">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 bg-brand-700/30 rounded-xl flex items-center justify-center"><Building2 size={18} className="text-brand-400"/></div>
                <span className={c.status==='Ativo'?'badge-green':c.status==='Manutenção'?'badge-yellow':'badge-red'}>{c.status}</span>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base mb-0.5">{c.nome}</h3>
                <p className="text-xs text-gray-500">{c.endereco || 'Endereço não informado'}</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500 font-medium">
                <span className="flex items-center gap-1"><Home size={12}/>{c.unidades || 0} unidades</span>
                {c.cotaPadrao > 0 && <span className="flex items-center gap-1 text-emerald-700 font-bold"><DollarSign size={12}/>Cota: R$ {fmtBR(c.cotaPadrao)}</span>}
              </div>

              {/* Fundo de Reserva */}
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-emerald-800 flex items-center gap-1"><TrendingUp size={11}/>Fundo de Reserva</span>
                  <span className="text-xs font-black text-emerald-700">R$ {fmtBR(saldo)}</span>
                </div>
                {meta>0?(
                  <>
                    <div className="w-full bg-emerald-100 rounded-full h-1.5 overflow-hidden">
                      <div className="h-1.5 bg-emerald-500 rounded-full transition-all" style={{width:`${pct}%`}}/>
                    </div>
                    <p className="text-[10px] text-emerald-600 mt-1 text-right font-medium">{pct.toFixed(1)}% · Meta: R$ {fmtBR(meta)}</p>
                  </>
                ):(
                  <p className="text-[10px] text-emerald-600 font-medium">Meta não definida</p>
                )}
              </div>

              <div className="pt-2 border-t border-cream-300 flex items-center justify-between mt-auto">
                <div><p className="text-[11px] text-gray-400">Síndico</p><p className="text-xs font-bold text-gray-700">{c.sindico || 'Não informado'}</p></div>
                {/* Botões sempre bem visíveis com alto contraste e cores claras */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      const origin = typeof window !== 'undefined' && window.location.origin
                        ? window.location.origin
                        : 'https://app.alphaadmsc.com.br'
                      const link = `${origin}/cadastro?condominio=${encodeURIComponent(c.nome)}`
                      navigator.clipboard.writeText(link)
                      alert(`🔗 Link oficial de cadastro do condomínio "${c.nome}" copiado com sucesso!\n\nLink: ${link}\n\nEnvie este link para os novos moradores. Eles já cairão vinculados a este condomínio automaticamente.`)
                    }}
                    className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-all shadow-sm"
                    title="Copiar Link de Auto-Cadastro deste Condomínio"
                  >
                    <Share2 size={14} />
                  </button>
                  <button 
                    onClick={()=>setModal(c)} 
                    className="p-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 transition-all shadow-sm flex items-center gap-1 font-bold text-xs" 
                    title="Editar Condomínio"
                  >
                    <Edit2 size={14} className="text-amber-700"/>
                    <span className="hidden sm:inline">Editar</span>
                  </button>
                  {isAdm && (
                    <button 
                      onClick={()=>{
                        if (window.confirm(`Tem certeza que deseja excluir o condomínio "${c.nome}"?`)) {
                          deleteItem(c.id)
                        }
                      }} 
                      className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all shadow-sm" 
                      title="Excluir Condomínio"
                    >
                      <Trash2 size={14}/>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {modal&&<CondoModal data={modal==='new'?null:modal} onClose={()=>setModal(null)} onSave={handleSave} isAdm={isAdm}/>}
    </div>
  )
}
