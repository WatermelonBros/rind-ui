/// <reference types="node" />
// Drawer through the Playwright adapter: the driver's swipe in real engines (touch and mouse),
// snap points, scroll before swipe, the indent, and the same velocity under a paused page clock.
// The page is bundled with rolldown from app.tsx.
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { type Browser, type BrowserType, chromium, type Page, webkit } from "playwright"
import { rolldown } from "rolldown"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { getDrawer, playwrightEnv } from "../../src/index"

const here = import.meta.dirname
const themeSrc = join(here, "../../../theme/src")
const engines: Record<string, BrowserType> = { chromium, webkit }
const wanted = (process.env["RIND_BROWSERS"] ?? "chromium").split(",").filter((n) => n in engines)

/** index.css with its @imports inlined (fonts are not needed). */
function themeCss(file = join(themeSrc, "index.css")): string {
  return readFileSync(file, "utf8").replace(/@import\s+"(.+?)";/g, (_, path: string) =>
    path.includes("fonts") ? "" : themeCss(join(dirname(file), path)),
  )
}

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
  html = `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${themeCss()}</style></head><body><div id="root"></div><script>${script}</script></body></html>`
}, 120_000)

const pages: Page[] = []
afterEach(async () => {
  for (const p of pages.splice(0)) await p.context().close()
})

