import React, { useState } from 'react'
import { Plus, Wallet, FileText, CreditCard, LayoutDashboard, Calendar, ShieldAlert, Calculator, FileCheck, DollarSign, Upload, Eye, Download, Copy, Check, Sparkles, Loader2, Repeat, ExternalLink } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'
import RepassesAlphaModal from '../components/RepassesAlphaModal'
import { CurrencyInput } from '../utils/currency'
import { registrarLogAuditoria } from '../utils/audit'
import { storage } from '../firebase'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'

// Importando as novas abas
import DashboardFinanceiro from './financeiro/DashboardFinanceiro'
import ContasPagar from './financeiro/ContasPagar'
import ContasReceber from './financeiro/ContasReceber'
import FluxoCaixa from './financeiro/FluxoCaixa'
import DRE from './financeiro/DRE'
import ReservaEmergencia from './financeiro/ReservaEmergencia'
import Historico from './financeiro/Historico'
import Conciliacao from './financeiro/Conciliacao'
import RateioAgua from './financeiro/RateioAgua'
import EFDReinf from './financeiro/EFDReinf'

// ─── Modal: Lançamento Financeiro com Upload no Storage & Recorrência ──
function ModalLancamento({ data, user, condominiosDisponiveis, filtroAtual, onClose, onSave }) {
  const defaultCondo = filtroAtual && filtroAtual !== 'Todos' ? filtroAtual : (user?.condominio || '');
  const [form, setForm] = useState(data || {
    descricao: '', 
    tipo: 'Despesa', 
    categoria: '', 
    valor: '', 
    data: new Date().toISOString().split('T')[0], 
    status: 'Pendente', 
    condominio: defaultCondo, 
    arquivoUrl: '', 
    linhaDigitavel: '',
    pix: '',
    recorrente: false, 
    qtdMeses: '12'
  })
  const [isExtracting, setIsExtracting] = useState(false)
  const [uploadingStorage, setUploadingStorage] = useState(false)
  const [copiado, setCopiado] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setIsExtracting(true)
    setUploadingStorage(true)

    try {
      // 1. Upload imediato no Firebase Storage para armazenar o boleto de forma permanente
      try {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const storageRef = ref(storage, `financeiro/boletos/${Date.now()}_${safeName}`)
        const snapshot = await uploadBytes(storageRef, file)
        const downloadUrl = await getDownloadURL(snapshot.ref)
        set('arquivoUrl', downloadUrl)
      } catch (stErr) {
        console.warn("Storage upload falhou, mantendo fluxo OCR:", stErr)
      }

      // 2. Leitura OCR com IA para preenchimento automático
      const reader = new FileReader()
      reader.onload = async (ev) => {
        const base64Data = ev.target.result
        try {
          const res = await fetch('/api/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file: base64Data, mimeType: file.type, type: 'despesa' })
          })
          const ocrData = await res.json()
          if (ocrData.success && ocrData.data) {
            const d = ocrData.data
            if (d.descricao) set('descricao', d.fornecedor ? `${d.descricao} - ${d.fornecedor}` : d.descricao)
            if (d.valor) set('valor', String(d.valor))
            if (d.vencimento) set('data', d.vencimento)
            if (d.categoria && !form.categoria) set('categoria', d.categoria)
            if (d.linhaDigitavel) set('linhaDigitavel', d.linhaDigitavel)
            if (d.pix) set('pix', d.pix)
            alert('✓ Dados e código do boleto extraídos automaticamente com Inteligência Artificial!')
          }
        } catch(err) {
          console.error("Erro na extração IA:", err)
        }
        setIsExtracting(false)
        setUploadingStorage(false)
      }
      reader.readAsDataURL(file)
    } catch (err) {
      console.error(err)
      setIsExtracting(false)
      setUploadingStorage(false)
    }
  }

  const handleCopiarCodigo = (texto) => {
    if (!texto) return
    navigator.clipboard.writeText(texto)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-cream-300 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="font-bold text-gray-900 text-base sm:text-lg">
              {data ? 'Editar Lançamento / Conta' : 'Novo Lançamento / Conta a Pagar'}
            </h3>
            <p className="text-xs text-gray-500">Cadastre boletos com código de pagamento e recorrência automática</p>
          </div>
          <button onClick={onClose} className="modal-close-btn" title="Fechar">✕</button>
        </div>

        <div className="p-6 space-y-4">
          {/* Caixa de Anexo & IA OCR */}
          <div className="bg-gradient-to-r from-brand-50 to-blue-50 p-4 rounded-2xl border border-brand-200">
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="text-xs font-black uppercase text-brand-800 flex items-center gap-1.5">
                <Sparkles size={14} className="text-brand-600" /> Auto-Preencher com Arquivo (Boleto / Recibo)
              </label>
              {(isExtracting || uploadingStorage) && (
                <span className="text-[11px] font-bold text-brand-700 flex items-center gap-1 animate-pulse">
                  <Loader2 size={12} className="animate-spin" /> Lendo documento...
                </span>
              )}
            </div>

            <input 
              type="file" 
              accept=".pdf,.png,.jpg,.jpeg" 
              onChange={handleFileUpload} 
              className="input p-2 text-xs bg-white w-full border-brand-300" 
              disabled={isExtracting || uploadingStorage} 
            />

            {form.arquivoUrl && (
              <div className="mt-2.5 flex items-center justify-between bg-white p-2 rounded-xl border border-brand-200 text-xs">
                <span className="text-emerald-700 font-bold flex items-center gap-1 text-[11px]">
                  ✓ Boleto armazenado em nuvem
                </span>
                <div className="flex items-center gap-2">
                  <a 
                    href={form.arquivoUrl} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-brand-600 font-bold hover:underline flex items-center gap-1 text-xs"
                  >
                    <Eye size={12} /> Visualizar
                  </a>
                  <a 
                    href={form.arquivoUrl} 
                    download="boleto_documento" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-gray-600 font-bold hover:underline flex items-center gap-1 text-xs"
                  >
                    <Download size={12} /> Baixar
                  </a>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Descrição / Fornecedor *</label>
              <input 
                className="input" 
                value={form.descricao} 
                onChange={e => set('descricao', e.target.value)} 
                placeholder="Ex: Allianz Seguro SA / Energisa / Taxa de Manutenção" 
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="label font-bold text-gray-800">Condomínio *</label>
              <select 
                className="input font-bold bg-amber-50/50 border-amber-300 text-gray-900" 
                value={form.condominio} 
                onChange={e => set('condominio', e.target.value)} 
                disabled={user?.role==='Morador'}
              >
                <option value="">Selecione o Condomínio...</option>
                <option value="Todos">🌐 Todos os Condomínios (Geral)</option>
                {condominiosDisponiveis.map(c => <option key={c} value={c}>🏢 {c}</option>)}
              </select>
            </div>

            <div>
              <label className="label">Tipo de Movimentação</label>
              <select className="input font-bold" value={form.tipo} onChange={e => set('tipo', e.target.value)}>
                <option value="Despesa">🔴 Despesa / Conta a Pagar</option>
                <option value="Receita">🟢 Receita / Conta a Receber</option>
              </select>
            </div>

            <div>
              <label className="label">Categoria</label>
              <input 
                className="input" 
                value={form.categoria} 
                onChange={e => set('categoria', e.target.value)} 
                placeholder="Ex: Seguro Predial, Energia, Água..." 
              />
            </div>

            <div>
              <label className="label">Valor (R$) *</label>
              <CurrencyInput value={form.valor} onChange={v => set('valor', v)} placeholder="0,00" />
            </div>

            <div>
              <label className="label">Data de Vencimento *</label>
              <input type="date" className="input" value={form.data} onChange={e => set('data', e.target.value)} />
            </div>

            <div className="sm:col-span-2">
              <label className="label">Status do Pagamento</label>
              <select className="input font-bold" value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="Pendente">⏳ Pendente (A Pagar)</option>
                <option value="Pago">✅ Pago / Liquidado</option>
                <option value="Aguardando Aprovação">🟠 Aguardando Aprovação do Síndico</option>
                <option value="Recebido">💵 Recebido</option>
              </select>
            </div>

            {/* Linha Digitável / Código de Barras */}
            <div className="sm:col-span-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-1">
                <label className="label text-xs font-bold text-gray-700 m-0">
                  Linha Digitável / Código de Barras do Boleto
                </label>
                {form.linhaDigitavel && (
                  <button
                    type="button"
                    onClick={() => handleCopiarCodigo(form.linhaDigitavel)}
                    className="text-[10px] font-black text-brand-700 hover:text-brand-900 flex items-center gap-1 cursor-pointer bg-brand-50 px-2 py-0.5 rounded border border-brand-200"
                  >
                    {copiado ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                    {copiado ? 'Copiado!' : 'Copiar Código'}
                  </button>
                )}
              </div>
              <input 
                className="input font-mono text-xs" 
                value={form.linhaDigitavel || ''} 
                onChange={e => set('linhaDigitavel', e.target.value)} 
                placeholder="Ex: 34191.09008 61071.749021 68000.000000 1 90000000020208" 
              />
            </div>

            {/* PIX Copia e Cola / Chave */}
            <div className="sm:col-span-2 bg-emerald-50/50 p-3 rounded-xl border border-emerald-200">
              <label className="label text-xs font-bold text-emerald-900 mb-1 block">
                Chave PIX ou Código PIX Copia e Cola
              </label>
              <input 
                className="input font-mono text-xs bg-white" 
                value={form.pix || ''} 
                onChange={e => set('pix', e.target.value)} 
                placeholder="Cole a chave PIX ou o código Copia e Cola do pagamento aqui" 
              />
            </div>
          </div>

          {/* SEÇÃO DE RECORRÊNCIA AUTOMÁTICA (REPETIR PRÓXIMOS MESES) */}
          {!data && (
            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl">
              <label className="flex items-center gap-2 text-xs font-black text-amber-950 cursor-pointer mb-2">
                <input 
                  type="checkbox" 
                  checked={form.recorrente} 
                  onChange={e => set('recorrente', e.target.checked)} 
                  className="w-4 h-4 text-amber-600 rounded border-gray-300 focus:ring-amber-500 cursor-pointer" 
                />
                <Repeat size={15} className="text-amber-700" /> Repetir este lançamento nos próximos meses automaticamente?
              </label>
              {form.recorrente && (
                <div className="mt-2 flex items-center gap-3">
                  <div>
                    <label className="label text-[11px] text-amber-900">Qtd de Meses / Parcelas</label>
                    <select 
                      className="input py-1.5 text-xs font-bold bg-white max-w-[160px]" 
                      value={form.qtdMeses || '12'} 
                      onChange={e => set('qtdMeses', e.target.value)}
                    >
                      <option value="2">2 meses</option>
                      <option value="3">3 meses (Trimestral)</option>
                      <option value="6">6 meses (Semestral)</option>
                      <option value="12">12 meses (Anual)</option>
                      <option value="24">24 meses (2 anos)</option>
                    </select>
                  </div>
                  <p className="text-[11px] text-amber-800 font-medium leading-tight">
                    O sistema agendará automaticamente os lançamentos dos próximos meses com o mesmo valor, categoria e boleto vinculado.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-cream-300 flex gap-3 justify-end sticky bottom-0 bg-white z-10">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button
            onClick={() => { 
              if (!form.descricao || !form.valor) {
                alert('Preencha ao menos a Descrição e o Valor do lançamento.')
                return;
              }
              onSave(form) 
            }}
            className="btn-primary"
          >
            {data ? 'Atualizar Lançamento' : 'Salvar Lançamento'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal: Conta Bancária ─────────────────────────────────────────────
function ModalConta({ data, onClose, onSave }) {
  const [form, setForm] = useState(data || { nome: '', tipo: 'Corrente', saldo: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">{data ? 'Editar Conta' : 'Nova Conta Bancária'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div>
            <label className="label">Nome da conta</label>
            <input className="input" value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Ex: Conta Corrente – Bradesco" autoFocus />
          </div>
          <div>
            <label className="label">Tipo</label>
            <select className="input" value={form.tipo} onChange={e => set('tipo', e.target.value)}>
              <option>Corrente</option><option>Poupança</option><option>Caixa</option><option>Reserva</option>
            </select>
          </div>
          <div>
            <label className="label">Saldo (R$)</label>
            <input type="number" min="0" step="0.01" className="input" value={form.saldo} onChange={e => set('saldo', e.target.value)} placeholder="0,00" />
          </div>
        </div>
        <div className="p-6 border-t border-cream-300 flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={() => { if (!form.nome) return; onSave(form) }} className="btn-primary">Salvar</button>
        </div>
      </div>
    </div>
  )
}

export default function Financeiro() {
  const { user } = useAuth()
  const isMorador = user?.role === 'Morador'

  const { items: allLancamentos, addItem: addLancamento, updateItem: updateLancamento, deleteItem: deleteLancamento } = useFirestore('financeiro_lancamentos')
  const { items: contas, addItem: addConta, updateItem: updateConta, deleteItem: deleteConta } = useFirestore('financeiro_contas')
  const { items: condominiosList } = useFirestore('condominios')
  const { items: allBoletos } = useFirestore('boletos')

  const searchParams = new URLSearchParams(window.location.search)
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || (isMorador ? 'Historico' : 'Dashboard'))
  const [modalLanc, setModalLanc] = useState(null)
  const [modalConta, setModalConta] = useState(null)
  const [condoFilter, setCondoFilter] = useState('Todos')
  const [showRepasses, setShowRepasses] = useState(false)

  const condominiosDisponiveis = condominiosList.filter(c => c.status !== 'Inativo').map(c => c.nome)

  const handleSaveLancamento = async (form) => {
    try {
      if (modalLanc && modalLanc.id) {
        // Edição simples
        await updateLancamento(modalLanc.id, form)
        await registrarLogAuditoria(user, 'Edição de Lançamento', `Editou o lançamento ${form.descricao}`)
      } else {
        // Novo Lançamento (com suporte a Recorrência Inteligente nos próximos meses)
        if (form.recorrente && form.qtdMeses && Number(form.qtdMeses) > 1) {
          const totalMeses = Math.min(Number(form.qtdMeses), 60)
          const dataBase = form.data ? new Date(form.data + 'T12:00:00') : new Date()

          for (let i = 0; i < totalMeses; i++) {
            const dataParcela = new Date(dataBase)
            dataParcela.setMonth(dataBase.getMonth() + i)
            const dataStr = dataParcela.toISOString().split('T')[0]
            const parcelaLabel = `(${String(i + 1).padStart(2, '0')}/${String(totalMeses).padStart(2, '0')})`

            await addLancamento({
              ...form,
              descricao: `${form.descricao} ${parcelaLabel}`,
              data: dataStr,
              recorrente: false, // salva individual
              origemRecorrente: true
            })
          }
          await registrarLogAuditoria(user, 'Criação Recorrente', `Criou ${totalMeses} lançamentos recorrentes para ${form.descricao}`)
        } else {
          await addLancamento(form)
          await registrarLogAuditoria(user, 'Criação de Lançamento', `Criou o lançamento ${form.descricao}`)
        }
      }
      setModalLanc(null)
    } catch (err) {
      console.error(err)
      alert("Erro ao salvar lançamento.")
    }
  }

  // Filtrar lançamentos por condomínio
  const lancamentos = allLancamentos.filter(l => {
    if (condoFilter === 'Todos') return true
    return l.condominio === condoFilter || l.condominio === 'Todos' || !l.condominio
  })

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-pale-300 shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
            <Wallet className="text-brand-600" /> Gestão Financeira Completa
          </h2>
          <p className="text-gray-500 font-medium text-xs sm:text-sm mt-0.5">
            Controle de receitas, despesas, boletos em nuvem, pagamentos e fluxo de caixa
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Seletor de Condomínio */}
          <select 
            value={condoFilter} 
            onChange={e => setCondoFilter(e.target.value)}
            className="input py-2 text-xs font-bold bg-amber-50/70 border-amber-300 text-gray-800"
          >
            <option value="Todos">🏢 Todos os Condomínios</option>
            {condominiosDisponiveis.map(c => <option key={c} value={c}>🏢 {c}</option>)}
          </select>

          {!isMorador && (
            <button
              onClick={() => setModalLanc({ tipo: 'Despesa', status: 'Pendente', descricao: '', categoria: '', valor: '', data: new Date().toISOString().split('T')[0], condominio: condoFilter !== 'Todos' ? condoFilter : '' })}
              className="btn-primary py-2 px-4 text-xs font-black flex items-center gap-1.5 shadow-md shadow-brand-700/20 bg-emerald-600 hover:bg-emerald-500 uppercase tracking-wider cursor-pointer"
            >
              <Plus size={16} /> + Novo Lançamento
            </button>
          )}
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-2 p-1 bg-slate-100 border border-slate-200 rounded-2xl w-fit flex-wrap">
        {!isMorador && (
          <>
            <button onClick={() => setActiveTab('Dashboard')} className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'Dashboard' ? 'bg-white shadow-sm text-brand-700' : 'text-gray-500 hover:text-brand-600'}`}>
              📊 Dashboard
            </button>
            <button onClick={() => setActiveTab('ContasPagar')} className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'ContasPagar' ? 'bg-white shadow-sm text-brand-700' : 'text-gray-500 hover:text-brand-600'}`}>
              🔴 Contas a Pagar & Boletos
            </button>
            <button onClick={() => setActiveTab('ContasReceber')} className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'ContasReceber' ? 'bg-white shadow-sm text-brand-700' : 'text-gray-500 hover:text-brand-600'}`}>
              🟢 Contas a Receber
            </button>
            <button onClick={() => setActiveTab('FluxoCaixa')} className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'FluxoCaixa' ? 'bg-white shadow-sm text-brand-700' : 'text-gray-500 hover:text-brand-600'}`}>
              📈 Fluxo de Caixa
            </button>
            <button onClick={() => setActiveTab('DRE')} className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'DRE' ? 'bg-white shadow-sm text-brand-700' : 'text-gray-500 hover:text-brand-600'}`}>
              📋 DRE
            </button>
          </>
        )}
        <button onClick={() => setActiveTab('Historico')} className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'Historico' ? 'bg-white shadow-sm text-brand-700' : 'text-gray-500 hover:text-brand-600'}`}>
          📜 Histórico Geral
        </button>
      </div>

      {/* Conteúdo das Abas */}
      {activeTab === 'Dashboard' && <DashboardFinanceiro lancamentos={lancamentos} contas={contas} setModalLanc={setModalLanc} />}
      {activeTab === 'ContasPagar' && <ContasPagar lancamentos={lancamentos} setModalLanc={setModalLanc} deleteLancamento={deleteLancamento} updateLancamento={updateLancamento} />}
      {activeTab === 'ContasReceber' && <ContasReceber lancamentos={lancamentos} setModalLanc={setModalLanc} deleteLancamento={deleteLancamento} updateLancamento={updateLancamento} />}
      {activeTab === 'FluxoCaixa' && <FluxoCaixa lancamentos={lancamentos} />}
      {activeTab === 'DRE' && <DRE lancamentos={lancamentos} />}
      {activeTab === 'Historico' && <Historico lancamentos={lancamentos} setModalLanc={setModalLanc} deleteLancamento={deleteLancamento} updateLancamento={updateLancamento} />}

      {/* Modais */}
      {modalLanc && (
        <ModalLancamento
          data={modalLanc.id ? modalLanc : null}
          user={user}
          condominiosDisponiveis={condominiosDisponiveis}
          filtroAtual={condoFilter}
          onClose={() => setModalLanc(null)}
          onSave={handleSaveLancamento}
        />
      )}

      {modalConta && (
        <ModalConta
          data={modalConta.id ? modalConta : null}
          onClose={() => setModalConta(null)}
          onSave={async (form) => {
            if (modalConta.id) await updateConta(modalConta.id, form)
            else await addConta(form)
            setModalConta(null)
          }}
        />
      )}
    </div>
  )
}
