import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Menu, Bell, Search, LogOut, ChevronDown, X, CheckCircle2, Trash2, Home, Signal } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import OneSignal from 'react-onesignal'
import { useFirestore } from '../hooks/useFirestore'

const pageNames = {
  '/dashboard':'Dashboard','/condominios':'Condomínios & Unidades','/moradores':'Moradores',
  '/rh':'Recursos Humanos','/prestadores':'Prestadores de Serviços','/usuarios':'Usuários & Acessos',
  '/financeiro':'Financeiro','/boletos':'Boletos & Fundo de Reserva','/notas-fiscais':'Notas Fiscais',
  '/assembleias':'Assembleias & Atas','/ocorrencias':'Ocorrências','/reservas':'Reservas de Espaços',
  '/portaria':'Portaria & Manutenção','/seguro':'Seguro do Condomínio','/regime':'Regime Interno & Externo',
  '/documentos':'Documentos','/comunicacao':'Comunicação',
}
const tipoIcon = t=>({reserva:'📅',boleto:'💰',ocorrencia:'⚠️',assembleia:'🏛️',manutencao:'🔧',morador:'👤',prestador:'🔨'}[t]||'🔔')

// Roles que podem ver notificações
const ROLES_COM_NOTIF = ['Administrador','Síndico','Financeiro','Subsíndico','Conselheiro','Morador']

