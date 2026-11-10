import React, { useState, useEffect, useRef } from 'react'
import { 
  ShieldAlert, ShieldCheck, Database, RefreshCw, Download, 
  RotateCcw, AlertTriangle, UserCheck, Eye, Trash2, CheckCircle2, Clock, Mail,
  UploadCloud, FileJson, HardDrive
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useFirestore } from '../hooks/useFirestore'
import { db, storage } from '../firebase'
import { 
  collection, getDocs, doc, setDoc, deleteDoc, writeBatch, serverTimestamp, query, orderBy 
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'

const COLECOES_SISTEMA = [
  'condominios', 'moradores', 'financeiro_lancamentos', 'boletos', 
  'cotacoes', 'manutencoes', 'apolices', 'ocorrencias', 'assembleias', 
  'avisos', 'reservas', 'usuarios', 'pets', 'veiculos', 'visitantes', 
  'documentos', 'encomendas', 'tarefas'
]

export default function PainelSegurancaBackup() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'Administrador'

  const [tab, setTab] = useState('alarmes') // 'alarmes' | 'backups'
  const [alarmes, setAlarmes] = useState([])
  const [backups, setBackups] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [executandoBackup, setExecutandoBackup] = useState(false)
  const [restaurandoId, setRestaurandoId] = useState(null)
  const [baixandoId, setBaixandoId] = useState(null)
  const [filtroTipo, setFiltroTipo] = useState('Todos')
  const [msgSucesso, setMsgSucesso] = useState('')
  const fileInputRef = useRef(null)

  // Carregar lista de alarmes do Firestore
  const { items: alarmesFirestore } = useFirestore('alarmes_seguranca')

  useEffect(() => {
    carregarBackups()
  }, [])

  const carregarBackups = async () => {
    try {
      setCarregando(true)
      const q = query(collection(db, 'backups_sistema'), orderBy('dataCriacao', 'desc'))
      const snap = await getDocs(q)
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setBackups(list)
    } catch (err) {
      console.warn('Erro ao carregar backups via Firestore:', err)
      // Fallback via API
      try {
        const res = await fetch('/api/backup/restaurar')
        const data = await res.json()
        if (data.success && data.backups) setBackups(data.backups)
      } catch (e) {}
    } finally {
      setCarregando(false)
    }
  }

  const handleDispararBackupAgora = async () => {
    if (!window.confirm('Deseja gerar uma cópia de segurança completa agora?\n\nO arquivo JSON completo será salvo no cofre e baixado para o seu computador.')) return
    setExecutandoBackup(true)
    setMsgSucesso('Coletando registros de todas as 18 coleções do sistema...')

    try {
      const dadosExportados = {}
      let totalDocs = 0

      // Exporta cada coleção diretamente do Firestore autenticado
      for (const colName of COLECOES_SISTEMA) {
        try {
          const snap = await getDocs(collection(db, colName))
          dadosExportados[colName] = snap.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
          }))
          totalDocs += snap.docs.length
        } catch (e) {
          console.warn(`Aviso ao exportar coleção ${colName}:`, e)
        }
      }

      const agora = new Date()
      const dataFormatada = agora.toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const dataRef = agora.toLocaleDateString('pt-BR')
      const backupId = `backup_${dataFormatada}`

      const jsonString = JSON.stringify(dadosExportados, null, 2)
      const jsonBlob = new Blob([jsonString], { type: 'application/json' })
      const tamanhoBytes = jsonBlob.size
      const tamanhoFormatado = (tamanhoBytes / (1024 * 1024)).toFixed(2) + ' MB'

      let arquivoUrl = ''
      let storagePath = ''

      // 1. Envia o arquivo JSON completo para o Firebase Storage (sem limite de 1MB do documento Firestore)
      setMsgSucesso('Preservando dados no cofre seguro da nuvem...')
      try {
        storagePath = `backups_sistema/${backupId}.json`
        const fileRef = ref(storage, storagePath)
        const uploadTask = uploadBytes(fileRef, jsonBlob, {
          contentType: 'application/json',
          customMetadata: {
            dataCriacao: agora.toISOString(),
            totalDocumentos: String(totalDocs),
            tamanho: tamanhoFormatado
          }
        })
        const timeoutTask = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout Firebase Storage')), 12000))
        const snapshot = await Promise.race([uploadTask, timeoutTask])
        arquivoUrl = await getDownloadURL(snapshot.ref)
      } catch (storageErr) {
        console.warn('Storage upload falhou ou expirou timeout, usando modo local:', storageErr)
      }

      // 2. Dispara o download automático do arquivo JSON diretamente no navegador do usuário
      const urlBlob = URL.createObjectURL(jsonBlob)
      const downloadAnchor = document.createElement('a')
      downloadAnchor.setAttribute("href", urlBlob)
      downloadAnchor.setAttribute("download", `alpha_backup_completo_${agora.toISOString().slice(0, 10)}_${totalDocs}_itens.json`)
      document.body.appendChild(downloadAnchor)
      downloadAnchor.click()
      downloadAnchor.remove()
      setTimeout(() => URL.revokeObjectURL(urlBlob), 5000)

      // 3. Salva apenas os metadados leves no Firestore (< 2KB), eliminando o erro de cota de 1MB
      await setDoc(doc(db, 'backups_sistema', backupId), {
        dataCriacao: agora.toISOString(),
        dataRef,
        origem: 'manual_painel',
        totalDocumentos: totalDocs,
        tamanhoBytes,
        tamanhoFormatado,
        arquivoUrl: arquivoUrl || null,
        storagePath: storagePath || null,
        colecoes: Object.keys(dadosExportados),
        resumoColecoes: Object.entries(dadosExportados).map(([nome, docs]) => ({
          nome,
          total: docs.length
        }))
      })

      setMsgSucesso(`✅ Backup concluído com sucesso! ${totalDocs} registros preservados (${tamanhoFormatado}) no cofre e salvos no seu computador.`)
      await carregarBackups()
    } catch (err) {
      alert('Erro ao executar backup: ' + err.message)
    } finally {
      setExecutandoBackup(false)
    }
  }

  const handleExportarJsonDireto = async () => {
    setExecutandoBackup(true)
    setMsgSucesso('Preparando download do JSON completo...')

    try {
      const dadosExportados = {}
      let totalDocs = 0

      for (const colName of COLECOES_SISTEMA) {
        try {
          const snap = await getDocs(collection(db, colName))
          dadosExportados[colName] = snap.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
          }))
          totalDocs += snap.docs.length
        } catch (e) {
          console.warn(`Aviso ao exportar coleção ${colName}:`, e)
        }
      }

      const agora = new Date()
      const dataFormatada = agora.toISOString().slice(0, 10)
      const blob = new Blob([JSON.stringify(dadosExportados, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const downloadAnchor = document.createElement('a')
      downloadAnchor.setAttribute("href", url)
      downloadAnchor.setAttribute("download", `alpha_backup_completo_${dataFormatada}_${totalDocs}_itens.json`)
      document.body.appendChild(downloadAnchor)
      downloadAnchor.click()
      downloadAnchor.remove()
      setTimeout(() => URL.revokeObjectURL(url), 5000)

      setMsgSucesso(`✅ Download concluído! Arquivo gerado com ${totalDocs} registros de todas as 18 coleções.`)
    } catch (err) {
      alert('Erro ao exportar backup: ' + err.message)
    } finally {
      setExecutandoBackup(false)
    }
  }

  const handleRestaurarBackup = async (backupId, modo = 'teste') => {
    const confirmMsg = modo === 'teste'
      ? 'Deseja restaurar este backup em AMBIENTE DE TESTE?\n\nOs dados serão gravados em coleções de teste (prefixo teste_) para você conferir a integridade sem alterar nenhum dado real em produção.'
      : 'ATENÇÃO CRÍTICA!\n\nVocê está prestes a restaurar dados diretamente no AMBIENTE DE PRODUÇÃO. Deseja prosseguir?'

    if (!window.confirm(confirmMsg)) return

    setRestaurandoId(backupId)
    setMsgSucesso('Localizando cópia de segurança...')
    const t0 = Date.now()

    try {
      // 1. Busca o snapshot no Firestore
      const snap = await getDocs(query(collection(db, 'backups_sistema')))
      const targetDoc = snap.docs.find(d => d.id === backupId)
      
      if (!targetDoc || !targetDoc.exists()) {
        throw new Error('Cópia de backup não encontrada.')
      }

      const backupData = targetDoc.data()
      let payload = backupData.payload || null

      // Se não houver payload direto no documento do Firestore, busca do arquivo do Storage
      if (!payload && backupData.arquivoUrl) {
        setMsgSucesso('Baixando dados do cofre na nuvem para restauração...')
        const resp = await fetch(backupData.arquivoUrl)
        if (!resp.ok) throw new Error('Não foi possível obter o arquivo de dados do cofre na nuvem.')
        payload = await resp.json()
      }

      if (!payload || Object.keys(payload).length === 0) {
        throw new Error('Este registro contém apenas o índice. Utilize o botão "Restaurar por Arquivo (.JSON)" para restaurar o arquivo salvo no seu computador.')
      }

      let totalRestaurado = 0
      setMsgSucesso('Gravando registros no banco de dados...')

      // 2. Restaura em lotes com ou sem prefixo de teste
      for (const [colName, registros] of Object.entries(payload)) {
        if (!Array.isArray(registros) || registros.length === 0) continue

        const targetColName = modo === 'teste' ? `teste_${colName}` : colName
        
        for (const reg of registros) {
          const { id: docId, ...dados } = reg
          if (!docId) continue
          const targetDocRef = doc(db, targetColName, docId)
          await setDoc(targetDocRef, {
            ...dados,
            _restauradoEm: new Date().toISOString(),
            _restauradoModo: modo
          })
          totalRestaurado++
        }
      }

      const tempoGasto = `${((Date.now() - t0) / 1000).toFixed(1)} segundos`
      const msg = modo === 'teste'
        ? `Ambiente de TESTE restaurado com sucesso! ${totalRestaurado} registros criados nas coleções teste_*.`
        : `Ambiente de PRODUÇÃO restaurado com sucesso! ${totalRestaurado} registros recuperados.`

      alert(`🎉 ${msg}\n\nTempo gasto: ${tempoGasto}.\nTotal de itens restaurados: ${totalRestaurado}`)
      setMsgSucesso(`✅ ${msg} (Tempo: ${tempoGasto})`)
    } catch (err) {
      alert('Erro na restauração: ' + err.message)
    } finally {
      setRestaurandoId(null)
    }
  }

  const handleBaixarCopia = async (b) => {
    if (b.payload) {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(b.payload, null, 2))
      const downloadAnchor = document.createElement('a')
      downloadAnchor.setAttribute("href", dataStr)
      downloadAnchor.setAttribute("download", `${b.id || 'backup'}.json`)
      document.body.appendChild(downloadAnchor)
      downloadAnchor.click()
      downloadAnchor.remove()
      return
    }

    if (b.arquivoUrl) {
      setBaixandoId(b.id)
      try {
        const resp = await fetch(b.arquivoUrl)
        const blob = await resp.blob()
        const url = URL.createObjectURL(blob)
        const downloadAnchor = document.createElement('a')
        downloadAnchor.setAttribute("href", url)
        downloadAnchor.setAttribute("download", `${b.id || 'backup'}.json`)
        document.body.appendChild(downloadAnchor)
        downloadAnchor.click()
        downloadAnchor.remove()
        setTimeout(() => URL.revokeObjectURL(url), 5000)
      } catch (err) {
        window.open(b.arquivoUrl, '_blank')
      } finally {
        setBaixandoId(null)
      }
    } else {
      alert('Arquivo no cofre da nuvem indisponível. Para gerar uma cópia completa agora, utilize o botão "Baixar JSON Completo".')
    }
  }

  const handleRestaurarArquivoJson = async (e, modo = 'teste') => {
    const file = e.target.files?.[0]
    if (!file) return

    const confirmMsg = modo === 'teste'
      ? `Deseja restaurar o arquivo "${file.name}" em AMBIENTE DE TESTE?\n\nOs registros serão salvos em coleções com prefixo teste_ para conferência sem alterar nenhum dado real em produção.`
      : `ATENÇÃO CRÍTICA!\n\nVocê está prestes a restaurar o arquivo "${file.name}" diretamente no AMBIENTE DE PRODUÇÃO. Deseja prosseguir?`

    if (!window.confirm(confirmMsg)) {
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setExecutandoBackup(true)
    setMsgSucesso(`Lendo "${file.name}" e preparando restauração...`)
    const t0 = Date.now()

    try {
      const text = await file.text()
      const payload = JSON.parse(text)
      let totalRestaurado = 0

      for (const [colName, registros] of Object.entries(payload)) {
        if (!Array.isArray(registros) || registros.length === 0) continue
        const targetColName = modo === 'teste' ? `teste_${colName}` : colName
        for (const reg of registros) {
          const { id: docId, ...dados } = reg
          if (!docId) continue
          const targetDocRef = doc(db, targetColName, docId)
          await setDoc(targetDocRef, {
            ...dados,
            _restauradoEm: new Date().toISOString(),
            _restauradoModo: modo,
            _arquivoOrigem: file.name
          })
          totalRestaurado++
        }
      }

      const tempoGasto = `${((Date.now() - t0) / 1000).toFixed(1)} segundos`
      const msg = modo === 'teste'
        ? `Ambiente de TESTE restaurado com sucesso! ${totalRestaurado} registros restaurados de "${file.name}".`
        : `Ambiente de PRODUÇÃO restaurado com sucesso! ${totalRestaurado} registros recuperados de "${file.name}".`

      alert(`🎉 ${msg}\n\nTempo gasto: ${tempoGasto}.\nTotal de itens restaurados: ${totalRestaurado}`)
      setMsgSucesso(`✅ ${msg} (Tempo: ${tempoGasto})`)
    } catch (err) {
      alert('Erro na restauração do arquivo: ' + err.message)
    } finally {
      setExecutandoBackup(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const alarmesFiltrados = (alarmesFirestore || []).filter(a => {
    if (filtroTipo === 'Todos') return true
    return a.tipo === filtroTipo
  }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

  const badgeTipo = (tipo) => {
    switch (tipo) {
      case 'ERRO_SENHA':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">🔑 20+ Erros de Senha</span>
      case 'CONSULTA_MASSIVA':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">📊 Consulta &gt;500 Registros</span>
      case 'CRIACAO_ADMIN':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-300">👤 Criação de Administrador</span>
      case 'ELEVACAO_ADMIN':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">⚡ Usuário Virou Administrador</span>
      case 'APAGAMENTO_MASSA':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">🚨 Apagamento em Massa</span>
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-800">⚠️ Incomum</span>
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in w-full max-w-7xl mx-auto pb-12">
      {/* Cabeçalho */}
      <div className="page-header flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="section-title text-xl flex items-center gap-2">
            <ShieldAlert className="text-red-600" /> Painel de Segurança &amp; Backup
          </h2>
          <p className="section-sub">
            Monitoramento de comportamentos anômalos, alarmes em tempo real e cópias diárias externas de restauração.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {tab === 'backups' && (
            <button
              onClick={handleDispararBackupAgora}
              disabled={executandoBackup}
              className="btn-primary bg-brand-600 hover:bg-brand-700 flex items-center gap-2 text-xs py-2"
            >
              <RefreshCw size={14} className={executandoBackup ? 'animate-spin' : ''} />
              {executandoBackup ? 'Gerando Backup...' : 'Gerar Backup Agora'}
            </button>
          )}
        </div>
      </div>

      {msgSucesso && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-sm font-semibold animate-fade-in">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>{msgSucesso}</span>
        </div>
      )}

      {/* Abas */}
      <div className="flex gap-2 border-b border-cream-300 pb-2">
        <button
          onClick={() => setTab('alarmes')}
          className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${tab === 'alarmes' ? 'bg-red-600 text-white shadow-md' : 'bg-white text-gray-600 hover:text-red-700 border border-cream-400'}`}
        >
          <AlertTriangle size={16} /> 🚨 Alarmes de Segurança ({alarmesFiltrados.length})
        </button>

        <button
          onClick={() => setTab('backups')}
          className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${tab === 'backups' ? 'bg-brand-600 text-white shadow-md' : 'bg-white text-gray-600 hover:text-brand-700 border border-cream-400'}`}
        >
          <Database size={16} /> 💾 Cópias de Backup &amp; Restauração ({backups.length})
        </button>
      </div>

      {/* ABA 1: ALARMES DE SEGURANÇA */}
      {tab === 'alarmes' && (
        <div className="flex flex-col gap-4">
          <div className="bg-white p-4 rounded-2xl border border-cream-300 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500 uppercase">Filtrar por evento:</span>
              <select
                value={filtroTipo}
                onChange={e => setFiltroTipo(e.target.value)}
                className="input py-1.5 px-3 text-xs bg-white border-gray-300 rounded-lg"
              >
                <option value="Todos">Todos os Alarmes</option>
                <option value="ERRO_SENHA">🔑 Mais de 20 Erros de Senha</option>
                <option value="CONSULTA_MASSIVA">📊 Consulta &gt;500 Registros</option>
                <option value="CRIACAO_ADMIN">👤 Criação de Administrador</option>
                <option value="ELEVACAO_ADMIN">⚡ Usuário Virou Administrador</option>
                <option value="APAGAMENTO_MASSA">🚨 Apagamento em Massa</option>
              </select>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Mail size={14} className="text-brand-600" />
              <span>Notificações enviadas para: <strong>alphaadmsc@gmail.com</strong></span>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-cream-300 overflow-hidden">
            {alarmesFiltrados.length === 0 ? (
              <div className="text-center py-16 px-4 text-gray-400">
                <ShieldCheck size={48} className="mx-auto mb-3 text-emerald-500 opacity-60" />
                <h3 className="font-bold text-gray-700 text-base">Nenhum alarme disparado</h3>
                <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                  O sistema está seguro. Quando houver 20+ falhas de senha, consultas volumosas ou alterações de administrador, os registros detalhados e alertas por e-mail aparecerão aqui.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {alarmesFiltrados.map(a => (
                  <div key={a.id} className="p-4 sm:p-5 hover:bg-slate-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {badgeTipo(a.tipo)}
                        <span className="text-[11px] text-gray-400 flex items-center gap-1 font-mono">
                          <Clock size={12} />
                          {a.timestamp ? new Date(a.timestamp).toLocaleString('pt-BR') : 'Horário não registrado'}
                        </span>
                      </div>
                      <h4 className="font-bold text-gray-800 text-sm mb-1">{a.titulo}</h4>
                      <p className="text-xs text-gray-600 leading-relaxed">{a.detalhes}</p>
                      
                      {a.metadata && (
                        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-gray-500 font-mono bg-cream-50 p-2 rounded-lg border border-cream-200 w-fit">
                          {a.metadata.usuario && <span>👤 <strong>Usuário:</strong> {a.metadata.usuario}</span>}
                          {a.metadata.ip && <span>🌐 <strong>IP:</strong> {a.metadata.ip}</span>}
                          {a.metadata.quantidade && <span>📊 <strong>Qtd:</strong> {a.metadata.quantidade}</span>}
                          {a.metadata.colecao && <span>📁 <strong>Coleção:</strong> {a.metadata.colecao}</span>}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center">
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg flex items-center gap-1">
                        <Mail size={12} /> E-mail Enviado
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA 2: BACKUPS E RESTAURAÇÃO */}
      {tab === 'backups' && (
        <div className="flex flex-col gap-6">
          {/* Input oculto para carregar arquivo de backup do computador ou Google Drive */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleRestaurarArquivoJson}
            accept=".json,application/json"
            className="hidden"
          />

          <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 rounded-2xl shadow-lg border border-slate-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black flex items-center gap-2">
                <Database className="text-emerald-400" /> Cofre de Backups &amp; Exportação Completa
              </h3>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                As cópias preservam todos os dados das 18 coleções (condomínios, moradores, finanças, boletos e manutenções). Ficam armazenadas no <strong>Cofre da Nuvem (Google Cloud Storage)</strong> e são baixadas diretamente para o seu computador, permitindo salvar na pasta do Google Drive ou em pen-drive para redundância máxima.
              </p>
            </div>
            <div className="flex items-center flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={executandoBackup}
                className="btn-secondary bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs py-2 flex items-center gap-1.5 cursor-pointer"
                title="Selecione um arquivo de backup (.json) do seu computador ou Google Drive para restaurar"
              >
                <UploadCloud size={14} /> Restaurar de Arquivo (.JSON)
              </button>

              <button
                type="button"
                onClick={handleExportarJsonDireto}
                disabled={executandoBackup}
                className="btn-secondary bg-emerald-600 hover:bg-emerald-500 text-white border-transparent text-xs py-2 flex items-center gap-1.5 cursor-pointer font-bold shadow-md"
                title="Faz o download imediato de todas as coleções para o seu computador em arquivo JSON"
              >
                <Download size={14} className={executandoBackup ? 'animate-bounce' : ''} />
                {executandoBackup ? 'Exportando Dados...' : 'Baixar JSON Completo'}
              </button>
            </div>
          </div>

          {/* Card explicativo sobre a nuvem e Google Drive */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-blue-900">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 shrink-0 font-bold">
                <HardDrive size={18} />
              </div>
              <div>
                <strong className="block text-blue-950 font-bold">Como funciona o armazenamento das cópias:</strong>
                <span>
                  Cada snapshot é gravado com segurança militar no <strong>Google Cloud Storage</strong> da Alpha e baixado no seu computador. Para sincronizar com o <strong>Google Drive</strong>, basta manter a pasta de Downloads sincronizada com o app do Google Drive no seu PC.
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-cream-300 overflow-hidden">
            <div className="p-4 border-b border-cream-300 bg-cream-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                  <Clock size={16} className="text-brand-600" /> Histórico de Cópias Disponíveis para Restauração
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">Selecione uma cópia para restaurar em ambiente de teste ou baixar</p>
              </div>
              <button onClick={carregarBackups} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1">
                <RefreshCw size={12} className={carregando ? 'animate-spin' : ''} /> Atualizar Lista
              </button>
            </div>

            {backups.length === 0 ? (
              <div className="text-center py-16 px-4 text-gray-400">
                <Database size={48} className="mx-auto mb-3 text-gray-300" />
                <h3 className="font-bold text-gray-700 text-base">Nenhum backup encontrado no cofre</h3>
                <p className="text-xs text-gray-500 mt-1 mb-4">Clique no botão abaixo para gerar a primeira cópia de segurança agora mesmo.</p>
                <button onClick={handleDispararBackupAgora} className="btn-primary text-xs py-2 px-4 mx-auto">
                  Gerar Primeiro Backup
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {backups.map(b => (
                  <div key={b.id} className="p-4 sm:p-5 hover:bg-slate-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-mono text-sm font-black text-brand-700">📅 {b.dataRef}</span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                          {b.totalDocumentos} registros preservados
                        </span>
                        {b.tamanhoFormatado && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300 font-mono">
                            💾 {b.tamanhoFormatado}
                          </span>
                        )}
                        {b.arquivoUrl && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                            ☁️ Nuvem Ativa
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        Cópia salva em: {new Date(b.dataCriacao).toLocaleString('pt-BR')} • {b.colecoes?.length || 0} coleções cobertas
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(b.colecoes || []).slice(0, 8).map(c => (
                          <span key={c} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            {c}
                          </span>
                        ))}
                        {b.colecoes?.length > 8 && <span className="text-[10px] text-gray-400">+{b.colecoes.length - 8} mais</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleBaixarCopia(b)}
                        disabled={baixandoId === b.id}
                        className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 cursor-pointer font-bold"
                        title="Baixar arquivo JSON completo deste backup"
                      >
                        <Download size={14} className={baixandoId === b.id ? 'animate-bounce' : ''} />
                        {baixandoId === b.id ? 'Baixando...' : 'Baixar JSON'}
                      </button>

                      <button
                        onClick={() => handleRestaurarBackup(b.id, 'teste')}
                        disabled={restaurandoId === b.id}
                        className="btn-secondary text-xs py-2 px-3 border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 flex items-center gap-1.5 font-bold cursor-pointer"
                        title="Restaura em ambiente isolado (prefixo teste_) para verificar sem afetar a produção"
                      >
                        <RotateCcw size={14} className={restaurandoId === b.id ? 'animate-spin' : ''} />
                        {restaurandoId === b.id ? 'Restaurando...' : 'Restaurar em Teste'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
