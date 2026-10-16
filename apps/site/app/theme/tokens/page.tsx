import type { Metadata } from "next"
import manifest from "../../../../../packages/theme/tokens.manifest.json"

const tier2: readonly string[] = manifest.tier2
const colors = tier2.filter((t) => t.startsWith("--rind-color-"))
const scale = (prefix: string) => tier2.filter((t) => t.startsWith(`--rind-${prefix}-`))

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 190px), 1fr))",
  gap: "var(--rind-space-4)",
} as const
const label = {
  fontFamily: "var(--rind-font-mono)",
  fontSize: "var(--rind-text-xs)",
  overflowWrap: "anywhere",
} as const

function Swatches({ scheme }: { scheme: "light" | "dark" }) {
  return (
    <section
      data-theme={scheme}
      aria-label={`${scheme} colours`}
      style={{
        background: "var(--rind-color-bg)",
        color: "var(--rind-color-text)",
        padding: "var(--rind-space-4)",
      }}
    >
      <h2 style={{ fontSize: "var(--rind-text-md)" }}>{scheme}</h2>
      <div style={grid}>
        {colors.map((token) => (
          <figure key={token} style={{ margin: 0 }}>
            <div
              style={{
                height: 48,
                borderRadius: "var(--rind-radius-md)",
                border: "1px solid var(--rind-color-border-strong)",
                background: `var(${token})`,
              }}
            />
            <figcaption style={label}>{token}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}

function Scales() {
  return (
    <section style={{ marginBlockStart: "var(--rind-space-6)" }} aria-label="scales">
      <h2>Space, size, radius, text</h2>
      <ul style={{ ...label, listStyle: "none", padding: 0 }}>
        {scale("space").map((t) => (
          <li key={t}>
            <span
              style={{
                display: "inline-block",
                inlineSize: `var(${t})`,
                background: "var(--rind-color-accent-solid)",
                blockSize: 8,
              }}
            />{" "}
            {t}
          </li>
        ))}
        {scale("size").map((t) => (
          <li key={t}>
            <span
              style={{
                display: "inline-block",
                inlineSize: `var(${t})`,
                blockSize: `var(${t})`,
                border: "1px solid var(--rind-color-border-strong)",
              }}
            />{" "}
            {t}
          </li>
        ))}
        {scale("radius").map((t) => (
          <li key={t}>
            <span
              style={{
                display: "inline-block",
                inlineSize: 32,
                blockSize: 32,
                borderRadius: `var(${t})`,
                border: "2px solid var(--rind-color-border-strong)",
              }}
            />{" "}
            {t}
          </li>
        ))}
        {scale("text").map((t) => (
          <li key={t} style={{ fontSize: `var(${t})` }}>
            Aa {t}
          </li>
        ))}
      </ul>
    </section>
  )
}

export const metadata: Metadata = { title: "Theme tokens" }

export default function Tokens() {
  return (
    <div>
      <h1>Tokens</h1>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 22rem), 1fr))",
        }}
      >
        <Swatches scheme="light" />
        <Swatches scheme="dark" />
      </div>
      <Scales />
    </div>
  )
}
