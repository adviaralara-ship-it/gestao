import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Condominios from './pages/Condominios'
import Moradores from './pages/Moradores'
import RH from './pages/RH'
import Prestadores from './pages/Prestadores'
import Usuarios from './pages/Usuarios'
import Financeiro from './pages/Financeiro'
import Boletos from './pages/Boletos'
import NotasFiscais from './pages/NotasFiscais'
import Assembleias from './pages/Assembleias'
import Ocorrencias from './pages/Ocorrencias'
import Reservas from './pages/Reservas'
import Eventos from './pages/Eventos'
import Portaria from './pages/Portaria'
import Seguro from './pages/Seguro'
import Regime from './pages/Regime'
import Documentos from './pages/Documentos'
import Comunicacao from './pages/Comunicacao'
import WhatsApp from './pages/WhatsApp'
import Email from './pages/Email'
import Relatorios from './pages/Relatorios'
import Encomendas from './pages/Encomendas'
import Visitantes from './pages/Visitantes'
import ValidaVisitante from './pages/ValidaVisitante'
import ValidaConvidado from './pages/ValidaConvidado'
import Enquetes from './pages/Enquetes'
import Classificados from './pages/Classificados'
import Tarefas from './pages/Tarefas'
import Cadastro from './pages/Cadastro'
import Manutencoes from './pages/Manutencoes'
import Veiculos from './pages/Veiculos'
import Cameras from './pages/Cameras'
import Calculadora from './pages/Calculadora'
import PontoEletronico from './pages/PontoEletronico'
import Conferencias from './pages/Conferencias'
import Recrutamento from './pages/Recrutamento'
import Mural from './pages/Mural'
import MonitoramentoIA from './pages/MonitoramentoIA'
import Inadimplencia from './pages/Inadimplencia'
import Locacao from './pages/Locacao'
import GeradorContratos from './pages/GeradorContratos'
import PortalFornecedores from './pages/PortalFornecedores'
import PortalVagas from './pages/PortalVagas'
import OnboardingCandidato from './pages/OnboardingCandidato'
import Pets from './pages/Pets'
import Totem from './pages/Totem'
import Mediacao from './pages/Mediacao'
import MediacaoNova from './pages/MediacaoNova'
import MediacaoSalaExterna from './pages/MediacaoSalaExterna'

// Spinner de carregamento enquanto o Firebase Auth verifica a sessão
function AuthLoader() {
  return (
    <div className="min-h-screen bg-cream-300 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        <p className="text-sm text-brand-600 font-medium">Verificando acesso...</p>
      </div>
    </div>
  )
}

function PrivateRoute({ children }) {
  const { user, authLoading } = useAuth()
  if (authLoading) return <AuthLoader />
  return user ? (
    <>
      {children}
    </>
  ) : (
    <Navigate to="/login" replace />
  )
}

function AuthorizedRoute({ module, children }) {
  const { user, authLoading } = useAuth()
  if (authLoading) return <AuthLoader />
  if (!user) return <Navigate to="/login" replace />
  
  // Se o módulo for home/index, manda pro primeiro permitido
  if (!module) {
    if (user.permissoes?.length > 0) return <Navigate to={`/${user.permissoes[0]}`} replace />
    return <Navigate to="/login" replace />
  }

  // Verifica se o usuário tem permissão para a rota específica
  let hasPerm = user.permissoes?.includes(module) || user.role === 'Administrador' || module === 'pets' || module === 'mediacao'
  if ((module === 'conferencias' || module === 'recrutamento') && user.permissoes?.includes('rh')) hasPerm = true
  
  if (!hasPerm) {
    if (user.permissoes?.length > 0) return <Navigate to={`/${user.permissoes[0]}`} replace />
    return <Navigate to="/login" replace />
  }

  return children
}

// ─── Botão WhatsApp flutuante ───────────────────────────────────────────────
const WHATSAPP_NUMBER = '5511999999999' // ⬅️ Troque pelo número do síndico (com DDI+DDD)
function WhatsAppButton() {
  const [tooltip, setTooltip] = useState(false)
  return (
    <a
      href={`https://wa.me/${WHATSAPP_NUMBER}?text=Olá!%20Preciso%20de%20suporte%20do%20condomínio.`}
      target="_blank"
      rel="noreferrer"
      onMouseEnter={() => setTooltip(true)}
      onMouseLeave={() => setTooltip(false)}
      className="fixed bottom-36 right-5 z-50 flex items-center gap-2 group"
    >
      {tooltip && (
        <div className="bg-white border border-cream-400 text-gray-700 text-xs font-medium px-3 py-2 rounded-xl shadow-lg whitespace-nowrap animate-fade-in">
          💬 Falar com o Síndico
        </div>
      )}
      <div className="w-14 h-14 bg-green-500 hover:bg-green-400 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30 transition-all hover:scale-110 active:scale-95">
        <svg viewBox="0 0 24 24" fill="white" width="28" height="28">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </div>
    </a>
  )
}

