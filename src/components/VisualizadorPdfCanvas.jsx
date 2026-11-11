import React, { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2, AlertCircle, Download, ExternalLink, FileText } from 'lucide-react'
import { converterParaBlobUrl } from '../utils/fileViewer'

// Configura o worker do PDF.js usando o bundler do Vite
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker
}

export default function VisualizadorPdfCanvas({ url, nome = 'Documento.pdf', onBaixar, onNovaAba }) {
  const canvasRef = useRef(null)
  const [pdfDoc, setPdfDoc] = useState(null)
  const [pageNum, setPageNum] = useState(1)
  const [numPages, setNumPages] = useState(0)
  const [scale, setScale] = useState(1.3)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [blobUrl, setBlobUrl] = useState('')

  useEffect(() => {
    let isCancelled = false
    setLoading(true)
    setError(null)
    setPageNum(1)

    if (!url) {
      setError('Nenhum arquivo anexado a este registro.')
      setLoading(false)
      return
    }

    // Gera o Blob URL correspondente para fallback e ações rápidas
    const bUrl = converterParaBlobUrl(url, 'application/pdf')
    setBlobUrl(bUrl)

    async function loadPdf() {
      try {
        let docSource = url

        // Se for Base64 (data URI), decodifica para Uint8Array em blocos seguros
        if (typeof url === 'string' && url.startsWith('data:')) {
          const parts = url.split(',')
          const rawBase64 = (parts[1] || '').replace(/[\s\r\n]+/g, '')
          const binaryStr = atob(rawBase64)
          const len = binaryStr.length
          const bytes = new Uint8Array(len)
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryStr.charCodeAt(i)
          }
          docSource = { data: bytes }
        }

        // Timeout preventivo para não travar o usuário
        const loadingPromise = pdfjsLib.getDocument(docSource).promise
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Tempo limite para renderizar páginas excedido')), 15000)
        )

        const doc = await Promise.race([loadingPromise, timeoutPromise])

        if (!isCancelled) {
          setPdfDoc(doc)
          setNumPages(doc.numPages)
          setLoading(false)
        }
      } catch (err) {
        console.warn('Aviso no carregamento do PDF via Canvas:', err.message)
        if (!isCancelled) {
          setError(err.message || 'Falha ao processar páginas do PDF')
          setLoading(false)
        }
      }
    }

    loadPdf()

    return () => {
      isCancelled = true
    }
  }, [url])

  // Renderiza a página atual no Canvas
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return
    let renderTask = null

    async function renderPage() {
      try {
        const page = await pdfDoc.getPage(pageNum)
        const viewport = page.getViewport({ scale })
        const canvas = canvasRef.current
        if (!canvas) return
        const context = canvas.getContext('2d')

        canvas.height = viewport.height
        canvas.width = viewport.width

        const renderContext = {
          canvasContext: context,
          viewport: viewport
        }

        renderTask = page.render(renderContext)
        await renderTask.promise
      } catch (err) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn('Renderização cancelada ou erro:', err)
        }
      }
    }

    renderPage()

    return () => {
      if (renderTask) {
        try {
          renderTask.cancel()
        } catch {
          // ignore
        }
      }
    }
  }, [pdfDoc, pageNum, scale])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500 gap-3 min-h-[350px]">
        <Loader2 size={36} className="animate-spin text-brand-600" />
        <span className="text-xs font-bold text-gray-700">Carregando visualização do PDF...</span>
        <span className="text-[11px] text-gray-400">Decodificando documento com alta fidelidade</span>
      </div>
    )
  }

  if (error || !pdfDoc) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center min-h-[380px] w-full bg-slate-50 rounded-2xl border border-slate-200">
        <div className="w-14 h-14 rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center mb-3 shadow-inner">
          <FileText size={28} />
        </div>
        <h4 className="font-black text-sm text-gray-900">{nome}</h4>
        <p className="text-xs text-gray-500 max-w-sm mt-1 mb-5">
          Documento PDF pronto para leitura. Você pode abrir instantaneamente no visualizador do navegador em tela cheia ou baixar o arquivo original.
        </p>

        <div className="flex gap-3 flex-wrap justify-center">
          {onNovaAba && (
            <button 
              onClick={onNovaAba}
              className="btn-primary py-2.5 px-5 text-xs flex items-center gap-2 font-bold shadow-sm active:scale-95 transition-all"
            >
              <ExternalLink size={15} /> Abrir em Nova Aba (Tela Cheia)
            </button>
          )}
          {onBaixar && (
            <button 
              onClick={onBaixar}
              className="btn-secondary py-2.5 px-5 text-xs flex items-center gap-2 font-bold active:scale-95 transition-all"
            >
              <Download size={15} /> Baixar Arquivo PDF
            </button>
          )}
        </div>

        {blobUrl && (
          <div className="w-full mt-6 pt-6 border-t border-slate-200">
            <object 
              data={blobUrl} 
              type="application/pdf" 
              className="w-full h-[55vh] rounded-xl border border-slate-300 shadow-inner bg-white"
            >
              <p className="text-xs text-gray-500 py-4">
                Seu navegador não suporta visualização embutida de PDF. Clique no botão "Abrir em Nova Aba" acima.
              </p>
            </object>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center w-full">
      {/* Barra de Controles de Página e Zoom */}
      <div className="flex items-center justify-between w-full max-w-xl bg-slate-800 text-white px-4 py-2 rounded-xl mb-3 shadow-sm text-xs font-semibold">
        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => setPageNum(p => Math.max(1, p - 1))}
            disabled={pageNum <= 1}
            className="p-1 rounded hover:bg-slate-700 disabled:opacity-40 transition-colors cursor-pointer"
            title="Página Anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            Pág. {pageNum} de {numPages || 1}
          </span>
          <button 
            onClick={() => setPageNum(p => Math.min(numPages, p + 1))}
            disabled={pageNum >= numPages}
            className="p-1 rounded hover:bg-slate-700 disabled:opacity-40 transition-colors cursor-pointer"
            title="Próxima Página"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => setScale(s => Math.max(0.7, s - 0.2))}
            className="p-1 rounded hover:bg-slate-700 transition-colors cursor-pointer"
            title="Diminuir Zoom"
          >
            <ZoomOut size={15} />
          </button>
          <span className="w-12 text-center">{Math.round(scale * 100)}%</span>
          <button 
            onClick={() => setScale(s => Math.min(2.5, s + 0.2))}
            className="p-1 rounded hover:bg-slate-700 transition-colors cursor-pointer"
            title="Aumentar Zoom"
          >
            <ZoomIn size={15} />
          </button>
        </div>
      </div>

      {/* Área do Canvas onde a página é desenhada pixel a pixel */}
      <div className="max-h-[68vh] overflow-auto w-full flex items-center justify-center p-2 custom-scrollbar bg-slate-200/60 rounded-xl border border-slate-300">
        <canvas ref={canvasRef} className="shadow-xl rounded-md bg-white max-w-full" />
      </div>
    </div>
  )
}
