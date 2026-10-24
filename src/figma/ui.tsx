"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { masks, type MaskName } from "@/lib/masks"
import Link from "next/link"
import { usePathname } from "next/navigation"

export type IconName = "activity" | "arrow" | "bell" | "briefcase" | "calendar" | "check" | "chevron" | "clock" | "close" | "contract" | "dashboard" | "document" | "download" | "filter" | "gear" | "grid" | "lock" | "logout" | "mail" | "menu" | "more" | "payment" | "people" | "plus" | "report" | "search" | "shield" | "upload"

const iconPaths: Record<IconName, ReactNode> = {
  close: <path d="M6 6l12 12M18 6 6 18" />,
  logout: <path d="M10 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4M15 8l4 4-4 4M19 12H9" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  activity: (
    <>
      <path d="M4 12h3l2-6 4 12 2-6h5" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14M14 7l5 5-5 5" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
      <path d="M10 19h4" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  contract: (
    <>
      <path d="M7 3h8l4 4v14H7z" />
      <path d="M15 3v5h4M10 12h6M10 16h6" />
    </>
  ),
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </>
  ),
  document: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M14 3v5h5M9 13h7M9 17h5" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />
    </>
  ),
  filter: <path d="M4 5h16l-6 7v5l-4 2v-7z" />,
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </>
  ),
  grid: (
    <>
      <path d="M4 5h16M4 12h16M4 19h16" />
      <path d="M9 5v14M16 5v14" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  payment: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M3 10h18M7 15h3" />
    </>
  ),
  people: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  report: (
    <>
      <path d="M5 20V10M12 20V4M19 20v-7" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  shield: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4m0 0L8 8m4-4 4 4M4 20h16" />
    </>
  ),
}

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      className="icon"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      {iconPaths[name]}
    </svg>
  )
}

// Wordmark "navelo" (minúsculas, traço único) desenhado numa grade de altura-x 44; o "l" sobe 16.
// public/brand guarda a mesma arte.
function NaveloWordmark() {
  return (
    <svg aria-hidden="true" className="logo-wordmark" viewBox="0 -16 270 60">
      <g fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="9">
        <path d="M4.5 44V25a20.5 20.5 0 0 1 41 0V44" />
        <circle cx="76.5" cy="22" r="17.5" />
        <path d="M98.5 0V44" />
        <path d="M108 4.5 128.5 38.5 149 4.5" strokeLinecap="round" />
        <path d="M160 22H195A17.5 17.5 0 1 0 189.9 34.4" />
        <path d="M211 -11.5V39.5" strokeLinecap="round" />
        <ellipse cx="245" cy="22" rx="19.5" ry="17.5" />
      </g>
    </svg>
  )
}

function NaveloMark() {
  return (
    <svg aria-hidden="true" className="logo-mark" viewBox="0 0 32 32">
      <rect fill="var(--zn-primary)" height="32" rx="9" width="32" />
      <path
        d="M10 22.5V15a6 6 0 0 1 12 0v7.5"
        fill="none"
        stroke="#fff"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3.2"
      />
    </svg>
  )
}

export function LogoArt({ light = false }: { light?: boolean }) {
  return (
    <span className={`logo${light ? " logo-light" : ""}`}>
      <NaveloWordmark />
    </span>
  )
}

export function Logo({
  compact = false,
  light = false,
  href = "/",
}: {
  compact?: boolean
  light?: boolean
  href?: string
}) {
  return (
    <Link
      aria-label="Navelo — página inicial"
      className={`logo${light ? " logo-light" : ""}${compact ? " is-compact" : ""}`}
      href={href}
    >
      <NaveloWordmark />
      <NaveloMark />
    </Link>
  )
}

