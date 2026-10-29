import { NextResponse, type NextRequest } from "next/server"

const SESSION_COOKIE = "navelo_session"
const PROTECTED = ["/app", "/portal"]
const isDev = process.env.NODE_ENV !== "production"

// Hosts extras autorizados a chamar a aplicação (reverse proxy, túnel de desenvolvimento).
const EXTRA_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean)

function contentSecurityPolicy(nonce: string) {
  return [
    "default-src 'self'",
    // 'strict-dynamic': só os scripts com este nonce rodam, e o que eles carregarem herda a confiança.
    // 'wasm-unsafe-eval': o leitor de PDF (pdf.js) compila WebAssembly; isso não libera eval de JS.
    // Em desenvolvimento o webpack embrulha cada módulo em eval para gerar o sourcemap.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}`,
    // os componentes usam atributos style={{…}}, que contam como estilo embutido
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:", // pré-visualização de documentos usa blob:
    "font-src 'self' data:",
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`, // ws: é o recarregamento automático do dev
    "worker-src 'self' blob:", // leitor de PDF (pdf.js)
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ")
}

function securityHeaders(csp: string) {
  const headers: Record<string, string> = {
    "Content-Security-Policy": csp,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), interest-cohort=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    // nenhum outro site embute arquivos nossos (documentos, notas fiscais)
    "Cross-Origin-Resource-Policy": "same-origin",
  }
  // HSTS só faz sentido sob HTTPS; em desenvolvimento travaria o localhost em https
  if (!isDev) headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
  return headers
}

// Requisição de outro site para a nossa API. O cookie é SameSite=Lax, então o navegador já não o
// envia nesses casos; isto aqui é a segunda tranca.
function isForeignOrigin(request: NextRequest) {
  const origin = request.headers.get("origin")
  if (!origin) return false // mesma origem (o navegador não manda Origin em GET próprio)
  try {
    const host = new URL(origin).host
    const self = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
    return host !== self && !EXTRA_ORIGINS.includes(host)
  } catch {
    return true // Origin malformado
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const nonce = crypto.randomUUID().replaceAll("-", "")
  const csp = contentSecurityPolicy(nonce)
  const headers = securityHeaders(csp)
  const withHeaders = <T extends NextResponse>(response: T) => {
    for (const [key, value] of Object.entries(headers)) response.headers.set(key, value)
    return response
  }

  // CORS fechado: nada de outra origem conversa com a API, e não devolvemos cabeçalho que libere.
  if (isForeignOrigin(request)) {
    return withHeaders(new NextResponse("Origem não permitida", { status: 403 }) as NextResponse)
  }

  // Filtro otimista: só checa se existe cookie de sessão. A validação de verdade
  // (sessão no banco, papel, empresa ativa) acontece nos layouts via requireSession().
  if (PROTECTED.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) && !request.cookies.has(SESSION_COOKIE)) {
    return withHeaders(NextResponse.redirect(new URL("/login", request.url)))
  }

  // o nonce vai junto no pedido: o Next assina os próprios scripts com ele
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("Content-Security-Policy", csp)

  return withHeaders(NextResponse.next({ request: { headers: requestHeaders } }))
}

// Atenção: toda página precisa ser renderizada sob demanda para receber o nonce desta requisição.
// Página gerada no build guarda um nonce velho e o navegador bloqueia os scripts dela.
export const config = {
  // todas as rotas, menos os arquivos estáticos já servidos com os próprios cabeçalhos
  matcher: [{ source: "/((?!_next/static|_next/image|favicon.ico).*)" }],
}
