/// <reference types="node" />
// Skeleton through the Playwright adapter (add-skeleton 4.2, 6.2): the same driver calls as
// the Vitest suites, and the themed captures: light/dark fill, forced colors, reduced motion,
// loaded (no animation) and a circle that stays round mid-shimmer in WebKit
// (mui/material-ui#24050). The page is bundled with rolldown from fixtures/skeleton/app.tsx.
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { type Browser, type BrowserType, chromium, type Page, webkit } from "playwright"
import { rolldown } from "rolldown"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { getSkeleton } from "../../src/index"

const here = import.meta.dirname
const themeSrc = join(here, "../../../theme/src")

function themeCss(file = join(themeSrc, "index.css")): string {
  return readFileSync(file, "utf8").replace(/@import\s+"(.+?)";/g, (_, path: string) =>
    path.includes("fonts") ? "" : themeCss(join(dirname(file), path)),
  )
}

const browsers: Browser[] = []
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
}, 120_000)

afterAll(async () => {
  for (const b of browsers) await b.close()
})

const pages: Page[] = []
afterEach(async () => {
  for (const p of pages.splice(0)) await p.context().close()
})

const launched = new Map<BrowserType, Browser>()
async function open(options: Parameters<Browser["newContext"]>[0] = {}, engine = chromium) {
  let browser = launched.get(engine)
  if (!browser) {
    browser = await engine.launch()
    launched.set(engine, browser)
    browsers.push(browser)
  }
  const context = await browser.newContext(options)
  const page = await context.newPage()
  pages.push(page)
  await page.setContent(html)
  await page.locator('[data-scope="skeleton"][data-part="root"]').waitFor()
  return page
}

const animations = (page: Page, testId: string) =>
  page.getByTestId(testId).evaluate((el) => el.getAnimations().length)
const fill = (page: Page) =>
  page.getByTestId("line").evaluate((el) => getComputedStyle(el).backgroundColor)

describe("Skeleton (Playwright)", () => {
  it("the driver reads the same as in Vitest", async () => {
    const page = await open({ reducedMotion: "no-preference" })
    const s = getSkeleton(page, { within: page.getByRole("region", { name: "Comments" }) })
    expect(await s.isLoading()).toBe(true)
    expect(await s.statusText()).toBe("Loading")
    await page.getByRole("button", { name: "Toggle" }).click()
    expect(await s.isLoading()).toBe(false)
    expect(await s.statusText()).toBe("")
  })

  it("shimmers while loading, stops on load", async () => {
    const page = await open({ reducedMotion: "no-preference" })
    expect(await animations(page, "line")).toBe(1)
    await page.getByRole("button", { name: "Toggle" }).click()
    await page.locator('[data-part="root"][data-state="loaded"]').waitFor()
    expect(await animations(page, "line")).toBe(0)
  })

  it("no running animation under reduced motion (mui/material-ui#49442)", async () => {
    const page = await open({ reducedMotion: "reduce" })
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0)
  })

  it("dark scheme uses the dark fill (mui/material-ui#19429)", async () => {
    const light = await fill(await open({ colorScheme: "light" }))
    const dark = await fill(await open({ colorScheme: "dark" }))
    expect(dark).not.toBe(light)
  })

  it("every placeholder is visible under forced colors", async () => {
    const page = await open({ forcedColors: "active" })
    for (const id of ["circle", "line", "text"]) {
      const bg = await page.getByTestId(id).evaluate((el) => getComputedStyle(el).backgroundColor)
      expect(bg).not.toBe("rgba(0, 0, 0, 0)")
    }
  })

  it("a circle stays round mid-shimmer in WebKit (mui/material-ui#24050)", async () => {
    const page = await open({ reducedMotion: "no-preference" }, webkit)
    const circle = page.getByTestId("circle")
    expect(await animations(page, "circle")).toBe(1)
    // Mid-shimmer by seeking the animation itself, not by waiting for time to pass.
    await circle.evaluate((el) => {
      for (const a of el.getAnimations()) {
        a.pause()
        a.currentTime = 400
      }
    })
    const style = await circle.evaluate((el) => {
      const s = getComputedStyle(el)
      return { radius: s.borderTopLeftRadius, overflow: el.children.length }
    })
    expect(style.radius).toBe("9999px")
    // The shimmer is the Item's own background: no clipped child to escape the radius.
    expect(style.overflow).toBe(0)
    const shot = await circle.screenshot()
    expect(shot.byteLength).toBeGreaterThan(0)
  })
})
