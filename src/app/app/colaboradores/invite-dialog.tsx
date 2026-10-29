"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/figma/ui"
import { InviteForm } from "../_invites/invite-form"

// Botão "Enviar convite" do topo de Colaboradores. Abre uma janela (modal) com o formulário, para
// convidar sem sair da lista. Mesmo padrão do ReasonDialog: <dialog> nativo, Esc fecha, fundo escurece.
export function InviteDialog() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <>
      <Button icon="mail" onClick={() => setOpen(true)}>
        Enviar convite
      </Button>
      <dialog
        aria-labelledby="invite-dialog-title"
        className="modal"
        onClick={(e) => e.target === ref.current && setOpen(false)} // clique no fundo fecha
        onClose={() => setOpen(false)}
        ref={ref}
      >
        {/* o formulário só existe com a janela aberta: ao reabrir, os campos voltam vazios */}
        {open && (
          <div className="modal-body">
            <div>
              <strong id="invite-dialog-title">Convidar colaborador</strong>
              <p className="form-hint" style={{ marginTop: 4 }}>
                Informe o e-mail e o cargo. O colaborador preenche os próprios dados no primeiro acesso.
              </p>
            </div>
            <InviteForm askJobTitle roles={["collaborator"]} submitLabel="Enviar convite" />
            <div className="modal-actions">
              <Button onClick={() => setOpen(false)} variant="ghost">
                Fechar
              </Button>
            </div>
          </div>
        )}
      </dialog>
    </>
  )
}
