import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // envio dos documentos do colaborador: até 25 MB no total + overhead do multipart
    serverActions: { bodySizeLimit: "30mb" },
    proxyClientMaxBodySize: "30mb",
  },
};

export default nextConfig;
