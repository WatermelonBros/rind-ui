/// <reference types="node" />
// The public Calendar through the Playwright adapter: driver calls plus real keyboard and
// pointer behaviour (paging, a month boundary, page scroll, dates that cannot be selected).
// The page is bundled with rolldown from app.tsx.
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { type Browser, chromium, type Page } from "playwright"
import { rolldown } from "rolldown"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { getCalendar } from "../../src/index"

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

async function open() {
  const context = await browser.newContext()
  const page = await context.newPage()
  pages.push(page)
  await page.setContent(html)
  await page.getByRole("grid").waitFor()
  return page
}

const calendar = (page: Page, modality?: "keyboard" | "pointer") =>
  getCalendar(page, { name: "Departure" }, modality ? { modality } : undefined)
const day = (page: Page, name: string | RegExp) => page.getByRole("gridcell", { name })
const scrollY = (page: Page) => page.evaluate(() => window.scrollY)

describe("calendar through Playwright", () => {
  for (const [modality, iso] of [
    ["keyboard", "2026-10-22"],
    ["pointer", "2026-11-03"],
  ] as const) {
    it(`select ${iso} with the ${modality} modality`, { timeout: 60_000 }, async () => {
      const page = await open()
      const cal = calendar(page, modality)
      await cal.select(iso)
      await expect.poll(() => cal.value()).toEqual([iso])
      await expect.poll(() => cal.isSelected(iso)).toBe(true)
    })
  }

  it("the next trigger pages and keeps focus on itself", { timeout: 60_000 }, async () => {
    const page = await open()
    const cal = calendar(page)
    await expect.poll(() => cal.heading()).toBe("October 2026")
    const next = page.getByRole("button", { name: "Next month" })
    await next.click()
    await expect.poll(() => cal.heading()).toBe("November 2026")
    await expect.poll(() => next.evaluate((el) => el === document.activeElement)).toBe(true)
    await page.getByRole("button", { name: "Previous month" }).click()
    await expect.poll(() => cal.heading()).toBe("October 2026")
  })

  it("ArrowRight crosses the month boundary", { timeout: 60_000 }, async () => {
    const page = await open()
    const cal = calendar(page, "keyboard")
    await cal.focusDate("2026-10-31")
    await expect.poll(() => cal.focusedDate()).toBe("2026-10-31")
    await page.keyboard.press("ArrowRight")
    await expect.poll(() => cal.focusedDate()).toBe("2026-11-01")
    await expect.poll(() => cal.heading()).toBe("November 2026")
    await expect
      .poll(() => day(page, /November 1, 2026/).evaluate((el) => el === document.activeElement))
      .toBe(true)
  })

  it("navigation keys never scroll the page", { timeout: 60_000 }, async () => {
    const page = await open()
    expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight)).toBe(
      true,
    )
    const cal = calendar(page, "keyboard")
    await cal.focusDate("2026-10-14")
    for (const key of ["ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp", "ArrowDown"]) {
      await page.keyboard.press(key)
    }
    await expect.poll(() => cal.focusedDate()).not.toBeNull()
    await expect.poll(() => scrollY(page)).toBe(0)
  })

  it("an unavailable or disabled date is not selected", { timeout: 60_000 }, async () => {
    const page = await open()
    const cal = calendar(page)
    await expect.poll(() => cal.isUnavailable("2026-10-20")).toBe(true)
    await expect.poll(() => cal.isDisabled("2026-10-02")).toBe(true)
    // aria-disabled cells are "not enabled" to Playwright: force the press a user would make.
    await day(page, /October 20, 2026/).click({ force: true })
    await day(page, /October 2, 2026/).click({ force: true })
    await expect.poll(() => cal.value()).toEqual([])
    // Keyboard: the unavailable date takes focus, Enter selects nothing.
    await calendar(page, "keyboard").focusDate("2026-10-20")
    await expect.poll(() => cal.focusedDate()).toBe("2026-10-20")
    await page.keyboard.press("Enter")
    await expect.poll(() => cal.value()).toEqual([])
    await day(page, /October 21, 2026/).click()
    await expect.poll(() => cal.value()).toEqual(["2026-10-21"])
  })
})
