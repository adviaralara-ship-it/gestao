import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Menu, Bell, Search, LogOut, ChevronDown, X, CheckCircle2, Trash2, Home, Signal, Bot, Clock, ArrowLeft, ArrowRight, ExternalLink } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import OneSignal from 'react-onesignal'
import { useFirestore } from '../hooks/useFirestore'
import { getFilteredNavGroups } from '../utils/navData'

const pageNames = {
  '/dashboard':'Dashboard','/condominios':'Condomínios & Unidades','/moradores':'Moradores',
  '/rh':'Recursos Humanos','/prestadores':'Fornecedores & Prestadores','/usuarios':'Usuários & Permissões',
  '/financeiro':'Receitas & Despesas','/boletos':'Boletos & Fundo de Reserva','/notas-fiscais':'Notas Fiscais',
  '/assembleias':'Assembleias & Atas','/ocorrencias':'Solicitações','/reservas':'Reservas de Espaços',
  '/portaria':'Portaria & Rondas','/seguro':'Seguro do Condomínio','/regime':'Regimentos Internos',
  '/documentos':'Documentos & Contratos','/comunicacao':'Comunicação','/cotacoes':'Cotações & Compras'
}

const ROLES_COM_NOTIF = ['Administrador','Síndico']
const WHATSAPP_NUMBER = '558396885931'

function WhatsAppHeaderButton() {
  return (
    <a
      href={`https://wa.me/${WHATSAPP_NUMBER}?text=Olá!%20Preciso%20de%20suporte%20do%20condomínio.`}
      target="_blank"
      rel="noreferrer"
      className="relative p-2 rounded-lg text-green-500 hover:text-green-600 hover:bg-green-50 transition-all flex items-center justify-center"
      title="Suporte via WhatsApp"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
    </a>
  )
}

