// src/utils/navData.js
import {
  LayoutDashboard, Bot, Radar, CheckSquare, BarChart3,
  Users, PawPrint, AlertTriangle, HeartHandshake, Handshake, MessageSquare,
  Megaphone, PieChart, ShoppingBag, Gavel, Video, CalendarCheck,
  Building2, FolderOpen, BookOpen, FileSignature, Receipt, Shield, FileText,
  CreditCard, Target, Scale, Building, Calculator,
  CalendarCheck as Reservas, Wrench, DoorOpen, Package, QrCode, Car, Camera,
  Briefcase, UserCog, Settings, MessageCircleCode, Mail, UserCog as Usuarios2,
  FileSpreadsheet
} from 'lucide-react'

export const navGroups = [
  // 🏠 Visão Geral
  {
    label: '🏠 Visão Geral',
    emoji: '🏠',
    items: [
      { to: '/dashboard',        label: 'Dashboard',            icon: LayoutDashboard },
      { to: '/alpha-ai',         label: 'Alpha IA',             icon: Bot },
      { to: '/monitoramento-ia', label: 'Monitoramento IA',     icon: BarChart3 },
      { to: '/whatsapp',         label: 'WhatsApp',             icon: MessageCircleCode },
      { to: '/email',            label: 'E-mail Alpha',         icon: Mail },
      { to: '/radar',            label: 'Radar de Convivência', icon: Radar },
      { to: '/tarefas',          label: 'Agenda & Tarefas',     icon: CheckSquare },
    ]
  },
  // 👥 Pessoas
  {
    label: '👥 Pessoas',
    emoji: '👥',
    items: [
      { to: '/moradores',    label: 'Moradores',             icon: Users },
      { to: '/pets',         label: 'Pets',                  icon: PawPrint },
      { to: '/condominios',  label: 'Condomínios',           icon: Building2 },
      { to: '/usuarios',     label: 'Usuários & Permissões', icon: Settings },
      { to: '/ocorrencias',  label: 'Solicitações',          icon: AlertTriangle },
      { to: '/conviver',     label: 'Conviver+',             icon: HeartHandshake },
      { to: '/comunicacao',  label: 'Comunicação',           icon: MessageSquare },
      { to: '/mural',        label: '↳ Mural de Recados',    icon: Megaphone },
      { to: '/enquetes',     label: '↳ Enquetes',            icon: PieChart },
      { to: '/classificados',label: '↳ Classificados',       icon: ShoppingBag },
      { to: '/mediacao',     label: 'Mediação & ODR',        icon: Handshake },
    ]
  },
  // 📅 Eventos & Reuniões
  {
    label: '📅 Eventos & Reuniões',
    emoji: '📅',
    items: [
      { to: '/assembleias',  label: 'Assembleias',          icon: Gavel },
      { to: '/conferencias', label: 'Reuniões Online',      icon: Video },
      { to: '/eventos',      label: 'Eventos & Check-in',   icon: CalendarCheck },
    ]
  },
  // 🏢 Gestão
  {
    label: '🏢 Gestão',
    emoji: '🏢',
    items: [
      { to: '/condominios',   label: 'Gestão do Condomínio',   icon: Building2 },
      { to: '/documentos',    label: 'Documentos',             icon: FolderOpen },
      { to: '/regime',        label: 'Regimentos',             icon: BookOpen },
      { to: '/contratos',     label: 'Contratos & Documentos', icon: FileSignature },
      { to: '/notas-fiscais', label: 'Notas Fiscais',          icon: Receipt },
      { to: '/seguro',        label: 'Seguros',                icon: Shield },
    ]
  },
  // 💰 Financeiro
  {
    label: '💰 Financeiro',
    emoji: '💰',
    items: [
      { to: '/financeiro',    label: 'Receitas & Despesas',        icon: CreditCard },
      { to: '/plano-contas',  label: 'Orçamento & Plano de Contas',icon: Target },
      { to: '/boletos',       label: 'Boletos & Fundos',           icon: FileText },
      { to: '/inadimplencia', label: 'Inadimplência & Jurídico',   icon: Scale },
      { to: '/locacao',       label: 'Locações',                   icon: Building },
      { to: '/calculadora',   label: 'Calculadoras',               icon: Calculator },
    ]
  },
  // 🔧 Operação
  {
    label: '🔧 Operação',
    emoji: '🔧',
    items: [
      { to: '/reservas',      label: 'Reservas',                 icon: Reservas },
      { to: '/manutencoes',   label: 'Manutenção & Suprimentos',  icon: Wrench },
      { to: '/portaria',      label: 'Portaria & Rondas',        icon: DoorOpen },
      { to: '/encomendas',    label: 'Encomendas',               icon: Package },
      { to: '/visitantes',    label: 'Visitantes',               icon: QrCode },
      { to: '/veiculos',      label: 'Garagem',                  icon: Car },
      { to: '/cameras',       label: 'Câmeras & Segurança',      icon: Camera },
    ]
  },
  // 🤝 Fornecedores
  {
    label: '🤝 Fornecedores',
    emoji: '🤝',
    items: [
      { to: '/prestadores',   label: 'Fornecedores',             icon: Briefcase },
      { to: '/cotacoes',      label: 'Cotações & Comparativos',  icon: FileSpreadsheet },
      { to: '/contratos',     label: 'Contratos',                icon: FileSignature },
    ]
  },
  // 👨‍💼 RH
  {
    label: '👨‍💼 RH',
    emoji: '👨‍💼',
    items: [
      { to: '/rh',            label: 'Funcionários',             icon: UserCog },
      { to: '/recrutamento',  label: 'Recrutamento',             icon: Users },
      { to: '/financeiro',    label: 'Receitas & Despesas',      icon: CreditCard },
    ]
  },
  // 📊 Relatórios
  {
    label: '📊 Relatórios',
    emoji: '📊',
    items: [
      { to: '/relatorios',    label: 'Relatórios',               icon: FileText },
    ]
  },
]

