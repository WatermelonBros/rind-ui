/// <reference types="node" />
// Accordion through the Playwright adapter, against the built Storybook: the driver in a real
// browser and the generic invariants on every Accordion story.
import { createReadStream, existsSync } from "node:fs"
import { createServer, type Server } from "node:http"
import { extname, join, normalize } from "node:path"
import { type Browser, chromium, type Page } from "playwright"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { checkGeneric, getAccordion, playwrightEnv } from "../../src/index"

const root = join(import.meta.dirname, "../../../../apps/storybook/storybook-static")
const types: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
}

let server: Server
let browser: Browser
let base = ""

beforeAll(async () => {
  if (!existsSync(root))
    throw new Error("Build Storybook first: pnpm --filter @rind-ui/storybook build")
  server = createServer((req, res) => {
    const path = normalize(decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/"))
    const file = join(root, path.endsWith("/") ? `${path}index.html` : path)
    if (!file.startsWith(root) || !existsSync(file)) {
      res.writeHead(404).end()
      return
    }
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" })
    createReadStream(file).pipe(res)
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`
  browser = await chromium.launch()
}, 60_000)

afterAll(async () => {
  await browser?.close()
  server?.close()
})

const pages: Page[] = []
async function open(id: string, options: Parameters<Browser["newContext"]>[0] = {}) {
  const context = await browser.newContext(options)
  const page = await context.newPage()
  pages.push(page)
  await page.goto(`${base}/iframe.html?id=components-accordion--${id}&viewMode=story`)
  await page.locator('[data-scope="accordion"]').first().waitFor()
  return page
}
afterEach(async () => {
  for (const page of pages.splice(0)) await page.context().close()
})

describe("accordion driver through Playwright", () => {
  it("expands, switches and collapses by pointer and keyboard", { timeout: 60_000 }, async () => {
    const page = await open("default")
    const faq = getAccordion(page, { item: "Shipping" })
    expect(await faq.expanded()).toEqual([])
    await faq.expand("Shipping")
    expect(await faq.expanded()).toEqual(["Shipping"])
    await faq.expand("Returns")
    expect(await faq.expanded()).toEqual(["Returns"])
    await faq.collapse("Returns")
    expect(await faq.expanded()).toEqual([])
    await page.getByRole("button", { name: /Payment/ }).focus()
    await page.keyboard.press("Enter")
    expect(await faq.expanded()).toEqual(["Payment"])
    await page.keyboard.press("Space")
    expect(await faq.expanded()).toEqual([])
  })

  it("keyboardNavigation: arrows move focus, Home and End jump", { timeout: 60_000 }, async () => {
    const page = await open("keyboard-navigation")
    const focused = () => page.evaluate(() => document.activeElement?.textContent?.trim() ?? "")
    await page.getByRole("button", { name: /Shipping/ }).focus()
    await page.keyboard.press("ArrowDown")
    expect(await focused()).toContain("Returns")
    await page.keyboard.press("End")
    expect(await focused()).toContain("Payment")
    await page.keyboard.press("Home")
    expect(await focused()).toContain("Shipping")
  })

  it("find-in-page: a beforematch on closed content opens its item", {
    timeout: 60_000,
  }, async () => {
    const page = await open("find-in-page")
    const trigger = page.getByRole("button", { name: /Hidden item/ })
    expect(await trigger.getAttribute("aria-expanded")).toBe("false")
    await page.locator('[data-part="content"]').last().dispatchEvent("beforematch")
    expect(await trigger.getAttribute("aria-expanded")).toBe("true")
  })

  it("reduced motion: the content height changes without a transition", {
    timeout: 60_000,
  }, async () => {
    const page = await open("default", { reducedMotion: "reduce" })
    await page.getByRole("button", { name: /Shipping/ }).click()
    const duration = await page
      .locator('[data-part="content"]')
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration)
    expect(Number.parseFloat(duration)).toBe(0)
  })

  // Chromium emulates forced colors: the trigger is painted in a system colour, the
  // separator border stays.
  it("Forced colors: system trigger colour, borders kept", { timeout: 60_000 }, async () => {
    const page = await open("default", { forcedColors: "active" })
    const color = await page
      .getByRole("button", { name: /Shipping/ })
      .evaluate((el) => getComputedStyle(el).color)
    expect(color).not.toBe("rgba(0, 0, 0, 0)")
    const border = await page
      .locator('[data-part="item"]')
      .first()
      .evaluate((el) => getComputedStyle(el).borderBlockEndStyle)
    expect(border).toBe("solid")
  })
})

const STORIES = [
  "default",
  "single",
  "multiple",
  "non-collapsible",
  "disabled-item",
  "heading-levels",
  "horizontal-ltr",
  "horizontal-rtl",
  "keyboard-navigation",
  "find-in-page",
  "nested",
  "driver-example",
]

describe("generic invariants on every Accordion story", () => {
  for (const id of STORIES) {
    it(id, { timeout: 60_000 }, async () => {
      const page = await open(id)
      const triggers = await page.locator('[data-scope="accordion"][data-part="trigger"]').all()
      expect(triggers.length, `${id}: no trigger`).toBeGreaterThan(0)
      for (const trigger of triggers) {
        const name = ((await trigger.textContent()) ?? "").replace("▸", "").trim()
        expect(name, `${id}: a trigger without a name`).not.toBe("")
        const env = playwrightEnv(page).create({
          scope: "accordion",
          anchor: { role: "button", name },
          modality: "virtual",
        })
        const snap = await env.collect()
        const problems = checkGeneric({
          before: null,
          after: snap,
          baseline: snap,
          from: null,
          state: "static",
          expected: () => ({}),
          open: false,
          atInitial: true,
          anchorCount: await env.anchorCount(),
          errors: await env.takeErrors(),
          traits: [],
          semantics: {},
          values: {},
        })
        expect(problems, `${id} / ${name}`).toEqual([])
      }
    })
  }
})