export default function Header({ onMenuClick }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [dropOpen,   setDropOpen]   = useState(false)
  const [notifOpen,  setNotifOpen]  = useState(false)
  const [centralOpen, setCentralOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchCategory, setSearchCategory] = useState('')
  const [condoFilter, setCondoFilter] = useState('Todos')
  const { items: allNotifications, updateItem, deleteItem } = useFirestore('notificacoes')

  const filteredNavGroups = getFilteredNavGroups(user)

  const notifications = allNotifications.filter(n => {
    if (user?.role === 'Administrador' || user?.role === 'Financeiro') return true;
    if (['Síndico', 'Subsíndico', 'Conselheiro', 'Morador'].includes(user?.role)) {
      if (n.condominio && n.condominio !== 'Todos' && n.condominio !== user?.condominio) return false;
      if (n.moradorId && n.moradorId !== user?.id) return false;
      if (n.moradorNome && n.moradorNome !== user?.nome) return false;
      return true;
    }
    return false;
  })

  const pageName = pageNames[location.pathname] || 'Sistema'
  const podeVerNotif = ROLES_COM_NOTIF.includes(user?.role)
  const naoLidas = notifications.filter(n=>!n.lida).length

  // Fecha todos os menus ao clicar fora
  React.useEffect(() => {
    const fecharMenus = (e) => {
      if (!e.target.closest('.search-menu-container')) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('click', fecharMenus)
    return () => document.removeEventListener('click', fecharMenus)
  }, [])

  return (
    <header className="h-16 bg-white/95 backdrop-blur-md border-b border-cream-400 flex items-center justify-between px-4 gap-4 sticky top-0 z-30 shadow-sm">
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

      {/* BUSCADOR DE MÓDULOS / MENUS AMPLO E LEGÍVEL */}
      <div className="relative flex-1 max-w-xl w-full search-menu-container">
        <div
          onClick={(e) => { e.stopPropagation(); setSearchOpen(true); setDropOpen(false); setNotifOpen(false) }}
          className="flex items-center gap-2.5 bg-slate-50 border border-slate-300 hover:border-brand-500 rounded-xl px-3.5 py-2 text-sm text-gray-600 transition-all cursor-text shadow-inner focus-within:ring-2 focus-within:ring-brand-200 focus-within:bg-white"
        >
          <Search size={17} className="shrink-0 text-brand-600"/>
          <input
            id="quick-search-input"
            type="text"
            placeholder="Buscar páginas e menus (ex: Gestão, Contratos, Boletos, Moradores...)"
            className="bg-transparent border-none outline-none text-xs sm:text-sm font-medium text-gray-800 w-full placeholder:text-gray-400"
            value={searchCategory}
            onChange={e => { setSearchCategory(e.target.value); setSearchOpen(true) }}
            onFocus={() => setSearchOpen(true)}
            onClick={e => e.stopPropagation()}
          />
          {searchCategory && (
            <button 
              onClick={e => { e.stopPropagation(); setSearchCategory(''); }} 
              className="text-gray-400 hover:text-gray-600 p-0.5 rounded-full hover:bg-gray-200"
              title="Limpar busca"
            >
              <X size={15}/>
            </button>
          )}
        </div>

        {/* JANELA EXPANDIDA DE RESULTADOS DO MENU (SEM CORTES) */}
        {searchOpen && (() => {
          const query = searchCategory.toLowerCase().trim()
          
          // Mapeamento plano com rótulo legível
          const allItems = filteredNavGroups.flatMap(g =>
            g.items.map(item => ({ 
              ...item, 
              groupLabel: g.label,
              cleanLabel: item.label.replace('↳ ', '')
            }))
          )
          
          const results = query
            ? allItems.filter(item =>
                item.cleanLabel.toLowerCase().includes(query) ||
                item.groupLabel.toLowerCase().includes(query) ||
                item.to.toLowerCase().includes(query)
              )
            : allItems

          return (
            <div
              className="absolute top-12 left-0 w-full sm:w-[580px] md:w-[650px] bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-fade-in p-3 max-h-[460px] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between text-xs text-gray-500 font-bold">
                <span>
                  {query ? `Resultados para "${searchCategory}" (${results.length})` : 'Todos os Menus & Módulos Disponíveis'}
                </span>
                <span className="text-[11px] text-gray-400 font-normal">Clique para navegar</span>
              </div>

              {results.length === 0 ? (
                <div className="text-center py-10 px-4 text-gray-400 flex flex-col items-center justify-center">
                  <Search size={32} className="opacity-30 mb-2 text-gray-400" />
                  <p className="text-sm font-bold text-gray-600">Nenhum menu encontrado para "{searchCategory}"</p>
                  <p className="text-xs text-gray-400 mt-1">Tente pesquisar por palavras como: Documentos, Gestão, Boletos, Moradores, etc.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 overflow-y-auto custom-scrollbar flex-1">
                  {results.map(item => (
                    <button
                      key={item.to}
                      onClick={() => { navigate(item.to); setSearchOpen(false); setSearchCategory('') }}
                      className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-brand-50 border border-slate-100 hover:border-brand-300 transition-all text-left group cursor-pointer bg-slate-50/50 hover:shadow-sm"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 group-hover:bg-brand-600 group-hover:text-white flex items-center justify-center text-brand-700 shadow-sm shrink-0 transition-colors">
                        <item.icon size={18} strokeWidth={2.2} />
                      </div>
                      <div className="flex-1 min-w-0 pr-1">
                        {/* Nome COMPLETO sem corte nem reticências curtas */}
                        <p className="text-xs sm:text-sm font-bold text-gray-800 group-hover:text-brand-800 transition-colors leading-snug break-words">
                          {item.cleanLabel}
                        </p>
                        <span className="inline-block text-[10px] font-semibold text-gray-500 group-hover:text-brand-600 mt-0.5">
                          {item.groupLabel}
                        </span>
                      </div>
                      <ArrowRight size={14} className="text-gray-300 group-hover:text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })()}
      </div>

      <div className="flex items-center gap-2">
        {/* Botão Rápido de Bater Ponto */}
        {user?.role !== 'Morador' && (
          <button
            onClick={() => navigate('/ponto')}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black px-3 py-1.5 rounded-xl shadow-sm flex items-center gap-1.5 transition-all hover:scale-105 cursor-pointer"
            title="Registrar Ponto Eletrônico (com foto e GPS)"
          >
            <Clock size={15} />
            <span className="hidden sm:inline">Bater Ponto</span>
          </button>
        )}

        <WhatsAppHeaderButton />
        
        {/* Botão Alpha AI */}
        <button
          onClick={() => navigate('/alpha-ai')}
          className="relative p-2 rounded-lg text-brand-600 hover:text-brand-800 hover:bg-pale-100 transition-all flex items-center justify-center cursor-pointer"
          title="Alpha AI — Concierge Virtual"
        >
          <Bot size={20} />
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-emerald-400 border-2 border-white rounded-full"></span>
        </button>
      </div>
    </header>
  )
}
