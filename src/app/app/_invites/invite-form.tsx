"use client"

import { useActionState } from "react"
import { Button, Icon, TextField } from "@/figma/ui"
import { ROLE_LABELS, type InvitableRole } from "@/lib/auth/permissions"
import { inviteMember } from "./actions"

// O corporativo informa o e-mail (e o cargo, no caso de colaborador); nome e demais dados a própria pessoa preenche ao aceitar.
export function InviteForm({
  roles,
  submitLabel,
  askJobTitle = false,
}: {
  roles: readonly InvitableRole[]
  submitLabel: string
  askJobTitle?: boolean
}) {
  const [state, action, pending] = useActionState(inviteMember, undefined)

  return (
    <form action={action} style={{ display: "grid", gap: 16 }}>
      {state?.error && (
        <p className="form-alert" role="alert">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="form-hint" role="status" style={{ overflowWrap: "anywhere" }}>
          {state.success}
        </p>
      )}
      <div className="form-grid">
        <TextField label="E-mail" name="email" placeholder="pessoa@empresa.com.br" required type="email" />
        {askJobTitle && <TextField label="Cargo" maxLength={100} name="jobTitle" placeholder="Ex.: Desenvolvedor Back-end" required />}
        {roles.length === 1 ? (
          <input name="role" type="hidden" value={roles[0]} />
        ) : (
          <label className="field">
            <span className="field-label">Papel</span>
            <span className="field-control field-select">
              <select defaultValue={roles[0]} name="role">
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
              <Icon name="chevron" size={16} />
            </span>
          </label>
        )}
      </div>
      <div className="portal-form-actions">
        <Button disabled={pending} icon="mail" loading={pending} type="submit">
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
