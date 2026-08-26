import {
  LayoutDashboard, Bot, Radar, CheckSquare, Bell,
  Users, PawPrint, AlertTriangle, HeartHandshake, Handshake, MessageSquare, Megaphone, PieChart, ShoppingBag,
  Gavel, Video, CalendarCheck,
  Building2, FolderOpen, BookOpen, FileSignature, Receipt, Shield, FileText,
  CreditCard, Target, FileText as Boleto, Scale, Building, Calculator,
  CalendarCheck as Reservas, Wrench, DoorOpen, Package, QrCode, Car, Camera,
  Briefcase,
  UserCog,
  BarChart3,
  Settings, MessageCircleCode, Mail, UserCog as Usuarios2
} from 'lucide-react'

export const navGroups = [
  {
    label: '🏠 Visão Geral',
    emoji: '🏠',
    items: [
      { to: '/dashboard',        label: 'Dashboard',            icon: LayoutDashboard },
      { to: '/alpha-ai',         label: 'Alpha IA',             icon: Bot },
      { to: '/radar',            label: 'Radar de Convivência', icon: Radar },
      { to: '/tarefas',          label: 'Tarefas & Agenda',     icon: CheckSquare },
      { to: '/monitoramento-ia', label: 'Monitoramento IA',     icon: BarChart3 },
    ]
  },
  {
    label: '👥 Pessoas',
    emoji: '👥',
    items: [
      { to: '/moradores',   label: 'Moradores',        icon: Users },
      { to: '/pets',        label: 'Pets',             icon: PawPrint },
      { to: '/ocorrencias', label: 'Solicitações',     icon: AlertTriangle },
      { to: '/conviver',    label: 'Conviver+',        icon: HeartHandshake },
      { to: '/mediacao',    label: 'Mediação & ODR',   icon: Handshake },
      { to: '/comunicacao', label: 'Comunicação',      icon: MessageSquare },
      { to: '/mural',       label: '↳ Mural de Recados', icon: Megaphone },
      { to: '/enquetes',    label: '↳ Enquetes',       icon: PieChart },
      { to: '/classificados',label: '↳ Classificados', icon: ShoppingBag },
    ]
  },
  {
    label: '📅 Eventos & Reuniões',
    emoji: '📅',
    items: [
      { to: '/assembleias',  label: 'Assembleias',       icon: Gavel },
      { to: '/conferencias', label: 'Reuniões Online',   icon: Video },
      { to: '/eventos',      label: 'Eventos & Check-in',icon: CalendarCheck },
    ]
  },
  {
    label: '🏢 Gestão',
    emoji: '🏢',
    items: [
      { to: '/condominios', label: 'Gestão do Condomínio', icon: Building2 },
      { to: '/documentos',  label: 'Documentos',           icon: FolderOpen },
      { to: '/regime',      label: 'Regimentos',           icon: BookOpen },
      { to: '/contratos',   label: 'Contratos & Documentos', icon: FileSignature },
      { to: '/notas-fiscais',label: 'Fiscal',              icon: Receipt },
      { to: '/seguro',      label: 'Seguros',              icon: Shield },
      { to: '/relatorios',  label: 'Relatórios',           icon: FileText },
    ]
  },
  {
    label: '💰 Financeiro',
    emoji: '💰',
    items: [
      { to: '/financeiro',   label: 'Receitas & Despesas',        icon: CreditCard },
      { to: '/plano-contas', label: 'Orçamento & Plano de Contas',icon: Target },
      { to: '/boletos',      label: 'Boletos & Fundos',           icon: FileText },
      { to: '/inadimplencia',label: 'Inadimplência & Jurídico',   icon: Scale },
      { to: '/locacao',      label: 'Locações',                   icon: Building },
      { to: '/calculadora',  label: 'Calculadoras',               icon: Calculator },
    ]
  },
  {
    label: '🔧 Operação',
    emoji: '🔧',
    items: [
      { to: '/reservas',    label: 'Reservas',                 icon: CalendarCheck },
      { to: '/manutencoes', label: 'Manutenção & Suprimentos', icon: Wrench },
      { to: '/portaria',    label: 'Portaria & Rondas',        icon: DoorOpen },
      { to: '/encomendas',  label: 'Encomendas',               icon: Package },
      { to: '/visitantes',  label: 'Visitantes',               icon: QrCode },
      { to: '/veiculos',    label: 'Garagem',                  icon: Car },
      { to: '/cameras',     label: 'Câmeras & Segurança',      icon: Camera },
    ]
  },
  {
    label: '🤝 Fornecedores',
    emoji: '🤝',
    items: [
      { to: '/prestadores', label: 'Fornecedores & Prestadores', icon: Briefcase },
    ]
  },
  {
    label: '👨‍💼 RH',
    emoji: '👨‍💼',
    items: [
      { to: '/rh',          label: 'Funcionários',  icon: UserCog },
      { to: '/recrutamento',label: 'Recrutamento',  icon: Users },
    ]
  },
  {
    label: '⚙️ Configurações',
    emoji: '⚙️',
    isConfig: true,
    items: [
      { to: '/usuarios',  label: 'Usuários & Permissões', icon: Usuarios2 },
      { to: '/whatsapp',  label: 'WhatsApp',              icon: MessageCircleCode },
      { to: '/email',     label: 'E-mail Alpha',          icon: Mail },
      { to: '/monitoramento-ia', label: 'Monitoramento IA', icon: Bot },
    ]
  },
]

export function getFilteredNavGroups(user) {
  const userPerms = user?.permissoes || []
  const isAdmin = user?.role === 'Administrador'
  const isMorador = user?.role === 'Morador'

  const ALWAYS_ALLOWED = new Set([
    'alpha-ai', 'pets', 'mediacao', 'conviver', 'radar',
    'mural', 'enquetes', 'classificados', 'comunicacao',
    'seguro', 'regime', 'documentos'
  ])

  const MORADOR_ALLOWED = new Set([
    'financeiro', 'manutencoes', 'seguro', 'regime', 'documentos',
    'comunicacao', 'mural', 'enquetes', 'classificados',
    'ocorrencias', 'reservas', 'visitantes'
  ])

  return navGroups.map(group => ({
    ...group,
    items: group.items.filter(item => {
      let reqPerm = item.to.replace('/', '')

      // Permissões especiais
      if (ALWAYS_ALLOWED.has(reqPerm)) return true
      if (isMorador && MORADOR_ALLOWED.has(reqPerm)) return true

      // Notas fiscais só para admin e financeiro
      if (reqPerm === 'notas-fiscais' && !isAdmin && user?.role !== 'Financeiro') return false

      // Mapeamentos especiais
      if (reqPerm === 'plano-contas') reqPerm = 'financeiro'
      if (reqPerm === 'conferencias' || reqPerm === 'recrutamento') reqPerm = 'rh'

      return isAdmin || userPerms.includes(reqPerm)
    }).map(item => ({
      ...item,
      // Boletos: nome simplificado para Síndico e Morador
      label: item.to === '/boletos' && (isMorador || user?.role === 'Síndico')
        ? 'Boletos'
        : item.label
    }))
  })).filter(group => group.items.length > 0)
}
