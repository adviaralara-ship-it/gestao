import React, { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2, AlertCircle, Download, ExternalLink } from 'lucide-react'

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

  useEffect(() => {
    let isCancelled = false
    setLoading(true)
    setError(null)
    setPageNum(1)

    async function loadPdf() {
      try {
        if (!url) {
          throw new Error('Endereço do documento não informado.')
        }

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

        const loadingTask = pdfjsLib.getDocument(docSource)
        const doc = await loadingTask.promise

        if (!isCancelled) {
          setPdfDoc(doc)
          setNumPages(doc.numPages)
          setLoading(false)
        }
      } catch (err) {
        console.error('Erro ao carregar PDF via Canvas:', err)
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
        <span className="text-xs font-bold">Carregando páginas do PDF...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center min-h-[350px] bg-slate-50 rounded-2xl border border-slate-200">
        <AlertCircle size={40} className="text-amber-500 mb-2" />
        <h4 className="font-bold text-sm text-gray-800">Visualização de Documento</h4>
        <p className="text-xs text-gray-500 max-w-sm mt-1 mb-4">
          O formato deste arquivo requer abertura direta no visualizador do navegador ou download.
        </p>
        <div className="flex gap-2.5">
          {onNovaAba && (
            <button 
              onClick={onNovaAba}
              className="btn-primary py-2 px-4 text-xs flex items-center gap-1.5 font-bold shadow-sm"
            >
              <ExternalLink size={14} /> Abrir em Nova Aba
            </button>
          )}
          {onBaixar && (
            <button 
              onClick={onBaixar}
              className="btn-secondary py-2 px-4 text-xs flex items-center gap-1.5 font-bold"
            >
              <Download size={14} /> Baixar Arquivo
            </button>
          )}
        </div>
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