for (const name of wanted) {
  describe(`drawer driver through Playwright (${name})`, () => {
    let browser: Browser
    beforeAll(async () => {
      browser = await (engines[name] as BrowserType).launch()
    }, 60_000)
    afterAll(async () => {
      await browser?.close()
    })

    async function open(fakeClock = false) {
      const context = await browser.newContext({
        hasTouch: true,
        viewport: { width: 400, height: 700 },
      })
      const page = await context.newPage()
      pages.push(page)
      if (fakeClock) await page.clock.install({ time: 1_000_000 })
      await page.setContent(html)
      await page.getByRole("button", { name: "Filters" }).waitFor()
      // Paused: the page's time moves only through `runFor` (the adapter's advance).
      if (fakeClock) await page.clock.pauseAt(2_000_000)
      const env = playwrightEnv(
        page,
        fakeClock ? { advanceTimers: (ms) => page.clock.runFor(ms) } : {},
      )
      return { page, env }
    }

    /** Opens Filters under the paused clock: the initial focus waits for frames. */
    async function openPaused(page: Page) {
      await trigger(page, "Filters").click()
      await expect
        .poll(async () => {
          // fake-time: one frame on the paused page clock (the initial focus runs in frames)
          await page.clock.runFor(16)
          return content(page).evaluate((e) => e.contains(document.activeElement))
        })
        .toBe(true)
    }

    const content = (page: Page) => page.locator('[data-scope="drawer"][data-part="content"]')
    const trigger = (page: Page, n: string) => page.getByRole("button", { name: n, exact: true })

    for (const [label, modality] of [
      ["touch", "touch"],
      ["pointer (mouse)", "pointer"],
    ] as const) {
      it(`Driver round trip: a swipe down closes with reason swipe (${label})`, async () => {
        const { page, env } = await open()
        const d = getDrawer(env, { name: "Filters" })
        await d.open()
        expect(await d.isOpen()).toBe(true)
        await d.via(modality).swipe("down", 300)
        expect(await d.isOpen()).toBe(false)
        expect(await d.closeReason()).toBe("swipe")
        await expect
          .poll(() => trigger(page, "Filters").evaluate((e) => e === document.activeElement))
          .toBe(true)
      })
    }

    it("a short drag (80 px) settles and stays open", async () => {
      const { page, env } = await open()
      const d = getDrawer(env, { name: "Filters" })
      await d.open()
      await d.via("touch").swipe("down", 80)
      expect(await d.isOpen()).toBe(true)
      await expect.poll(() => d.isSwiping()).toBe(false)
      expect(await content(page).evaluate((e) => e.hasAttribute("data-swiping"))).toBe(false)
    })

    it("pressHandle moves the snap point from 0 to 1 and stays open", async () => {
      const { env } = await open()
      const d = getDrawer(env, { name: "Sheet" })
      await d.open()
      expect(await d.snapPoint()).toBe("0")
      await d.via("keyboard").pressHandle()
      await expect.poll(() => d.snapPoint()).toBe("1")
      expect(await d.isOpen()).toBe(true)
    })

    it("a swipe up from 0.4 settles at 1", async () => {
      const { env } = await open()
      const d = getDrawer(env, { name: "Sheet" })
      await d.open()
      expect(await d.snapPoint()).toBe("0")
      await d.via("touch").swipe("up", 300)
      await expect.poll(() => d.snapPoint()).toBe("1")
      expect(await d.isOpen()).toBe(true)
    })

    describe("same velocity in both environments (clock paused)", () => {
      it("the driver's swipe down closes with reason swipe", async () => {
        const { page, env } = await open(true)
        const d = getDrawer(env, { name: "Filters" })
        await openPaused(page)
        await d.via("touch").swipe("down", 300)
        expect(await d.isOpen()).toBe(false)
        expect(await d.closeReason()).toBe("swipe")
      })

      /** A 60 px mouse drag down taking `ms` of page time (the clock steps with the mouse). */
      async function flick(page: Page, ms: number) {
        const box = await content(page).boundingBox()
        if (!box) throw new Error("no content box")
        const x = box.x + box.width / 2
        const y = box.y + 40
        await page.mouse.move(x, y)
        await page.mouse.down()
        for (let i = 1; i <= 6; i++) {
          // fake-time: the drag's duration is the velocity under test
          await page.clock.runFor(ms / 6)
          await page.mouse.move(x, y + 10 * i)
        }
        await page.mouse.up()
      }

      it("60 px in 60 ms (1 px/ms, over the 0.5 threshold) closes", async () => {
        const { page, env } = await open(true)
        const d = getDrawer(env, { name: "Filters" })
        await openPaused(page)
        await flick(page, 60)
        await expect.poll(() => d.isOpen()).toBe(false)
        expect(await d.closeReason()).toBe("swipe")
      })

      it("60 px in 600 ms does not close", async () => {
        const { page, env } = await open(true)
        const d = getDrawer(env, { name: "Filters" })
        await openPaused(page)
        await flick(page, 600)
        await expect.poll(() => d.isSwiping()).toBe(false)
        expect(await d.isOpen()).toBe(true)
      })
    })

    it("scroll comes first: a touch drag down on a scrolled list keeps the drawer open", async () => {
      const { page, env } = await open()
      const d = getDrawer(env, { name: "Filters" })
      await d.open()
      await content(page).evaluate((el) => {
        el.scrollTop = (el.scrollHeight - el.clientHeight) / 2
      })
      const before = await content(page).evaluate((el) => el.scrollTop)
      expect(before).toBeGreaterThan(0)
      if (name === "chromium") {
        // A real touch drag, so the browser itself scrolls (synthetic events never do).
        const box = await content(page).boundingBox()
        if (!box) throw new Error("no content box")
        const cdp = await page.context().newCDPSession(page)
        const x = box.x + box.width / 2
        const y = box.y + box.height / 2
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] })
        for (let i = 1; i <= 8; i++)
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x, y: y + 12 * i }],
          })
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
        await expect.poll(() => content(page).evaluate((el) => el.scrollTop)).toBeLessThan(before)
      } else {
        await d.via("touch").swipe("down", 100)
      }
      expect(await d.isOpen()).toBe(true)
      await expect.poll(() => d.isSwiping()).toBe(false)
    })

    it("the indent is active while Filters is open", async () => {
      const { page, env } = await open()
      const active = () => page.getByTestId("indent").evaluate((e) => e.hasAttribute("data-active"))
      expect(await active()).toBe(false)
      const d = getDrawer(env, { name: "Filters" })
      await d.open()
      await expect.poll(active).toBe(true)
      await d.via("keyboard").close()
      await expect.poll(active).toBe(false)
    })

    // WebKit moves focus from the focused close trigger to the content on mousedown: that
    // blur is the press's own and must not cancel it.
    it("a mouse click on the focused close trigger closes", async () => {
      const { page, env } = await open()
      const d = getDrawer(env, { name: "Filters" })
      await d.open()
      await expect.poll(() => content(page).evaluate((e) => e.getAnimations().length)).toBe(0)
      await page.getByRole("button", { name: "Done" }).click()
      await expect.poll(() => d.isOpen(), { timeout: 3000 }).toBe(false)
      expect(await d.closeReason()).toBe("close-trigger")
    })
  })
}
