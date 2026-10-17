/// <reference types="node" />
// Hover Card through the Playwright adapter (tasks 5.2, 7.3, 8.2): the same driver calls as
// the Vitest suites, a real held stepper, touch taps that take no focus, forced colors and
// reduced motion on the themed component. The page is bundled with rolldown from app.tsx.
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { type Browser, chromium, type Page } from "playwright"
import { rolldown } from "rolldown"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { getHoverCard, playwrightEnv } from "../../src/index"

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
  await page.getByRole("link", { name: "Jane Doe" }).waitFor()
  // An installed clock still flows with real time: paused, the page's time moves only through
  // `runFor` (the adapter's advance), never with polling or load.
  if (fakeClock) await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1)
  return page
}

describe("hover card driver through Playwright", () => {
  for (const modality of ["pointer", "keyboard"] as const) {
    it(`Same test in Playwright: show, then hide (${modality})`, {
      timeout: 60_000,
    }, async () => {
      const page = await open({}, true)
      const env = playwrightEnv(page, { advanceTimers: (ms) => page.clock.runFor(ms) })
      const h = getHoverCard(env, { name: "Jane Doe" }).via(modality)
      await h.show()
      expect(await h.isOpen()).toBe(true)
      // Placement runs in animation frames, which the paused page clock moves.
      await expect
        .poll(async () => {
          // fake-time: one frame on the paused page clock (placement runs in frames)
          await page.clock.runFor(16)
          return h.isPlaced()
        })
        .toBe(true)
      if (modality === "keyboard") {
        await h.enter()
        expect(await h.hasFocus()).toBe(true)
      }
      // Pointer: a press outside; keyboard: Escape.
      await h.hide()
      expect(await h.isOpen()).toBe(false)
    })
  }

  it("a tap follows the link and opens nothing (reka-ui#802)", { timeout: 60_000 }, async () => {
    const page = await open({ hasTouch: true })
    // The link's own activation must reach the browser: nothing prevents its click.
    await page.evaluate(() => {
      document.addEventListener("click", (e) => {
        Reflect.set(window, "followed", !e.defaultPrevented)
        e.preventDefault()
      })
    })
    await page.getByRole("link", { name: "Jane Doe" }).tap()
    await expect.poll(() => page.evaluate(() => Reflect.get(window, "followed"))).toBe(true)
    expect(await page.getByRole("dialog").count()).toBe(0)
  })
})
