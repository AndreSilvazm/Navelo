import type { NextConfig } from "next";
import { allowedHosts } from "./src/lib/app-env";

// Hosts autorizados a disparar server actions (o próprio domínio já é permitido por padrão):
// em produção, navelo.com.br e www.navelo.com.br; em qualquer ambiente, o APP_URL e o ALLOWED_ORIGINS.
const allowedOrigins = allowedHosts();

const nextConfig: NextConfig = {
  // permite gerar um build de produção em outra pasta sem atrapalhar o `next dev`
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // não anunciar a tecnologia do servidor
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // envio dos documentos do colaborador: até 25 MB no total + overhead do multipart
      bodySizeLimit: "30mb",
      // proteção contra CSRF: o Next recusa ação cuja origem não seja a do próprio site
      ...(allowedOrigins.length > 0 ? { allowedOrigins } : {}),
    },
    proxyClientMaxBodySize: "30mb",
  },
};

export default nextConfig;
