import React, { useState, useRef } from 'react'
import { FileText, Printer, Download, Save, CheckCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const modelos = [
  {
    id: 'ata-assembleia',
    nome: 'Ata de Assembleia Ordinária',
    campos: ['condominio', 'data', 'hora', 'sindico', 'presidente', 'secretario', 'assuntos'],
    template: (dados) => `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="text-align: center; text-transform: uppercase;">Ata de Assembleia Geral Ordinária</h2>
        <h3 style="text-align: center;">Condomínio ${dados.condominio}</h3>
        <br/>
        <p>Aos <strong>${dados.data}</strong>, às <strong>${dados.hora}</strong>, reuniram-se em Assembleia Geral Ordinária os condôminos do <strong>${dados.condominio}</strong>, em primeira/segunda chamada.</p>
        <p>A reunião foi presidida por <strong>${dados.presidente}</strong> e secretariada por <strong>${dados.secretario}</strong>.</p>
        <p>Estando presente o síndico <strong>${dados.sindico}</strong>, passou-se à ordem do dia para deliberar sobre os seguintes assuntos:</p>
        <div style="margin-left: 20px; font-style: italic;">
          ${dados.assuntos ? dados.assuntos.split('\n').map(l => `<p>- ${l}</p>`).join('') : ''}
        </div>
        <p>Após amplos debates, as pautas foram aprovadas por maioria simples dos presentes.</p>
        <p>Nada mais havendo a tratar, o Presidente encerrou a sessão, da qual foi lavrada a presente ata, que lida e achada conforme, vai assinada pelo Presidente e Secretário.</p>
        <br/><br/><br/>
        <div style="display: flex; justify-content: space-around; text-align: center; margin-top: 50px;">
          <div>_________________________________<br/>${dados.presidente}<br/>Presidente da Mesa</div>
          <div>_________________________________<br/>${dados.secretario}<br/>Secretário da Mesa</div>
        </div>
      </div>
    `
  },
  {
    id: 'advertencia',
    nome: 'Advertência por Infração',
    campos: ['condominio', 'morador', 'apt', 'data_infracao', 'motivo', 'sindico'],
    template: (dados) => `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="text-align: center; text-transform: uppercase;">Termo de Advertência Formal</h2>
        <br/><br/>
        <p><strong>Ao(s) Morador(es) da Unidade:</strong> ${dados.apt}</p>
        <p><strong>Nome:</strong> ${dados.morador}</p>
        <p><strong>Condomínio:</strong> ${dados.condominio}</p>
        <br/>
        <p>Prezado(a) condômino(a),</p>
        <p>Servimo-nos da presente para notificar e <strong>ADVERTIR</strong> formalmente V. Sa., em virtude de infração cometida no dia <strong>${dados.data_infracao}</strong>, consubstanciada no seguinte fato:</p>
        <p style="padding: 15px; background: #f9f9f9; border-left: 4px solid #cc0000; font-style: italic;">
          ${dados.motivo}
        </p>
        <p>Tal conduta viola expressamente o disposto na Convenção e no Regimento Interno deste condomínio.</p>
        <p>Solicitamos, portanto, a imediata adequação às normas condominiais, sob pena de aplicação de multa pecuniária, conforme previsto em nossa regulamentação.</p>
        <br/><br/>
        <p style="text-align: right;">Atenciosamente, __________________, ${new Date().toLocaleDateString('pt-BR')}.</p>
        <br/><br/>
        <div style="text-align: center; margin-top: 50px;">
          _________________________________<br/>${dados.sindico}<br/>Síndico / Administração
        </div>
      </div>
    `
  }
]

export default function GeradorContratos() {
  const { user } = useAuth()
  const [modeloAtivo, setModeloAtivo] = useState(modelos[0])
  const [form, setForm] = useState({})
  
  const printRef = useRef()

  const handlePrint = () => {
    const printContent = printRef.current.innerHTML
    const originalContent = document.body.innerHTML
    
    document.body.innerHTML = printContent
    window.print()
    document.body.innerHTML = originalContent
    window.location.reload() // Reload to restore React bindings after print hack
  }

  const handleCampo = (campo, valor) => {
    setForm({...form, [campo]: valor})
  }

  const getLabel = (campo) => {
    const labels = {
      condominio: 'Nome do Condomínio',
      data: 'Data da Assembleia',
      hora: 'Horário',
      sindico: 'Nome do Síndico',
      presidente: 'Presidente da Mesa',
      secretario: 'Secretário da Mesa',
      assuntos: 'Assuntos (Um por linha)',
      morador: 'Nome do Morador Infrator',
      apt: 'Apt / Unidade',
      data_infracao: 'Data da Infração',
      motivo: 'Descrição da Infração'
    }
    return labels[campo] || campo
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Gerador de Documentos Mágicos</h1>
        <p className="text-gray-500">Crie atas, advertências e contratos preenchidos automaticamente.</p>
      </div>

      <div className="flex gap-6">
        {/* Lado Esquerdo - Formulário */}
        <div className="w-1/3 space-y-4">
          <div className="bg-white p-5 rounded-xl border border-cream-300 shadow-sm">
            <label className="label text-sm text-brand-600 font-bold mb-2">1. Escolha o Modelo</label>
            <select 
              className="input w-full"
              value={modeloAtivo.id}
              onChange={e => {
                const m = modelos.find(x => x.id === e.target.value)
                setModeloAtivo(m)
                setForm({})
              }}
            >
              {modelos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          </div>

          <div className="bg-white p-5 rounded-xl border border-cream-300 shadow-sm space-y-4">
            <label className="label text-sm text-brand-600 font-bold mb-2">2. Preencha os Dados</label>
            {modeloAtivo.campos.map(campo => (
              <div key={campo}>
                <label className="label capitalize">{getLabel(campo)}</label>
                {campo === 'assuntos' || campo === 'motivo' ? (
                  <textarea 
                    className="input resize-none h-24"
                    value={form[campo] || ''}
                    onChange={e => handleCampo(campo, e.target.value)}
                  />
                ) : (
                  <input 
                    type={campo.includes('data') ? 'date' : campo === 'hora' ? 'time' : 'text'}
                    className="input"
                    value={form[campo] || ''}
                    onChange={e => handleCampo(campo, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>

          <button onClick={handlePrint} className="btn-primary w-full flex justify-center items-center gap-2 py-3">
            <Printer size={20} /> Salvar em PDF / Imprimir
          </button>
        </div>

        {/* Lado Direito - Preview */}
        <div className="w-2/3">
          <div className="bg-gray-100 p-8 rounded-xl border border-cream-300 shadow-inner h-[800px] overflow-y-auto flex justify-center">
            {/* Folha A4 Fake para Preview */}
            <div 
              ref={printRef}
              className="bg-white shadow-lg p-12"
              style={{ width: '210mm', minHeight: '297mm', boxSizing: 'border-box' }}
              dangerouslySetInnerHTML={{ __html: modeloAtivo.template(form) }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
