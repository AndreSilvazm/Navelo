"use client"

import Link from "next/link"
import { useEffect, useRef } from "react"
import { logout } from "@/app/login/actions"
import { Avatar, Icon, type IconName } from "@/figma/ui"
import { initialsOf } from "@/lib/initials"

/**
 * Menu da conta no topo, só no celular: ao tocar no avatar abre o perfil, os atalhos da conta e o
 * "Sair". No computador esses itens ficam na barra lateral e este menu nem aparece (CSS).
 */
export function AccountMenu({
  name,
  subtitle,
  links,
  tone = 0,
}: {
  name: string
  subtitle: string
  links: { href: string; label: string; icon: IconName }[]
  tone?: number
}) {
  const ref = useRef<HTMLDetailsElement>(null)

  // fecha ao tocar fora ou ao apertar Esc
  useEffect(() => {
    const close = () => ref.current?.removeAttribute("open")
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close()
    document.addEventListener("pointerdown", onPointer)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [])

  return (
    <details className="account-menu" ref={ref}>
      <summary aria-label="Menu da conta">
        <Avatar initials={initialsOf(name)} name={name} size="sm" tone={tone} />
      </summary>
      <div className="account-menu-panel" role="menu">
        <div className="account-menu-head">
          <strong>{name}</strong>
          <span>{subtitle}</span>
        </div>
        {links.map((l) => (
          <Link href={l.href} key={l.href} onClick={() => ref.current?.removeAttribute("open")} role="menuitem">
            <Icon name={l.icon} size={18} />
            {l.label}
          </Link>
        ))}
        <form action={logout}>
          <button role="menuitem" type="submit">
            <Icon name="logout" size={18} />
            Sair
          </button>
        </form>
      </div>
    </details>
  )
}
