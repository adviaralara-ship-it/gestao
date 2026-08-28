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

          {/* Botão de Voltar menor no canto inferior esquerdo no celular */}
          {!isHome && (
            <div className="lg:hidden fixed bottom-4 left-4 z-40">
              <button
                onClick={() => navigate('/dashboard')}
                style={{ backgroundColor: '#fcd86c', borderColor: '#e4c055', color: '#2f2f49' }}
                className="flex items-center gap-1.5 py-2 px-3.5 active:scale-95 rounded-full text-xs font-black shadow-2xl border transition-all cursor-pointer"
              >
                <ArrowLeft size={15} style={{ color: '#2f2f49' }} strokeWidth={3} />
                <span style={{ color: '#2f2f49' }} className="font-black tracking-wide">Voltar</span>
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
