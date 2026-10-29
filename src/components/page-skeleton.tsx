// Esqueleto mostrado na hora em que a pessoa troca de tela, enquanto a página busca os dados.
export function PageSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div aria-busy="true" aria-live="polite" className="skel-page">
      <span className="sr-only">Carregando…</span>
      <div className="skel skel-title" />
      <div className="skel skel-subtitle" />
      <div className="skel-grid">
        {Array.from({ length: cards }, (_, i) => (
          <div className="card skel-card" key={i}>
            <div className="skel skel-line short" />
            <div className="skel skel-line big" />
          </div>
        ))}
      </div>
      <div className="card skel-table">
        {Array.from({ length: 6 }, (_, i) => (
          <div className="skel skel-line" key={i} />
        ))}
      </div>
    </div>
  )
}
