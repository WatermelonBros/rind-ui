// Focus ring contrast (WCAG 1.4.11, 3:1) and the theme's hidden-content rule, read from the CSS.
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

// Comments stripped: the checks are about rules, and comments may name what is avoided.
const css = (file: string) =>
  readFileSync(new URL(`./${file}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
const tokens = css("tokens.css")

/** [light, dark] of a `light-dark(#hex, #hex)` token, following `var()` aliases. */
function palette(name: string): [string, string] {
  const value = new RegExp(`--${name}:\\s*([^;]+);`).exec(tokens)?.[1]?.trim()
  if (!value) throw new Error(`no token --${name}`)
  const alias = /^var\(--([\w-]+)\)$/.exec(value)?.[1]
  if (alias) return palette(alias)
  const pair = /^light-dark\((#[0-9a-f]{6}),\s*(#[0-9a-f]{6})\)$/i.exec(value)
  if (!pair?.[1] || !pair[2]) throw new Error(`--${name} is not light-dark(#hex, #hex): ${value}`)
  return [pair[1], pair[2]]
}

const luminance = (hex: string) => {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

describe("theme accessibility", () => {
  it.each(["rind-color-bg", "rind-color-surface", "rind-color-surface-raised"])(
    "focus ring has 3:1 against %s in light and dark",
    (background) => {
      const [ringLight, ringDark] = palette("rind-focus-color")
      const [bgLight, bgDark] = palette(background)
      expect(contrast(ringLight, bgLight)).toBeGreaterThanOrEqual(3)
      expect(contrast(ringDark, bgDark)).toBeGreaterThanOrEqual(3)
    },
  )

  it("focus is an outline of at least 2px, never box-shadow alone", () => {
    expect(tokens).toMatch(/--rind-focus-width:\s*2px/)
    expect(css("base.css")).toMatch(/\[data-focus-visible\]\s*\{\s*outline:/)
    expect(css("base.css") + tokens).not.toMatch(/box-shadow/)
  })

  it("never overrides [hidden] (hidden=until-found must keep working)", () => {
    for (const file of ["tokens.css", "base.css", "index.css"]) {
      expect(css(file)).not.toMatch(/\[hidden/)
    }
  })

  it("zeroes every duration token under reduced motion", () => {
    const durations = [...tokens.matchAll(/(--rind-duration-[\w-]+):/g)].map((m) => m[1])
    const reduced = /prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/.exec(tokens)?.[1] ?? ""
    for (const d of new Set(durations)) expect(reduced).toMatch(new RegExp(`${d}:\\s*0m?s`))
  })

  it("overlay.css: no [hidden] rule, no box-shadow focus, scrollbar compensation, token durations", () => {
    const overlay = css("overlay.css")
    expect(css("index.css")).toContain("overlay.css")
    expect(overlay).not.toMatch(/\[hidden/)
    expect(overlay).not.toMatch(/box-shadow/)
    expect(overlay).toMatch(/var\(--rind-scrollbar-width/)
    expect(overlay).toMatch(/@starting-style/)
    const durations = [...overlay.matchAll(/\b\d+m?s\b/g)]
    expect(durations).toEqual([])
    expect(overlay).toMatch(/var\(--rind-duration-normal\)/)
  })
  it("positioner.css: z-index from the layer index, placing guard, available-size caps, forced-colors arrow", () => {
    const positioner = css("positioner.css")
    expect(css("index.css")).toContain("positioner.css")
    expect(positioner).not.toMatch(/\[hidden/)
    expect(positioner).not.toMatch(/box-shadow/)
    expect(positioner).toMatch(/z-index:\s*calc\(1000 \+ var\(--layer-index, 0\)\)/)
    expect(positioner).toMatch(/\[data-placing\]\s*\{[^}]*animation:\s*none !important/)
    expect(positioner).toMatch(/max-width:\s*var\(--rind-available-width\)/)
    expect(positioner).toMatch(/max-height:\s*var\(--rind-available-height\)/)
    expect(positioner).toMatch(/overflow:\s*auto/)
    expect(positioner).toMatch(/transform-origin:\s*var\(--rind-transform-origin\)/)
    expect(positioner).toMatch(/\[data-part="arrow"\][^{]*\{[^}]*currentcolor/)
    expect(positioner.match(/!important/g)).toHaveLength(2)
    expect([...positioner.matchAll(/\b\d+m?s\b/g)]).toEqual([])
  })
})
