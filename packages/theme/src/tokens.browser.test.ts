// add-theme-system 1.5 (design-tokens scenarios) in real browsers. Reduced motion and more
// contrast need media emulation, which Vitest's browser API lacks: they are in
// fixtures/media/media.pw.test.ts.
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { cleanup, indexCss, inject, lengthOf, mount, paint, q, resolve, rgba } from "./test-css"

beforeEach(() => {
  inject(indexCss)
})
afterEach(cleanup)

const accentTokens = [
  "--rind-color-accent-solid",
  "--rind-color-accent-solid-hover",
  "--rind-color-accent-soft",
  "--rind-color-accent-text",
  "--rind-color-accent-border",
  "--rind-focus-color",
]
const paints = (el: Element, tokens = accentTokens) => tokens.map((t) => paint(el, t))

describe("Brand Inputs", () => {
  it("One input re-skins everything", () => {
    const host = mount(`
      <div id="outside" data-rind-theme="x" data-theme="light"></div>
      <div id="inside" data-rind-theme="green" data-theme="light"></div>`)
    const outside = q(host, "#outside")
    const inside = q(host, "#inside")
    const before = paints(outside)
    inject(`[data-rind-theme="green"] { --rind-brand-accent: #0a7d55 }`)
    const after = paints(inside)
    // Every accent role (and the focus ring, which is the accent border) changes inside...
    const baseline = paints(q(mount(`<div data-rind-theme="y" data-theme="light"></div>`), "div"))
    for (const [i, token] of accentTokens.entries()) {
      expect(after[i], token).not.toBe(baseline[i])
    }
    const [r, g, b] = rgba(inside, "--rind-color-accent-solid")
    expect(g).toBeGreaterThan(r)
    expect(g).toBeGreaterThan(b)
    // ...and nothing outside the scope does.
    expect(paints(outside)).toEqual(before)
  })

  it("Neutral lightness is ignored", () => {
    const host = mount(`
      <div id="dark" data-rind-theme="n1" data-theme="light"></div>
      <div id="light" data-rind-theme="n2" data-theme="light"></div>`)
    inject(`
      [data-rind-theme="n1"] { --rind-brand-neutral: oklch(0.2 0.02 250) }
      [data-rind-theme="n2"] { --rind-brand-neutral: oklch(0.9 0.02 250) }`)
    const names = [
      "bg",
      "surface",
      "surface-raised",
      "text",
      "text-muted",
      "text-disabled",
      "border",
      "border-strong",
      "neutral-soft",
    ].map((n) => `--rind-color-${n}`)
    for (const dark of [false, true]) {
      for (const el of host.children) el.setAttribute("data-theme", dark ? "dark" : "light")
      // The neutral *palette* roles solid / solid-hover / on-solid / text / border are derived
      // from the input's lightness (`min(l, 0.5)`, `max(l, 0.78)`...), so they are not part of
      // "surfaces and text" here; see the report.
      for (const token of names) {
        expect(paint(q(host, "#dark"), token), `${token} ${dark ? "dark" : "light"}`).toBe(
          paint(q(host, "#light"), token),
        )
      }
    }
  })
})

describe("Colour Palettes And Role Tokens", () => {
  it("Soft background is opaque (shadcn-ui#10431)", () => {
    const host = mount(`<div data-rind-theme="live"></div>`)
    const scope = q(host, "div")
    for (const theme of ["light", "dark"]) {
      scope.setAttribute("data-theme", theme)
      for (const palette of ["accent", "neutral", "danger", "warning", "success"]) {
        for (const role of ["soft", "soft-hover"]) {
          const [, , , alpha] = rgba(scope, `--rind-color-${palette}-${role}`)
          expect(alpha, `${palette}-${role} ${theme}`).toBe(255)
        }
      }
    }
    // The built root (calm literals) is opaque as well.
    const [, , , a] = rgba(document.documentElement, "--rind-color-danger-soft")
    expect(a).toBe(255)
  })

  it("Soft background stays opaque for a translucent brand input", () => {
    // Relative colour syntax keeps the origin's alpha: `oklch(from <input> L C H)` of a
    // translucent input is translucent unless the derivation resets alpha to 1.
    const host = mount(`<div data-rind-theme="live" data-theme="light"></div>`)
    inject(`[data-rind-theme="live"] { --rind-brand-danger: oklch(0.55 0.2 27 / 0.3) }`)
    const scope = q(host, "div")
    for (const role of ["soft", "soft-hover"]) {
      expect(rgba(scope, `--rind-color-danger-${role}`)[3], role).toBe(255)
    }
  })

  it("Yellow brand keeps its colour", () => {
    const host = mount(`<div data-rind-theme="yellow" data-theme="light"></div>`)
    inject(`[data-rind-theme="yellow"] { --rind-brand-accent: oklch(0.86 0.17 95) }`)
    const el = q(host, "div")
    expect(paint(el, "--rind-color-accent-solid")).toBe(resolve(el, "color", "--rind-brand-accent"))
    const [r, g, b] = rgba(el, "--rind-color-accent-on-solid")
    expect(Math.max(r, g, b)).toBeLessThan(70) // near-black
    const [tr, tg, tb] = rgba(el, "--rind-color-accent-text")
    const [sr, sg] = rgba(el, "--rind-color-accent-solid")
    expect(tr).toBeLessThan(sr) // darker yellow-brown
    expect(tg).toBeLessThan(sg)
    expect(tr).toBeGreaterThan(tb)
  })
})

