import { queryOptions } from "@tanstack/react-query"

// O arquivo de um documento nunca muda para a mesma URL (a URL leva a versão do upload),
// então fica em cache sem expirar e é reaproveitado entre telas, abas e voltas ao documento.
export const documentFileQuery = (url: string) =>
  queryOptions({
    queryKey: ["document-file", url],
    queryFn: async () => {
      const res = await fetch(url)
      if (!res.ok) throw new Error("Falha ao carregar o documento")
      return res.blob()
    },
    staleTime: Infinity,
    gcTime: 30 * 60_000,
  })
