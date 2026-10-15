import { describe, expect, it } from "vitest"
import { contrast, parseColor } from "./color"
import {
  checkTheme,
  crisp,
  defineTheme,
  ThemeContrastError,
  type ThemeInput,
  ThemeInputError,
} from "./index"

const input = (x: Record<string, unknown>) => x as unknown as ThemeInput
const fail = (fn: () => unknown): unknown => {
  try {
    fn()
  } catch (e) {
    return e
  }
  return undefined
}
const oklch = (s: string) => {
  const c = parseColor(s)
  if (!c) throw new Error(`unparsable ${s}`)
  return c
}

describe("typed input errors", () => {
  it("unknown key", () => {
    const e = fail(() => defineTheme(input({ name: "acme", acent: "#f60" })))
    expect(e).toBeInstanceOf(ThemeInputError)
    expect((e as ThemeInputError).key).toBe("acent")
  })

  it.each([3, 0.5, Number.NaN, "1"])("density %s names the key and range", (density) => {
    const e = fail(() => defineTheme(input({ name: "acme", density })))
    expect(e).toBeInstanceOf(ThemeInputError)
    expect((e as ThemeInputError).key).toBe("density")
    expect((e as ThemeInputError).message).toContain("0.75")
    expect((e as ThemeInputError).message).toContain("1.25")
  })

  it.each(["motion", "borderStrength"])("%s out of 0-1", (key) => {
    const e = fail(() => defineTheme(input({ name: "acme", [key]: 2 })))
    expect((e as ThemeInputError).key).toBe(key)
  })

  it("unknown override and unparsable colours", () => {
    const e = fail(() => defineTheme(input({ name: "acme", overrides: { accentTxt: "#000" } })))
    expect((e as ThemeInputError).key).toBe("overrides.accentTxt")
    const c = fail(() => defineTheme(input({ name: "acme", accent: "not-a-colour" })))
    expect((c as ThemeInputError).key).toBe("accent")
    const o = fail(() => defineTheme(input({ name: "acme", overrides: { bg: "nope" } })))
    expect((o as ThemeInputError).key).toBe("overrides.bg")
  })

  it("name, extends, lengths", () => {
    expect((fail(() => defineTheme(input({ name: "Acme" }))) as ThemeInputError).key).toBe("name")
    expect(
      (fail(() => defineTheme(input({ name: "acme", extends: "nope" }))) as ThemeInputError).key,
    ).toBe("extends")
    expect(
      (fail(() => defineTheme(input({ name: "a", fontSize: "14px" }))) as ThemeInputError).key,
    ).toBe("fontSize")
    expect(
      (fail(() => defineTheme(input({ name: "a", radius: "1;" }))) as ThemeInputError).key,
    ).toBe("radius")
  })

  it("font injection", () => {
    for (const key of ["fontSans", "fontMono"]) {
      const e = fail(() => defineTheme(input({ name: "acme", [key]: "x;}</style><script>" })))
      expect(e).toBeInstanceOf(ThemeInputError)
      expect((e as ThemeInputError).key).toBe(key)
    }
  })

  it("unsafe component override value", () => {
    const e = fail(() =>
      defineTheme(input({ name: "acme", components: { button: { solidBg: "red; } a {" } } })),
    )
    expect(e).toBeInstanceOf(ThemeInputError)
  })
})

