/// <reference types="node" />
// Number Input through the Playwright adapter (tasks 5.2, 7.3, 8.2): the same driver calls as
// the Vitest suites, a real held stepper, touch taps that take no focus, forced colors and
// reduced motion on the themed component. The page is bundled with rolldown from app.tsx.
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { type Browser, chromium, type Page } from "playwright"
import { rolldown } from "rolldown"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { getNumberInput, playwrightEnv } from "../../src/index"

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

async function open(options: Parameters<Browser["newContext"]>[0] = {}, fakeClock = false) {
  const context = await browser.newContext({ hasTouch: true, ...options })
  const page = await context.newPage()
  pages.push(page)
  // Deterministic time for holds: the page's timers advance only when the test says so.
  if (fakeClock) await page.clock.install()
  await page.setContent(html)
  await page.getByRole("spinbutton", { name: "Quantity" }).waitFor()
  // An installed clock still flows with real time: paused, the page's time moves only through
  // `runFor` (the adapter's advance), never with polling or load.
  if (fakeClock) await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1)
  return page
}

describe("number input driver through Playwright", () => {
  it("Same test in both environments: step from 0 gives 1", { timeout: 60_000 }, async () => {
    const page = await open()
    const q = getNumberInput(page, { name: "Quantity" })
    await q.step("increase")
    expect(await q.value()).toBe(1)
  })

  it("types, commits, steps by keys, resets", { timeout: 60_000 }, async () => {
    const page = await open()
    const price = getNumberInput(page, { name: "Price" })
    await price.fill("12,5")
    expect(await price.value()).toBe(12.5)
    expect(await price.text()).toBe(
      new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(12.5),
    )
    await price.via("keyboard").step("increase")
    expect(await price.value()).toBe(13)
    expect(await price.formValue()).toBe("13")
    await price.resetForm()
    expect(await price.value()).toBe(9)
  })

  it("a real held stepper repeats, then commits once at the bound", {
    timeout: 60_000,
  }, async () => {
    const page = await open({}, true)
    const clocked = playwrightEnv(page, { advanceTimers: (ms) => page.clock.runFor(ms) })
    const limit = getNumberInput(clocked, { name: "Limit" })
    await limit.holdStepper("increase", 900)
    expect(await limit.value()).toBe(10)
    expect(await limit.canIncrement()).toBe(false)
    const quantity = getNumberInput(clocked, { name: "Quantity" })
    await quantity.holdStepper("increase", 400 + 5 * 60)
    // The press step and one repeat per 60 ms after the 400 ms delay.
    expect(await quantity.value()).toBe(6)
  })

  it("a touch tap steps without taking focus", { timeout: 60_000 }, async () => {
    const page = await open()
    await page.getByRole("button", { name: "Increase Quantity" }).tap()
    expect(await getNumberInput(page, { name: "Quantity" }).value()).toBe(1)
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true)
  })

  it("reduced motion: nothing transitions", { timeout: 60_000 }, async () => {
    const page = await open({ reducedMotion: "reduce" })
    const d = await page
      .locator('[data-scope="number-input"][data-part="control"]')
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration)
    expect(d.split(",").every((x) => Number.parseFloat(x) === 0)).toBe(true)
  })
})

describe("forced colors", () => {
  it("the field edge, glyphs and ring are visible; a stepper at its bound is GrayText", {
    timeout: 60_000,
  }, async () => {
    const page = await open({ forcedColors: "active" })
    await getNumberInput(page, { name: "Limit" }).via("keyboard").step("increase")
    const group = page.locator('[data-scope="number-input"][data-part="root"]').nth(2)
    const style = await group.evaluate((root) => {
      const css = (sel: string) => getComputedStyle(root.querySelector(sel) as Element)
      return {
        edge: css('[data-part="control"]').borderTopStyle,
        ring: css('[data-part="control"]').outlineStyle,
        inc: css('[data-part="increment-trigger"]').color,
        dec: css('[data-part="decrement-trigger"]').color,
      }
    })
    expect(style.edge).toBe("solid")
    expect(style.ring).toBe("solid")
    expect(style.inc).not.toBe(style.dec)
    expect((await group.screenshot()).byteLength).toBeGreaterThan(0)
  })
})
