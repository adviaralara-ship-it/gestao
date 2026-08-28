import React, { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { ArrowLeft } from 'lucide-react'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const isHome = location.pathname === '/dashboard' || location.pathname === '/'

  return (
    <div className="flex h-screen overflow-hidden bg-cream-300">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(c => !c)}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {!isHome && (
            <div className="mb-3 lg:hidden">
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-white hover:bg-slate-50 border border-cream-400 rounded-xl text-xs font-black text-brand-800 shadow-xs active:scale-98 transition-all"
              >
                <ArrowLeft size={15} className="text-brand-600" />
                <span>← Voltar ao Início</span>
              </button>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  )
}
