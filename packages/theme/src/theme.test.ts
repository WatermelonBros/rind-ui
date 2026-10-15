/// <reference types="node" />
// Focus ring contrast (WCAG 1.4.11, 3:1) and the theme's hidden-content rule, read from the CSS.
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { calm, checkTheme, crisp } from "./builder"

// Comments stripped: the checks are about rules, and comments may name what is avoided.
const css = (file: string) =>
  readFileSync(new URL(`./${file}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
const tokens = css("tokens.css")

describe("theme accessibility", () => {
  // The focus colour is the accent border: the builder measures it against every ground.
  it.each(["calm", "crisp"] as const)(
    "focus ring has 3:1 against bg, surface and surface-raised (%s)",
    (name) => {
      const report = checkTheme({ name, ...(name === "calm" ? calm : crisp) })
      const focus = report.pairs.filter((p) => p.foreground === "focus-color")
      expect(focus.map((p) => `${p.scheme} ${p.background}`).sort()).toEqual([
        "dark bg",
        "dark surface",
        "dark surface-raised",
        "light bg",
        "light surface",
        "light surface-raised",
      ])
      for (const p of focus) expect(p.ratio).toBeGreaterThanOrEqual(3)
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
