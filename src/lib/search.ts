// "João Silva" -> "joao silva": a busca ignora acentos e maiúsculas
export const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()

// "joao silva" -> ["joao", "silva"]: cada termo precisa aparecer em algum campo
export const searchTerms = (query: string) => fold(query).split(/\s+/).filter(Boolean)
