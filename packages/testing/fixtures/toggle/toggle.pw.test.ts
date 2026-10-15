/// <reference types="node" />
// Toggle through the Playwright adapter, against the built Storybook: the driver in a real
// browser and the generic invariants on every Toggle story.
import { createReadStream, existsSync } from "node:fs"
import { createServer, type Server } from "node:http"
import { extname, join, normalize } from "node:path"
import { type Browser, chromium, type Page } from "playwright"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { checkGeneric, getToggle, playwrightEnv } from "../../src/index"

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
  await page.goto(`${base}/iframe.html?id=components-toggle--${id}&viewMode=story`)
  await page.locator('[data-scope="toggle"]').first().waitFor()
  return page
}
afterEach(async () => {
  for (const page of pages.splice(0)) await page.context().close()
})

describe("toggle driver through Playwright", () => {
  it("sets pressed by pointer, Space and Enter", { timeout: 60_000 }, async () => {
    const page = await open("default")
    const toggle = getToggle(page, { name: "Bold" })
    expect(await toggle.isPressed()).toBe(false)
    await toggle.setPressed(true)
    expect(await toggle.isPressed()).toBe(true)
    await toggle.via("keyboard").setPressed(false)
    expect(await toggle.isPressed()).toBe(false)
    await toggle.via("keyboard").activateWithEnter(true)
    expect(await toggle.isPressed()).toBe(true)
  })

  it("reduced motion: nothing transitions", { timeout: 60_000 }, async () => {
    const page = await open("on", { reducedMotion: "reduce" })
    const duration = await page
      .getByRole("button", { name: "Bold" })
      .evaluate((el) => getComputedStyle(el).transitionDuration)
    expect(Number.parseFloat(duration)).toBe(0)
  })
})

// Chromium emulates forced colors: on and off must differ by more than the page can fake.
describe("forced colors", () => {
  const paint = (page: Page) =>
    page.getByRole("button", { name: "Bold" }).evaluate((el) => {
      const s = getComputedStyle(el)
      return {
        bg: s.backgroundColor,
        color: s.color,
        outline: `${s.outlineStyle} ${s.outlineWidth}`,
      }
    })

  it("on and off are distinguishable", { timeout: 60_000 }, async () => {
    const off = await paint(await open("default", { forcedColors: "active" }))
    const on = await paint(await open("on", { forcedColors: "active" }))
    expect(on).not.toEqual(off)
    expect(on.outline).not.toBe(off.outline)
  })

  it("disabled is GrayText and the focus ring is visible", { timeout: 60_000 }, async () => {
    const page = await open("disabled", { forcedColors: "active" })
    const [color, gray] = await Promise.all([
      page
        .locator('[data-scope="toggle"]')
        .first()
        .evaluate((el) => getComputedStyle(el).color),
      page.evaluate(() => {
        const span = document.createElement("span")
        span.style.color = "GrayText"
        document.body.append(span)
        return getComputedStyle(span).color
      }),
    ])
    expect(color).toBe(gray)
    const focused = await open("default", { forcedColors: "active" })
    await focused.keyboard.press("Tab")
    const ring = await focused
      .getByRole("button", { name: "Bold" })
      .evaluate((el) => getComputedStyle(el).outlineStyle)
    expect(ring).toBe("solid")
  })
})

const STORIES = [
  "default",
  "on",
  "disabled",
  "focusable-when-disabled",
  "icon-only",
  "controlled",
  "driver-example",
]

describe("generic invariants on every Toggle story", () => {
  for (const id of STORIES) {
    it(id, { timeout: 60_000 }, async () => {
      const page = await open(id)
      const roots = await page.locator('[data-scope="toggle"][data-part="root"]').all()
      expect(roots.length, `${id}: no toggle`).toBeGreaterThan(0)
      for (const el of roots) {
        const name =
          ((await el.getAttribute("aria-label")) ?? (await el.textContent()))?.trim() ?? ""
        expect(name, `${id}: a toggle without a name`).not.toBe("")
        const env = playwrightEnv(page).create({
          scope: "toggle",
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
