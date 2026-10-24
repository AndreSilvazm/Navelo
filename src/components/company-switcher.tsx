"use client"

import { useEffect, useRef } from "react"
import { chooseAccess } from "@/app/acesso/actions"
import { acceptPendingInvitation, switchCompany } from "@/app/portal/actions"
import { Icon } from "@/figma/ui"
import { initialsOf } from "@/lib/initials"
import type { PortalSwitcherData } from "@/lib/portal-companies"

const statusLabel: Record<string, string> = {
  profile_pending: "Cadastro pendente",
  documents_pending: "Cadastro pendente",
  in_review: "Em análise",
  rejected: "Acesso recusado",
  suspended: "Acesso suspenso",
}

// "Contratante" do topo do portal. Com mais de uma empresa (ou convite pendente) vira um menu:
// cada empresa é uma visão própria do colaborador.
export function CompanySwitcher({ companies, invites, others }: PortalSwitcherData) {
  const ref = useRef<HTMLDetailsElement>(null)
  const current = companies.find((c) => c.current) ?? companies[0]

  // fecha o menu quando a empresa ativa muda
  const currentId = current?.id
  useEffect(() => {
    if (ref.current) ref.current.open = false
  }, [currentId])

  // fecha ao clicar fora
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [])

  if (!current) return null

  const head = (
    <>
      <span className="company-dot">{initialsOf(current.name)}</span>
      <div>
        <small>Contratante</small>
        <strong>{current.name}</strong>
      </div>
    </>
  )

  if (companies.length < 2 && invites.length === 0 && others.length === 0) return <div className="portal-company">{head}</div>

  return (
    <details className="company-switcher" ref={ref}>
      <summary className="portal-company" aria-label="Trocar de empresa">
        {head}
        {invites.length > 0 && <b className="switcher-count">{invites.length}</b>}
        <Icon name="chevron" size={14} />
      </summary>
      <div className="switcher-menu">
        <ul>
          {companies.map((c) => (
            <li key={c.id}>
              <form action={switchCompany.bind(null, c.id)}>
                <button className={c.current ? "current" : ""} disabled={c.current} type="submit">
                  <span className="company-dot">{initialsOf(c.name)}</span>
                  <span>
                    <strong>{c.name}</strong>
                    {c.status !== "active" && <small>{statusLabel[c.status]}</small>}
                  </span>
                  {c.current && <i aria-hidden="true">✓</i>}
                </button>
              </form>
            </li>
          ))}
        </ul>
        {others.length > 0 && (
          <>
            <p className="switcher-title">Outros acessos</p>
            <ul>
              {others.map((o) => (
                <li key={o.membershipId}>
                  <form action={chooseAccess.bind(null, o.membershipId)}>
                    <button type="submit">
                      <span>
                        <strong>Entrar como {o.label}</strong>
                      </span>
                      <i aria-hidden="true">→</i>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </>
        )}
        {invites.length > 0 && (
          <>
            <p className="switcher-title">Convites</p>
            <ul>
              {invites.map((i) => (
                <li key={i.id}>
                  <form action={acceptPendingInvitation.bind(null, i.id)}>
                    <button type="submit">
                      <span className="company-dot">{initialsOf(i.companyName)}</span>
                      <span>
                        <strong>{i.companyName}</strong>
                        <small>{i.jobTitle ? `Convite para ${i.jobTitle}` : "Convite para colaborar"}</small>
                      </span>
                      <em>Aceitar</em>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </details>
  )
}
