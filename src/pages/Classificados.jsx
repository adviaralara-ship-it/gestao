import React, { useState } from 'react'
import { ShoppingBag, Search, Plus, Trash2, MapPin, MessageSquare, Tag, X, ExternalLink, Building2 } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'

export default function Classificados() {
  const { user } = useAuth()
  const isAdmin = ['Administrador', 'Síndico'].includes(user?.role)
  const { items: anuncios, addItem, deleteItem } = useFirestore('classificados')
  const { items: condominios } = useFirestore('condominios')
  
  const [modal, setModal] = useState(false)
  const [busca, setBusca] = useState('')
  const [condoFiltro, setCondoFiltro] = useState('')

  const filtrados = anuncios.filter(a => {
    const matchBusca = a.titulo.toLowerCase().includes(busca.toLowerCase()) || 
                       a.descricao.toLowerCase().includes(busca.toLowerCase())
    const matchCondo = !condoFiltro || !a.condominio || a.condominio === 'todos' || a.condominio === condoFiltro
    return matchBusca && matchCondo
  }).sort((a,b) => new Date(b._createdAt) - new Date(a._createdAt))

  const handleSave = async (form) => {
    await addItem({ 
      ...form, 
      anuncianteId: user?.id || 'mock',
      anuncianteNome: user?.nome || 'Morador Teste',
      _createdAt: new Date().toISOString()
    })
    setModal(false)
  }

  const enviarWhats = (tel, titulo) => {
    // Regex para extrair apenas os números do telefone
    const numero = tel.replace(/\D/g, '')
    const msg = `Olá! Vi seu anúncio "${titulo}" nos Classificados do Condomínio e tenho interesse.`
    window.open(`https://wa.me/55${numero}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h2 className="section-title text-xl">Classificados</h2>
          <p className="section-sub">Produtos e serviços oferecidos pelos moradores</p>
        </div>
        {!['Porteiro'].includes(user?.role) && (
          <button onClick={() => setModal(true)} className="btn-primary">
            <Plus size={16} />Criar Anúncio
          </button>
        )}
      </div>

      <div className="card p-4 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center flex-1">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" className="input pl-9 w-full" placeholder="Buscar por produto ou serviço..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>

          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-gray-400" />
            <select
              value={condoFiltro}
              onChange={e => setCondoFiltro(e.target.value)}
              className="input py-2 text-sm bg-white"
            >
              <option value="">🏢 Todos os Condomínios</option>
              {condominios.map(c => (
                <option key={c.id} value={c.nome || c.id}>{c.nome || c.id}</option>
              ))}
            </select>
          </div>
        </div>
        <span className="text-sm text-gray-400 font-medium">{filtrados.length} resultados</span>
      </div>

      {filtrados.length === 0 ? (
        <div className="card text-center py-20">
          <ShoppingBag size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 mb-2">Nenhum anúncio encontrado.</p>
          <p className="text-sm text-gray-400">Que tal ser o primeiro a anunciar um produto ou serviço na comunidade?</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtrados.map(a => {
            const isDono = a.anuncianteId === user?.id
            return (
              <div key={a.id} className="card p-0 overflow-hidden flex flex-col hover:shadow-md transition-shadow group">
                {/* Imagem Placeholder */}
                <div className="h-40 bg-cream-200 relative overflow-hidden flex items-center justify-center">
                  {a.imagemUrl ? (
                    <img src={a.imagemUrl} alt={a.titulo} className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center text-gray-400">
                      <ShoppingBag size={32} className="mx-auto opacity-50 mb-2" />
                      <span className="text-xs font-semibold uppercase tracking-widest opacity-60">Sem Foto</span>
                    </div>
                  )}
                  <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs font-bold text-gray-800 shadow-sm flex items-center gap-1">
                    <Tag size={12} className="text-brand-600"/> {a.categoria}
                  </div>

                  {a.condominio && a.condominio !== 'todos' && (
                    <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-white px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1">
                      <Building2 size={10} /> {a.condominio}
                    </div>
                  )}
                  
                  {/* Botão de excluir se for dono ou admin */}
                  {(isDono || isAdmin) && (
                    <button onClick={() => { if(confirm('Excluir este anúncio?')) deleteItem(a.id) }} className="absolute top-2 left-2 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center text-xs font-bold text-red-500 shadow-sm hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="font-bold text-gray-800 text-lg line-clamp-2 leading-tight flex-1">{a.titulo}</h3>
                  </div>
                  {a.condominio && (
                    <span className="text-[11px] font-medium text-brand-600 bg-brand-50 px-2 py-0.5 rounded w-fit mb-2 flex items-center gap-1">
                      <Building2 size={11} /> {a.condominio === 'todos' ? 'Disponível para todos os condomínios' : a.condominio}
                    </span>
                  )}
                  <p className="text-brand-600 font-black text-xl mb-3">{a.valor > 0 ? `R$ ${Number(a.valor).toLocaleString('pt-BR', {minimumFractionDigits: 2})}` : 'A Combinar / Grátis'}</p>
                  
                  <p className="text-sm text-gray-500 line-clamp-3 mb-4 flex-1">{a.descricao}</p>
                  
                  <div className="border-t border-cream-200 pt-4 mt-auto">
                    <p className="text-xs text-gray-400 font-semibold uppercase mb-2">Anunciante</p>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-xs">
                        {a.anuncianteNome.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800 truncate">{a.anuncianteNome}</p>
                        <p className="text-xs text-gray-500 truncate flex items-center gap-1"><MapPin size={10}/> {a.localizacao || 'Condomínio'}</p>
                      </div>
                    </div>
                    
                    <button onClick={() => enviarWhats(a.telefone, a.titulo)} className="w-full btn-success justify-center py-2.5 text-sm">
                      <MessageSquare size={16} /> Falar no WhatsApp
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal && <ModalClassificadoForm condominios={condominios} onClose={() => setModal(false)} onSave={handleSave} />}
    </div>
  )
}

function ModalClassificadoForm({ condominios = [], onClose, onSave }) {
  const [form, setForm] = useState({ titulo: '', descricao: '', valor: '', categoria: 'Produto', telefone: '', localizacao: '', imagemUrl: '', condominio: 'todos' })

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">Criar Anúncio</h3>
          <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-700" /></button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Título do Anúncio *</label>
              <input className="input w-full" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Bicicleta Caloi Aro 29" autoFocus />
            </div>
            
            <div>
              <label className="label">Categoria</label>
              <select className="input w-full" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                <option>Produto</option>
                <option>Serviço</option>
                <option>Doação</option>
                <option>Imóvel / Vaga</option>
              </select>
            </div>
            
            <div>
              <label className="label">Valor (R$) {form.categoria === 'Doação' && '(Opcional)'}</label>
              <input type="number" min="0" step="0.01" className="input w-full" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" />
            </div>
          </div>

          <div>
            <label className="label">Descrição Detalhada *</label>
            <textarea className="input w-full min-h-[100px]" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Descreva os detalhes, tempo de uso, motivo da venda, etc..." />
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-cream-200 pt-4 mt-2">
            <div>
               <label className="label">Telefone / WhatsApp *</label>
               <input className="input w-full" value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(11) 99999-9999" />
            </div>
            <div>
               <label className="label">Localização (Ex: Bloco/Apto)</label>
               <input className="input w-full" value={form.localizacao} onChange={e => setForm(f => ({ ...f, localizacao: e.target.value }))} placeholder="Ex: Bloco B - Apt 304" />
            </div>
          </div>

          <div>
            <label className="label">Condomínio de Destino (Para quem vai aparecer) *</label>
            <select
              className="input w-full"
              value={form.condominio}
              onChange={e => setForm(f => ({ ...f, condominio: e.target.value }))}
            >
              <option value="todos">🏢 Todos os Condomínios (Geral)</option>
              {condominios.map(c => (
                <option key={c.id} value={c.nome || c.id}>{c.nome || c.id}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">Selecione para qual condomínio este anúncio ficará visível.</p>
          </div>
          
          <div>
            <label className="label">Link de Imagem (Opcional - Hospedada externamente)</label>
            <div className="flex gap-2 relative">
               <ExternalLink size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
               <input className="input w-full pl-9" value={form.imagemUrl} onChange={e => setForm(f => ({ ...f, imagemUrl: e.target.value }))} placeholder="https://exemplo.com/foto.jpg" />
            </div>
          </div>

        </div>
        <div className="p-6 border-t border-cream-300 flex gap-3 justify-end bg-gray-50/50 rounded-b-2xl">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={() => { 
            if(!form.titulo || !form.descricao || !form.telefone) return alert('Preecha Título, Descrição e Telefone para contato.')
            onSave(form) 
          }} className="btn-primary">Publicar Anúncio</button>
        </div>
      </div>
    </div>
  )
}
