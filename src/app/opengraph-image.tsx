import { ImageResponse } from "next/og"
import { SITE } from "@/lib/site"

export const alt = SITE.title
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

// Imagem de compartilhamento (WhatsApp, LinkedIn, Slack...): logo e frase sobre o fundo claro da marca.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 36,
          background: "linear-gradient(135deg, #f4f7ff 0%, #dfe7ff 55%, #c9bdfb 100%)",
          color: "#101722",
        }}
      >
        <svg width="640" height="142" viewBox="0 -16 270 60">
          <g fill="none" stroke="#385bff" strokeLinejoin="round" strokeWidth="9">
            <path d="M4.5 44V25a20.5 20.5 0 0 1 41 0V44" />
            <circle cx="76.5" cy="22" r="17.5" />
            <path d="M98.5 0V44" />
            <path d="M108 4.5 128.5 38.5 149 4.5" strokeLinecap="round" />
            <path d="M160 22H195A17.5 17.5 0 1 0 189.9 34.4" />
            <path d="M211 -11.5V39.5" strokeLinecap="round" />
            <ellipse cx="245" cy="22" rx="19.5" ry="17.5" />
          </g>
        </svg>
        <div style={{ display: "flex", fontSize: 44, fontWeight: 600, letterSpacing: -1, color: "#101722" }}>
          Seus colaboradores PJ, tudo em um só lugar.
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#44506a" }}>Contratos, documentos e notas fiscais</div>
      </div>
    ),
    size,
  )
}
