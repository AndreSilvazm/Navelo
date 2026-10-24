"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { LoginForm } from "@/app/login/login-form"
import { LandingMotion } from "@/components/landing-motion"
import {
  Avatar,
  Badge,
  Button,
  Icon,
  Logo,
  LogoArt,
  type IconName,
} from "./ui"

const siteNav = [
  { href: "/#produto", label: "Produto" },
  { href: "/#empresas", label: "Para empresas" },
  { href: "/#colaboradores", label: "Para colaboradores" },
]

export function SiteHeader() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  return (
    <header className={`site-header${open ? " is-open" : ""}`}>
      <div className="site-header-inner">
        <Logo />
        <nav aria-label="Principal" className="site-nav">
          {siteNav.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="site-actions">
          <Link className="site-signin" href="/login">
            Entrar
          </Link>
          <Button href="/login">Começar agora</Button>
        </div>
        <button
          aria-controls="menu-mobile"
          aria-expanded={open}
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          className="site-menu-button"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          <Icon name={open ? "close" : "menu"} size={22} />
        </button>
      </div>
      <div className="site-mobile-menu" hidden={!open} id="menu-mobile">
        <nav aria-label="Principal (celular)">
          {siteNav.map((item) => (
            <Link href={item.href} key={item.href} onClick={() => setOpen(false)}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div>
          <Button className="full-button" href="/login" variant="secondary">
            Entrar
          </Button>
          <Button className="full-button" href="/login">
            Começar agora
          </Button>
        </div>
      </div>
    </header>
  )
}

function DashboardPreview() {
  const nav: Array<[IconName, string, string?]> = [
    ["dashboard", "Visão geral"],
    ["contract", "Contratos"],
    ["people", "Colaboradores"],
    ["document", "Documentos"],
    ["upload", "Notas fiscais"],
    ["clock", "Pendências", "9"],
  ]
  const metrics = [
    ["Contratos ativos", "12"],
    ["Colaboradores", "84"],
    ["Documentos pendentes", "7"],
    ["Notas fiscais pendentes", "4"],
  ]
  const attention: Array<[string, string, "danger" | "warning"]> = [
    ["3 documentos aguardando envio", "João, Pedro e mais 1", "danger"],
    ["4 documentos aguardando análise", "Enviados nos últimos 2 dias", "warning"],
    ["2 notas fiscais não enviadas", "Competência Outubro/2026", "warning"],
  ]
  return (
    <div
      aria-label="Prévia do painel da empresa no Navelo"
      className="product-frame"
      role="img"
    >
      <div aria-hidden="true" className="pf-layout">
        <div className="pf-sidebar">
          <span className="pf-brand">
            <LogoArt />
          </span>
          {nav.map(([icon, label, count], index) => (
            <span className={`pf-nav${index === 0 ? " active" : ""}`} key={label}>
              <Icon name={icon} size={15} />
              {label}
              {count && <b>{count}</b>}
            </span>
          ))}
        </div>
        <div className="pf-main">
          <div className="pf-heading">
            <strong>Bom dia, Empresa XPTO</strong>
            <span>Veja o que precisa da sua atenção.</span>
          </div>
          <div className="pf-metrics">
            {metrics.map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <div className="pf-columns">
            <div className="pf-panel">
              <div className="pf-panel-title">
                <strong>Atenção necessária</strong>
                <span>Ver todas</span>
              </div>
              {attention.map(([title, detail, tone]) => (
                <div className="pf-row" key={title}>
                  <i className={`status-mark ${tone}`} />
                  <div>
                    <strong>{title}</strong>
                    <span>{detail}</span>
                  </div>
                  <em>Ver</em>
                </div>
              ))}
            </div>
            <div className="pf-panel">
              <div className="pf-panel-title">
                <strong>Contratos</strong>
              </div>
              {[
                ["Contrato Alpha", "84 colaboradores", "92%"],
                ["Contrato Beta", "12 colaboradores", "80%"],
              ].map(([name, people, docs]) => (
                <div className="pf-contract" key={name}>
                  <div>
                    <strong>{name}</strong>
                    <span>{people}</span>
                  </div>
                  <div className="pf-bar">
                    <i style={{ width: docs }} />
                  </div>
                  <span>{docs} da documentação regular</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PendingPreview() {
  const items: Array<[string, string, string, "danger" | "warning"]> = [
    ["João precisa enviar documento de identificação.", "Contrato Alpha", "Até 08/10", "danger"],
    ["Maria enviou uma nota fiscal para análise.", "Contrato Alpha", "Enviada hoje", "warning"],
    ["Pedro ainda não enviou a nota de outubro.", "Contrato Beta", "Até 05/10", "danger"],
  ]
  return (
    <div
      aria-label="Prévia da lista de pendências do portal da empresa"
      className="preview-card"
      role="img"
    >
      <div aria-hidden="true">
        <div className="preview-card-head">
          <strong>Pendências</strong>
          <span>Tudo o que precisa ser resolvido, em um único lugar.</span>
        </div>
        <div className="preview-summary">
          {[
            ["9", "abertas"],
            ["4", "com a empresa"],
            ["5", "com colaboradores"],
          ].map(([value, label]) => (
            <div key={label}>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
        {items.map(([title, contract, due, tone]) => (
          <div className="preview-pending" key={title}>
            <i className={`status-mark ${tone}`} />
            <div>
              <strong>{title}</strong>
              <span>{contract}</span>
            </div>
            <small>{due}</small>
          </div>
        ))}
      </div>
    </div>
  )
}

function CollaboratorPreview() {
  return (
    <div
      aria-label="Prévia da tela inicial do portal do colaborador"
      className="phone-preview"
      role="img"
    >
      <div aria-hidden="true">
        <div className="phone-top">
          <LogoArt />
          <Avatar initials="JS" name="João Silva" size="sm" />
        </div>
        <div className="phone-greeting">
          <strong>Olá, João</strong>
          <Badge tone="warning">2 pendências</Badge>
        </div>
        <div className="phone-task">
          <span className="icon-tile">
            <Icon name="document" size={17} />
          </span>
          <div>
            <strong>Enviar nota fiscal</strong>
            <span>Outubro/2026 · prazo 05/10</span>
          </div>
        </div>
        <div className="phone-task">
          <span className="icon-tile warning">
            <Icon name="upload" size={17} />
          </span>
          <div>
            <strong>Atualizar documento</strong>
            <span>Certificado MEI · vence em 15 dias</span>
          </div>
        </div>
        <span className="phone-button">Enviar nota fiscal</span>
        <div className="phone-links">
          {[
            ["contract", "Meu contrato"],
            ["document", "Documentos"],
            ["upload", "Notas fiscais"],
          ].map(([icon, label]) => (
            <span key={label}>
              <Icon name={icon as IconName} size={16} />
              {label}
              <Icon name="chevron" size={14} />
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

const features: Array<{ title: string; text: string; where: string }> = [
  {
    title: "Gestão de contratos",
    text: "Cada contrato reúne período, valor, responsável, colaboradores vinculados e os documentos exigidos.",
    where: "Portal da empresa",
  },
  {
    title: "Organização de documentos",
    text: "Os documentos de cada profissional ficam em um só lugar, com status e validade visíveis: aprovado, em análise ou pendente.",
    where: "Empresa e colaborador",
  },
  {
    title: "Acompanhamento de pendências",
    text: "Documentos não enviados, notas fiscais em análise e prazos próximos aparecem em uma única lista, indicando quem precisa agir.",
    where: "Portal da empresa",
  },
  {
    title: "Informações centralizadas",
    text: "Dados cadastrais, CNPJ, contratos e notas fiscais de cada colaborador PJ, sem depender de planilhas e e-mails.",
    where: "Portal da empresa",
  },
  {
    title: "Acesso do colaborador",
    text: "O profissional consulta o próprio contrato, envia notas fiscais e documentos e acompanha as notificações.",
    where: "Portal do colaborador",
  },
]

const companyBenefits: Array<{ title: string; text: string }> = [
  {
    title: "Mais organização",
    text: "Contratos, documentos e notas fiscais seguem a mesma estrutura para todos os colaboradores.",
  },
  {
    title: "Menos processos manuais",
    text: "Os profissionais enviam os próprios arquivos. Sua equipe só confere e aprova.",
  },
  {
    title: "Visibilidade das informações",
    text: "Indicadores mostram o que está regular e o que precisa de atenção em cada contrato.",
  },
  {
    title: "Acompanhamento sem esforço",
    text: "Pendências e prazos ficam reunidos, com o responsável por cada ação.",
  },
]

export function LandingPage() {
  return (
    <div className="site">
      <LandingMotion />
      <SiteHeader />
      <main id="conteudo">
        <section aria-labelledby="hero-title" className="hero lumen lumen-sphere">
          <div className="hero-copy">

            <h1 id="hero-title">
              Seus colaboradores, <br />
              tudo em um só lugar.
            </h1>
            <p className="hero-lead">
              Gerencie contratos, documentos e informações dos seus
              colaboradores PJ em uma plataforma simples, organizada e feita
              para facilitar o dia a dia da sua empresa.
            </p>
            <div className="hero-actions">
              <Button className="button-lg" href="/login">
                Começar agora <Icon name="arrow" size={18} />
              </Button>
              <Button className="button-lg" href="/#produto" variant="secondary">
                Conhecer a plataforma
              </Button>
            </div>
            <ul className="hero-notes">
              <li>
                <Icon name="check" size={16} />
                Portal da empresa
              </li>
              <li>
                <Icon name="check" size={16} />
                Portal do colaborador PJ
              </li>
              <li>
                <Icon name="check" size={16} />
                Contratos, documentos e notas fiscais
              </li>
            </ul>
          </div>
          <div className="hero-stage">
            <DashboardPreview />
          </div>
        </section>

        <section aria-labelledby="produto-title" className="section lumen lumen-soft" id="produto">
          <div className="section-inner">
            <div className="section-intro split">
              <div>
                <p className="kicker">A plataforma</p>
                <h2 id="produto-title">
                  Tudo o que envolve seus colaboradores PJ, organizado.
                </h2>
              </div>
              <p>
                O Navelo conecta a empresa e cada profissional em um único
                ambiente. Quem contrata acompanha; quem presta serviço envia o
                que é preciso, no tempo certo.
              </p>
            </div>
            <ol className="feature-list">
              {features.map((feature, index) => (
                <li key={feature.title}>
                  <span className="feature-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3>{feature.title}</h3>
                    <p>{feature.text}</p>
                  </div>
                  <span className="feature-where">{feature.where}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          aria-labelledby="empresas-title"
          className="section section-ice lumen lumen-soft lumen-flip"
          id="empresas"
        >
          <div className="section-inner duo">
            <div className="duo-copy">
              <p className="kicker">Para empresas</p>
              <h2 id="empresas-title">
                Menos planilhas. Mais clareza sobre cada contrato.
              </h2>
              <p>
                Acompanhe contratos, documentação e notas fiscais da sua
                operação PJ sem correr atrás de arquivos.
              </p>
              <ul className="benefit-list">
                {companyBenefits.map((item) => (
                  <li key={item.title}>
                    <span className="benefit-check">
                      <Icon name="check" size={14} />
                    </span>
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.text}</span>
                    </div>
                  </li>
                ))}
              </ul>
              <Button className="button-lg" href="/login">
                Começar com o Navelo <Icon name="arrow" size={18} />
              </Button>
            </div>
            <PendingPreview />
          </div>
        </section>

        <section
          aria-labelledby="colaboradores-title"
          className="section lumen lumen-soft"
          id="colaboradores"
        >
          <div className="section-inner duo reverse">
            <div className="duo-copy">
              <p className="kicker">Para colaboradores</p>
              <h2 id="colaboradores-title">
                Um portal simples para o profissional resolver o que precisa.
              </h2>
              <p>
                Cada colaborador PJ tem acesso ao próprio contrato, documentos e
                notas fiscais. A tela inicial mostra o que precisa ser feito, sem
                rodeios.
              </p>
              <ul className="plain-list">
                <li>
                  <Icon name="contract" size={18} />
                  Consulta do contrato e das condições
                </li>
                <li>
                  <Icon name="upload" size={18} />
                  Envio de notas fiscais e documentos em poucos passos
                </li>
                <li>
                  <Icon name="bell" size={18} />
                  Avisos sobre prazos, aprovações e pendências
                </li>
              </ul>
              <Button className="button-lg" href="/login" variant="secondary">
                Acessar o portal do colaborador
              </Button>
            </div>
            <CollaboratorPreview />
          </div>
        </section>

        <section aria-labelledby="cta-title" className="cta">
          <div className="cta-inner lumen lumen-glow">
            <h2 id="cta-title">Simplifique a gestão dos seus colaboradores.</h2>
            <p>
              Contratos, documentos e pendências da sua equipe PJ em uma única
              plataforma.
            </p>
            <div className="cta-actions">
              <Button className="button-lg" href="/login">
                Conhecer o Navelo <Icon name="arrow" size={18} />
              </Button>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="footer-brand">
          <Logo />
          <p>Tecnologia que simplifica o trabalho.</p>
        </div>
        <nav aria-label="Plataforma" className="footer-col">
          <strong>Plataforma</strong>
          {siteNav.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <nav aria-label="Acesso" className="footer-col">
          <strong>Acesso</strong>
          <Link href="/login">Entrar</Link>
          <Link href="/login">Começar agora</Link>
        </nav>
        <div className="footer-col">
          <strong>Institucional</strong>
          <a href="mailto:contato@navelo.com.br">Contato</a>
          <Link href="/privacidade">Política de Privacidade</Link>
          <Link href="/termos">Termos de Uso</Link>
        </div>
      </div>
      <div className="site-footer-bottom">
        <span>© 2026 Navelo</span>
        <nav aria-label="Documentos legais" className="footer-legal">
          <Link href="/privacidade">Política de Privacidade</Link>
          <Link href="/termos">Termos de Uso</Link>
        </nav>
      </div>
    </footer>
  )
}

export function LoginPage() {
  return (
    <div className="login-page">
      <main className="login-main" id="conteudo">
        <div className="login-form">
          <Logo />
          <div className="login-heading">
            <h1>Entre na sua conta</h1>
            <p>Use seus dados de acesso para continuar.</p>
          </div>
          <LoginForm />
        </div>
      </main>
      <aside className="login-aside lumen lumen-sphere">
        <Logo />
        <div className="login-aside-body">
          <h2>Tecnologia que simplifica o trabalho.</h2>
          <p>
            Um único ambiente para empresas e colaboradores PJ organizarem
            contratos, documentos e pendências.
          </p>
          <ul>
            <li>
              <span>
                <Icon name="briefcase" size={18} />
              </span>
              <div>
                <strong>Portal da empresa</strong>
                <small>Contratos, colaboradores, documentos e pendências.</small>
              </div>
            </li>
            <li>
              <span>
                <Icon name="people" size={18} />
              </span>
              <div>
                <strong>Portal do colaborador</strong>
                <small>Contrato, notas fiscais, documentos e notificações.</small>
              </div>
            </li>
          </ul>
        </div>
        <small className="login-aside-foot">© 2026 Navelo</small>
      </aside>
    </div>
  )
}
