"use client"

import { useEffect } from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { ScrollToPlugin } from "gsap/ScrollToPlugin"

// altura do cabeçalho fixo da landing (as seções "encaixam" logo abaixo dele)
const HEADER = 72

// Movimento da landing com GSAP: entrada do hero, prévia que sobe com o scroll, revelação das
// seções e rolagem automática (encaixe) ao passar de uma seção para outra.
// O texto/estrutura vêm do servidor; aqui só se anima o que já está na página.
export function LandingMotion() {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger, ScrollToPlugin)
    const root = document.documentElement
    const previousBehavior = root.style.scrollBehavior
    // o scroll suave do CSS briga com as animações de rolagem do GSAP
    root.style.scrollBehavior = "auto"

    const mm = gsap.matchMedia()

    // quem prefere menos movimento vê tudo parado, sem encaixe
    mm.add("(prefers-reduced-motion: reduce)", () => {
      gsap.set(".hero-copy > *, .hero-stage", { opacity: 1 })
    })

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      // ---- entrada do hero
      const intro = gsap.timeline({ defaults: { ease: "power3.out" } })
      intro
        .fromTo(".hero-copy > *", { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.09 })
        .fromTo(
          ".hero-stage",
          { autoAlpha: 0, y: 90, scale: 0.94, rotateX: 8, transformPerspective: 1200, transformOrigin: "50% 100%" },
          { autoAlpha: 1, y: 0, scale: 1, rotateX: 0, duration: 1.2 },
          "-=0.55",
        )

      // números da prévia contam até o valor e as barras enchem
      gsap.utils.toArray<HTMLElement>(".pf-metrics strong").forEach((el) => {
        // guarda o valor real: o efeito roda duas vezes em desenvolvimento e o texto já estaria zerado
        el.dataset.target ??= el.textContent ?? "0"
        const target = parseInt(el.dataset.target, 10)
        if (Number.isNaN(target)) return
        const counter = { value: 0 }
        el.textContent = "0"
        intro.to(counter, { value: target, duration: 1.2, ease: "power2.out", onUpdate: () => void (el.textContent = String(Math.round(counter.value))) }, "-=0.9")
      })
      gsap.utils.toArray<HTMLElement>(".pf-bar i").forEach((bar) => {
        const width = bar.style.width
        intro.fromTo(bar, { width: "0%" }, { width, duration: 1.1, ease: "power2.out" }, "-=1.0")
      })

      // conforme rola, a prévia sobe e o texto some devagar
      gsap.to(".hero-stage", {
        yPercent: -14,
        ease: "none",
        scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
      })
      gsap.to(".hero-copy", {
        y: -70,
        opacity: 0.15,
        ease: "none",
        scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
      })

      // ---- revelação das seções
      const reveals = gsap.utils.toArray<HTMLElement>(
        ".section-intro > *, .feature-list li, .duo-copy > *, .benefit-list li, .preview-card, .phone-preview, .cta-inner > *",
      )
      gsap.set(reveals, { autoAlpha: 0, y: 36 })
      ScrollTrigger.batch(reveals, {
        start: "top 88%",
        once: true,
        onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.85, stagger: 0.09, ease: "power3.out", overwrite: true }),
      })

      // ---- links de âncora (Produto, Para empresas...) rolam com a mesma animação
      const onClick = (event: MouseEvent) => {
        const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="/#"], a[href^="#"]')
        if (!link || event.metaKey || event.ctrlKey || event.shiftKey) return
        const id = link.getAttribute("href")!.replace(/^\/?#/, "")
        const target = id ? document.getElementById(id) : null
        if (!target) return
        event.preventDefault() // o Link do Next respeita e não navega
        gsap.to(window, { scrollTo: { y: target, offsetY: HEADER, autoKill: true }, duration: 1.1, ease: "power3.inOut", overwrite: true })
        history.replaceState(null, "", `/#${id}`)
      }
      document.addEventListener("click", onClick, true)
      return () => document.removeEventListener("click", onClick, true)
    })

    // ---- rolagem automática entre seções (só em tela grande, com mouse e sem "menos movimento")
    mm.add("(prefers-reduced-motion: no-preference) and (min-width: 900px) and (hover: hover)", () => {
        const sections = [".hero", "#produto", "#empresas", "#colaboradores", ".cta"]
          .map((selector) => document.querySelector<HTMLElement>(selector))
          .filter((el): el is HTMLElement => !!el)

        const tops = () => sections.map((el, i) => (i === 0 ? 0 : el.getBoundingClientRect().top + window.scrollY - HEADER))

        const snap = ScrollTrigger.create({
          start: 0,
          end: "max",
          snap: {
            // encaixa no início da seção mais próxima, mas só quando a pessoa parou perto dele:
            // no meio de uma seção longa a rolagem fica livre
            snapTo: (progress) => {
              const max = ScrollTrigger.maxScroll(window)
              const position = progress * max
              if (position >= max - 4) return progress // fim da página (rodapé)
              const nearest = tops().reduce((best, top) => (Math.abs(top - position) < Math.abs(best - position) ? top : best))
              return Math.abs(nearest - position) < window.innerHeight * 0.4 ? nearest / max : progress
            },
            duration: { min: 0.3, max: 0.9 },
            delay: 0.12,
            ease: "power2.inOut",
          },
        })
        return () => snap.kill()
    })

    const refresh = () => ScrollTrigger.refresh()
    window.addEventListener("load", refresh)

    return () => {
      window.removeEventListener("load", refresh)
      mm.revert()
      root.style.scrollBehavior = previousBehavior
    }
  }, [])

  return null
}