describe("Derivation In CSS", () => {
  it("Input changed at runtime", () => {
    const host = mount(`<div data-rind-theme="live" data-theme="light"></div>`)
    const sheet = inject(`[data-rind-theme="live"] { --rind-brand-accent: oklch(0.52 0.19 268) }`)
    const el = q(host, "div")
    const before = paints(el)
    const rule = sheet.cssRules[0] as CSSStyleRule
    rule.style.setProperty("--rind-brand-accent", "oklch(0.55 0.15 150)")
    const after = paints(el)
    expect(after[0]).not.toBe(before[0]) // solid
    expect(after[3]).not.toBe(before[3]) // text
    expect(after[5]).not.toBe(before[5]) // focus
  })

  it("Override on a nested element is not frozen", () => {
    const host = mount(`
      <div id="root-probe" data-theme="light">
        <div id="nested" data-rind-theme="nested" data-theme="light"></div>
      </div>`)
    inject(`[data-rind-theme="nested"] { --rind-brand-accent: oklch(0.55 0.15 150) }`)
    const nested = q(host, "#nested")
    const root = q(host, "#root-probe")
    expect(paint(nested, "--rind-color-accent-text")).not.toBe(
      paint(root, "--rind-color-accent-text"),
    )
    const [r, g, b] = rgba(nested, "--rind-color-accent-text")
    expect(g).toBeGreaterThan(b) // green, not the root's indigo
    expect(g).toBeGreaterThan(r)
  })
})

describe("Scales From Inputs", () => {
  it("Compact density keeps target size", () => {
    const host = mount(`<div data-rind-theme="compact"></div>`)
    inject(`[data-rind-theme="compact"] { --rind-brand-density: 0.75 }`)
    const el = q(host, "div")
    for (const size of ["sm", "md", "lg"]) {
      expect(lengthOf(el, `--rind-size-${size}`, "min-height"), size).toBeGreaterThanOrEqual(24)
    }
    expect(lengthOf(el, "--rind-size-sm", "min-height")).toBe(24)
    // Spacing does follow the density.
    expect(lengthOf(el, "--rind-space-4")).toBe(12)
  })

  it("Browser text size is respected (radix-ui/themes#121)", () => {
    // Emulated: the browser's default-font-size setting is the root element's initial
    // font-size, so a 20 px default is html { font-size: 125% } of the 16 px base.
    const host = mount(`<div data-rind-theme="live"></div>`)
    const el = q(host, "div")
    const sizes = ["xs", "sm", "md", "lg"].map((s) => `--rind-text-${s}`)
    const at16 = sizes.map((t) => lengthOf(el, t, "font-size"))
    document.documentElement.style.fontSize = "125%"
    const at20 = sizes.map((t) => lengthOf(el, t, "font-size"))
    for (const [i, t] of sizes.entries()) {
      expect((at20[i] ?? 0) / (at16[i] ?? 1), t).toBeCloseTo(1.25, 3)
    }
  })

  it.each(["0", "0px"])("Radius zero (--rind-brand-radius: %s)", (zero) => {
    const host = mount(`<div data-rind-theme="sharp"></div>`)
    inject(`[data-rind-theme="sharp"] { --rind-brand-radius: ${zero} }`)
    const el = q(host, "div")
    for (const r of ["sm", "md", "lg", "control", "panel", "indicator"]) {
      expect(resolve(el, "border-top-left-radius", `--rind-radius-${r}`), r).toBe("0px")
    }
    expect(lengthOf(el, "--rind-radius-full", "border-top-left-radius")).toBe(9999)
  })
})

describe("Cascade Layer", () => {
  const button = `<button data-scope="button" data-part="root" data-variant="solid" class="brand-btn">x</button>`
  const themed = `@layer rind.components {
    [data-scope="button"][data-part="root"][data-variant="solid"] { background-color: rgb(1, 2, 3) }
  }`

  it("Utility class wins (radix-ui/themes#109)", () => {
    inject(themed)
    inject(`.brand-btn { background-color: rgb(255, 105, 180) }`)
    const el = q(mount(button), "button")
    expect(getComputedStyle(el).backgroundColor).toBe("rgb(255, 105, 180)")
  })

  it("the layered rule applies without the class (the test above proves the layer, not a typo)", () => {
    inject(themed)
    const el = q(mount(button), "button")
    expect(getComputedStyle(el).backgroundColor).toBe("rgb(1, 2, 3)")
  })

  it("Consumer layer order", () => {
    cleanup()
    // Declared before the theme is imported: reset < rind < utilities, rind's sublayers inside.
    inject(`@layer reset, rind, utilities;`)
    inject(indexCss.replaceAll(/@layer rind\.(\w+) \{/g, "@layer rind.$1 {"))
    inject(`@layer reset { [data-rind-theme] { color: rgb(255, 0, 0); font-size: 11px } }`)
    inject(`@layer utilities { :where([data-rind-theme]) { color: rgb(0, 255, 0) } }`)
    const el = q(mount(`<div data-rind-theme="live" data-theme="light">x</div>`), "div")
    // utilities beat rind even at lower specificity...
    expect(getComputedStyle(el).color).toBe("rgb(0, 255, 0)")
    // ...and rind beats reset even at higher specificity (base.css sets the font size).
    expect(getComputedStyle(el).fontSize).not.toBe("11px")
  })
})
