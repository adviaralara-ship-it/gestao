import React, { useState } from 'react'
import { Plus, Wallet, FileText, CreditCard, LayoutDashboard, Calendar, ShieldAlert, Calculator, FileCheck, DollarSign, Upload, Eye, Download, Copy, Check, Sparkles, Loader2, Repeat, ExternalLink, Crown, Building2, Droplet, Shield, Landmark } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'
import RepassesAlphaModal from '../components/RepassesAlphaModal'
import { CurrencyInput } from '../utils/currency'
import { registrarLogAuditoria } from '../utils/audit'
import { storage } from '../firebase'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'

// Importando as abas
import DashboardFinanceiro from './financeiro/DashboardFinanceiro'
import ContasPagar from './financeiro/ContasPagar'
import ContasReceber from './financeiro/ContasReceber'
import RateioAgua from './financeiro/RateioAgua'
import FluxoCaixa from './financeiro/FluxoCaixa'
import Conciliacao from './financeiro/Conciliacao'
import ReservaEmergencia from './financeiro/ReservaEmergencia'
import DRE from './financeiro/DRE'
import Historico from './financeiro/Historico'
import EFDReinf from './financeiro/EFDReinf'

// Helper para identificar se o lançamento pertence ao financeiro interno da Alpha
export const isAlphaInterno = (condo) => {
  if (!condo) return true
  const c = condo.toLowerCase().trim()
  return c.includes('alpha') || c === 'interno' || c === 'administração' || c === 'administracao' || c === 'matriz'
}

