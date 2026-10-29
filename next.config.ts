import type { NextConfig } from "next";

// Hosts autorizados a disparar server actions (o próprio domínio já é permitido por padrão).
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

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
