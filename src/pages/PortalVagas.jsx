import React, { useState, useEffect } from 'react'
import { Briefcase, MapPin, Clock, DollarSign, Upload, Send, CheckCircle2, Building, ChevronLeft } from 'lucide-react'
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../firebase'
import { Link } from 'react-router-dom'

export default function PortalVagas() {
  const [vagas, setVagas] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [vagaSelecionada, setVagaSelecionada] = useState(null)
  
  const [form, setForm] = useState({ nome: '', email: '', telefone: '', experiencia: '' })
  const [file, setFile] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [sucesso, setSucesso] = useState(false)

  useEffect(() => {
    carregarVagas()
  }, [])

  const carregarVagas = async () => {
    try {
      const q = query(collection(db, 'vagas'), where('status', '==', 'Aberta'))
      const snap = await getDocs(q)
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setVagas(data)
    } catch (e) {
      console.error("Erro ao carregar vagas:", e)
    } finally {
      setLoading(false)
    }
  }

  const handleApply = (vaga) => {
    setVagaSelecionada(vaga)
    setSucesso(false)
    setForm({ nome: '', email: '', telefone: '', experiencia: '' })
    setFile(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setEnviando('Preparando envio...')

    try {
      // 1. Criar Candidato
      setEnviando('Salvando candidato no banco de dados...')
      await addDoc(collection(db, 'candidatos'), {
        ...form,
        vagaId: vagaSelecionada.id,
        vagaTitulo: vagaSelecionada.titulo,
        condominio: vagaSelecionada.condominio || 'Administradora',
        curriculoUrl: '', // Será enviado via WhatsApp
        status: 'Pendente (WhatsApp)', // Aguardando o anexo via whats
        _createdAt: serverTimestamp()
      })

      // 2. Notificação
      setEnviando('Gerando notificação para o RH...')
      await addDoc(collection(db, 'notificacoes'), {
        text: `💼 Novo candidato (via WhatsApp) para a vaga: ${vagaSelecionada.titulo}`,
        time: new Date().toISOString(),
        tipo: 'rh',
        lida: false,
        condominio: vagaSelecionada.condominio || '',
        _createdAt: serverTimestamp()
      })

      // 3. Redirecionar para WhatsApp
      const numeroRH = "5583998468997" // Substitua pelo número real do RH se precisar
      const mensagem = `Olá, estou me candidatando para a vaga de *${vagaSelecionada.titulo}*.\n\nMeu nome: ${form.nome}\nEmail: ${form.email}\n\nSegue o meu currículo em PDF em anexo!`
      const linkWhatsapp = `https://wa.me/${numeroRH}?text=${encodeURIComponent(mensagem)}`
      
      window.open(linkWhatsapp, '_blank')
      setSucesso(true)
    } catch (e) {
      console.error(e)
      alert(`ERRO DETALHADO: ${e.message || e}`)
    } finally {
      setEnviando(false)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-brand-600 font-bold">Carregando Vagas...</div>

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans animate-fade-in">
      {/* HEADER PÚBLICO */}
      <header className="bg-brand-900 text-white py-12 px-4 shadow-md text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent"></div>
        <div className="max-w-3xl mx-auto relative z-10 flex flex-col items-center">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-md border border-white/20">
            <Briefcase size={32} className="text-brand-300" />
          </div>
          <h1 className="text-3xl md:text-4xl font-black mb-2 tracking-tight">Trabalhe Conosco</h1>
          <p className="text-brand-200 text-sm md:text-base max-w-lg">
            Faça parte da nossa equipe. Temos vagas abertas para atuar em nossos condomínios parceiros e na nossa administradora.
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 -mt-8 relative z-20">
        
        {/* TELA DE SUCESSO */}
        {sucesso && (
          <div className="bg-white rounded-2xl shadow-xl p-10 text-center animate-scale-up">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={40} className="text-emerald-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Quase lá!</h2>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              Recebemos os seus dados iniciais para a vaga de <strong>{vagaSelecionada?.titulo}</strong>. Agora, não esqueça de <strong>enviar o arquivo do seu currículo</strong> no WhatsApp que acabou de abrir! Boa sorte!
            </p>
            <button onClick={() => { setSucesso(false); setVagaSelecionada(null); }} className="btn-secondary px-8 py-3 rounded-xl mx-auto flex items-center gap-2">
              <ChevronLeft size={18}/> Voltar para as vagas
            </button>
          </div>
        )}

        {/* TELA DE FORMULÁRIO */}
        {!sucesso && vagaSelecionada && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden animate-fade-in flex flex-col md:flex-row">
            {/* Lado Esquerdo - Resumo da Vaga */}
            <div className="w-full md:w-1/3 bg-brand-50 p-8 border-b md:border-b-0 md:border-r border-brand-100">
              <button onClick={() => setVagaSelecionada(null)} className="text-brand-600 font-bold text-xs flex items-center gap-1 mb-6 hover:text-brand-800">
                <ChevronLeft size={14}/> Voltar
              </button>
              <h3 className="text-xl font-black text-brand-900 mb-4">{vagaSelecionada.titulo}</h3>
              <div className="flex flex-col gap-3 text-sm text-brand-700">
                <div className="flex items-center gap-2"><Building size={16}/> {vagaSelecionada.condominio || 'Administradora'}</div>
                <div className="flex items-center gap-2"><MapPin size={16}/> {vagaSelecionada.local || 'Não informado'}</div>
                <div className="flex items-center gap-2"><Clock size={16}/> {vagaSelecionada.cargaHoraria || 'Período Integral'}</div>
                {vagaSelecionada.salario && <div className="flex items-center gap-2"><DollarSign size={16}/> {vagaSelecionada.salario}</div>}
              </div>
              <div className="mt-6 pt-6 border-t border-brand-200">
                <h4 className="font-bold text-brand-900 mb-2 text-sm">Descrição</h4>
                <p className="text-xs text-brand-800 leading-relaxed whitespace-pre-wrap">{vagaSelecionada.descricao}</p>
              </div>
            </div>

            {/* Lado Direito - Form */}
            <div className="w-full md:w-2/3 p-8">
              <h3 className="text-xl font-bold text-gray-800 mb-6">Envie seu currículo</h3>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Nome Completo</label>
                    <input required type="text" className="input" value={form.nome} onChange={e=>setForm({...form, nome:e.target.value})} placeholder="Seu nome" />
                  </div>
                  <div>
                    <label className="label">Telefone (WhatsApp)</label>
                    <input required type="tel" className="input" value={form.telefone} onChange={e=>setForm({...form, telefone:e.target.value})} placeholder="(11) 99999-9999" />
                  </div>
                </div>
                <div>
                  <label className="label">Email</label>
                  <input required type="email" className="input" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} placeholder="seu.email@exemplo.com" />
                </div>
                <div>
                  <label className="label">Resumo Profissional</label>
                  <textarea required className="input min-h-[100px] resize-none" value={form.experiencia} onChange={e=>setForm({...form, experiencia:e.target.value})} placeholder="Fale um pouco sobre suas experiências recentes..." />
                </div>

                <div className="bg-emerald-50 text-emerald-800 p-4 rounded-xl border border-emerald-200 mt-2 text-sm flex gap-3 items-start">
                  <div className="bg-emerald-100 p-2 rounded-full mt-1 shrink-0">
                    <Send size={16} className="text-emerald-600" />
                  </div>
                  <p>Ao clicar em "Avançar para o WhatsApp", você será redirecionado para o WhatsApp do nosso RH. <strong>Por favor, lembre-se de anexar o arquivo do seu currículo na conversa!</strong></p>
                </div>

                <button type="submit" disabled={enviando} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold w-full py-4 text-base shadow-xl shadow-emerald-500/30 mt-4 justify-center flex items-center gap-2 rounded-xl transition-all">
                  {enviando ? enviando : <><Send size={18}/> Avançar para o WhatsApp</>}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TELA DE LISTAGEM */}
        {!sucesso && !vagaSelecionada && (
          <div className="flex flex-col gap-4">
            {vagas.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-xl p-10 text-center text-gray-500">
                <Briefcase size={40} className="mx-auto text-gray-300 mb-3" />
                <p>Nenhuma vaga aberta no momento.</p>
              </div>
            ) : (
              vagas.map(v => (
                <div key={v.id} className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-cream-200">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800 mb-1">{v.titulo}</h3>
                    <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-gray-500">
                      <span className="flex items-center gap-1"><Building size={14} className="text-brand-500"/> {v.condominio || 'Administradora'}</span>
                      <span className="flex items-center gap-1"><MapPin size={14} className="text-brand-500"/> {v.local || 'Diversos'}</span>
                    </div>
                  </div>
                  <button onClick={() => handleApply(v)} className="btn-primary py-3 px-6 shadow-md shrink-0 justify-center">
                    Candidatar-se
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      <footer className="text-center mt-20 text-xs text-gray-400">
        <p>Desenvolvido por Alpha Soluções Condominiais</p>
      </footer>
    </div>
  )
}
