/// <reference types="node" />
// The public Date Field through the Playwright adapter: the shared driver test (date-field
// "Same test in both environments") plus real typing, Tab order and page scroll.
// The page is bundled with rolldown from app.tsx.
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { type Browser, chromium, type Page } from "playwright"
import { rolldown } from "rolldown"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { getDateField } from "../../src/index"

const here = import.meta.dirname
const themeSrc = join(here, "../../../theme/src")

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

async function open(locale = "en-US") {
  const context = await browser.newContext()
  const page = await context.newPage()
  pages.push(page)
  await page.route("http://fixture.test/**", (route) =>
    route.fulfill({ contentType: "text/html", body: html }),
  )
  await page.goto(`http://fixture.test/?locale=${locale}`)
  await page.getByRole("group", { name: "Birthday" }).waitFor()
  return page
}

const field = (page: Page, modality?: "keyboard" | "pointer") =>
  getDateField(page, { name: "Birthday" }, modality ? { modality } : undefined)
const scrollY = (page: Page) => page.evaluate(() => window.scrollY)

describe("date field through Playwright", () => {
  for (const modality of ["keyboard", "pointer"] as const) {
    it(`fill in en-GB with the ${modality} modality`, { timeout: 60_000 }, async () => {
      const page = await open("en-GB")
      const f = field(page, modality)
      await f.fill("1990-12-01")
      await expect.poll(() => f.value()).toBe("1990-12-01")
      await expect
        .poll(async () => (await f.segments()).map((s) => s.text))
        .toEqual(["01", "12", "1990"])
    })
  }

  it("Tab moves through every segment, then out", { timeout: 60_000 }, async () => {
    const page = await open()
    const f = field(page, "keyboard")
    await f.enter()
    await expect.poll(() => f.focusedSegment()).toBe("month")
    await page.keyboard.press("Tab")
    await expect.poll(() => f.focusedSegment()).toBe("day")
    await page.keyboard.press("Tab")
    await expect.poll(() => f.focusedSegment()).toBe("year")
    await page.keyboard.press("Tab")
    await expect.poll(() => f.focusedSegment()).toBeNull()
  })

  it("real typing: digits advance, letters are rejected, keys never scroll", async () => {
    const page = await open()
    const f = field(page, "keyboard")
    await f.enter()
    await page.keyboard.type("1x0")
    await expect.poll(() => f.focusedSegment()).toBe("day")
    await page.keyboard.type("14")
    await page.keyboard.type("2026")
    await expect.poll(() => f.value()).toBe("2026-10-14")
    for (const key of ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"]) {
      await page.keyboard.press(key)
    }
    await expect.poll(() => scrollY(page)).toBe(0)
  })

  it("out of range is invalid natively", { timeout: 60_000 }, async () => {
    const page = await open()
    const f = field(page)
    await f.fill("2031-01-01")
    await expect.poll(() => f.value()).toBe("2031-01-01")
    const valid = await page
      .locator('[data-part="hidden-input"]')
      .evaluate((el) => (el as HTMLInputElement).checkValidity())
    expect(valid).toBe(false)
  })
})