describe("contrast validation", () => {
  const sky = { name: "acme", accent: "#0ea5e9", overrides: { accentText: "#0ea5e9" } } as const

  it("rejects #0ea5e9 accent-text with a passing same-hue suggestion", () => {
    const e = fail(() => defineTheme(sky))
    expect(e).toBeInstanceOf(ThemeContrastError)
    const pair = (e as ThemeContrastError).report.pairs.find(
      (p) => p.scheme === "light" && p.foreground === "accent-text" && p.background === "bg",
    )
    expect(pair?.pass).toBe(false)
    expect(pair?.required).toBe(4.5)
    expect(pair?.ratio).toBeGreaterThan(2.6)
    expect(pair?.ratio).toBeLessThan(3)
    expect(pair?.suggestion).toBeDefined()
    const suggested = oklch(pair?.suggestion ?? "")
    const bg = oklch(checkTheme(sky).pairs.length ? "oklch(0.995 0.0024 250)" : "")
    expect(contrast(suggested, bg)).toBeGreaterThanOrEqual(4.5)
    const hue = oklch("#0ea5e9").h
    expect(Math.abs(suggested.h - hue)).toBeLessThan(1)
    expect((e as Error).message).toContain("accent-text on bg")
  })

  it("checkTheme reports the same without throwing", () => {
    const r = checkTheme(sky)
    expect(r.ok).toBe(false)
    expect(r.pairs.some((p) => !p.pass && p.suggestion)).toBe(true)
    expect(checkTheme({ name: "calm" }).ok).toBe(true)
  })

  it("checkTheme never throws for contrast even on garish input", () => {
    expect(() =>
      checkTheme({ name: "x", accent: "#ffff00", warning: "#ffffff", danger: "#000" }),
    ).not.toThrow()
  })

  it("unreachable on-solid lists dark accent-on-solid with a solid suggestion", () => {
    // Mid-lightness solid where neither white nor black reaches 4.5 (dark scheme has no
    // special rule, so it fails in both schemes).
    const t = { name: "acme", accent: "oklch(0.575 0.12 250)" } as const
    const r = checkTheme(t)
    const p = r.pairs.find(
      (x) =>
        x.scheme === "dark" &&
        x.foreground === "accent-on-solid" &&
        x.background === "accent-solid",
    )
    expect(p, "pair listed").toBeDefined()
    expect(p?.pass).toBe(false)
    expect(p?.suggestion).toMatch(/^oklch\(/)
    const e = fail(() => defineTheme(t))
    expect(e).toBeInstanceOf(ThemeContrastError)
    expect((e as Error).message).toContain("dark: accent-on-solid on accent-solid")
  })

  it("warning #facc15 meets 4.5 on bg or is reported", () => {
    const r = checkTheme({ name: "acme", warning: "#facc15" })
    const p = r.pairs.filter((x) => x.foreground === "warning-text" && x.background === "bg")
    expect(p.length).toBe(2)
    for (const x of p) expect(x.pass || x.suggestion !== undefined).toBe(true)
    const adj = defineTheme({ name: "acme", warning: "#facc15", contrast: "adjust" })
    for (const x of adj.report.pairs.filter((q) => q.foreground === "warning-text")) {
      expect(x.pass).toBe(true)
    }
  })
})

describe("nearest passing shade", () => {
  it("suggestion sits just inside the passing bound, same hue, and passes", () => {
    const bg = oklch("oklch(0.995 0.0024 250)")
    const t = { name: "acme", accent: "#0ea5e9", overrides: { accentText: "#0ea5e9" } } as const
    const p = checkTheme(t).pairs.find(
      (x) => x.scheme === "light" && x.foreground === "accent-text" && x.background === "bg",
    )
    const s = oklch(p?.suggestion ?? "")
    expect(contrast(s, bg)).toBeGreaterThanOrEqual(4.5)
    // Find the bound by scanning lightness down at the same hue/chroma: the suggestion must be
    // within 0.01 L of the lightest passing value.
    let bound = s.l
    for (let l = s.l; l < 1; l += 0.001) {
      if (contrast({ ...s, l }, bg) >= 4.5) bound = l
      else break
    }
    expect(bound - s.l).toBeLessThan(0.01)
    expect(Math.abs(s.h - oklch("#0ea5e9").h)).toBeLessThan(1)
  })
})

describe("determinism and adjust mode", () => {
  it("byte-identical output", () => {
    const i = { name: "acme", accent: "#0a7d55", extends: "crisp", root: true } as const
    expect(defineTheme(i).css).toBe(defineTheme(i).css)
    expect(JSON.stringify(defineTheme(i).tokens)).toBe(JSON.stringify(defineTheme(i).tokens))
    expect(JSON.stringify(defineTheme(i).toDTCG())).toBe(JSON.stringify(defineTheme(i).toDTCG()))
  })

  it("adjust keeps accent-solid and reports from/to", () => {
    const t = defineTheme({
      name: "acme",
      accent: "#0ea5e9",
      warning: "#facc15",
      contrast: "adjust",
    })
    expect(t.report.ok).toBe(true)
    const accent = oklch("#0ea5e9")
    for (const s of ["light", "dark"] as const) {
      const solid = oklch(t.tokens.colors["accent-solid"][s])
      expect(Math.abs(solid.l - accent.l)).toBeLessThan(0.001)
    }
    expect(t.report.adjusted.some((a) => a.token === "accent-solid")).toBe(false)
  })

  // BUG (theme.ts build/validate.correct): `correct` skips locked (overridden) tokens, so adjust
  // mode cannot fix a failing override and defineTheme throws ThemeContrastError, while the
  // spec says adjust "SHALL apply every suggestion".
  it("adjust applies the suggestion to a failing semantic override", () => {
    const t = defineTheme({
      name: "acme",
      accent: "#0ea5e9",
      overrides: { accentText: "#0ea5e9" },
      contrast: "adjust",
    })
    expect(t.report.ok).toBe(true)
    expect(t.report.adjusted.some((a) => a.token === "accent-text")).toBe(true)
  })

  it("adjust moves the solid when on-solid cannot pass", () => {
    const t = defineTheme({ name: "acme", accent: "oklch(0.575 0.12 250)", contrast: "adjust" })
    expect(t.report.ok).toBe(true)
    const solid = t.report.adjusted.filter((a) => a.token === "accent-solid")
    expect(solid.length).toBeGreaterThan(0)
    for (const a of t.report.adjusted) {
      expect(a.from).toMatch(/^oklch\(/)
      expect(a.to).toMatch(/^oklch\(/)
      expect(a.to).not.toBe(a.from)
    }
  })
})

describe("extends", () => {
  it("crisp keeps radius, density and border strength", () => {
    const t = defineTheme({ name: "acme", extends: "crisp", accent: "#0a7d55" })
    expect(t.inputs.radius).toBe(crisp.radius)
    expect(t.inputs.density).toBe(crisp.density)
    expect(t.inputs.borderStrength).toBe(crisp.borderStrength)
    expect(t.css).toContain("--rind-brand-radius: 0.25rem;")
    expect(t.css).toContain("--rind-brand-density: 0.875;")
    expect(t.css).toContain("--rind-brand-border-strength: 0.6;")
  })

  it("extends another definition", () => {
    const base = defineTheme({ name: "base", extends: "crisp" })
    const t = defineTheme({ name: "child", extends: base })
    expect(t.inputs).toEqual(base.inputs)
  })
})

describe("output", () => {
  const t = defineTheme({ name: "acme", extends: "crisp" })
  const root = defineTheme({ name: "acme", root: true })

  it("one rind.themes layer, scoped with :where", () => {
    expect(t.css.match(/@layer /g)).toHaveLength(1)
    expect(t.css).toContain("@layer rind.themes {")
    expect(t.css).toContain(':where([data-rind-theme="acme"])')
    expect(t.css).not.toContain(":root")
    expect(root.css).toContain(':where(:root:not([data-rind-theme]), [data-rind-theme="acme"])')
  })

  it("has no imports, urls, relative colours or script hooks", () => {
    for (const css of [t.css, root.css]) {
      expect(css).not.toMatch(/@import/i)
      expect(css).not.toMatch(/url\(/i)
      expect(css).not.toMatch(/\bfrom /)
      expect(css).not.toMatch(/expression/i)
      expect(css).not.toMatch(/<|script/i)
    }
  })

  it("declares every brand input and every semantic colour", () => {
    for (const k of [
      "accent",
      "neutral",
      "danger",
      "warning",
      "success",
      "font-sans",
      "font-mono",
      "font-size",
      "radius",
      "density",
      "motion",
      "border-strength",
    ]) {
      expect(t.css).toContain(`--rind-brand-${k}:`)
    }
    for (const token of Object.keys(t.tokens.colors)) {
      // focus-color is the accent border, declared by the stylesheets, not the theme.
      if (token === "focus-color") continue
      expect(t.css, token).toContain(`--rind-color-${token}:`)
    }
  })

  it("colours are light-dark(oklch, oklch) or a single oklch", () => {
    const decls = [...t.css.matchAll(/--rind-color-([a-z-]+): ([^;]+);/g)]
    expect(decls.length).toBeGreaterThan(30)
    for (const [, name, value] of decls) {
      expect(value, name).toMatch(
        /^(?:light-dark\(oklch\([^()]+\), oklch\([^()]+\)\)|oklch\([^()]+\))$/,
      )
    }
  })

  it("tokens mirror the css values", () => {
    for (const [token, pair] of Object.entries(t.tokens.colors)) {
      if (token === "focus-color") continue
      const css = pair.light === pair.dark ? pair.light : `light-dark(${pair.light}, ${pair.dark})`
      expect(t.css).toContain(`--rind-color-${token}: ${css};`)
    }
  })

  it("component overrides are not checked for contrast and are listed as unchecked", () => {
    // ComponentTokens is empty until the manifest generator lands: cast through unknown.
    const withComponents = defineTheme(
      input({ name: "acme", components: { button: { solidBg: "#123456" } } }),
    )
    expect(withComponents.css).toContain("--rind-button-solid-bg: #123456;")
    expect(withComponents.report.unchecked).toEqual(["--rind-button-solid-bg"])
    expect(t.report.unchecked).toEqual([])
  })
})

describe("toDTCG", () => {
  const t = defineTheme({ name: "acme", extends: "crisp", accent: "#0a7d55" })
  const doc = t.toDTCG() as unknown as Record<string, Record<string, Record<string, unknown>>>

  // No official DTCG schema file in the repo: the structure is checked by hand.
  it("every leaf has $type and $value; groups have neither", () => {
    const walk = (node: unknown, path: string) => {
      const n = node as Record<string, unknown>
      if ("$value" in n) {
        expect(typeof n["$type"], path).toBe("string")
        return
      }
      expect(n["$type"], path).toBeUndefined()
      for (const [k, v] of Object.entries(n)) {
        expect(k.startsWith("$"), path).toBe(false)
        walk(v, `${path}.${k}`)
      }
    }
    walk(doc, "")
  })

  it("brand colours are oklch colour objects", () => {
    const accent = doc["brand"]?.["accent"]
    expect(accent?.["$type"]).toBe("color")
    const v = accent?.["$value"] as { colorSpace: string; components: number[] }
    expect(v.colorSpace).toBe("oklch")
    expect(v.components).toHaveLength(3)
    expect(v.components.every(Number.isFinite)).toBe(true)
    expect(doc["brand"]?.["fontSans"]?.["$type"]).toBe("fontFamily")
    expect(doc["brand"]?.["radius"]?.["$type"]).toBe("dimension")
  })

  it("unadjusted solids alias the brand palette", () => {
    for (const s of ["light", "dark"]) {
      expect(doc[s]?.["accent-solid"]?.["$value"]).toBe("{brand.accent}")
    }
    expect(doc["light"]?.["accent-text"]?.["$value"]).toHaveProperty("colorSpace", "oklch")
  })

  it("an adjusted solid does not alias", () => {
    const a = defineTheme({ name: "acme", accent: "oklch(0.575 0.12 250)", contrast: "adjust" })
    const d = a.toDTCG() as unknown as Record<string, Record<string, Record<string, unknown>>>
    expect(d["light"]?.["accent-solid"]?.["$value"]).toHaveProperty("colorSpace", "oklch")
  })
})

describe("on-solid by luminance, hover a step away from it", () => {
  const cases = [150, 250].flatMap((h) =>
    [0.55, 0.56, 0.57, 0.58, 0.59, 0.6, 0.61, 0.62].map((l) => `oklch(${l} 0.15 ${h})`),
  )

  it.each(cases)("%s: hover moves away from on-solid and keeps its contrast", (accent) => {
    const t = defineTheme({ name: "acme", accent, contrast: "adjust" })
    for (const s of ["light", "dark"] as const) {
      const c = (token: string) => oklch(t.tokens.colors[token as "accent-solid"][s])
      const [solid, hover, on] = [c("accent-solid"), c("accent-solid-hover"), c("accent-on-solid")]
      if (on.l > 0.9) expect(hover.l, `${s} white text`).toBeLessThan(solid.l)
      else expect(hover.l, `${s} dark text`).toBeGreaterThan(solid.l)
      if (contrast(on, solid) >= 4.5) {
        expect(contrast(on, hover), `${s} on-solid on hover`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it("a mid-lightness accent where luminance picks dark text does not hover towards it", () => {
    const picked = cases.filter((accent) => {
      const t = defineTheme({ name: "acme", accent, contrast: "adjust" })
      return oklch(t.tokens.colors["accent-on-solid"].light).l < 0.5
    })
    // Guards the loop above: it must exercise both branches.
    expect(picked.length).toBeGreaterThan(0)
    expect(picked.length).toBeLessThan(cases.length)
  })
})

describe("focus colour override", () => {
  const t = defineTheme({ name: "acme", overrides: { focusColor: "#ff00aa" } })

  it("is emitted in a rind.preferences block for the scope", () => {
    expect(t.css).toMatch(
      /@layer rind\.preferences \{\n {2}:where\(\[data-rind-theme="acme"\]\) \{\n {4}--rind-focus-color: [^;]+;/,
    )
  })

  it("is absent when focus follows the accent border", () => {
    expect(defineTheme({ name: "acme" }).css).not.toContain("rind.preferences")
  })
})
