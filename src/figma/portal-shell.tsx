"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { logout } from "@/app/login/actions"
import { AccountMenu } from "@/components/account-menu"
import { CompanySwitcher } from "@/components/company-switcher"
import type { PortalSwitcherData } from "@/lib/portal-companies"
import { initialsOf } from "@/lib/initials"
import {
  Avatar,
  Icon,
  Logo,
  NavLink,
  type IconName,
} from "./ui"

const portalNav: Array<{
  icon: IconName
  label: string
  short?: string
  to: string
  /** só na barra lateral do computador: no celular o item vai para o menu do avatar */
  desktopOnly?: boolean
}> = [
  { icon: "dashboard", label: "Início", to: "/portal" },
  { icon: "contract", label: "Contrato", to: "/portal/contrato" },
  { icon: "document", label: "Notas fiscais", short: "Notas", to: "/portal/notas-fiscais" },
  { icon: "payment", label: "Reembolsos", short: "Reemb.", to: "/portal/reembolsos" },
  { icon: "upload", label: "Documentos", short: "Docs", to: "/portal/documentos", desktopOnly: true },
  { icon: "people", label: "Perfil", to: "/portal/perfil" },
]

export function PortalShell({
  children,
  company,
  switcher,
  user,
}: {
  children: ReactNode
  company: { name: string }
  switcher: PortalSwitcherData
  user: { name: string }
}) {
  return (
    <div className="portal-layout">
      <aside className="portal-sidebar">
        <div className="portal-brand">
          <Logo href="/portal" />
          <span className="portal-tag">Colaborador</span>
        </div>
        <nav aria-label="Portal do colaborador" className="portal-nav">
          {portalNav.map((item) => (
            <NavLink
              className={({ isActive }) =>
                `portal-nav-item ${isActive ? "active" : ""} ${item.desktopOnly ? "nav-desktop-only" : ""}`
              }
              end={item.to === "/portal"}
              key={item.to}
              href={item.to}
              title={item.label}
            >
              <Icon name={item.icon} size={19} />
              <span className="nav-label">{item.label}</span>
              <span aria-hidden="true" className="nav-label-short">
                {item.short ?? item.label}
              </span>
            </NavLink>
          ))}
        </nav>
        <div className="portal-help">
          <span className="portal-help-icon">
            <Icon name="shield" size={18} />
          </span>
          <div>
            <strong>Precisa de ajuda?</strong>
            <span>Fale com o suporte do Navelo</span>
          </div>
          <Icon name="chevron" size={15} />
        </div>
        <form action={logout} className="logout-form">
          <button className="portal-nav-item" title="Sair" type="submit">
            <Icon name="logout" size={19} />
            <span className="nav-label">Sair</span>
          </button>
        </form>
        <Link className="portal-user" href="/portal/perfil">
          <Avatar initials={initialsOf(user.name)} name={user.name} tone={0} />
          <div>
            <strong>{user.name}</strong>
            <span>{company.name}</span>
          </div>
          <Icon name="more" size={18} />
        </Link>
      </aside>
      <div className="portal-main">
        <header className="portal-topbar">
          <div className="portal-mobile-brand">
            <Logo href="/portal" />
            <span className="portal-tag">Colaborador</span>
          </div>
          <CompanySwitcher {...switcher} />
          <div className="portal-top-actions">
            <Link aria-label="Meu perfil" className="account-desktop" href="/portal/perfil">
              <Avatar initials={initialsOf(user.name)} name={user.name} size="sm" tone={0} />
            </Link>
            <AccountMenu links={[
                { href: "/portal/perfil", label: "Meu perfil", icon: "people" },
                { href: "/portal/documentos", label: "Meus documentos", icon: "upload" },
              ]} name={user.name} subtitle={company.name} tone={0} />
          </div>
        </header>
        <main className="portal-content" id="conteudo">
          {children}
        </main>
      </div>
    </div>
  )
}
