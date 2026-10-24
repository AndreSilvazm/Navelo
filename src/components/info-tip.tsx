import { useId } from "react"

// Ícone de informação (ⓘ) com explicação que aparece ao passar o mouse ou focar com o teclado.
// Padrão da plataforma para textos de apoio: em vez de deixar o texto solto no formulário,
// ele fica ao lado do título do campo. Funciona só com CSS.
export function InfoTip({ text }: { text: string }) {
  const id = useId()

  return (
    <span aria-describedby={id} aria-label="Mais informações" className="info-tip" role="img" tabIndex={0}>
      <svg aria-hidden="true" height="16" viewBox="0 0 24 24" width="16">
        <circle cx="12" cy="12" r="9.5" />
        <path d="M12 11v5.5M12 7.6v.1" />
      </svg>
      <span className="info-tip-bubble" id={id} role="tooltip">
        {text}
      </span>
    </span>
  )
}
