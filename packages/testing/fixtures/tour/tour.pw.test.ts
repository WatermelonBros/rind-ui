/// <reference types="node" />
// Tour through the Playwright adapter (add-tour 5.2, 6.4): the same driver round trip as the
// Vitest suites in Chromium, Firefox and WebKit, axe on each step, and the forced-colors
// capture. The page is bundled here with rolldown from fixtures/tour/app.tsx.
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { type Browser, type BrowserType, chromium, firefox, type Page, webkit } from "playwright"
import { rolldown } from "rolldown"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { getTour } from "../../src/index"

const here = import.meta.dirname
const themeSrc = join(here, "../../../theme/src")
const axeSource = readFileSync(join(here, "../../../../node_modules/axe-core/axe.min.js"), "utf8")

/** index.css with its @imports inlined (fonts are not needed). */
function themeCss(file = join(themeSrc, "index.css")): string {
  return readFileSync(file, "utf8").replace(/@import\s+"(.+?)";/g, (_, path: string) =>
    path.includes("fonts") ? "" : themeCss(join(dirname(file), path)),
  )
}

let html = ""
const browsers: Browser[] = []

beforeAll(async () => {
  const bundle = await rolldown({
    input: join(here, "app.tsx"),
    platform: "browser",
    resolve: { conditionNames: ["@rind-ui/source", "browser", "import", "default"] },
    transform: { define: { "process.env.NODE_ENV": '"development"' } },
    logLevel: "silent",
  })
  const { output } = await bundle.generate({ format: "iife" })
  const script = output[0].code.replaceAll("</script", "<\\/script")
  html = `<!doctype html><html lang="en"><head><title>Tour</title><style>${themeCss()}</style></head><body><div id="root"></div><script>${script}</script></body></html>`
}, 120_000)

afterAll(async () => {
  for (const b of browsers.splice(0)) await b.close()
})

async function open(type: BrowserType, options: Parameters<Browser["newContext"]>[0] = {}) {
  const browser = await type.launch()
  browsers.push(browser)
  const page = await (await browser.newContext(options)).newPage()
  await page.setContent(html)
  await page.getByRole("button", { name: "Take the tour" }).waitFor()
  return page
}

async function axe(page: Page) {
  await page.addScriptTag({ content: axeSource })
  return page.evaluate(async () => {
    const w = window as unknown as {
      axe: {
        run: (
          d: Document,
          o: object,
        ) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }>
      }
    }
    const r = await w.axe.run(document, {
      // Page-structure rules about the fixture page itself, not the tour.
      rules: {
        region: { enabled: false },
        "landmark-one-main": { enabled: false },
        "page-has-heading-one": { enabled: false },
      },
    })
    return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(" ")}`)
  })
}

for (const [name, type] of [
  ["chromium", chromium],
  ["firefox", firefox],
  ["webkit", webkit],
] as const) {
  describe(`tour driver through Playwright (${name})`, () => {
    it("start, next, next, pressEscape; axe clean on every step", { timeout: 90_000 }, async () => {
      const page = await open(type)
      const t = getTour(page, { name: "Take the tour" })
      await t.start()
      expect(await t.stepId()).toBe("welcome")
      expect(await t.isModal()).toBe(true)
      expect(await axe(page)).toEqual([])
      await t.next()
      await t.waitForStep("search")
      expect(await t.isModal()).toBe(false)
      expect(await t.progressText()).toBe("2 of 3")
      expect(await t.spotlightRect()).not.toBeNull()
      expect(await axe(page)).toEqual([])
      await t.next()
      await t.waitForStep("toolbar")
      await t.pressEscape()
      expect(await t.isOpen()).toBe(false)
      expect(await page.locator("[data-rind-tour-target]").count()).toBe(0)
    })
  })
}

describe("tour theme capture", () => {
  it("forced colors: no scrim, the ring stays visible", { timeout: 60_000 }, async () => {
    const page = await open(chromium, { forcedColors: "active" })
    const t = getTour(page, { name: "Take the tour" })
    await t.start()
    await t.next()
    await t.waitForStep("search")
    const backdrop = await page
      .locator('[data-part="backdrop"]')
      .evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(backdrop).toMatch(/rgba\(\d+, \d+, \d+, 0\)|transparent/)
    const ring = await page
      .locator('[data-part="spotlight"]')
      .evaluate((el) => getComputedStyle(el).outlineStyle)
    expect(ring).toBe("solid")
  })
})
