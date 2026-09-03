import React, { useState } from 'react'
import { 
  Briefcase, Plus, Search, Edit2, Trash2, Star, QrCode, Printer, 
  CheckCircle2, Clock, Building2, User, Camera, Calendar, Phone, 
  Mail, Sparkles, Filter, X, CreditCard, Copy, Check, ExternalLink, 
  MessageCircle, FileText, Landmark
} from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { QRCodeSVG } from 'qrcode.react'

const BANCOS_POPULARES = [
  '001 - Banco do Brasil',
  '033 - Santander',
  '104 - Caixa Econômica Federal',
  '237 - Bradesco',
  '341 - Itaú Unibanco',
  '260 - Nubank',
  '077 - Banco Inter',
  '336 - C6 Bank',
  '748 - Sicredi',
  '756 - Sicoob',
  '212 - Banco Original',
  '290 - PagBank (PagSeguro)',
  '380 - PicPay',
  'Outro / Não listado'
]

function Modal({ data, onClose, onSave, condominios }) {
  const [form, setForm] = useState(data || {
    nome: '',
    documento: '',
    servico: '',
    contato: '',
    email: '',
    valor: '',
    condominio: 'Todos',
    avaliacao: 5,
    status: 'Ativo',
    tipoPix: 'CNPJ',
    chavePix: '',
    titularPix: '',
    banco: '',
    agencia: '',
    conta: '',
    tipoConta: 'Conta Corrente',
    titularConta: '',
    documentoTitular: '',
    observacoes: ''
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-cream-300 flex items-center justify-between gap-3 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-700 flex-shrink-0">
              <Briefcase size={20} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base sm:text-lg truncate">
                {data ? 'Editar Fornecedor / Prestador' : 'Novo Fornecedor / Prestador'}
              </h3>
              <p className="text-xs text-gray-500">Cadastre os dados de contato, condomínio e informações bancárias/PIX</p>
            </div>
          </div>
          <button onClick={onClose} className="modal-close-btn" title="Fechar"><X size={20} strokeWidth={2.5} /></button>
        </div>

        {/* Corpo do Formulário */}
        <div className="p-6 space-y-6">
          {/* 1. DADOS PRINCIPAIS */}
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-brand-700 mb-3 flex items-center gap-1.5">
              <User size={15} /> 1. Dados da Empresa / Prestador
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="label">Nome do Prestador / Razão Social *</label>
                <input 
                  className="input" 
                  value={form.nome} 
                  onChange={e => set('nome', e.target.value)} 
                  placeholder="Ex: Alpha Elevadores LTDA / João Eletricista" 
                  required 
                />
              </div>

              <div>
                <label className="label">CNPJ ou CPF do Fornecedor</label>
                <input 
                  className="input" 
                  value={form.documento || ''} 
                  onChange={e => set('documento', e.target.value)} 
                  placeholder="00.000.000/0000-00 ou 000.000.000-00" 
                />
              </div>

              <div>
                <label className="label">Serviço Prestado / Especialidade *</label>
                <input 
                  className="input" 
                  value={form.servico} 
                  onChange={e => set('servico', e.target.value)} 
                  placeholder="Ex: Manutenção de Elevadores, Pintura, Bombas" 
                  required 
                />
              </div>

              <div>
                <label className="label">Telefone / WhatsApp</label>
                <input 
                  className="input" 
                  value={form.contato} 
                  onChange={e => set('contato', e.target.value)} 
                  placeholder="(83) 90000-0000" 
                />
              </div>

              <div>
                <label className="label">E-mail</label>
                <input 
                  className="input" 
                  value={form.email} 
                  onChange={e => set('email', e.target.value)} 
                  placeholder="financeiro@empresa.com" 
                />
              </div>

              <div>
                <label className="label font-black text-brand-800">Condomínio Vinculado *</label>
                <select 
                  className="input font-bold bg-amber-50/50 border-amber-300 text-gray-900" 
                  value={form.condominio || 'Todos'} 
                  onChange={e => set('condominio', e.target.value)}
                >
                  <option value="Todos">🌐 Todos os Condomínios (Geral)</option>
                  {condominios.map(c => (
                    <option key={c.id || c.nome} value={c.nome}>🏢 {c.nome}</option>
                  ))}
                </select>
                <span className="text-[10px] text-gray-500 mt-0.5 block">
                  Selecione o condomínio específico ou deixe "Todos" se atender a rede.
                </span>
              </div>

              <div>
                <label className="label">Valor Médio / Contrato</label>
                <input 
                  className="input" 
                  value={form.valor} 
                  onChange={e => set('valor', e.target.value)} 
                  placeholder="Ex: R$ 850,00/mês ou R$ 150/visita" 
                />
              </div>

              <div>
                <label className="label">Status</label>
                <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
                  <option value="Ativo">Ativo (Prestador Frequente)</option>
                  <option value="Eventual">Eventual (Chamados Pontuais)</option>
                  <option value="Inativo">Inativo / Bloqueado</option>
                </select>
              </div>

              <div>
                <label className="label">Avaliação do Serviço</label>
                <select className="input font-bold text-amber-600" value={form.avaliacao} onChange={e => set('avaliacao', Number(e.target.value))}>
                  <option value={5}>⭐⭐⭐⭐⭐ (5 estrelas - Excelente)</option>
                  <option value={4}>⭐⭐⭐⭐ (4 estrelas - Bom)</option>
                  <option value={3}>⭐⭐⭐ (3 estrelas - Regular)</option>
                  <option value={2}>⭐⭐ (2 estrelas - Ruim)</option>
                  <option value={1}>⭐ (1 estrela - Péssimo)</option>
                </select>
              </div>
            </div>
          </div>

          {/* 2. DADOS DO PIX */}
          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl">
            <h4 className="text-xs font-black uppercase tracking-wider text-emerald-800 mb-3 flex items-center gap-1.5">
              <Sparkles size={15} /> 2. Informações de Chave PIX (Para Pagamentos Rápidos)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="label text-emerald-900">Tipo de Chave PIX</label>
                <select 
                  className="input bg-white" 
                  value={form.tipoPix || 'CNPJ'} 
                  onChange={e => set('tipoPix', e.target.value)}
                >
                  <option value="CNPJ">CNPJ</option>
                  <option value="CPF">CPF</option>
                  <option value="Telefone">Telefone (Celular)</option>
                  <option value="E-mail">E-mail</option>
                  <option value="Chave Aleatória">Chave Aleatória (EVP)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="label text-emerald-900">Chave PIX</label>
                <input 
                  className="input bg-white font-mono font-bold" 
                  value={form.chavePix || ''} 
                  onChange={e => set('chavePix', e.target.value)} 
                  placeholder={
                    form.tipoPix === 'CNPJ' ? '00.000.000/0000-00' :
                    form.tipoPix === 'CPF' ? '000.000.000-00' :
                    form.tipoPix === 'Telefone' ? '(83) 90000-0000' :
                    form.tipoPix === 'E-mail' ? 'pix@empresa.com' :
                    'Cole a chave aleatória aqui'
                  }
                />
              </div>

              <div className="sm:col-span-3">
                <label className="label text-emerald-900">Nome / Razão Social do Titular do PIX</label>
                <input 
                  className="input bg-white" 
                  value={form.titularPix || ''} 
                  onChange={e => set('titularPix', e.target.value)} 
                  placeholder="Nome que aparece ao confirmar o PIX no banco" 
                />
              </div>
            </div>
          </div>

          {/* 3. DADOS BANCÁRIOS COMPLETOS */}
          <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl">
            <h4 className="text-xs font-black uppercase tracking-wider text-blue-800 mb-3 flex items-center gap-1.5">
              <Landmark size={15} /> 3. Dados da Conta Bancária (TED / DOC / Transferência)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="label text-blue-900">Banco / Instituição Financeira</label>
                <input 
                  className="input bg-white" 
                  value={form.banco || ''} 
                  onChange={e => set('banco', e.target.value)} 
                  placeholder="Ex: 260 - Nubank ou Banco do Brasil" 
                  list="lista-bancos"
                />
                <datalist id="lista-bancos">
                  {BANCOS_POPULARES.map(b => <option key={b} value={b} />)}
                </datalist>
              </div>

              <div>
                <label className="label text-blue-900">Agência (com dígito se houver)</label>
                <input 
                  className="input bg-white font-mono" 
                  value={form.agencia || ''} 
                  onChange={e => set('agencia', e.target.value)} 
                  placeholder="Ex: 0001 ou 1234-5" 
                />
              </div>

              <div>
                <label className="label text-blue-900">Número da Conta (com dígito)</label>
                <input 
                  className="input bg-white font-mono font-bold" 
                  value={form.conta || ''} 
                  onChange={e => set('conta', e.target.value)} 
                  placeholder="Ex: 1234567-8" 
                />
              </div>

              <div>
                <label className="label text-blue-900">Tipo de Conta</label>
                <select 
                  className="input bg-white" 
                  value={form.tipoConta || 'Conta Corrente'} 
                  onChange={e => set('tipoConta', e.target.value)}
                >
                  <option value="Conta Corrente">Conta Corrente (CC)</option>
                  <option value="Conta Poupança">Conta Poupança (CP)</option>
                  <option value="Conta Pagamento">Conta de Pagamento</option>
                </select>
              </div>

              <div>
                <label className="label text-blue-900">CPF / CNPJ do Titular da Conta</label>
                <input 
                  className="input bg-white" 
                  value={form.documentoTitular || ''} 
                  onChange={e => set('documentoTitular', e.target.value)} 
                  placeholder="Documento vinculado à conta bancária" 
                />
              </div>

              <div className="sm:col-span-2">
                <label className="label text-blue-900">Nome / Razão Social do Titular da Conta</label>
                <input 
                  className="input bg-white" 
                  value={form.titularConta || ''} 
                  onChange={e => set('titularConta', e.target.value)} 
                  placeholder="Nome completo ou Razão Social do titular da conta" 
                />
              </div>
            </div>
          </div>

          {/* 4. OBSERVAÇÕES & NOTAS */}
          <div>
            <label className="label">Observações Adicionais / Detalhes de Contrato</label>
            <textarea 
              className="input text-xs" 
              rows={2} 
              value={form.observacoes || ''} 
              onChange={e => set('observacoes', e.target.value)} 
              placeholder="Ex: Pagamento todo dia 10; falar com Sr. Carlos no setor financeiro; emitir NF antes do envio do boleto."
            />
          </div>
        </div>

        {/* Rodapé do Modal */}
        <div className="p-4 sm:p-6 border-t border-cream-300 flex gap-3 justify-end sticky bottom-0 bg-white z-10">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={() => onSave(form)} className="btn-primary">Salvar Fornecedor</button>
        </div>
      </div>
    </div>
  )
}

function ModalPlacaQRCode({ condominios, condoInicial, onClose }) {
  const [condoEscolhido, setCondoEscolhido] = useState(condoInicial && condoInicial !== 'Todos' ? condoInicial : (condominios[0]?.nome || 'Residencial'))

  const urlCheckin = `https://alpha-solucoes-condominiais.vercel.app/checkin-prestador?condo=${encodeURIComponent(condoEscolhido)}`

  const handleImprimir = () => {
    window.print()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-xl" onClick={e => e.stopPropagation()}>
        
        {/* Barra superior de controle */}
        <div className="p-4 border-b border-cream-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-2">
            <QrCode size={20} className="text-brand-600" />
            <div>
              <h3 className="font-bold text-gray-800 text-sm">Placa QR Code para Condomínio</h3>
              <p className="text-[11px] text-gray-400">Escolha o condomínio para gerar a placa individual</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={condoEscolhido}
              onChange={e => setCondoEscolhido(e.target.value)}
              className="input py-1 text-xs font-bold bg-amber-50 border-amber-300"
            >
              {condominios.map(c => <option key={c.id || c.nome} value={c.nome}>🏢 {c.nome}</option>)}
            </select>
            <button onClick={handleImprimir} className="btn-primary py-1.5 px-3 text-xs font-black bg-brand-700 hover:bg-brand-600 flex items-center gap-1.5 shadow-sm">
              <Printer size={14} /> Imprimir
            </button>
            <button onClick={onClose} className="modal-close-btn" title="Fechar"><X size={20} strokeWidth={2.5} /></button>
          </div>
        </div>

        {/* ÁREA DA PLACA A4 IMPRIMÍVEL */}
        <div className="p-8 text-center bg-white border-4 border-brand-800 rounded-3xl m-4 space-y-6 shadow-md print:m-0 print:border-8">
          <div className="space-y-1">
            <span className="text-[11px] font-black uppercase tracking-widest text-brand-700 bg-brand-50 px-3 py-1 rounded-full border border-brand-200">
              Alpha Soluções Condominiais
            </span>
            <h2 className="text-2xl font-black text-slate-900 mt-2">
              {condoEscolhido}
            </h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
              Controle de Entrada & Saída de Terceirizados
            </p>
          </div>

          <div className="p-4 bg-slate-50 border-2 border-dashed border-brand-300 rounded-3xl w-fit mx-auto shadow-inner">
            <QRCodeSVG value={urlCheckin} size={220} level="H" includeMargin={true} />
          </div>

          <div className="space-y-2 max-w-sm mx-auto">
            <h4 className="font-black text-slate-900 text-sm">
              📲 PRESTADOR / TERCEIRIZADO:
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              1. Aponte a câmera do seu celular para este QR Code.<br />
              2. Registre sua <b>Entrada</b> ao iniciar o serviço.<br />
              3. Ao terminar, aponte novamente e registre sua <b>Saída com foto</b>.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-200 text-[10px] text-slate-400 font-medium flex items-center justify-between">
            <span>Comprovante Oficial com Horário e GPS</span>
            <span>Alpha ADM</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Prestadores() {
  const { items: prestadores, addItem, updateItem, deleteItem } = useFirestore('prestadores')
  const { items: atendimentos } = useFirestore('prestadores_atendimentos')
  const { items: condominios } = useFirestore('condominios')

  const [activeTab, setActiveTab] = useState('cadastro') // Iniciar na aba de cadastro de fornecedores
  const [search, setSearch] = useState('')
  const [filtroCondo, setFiltroCondo] = useState('Todos')
  const [filtroStatus, setFiltroStatus] = useState('Todos')
  const [modal, setModal] = useState(null)
  const [modalPlaca, setModalPlaca] = useState(false)
  const [pixCopiadoId, setPixCopiadoId] = useState(null)

  const handleCopiarPix = (id, chave) => {
    if (!chave) return
    navigator.clipboard.writeText(chave)
    setPixCopiadoId(id)
    setTimeout(() => {
      setPixCopiadoId(null)
    }, 2500)
  }

  const filteredPrestadores = prestadores.filter(i => {
    const s = search.toLowerCase()
    const matchSearch = 
      (i.nome || '').toLowerCase().includes(s) || 
      (i.servico || '').toLowerCase().includes(s) ||
      (i.documento || '').toLowerCase().includes(s) ||
      (i.contato || '').includes(s) ||
      (i.chavePix || '').toLowerCase().includes(s) ||
      (i.banco || '').toLowerCase().includes(s) ||
      (i.condominio || '').toLowerCase().includes(s)

    const matchCondo = filtroCondo === 'Todos' || !i.condominio || i.condominio === 'Todos' || i.condominio === filtroCondo
    const matchStatus = filtroStatus === 'Todos' || i.status === filtroStatus

    return matchSearch && matchCondo && matchStatus
  })

  const filteredAtendimentos = atendimentos.filter(a => {
    const s = search.toLowerCase()
    const matchSearch = 
      (a.nome || '').toLowerCase().includes(s) ||
      (a.servico || '').toLowerCase().includes(s) ||
      (a.empresa || '').toLowerCase().includes(s) ||
      (a.telefone || '').includes(s) ||
      (a.condominio || '').toLowerCase().includes(s)

    const matchCondo = filtroCondo === 'Todos' || a.condominio === filtroCondo
    return matchSearch && matchCondo
  }).sort((a, b) => new Date(b.entradaISO || 0) - new Date(a.entradaISO || 0))

  const handleSave = async (form) => {
    if (modal === 'new') await addItem(form)
    else await updateItem(modal.id, form)
    setModal(null)
  }

  const emAndamentoCount = atendimentos.filter(a => a.status === 'Em Andamento').length

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-7xl mx-auto pb-12">
      {/* Cabeçalho da Página */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-pale-300 shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-brand-700 to-brand-500 bg-clip-text text-transparent flex items-center gap-2">
            <Briefcase size={24} className="text-brand-600" /> Fornecedores & Prestadores de Serviços
          </h2>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            Cadastro de parceiros com Chave PIX, Dados Bancários, Condomínio Vinculado e Check-in de Serviços
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setModalPlaca(true)}
            className="btn-secondary py-2 px-3 text-xs font-black bg-indigo-50 text-indigo-900 border-indigo-300 hover:bg-indigo-100 flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <QrCode size={15} className="text-indigo-600" /> Imprimir Placa QR Code
          </button>
          <button
            onClick={() => setModal('new')}
            className="btn-primary py-2 px-4 text-xs font-black flex items-center gap-1.5 shadow-md shadow-brand-700/20 bg-emerald-600 hover:bg-emerald-500 cursor-pointer uppercase tracking-wider"
          >
            <Plus size={16} /> + Novo Fornecedor
          </button>
        </div>
      </div>

      {/* Abas de Navegação */}
      <div className="flex gap-2 p-1.5 bg-slate-100 border border-slate-200 rounded-2xl w-fit flex-wrap">
        <button
          onClick={() => setActiveTab('cadastro')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${activeTab === 'cadastro' ? 'bg-white shadow-sm text-brand-700' : 'text-gray-500 hover:text-brand-600 hover:bg-white/50'}`}
        >
          <Briefcase size={16} /> Fornecedores Cadastrados ({prestadores.length})
        </button>
        <button
          onClick={() => setActiveTab('atendimentos')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer relative ${activeTab === 'atendimentos' ? 'bg-white shadow-sm text-brand-700' : 'text-gray-500 hover:text-brand-600 hover:bg-white/50'}`}
        >
          <Clock size={16} /> Presença & Check-in QR Code ({atendimentos.length})
          {emAndamentoCount > 0 && (
            <span className="bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
              {emAndamentoCount} no local
            </span>
          )}
        </button>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-white p-4 rounded-2xl border border-pale-300 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-10 text-xs w-full bg-slate-50 border-gray-200"
            placeholder="Buscar por nome, serviço, CNPJ/CPF, PIX, banco ou condomínio..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
          <div className="relative flex-1 sm:w-64">
            <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-600" />
            <select
              className="input pl-9 text-xs font-bold bg-amber-50/60 border-amber-200 text-gray-800"
              value={filtroCondo}
              onChange={e => setFiltroCondo(e.target.value)}
            >
              <option value="Todos">🏢 Todos os Condomínios</option>
              {condominios.map(c => <option key={c.id || c.nome} value={c.nome}>🏢 {c.nome}</option>)}
            </select>
          </div>

          {activeTab === 'cadastro' && (
            <div className="relative sm:w-44">
              <select
                className="input text-xs font-bold bg-slate-50 border-gray-200 text-gray-700"
                value={filtroStatus}
                onChange={e => setFiltroStatus(e.target.value)}
              >
                <option value="Todos">Todos os Status</option>
                <option value="Ativo">Ativos</option>
                <option value="Eventual">Eventuais</option>
                <option value="Inativo">Inativos</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ABA 1: FORNECEDORES CADASTRADOS (COM PIX E BANCO) */}
      {activeTab === 'cadastro' && (
        filteredPrestadores.length === 0 ? (
          <div className="bg-white rounded-2xl border border-pale-300 p-12 text-center text-gray-400 shadow-sm flex flex-col items-center justify-center">
            <Briefcase size={44} className="mb-3 opacity-30 text-gray-400" />
            <h3 className="font-bold text-gray-700 text-base">Nenhum fornecedor encontrado</h3>
            <p className="text-xs text-gray-400 mt-1 max-w-md">
              {search || filtroCondo !== 'Todos' 
                ? 'Nenhum fornecedor corresponde aos filtros selecionados. Tente limpar a busca ou mudar o condomínio.' 
                : 'Você ainda não cadastrou nenhum fornecedor. Clique no botão acima para adicionar o primeiro.'}
            </p>
            <button
              onClick={() => setModal('new')}
              className="btn-primary mt-4 py-2 px-4 text-xs font-bold flex items-center gap-1.5"
            >
              <Plus size={15} /> Cadastrar Fornecedor Agora
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredPrestadores.map(item => {
              const temPix = !!item.chavePix
              const temBanco = !!(item.banco || item.conta)
              const telLimpo = (item.contato || '').replace(/\D/g, '')

              return (
                <div 
                  key={item.id} 
                  className="bg-white rounded-2xl border border-pale-300 shadow-sm hover:shadow-md hover:border-brand-400 transition-all flex flex-col justify-between overflow-hidden group"
                >
                  {/* Cabeçalho do Card */}
                  <div className="p-5 pb-3">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-brand-50 border border-brand-200 rounded-xl flex items-center justify-center text-brand-700 font-black text-base flex-shrink-0">
                          {item.nome?.[0]?.toUpperCase() || 'F'}
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900 text-base leading-snug group-hover:text-brand-700 transition-colors">
                            {item.nome}
                          </h3>
                          <span className="text-[11px] font-semibold text-brand-600 block">
                            {item.servico}
                          </span>
                        </div>
                      </div>

                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                        item.status === 'Ativo' ? 'bg-emerald-100 text-emerald-800' :
                        item.status === 'Eventual' ? 'bg-amber-100 text-amber-800' :
                        'bg-rose-100 text-rose-800'
                      }`}>
                        {item.status || 'Ativo'}
                      </span>
                    </div>

                    {/* Tag de Condomínio Vinculado */}
                    <div className="mb-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">
                        <Building2 size={13} className="text-amber-700 flex-shrink-0" />
                        <span className="truncate">{item.condominio || 'Todos os Condomínios'}</span>
                      </span>
                    </div>

                    {/* Avaliação em Estrelas */}
                    <div className="flex items-center gap-1 mb-3">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star 
                          key={s} 
                          size={13} 
                          className={s <= (item.avaliacao || 5) ? 'text-amber-400 fill-amber-400' : 'text-gray-200'} 
                        />
                      ))}
                      <span className="text-[11px] font-bold text-gray-400 ml-1">
                        ({item.avaliacao || 5}.0)
                      </span>
                    </div>

                    {/* Contatos & Documentos */}
                    <div className="space-y-1.5 text-xs text-gray-600 pt-3 border-t border-gray-100">
                      {item.documento && (
                        <p className="flex items-center gap-1.5 text-[11px]">
                          <span className="font-bold text-gray-500">Doc:</span> 
                          <span className="font-mono text-gray-800">{item.documento}</span>
                        </p>
                      )}
                      {item.contato && (
                        <p className="flex items-center gap-1.5">
                          <Phone size={13} className="text-gray-400 flex-shrink-0" />
                          <span className="text-gray-800 font-medium">{item.contato}</span>
                        </p>
                      )}
                      {item.email && (
                        <p className="flex items-center gap-1.5 truncate">
                          <Mail size={13} className="text-gray-400 flex-shrink-0" />
                          <span className="text-gray-700 truncate">{item.email}</span>
                        </p>
                      )}
                    </div>

                    {/* BLOCO DE DADOS DE PAGAMENTO (PIX & BANCO) */}
                    <div className="mt-3 pt-3 border-t border-dashed border-gray-200 space-y-2">
                      {/* PIX */}
                      {temPix ? (
                        <div className="p-2.5 bg-emerald-50/90 border border-emerald-200 rounded-xl flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                              <Sparkles size={11} /> PIX ({item.tipoPix || 'Chave'})
                            </span>
                            <p className="font-mono font-bold text-xs text-emerald-950 truncate mt-0.5">
                              {item.chavePix}
                            </p>
                            {item.titularPix && (
                              <p className="text-[10px] text-emerald-700 truncate">
                                Titular: {item.titularPix}
                              </p>
                            )}
                          </div>

                          <button
                            onClick={() => handleCopiarPix(item.id, item.chavePix)}
                            className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all flex items-center gap-1 text-[10px] font-black flex-shrink-0 cursor-pointer shadow-sm"
                            title="Copiar Chave PIX"
                          >
                            {pixCopiadoId === item.id ? (
                              <>
                                <Check size={12} /> Copiado!
                              </>
                            ) : (
                              <>
                                <Copy size={12} /> Copiar
                              </>
                            )}
                          </button>
                        </div>
                      ) : (
                        <div className="p-2 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-[11px] text-gray-400 flex items-center gap-1.5 justify-center">
                          <CreditCard size={13} /> Sem chave PIX cadastrada
                        </div>
                      )}

                      {/* Dados Bancários */}
                      {temBanco && (
                        <div className="p-2.5 bg-blue-50/80 border border-blue-200 rounded-xl text-xs text-blue-950 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-blue-800 flex items-center gap-1">
                              <Landmark size={11} /> {item.banco || 'Conta Bancária'}
                            </span>
                            <span className="text-[10px] font-bold text-blue-600 bg-white px-1.5 py-0.5 rounded border border-blue-200">
                              {item.tipoConta || 'CC'}
                            </span>
                          </div>
                          <p className="text-[11px] font-mono">
                            Ag: <b>{item.agencia || '—'}</b> • Conta: <b>{item.conta || '—'}</b>
                          </p>
                          {item.titularConta && (
                            <p className="text-[10px] text-blue-800 truncate">
                              Favorecido: {item.titularConta}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Rodapé do Card */}
                  <div className="p-4 bg-slate-50 border-t border-cream-300 flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] text-gray-400 font-bold uppercase block">Valor / Custo</span>
                      <span className="text-xs font-black text-emerald-700">
                        {item.valor || 'A combinar'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {telLimpo && (
                        <a
                          href={`https://wa.me/55${telLimpo}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-800 transition-colors flex items-center justify-center"
                          title="Abrir WhatsApp"
                        >
                          <MessageCircle size={15} />
                        </a>
                      )}
                      <button 
                        onClick={() => setModal(item)} 
                        className="p-2 rounded-xl bg-white hover:bg-brand-50 hover:text-brand-700 text-gray-600 border border-gray-200 transition-all cursor-pointer"
                        title="Editar Fornecedor"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={() => { 
                          if (window.confirm(`Deseja remover o fornecedor "${item.nome}"?`)) {
                            deleteItem(item.id)
                          }
                        }} 
                        className="p-2 rounded-xl bg-white hover:bg-rose-50 hover:text-rose-600 text-gray-400 border border-gray-200 transition-all cursor-pointer"
                        title="Excluir Fornecedor"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* ABA 2: HISTÓRICO & PRESENÇA DE TERCEIRIZADOS (CHECK-IN QR CODE) */}
      {activeTab === 'atendimentos' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-blue-900">
            <div className="flex items-center gap-3">
              <QrCode size={24} className="text-blue-600 shrink-0" />
              <div>
                <p className="font-bold">Onde visualizo o que os terceirizados fizeram?</p>
                <p className="text-blue-700 mt-0.5">
                  Aqui você tem o registro com <b>Nome</b>, <b>Empresa</b>, <b>Condomínio</b>, <b>Serviço</b>, <b>Entrada</b>, <b>Saída</b>, <b>Duração</b> e <b>Fotos do Serviço</b>.
                </p>
              </div>
            </div>
            <button
              onClick={() => setModalPlaca(true)}
              className="btn-primary py-1.5 px-3 text-xs font-black bg-blue-700 hover:bg-blue-600 shrink-0 whitespace-nowrap cursor-pointer"
            >
              Imprimir Placa QR Code
            </button>
          </div>

          {filteredAtendimentos.length === 0 ? (
            <div className="bg-white rounded-2xl border border-pale-300 p-12 text-center text-gray-400 text-sm shadow-sm">
              <Clock size={36} className="mx-auto mb-2 opacity-30 text-gray-400" />
              Nenhum registro de atendimento ou presença de terceirizados para o filtro selecionado.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAtendimentos.map(atend => {
                const emAndamento = atend.status === 'Em Andamento'

                return (
                  <div
                    key={atend.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      emAndamento 
                        ? 'bg-white border-emerald-400 shadow-md ring-2 ring-emerald-100' 
                        : 'bg-white border-gray-200 shadow-sm'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start gap-3.5">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-sm ${
                          emAndamento ? 'bg-emerald-600 text-white animate-pulse' : 'bg-slate-700 text-white'
                        }`}>
                          {emAndamento ? '🟢' : '✓'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-gray-900 text-base">{atend.nome}</h4>
                            <span className="text-xs text-gray-500 font-medium">({atend.empresa || 'Autônomo'})</span>
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                              emAndamento ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {atend.status}
                            </span>
                            <span className="bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1">
                              <Building2 size={11} /> {atend.condominio || 'Geral'}
                            </span>
                          </div>

                          <p className="text-xs font-semibold text-brand-700 mt-0.5">
                            🔧 Serviço: {atend.servico}
                          </p>

                          {atend.detalhes && (
                            <p className="text-xs text-gray-600 mt-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                              "{atend.detalhes}"
                            </p>
                          )}

                          <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-500 flex-wrap">
                            <span className="bg-slate-100 px-2 py-1 rounded border border-gray-200 font-bold">
                              📅 Data: {atend.entradaData || 'Hoje'}
                            </span>
                            <span className="bg-emerald-50 px-2 py-1 rounded border border-emerald-200 font-bold text-emerald-800">
                              🟢 Entrada: {atend.entradaHora}
                            </span>
                            {atend.saidaHora && (
                              <span className="bg-rose-50 px-2 py-1 rounded border border-rose-200 font-bold text-rose-800">
                                🔴 Saída: {atend.saidaHora}
                              </span>
                            )}
                            {atend.duracao && (
                              <span className="bg-amber-100 text-amber-900 px-2 py-1 rounded font-black border border-amber-300">
                                ⏳ Duração: {atend.duracao}
                              </span>
                            )}
                          </div>

                          {/* Fotos de Comprovação */}
                          {(atend.fotoEntrada || atend.fotoSaida) && (
                            <div className="flex items-center gap-3 mt-3">
                              {atend.fotoEntrada && (
                                <div>
                                  <span className="text-[10px] text-gray-400 font-bold block mb-1">Foto Entrada / Selfie</span>
                                  <img 
                                    src={atend.fotoEntrada} 
                                    alt="Entrada" 
                                    className="w-14 h-14 object-cover rounded-xl border border-gray-300 shadow-sm cursor-pointer hover:opacity-80 transition-opacity" 
                                    onClick={() => window.open(atend.fotoEntrada, '_blank')} 
                                  />
                                </div>
                              )}
                              {atend.fotoSaida && (
                                <div>
                                  <span className="text-[10px] text-gray-400 font-bold block mb-1">Foto do Serviço Finalizado</span>
                                  <img 
                                    src={atend.fotoSaida} 
                                    alt="Saída" 
                                    className="w-14 h-14 object-cover rounded-xl border border-gray-300 shadow-sm cursor-pointer hover:opacity-80 transition-opacity" 
                                    onClick={() => window.open(atend.fotoSaida, '_blank')} 
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Modais */}
      {modal && (
        <Modal 
          data={modal === 'new' ? null : modal} 
          onClose={() => setModal(null)} 
          onSave={handleSave} 
          condominios={condominios} 
        />
      )}

      {modalPlaca && (
        <ModalPlacaQRCode 
          condominios={condominios} 
          condoInicial={filtroCondo} 
          onClose={() => setModalPlaca(false)} 
        />
      )}
    </div>
  )
}