export function NavLink({
  children,
  className,
  end = false,
  href,
  title,
}: {
  children: ReactNode
  className: (state: { isActive: boolean }) => string
  end?: boolean
  href: string
  title?: string
}) {
  const pathname = usePathname()
  const isActive = end
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`)
  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      className={className({ isActive })}
      href={href}
      title={title}
    >
      {children}
    </Link>
  )
}

type ButtonProps = {
  children: ReactNode
  className?: string
  disabled?: boolean
  icon?: IconName
  loading?: boolean
  onClick?: () => void
  href?: string
  type?: "button" | "submit"
  variant?: "primary" | "secondary" | "ghost" | "dark"
}

export function Button({
  children,
  className = "",
  disabled,
  icon,
  loading,
  onClick,
  href,
  type = "button",
  variant = "primary",
}: ButtonProps) {
  const content = (
    <>
      {loading ? (
        <span className="spinner" />
      ) : icon ? (
        <Icon name={icon} size={17} />
      ) : null}
      <span>{children}</span>
    </>
  )
  const classes = `button button-${variant} ${className}`
  if (href)
    return (
      <Link aria-disabled={disabled} className={classes} href={href}>
        {content}
      </Link>
    )
  return (
    <button
      className={classes}
      disabled={disabled}
      onClick={onClick}
      type={type}
    >
      {content}
    </button>
  )
}

export function IconButton({
  children,
  label,
}: {
  children: ReactNode
  label: string
}) {
  return (
    <button aria-label={label} className="icon-button" type="button">
      {children}
    </button>
  )
}

export function SurfaceButton({
  children,
  className,
  label,
}: {
  children: ReactNode
  className: string
  label: string
}) {
  return (
    <button aria-label={label} className={className} type="button">
      {children}
    </button>
  )
}

export function Checkbox({ label, name }: { label?: string; name?: string }) {
  return (
    <label className={label ? "checkbox" : "checkbox-only"}>
      <input aria-label={label || "Selecionar item"} name={name} type="checkbox" />
      {label && <span>{label}</span>}
    </label>
  )
}

export function SearchInput({ placeholder }: { placeholder: string }) {
  return (
    <div className="table-search">
      <Icon name="search" size={17} />
      <input aria-label={placeholder} placeholder={placeholder} />
    </div>
  )
}

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// aceita o mesmo formato do atributo accept: ".pdf,.png", "image/*", "application/pdf"
function matchesAccept(file: File, accept: string) {
  const name = file.name.toLowerCase()
  return accept.split(",").some((raw) => {
    const token = raw.trim().toLowerCase()
    if (token.startsWith(".")) return name.endsWith(token)
    if (token.endsWith("/*")) return file.type.startsWith(token.slice(0, -1))
    return file.type === token
  })
}

// Campo de upload padrão da plataforma: arrastar e soltar ou clicar para escolher.
// Guarda o arquivo num <input type="file" name={name}>, então funciona direto
// dentro de um <form> (inclusive com Server Actions).
export function UploadZone({
  accept,
  disabled,
  formats,
  maxSizeMB = 10,
  name = "file",
  onFileChange,
  required,
  title = "Arraste o arquivo aqui",
}: {
  accept: string
  disabled?: boolean
  formats: string
  maxSizeMB?: number
  name?: string
  onFileChange?: (file: File | null) => void
  required?: boolean
  title?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState("")

  const select = (next: File | null) => {
    const input = inputRef.current
    if (!input) return
    setError("")
    if (next && !matchesAccept(next, accept)) {
      next = null
      setError(`Formato não aceito. Use: ${formats.split("•")[0].trim()}.`)
    } else if (next && next.size > maxSizeMB * 1024 * 1024) {
      next = null
      setError(`O arquivo passa de ${maxSizeMB} MB.`)
    }
    if (next) {
      // coloca o arquivo no input para ele seguir junto com o formulário
      const transfer = new DataTransfer()
      transfer.items.add(next)
      input.files = transfer.files
    } else {
      input.value = ""
    }
    setFile(next)
    onFileChange?.(next)
  }

  // formulário reiniciado (ex.: depois de uma Server Action) limpa o campo
  useEffect(() => {
    const form = inputRef.current?.form
    const clear = () => {
      setFile(null)
      setError("")
      onFileChange?.(null)
    }
    form?.addEventListener("reset", clear)
    return () => form?.removeEventListener("reset", clear)
  }, [onFileChange])

  return (
    <div className="upload-field">
      <input
        accept={accept}
        className="visually-hidden"
        disabled={disabled}
        name={name}
        onChange={(e) => select(e.target.files?.[0] ?? null)}
        ref={inputRef}
        required={required}
        tabIndex={-1}
        type="file"
      />
      {file ? (
        <div className="upload-file">
          <span className="upload-file-icon">
            <Icon name="document" size={22} />
          </span>
          <div>
            <strong>{file.name}</strong>
            <span>{formatBytes(file.size)} · Pronto para enviar</span>
          </div>
          <button className="upload-remove" disabled={disabled} onClick={() => select(null)} type="button">
            Remover
          </button>
        </div>
      ) : (
        <div
          aria-disabled={disabled}
          className="upload-zone"
          data-dragging={dragging}
          onClick={() => !disabled && inputRef.current?.click()}
          onDragLeave={() => setDragging(false)}
          onDragOver={(e) => {
            e.preventDefault()
            if (!disabled) setDragging(true)
          }}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            if (!disabled) select(e.dataTransfer.files?.[0] ?? null)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              inputRef.current?.click()
            }
          }}
          role="button"
          tabIndex={disabled ? -1 : 0}
        >
          <span className="upload-zone-icon">
            <Icon name="upload" size={25} />
          </span>
          <strong>{title}</strong>
          <span>
            ou <b>selecione um arquivo</b>
          </span>
          <small>{formats}</small>
        </div>
      )}
      {error && (
        <p className="field-message" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export function TextArea({
  label,
  placeholder,
}: {
  label: string
  placeholder?: string
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <textarea className="textarea" placeholder={placeholder} />
    </label>
  )
}

export function TextField({
  autoComplete,
  defaultValue,
  error,
  hint,
  icon,
  label,
  leading,
  mask,
  maxLength,
  name,
  onValueChange,
  placeholder,
  readOnly,
  required,
  type = "text",
  value,
}: {
  autoComplete?: string
  defaultValue?: string
  error?: string
  hint?: ReactNode
  icon?: IconName
  label?: string
  // conteúdo à esquerda do campo, no lugar do ícone (ex.: logo do banco)
  leading?: ReactNode
  mask?: MaskName
  maxLength?: number
  name?: string
  // com `value` o campo é controlado: use junto com onValueChange (recebe o texto já com máscara)
  onValueChange?: (value: string) => void
  placeholder?: string
  readOnly?: boolean
  required?: boolean
  type?: string
  value?: string
}) {
  return (
    <label className={`field ${error ? "field-error" : ""}`}>
      {label && <span className="field-label">{label}</span>}
      <span className="field-control">
        {leading ?? (icon && <Icon name={icon} size={18} />)}
        <input
          aria-invalid={error ? true : undefined}
          autoComplete={autoComplete}
          defaultValue={value === undefined ? (mask && defaultValue ? masks[mask](defaultValue) : defaultValue) : undefined}
          inputMode={mask ? "numeric" : undefined}
          maxLength={maxLength}
          name={name}
          onChange={(e) => {
            const next = mask ? masks[mask](e.currentTarget.value) : e.currentTarget.value
            if (value === undefined && mask) e.currentTarget.value = next
            onValueChange?.(next)
          }}
          placeholder={placeholder}
          readOnly={readOnly}
          required={required}
          type={type}
          value={value}
        />
      </span>
      {error && <span className="field-message">{error}</span>}
      {hint && !error && <span className="form-hint">{hint}</span>}
    </label>
  )
}

export function SelectField({
  label,
  value,
}: {
  label?: string
  value: string
}) {
  return (
    <label className="field">
      {label && <span className="field-label">{label}</span>}
      <span className="field-control field-select">
        <select aria-label={label ? undefined : value} defaultValue={value}>
          <option>{value}</option>
          <option>Todos</option>
        </select>
        <Icon name="chevron" size={16} />
      </span>
    </label>
  )
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode
  tone?: "success" | "warning" | "danger" | "info" | "neutral"
}) {
  return (
    <span className={`badge badge-${tone}`}>
      <span className="badge-dot" />
      {children}
    </span>
  )
}

export function Avatar({
  initials,
  name,
  size = "md",
  tone = 0,
}: {
  initials: string
  name: string
  size?: "sm" | "md" | "lg" | "xl"
  tone?: number
}) {
  return (
    <span
      aria-label={name}
      className={`avatar avatar-${size} avatar-tone-${tone % 5}`}
      role="img"
    >
      {initials}
    </span>
  )
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={`card ${className}`}>{children}</div>
}

export function PageHeading({
  action,
  eyebrow,
  subtitle,
  title,
}: {
  action?: ReactNode
  eyebrow?: string
  subtitle?: string
  title: string
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {action && <div className="page-actions">{action}</div>}
    </div>
  )
}
