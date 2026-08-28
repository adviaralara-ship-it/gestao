import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { collection, addDoc, updateDoc, doc, getDocs, query, where, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { CheckCircle2, Clock, Camera, Building2, User, FileText, Phone, Briefcase, ShieldCheck, ArrowRight, Sparkles } from 'lucide-react'

export default function CheckinPrestador() {
  const [searchParams] = useSearchParams()
  const condoParam = searchParams.get('condo') || ''

  const [condominios, setCondominios] = useState([])
  const [condoSelecionado, setCondoSelecionado] = useState(condoParam)
  const [nome, setNome] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [servico, setServico] = useState('')
  const [telefone, setTelefone] = useState('')
  const [foto, setFoto] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [etapa, setEtapa] = useState('selecao') // 'selecao' | 'sucesso_entrada' | 'sucesso_saida'
  const [loading, setLoading] = useState(false)
  const [gps, setGps] = useState(null)
  
  // Atendimentos em andamento do prestador
  const [atendimentoAtivo, setAtendimentoAtivo] = useState(null)

  useEffect(() => {
    const fetchCondos = async () => {
      try {
        const snap = await getDocs(collection(db, 'condominios'))
        setCondominios(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch (err) {
        console.error(err)
      }
    }
    fetchCondos()

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        },
        err => console.log('GPS indisponível:', err)
      )
    }
  }, [])

  useEffect(() => {
    if (condoParam) {
      setCondoSelecionado(decodeURIComponent(condoParam))
    }
  }, [condoParam])

  const verificarAtendimentoEmAberto = async () => {
    if (!nome || !condoSelecionado) return
    try {
      const q = query(
        collection(db, 'prestadores_atendimentos'),
        where('condominio', '==', condoSelecionado),
        where('nome', '==', nome.trim()),
        where('status', '==', 'Em Andamento')
      )
      const snap = await getDocs(q)
      if (!snap.empty) {
        const docAtivo = { id: snap.docs[0].id, ...snap.docs[0].data() }
        setAtendimentoAtivo(docAtivo)
      } else {
        setAtendimentoAtivo(null)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleFoto = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_WIDTH = 600
        const scaleSize = MAX_WIDTH / img.width
        canvas.width = MAX_WIDTH
        canvas.height = img.height * scaleSize
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const base64 = canvas.toDataURL('image/jpeg', 0.75)
        setFoto(base64)
      }
      img.src = event.target.result
    }
    reader.readAsDataURL(file)
  }

  const handleRegistrarEntrada = async (e) => {
    e.preventDefault()
    if (!condoSelecionado || !nome || !servico) {
      alert('Por favor, confirme o Condomínio, informe seu Nome e o Serviço a ser realizado.')
      return
    }

    setLoading(true)
    try {
      const agora = new Date()
      await addDoc(collection(db, 'prestadores_atendimentos'), {
        condominio: condoSelecionado,
        nome: nome.trim(),
        empresa: empresa.trim() || 'Autônomo',
        servico: servico.trim(),
        telefone: telefone.trim(),
        fotoEntrada: foto,
        entradaISO: agora.toISOString(),
        entradaData: agora.toLocaleDateString('pt-BR'),
        entradaHora: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        gpsEntrada: gps,
        status: 'Em Andamento',
        observacoesEntrada: observacoes,
        createdAt: serverTimestamp()
      })

      setEtapa('sucesso_entrada')
    } catch (err) {
      console.error(err)
      alert('Erro ao registrar entrada: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRegistrarSaida = async () => {
    if (!atendimentoAtivo) return
    setLoading(true)
    try {
      const agora = new Date()
      const entradaTime = new Date(atendimentoAtivo.entradaISO || (atendimentoAtivo.createdAt?.toDate ? atendimentoAtivo.createdAt.toDate() : agora))
      const diffMs = agora - entradaTime
      const diffHoras = Math.floor(diffMs / 3600000)
      const diffMin = Math.round((diffMs % 3600000) / 60000)
      const duracaoFormatada = `${diffHoras > 0 ? `${diffHoras}h ` : ''}${diffMin}min`

      await updateDoc(doc(db, 'prestadores_atendimentos', atendimentoAtivo.id), {
        status: 'Concluído',
        fotoSaida: foto,
        saidaISO: agora.toISOString(),
        saidaData: agora.toLocaleDateString('pt-BR'),
        saidaHora: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        gpsSaida: gps,
        duracao: duracaoFormatada,
        observacoesSaida: observacoes || servico,
        finalizadoEm: serverTimestamp()
      })

      setEtapa('sucesso_saida')
    } catch (err) {
      console.error(err)
      alert('Erro ao registrar saída: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const servicosSugestoes = [
    'Tratamento e Limpeza de Piscina',
    'Jardinagem e Poda de Grama',
    'Limpeza e Conservação Geral',
    'Manutenção Preventiva de Elevador',
    'Elétrica e Troca de Lâmpadas',
    'Hidráulica / Bombas d\'Água',
    'Controle de Pragas / Dedetização',
    'Manutenção de Portões e CFTV',
    'Pintura / Reparos Gerais'
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-brand-950 to-slate-900 text-gray-800 p-4 sm:p-6 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-white/20 animate-fade-in">
        
        {/* Cabeçalho */}
        <div className="bg-gradient-to-r from-brand-700 to-brand-850 p-6 text-white text-center relative">
          <div className="w-14 h-14 mx-auto bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 mb-3 shadow-inner">
            <ShieldCheck size={28} className="text-emerald-400" />
          </div>
          <h1 className="text-xl font-black tracking-tight">Alpha Soluções Condominiais</h1>
          <p className="text-xs text-brand-200 mt-0.5 font-medium">Registro de Serviço & Presença de Terceirizados</p>

          {/* Se o condomínio veio direto pelo QR Code do Residencial */}
          {condoSelecionado && (
            <div className="mt-3 bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/30 text-xs font-black text-white inline-flex items-center gap-1.5 shadow-sm">
              <Building2 size={14} className="text-amber-300" />
              <span>{condoSelecionado}</span>
            </div>
          )}
        </div>

        {/* Conteúdo */}
        <div className="p-6">

          {/* SUCESSO ENTRADA */}
          {etapa === 'sucesso_entrada' && (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 size={36} />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900">Entrada Registrada com Sucesso!</h2>
                <p className="text-xs text-slate-600 mt-1">
                  Bom trabalho, <b>{nome}</b>! Seu início de serviço no <b>{condoSelecionado}</b> foi registrado no painel da administração.
                </p>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs text-left space-y-1.5 font-medium">
                <p className="flex justify-between"><span>Empresa:</span> <b className="text-slate-900">{empresa || 'Autônomo'}</b></p>
                <p className="flex justify-between"><span>Serviço:</span> <b className="text-slate-900">{servico}</b></p>
                <p className="flex justify-between"><span>Horário de Início:</span> <b className="text-emerald-700">{new Date().toLocaleTimeString('pt-BR')}</b></p>
                <p className="flex justify-between"><span>Condomínio:</span> <b className="text-slate-900">{condoSelecionado}</b></p>
              </div>

              <div className="text-[11px] text-amber-900 bg-amber-50 p-3 rounded-xl border border-amber-200 text-left space-y-1">
                <p className="font-bold flex items-center gap-1">🔔 Ao terminar o serviço:</p>
                <p className="text-amber-800 leading-relaxed">
                  Aponte a câmera novamente para a placa QR Code deste condomínio para registrar sua <b>Saída com a foto do serviço executado</b>.
                </p>
              </div>

              <button
                onClick={() => { setEtapa('selecao'); setFoto(''); setObservacoes(''); }}
                className="btn-secondary w-full text-xs font-bold py-2.5"
              >
                Voltar ao Início
              </button>
            </div>
          )}

          {/* SUCESSO SAÍDA */}
          {etapa === 'sucesso_saida' && (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 size={36} />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900">Serviço Concluído & Saída Registrada!</h2>
                <p className="text-xs text-slate-600 mt-1">
                  Obrigado, <b>{nome}</b>! A comprovação do seu serviço foi gravada com sucesso.
                </p>
              </div>

              <div className="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-200 text-xs text-left space-y-1.5 font-medium text-emerald-900">
                <p className="flex justify-between"><span>Serviço Realizado:</span> <b>{atendimentoAtivo?.servico}</b></p>
                <p className="flex justify-between"><span>Entrada:</span> <b>{atendimentoAtivo?.entradaHora}</b></p>
                <p className="flex justify-between"><span>Saída:</span> <b>{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</b></p>
                <p className="flex justify-between"><span>Tempo no Condomínio:</span> <b className="text-emerald-700 font-black">{atendimentoAtivo?.duracao || 'Concluído'}</b></p>
              </div>

              <button
                onClick={() => { setEtapa('selecao'); setNome(''); setServico(''); setFoto(''); setAtendimentoAtivo(null); }}
                className="btn-primary w-full text-xs font-black py-3 bg-brand-700"
              >
                Novo Registro
              </button>
            </div>
          )}

          {/* FORMULÁRIO PRINCIPAL */}
          {etapa === 'selecao' && (
            <form onSubmit={handleRegistrarEntrada} className="space-y-4">
              
              {/* Seleção de Condomínio (Caso não tenha vindo direto pela URL) */}
              {!condoParam ? (
                <div>
                  <label className="label font-bold text-xs text-slate-700 flex items-center gap-1">
                    <Building2 size={14} className="text-brand-600" /> Condomínio *
                  </label>
                  <select
                    value={condoSelecionado}
                    onChange={e => setCondoSelecionado(e.target.value)}
                    className="input text-xs font-bold bg-slate-50"
                    required
                  >
                    <option value="">Selecione o Condomínio...</option>
                    {condominios.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                  </select>
                </div>
              ) : null}

              {/* Nome do Prestador */}
              <div>
                <label className="label font-bold text-xs text-slate-700 flex items-center gap-1">
                  <User size={14} className="text-brand-600" /> Seu Nome Completo *
                </label>
                <input
                  type="text"
                  className="input text-xs"
                  placeholder="Ex: Carlos Eduardo da Silva"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  onBlur={verificarAtendimentoEmAberto}
                  required
                />
              </div>

              {/* SE JÁ ESTIVER EM ANDAMENTO -> MOSTRA CARD DE REGISTRAR SAÍDA */}
              {atendimentoAtivo ? (
                <div className="bg-amber-50 p-4 rounded-2xl border-2 border-amber-300 space-y-3 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <Clock size={18} className="text-amber-700 animate-pulse" />
                    <div>
                      <h3 className="text-xs font-black text-amber-900 uppercase">Serviço em Andamento!</h3>
                      <p className="text-[11px] text-amber-800">
                        Entrada às <b>{atendimentoAtivo.entradaHora}</b> ({atendimentoAtivo.servico})
                      </p>
                    </div>
                  </div>

                  {/* Foto do Serviço Executado */}
                  <div>
                    <label className="label text-xs font-bold text-amber-900">Foto do Serviço Executado (Opcional)</label>
                    {foto ? (
                      <div className="flex items-center gap-3">
                        <img src={foto} alt="Serviço" className="w-16 h-16 object-cover rounded-xl border border-amber-300 shadow-sm" />
                        <button type="button" onClick={() => setFoto('')} className="text-xs text-rose-600 font-bold hover:underline">Trocar Foto</button>
                      </div>
                    ) : (
                      <input type="file" accept="image/*" capture="environment" onChange={handleFoto} className="input text-xs file:mr-3 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-amber-100 file:text-amber-900" />
                    )}
                  </div>

                  <div>
                    <label className="label text-xs font-bold text-amber-900">O que foi feito / Relato do Serviço:</label>
                    <input
                      type="text"
                      className="input text-xs bg-white"
                      placeholder="Ex: Piscina limpa, dosagem de cloro aplicada, filtros lavados..."
                      value={observacoes}
                      onChange={e => setObservacoes(e.target.value)}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleRegistrarSaida}
                    disabled={loading}
                    className="btn-primary w-full py-3 text-xs font-black bg-rose-600 hover:bg-rose-500 flex items-center justify-center gap-2 shadow-md"
                  >
                    <Clock size={16} /> Registrar Saída / Concluir Serviço
                  </button>
                </div>
              ) : (
                /* FORMULÁRIO DE ENTRADA */
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label font-bold text-xs text-slate-700 flex items-center gap-1">
                        <Briefcase size={14} className="text-brand-600" /> Empresa
                      </label>
                      <input
                        type="text"
                        className="input text-xs"
                        placeholder="Ex: Alpha Elevadores / Autônomo"
                        value={empresa}
                        onChange={e => setEmpresa(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label font-bold text-xs text-slate-700 flex items-center gap-1">
                        <Phone size={14} className="text-brand-600" /> WhatsApp / Tel
                      </label>
                      <input
                        type="tel"
                        className="input text-xs"
                        placeholder="(00) 00000-0000"
                        value={telefone}
                        onChange={e => setTelefone(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label font-bold text-xs text-slate-700 flex items-center gap-1">
                      <FileText size={14} className="text-brand-600" /> Serviço Prestado / O que veio fazer *
                    </label>
                    <input
                      type="text"
                      className="input text-xs font-semibold"
                      placeholder="Digite ou escolha uma sugestão abaixo..."
                      value={servico}
                      onChange={e => setServico(e.target.value)}
                      required
                    />
                    
                    {/* Sugestões rápidas com 1 clique */}
                    <div className="flex gap-1.5 flex-wrap mt-2">
                      {servicosSugestoes.slice(0, 5).map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setServico(s)}
                          className={`text-[10px] px-2 py-0.5 rounded-md border font-medium transition-all ${servico === s ? 'bg-brand-600 text-white border-brand-600' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'}`}
                        >
                          + {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Foto de Comprovação ou Selfie */}
                  <div>
                    <label className="label font-bold text-xs text-slate-700 flex items-center gap-1">
                      <Camera size={14} className="text-brand-600" /> Foto Selfie / Crachá (Opcional)
                    </label>
                    {foto ? (
                      <div className="flex items-center gap-3">
                        <img src={foto} alt="Selfie" className="w-16 h-16 object-cover rounded-xl border border-gray-300 shadow-sm" />
                        <button type="button" onClick={() => setFoto('')} className="text-xs text-rose-600 font-bold hover:underline">Trocar Foto</button>
                      </div>
                    ) : (
                      <input type="file" accept="image/*" capture="user" onChange={handleFoto} className="input text-xs file:mr-3 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700" />
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary w-full py-3 text-xs font-black bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center gap-2 shadow-lg mt-2 transition-all hover:scale-[1.02]"
                  >
                    <CheckCircle2 size={16} /> Registrar Entrada / Início do Serviço
                  </button>
                </>
              )}
            </form>
          )}
        </div>

        {/* Rodapé Seguro */}
        <div className="bg-slate-50 p-4 border-t border-slate-100 text-center text-[11px] text-slate-400">
          🔒 Alpha Soluções Condominiais • Comprovante de Presença com Horário & GPS
        </div>
      </div>
    </div>
  )
}
