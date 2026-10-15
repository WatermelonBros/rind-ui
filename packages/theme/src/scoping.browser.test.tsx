// add-theme-system 2.4, 6.3 and 7.1 (theme-scoping, theme-presets) in real browsers.
import { render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { userEvent } from "vitest/browser"
import { Pop } from "../../testing/fixtures/anchored/anchored.harness"
import manifest from "../tokens.manifest.json"
import { defineTheme } from "./builder"
import {
  cleanup,
  files,
  indexCss,
  indexCssWith,
  inject,
  lengthOf,
  literal,
  mount,
  paint,
  q,
  ratio,
  resolve,
  rgba,
  withoutDerivation,
} from "./test-css"

afterEach(cleanup)

const calmLight = {
  bg: "oklch(0.968 0.006 250)",
  accent: "oklch(0.67 0.165 42)",
}
const calmDarkBg = "oklch(0.185 0.006 250)"

describe("Default Theme Without Attributes", () => {
  beforeEach(() => {
    inject(indexCss)
  })

  it("Plain import", () => {
    const probe = q(mount(`<button data-scope="button" data-part="root">x</button>`), "button")
    document.documentElement.style.colorScheme = "light" // the OS scheme, pinned for the check
    expect(paint(probe, "--rind-color-accent-solid")).toBe(literal(calmLight.accent))
    expect(paint(probe, "--rind-color-bg")).toBe(literal(calmLight.bg))
    expect(getComputedStyle(document.documentElement).colorScheme).toBe("light")
  })

  it("Plain import follows the OS colour scheme (light dark on :root)", () => {
    expect(getComputedStyle(document.documentElement).colorScheme).toBe("light dark")
  })
})

describe("Derivation fallback", () => {
  it("Browser without relative colour syntax keeps calm", () => {
    // Simulated: the stylesheet without the @supports derivation rules, which is what an
    // engine failing the query uses.
    inject(indexCssWith(withoutDerivation(files.tokens)))
    const host = mount(`
      <div id="reference" data-theme="light"></div>
      <div id="live" data-rind-theme="live" data-theme="light"></div>`)
    inject(`[data-rind-theme="live"] { --rind-brand-accent: oklch(0.55 0.15 150) }`)
    const live = q(host, "#live")
    const reference = q(host, "#reference")
    for (const palette of ["accent", "neutral", "danger", "warning", "success"]) {
      for (const role of [
        "solid",
        "solid-hover",
        "on-solid",
        "soft",
        "soft-hover",
        "text",
        "border",
      ]) {
        const token = `--rind-color-${palette}-${role}`
        expect(paint(live, token), token).toBe(paint(reference, token))
        expect(rgba(live, token)[3], `${token} is a real colour`).toBeGreaterThan(0)
      }
    }
    for (const token of ["bg", "surface", "text", "text-muted", "border"]) {
      expect(paint(live, `--rind-color-${token}`)).toBe(paint(reference, `--rind-color-${token}`))
    }
    expect(paint(live, "--rind-color-accent-solid")).toBe(literal(calmLight.accent))
  })
})

describe("Light And Dark Are Orthogonal", () => {
  beforeEach(() => {
    inject(indexCss)
  })

  it("App's own dark class (radix-ui/themes#280)", () => {
    inject(`.dark { color-scheme: dark }`)
    const probe = q(mount(`<div></div>`), "div")
    document.documentElement.style.colorScheme = ""
    document.documentElement.classList.remove("dark")
    document.documentElement.setAttribute("data-theme", "light")
    document.documentElement.removeAttribute("data-theme")
    document.documentElement.style.colorScheme = "light"
    const light = paint(probe, "--rind-color-bg")
    document.documentElement.style.colorScheme = ""
    document.documentElement.classList.add("dark")
    expect(paint(probe, "--rind-color-bg")).toBe(literal(calmDarkBg))
    expect(paint(probe, "--rind-color-bg")).not.toBe(light)
    expect(paint(probe, "--rind-color-text")).toBe(literal("oklch(0.93 0.006 250)"))
  })

  it("Dark island in a light page (radix-ui/themes#418)", () => {
    document.documentElement.setAttribute("data-theme", "light")
    const host = mount(`
      <div id="page"></div>
      <div id="island" data-theme="dark"><a href="#x">link</a><span data-badge>badge</span></div>`)
    const island = q(host, "#island")
    expect(paint(island, "--rind-color-bg")).toBe(literal(calmDarkBg))
    expect(paint(q(host, "#page"), "--rind-color-bg")).toBe(literal(calmLight.bg))
    // The link (accent text) and a badge (accent text on soft) meet their contrast pairs
    // against the dark surface.
    const surface = rgba(island, "--rind-color-surface")
    expect(ratio(rgba(island, "--rind-color-accent-text"), surface)).toBeGreaterThanOrEqual(4.5)
    expect(
      ratio(rgba(island, "--rind-color-accent-text"), rgba(island, "--rind-color-accent-soft")),
    ).toBeGreaterThanOrEqual(4.5)
    expect(ratio(rgba(island, "--rind-color-text"), surface)).toBeGreaterThanOrEqual(4.5)
  })

  it("Tenant and scheme combine", () => {
    const acme = defineTheme({ name: "acme", accent: "#0a7d55", radius: "1rem" })
    inject(acme.css)
    const host = mount(`<div id="t" data-rind-theme="acme" data-theme="light"></div>`)
    const t = q(host, "#t")
    const light = paint(t, "--rind-color-bg")
    t.setAttribute("data-theme", "dark")
    expect(paint(t, "--rind-color-bg")).not.toBe(light)
    // acme's dark pair, not calm's: the built literal for its dark text on bg.
    const dark = acme.tokens.colors["accent-text"].dark
    expect(paint(t, "--rind-color-accent-text")).toBe(literal(dark))
  })
})

describe("Named Scopes (presets and builder output)", () => {
  const crispCss = files.crisp
  beforeEach(() => {
    inject(indexCss)
    inject(crispCss)
  })

  it("Switching preset by attribute", () => {
    const el = q(mount(`<div data-rind-theme="calm" data-theme="light"></div>`), "div")
    const snapshot = () => ({
      radius: lengthOf(el, "--rind-radius-control", "border-top-left-radius"),
      space: lengthOf(el, "--rind-space-4"),
      size: lengthOf(el, "--rind-size-md", "min-height"),
      border: paint(el, "--rind-color-border"),
      accent: paint(el, "--rind-color-accent-solid"),
    })
    const calm = snapshot()
    el.setAttribute("data-rind-theme", "crisp")
    const crisp = snapshot()
    expect(calm).toMatchObject({ radius: 6, space: 16 })
    expect(crisp).toMatchObject({ radius: 4, space: 14 })
    expect(crisp.size).toBeLessThan(calm.size)
    expect(crisp.border).not.toBe(calm.border)
    expect(crisp.accent).not.toBe(calm.accent)
  })

  it("Extending a preset keeps its radius, density and borders", () => {
    inject(defineTheme({ name: "acme", extends: "crisp", accent: "#0a7d55" }).css)
    const host = mount(`
      <div id="crisp" data-rind-theme="crisp" data-theme="light"></div>
      <div id="acme" data-rind-theme="acme" data-theme="light"></div>`)
    const acme = q(host, "#acme")
    const crisp = q(host, "#crisp")
    expect(lengthOf(acme, "--rind-radius-control", "border-top-left-radius")).toBe(4)
    expect(lengthOf(acme, "--rind-space-4")).toBe(lengthOf(crisp, "--rind-space-4"))
    expect(paint(acme, "--rind-color-border")).toBe(paint(crisp, "--rind-color-border"))
    expect(resolve(acme, "transition-duration", "--rind-duration-normal")).toBe(
      resolve(crisp, "transition-duration", "--rind-duration-normal"),
    )
    expect(paint(acme, "--rind-color-accent-solid")).not.toBe(
      paint(crisp, "--rind-color-accent-solid"),
    )
  })

  it("Two tenants side by side", () => {
    inject(defineTheme({ name: "acme", accent: "#0a7d55", radius: "1rem", density: 1.25 }).css)
    inject(
      defineTheme({ name: "globex", accent: "#c2410c", radius: "0.125rem", density: 0.75 }).css,
    )
    const host = mount(`
      <div id="a" data-rind-theme="acme" data-theme="light"></div>
      <div id="g" data-rind-theme="globex" data-theme="light"></div>`)
    const a = q(host, "#a")
    const g = q(host, "#g")
    expect(lengthOf(a, "--rind-radius-control", "border-top-left-radius")).toBe(16)
    expect(lengthOf(g, "--rind-radius-control", "border-top-left-radius")).toBe(2)
    expect(lengthOf(a, "--rind-space-4")).toBe(20)
    expect(lengthOf(g, "--rind-space-4")).toBe(12)
    const [ar, ag] = rgba(a, "--rind-color-accent-solid")
    const [gr, gg] = rgba(g, "--rind-color-accent-solid")
    expect(ag).toBeGreaterThan(ar) // green
    expect(gr).toBeGreaterThan(gg) // orange
  })

  it("Nested built theme does not inherit outer inputs", () => {
    inject(
      defineTheme({
        name: "acme",
        accent: "#0a7d55",
        radius: "1rem",
        density: 1.25,
        fontSize: "1.25rem",
      }).css,
    )
    const host = mount(`
      <div id="outer" data-rind-theme="acme" data-theme="light">
        <div id="inner" data-rind-theme="crisp"></div>
      </div>
      <div id="alone" data-rind-theme="crisp" data-theme="light"></div>`)
    const inner = q(host, "#inner")
    const alone = q(host, "#alone")
    expect(lengthOf(inner, "--rind-radius-control", "border-top-left-radius")).toBe(4)
    for (const t of ["--rind-space-4", "--rind-text-sm", "--rind-size-md"]) {
      expect(lengthOf(inner, t, t.includes("text") ? "font-size" : "width"), t).toBe(
        lengthOf(alone, t, t.includes("text") ? "font-size" : "width"),
      )
    }
    expect(paint(inner, "--rind-color-accent-solid")).toBe(
      paint(alone, "--rind-color-accent-solid"),
    )
  })

  it("Live scope inherits the rest", () => {
    inject(
      defineTheme({
        name: "acme",
        accent: "#0a7d55",
        radius: "1rem",
        density: 1.25,
        fontSans: "Georgia, serif",
      }).css,
    )
    const host = mount(`
      <div id="outer" data-rind-theme="acme" data-theme="light">
        <div id="live" data-rind-theme="live"></div>
      </div>`)
    inject(`[data-rind-theme="live"] { --rind-brand-accent: oklch(0.55 0.2 20) }`)
    const outer = q(host, "#outer")
    const live = q(host, "#live")
    expect(paint(live, "--rind-color-accent-solid")).not.toBe(
      paint(outer, "--rind-color-accent-solid"),
    )
    const [r, g] = rgba(live, "--rind-color-accent-solid")
    expect(r).toBeGreaterThan(g) // the new (red) accent
    expect(lengthOf(live, "--rind-radius-control", "border-top-left-radius")).toBe(16)
    expect(lengthOf(live, "--rind-space-4")).toBe(20)
    expect(resolve(live, "font-family", "--rind-font-sans")).toBe(
      resolve(outer, "font-family", "--rind-font-sans"),
    )
    expect(getComputedStyle(live).fontFamily).toContain("Georgia")
  })
})

describe("Portalled Content Keeps The Theme", () => {
  const acme = defineTheme({ name: "acme", accent: "#0a7d55", radius: "1rem" })
  const globex = defineTheme({ name: "globex", accent: "#c2410c", radius: "0.125rem" })
  beforeEach(() => {
    inject(indexCss)
    inject(acme.css)
    inject(globex.css)
  })

  async function openInTenant(attrs: string) {
    const host = mount(`<div id="tenant" ${attrs}></div>`)
    const tenant = q(host, "#tenant")
    render(<Pop id="p" />, { container: tenant })
    await userEvent.click(screen.getByRole("button", { name: "Open" }))
    const content = await vi.waitFor(() => {
      const el = document.querySelector<HTMLElement>('[data-part="content"]')
      expect(el).not.toBeNull()
      return el as HTMLElement
    })
    return {
      tenant,
      content,
      host: content.closest<HTMLElement>("[data-rind-portal]") as HTMLElement,
    }
  }

  it("Portal content keeps the tenant theme (radix-ui/themes#708)", async () => {
    const { tenant, content, host } = await openInTenant(
      `data-rind-theme="acme" data-theme="light"`,
    )
    expect(host.parentElement).toBe(document.body) // really portalled out of the tenant
    expect(tenant.contains(content)).toBe(false)
    expect(host.getAttribute("data-rind-theme")).toBe("acme")
    const rootProbe = document.documentElement
    expect(paint(content, "--rind-color-accent-solid")).toBe(
      paint(tenant, "--rind-color-accent-solid"),
    )
    expect(paint(content, "--rind-color-accent-solid")).not.toBe(
      paint(rootProbe, "--rind-color-accent-solid"),
    )
    expect(lengthOf(content, "--rind-radius-control", "border-top-left-radius")).toBe(16)
    // The host receives text colour and font, not the page background.
    expect(getComputedStyle(host).backgroundColor).toBe("rgba(0, 0, 0, 0)")
    expect(getComputedStyle(host).color).toBe(paint(tenant, "--rind-color-text"))
  })

  it("Scheme switch while a toast/popover is open (chakra-ui#3076)", async () => {
    const { tenant, content } = await openInTenant(`data-rind-theme="acme" data-theme="light"`)
    const light = paint(content, "--rind-color-bg")
    tenant.setAttribute("data-theme", "dark")
    await vi.waitFor(() => expect(paint(content, "--rind-color-bg")).not.toBe(light))
    expect(paint(content, "--rind-color-bg")).toBe(paint(tenant, "--rind-color-bg"))
    expect(document.querySelector('[data-part="content"]')).toBe(content) // not reopened
  })

  it("Brand switch while a popover is open", async () => {
    const { tenant, content } = await openInTenant(`data-rind-theme="acme" data-theme="light"`)
    const before = paint(content, "--rind-color-accent-solid")
    tenant.setAttribute("data-rind-theme", "globex")
    await vi.waitFor(() => expect(paint(content, "--rind-color-accent-solid")).not.toBe(before))
    expect(paint(content, "--rind-color-accent-solid")).toBe(
      paint(tenant, "--rind-color-accent-solid"),
    )
    expect(lengthOf(content, "--rind-radius-control", "border-top-left-radius")).toBe(2)
  })
})

describe("Re-skinning a built theme", () => {
  it("Brand input on root after a built preset", () => {
    inject(indexCss)
    const host = mount(`<div id="scope" data-rind-theme="acme" data-theme="light"></div>`)
    document.documentElement.setAttribute("data-theme", "light")
    const root = document.documentElement
    const tokens = ["--rind-color-accent-solid", "--rind-color-accent-text", "--rind-focus-color"]
    const before = tokens.map((t) => paint(root, t))
    const scopeBefore = paint(q(host, "#scope"), tokens[0] as string)
    inject(`:root { --rind-brand-accent: #0a7d55 }`)
    expect(tokens.map((t) => paint(root, t))).toEqual(before)
    // Same input on a scope with no built theme: the CSS derivation re-skins it.
    inject(`[data-rind-theme="acme"] { --rind-brand-accent: #0a7d55 }`)
    expect(paint(q(host, "#scope"), tokens[0] as string)).not.toBe(scopeBefore)
    const [r, g, b] = rgba(q(host, "#scope"), "--rind-color-accent-solid")
    expect(g).toBeGreaterThan(r)
    expect(g).toBeGreaterThan(b)
  })
})

describe("Built root preset under another theme attribute", () => {
  const acme = defineTheme({ name: "acme", accent: "#c2410c" })
  const order = "@layer rind.tokens, rind.themes, rind.components, rind.preferences;"
  const solid = "--rind-color-accent-solid"

  it("without the attribute calm applies on :root", () => {
    inject(order)
    inject(acme.css)
    inject(files.calm)
    expect(paint(document.documentElement, solid)).toBe(literal("oklch(0.67 0.165 42)"))
  })

  it.each([
    ["before", true],
    ["after", false],
  ])("acme wins when its css is injected %s calm.css", (_, first) => {
    document.documentElement.setAttribute("data-rind-theme", "acme")
    inject(order)
    if (first) inject(acme.css)
    inject(files.calm)
    if (!first) inject(acme.css)
    const root = document.documentElement
    expect(paint(root, solid)).toBe(literal(acme.tokens.colors["accent-solid"].light))
    expect(paint(root, solid)).not.toBe(literal("oklch(0.67 0.165 42)"))
  })
})

describe("Focus colour override", () => {
  it("rind.preferences beats the default focus declaration inside the scope", () => {
    const t = defineTheme({ name: "acme", overrides: { focusColor: "#ff00aa" } })
    inject(indexCss)
    inject(t.css)
    const host = mount(`<div id="in" data-rind-theme="acme" data-theme="light"></div>
      <div id="out" data-rind-theme="other" data-theme="light"></div>`)
    expect(rgba(q(host, "#in"), "--rind-focus-color")).toEqual([255, 0, 170, 255])
    expect(rgba(q(host, "#out"), "--rind-focus-color")).not.toEqual([255, 0, 170, 255])
  })
})

describe("Translucent brand inputs", () => {
  const colours = manifest.tier2.filter(
    (n: string) => n.startsWith("--rind-color-") && n !== "--rind-color-overlay",
  )
  it.each(["light", "dark"])("every colour token except overlay is opaque (%s)", (scheme) => {
    inject(indexCss)
    inject(`[data-rind-theme="live"] {
      --rind-brand-accent: oklch(0.55 0.15 250 / 0.3);
      --rind-brand-neutral: oklch(0.5 0.02 270 / 0.3);
      --rind-brand-danger: oklch(0.55 0.2 27 / 0.3);
      --rind-brand-warning: oklch(0.75 0.15 75 / 0.3);
      --rind-brand-success: oklch(0.6 0.14 150 / 0.3);
    }`)
    const el = q(mount(`<div data-rind-theme="live" data-theme="${scheme}"></div>`), "div")
    expect(colours.length).toBeGreaterThan(30)
    for (const token of colours) expect(rgba(el, token)[3], token).toBe(255)
  })
})
