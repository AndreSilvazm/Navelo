"use client"

import { useEffect, useRef, useState } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"

// precisa ficar no mesmo módulo que renderiza <Document>/<Page>
pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString()

const STEP = 0.25

export default function PdfViewer({ file }: { file: Blob }) {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(600)
  const [pages, setPages] = useState(0)
  const [page, setPage] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [failed, setFailed] = useState(false)

  // a página acompanha a largura do painel
  useEffect(() => {
    const el = box.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry.contentRect.width - 32)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="doc-viewer-pdf">
      <div className="doc-viewer-bar">
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} type="button">
          ‹
        </button>
        <span>
          Página {page} de {pages || "–"}
        </span>
        <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} type="button">
          ›
        </button>
        <span className="doc-viewer-sep" />
        <button disabled={zoom <= 0.5} onClick={() => setZoom((z) => z - STEP)} type="button">
          −
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button disabled={zoom >= 3} onClick={() => setZoom((z) => z + STEP)} type="button">
          +
        </button>
      </div>
      <div className="doc-viewer-canvas" ref={box}>
        {failed ? (
          <p className="form-hint">Não foi possível exibir este PDF. Use “Abrir em nova aba”.</p>
        ) : (
          <Document
            error={<p className="form-hint">Não foi possível exibir este PDF.</p>}
            file={file}
            loading={<p className="form-hint">Carregando documento…</p>}
            onLoadError={() => setFailed(true)}
            onLoadSuccess={({ numPages }) => {
              setPages(numPages)
              setPage(1)
            }}
          >
            <Page pageNumber={page} width={width * zoom} />
          </Document>
        )}
      </div>
    </div>
  )
}
