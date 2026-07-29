import React, { useState } from 'react'
import { BookOpen, Edit2, Save, X, Plus, Trash2 } from 'lucide-react'

const initialArticles = [
  { id: 1, titulo: 'Art. 1 – Das Disposições Gerais', conteudo: 'O presente Regime Interno é parte integrante da Convenção de Condomínio e tem por finalidade regular o uso das áreas comuns, as relações entre condôminos e a administração do condomínio.' },
  { id: 2, titulo: 'Art. 2 – Do Uso das Unidades Autônomas', conteudo: 'Cada condômino tem o direito de usar, fruir e dispor de sua unidade autônoma conforme estabelecido na Convenção, vedando-se o uso para fins ilícitos ou que causem perturbação aos demais.' },
  { id: 3, titulo: 'Art. 3 – Das Áreas Comuns', conteudo: 'As áreas comuns, incluindo hall, corredores, elevadores, garagem, salão de festas, piscina e demais dependências, são de uso de todos os condôminos, observadas as regras deste Regime.' },
  { id: 4, titulo: 'Art. 4 – Do Silêncio', conteudo: 'Entre 22h e 8h, é obrigatório o silêncio nas dependências do condomínio. Ruídos que perturbem o sossego dos condôminos são sujeitos a advertência e multa.' },
  { id: 5, titulo: 'Art. 5 – Das Multas e Penalidades', conteudo: '1ª infração: advertência escrita. 2ª infração: multa de R$ 300,00. Reincidências: multa em dobro acumulativamente. Valores reajustados anualmente pelo IGPM.' },
  { id: 6, titulo: 'Art. 6 – Do Regime Externo (Prestadores)', conteudo: 'Prestadores de serviço devem se identificar na portaria, portar crachá e estão sujeitos às normas do condomínio. Vedada a entrada fora do horário comercial sem autorização prévia do síndico.' },
]

function ArticleEditor({ article, onSave, onCancel }) {
  const [titulo, setTitulo] = useState(article.titulo)
  const [conteudo, setConteudo] = useState(article.conteudo)
  return (
    <div className="border border-brand-400 rounded-xl p-4 bg-pale-100 animate-fade-in">
      <div className="mb-3">
        <label className="label">Título</label>
        <input className="input" value={titulo} onChange={e => setTitulo(e.target.value)} />
      </div>
      <div className="mb-4">
        <label className="label">Conteúdo</label>
        <textarea className="input resize-none min-h-[100px]" value={conteudo} onChange={e => setConteudo(e.target.value)} />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="btn-secondary py-1.5 text-xs"><X size={12} />Cancelar</button>
        <button onClick={() => onSave(titulo, conteudo)} className="btn-primary py-1.5 text-xs"><Save size={12} />Salvar</button>
      </div>
    </div>
  )
}

function ArticleItem({ article, onEdit, onDelete }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-cream-400 rounded-xl overflow-hidden hover:border-brand-300 transition-all group">
      <div className="flex items-center p-4">
        <button className="flex-1 text-left flex items-center justify-between" onClick={() => setOpen(o => !o)}>
          <p className="font-semibold text-gray-800 text-sm">{article.titulo}</p>
          <span className="text-gray-400 text-xs ml-2">{open ? '▲' : '▼'}</span>
        </button>
        <div className="flex gap-1.5 ml-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(article)} className="p-1.5 rounded-lg bg-cream-200 hover:bg-brand-100 text-gray-400 hover:text-brand-700 transition-all"><Edit2 size={11} /></button>
          <button onClick={() => onDelete(article.id)} className="p-1.5 rounded-lg bg-cream-200 hover:bg-red-100 text-gray-400 hover:text-red-500 transition-all"><Trash2 size={11} /></button>
        </div>
      </div>
      {open && (
        <div className="px-4 pb-4 text-sm text-gray-600 leading-relaxed border-t border-cream-300 pt-3 animate-fade-in">
          {article.conteudo}
        </div>
      )}
    </div>
  )
}

export default function Regime() {
  const [articles, setArticles] = useState(initialArticles)
  const [editing, setEditing] = useState(null) // null | 'new' | {article}
  const [newForm, setNewForm] = useState({ titulo: '', conteudo: '' })

  const saveEdit = (id, titulo, conteudo) => {
    setArticles(as => as.map(a => a.id === id ? { ...a, titulo, conteudo } : a))
    setEditing(null)
  }

  const deleteArticle = (id) => {
    if (window.confirm('Deseja excluir este artigo?')) setArticles(as => as.filter(a => a.id !== id))
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="page-header">
        <div><h2 className="section-title text-xl">Regime Interno & Externo</h2><p className="section-sub">Regulamento do condomínio</p></div>
        <button onClick={() => setEditing('new')} className="btn-primary"><Plus size={14} />Novo Artigo</button>
      </div>

      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <BookOpen size={18} className="text-brand-500" />
          <span className="font-bold text-gray-800">Regulamento Interno – Condomínio Alpha</span>
          <span className="badge-green ml-auto">Vigente</span>
        </div>
        <p className="text-xs text-gray-400 mb-5">Última atualização: {new Date().toLocaleDateString('pt-BR')} · Passe o mouse sobre o artigo para editar ou excluir.</p>

        {editing === 'new' && (
          <div className="mb-4 border border-brand-400 rounded-xl p-4 bg-pale-100 animate-fade-in">
            <div className="mb-3">
              <label className="label">Título do Artigo</label>
              <input className="input" value={newForm.titulo} onChange={e => setNewForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Art. 7 – Das Obras" />
            </div>
            <div className="mb-4">
              <label className="label">Conteúdo</label>
              <textarea className="input resize-none min-h-[100px]" value={newForm.conteudo} onChange={e => setNewForm(f => ({ ...f, conteudo: e.target.value }))} />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditing(null)} className="btn-secondary py-1.5 text-xs"><X size={12} />Cancelar</button>
              <button onClick={() => {
                if (!newForm.titulo) return
                setArticles(as => [...as, { id: Date.now(), ...newForm }])
                setNewForm({ titulo: '', conteudo: '' })
                setEditing(null)
              }} className="btn-primary py-1.5 text-xs"><Save size={12} />Salvar Artigo</button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {articles.map(a =>
            editing && editing !== 'new' && editing.id === a.id
              ? <ArticleEditor key={a.id} article={editing} onCancel={() => setEditing(null)} onSave={(t, c) => saveEdit(a.id, t, c)} />
              : <ArticleItem key={a.id} article={a} onEdit={a => setEditing(a)} onDelete={deleteArticle} />
          )}
        </div>
      </div>
    </div>
  )
}
