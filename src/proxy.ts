import { NextResponse, type NextRequest } from "next/server"

// Filtro otimista: só checa se existe cookie de sessão. A validação de verdade
// (sessão no banco, papel, empresa ativa) acontece nos layouts via requireSession().
export function proxy(request: NextRequest) {
  if (!request.cookies.has("navelo_session")) {
    return NextResponse.redirect(new URL("/login", request.url))
  }
}

export const config = {
  matcher: ["/app/:path*", "/portal/:path*"],
}