function ModalLancamento({ data, allLancamentos = [], user, condominiosDisponiveis, filtroAtual, onClose, onSave }) {
  const defaultCondo = filtroAtual && filtroAtual !== 'Todos' ? filtroAtual : (user?.condominio || 'Alpha (Interno)');
  
  // Detectar se o lançamento atual pertence a um grupo de parcelas (seja por grupoParcelaId ou por padrão no nome "Nome (01/12)")
  const parsedParcelaInfo = React.useMemo(() => {
    if (!data) return null
    if (data.grupoParcelaId) {
      return {
        grupoParcelaId: data.grupoParcelaId,
        numero: Number(data.numeroParcela || 1),
        total: Number(data.totalParcelas || 1),
        porNome: false
      }
    }
    const match = (data.descricao || '').match(/\((\d+)\/(\d+)\)$/)
    if (match) {
      return {
        numero: parseInt(match[1], 10),
        total: parseInt(match[2], 10),
        baseDesc: (data.descricao || '').replace(/\s*\(\d+\/\d+\)$/, '').trim(),
        porNome: true
      }
    }
    return null
  }, [data])

  const [form, setForm] = useState(() => {
    if (data) {
      return {
        ...data,
        atualizarGrupo: parsedParcelaInfo ? true : false,
        escopoParcelas: 'futuras' // 'futuras' (esta e as da frente) | 'todas' (todas pendentes)
      }
    }
    return {
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
    }
  })
  const [isExtracting, setIsExtracting] = useState(false)
  const [uploadingStorage, setUploadingStorage] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [loteMultiboletos, setLoteMultiboletos] = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setIsExtracting(true)
    setUploadingStorage(true)

    try {
      try {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const storageRef = ref(storage, `financeiro/boletos/${Date.now()}_${safeName}`)
        const snapshot = await uploadBytes(storageRef, file)
        const downloadUrl = await getDownloadURL(snapshot.ref)
        set('arquivoUrl', downloadUrl)
      } catch (stErr) {
        console.warn("Storage upload falhou:", stErr)
      }

      const reader = new FileReader()
      reader.onload = async (ev) => {
        const base64Data = ev.target.result
        // Fallback imediato: se o upload no storage falhou, salva o Base64 garantindo que o PDF fique anexado
        setForm(prev => {
          if (!prev.arquivoUrl) return { ...prev, arquivoUrl: base64Data }
          return prev
        })
        try {
          const res = await fetch('/api/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file: base64Data, mimeType: file.type, type: 'despesa' })
          })
          const ocrData = await res.json()
          if (ocrData.success && ocrData.data) {
            let dataArr = ocrData.data;
            if (!Array.isArray(dataArr)) dataArr = [dataArr];
            
            if (dataArr.length > 0) {
              const first = dataArr[0];
              if (first.descricao) set('descricao', first.fornecedor ? `${first.descricao} - ${first.fornecedor}` : first.descricao);
              if (first.valor) set('valor', String(first.valor));
              if (first.vencimento) set('data', first.vencimento);
              if (first.categoria && !form.categoria) set('categoria', first.categoria);
              if (first.linhaDigitavel) set('linhaDigitavel', first.linhaDigitavel);
              if (first.pix) set('pix', first.pix);
              
              if (dataArr.length > 1) {
                setLoteMultiboletos(dataArr);
                alert(`✓ Encontramos ${dataArr.length} boletos/parcelas no arquivo! Configure os dados gerais (condomínio, tipo) e clique em "Salvar Lote" para cadastrar todos.`);
              } else {
                alert('✓ Dados e código do boleto extraídos automaticamente com Inteligência Artificial!');
              }
            }
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
              {data ? 'Editar Lançamento' : 'Novo Lançamento Financeiro'}
            </h3>
            <p className="text-xs text-gray-500">Cadastre despesas/receitas da Alpha ou dos Condomínios</p>
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
                  ✓ Boleto / Recibo anexado na nuvem
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
              <label className="label">Descrição / Fornecedor / Origem *</label>
              <input 
                className="input" 
                value={form.descricao} 
                onChange={e => set('descricao', e.target.value)} 
                placeholder="Ex: Honorários Alpha, Allianz Seguro, Salários, Software" 
                required
              />
            </div>

            {/* SELEÇÃO DE CENTRO DE CUSTO / CONDOMÍNIO */}
            <div className="sm:col-span-2">
              <label className="label font-black text-brand-900 flex items-center gap-1.5">
                <Building2 size={14} /> Unidade de Custo / Condomínio *
              </label>
              <select 
                className="input font-bold bg-amber-50/70 border-amber-300 text-gray-900" 
                value={form.condominio} 
                onChange={e => set('condominio', e.target.value)} 
                disabled={user?.role==='Morador'}
              >
                <option value="Alpha (Interno)">👑 Alpha Soluções (Financeiro Interno / Matriz)</option>
                <option value="Todos">🌐 Geral (Todos os Condomínios)</option>
                {condominiosDisponiveis.map(c => <option key={c} value={c}>🏢 {c}</option>)}
              </select>
              <span className="text-[10px] text-gray-500 mt-0.5 block">
                Escolha <b>Alpha Soluções (Interno)</b> para gastos e receitas da empresa, ou o condomínio correspondente.
              </span>
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
                list="categorias-sugestoes"
                value={form.categoria} 
                onChange={e => set('categoria', e.target.value)} 
                placeholder="Ex: Manutenção Preventiva, Visita Técnica, Honorários..." 
              />
              <datalist id="categorias-sugestoes">
                <option value="Manutenção Preventiva" />
                <option value="Visita Técnica" />
                <option value="Manutenção Corretiva" />
                <option value="Honorários Alpha" />
                <option value="Equipe / Salários" />
                <option value="Seguro Predial" />
                <option value="Limpeza & Conservação" />
                <option value="Tecnologia & Softwares" />
                <option value="Tarifa Bancária" />
                <option value="Água & Saneamento" />
                <option value="Energia Elétrica" />
              </datalist>
              <div className="flex gap-1.5 mt-1.5 flex-wrap">
                {['Manutenção Preventiva', 'Visita Técnica', 'Manutenção Corretiva'].map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => set('categoria', cat)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                      form.categoria === cat 
                        ? 'bg-brand-600 text-white border-brand-600 shadow-sm' 
                        : 'bg-cream-50 text-gray-600 border-cream-300 hover:bg-cream-100'
                    }`}
                  >
                    {cat === 'Manutenção Preventiva' ? '🔧 Preventiva' : cat === 'Visita Técnica' ? '📋 Visita Técnica' : '🚨 Corretiva'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Valor (R$) *</label>
              <CurrencyInput value={form.valor} onChange={v => set('valor', v)} placeholder="0,00" />
            </div>

            <div>
              <label className="label">Data de Vencimento / Pagamento *</label>
              <input type="date" className="input" value={form.data} onChange={e => set('data', e.target.value)} />
            </div>

            <div className="sm:col-span-2">
              <label className="label">Status</label>
              <select className="input font-bold" value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="Pendente">⏳ Pendente</option>
                <option value="Pago">✅ Pago / Liquidado</option>
                <option value="Recebido">💵 Recebido</option>
                <option value="Aguardando Aprovação">🟠 Aguardando Aprovação</option>
              </select>
            </div>

            {/* Linha Digitável */}
            <div className="sm:col-span-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-1">
                <label className="label text-xs font-bold text-gray-700 m-0">
                  Linha Digitável / Código de Barras
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
                placeholder="Linha digitável ou código numérico do boleto" 
              />
            </div>

            {/* PIX */}
            <div className="sm:col-span-2 bg-emerald-50/50 p-3 rounded-xl border border-emerald-200">
              <label className="label text-xs font-bold text-emerald-900 mb-1 block">
                Chave PIX / PIX Copia e Cola
              </label>
              <input 
                className="input font-mono text-xs bg-white" 
                value={form.pix || ''} 
                onChange={e => set('pix', e.target.value)} 
                placeholder="Chave PIX do fornecedor ou código Copia e Cola" 
              />
            </div>

            {/* Edição de Parcela de Grupo Existente */}
            {data && (data.grupoParcelaId || parsedParcelaInfo) && (
              <div className="sm:col-span-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-300 p-4 rounded-xl flex flex-col gap-2.5 shadow-xs">
                <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                  📦 Este lançamento é a <b>Parcela {data.numeroParcela || parsedParcelaInfo?.numero || '1'} de {data.totalParcelas || parsedParcelaInfo?.total || '—'}</b>
                </span>
                
                <label className="flex items-center gap-2 text-xs font-bold text-blue-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(form.atualizarGrupo)}
                    onChange={e => set('atualizarGrupo', e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-blue-400 focus:ring-blue-500 cursor-pointer"
                  />
                  <span>Replicar alterações para as demais parcelas deste lançamento</span>
                </label>

                {form.atualizarGrupo && (
                  <div className="pl-6 flex flex-col gap-1.5 text-xs text-blue-950 font-medium animate-fade-in">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="escopoParcelas"
                        value="futuras"
                        checked={form.escopoParcelas === 'futuras'}
                        onChange={e => set('escopoParcelas', e.target.value)}
                        className="text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span><b>Atualizar esta e todas as parcelas lançadas para frente</b> (recomendado)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="escopoParcelas"
                        value="todas"
                        checked={form.escopoParcelas === 'todas'}
                        onChange={e => set('escopoParcelas', e.target.value)}
                        className="text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span>Atualizar todas as parcelas pendentes deste parcelamento</span>
                    </label>
                  </div>
                )}

                <p className="text-[11px] text-blue-700">
                  {form.atualizarGrupo
                    ? '✓ As parcelas selecionadas receberão o novo valor, categoria, condomínio, fornecedor e descrição automaticamente.'
                    : 'Desmarcado: altera somente esta parcela individual, sem modificar as outras.'}
                </p>
              </div>
            )}
          </div>

          {/* PARCELAMENTO / RECORRÊNCIA FLEXÍVEL (LANÇAMENTO NOVO) */}
          {!data && (
            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl flex flex-col gap-3">
              <label className="flex items-center gap-2 text-xs font-black text-amber-950 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={Boolean(form.parcelado || form.recorrente)} 
                  onChange={e => {
                    const checked = e.target.checked
                    setForm(f => ({ ...f, parcelado: checked, recorrente: checked }))
                  }} 
                  className="w-4 h-4 text-amber-600 rounded border-gray-300 focus:ring-amber-500 cursor-pointer" 
                />
                <Repeat size={15} className="text-amber-700" /> Parcelar ou Repetir este lançamento nos próximos meses?
              </label>

              {(form.parcelado || form.recorrente) && (
                <div className="flex flex-col gap-3 bg-white p-3.5 rounded-xl border border-amber-200 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label text-[11px] font-bold text-gray-700">Quantidade de Parcelas (Meses)</label>
                      <input
                        type="number"
                        min="2"
                        max="60"
                        className="input py-1.5 font-bold"
                        value={form.qtdParcelas || form.qtdMeses || '2'}
                        onChange={e => setForm(f => ({ ...f, qtdParcelas: e.target.value, qtdMeses: e.target.value }))}
                        placeholder="Ex: 2, 3, 5, 10, 12..."
                      />
                    </div>
                    <div>
                      <label className="label text-[11px] font-bold text-gray-700">Como Calcular o Valor?</label>
                      <select
                        className="input py-1.5 font-bold"
                        value={form.modoParcelas || 'dividir'}
                        onChange={e => set('modoParcelas', e.target.value)}
                      >
                        <option value="dividir">Dividir o valor total digitado entre as parcelas</option>
                        <option value="repetir">Repetir o valor digitado em cada mês</option>
                      </select>
                    </div>
                  </div>

                  {/* Resumo do cálculo em tempo real */}
                  {(() => {
                    const q = Math.max(2, Number(form.qtdParcelas || form.qtdMeses || 2))
                    const valLimpo = typeof form.valor === 'number' ? form.valor : (Number(String(form.valor || '0').replace(/\./g, '').replace(',', '.')) || 0)
                    const valPorParcela = form.modoParcelas === 'repetir' ? valLimpo : (valLimpo / q)
                    const totalCalculado = form.modoParcelas === 'repetir' ? (valLimpo * q) : valLimpo
                    return (
                      <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200/80 text-[11px] text-amber-900 font-semibold flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1">
                        <span>
                          {form.modoParcelas === 'repetir' 
                            ? `Serão lançadas ${q} parcelas de R$ ${valPorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} cada.`
                            : `Valor total R$ ${totalCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} dividido em ${q} parcelas de R$ ${valPorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`}
                        </span>
                        <span className="text-[10px] text-amber-800 font-black">
                          Total: R$ {totalCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )
                  })()}
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
              if (loteMultiboletos && loteMultiboletos.length > 1) {
                onSave({ ...form, loteMultiboletos })
              } else {
                onSave(form)
              }
            }}
            className="btn-primary"
          >
            {data ? 'Atualizar Lançamento' : (loteMultiboletos && loteMultiboletos.length > 1 ? `Salvar Lote (${loteMultiboletos.length})` : 'Salvar Lançamento')}
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
  const { items: financeiroConfigs } = useFirestore('financeiro_config')
  const { items: condominiosList } = useFirestore('condominios')
  const { items: allBoletos } = useFirestore('boletos')

  const searchParams = new URLSearchParams(window.location.search)
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || (isMorador ? 'Historico' : 'Dashboard'))
  const [modalLanc, setModalLanc] = useState(null)
  const [modalConta, setModalConta] = useState(null)
  const userRole = user?.role || ''
  const isAdm = userRole === 'Administrador'
  const isSindicoOuConselho = ['Síndico', 'Subsíndico', 'Conselheiro', 'Conselho', 'Conselho Fiscal'].includes(userRole)
  const meuCondominio = user?.condominio || ''

  // Para síndico/conselheiro, o filtro é fixo no condomínio dele. Somente Administrador pode ver 'Todos' ou 'Alpha (Interno)'.
  const [condoFilter, setCondoFilter] = useState(() => {
    if (!isAdm && meuCondominio) return meuCondominio
    return 'Todos'
  })

  // Se o usuário não for administrador, garante que o condoFilter fique travado no condomínio dele
  React.useEffect(() => {
    if (!isAdm && meuCondominio && condoFilter !== meuCondominio) {
      setCondoFilter(meuCondominio)
    }
  }, [isAdm, meuCondominio])

  const [showRepasses, setShowRepasses] = useState(false)

  const condominiosDisponiveis = isAdm
    ? condominiosList.filter(c => c.status !== 'Inativo').map(c => c.nome)
    : (meuCondominio ? [meuCondominio] : [])

  const handleSaveLancamento = async (form) => {
    try {
      if (modalLanc && modalLanc.id) {
        if (form.atualizarGrupo) {
          // Identificar grupo de parcelas: seja por grupoParcelaId ou por correspondência de nome no formato "(XX/YY)"
          const grupoId = form.grupoParcelaId || modalLanc.grupoParcelaId
          const matchOrig = (modalLanc.descricao || '').match(/\((\d+)\/(\d+)\)$/)
          const numOrig = modalLanc.numeroParcela || (matchOrig ? parseInt(matchOrig[1], 10) : 1)
          const descBaseOrig = (modalLanc.descricao || '').replace(/\s*\(\d+\/\d+\)$/, '').trim().toLowerCase()
          const escopo = form.escopoParcelas || 'futuras' // 'futuras' (esta e as da frente) | 'todas'

          const parcelasDoGrupo = allLancamentos.filter(l => {
            if (grupoId && l.grupoParcelaId === grupoId) return true
            if (descBaseOrig) {
              const matchL = (l.descricao || '').match(/\((\d+)\/(\d+)\)$/)
              if (matchL) {
                const descBaseL = (l.descricao || '').replace(/\s*\(\d+\/\d+\)$/, '').trim().toLowerCase()
                return descBaseL === descBaseOrig && (l.condominio === modalLanc.condominio || l.tipo === modalLanc.tipo)
              }
            }
            return false
          })

          const novaDescBase = (form.descricao || '').replace(/\s*\(\d+\/\d+\)$/, '').trim()

          for (const p of parcelasDoGrupo) {
            if (p.id === modalLanc.id) {
              await updateLancamento(modalLanc.id, form)
            } else {
              const matchP = (p.descricao || '').match(/\((\d+)\/(\d+)\)$/)
              const numP = p.numeroParcela || (matchP ? parseInt(matchP[1], 10) : null)
              
              // Se escopo for 'futuras', apenas atualizar parcelas da frente (número maior ou data posterior)
              let deveAtualizar = false
              if (escopo === 'futuras') {
                if (numP !== null && numOrig !== null) {
                  deveAtualizar = numP > numOrig
                } else if (p.data && modalLanc.data) {
                  deveAtualizar = new Date(p.data) >= new Date(modalLanc.data)
                } else {
                  deveAtualizar = true
                }
              } else {
                deveAtualizar = true
              }

              // Não sobrescrever parcelas que já estejam pagas
              if (deveAtualizar && p.status !== 'Pago') {
                const labelParcela = matchP ? ` (${matchP[1]}/${matchP[2]})` : (p.numeroParcela ? ` (${String(p.numeroParcela).padStart(2, '0')}/${String(p.totalParcelas || '').padStart(2, '0')})` : '')
                await updateLancamento(p.id, {
                  descricao: novaDescBase ? `${novaDescBase}${labelParcela}` : p.descricao,
                  valor: form.valor,
                  categoria: form.categoria || p.categoria,
                  fornecedor: form.fornecedor || p.fornecedor,
                  condominio: form.condominio || p.condominio,
                  tipo: form.tipo || p.tipo,
                  conta: form.conta || p.conta,
                  observacao: form.observacao || p.observacao
                })
              }
            }
          }
          await registrarLogAuditoria(user, 'Edição de Parcelas em Grupo', `Atualizou o parcelamento de ${form.descricao} (escopo: ${escopo})`)
        } else {
          await updateLancamento(modalLanc.id, form)
          await registrarLogAuditoria(user, 'Edição de Lançamento', `Editou o lançamento ${form.descricao}`)
        }
      } else {
        if (form.loteMultiboletos && form.loteMultiboletos.length > 1) {
          for (let i = 0; i < form.loteMultiboletos.length; i++) {
            const b = form.loteMultiboletos[i];
            await addLancamento({
              ...form,
              descricao: b.fornecedor ? `${b.descricao} - ${b.fornecedor}` : (b.descricao || form.descricao),
              valor: b.valor ? String(b.valor) : form.valor,
              data: b.vencimento || form.data,
              linhaDigitavel: b.linhaDigitavel || '',
              pix: b.pix || '',
              recorrente: false,
              parcelado: false,
              loteMultiboletos: null
            });
          }
          await registrarLogAuditoria(user, 'Criação em Lote OCR', `Criou ${form.loteMultiboletos.length} lançamentos a partir de PDF (Lote).`);
        } else if ((form.parcelado || form.recorrente) && (Number(form.qtdParcelas || form.qtdMeses) > 1)) {
          const totalParcelas = Math.min(Math.max(2, Number(form.qtdParcelas || form.qtdMeses)), 60)
          const dataBase = form.data ? new Date(form.data + 'T12:00:00') : new Date()
          const grupoParcelaId = 'grp_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6)
          
          const valLimpo = typeof form.valor === 'number' ? form.valor : (Number(String(form.valor || '0').replace(/\./g, '').replace(',', '.')) || 0)
          const modo = form.modoParcelas || 'dividir'
          const valPorParcela = modo === 'repetir' ? valLimpo : Number((valLimpo / totalParcelas).toFixed(2))

          for (let i = 0; i < totalParcelas; i++) {
            const dataParcela = new Date(dataBase)
            dataParcela.setMonth(dataBase.getMonth() + i)
            const dataStr = dataParcela.toISOString().split('T')[0]
            const parcelaLabel = `(${String(i + 1).padStart(2, '0')}/${String(totalParcelas).padStart(2, '0')})`
            const descLimpa = (form.descricao || '').replace(/\s*\(\d+\/\d+\)$/, '').trim()

            await addLancamento({
              ...form,
              descricao: `${descLimpa} ${parcelaLabel}`,
              valor: String(valPorParcela.toFixed(2)),
              data: dataStr,
              recorrente: false,
              parcelado: true,
              origemRecorrente: true,
              grupoParcelaId,
              numeroParcela: i + 1,
              totalParcelas,
              modoParcelas: modo,
              status: i === 0 ? (form.status || 'Pendente') : 'Pendente'
            })
          }
          await registrarLogAuditoria(user, 'Criação de Parcelas', `Criou ${totalParcelas} parcelas de ${form.descricao}`)
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

  // Filtragem Inteligente: Geral, Alpha Interno ou Condomínio Específico
  // Para síndico e conselheiro: EXCLUSIVO do condomínio dele, sem ver dados da matriz Alpha nem outros condomínios
  const lancamentos = allLancamentos.filter(l => {
    if (!isAdm) {
      if (!meuCondominio) return false
      // Não pode ver lançamentos internos da Alpha
      if (isAlphaInterno(l.condominio)) return false
      return (l.condominio || '').trim().toLowerCase() === meuCondominio.trim().toLowerCase()
    }

    if (condoFilter === 'Todos') return true
    if (condoFilter === 'Alpha (Interno)') {
      return isAlphaInterno(l.condominio)
    }
    return l.condominio === condoFilter
  })

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-pale-300 shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
            <Wallet className="text-brand-600" /> Gestão Financeira {isAdm ? 'Completa' : `— ${meuCondominio || 'Meu Condomínio'}`}
          </h2>
          <p className="text-gray-500 font-medium text-xs sm:text-sm mt-0.5">
            {isAdm 
              ? 'Controle de receitas, despesas, boletos em nuvem, pagamentos e fluxo de caixa de todos os condomínios e Alpha interna'
              : `Prestação de contas, receitas e despesas exclusivas do condomínio ${meuCondominio || ''}`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Seletor visível apenas para Administrador */}
          {isAdm ? (
            <div className="relative">
              <select 
                value={condoFilter} 
                onChange={e => setCondoFilter(e.target.value)}
                className="input py-2 text-xs font-bold bg-amber-50/80 border-amber-300 text-gray-900 pr-8"
              >
                <option value="Todos">🌐 Todos os Condomínios + Alpha (Geral)</option>
                <option value="Alpha (Interno)">👑 Alpha Soluções (Financeiro Interno / Matriz)</option>
                <optgroup label="Condomínios Clientes">
                  {condominiosDisponiveis.map(c => <option key={c} value={c}>🏢 {c}</option>)}
                </optgroup>
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-brand-50 border border-brand-200 px-3 py-2 rounded-xl text-xs font-bold text-brand-900">
              <Building2 size={16} className="text-brand-600" />
              <span>Condomínio: {meuCondominio || 'Vinculado'}</span>
            </div>
          )}

          {!isMorador && (
            <button
              onClick={() => setModalLanc({ tipo: 'Despesa', status: 'Pendente', descricao: '', categoria: '', valor: '', data: new Date().toISOString().split('T')[0], condominio: !isAdm ? (meuCondominio || '') : (condoFilter !== 'Todos' ? condoFilter : 'Alpha (Interno)') })}
              className="btn-primary py-2 px-4 text-xs font-black flex items-center gap-1.5 shadow-md shadow-brand-700/20 bg-emerald-600 hover:bg-emerald-500 uppercase tracking-wider cursor-pointer"
            >
              <Plus size={16} /> + Novo Lançamento
            </button>
          )}
        </div>
      </div>

      {/* TODAS AS ABAS VISÍVEIS EM BOTÕES ELEGANTES */}
      <div className="flex gap-2 p-1.5 bg-slate-100 border border-slate-200 rounded-2xl w-full flex-wrap items-center">
        {!isMorador && (
          <>
            <button 
              onClick={() => setActiveTab('Dashboard')} 
              className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${activeTab === 'Dashboard' ? 'bg-white shadow-md text-brand-700 ring-1 ring-slate-200' : 'text-gray-600 hover:text-brand-600 hover:bg-white/50'}`}
            >
              📊 Dashboard
            </button>
            <button 
              onClick={() => setActiveTab('ContasPagar')} 
              className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${activeTab === 'ContasPagar' ? 'bg-white shadow-md text-rose-700 ring-1 ring-slate-200' : 'text-gray-600 hover:text-rose-600 hover:bg-white/50'}`}
            >
              🔴 Contas a Pagar & Boletos
            </button>
            <button 
              onClick={() => setActiveTab('ContasReceber')} 
              className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${activeTab === 'ContasReceber' ? 'bg-white shadow-md text-emerald-700 ring-1 ring-slate-200' : 'text-gray-600 hover:text-emerald-600 hover:bg-white/50'}`}
            >
              🟢 Contas a Receber
            </button>
            <button 
              onClick={() => setActiveTab('RateioAgua')} 
              className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${activeTab === 'RateioAgua' ? 'bg-white shadow-md text-blue-700 ring-1 ring-slate-200' : 'text-gray-600 hover:text-blue-600 hover:bg-white/50'}`}
            >
              <Droplet size={14} className="text-blue-500" /> Rateio de Água & Gás
            </button>
            <button 
              onClick={() => setActiveTab('FluxoCaixa')} 
              className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${activeTab === 'FluxoCaixa' ? 'bg-white shadow-md text-brand-700 ring-1 ring-slate-200' : 'text-gray-600 hover:text-brand-600 hover:bg-white/50'}`}
            >
              📈 Fluxo de Caixa
            </button>
            <button 
              onClick={() => setActiveTab('Conciliacao')} 
              className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${activeTab === 'Conciliacao' ? 'bg-white shadow-md text-purple-700 ring-1 ring-slate-200' : 'text-gray-600 hover:text-purple-600 hover:bg-white/50'}`}
            >
              <Landmark size={14} className="text-purple-500" /> Conciliação OFX
            </button>
            <button 
              onClick={() => setActiveTab('ReservaEmergencia')} 
              className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${activeTab === 'ReservaEmergencia' ? 'bg-white shadow-md text-indigo-700 ring-1 ring-slate-200' : 'text-gray-600 hover:text-indigo-600 hover:bg-white/50'}`}
            >
              <Shield size={14} className="text-indigo-500" /> Fundo de Caixa / Reserva
            </button>
            <button 
              onClick={() => setActiveTab('DRE')} 
              className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${activeTab === 'DRE' ? 'bg-white shadow-md text-brand-700 ring-1 ring-slate-200' : 'text-gray-500 hover:text-brand-600 hover:bg-white/50'}`}
            >
              📋 DRE
            </button>
          </>
        )}
        <button 
          onClick={() => setActiveTab('Historico')} 
          className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${activeTab === 'Historico' ? 'bg-white shadow-md text-brand-700 ring-1 ring-slate-200' : 'text-gray-600 hover:text-brand-600 hover:bg-white/50'}`}
        >
          📜 Histórico Geral
        </button>
      </div>

      {/* Conteúdo Renderizado da Aba Ativa */}
      {activeTab === 'Dashboard' && (
        <DashboardFinanceiro 
          lancamentos={lancamentos} 
          contas={contas} 
          configs={financeiroConfigs}
          condominios={condominiosList}
          boletos={allBoletos}
          condoFilter={condoFilter}
          setModalLanc={setModalLanc} 
        />
      )}
      {activeTab === 'ContasPagar' && <ContasPagar lancamentos={lancamentos} setModalLanc={setModalLanc} deleteLancamento={deleteLancamento} updateLancamento={updateLancamento} />}
      {activeTab === 'ContasReceber' && <ContasReceber lancamentos={lancamentos} setModalLanc={setModalLanc} deleteLancamento={deleteLancamento} updateLancamento={updateLancamento} />}
      {activeTab === 'RateioAgua' && <RateioAgua lancamentos={lancamentos} condoFilter={condoFilter} condominiosDisponiveis={condominiosDisponiveis} />}
      {activeTab === 'FluxoCaixa' && <FluxoCaixa lancamentos={lancamentos} contas={contas} />}
      {activeTab === 'Conciliacao' && <Conciliacao lancamentos={lancamentos} setModalLanc={setModalLanc} updateLancamento={updateLancamento} />}
      {activeTab === 'ReservaEmergencia' && (
        <ReservaEmergencia 
          lancamentos={allLancamentos} 
          condoFilter={condoFilter} 
          condominiosDisponiveis={condominiosDisponiveis} 
          condominios={condominiosList}
          boletos={allBoletos}
          setModalLanc={setModalLanc} 
        />
      )}
      {activeTab === 'DRE' && <DRE lancamentos={lancamentos} condoFilter={condoFilter} />}
      {activeTab === 'Historico' && <Historico lancamentos={lancamentos} setModalLanc={setModalLanc} deleteLancamento={deleteLancamento} updateLancamento={updateLancamento} />}

      {/* Modais */}
      {modalLanc && (
        <ModalLancamento
          data={modalLanc.id ? modalLanc : null}
          allLancamentos={allLancamentos}
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
