import React, { useState, useEffect, useRef } from 'react'
import { Calculator, Download, Settings, Building, MapPin, Users, Briefcase, FileText } from 'lucide-react'

export default function Calculadora() {
  const [unidades, setUnidades] = useState(50)
  const [nomeCondominio, setNomeCondominio] = useState('')
  const [endereco, setEndereco] = useState('')
  
  // Parâmetros Administrativos (Editáveis)
  const [custoAte40, setCustoAte40] = useState(30.00)
  const [custo41a100, setCusto41a100] = useState(27.50)
  const [custoAcima100, setCustoAcima100] = useState(25.00)
  const [pisoAdm, setPisoAdm] = useState(800.00)
  
  // Multiplicadores
  const [fatorBairro, setFatorBairro] = useState(1.0) // 1.0 = normal, 1.2 = nobre
  const [fatorPadrao, setFatorPadrao] = useState(1.0) // 1.0 = normal, 1.3 = alto padrão
  
  // Sindicatura (Editáveis)
  const [incluirSindico, setIncluirSindico] = useState(true)
  const [sindicoBase, setSindicoBase] = useState(1500.00)
  const [sindicoPorUnidade, setSindicoPorUnidade] = useState(12.00)
  const [fatorVisitas, setFatorVisitas] = useState(1.0) // 1.0 = 1x semana
  
  // Implantação
  const [valorImplantacao, setValorImplantacao] = useState(1500.00)
  
  // Totais Calculados
  const [totalAdm, setTotalAdm] = useState(0)
  const [totalSindico, setTotalSindico] = useState(0)
  const [totalMensal, setTotalMensal] = useState(0)

  useEffect(() => {
    // 1. Cálculo da Administração
    let custoUnitario = 0
    if (unidades <= 40) custoUnitario = custoAte40
    else if (unidades <= 100) custoUnitario = custo41a100
    else custoUnitario = custoAcima100

    let baseAdm = unidades * custoUnitario
    let calcAdm = baseAdm * fatorBairro * fatorPadrao
    
    if (calcAdm < pisoAdm) calcAdm = pisoAdm
    setTotalAdm(calcAdm)

    // 2. Cálculo Sindicatura
    let calcSindico = 0
    if (incluirSindico) {
      calcSindico = (sindicoBase + (unidades * sindicoPorUnidade)) * fatorPadrao * fatorVisitas
    }
    setTotalSindico(calcSindico)

    // 3. Total Mensal
    setTotalMensal(calcAdm + calcSindico)
  }, [unidades, custoAte40, custo41a100, custoAcima100, pisoAdm, fatorBairro, fatorPadrao, incluirSindico, sindicoBase, sindicoPorUnidade, fatorVisitas])

  const handlePrint = () => {
    window.print()
  }

  const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  return (
    <div className="flex flex-col gap-6 animate-fade-in print-container">
      {/* Estilos para Impressão */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 2cm; background: white; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="page-header no-print">
        <div>
          <h2 className="section-title text-xl flex items-center gap-2"><Calculator className="text-brand-600"/> Simulador de Orçamentos</h2>
          <p className="section-sub">Calcule propostas para novos condomínios com base em parâmetros dinâmicos.</p>
        </div>
        <button onClick={handlePrint} className="btn-primary"><Download size={16}/> Gerar PDF / Imprimir Proposta</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print">
        {/* COLUNA 1: Parâmetros do Condomínio */}
        <div className="flex flex-col gap-6">
          <div className="card">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 border-b border-cream-200 pb-2">
              <Building size={18} className="text-brand-500"/> Dados do Condomínio
            </h3>
            <div className="space-y-4">
              <div><label className="label">Nome do Condomínio</label><input className="input" placeholder="Residencial Alpha" value={nomeCondominio} onChange={e=>setNomeCondominio(e.target.value)}/></div>
              <div><label className="label">Endereço / Bairro</label><input className="input" placeholder="Rua das Flores, 123" value={endereco} onChange={e=>setEndereco(e.target.value)}/></div>
              <div><label className="label">Quantidade de Unidades (N)</label><input type="number" className="input text-lg font-bold text-brand-700" value={unidades} onChange={e=>setUnidades(Number(e.target.value))}/></div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Padrão do Imóvel</label>
                  <select className="input" value={fatorPadrao} onChange={e=>setFatorPadrao(Number(e.target.value))}>
                    <option value={1.0}>Normal / Econômico</option>
                    <option value={1.15}>Médio Padrão (+15%)</option>
                    <option value={1.30}>Alto Padrão (+30%)</option>
                    <option value={1.50}>Luxo (+50%)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Localização/Risco</label>
                  <select className="input" value={fatorBairro} onChange={e=>setFatorBairro(Number(e.target.value))}>
                    <option value={1.0}>Padrão (1x)</option>
                    <option value={1.1}>Área Nobre (+10%)</option>
                    <option value={1.2}>Complexo (+20%)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          
          <div className="card">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 border-b border-cream-200 pb-2">
              <Settings size={18} className="text-gray-500"/> Implantação
            </h3>
            <div>
              <label className="label">Taxa Única de Implantação (R$)</label>
              <input type="number" className="input" value={valorImplantacao} onChange={e=>setValorImplantacao(Number(e.target.value))}/>
              <p className="text-xs text-gray-500 mt-1">Custo inicial de configuração do condomínio.</p>
            </div>
          </div>
        </div>

        {/* COLUNA 2: Configurações de Valores (Motor) */}
        <div className="flex flex-col gap-6">
          <div className="card border-l-4 border-l-blue-500">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 border-b border-cream-200 pb-2">
              <Briefcase size={18} className="text-blue-500"/> Base: Gestão Administrativa
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center"><label className="text-sm font-medium text-gray-600">Até 40 unid. (R$/unid)</label><input type="number" className="input w-24 text-right" value={custoAte40} onChange={e=>setCustoAte40(Number(e.target.value))}/></div>
              <div className="flex justify-between items-center"><label className="text-sm font-medium text-gray-600">De 41 a 100 (R$/unid)</label><input type="number" className="input w-24 text-right" value={custo41a100} onChange={e=>setCusto41a100(Number(e.target.value))}/></div>
              <div className="flex justify-between items-center"><label className="text-sm font-medium text-gray-600">Acima de 100 (R$/unid)</label><input type="number" className="input w-24 text-right" value={custoAcima100} onChange={e=>setCustoAcima100(Number(e.target.value))}/></div>
              <div className="flex justify-between items-center pt-3 border-t border-dashed border-gray-200"><label className="text-sm font-bold text-gray-700">Piso Mínimo Obrigatório</label><input type="number" className="input w-24 text-right border-blue-300 bg-blue-50" value={pisoAdm} onChange={e=>setPisoAdm(Number(e.target.value))}/></div>
            </div>
          </div>

          <div className="card border-l-4 border-l-purple-500">
            <div className="flex justify-between items-center mb-4 border-b border-cream-200 pb-2">
              <h3 className="font-bold text-gray-800 flex items-center gap-2"><Users size={18} className="text-purple-500"/> Sindicatura Profissional</h3>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={incluirSindico} onChange={e=>setIncluirSindico(e.target.checked)}/>
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
              </label>
            </div>
            
            {incluirSindico ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center"><label className="text-sm font-medium text-gray-600">Remuneração Base Fixa</label><input type="number" className="input w-28 text-right" value={sindicoBase} onChange={e=>setSindicoBase(Number(e.target.value))}/></div>
                <div className="flex justify-between items-center"><label className="text-sm font-medium text-gray-600">Adicional por Unidade</label><input type="number" className="input w-28 text-right" value={sindicoPorUnidade} onChange={e=>setSindicoPorUnidade(Number(e.target.value))}/></div>
                <div className="pt-3 border-t border-dashed border-gray-200">
                  <label className="label">Frequência de Visitas Presenciais</label>
                  <select className="input" value={fatorVisitas} onChange={e=>setFatorVisitas(Number(e.target.value))}>
                    <option value={0.8}>Apenas Online / Sob Demanda (-20%)</option>
                    <option value={1.0}>1x na Semana (Normal)</option>
                    <option value={1.3}>2x na Semana (+30%)</option>
                    <option value={1.5}>3x na Semana (+50%)</option>
                  </select>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">Módulo de Sindicatura Desativado</p>
            )}
          </div>
        </div>

        {/* COLUNA 3: Resultados */}
        <div className="flex flex-col gap-6">
          <div className="card bg-slate-900 text-white border-0 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10"><Calculator size={100}/></div>
            <h3 className="font-bold text-slate-300 mb-6 uppercase tracking-wider text-sm relative z-10">Resumo do Orçamento</h3>
            
            <div className="space-y-4 relative z-10">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-xs text-slate-400">Gestão Administrativa</p>
                  <p className="text-2xl font-light">{formatBRL(totalAdm)}<span className="text-xs text-slate-500 ml-1">/mês</span></p>
                </div>
              </div>
              
              {incluirSindico && (
                <div className="flex justify-between items-end border-t border-slate-700 pt-4">
                  <div>
                    <p className="text-xs text-purple-300">Sindicatura Profissional</p>
                    <p className="text-2xl font-light text-purple-100">{formatBRL(totalSindico)}<span className="text-xs text-purple-400/50 ml-1">/mês</span></p>
                  </div>
                </div>
              )}
              
              <div className="flex justify-between items-end border-t border-slate-700 pt-4">
                <div>
                  <p className="text-xs text-brand-300 font-bold">TOTAL MENSAL</p>
                  <p className="text-4xl font-black text-brand-400">{formatBRL(totalMensal)}</p>
                </div>
              </div>

              <div className="flex justify-between items-end border-t border-slate-700 pt-4 mt-4">
                <div>
                  <p className="text-xs text-slate-400">Implantação (Taxa Única)</p>
                  <p className="text-lg font-medium">{formatBRL(valorImplantacao)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ÁREA DE IMPRESSÃO (Fica oculta na tela, aparece no PDF) */}
      <div className="hidden print-area bg-white text-gray-900 min-h-screen">
        <div className="flex items-center justify-between border-b-2 border-brand-800 pb-6 mb-8">
          <img src="/logo.png" alt="Alpha Soluções" className="h-16 object-contain" />
          <div className="text-right">
            <h1 className="text-2xl font-black text-brand-900 tracking-tight">PROPOSTA COMERCIAL</h1>
            <p className="text-sm text-gray-500 mt-1">Data: {new Date().toLocaleDateString('pt-BR')}</p>
          </div>
        </div>

        <div className="mb-10">
          <h2 className="text-lg font-bold text-gray-800 mb-2 uppercase border-l-4 border-brand-500 pl-3">Apresentação</h2>
          <p className="text-gray-600 leading-relaxed text-justify">
            A <strong>Alpha Soluções Condominiais</strong> apresenta esta proposta de prestação de serviços para o <strong>{nomeCondominio || 'Condomínio'}</strong>, 
            localizado em {endereco || '(Endereço não informado)'}. Nosso objetivo é garantir a máxima eficiência, transparência e segurança na gestão do seu patrimônio.
          </p>
        </div>

        <div className="mb-10">
          <h2 className="text-lg font-bold text-gray-800 mb-4 uppercase border-l-4 border-brand-500 pl-3">Perfil do Condomínio</h2>
          <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div><span className="text-gray-500 text-sm block">Quantidade de Unidades</span><span className="font-bold">{unidades} apartamentos/salas</span></div>
            <div><span className="text-gray-500 text-sm block">Padrão Considerado</span><span className="font-bold">{fatorPadrao === 1 ? 'Padrão Normal' : fatorPadrao === 1.15 ? 'Médio Padrão' : fatorPadrao === 1.3 ? 'Alto Padrão' : 'Luxo'}</span></div>
          </div>
        </div>

        <div className="mb-10">
          <h2 className="text-lg font-bold text-gray-800 mb-4 uppercase border-l-4 border-brand-500 pl-3">Investimento Mensal</h2>
          
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-brand-900 text-white">
                <th className="p-3 font-bold text-sm">Descrição dos Serviços</th>
                <th className="p-3 font-bold text-sm text-right w-40">Valor (R$)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="p-4">
                  <p className="font-bold text-gray-800">Gestão Administrativa e Financeira</p>
                  <p className="text-xs text-gray-500 mt-1">Emissão de boletos, cobrança amigável, gestão de contas a pagar, conciliação bancária, atendimento aos moradores (App Alpha) e prestação de contas digital.</p>
                </td>
                <td className="p-4 text-right font-medium">{formatBRL(totalAdm)}</td>
              </tr>
              {incluirSindico && (
                <tr className="border-b border-gray-200">
                  <td className="p-4">
                    <p className="font-bold text-gray-800">Sindicatura Profissional</p>
                    <p className="text-xs text-gray-500 mt-1">Representação legal (civil e criminal), vistorias presenciais ({fatorVisitas === 1 ? '1x' : fatorVisitas === 1.3 ? '2x' : fatorVisitas === 1.5 ? '3x' : 'sob demanda'} na semana), gestão de contratos, mediação de conflitos e planejamento preventivo.</p>
                  </td>
                  <td className="p-4 text-right font-medium">{formatBRL(totalSindico)}</td>
                </tr>
              )}
              <tr className="bg-brand-50">
                <td className="p-4 font-black text-brand-900 text-right uppercase text-sm">Total Mensal</td>
                <td className="p-4 text-right font-black text-brand-900 text-xl">{formatBRL(totalMensal)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {valorImplantacao > 0 && (
          <div className="mb-10">
            <h2 className="text-lg font-bold text-gray-800 mb-4 uppercase border-l-4 border-brand-500 pl-3">Taxa de Implantação</h2>
            <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div>
                <p className="font-bold text-gray-800">Setup Inicial e Onboarding</p>
                <p className="text-xs text-gray-500 mt-1">Cadastramento de moradores, auditoria inicial, configuração do aplicativo Alpha e migração de dados.</p>
              </div>
              <p className="font-bold text-gray-900 text-lg">{formatBRL(valorImplantacao)}</p>
            </div>
            <p className="text-xs text-gray-400 mt-2 italic">* Cobrado uma única vez no início do contrato.</p>
          </div>
        )}

        <div className="mt-20 pt-10 border-t border-gray-300 text-center">
          <p className="font-bold text-gray-800">Alpha Soluções Condominiais</p>
          <p className="text-sm text-gray-500">Transformando a gestão do seu condomínio com tecnologia e transparência.</p>
        </div>
      </div>
    </div>
  )
}