export function getFilteredNavGroups(user) {
  const isMorador = user?.role === 'Morador'

  // SE FOR MORADOR: Portal do Morador exclusivo e simplificado
  if (isMorador) {
    return [
      {
        label: '🏠 Portal do Morador',
        emoji: '🏠',
        items: [
          { to: '/dashboard',   label: 'Meu Painel',                icon: LayoutDashboard },
          { to: '/alpha-ai',    label: 'Alpha IA (Concierge)',       icon: Bot },
          { to: '/boletos',     label: 'Minha Situação Financeira', icon: CreditCard },
          { to: '/documentos',  label: 'Documentos do Condomínio',  icon: FolderOpen },
          { to: '/mural',       label: 'Comunicados & Mural',       icon: Megaphone },
          { to: '/ocorrencias', label: 'Minhas Solicitações',       icon: AlertTriangle },
          { to: '/reservas',    label: 'Reservas de Espaços',       icon: Reservas },
          { to: '/assembleias', label: 'Assembleias & Votação',     icon: Gavel },
          { to: '/veiculos',    label: 'Cadastro de Veículos',      icon: Car },
          { to: '/visitantes',  label: 'Autorizar Visitantes',      icon: QrCode },
          { to: '/relatorios',  label: 'Prestação de Contas',       icon: FileSpreadsheet }
        ]
      }
    ]
  }

  const userPerms = user?.permissoes || []
  const isAdmin = user?.role === 'Administrador'

  const ALWAYS_ALLOWED = new Set([
    'alpha-ai', 'pets', 'mediacao', 'conviver', 'radar',
    'mural', 'enquetes', 'classificados', 'comunicacao',
    'seguro', 'regime', 'documentos', 'monitoramento-ia',
    'whatsapp', 'email', 'condominios', 'relatorios', 'tarefas',
    'cotacoes'
  ])

  return navGroups.map(group => ({
    ...group,
    items: group.items.filter(item => {
      let reqPerm = item.to.replace('/', '')

      // Permissões especiais
      if (ALWAYS_ALLOWED.has(reqPerm)) return true

      // Notas fiscais só para admin e financeiro
      if (reqPerm === 'notas-fiscais' && !isAdmin && user?.role !== 'Financeiro') return false

      // Mapeamentos especiais
      if (reqPerm === 'plano-contas') reqPerm = 'financeiro'
      if (reqPerm === 'conferencias' || reqPerm === 'recrutamento') reqPerm = 'rh'

      return isAdmin || userPerms.includes(reqPerm)
    })
  })).filter(group => group.items.length > 0)
}
