import { connection } from "next/server"
import { ENV_TAG } from "@/lib/app-env"

/**
 * Tag fixa no topo de todas as telas fora de produção. Quem usa o site de teste precisa saber,
 * a qualquer momento, que aquilo não é o sistema de verdade: dado de teste, e-mails marcados e
 * nada indexado. Em produção não renderiza nada.
 */
export async function EnvTag() {
  // renderiza a cada requisição: o ambiente vem do servidor em execução, não congelado no build
  await connection()
  if (!ENV_TAG) return null
  return (
    <div aria-label={`Você está no ambiente: ${ENV_TAG}`} className="env-tag" role="status">
      {ENV_TAG}
    </div>
  )
}