function AppRoutes() {
  const { user, authLoading } = useAuth()
  return (
    <>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
        {/* /cadastro: mostra formulário apenas se não logado; usuário logado vai ao dashboard */}
        <Route path="/cadastro" element={user ? <Navigate to="/dashboard" replace /> : <Cadastro />} />
        <Route path="/visitantes/valida/:id" element={<ValidaVisitante />} />
        <Route path="/eventos/valida/:id" element={<ValidaConvidado />} />
        <Route path="/ponto" element={<PontoEletronico />} />
        <Route path="/fornecedores" element={<PortalFornecedores />} />
        <Route path="/trabalhe-conosco" element={<PortalVagas />} />
        <Route path="/onboarding/:id" element={<OnboardingCandidato />} />
        <Route path="/totem" element={<Totem />} />
        {/* Rota pública para o morador acessar e assinar o termo de mediação ODR */}
        <Route path="/mediacao/sala/:id" element={<MediacaoSalaExterna />} />
        
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<AuthorizedRoute module=""><span /></AuthorizedRoute>} />
          <Route path="dashboard" element={<AuthorizedRoute module="dashboard"><Dashboard /></AuthorizedRoute>} />
          <Route path="whatsapp" element={<AuthorizedRoute module="whatsapp"><WhatsApp /></AuthorizedRoute>} />
          <Route path="email" element={<AuthorizedRoute module="email"><Email /></AuthorizedRoute>} />
          <Route path="encomendas" element={<AuthorizedRoute module="encomendas"><Encomendas /></AuthorizedRoute>} />
          <Route path="visitantes" element={<AuthorizedRoute module="visitantes"><Visitantes /></AuthorizedRoute>} />
          <Route path="enquetes" element={<AuthorizedRoute module="enquetes"><Enquetes /></AuthorizedRoute>} />
          <Route path="classificados" element={<AuthorizedRoute module="classificados"><Classificados /></AuthorizedRoute>} />
          <Route path="condominios" element={<AuthorizedRoute module="condominios"><Condominios /></AuthorizedRoute>} />
          <Route path="moradores" element={<AuthorizedRoute module="moradores"><Moradores /></AuthorizedRoute>} />
          <Route path="pets" element={<AuthorizedRoute module="pets"><Pets /></AuthorizedRoute>} />
          <Route path="rh" element={<AuthorizedRoute module="rh"><RH /></AuthorizedRoute>} />
          <Route path="conferencias" element={<AuthorizedRoute module="conferencias"><Conferencias /></AuthorizedRoute>} />
          <Route path="recrutamento" element={<AuthorizedRoute module="recrutamento"><Recrutamento /></AuthorizedRoute>} />
          <Route path="mural" element={<AuthorizedRoute module="mural"><Mural /></AuthorizedRoute>} />
          <Route path="monitoramento-ia" element={<AuthorizedRoute module="monitoramento-ia"><MonitoramentoIA /></AuthorizedRoute>} />
          <Route path="prestadores" element={<AuthorizedRoute module="prestadores"><Prestadores /></AuthorizedRoute>} />
          <Route path="usuarios" element={<AuthorizedRoute module="usuarios"><Usuarios /></AuthorizedRoute>} />
          <Route path="financeiro" element={<AuthorizedRoute module="financeiro"><Financeiro /></AuthorizedRoute>} />
          <Route path="boletos" element={<AuthorizedRoute module="boletos"><Boletos /></AuthorizedRoute>} />
          <Route path="notas-fiscais" element={<AuthorizedRoute module="notas-fiscais"><NotasFiscais /></AuthorizedRoute>} />
          <Route path="inadimplencia" element={<AuthorizedRoute module="inadimplencia"><Inadimplencia /></AuthorizedRoute>} />
          <Route path="mediacao" element={<AuthorizedRoute module="mediacao"><Mediacao /></AuthorizedRoute>} />
          <Route path="mediacao/nova" element={<AuthorizedRoute module="mediacao"><MediacaoNova /></AuthorizedRoute>} />
          <Route path="locacao" element={<AuthorizedRoute module="locacao"><Locacao /></AuthorizedRoute>} />
          <Route path="contratos" element={<AuthorizedRoute module="contratos"><GeradorContratos /></AuthorizedRoute>} />
          <Route path="assembleias" element={<AuthorizedRoute module="assembleias"><Assembleias /></AuthorizedRoute>} />
          <Route path="eventos" element={<AuthorizedRoute module="eventos"><Eventos /></AuthorizedRoute>} />
          <Route path="ocorrencias" element={<AuthorizedRoute module="ocorrencias"><Ocorrencias /></AuthorizedRoute>} />
          <Route path="reservas" element={<AuthorizedRoute module="reservas"><Reservas /></AuthorizedRoute>} />
          <Route path="portaria" element={<AuthorizedRoute module="portaria"><Portaria /></AuthorizedRoute>} />
          <Route path="seguro" element={<AuthorizedRoute module="seguro"><Seguro /></AuthorizedRoute>} />
          <Route path="regime" element={<AuthorizedRoute module="regime"><Regime /></AuthorizedRoute>} />
          <Route path="documentos" element={<AuthorizedRoute module="documentos"><Documentos /></AuthorizedRoute>} />
          <Route path="comunicacao" element={<AuthorizedRoute module="comunicacao"><Comunicacao /></AuthorizedRoute>} />
          <Route path="tarefas" element={<AuthorizedRoute module="tarefas"><Tarefas /></AuthorizedRoute>} />
          <Route path="relatorios" element={<AuthorizedRoute module="relatorios"><Relatorios /></AuthorizedRoute>} />
          <Route path="manutencoes" element={<AuthorizedRoute module="manutencoes"><Manutencoes /></AuthorizedRoute>} />
          <Route path="veiculos" element={<AuthorizedRoute module="veiculos"><Veiculos /></AuthorizedRoute>} />
          <Route path="cameras" element={<AuthorizedRoute module="cameras"><Cameras /></AuthorizedRoute>} />
          <Route path="calculadora" element={<AuthorizedRoute module="calculadora"><Calculadora /></AuthorizedRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
