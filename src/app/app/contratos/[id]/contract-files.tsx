"use client"

import { Popconfirm } from "antd"
import { useRouter } from "next/navigation"
import { useRef, useState, useTransition, type ReactNode } from "react"
import { DocumentViewer } from "@/components/document-viewer"
import { Badge, Button, Card, Icon } from "@/figma/ui"
import { deleteContractFile } from "../actions"

export type ContractFileItem = {
  id: string
  title: string
  fileName: string
  mimeType: string
  size: string // já formatado
  when: string // já formatado
  by: string | null
  /** o documento do contrato (contrato de adesão) em que a pessoa foi contratada */
  principal: boolean
}

const kind = (mime: string) => (mime === "application/pdf" ? { cls: "pdf", label: "PDF" } : { cls: "img", label: mime === "image/png" ? "PNG" : "JPG" })

// Aba de arquivos do contrato: cartões com tipo, tamanho, data e quem anexou; clicar em "Visualizar" abre a
// prévia ao lado (cada abertura fica registrada na auditoria, por isso a prévia só carrega quando se pede).
export function ContractFiles({ contractId, files, canEdit, children }: { contractId: string; files: ContractFileItem[]; canEdit: boolean; children?: ReactNode }) {
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(null)
  const [removing, startRemove] = useTransition()
  const previewRef = useRef<HTMLDivElement>(null)
  const current = files.find((f) => f.id === selected) ?? null
  const url = (id: string) => `/api/contratos/${contractId}/arquivos/${id}`

  const open = (id: string) => {
    setSelected(id)
    // em tela estreita a prévia fica embaixo da lista: leva a pessoa até ela
    if (window.matchMedia("(max-width: 1100px)").matches) setTimeout(() => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80)
  }

  return (
    <div className="cfiles">
      <div className="cfiles-column">
        <Card className="mvp-settings-card">
          <div className="mvp-section-heading">
            <div>
              <strong>Arquivos do contrato</strong>
              <span>
                {files.length === 0 ? "Nenhum arquivo anexado ainda." : `${files.length} arquivo(s). Só o corporativo vê e anexa.`}
              </span>
            </div>
          </div>
          {files.length === 0 ? (
            <div className="cfiles-empty" style={{ minHeight: 160 }}>
              <Icon name="document" size={28} />
              <span>Anexe o primeiro documento deste contrato abaixo.</span>
            </div>
          ) : (
            <ul className="cfiles-list">
              {files.map((f) => {
                const k = kind(f.mimeType)
                return (
                  <li className={`cfile${selected === f.id ? " is-selected" : ""}${f.principal ? " is-principal" : ""}`} key={f.id}>
                    <span aria-hidden="true" className={`cfile-icon ${k.cls}`}>
                      {k.label}
                    </span>
                    <div className="cfile-main">
                      <div className="cfile-title">
                        <strong>{f.title}</strong>
                        {f.principal && <Badge tone="info">Documento principal</Badge>}
                      </div>
                      <span className="cfile-name" title={f.fileName}>
                        {f.fileName}
                      </span>
                      <div className="cfile-meta">
                        <span>{f.size}</span>
                        <span>Anexado em {f.when}</span>
                        <span>por {f.by ?? "usuário removido"}</span>
                      </div>
                      <div className="cfile-actions">
                        <Button onClick={() => open(f.id)} variant={selected === f.id ? "primary" : "secondary"}>
                          {selected === f.id ? "Em exibição" : "Visualizar"}
                        </Button>
                        <Button href={`${url(f.id)}?download=1`} variant="ghost">
                          Baixar
                        </Button>
                        {canEdit && (
                          <Popconfirm
                            cancelText="Voltar"
                            description="O arquivo é apagado e a remoção fica registrada na auditoria."
                            okButtonProps={{ danger: true, loading: removing }}
                            okText="Remover"
                            onConfirm={() =>
                              startRemove(async () => {
                                await deleteContractFile(contractId, f.id)
                                if (selected === f.id) setSelected(null)
                                router.refresh()
                              })
                            }
                            title="Remover este arquivo?"
                          >
                            <span>
                              <Button disabled={removing} variant="ghost">
                                Remover
                              </Button>
                            </span>
                          </Popconfirm>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
        {children}
      </div>

      <div className="cfiles-preview" ref={previewRef}>
        <Card className="mvp-settings-card">
          {current ? (
            <>
              <div className="mvp-section-heading">
                <div>
                  <strong>{current.title}</strong>
                  <span>
                    {current.fileName} · {current.size}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <a className="doc-review-next" href={url(current.id)} rel="noreferrer" target="_blank">
                    Abrir em nova aba
                  </a>
                </div>
              </div>
              <div className="doc-viewer">
                <DocumentViewer fileName={current.fileName} key={current.id} mimeType={current.mimeType} url={url(current.id)} />
              </div>
            </>
          ) : (
            <div className="cfiles-empty">
              <span className="cfiles-empty-icon">
                <Icon name="eye" size={26} />
              </span>
              <strong>Selecione um arquivo</strong>
              <span>Clique em &ldquo;Visualizar&rdquo; em um dos documentos para abri-lo aqui.</span>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
