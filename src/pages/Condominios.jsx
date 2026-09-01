import React, { useState } from 'react'
import { Building2, Plus, Search, Edit2, Trash2, Home, DollarSign, TrendingUp } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { CurrencyInput } from '../utils/currency'

const parseBR = v => typeof v === 'number' ? v : (parseFloat((v||'').toString().replace(/\./g,'').replace(',','.')) || 0)
const fmtBR   = v => Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})

function CondoModal({ data, onClose, onSave }) {
  const [form, setForm] = useState(data || {
    nome:'', endereco:'', unidades:'', sindico:'', mandatoFim:'', cnpj:'', status:'Ativo', fundoReserva:'', fundoMeta:'',
    honorariosAdm: '', chavePixAlpha: '66.643.272/0001-18', discriminarTaxa: false, taxaEmissao: '3.50', nomeTaxa: 'Serviço de Cobrança Digital'
  })
  const [fundoStr, setFundoStr] = useState(data?.fundoReserva || '')
  const [metaStr,  setMetaStr]  = useState(data?.fundoMeta || '')
  const [honorariosStr, setHonorariosStr] = useState(data?.honorariosAdm || '')
  const [taxaStr, setTaxaStr] = useState(data?.taxaEmissao !== undefined ? data.taxaEmissao : 3.50)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-xl" onClick={e=>e.stopPropagation()}>
        <div className="p-4 sm:p-6 border-b border-cream-300 flex items-center justify-between gap-3">
          <h3 className="font-bold text-gray-800 text-base sm:text-lg min-w-0 flex-1 truncate">{data?'Editar Condomínio':'Novo Condomínio'}</h3>
          <button onClick={onClose} className="modal-close-btn" title="Fechar">✕</button>
        </div>
        <div className="p-6 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
          {[['nome','Nome do Condomínio'],['endereco','Endereço Completo'],['sindico','Nome do Síndico'],['cnpj','CNPJ'],['mandatoFim','Fim do Mandato (Síndico)'],['unidades','Nº de Unidades'],['chave_pix','Chave PIX do Condomínio (Para onde vão as cotas)']].map(([k,l])=>(
            <div key={k}><label className="label">{l}</label><input type={k==='mandatoFim'?'date':'text'} className={`input ${k==='nome'?'uppercase':''}`} value={form[k]||''} onChange={e=>set(k, k==='nome'?e.target.value.toUpperCase():e.target.value)} placeholder={l}/></div>
          ))}
          <div><label className="label">Status</label>
            <select className="input" value={form.status} onChange={e=>set('status',e.target.value)}>
              <option>Ativo</option><option>Manutenção</option><option>Inativo</option>
            </select>
          </div>

          {/* Seção de Remuneração e Taxas da Alpha */}
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
        <div className="p-4 sm:p-6 border-t border-cream-300 flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={()=>onSave({
            ...form,
            unidades:Number(form.unidades)||0,
            honorariosAdm: parseBR(honorariosStr),
            taxaEmissao: form.discriminarTaxa ? parseBR(taxaStr) : 0,
            fundoReserva:parseBR(fundoStr),
            fundoMeta:parseBR(metaStr)
          })} className="btn-primary">Salvar</button>
        </div>
      </div>
    </div>
  )
}

export default function Condominios() {
  const { items: condos, addItem, updateItem, deleteItem } = useFirestore('condominios')
  const [search, setSearch] = useState('')
  const [modal,  setModal]  = useState(null)

  const filtered = condos.filter(c=>c.nome?.toLowerCase().includes(search.toLowerCase())||c.endereco?.toLowerCase().includes(search.toLowerCase()))

  const handleSave = async form => {
    if (modal==='new') await addItem(form)
    else await updateItem(modal.id,form)
    setModal(null)
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h2 className="section-title text-xl">Condomínios &amp; Unidades</h2>
          <p className="section-sub">{condos.length} condomínios cadastrados</p>
        </div>
        <button onClick={()=>setModal('new')} className="btn-primary"><Plus size={16}/>Novo Condomínio</button>
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
            <div key={c.id} className="card hover:border-brand-700/50 transition-all group flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 bg-brand-700/30 rounded-xl flex items-center justify-center"><Building2 size={18} className="text-brand-400"/></div>
                <span className={c.status==='Ativo'?'badge-green':c.status==='Manutenção'?'badge-yellow':'badge-red'}>{c.status}</span>
              </div>
              <div>
                <h3 className="font-bold text-gray-800 mb-0.5">{c.nome}</h3>
                <p className="text-xs text-gray-500">{c.endereco}</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1"><Home size={12}/>{c.unidades} unidades</span>
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
                    <p className="text-[10px] text-emerald-600 mt-1 text-right">{pct.toFixed(1)}% · Meta: R$ {fmtBR(meta)}</p>
                  </>
                ):(
                  <p className="text-[10px] text-emerald-600">Meta não definida</p>
                )}
              </div>

              <div className="pt-2 border-t border-cream-300 flex items-center justify-between">
                <div><p className="text-xs text-gray-500">Síndico</p><p className="text-xs font-semibold text-gray-600">{c.sindico}</p></div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={()=>setModal(c)} className="p-1.5 rounded-lg bg-cream-200 hover:bg-brand-100 text-gray-400 hover:text-brand-700 transition-all"><Edit2 size={13}/></button>
                  <button onClick={()=>deleteItem(c.id)} className="p-1.5 rounded-lg bg-cream-200 hover:bg-red-100 text-gray-400 hover:text-red-500 transition-all"><Trash2 size={13}/></button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {modal&&<CondoModal data={modal==='new'?null:modal} onClose={()=>setModal(null)} onSave={handleSave}/>}
    </div>
  )
}
