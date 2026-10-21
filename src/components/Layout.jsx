import React, { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { ArrowLeft } from 'lucide-react'
import { useMaintenanceAutoReminder } from '../hooks/useMaintenanceAutoReminder'
import { useDailyAutoReminder } from '../hooks/useDailyAutoReminder'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary capturou erro:', error, errorInfo)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center flex flex-col items-center justify-center min-h-[50vh] gap-4 bg-white rounded-3xl border border-gray-200 shadow-sm m-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center text-2xl font-black">
            ⚠️
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-800">Ops! Algo inesperado aconteceu nesta tela.</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md">
              {this.state.error?.message || 'Erro ao renderizar o módulo.'}
            </p>
          </div>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null })
              window.location.reload()
            }}
            className="px-5 py-2.5 bg-brand-600 text-white font-black text-xs rounded-xl hover:bg-brand-500 shadow-md cursor-pointer"
          >
            Recarregar Módulo
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function Layout() {
  useMaintenanceAutoReminder()
  useDailyAutoReminder()
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
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>

          {/* Botão de Voltar menor no canto inferior esquerdo no celular */}
          {!isHome && (
            <div className="lg:hidden fixed bottom-4 left-4 z-40">
              <button
                onClick={() => navigate('/dashboard')}
                style={{ backgroundColor: '#f8df86', borderColor: '#e2c970', color: '#2f2f49' }}
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
