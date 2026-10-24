"use client"

import { useQuery } from "@tanstack/react-query"
import dynamic from "next/dynamic"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { documentFileQuery } from "@/lib/document-file"

// pdf.js só roda no navegador
const PdfViewer = dynamic(() => import("./pdf-viewer"), {
  ssr: false,
  loading: () => <p className="form-hint">Carregando visualizador…</p>,
})

// Moldura do visualizador com o botão de tela cheia. Usa a tela cheia do navegador; onde ela não
// existe (iPhone), cobre a janela com CSS.
function FullscreenShell({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [full, setFull] = useState(false)

  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === ref.current)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) setFull(false) // saída do modo por CSS
    }
    document.addEventListener("fullscreenchange", onChange)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("fullscreenchange", onChange)
      document.removeEventListener("keydown", onKey)
    }
  }, [])

  const toggle = async () => {
    const el = ref.current
    if (!el) return
    if (el.requestFullscreen) {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await el.requestFullscreen().catch(() => setFull(true))
    } else setFull((value) => !value)
  }

  return (
    <div className={`doc-viewer-shell${full ? " is-full" : ""}`} ref={ref}>
      <button className="doc-fs-button" onClick={toggle} type="button">
        {full ? "Sair da tela cheia" : "Tela cheia"}
      </button>
      {children}
    </div>
  )
}

// Visualizador padrão da plataforma: PDF (paginado, com zoom) e imagens.
// `url` precisa servir o arquivo na mesma origem; o arquivo fica em cache (TanStack Query).
export function DocumentViewer({
  url,
  file,
  mimeType,
  fileName,
}: {
  /** arquivo servido pelo servidor (fica em cache) */
  url?: string
  /** ou um arquivo local, ainda não enviado (pré-visualização) */
  file?: Blob
  mimeType: string
  fileName: string
}) {
  const [zoom, setZoom] = useState(1)
  const { data: fetched, isError } = useQuery({ ...documentFileQuery(url ?? ""), enabled: !!url && !file })
  const blob = file ?? fetched

  // imagens precisam de uma URL local para o arquivo em cache (uma por documento aberto;
  // não é revogada de propósito, para não quebrar com o duplo efeito do modo dev)
  const imageUrl = useMemo(
    () => (blob && mimeType.startsWith("image/") ? URL.createObjectURL(blob) : undefined),
    [blob, mimeType],
  )

  if (isError && !file) return <p className="form-hint">Não foi possível carregar o documento.</p>
  if (!blob) return <p className="form-hint">Carregando documento…</p>

  if (mimeType === "application/pdf")
    return (
      <FullscreenShell>
        <PdfViewer file={blob} key={url ?? fileName} />
      </FullscreenShell>
    )

  if (mimeType.startsWith("image/")) {
    return (
      <FullscreenShell>
      <div className="doc-viewer-pdf">
        <div className="doc-viewer-bar">
          <button disabled={zoom <= 0.5} onClick={() => setZoom((z) => z - 0.25)} type="button">
            −
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button disabled={zoom >= 3} onClick={() => setZoom((z) => z + 0.25)} type="button">
            +
          </button>
        </div>
        <div className="doc-viewer-canvas">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt={fileName} src={imageUrl} style={{ width: `${zoom * 100}%`, maxWidth: "none", height: "auto" }} />
        </div>
      </div>
      </FullscreenShell>
    )
  }

  return (
    <p className="form-hint">
      Este formato não tem pré-visualização.
      {url && (
        <>
          {" "}
          <a href={url} rel="noreferrer" target="_blank">
            Abrir arquivo
          </a>
        </>
      )}
    </p>
  )
}
