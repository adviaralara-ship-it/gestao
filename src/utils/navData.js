import { Radar, HeartHandshake, 
  LayoutDashboard, Building2, Users, UserCog, Briefcase, Wrench,
  CreditCard, FileText, Receipt, Gavel, AlertTriangle, CalendarCheck,
  DoorOpen, Shield, BookOpen, FolderOpen, MessageSquare, Building, 
  CheckSquare, Package, QrCode, PieChart, ShoppingBag,
  Car, Video, Calculator, MessageCircleCode, Mail, Megaphone, Bot, Scale, PawPrint, FileSignature, Handshake
} from 'lucide-react'

export const navGroups = [
  {
    label: 'Painel',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/alpha-ai', label: 'Alpha IA', icon: Bot },
      { to: '/whatsapp', label: 'WhatsApp', icon: MessageCircleCode },
      { to: '/email', label: 'E-mail Alpha', icon: Mail },
      { to: '/condominios', label: 'CondomÃ­nios', icon: Building2 },
      { to: '/moradores', label: 'Moradores', icon: Users },
      { to: '/pets', label: 'Pets', icon: PawPrint },
    ]
  },
  {
    label: 'GestÃ£o',
    items: [
      { to: '/rh', label: 'Recursos Humanos', icon: UserCog },
      { to: '/notas-fiscais', label: 'Notas Fiscais', icon: Receipt },
      { to: '/recrutamento', label: 'Recrutamento', icon: Users },
      { to: '/usuarios', label: 'UsuÃ¡rios', icon: Users },
      { to: '/conferencias', label: 'ConferÃªncias', icon: Video },
      { to: '/prestadores', label: 'Prestadores', icon: Briefcase },
      { to: '/ocorrencias', label: 'SolicitaÃ§Ãµes', icon: AlertTriangle },
      { to: '/tarefas', label: 'Tarefas & Agenda', icon: CheckSquare },
      { to: '/conviver', label: 'MÃ©todo Conviver+', icon: HeartHandshake },
      { to: '/radar', label: 'Radar de ConvivÃªncia', icon: Radar },
      { to: '/monitoramento-ia', label: 'Monitoramento IA', icon: Bot },
      { to: '/eventos', label: 'Eventos & Check-in', icon: CalendarCheck },
    ]
  },
  {
    label: 'Financeiro',
    items: [
      { to: '/financeiro', label: 'Receitas & Despesas', icon: CreditCard },
      { to: '/plano-contas', label: 'PrevisÃ£o & Plano de Contas', icon: PieChart },
      { to: '/boletos', label: 'Boletos & Fundo', icon: FileText },
      { to: '/inadimplencia', label: 'InadimplÃªncia & JurÃ­dico', icon: Scale },
      { to: '/mediacao', label: 'MediaÃ§Ã£o & ODR', icon: Handshake },
      { to: '/contratos', label: 'Gerador de Contratos & Documentos', icon: FileSignature },
      { to: '/calculadora', label: 'Calculadora (Comercial)', icon: Calculator },
      { to: '/locacao', label: 'LocaÃ§Ã£o & AluguÃ©is', icon: Building },
    ]
  },
  {
    label: 'Operacional',
    items: [
      { to: '/reservas', label: 'Reservas', icon: CalendarCheck },
      { to: '/manutencoes', label: 'ManutenÃ§Ã£o & Compras', icon: Wrench },
      { to: '/portaria', label: 'Portaria & Rondas', icon: DoorOpen },
      { to: '/encomendas', label: 'Encomendas', icon: Package },
      { to: '/visitantes', label: 'Visitantes', icon: QrCode },
      { to: '/veiculos', label: 'VeÃ­culos & Garagem', icon: Car },
      { to: '/cameras', label: 'CÃ¢meras', icon: Video },
      { to: '/assembleias', label: 'Assembleias & Atas', icon: Gavel },
    ]
  },
  {
    label: 'Administrativo',
    items: [
      { to: '/seguro', label: 'Seguro', icon: Shield },
      { to: '/regime', label: 'Regime Interno/Externo', icon: BookOpen },
      { to: '/documentos', label: 'Documentos', icon: FolderOpen },
      { to: '/comunicacao', label: 'ComunicaÃ§Ã£o', icon: MessageSquare },
      { to: '/mural', label: 'Mural de Recados', icon: Megaphone },
      { to: '/enquetes', label: 'Enquetes', icon: PieChart },
      { to: '/classificados', label: 'Classificados', icon: ShoppingBag },
      { to: '/relatorios', label: 'RelatÃ³rios', icon: FileText },
    ]
  },
]

export function getFilteredNavGroups(user) {
  const userPerms = user?.permissoes || []

  return navGroups.map(group => ({
    ...group,
    items: group.items.filter(item => {
      if (item.to === '/notas-fiscais' && user?.role !== 'Administrador' && user?.role !== 'Financeiro') return false
      
      let reqPerm = item.to.replace('/', '')
      if (reqPerm === 'conferencias' || reqPerm === 'recrutamento') reqPerm = 'rh'
      if (reqPerm === 'plano-contas') reqPerm = 'financeiro'
      if (reqPerm === 'pets' || reqPerm === 'alpha-ai') return true
      const moradorAdminTabs = ['seguro', 'regime', 'documentos', 'comunicacao', 'mural', 'enquetes', 'classificados', 'relatorios']
      if (user?.role === 'Morador' && (reqPerm === 'financeiro' || reqPerm === 'manutencoes' || moradorAdminTabs.includes(reqPerm))) return true
      
      // FORÃ‡A A EXIBIÃ‡ÃƒO INDEPENDENTE DE QUEM ESTEJA LOGADO (apenas para teste)
      if (reqPerm === 'conviver' || reqPerm === 'radar') return true
      
      return userPerms.includes(reqPerm) || user?.role === 'Administrador'
    }).map(item => ({
      ...item,
      label: item.to === '/boletos' && (user?.role === 'Morador' || user?.role === 'SÃ­ndico') ? 'Boletos' : item.label
    }))
  })).filter(group => group.items.length > 0)
}
