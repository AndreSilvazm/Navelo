import type { Metadata } from "next"
import { LoginPage } from "@/figma/site"

// A CSP leva um nonce novo a cada requisição (ver src/proxy.ts). Uma página gerada no build
// congelaria o nonce no HTML e teria os próprios scripts bloqueados — por isso, renderização sob demanda.
export const dynamic = "force-dynamic"

export const metadata: Metadata = { title: "Entrar", robots: { index: false, follow: false } }

export default LoginPage
