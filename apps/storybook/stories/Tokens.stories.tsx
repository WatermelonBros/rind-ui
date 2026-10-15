import type { Meta, StoryObj } from "@storybook/react-vite"
import manifest from "../../../packages/theme/tokens.manifest.json"

const tier2: readonly string[] = manifest.tier2
const colors = tier2.filter((t) => t.startsWith("--rind-color-"))
const scale = (prefix: string) => tier2.filter((t) => t.startsWith(`--rind-${prefix}-`))

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
  gap: "var(--rind-space-4)",
} as const
const label = { fontFamily: "var(--rind-font-mono)", fontSize: "var(--rind-text-xs)" } as const

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

function Tokens() {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
        <Swatches scheme="light" />
        <Swatches scheme="dark" />
      </div>
      <Scales />
    </div>
  )
}

const meta = { title: "Theme/Tokens", component: Tokens } satisfies Meta<typeof Tokens>
export default meta

export const Colors: StoryObj<typeof meta> = {}

// Axe colour-contrast per brand × scheme (task 4.3): the addon runs each story once, so
// each combination is its own story that sets the globals.
const at = (brand: string, theme: "light" | "dark"): StoryObj<typeof meta> => ({
  globals: { brand, theme },
})
export const CalmLight: StoryObj<typeof meta> = at("calm", "light")
export const CalmDark: StoryObj<typeof meta> = at("calm", "dark")
export const CrispLight: StoryObj<typeof meta> = at("crisp", "light")
export const CrispDark: StoryObj<typeof meta> = at("crisp", "dark")
export const SampleYellowLight: StoryObj<typeof meta> = at("sample-yellow", "light")
export const SampleYellowDark: StoryObj<typeof meta> = at("sample-yellow", "dark")
export const SampleWhiteLight: StoryObj<typeof meta> = at("sample-white", "light")
export const SampleWhiteDark: StoryObj<typeof meta> = at("sample-white", "dark")
