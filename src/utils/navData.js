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
  const role = user?.role || ''
  const isMorador = role === 'Morador'
  const isConselho = role === 'Conselheiro' || role === 'Conselho' || role === 'Conselho Fiscal'
  const isSindico = role === 'Síndico' || role === 'Subsíndico'
  const isAdmin = role === 'Administrador'

  // 1. SE FOR MORADOR: Portal do Morador exclusivo
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
          { to: '/cameras',     label: 'Câmeras de Segurança',      icon: Camera },
          { to: '/relatorios',  label: 'Prestação de Contas',       icon: FileSpreadsheet }
        ]
      }
    ]
  }

  // 2. SE FOR CONSELHO FISCAL: Portal de Fiscalização e Auditoria
  if (isConselho) {
    return [
      {
        label: '🏛️ Conselho Fiscal',
        emoji: '🏛️',
        items: [
          { to: '/dashboard',     label: 'Dashboard Executivo',       icon: LayoutDashboard },
          { to: '/alpha-ai',      label: 'Alpha IA',                  icon: Bot },
          { to: '/financeiro',    label: 'Receitas & Despesas',       icon: CreditCard },
          { to: '/plano-contas',  label: 'Orçamento & Plano de Contas', icon: Target },
          { to: '/boletos',       label: 'Boletos & Inadimplência',   icon: FileText },
          { to: '/notas-fiscais', label: 'Notas Fiscais & Comprovantes', icon: Receipt },
          { to: '/cotacoes',      label: 'Cotações & Comparativos',   icon: FileSpreadsheet },
          { to: '/prestadores',   label: 'Fornecedores Cadastrados',  icon: Briefcase },
          { to: '/contratos',     label: 'Contratos & Seguros',       icon: FileSignature },
          { to: '/documentos',    label: 'Documentos & Regimentos',   icon: FolderOpen },
          { to: '/assembleias',   label: 'Assembleias & Atas',        icon: Gavel },
          { to: '/relatorios',    label: 'Prestação de Contas',       icon: FileText }
        ]
      }
    ]
  }

  // 3. SE FOR SÍNDICO / SUBSÍNDICO: Gestão do Condomínio (sem RH interno da Alpha)
  if (isSindico) {
    return [
      {
        label: '🏠 Visão Geral',
        emoji: '🏠',
        items: [
          { to: '/dashboard',    label: 'Dashboard',            icon: LayoutDashboard },
          { to: '/alpha-ai',     label: 'Alpha IA',             icon: Bot },
          { to: '/radar',        label: 'Radar de Convivência', icon: Radar },
          { to: '/tarefas',      label: 'Agenda & Tarefas',     icon: CheckSquare },
        ]
      },
      {
        label: '👥 Pessoas & Comunicação',
        emoji: '👥',
        items: [
          { to: '/moradores',    label: 'Moradores',             icon: Users },
          { to: '/pets',         label: 'Pets',                  icon: PawPrint },
          { to: '/ocorrencias',  label: 'Solicitações & Ocorrências', icon: AlertTriangle },
          { to: '/conviver',     label: 'Conviver+',             icon: HeartHandshake },
          { to: '/mural',        label: 'Mural de Recados',      icon: Megaphone },
          { to: '/enquetes',     label: 'Enquetes',              icon: PieChart },
          { to: '/mediacao',     label: 'Mediação & ODR',        icon: Handshake },
        ]
      },
      {
        label: '💰 Financeiro & Cotações',
        emoji: '💰',
        items: [
          { to: '/financeiro',    label: 'Receitas & Despesas',        icon: CreditCard },
          { to: '/plano-contas',  label: 'Orçamento & Plano de Contas', icon: Target },
          { to: '/boletos',       label: 'Boletos & Cobrança',         icon: FileText },
          { to: '/inadimplencia', label: 'Inadimplência & Jurídico',   icon: Scale },
          { to: '/cotacoes',      label: 'Cotações & Comparativos',    icon: FileSpreadsheet },
          { to: '/notas-fiscais', label: 'Notas Fiscais',              icon: Receipt },
        ]
      },
      {
        label: '🔧 Operação & Contratos',
        emoji: '🔧',
        items: [
          { to: '/manutencoes',   label: 'Manutenção & Suprimentos',  icon: Wrench },
          { to: '/contratos',     label: 'Contratos & Prestadores',   icon: FileSignature },
          { to: '/seguro',        label: 'Seguros',                   icon: Shield },
          { to: '/reservas',      label: 'Reservas de Áreas',         icon: Reservas },
          { to: '/portaria',      label: 'Portaria & Visitantes',     icon: DoorOpen },
          { to: '/encomendas',    label: 'Encomendas',                icon: Package },
          { to: '/veiculos',      label: 'Garagem & Veículos',        icon: Car },
          { to: '/cameras',       label: 'Câmeras CFTV',              icon: Camera },
        ]
      },
      {
        label: '📅 Eventos & Atas',
        emoji: '📅',
        items: [
          { to: '/assembleias',  label: 'Assembleias & Atas',    icon: Gavel },
          { to: '/conferencias', label: 'Reuniões Online',       icon: Video },
          { to: '/eventos',      label: 'Eventos & Check-in',    icon: CalendarCheck },
          { to: '/documentos',   label: 'Documentos do Condomínio', icon: FolderOpen },
          { to: '/regime',       label: 'Regimentos Internos',   icon: BookOpen },
          { to: '/relatorios',   label: 'Relatórios & Prestação', icon: FileText },
        ]
      }
    ]
  }

  // 4. SE FOR PORTEIRO / PORTARIA: Operação e Acesso Restrito
  const isPorteiro = role === 'Porteiro' || role === 'Portaria'
  if (isPorteiro) {
    return [
      {
        label: '🚪 Central da Portaria',
        emoji: '🚪',
        items: [
          { to: '/dashboard',   label: 'Dashboard da Portaria',     icon: LayoutDashboard },
          { to: '/portaria',    label: 'Portaria & Entradas',       icon: DoorOpen },
          { to: '/visitantes',  label: 'Visitantes & Convites',     icon: QrCode },
          { to: '/moradores',   label: 'Consultar Moradores',       icon: Users },
          { to: '/encomendas',  label: 'Controle de Encomendas',    icon: Package },
          { to: '/veiculos',    label: 'Garagem & Veículos',        icon: Car },
          { to: '/cameras',     label: 'Câmeras de Segurança',      icon: Camera },
          { to: '/ocorrencias', label: 'Ocorrências & Livro',       icon: AlertTriangle },
          { to: '/reservas',    label: 'Reservas de Espaços',       icon: Reservas },
          { to: '/mural',       label: 'Avisos da Portaria',        icon: Megaphone }
        ]
      }
    ]
  }

  // 5. SE FOR ADMIN MASTER (Alpha): Visão Completa Global
  const userPerms = user?.permissoes || []
  return navGroups.map(group => ({
    ...group,
    items: group.items.filter(item => {
      let reqPerm = item.to.replace('/', '')
      if (isAdmin) return true
      return userPerms.includes(reqPerm)
    })
  })).filter(group => group.items.length > 0)
}
