/// <reference types="node" />
// add-floating-positioning 7.3: Chromium-only visual-viewport scenarios (pinch-zoom, and the
// visual viewport shrinking from the bottom as an on-screen keyboard does) against the built
// Storybook's anchored fixture. Vitest browser mode cannot reach CDP's Input domain, so these
// run through Playwright. The keyboard is emulated by pinch-zooming to scale 2 with the top of
// the layout viewport in view: the visual viewport then covers only the top half, which is the
// same signal (`visualViewport.height` < `innerHeight`) the engine reads.
import { createReadStream, existsSync } from "node:fs"
import { createServer, type Server } from "node:http"
import { extname, join, normalize } from "node:path"
import { type Browser, type CDPSession, chromium, type Page } from "playwright"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

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
afterEach(async () => {
  for (const page of pages.splice(0)) await page.context().close()
})

/** A mobile-emulated page on an open anchored story, its trigger moved to `top` px. */
async function openStory(id: string, top: number) {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 400, height: 700 },
  })
  const page = await context.newPage()
  pages.push(page)
  await page.goto(`${base}/iframe.html?id=foundations-anchored-fixture--${id}&viewMode=story`)
  await page.locator('[data-part="positioner"]').waitFor()
  await page.locator('[data-part="positioner"]:not([data-placing])').waitFor()
  await page.evaluate((y) => {
    const t = document.querySelector<HTMLElement>('[data-part="trigger"]')
    if (t) t.style.cssText = `position:absolute;left:100px;top:${y}px;margin:0`
    window.dispatchEvent(new Event("resize"))
  }, top)
  await page.waitForTimeout(150)
  return { page, cdp: await context.newCDPSession(page) }
}

const pinch = (cdp: CDPSession, x: number, y: number) =>
  cdp.send("Input.synthesizePinchGesture", { x, y, scaleFactor: 2 })

const measure = (page: Page) =>
  page.evaluate(() => {
    const p = document.querySelector<HTMLElement>('[data-part="positioner"]')
    const t = document.querySelector<HTMLElement>('[data-part="trigger"]')
    const vv = window.visualViewport
    if (!p || !t || !vv) throw new Error("anchored story not ready")
    const pr = p.getBoundingClientRect()
    const tr = t.getBoundingClientRect()
    return {
      gap: pr.top - tr.bottom,
      left: pr.left - tr.left,
      side: p.getAttribute("data-side"),
      available: Number.parseFloat(p.style.getPropertyValue("--rind-available-height")),
      scale: vv.scale,
      vvBottom: vv.offsetTop + vv.height,
      triggerBottom: tr.bottom,
    }
  })

describe("Viewports, Zoom And On-Screen Keyboard (Chromium)", () => {
  it("Pinch-zoom while open", { timeout: 60_000 }, async () => {
    const { page, cdp } = await openStory("dropdown", 200)
    const before = await measure(page)
    expect(before.side).toBe("bottom")
    await pinch(cdp, 200, 200)
    await page.waitForTimeout(300)
    const after = await measure(page)
    expect(after.scale).toBeGreaterThan(1.9)
    // In page (layout) coordinates the menu stays on its trigger.
    expect(after.side).toBe(before.side)
    expect(Math.abs(after.gap - before.gap)).toBeLessThanOrEqual(1)
    expect(Math.abs(after.left - before.left)).toBeLessThanOrEqual(1)
  })

  it("Keyboard shrinks the visual viewport", { timeout: 60_000 }, async () => {
    const { page, cdp } = await openStory("popup", 300)
    const before = await measure(page)
    expect(before.side).toBe("bottom")
    // Zoom around the top edge: the visual viewport is now the top 350 px of the layout.
    await pinch(cdp, 200, 1)
    await page.waitForTimeout(400)
    const after = await measure(page)
    expect(after.vvBottom).toBeLessThan(400)
    // Either flipped above, or capped to what is left of the visual viewport.
    const remaining = after.vvBottom - after.triggerBottom
    expect(after.side === "top" || after.available <= remaining + 1).toBe(true)
  })
})
