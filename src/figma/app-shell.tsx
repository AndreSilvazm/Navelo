"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { logout } from "@/app/login/actions"
import { AccountMenu } from "@/components/account-menu"
import { initialsOf } from "@/lib/initials"
import {
  Avatar,
  Icon,
  IconButton,
  Logo,
  NavLink,
  SurfaceButton,
  type IconName,
} from "./ui"

const workspaceNav: Array<{
  icon: IconName
  label: string
  short?: string
  to: string
}> = [
  { icon: "dashboard", label: "Visão geral", short: "Início", to: "/app" },
  { icon: "contract", label: "Contratos", to: "/app/contratos" },
  { icon: "people", label: "Colaboradores", short: "Equipe", to: "/app/colaboradores" },
  { icon: "upload", label: "Notas fiscais", short: "Notas", to: "/app/notas-fiscais" },
  { icon: "payment", label: "Reembolsos", short: "Reemb.", to: "/app/reembolsos" },
  { icon: "shield", label: "Auditoria", to: "/app/auditoria" },
]

export function AppShell({
  children,
  company,
  hasOtherAccess,
  user,
}: {
  children: ReactNode
  company: { name: string }
  hasOtherAccess?: boolean
  user: { name: string; roleLabel: string }
}) {
  const pathname = usePathname()
  const inContract = pathname.includes("/contratos/alpha")

  return (
    <div className="workspace-layout">
      <aside className="workspace-sidebar">
        <div className="workspace-brand">
          <Logo href="/app" />
          <span className="workspace-plan">Empresa</span>
        </div>
        <nav aria-label="Portal da empresa" className="workspace-nav">
          <span className="workspace-label">Operação</span>
          {workspaceNav.map((item) => (
            <NavLink
              className={({ isActive }) =>
                `workspace-nav-item ${isActive ? "active" : ""}`
              }
              end={item.to === "/app"}
              key={item.to}
              href={item.to}
              title={item.label}
            >
              <Icon name={item.icon} size={18} />
              <span className="nav-label">{item.label}</span>
              <span aria-hidden="true" className="nav-label-short">
                {item.short ?? item.label}
              </span>
            </NavLink>
          ))}
        </nav>
        <div className="workspace-sidebar-bottom">
          <NavLink
            className={({ isActive }) =>
              `workspace-nav-item ${isActive ? "active" : ""}`
            }
            href="/app/configuracoes"
            title="Configurações"
          >
            <Icon name="gear" size={18} />
            <span className="nav-label">Configurações</span>
          </NavLink>
          {hasOtherAccess && (
            <Link className="workspace-nav-item" href="/acesso" title="Trocar de acesso">
              <Icon name="people" size={18} />
              <span className="nav-label">Trocar de acesso</span>
            </Link>
          )}
          <form action={logout} className="logout-form">
            <button className="workspace-nav-item" title="Sair" type="submit">
              <Icon name="logout" size={18} />
              <span className="nav-label">Sair</span>
            </button>
          </form>
          <Link className="workspace-user" href="/app/configuracoes">
            <Avatar initials={initialsOf(user.name)} name={user.name} size="sm" tone={1} />
            <div>
              <strong>{user.name}</strong>
              <span>{user.roleLabel}</span>
            </div>
            <Icon name="more" size={18} />
          </Link>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="workspace-topbar">
          <div className="workspace-selectors">
            <SurfaceButton
              className="organization-selector"
              label="Selecionar empresa ou organização"
            >
              <span className="organization-avatar">{initialsOf(company.name)}</span>
              <span>
                <small>Empresa / Organização</small>
                <strong>{company.name}</strong>
              </span>
              <Icon name="chevron" size={14} />
            </SurfaceButton>
            {inContract && (
              <>
                <span className="selector-divider">
                  <Icon name="chevron" size={14} />
                </span>
                <SurfaceButton
                  className="contract-selector"
                  label="Selecionar contrato atual"
                >
                  <span>
                    <small>Contrato atual</small>
                    <strong>Contrato Alpha</strong>
                  </span>
                  <Icon name="chevron" size={14} />
                </SurfaceButton>
              </>
            )}
          </div>
          <div className="workspace-top-actions">
            <div aria-hidden="true" className="global-search">
              <Icon name="search" size={17} />
              <span>Buscar no Navelo…</span>
              <kbd>⌘ K</kbd>
            </div>
            <IconButton label="Notificações">
              <Icon name="bell" size={19} />
              <span className="notification-dot" />
            </IconButton>
            <Link aria-label="Configurações da conta" className="topbar-account account-desktop" href="/app/configuracoes">
              <Avatar initials={initialsOf(user.name)} name={user.name} size="sm" tone={1} />
            </Link>
            <AccountMenu
              links={[
                { href: "/app/configuracoes", label: "Configurações", icon: "gear" },
                ...(hasOtherAccess ? [{ href: "/acesso", label: "Trocar de acesso", icon: "people" as const }] : []),
              ]}
              name={user.name}
              subtitle={user.roleLabel}
              tone={1}
            />
          </div>
        </header>
        <main className="workspace-content" id="conteudo">
          {children}
        </main>
      </div>
    </div>
  )
}
