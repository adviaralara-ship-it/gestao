import React, { useState, useEffect } from 'react'
import { Briefcase, Building, Wrench, CheckCircle, UploadCloud, ChevronRight, FileText } from 'lucide-react'
import { db } from '../firebase'
import { collection, addDoc, getDocs, serverTimestamp, query, where } from 'firebase/firestore'

export default function PortalFornecedores() {
  const [demandas, setDemandas] = useState([])
  const [selectedDemanda, setSelectedDemanda] = useState(null)
  const [loading, setLoading] = useState(true)
  const [enviado, setEnviado] = useState(false)
  
  const [form, setForm] = useState({
    empresa: '', cnpj: '', contato: '', telefone: '', email: '', valor: '', propostaTexto: ''
  })

  useEffect(() => {
    fetchDemandas()
  }, [])

  const fetchDemandas = async () => {
    try {
      const q = query(collection(db, 'demandas_cotacao'), where('status', '==', 'Aberta'))
      const snap = await getDocs(q)
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setDemandas(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.empresa || !form.valor || !form.telefone) {
      alert("Preencha Empresa, Telefone e Valor da Proposta.")
      return
    }

    try {
      await addDoc(collection(db, 'propostas_fornecedores'), {
        ...form,
        demandaId: selectedDemanda.id,
        demandaTitulo: selectedDemanda.titulo,
        condominio: selectedDemanda.condominio,
        dataEnvio: new Date().toLocaleDateString('pt-BR'),
        status: 'Em Análise',
        _createdAt: serverTimestamp()
      })
      
      // Notificação para o sistema
      await addDoc(collection(db, 'notificacoes'), {
        text: `[${selectedDemanda.condominio}] Nova proposta recebida para: ${selectedDemanda.titulo} (${form.empresa})`,
        time: new Date().toISOString(),
        tipo: 'cotacao',
        lida: false,
        condominio: selectedDemanda.condominio,
        _createdAt: serverTimestamp()
      })

      setEnviado(true)
    } catch (error) {
      alert("Erro ao enviar proposta. Tente novamente.")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
      </div>
    )
  }

  if (enviado) {
    return (
      <div className="min-h-screen bg-cream-50 flex flex-col items-center justify-center p-6 animate-fade-in">
        <div className="bg-white p-10 rounded-3xl shadow-xl max-w-md w-full text-center flex flex-col items-center">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
            <CheckCircle size={40} />
          </div>
          <h2 className="text-2xl font-black text-gray-800 mb-2">Proposta Enviada!</h2>
          <p className="text-gray-500 mb-8">Recebemos o seu orçamento com sucesso. O setor de compras da administradora entrará em contato caso sua proposta seja aprovada.</p>
          <button onClick={() => { setEnviado(false); setSelectedDemanda(null); setForm({ empresa: '', cnpj: '', contato: '', telefone: '', email: '', valor: '', propostaTexto: '' }) }} className="btn-primary w-full justify-center py-3">
            Voltar às Demandas
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream-50 flex flex-col items-center pb-20">
      {/* Header Público */}
      <div className="w-full bg-brand-900 text-white py-12 px-6 flex flex-col items-center text-center shadow-lg relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <Building size={48} className="mb-4 text-brand-300 relative z-10" />
        <h1 className="text-4xl font-black mb-2 relative z-10">Portal de Compras</h1>
        <p className="text-brand-100 max-w-lg relative z-10">Confira as demandas abertas dos condomínios administrados pela Alpha Gestão e envie sua proposta comercial.</p>
      </div>

      <div className="w-full max-w-5xl px-6 -mt-8 relative z-20">
        {!selectedDemanda ? (
          <div className="bg-white rounded-3xl shadow-xl p-6 md:p-10 border border-cream-200 min-h-[400px]">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <Briefcase className="text-brand-600"/> Oportunidades Abertas
            </h2>
            
            {demandas.length === 0 ? (
              <div className="text-center py-16">
                <Wrench size={48} className="mx-auto text-cream-300 mb-4" />
                <h3 className="text-lg font-bold text-gray-600">Nenhuma demanda no momento</h3>
                <p className="text-gray-400">Nossas cotações estão fechadas agora. Volte mais tarde.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {demandas.map(d => (
                  <div key={d.id} className="border border-cream-300 rounded-2xl p-5 hover:shadow-lg hover:border-brand-300 transition-all cursor-pointer group bg-gray-50 flex flex-col" onClick={() => setSelectedDemanda(d)}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="bg-brand-100 text-brand-800 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">
                        {d.categoria || 'Manutenção'}
                      </span>
                      <span className="text-xs font-bold text-gray-400 flex items-center gap-1">
                        Ver Detalhes <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform"/>
                      </span>
                    </div>
                    <h3 className="font-bold text-gray-800 text-lg mb-2">{d.titulo}</h3>
                    <p className="text-sm text-gray-500 line-clamp-2 flex-1 mb-4">{d.descricao}</p>
                    <div className="flex items-center justify-between text-xs font-medium text-gray-400 pt-3 border-t border-cream-200">
                      <span>Prazo: {d.prazoLimite || 'Não informado'}</span>
                      <span className="text-brand-600">🏢 {d.condominio || 'Alpha Gestão'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-xl border border-cream-200 overflow-hidden flex flex-col md:flex-row">
            {/* Detalhes da Demanda */}
            <div className="bg-cream-50 w-full md:w-5/12 p-8 border-b md:border-b-0 md:border-r border-cream-200 flex flex-col">
              <button onClick={() => setSelectedDemanda(null)} className="text-gray-400 hover:text-brand-600 font-medium text-sm flex items-center gap-1 mb-6 w-max transition-colors">
                <ChevronRight size={16} className="rotate-180"/> Voltar às demandas
              </button>
              
              <span className="bg-brand-600 text-white w-max text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider mb-3">
                {selectedDemanda.categoria || 'Manutenção'}
              </span>
              <h2 className="text-2xl font-black text-gray-800 mb-4">{selectedDemanda.titulo}</h2>
              <p className="text-gray-600 text-sm mb-6 whitespace-pre-wrap flex-1">{selectedDemanda.descricao}</p>
              
              <div className="bg-white p-4 rounded-xl border border-cream-200 text-sm">
                <p className="flex justify-between mb-2 pb-2 border-b border-cream-100">
                  <span className="text-gray-400 font-medium">Condomínio:</span>
                  <span className="font-bold text-gray-700 text-right">{selectedDemanda.condominio}</span>
                </p>
                <p className="flex justify-between mb-2 pb-2 border-b border-cream-100">
                  <span className="text-gray-400 font-medium">Prazo p/ Envio:</span>
                  <span className="font-bold text-gray-700 text-right">{selectedDemanda.prazoLimite || 'Imediato'}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-gray-400 font-medium">ID da Cotação:</span>
                  <span className="font-bold text-gray-400 text-right">#{selectedDemanda.id.substring(0,6).toUpperCase()}</span>
                </p>
              </div>
            </div>

            {/* Formulário de Proposta */}
            <div className="w-full md:w-7/12 p-8">
              <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <FileText className="text-brand-600"/> Enviar Orçamento
              </h3>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Nome da Empresa</label>
                    <input required className="w-full bg-cream-50 border border-cream-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none" value={form.empresa} onChange={e=>setForm({...form, empresa: e.target.value})} placeholder="Sua empresa" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">CNPJ (Opcional)</label>
                    <input className="w-full bg-cream-50 border border-cream-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none" value={form.cnpj} onChange={e=>setForm({...form, cnpj: e.target.value})} placeholder="00.000.000/0000-00" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Pessoa de Contato</label>
                    <input required className="w-full bg-cream-50 border border-cream-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none" value={form.contato} onChange={e=>setForm({...form, contato: e.target.value})} placeholder="Seu nome" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">WhatsApp / Telefone</label>
                    <input required className="w-full bg-cream-50 border border-cream-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none" value={form.telefone} onChange={e=>setForm({...form, telefone: e.target.value})} placeholder="(11) 99999-9999" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Valor da Proposta (R$)</label>
                  <input required type="number" step="0.01" min="0" className="w-full bg-brand-50 border border-brand-200 text-brand-900 font-bold rounded-xl px-4 py-3 text-lg focus:ring-2 focus:ring-brand-500 outline-none" value={form.valor} onChange={e=>setForm({...form, valor: e.target.value})} placeholder="0.00" />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Resumo do Orçamento / Descrição Técnica</label>
                  <textarea required className="w-full bg-cream-50 border border-cream-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none min-h-[120px] resize-y" value={form.propostaTexto} onChange={e=>setForm({...form, propostaTexto: e.target.value})} placeholder="Descreva os materiais, mão de obra, tempo estimado de garantia, etc..." />
                </div>

                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex gap-3 text-blue-800 text-sm mb-2 mt-2">
                  <UploadCloud size={24} className="shrink-0 text-blue-500" />
                  <p>Para enviar o PDF do orçamento ou laudo oficial, cole o link dele na descrição acima (ex: Google Drive), ou enviaremos um e-mail solicitando o anexo após o envio desta proposta.</p>
                </div>

                <button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg shadow-brand-500/30 transition-all flex items-center justify-center gap-2 mt-4 text-lg">
                  Enviar Proposta Comercial <CheckCircle size={20}/>
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
