import React, { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronRight, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getFilteredNavGroups } from '../utils/navData'

function NavGroup({ group, collapsed }) {
  const [open, setOpen] = useState(group.isConfig ? false : true)

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
        className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-bold text-gray-600 uppercase tracking-widest hover:text-brand-600 transition-colors"
      >
        <span>{group.label}</span>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {open && (
        <div className="flex flex-col gap-0.5 mt-1 mb-2">
          {group.items.map(item => {
            const isSub = item.label.startsWith('↳')
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `${isActive ? 'nav-item-active' : 'nav-item-inactive'} ${isSub ? 'ml-4 text-[13px] opacity-90' : ''}`
                }
              >
                <item.icon size={isSub ? 14 : 16} />
                <span className="truncate">{item.label.replace('↳ ', '')}</span>
              </NavLink>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Sidebar({ open, onClose, collapsed, onToggleCollapse }) {
  const { user } = useAuth()
  const filteredNavGroups = getFilteredNavGroups(user)

  const mainGroups   = filteredNavGroups.filter(g => !g.isConfig)
  const configGroups = filteredNavGroups.filter(g =>  g.isConfig)

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

        {/* Nav principal — scrollável */}
        <nav className="flex-1 overflow-y-auto p-3 flex flex-col gap-1 bg-pale-100 custom-scrollbar">
          {mainGroups.map(group => (
            <NavGroup key={group.label} group={group} collapsed={collapsed} />
          ))}
        </nav>

        {/* Configurações — fixo no fundo */}
        {configGroups.length > 0 && (
          <div className="border-t-2 border-pale-300 p-3 bg-pale-100">
            {configGroups.map(group => (
              <NavGroup key={group.label} group={group} collapsed={collapsed} />
            ))}
          </div>
        )}

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
