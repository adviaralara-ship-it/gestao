import React, { useState, useMemo, useRef } from 'react'
import {
  Plus, Search, Shield, CheckCircle2, XCircle, Clock, AlertTriangle, QrCode, X,
  User, Camera, Package, Car, PhoneCall, AlertOctagon, RefreshCw, Check, CheckSquare,
  BookOpen, Building2, Eye, ExternalLink, Calendar, MapPin, Truck, ChevronRight
} from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'

export default function Portaria() {
  const { user } = useAuth()
  const { items: condominios } = useFirestore('condominios')
  const { items: visitantesCadastrados, updateItem: updateVisitanteCadastrado, deleteItem: delVisitanteCadastrado } = useFirestore('visitantes')
  const { items: acessosPortaria, addItem: addAcesso, updateItem: updateAcesso, deleteItem: delAcesso } = useFirestore('portaria_visitantes')
  const { items: prestadores, addItem: addPrestador, updateItem: updatePrestador } = useFirestore('portaria_prestadores')
  const { items: encomendas, addItem: addEncomenda, updateItem: updateEncomenda } = useFirestore('encomendas')
  const { items: livroPortaria, addItem: addLivroItem } = useFirestore('portaria_livro')
  const { items: avisos } = useFirestore('avisos')
  const { items: moradores } = useFirestore('moradores')
  const { items: veiculos } = useFirestore('veiculos')

  // Filtro de Condomínio
  const [condoFiltro, setCondoFiltro] = useState(user?.condominio || 'Todos')
  const [tab, setTab] = useState('visitantes')
  const [search, setSearch] = useState('')
  const [showScanner, setShowScanner] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [fotoModal, setFotoModal] = useState(null)
  const [modalEmergencia, setModalEmergencia] = useState(false)
  const [modalPassagemTurno, setModalPassagemTurno] = useState(false)
  const [modalNovoPrestador, setModalNovoPrestador] = useState(false)
  const [modalNovaEncomenda, setModalNovaEncomenda] = useState(false)
  const [modalNovoRegistroLivro, setModalNovoRegistroLivro] = useState(false)

  // Formulário manual de entrada rápida
  const [formManual, setFormManual] = useState({
    nome: '', destino: '', tipo: 'Visitante', autorizadoPor: '', doc: '', placa: ''
  })

  // Formulário de Prestador
  const [formPrestador, setFormPrestador] = useState({
    nome: '', empresa: '', documento: '', servico: '', destino: '', horarioAutorizado: 'Horário Comercial', responsavel: 'Síndico', obs: ''
  })

  // Formulário de Encomenda
  const [formEnc, setFormEnc] = useState({
    unidade: '', morador: '', transportadora: 'Correios', codigo: '', tipo: 'Pacote'
  })

  // Formulário Livro da Portaria
  const [formLivro, setFormLivro] = useState({ texto: '', tipo: 'Rotina' })

  // Formulário Passagem de Turno
  const [formTurno, setFormTurno] = useState({
    porteiroSaindo: user?.nome || 'Porteiro',
    porteiroEntrando: '',
    turno: 'Manhã',
    observacoes: '',
    pendencias: ''
  })

  // Filtragem por Condomínio
  const filterByCondo = (items) => {
    if (!condoFiltro || condoFiltro === 'Todos') return items
    return items.filter(it => !it.condominio || it.condominio === condoFiltro)
  }

  const visCadFiltrados = useMemo(() => filterByCondo(visitantesCadastrados), [visitantesCadastrados, condoFiltro])
  const acessosFiltrados = useMemo(() => filterByCondo(acessosPortaria), [acessosPortaria, condoFiltro])
  const prestFiltrados = useMemo(() => filterByCondo(prestadores), [prestadores, condoFiltro])
  const encFiltradas = useMemo(() => filterByCondo(encomendas), [encomendas, condoFiltro])
  const livroFiltrado = useMemo(() => filterByCondo(livroPortaria), [livroPortaria, condoFiltro])
  const avisosFiltrados = useMemo(() => filterByCondo(avisos), [avisos, condoFiltro])

  // Visitantes Esperados Hoje
  const visitantesEsperadosHoje = useMemo(() => {
    const hojeStr = new Date().toISOString().split('T')[0]
    return visCadFiltrados.filter(v => {
      const isHoje = !v.dataVisita || v.dataVisita === hojeStr || v.dataVisita.startsWith(hojeStr)
      return v.status === 'Autorizado' && isHoje
    })
  }, [visCadFiltrados])

  // Encomendas Pendentes
  const encomendasPendentes = useMemo(() => {
    return encFiltradas.filter(e => e.status !== 'Retirada' && e.status !== 'Entregue')
  }, [encFiltradas])

  // 1. Liberar Entrada de Visitante Pré-Autorizado
  const liberarVisitantePreAutorizado = async (vis) => {
    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const dataHoje = new Date().toLocaleDateString('pt-BR')

    // Registra no histórico de acessos
    await addAcesso({
      nome: vis.nome,
      destino: `${vis.moradorNome ? 'Morador: ' + vis.moradorNome : ''} ${vis.apt ? '(Apt ' + vis.apt + ')' : ''}`.trim() || 'Unidade',
      tipo: 'Visitante',
      autorizadoPor: vis.moradorNome ? `${vis.moradorNome} (Pré-autorizado)` : 'Morador',
      entrada: hora,
      saida: '—',
      data: dataHoje,
      status: 'No local',
      autorizado: true,
      foto: vis.foto || null,
      doc: vis.documento || '',
      condominio: vis.condominio || user?.condominio || ''
    })

    // Atualiza status do convite
    await updateVisitanteCadastrado(vis.id, { status: 'Acessou', entradaRegistrada: new Date().toISOString() })

    // Adiciona no livro da portaria automaticamente
    await addLivroItem({
      hora,
      data: dataHoje,
      texto: `Entrada autorizada: Visitante ${vis.nome} para ${vis.moradorNome || 'Morador'} (Apt ${vis.apt || '—'}).`,
      tipo: 'Visitante',
      porteiro: user?.nome || 'Porteiro',
      condominio: vis.condominio || user?.condominio || ''
    })

    alert(`✅ Entrada de ${vis.nome} liberada com sucesso!`)
  }

  // 2. Registrar Entrada Manual
  const handleRegistrarEntradaManual = async () => {
    if (!formManual.nome.trim() || !formManual.destino.trim()) {
      alert('Por favor, preencha o Nome e o Destino / Apartamento.')
      return
    }
    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const dataHoje = new Date().toLocaleDateString('pt-BR')

    await addAcesso({
      ...formManual,
      entrada: hora,
      saida: '—',
      data: dataHoje,
      status: 'No local',
      autorizado: true,
      condominio: condoFiltro !== 'Todos' ? condoFiltro : (user?.condominio || '')
    })

    await addLivroItem({
      hora,
      data: dataHoje,
      texto: `Entrada manual: ${formManual.tipo} ${formManual.nome} para ${formManual.destino}. Autorizado por: ${formManual.autorizadoPor || 'Portaria'}.`,
      tipo: formManual.tipo,
      porteiro: user?.nome || 'Porteiro',
      condominio: condoFiltro !== 'Todos' ? condoFiltro : (user?.condominio || '')
    })

    setFormManual({ nome: '', destino: '', tipo: 'Visitante', autorizadoPor: '', doc: '', placa: '' })
  }

  // 3. Registrar Saída
  const handleRegistrarSaida = async (id, nome) => {
    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    await updateAcesso(id, { saida: hora, status: 'Saiu' })
    
    await addLivroItem({
      hora,
      data: new Date().toLocaleDateString('pt-BR'),
      texto: `Saída registrada: ${nome || 'Pessoa'} deixou o condomínio.`,
      tipo: 'Saída',
      porteiro: user?.nome || 'Porteiro',
      condominio: condoFiltro !== 'Todos' ? condoFiltro : (user?.condominio || '')
    })
  }

  // 4. Scanner QR Code
  React.useEffect(() => {
    let scanner = null
    if (showScanner) {
      scanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false)
      scanner.render((text) => {
        scanner.clear()
        setShowScanner(false)
        handleQRScanned(text)
      }, () => {})
    }
    return () => {
      if (scanner) scanner.clear().catch(() => {})
    }
  }, [showScanner])

  const handleQRScanned = async (text) => {
    try {
      setScanResult({ type: 'loading', msg: 'Validando QR Code...' })
      let cleanId = text.trim()

      if (cleanId.includes('/visitantes/valida/')) {
        cleanId = cleanId.split('/visitantes/valida/')[1].split('?')[0].split('#')[0].trim()
      } else if (cleanId.includes('/eventos/valida/')) {
        cleanId = cleanId.split('/eventos/valida/')[1].split('?')[0].split('#')[0].trim()
      }

      const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      const dataHoje = new Date().toLocaleDateString('pt-BR')

      // Busca em visitantes
      try {
        const visRef = doc(db, 'visitantes', cleanId)
        const snap = await getDoc(visRef)
        if (snap.exists()) {
          const vis = snap.data()
          if (vis.status === 'Cancelado') {
            setScanResult({ type: 'error', msg: '⛔ Este convite foi CANCELADO pelo morador.' })
            return
          }
          if (vis.status === 'Acessou' && vis.entradaRegistrada) {
            setScanResult({ type: 'error', msg: `⚠️ Atenção: Entrada de ${vis.nome} já foi registrada hoje às ${vis.entradaRegistrada.split('T')[1]?.slice(0,5) || ''}.` })
            return
          }

          await addAcesso({
            nome: vis.nome || 'Visitante (QR Code)',
            destino: `${vis.moradorNome ? 'Morador: ' + vis.moradorNome : ''} ${vis.apt ? '(Apt ' + vis.apt + ')' : ''}`.trim() || 'Unidade Residencial',
            tipo: 'Visitante',
            autorizadoPor: vis.moradorNome ? `${vis.moradorNome} (QR Code)` : 'Morador',
            entrada: hora,
            saida: '—',
            data: dataHoje,
            status: 'No local',
            autorizado: true,
            foto: vis.foto || null,
            doc: vis.documento || '',
            condominio: vis.condominio || user?.condominio || ''
          })

          await updateDoc(visRef, { status: 'Acessou', entradaRegistrada: new Date().toISOString() })

          await addLivroItem({
            hora,
            data: dataHoje,
            texto: `QR Code validado: Entrada de ${vis.nome} para ${vis.moradorNome || 'Morador'} (Apt ${vis.apt || '—'}).`,
            tipo: 'QR Code',
            porteiro: user?.nome || 'Porteiro',
            condominio: vis.condominio || user?.condominio || ''
          })

          setScanResult({
            type: 'success',
            msg: `✅ Entrada de ${vis.nome} LIBERADA! Destino: ${vis.moradorNome || 'Morador'} (Apt ${vis.apt || '—'})`,
            foto: vis.foto || null
          })
          return
        }
      } catch (err) {}

      setScanResult({ type: 'error', msg: '❌ QR Code não encontrado no sistema.' })
    } catch (err) {
      setScanResult({ type: 'error', msg: 'Erro ao processar QR Code.' })
    }
  }

  // 5. Salvar Prestador de Serviço
  const handleSavePrestador = async () => {
    if (!formPrestador.nome || !formPrestador.empresa) {
      alert('Preencha o Nome e a Empresa do prestador.')
      return
    }
    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const dataHoje = new Date().toLocaleDateString('pt-BR')

    await addPrestador({
      ...formPrestador,
      entrada: hora,
      saida: '—',
      data: dataHoje,
      status: 'No local',
      condominio: condoFiltro !== 'Todos' ? condoFiltro : (user?.condominio || '')
    })

    await addLivroItem({
      hora,
      data: dataHoje,
      texto: `Prestador de serviço: ${formPrestador.nome} (${formPrestador.empresa}) entrou para serviço de ${formPrestador.servico} em ${formPrestador.destino || 'Área Comum'}.`,
      tipo: 'Prestador',
      porteiro: user?.nome || 'Porteiro',
      condominio: condoFiltro !== 'Todos' ? condoFiltro : (user?.condominio || '')
    })

    setFormPrestador({ nome: '', empresa: '', documento: '', servico: '', destino: '', horarioAutorizado: 'Horário Comercial', responsavel: 'Síndico', obs: '' })
    setModalNovoPrestador(false)
  }

  // 6. Salvar Encomenda
  const handleSaveEncomenda = async () => {
    if (!formEnc.unidade) {
      alert('Informe a unidade / apartamento da encomenda.')
      return
    }
    const dataHora = new Date().toLocaleString('pt-BR')
    await addEncomenda({
      ...formEnc,
      dataRecebimento: dataHora,
      status: 'Recebida',
      condominio: condoFiltro !== 'Todos' ? condoFiltro : (user?.condominio || '')
    })

    await addLivroItem({
      hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      data: new Date().toLocaleDateString('pt-BR'),
      texto: `Encomenda recebida: ${formEnc.tipo} da ${formEnc.transportadora} para Unidade ${formEnc.unidade} (${formEnc.morador || 'Morador'}).`,
      tipo: 'Encomenda',
      porteiro: user?.nome || 'Porteiro',
      condominio: condoFiltro !== 'Todos' ? condoFiltro : (user?.condominio || '')
    })

    setFormEnc({ unidade: '', morador: '', transportadora: 'Correios', codigo: '', tipo: 'Pacote' })
    setModalNovaEncomenda(false)
  }

  // 7. Retirar Encomenda
  const handleRetirarEncomenda = async (id, unidade) => {
    const dataHora = new Date().toLocaleString('pt-BR')
    await updateEncomenda(id, { status: 'Retirada', dataRetirada: dataHora, retiradoPor: 'Morador / Autorizado' })
    
    await addLivroItem({
      hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      data: new Date().toLocaleDateString('pt-BR'),
      texto: `Encomenda retirada pela Unidade ${unidade}.`,
      tipo: 'Encomenda',
      porteiro: user?.nome || 'Porteiro',
      condominio: condoFiltro !== 'Todos' ? condoFiltro : (user?.condominio || '')
    })
  }

  // 8. Salvar Item no Livro da Portaria
  const handleSaveLivro = async () => {
    if (!formLivro.texto.trim()) return
    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const dataHoje = new Date().toLocaleDateString('pt-BR')

    await addLivroItem({
      hora,
      data: dataHoje,
      texto: formLivro.texto.trim(),
      tipo: formLivro.tipo,
      porteiro: user?.nome || 'Porteiro',
      condominio: condoFiltro !== 'Todos' ? condoFiltro : (user?.condominio || '')
    })

    setFormLivro({ texto: '', tipo: 'Rotina' })
    setModalNovoRegistroLivro(false)
  }

  // 9. Salvar Passagem de Turno
  const handleSavePassagemTurno = async () => {
    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const dataHoje = new Date().toLocaleDateString('pt-BR')

    const textoTurno = `🔄 PASSAGEM DE TURNO (${formTurno.turno}): De ${formTurno.porteiroSaindo} para ${formTurno.porteiroEntrando || 'Próximo Porteiro'}. Pendências: ${formTurno.pendencias || 'Nenhuma'}. Observações: ${formTurno.observacoes || 'Turno tranquilo'}.`

    await addLivroItem({
      hora,
      data: dataHoje,
      texto: textoTurno,
      tipo: 'Passagem de Turno',
      porteiro: formTurno.porteiroSaindo,
      condominio: condoFiltro !== 'Todos' ? condoFiltro : (user?.condominio || '')
    })

    alert('✅ Passagem de turno registrada no Livro Oficial da Portaria!')
    setModalPassagemTurno(false)
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-7xl mx-auto pb-16">
      
      {/* Topo / Header da Portaria com Seletor de Condomínio e SOS */}
      <div className="bg-white p-5 rounded-3xl border border-pale-300 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-gray-900">
              🚪 Central de Portaria & Controle de Acesso
            </h2>
          </div>
          <p className="text-gray-500 font-medium text-xs md:text-sm mt-0.5">
            Recepção, verificação de QR Code, biometria facial, encomendas e livro de turno
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Seletor de Condomínio Ativo */}
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 px-3 rounded-2xl border border-gray-200">
            <Building2 size={16} className="text-brand-600" />
            <select
              className="bg-transparent text-xs font-black text-gray-800 border-none outline-none cursor-pointer"
              value={condoFiltro}
              onChange={e => setCondoFiltro(e.target.value)}
            >
              <option value="Todos">🏢 Todos os Condomínios</option>
              {condominios.map(c => (
                <option key={c.id || c.nome} value={c.nome}>{c.nome}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setModalEmergencia(true)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-rose-600/30 animate-pulse cursor-pointer"
          >
            <AlertOctagon size={16} /> 🚨 SOS EMERGÊNCIA
          </button>
        </div>
      </div>

      {/* Cards de Métricas da Portaria */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-pale-300 shadow-sm">
          <span className="text-[11px] font-bold text-gray-400 uppercase">Esperados Hoje</span>
          <p className="text-2xl font-black text-amber-600 mt-1">{visitantesEsperadosHoje.length}</p>
          <span className="text-[10px] text-gray-500">Visitantes pré-autorizados</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-pale-300 shadow-sm">
          <span className="text-[11px] font-bold text-gray-400 uppercase">No Local Agora</span>
          <p className="text-2xl font-black text-emerald-600 mt-1">
            {acessosFiltrados.filter(a => a.status === 'No local').length}
          </p>
          <span className="text-[10px] text-gray-500">Visitantes / Prestadores</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-pale-300 shadow-sm">
          <span className="text-[11px] font-bold text-gray-400 uppercase">Prestadores</span>
          <p className="text-2xl font-black text-blue-600 mt-1">
            {prestFiltrados.filter(p => p.status === 'No local').length}
          </p>
          <span className="text-[10px] text-gray-500">Em serviço ativo</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-pale-300 shadow-sm">
          <span className="text-[11px] font-bold text-gray-400 uppercase">Encomendas</span>
          <p className="text-2xl font-black text-purple-600 mt-1">{encomendasPendentes.length}</p>
          <span className="text-[10px] text-gray-500">Aguardando retirada</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-pale-300 shadow-sm col-span-2 sm:col-span-1">
          <span className="text-[11px] font-bold text-gray-400 uppercase">Passagem de Turno</span>
          <button
            onClick={() => setModalPassagemTurno(true)}
            className="mt-1 w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1 shadow-sm"
          >
            <RefreshCw size={13} /> Troca de Turno
          </button>
          <span className="text-[10px] text-gray-400 block text-center mt-1">Passar pendências</span>
        </div>
      </div>

      {/* Navegação por Abas da Portaria */}
      <div className="flex gap-2 border-b border-gray-200 pb-2 overflow-x-auto">
        {[
          { id: 'visitantes', label: '👥 Visitantes & Entradas' },
          { id: 'prestadores', label: '🔧 Prestadores de Serviço' },
          { id: 'encomendas', label: '📦 Encomendas' },
          { id: 'livro', label: '📖 Livro da Portaria' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-2.5 rounded-2xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
              tab === t.id ? 'bg-brand-600 text-white shadow-md' : 'bg-white text-gray-600 hover:text-brand-700 border border-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* ABA 1: VISITANTES & ENTRADAS                                              */}
      {/* ========================================================================= */}
      {tab === 'visitantes' && (
        <div className="flex flex-col gap-6">
          {/* Card: Leitor QR Code + Registro Rápido */}
          <div className="bg-white p-6 rounded-3xl border border-pale-300 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="font-black text-gray-900 text-base">🚪 Registrar Entrada de Visitante</h3>
                <p className="text-xs text-gray-400">Leia o QR Code do celular do visitante ou cadastre manualmente</p>
              </div>
              <button
                onClick={() => { setScanResult(null); setShowScanner(true); }}
                className="btn-primary py-2.5 px-5 text-xs font-black bg-emerald-600 hover:bg-emerald-500 flex items-center gap-2 shadow-md"
              >
                <QrCode size={16} /> Ler QR Code na Câmera
              </button>
            </div>

            {/* Resultado do Scan */}
            {scanResult && (
              <div className={`p-4 rounded-2xl mb-4 border flex items-center justify-between gap-3 ${
                scanResult.type === 'success' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' :
                scanResult.type === 'error' ? 'bg-rose-50 border-rose-300 text-rose-900' :
                'bg-blue-50 border-blue-300 text-blue-900'
              }`}>
                <div className="flex items-center gap-3">
                  {scanResult.foto && (
                    <img src={scanResult.foto} alt="Visitante" className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500 shadow-sm" />
                  )}
                  <div>
                    <p className="text-sm font-black">{scanResult.msg}</p>
                    <p className="text-xs opacity-75 mt-0.5">Validação em tempo real</p>
                  </div>
                </div>
                <button onClick={() => setScanResult(null)} className="p-1 rounded-lg hover:bg-black/10 text-gray-600">
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Modal Scanner */}
            {showScanner && (
              <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                <div className="bg-white p-6 rounded-3xl max-w-sm w-full relative shadow-2xl">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                      <QrCode size={18} className="text-brand-600" /> Aponte para o QR Code
                    </h3>
                    <button onClick={() => setShowScanner(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
                      <X size={20} />
                    </button>
                  </div>
                  <div id="qr-reader" className="overflow-hidden rounded-2xl border border-gray-200"></div>
                  <p className="text-xs text-gray-400 text-center mt-3">Aponte a câmera para o QR Code apresentado pelo visitante.</p>
                </div>
              </div>
            )}

            {/* Formulário de Entrada Manual */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="label">Nome do Visitante *</label>
                <input className="input w-full" placeholder="Nome completo" value={formManual.nome} onChange={e => setFormManual(f => ({ ...f, nome: e.target.value }))} />
              </div>
              <div>
                <label className="label">Destino / Apartamento *</label>
                <input className="input w-full" placeholder="Ex: Bloco B Apt 103" value={formManual.destino} onChange={e => setFormManual(f => ({ ...f, destino: e.target.value }))} />
              </div>
              <div>
                <label className="label">Tipo</label>
                <select className="input w-full" value={formManual.tipo} onChange={e => setFormManual(f => ({ ...f, tipo: e.target.value }))}>
                  <option>Visitante</option>
                  <option>Entrega / Delivery</option>
                  <option>Prestador de Serviço</option>
                  <option>Corretor / Outro</option>
                </select>
              </div>
              <div>
                <label className="label">Autorizado Por</label>
                <input className="input w-full" placeholder="Nome do morador" value={formManual.autorizadoPor} onChange={e => setFormManual(f => ({ ...f, autorizadoPor: e.target.value }))} />
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button onClick={handleRegistrarEntradaManual} className="btn-primary py-2 px-5 text-xs font-bold flex items-center gap-1.5 shadow-sm">
                <Plus size={15} /> Registrar Entrada Manual
              </button>
            </div>
          </div>

          {/* SEÇÃO 1: VISITANTES ESPERADOS / PRÉ-AUTORIZADOS PELOS MORADORES */}
          <div className="bg-white rounded-3xl border border-amber-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 bg-amber-50/70 border-b border-amber-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping"></span>
                <h3 className="font-black text-amber-900 text-sm">
                  🟡 Visitantes Esperados Hoje (Pré-autorizados pelos Moradores)
                </h3>
              </div>
              <span className="text-xs font-bold text-amber-800 bg-amber-100 px-3 py-0.5 rounded-full">
                {visitantesEsperadosHoje.length} aguardando chegada
              </span>
            </div>

            <div className="divide-y divide-gray-100">
              {visitantesEsperadosHoje.length === 0 ? (
                <p className="text-xs text-gray-400 p-6 text-center">Nenhum visitante pré-autorizado aguardando chegada no momento.</p>
              ) : (
                visitantesEsperadosHoje.map(v => (
                  <div key={v.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-amber-50/30 transition-colors">
                    <div className="flex items-center gap-3">
                      {v.foto ? (
                        <img onClick={() => setFotoModal(v.foto)} src={v.foto} alt={v.nome} className="w-11 h-11 rounded-full object-cover border-2 border-emerald-500 cursor-pointer shadow-sm" title="Ver Foto" />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-slate-100 border border-gray-200 flex items-center justify-center text-gray-400">
                          <User size={18} />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-gray-900 text-sm">{v.nome}</h4>
                          <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md uppercase">
                            Pré-autorizado
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5">
                          Anfitrião: <b className="text-gray-900">{v.moradorNome || 'Morador'}</b> {v.apt ? `(Apt ${v.apt})` : ''} • Doc: <span className="font-mono text-gray-700">{v.documento || '—'}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => liberarVisitantePreAutorizado(v)}
                        className="btn-primary py-2 px-4 text-xs font-black bg-emerald-600 hover:bg-emerald-500 flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
                      >
                        <Check size={15} /> Liberar Entrada
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* SEÇÃO 2: HISTÓRICO DE ACESSOS E ENTRADAS REGISTRADAS HOJE */}
          <div className="bg-white rounded-3xl border border-pale-300 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="font-black text-gray-900 text-sm">📋 Acessos Registrados na Portaria</h3>
              <div className="relative w-full sm:max-w-xs">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-9 w-full text-xs" placeholder="Buscar visitante ou destino..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-gray-200">
                  <tr>
                    {['Visitante', 'Destino', 'Tipo', 'Autorizado Por', 'Entrada', 'Saída', 'Status', 'Ações'].map(h => (
                      <th key={h} className="table-head text-[11px] font-black text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {acessosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-10 text-gray-400 text-xs">
                        Nenhum registro de acesso na portaria hoje.
                      </td>
                    </tr>
                  ) : (
                    acessosFiltrados.map(v => (
                      <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                        <td className="table-cell">
                          <div className="flex items-center gap-2.5">
                            {v.foto ? (
                              <img onClick={() => setFotoModal(v.foto)} src={v.foto} alt={v.nome} className="w-8 h-8 rounded-full object-cover border border-emerald-400 cursor-pointer" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-gray-400">
                                <User size={14} />
                              </div>
                            )}
                            <div>
                              <p className="font-bold text-gray-900 text-xs">{v.nome}</p>
                              {v.doc && <p className="text-[10px] text-gray-400 font-mono">Doc: {v.doc}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="table-cell text-xs font-bold text-gray-700">{v.destino}</td>
                        <td className="table-cell">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                            {v.tipo}
                          </span>
                        </td>
                        <td className="table-cell text-xs text-gray-600">{v.autorizadoPor || '—'}</td>
                        <td className="table-cell text-xs font-bold text-emerald-700">{v.entrada || '—'}</td>
                        <td className="table-cell text-xs font-bold text-gray-500">{v.saida || '—'}</td>
                        <td className="table-cell">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase ${
                            v.status === 'No local' ? 'bg-emerald-100 text-emerald-800' :
                            v.status === 'Saiu' ? 'bg-slate-100 text-slate-700' :
                            'bg-rose-100 text-rose-800'
                          }`}>
                            {v.status || 'Ativo'}
                          </span>
                        </td>
                        <td className="table-cell">
                          {v.status === 'No local' && (
                            <button
                              onClick={() => handleRegistrarSaida(v.id, v.nome)}
                              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold"
                            >
                              Dar Saída
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: PRESTADORES DE SERVIÇO                                             */}
      {/* ========================================================================= */}
      {tab === 'prestadores' && (
        <div className="bg-white p-6 rounded-3xl border border-pale-300 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-black text-gray-900 text-base">🔧 Controle de Prestadores de Serviço</h3>
              <p className="text-xs text-gray-400">Registro de técnicos, empreiteiras, manutenção e entregadores terceirizados</p>
            </div>
            <button
              onClick={() => setModalNovoPrestador(true)}
              className="btn-primary py-2 px-4 text-xs font-black bg-blue-600 hover:bg-blue-500"
            >
              + Registrar Entrada de Prestador
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-gray-200">
                <tr>
                  {['Técnico / Prestador', 'Empresa', 'Serviço', 'Local / Unidade', 'Horário Autorizado', 'Responsável', 'Entrada', 'Saída', 'Ações'].map(h => (
                    <th key={h} className="table-head text-[11px] font-black text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {prestFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-10 text-gray-400 text-xs">Nenhum prestador de serviço registrado no momento.</td>
                  </tr>
                ) : (
                  prestFiltrados.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="table-cell font-bold text-gray-900 text-xs">{p.nome}</td>
                      <td className="table-cell text-xs font-semibold text-blue-700">{p.empresa}</td>
                      <td className="table-cell text-xs text-gray-600">{p.servico}</td>
                      <td className="table-cell text-xs font-bold text-gray-800">{p.destino || 'Área Comum'}</td>
                      <td className="table-cell text-xs text-gray-500">{p.horarioAutorizado || 'Comercial'}</td>
                      <td className="table-cell text-xs text-gray-700">{p.responsavel || 'Síndico'}</td>
                      <td className="table-cell text-xs font-bold text-emerald-700">{p.entrada}</td>
                      <td className="table-cell text-xs font-bold text-gray-500">{p.saida || '—'}</td>
                      <td className="table-cell">
                        {p.status === 'No local' && (
                          <button
                            onClick={async () => {
                              const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                              await updatePrestador(p.id, { saida: hora, status: 'Finalizado' })
                            }}
                            className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold"
                          >
                            Registrar Saída
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 3: ENCOMENDAS                                                         */}
      {/* ========================================================================= */}
      {tab === 'encomendas' && (
        <div className="bg-white p-6 rounded-3xl border border-pale-300 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-black text-gray-900 text-base">📦 Controle de Encomendas & Entregas</h3>
              <p className="text-xs text-gray-400">Recebimento, guarda e baixa de pacotes para moradores</p>
            </div>
            <button
              onClick={() => setModalNovaEncomenda(true)}
              className="btn-primary py-2 px-4 text-xs font-black bg-purple-600 hover:bg-purple-500"
            >
              + Receber Nova Encomenda
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {encomendasPendentes.map(enc => (
              <div key={enc.id} className="p-4 bg-purple-50/60 rounded-2xl border border-purple-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black bg-purple-200 text-purple-900 px-2.5 py-0.5 rounded-lg">
                      Unidade {enc.unidade}
                    </span>
                    <span className="text-[10px] text-gray-500 font-bold">{enc.dataRecebimento}</span>
                  </div>
                  <p className="font-bold text-gray-900 text-sm">{enc.morador || 'Morador'}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Transportadora: <b>{enc.transportadora}</b> ({enc.tipo || 'Pacote'})
                  </p>
                  {enc.codigo && <p className="text-[10px] text-gray-400 font-mono mt-0.5">Rastreio: {enc.codigo}</p>}
                </div>

                <button
                  onClick={() => handleRetirarEncomenda(enc.id, enc.unidade)}
                  className="mt-4 w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-sm flex items-center justify-center gap-1.5"
                >
                  <Check size={14} /> Marcar como Retirada
                </button>
              </div>
            ))}
          </div>

          {encomendasPendentes.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-8">Nenhuma encomenda aguardando retirada na portaria.</p>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 4: LIVRO DA PORTARIA (DIÁRIO DIGITAL DO TURNO)                        */}
      {/* ========================================================================= */}
      {tab === 'livro' && (
        <div className="bg-white p-6 rounded-3xl border border-pale-300 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-black text-gray-900 text-base">📖 Livro de Ocorrências Digital da Portaria</h3>
              <p className="text-xs text-gray-400">Histórico cronológico de acontecimentos, rondas e observações do turno</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setModalNovoRegistroLivro(true)}
                className="btn-secondary py-2 px-3 text-xs font-bold"
              >
                + Novo Registro no Livro
              </button>
              <button
                onClick={() => setModalPassagemTurno(true)}
                className="btn-primary py-2 px-4 text-xs font-black bg-slate-900 hover:bg-slate-800"
              >
                <RefreshCw size={13} /> Passagem de Turno
              </button>
            </div>
          </div>

          <div className="space-y-3 mt-2">
            {livroFiltrado.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">Nenhum registro no livro da portaria hoje.</p>
            ) : (
              livroFiltrado.map((item, idx) => (
                <div key={idx} className="p-3.5 bg-slate-50 rounded-2xl border border-gray-200 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-mono font-black bg-brand-100 text-brand-800 px-2 py-0.5 rounded-lg shrink-0">
                      {item.hora || '00:00'}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-gray-900 leading-relaxed">{item.texto}</p>
                      <p className="text-[10px] text-gray-500 mt-1">Registrado por: <b>{item.porteiro || 'Porteiro'}</b> • {item.data}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{item.tipo || 'Geral'}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: BOTÃO DE EMERGÊNCIA (SOS)                                        */}
      {/* ========================================================================= */}
      {modalEmergencia && (
        <div className="modal-overlay" onClick={() => setModalEmergencia(false)}>
          <div className="modal-content max-w-md p-6 bg-white rounded-3xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertOctagon size={24} />
                <h3 className="font-black text-lg text-rose-600">🚨 DISCADOR DE EMERGÊNCIA</h3>
              </div>
              <button onClick={() => setModalEmergencia(false)}><X size={20} className="text-gray-400" /></button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <a href="tel:190" className="p-4 bg-rose-50 hover:bg-rose-100 rounded-2xl border border-rose-200 flex flex-col items-center justify-center text-center group">
                <span className="text-2xl mb-1">🚓</span>
                <span className="font-black text-rose-900 text-sm">Polícia Militar</span>
                <span className="text-lg font-black text-rose-600">190</span>
              </a>

              <a href="tel:193" className="p-4 bg-rose-50 hover:bg-rose-100 rounded-2xl border border-rose-200 flex flex-col items-center justify-center text-center group">
                <span className="text-2xl mb-1">🚒</span>
                <span className="font-black text-rose-900 text-sm">Bombeiros</span>
                <span className="text-lg font-black text-rose-600">193</span>
              </a>

              <a href="tel:192" className="p-4 bg-rose-50 hover:bg-rose-100 rounded-2xl border border-rose-200 flex flex-col items-center justify-center text-center group">
                <span className="text-2xl mb-1">🚑</span>
                <span className="font-black text-rose-900 text-sm">SAMU</span>
                <span className="text-lg font-black text-rose-600">192</span>
              </a>

              <a href="tel:0800000000" className="p-4 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-gray-200 flex flex-col items-center justify-center text-center group">
                <span className="text-2xl mb-1">🛡️</span>
                <span className="font-black text-gray-900 text-sm">Central Alpha</span>
                <span className="text-sm font-black text-brand-600">Suporte 24h</span>
              </a>
            </div>

            <p className="text-xs text-gray-500 text-center mt-4">
              Clique em qualquer número para ligar imediatamente do celular ou telefone IP.
            </p>
          </div>
        </div>
      )}

      {/* MODAL 2: NOVO PRESTADOR */}
      {modalNovoPrestador && (
        <div className="modal-overlay" onClick={() => setModalNovoPrestador(false)}>
          <div className="modal-content max-w-md p-6 bg-white rounded-3xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Entrada de Prestador de Serviço</h3>
              <button onClick={() => setModalNovoPrestador(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="flex flex-col gap-3">
              <div><label className="label">Nome do Técnico *</label><input className="input w-full" value={formPrestador.nome} onChange={e => setFormPrestador(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Marcos Souza" /></div>
              <div><label className="label">Empresa *</label><input className="input w-full" value={formPrestador.empresa} onChange={e => setFormPrestador(f => ({ ...f, empresa: e.target.value }))} placeholder="Ex: Elevadores Atlas / Construtora" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Documento</label><input className="input w-full" value={formPrestador.documento} onChange={e => setFormPrestador(f => ({ ...f, documento: e.target.value }))} placeholder="RG/CPF" /></div>
                <div><label className="label">Serviço</label><input className="input w-full" value={formPrestador.servico} onChange={e => setFormPrestador(f => ({ ...f, servico: e.target.value }))} placeholder="Ex: Manutenção" /></div>
              </div>
              <div><label className="label">Local / Unidade</label><input className="input w-full" value={formPrestador.destino} onChange={e => setFormPrestador(f => ({ ...f, destino: e.target.value }))} placeholder="Ex: Casa de Máquinas / Apt 402" /></div>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setModalNovoPrestador(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSavePrestador} className="btn-primary">Registrar Entrada</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: NOVA ENCOMENDA */}
      {modalNovaEncomenda && (
        <div className="modal-overlay" onClick={() => setModalNovaEncomenda(false)}>
          <div className="modal-content max-w-md p-6 bg-white rounded-3xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Receber Encomenda</h3>
              <button onClick={() => setModalNovaEncomenda(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Unidade / Apt *</label><input className="input w-full" value={formEnc.unidade} onChange={e => setFormEnc(f => ({ ...f, unidade: e.target.value }))} placeholder="Ex: 103" /></div>
                <div><label className="label">Nome do Morador</label><input className="input w-full" value={formEnc.morador} onChange={e => setFormEnc(f => ({ ...f, morador: e.target.value }))} placeholder="Nome do destinatário" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Transportadora</label>
                  <select className="input w-full" value={formEnc.transportadora} onChange={e => setFormEnc(f => ({ ...f, transportadora: e.target.value }))}>
                    <option>Correios</option>
                    <option>Mercado Livre</option>
                    <option>Amazon</option>
                    <option>Shopee</option>
                    <option>Jadlog</option>
                    <option>iFood / Delivery</option>
                    <option>Outra</option>
                  </select>
                </div>
                <div><label className="label">Código / Rastreio</label><input className="input w-full" value={formEnc.codigo} onChange={e => setFormEnc(f => ({ ...f, codigo: e.target.value }))} placeholder="Opcional" /></div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setModalNovaEncomenda(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSaveEncomenda} className="btn-primary">Registrar Encomenda</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: NOVO REGISTRO NO LIVRO */}
      {modalNovoRegistroLivro && (
        <div className="modal-overlay" onClick={() => setModalNovoRegistroLivro(false)}>
          <div className="modal-content max-w-md p-6 bg-white rounded-3xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Novo Registro no Livro da Portaria</h3>
              <button onClick={() => setModalNovoRegistroLivro(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="label">Tipo de Ocorrência</label>
                <select className="input w-full" value={formLivro.tipo} onChange={e => setFormLivro(f => ({ ...f, tipo: e.target.value }))}>
                  <option>Rotina</option>
                  <option>Barulho / Perturbação</option>
                  <option>Portão / Acesso com Defeito</option>
                  <option>Elevador</option>
                  <option>Vazamento / Iluminação</option>
                  <option>Visitante não autorizado</option>
                  <option>Outros</option>
                </select>
              </div>
              <div>
                <label className="label">Descrição do Acontecimento *</label>
                <textarea rows={3} className="input w-full" value={formLivro.texto} onChange={e => setFormLivro(f => ({ ...f, texto: e.target.value }))} placeholder="Descreva com clareza o que aconteceu..." />
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setModalNovoRegistroLivro(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSaveLivro} className="btn-primary">Salvar no Livro</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: PASSAGEM DE TURNO */}
      {modalPassagemTurno && (
        <div className="modal-overlay" onClick={() => setModalPassagemTurno(false)}>
          <div className="modal-content max-w-md p-6 bg-white rounded-3xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <RefreshCw size={20} className="text-brand-600" />
                <h3 className="font-black text-gray-900 text-base">🔄 Passagem de Turno</h3>
              </div>
              <button onClick={() => setModalPassagemTurno(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Porteiro Saindo</label><input className="input w-full bg-slate-50" value={formTurno.porteiroSaindo} disabled /></div>
                <div><label className="label">Porteiro Entrando *</label><input className="input w-full" value={formTurno.porteiroEntrando} onChange={e => setFormTurno(f => ({ ...f, porteiroEntrando: e.target.value }))} placeholder="Nome do colega" /></div>
              </div>
              <div>
                <label className="label">Turno Encerrado</label>
                <select className="input w-full" value={formTurno.turno} onChange={e => setFormTurno(f => ({ ...f, turno: e.target.value }))}>
                  <option>Manhã (06h às 14h)</option>
                  <option>Tarde (14h às 22h)</option>
                  <option>Noite / Madrugada (22h às 06h)</option>
                  <option>12x36 Diurno</option>
                  <option>12x36 Noturno</option>
                </select>
              </div>
              <div>
                <label className="label">Pendências para o Próximo Porteiro</label>
                <textarea rows={2} className="input w-full" value={formTurno.pendencias} onChange={e => setFormTurno(f => ({ ...f, pendencias: e.target.value }))} placeholder="Ex: Encomendas da unidade 103 aguardando, técnico da bomba ainda no subsolo..." />
              </div>
              <div>
                <label className="label">Observações Gerais</label>
                <textarea rows={2} className="input w-full" value={formTurno.observacoes} onChange={e => setFormTurno(f => ({ ...f, observacoes: e.target.value }))} placeholder="Observações sobre chaves, portões, iluminação..." />
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setModalPassagemTurno(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSavePassagemTurno} className="btn-primary bg-slate-900 hover:bg-slate-800">Concluir Passagem</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: FOTO AMPLIADA */}
      {fotoModal && (
        <div className="modal-overlay" onClick={() => setFotoModal(null)}>
          <div className="relative p-2 animate-fade-in text-center" onClick={e => e.stopPropagation()}>
            <button onClick={() => setFotoModal(null)} className="absolute -top-3 -right-3 bg-white rounded-full p-2 shadow-lg text-gray-600 hover:text-rose-600 z-10">
              <X size={18} />
            </button>
            <img src={fotoModal} alt="Foto" className="max-w-[90vw] max-h-[80vh] rounded-3xl shadow-2xl border-4 border-white object-contain" />
          </div>
        </div>
      )}

    </div>
  )
}
