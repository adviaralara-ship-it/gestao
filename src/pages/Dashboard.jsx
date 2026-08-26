import React, { useState, useMemo } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'
import { TrendingUp, TrendingDown, Users, Building2, AlertTriangle, CalendarCheck, CreditCard, DollarSign, Smartphone, LogIn, LogOut, FileText, Bell, Clock, DoorOpen, Bot, Shield } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useFirestore } from '../hooks/useFirestore'
import { Link, useNavigate } from 'react-router-dom'
import { Video, Receipt, Package, Car } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

function StatCard({ label, value, sub, icon: Icon, trend, color }) {
  return (
    <div className="stat-card group hover:border-brand-700/50 transition-all cursor-default">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}><Icon size={18} className="text-white"/></div>
        {trend!==undefined&&(
          <span className={`flex items-center gap-1 text-xs font-semibold ${trend>=0?'text-emerald-400':'text-red-400'}`}>
            {trend>=0?<TrendingUp size={12}/>:<TrendingDown size={12}/>}{Math.abs(trend)}%
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-black text-gray-800">{value}</p>
        <p className="text-sm font-semibold text-gray-600">{label}</p>
        {sub&&<p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active&&payload&&payload.length) return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-xs shadow-xl">
      <p className="font-bold text-white mb-1">{label}</p>
      {payload.map((p,i)=><p key={i} style={{color:p.color}}>{p.name}: R$ {p.value.toLocaleString('pt-BR')}</p>)}
    </div>
  )
  return null
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [waConectado, setWaConectado] = useState(false)

  // Dados reais do Firestore
  const { items: moradores }    = useFirestore('moradores')
  const { items: ocorrencias }  = useFirestore('ocorrencias')
  const { items: visitantes }   = useFirestore('portaria_visitantes')
  const { items: reservas }     = useFirestore('reservas')
  const { items: boletos }      = useFirestore('boletos')
  const { items: encomendas }   = useFirestore('encomendas')
  const { items: financeiro }   = useFirestore('financeiro_lancamentos')
  const { items: notificacoes } = useFirestore('notificacoes')
  const { items: assembleias }  = useFirestore('assembleias')
  const { items: apolices }  = useFirestore('apolices')
  const { items: condominios }  = useFirestore('condominios')

  const getSafeDate = val => {
    if (!val) return new Date()
    if (val.seconds) return new Date(val.seconds*1000)
    if (typeof val==='string'&&val.includes('/')) {
      const p=val.split('/'); if(p.length===3){const d=new Date(`${p[2]}-${p[1]}-${p[0]}T12:00:00`);if(!isNaN(d.getTime()))return d}
    }
    const d=new Date(val); return isNaN(d.getTime())?new Date():d
  }

  // Stats derivados
  const totalMoradores   = moradores.length
  const visNoLocal       = visitantes.filter(v=>v.status==='No local').length
  const ocPendentes      = ocorrencias.filter(o=>o.status!=='Resolvida').length
  const boletosPendentes = boletos.filter(b=>b.status==='Pendente').length
  const boletosVencidos  = boletos.filter(b=>b.status==='Vencido').length

  const reservasFuturas = reservas.filter(r=>{
    if(!r.data) return false
    const d=getSafeDate(r.data); d.setHours(23,59,59)
    return d.getTime()>=Date.now()
  }).length

  
  const roboAlertas = useMemo(() => {
    const alertas = []
    const hoje = new Date()
    hoje.setHours(0,0,0,0)

    apolices.forEach(a => {
      if(a.vigencia_fim && a.status !== 'Cancelada') {
        const fim = new Date(a.vigencia_fim + 'T12:00:00Z')
        const diff = Math.ceil((fim - hoje) / (1000 * 60 * 60 * 24))
        if (diff <= 30 && diff >= -30) {
          alertas.push({ id: a.id, tipo: 'Seguro/Apólice', desc: a.seguradora, dias: diff, icon: Shield, color: diff < 0 ? 'text-red-500 bg-red-50 border-red-100' : 'text-orange-500 bg-orange-50 border-orange-100' })
        }
      }
    })

    condominios.forEach(c => {
      if(c.mandatoFim && c.status === 'Ativo') {
        const fim = new Date(c.mandatoFim + 'T12:00:00Z')
        const diff = Math.ceil((fim - hoje) / (1000 * 60 * 60 * 24))
        if (diff <= 30 && diff >= -30) {
          alertas.push({ id: c.id, tipo: 'Fim de Mandato', desc: `${c.sindico} (${c.nome})`, dias: diff, icon: Users, color: diff < 0 ? 'text-red-500 bg-red-50 border-red-100' : 'text-orange-500 bg-orange-50 border-orange-100' })
        }
      }
    })

    return alertas.sort((a,b) => a.dias - b.dias)
  }, [apolices, condominios])

  const visRecentes = [...visitantes]
    .sort((a,b)=>getSafeDate(b._createdAt).getTime()-getSafeDate(a._createdAt).getTime())
    .slice(0,5)

  const { user } = useAuth()
  
  // Filtrar notificações
  const minhasNotificacoes = notificacoes.filter(n => {
    if (user?.role === 'Administrador' || user?.role === 'Financeiro') return true
    if (['Síndico', 'Subsíndico', 'Conselheiro'].includes(user?.role)) return !n.condominio || n.condominio === user?.condominio
    // Para morador
    if (!n.destino || n.destino === 'Todos' || n.destino === 'Moradores') return true
    if (n.destino === 'Individual' && n.moradorEmail === user?.email) return true
    return false
  })

  // Atividades recentes das notificações reais
  const atividadesRecentes = [...minhasNotificacoes]
    .sort((a,b)=>new Date(b.time||b._createdAt?.seconds*1000||0)-new Date(a.time||a._createdAt?.seconds*1000||0))
    .slice(0,6)

  // Lógica financeira (Mesclando Financeiro + Boletos)
  const { balancoGeral, chartData, adimplenciaData, mesAtualData } = useMemo(()=>{
    let recGlobal=0,desGlobal=0,recPaga=0,recPendente=0
    let recMes=0, desMes=0
    const hist={}

    const hoje = new Date()
    const currentMesKey = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}`

    // Processar Financeiro
    financeiro.forEach(f=>{
      const v=Number(f.valor)||0
      const d=getSafeDate(f.data||f._createdAt)
      const mesKey=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
      const mesAbrev=d.toLocaleDateString('pt-BR',{month:'short',timeZone:'UTC'})
      if(!hist[mesKey]) hist[mesKey]={sortKey:mesKey,mes:mesAbrev,receitas:0,despesas:0}
      if(f.tipo==='Despesa'){
        desGlobal+=v; hist[mesKey].despesas+=v
        if (mesKey === currentMesKey) desMes+=v
      }
      else{
        recGlobal+=v; hist[mesKey].receitas+=v
        if (mesKey === currentMesKey) recMes+=v
        if(f.status==='Pago')recPaga+=v;else recPendente+=v
      }
    })

    // Processar Boletos como Receitas
    boletos.forEach(b=>{
      const v=Number(b.valor)||0
      const d=getSafeDate(b.vencimento||b._createdAt)
      const mesKey=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
      const mesAbrev=d.toLocaleDateString('pt-BR',{month:'short',timeZone:'UTC'})
      if(!hist[mesKey]) hist[mesKey]={sortKey:mesKey,mes:mesAbrev,receitas:0,despesas:0}
      
      recGlobal+=v
      hist[mesKey].receitas+=v
      if (mesKey === currentMesKey) recMes+=v
      if(b.status==='Pago') recPaga+=v; else recPendente+=v
    })

    const totalEsp=recPaga+recPendente
    const pct=totalEsp>0?Math.round((recPaga/totalEsp)*100):100
    return {
      balancoGeral:{recGlobal,desGlobal,saldo:recGlobal-desGlobal,pendente:recPendente},
      mesAtualData: { receitas: recMes, despesas: desMes, saldo: recMes - desMes },
      chartData:Object.values(hist).sort((a,b)=>a.sortKey.localeCompare(b.sortKey)).slice(-6),
      adimplenciaData:[{name:'Adimplentes',value:pct,color:'#10b981'},{name:'Inadimplentes',value:100-pct,color:'#f59e0b'}]
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[financeiro, boletos])

  const tipoIcon = t=>({reserva:'📅',boleto:'💰',ocorrencia:'⚠️',assembleia:'🏛️',manutencao:'🔧',morador:'👤',prestador:'🔨',mensagem:'💬'}[t]||'🔔')

  return (
    <div className="animate-fade-in h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div className="page-header mb-0">
          <div>
            <h2 className="section-title text-2xl font-black bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">
              Olá, {user?.nome?.split(' ')[0] || 'Usuário'}
            </h2>
            <p className="text-gray-500">Acompanhe as principais métricas do condomínio hoje.</p>
          </div>
        </div>
        {user?.role !== 'Morador' && (
          <button 
            onClick={() => window.open('/ponto', '_blank')}
            className="hidden md:flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl shadow-lg transition-all"
          >
            <Clock size={16} /> Bater Ponto
          </button>
        )}
      </div>

      {/* ─── VISÃO MOBILE (APP STYLE) ─── */}
      <div className="md:hidden flex flex-col min-h-screen -m-4 sm:-m-6 bg-[#C9CCDB] p-4 sm:p-6 pb-24 gap-6">
        <div className="text-center mt-4">
          <h2 className="text-2xl font-black text-[#2E3045]">Menu Rápido</h2>
          <p className="text-sm text-[#2E3045]/70 font-semibold mt-1">O que você precisa hoje?</p>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Bater Ponto', icon: Clock, to: '/ponto', bg: 'bg-[#A4B6BA]' },
            { label: 'Câmeras', icon: Video, to: '/cameras', bg: 'bg-[#A4B6BA]' },
            { label: 'Reservas', icon: CalendarCheck, to: '/reservas', bg: 'bg-[#D1D3DF]' },
            { label: 'Boletos', icon: Receipt, to: '/boletos', bg: 'bg-[#D1D3DF]' },
            { label: 'Encomendas', icon: Package, to: '/encomendas', bg: 'bg-[#A4B6BA]' },
            { label: 'Ocorrências', icon: AlertTriangle, to: '/ocorrencias', bg: 'bg-[#A4B6BA]' },
            { label: 'Veículos', icon: Car, to: '/veiculos', bg: 'bg-[#D1D3DF]' },
            { label: 'Notificações', icon: Bell, to: '/comunicacao', bg: 'bg-[#D1D3DF]', badge: minhasNotificacoes.filter(n=>!n.lida).length },
            { label: 'Visitantes', icon: Users, to: '/visitantes', bg: 'bg-[#A4B6BA]' },
          ].map(item => (
            <Link key={item.label} to={item.to} className={`${item.bg} flex flex-col items-center justify-center p-6 rounded-3xl shadow-sm active:scale-95 transition-transform border border-[#2E3045]/10 relative`}>
               {item.badge > 0 && <div className="absolute top-3 right-3 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md animate-pulse">{item.badge}</div>}
               <item.icon size={44} className="mb-3 text-[#2E3045]" strokeWidth={1.5} />
               <span className="font-bold text-sm text-[#2E3045]">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ─── VISÃO DESKTOP (DASHBOARD COMPLETO) ─── */}
      <div className="hidden md:flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div><h2 className="text-xl font-black text-[#2E3045]">Visão Geral</h2><p className="text-sm text-gray-600">Bem-vindo ao Alpha Soluções Condominiais</p></div>
          <span className="badge badge-green px-3 py-1.5 text-xs">● Sistema Online</span>
        </div>

      {/* Stats Gerais */}
      <div className="grid grid-cols-2 xl:grid-cols-4 lg:grid-cols-4 gap-4">
        {user?.role === 'Morador' ? (
          <>
            <StatCard label="Ocorrências" value={ocorrencias.filter(o=>o.autor===user?.nome && o.status!=='Resolvida').length} sub="Suas ocorrências abertas" icon={AlertTriangle} color="bg-red-600"/>
            <StatCard label="Boletos" value={boletos.filter(b=>b.morador===user?.nome && b.status==='Pendente').length} sub="Boletos pendentes" icon={Receipt} color="bg-amber-600"/>
            <StatCard label="Encomendas" value={encomendas?.filter(e=>e.morador===user?.nome && e.status==='Pendente').length || 0} sub="Aguardando retirada" icon={Package} color="bg-blue-600"/>
            <StatCard label="Reservas Futuras" value={reservasFuturas||0} sub="Próximos agendamentos" icon={CalendarCheck} color="bg-purple-700"/>
          </>
        ) : user?.role === 'Porteiro' ? (
          <>
            <StatCard label="Moradores" value={totalMoradores||0} sub="Cadastrados no sistema" icon={Users} color="bg-brand-600"/>
            <StatCard label="Visitantes no Local" value={visNoLocal||0} sub="Pessoas atualmente no prédio" icon={DoorOpen} color="bg-amber-600"/>
            <StatCard label="Ocorrências" value={ocPendentes||0} sub="Pendentes de resolução" icon={AlertTriangle} color="bg-red-600"/>
            <StatCard label="Reservas do Dia" value={reservasFuturas||0} sub="Próximos agendamentos" icon={CalendarCheck} color="bg-purple-700"/>
          </>
        ) : (
          <>
            <StatCard label="Moradores" value={totalMoradores||0} sub="Cadastrados no sistema" icon={Users} color="bg-brand-600"/>
            <StatCard label="Reservas Futuras" value={reservasFuturas||0} sub="Próximos agendamentos" icon={CalendarCheck} color="bg-purple-700"/>
            <StatCard label="Receitas do Mês" value={`R$ ${(mesAtualData.receitas/1000).toFixed(1)}k`} sub="Lançadas este mês" icon={TrendingUp} color="bg-emerald-600"/>
            <StatCard label="Despesas do Mês" value={`R$ ${(mesAtualData.despesas/1000).toFixed(1)}k`} sub="Lançadas este mês" icon={TrendingDown} color="bg-red-600"/>
          </>
        )}
      </div>

      {/* Cards de boletos (Apenas para Gestão/Financeiro/Síndico) */}
      {(user?.role === 'Administrador' || user?.role === 'Financeiro' || user?.role === 'Síndico') && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card text-center">
            <p className="text-2xl font-black text-emerald-400">{boletos.filter(b=>b.status==='Pago').length}</p>
            <p className="text-xs text-gray-400 mt-1">Boletos Pagos</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-black text-amber-400">{boletosPendentes}</p>
            <p className="text-xs text-gray-400 mt-1">Boletos Pendentes</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-black text-red-400">{boletosVencidos}</p>
            <p className="text-xs text-gray-400 mt-1">Boletos Vencidos</p>
          </div>
        </div>
      )}

      {/* Charts (Apenas para Gestão/Financeiro/Síndico) */}
      {(user?.role === 'Administrador' || user?.role === 'Financeiro' || user?.role === 'Síndico') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="card lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div><p className="section-title">Receitas vs Despesas</p><p className="section-sub">Histórico lançado</p></div>
              <div className="flex gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-brand-500"/> Receitas</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"/>Despesas</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData.length?chartData:[{mes:'—',receitas:0,despesas:0}]} margin={{top: 10, right: 10, left: -20, bottom: 0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                <XAxis dataKey="mes" tick={{fill:'#64748b',fontSize:12,fontWeight:600}} axisLine={false} tickLine={false} dy={10}/>
                <YAxis tick={{fill:'#94a3b8',fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`R$${(v/1000).toFixed(0)}k`}/>
                <Tooltip cursor={{fill: '#f8fafc'}} content={<CustomTooltip/>}/>
                <Bar dataKey="receitas" name="Receitas" fill="#10b981" radius={[4,4,0,0]} barSize={32} onClick={(data) => navigate(`/financeiro?tab=Historico&mes=${data.sortKey}&tipo=Receita`)} className="cursor-pointer hover:opacity-80 transition-opacity" />
                <Bar dataKey="despesas" name="Despesas" fill="#ef4444" radius={[4,4,0,0]} barSize={32} onClick={(data) => navigate(`/financeiro?tab=Historico&mes=${data.sortKey}&tipo=Despesa`)} className="cursor-pointer hover:opacity-80 transition-opacity" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card flex flex-col">
            <p className="section-title">Inadimplência</p>
            <p className="section-sub mb-4">Baseado em cobranças (R$)</p>
            <div className="flex-1 flex items-center justify-center">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={adimplenciaData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={3}>
                    {adimplenciaData.map((e,i)=><Cell key={i} fill={e.color}/>)}
                  </Pie>
                  <Tooltip formatter={v=>`${v}%`} contentStyle={{background:'#111827',border:'1px solid #374151',borderRadius:8,fontSize:12}}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-2 mt-2">
              {adimplenciaData.map(d=>(
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{background:d.color}}/><span className="text-gray-600">{d.name}</span></span>
                  <span className="font-bold text-gray-800">{d.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Balanço + Atividades reais + WhatsApp */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {(user?.role === 'Administrador' || user?.role === 'Financeiro' || user?.role === 'Síndico') && (
          <div className="card">
            <p className="section-title mb-4">Balanço Global (Caixa)</p>
            <div className="flex flex-col gap-3">
              {[
                {label:'Receita Total Lançada', val:`R$ ${balancoGeral.recGlobal.toLocaleString('pt-BR',{minimumFractionDigits:2})}`, icon:TrendingUp, color:'text-emerald-400'},
                {label:'Despesa Total Lançada', val:`R$ ${balancoGeral.desGlobal.toLocaleString('pt-BR',{minimumFractionDigits:2})}`, icon:TrendingDown, color:'text-red-400'},
                {label:'A Receber (Inadimplência)', val:`R$ ${balancoGeral.pendente.toLocaleString('pt-BR',{minimumFractionDigits:2})}`, icon:CreditCard, color:'text-amber-500'},
                {label:'Saldo Estimado', val:`R$ ${balancoGeral.saldo.toLocaleString('pt-BR',{minimumFractionDigits:2})}`, icon:DollarSign, color:balancoGeral.saldo>=0?'text-emerald-400':'text-red-500'},
              ].map(item=>(
                <div key={item.label} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                  <div className="flex items-center gap-2 text-sm text-gray-400"><item.icon size={14} className={item.color}/>{item.label}</div>
                  <span className={`text-sm font-bold ${item.color}`}>{item.val}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Atividades recentes — dados reais de notificacoes */}
        {user?.role !== 'Morador' && (
          <div className="card max-h-[300px] overflow-y-auto custom-scrollbar flex flex-col">
            <p className="section-title mb-3 sticky top-0 bg-white z-10 py-1 flex items-center gap-2"><Bell size={14} className="text-brand-500"/>Atividades Recentes</p>
            <div className="flex flex-col gap-1 flex-1">
              {atividadesRecentes.length===0
                ? <p className="text-gray-400 text-sm py-8 text-center">Nenhuma atividade registrada.</p>
                : atividadesRecentes.map(n=>(
                  <div key={n.id} className="flex items-start gap-2 py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 px-1 rounded-lg transition-colors">
                    <span className="text-base shrink-0 mt-0.5">{tipoIcon(n.tipo)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 leading-snug truncate">{n.text}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{n.time?new Date(n.time).toLocaleString('pt-BR'):''}</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* WhatsApp */}
        {(user?.role === 'Administrador' || user?.role === 'Síndico') && (
          <div className="card bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <div className="flex items-center justify-between mb-4">
              <p className="section-title text-green-800 flex items-center gap-2"><Smartphone size={16}/>Integração WhatsApp</p>
              <span className={`badge ${waConectado?'badge-green':'badge-yellow'} px-2 py-0.5 text-[10px]`}>{waConectado?'Conectado':'Aguardando'}</span>
            </div>
            {!waConectado?(
              <div className="flex flex-col items-center justify-center text-center gap-3 py-2">
                <div className="bg-white p-3 rounded-xl shadow-sm border border-green-100 mb-1 inline-block opacity-50 pointer-events-none">
                  <QRCodeSVG value="demo-qr-code" size={120} level="M"/>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-800">Modo Demonstração</p>
                  <p className="text-[11px] text-gray-500 max-w-[200px] mt-1 leading-tight">Para ativar, conecte uma API oficial (Z-API, Evolution API ou Meta).</p>
                </div>
                <button onClick={()=>setWaConectado(true)} className="btn-primary bg-green-600 hover:bg-green-700 w-full justify-center text-xs mt-2">Simular Leitura</button>
              </div>
            ):(
              <div className="flex flex-col items-center justify-center text-center gap-4 py-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-2"><Smartphone size={32}/></div>
                <div>
                  <p className="text-sm font-bold text-green-800">Aparelho Conectado!</p>
                  <p className="text-xs text-green-600 mt-1">Sistema de disparos automáticos ativo.</p>
                </div>
                <button onClick={()=>setWaConectado(false)} className="btn-secondary text-xs text-red-500 hover:bg-red-50 hover:text-red-600 w-full justify-center">Desconectar</button>
              </div>
            )}
          </div>
        )}
      </div>

      
      {/* Robô de Vencimentos */}
      {(user?.role === 'Administrador' || user?.role === 'Síndico') && (
        <div className="card border-orange-200 bg-gradient-to-r from-orange-50/50 to-white">
          <div className="flex items-center gap-2 mb-4">
            <Bot size={20} className="text-orange-500" />
            <p className="section-title text-orange-800 m-0">Robô de Vencimentos (Alertas Automáticos)</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roboAlertas.length === 0 ? (
              <div className="col-span-full py-6 flex flex-col items-center justify-center text-orange-400 opacity-80">
                <Shield size={32} className="mb-2 text-orange-300" />
                <p className="text-sm font-medium">Tudo em dia!</p>
                <p className="text-xs">Nenhum seguro ou mandato vencendo nos próximos 30 dias.</p>
              </div>
            ) : roboAlertas.map(a => (
              <div key={a.id + a.tipo} className={`flex items-start gap-3 p-3 rounded-xl border ${a.color} transition-all hover:scale-[1.02]`}>
                <div className="p-2 bg-white rounded-lg shadow-sm"><a.icon size={16}/></div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider opacity-80">{a.tipo}</p>
                  <p className="text-sm font-bold mt-0.5">{a.desc}</p>
                  <p className="text-xs mt-1 font-medium">{a.dias < 0 ? `Venceu há ${Math.abs(a.dias)} dias!` : a.dias === 0 ? 'Vence HOJE!' : `Vence em ${a.dias} dias`}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}


      {/* Divulgação do App + Portaria */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* QR Code do App */}
        <div className="card bg-gradient-to-br from-brand-50 to-indigo-50 border-brand-200 flex flex-col items-center justify-center text-center">
          <div className="flex items-center gap-2 text-brand-800 font-bold mb-4">
            <Smartphone size={18}/> Acesso ao Aplicativo
          </div>
          <div className="bg-white p-3 rounded-2xl shadow-sm border border-brand-100 mb-3">
            <QRCodeSVG value="https://alpha-solucoes-condominiais.vercel.app" size={130} level="M" fgColor="#1e3a8a"/>
          </div>
          <p className="text-xs text-brand-700 max-w-[220px]">
            Plataforma 100% otimizada para celular. Os moradores podem escanear para acessar e <b>Instalar o App (PWA)</b> direto pelo navegador, sem ocupar memória do aparelho!
          </p>
          <button onClick={()=>window.print()} className="btn-primary w-full justify-center mt-4 text-xs">
             🖨️ Imprimir Cartaz do QR Code
          </button>
        </div>

        {/* Portaria recente */}
        {visRecentes.length>0 ? (
          <div className="card lg:col-span-2">
            <p className="section-title mb-3">Monitoramento Portaria (Recentes)</p>
            <div className="flex flex-col gap-1">
              {visRecentes.map(v=>(
                <div key={v.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 px-1 rounded-lg transition-colors">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${v.status==='Saiu'?'bg-red-50 text-red-500':'bg-emerald-50 text-emerald-500'}`}>
                    {v.status==='Saiu'?<LogOut size={16}/>:<LogIn size={16}/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-800 truncate">{v.nome} <span className="text-[10px] text-gray-400 font-normal">({v.tipo})</span></p>
                    <p className="text-xs text-brand-600 truncate">→ {v.destino}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] uppercase font-bold text-gray-400">{v.status==='Saiu'?'SAÍDA':'ENTRADA'}</p>
                    <p className="text-xs font-mono text-gray-600">{v.status==='Saiu'?v.saida:v.entrada}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card lg:col-span-2 flex items-center justify-center">
            <p className="text-sm text-gray-400">Nenhuma movimentação na portaria recente.</p>
          </div>
          )}
        </div>
      </div>
    </div>
  )
}
