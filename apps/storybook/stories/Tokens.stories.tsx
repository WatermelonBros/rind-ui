import type { Meta, StoryObj } from "@storybook/react-vite"

const colors = [
  "bg",
  "surface",
  "surface-raised",
  "border",
  "border-strong",
  "text",
  "text-muted",
  "accent",
  "accent-hover",
  "accent-text",
  "danger",
  "focus",
] as const

function Palette() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
        gap: "var(--rind-space-4)",
      }}
    >
      {colors.map((name) => (
        <figure key={name} style={{ margin: 0 }}>
          <div
            style={{
              height: 64,
              borderRadius: "var(--rind-radius-md)",
              border: "1px solid var(--rind-color-border)",
              background: `var(--rind-color-${name})`,
            }}
          />
          <figcaption
            style={{ fontFamily: "var(--rind-font-mono)", fontSize: "var(--rind-text-xs)" }}
          >
            --rind-color-{name}
          </figcaption>
        </figure>
      ))}
    </div>
  )
}

const meta = { title: "Theme/Tokens", component: Palette } satisfies Meta<typeof Palette>
export default meta

export const Colors: StoryObj<typeof meta> = {}
