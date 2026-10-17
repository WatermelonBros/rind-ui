/// <reference types="node" />
// Image through the Playwright adapter (tasks 4.2, 6.2): the same driver calls as the Vitest
// suites (one handle from loading to loaded and to error), the ratio box kept in every status,
// and theme captures (statuses, forced colors). The page is bundled here with rolldown from
// fixtures/image/app.tsx; the slow image is held until the test releases it.
import { mkdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { type Browser, chromium, type Page } from "playwright"
import { rolldown } from "rolldown"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { getImage } from "../../src/index"

const here = import.meta.dirname
const themeSrc = join(here, "../../../theme/src")
const captures = join(here, "../../../../.vitest/attachments/captures")
const face = readFileSync(join(here, "../avatar/face.svg"))

/** index.css with its @imports inlined (fonts are not needed). */
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

/** The page with its image routes; "slow" images are held until `release()`. */
async function open() {
  const context = await browser.newContext()
  const page = await context.newPage()
  pages.push(page)
  let release = () => {}
  const released = new Promise<void>((r) => {
    release = r
  })
  await page.route("https://img.rind.test/**", async (route) => {
    const url = route.request().url()
    if (url.endsWith("missing.png")) return route.fulfill({ status: 404, body: "" })
    if (url.includes("slow")) await released
    return route.fulfill({ status: 200, contentType: "image/svg+xml", body: face })
  })
  await page.setContent(html)
  await page.getByRole("img", { name: "Empty" }).waitFor()
  return { page, release }
}

const box = async (page: Page, name: string) =>
  page
    .locator('[data-scope="image"][data-part="root"]')
    .filter({ has: page.locator(`img[alt="${name}"]`) })
    .boundingBox()

describe("image driver through Playwright", () => {
  it("one handle from loading to loaded; the ratio box does not change", {
    timeout: 60_000,
  }, async () => {
    const { page, release } = await open()
    const slow = getImage(page, { name: "Slow" })
    expect(await slow.status()).toBe("loading")
    expect(await slow.isFallbackVisible()).toBe(true)
    const before = await box(page, "Slow")
    release()
    await slow.waitForStatus("loaded")
    expect(await slow.isFallbackVisible()).toBe(false)
    expect(await slow.name()).toBe("Slow")
    expect(await box(page, "Slow")).toEqual(before)
  })

  it("a broken image: error, Root named, the box is kept (320 × 180)", {
    timeout: 60_000,
  }, async () => {
    const { page } = await open()
    const broken = getImage(page, { name: "Broken" })
    await broken.waitForStatus("error")
    expect(await broken.name()).toBe("Broken")
    const b = await box(page, "Broken")
    expect([b?.width, b?.height]).toEqual([320, 180])
  })
})

describe("image theme captures", () => {
  it("each status, and forced colors: the Fallback border is visible", {
    timeout: 60_000,
  }, async () => {
    const { page, release } = await open()
    release()
    await getImage(page, { name: "Slow" }).waitForStatus("loaded")
    await getImage(page, { name: "Broken" }).waitForStatus("error")
    mkdirSync(captures, { recursive: true })
    await page.screenshot({ path: join(captures, "image-statuses.png") })
    await page.emulateMedia({ forcedColors: "active" })
    const border = await page
      .getByRole("img", { name: "Broken" })
      .locator('[data-part="fallback"]')
      .evaluate((el) => {
        const s = getComputedStyle(el)
        return { style: s.borderTopStyle, width: Number.parseFloat(s.borderTopWidth) }
      })
    expect(border.style).toBe("solid")
    expect(border.width).toBeGreaterThanOrEqual(1)
    await page.screenshot({ path: join(captures, "image-forced-colors.png") })
  })
})
