import React, { useState, useEffect } from 'react'
import { CheckCircle2, ChevronRight, Upload, Briefcase, AlertCircle } from 'lucide-react'
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../firebase'
import { useParams } from 'react-router-dom'

export default function OnboardingCandidato() {
  const { id } = useParams()
  const [candidato, setCandidato] = useState(null)
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [sucesso, setSucesso] = useState(false)

  // Documentos necessários
  const documentos = [
    { id: 'rg', nome: 'RG (Frente e Verso)' },
    { id: 'cpf', nome: 'CPF' },
    { id: 'cnh', nome: 'CNH (Opcional se não for motorista)' },
    { id: 'comprovanteResidencia', nome: 'Comprovante de Residência' },
    { id: 'ctps', nome: 'Carteira de Trabalho (CTPS)' },
    { id: 'certidaoNascimento', nome: 'Certidão de Nascimento (Filhos)' }
  ]

  const [form, setForm] = useState({
    nomeCompleto: '',
    nomeMae: '',
    dataNascimento: '',
    estadoCivil: 'Solteiro(a)',
    endereco: '',
    cep: ''
  })
  
  const [arquivos, setArquivos] = useState({}) // { rg: File, cpf: File, ... }

  useEffect(() => {
    carregarCandidato()
  }, [id])

  const carregarCandidato = async () => {
    if (!id) return
    try {
      const docRef = doc(db, 'candidatos', id)
      const snap = await getDoc(docRef)
      if (snap.exists()) {
        const data = snap.data()
        setCandidato(data)
        setForm(f => ({ ...f, nomeCompleto: data.nome || '' }))
        if (data.statusOnboarding === 'Concluído') {
          setSucesso(true)
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (docId, file) => {
    setArquivos(prev => ({ ...prev, [docId]: file }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validar essenciais
    if (!arquivos.rg || !arquivos.cpf || !arquivos.comprovanteResidencia || !arquivos.ctps) {
      return alert("Por favor, anexe pelo menos RG, CPF, Comprovante de Residência e CTPS.")
    }

    setEnviando(true)

    try {
      const urlsDocumentos = {}

      // Fazer upload de cada arquivo
      for (const docId of Object.keys(arquivos)) {
        const file = arquivos[docId]
        if (file) {
          const fileRef = ref(storage, `onboarding/${id}_${docId}_${Date.now()}`)
          await uploadBytes(fileRef, file)
          const url = await getDownloadURL(fileRef)
          urlsDocumentos[docId] = url
        }
      }

      // Atualizar o candidato no Firestore
      await updateDoc(doc(db, 'candidatos', id), {
        dadosPessoais: form,
        documentosDigitais: urlsDocumentos,
        statusOnboarding: 'Concluído',
        _updatedAt: serverTimestamp()
      })

      setSucesso(true)
    } catch (error) {
      console.error(error)
      alert("Erro ao enviar documentos. Tente novamente.")
    } finally {
      setEnviando(false)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-brand-600 font-bold">Verificando Link...</div>

  if (!candidato && !loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-sm">
        <AlertCircle size={40} className="text-red-500 mx-auto mb-4"/>
        <h2 className="text-xl font-bold text-gray-800">Link Inválido</h2>
        <p className="text-gray-500 text-sm mt-2">Este link de admissão não existe ou expirou.</p>
      </div>
    </div>
  )

  if (sucesso) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 animate-fade-in">
      <div className="bg-white p-10 rounded-2xl shadow-xl text-center max-w-md animate-scale-up">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 size={40} className="text-emerald-500" />
        </div>
        <h2 className="text-2xl font-black text-gray-800 mb-2">Tudo Certo!</h2>
        <p className="text-gray-500 mb-4">
          Seus documentos foram enviados com sucesso para o RH da Alpha Soluções Condominiais.
        </p>
        <p className="text-sm font-bold text-brand-600">
          Você pode fechar esta página.
        </p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans animate-fade-in">
      <header className="bg-brand-900 text-white py-12 px-4 shadow-md text-center">
        <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/20">
          <Briefcase size={32} className="text-emerald-400" />
        </div>
        <h1 className="text-3xl font-black mb-2">Admissão Digital</h1>
        <p className="text-brand-200 text-sm max-w-md mx-auto">
          Olá, {candidato.nome}! Parabéns pela aprovação na vaga de <strong>{candidato.vagaTitulo}</strong>. 
          Preencha os dados abaixo para concluirmos sua contratação.
        </p>
      </header>

      <main className="max-w-3xl mx-auto px-4 -mt-6">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-6 md:p-10">
          
          <div className="mb-8 border-b border-cream-200 pb-8">
            <h3 className="text-lg font-bold text-brand-900 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs">1</span>
              Dados Pessoais
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="label">Nome Completo</label><input required className="input" value={form.nomeCompleto} onChange={e=>setForm({...form, nomeCompleto:e.target.value})}/></div>
              <div><label className="label">Data de Nascimento</label><input required type="date" className="input" value={form.dataNascimento} onChange={e=>setForm({...form, dataNascimento:e.target.value})}/></div>
              <div><label className="label">Nome da Mãe</label><input required className="input" value={form.nomeMae} onChange={e=>setForm({...form, nomeMae:e.target.value})}/></div>
              <div>
                <label className="label">Estado Civil</label>
                <select className="input" value={form.estadoCivil} onChange={e=>setForm({...form, estadoCivil:e.target.value})}>
                  <option>Solteiro(a)</option>
                  <option>Casado(a)</option>
                  <option>Divorciado(a)</option>
                  <option>Viúvo(a)</option>
                </select>
              </div>
              <div className="md:col-span-2"><label className="label">Endereço Completo</label><input required className="input" value={form.endereco} onChange={e=>setForm({...form, endereco:e.target.value})} placeholder="Rua, Número, Bairro, Cidade"/></div>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-lg font-bold text-brand-900 mb-2 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs">2</span>
              Fotos dos Documentos
            </h3>
            <p className="text-xs text-gray-500 mb-6">Tire fotos legíveis dos documentos abaixo. Se estiver no celular, clique no botão para abrir a câmera.</p>
            
            <div className="flex flex-col gap-4">
              {documentos.map(doc => (
                <div key={doc.id} className="border border-cream-300 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50 hover:bg-cream-50 transition-colors">
                  <div>
                    <p className="font-bold text-gray-800 text-sm">{doc.nome}</p>
                    <p className="text-[10px] text-gray-500">{arquivos[doc.id] ? arquivos[doc.id].name : 'Nenhum arquivo anexado'}</p>
                  </div>
                  <div className="relative shrink-0">
                    <input 
                      type="file" 
                      accept="image/*,application/pdf"
                      capture="environment"
                      onChange={e => handleFileChange(doc.id, e.target.files[0])}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <button type="button" className={`btn-secondary text-xs w-full justify-center ${arquivos[doc.id] ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : ''}`}>
                      {arquivos[doc.id] ? <><CheckCircle2 size={14}/> Anexado</> : <><Upload size={14}/> Tirar Foto</>}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button type="submit" disabled={enviando} className="btn-primary w-full py-4 text-base shadow-xl justify-center">
            {enviando ? 'Enviando Documentos...' : <><CheckCircle2 size={18}/> Concluir e Enviar Admissão</>}
          </button>
        </form>
      </main>
    </div>
  )
}
