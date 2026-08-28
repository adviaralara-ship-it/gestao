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
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-20 lg:pb-6">
          <Outlet />

          {/* Botão de Voltar ao Início na parte inferior no celular */}
          {!isHome && (
            <div className="lg:hidden sticky bottom-3 z-30 mt-6">
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-brand-850 hover:bg-brand-900 text-white rounded-2xl text-xs font-black shadow-xl border border-brand-700/60 backdrop-blur-md active:scale-98 transition-all"
              >
                <ArrowLeft size={16} className="text-amber-400" />
                <span>← Voltar ao Início</span>
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
