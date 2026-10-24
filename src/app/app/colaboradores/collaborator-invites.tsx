import { Card } from "@/figma/ui"
import { InviteForm } from "../_invites/invite-form"
import { InvitationsHistory } from "../_invites/invitations-history"

export function CollaboratorInvites() {
  return (
    <div style={{ display: "grid", gap: 24 }}>
      <Card className="mvp-settings-card">
        <div className="mvp-section-heading">
          <div>
            <strong>Convidar colaborador</strong>
            <span>Informe o e-mail e o cargo. O colaborador preenche os próprios dados no primeiro acesso.</span>
          </div>
        </div>
        <InviteForm askJobTitle roles={["collaborator"]} submitLabel="Enviar convite" />
      </Card>
      <Card className="mvp-settings-card">
        <div className="mvp-section-heading">
          <div>
            <strong>Convites enviados</strong>
            <span>Todos os convites de colaboradores e a situação de cada um.</span>
          </div>
        </div>
        <InvitationsHistory roles={["collaborator"]} />
      </Card>
    </div>
  )
}
