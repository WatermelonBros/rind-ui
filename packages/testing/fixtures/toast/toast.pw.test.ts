/// <reference types="node" />
// Toast through the Playwright adapter: swipe (touch and mouse) with its dismiss reason, excluded
// directions, F6 in and out, the timeout and hover pause under the page clock, and the region
// above a modal Dialog. The page is bundled with rolldown from app.tsx.
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { type Browser, type BrowserType, chromium, type Page, webkit } from "playwright"
import { rolldown } from "rolldown"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { getToast, playwrightEnv } from "../../src/index"

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

type Variant = "default" | "restricted" | "dialog"
type Show = { title: string; duration?: number; action?: { label: string } }

for (const name of wanted) {
  describe(`toast driver through Playwright (${name})`, () => {
    let browser: Browser
    beforeAll(async () => {
      browser = await (engines[name] as BrowserType).launch()
    }, 60_000)
    afterAll(async () => {
      await browser?.close()
    })

    async function open(variant: Variant = "default", fakeClock = false) {
      const context = await browser.newContext({
        hasTouch: true,
        viewport: { width: 500, height: 700 },
      })
      const page = await context.newPage()
      pages.push(page)
      if (fakeClock) await page.clock.install({ time: 1_000_000 })
      // setContent does not rerun init scripts: the variant rides in the page itself.
      await page.setContent(
        html.replace("<script>", `<script>window.__variant=${JSON.stringify(variant)};`),
      )
      await page.getByRole("button", { name: "Show saved" }).waitFor()
      if (fakeClock) await page.clock.pauseAt(2_000_000)
      const env = playwrightEnv(
        page,
        fakeClock ? { advanceTimers: (ms) => page.clock.runFor(ms) } : {},
      )
      return { page, env }
    }

    /** Shows a toast and records its dismiss reason in `window.__log`. */
    const show = (page: Page, data: Show) =>
      page.evaluate((d) => {
        const w = window as unknown as { __log?: string[]; store: { show: (x: object) => void } }
        w.__log = []
        const action = d.action && { ...d.action, onAction: () => w.__log?.push("onAction") }
        w.store.show({ ...d, action, onDismiss: (r: string) => w.__log?.push(r) })
      }, data)
    const log = (page: Page) =>
      page.evaluate(() => (window as unknown as { __log?: string[] }).__log ?? [])
    const item = (page: Page, n: string) => page.getByRole("listitem", { name: n })

    for (const modality of ["touch", "pointer"] as const) {
      it(`a swipe right dismisses with reason swipe (${modality})`, async () => {
        const { page, env } = await open()
        await show(page, { title: "Saved" })
        await item(page, "Saved").waitFor()
        await getToast(env, { name: "Saved" }).via(modality).swipe("right")
        await expect.poll(() => item(page, "Saved").count()).toBe(0)
        expect(await log(page)).toEqual(["swipe"])
      })
    }

    it("a flick in an excluded direction (left) keeps the toast", async () => {
      const { page, env } = await open("restricted")
      await show(page, { title: "Saved" })
      await item(page, "Saved").waitFor()
      await getToast(env, { name: "Saved" }).via("touch").swipe("left")
      await expect.poll(() => item(page, "Saved").getAttribute("data-swiping")).toBe(null)
      expect(await item(page, "Saved").count()).toBe(1)
      expect(await log(page)).toEqual([])
    })

    it("F6 from the input focuses the newest toast; F6 again returns to the input", async () => {
      const { page } = await open()
      await page.evaluate(() => {
        window.store.show("Older")
        window.store.show("Newer")
      })
      await item(page, "Newer").waitFor()
      const focused = () =>
        page.evaluate(() => {
          const a = document.activeElement
          return a?.tagName === "INPUT" ? "input" : (a?.textContent ?? "")
        })
      await page.getByRole("textbox", { name: "Name" }).focus()
      await page.keyboard.press("F6")
      await expect.poll(focused).toContain("Newer")
      await page.keyboard.press("F6")
      await expect.poll(focused).toBe("input")
    })

    describe("timeout under the page clock", () => {
      it("a 3000 ms toast dismisses only after 3000 ms of clock time", async () => {
        const { page } = await open("default", true)
        await show(page, { title: "Saved", duration: 3000 })
        await item(page, "Saved").waitFor()
        // fake-time: just under the toast's 3000 ms lifetime
        await page.clock.runFor(2500)
        expect(await item(page, "Saved").count()).toBe(1)
        // fake-time: past the 3000 ms lifetime
        await page.clock.runFor(700)
        await expect.poll(() => item(page, "Saved").count()).toBe(0)
        expect(await log(page)).toEqual(["timeout"])
      })

      it("hovering the region pauses the timeout", async () => {
        const { page } = await open("default", true)
        await show(page, { title: "Saved", duration: 3000 })
        await item(page, "Saved").waitFor()
        await item(page, "Saved").hover()
        // fake-time: well past 3000 ms while hovered
        await page.clock.runFor(10_000)
        expect(await item(page, "Saved").count()).toBe(1)
        await page.mouse.move(2, 2)
        // fake-time: the remaining lifetime after the pointer leaves
        await page.clock.runFor(4000)
        await expect.poll(() => item(page, "Saved").count()).toBe(0)
      })
    })

    it("above a modal Dialog, Undo is clickable and the dialog stays open", async () => {
      const { page } = await open("dialog")
      await show(page, { title: "Archived", action: { label: "Undo" } })
      await item(page, "Archived").waitFor()
      await page.getByRole("button", { name: "Undo" }).click()
      await expect.poll(() => item(page, "Archived").count()).toBe(0)
      expect(await log(page)).toEqual(["onAction", "action"])
      expect(await page.getByRole("dialog", { name: "Settings" }).isVisible()).toBe(true)
    })
  })
}
