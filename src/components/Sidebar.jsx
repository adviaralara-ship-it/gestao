import React, { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Building2, Users, UserCog, Briefcase, Wrench,
  CreditCard, FileText, Receipt, Gavel, AlertTriangle, CalendarCheck,
  DoorOpen, Shield, BookOpen, FolderOpen, MessageSquare, ChevronDown,
  ChevronRight, X, Building, CheckSquare, Package, QrCode, PieChart, ShoppingBag,
  Car, Video, Calculator, MessageCircleCode, Mail, Megaphone, Bot, Scale
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const navGroups = [
  {
    label: 'Painel',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/whatsapp', label: 'WhatsApp', icon: MessageCircleCode },
      { to: '/email', label: 'E-mail Alpha', icon: Mail },
      { to: '/condominios', label: 'Condomínios', icon: Building2 },
      { to: '/moradores', label: 'Moradores', icon: Users },
    ]
  },
  {
    label: 'Gestão',
    items: [
      { to: '/rh', label: 'Recursos Humanos', icon: UserCog },
      { to: '/notas-fiscais', label: 'Notas Fiscais', icon: Receipt },
      { to: '/recrutamento', label: 'Recrutamento', icon: Users },
      { to: '/usuarios', label: 'Usuários', icon: Users },
      { to: '/conferencias', label: 'Conferências', icon: Video },
      { to: '/prestadores', label: 'Prestadores', icon: Briefcase },
      { to: '/ocorrencias', label: 'Ocorrências', icon: AlertTriangle },
      { to: '/tarefas', label: 'Tarefas & Agenda', icon: CheckSquare },
      { to: '/monitoramento-ia', label: 'Monitoramento IA', icon: Bot },
      { to: '/eventos', label: 'Eventos & Check-in', icon: CalendarCheck },
    ]
  },
  {
    label: 'Financeiro',
    items: [
      { to: '/financeiro', label: 'Receitas & Despesas', icon: CreditCard },
      { to: '/boletos', label: 'Boletos & Fundo', icon: FileText },
      { to: '/inadimplencia', label: 'Inadimplência & Jurídico', icon: Scale },
      { to: '/calculadora', label: 'Calculadora (Comercial)', icon: Calculator },
      { to: '/locacao', label: 'Locação & Aluguéis', icon: Building },
    ]
  },
  {
    label: 'Operacional',
    items: [
      { to: '/reservas', label: 'Reservas', icon: CalendarCheck },
      { to: '/portaria', label: 'Portaria & Rondas', icon: DoorOpen },
      { to: '/encomendas', label: 'Encomendas', icon: Package },
      { to: '/visitantes', label: 'Visitantes', icon: QrCode },
      { to: '/veiculos', label: 'Veículos & Garagem', icon: Car },
      { to: '/cameras', label: 'Câmeras', icon: Video },
      { to: '/assembleias', label: 'Assembleias & Atas', icon: Gavel },
    ]
  },
  {
    label: 'Administrativo',
    items: [
      { to: '/seguro', label: 'Seguro', icon: Shield },
      { to: '/regime', label: 'Regime Interno/Externo', icon: BookOpen },
      { to: '/documentos', label: 'Documentos', icon: FolderOpen },
      { to: '/contratos', label: 'Gerador de Documentos', icon: FileText },
      { to: '/comunicacao', label: 'Comunicação', icon: MessageSquare },
      { to: '/mural', label: 'Mural de Recados', icon: Megaphone },
      { to: '/enquetes', label: 'Enquetes', icon: PieChart },
      { to: '/classificados', label: 'Classificados', icon: ShoppingBag },
      { to: '/relatorios', label: 'Relatórios', icon: FileText },
    ]
  },
]

function NavGroup({ group, collapsed }) {
  const [open, setOpen] = useState(true)
  const location = useLocation()

  if (collapsed) {
    return (
      <div className="flex flex-col gap-1">
        {group.items.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            title={item.label}
            className={({ isActive }) =>
              isActive ? 'nav-item-active justify-center px-0 py-2.5' : 'nav-item-inactive justify-center px-0 py-2.5'
            }
          >
            <item.icon size={18} />
          </NavLink>
        ))}
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-bold text-gray-400 uppercase tracking-widest hover:text-brand-600 transition-colors"
      >
        {group.label}
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {open && (
        <div className="flex flex-col gap-0.5 mt-1 mb-2">
          {group.items.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => isActive ? 'nav-item-active' : 'nav-item-inactive'}
            >
              <item.icon size={16} />
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Sidebar({ open, onClose, collapsed, onToggleCollapse }) {
  const { user } = useAuth()
  const userPerms = user?.permissoes || []

  // Filtra as opções do menu baseadas nas permissões do usuário
  const filteredNavGroups = navGroups.map(group => ({
    ...group,
    items: group.items.filter(item => {
      // Esconder Notas Fiscais para quem não for Administrador/Financeiro
      if (item.to === '/notas-fiscais' && user?.role !== 'Administrador' && user?.role !== 'Financeiro') return false
      
      let reqPerm = item.to.replace('/', '')
      if (reqPerm === 'conferencias' || reqPerm === 'recrutamento') reqPerm = 'rh'
      
      return userPerms.includes(reqPerm) || user?.role === 'Administrador'
    }).map(item => ({
      ...item,
      label: item.to === '/boletos' && (user?.role === 'Morador' || user?.role === 'Síndico') ? 'Boletos' : item.label
    }))
  })).filter(group => group.items.length > 0)

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-gray-900/40 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full z-50 flex flex-col
          bg-pale-100 border-r border-pale-300
          transition-all duration-300 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:z-auto
          ${collapsed ? 'w-16' : 'w-64'}
        `}
      >
        {/* Logo */}
        <div className={`flex items-center gap-3 p-4 border-b border-white/10 min-h-[64px] bg-[#2d3045] ${collapsed ? 'justify-center' : ''}`}>
          {collapsed ? (
            <img src="/logo.png" alt="Alpha" className="w-10 h-10 min-w-10 object-contain drop-shadow-sm" />
          ) : (
            <>
              <img src="/logo.png" alt="Alpha Soluções" className="w-32 h-auto object-contain drop-shadow-sm mx-auto" />
              <button onClick={onClose} className="ml-auto text-gray-400 hover:text-white lg:hidden">
                <X size={18} />
              </button>
            </>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 flex flex-col gap-1 bg-pale-100">
          {filteredNavGroups.map(group => (
            <NavGroup key={group.label} group={group} collapsed={collapsed} />
          ))}
        </nav>

        {/* Collapse toggle */}
        <div className="hidden lg:flex border-t border-pale-300 p-3 bg-pale-100">
          <button
            onClick={onToggleCollapse}
            className="w-full flex items-center justify-center gap-2 text-xs text-gray-400 hover:text-brand-600 py-2 rounded-lg hover:bg-pale-100 transition-all"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={14} className="-rotate-90" />}
            {!collapsed && <span>Recolher</span>}
          </button>
        </div>
      </aside>
    </>
  )
}
