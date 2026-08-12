import React, { useState, useEffect } from 'react'
import { collection, query, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { 
  AlertTriangle, DollarSign, Scale, FileText, Search, Plus, 
  MessageCircle, Mail, Briefcase, Gavel, BookOpen, ExternalLink, X 
} from 'lucide-react'
import BibliotecaLeis from '../components/juridico/BibliotecaLeis'

// Modal para Adicionar Processo Jurídico
function ProcessoModal({ onClose, onSave, processo }) {
  const [form, setForm] = useState(processo || {
    condominio: '', morador: '', apt: '', valor: '', status: 'Em Andamento', 
    vara: '', numero_processo: '', honorarios: '', observacoes: ''
  })
  
  const set = (k, v) => setForm({ ...form, [k]: v })

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-lg" onClick={e=>e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex justify-between items-center">
          <h3 className="font-bold text-gray-800">{processo ? 'Editar Processo' : 'Novo Processo Jurídico'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={20}/></button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className="label">Morador / Réu</label><input className="input" value={form.morador} onChange={e=>set('morador', e.target.value)} placeholder="Nome completo" /></div>
          <div><label className="label">Condomínio</label><input className="input" value={form.condominio} onChange={e=>set('condominio', e.target.value)} /></div>
          <div><label className="label">Unidade/Apt</label><input className="input" value={form.apt} onChange={e=>set('apt', e.target.value)} /></div>
          <div><label className="label">Valor Cobrado (R$)</label><input type="number" className="input" value={form.valor} onChange={e=>set('valor', e.target.value)} /></div>
          <div><label className="label">Status</label>
            <select className="input" value={form.status} onChange={e=>set('status', e.target.value)}>
              <option>Em Andamento</option><option>Acordo Realizado</option><option>Encerrado</option><option>Suspenso</option>
            </select>
          </div>
          <div><label className="label">Nº do Processo</label><input className="input" value={form.numero_processo} onChange={e=>set('numero_processo', e.target.value)} /></div>
          <div><label className="label">Vara/Comarca</label><input className="input" value={form.vara} onChange={e=>set('vara', e.target.value)} /></div>
          <div className="col-span-2"><label className="label">Honorários / Custas (R$)</label><input type="number" className="input" value={form.honorarios} onChange={e=>set('honorarios', e.target.value)} /></div>
          <div className="col-span-2"><label className="label">Andamento / Observações</label><textarea className="input resize-none h-20" value={form.observacoes} onChange={e=>set('observacoes', e.target.value)} /></div>
        </div>
        <div className="p-6 border-t border-cream-300 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={()=>onSave(form)} className="btn-primary">Salvar Processo</button>
        </div>
      </div>
    </div>
  )
}

export default function Inadimplencia() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('cobranca') // cobranca, juridico, biblioteca
  const [cobrancas, setCobrancas] = useState([])
  const [processos, setProcessos] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    // Escuta Financeiro para achar as cobranças "Atrasadas" (Mock ou Reais)
    const qF = query(collection(db, 'financeiro'))
    const unF = onSnapshot(qF, snap => {
      const fin = snap.docs.map(d=>({id: d.id, ...d.data()}))
      // Filtra apenas receitas atrasadas
      const atrasados = fin.filter(f => f.tipo === 'Receita' && f.status === 'Atrasado')
      setCobrancas(atrasados)
    })

    const qP = query(collection(db, 'juridico'))
    const unP = onSnapshot(qP, snap => {
      setProcessos(snap.docs.map(d=>({id: d.id, ...d.data()})))
      setLoading(false)
    })

    return () => { unF(); unP() }
  }, [])

  const handleCobrancaWpp = (c) => {
    const msg = encodeURIComponent(`Olá, consta em nosso sistema um atraso referente à taxa de *${c.categoria || 'Condomínio'}* no valor de R$ ${Number(c.valor).toFixed(2)}. Para evitar acréscimos e encaminhamento jurídico, solicitamos a regularização. Se já foi pago, por favor desconsidere.`)
    window.open(`https://wa.me/?text=${msg}`, '_blank')
  }

  const handleSaveProcesso = async (form) => {
    if (form.id) {
      await updateDoc(doc(db, 'juridico', form.id), form)
    } else {
      await addDoc(collection(db, 'juridico'), {
        ...form,
        _createdAt: serverTimestamp()
      })
    }
    setShowModal(false)
  }

  const leis = [
    { titulo: 'Nova Reforma Tributária', desc: 'Impactos da CBS e IBS em condomínios e imobiliárias.', link: 'https://www.planalto.gov.br/' },
    { titulo: 'CLT - Leis Trabalhistas', desc: 'Regras para contratação e demissão de porteiros, zeladores e faxineiros.', link: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452.htm' },
    { titulo: 'Lei do Inquilinato', desc: 'Lei 8.245/91. Direitos e deveres de locadores e locatários.', link: 'https://www.planalto.gov.br/ccivil_03/leis/l8245.htm' },
    { titulo: 'Código Civil (Condomínios)', desc: 'Artigos 1.331 a 1.358 sobre as regras gerais de Condomínio Edilício.', link: 'https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm' },
  ]

  const totalAtrasado = cobrancas.reduce((acc, c) => acc + Number(c.valor||0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Inadimplência e Jurídico</h1>
          <p className="text-gray-500">Gestão de cobranças, contencioso e base legal.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl border border-cream-300 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-100 text-red-600 rounded-lg"><AlertTriangle size={24}/></div>
          <div><p className="text-sm text-gray-500 font-medium">Total em Atraso</p><h3 className="text-2xl font-bold text-gray-800">R$ {totalAtrasado.toFixed(2)}</h3></div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-cream-300 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-brand-100 text-brand-600 rounded-lg"><Scale size={24}/></div>
          <div><p className="text-sm text-gray-500 font-medium">Processos Ativos</p><h3 className="text-2xl font-bold text-gray-800">{processos.filter(p=>p.status==='Em Andamento').length}</h3></div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-cream-300 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-green-100 text-green-600 rounded-lg"><DollarSign size={24}/></div>
          <div><p className="text-sm text-gray-500 font-medium">Acordos Realizados</p><h3 className="text-2xl font-bold text-gray-800">{processos.filter(p=>p.status==='Acordo Realizado').length}</h3></div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-cream-300 shadow-sm overflow-hidden">
        <div className="flex border-b border-cream-300">
          <button onClick={()=>setActiveTab('cobranca')} className={`px-6 py-4 font-medium flex items-center gap-2 ${activeTab==='cobranca' ? 'text-brand-600 border-b-2 border-brand-600' : 'text-gray-500 hover:bg-cream-50'}`}><AlertTriangle size={18}/> Cobrança Automática</button>
          <button onClick={()=>setActiveTab('juridico')} className={`px-6 py-4 font-medium flex items-center gap-2 ${activeTab==='juridico' ? 'text-brand-600 border-b-2 border-brand-600' : 'text-gray-500 hover:bg-cream-50'}`}><Briefcase size={18}/> Área Jurídica (Contencioso)</button>
          <button onClick={()=>setActiveTab('biblioteca')} className={`px-6 py-4 font-medium flex items-center gap-2 ${activeTab==='biblioteca' ? 'text-brand-600 border-b-2 border-brand-600' : 'text-gray-500 hover:bg-cream-50'}`}><BookOpen size={18}/> Biblioteca de Leis</button>
        </div>

        <div className="p-6">
          {activeTab === 'cobranca' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-gray-800">Faturas em Atraso</h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input type="text" placeholder="Buscar inadimplente..." value={search} onChange={e=>setSearch(e.target.value)} className="input pl-10 w-64" />
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-gray-500 text-sm border-b border-cream-300">
                      <th className="pb-3 font-medium">Morador / Condomínio</th>
                      <th className="pb-3 font-medium">Referência</th>
                      <th className="pb-3 font-medium">Vencimento</th>
                      <th className="pb-3 font-medium">Valor</th>
                      <th className="pb-3 font-medium text-right">Ação de Cobrança</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cobrancas.filter(c => c.descricao?.toLowerCase().includes(search.toLowerCase()) || c.condominio?.toLowerCase().includes(search.toLowerCase())).map(c => (
                      <tr key={c.id} className="border-b border-cream-300 last:border-0">
                        <td className="py-3">
                          <p className="font-medium text-gray-800">{c.descricao.split('-')[0]}</p>
                          <p className="text-xs text-gray-500">{c.condominio}</p>
                        </td>
                        <td className="py-3 text-sm text-gray-600">{c.categoria}</td>
                        <td className="py-3 text-sm text-red-600 font-medium">{c.data}</td>
                        <td className="py-3 font-bold text-gray-800">R$ {Number(c.valor).toFixed(2)}</td>
                        <td className="py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={()=>handleCobrancaWpp(c)} className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100" title="Cobrar por WhatsApp"><MessageCircle size={18}/></button>
                            <button className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100" title="Cobrar por E-mail"><Mail size={18}/></button>
                            <button onClick={()=>setShowModal(true)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 flex items-center gap-1 text-sm font-medium" title="Enviar para Jurídico"><Gavel size={16}/> Jurídico</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {cobrancas.length === 0 && (
                      <tr><td colSpan="5" className="py-8 text-center text-gray-500">Nenhuma fatura em atraso. Parabéns!</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'juridico' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-gray-800">Processos em Andamento</h3>
                <button onClick={()=>setShowModal(true)} className="btn-primary flex items-center gap-2"><Plus size={18}/> Novo Processo</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {processos.map(p => (
                  <div key={p.id} className="border border-cream-300 rounded-xl p-5 hover:border-brand-300 transition-colors bg-cream-50">
                    <div className="flex justify-between items-start mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${p.status === 'Em Andamento' ? 'bg-yellow-100 text-yellow-700' : p.status === 'Acordo Realizado' ? 'bg-green-100 text-green-700' : p.status === 'Encerrado' ? 'bg-gray-200 text-gray-700' : 'bg-red-100 text-red-700'}`}>{p.status}</span>
                      <button onClick={()=>setShowModal(p)} className="text-gray-400 hover:text-brand-600"><Search size={16}/></button>
                    </div>
                    <h4 className="font-bold text-gray-800 mb-1">{p.morador}</h4>
                    <p className="text-xs text-gray-500 mb-3">{p.condominio} - Apt {p.apt}</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between"><span className="text-gray-500">Valor Cobrado:</span><span className="font-medium text-gray-800">R$ {Number(p.valor).toFixed(2)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Processo:</span><span className="font-medium text-gray-800">{p.numero_processo || 'Ñ Informado'}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Vara:</span><span className="font-medium text-gray-800">{p.vara || 'Extrajudicial'}</span></div>
                    </div>
                  </div>
                ))}
                {processos.length === 0 && (
                  <div className="col-span-full py-8 text-center text-gray-500">Nenhum processo jurídico ativo.</div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'biblioteca' && (
            <BibliotecaLeis />
          )}
        </div>
      </div>
      
      {showModal && <ProcessoModal processo={showModal !== true ? showModal : null} onClose={()=>setShowModal(false)} onSave={handleSaveProcesso} />}
    </div>
  )
}
