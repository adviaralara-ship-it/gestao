import React, { useState, useEffect } from 'react'
import { FileText, Plus, Download, DollarSign, Printer, CheckCircle2, Clock, AlertCircle, Trash2, Edit2, X, MessageSquare, Sparkles, Check, TrendingUp, Bell, Building, Upload } from 'lucide-react'
import { useFirestore } from '../hooks/useFirestore'
import { useAuth } from '../context/AuthContext'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { notificarAdm, enviarEmail } from '../emailjs.config'

function gerarLinhaDigitavel(apt, valor, venc) {
  const r = () => Math.floor(Math.random() * 9)
  return `34191.${r()}${r()}${r()}${r()}${r()} ${r()}${r()}${r()}${r()}${r()}.${r()}${r()}${r()}${r()}${r()}${r()} ${r()}${r()}${r()}${r()}${r()}.${r()}${r()}${r()}${r()}${r()}${r()} ${r()} ${(venc||'').replace(/\//g,'')}${String(Math.round((valor||0)*100)).padStart(10,'0')}`
}

function BoletoPrintModal({ boleto, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">Boleto – {boleto.morador}</h3>
          <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-700" /></button>
        </div>
        <div className="p-6">
          <div className="border-2 border-gray-200 rounded-xl overflow-hidden font-mono">
            <div className="bg-brand-700 text-white p-4 flex items-center justify-between">
              <div><p className="font-black text-lg">Alpha Soluções Condominiais</p><p className="text-xs opacity-80">CNPJ: 00.000.000/0001-00</p></div>
              <div className="text-right"><p className="text-xs opacity-80">Banco</p><p className="text-2xl font-black">341-7</p></div>
            </div>
            <div className="p-4 bg-white grid grid-cols-2 gap-4 text-sm border-b border-gray-200">
              <div><p className="text-xs text-gray-400">Sacado</p><p className="font-bold text-gray-800">{boleto.morador}</p></div>
              <div><p className="text-xs text-gray-400">Unidade</p><p className="font-bold text-gray-800">Apt {boleto.apt}</p></div>
              <div><p className="text-xs text-gray-400">Competência</p><p className="font-bold text-gray-800">{boleto.competencia}</p></div>
              <div><p className="text-xs text-gray-400">Vencimento</p><p className="font-bold text-gray-800">{boleto.vencimento}</p></div>
              <div><p className="text-xs text-gray-400">Descrição</p><p className="font-bold text-gray-800">Taxa de Condomínio</p></div>
              <div><p className="text-xs text-gray-400">Valor</p><p className="font-black text-brand-700 text-lg">R$ {Number(boleto.valor||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</p></div>
            </div>
            <div className="p-4 bg-gray-50"><p className="text-xs text-gray-500 mb-2">Pix Copia e Cola:</p><p className="text-sm font-bold text-gray-800 tracking-wider break-all">{boleto.pix_emv || boleto.linha}</p></div>
            <div className="p-4 bg-white flex justify-center"><div className="flex gap-px h-12">{Array.from({length:80}).map((_,i)=><div key={i} className="bg-gray-900" style={{width:Math.random()>0.5?3:1}}/>)}</div></div>
            <div className="p-3 bg-gray-50 text-center text-xs text-gray-400">Este é um boleto oficial emitido via Banco Cora · Alpha Soluções Condominiais © 2025</div>
          </div>
        </div>
        <div className="p-6 border-t border-cream-300 flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Fechar</button>
          {boleto.url ? (
             <a href={boleto.url} target="_blank" rel="noreferrer" className="btn-primary"><Printer size={14}/>Imprimir PDF</a>
          ) : (
             <button onClick={()=>window.print()} className="btn-primary"><Printer size={14}/>Imprimir</button>
          )}
        </div>
      </div>
    </div>
  )
}

function ModalBoleto({ data, onClose, onSave, moradores = [] }) {
  const [form, setForm] = useState(data || { morador:'', apt:'', vencimento:'', valor:'', status:'Pendente', competencia:'', emitido:false, linha:'', url:'', pix_emv:'', invoice_id:'' })
  const set = (k,v) => setForm(f=>({...f,[k]:v}))
  
  const handleMoradorChange = (e) => {
    const nome = e.target.value
    const mor = moradores.find(m => m.nome === nome)
    if (mor) {
      setForm(f => ({ ...f, morador: nome, apt: mor.apt, condominio: mor.condominio || '' }))
    } else {
      set('morador', nome)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e=>e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">{data?'Editar Boleto':'Novo Boleto'}</h3>
          <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-700"/></button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Morador</label>
            <select className="input" value={form.morador} onChange={handleMoradorChange}>
               <option value="">Selecione um morador cadastrado...</option>
               {moradores.map(m => <option key={m.id} value={m.nome}>{m.nome} (Apt {m.apt})</option>)}
            </select>
          </div>
          <div><label className="label">Unidade / Apt.</label><input className="input" value={form.apt} onChange={e=>set('apt',e.target.value)} placeholder="Ex: 101-A"/></div>
          <div><label className="label">Competência</label><input className="input" value={form.competencia} onChange={e=>set('competencia',e.target.value)} placeholder="Ex: Mar/2025"/></div>
          <div><label className="label">Vencimento</label><input type="date" className="input" value={form.vencimento} onChange={e=>set('vencimento',e.target.value)}/></div>
          <div><label className="label">Valor (R$)</label><input type="number" min="0" step="0.01" className="input" value={form.valor} onChange={e=>set('valor',e.target.value)} placeholder="0,00"/></div>
          <div className="col-span-2"><label className="label">Status</label>
            <select className="input" value={form.status} onChange={e=>set('status',e.target.value)}>
              <option>Pendente</option><option>Pago</option><option>Vencido</option>
            </select>
          </div>

          <div className="col-span-2 mt-2 pt-4 border-t border-cream-200">
             <label className="flex items-center gap-2 cursor-pointer mb-3">
               <input type="checkbox" checked={form.emitido} onChange={e=>set('emitido', e.target.checked)} className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 w-4 h-4"/>
               <span className="font-bold text-gray-700 text-sm">Boleto gerado externamente (Sem API)</span>
             </label>
             
             {form.emitido && (
               <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-cream-200">
                  <div>
                    <label className="label text-xs">Link do Boleto PDF (Opcional)</label>
                    <input className="input text-xs" value={form.url} onChange={e=>set('url',e.target.value)} placeholder="https://..."/>
                  </div>
                  <div>
                    <label className="label text-xs">PIX Copia e Cola (Opcional)</label>
                    <input className="input text-xs" value={form.pix_emv} onChange={e=>set('pix_emv',e.target.value)} placeholder="0002012658..."/>
                  </div>
               </div>
             )}
          </div>
        </div>
        <div className="p-6 border-t border-cream-300 flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={()=>{if(!form.morador||!form.valor)return;onSave(form)}} className="btn-primary">Salvar</button>
        </div>
      </div>
    </div>
  )
}

function ModalFundo({ condo, onClose, onSave }) {
  const [saldoStr, setSaldoStr] = useState(condo?.fundoReserva ? Number(condo.fundoReserva).toLocaleString('pt-BR',{minimumFractionDigits:2}) : '')
  const [metaStr, setMetaStr]   = useState(condo?.fundoMeta  ? Number(condo.fundoMeta).toLocaleString('pt-BR',{minimumFractionDigits:2}) : '')

  const parseBR = v => parseFloat(v.replace(/\./g,'').replace(',','.')) || 0
  const fmtInput = (v, setter) => {
    const nums = v.replace(/\D/g,'')
    if (!nums) { setter(''); return }
    const n = parseInt(nums,10)/100
    setter(n.toLocaleString('pt-BR',{minimumFractionDigits:2}))
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-sm" onClick={e=>e.stopPropagation()}>
        <div className="p-6 border-b border-cream-300 flex items-center justify-between">
          <div>
             <h3 className="font-bold text-gray-800">Atualizar Fundo</h3>
             <p className="text-xs text-gray-500">{condo?.nome}</p>
          </div>
          <button onClick={onClose}><X size={18} className="text-gray-400"/></button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div><label className="label">Saldo atual (R$)</label><input className="input" value={saldoStr} onChange={e=>fmtInput(e.target.value,setSaldoStr)} placeholder="0,00" autoFocus inputMode="numeric"/></div>
          <div><label className="label">Meta anual (R$)</label><input className="input" value={metaStr} onChange={e=>fmtInput(e.target.value,setMetaStr)} placeholder="0,00" inputMode="numeric"/></div>
        </div>
        <div className="p-6 border-t border-cream-300 flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={()=>onSave({fundoReserva:parseBR(saldoStr),fundoMeta:parseBR(metaStr)})} className="btn-primary">Salvar</button>
        </div>
      </div>
    </div>
  )
}

const statusBadge = s=>({Pago:'badge-green',Pendente:'badge-yellow',Vencido:'badge-red'}[s]||'badge-blue')
const statusIcon  = s=>s==='Pago'?<CheckCircle2 size={14} className="text-emerald-500"/>:s==='Vencido'?<AlertCircle size={14} className="text-red-500"/>:<Clock size={14} className="text-amber-500"/>
const fmt = v=>Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})

export default function Boletos() {
  const { user } = useAuth()
  const { items: allBoletos, addItem, updateItem, deleteItem } = useFirestore('boletos')
  const { items: allCondominios, updateItem: updateCondominio } = useFirestore('condominios')
  const { items: moradores } = useFirestore('moradores')

  const [tab, setTab] = useState('boletos')
  const [condoFilter, setCondoFilter] = useState('Todos')
  const [viewing, setViewing] = useState(null)
  const [modal, setModal] = useState(null)
  const [condoFundoEdit, setCondoFundoEdit] = useState(null)

  const boletos = allBoletos.filter(b => {
    if (user?.role === 'Morador') return b.apt === user?.apt && b.morador === user?.nome;
    if (['Síndico', 'Subsíndico', 'Conselheiro'].includes(user?.role)) {
       const moradorDoc = moradores.find(m => m.nome === b.morador);
       const bCondo = b.condominio || moradorDoc?.condominio;
       return !bCondo || bCondo === user?.condominio;
    }
    if (condoFilter && condoFilter !== 'Todos') {
       const moradorDoc = moradores.find(m => m.nome === b.morador);
       const bCondo = b.condominio || moradorDoc?.condominio;
       return bCondo === condoFilter;
    }
    return true;
  })

  const condominios = allCondominios.filter(c => {
    if (user?.role === 'Morador') return c.nome === user?.condominio;
    if (['Síndico', 'Subsíndico', 'Conselheiro'].includes(user?.role)) return c.nome === user?.condominio;
    if (condoFilter && condoFilter !== 'Todos') return c.nome === condoFilter;
    return true;
  })

  const uniqueCondos = Array.from(new Set(allCondominios.map(c=>c.nome).filter(Boolean)))

  const pago     = boletos.filter(b=>b.status==='Pago').length
  const pendente = boletos.filter(b=>b.status==='Pendente').length
  const vencido  = boletos.filter(b=>b.status==='Vencido').length

  // ── Alertas de vencimento ao carregar ────────────────────────────────────
  useEffect(() => {
    if (!boletos.length) return
    const hoje = new Date(); hoje.setHours(0,0,0,0)
    boletos.forEach(async b => {
      if (b.status === 'Pago' || !b.vencimento) return
      const venc = new Date(b.vencimento + 'T12:00:00')
      const diff = Math.round((venc - hoje) / 86400000)
      
      const moradorDoc = moradores.find(m => m.nome === b.morador);
      const bCondo = b.condominio || moradorDoc?.condominio || '';

      if (diff === 5 && !b.notif5d) {
        const msg = `Boleto vencendo em 5 dias – ${b.morador} (Apt ${b.apt}), R$ ${fmt(b.valor)}, venc. ${b.vencimento}`
        await addDoc(collection(db,'notificacoes'),{text:msg,time:new Date().toISOString(),tipo:'boleto',lida:false,_createdAt:serverTimestamp(), condominio: bCondo, moradorNome: b.morador})
        await updateItem(b.id, { notif5d: true })
        notificarAdm('⚠️ Boleto vencendo em 5 dias',msg)
      } else if (diff === 0 && !b.notif0d) {
        const msg = `🔴 VENCE HOJE – Boleto ${b.morador} (Apt ${b.apt}), R$ ${fmt(b.valor)}`
        await addDoc(collection(db,'notificacoes'),{text:msg,time:new Date().toISOString(),tipo:'boleto',lida:false,_createdAt:serverTimestamp(), condominio: bCondo, moradorNome: b.morador})
        await updateItem(b.id, { notif0d: true })
        notificarAdm('🔴 Boleto vence HOJE',msg)
      } else if (diff < 0 && !b.notifAtraso && b.status !== 'Vencido') {
        // Marca o boleto como vencido automaticamente no sistema também
        const msg = `⛔ BOLETO ATRASADO – Boleto ${b.morador} (Apt ${b.apt}), R$ ${fmt(b.valor)} vencido em ${b.vencimento}`
        await addDoc(collection(db,'notificacoes'),{text:msg,time:new Date().toISOString(),tipo:'boleto',lida:false,_createdAt:serverTimestamp(), condominio: bCondo, moradorNome: b.morador})
        await updateItem(b.id, { status: 'Vencido', notifAtraso: true })
        notificarAdm('⛔ Boleto Atrasado',msg)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boletos.length])

  const emitirBoleto = async b => {
    try {
      const mor = moradores.find(m => m.nome === b.morador);
      if (!mor || !mor.cpf) {
        alert("Morador não encontrado ou sem CPF cadastrado. Atualize o cadastro de Moradores com um CPF válido primeiro.");
        return;
      }
      
      // Indicador de loading
      const btn = document.activeElement;
      const originalText = btn.innerHTML;
      if(btn) btn.innerHTML = "Emitindo...";
      
      const res = await fetch('/api/cora/emitir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: b.morador,
          cpf: mor.cpf,
          email: mor.email || '',
          valor: b.valor,
          vencimento: b.vencimento,
          descricao: `Taxa de Condomínio - ${b.competencia}`
        })
      });
      
      if(btn) btn.innerHTML = originalText;
      
      const data = await res.json();
      
      if (data.success) {
         await updateItem(b.id, {
           ...b, emitido: true, linha: data.barcode || '', url: data.url, pix_emv: data.pix_emv, invoice_id: data.invoice_id
         });
         
         if (mor.email) {
           await enviarEmail(mor.email, mor.nome, "Seu Boleto Condominial", `Olá ${mor.nome},<br><br>Seu boleto da competência ${b.competencia} já está disponível.<br><br><b>Valor:</b> R$ ${fmt(b.valor)}<br><b>Vencimento:</b> ${b.vencimento}<br><br><a href="${data.url}" target="_blank">Clique aqui para acessar o Boleto PDF</a><br><br><b>PIX Copia e Cola:</b><br>${data.pix_emv}`);
           
           // Disparo Push OneSignal para o Morador
           fetch('/api/onesignal', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ 
               title: 'Boleto Disponível', 
               message: `Seu boleto de R$ ${fmt(b.valor)} já está disponível para pagamento.`,
               targetUserId: mor.email,
               targetUrl: window.location.origin + '/boletos'
             })
           }).catch(e => console.error("Push erro", e))
         }
         alert("Boleto emitido via Banco Cora com sucesso e enviado por e-mail!");
      } else {
         alert("Erro ao emitir boleto no banco: " + (data.error || "Verifique se as credenciais do Cora estão configuradas."));
      }
    } catch (err) {
      console.error(err);
      alert("Falha na emissão. Tente novamente.");
    }
  }
  
  const emitirLote = async () => {
    alert("Para emissão em lote via banco Cora, por favor emita um por um nesta versão para garantir o envio correto.");
  }
  const enviarWhats = b => {
    const msg = b.status==='Vencido'
      ? `Olá ${b.morador}, o boleto da unidade ${b.apt} (Venc: ${b.vencimento}) R$ ${fmt(b.valor)} está em aberto.`
      : `Olá ${b.morador}, lembrete: boleto da unidade ${b.apt} vence em ${b.vencimento} – R$ ${fmt(b.valor)}.`
    window.open(`https://wa.me/5511999999999?text=${encodeURIComponent(msg)}`,'_blank')
  }
  const marcarPago  = async b => updateItem(b.id,{...b,status:'Pago'})
  
  const handleSaveBoleto = async form => {
    const clean = {...form,valor:Number(form.valor)}
    if (!clean.emitido) { clean.linha = ''; clean.url = ''; clean.pix_emv = ''; }
    if (modal!=='new') await updateItem(modal.id,clean); else await addItem(clean)
    setModal(null)
  }
  
  const gerarSegundaVia = async b => {
    if (window.confirm(`Deseja gerar a 2ª via atualizada com vencimento para HOJE?\n\nOs juros de mora e multa serão calculados automaticamente pelo banco de acordo com os dias de atraso.`)) {
      const hoje = new Date().toISOString().split('T')[0];
      
      // Atualiza a data do boleto no banco de dados e volta para pendente
      await updateItem(b.id, { vencimento: hoje, status: 'Pendente', emitido: false, url: '', pix_emv: '', linha: '' });
      
      // Emite o boleto novamente no banco para gerar a nova URL com os juros (API Cora)
      const boletoAtualizado = { ...b, vencimento: hoje, status: 'Pendente' };
      await emitirBoleto(boletoAtualizado);
    }
  }
  
  const handleSaveFundo = async form => {
    await updateCondominio(condoFundoEdit.id, form)
    setCondoFundoEdit(null)
  }

  const handleCSVImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
        if (lines.length < 2) {
          alert('A planilha parece estar vazia ou sem cabeçalho.');
          return;
        }

        const headers = lines[0].toLowerCase().split(/[;,]/).map(h => h.trim());
        const getIdx = (keywords) => headers.findIndex(h => keywords.some(k => h.includes(k)));

        const idxMorador = getIdx(['nome', 'morador', 'pagador', 'sacado', 'cliente']);
        const idxApt = getIdx(['apt', 'unidade', 'lote']);
        const idxVencimento = getIdx(['venc', 'data']);
        const idxValor = getIdx(['valor', 'total']);
        const idxLink = getIdx(['link', 'url', 'pdf']);
        const idxPix = getIdx(['pix']);
        
        if (idxMorador === -1 || idxValor === -1) {
          alert("Não conseguimos identificar as colunas 'Nome' e 'Valor' na sua planilha. Verifique se estão presentes.");
          return;
        }

        let added = 0;
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(/[;,]/).map(c => c.trim().replace(/^"|"$/g, ''));
          const nome = cols[idxMorador];
          if (!nome) continue;

          let valorBruto = cols[idxValor] || '0';
          let valor = parseFloat(valorBruto.replace(/\./g, '').replace(',', '.')) || 0;
          if (isNaN(valor)) valor = parseFloat(valorBruto.replace(',', '.')) || 0;

          const moradorDb = moradores.find(m => m.nome.toLowerCase() === nome.toLowerCase());
          const apt = (idxApt !== -1 ? cols[idxApt] : '') || moradorDb?.apt || '';
          
          let venc = idxVencimento !== -1 ? cols[idxVencimento] : '';
          if (venc && venc.includes('/')) {
             const parts = venc.split('/');
             if (parts.length === 3) venc = `${parts[2]}-${parts[1]}-${parts[0]}`;
          }

          const link = idxLink !== -1 ? cols[idxLink] : '';
          const pix = idxPix !== -1 ? cols[idxPix] : '';

          const boleto = {
            morador: nome,
            apt: apt,
            condominio: moradorDb?.condominio || '',
            vencimento: venc,
            valor: valor,
            status: 'Pendente',
            competencia: new Date().toLocaleDateString('pt-BR', {month:'short', year:'numeric'}).replace('.','/'),
            emitido: true,
            url: link,
            pix_emv: pix,
            linha: ''
          };
          
          await addItem(boleto);
          added++;
        }
        alert(`Sucesso! ${added} boletos importados com sucesso.`);
      } catch (err) {
        console.error(err);
        alert('Erro ao processar a planilha. Verifique o formato CSV (separado por vírgula ou ponto e vírgula).');
      }
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h2 className="section-title text-xl">
            {user?.role === 'Morador' || user?.role === 'Síndico' ? 'Boletos' : 'Boletos & Fundo de Reserva'}
          </h2>
          <p className="section-sub">Emissão e acompanhamento de cobranças</p>
        </div>
        {tab==='boletos' && (user?.role === 'Administrador' || user?.role === 'Financeiro') && (
          <div className="flex gap-2">
            <button onClick={emitirLote} className="btn-secondary text-sm"><FileText size={14}/>Emitir Lote</button>
            <label className="btn-secondary text-sm cursor-pointer flex items-center gap-1">
              <Upload size={14}/>
              Importar CSV
              <input type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />
            </label>
            <button onClick={()=>setModal('new')} className="btn-primary"><Plus size={16}/>Novo Boleto</button>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {/* Tabs */}
        <div className="flex gap-2">
          {[{id:'boletos',label:'📄 Boletos'},{id:'fundo',label:'💰 Fundo de Reserva'}]
            .filter(t => t.id === 'boletos' || (user?.role !== 'Morador' && user?.role !== 'Síndico'))
            .map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab===t.id?'bg-brand-600 text-white shadow-md':'bg-white text-gray-500 hover:text-brand-700 border border-cream-400'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Filtro ADM */}
        {(user?.role === 'Administrador' || user?.role === 'Financeiro') && uniqueCondos.length > 0 && (
          <div className="w-full sm:w-auto flex items-center gap-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0 block">Filtrar:</label>
            <select className="input text-sm py-1.5 h-auto w-48" value={condoFilter} onChange={e=>setCondoFilter(e.target.value)}>
              <option value="Todos">Todos os Condomínios</option>
              {uniqueCondos.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* ── ABA BOLETOS ─────────────────────────────────────────────── */}
      {tab==='boletos' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[{label:'Total',val:boletos.length,color:'text-brand-700'},{label:'Pagos',val:pago,color:'text-emerald-600'},{label:'Pendentes',val:pendente,color:'text-amber-600'},{label:'Vencidos',val:vencido,color:'text-red-600'}].map(s=>(
              <div key={s.label} className="card text-center">
                <p className={`text-3xl font-black mb-1 ${s.color}`}>{s.val}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Aviso boletos próximos do vencimento */}
          {boletos.filter(b=>{ if(b.status==='Pago'||!b.vencimento)return false; const d=Math.round((new Date(b.vencimento+'T12:00:00')-new Date())/86400000); return d>=0&&d<=5 }).length > 0 && (
            <div className="card bg-amber-50 border-amber-200 flex items-start gap-3">
              <Bell size={18} className="text-amber-600 mt-0.5 shrink-0"/>
              <div>
                <p className="font-bold text-amber-800 text-sm">⚠️ Boletos vencendo em breve</p>
                {boletos.filter(b=>{ if(b.status==='Pago'||!b.vencimento)return false; const d=Math.round((new Date(b.vencimento+'T12:00:00')-new Date())/86400000); return d>=0&&d<=5 }).map(b=>{
                  const d=Math.round((new Date(b.vencimento+'T12:00:00')-new Date())/86400000)
                  return <p key={b.id} className="text-xs text-amber-700">{b.morador} – Apt {b.apt} – R$ {fmt(b.valor)} – {d===0?'Vence HOJE':`Vence em ${d} dia(s)`}</p>
                })}
              </div>
            </div>
          )}

          <div className="card p-0 overflow-hidden">
            <div className="p-4 border-b border-cream-300 flex items-center justify-between">
              <p className="font-bold text-gray-800 text-sm">Boletos cadastrados</p>
              <span className="text-xs text-gray-400">{boletos.filter(b=>b.emitido).length} emitidos de {boletos.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-cream-100 border-b border-cream-400">
                  <tr>{['Morador','Unidade','Vencimento','Valor','Status','Emitido','Ações'].map(h=><th key={h} className="table-head">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {boletos.length===0
                    ? <tr><td colSpan={7} className="text-center py-10 text-gray-400 text-sm">Nenhum boleto cadastrado.</td></tr>
                    : boletos.map(b=>(
                      <tr key={b.id} className="table-row">
                        <td className="table-cell font-medium text-gray-800">{b.morador}</td>
                        <td className="table-cell text-gray-500">{b.apt}</td>
                        <td className="table-cell text-gray-500">{b.vencimento}</td>
                        <td className="table-cell font-bold text-gray-800">R$ {fmt(b.valor)}</td>
                        <td className="table-cell"><span className={`${statusBadge(b.status)} flex items-center gap-1 w-fit`}>{statusIcon(b.status)}{b.status}</span></td>
                        <td className="table-cell">{b.emitido?<span className="badge-green flex items-center gap-1 w-fit"><CheckCircle2 size={11}/>Sim</span>:<span className="badge-yellow">Não</span>}</td>
                        <td className="table-cell">
                          <div className="flex gap-1.5 flex-wrap">
                            {(user?.role === 'Administrador' || user?.role === 'Financeiro') && !b.emitido && <button onClick={()=>emitirBoleto(b)} className="btn-primary py-1 px-2.5 text-xs"><FileText size={11}/>Emitir</button>}
                            
                            {/* Botão de 2ª Via para Boletos Vencidos (Para Moradores e ADMs) */}
                            {b.status === 'Vencido' && b.emitido && (
                              <button onClick={() => gerarSegundaVia(b)} className="btn-primary py-1 px-2.5 text-xs bg-orange-500 hover:bg-orange-600 border-orange-600">
                                <FileText size={11}/> 2ª Via
                              </button>
                            )}
                            
                            {b.emitido && <button onClick={()=>b.url?window.open(b.url,'_blank'):setViewing(b)} className="btn-secondary py-1 px-2.5 text-xs"><Download size={11}/>Ver</button>}
                            
                            {(user?.role === 'Administrador' || user?.role === 'Financeiro') && (
                              <>
                                <button onClick={()=>enviarWhats(b)} className="btn-secondary py-1 px-2.5 text-xs text-green-700 bg-green-50 border-green-200 hover:bg-green-100"><MessageSquare size={11}/>Whats</button>
                                {b.status !== 'Pago' && <button onClick={()=>marcarPago(b)} className="btn-success py-1 px-2.5 text-xs"><CheckCircle2 size={11}/>Pago</button>}
                                <button onClick={()=>setModal(b)} className="p-1.5 rounded-lg bg-cream-100 hover:bg-brand-100 text-gray-400 hover:text-brand-600 transition-all"><Edit2 size={11}/></button>
                                <button onClick={()=>deleteItem(b.id)} className="p-1.5 rounded-lg bg-cream-100 hover:bg-red-100 text-gray-400 hover:text-red-500 transition-all"><Trash2 size={11}/></button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── ABA FUNDO DE RESERVA ─────────────────────────────────────── */}
      {tab==='fundo' && (
        <div className="flex flex-col gap-4">
          <p className="text-gray-500 text-sm mb-2">Fundos de reserva divididos por condomínio (os mesmos que você cadastra na página de Condomínios).</p>
          
          {condominios.length === 0 ? (
            <div className="card text-center py-10 text-gray-400 text-sm">
              Nenhum condomínio cadastrado. Vá até a aba "Condomínios" para registrar os blocos/condomínios primeiro.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {condominios.map(c => {
                const fundoSaldo = Number(c.fundoReserva||0)
                const fundoMeta  = Number(c.fundoMeta||0)
                const pct = fundoMeta>0 ? Math.min((fundoSaldo/fundoMeta)*100, 100) : 0

                return (
                  <div key={c.id} className="card flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><Building size={16}/></div>
                          <div>
                            <p className="font-bold text-gray-800">{c.nome}</p>
                            <p className="text-xs text-gray-500">{c.unidades} unidades</p>
                          </div>
                        </div>
                        {user?.role !== 'Morador' && (
                          <button onClick={()=>setCondoFundoEdit(c)} className="btn-secondary text-xs py-1.5 px-2.5"><Edit2 size={12}/>Editar Fundo</button>
                        )}
                      </div>
                      
                      <div className="bg-cream-50 p-4 rounded-xl border border-cream-200">
                        <div className="flex justify-between items-end mb-2">
                          <div>
                            <p className="text-xs text-gray-500 mb-0.5">Saldo Atual</p>
                            <p className="text-xl font-black text-emerald-600">R$ {fmt(fundoSaldo)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-400 mb-0.5">Meta Anual</p>
                            <p className="text-sm font-bold text-brand-700">R$ {fmt(fundoMeta)}</p>
                          </div>
                        </div>
                        
                        {fundoMeta > 0 ? (
                          <div className="mt-4">
                            <div className="w-full bg-cream-300 rounded-full h-2 overflow-hidden mb-1">
                              <div className="h-2 bg-gradient-to-r from-brand-500 to-emerald-500 rounded-full transition-all" style={{width:`${pct}%`}}/>
                            </div>
                            <div className="flex justify-between items-center text-[10px] text-gray-500 font-medium">
                              <span>{pct.toFixed(1)}% alcançado</span>
                              <span>Falta R$ {fmt(Math.max(fundoMeta-fundoSaldo,0))}</span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 mt-2">Nenhuma meta anual definida para este condomínio.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Vitrine Premium */}
          <div className="card bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 relative overflow-hidden mt-2">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"/>
            <div className="relative z-10">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold mb-3 uppercase tracking-widest">
                <Sparkles size={14}/> Em Breve / Premium
              </div>
              <h3 className="text-lg font-black text-amber-900 mb-2">Automação Financeira Completa</h3>
              <p className="text-sm text-amber-800 mb-4">Integração bancária oficial com conciliação automática e baixa de inadimplentes.</p>
              <div className="grid grid-cols-2 gap-y-2 gap-x-6">
                {["Emissão automática de boletos","Baixa automática de inadimplentes","Conciliação bancária","Pagamentos rápidos e seguros"].map((item,i)=>(
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0"><Check size={10} className="text-amber-700"/></div>
                    <span className="text-xs font-semibold text-amber-900/80">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {viewing&&<BoletoPrintModal boleto={viewing} onClose={()=>setViewing(null)}/>}
      {modal&&<ModalBoleto data={modal==='new'?null:modal} onClose={()=>setModal(null)} onSave={handleSaveBoleto} moradores={moradores}/>}
      {condoFundoEdit&&<ModalFundo condo={condoFundoEdit} onClose={()=>setCondoFundoEdit(null)} onSave={handleSaveFundo}/>}
    </div>
  )
}
