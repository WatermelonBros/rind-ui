"use client"

import { QrCode } from "@rind-ui/react"
import { useState } from "react"
import type { States, Variants } from "./types"

export const states: States = { "qr-code": { ready: "Basic", downloading: "Download" } }

// Inline images: the site builds and runs without network.
const LOGO = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#16a34a"/><path d="M6 13l4 4 8-9" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>',
)}`

export function Basic() {
  return (
    <QrCode.Root defaultValue="https://rind.watermelon-studio.it">
      <QrCode.Frame>
        <QrCode.Pattern />
      </QrCode.Frame>
      <QrCode.ValueText />
    </QrCode.Root>
  )
}

export function WithLogo() {
  return (
    <div className="row">
      <QrCode.Root defaultValue="https://rind.watermelon-studio.it/docs" encoding={{ ecc: "H" }}>
        <QrCode.Frame aria-label="QR code with logo">
          <QrCode.Pattern />
        </QrCode.Frame>
        <QrCode.Overlay>
          {/* biome-ignore lint/performance/noImgElement: the overlay is drawn into the download; next/image adds nothing here */}
          <img alt="" src={LOGO} />
        </QrCode.Overlay>
        <QrCode.ValueText />
      </QrCode.Root>
      <QrCode.Root defaultValue="https://rind.watermelon-studio.it/docs" encoding={{ ecc: "H" }}>
        <QrCode.Frame aria-label="QR code with an inline SVG logo">
          <QrCode.Pattern />
        </QrCode.Frame>
        <QrCode.Overlay>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="12" fill="#2563eb" />
            <text x="12" y="16.5" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">
              r
            </text>
          </svg>
        </QrCode.Overlay>
      </QrCode.Root>
    </div>
  )
}

export function Sizes() {
  return (
    <div className="row">
      {(["6rem", "9rem", "12rem"] as const).map((size) => (
        <QrCode.Root
          key={size}
          defaultValue="https://rind.watermelon-studio.it"
          style={{ "--rind-qr-code-size": size } as React.CSSProperties}
        >
          <QrCode.Frame aria-label={`QR code, ${size}`}>
            <QrCode.Pattern />
          </QrCode.Frame>
        </QrCode.Root>
      ))}
    </div>
  )
}

export function Levels() {
  return (
    <div className="row">
      {(["L", "M", "Q", "H"] as const).map((ecc) => (
        <figure key={ecc} className="stack" style={{ margin: 0, justifyItems: "center" }}>
          <QrCode.Root defaultValue="https://rind.watermelon-studio.it" encoding={{ ecc }}>
            <QrCode.Frame aria-label={`QR code at level ${ecc}`}>
              <QrCode.Pattern />
            </QrCode.Frame>
          </QrCode.Root>
          <figcaption>Level {ecc}</figcaption>
        </figure>
      ))}
    </div>
  )
}

export function QuietZone() {
  return (
    <div className="row">
      {[4, 0].map((quietZone) => (
        <QrCode.Root key={quietZone} defaultValue="QUIET ZONE" encoding={{ quietZone }}>
          <QrCode.Frame aria-label={`QR code, quiet zone ${quietZone}`}>
            <QrCode.Pattern />
          </QrCode.Frame>
        </QrCode.Root>
      ))}
    </div>
  )
}

export function Download() {
  const [last, setLast] = useState("")
  return (
    <div className="stack">
      <QrCode.Root
        defaultValue="https://rind.watermelon-studio.it"
        onDownload={(d) => setLast(`${d.fileName} (overlay ${d.overlay})`)}
      >
        <QrCode.Frame>
          <QrCode.Pattern />
        </QrCode.Frame>
        <div className="row">
          <QrCode.DownloadTrigger fileName="rind.png">PNG</QrCode.DownloadTrigger>
          <QrCode.DownloadTrigger mimeType="image/svg+xml" fileName="rind.svg">
            SVG
          </QrCode.DownloadTrigger>
        </div>
      </QrCode.Root>
      <p className="note" aria-live="polite">
        {last === "" ? "Nothing downloaded yet." : `Saved ${last}.`}
      </p>
    </div>
  )
}

export function LiveValue() {
  const [value, setValue] = useState("Hello from rind")
  return (
    <div className="stack">
      <label className="stack">
        Text to encode
        <input value={value} onChange={(e) => setValue(e.currentTarget.value)} />
      </label>
      <QrCode.Root value={value} onValueChange={setValue}>
        <QrCode.Frame>
          <QrCode.Pattern />
        </QrCode.Frame>
        <QrCode.ValueText />
      </QrCode.Root>
    </div>
  )
}

export function EmptyAndInvalid() {
  return (
    <div className="row">
      <QrCode.Root defaultValue="">
        <QrCode.Frame>
          <QrCode.Pattern />
        </QrCode.Frame>
        <QrCode.DownloadTrigger>Download empty</QrCode.DownloadTrigger>
      </QrCode.Root>
      <QrCode.Root defaultValue={"x".repeat(3000)} encoding={{ ecc: "H" }}>
        <QrCode.Frame>
          <QrCode.Pattern />
        </QrCode.Frame>
        <QrCode.DownloadTrigger>Download too long</QrCode.DownloadTrigger>
      </QrCode.Root>
    </div>
  )
}

export function RightToLeft() {
  return (
    <div dir="rtl" className="row">
      <QrCode.Root defaultValue="https://rind.watermelon-studio.it">
        <QrCode.Frame aria-label="رمز QR">
          <QrCode.Pattern />
        </QrCode.Frame>
        <QrCode.ValueText />
      </QrCode.Root>
      <p>الرمز لا ينعكس أبداً.</p>
    </div>
  )
}

export const variants: Variants = {
  Basic: {
    title: "Basic",
    description: 'A named image ("QR code") with the value as its description.',
  },
  WithLogo: {
    title: "With a logo",
    description: "An overlay image or inline SVG over level H; the modules under it stay.",
  },
  Sizes: { title: "Sizes", description: "`--rind-qr-code-size` sizes the frame." },
  Levels: {
    title: "Error correction",
    description: "L, M (default), Q and H: higher levels recover more and are denser.",
  },
  QuietZone: {
    title: "Quiet zone",
    description: "Four light modules by default, inside the viewBox; `quietZone: 0` drops it.",
  },
  Download: {
    title: "Download",
    description: "PNG at whole pixels per module, or a self-contained SVG.",
  },
  LiveValue: { title: "Live value", description: "A controlled value from an input." },
  EmptyAndInvalid: {
    title: "Empty and too long",
    description: "No symbol: the frame keeps its size, is hidden, and the trigger is disabled.",
  },
  RightToLeft: { title: "Right to left", description: "The symbol is never mirrored." },
}
