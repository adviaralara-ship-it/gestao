import React, { useState } from 'react'
import { Plus, Wallet, FileText, CreditCard, LayoutDashboard, Calendar, ShieldAlert, Calculator, FileCheck, DollarSign } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'
import RepassesAlphaModal from '../components/RepassesAlphaModal'
import { CurrencyInput } from '../utils/currency'

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

// ─── Modal: Lançamento ────────────────────────────────────────────────
function ModalLancamento({ data, user, condominiosDisponiveis, filtroAtual, onClose, onSave }) {
  const defaultCondo = filtroAtual && filtroAtual !== 'Todos' ? filtroAtual : (user?.condominio || '');
  const [form, setForm] = useState(data || {
    descricao: '', tipo: 'Receita', categoria: '', valor: '', data: '', status: 'Pendente', condominio: defaultCondo, arquivoUrl: '', recorrente: false, qtdMeses: ''
  })
  const [isExtracting, setIsExtracting] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setIsExtracting(true)
    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const base64Data = e.target.result
        try {
          const res = await fetch('/api/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file: base64Data, mimeType: file.type, type: 'despesa' })
          })
          const ocrData = await res.json()
          if (ocrData.success) {
            if (ocrData.data.descricao) set('descricao', ocrData.data.descricao)
            if (ocrData.data.valor) set('valor', ocrData.data.valor)
            if (ocrData.data.vencimento) set('data', ocrData.data.vencimento)
            if (ocrData.data.fornecedor && form.tipo === 'Despesa') set('descricao', `${ocrData.data.descricao} - ${ocrData.data.fornecedor}`)
            alert('Dados extraídos automaticamente com IA!')
          } else {
            console.error('OCR Error:', ocrData.error)
            alert('Não foi possível ler o arquivo. Preencha manualmente.')
          }
        } catch(err) {
          console.error(err)
        }
        
        if (file.size < 2048576) { 
           set('arquivoUrl', base64Data)
        }
        setIsExtracting(false)
      }
      reader.readAsDataURL(file)
    } catch (err) {
      console.error(err)
      setIsExtracting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">{data ? 'Editar Lançamento' : 'Novo Lançamento'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="col-span-2 bg-brand-50 p-3 rounded-lg border border-brand-100">
            <label className="label text-brand-700 flex items-center gap-2">🤖 Auto-preencher com Arquivo (Boleto/Recibo)</label>
            <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleFileUpload} className="input p-2 text-sm bg-white" disabled={isExtracting} />
            {isExtracting && <p className="text-xs text-brand-600 mt-1 animate-pulse">Extraindo informações...</p>}
            {form.arquivoUrl && <a href={form.arquivoUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-500 underline mt-2 block">Ver arquivo anexado</a>}
          </div>
          <div className="col-span-2">
            <label className="label">Descrição</label>
            <input className="input" value={form.descricao} onChange={e => set('descricao', e.target.value)} placeholder="Ex: Taxa condominial de abril" autoFocus />
          </div>
          <div className="col-span-2">
            <label className="label">Condomínio</label>
            <select className="input" value={form.condominio} onChange={e => set('condominio', e.target.value)} disabled={user?.role==='Morador'}>
              <option value="">Selecione...</option>
              {condominiosDisponiveis.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Tipo</label>
            <select className="input" value={form.tipo} onChange={e => set('tipo', e.target.value)}>
              <option>Receita</option><option>Despesa</option>
            </select>
          </div>
          <div>
            <label className="label">Categoria</label>
            <input className="input" value={form.categoria} onChange={e => set('categoria', e.target.value)} placeholder="Ex: Manutenção, Taxa..." />
          </div>
          <div>
            <label className="label">Valor</label>
            <CurrencyInput value={form.valor} onChange={v => set('valor', v)} placeholder="0,00" />
          </div>
          <div>
            <label className="label">Data</label>
            <input type="date" className="input" value={form.data} onChange={e => set('data', e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
              <option>Recebido</option><option>Pago</option><option>Pendente</option><option>Aguardando Aprovação</option>
            </select>
          </div>
          
          {!data && (
            <div className="col-span-2 bg-cream-50 p-3 rounded-lg border border-cream-200 mt-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer mb-2">
                <input type="checkbox" checked={form.recorrente} onChange={e=>set('recorrente',e.target.checked)} className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500" />
                Repetir este lançamento mensalmente?
              </label>
              {form.recorrente && (
                <div>
                  <label className="label text-xs">Quantidade de meses (Ex: 12)</label>
                  <input type="number" min="2" max="60" className="input max-w-[150px]" value={form.qtdMeses} onChange={e => set('qtdMeses', e.target.value)} placeholder="Digite..." />
                </div>
              )}
            </div>
          )}
        </div>
        <div className="p-6 border-t border-cream-300 flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button
            onClick={() => { if (!form.descricao || !form.valor) return; onSave(form) }}
            className="btn-primary"
          >Salvar</button>
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

  const lancamentos = allLancamentos.filter(l => {
    if (['Morador', 'Síndico', 'Subsíndico', 'Conselheiro'].includes(user?.role)) {
       return !l.condominio || l.condominio === user?.condominio;
    }
    if (condoFilter && condoFilter !== 'Todos') {
       return l.condominio === condoFilter;
    }
    return true;
  })

  const uniqueCondos = Array.from(new Set([
    ...condominiosList.filter(c => c.status !== 'Inativo').map(c => c.nome),
    ...allLancamentos.map(n => n.condominio),
    'Alpha Soluções (Uso Interno)'
  ].filter(Boolean)))

  const handleSaveLanc = async (form) => {
    const clean = { ...form, valor: Number(form.valor) }
    
    if (form.id) {
      delete clean.recorrente
      delete clean.qtdMeses
      await updateLancamento(form.id, clean)
    } else {
      if (form.recorrente && form.qtdMeses && Number(form.qtdMeses) > 1) {
        const baseDate = new Date(form.data + 'T12:00:00Z') // T12 to avoid timezone shift
        const qtd = Number(form.qtdMeses)
        for (let i = 0; i < qtd; i++) {
          const newDate = new Date(baseDate)
          newDate.setMonth(newDate.getMonth() + i)
          const dataStr = newDate.toISOString().split('T')[0]
          
          const parcelaClean = { ...clean, data: dataStr }
          if (i > 0) parcelaClean.status = 'Pendente' // Future installments are pending
          delete parcelaClean.recorrente
          delete parcelaClean.qtdMeses
          
          await addLancamento(parcelaClean)
        }
      } else {
        delete clean.recorrente
        delete clean.qtdMeses
        await addLancamento(clean)
      }
    }
    setModalLanc(null)
  }

  const handleSaveConta = async (form) => {
    const clean = { ...form, saldo: Number(form.saldo) }
    if (form.id) await updateConta(form.id, clean)
    else await addConta(clean)
    setModalConta(null)
  }

  let tabs = [
    { id: 'Dashboard', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'Pagar', label: 'Contas a Pagar', icon: CreditCard },
    { id: 'Receber', label: 'Contas a Receber', icon: Wallet },
    { id: 'Fluxo', label: 'Fluxo de Caixa', icon: Calendar },
    { id: 'DRE', label: 'DRE (Relatório)', icon: FileText },
    { id: 'Historico', label: 'Histórico (Todos)', icon: FileText },
  ]
  
  
  if (isMorador) {
    tabs = [{ id: 'Historico', label: 'Histórico (Todos)', icon: FileText }]
  }

  if (user?.role === 'Administrador' || user?.role === 'Financeiro') {
    tabs.push({ id: 'Reserva', label: 'Caixa Alpha', icon: ShieldAlert })
    tabs.push({ id: 'Conciliacao', label: 'Conciliação (OFX)', icon: LayoutDashboard })
    tabs.push({ id: 'Rateio', label: 'Rateio de Água', icon: Calculator })
    tabs.push({ id: 'Fiscal', label: 'Fiscal & EFD-Reinf', icon: FileCheck })
  }

  // Tabela Antiga e Listagem de Contas (Aba Configurações/Geral)
  const renderContasBancarias = () => (
    <div className="animate-fade-in mt-6">
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <p className="section-title">Contas Bancárias</p>
          <button onClick={() => setModalConta({})} className="btn-secondary text-sm py-1.5 px-3">Adicionar</button>
        </div>
      {contas.length === 0
        ? <p className="text-sm text-gray-400 text-center py-4">Nenhuma conta cadastrada.</p>
        : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {contas.map(c => (
              <div key={c.id} className="bg-gray-100 border border-gray-200 rounded-xl p-4 group relative">
                <p className="text-xs text-gray-500 mb-1">{c.tipo}</p>
                <p className="text-sm font-semibold text-gray-800 mb-2">{c.nome}</p>
                <p className="text-lg font-black text-emerald-600">R$ {Number(c.saldo || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setModalConta(c)} className="p-1 rounded bg-white border border-gray-200 hover:text-brand-600">✎</button>
                  <button onClick={() => deleteConta(c.id)} className="p-1 rounded bg-white border border-gray-200 hover:text-red-500">✕</button>
                </div>
              </div>
            ))}
          </div>
        )
      }
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-20">
      <div className="page-header flex flex-col md:flex-row gap-4 items-start md:items-center">
        <div className="flex-1">
          <h2 className="section-title text-2xl">{isMorador ? 'Prestação de Contas' : 'Gestão Financeira'}</h2>
          <p className="section-sub">{isMorador ? 'Acompanhe a transparência financeira' : 'Módulo completo de DRE, Fluxo de Caixa e Contas'}</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
          {(user?.role === 'Administrador' || user?.role === 'Financeiro') && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0 block">Filtrar:</label>
              <select className="input text-sm py-1.5 h-auto w-40" value={condoFilter} onChange={e=>setCondoFilter(e.target.value)}>
                <option value="Todos">Todos os Condomínios</option>
                {uniqueCondos.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          {!isMorador && (
            <div className="flex items-center gap-2">
              {(user?.role === 'Administrador' || user?.role === 'Financeiro' || user?.role === 'Síndico') && (
                <button
                  onClick={() => setShowRepasses(true)}
                  className="btn-secondary text-sm flex items-center gap-1.5 bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 font-bold shadow-sm"
                >
                  <DollarSign size={15} className="text-amber-700"/> Repasses Alpha
                </button>
              )}
              <button onClick={() => setModalLanc({})} className="btn-primary shadow-lg shadow-brand-500/30 whitespace-nowrap">
                <Plus size={16} /> Novo Lançamento
              </button>
            </div>
          )}
        </div>
      </div>

      {!isMorador && (
        <div className="bg-white border border-cream-300 rounded-xl p-2 flex flex-wrap gap-2 shadow-sm">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all whitespace-nowrap
                ${activeTab === tab.id 
                  ? 'bg-brand-600 text-white shadow-md' 
                  : 'text-gray-500 hover:bg-cream-100 hover:text-brand-600'
                }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Roteamento Interno das Abas */}
      {activeTab === 'Dashboard' && (
        <>
          <DashboardFinanceiro lancamentos={lancamentos} contas={contas} />
          {!isMorador && renderContasBancarias()}
        </>
      )}
      
      {activeTab === 'Pagar' && (
        <ContasPagar 
          lancamentos={lancamentos} 
          setModalLanc={setModalLanc} 
          updateLancamento={updateLancamento} 
          deleteLancamento={deleteLancamento} 
        />
      )}

      {activeTab === 'Receber' && (
        <ContasReceber 
          lancamentos={lancamentos} 
          setModalLanc={setModalLanc} 
          updateLancamento={updateLancamento} 
          deleteLancamento={deleteLancamento} 
        />
      )}

      {activeTab === 'Fluxo' && (
        <FluxoCaixa lancamentos={lancamentos} contas={contas} />
      )}

      {activeTab === 'DRE' && (
        <DRE lancamentos={lancamentos} condoFilter={condoFilter} />
      )}

      {activeTab === 'Reserva' && (
        <ReservaEmergencia lancamentos={lancamentos} />
      )}

      {activeTab === 'Historico' && (
        <Historico 
          lancamentos={lancamentos} 
          setModalLanc={setModalLanc} 
          deleteLancamento={deleteLancamento} 
        />
      )}

      { activeTab === 'Conciliacao' && (
        <Conciliacao 
          lancamentos={lancamentos} 
          setModalLanc={setModalLanc} 
          updateLancamento={updateLancamento} 
        />
      )}

      { activeTab === 'Rateio' && (
        <RateioAgua lancamentos={lancamentos} />
      )}

      { activeTab === 'Fiscal' && (
        <EFDReinf lancamentos={lancamentos} />
      )}

      {/* Modais */}
      {modalLanc && <ModalLancamento data={modalLanc.id ? modalLanc : null} user={user} condominiosDisponiveis={uniqueCondos} filtroAtual={condoFilter} onClose={() => setModalLanc(null)} onSave={handleSaveLanc} />}
      {modalConta && <ModalConta data={modalConta.id ? modalConta : null} onClose={() => setModalConta(null)} onSave={handleSaveConta} />}
      <RepassesAlphaModal
        isOpen={showRepasses}
        onClose={() => setShowRepasses(false)}
        condominios={condominiosList}
        allBoletos={allBoletos}
        selectedCondoName={condoFilter !== 'Todos' ? condoFilter : ''}
      />
    </div>
  )
}
