/// <reference types="node" />
// Media-dependent theme behaviour that Vitest's browser API cannot emulate:
//  - add-theme-system 1.5: "Tenant theme cannot re-enable motion" (reduced motion) and
//    "More contrast" (prefers-contrast: more);
//  - 7.3: forced colors (theme-scoping "Ghost button in high contrast") and focus.
import type { Browser, BrowserContextOptions, Page } from "playwright"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { defineTheme } from "../../src/builder"
import { type Engine, engines, indexCss, launch, probe } from "../harness"

const acme = defineTheme({ name: "acme", accent: "#0a7d55", motion: 1 })
const page$ = (body: string, extra = "") =>
  `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><style>${indexCss}\n${acme.css}\n${extra}</style></head><body>${body}</body></html>`

describe.each(engines)("theme and media preferences (%s)", (engine: Engine) => {
  let browser: Browser
  const opened: Page[] = []
  beforeAll(async () => {
    browser = await launch(engine)
  }, 60_000)
  afterAll(async () => {
    await browser.close()
  })
  afterEach(async () => {
    await Promise.all(opened.splice(0).map((p) => p.context().close()))
  })
  const open = async (html: string, options: BrowserContextOptions = {}) => {
    const page = await (await browser.newContext(options)).newPage()
    opened.push(page)
    await page.setContent(html)
    return page
  }
  const seconds = (page: Page, selector: string, token: string) =>
    page
      .evaluate(probe(selector, token, "transition-duration") as string)
      .then((v) => Number.parseFloat(v as string) * ((v as string).endsWith("ms") ? 0.001 : 1))

  const scopes = `
    <div id="root-probe"></div>
    <div id="tenant" data-rind-theme="acme"></div>
    <div id="live" data-rind-theme="live" style="--rind-brand-motion: 1"></div>
    <div id="crisp" data-rind-theme="calm"></div>`

  describe("User Preferences Win", () => {
    it("Tenant theme cannot re-enable motion", async () => {
      const html = page$(scopes, `[data-rind-theme="live"] { --rind-brand-motion: 1 }`)
      const motion = await open(html, { reducedMotion: "no-preference" })
      // Control: without the preference the tenant's motion factor 1 gives 180 ms.
      expect(await seconds(motion, "#tenant", "--rind-duration-normal")).toBeCloseTo(0.18, 3)
      const reduced = await open(html, { reducedMotion: "reduce" })
      for (const id of ["#root-probe", "#tenant", "#live", "#crisp"]) {
        for (const d of ["fast", "normal", "slow"]) {
          expect(await seconds(reduced, id, `--rind-duration-${d}`), `${id} ${d}`).toBe(0)
        }
      }
    })

    it("More contrast", async () => {
      const html = page$(scopes)
      const same = async (page: Page, selector: string, a: string, b: string) =>
        (await page.evaluate(probe(selector, a) as string)) ===
        (await page.evaluate(probe(selector, b) as string))
      const normal = await open(html, { contrast: "no-preference" })
      const more = await open(html, { contrast: "more" })
      for (const scheme of ["light", "dark"]) {
        await normal.evaluate((s) => document.documentElement.setAttribute("data-theme", s), scheme)
        await more.evaluate((s) => document.documentElement.setAttribute("data-theme", s), scheme)
        for (const id of ["#root-probe", "#tenant", "#live"]) {
          const where = `${id} ${scheme}`
          expect(
            await same(normal, id, "--rind-color-text-muted", "--rind-color-text"),
            where,
          ).toBe(false)
          expect(
            await same(normal, id, "--rind-color-border", "--rind-color-border-strong"),
            where,
          ).toBe(false)
          expect(await same(more, id, "--rind-color-text-muted", "--rind-color-text"), where).toBe(
            true,
          )
          expect(
            await same(more, id, "--rind-color-border", "--rind-color-border-strong"),
            where,
          ).toBe(true)
        }
      }
    })
  })

  describe("Forced Colors Override Tokens", () => {
    // A demo stylesheet following the component convention (design D7): every variant keeps a
    // border, transparent by default; the look comes from tokens that forced colors drop.
    const demo = `
      @layer rind.components {
        :where([data-scope="button"][data-part="root"]) {
          border: var(--rind-border-width) solid transparent;
          border-radius: var(--rind-radius-control);
          padding: 4px 12px;
          font: inherit;
        }
        :where([data-scope="button"][data-part="root"]:not([data-variant]),
               [data-scope="button"][data-part="root"][data-variant="solid"]) {
          background: var(--rind-color-accent-solid); color: var(--rind-color-accent-on-solid);
        }
        :where([data-scope="button"][data-part="root"][data-variant="soft"]) {
          background: var(--rind-color-accent-soft); color: var(--rind-color-accent-text);
        }
        :where([data-scope="button"][data-part="root"][data-variant="ghost"]) {
          background: transparent; color: var(--rind-color-accent-text);
        }
        :where([data-scope="button"][data-part="root"][data-variant="outline"]) {
          background: transparent; border-color: var(--rind-color-accent-border);
        }
      }`
    const buttons = ["solid", "soft", "ghost", "outline"]
      .map((v) => `<button data-scope="button" data-part="root" data-variant="${v}">${v}</button>`)
      .join("")
    const borders = (page: Page) =>
      page.evaluate(() =>
        [...document.querySelectorAll("button")].map((b) => {
          const s = getComputedStyle(b)
          return {
            variant: b.dataset["variant"] ?? "",
            width: s.borderTopWidth,
            style: s.borderTopStyle,
            color: s.borderTopColor,
          }
        }),
      )
    const transparent = /^(transparent|rgba\(0, 0, 0, 0\))$/

    // WebKit matches (forced-colors: active) under emulation but applies no system-colour
    // adjustment: a plain background keeps its author colour. Nothing to measure there.
    const forces = (page: Page) =>
      page.evaluate(() => {
        const el = document.createElement("div")
        el.style.background = "rgb(1, 2, 3)"
        document.body.append(el)
        return getComputedStyle(el).backgroundColor !== "rgb(1, 2, 3)"
      })

    it("Ghost button in high contrast: every variant shows a visible border", async (ctx) => {
      const html = page$(`<div data-rind-theme="acme">${buttons}</div>`, demo)
      const normal = await open(html, { forcedColors: "none" })
      const forced = await open(html, { forcedColors: "active" })
      expect(await forced.evaluate(() => matchMedia("(forced-colors: active)").matches)).toBe(true)
      if (!(await forces(forced))) ctx.skip("engine applies no forced-colors adjustment")
      // Control: outside forced colors a ghost/soft border is transparent (that is the point).
      const plain = await borders(normal)
      expect(plain.find((b) => b.variant === "ghost")?.color).toMatch(transparent)
      for (const b of await borders(forced)) {
        expect(b.style, b.variant).toBe("solid")
        expect(Number.parseFloat(b.width), b.variant).toBeGreaterThanOrEqual(1)
        expect(b.color, b.variant).not.toMatch(transparent)
      }
    })

    it("Focus stays visible in forced colors (theme-accessibility)", async () => {
      const html = page$(
        `<div data-rind-theme="acme">${buttons.replaceAll("<button ", "<button data-focus-visible ")}</div>`,
        demo,
      )
      const forced = await open(html, { forcedColors: "active" })
      const outlines = await forced.evaluate(() =>
        [...document.querySelectorAll("button")].map((b) => {
          const s = getComputedStyle(b)
          return { style: s.outlineStyle, width: s.outlineWidth, color: s.outlineColor }
        }),
      )
      for (const o of outlines) {
        expect(o.style).toBe("solid")
        expect(Number.parseFloat(o.width)).toBeGreaterThanOrEqual(2)
        expect(o.color).not.toMatch(transparent)
      }
    })
  })
})
