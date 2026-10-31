"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ConfigProvider } from "antd"
import ptBR from "antd/locale/pt_BR"
import { useState, type ReactNode } from "react"

export function Providers({ children }: { children: ReactNode }) {
  // um cliente por navegador; sobrevive às navegações entre páginas
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000, // dado "fresco" por 30 s: voltar a uma tela não refaz a consulta
            gcTime: 10 * 60_000, // fica na memória por 10 min depois de sair da tela
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={client}>
      {/* componentes do Ant Design com a cor e a fonte da marca */}
      <ConfigProvider
        locale={ptBR}
        theme={{
          token: { colorPrimary: "#385bff", colorText: "#101722", fontFamily: "var(--font-inter), system-ui, sans-serif", borderRadius: 8 },
          components: { Table: { headerBg: "#f8fafc", headerColor: "#64748b", cellPaddingBlock: 16 } },
        }}
      >
        {children}
      </ConfigProvider>
    </QueryClientProvider>
  )
}
