import React, { useState } from 'react'
import { Video, Plus, Edit2, Trash2, ExternalLink, Shield, Lock, Users, MapPin, Eye, Filter } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'

const LOCALIZACOES = [
  'Portaria e Acessos',
  'Garagem e Estacionamento',
  'Áreas de Lazer (Piscina/Playground/Salão)',
  'Halls e Elevadores',
  'Área Restrita / Operacional (Guarita/Bombas/CFTV)',
  'Perímetro e Muros'
]

function CameraModal({ data, onClose, onSave, currentUser, condominios = [] }) {
  const [form, setForm] = useState(data || {
    nome: '',
    link: '',
    appExterno: '',
    condominio: currentUser?.condominio || condominios[0]?.nome || '',
    localizacao: 'Portaria e Acessos',
    visibilidade: 'moradores' // 'moradores' | 'portaria' | 'restrita'
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const isMorador = currentUser?.role === 'Morador'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-brand-50 text-brand-700 rounded-xl">
              <Video size={18} />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-base">{data ? 'Editar Câmera' : 'Nova Câmera'}</h3>
              <p className="text-xs text-gray-500">Configuração de stream e controle de permissões de acesso</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-lg">✕</button>
        </div>

        <div className="p-6 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
          {/* Nome */}
          <div>
            <label className="label">Nome da Câmera / Ponto de Monitoramento *</label>
            <input
              className="input"
              placeholder="Ex: Portaria Principal - Entrada Pedestres"
              value={form.nome}
              onChange={e => set('nome', e.target.value)}
              required
            />
          </div>

          {/* Condomínio */}
          <div>
            <label className="label">Condomínio *</label>
            {isMorador ? (
              <input className="input" value={form.condominio} disabled />
            ) : (
              <select className="input" value={form.condominio} onChange={e => set('condominio', e.target.value)}>
                <option value="">Selecione o Condomínio...</option>
                {condominios.map(c => (
                  <option key={c.id || c.nome} value={c.nome}>{c.nome}</option>
                ))}
              </select>
            )}
          </div>

          {/* Localização / Setor */}
          <div>
            <label className="label flex items-center gap-1.5">
              <MapPin size={13} className="text-brand-600" />
              Localização / Setor
            </label>
            <select
              className="input"
              value={form.localizacao || 'Portaria e Acessos'}
              onChange={e => set('localizacao', e.target.value)}
            >
              {LOCALIZACOES.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>

          {/* Nível de Permissão de Acesso */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <label className="label flex items-center gap-1.5 text-slate-800 font-bold mb-1">
              <Shield size={14} className="text-brand-600" />
              Quem pode visualizar esta câmera?
            </label>
            <p className="text-[11px] text-slate-500 mb-3">Defina quais perfis têm autorização para assistir ao sinal desta câmera.</p>

            <div className="flex flex-col gap-2">
              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${form.visibilidade === 'moradores' ? 'bg-emerald-50/60 border-emerald-300 ring-1 ring-emerald-300' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                <input
                  type="radio"
                  name="visibilidade"
                  value="moradores"
                  checked={form.visibilidade === 'moradores' || !form.visibilidade}
                  onChange={e => set('visibilidade', e.target.value)}
                  className="mt-1"
                />
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                    <Users size={13} className="text-emerald-600" />
                    <span>Liberada para Todos os Moradores</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">Visível para condôminos, portaria, síndico e administração. (Ideal para portões de entrada, lazer e garagens).</p>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${form.visibilidade === 'portaria' ? 'bg-amber-50/60 border-amber-300 ring-1 ring-amber-300' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                <input
                  type="radio"
                  name="visibilidade"
                  value="portaria"
                  checked={form.visibilidade === 'portaria'}
                  onChange={e => set('visibilidade', e.target.value)}
                  className="mt-1"
                />
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                    <Shield size={13} className="text-amber-600" />
                    <span>Apenas Portaria e Gestão</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">Visível apenas para porteiros, síndico e administração. Moradores NÃO têm acesso.</p>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${form.visibilidade === 'restrita' ? 'bg-rose-50/60 border-rose-300 ring-1 ring-rose-300' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                <input
                  type="radio"
                  name="visibilidade"
                  value="restrita"
                  checked={form.visibilidade === 'restrita'}
                  onChange={e => set('visibilidade', e.target.value)}
                  className="mt-1"
                />
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                    <Lock size={13} className="text-rose-600" />
                    <span>Restrita (Apenas Síndico e Administrador)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">Exclusiva da alta gestão. Nem moradores nem portaria conseguem visualizar. (Ideal para guarita interna, casa de bombas, máquinas e finanças).</p>
                </div>
              </label>
            </div>
          </div>

          {/* Links */}
          <div>
            <label className="label">Link Web do Vídeo (Iframe / WebRTC / HLS)</label>
            <input
              className="input font-mono text-xs"
              placeholder="https://..."
              value={form.link || ''}
              onChange={e => set('link', e.target.value)}
            />
            <p className="text-[10px] text-slate-400 mt-1">Gera o player direto na tela do sistema da Alpha.</p>
          </div>

          <div>
            <label className="label">Link do App Externo (Opcional - Android/iOS)</label>
            <input
              className="input font-mono text-xs"
              placeholder="https://..."
              value={form.appExterno || ''}
              onChange={e => set('appExterno', e.target.value)}
            />
          </div>
        </div>

        <div className="p-6 border-t border-cream-300 flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={() => onSave(form)} className="btn-primary">Salvar Câmera</button>
        </div>
      </div>
    </div>
  )
}

export default function Cameras() {
  const { user } = useAuth()
  const { items, addItem, updateItem, deleteItem } = useFirestore('cameras')
  const { items: condominios } = useFirestore('condominios')

  const role = user?.role || 'Morador'
  const isMorador = role === 'Morador'
  const isPortaria = role === 'Porteiro' || role === 'Portaria Remota'
  const isGestao = role === 'Síndico' || role === 'Administrador'

  const [condoFiltro, setCondoFiltro] = useState(isMorador ? user?.condominio : 'Todos')
  const [localizacaoFiltro, setLocalizacaoFiltro] = useState('Todas')
  const [modal, setModal] = useState(null)

  const filtered = items.filter(c => {
    // 1. Filtragem por Condomínio
    if (isMorador && user?.condominio && c.condominio !== user.condominio) return false
    if (isPortaria && user?.condominio && c.condominio !== user.condominio) return false
    if (role === 'Síndico' && user?.condominio && c.condominio !== user.condominio) return false
    if (role === 'Administrador' && condoFiltro !== 'Todos' && c.condominio !== condoFiltro) return false

    // 2. Filtragem por Permissão / Visibilidade
    const vis = c.visibilidade || 'moradores'
    if (isMorador && vis !== 'moradores') return false // morador nunca vê câmeras restritas ou de portaria
    if (isPortaria && vis === 'restrita') return false // portaria não vê restritas à gestão

    // 3. Filtragem por Localização
    if (localizacaoFiltro !== 'Todas' && (c.localizacao || 'Portaria e Acessos') !== localizacaoFiltro) return false

    return true
  })

  const handleSave = async form => {
    if (modal === 'new') await addItem(form)
    else await updateItem(modal.id, form)
    setModal(null)
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="page-header flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="section-title text-xl flex items-center gap-2">
            <Video className="text-brand-600" size={24} />
            Monitoramento e Câmeras (CFTV)
          </h2>
          <p className="section-sub">
            {isMorador
              ? 'Transmissão ao vivo das áreas comuns autorizadas do seu condomínio'
              : 'Gerenciamento de streams de CFTV com controle de privacidade e permissões'}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {role === 'Administrador' && (
            <select
              className="input py-2 text-xs font-bold text-gray-800 bg-white border-gray-300 rounded-xl"
              value={condoFiltro}
              onChange={e => setCondoFiltro(e.target.value)}
            >
              <option value="Todos">🏢 Todos os Condomínios</option>
              {condominios.map(c => (
                <option key={c.id || c.nome} value={c.nome}>{c.nome}</option>
              ))}
            </select>
          )}

          {isGestao && (
            <button onClick={() => setModal('new')} className="btn-primary">
              <Plus size={16} /> Nova Câmera
            </button>
          )}
        </div>
      </div>

      {/* Barra de Filtros por Setor / Localização */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-slate-400 font-semibold flex items-center gap-1 pl-1">
          <Filter size={12} /> Setor:
        </span>
        <button
          onClick={() => setLocalizacaoFiltro('Todas')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap ${localizacaoFiltro === 'Todas' ? 'bg-brand-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}
        >
          Todas ({items.length})
        </button>
        {LOCALIZACOES.map(loc => {
          const count = items.filter(c => (c.localizacao || 'Portaria e Acessos') === loc).length
          if (count === 0 && !isGestao) return null
          return (
            <button
              key={loc}
              onClick={() => setLocalizacaoFiltro(loc)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${localizacaoFiltro === loc ? 'bg-brand-600 text-white shadow-sm font-bold' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}
            >
              <span>{loc.split('(')[0].trim()}</span>
              {count > 0 && <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${localizacaoFiltro === loc ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>{count}</span>}
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-16 text-slate-400 text-sm bg-white border border-dashed border-slate-200 rounded-2xl">
          <Video size={40} className="mx-auto mb-3 opacity-40 text-slate-400" />
          <p className="font-semibold text-slate-600">Nenhuma câmera disponível para exibição.</p>
          <p className="text-xs text-slate-400 mt-1">
            {isMorador
              ? 'Não há câmeras liberadas para moradores neste setor ou condomínio.'
              : 'Cadastre uma nova câmera ou ajuste os filtros de condomínio e setor.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filtered.map(c => {
            const vis = c.visibilidade || 'moradores'
            return (
              <div key={c.id} className="card p-0 overflow-hidden group shadow-sm border border-slate-200 hover:shadow-md transition-all rounded-2xl bg-white flex flex-col">
                {/* Header da Câmera com Badges */}
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                    <h3 className="font-bold text-gray-800 text-sm truncate" title={c.nome}>{c.nome}</h3>
                  </div>

                  {/* Badge de Visibilidade / Permissão */}
                  {vis === 'restrita' && (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 text-rose-700 flex items-center gap-1 shrink-0">
                      <Lock size={10} /> Restrita (Gestão)
                    </span>
                  )}
                  {vis === 'portaria' && (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-700 flex items-center gap-1 shrink-0">
                      <Shield size={10} /> Portaria & Gestão
                    </span>
                  )}
                  {vis === 'moradores' && (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1 shrink-0">
                      <Users size={10} /> Moradores
                    </span>
                  )}
                </div>

                {/* Player ou Placeholder */}
                <div className="bg-slate-900 aspect-video relative flex items-center justify-center">
                  {c.link ? (
                    <iframe
                      src={c.link}
                      className="w-full h-full border-0"
                      allowFullScreen
                      allow="autoplay; camera; microphone"
                      title={c.nome}
                    ></iframe>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-500 p-6 text-center">
                      <Video size={48} className="mb-4 opacity-50" />
                      <p className="text-sm font-medium text-slate-300">Câmera Externa (DVR)</p>
                      {c.appExterno && (
                        <a
                          href={c.appExterno}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-4 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-bold transition-all flex items-center gap-2"
                        >
                          Abrir App da Câmera <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  )}

                  {/* Ações para Síndico / Administrador */}
                  {isGestao && (
                    <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setModal(c)}
                        title="Editar configurações e permissões"
                        className="p-2 rounded-lg bg-black/60 hover:bg-white hover:text-slate-900 text-white transition-all backdrop-blur-sm"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => deleteItem(c.id)}
                        title="Remover câmera"
                        className="p-2 rounded-lg bg-red-600/80 hover:bg-red-600 text-white transition-all backdrop-blur-sm"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Rodapé do Card com Detalhes */}
                <div className="p-3.5 bg-white flex items-center justify-between text-xs text-slate-500 border-t border-slate-100">
                  <div className="flex items-center gap-1 font-semibold text-slate-700">
                    <span>🏢</span>
                    <span>{c.condominio}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-slate-500">
                    <MapPin size={11} className="text-slate-400" />
                    <span>{c.localizacao || 'Portaria e Acessos'}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal && (
        <CameraModal
          data={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
          currentUser={user}
          condominios={condominios}
        />
      )}
    </div>
  )
}
