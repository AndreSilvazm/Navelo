"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
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

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
