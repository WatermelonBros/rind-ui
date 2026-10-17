/// <reference types="node" />
// Scroll Area through the Playwright adapter (add-scroll-area 5.2, 7.2): the driver's keyboard
// `scroll` with real keys, a thumb drag, and the themed captures (forced colors, RTL, both
// axes with a corner, reduced motion). The page is bundled with rolldown from app.tsx.
import { mkdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { type Browser, chromium, type Page } from "playwright"
import { rolldown } from "rolldown"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { getScrollArea } from "../../src/index"

const here = import.meta.dirname
const themeSrc = join(here, "../../../theme/src")
const captures = join(here, "../../../../.vitest/attachments/captures")

function themeCss(file = join(themeSrc, "index.css")): string {
  return readFileSync(file, "utf8").replace(/@import\s+"(.+?)";/g, (_, path: string) =>
    path.includes("fonts") ? "" : themeCss(join(dirname(file), path)),
  )
}

let browser: Browser
let html = ""

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
  html = `<!doctype html><html lang="en"><head><style>${themeCss()}</style></head><body><div id="root"></div><script>${script}</script></body></html>`
  browser = await chromium.launch()
}, 120_000)

afterAll(async () => {
  await browser?.close()
})

const pages: Page[] = []
afterEach(async () => {
  for (const p of pages.splice(0)) await p.context().close()
})

async function open(options: Parameters<Browser["newContext"]>[0] = {}) {
  const context = await browser.newContext(options)
  const page = await context.newPage()
  pages.push(page)
  await page.setContent(html)
  // Measured: the always-visible thumbs are painted.
  await page.locator('[data-part="viewport"][data-overflow-y]').first().waitFor()
  return page
}

describe("Scroll Area (Playwright)", () => {
  it("the driver's keyboard scroll reaches the end with native keys", async () => {
    const page = await open()
    const area = getScrollArea(page, { name: "Release notes" }, { modality: "keyboard" })
    expect(await area.isTabStop()).toBe(true)
    await area.scroll("y", "end")
    expect(await area.atEnd("y")).toBe(true)
    await area.scroll("y", "start")
    expect(await area.atStart("y")).toBe(true)
  })

  it("a thumb drag to the end", async () => {
    const page = await open()
    const area = getScrollArea(page, { name: "Release notes" })
    await area.dragThumb("y", 1)
    expect(await area.atEnd("y")).toBe(true)
  })

  it("captures: both axes with a corner, RTL, forced colors, reduced motion", async () => {
    mkdirSync(captures, { recursive: true })
    const page = await open({ reducedMotion: "reduce" })
    await page.screenshot({ path: join(captures, "scroll-area.png") })
    // Reduced motion: no transition on the scrollbar's fade.
    const duration = await page
      .locator('[data-part="scrollbar"]')
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration)
    expect(duration.split(",").every((d) => Number.parseFloat(d) === 0)).toBe(true)
    // RTL: the vertical bar sits on the left of its area.
    const rtl = page.locator('[dir="rtl"] [data-part="root"]')
    const rootBox = await rtl.boundingBox()
    const barBox = await rtl
      .locator('[data-part="scrollbar"][data-orientation="vertical"]')
      .boundingBox()
    expect(barBox && rootBox && barBox.x - rootBox.x).toBeLessThan(2)
    const forced = await open({ forcedColors: "active" })
    const thumb = forced.locator('[data-part="thumb"]').first()
    const bg = await thumb.evaluate((el) => getComputedStyle(el).backgroundColor)
    const canvasText = await forced.evaluate(() => {
      const probe = document.createElement("span")
      probe.style.color = "CanvasText"
      document.body.append(probe)
      const c = getComputedStyle(probe).color
      probe.remove()
      return c
    })
    expect(bg).toBe(canvasText)
    await forced.screenshot({ path: join(captures, "scroll-area-forced-colors.png") })
  })
})