export default function Header({ onMenuClick }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [dropOpen,   setDropOpen]   = useState(false)
  const [notifOpen,  setNotifOpen]  = useState(false)
  const [centralOpen, setCentralOpen] = useState(false)
  const [condoFilter, setCondoFilter] = useState('Todos')
  const { items: allNotifications, updateItem, deleteItem } = useFirestore('notificacoes')

  const notifications = allNotifications.filter(n => {
    if (user?.role === 'Administrador' || user?.role === 'Financeiro') return true;
    if (['Síndico', 'Subsíndico', 'Conselheiro', 'Morador'].includes(user?.role)) {
      // Filtrar por condomínio
      if (n.condominio && n.condominio !== 'Todos' && n.condominio !== user?.condominio) return false;
      
      // Filtrar por morador (se for uma notificação individual)
      if (n.moradorId && n.moradorId !== user?.id) return false;
      if (n.moradorNome && n.moradorNome !== user?.nome) return false;

      return true;
    }
    return false;
  })

  const pageName  = pageNames[location.pathname] || 'Sistema'
  const podeVerNotif = ROLES_COM_NOTIF.includes(user?.role)
  const naoLidas  = notifications.filter(n=>!n.lida).length

  const uniqueCondos = Array.from(new Set(notifications.map(n=>n.condominio).filter(Boolean)))
  const filteredCentral = notifications.filter(n => condoFilter === 'Todos' || n.condominio === condoFilter)

  const markAll = async () => {
    for (const n of notifications) if (!n.lida) await updateItem(n.id,{lida:true})
  }
  const preview = notifications.slice(0,4)

  const handleNotifClick = async (n) => {
    if (!n.lida) await updateItem(n.id, { lida: true })
    setNotifOpen(false)
    setCentralOpen(false)
    if (n.tipo === 'ocorrencia') navigate('/ocorrencias')
    if (n.tipo === 'reserva') navigate('/reservas')
    if (n.tipo === 'visitante') navigate('/visitantes')
    if (n.tipo === 'boleto') navigate('/boletos')
    if (n.tipo === 'comunicado' || n.tipo === 'mensagem') navigate('/comunicacao')
  }

  return (
    <header className="h-16 bg-white/90 backdrop-blur-md border-b border-cream-400 flex items-center justify-between px-4 gap-4 sticky top-0 z-30 shadow-sm">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="lg:hidden p-2 rounded-lg text-gray-500 hover:text-brand-600 hover:bg-pale-100 transition-all"><Menu size={20}/></button>
        <button onClick={() => navigate('/dashboard')} className="lg:hidden flex items-center justify-center p-2 rounded-lg text-[#2E3045] bg-[#D1D3DF] hover:bg-[#A4B6BA] border border-[#2E3045]/10 transition-all" title="Voltar ao Início">
          <Home size={20}/>
        </button>
        <button onClick={() => { 
          if (!window.OneSignal) {
            alert("O OneSignal não carregou! O script pode estar bloqueado pelo navegador.");
            return;
          }
          window.OneSignalDeferred = window.OneSignalDeferred || [];
          window.OneSignalDeferred.push(async function(OneSignal) {
            try {
              await OneSignal.User.PushSubscription.optIn();
              alert("Pedido de permissão processado pelo OneSignal!");
            } catch (e) {
              alert("Erro ao ativar Push: " + e.message);
            }
          });
        }} className="flex items-center gap-2 p-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-all text-xs font-bold" title="Testar Notificações">
          <Signal size={16}/> ATIVAR PUSH
        </button>
        <h1 className="text-sm font-bold text-gray-800 hidden sm:block">{pageName}</h1>
      </div>

      <div className="flex-1 max-w-sm hidden md:flex items-center gap-2 bg-cream-100 border border-cream-400 rounded-lg px-3 py-2 text-sm text-gray-400 hover:border-brand-400 transition-all cursor-pointer">
        <Search size={14}/><span className="text-xs">Buscar...</span>
      </div>

      <div className="flex items-center gap-2">
        {/* Notificações – somente para ADM/Síndico/Financeiro */}
        {podeVerNotif && (
          <div className="relative">
            <button onClick={()=>{setNotifOpen(o=>!o);setDropOpen(false);}}
              className="relative p-2 rounded-lg text-gray-500 hover:text-brand-600 hover:bg-pale-100 transition-all">
              <Bell size={18}/>
              {naoLidas>0&&(
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-xs text-white flex items-center justify-center font-bold leading-none">{naoLidas}</span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-12 w-80 bg-white border border-cream-400 rounded-2xl shadow-xl z-50 overflow-hidden animate-fade-in">
                <div className="p-4 border-b border-cream-300 flex items-center justify-between">
                  <p className="font-bold text-sm text-gray-800">Notificações {naoLidas>0&&<span className="ml-1 badge-red">{naoLidas}</span>}</p>
                  <div className="flex gap-2">
                    {naoLidas>0&&<button onClick={markAll} className="text-xs text-brand-500 hover:text-brand-700 flex items-center gap-1"><CheckCircle2 size={11}/>Marcar lidas</button>}
                    <button onClick={()=>setNotifOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={14}/></button>
                  </div>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {preview.map(n=>(
                    <div key={n.id} onClick={()=>handleNotifClick(n)} className={`px-4 py-3 border-b border-cream-200 flex items-start gap-2 cursor-pointer hover:bg-brand-50 transition-all ${!n.lida?'bg-pale-100':''}`}>
                      <span className="text-base mt-0.5">{tipoIcon(n.tipo)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-700 leading-relaxed">{n.text}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{n.time ? new Date(n.time).toLocaleString('pt-BR') : ''}</p>
                      </div>
                      <button onClick={(e)=>{e.stopPropagation();deleteItem(n.id)}} className="p-1 rounded hover:bg-red-100 text-gray-300 hover:text-red-500 transition-all mt-0.5"><X size={11}/></button>
                    </div>
                  ))}
                  {notifications.length===0&&<div className="p-6 text-center text-xs text-gray-400">Nenhuma notificação.</div>}
                </div>
                {notifications.length>4&&(
                  <div className="p-2 text-center border-t border-cream-300">
                    <button onClick={()=>{setCentralOpen(true);setNotifOpen(false)}} className="text-xs text-brand-600 hover:text-brand-800 font-semibold w-full py-1 transition-all rounded hover:bg-brand-50">
                      Ver todas na Central
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* User menu */}
        <div className="relative">
          <button onClick={()=>{setDropOpen(o=>!o);setNotifOpen(false)}}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-pale-100 transition-all">
            <div className="w-7 h-7 bg-gradient-to-br from-brand-500 to-brand-700 rounded-full flex items-center justify-center text-xs font-bold text-white">{user?.nome?.[0]||'A'}</div>
            <span className="text-xs font-medium text-gray-700 hidden sm:block">{user?.nome}</span>
            <ChevronDown size={12} className="text-gray-400 hidden sm:block"/>
          </button>
          {dropOpen&&(
            <div className="absolute right-0 top-12 w-48 bg-white border border-cream-400 rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in">
              <div className="p-3 border-b border-cream-300">
                <p className="text-xs font-semibold text-gray-800">{user?.nome}</p>
                <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
              </div>
              <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-red-500 hover:bg-red-50 transition-all"><LogOut size={14}/>Sair</button>
            </div>
          )}
        </div>
      </div>

      {/* MODAL CENTRAL DE NOTIFICAÇÕES */}
      {centralOpen && (
        <div className="modal-overlay" onClick={()=>setCentralOpen(false)}>
          <div className="modal-content max-w-2xl w-full" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 border-b border-cream-300 pb-3">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Central de Notificações</h2>
                <p className="text-xs text-gray-500">Visualize e filtre os alertas de todos os condomínios.</p>
              </div>
              <button onClick={()=>setCentralOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-cream-100 rounded-lg transition-all"><X size={18}/></button>
            </div>
            
            {(user?.role === 'Administrador' || user?.role === 'Financeiro') && uniqueCondos.length > 0 && (
              <div className="mb-4">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Filtrar por Condomínio</label>
                <select className="input text-sm" value={condoFilter} onChange={e=>setCondoFilter(e.target.value)}>
                  <option value="Todos">Todos os Condomínios</option>
                  {uniqueCondos.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}

            <div className="max-h-[60vh] overflow-y-auto custom-scrollbar flex flex-col gap-2 pr-1">
              {filteredCentral.map(n=>(
                <div key={n.id} onClick={()=>handleNotifClick(n)} className={`p-4 rounded-xl border border-cream-200 flex items-start gap-3 cursor-pointer transition-all hover:border-brand-300 hover:bg-brand-50 shadow-sm ${!n.lida?'bg-pale-100':'bg-white'}`}>
                  <span className="text-2xl mt-1">{tipoIcon(n.tipo)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 leading-relaxed font-medium">{n.text}</p>
                    <p className="text-xs text-gray-400 mt-1">{n.time ? new Date(n.time).toLocaleString('pt-BR') : ''}</p>
                  </div>
                  <button onClick={(e)=>{e.stopPropagation();deleteItem(n.id)}} className="p-2 rounded-lg hover:bg-red-100 text-gray-300 hover:text-red-500 transition-all"><Trash2 size={14}/></button>
                </div>
              ))}
              {filteredCentral.length===0&&<div className="p-8 text-center text-sm text-gray-400">Nenhuma notificação encontrada para este filtro.</div>}
            </div>
          </div>
        </div>
      )}

    </header>
  )
}
