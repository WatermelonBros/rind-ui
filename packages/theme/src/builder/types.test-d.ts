import { describe, expectTypeOf, it } from "vitest"
import { checkTheme, defineTheme, type ThemeDefinition, type ThemeInput } from "./index"

describe("theme builder input types", () => {
  it("returns a ThemeDefinition", () => {
    expectTypeOf(defineTheme({ name: "acme", accent: "#f60" })).toEqualTypeOf<ThemeDefinition>()
    expectTypeOf(checkTheme({ name: "acme" }).ok).toEqualTypeOf<boolean>()
  })

  it("an unknown input key is an error", () => {
    // @ts-expect-error `acent` is not an input
    defineTheme({ name: "acme", acent: "#f60" })
    // @ts-expect-error the same for the report
    checkTheme({ name: "acme", acent: "#f60" })
  })

  it("name must be lowercase", () => {
    defineTheme({ name: "acme" })
    // @ts-expect-error uppercase names fail the lowercase check
    defineTheme({ name: "Acme" })
  })

  it("extends takes a preset name or a definition", () => {
    defineTheme({ name: "acme", extends: "crisp" })
    defineTheme({ name: "acme", extends: "calm" })
    defineTheme({ name: "acme", extends: defineTheme({ name: "base" }) })
    // @ts-expect-error not a preset
    defineTheme({ name: "acme", extends: "nope" })
  })

  it("overrides are keyed by camel-case semantic tokens, as a value or { light, dark }", () => {
    defineTheme({
      name: "acme",
      overrides: { accentText: "#000", textMuted: { light: "#111", dark: "#eee" } },
    })
    // @ts-expect-error typo
    defineTheme({ name: "acme", overrides: { accentTxt: "#000" } })
    // @ts-expect-error a pair needs both schemes
    defineTheme({ name: "acme", overrides: { bg: { light: "#fff" } } })
    // @ts-expect-error colours are strings
    defineTheme({ name: "acme", overrides: { bg: 1 } })
  })

  it("brand inputs are typed", () => {
    // @ts-expect-error density is a number
    defineTheme({ name: "acme", density: "1" })
    // @ts-expect-error contrast is strict or adjust
    defineTheme({ name: "acme", contrast: "lenient" })
    defineTheme({ name: "acme", contrast: "adjust", root: true, density: 1.1 })
  })

  it("components with an unknown scope are an error (manifest is empty until generated)", () => {
    // @ts-expect-error no such component scope
    defineTheme({ name: "acme", components: { nonexistent: { solidBg: "red" } } })
    defineTheme({ name: "acme", components: {} })
  })

  it("ThemeInput requires a name", () => {
    expectTypeOf<ThemeInput["name"]>().toBeString()
    // @ts-expect-error name is required
    const bad: ThemeInput = { accent: "#f60" }
    void bad
  })
})
