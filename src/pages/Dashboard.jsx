import React, { useState, useMemo } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import {
  TrendingUp, TrendingDown, Users, Building2, AlertTriangle, CalendarCheck, Calendar,
  CreditCard, DollarSign, FileText, Bell, Clock, Wrench, Shield, Plus,
  FileSpreadsheet, ArrowRight, CheckCircle2, AlertCircle, Sparkles, ChevronRight,
  ExternalLink, Layers, Eye, EyeOff, Bot, Megaphone, Car, QrCode, Gavel, FolderOpen, Check, User, Camera,
  DoorOpen, Package, PhoneCall, AlertOctagon, Truck, BookOpen, RefreshCw, PawPrint, Home, Trash2, X,
  PieChart as PieIcon, Percent, ArrowUpRight, Filter, ShieldAlert
} from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { format, parseISO, differenceInDays } from 'date-fns'
import { isAlphaInterno } from './Financeiro'

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // Buscar dados reais do Firestore
  const { items: condominios }  = useFirestore('condominios')
  const { items: financeiro, deleteItem: deleteFinanceiro }   = useFirestore('financeiro_lancamentos')
  const { items: boletos, deleteItem: deleteBoleto }      = useFirestore('boletos')
  const { items: cotacoes }     = useFirestore('cotacoes')
  const { items: manutencoes }  = useFirestore('manutencoes')
  const { items: apolices }     = useFirestore('apolices')
  const { items: ocorrencias }  = useFirestore('ocorrencias')
  const { items: assembleias }  = useFirestore('assembleias')
  const { items: avisos }       = useFirestore('avisos')
  const { items: reservas }     = useFirestore('reservas')
  const { items: moradores }    = useFirestore('moradores')
  const { items: pets, deleteItem: deletePet } = useFirestore('pets')
  const { items: veiculos }     = useFirestore('veiculos')
  const { items: visitantes }   = useFirestore('visitantes')
  const { items: acessosPortaria } = useFirestore('portaria_visitantes')
  const { items: prestadores }  = useFirestore('portaria_prestadores')
  const { items: encomendas }   = useFirestore('encomendas')
  const { items: financeiroConfigs } = useFirestore('financeiro_config')
  const { items: financeiroContas }  = useFirestore('financeiro_contas')

  // =========================================================================
  // 1. SE FOR MORADOR -> PORTAL DO MORADOR
  // =========================================================================
  if (user?.role === 'Morador') {
    const meusBoletos = boletos.filter(b => {
      const uNome = (user?.nome || '').toLowerCase().trim()
      const uAptDigits = String(user?.apt || user?.unidade || '').replace(/\D/g, '')
      const uEmail = (user?.email || '').toLowerCase().trim()
      const bMorador = (b.morador || '').toLowerCase().trim()
      const bAptDigits = String(b.apt || b.unidade || '').replace(/\D/g, '')
      const bEmail = (b.email || '').toLowerCase().trim()

      const matchEmail = uEmail && bEmail && uEmail === bEmail
      const matchApt = uAptDigits && bAptDigits && uAptDigits === bAptDigits
      const matchNome = uNome && bMorador && (uNome === bMorador || uNome.includes(bMorador) || bMorador.includes(uNome))

      return matchEmail || matchApt || matchNome
    }).sort((a, b) => new Date(b.vencimento || 0) - new Date(a.vencimento || 0))

    const proximoBoleto = meusBoletos.find(b => b.status === 'Pendente' || b.status === 'Vencido') || meusBoletos[0]
    const emDia = !meusBoletos.some(b => b.status === 'Vencido')

    const avisosMorador = avisos.filter(a => {
      if (a.condominio && a.condominio !== 'Todos' && user?.condominio && a.condominio !== user.condominio) return false
      if (a.destino === 'Colaboradores') return false
      return true
    }).slice(0, 3)

    const minhasReservas = reservas.filter(r => {
      const matchNome = (r.morador || '').toLowerCase() === (user?.nome || '').toLowerCase()
      const matchApt = r.apt === user?.apt || r.apt === user?.unidade
      return matchNome || matchApt
    }).slice(0, 3)

    const minhasSolicitacoes = ocorrencias.filter(o => {
      const matchApt = o.apt === user?.apt || o.apt === user?.unidade
      const matchAutor = o.autor === user?.nome || o.nome_morador === user?.nome || o.uid === user?.uid
      return matchApt || matchAutor
    }).slice(0, 3)

    const uAptDigits = String(user?.unidade || user?.apt || '').replace(/\D/g, '')

    const meusFamiliares = moradores.filter(m => {
      const mAptDigits = String(m.apt || '').replace(/\D/g, '')
      const matchApt = uAptDigits && mAptDigits && uAptDigits === mAptDigits
      const matchCondo = !user?.condominio || m.condominio?.toLowerCase() === user?.condominio?.toLowerCase()
      return matchApt && matchCondo
    })

    const meusPets = pets.filter(p => {
      const pAptDigits = String(p.apt || '').replace(/\D/g, '')
      const matchApt = uAptDigits && pAptDigits && uAptDigits === pAptDigits
      const matchCondo = !user?.condominio || p.condominio?.toLowerCase() === user?.condominio?.toLowerCase()
      const matchDono = p.dono && user?.nome && p.dono.toLowerCase() === user?.nome.toLowerCase()
      return (matchApt && matchCondo) || matchDono
    })

    return (
      <div className="flex flex-col gap-6 animate-fade-in max-w-6xl mx-auto pb-12">
        {/* Header do Morador */}
        <div className="bg-gradient-to-r from-[#2d3045] to-[#1e2030] text-white p-6 rounded-3xl shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-brand-500 flex items-center justify-center font-black text-2xl text-white shadow-inner border-2 border-white/20">
              {user?.nome?.charAt(0) || 'M'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black">{user?.nome || 'Morador'}</h1>
                <span className="bg-emerald-500/30 text-emerald-300 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                  {user?.status || 'Morador'}
                </span>
              </div>
              <p className="text-gray-300 text-xs md:text-sm font-medium mt-0.5 flex items-center gap-2">
                <Building2 size={14} className="text-brand-300" /> {user?.condominio || 'Condomínio'}
                <span>•</span>
                <span>Bloco {user?.bloco || '1'}</span>
                <span>•</span>
                <span>Unidade {user?.unidade || user?.apt || '—'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/alpha-ai')}
              className="bg-brand-500 hover:bg-brand-400 text-white text-xs font-black px-4 py-2.5 rounded-xl shadow-md flex items-center gap-2 transition-transform hover:scale-105"
            >
              <Bot size={16} /> Falar com Alpha IA
            </button>
            <button
              onClick={() => navigate('/ocorrencias')}
              className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all flex items-center gap-2"
            >
              <FileText size={16} /> Solicitações
            </button>
          </div>
        </div>

        {/* Serviços Rápidos no Topo */}
        <div className="bg-white p-5 rounded-2xl border border-pale-300 shadow-sm">
          <h3 className="font-bold text-gray-900 text-sm mb-3">Serviços Rápidos do Condomínio</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 text-center">
            <button
              onClick={() => navigate('/veiculos')}
              className="p-3.5 bg-slate-50 hover:bg-brand-50 hover:border-brand-300 rounded-xl border border-gray-200 transition-all flex flex-col items-center gap-2 group cursor-pointer"
            >
              <Car size={22} className="text-gray-600 group-hover:text-brand-600" />
              <span className="text-xs font-bold text-gray-700 group-hover:text-brand-700">Meus Veículos</span>
            </button>

            <button
              onClick={() => navigate('/visitantes')}
              className="p-3.5 bg-slate-50 hover:bg-brand-50 hover:border-brand-300 rounded-xl border border-gray-200 transition-all flex flex-col items-center gap-2 group cursor-pointer"
            >
              <QrCode size={22} className="text-gray-600 group-hover:text-brand-600" />
              <span className="text-xs font-bold text-gray-700 group-hover:text-brand-700">Autorizar Visitante</span>
            </button>

            <button
              onClick={() => navigate('/cameras')}
              className="p-3.5 bg-slate-50 hover:bg-brand-50 hover:border-brand-300 rounded-xl border border-gray-200 transition-all flex flex-col items-center gap-2 group cursor-pointer"
            >
              <Camera size={22} className="text-gray-600 group-hover:text-brand-600" />
              <span className="text-xs font-bold text-gray-700 group-hover:text-brand-700">Câmeras CFTV</span>
            </button>

            <button
              onClick={() => navigate('/documentos')}
              className="p-3.5 bg-slate-50 hover:bg-brand-50 hover:border-brand-300 rounded-xl border border-gray-200 transition-all flex flex-col items-center gap-2 group cursor-pointer"
            >
              <FolderOpen size={22} className="text-gray-600 group-hover:text-brand-600" />
              <span className="text-xs font-bold text-gray-700 group-hover:text-brand-700">Documentos</span>
            </button>

            <button
              onClick={() => navigate('/assembleias')}
              className="p-3.5 bg-slate-50 hover:bg-brand-50 hover:border-brand-300 rounded-xl border border-gray-200 transition-all flex flex-col items-center gap-2 group cursor-pointer"
            >
              <Gavel size={22} className="text-gray-600 group-hover:text-brand-600" />
              <span className="text-xs font-bold text-gray-700 group-hover:text-brand-700">Assembleias</span>
            </button>

            <button
              onClick={() => navigate('/relatorios')}
              className="p-3.5 bg-slate-50 hover:bg-brand-50 hover:border-brand-300 rounded-xl border border-gray-200 transition-all flex flex-col items-center gap-2 group cursor-pointer"
            >
              <FileSpreadsheet size={22} className="text-gray-600 group-hover:text-brand-600" />
              <span className="text-xs font-bold text-gray-700 group-hover:text-brand-700">Prestação Contas</span>
            </button>

            <button
              onClick={() => navigate('/alpha-ai')}
              className="p-3.5 bg-slate-50 hover:bg-brand-50 hover:border-brand-300 rounded-xl border border-gray-200 transition-all flex flex-col items-center gap-2 group cursor-pointer"
            >
              <Bot size={22} className="text-brand-600" />
              <span className="text-xs font-bold text-brand-700">Alpha IA</span>
            </button>
          </div>
        </div>

        {/* Grade Principal: Financeiro & Avisos */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card: Minha Situação Financeira */}
          <div className="bg-white p-6 rounded-2xl border border-pale-300 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                    <CreditCard size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base leading-tight">Situação Financeira</h3>
                    <p className="text-xs text-gray-400">Unidade {user?.unidade || user?.apt}</p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${emDia ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                  {emDia ? 'Em Dia' : 'Débitos Pendentes'}
                </span>
              </div>

              {proximoBoleto ? (
                <div className="bg-slate-50 p-4 rounded-xl border border-gray-200 mb-4">
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Próximo Vencimento</p>
                  <p className="text-2xl font-black text-gray-900 mt-1">
                    R$ {(parseFloat(proximoBoleto.valor) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-gray-600 font-medium mt-0.5">
                    Vencimento: <b className="text-gray-900">{proximoBoleto.vencimento}</b> ({proximoBoleto.competencia || 'Mês Atual'})
                  </p>
                </div>
              ) : (
                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 text-center text-emerald-800 text-xs font-bold mb-4">
                  Nenhum boleto em aberto para a sua unidade. Parabéns!
                </div>
              )}
            </div>

            <button
              onClick={() => navigate('/boletos')}
              className="btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-2 shadow-sm"
            >
              <FileText size={15} /> Ver Todos os Boletos & Extrato
            </button>
          </div>

          {/* Card: Avisos & Comunicados Recentes */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-pale-300 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700">
                    <Megaphone size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base leading-tight">Avisos & Comunicados</h3>
                    <p className="text-xs text-gray-400">Informativos oficiais do condomínio</p>
                  </div>
                </div>
                <button onClick={() => navigate('/mural')} className="text-xs font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1">
                  Ver Mural Completo <ChevronRight size={14} />
                </button>
              </div>

              <div className="space-y-3">
                {avisosMorador.length === 0 ? (
                  <p className="text-xs text-gray-400 py-6 text-center">Nenhum comunicado recente no momento.</p>
                ) : (
                  avisosMorador.map(av => (
                    <div key={av.id} className="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-gray-200 transition-colors flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black bg-brand-100 text-brand-800 px-2 py-0.5 rounded-md uppercase">
                            {av.tipo || 'Aviso'}
                          </span>
                          <h4 className="font-bold text-gray-900 text-sm">{av.titulo}</h4>
                        </div>
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2 leading-relaxed">{av.texto}</p>
                      </div>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap font-medium">{av.data}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
              <button onClick={() => navigate('/mural')} className="text-xs font-bold text-gray-600 hover:text-brand-600">
                Acessar Mural de Recados →
              </button>
            </div>
          </div>
        </div>

        {/* Grade Secundária: Solicitações & Reservas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Minhas Solicitações */}
          <div className="bg-white p-6 rounded-2xl border border-pale-300 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
                    <Wrench size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base leading-tight">Minhas Solicitações</h3>
                    <p className="text-xs text-gray-400">Acompanhamento em tempo real</p>
                  </div>
                </div>
                <button onClick={() => navigate('/ocorrencias')} className="text-xs font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1">
                  Ver Todas <ChevronRight size={14} />
                </button>
              </div>

              <div className="space-y-2.5">
                {minhasSolicitacoes.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-xs">
                    <p>Nenhuma solicitação aberta no momento.</p>
                    <button onClick={() => navigate('/ocorrencias')} className="btn-secondary text-xs mt-3 py-1.5 px-3">
                      + Abrir Nova Solicitação
                    </button>
                  </div>
                ) : (
                  minhasSolicitacoes.map(s => (
                    <div key={s.id} className="p-3 bg-slate-50 rounded-xl border border-gray-200 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-gray-900 text-xs">{s.titulo}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">{s.categoria || 'Geral'} • {s.data}</p>
                      </div>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 uppercase">
                        {s.status || 'Aberta'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button
              onClick={() => navigate('/ocorrencias')}
              className="btn-secondary w-full py-2.5 text-xs font-bold mt-4"
            >
              + Abrir Chamado de Manutenção ou Dúvida
            </button>
          </div>

          {/* Minhas Reservas */}
          <div className="bg-white p-6 rounded-2xl border border-pale-300 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700">
                    <CalendarCheck size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base leading-tight">Minhas Reservas</h3>
                    <p className="text-xs text-gray-400">Salão de festas, churrasqueira, etc.</p>
                  </div>
                </div>
                <button onClick={() => navigate('/reservas')} className="text-xs font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1">
                  Ver Calendário <ChevronRight size={14} />
                </button>
              </div>

              <div className="space-y-2.5">
                {minhasReservas.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-xs">
                    <p>Nenhuma reserva agendada.</p>
                    <button onClick={() => navigate('/reservas')} className="btn-secondary text-xs mt-3 py-1.5 px-3">
                      + Reservar Espaço Comum
                    </button>
                  </div>
                ) : (
                  minhasReservas.map(r => (
                    <div key={r.id} className="p-3 bg-slate-50 rounded-xl border border-gray-200 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-gray-900 text-xs">{r.espaco || 'Área Comum'}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">Data: {r.data} • {r.horario || 'Dia Todo'}</p>
                      </div>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {r.status || 'Confirmada'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button
              onClick={() => navigate('/reservas')}
              className="btn-primary w-full py-2.5 text-xs font-bold mt-4"
            >
              + Solicitar Nova Reserva de Espaço
            </button>
          </div>
        </div>

        {/* Seção: Membros da Minha Unidade & Pets */}
        <div className="bg-white p-6 rounded-2xl border border-pale-300 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                <Users size={20} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base leading-tight">Membros da Minha Unidade & Pets</h3>
                <p className="text-xs text-gray-400">Familiares e animais de estimação cadastrados no seu apartamento</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/moradores')}
                className="btn-secondary text-xs font-bold py-1.5 px-3 flex items-center gap-1 shadow-sm"
              >
                <Plus size={14} /> Adicionar Familiar
              </button>
              <button
                onClick={() => navigate('/pets')}
                className="btn-secondary text-xs font-bold py-1.5 px-3 flex items-center gap-1 bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 shadow-sm"
              >
                <PawPrint size={14} className="text-amber-600" /> Cadastrar Pet
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bloco Familiares */}
            <div className="bg-slate-50 p-4 rounded-xl border border-gray-200">
              <p className="text-xs font-black text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Users size={14} className="text-brand-600" /> Familiares / Moradores ({meusFamiliares.length})
              </p>
              {meusFamiliares.length === 0 ? (
                <p className="text-xs text-gray-400 py-3">Nenhum membro cadastrado.</p>
              ) : (
                <div className="space-y-2">
                  {meusFamiliares.map(m => (
                    <div key={m.id} className="p-2.5 bg-white rounded-lg border border-gray-200 flex items-center justify-between gap-2 shadow-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {m.fotoRosto ? (
                          <img src={m.fotoRosto} alt={m.nome} className="w-8 h-8 rounded-full object-cover border border-brand-300" />
                        ) : (
                          <div className="w-8 h-8 bg-brand-100 text-brand-700 font-bold rounded-full flex items-center justify-center text-xs">
                            {m.nome?.[0] || 'M'}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 text-xs truncate">{m.nome}</p>
                          <p className="text-[10px] text-gray-500">{m.tel || m.email || 'Sem contato cadastrado'}</p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${m.status === 'Proprietário' ? 'bg-blue-100 text-blue-800' : m.status === 'Inquilino' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'}`}>
                        {m.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bloco Pets */}
            <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200">
              <p className="text-xs font-black text-amber-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <PawPrint size={14} className="text-amber-600" /> Animais de Estimação ({meusPets.length})
              </p>
              {meusPets.length === 0 ? (
                <div className="py-3 text-center">
                  <p className="text-xs text-amber-800 font-medium">Nenhum pet cadastrado para a sua unidade.</p>
                  <button onClick={() => navigate('/pets')} className="text-xs font-bold text-amber-700 underline mt-1 block">
                    + Clique aqui para cadastrar seu cãozinho, gato ou ave
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {meusPets.map(p => (
                    <div key={p.id} className="p-2.5 bg-white rounded-lg border border-amber-200 flex items-center justify-between gap-2 shadow-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-sm shrink-0">
                          🐾
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 text-xs truncate">{p.nome}</p>
                          <p className="text-[10px] text-gray-500">{p.tipo || 'Pet'} • {p.raca || p.porte || 'Médio'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md">
                          {p.porte || 'Médio'}
                        </span>
                        <button
                          onClick={() => {
                            if (window.confirm(`Deseja realmente remover o pet "${p.nome}"?`)) {
                              deletePet(p.id)
                            }
                          }}
                          className="p-1 hover:bg-red-100 text-gray-400 hover:text-red-600 rounded-md transition-colors"
                          title={`Remover pet ${p.nome}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // 2. SE FOR PORTEIRO -> DASHBOARD DA PORTARIA
  // =========================================================================
  if (user?.role === 'Porteiro' || user?.role === 'Portaria') {
    const hojeStr = new Date().toISOString().split('T')[0]
    const condo = user?.condominio || 'Todos'

    const filterCondo = (items) => {
      if (!condo || condo === 'Todos') return items
      return items.filter(i => !i.condominio || i.condominio === condo)
    }

    const visEsperados = filterCondo(visitantes).filter(v => {
      const isHoje = !v.dataVisita || v.dataVisita === hojeStr || v.dataVisita.startsWith(hojeStr)
      return v.status === 'Autorizado' && isHoje
    })

    const noLocal = filterCondo(acessosPortaria).filter(a => a.status === 'No local')
    const prestadoresNoLocal = filterCondo(prestadores).filter(p => p.status === 'No local')
    const encPendentes = filterCondo(encomendas).filter(e => e.status !== 'Retirada' && e.status !== 'Entregue')
    const totalMoradores = filterCondo(moradores).length
    const totalVeiculos = filterCondo(veiculos).length

    return (
      <div className="flex flex-col gap-6 animate-fade-in max-w-7xl mx-auto pb-16">
        {/* Header da Portaria */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 rounded-3xl shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-brand-600 flex items-center justify-center font-black text-2xl text-white shadow-inner border border-white/20">
              🚪
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black">{user?.nome || 'Porteiro'}</h1>
                <span className="bg-emerald-500/30 text-emerald-300 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                  Portaria Ativa
                </span>
              </div>
              <p className="text-gray-300 text-xs md:text-sm font-medium mt-0.5 flex items-center gap-2">
                <Building2 size={14} className="text-brand-300" /> {user?.condominio || 'Condomínio'}
                <span>•</span>
                <span>Turno: {format(new Date(), "EEEE, dd 'de' MMMM", { locale: undefined })}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/portaria')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black px-4 py-2.5 rounded-xl shadow-md flex items-center gap-2 transition-transform hover:scale-105"
            >
              <QrCode size={16} /> Ler QR Code de Acesso
            </button>
            <button
              onClick={() => navigate('/ocorrencias')}
              className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all flex items-center gap-2"
            >
              <AlertTriangle size={16} /> Nova Ocorrência
            </button>
          </div>
        </div>

        {/* Métricas Operacionais da Portaria */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div onClick={() => navigate('/moradores')} className="bg-white p-4 rounded-2xl border border-pale-300 shadow-sm hover:border-brand-400 cursor-pointer transition-all">
            <span className="text-[11px] font-bold text-gray-400 uppercase">Moradores</span>
            <p className="text-2xl font-black text-emerald-600 mt-1">{totalMoradores}</p>
            <span className="text-[10px] text-gray-500">Cadastrados</span>
          </div>

          <div onClick={() => navigate('/portaria')} className="bg-white p-4 rounded-2xl border border-pale-300 shadow-sm hover:border-brand-400 cursor-pointer transition-all">
            <span className="text-[11px] font-bold text-gray-400 uppercase">Esperados Hoje</span>
            <p className="text-2xl font-black text-amber-600 mt-1">{visEsperados.length}</p>
            <span className="text-[10px] text-gray-500">Pré-autorizados</span>
          </div>

          <div onClick={() => navigate('/portaria')} className="bg-white p-4 rounded-2xl border border-pale-300 shadow-sm hover:border-brand-400 cursor-pointer transition-all">
            <span className="text-[11px] font-bold text-gray-400 uppercase">No Condomínio</span>
            <p className="text-2xl font-black text-emerald-600 mt-1">{noLocal.length}</p>
            <span className="text-[10px] text-gray-500">Visitantes agora</span>
          </div>

          <div onClick={() => navigate('/portaria')} className="bg-white p-4 rounded-2xl border border-pale-300 shadow-sm hover:border-brand-400 cursor-pointer transition-all">
            <span className="text-[11px] font-bold text-gray-400 uppercase">Prestadores</span>
            <p className="text-2xl font-black text-blue-600 mt-1">{prestadoresNoLocal.length}</p>
            <span className="text-[10px] text-gray-500">Em serviço</span>
          </div>

          <div onClick={() => navigate('/encomendas')} className="bg-white p-4 rounded-2xl border border-pale-300 shadow-sm hover:border-brand-400 cursor-pointer transition-all">
            <span className="text-[11px] font-bold text-gray-400 uppercase">Encomendas</span>
            <p className="text-2xl font-black text-purple-600 mt-1">{encPendentes.length}</p>
            <span className="text-[10px] text-gray-500">Aguardando retirada</span>
          </div>

          <div onClick={() => navigate('/veiculos')} className="bg-white p-4 rounded-2xl border border-pale-300 shadow-sm hover:border-brand-400 cursor-pointer transition-all">
            <span className="text-[11px] font-bold text-gray-400 uppercase">Veículos</span>
            <p className="text-2xl font-black text-gray-800 mt-1">{totalVeiculos}</p>
            <span className="text-[10px] text-gray-500">Na garagem</span>
          </div>
        </div>

        {/* Atalhos Rápidos da Portaria */}
        <div className="bg-white p-6 rounded-3xl border border-pale-300 shadow-sm">
          <h3 className="font-bold text-gray-900 text-sm mb-4">Atalhos Rápidos de Operação</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-center">
            <button
              onClick={() => navigate('/portaria')}
              className="p-4 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 rounded-2xl border border-gray-200 transition-all flex flex-col items-center gap-2 group cursor-pointer"
            >
              <QrCode size={24} className="text-emerald-600" />
              <span className="text-xs font-bold text-gray-800">Ler QR Code</span>
            </button>

            <button
              onClick={() => navigate('/moradores')}
              className="p-4 bg-slate-50 hover:bg-brand-50 hover:border-brand-300 rounded-2xl border border-gray-200 transition-all flex flex-col items-center gap-2 group cursor-pointer"
            >
              <Users size={24} className="text-brand-600" />
              <span className="text-xs font-bold text-gray-800">Consultar Morador</span>
            </button>

            <button
              onClick={() => navigate('/encomendas')}
              className="p-4 bg-slate-50 hover:bg-purple-50 hover:border-purple-300 rounded-2xl border border-gray-200 transition-all flex flex-col items-center gap-2 group cursor-pointer"
            >
              <Package size={24} className="text-purple-600" />
              <span className="text-xs font-bold text-gray-800">Encomendas</span>
            </button>

            <button
              onClick={() => navigate('/veiculos')}
              className="p-4 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 rounded-2xl border border-gray-200 transition-all flex flex-col items-center gap-2 group cursor-pointer"
            >
              <Car size={24} className="text-blue-600" />
              <span className="text-xs font-bold text-gray-800">Consultar Veículo</span>
            </button>

            <button
              onClick={() => navigate('/cameras')}
              className="p-4 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 rounded-2xl border border-gray-200 transition-all flex flex-col items-center gap-2 group cursor-pointer"
            >
              <Camera size={24} className="text-indigo-600" />
              <span className="text-xs font-bold text-gray-800">Câmeras CFTV</span>
            </button>

            <button
              onClick={() => navigate('/ocorrencias')}
              className="p-4 bg-slate-50 hover:bg-rose-50 hover:border-rose-300 rounded-2xl border border-gray-200 transition-all flex flex-col items-center gap-2 group cursor-pointer"
            >
              <AlertTriangle size={24} className="text-rose-600" />
              <span className="text-xs font-bold text-gray-800">Livro de Ocorrências</span>
            </button>
          </div>
        </div>

        {/* Visitantes Esperados Hoje com Liberação Rápida */}
        <div className="bg-white rounded-3xl border border-amber-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 bg-amber-50/70 border-b border-amber-100 flex items-center justify-between">
            <h3 className="font-black text-amber-900 text-sm">
              🟡 Visitantes Pré-Autorizados Esperados Hoje
            </h3>
            <button onClick={() => navigate('/portaria')} className="text-xs font-bold text-brand-600 hover:text-brand-800">
              Abrir Controle Completo da Portaria →
            </button>
          </div>

          <div className="divide-y divide-gray-100">
            {visEsperados.length === 0 ? (
              <p className="text-xs text-gray-400 p-6 text-center">Nenhum visitante pré-autorizado aguardando chegada hoje.</p>
            ) : (
              visEsperados.map(v => (
                <div key={v.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-amber-50/30 transition-colors">
                  <div className="flex items-center gap-3">
                    {v.foto ? (
                      <img src={v.foto} alt={v.nome} className="w-10 h-10 rounded-full object-cover border-2 border-emerald-500 shadow-sm" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-100 border border-gray-200 flex items-center justify-center text-gray-400">
                        <User size={16} />
                      </div>
                    )}
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">{v.nome}</h4>
                      <p className="text-xs text-gray-600 mt-0.5">
                        Anfitrião: <b className="text-gray-900">{v.moradorNome || 'Morador'}</b> {v.apt ? `(Apt ${v.apt})` : ''} • Doc: {v.documento || '—'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate('/portaria')}
                    className="btn-primary py-2 px-4 text-xs font-black bg-emerald-600 hover:bg-emerald-500 flex items-center gap-1.5 shadow-sm"
                  >
                    <Check size={14} /> Liberar na Portaria
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // 3. GESTÃO / SÍNDICO / ADMINISTRADOR / CONSELHO (100% DADOS REAIS DO FIRESTORE)
  // =========================================================================
  const isAdm = user?.role === 'Administrador'
  const meuCondominio = user?.condominio || ''
  const [condoFiltro, setCondoFiltro] = useState(() => (!isAdm && meuCondominio ? meuCondominio : 'Todos'))

  React.useEffect(() => {
    if (!isAdm && meuCondominio && condoFiltro !== meuCondominio) {
      setCondoFiltro(meuCondominio)
    }
  }, [isAdm, meuCondominio])
  
  const hoje = new Date()
  const mesAtualStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  const [mesFiltro, setMesFiltro] = useState(mesAtualStr)
  const [saldoVisivel, setSaldoVisivel] = useState(() => {
    return localStorage.getItem('dashboard_saldo_visivel') !== 'hidden'
  })

  const toggleSaldoVisivel = (e) => {
    e?.stopPropagation()
    setSaldoVisivel(prev => {
      const next = !prev
      localStorage.setItem('dashboard_saldo_visivel', next ? 'visible' : 'hidden')
      return next
    })
  }

  const [modalInadimplencia, setModalInadimplencia] = useState(false)
  const [limpandoInadimp, setLimpandoInadimp] = useState(false)

  const fmtVal = (v) => {
    if (!saldoVisivel) return '••••••••'
    return `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const normalizarNomeCondo = (nome) => {
    return String(nome || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/^(residencial|condominio|edificio|ed\.)\s+/i, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .trim()
      .toLowerCase()
  }

  const condoMatch = (c1, c2) => {
    if (!c1 || !c2) return false
    const n1 = normalizarNomeCondo(c1)
    const n2 = normalizarNomeCondo(c2)
    return n1 === n2 || n1.includes(n2) || n2.includes(n1)
  }

  const filterByCondo = (items, isBoleto = false) => {
    if (!items || !Array.isArray(items)) return []

    // Helper para extrair condomínio do item (incluindo busca do morador para boletos)
    const getItemCondo = (it) => {
      if (it.condominio) return it.condominio
      if (isBoleto && it.morador) {
        const mor = (moradores || []).find(m => m?.nome && String(m.nome).trim().toLowerCase() === String(it.morador).trim().toLowerCase())
        if (mor?.condominio) return mor.condominio
      }
      return ''
    }

    // Para usuários não-administradores (Síndico, Subsíndico, Conselho):
    // Jamais exibe dados de Alpha Interno nem lançamentos sem condomínio definido
    if (!isAdm) {
      if (!meuCondominio) return []
      return items.filter(it => {
        const cNome = getItemCondo(it)
        if (!cNome) return false
        if (isAlphaInterno(cNome)) return false
        return condoMatch(cNome, meuCondominio)
      })
    }

    // Para Administradores:
    if (!condoFiltro || condoFiltro === 'Todos') return items
    if (condoFiltro === 'Alpha (Interno)') {
      return items.filter(it => isAlphaInterno(getItemCondo(it)))
    }
    // Quando selecionado um condomínio específico, aceita estritamente lançamentos dele
    return items.filter(it => {
      const cNome = getItemCondo(it)
      return Boolean(cNome) && condoMatch(cNome, condoFiltro)
    })
  }

  const finFiltrado = useMemo(() => filterByCondo(financeiro, false), [financeiro, condoFiltro, moradores, isAdm, meuCondominio])
  const bolFiltrado = useMemo(() => filterByCondo(boletos, true), [boletos, condoFiltro, moradores, isAdm, meuCondominio])
  const cotFiltradas = useMemo(() => filterByCondo(cotacoes, false), [cotacoes, condoFiltro, moradores, isAdm, meuCondominio])
  const manFiltradas = useMemo(() => filterByCondo(manutencoes, false), [manutencoes, condoFiltro, moradores, isAdm, meuCondominio])
  const apoFiltradas = useMemo(() => filterByCondo(apolices, false), [apolices, condoFiltro, moradores, isAdm, meuCondominio])
  const ocFiltradas = useMemo(() => filterByCondo(ocorrencias, false), [ocorrencias, condoFiltro, moradores, isAdm, meuCondominio])

  // Função utilitária para extrair ano-mês (YYYY-MM) de qualquer string de data ou competência
  const parseAnoMes = (str, competenciaStr) => {
    if (!str && !competenciaStr) return ''
    const s = String(str || '').trim()
    // Caso 1: YYYY-MM ou YYYY-MM-DD
    if (/^\d{4}-\d{2}/.test(s)) {
      return s.substring(0, 7)
    }
    // Caso 2: DD/MM/YYYY
    const brMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
    if (brMatch) {
      return `${brMatch[3]}-${brMatch[2].padStart(2, '0')}`
    }
    // Caso 3: Tenta via Date parse se não for vazio
    if (s && !isNaN(Date.parse(s))) {
      try {
        const d = new Date(s)
        if (!isNaN(d.getTime())) {
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        }
      } catch (e) {}
    }
    // Caso 4: Competência textual (ex: "out/2026", "outubro/2026", "10/2026")
    if (competenciaStr) {
      const c = String(competenciaStr).toLowerCase().trim()
      const mNum = c.match(/(\d{1,2})\/(\d{4})/)
      if (mNum) {
        return `${mNum[2]}-${mNum[1].padStart(2, '0')}`
      }
      const mesesMap = {
        jan: '01', fev: '02', mar: '03', abr: '04', mai: '05', jun: '06',
        jul: '07', ago: '08', set: '09', out: '10', nov: '11', dez: '12'
      }
      for (const [prefix, num] of Object.entries(mesesMap)) {
        if (c.includes(prefix)) {
          const anoMatch = c.match(/\d{4}/)
          if (anoMatch) return `${anoMatch[0]}-${num}`
        }
      }
    }
    return ''
  }

  const { saldoAtual, capitalDeGiro, aReceber, aPagar, inadimplenciaTotal, itensInadimplentes = [], contasVencidas, chartData } = useMemo(() => {
    let recPagasTotal = 0
    let desPagasTotal = 0
    let recPendentesMes = 0
    let desPendentesMes = 0
    let inadimp = 0
    let vencidas = []

    const refHoje = new Date()
    refHoje.setHours(0, 0, 0, 0)
    const histMeses = {}

    let itensInadimp = []

    // 1. Obter saldo inicial configurado no Fundo de Caixa / Reserva e Contas Bancárias
    const isAlpha = condoFiltro === 'Alpha (Interno)' || condoFiltro?.toLowerCase()?.includes('alpha')
    const isTodos = !condoFiltro || condoFiltro === 'Todos'
    
    // Contas bancárias vinculadas ao condomínio selecionado
    const contasFiltradas = (financeiroContas || []).filter(c => {
      if (isTodos) return true
      if (isAlpha) return isAlphaInterno(c.condominio)
      return condoMatch(c.condominio, condoFiltro)
    })
    const saldoContasBancarias = contasFiltradas.reduce((acc, c) => acc + Number(c.saldo || 0), 0)

    // Fundo de Caixa cadastrado na Reserva de Emergência (financeiro_config) ou no Cadastro do Condomínio (fundoReserva)
    let saldoFundoCaixa = 0
    if (isAlpha) {
      const doc = (financeiroConfigs || []).find(c => c.id === 'caixa_alpha')
      if (doc && doc.saldo_real !== undefined) saldoFundoCaixa = Number(doc.saldo_real || 0)
    } else if (isTodos) {
      // No consolidado 'Todos', soma os saldos reais de todos os caixas cadastrados e fundos de reserva
      const somaCaixas = (financeiroConfigs || []).reduce((acc, c) => acc + Number(c.saldo_real || 0), 0)
      const somaFundos = (condominios || []).reduce((acc, c) => acc + Number(c.fundoReserva || 0), 0)
      saldoFundoCaixa = somaCaixas > 0 ? somaCaixas : somaFundos
    } else {
      const configId = `caixa_${condoFiltro.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`
      const doc = (financeiroConfigs || []).find(c => c.id === configId)
      if (doc && doc.saldo_real !== undefined) {
        saldoFundoCaixa = Number(doc.saldo_real || 0)
      } else {
        // Fallback 1: procura por correspondência no nome da chave do financeiro_config
        const docAlt = (financeiroConfigs || []).find(c => {
          const cid = (c.id || '').toLowerCase()
          const cNome = normalizarNomeCondo(condoFiltro)
          return cid.includes(cNome) || (c.condominio && condoMatch(c.condominio, condoFiltro))
        })
        if (docAlt && docAlt.saldo_real !== undefined) {
          saldoFundoCaixa = Number(docAlt.saldo_real || 0)
        } else {
          // Fallback 2: busca no cadastro do condomínio (tabela condominios -> fundoReserva)
          const condoObj = (condominios || []).find(c => condoMatch(c.nome, condoFiltro))
          if (condoObj && condoObj.fundoReserva !== undefined) {
            saldoFundoCaixa = Number(condoObj.fundoReserva || 0)
          }
        }
      }
    }

    // Processamento de Boletos (Receitas de Cotas Condominiais)
    bolFiltrado.forEach(b => {
      // Ignorar boletos cancelados, excluídos ou soft-deleted
      if (b.status === 'Cancelado' || b.status === 'Excluído' || b.status === 'Excluido' || b.excluido || b.deletado) {
        return
      }

      const val = parseFloat(b.valor) || 0
      // Identificar o mês da competência do boleto com prioridade para a competência informada
      const mesKey = parseAnoMes(b.competencia) || parseAnoMes(b.vencimento || b.data || '')

      let dObj = refHoje
      const dStr = b.vencimento || b.data || ''
      if (dStr) {
        try {
          const parsed = parseISO(dStr)
          if (!isNaN(parsed.getTime())) dObj = parsed
        } catch(e) {}
      }
      const mesAbrev = mesKey ? new Date(`${mesKey}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'short' }) : dObj.toLocaleDateString('pt-BR', { month: 'short' })

      if (mesKey && !histMeses[mesKey]) {
        histMeses[mesKey] = { mes: mesAbrev, receitas: 0, despesas: 0, order: new Date(`${mesKey}-01T12:00:00`).getTime() || dObj.getTime() }
      }

      if (b.status === 'Pago') {
        // Se houver filtro de mês, considera as receitas pagas até o mês selecionado
        if (!mesFiltro || !mesKey || mesKey <= mesFiltro) {
          recPagasTotal += val
        }
        if (mesKey && histMeses[mesKey]) histMeses[mesKey].receitas += val
      } else {
        // A Receber no Mês Selecionado (Pendente, Emitido ou Vencido)
        if (!mesFiltro || mesKey === mesFiltro) {
          recPendentesMes += val
        }
        if (dStr) {
          try {
            const d = parseISO(dStr)
            if (!isNaN(d.getTime()) && differenceInDays(d, refHoje) < 0) {
              inadimp += val
              itensInadimp.push({
                origem: 'boletos',
                id: b.id,
                morador: b.morador || 'Sem Nome',
                apt: b.apt || b.unidade || '—',
                condominio: b.condominio || 'Geral',
                valor: val,
                vencimento: b.vencimento || '—',
                competencia: b.competencia || '—',
                status: b.status || 'Pendente'
              })
            }
          } catch(e) {}
        }
      }
    })

    // Processamento de Lançamentos Financeiros (Despesas e Receitas Avulsas)
    finFiltrado.forEach(f => {
      // Ignorar lançamentos cancelados ou excluídos
      if (f.status === 'Cancelado' || f.status === 'Excluído' || f.excluido || f.deletado) {
        return
      }

      const val = parseFloat(f.valor) || 0
      const isDespesa = f.tipo === 'Despesa'
      // Alinhamento estrito com Contas a Pagar: data do lançamento (f.data) ou vencimento
      const mesData = (f.data ? f.data.substring(0, 7) : '') || parseAnoMes(f.vencimento || '', f.competencia)
      const dStr = f.data || f.vencimento || ''

      let dObj = refHoje
      if (dStr) {
        try {
          const parsed = parseISO(dStr)
          if (!isNaN(parsed.getTime())) dObj = parsed
        } catch(e) {}
      }
      const mesAbrev = mesData ? new Date(`${mesData}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'short' }) : dObj.toLocaleDateString('pt-BR', { month: 'short' })

      if (mesData && !histMeses[mesData]) {
        histMeses[mesData] = { mes: mesAbrev, receitas: 0, despesas: 0, order: new Date(`${mesData}-01T12:00:00`).getTime() || dObj.getTime() }
      }

      if (isDespesa) {
        if (f.status === 'Pago' || f.status === 'Liquidado' || f.pago) {
          if (!mesFiltro || !mesData || mesData <= mesFiltro) {
            desPagasTotal += val
          }
          if (mesData && histMeses[mesData]) histMeses[mesData].despesas += val
        } else if (f.status === 'Pendente' || f.status === 'Aguardando Aprovação' || !f.status) {
          // A Pagar no Mês Selecionado (Exatamente idêntico ao totalPendente de Contas a Pagar)
          if (!mesFiltro || mesData === mesFiltro) {
            desPendentesMes += val
          }
          if (dStr) {
            try {
              const d = parseISO(dStr)
              if (!isNaN(d.getTime())) {
                const diff = differenceInDays(d, refHoje)
                if (diff < 0) {
                  vencidas.push({ ...f, diasAtraso: Math.abs(diff) })
                }
              }
            } catch(e) {}
          }
        }
      } else {
        // Receitas Avulsas do financeiro_lancamentos
        // Evitar duplicidade caso seja lançamento espelho automático de Rateio de Água já emitido em boletos
        const isRateioAguaBoleto = f.categoria === 'Taxa de Água' && (f.descricao || '').toLowerCase().includes('rateio de água - apt')
        if (isRateioAguaBoleto && bolFiltrado.length > 0) {
          return
        }

        const mesRec = parseAnoMes(f.competencia) || mesData

        if (f.status === 'Pago' || f.status === 'Liquidado' || f.status === 'Recebido' || f.pago) {
          if (!mesFiltro || !mesRec || mesRec <= mesFiltro) {
            recPagasTotal += val
          }
          if (mesRec && histMeses[mesRec]) histMeses[mesRec].receitas += val
        } else {
          if (!mesFiltro || mesRec === mesFiltro) {
            recPendentesMes += val
          }
          // Se for receita avulsa marcada como atrasada ou vencida
          if (f.status === 'Atrasado' || f.status === 'Vencido') {
            inadimp += val
            itensInadimp.push({
              origem: 'financeiro_lancamentos',
              id: f.id,
              morador: f.descricao || f.pagador || 'Lançamento Financeiro',
              apt: f.apt || f.unidade || '—',
              condominio: f.condominio || 'Geral',
              valor: val,
              vencimento: f.vencimento || f.data || '—',
              competencia: f.competencia || '—',
              status: f.status
            })
          }
        }
      }
    })

    const sortedChart = Object.values(histMeses)
      .sort((a, b) => a.order - b.order)
      .slice(-6)

    // Base de Caixa:
    // Se o condomínio possui saldo registrado em Fundo de Caixa / Reserva (saldoFundoCaixa),
    // esse valor representa exatamente o saldo inicial/caixa de referência (ex: R$ 1.109,98 do Residencial Dália).
    // Caso existam contas bancárias cadastradas com saldo, utiliza o saldo consolidado das contas bancárias.
    const baseCaixa = saldoContasBancarias > 0 ? saldoContasBancarias : saldoFundoCaixa
    const saldoEmCaixaAcumulado = baseCaixa + recPagasTotal - desPagasTotal
    const giroDoMes = saldoEmCaixaAcumulado + recPendentesMes - desPendentesMes

    return {
      saldoAtual: saldoEmCaixaAcumulado,
      capitalDeGiro: giroDoMes,
      aReceber: recPendentesMes,
      aPagar: desPendentesMes,
      inadimplenciaTotal: inadimp,
      itensInadimplentes: itensInadimp,
      contasVencidas: vencidas,
      chartData: sortedChart.length > 0 ? sortedChart : [
        { mes: format(new Date(), 'MMM'), receitas: 0, despesas: 0 }
      ]
    }
  }, [bolFiltrado, finFiltrado, mesFiltro, condoFiltro, financeiroConfigs, financeiroContas, condominios])

  const statsCotacoes = useMemo(() => {
    let emAndamento = 0
    let aguardandoOrcamento = 0
    let aguardandoAprovacao = 0
    let concluidasMes = 0
    let cotacaoDestaque = null

    cotFiltradas.forEach(c => {
      const st = (c.status || '').toLowerCase()
      if (st.includes('andamento') || st.includes('aberta')) emAndamento++
      if (st.includes('orçamento') || st.includes('aguardando orc')) aguardandoOrcamento++
      if (st.includes('aprovação') || st.includes('analise')) aguardandoAprovacao++
      if (st.includes('aprovada') || st.includes('concluída') || st.includes('finalizada')) concluidasMes++

      if (!cotacaoDestaque && (st.includes('aprovação') || st.includes('andamento') || st.includes('orçamento'))) {
        cotacaoDestaque = c
      }
    })

    return {
      emAndamento,
      aguardandoOrcamento,
      aguardandoAprovacao,
      concluidasMes,
      destaque: cotacaoDestaque || cotFiltradas[0] || null
    }
  }, [cotFiltradas])

  const statsManutencoes = useMemo(() => {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const hojeStr = hoje.toISOString().split('T')[0]

    let pendentes = 0
    let emAndamento = 0
    let concluidas = 0
    let vencendo30Dias = 0
    let totalCustoPrevisto = 0
    let atrasadas = []
    let proximas = []
    let todasAtivas = []

    manFiltradas.forEach(m => {
      const st = (m.status || 'Agendada').toLowerCase()
      const val = parseFloat(m.custoEstimado || m.custo || m.valor || 0) || 0
      totalCustoPrevisto += val

      if (st.includes('conclu') || st.includes('finaliz')) {
        concluidas++
      } else if (st.includes('andamento') || st.includes('execu')) {
        emAndamento++
      } else {
        pendentes++
      }

      const dStr = m.dataPrevista || m.proxima_data || m.data || m.vencimento || ''
      let isAtrasada = false
      let dias = 0

      if (dStr) {
        try {
          const d = parseISO(dStr)
          const diff = differenceInDays(d, hoje)
          dias = diff

          if (st !== 'concluída' && st !== 'concluida') {
            if (diff < 0) {
              isAtrasada = true
              atrasadas.push({ ...m, dias: Math.abs(diff), dataFormatada: format(d, 'dd/MM/yyyy') })
            } else {
              if (diff <= 30) vencendo30Dias++
              proximas.push({ ...m, dias: diff, dataFormatada: format(d, 'dd/MM/yyyy') })
            }
          }
        } catch(e) {}
      }

      if (st !== 'concluída' && st !== 'concluida') {
        todasAtivas.push({
          ...m,
          isAtrasada,
          dias,
          statusVisual: isAtrasada ? 'Atrasada' : (m.status || 'Agendada')
        })
      }
    })

    todasAtivas.sort((a, b) => new Date(a.dataPrevista || '9999') - new Date(b.dataPrevista || '9999'))

    return {
      pendentes,
      emAndamento,
      concluidas,
      vencendo30Dias,
      totalCustoPrevisto,
      todasAtivas: todasAtivas.slice(0, 6),
      atrasadas,
      proximas
    }
  }, [manFiltradas])

  const statsContratos = useMemo(() => {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    let ativos = 0
    let vencendo30Dias = 0
    let vencidos = 0
    let maisUrgente = null

    apoFiltradas.forEach(a => {
      const dStr = a.vigencia_fim || a.vencimento || ''
      if (dStr) {
        try {
          const d = parseISO(dStr)
          const diff = differenceInDays(d, hoje)
          if (diff < 0) {
            vencidos++
          } else {
            ativos++
            if (diff <= 30) {
              vencendo30Dias++
              if (!maisUrgente || diff < maisUrgente.dias) {
                maisUrgente = { ...a, dias: diff, dataFormatada: format(d, 'dd/MM/yyyy') }
              }
            }
          }
        } catch(e) {}
      } else {
        ativos++
      }
    })

    return {
      ativos,
      vencendo30Dias,
      vencidos,
      urgente: maisUrgente
    }
  }, [apoFiltradas])

  const alertasCriticos = useMemo(() => {
    const list = []

    if (contasVencidas.length > 0) {
      const totalVencido = contasVencidas.reduce((acc, c) => acc + (parseFloat(c.valor) || 0), 0)
      list.push({
        id: 'contas_vencidas',
        tipo: 'vermelho',
        icone: '🔴',
        texto: `${contasVencidas.length} conta(s) a pagar vencida(s) totalizando R$ ${totalVencido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        rota: '/financeiro'
      })
    }

    if (statsContratos.urgente) {
      list.push({
        id: 'contrato_vencendo',
        tipo: 'vermelho',
        icone: '🔴',
        texto: `${statsContratos.urgente.titulo || statsContratos.urgente.seguradora || 'Contrato/Seguro'} vence em ${statsContratos.urgente.dias} dias (${statsContratos.urgente.dataFormatada})`,
        rota: '/seguro'
      })
    }

    if (statsCotacoes.aguardandoAprovacao > 0) {
      list.push({
        id: 'cotacao_aprovacao',
        tipo: 'amarelo',
        icone: '🟡',
        texto: `${statsCotacoes.aguardandoAprovacao} cotação(ões) aguardando aprovação do Síndico / Conselho`,
        rota: '/cotacoes'
      })
    }

    if (statsManutencoes.atrasadas.length > 0) {
      list.push({
        id: 'manutencao_atrasada',
        tipo: 'vermelho',
        icone: '🔴',
        texto: `Manutenção atrasada: ${statsManutencoes.atrasadas[0].titulo || statsManutencoes.atrasadas[0].equipamento} (${statsManutencoes.atrasadas[0].dias} dias de atraso)`,
        rota: '/manutencoes'
      })
    } else if (statsManutencoes.proximas.length > 0) {
      list.push({
        id: 'manutencao_proxima',
        tipo: 'amarelo',
        icone: '🟡',
        texto: `Manutenção preventiva próxima: ${statsManutencoes.proximas[0].titulo || statsManutencoes.proximas[0].equipamento} em ${statsManutencoes.proximas[0].dias} dias`,
        rota: '/manutencoes'
      })
    }

    const ocAbertas = ocFiltradas.filter(o => o.status !== 'Resolvida' && o.status !== 'Solucionada').length
    if (ocAbertas > 0) {
      list.push({
        id: 'ocorrencias_abertas',
        tipo: 'laranja',
        icone: '🟠',
        texto: `${ocAbertas} solicitação(ões) de morador aguardando resposta ou atendimento`,
        rota: '/ocorrencias'
      })
    }

    return list
  }, [contasVencidas, statsContratos, statsCotacoes, statsManutencoes, ocFiltradas])

  // =========================================================================
  // CÁLCULO DE VALORES A RECEBER, EM ATRASO E PAGOS POR CONDOMÍNIO + PIE CHART
  // =========================================================================
  const { 
    resumoPorCondominio, 
    totalAReceberGeral, 
    totalEmAtrasoGeral, 
    totalPagoGeral,
    pizzaStatusData,
    pizzaCondominiosAtrasoData,
    pizzaCondominiosAReceberData
  } = useMemo(() => {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    const mapCondos = {}

    // Inicializar todos os condomínios cadastrados
    condominios.forEach(c => {
      const nome = (c.nome || 'Geral').trim()
      mapCondos[nome] = {
        id: c.id,
        nome: nome,
        aReceber: 0,
        qtdAReceber: 0,
        emAtraso: 0,
        qtdEmAtraso: 0,
        pago: 0,
        qtdPago: 0,
        totalGeral: 0,
        qtdTotal: 0
      }
    })

    // Processar boletos
    boletos.forEach(b => {
      // Ignorar boletos cancelados, excluídos ou soft-deleted
      if (b.status === 'Cancelado' || b.status === 'Excluído' || b.status === 'Excluido' || b.excluido || b.deletado) {
        return
      }

      const cNome = (b.condominio || 'Geral').trim()
      if (!mapCondos[cNome]) {
        mapCondos[cNome] = {
          id: cNome,
          nome: cNome,
          aReceber: 0,
          qtdAReceber: 0,
          emAtraso: 0,
          qtdEmAtraso: 0,
          pago: 0,
          qtdPago: 0,
          totalGeral: 0,
          qtdTotal: 0
        }
      }

      const val = parseFloat(b.valor) || 0
      const dStr = b.vencimento || b.data || ''
      let isAtrasado = false

      if (dStr) {
        try {
          const d = parseISO(dStr)
          if (differenceInDays(d, hoje) < 0) {
            isAtrasado = true
          }
        } catch(e) {}
      }

      mapCondos[cNome].totalGeral += val
      mapCondos[cNome].qtdTotal += 1

      if (b.status === 'Pago') {
        mapCondos[cNome].pago += val
        mapCondos[cNome].qtdPago += 1
      } else if (b.status === 'Vencido' || isAtrasado) {
        mapCondos[cNome].emAtraso += val
        mapCondos[cNome].qtdEmAtraso += 1
      } else {
        mapCondos[cNome].aReceber += val
        mapCondos[cNome].qtdAReceber += 1
      }
    })

    // Converter para lista ordenada
    const lista = Object.values(mapCondos).map(item => {
      const soma = item.pago + item.aReceber + item.emAtraso
      const taxaInadimplencia = soma > 0 ? ((item.emAtraso / soma) * 100) : 0
      return {
        ...item,
        taxaInadimplencia: Math.min(100, Math.round(taxaInadimplencia * 10) / 10)
      }
    }).sort((a, b) => (b.emAtraso + b.aReceber) - (a.emAtraso + a.aReceber))

    let totalARec = 0
    let totalAtraso = 0
    let totalPago = 0

    lista.forEach(l => {
      totalARec += l.aReceber
      totalAtraso += l.emAtraso
      totalPago += l.pago
    })

    // Dados para Gráfico de Pizza 1: Status Geral (Pago x A Receber x Em Atraso)
    const pizzaStatus = [
      { name: 'Em Atraso (Inadimplente)', value: totalAtraso, color: '#ef4444' },
      { name: 'A Receber (No Prazo)', value: totalARec, color: '#3b82f6' },
      { name: 'Recebido / Pago', value: totalPago, color: '#10b981' },
    ].filter(p => p.value > 0)

    // Cores para os condomínios
    const CORES_CONDOS = [
      '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', 
      '#8b5cf6', '#14b8a6', '#f97316', '#06b6d4', '#e11d48', '#84cc16'
    ]

    // Dados para Gráfico de Pizza 2: Inadimplência / Atraso por Condomínio
    const pizzaAtraso = lista
      .filter(l => l.emAtraso > 0)
      .map((l, idx) => ({
        name: l.nome,
        value: l.emAtraso,
        color: CORES_CONDOS[idx % CORES_CONDOS.length]
      }))

    // Dados para Gráfico de Pizza 3: A Receber por Condomínio
    const pizzaARec = lista
      .filter(l => l.aReceber > 0)
      .map((l, idx) => ({
        name: l.nome,
        value: l.aReceber,
        color: CORES_CONDOS[idx % CORES_CONDOS.length]
      }))

    return {
      resumoPorCondominio: lista,
      totalAReceberGeral: totalARec,
      totalEmAtrasoGeral: totalAtraso,
      totalPagoGeral: totalPago,
      pizzaStatusData: pizzaStatus.length > 0 ? pizzaStatus : [{ name: 'Sem Boletos', value: 1, color: '#94a3b8' }],
      pizzaCondominiosAtrasoData: pizzaAtraso,
      pizzaCondominiosAReceberData: pizzaARec
    }
  }, [condominios, boletos])

  const saudacaoHora = useMemo(() => {
    const hora = new Date().getHours()
    if (hora >= 5 && hora < 12) return 'Bom dia'
    if (hora >= 12 && hora < 18) return 'Boa tarde'
    return 'Boa noite'
  }, [])

  const dataHojeFormatada = useMemo(() => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(new Date())
  }, [])

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-7xl mx-auto pb-12">
      {/* Header Central de Comando */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-pale-300 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black bg-gradient-to-r from-brand-700 to-brand-500 bg-clip-text text-transparent">
              {saudacaoHora}, {user?.nome?.split(' ')[0] || 'Gestor'}.
            </h2>
            <button
              type="button"
              onClick={toggleSaldoVisivel}
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-gray-600 transition-colors cursor-pointer"
              title={saldoVisivel ? 'Ocultar todos os valores' : 'Mostrar todos os valores'}
            >
              {saldoVisivel ? <Eye size={18} /> : <EyeOff size={18} className="text-rose-600" />}
            </button>
          </div>
          <p className="text-gray-500 font-medium text-xs md:text-sm mt-0.5">
            Central de Comando e Decisões • {dataHojeFormatada}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500">Mês:</span>
            <input
              type="month"
              value={mesFiltro}
              onChange={e => setMesFiltro(e.target.value)}
              className="input py-1.5 text-xs font-bold text-gray-800 bg-slate-50 border-gray-300 rounded-xl"
            />
          </div>

          {isAdm ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500">Condomínio:</span>
              <select
                className="input py-2 text-xs font-bold text-gray-800 bg-slate-50 border-gray-300 rounded-xl"
                value={condoFiltro}
                onChange={e => setCondoFiltro(e.target.value)}
              >
                <option value="Todos">🌐 Todos os Condomínios + Alpha</option>
                <option value="Alpha (Interno)">👑 Alpha Soluções (Financeiro Interno / Matriz)</option>
                <optgroup label="Condomínios">
                  {condominios.map(c => (
                    <option key={c.id || c.nome} value={c.nome}>🏢 {c.nome}</option>
                  ))}
                </optgroup>
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 bg-brand-50 border border-brand-200 rounded-xl text-xs font-bold text-brand-900 shadow-2xs">
              <Building2 size={16} className="text-brand-600 shrink-0" />
              <span>{meuCondominio || 'Condomínio'}</span>
            </div>
          )}

          {isAdm && (
            <button
              onClick={() => navigate('/seguranca')}
              className="btn-secondary py-2 px-3 text-xs font-bold flex items-center gap-1.5 bg-red-50 text-red-700 border-red-200 hover:bg-red-100 shadow-xs cursor-pointer"
              title="Acessar painel de alarmes, segurança e restauração de backups"
            >
              <ShieldAlert size={15} className="text-red-600" /> Segurança &amp; Backups
            </button>
          )}

          <button
            onClick={() => navigate('/cotacoes')}
            className="btn-primary py-2 px-4 text-xs font-black flex items-center gap-1.5 shadow-md shadow-brand-700/20 bg-emerald-600 hover:bg-emerald-500 border-none cursor-pointer uppercase tracking-wider"
          >
            <Plus size={15} /> + NOVA COTAÇÃO
          </button>
        </div>
      </div>

      {/* 1. VISÃO FINANCEIRA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Saldo Atual / Saldo em Caixa */}
        <div 
          onClick={() => navigate('/financeiro')}
          className="bg-white p-5 rounded-2xl border border-pale-300 shadow-sm hover:shadow-md hover:border-brand-400 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Saldo Atual</span>
              <button
                type="button"
                onClick={toggleSaldoVisivel}
                className="text-gray-400 hover:text-gray-700 transition-colors p-0.5 rounded focus:outline-none"
                title={saldoVisivel ? 'Ocultar valores' : 'Mostrar valores'}
              >
                {saldoVisivel ? <Eye size={15} /> : <EyeOff size={15} className="text-rose-600" />}
              </button>
            </div>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="my-2">
            <span className="text-2xl font-black text-gray-900 group-hover:text-brand-700 transition-colors">
              {fmtVal(saldoAtual)}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-bold">
            <span>Saldo em Caixa</span>
            <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Capital de Giro (Saúde do Mês) */}
        <div 
          onClick={() => navigate('/financeiro')}
          className={`bg-white p-5 rounded-2xl border ${capitalDeGiro >= 0 ? 'border-emerald-200' : 'border-rose-200'} shadow-sm hover:shadow-md hover:border-brand-400 transition-all cursor-pointer group flex flex-col justify-between`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Capital de Giro</span>
            <div className={`w-8 h-8 rounded-xl ${capitalDeGiro >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'} flex items-center justify-center group-hover:scale-110 transition-transform`}>
              <Layers size={18} />
            </div>
          </div>
          <div className="my-2">
            <span className={`text-2xl font-black ${capitalDeGiro >= 0 ? 'text-emerald-600' : 'text-rose-600'} transition-colors`}>
              {fmtVal(capitalDeGiro)}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-gray-500 font-bold">
            <span>Saúde do Mês</span>
            <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* A Receber (Mês Selecionado) */}
        <div 
          onClick={() => navigate('/boletos')}
          className="bg-white p-5 rounded-2xl border border-pale-300 shadow-sm hover:shadow-md hover:border-brand-400 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">A Receber</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="my-2">
            <span className="text-2xl font-black text-gray-900 group-hover:text-brand-700 transition-colors">
              {fmtVal(aReceber)}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-blue-600 font-bold">
            <span>Boletos do Mês</span>
            <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* A Pagar (Mês Selecionado) */}
        <div 
          onClick={() => navigate('/financeiro')}
          className="bg-white p-5 rounded-2xl border border-pale-300 shadow-sm hover:shadow-md hover:border-brand-400 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">A Pagar</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
              <CreditCard size={18} />
            </div>
          </div>
          <div className="my-2">
            <span className="text-2xl font-black text-gray-900 group-hover:text-amber-700 transition-colors">
              {fmtVal(aPagar)}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-amber-600 font-bold">
            <span>Contas do Mês</span>
            <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Inadimplência */}
        <div 
          onClick={() => {
            if (inadimplenciaTotal > 0 || itensInadimplentes.length > 0) {
              setModalInadimplencia(true)
            } else {
              navigate('/inadimplencia')
            }
          }}
          className="bg-white p-5 rounded-2xl border border-pale-300 shadow-sm hover:shadow-md hover:border-brand-400 transition-all cursor-pointer group flex flex-col justify-between"
          title="Clique para auditar ou limpar os boletos/lançamentos em atraso"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Inadimplência</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 group-hover:scale-110 transition-transform">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="my-2">
            <span className="text-2xl font-black text-rose-600">
              {fmtVal(inadimplenciaTotal)}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span className="text-rose-600 flex items-center gap-1">
              {inadimplenciaTotal > 0 ? 'Auditar & Resolver' : 'Cobrança & Jurídico'}
              <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
            </span>
            {inadimplenciaTotal > 0 && (
              <span className="text-[10px] bg-rose-50 border border-rose-200 text-rose-700 px-1.5 py-0.5 rounded-md">
                Ver Faturas ({itensInadimplentes.length})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Gráfico Receitas x Despesas */}
      <div className="bg-white p-6 rounded-2xl border border-pale-300 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-gray-900 text-base">Receitas x Despesas</h3>
            <p className="text-xs text-gray-400">Comparativo financeiro mensal real</p>
          </div>
          <button 
            onClick={() => navigate('/financeiro')}
            className="text-xs font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1"
          >
            Ver Relatório Financeiro Completo <ChevronRight size={14} />
          </button>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="mes" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => `R$ ${v/1000}k`} />
              <Tooltip 
                formatter={(value) => [fmtVal(value), '']}
                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="receitas" name="Receitas" fill="#10b981" radius={[6, 6, 0, 0]} />
              <Bar dataKey="despesas" name="Despesas" fill="#ef4444" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. VALORES A RECEBER, EM ATRASO E GRÁFICOS DE PIZZA POR CONDOMÍNIO */}
      <div className="bg-white p-6 rounded-2xl border border-pale-300 shadow-sm flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600">
                <PieIcon size={20} />
              </div>
              <h3 className="font-bold text-gray-900 text-lg">Valores a Receber & Em Atraso por Condomínio</h3>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Visão consolidada de arrecadação, inadimplência e projeção financeira de todos os condomínios
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigate('/boletos')}
              className="text-xs font-bold text-brand-600 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 py-2 px-3 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>Gerenciar Boletos</span>
              <ChevronRight size={14} />
            </button>
            <button 
              onClick={() => navigate('/inadimplencia')}
              className="text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 py-2 px-3 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>Régua de Cobrança</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Gráficos de Pizza Lado a Lado */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pizza 1: Status Geral de Faturamento */}
          <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-600"></span>
                Status Geral de Arrecadação (Total)
              </h4>
              <span className="text-[11px] font-bold text-gray-500">
                Total: {fmtVal(totalPagoGeral + totalAReceberGeral + totalEmAtrasoGeral)}
              </span>
            </div>

            <div className="h-56 w-full relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pizzaStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pizzaStatusData.map((entry, index) => (
                      <Cell key={`cell-status-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(val) => [fmtVal(val), '']}
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Resumo dos 3 indicadores */}
            <div className="grid grid-cols-3 gap-2 mt-2 pt-3 border-t border-slate-200 text-center">
              <div className="bg-emerald-50/80 p-2 rounded-xl border border-emerald-100">
                <span className="text-[10px] font-bold text-emerald-800 uppercase block">Recebido</span>
                <span className="text-xs font-black text-emerald-700">
                  {fmtVal(totalPagoGeral)}
                </span>
              </div>
              <div className="bg-blue-50/80 p-2 rounded-xl border border-blue-100">
                <span className="text-[10px] font-bold text-blue-800 uppercase block">A Receber</span>
                <span className="text-xs font-black text-blue-700">
                  {fmtVal(totalAReceberGeral)}
                </span>
              </div>
              <div className="bg-rose-50/80 p-2 rounded-xl border border-rose-100">
                <span className="text-[10px] font-bold text-rose-800 uppercase block">Em Atraso</span>
                <span className="text-xs font-black text-rose-700">
                  {fmtVal(totalEmAtrasoGeral)}
                </span>
              </div>
            </div>
          </div>

          {/* Pizza 2: Inadimplência por Condomínio */}
          <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                Distribuição de Atrasos por Condomínio
              </h4>
              <span className="text-[11px] font-bold text-rose-600">
                Atraso Total: {fmtVal(totalEmAtrasoGeral)}
              </span>
            </div>

            <div className="h-56 w-full relative flex items-center justify-center">
              {pizzaCondominiosAtrasoData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pizzaCondominiosAtrasoData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pizzaCondominiosAtrasoData.map((entry, index) => (
                        <Cell key={`cell-condo-atraso-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(val) => [fmtVal(val), 'Valor em Atraso']}
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-6 text-gray-400">
                  <CheckCircle2 size={36} className="text-emerald-500 mb-2" />
                  <p className="text-xs font-bold text-emerald-700">Parabéns! 100% dos condomínios em dia!</p>
                  <p className="text-[11px] text-gray-400">Nenhum valor em atraso registrado no momento.</p>
                </div>
              )}
            </div>

            <div className="mt-2 pt-3 border-t border-slate-200 text-[11px] text-gray-500 flex items-center justify-between">
              <span>Condomínios com pendência: <b>{pizzaCondominiosAtrasoData.length}</b></span>
              <button onClick={() => navigate('/inadimplencia')} className="text-brand-600 font-bold hover:underline cursor-pointer">
                Ver detalhes na Régua →
              </button>
            </div>
          </div>
        </div>

        {/* Tabela Detalhada por Condomínio */}
        <div className="overflow-x-auto border border-gray-100 rounded-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-slate-50 text-[11px] font-black text-gray-600 uppercase tracking-wider">
                <th className="py-3 px-4">Condomínio</th>
                <th className="py-3 px-4">A Receber (No Prazo)</th>
                <th className="py-3 px-4">Em Atraso (Vencido)</th>
                <th className="py-3 px-4">Recebido (Pago)</th>
                <th className="py-3 px-4">Índice Inadimplência</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs font-medium text-gray-700">
              {resumoPorCondominio.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400">
                    Nenhum condomínio cadastrado com movimentação.
                  </td>
                </tr>
              ) : (
                resumoPorCondominio.map((c, idx) => (
                  <tr key={c.id || c.nome || idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-gray-900 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-brand-700 flex-shrink-0">
                        <Building2 size={14} />
                      </div>
                      <div>
                        <span>{c.nome}</span>
                        <span className="block text-[10px] font-normal text-gray-400">
                          {c.qtdTotal} boletos cadastrados
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-blue-700">
                          {fmtVal(c.aReceber)}
                        </span>
                        {c.qtdAReceber > 0 && (
                          <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-md font-bold">
                            {c.qtdAReceber}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-black ${c.emAtraso > 0 ? 'text-rose-600' : 'text-gray-400'}`}>
                          {fmtVal(c.emAtraso)}
                        </span>
                        {c.qtdEmAtraso > 0 && (
                          <span className="text-[10px] bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded-md font-bold">
                            {c.qtdEmAtraso} atrasado{c.qtdEmAtraso > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-bold text-emerald-700">
                      {fmtVal(c.pago)}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2 w-36">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div 
                            className={`h-2 rounded-full ${c.taxaInadimplencia > 15 ? 'bg-rose-500' : c.taxaInadimplencia > 5 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.min(100, c.taxaInadimplencia)}%` }}
                          />
                        </div>
                        <span className={`text-[11px] font-black ${c.taxaInadimplencia > 15 ? 'text-rose-600' : c.taxaInadimplencia > 5 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {c.taxaInadimplencia}%
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => {
                          setCondoFiltro(c.nome)
                          navigate('/boletos', { state: { condominio: c.nome, competencia: 'Todas' } })
                        }}
                        className="p-1.5 bg-slate-100 hover:bg-brand-50 hover:text-brand-700 text-gray-600 rounded-lg transition-colors font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                        title="Ver boletos deste condomínio"
                      >
                        <span>Boletos</span>
                        <ArrowUpRight size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SEÇÃO ESPECIAL: CRONOGRAMA DE MANUTENÇÕES PREVENTIVAS E VISITAS TÉCNICAS */}
      <div className="bg-white p-6 rounded-3xl border border-pale-300 shadow-sm flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
              <Wrench size={22} />
            </div>
            <div>
              <h3 className="font-black text-gray-900 text-lg">
                Cronograma de Manutenções Preventivas &amp; Visitas Técnicas
              </h3>
              <p className="text-xs text-gray-500">
                Acompanhamento operacional dos condomínios • Visitas, dedetizações, extintores e inspeções
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/manutencoes')}
              className="btn-secondary text-xs font-black py-2 px-3 flex items-center gap-1.5 bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 shadow-sm"
            >
              <Plus size={14} /> + Agendar Manutenção
            </button>
            <button
              onClick={() => navigate('/manutencoes')}
              className="btn-primary text-xs font-black py-2 px-3 flex items-center gap-1 bg-brand-600 hover:bg-brand-500"
            >
              Ver Todas ({manFiltradas.length}) →
            </button>
          </div>
        </div>

        {/* Indicadores Rápidos */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-50 p-3 rounded-xl border border-gray-200">
            <span className="text-[10px] font-bold text-gray-500 uppercase">Agendadas / Pendentes</span>
            <p className="text-xl font-black text-blue-700 mt-0.5">{statsManutencoes.pendentes}</p>
          </div>
          <div className="bg-rose-50 p-3 rounded-xl border border-rose-200">
            <span className="text-[10px] font-bold text-rose-800 uppercase">Atrasadas / Atenção</span>
            <p className="text-xl font-black text-rose-600 mt-0.5">{statsManutencoes.atrasadas.length}</p>
          </div>
          <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
            <span className="text-[10px] font-bold text-emerald-800 uppercase">Concluídas</span>
            <p className="text-xl font-black text-emerald-700 mt-0.5">{statsManutencoes.concluidas}</p>
          </div>
          <div className="bg-purple-50 p-3 rounded-xl border border-purple-200">
            <span className="text-[10px] font-bold text-purple-800 uppercase">Custo Total Previsto</span>
            <p className="text-xl font-black text-purple-700 mt-0.5">{fmtVal(statsManutencoes.totalCustoPrevisto)}</p>
          </div>
        </div>

        {/* Cards das Manutenções Agendadas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-1">
          {statsManutencoes.todasAtivas.length === 0 ? (
            <div className="col-span-full py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-gray-300 text-gray-400 text-xs">
              <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
              <p className="font-bold text-gray-700">Nenhuma manutenção pendente no momento.</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Clique no botão acima para agendar uma nova visita técnica ou manutenção preventiva.</p>
            </div>
          ) : (
            statsManutencoes.todasAtivas.map(m => (
              <div 
                key={m.id}
                onClick={() => navigate('/manutencoes')}
                className="p-4 rounded-2xl border transition-all hover:shadow-md cursor-pointer flex flex-col justify-between bg-white hover:border-brand-400 border-gray-200"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase border ${
                      m.statusVisual === 'Atrasada' 
                        ? 'bg-rose-100 text-rose-800 border-rose-300' 
                        : m.statusVisual === 'Em Andamento'
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-blue-100 text-blue-800 border-blue-300'
                    }`}>
                      {m.statusVisual}
                    </span>
                    {m.recorrencia && m.recorrencia !== 'Nenhuma' && (
                      <span className="text-[9px] font-bold text-gray-400 bg-slate-100 px-2 py-0.5 rounded-md">
                        🔄 {m.recorrencia}
                      </span>
                    )}
                  </div>

                  <h4 className="font-black text-slate-900 text-sm leading-snug">
                    {m.titulo}
                  </h4>
                  {m.fornecedor && (
                    <p className="text-xs text-gray-600 mt-0.5 font-medium">
                      Prestador: <span className="text-gray-800 font-bold">{m.fornecedor}</span>
                    </p>
                  )}

                  {m.condominio && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md mt-2">
                      <Building2 size={11} /> {m.condominio}
                    </span>
                  )}
                </div>

                <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 font-bold text-slate-700">
                    <Calendar size={13} className={m.isAtrasada ? 'text-rose-600' : 'text-slate-400'} />
                    <span className={m.isAtrasada ? 'text-rose-600 font-black' : ''}>
                      {m.dataPrevista ? (m.dataPrevista.includes('-') ? m.dataPrevista.split('-').reverse().join('/') : m.dataPrevista) : 'Sem data'}
                    </span>
                  </div>
                  {m.custoEstimado && Number(m.custoEstimado) > 0 && (
                    <span className="font-mono font-bold text-emerald-700">
                      {fmtVal(m.custoEstimado)}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 2. OS 3 CARDS DE OPERAÇÃO & DECISÃO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Cotações */}
        <div 
          onClick={() => navigate('/cotacoes')}
          className="bg-white p-6 rounded-2xl border border-pale-300 shadow-sm hover:shadow-md hover:border-brand-400 transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700">
                  <FileSpreadsheet size={20} />
                </div>
                <h3 className="font-bold text-gray-900 text-lg">Cotações</h3>
              </div>
              <ChevronRight size={18} className="text-gray-400 group-hover:translate-x-1 transition-transform" />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs mb-4">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-gray-200">
                <span className="text-gray-500 font-medium">Em andamento:</span>
                <p className="text-base font-black text-gray-900">{statsCotacoes.emAndamento}</p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-gray-200">
                <span className="text-gray-500 font-medium">Aguard. orçamento:</span>
                <p className="text-base font-black text-amber-600">{statsCotacoes.aguardandoOrcamento}</p>
              </div>
              <div className="bg-amber-50/60 p-2.5 rounded-xl border border-amber-200">
                <span className="text-amber-800 font-bold">Aguard. aprovação:</span>
                <p className="text-base font-black text-amber-700">{statsCotacoes.aguardandoAprovacao}</p>
              </div>
              <div className="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-200">
                <span className="text-emerald-800 font-bold">Concluídas no mês:</span>
                <p className="text-base font-black text-emerald-700">{statsCotacoes.concluidasMes}</p>
              </div>
            </div>

            {statsCotacoes.destaque ? (
              <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-xs">
                <div className="flex items-center justify-between font-bold text-blue-900 mb-1">
                  <span>{statsCotacoes.destaque.codigo || 'Cotação'} — {statsCotacoes.destaque.titulo}</span>
                </div>
                <p className="text-gray-600">
                  {statsCotacoes.destaque.fornecedores?.length || 0} fornecedor(es) • Menor: <b className="text-gray-900">{fmtVal(statsCotacoes.destaque.menorPreco)}</b>
                </p>
                <span className="inline-block mt-2 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-black text-[10px] uppercase">
                  {statsCotacoes.destaque.status || 'Em andamento'}
                </span>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 rounded-xl border border-gray-200 text-xs text-gray-400 text-center">
                Nenhuma cotação ativa no momento.
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 text-xs font-bold text-brand-600 flex items-center gap-1 justify-end">
            <span>Abrir Módulo de Cotações</span>
            <ArrowRight size={13} />
          </div>
        </div>

        {/* Card 2: Manutenções */}
        <div 
          onClick={() => navigate('/manutencoes')}
          className="bg-white p-6 rounded-2xl border border-pale-300 shadow-sm hover:shadow-md hover:border-brand-400 transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
                  <Wrench size={20} />
                </div>
                <h3 className="font-bold text-gray-900 text-lg">Manutenções</h3>
              </div>
              <ChevronRight size={18} className="text-gray-400 group-hover:translate-x-1 transition-transform" />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs mb-4">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-gray-200">
                <span className="text-gray-500 font-medium">Pendentes:</span>
                <p className="text-base font-black text-amber-600">{statsManutencoes.pendentes}</p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-gray-200">
                <span className="text-gray-500 font-medium">Em andamento:</span>
                <p className="text-base font-black text-blue-600">{statsManutencoes.emAndamento}</p>
              </div>
              <div className="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-200">
                <span className="text-emerald-800 font-bold">Concluídas:</span>
                <p className="text-base font-black text-emerald-700">{statsManutencoes.concluidas}</p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-gray-200">
                <span className="text-gray-500 font-medium">Vencendo 30 dias:</span>
                <p className="text-base font-black text-gray-900">{statsManutencoes.vencendo30Dias}</p>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              {statsManutencoes.atrasadas.length > 0 ? (
                statsManutencoes.atrasadas.map((m, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-rose-50 border border-rose-100 text-rose-800 font-bold">
                    <span>🔴</span>
                    <span className="truncate">{m.titulo || m.equipamento} — Atrasada ({m.dias}d)</span>
                  </div>
                ))
              ) : statsManutencoes.proximas.length > 0 ? (
                statsManutencoes.proximas.map((m, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 border border-amber-100 text-amber-800 font-bold">
                    <span>🟡</span>
                    <span className="truncate">{m.titulo || m.equipamento} — Em {m.dias} dias</span>
                  </div>
                ))
              ) : (
                <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-100 text-xs font-bold text-center">
                  ✅ Todas as manutenções preventivas em dia.
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 text-xs font-bold text-brand-600 flex items-center gap-1 justify-end">
            <span>Abrir Manutenções</span>
            <ArrowRight size={13} />
          </div>
        </div>

        {/* Card 3: Contratos & Seguros */}
        <div 
          onClick={() => navigate('/seguro')}
          className="bg-white p-6 rounded-2xl border border-pale-300 shadow-sm hover:shadow-md hover:border-brand-400 transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700">
                  <Shield size={20} />
                </div>
                <h3 className="font-bold text-gray-900 text-lg">Contratos & Seguros</h3>
              </div>
              <ChevronRight size={18} className="text-gray-400 group-hover:translate-x-1 transition-transform" />
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs mb-4">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-gray-200 text-center">
                <span className="text-gray-500 font-medium">Ativos:</span>
                <p className="text-base font-black text-gray-900">{statsContratos.ativos}</p>
              </div>
              <div className="bg-amber-50/60 p-2.5 rounded-xl border border-amber-200 text-center">
                <span className="text-amber-800 font-bold">30 dias:</span>
                <p className="text-base font-black text-amber-700">{statsContratos.vencendo30Dias}</p>
              </div>
              <div className="bg-rose-50/60 p-2.5 rounded-xl border border-rose-200 text-center">
                <span className="text-rose-800 font-bold">Vencidos:</span>
                <p className="text-base font-black text-rose-700">{statsContratos.vencidos}</p>
              </div>
            </div>

            {statsContratos.urgente ? (
              <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-amber-900 mb-1">
                  <span>⚠️</span>
                  <span className="truncate">{statsContratos.urgente.titulo || statsContratos.urgente.seguradora || 'Contrato/Apólice'}</span>
                </div>
                <p className="text-gray-600 font-medium">
                  Vence em <b className="text-gray-900">{statsContratos.urgente.dias} dias</b> ({statsContratos.urgente.dataFormatada})
                </p>
                <span className="inline-block mt-2 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[10px]">
                  Renovação necessária
                </span>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 rounded-xl border border-gray-200 text-xs text-gray-400 text-center">
                Nenhum contrato com vencimento próximo.
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 text-xs font-bold text-brand-600 flex items-center gap-1 justify-end">
            <span>Abrir Contratos & Seguros</span>
            <ArrowRight size={13} />
          </div>
        </div>
      </div>

      {/* 3. CENTRAL DE ALERTAS CRÍTICOS (⚠️ ATENÇÃO) */}
      <div className="bg-white p-6 rounded-2xl border border-pale-300 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
              <AlertCircle size={18} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">⚠️ Central de Alertas Críticos — Decisões de Hoje</h3>
              <p className="text-xs text-gray-400">Clique em qualquer item para agir diretamente</p>
            </div>
          </div>
          <span className="text-xs bg-amber-100 text-amber-800 px-3 py-1 rounded-full font-bold">
            {alertasCriticos.length} pendências prioritárias
          </span>
        </div>

        {alertasCriticos.length === 0 ? (
          <div className="p-6 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 text-center text-xs font-bold">
            ✨ Excelente! Não há alertas críticos ou pendências urgentes para este condomínio hoje.
          </div>
        ) : (
          <div className="space-y-2.5">
            {alertasCriticos.map(alerta => (
              <div
                key={alerta.id}
                onClick={() => navigate(alerta.rota)}
                className="p-3.5 bg-slate-50 hover:bg-brand-50/60 rounded-xl border border-gray-200 hover:border-brand-300 transition-all cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{alerta.icone}</span>
                  <span className="text-sm font-bold text-gray-800 group-hover:text-brand-800 transition-colors">
                    {alerta.texto}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-brand-600 group-hover:translate-x-1 transition-transform">
                  <span>Resolver</span>
                  <ArrowRight size={14} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Auditoria e Limpeza Direta de Inadimplência */}
      {modalInadimplencia && (
        <div className="modal-overlay" onClick={() => !limpandoInadimp && setModalInadimplencia(false)}>
          <div className="modal-content max-w-xl" onClick={e => e.stopPropagation()}>
            <div className="p-4 sm:p-5 border-b border-gray-200 flex items-center justify-between gap-3 bg-rose-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">
                    Auditoria de Inadimplência & Cobrança
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    {itensInadimplentes.length} fatura(s) ou boleto(s) constando em atraso no painel
                  </p>
                </div>
              </div>
              <button
                onClick={() => !limpandoInadimp && setModalInadimplencia(false)}
                className="text-gray-400 hover:text-gray-700 p-1"
                disabled={limpandoInadimp}
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              <div className="p-3 bg-slate-50 border border-gray-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Valor Total Acumulado</span>
                  <span className="text-xl font-black text-rose-600">{fmtVal(inadimplenciaTotal)}</span>
                </div>
                {itensInadimplentes.length > 0 && (
                  <button
                    onClick={async () => {
                      if (!window.confirm(`⚠️ Deseja realmente EXCLUIR DEFINITIVAMENTE todas as ${itensInadimplentes.length} pendências em atraso (incluindo o boleto/lançamento de teste de R$ 2,50)? Esta ação zerará a inadimplência imediatamente no banco de dados.`)) return
                      setLimpandoInadimp(true)
                      try {
                        for (const item of itensInadimplentes) {
                          if (item.origem === 'boletos') {
                            await deleteBoleto(item.id)
                          } else if (item.origem === 'financeiro_lancamentos') {
                            await deleteFinanceiro(item.id)
                          }
                        }
                        setModalInadimplencia(false)
                        alert("✅ Todas as pendências de inadimplência foram excluídas com sucesso do banco de dados!")
                      } catch(err) {
                        console.error(err)
                        alert("Erro ao excluir algumas pendências. Tente novamente.")
                      } finally {
                        setLimpandoInadimp(false)
                      }
                    }}
                    disabled={limpandoInadimp}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                    title="Excluir tudo o que está gerando inadimplência"
                  >
                    <Trash2 size={13} />
                    <span>Excluir Todas ({itensInadimplentes.length})</span>
                  </button>
                )}
              </div>

              <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-xl">
                {itensInadimplentes.length === 0 ? (
                  <div className="p-6 text-center text-xs text-gray-400">
                    Nenhuma fatura em atraso encontrada. Inadimplência zerada!
                  </div>
                ) : (
                  itensInadimplentes.map((item, idx) => (
                    <div key={item.id || idx} className="p-3 bg-white hover:bg-slate-50 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-slate-900 text-xs truncate">{item.morador}</p>
                          <span className="text-[10px] bg-slate-100 text-gray-600 font-bold px-1.5 py-0.5 rounded">
                            Apt {item.apt}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          🏢 {item.condominio} • Vencimento: <b className="text-rose-600">{item.vencimento}</b> ({item.origem === 'boletos' ? 'Boleto' : 'Lançamento'})
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-black text-rose-600 text-xs">
                          {fmtVal(item.valor)}
                        </span>
                        <button
                          onClick={async () => {
                            if (!window.confirm(`Deseja excluir este item de "${item.morador}" no valor de ${fmtVal(item.valor)}?`)) return
                            try {
                              if (item.origem === 'boletos') {
                                await deleteBoleto(item.id)
                              } else {
                                await deleteFinanceiro(item.id)
                              }
                            } catch(e) {
                              console.error(e)
                            }
                          }}
                          className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-700 transition-colors border border-red-200 cursor-pointer"
                          title="Excluir este boleto/lançamento"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-gray-200 flex items-center justify-between">
              <button
                onClick={() => {
                  setModalInadimplencia(false)
                  navigate('/boletos')
                }}
                className="text-xs font-bold text-brand-600 hover:underline cursor-pointer"
              >
                Abrir Tela de Boletos →
              </button>
              <button
                onClick={() => setModalInadimplencia(false)}
                className="btn-secondary text-xs"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
