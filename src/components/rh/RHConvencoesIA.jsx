import React, { useState, useEffect } from 'react'
import { BookOpen, Plus, Trash2, Bot, AlertTriangle } from 'lucide-react'
import { db } from '../../firebase'
import { collection, addDoc, getDocs, deleteDoc, doc, query, where } from 'firebase/firestore'
import { useAuth } from '../../context/AuthContext'

export default function RHConvencoesIA() {
  const { user } = useAuth()
  const [convencoes, setConvencoes] = useState([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ titulo: '', texto: '' })

  const fetchConvencoes = async () => {
    setLoading(true)
    try {
      const q = query(collection(db, 'ai_knowledge'), where('tipo', '==', 'convencao_rh'))
      const snap = await getDocs(q)
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setConvencoes(data)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchConvencoes()
  }, [])

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!form.titulo || !form.texto) return
    try {
      await addDoc(collection(db, 'ai_knowledge'), {
        titulo: form.titulo,
        text: form.texto,
        tipo: 'convencao_rh',
        dataCadastro: new Date().toISOString()
      })
      setShowModal(false)
      setForm({ titulo: '', texto: '' })
      fetchConvencoes()
    } catch (e) {
      console.error(e)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Deseja excluir esta convenção? O Assistente IA deixará de considerá-la.')) return
    try {
      await deleteDoc(doc(db, 'ai_knowledge', id))
      fetchConvencoes()
    } catch (e) {
      console.error(e)
    }
  }

  const loadJP = () => {
    setForm({
      titulo: 'Convenção Coletiva de João Pessoa (SINDIFICIOS-PB)',
      texto: `CONVENÇÃO COLETIVA DE TRABALHO - JOÃO PESSOA / PB (SINDIFICIOS-PB e SINDICON-PB)
Cláusula 1: Piso salarial do Porteiro: R$ 1.550,00. Zelador: R$ 1.800,00.
Cláusula 2: Vale Alimentação (Ticket): R$ 25,00 por dia trabalhado.
Cláusula 3: Adicional Noturno: 20% sobre o salário base.
Cláusula 4: Feriados trabalhados devem ser pagos em dobro ou compensados na mesma semana.
Cláusula 5: Horário de Almoço/Janta (Intervalo Intrajornada) é de 1 hora obrigatória.
Cláusula 6: Escala 12x36 é permitida desde que haja acordo por escrito.`
    })
    setShowModal(true)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-cream-200 p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <BookOpen size={20} className="text-brand-600" />
            Convenções Coletivas & Leis Trabalhistas
          </h3>
          <p className="text-sm text-gray-500">
            Cadastre os textos das convenções aqui. A <strong>Alpha AI</strong> lerá essas informações para te ajudar em cálculos e direitos trabalhistas (clique no robô azul no canto da tela).
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadJP} className="btn btn-outline text-xs">
            + Template João Pessoa (PB)
          </button>
          <button onClick={() => setShowModal(true)} className="btn btn-primary text-xs">
            <Plus size={14} /> Nova Convenção
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-8">Carregando convenções...</div>
      ) : convencoes.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <Bot size={40} className="mx-auto text-gray-300 mb-3" />
          <h3 className="text-gray-500 font-bold">Nenhuma convenção cadastrada</h3>
          <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">
            A Inteligência Artificial precisa que você cadastre os textos das convenções coletivas da sua região para poder te dar respostas precisas.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {convencoes.map(c => (
            <div key={c.id} className="border border-cream-300 p-4 rounded-xl relative group hover:border-brand-300 transition-colors">
              <h4 className="font-bold text-gray-700">{c.titulo}</h4>
              <p className="text-xs text-gray-500 mt-2 line-clamp-3">{c.text}</p>
              
              <button 
                onClick={() => handleDelete(c.id)}
                className="absolute top-4 right-4 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={16} />
              </button>
              
              <div className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                <Bot size={12} /> IA APRENDEU ISTO
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-gray-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-cream-200 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-700">Cadastrar Nova Convenção</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <form onSubmit={handleAdd} className="p-6 flex flex-col gap-4">
              <div>
                <label className="label">Título (Ex: Convenção João Pessoa 2026)</label>
                <input 
                  type="text" 
                  required
                  className="input" 
                  value={form.titulo}
                  onChange={e => setForm({...form, titulo: e.target.value})}
                />
              </div>
              <div>
                <label className="label">Texto da Convenção (Cole o texto ou os resumos aqui)</label>
                <textarea 
                  required
                  className="input min-h-[250px] resize-y" 
                  placeholder="Artigo 1..."
                  value={form.texto}
                  onChange={e => setForm({...form, texto: e.target.value})}
                />
              </div>
              <div className="flex gap-2 justify-end mt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-outline">Cancelar</button>
                <button type="submit" className="btn btn-primary">Salvar na IA</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
