import React, { useState, useEffect } from 'react'
import { Shield, Target, AlertTriangle, Save, Calculator, DollarSign, Wallet, ArrowRight, Wrench, CalendarCheck, Clock, Building2, Plus, CheckCircle2, ChevronRight } from 'lucide-react'
import { useFirestore } from '../../hooks/useFirestore'
import { CurrencyInput } from '../../utils/currency'
import { isAlphaInterno } from '../Financeiro'

export default function ReservaEmergencia({ lancamentos = [], condoFilter = 'Todos', condominiosDisponiveis = [], condominios = [], boletos = [], setModalLanc }) {
  const { items: configs, updateItem, addItem } = useFirestore('financeiro_config')
  const { items: allManutencoes } = useFirestore('manutencoes')
  
  const [selectedCondo, setSelectedCondo] = useState(condoFilter)
  const [saldoReal, setSaldoReal] = useState(0)
  const [editando, setEditando] = useState(false)
  const [inputSaldo, setInputSaldo] = useState('')
  const [mostrarDivisao, setMostrarDivisao] = useState(false)

  // Atualiza condomínio se o filtro do topo mudar
  useEffect(() => {
    setSelectedCondo(condoFilter)
  }, [condoFilter])

  const isAlpha = selectedCondo === 'Alpha (Interno)' || selectedCondo.toLowerCase().includes('alpha')
  const isTodos = selectedCondo === 'Todos'

  const normalizarNome = (nome) => {
    return String(nome || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/^(residencial|condominio|edificio|ed\.)\s+/i, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .trim()
      .toLowerCase()
  }

  const condoMatch = (c1, c2) => {
    if (!c1 || !c2) return false
    const n1 = normalizarNome(c1)
    const n2 = normalizarNome(c2)
    return n1 === n2 || n1.includes(n2) || n2.includes(n1)
  }

  // ID único para salvar o saldo do fundo de caixa por condomínio ou Alpha
  const configId = isAlpha 
    ? 'caixa_alpha' 
    : (isTodos ? 'caixa_geral' : `caixa_${selectedCondo.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`)

  const configDoc = configs.find(c => c.id === configId)

  useEffect(() => {
    if (configDoc && configDoc.saldo_real !== undefined) {
      setSaldoReal(Number(configDoc.saldo_real))
    } else {
      // Fallback 1: procura correspondência no financeiro_config
      const docAlt = configs.find(c => {
        const cid = (c.id || '').toLowerCase()
        const cNome = normalizarNome(selectedCondo)
        return cid.includes(cNome) || (c.condominio && condoMatch(c.condominio, selectedCondo))
      })
      if (docAlt && docAlt.saldo_real !== undefined) {
        setSaldoReal(Number(docAlt.saldo_real))
      } else {
        // Fallback 2: busca no cadastro do condomínio (ex: 1109.98 do Residencial Dália)
        if (isAlpha) {
          setSaldoReal(0)
        } else if (isTodos) {
          const somaFundos = condominios.reduce((acc, c) => acc + Number(c.fundoReserva || 0), 0)
          setSaldoReal(somaFundos)
        } else {
          const condoObj = condominios.find(c => condoMatch(c.nome, selectedCondo))
          if (condoObj && condoObj.fundoReserva !== undefined) {
            setSaldoReal(Number(condoObj.fundoReserva || 0))
          } else {
            setSaldoReal(0)
          }
        }
      }
    }
  }, [configDoc, configId, configs, condominios, selectedCondo, isAlpha, isTodos])

  const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  // Filtrar lançamentos da unidade selecionada
  const lFiltrados = lancamentos.filter(l => {
    if (isTodos) return true
    if (isAlpha) return isAlphaInterno(l.condominio)
    return l.condominio === selectedCondo || condoMatch(l.condominio, selectedCondo)
  })

  // Boletos vinculados
  const bFiltrados = boletos.filter(b => {
    if (b.status === 'Cancelado' || b.status === 'Excluído' || b.excluido || b.deletado) return false
    if (isTodos) return true
    if (isAlpha) return isAlphaInterno(b.condominio)
    return b.condominio === selectedCondo || condoMatch(b.condominio, selectedCondo)
  })

  // Total Geral de Receitas e Despesas do Caixa
  const totalReceitasFinPagas = lFiltrados.filter(l => l.tipo === 'Receita' && (l.status === 'Pago' || l.status === 'Recebido')).reduce((a, b) => a + Number(b.valor || 0), 0)
  const totalReceitasBolPagas = bFiltrados.filter(b => b.status === 'Pago').reduce((a, b) => a + Number(b.valor || 0), 0)
  const totalReceitasLiquidadas = totalReceitasFinPagas + totalReceitasBolPagas

  const totalDespesasPagas = lFiltrados.filter(l => l.tipo === 'Despesa' && (l.status === 'Pago' || l.status === 'Liquidado' || l.pago)).reduce((a, b) => a + Number(b.valor || 0), 0)
  
  // Saldo real dinâmico em caixa: base real + entradas pagas - contas pagas
  const saldoCaixaDinamico = saldoReal + totalReceitasLiquidadas - totalDespesasPagas

  const totalReceitas = lFiltrados.filter(l => l.tipo === 'Receita').reduce((a, b) => a + Number(b.valor || 0), 0) + bFiltrados.reduce((a, b) => a + Number(b.valor || 0), 0)
  const totalDespesas = lFiltrados.filter(l => l.tipo === 'Despesa').reduce((a, b) => a + Number(b.valor || 0), 0)
  const saldoOperacional = totalReceitas - totalDespesas

  // 1. SEPARAÇÃO: MANUTENÇÃO PREVENTIVA
  const lancamentosPreventivas = lFiltrados.filter(l => {
    const cat = (l.categoria || '').toLowerCase()
    const desc = (l.descricao || '').toLowerCase()
    return (cat.includes('preventiv') || desc.includes('preventiv')) && !cat.includes('visita') && !desc.includes('visita')
  })
  const totalPreventivas = lancamentosPreventivas.reduce((a, b) => a + Number(b.valor || 0), 0)

  // 2. SEPARAÇÃO: VISITA TÉCNICA
  const lancamentosVisitas = lFiltrados.filter(l => {
    const cat = (l.categoria || '').toLowerCase()
    const desc = (l.descricao || '').toLowerCase()
    return cat.includes('visita') || desc.includes('visita') || cat.includes('vistoria') || desc.includes('vistoria') || cat.includes('inspe') || desc.includes('inspe')
  })
  const totalVisitas = lancamentosVisitas.reduce((a, b) => a + Number(b.valor || 0), 0)

  // 3. DEMAIS DESPESAS OPERACIONAIS (Sem misturar)
  const demaisDespesas = lFiltrados.filter(l => {
    if (l.tipo !== 'Despesa') return false
    const cat = (l.categoria || '').toLowerCase()
    const desc = (l.descricao || '').toLowerCase()
    const ehPrev = (cat.includes('preventiv') || desc.includes('preventiv')) && !cat.includes('visita') && !desc.includes('visita')
    const ehVisita = cat.includes('visita') || desc.includes('visita') || cat.includes('vistoria') || desc.includes('vistoria') || cat.includes('inspe') || desc.includes('inspe')
    return !ehPrev && !ehVisita
  })
  const totalDemaisDespesas = demaisDespesas.reduce((a, b) => a + Number(b.valor || 0), 0)

  // Manutenções Agendadas do Módulo Manutenções
  const manutencoesDoCondo = allManutencoes.filter(m => {
    if (isTodos) return true
    if (isAlpha) return isAlphaInterno(m.condominio)
    return m.condominio === selectedCondo
  })
  const cronogramaPreventivas = manutencoesDoCondo.filter(m => (m.tipo || '').includes('Preventiva') || (!m.tipo && !(m.titulo || '').toLowerCase().includes('visita')))
  const cronogramaVisitas = manutencoesDoCondo.filter(m => (m.tipo || '').includes('Visita') || (m.titulo || '').toLowerCase().includes('visita') || (m.titulo || '').toLowerCase().includes('vistoria'))

  // Divisão de Lucro da Alpha (apenas para a Alpha)
  const cotaParte = saldoOperacional > 0 ? saldoOperacional / 4 : 0

  const salvarSaldo = async () => {
    const val = typeof inputSaldo === 'number' ? inputSaldo : (Number(String(inputSaldo).replace(/\./g, '').replace(',', '.')) || 0)
    if (val >= 0) {
      if (configDoc) {
        await updateItem(configId, { saldo_real: val })
      } else {
        await addItem({ id: configId, saldo_real: val })
      }
      setSaldoReal(val)
      setEditando(false)
    }
  }

  const condoLabelExibicao = isAlpha 
    ? 'Alpha Soluções (Financeiro Interno)' 
    : (isTodos ? 'Visão Consolidada (Todos os Condomínios)' : selectedCondo)

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-6xl mx-auto pb-8">
      {/* Top Header & Seletor de Residência */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-pale-300 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-700 font-bold"><Shield size={20}/></span>
            <div>
              <h3 className="text-xl font-black text-gray-900">Fundo de Caixa &amp; Gestão de Reservas</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Patrimônio acumulado, controle de manutenções preventivas e visitas técnicas
              </p>
            </div>
          </div>
        </div>

        {/* Seletor Rápido de Residência / Alpha */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select 
            value={selectedCondo} 
            onChange={e => setSelectedCondo(e.target.value)}
            className="input py-2 text-xs font-black bg-amber-50/90 border-amber-300 text-gray-900 w-full sm:w-auto"
          >
            <option value="Alpha (Interno)">👑 Alpha Soluções (Financeiro Interno)</option>
            <option value="Todos">🌐 Todos os Condomínios (Geral)</option>
            <optgroup label="Condomínios Clientes">
              {condominiosDisponiveis.map(c => <option key={c} value={c}>🏢 {c}</option>)}
            </optgroup>
          </select>
          {!editando && (
            <button onClick={() => { setInputSaldo(saldoReal); setEditando(true) }} className="btn-secondary text-xs py-2 px-3 whitespace-nowrap">
              Atualizar Saldo
            </button>
          )}
        </div>
      </div>

      {/* Saldo Real do Fundo de Caixa Selecionado */}
      <div className={`card text-center py-8 border-0 shadow-lg relative overflow-hidden text-white ${
        isAlpha 
          ? 'bg-gradient-to-br from-brand-700 via-brand-800 to-slate-900' 
          : 'bg-gradient-to-br from-indigo-700 via-indigo-800 to-slate-900'
      }`}>
        <div className="absolute top-0 right-0 p-8 opacity-10"><Shield size={130} /></div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white/90 text-xs font-bold uppercase tracking-wider mb-2">
          <Building2 size={13} /> {condoLabelExibicao}
        </div>
        <h4 className="text-brand-100 uppercase tracking-widest text-xs font-bold mb-4 relative z-10">
          Saldo Atual do Fundo de Caixa / Reserva
        </h4>
        {editando ? (
          <div className="flex justify-center items-center gap-2 max-w-sm mx-auto relative z-10">
            <CurrencyInput className="text-center text-xl font-bold text-gray-800" value={inputSaldo} onChange={v => setInputSaldo(v)} autoFocus />
            <button onClick={salvarSaldo} className="btn-primary bg-white text-brand-700 hover:bg-cream-100 flex items-center gap-2"><Save size={16}/> Salvar</button>
            <button onClick={() => setEditando(false)} className="px-3 py-2 text-xs bg-white/20 text-white rounded-lg hover:bg-white/30">Cancelar</button>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-center gap-3 text-4xl sm:text-5xl font-black text-white relative z-10">
              R$ {fmt(saldoCaixaDinamico)}
            </div>
            {saldoReal > 0 && (
              <p className="text-xs text-white/80 mt-1 relative z-10 font-medium">
                Saldo Base / Reserva Cadastrada: <b>R$ {fmt(saldoReal)}</b>
                {totalReceitasLiquidadas > 0 ? ` + R$ ${fmt(totalReceitasLiquidadas)} (receitas/boletos pagos)` : ''}
                {totalDespesasPagas > 0 ? ` - R$ ${fmt(totalDespesasPagas)} (despesas pagas)` : ''}
              </p>
            )}
          </div>
        )}
        <p className="text-xs text-brand-200/90 mt-3 relative z-10">
          {isAlpha ? 'Patrimônio acumulado no caixa da Alpha Gestão.' : `Reserva financeira acumulada para emergências e obras do condomínio ${selectedCondo}.`}
        </p>
      </div>

      {/* Resumo do Caixa em 3 Colunas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card border-l-4 border-emerald-500 bg-white shadow-sm p-4">
          <p className="text-xs text-gray-500 font-bold uppercase">Entradas / Receitas</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">R$ {fmt(totalReceitas)}</p>
          <p className="text-[11px] text-gray-400 mt-1">Total de receitas vinculadas</p>
        </div>
        
        <div className="card border-l-4 border-rose-500 bg-white shadow-sm p-4">
          <p className="text-xs text-gray-500 font-bold uppercase">Saídas / Despesas Totais</p>
          <p className="text-2xl font-black text-rose-600 mt-1">R$ {fmt(totalDespesas)}</p>
          <p className="text-[11px] text-gray-400 mt-1">Despesas pagas e pendentes</p>
        </div>

        <div className={`card border-l-4 ${saldoOperacional >= 0 ? 'border-brand-500 bg-brand-50/50' : 'border-amber-500 bg-amber-50/50'} shadow-sm p-4`}>
          <p className="text-xs text-gray-700 font-bold uppercase">Resultado Operacional</p>
          <p className={`text-2xl font-black mt-1 ${saldoOperacional >= 0 ? 'text-brand-700' : 'text-amber-700'}`}>
            R$ {fmt(saldoOperacional)}
          </p>
          <p className="text-[11px] text-gray-500 mt-1">Balanço líquido das movimentações</p>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* SEÇÃO 1: MANUTENÇÃO PREVENTIVA (SEPARADA)                 */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border-2 border-amber-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
              <Wrench size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-black text-gray-900 text-base">Manutenções Preventivas</h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-900 uppercase">
                  {lancamentosPreventivas.length} lançamentos • {cronogramaPreventivas.length} agendamentos
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Custos e cronograma de conservação periódica (bombas, caixa d'água, elevadores, extintores)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center">
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-gray-500 block">Total Preventiva</span>
              <span className="text-lg font-black text-amber-800">R$ {fmt(totalPreventivas)}</span>
            </div>
            {setModalLanc && (
              <button 
                onClick={() => setModalLanc({ tipo: 'Despesa', status: 'Pendente', categoria: 'Manutenção Preventiva', condominio: selectedCondo !== 'Todos' ? selectedCondo : 'Alpha (Interno)', data: new Date().toISOString().split('T')[0] })}
                className="btn-primary py-1.5 px-3 text-xs bg-amber-600 hover:bg-amber-500 flex items-center gap-1 cursor-pointer"
              >
                <Plus size={14} /> Lançar Preventiva
              </button>
            )}
          </div>
        </div>

        <div className="p-4">
          {lancamentosPreventivas.length === 0 && cronogramaPreventivas.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-xs bg-slate-50 rounded-xl border border-dashed border-gray-200">
              Nenhuma manutenção preventiva registrada para {condoLabelExibicao}.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {lancamentosPreventivas.map(item => (
                <div key={item.id} className="p-3.5 rounded-xl border border-amber-200/80 bg-amber-50/30 flex items-center justify-between hover:bg-amber-50/60 transition-all">
                  <div className="min-w-0 pr-3">
                    <p className="font-bold text-gray-800 text-xs truncate">{item.descricao}</p>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500">
                      <span>📅 {item.data?.split('-').reverse().join('/') || '—'}</span>
                      <span>•</span>
                      <span className={`font-bold ${item.status === 'Pago' ? 'text-emerald-600' : 'text-amber-700'}`}>
                        {item.status || 'Pendente'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-black text-sm text-gray-900">R$ {fmt(item.valor)}</span>
                    {setModalLanc && (
                      <button onClick={() => setModalLanc(item)} className="block text-[10px] text-brand-600 font-bold hover:underline mt-0.5 ml-auto cursor-pointer">
                        Editar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* SEÇÃO 2: VISITAS TÉCNICAS (SEPARADA)                      */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border-2 border-purple-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-sm">
              <CalendarCheck size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-black text-gray-900 text-base">Visitas Técnicas &amp; Vistorias</h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-200 text-purple-900 uppercase">
                  {lancamentosVisitas.length} lançamentos • {cronogramaVisitas.length} agendamentos
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Custos e vistorias presenciais de engenharia, inspeções de segurança e visitas especializadas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center">
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-gray-500 block">Total Visitas</span>
              <span className="text-lg font-black text-purple-800">R$ {fmt(totalVisitas)}</span>
            </div>
            {setModalLanc && (
              <button 
                onClick={() => setModalLanc({ tipo: 'Despesa', status: 'Pendente', categoria: 'Visita Técnica', condominio: selectedCondo !== 'Todos' ? selectedCondo : 'Alpha (Interno)', data: new Date().toISOString().split('T')[0] })}
                className="btn-primary py-1.5 px-3 text-xs bg-purple-600 hover:bg-purple-500 flex items-center gap-1 cursor-pointer"
              >
                <Plus size={14} /> Lançar Visita Técnica
              </button>
            )}
          </div>
        </div>

        <div className="p-4">
          {lancamentosVisitas.length === 0 && cronogramaVisitas.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-xs bg-slate-50 rounded-xl border border-dashed border-gray-200">
              Nenhuma visita técnica registrada para {condoLabelExibicao}.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {lancamentosVisitas.map(item => (
                <div key={item.id} className="p-3.5 rounded-xl border border-purple-200/80 bg-purple-50/30 flex items-center justify-between hover:bg-purple-50/60 transition-all">
                  <div className="min-w-0 pr-3">
                    <p className="font-bold text-gray-800 text-xs truncate">{item.descricao}</p>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500">
                      <span>📅 {item.data?.split('-').reverse().join('/') || '—'}</span>
                      <span>•</span>
                      <span className={`font-bold ${item.status === 'Pago' ? 'text-emerald-600' : 'text-purple-700'}`}>
                        {item.status || 'Pendente'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-black text-sm text-gray-900">R$ {fmt(item.valor)}</span>
                    {setModalLanc && (
                      <button onClick={() => setModalLanc(item)} className="block text-[10px] text-purple-600 font-bold hover:underline mt-0.5 ml-auto cursor-pointer">
                        Editar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* SEÇÃO 3: DEMAIS DESPESAS OPERACIONAIS                     */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
          <div>
            <h4 className="font-bold text-gray-800 text-sm">Demais Despesas &amp; Movimentações Operacionais</h4>
            <p className="text-[11px] text-gray-400">Honorários, tributos, tarifas e outras despesas regulares</p>
          </div>
          <span className="text-xs font-black text-gray-700">R$ {fmt(totalDemaisDespesas)}</span>
        </div>

        {demaisDespesas.length === 0 ? (
          <p className="text-xs text-gray-400 py-3 text-center">Nenhuma outra despesa registrada.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {demaisDespesas.slice(0, 9).map(d => (
              <div key={d.id} className="p-2.5 rounded-xl border border-gray-200 bg-slate-50/50 flex items-center justify-between text-xs">
                <div className="min-w-0 pr-2">
                  <p className="font-semibold text-gray-800 truncate">{d.descricao}</p>
                  <span className="text-[10px] text-gray-400">{d.categoria || 'Geral'}</span>
                </div>
                <span className="font-black text-gray-900 whitespace-nowrap">R$ {fmt(d.valor)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* DISTRIBUIÇÃO DE LUCROS DA ALPHA (EXCLUSIVO DA ALPHA)       */}
      {/* ────────────────────────────────────────────────────────── */}
      {isAlpha && (
        <div className="card bg-purple-50/40 border border-purple-200">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h4 className="font-bold text-gray-800 flex items-center gap-2"><Calculator size={18} className="text-purple-600"/> Distribuição de Lucros (Alpha)</h4>
              <p className="text-xs text-gray-500 mt-1">Divisão do Lucro Líquido em 4 partes (Sócias + Fundo de Caixa da Alpha).</p>
            </div>
            <button onClick={() => setMostrarDivisao(!mostrarDivisao)} className="btn-primary bg-purple-600 hover:bg-purple-700 shadow-purple-500/30 text-xs py-2 px-3">
              {mostrarDivisao ? 'Ocultar Simulação' : 'Simular Divisão'}
            </button>
          </div>

          {mostrarDivisao && (
            <div className="animate-fade-in">
              {saldoOperacional <= 0 ? (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl text-center text-sm font-semibold flex items-center justify-center gap-2">
                  <AlertTriangle size={18} /> Não há lucro líquido para distribuir neste momento.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { nome: 'Sócia 1', icon: '👩🏻‍💼', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
                    { nome: 'Sócia 2', icon: '👩🏼‍💼', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
                    { nome: 'Sócia 3', icon: '👩🏽‍💼', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
                    { nome: 'Fundo Alpha (Caixa)', icon: '🏢', color: 'text-brand-700', bg: 'bg-brand-50', border: 'border-brand-200' },
                  ].map((s, i) => (
                    <div key={i} className={`border ${s.border} ${s.bg} rounded-xl p-4 text-center relative overflow-hidden group`}>
                      <div className="text-3xl mb-2">{s.icon}</div>
                      <p className={`text-sm font-bold ${s.color} mb-1`}>{s.nome}</p>
                      <p className={`text-xl font-black ${s.color}`}>R$ {fmt(cotaParte)}</p>
                      <div className="text-[10px] uppercase font-bold text-gray-400 mt-3 tracking-widest">25% da cota</div>
                      
                      {s.nome === 'Fundo Alpha (Caixa)' && (
                        <div className="absolute inset-0 bg-brand-600 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity p-4 cursor-pointer" onClick={() => {
                          setInputSaldo(saldoReal + cotaParte)
                          setEditando(true)
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}>
                          <ArrowRight size={24} className="mb-2" />
                          <span className="text-xs font-bold text-center">Adicionar ao Saldo Real</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  )
}

