/// <reference types="node" />
// Select through the Playwright adapter in Chromium and WebKit (RIND_BROWSERS picks the engines):
// the same driver test for pointer, keyboard and touch, plus what only a touch browser shows:
// a swipe on the trigger, tap-through, a finger scrolling the list, and flip placement. The page
// is bundled with rolldown from app.tsx.
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { type Browser, type BrowserType, chromium, type Page, webkit } from "playwright"
import { rolldown } from "rolldown"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { getSelect } from "../../src/index"

const here = import.meta.dirname
const themeSrc = join(here, "../../../theme/src")

/** index.css with its @imports inlined (fonts are not needed). */
function themeCss(file = join(themeSrc, "index.css")): string {
  return readFileSync(file, "utf8").replace(/@import\s+"(.+?)";/g, (_, path: string) =>
    path.includes("fonts") ? "" : themeCss(join(dirname(file), path)),
  )
}

const types: Record<string, BrowserType> = { chromium, webkit }
const engines = (process.env["RIND_BROWSERS"] ?? "chromium")
  .split(",")
  .filter((name) => name in types)

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

type Touch = "down" | "move" | "up" | "cancel"

describe.each(engines)("select driver through Playwright (%s)", (engine) => {
  let browser: Browser
  const pages: Page[] = []

  beforeAll(async () => {
    browser = await (types[engine] as BrowserType).launch()
  }, 60_000)
  afterAll(async () => {
    await browser?.close()
  })
  afterEach(async () => {
    for (const p of pages.splice(0)) await p.context().close()
  })

  async function open() {
    const context = await browser.newContext({
      hasTouch: true,
      viewport: { width: 500, height: 700 },
    })
    const page = await context.newPage()
    pages.push(page)
    await page.setContent(html)
    await page.getByRole("combobox", { name: "Fruit" }).waitFor()
    return page
  }

  /** One touch pointer event at (x, y) on whatever is there: a swipe the browser would have
   * turned into a scroll has no Playwright input, so the events are dispatched. */
  const touch = (page: Page, phase: Touch, x: number, y: number) =>
    page.evaluate(
      (o) => {
        const target = document.elementFromPoint(o.x, o.y) ?? document.body
        const down = o.phase === "down" || o.phase === "move"
        target.dispatchEvent(
          new PointerEvent(`pointer${o.phase}`, {
            bubbles: true,
            cancelable: o.phase !== "cancel",
            composed: true,
            pointerId: 7,
            pointerType: "touch",
            isPrimary: true,
            clientX: o.x,
            clientY: o.y,
            button: o.phase === "move" ? -1 : 0,
            buttons: down ? 1 : 0,
            pressure: down ? 0.5 : 0,
          }),
        )
      },
      { phase, x, y },
    )

  const centre = async (page: Page, role: "combobox" | "option", name: string) => {
    const box = await page.getByRole(role, { name, exact: true }).boundingBox()
    if (!box) throw new Error(`${name} has no layout`)
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  }
  for (const modality of ["pointer", "keyboard", "touch"] as const) {
    it(`Same test in Playwright: choose Banana (${modality})`, async () => {
      const page = await open()
      const s = getSelect(page, { name: "Fruit" }).via(modality)
      await s.choose("Banana")
      await expect.poll(() => s.isOpen()).toBe(false)
      await expect.poll(() => s.value()).toBe("Banana")
      expect(await s.formValue()).toBe("banana")
      expect(
        await page
          .getByRole("combobox", { name: "Fruit" })
          .evaluate((el) => el === document.activeElement),
      ).toBe(true)
    })
  }

  it("touch: a vertical swipe starting on the trigger does not open it", async () => {
    const page = await open()
    const s = getSelect(page, { name: "Fruit" })
    const { x, y } = await centre(page, "combobox", "Fruit")
    await touch(page, "down", x, y)
    await touch(page, "move", x, y - 60)
    // A scrolling browser cancels the pointer; the page scrolls instead.
    await touch(page, "cancel", x, y - 60)
    expect(await s.isOpen()).toBe(false)
    // A browser that does not cancel ends the swipe away from the trigger.
    await touch(page, "down", x, y)
    await touch(page, "move", x, y + 120)
    await touch(page, "up", x, y + 120)
    expect(await s.isOpen()).toBe(false)
    // The trigger still works afterwards.
    await s.via("touch").open()
    expect(await s.isOpen()).toBe(true)
  })

  it("touch: choosing an option closes the popup and the element under it gets no click", async () => {
    const page = await open()
    const s = getSelect(page, { name: "Fruit" }).via("touch")
    await s.open()
    await s.choose("Banana")
    await expect.poll(() => s.isOpen()).toBe(false)
    await expect.poll(() => s.value()).toBe("Banana")
    // Any synthesized click lands right after the pointer sequence; wait for a settled frame.
    await page.evaluate(
      () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
    )
    expect(await page.getByLabel("Clicks").textContent()).toBe("0")
  })

  it("touch: a finger dragging inside the list scrolls it and neither selects nor closes", async () => {
    const page = await open()
    const s = getSelect(page, { name: "Many" })
    await s.via("touch").open()
    const list = page.getByRole("listbox")
    expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true)
    const box = await list.boundingBox()
    if (!box) throw new Error("list has no layout")
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    const scrolled = () => list.evaluate((el) => el.scrollTop)

    // Real gesture where the engine has the input: Chromium's synthesized touch scroll.
    if (engine === "chromium") {
      const cdp = await page.context().newCDPSession(page)
      await cdp.send("Input.synthesizeScrollGesture", {
        x,
        y,
        yDistance: -100,
        gestureSourceType: "touch",
      })
      await expect.poll(scrolled).toBeGreaterThan(0)
    } else {
      // The browser scrolls the list under the finger, then cancels or ends the pointer.
      await touch(page, "down", x, y)
      await touch(page, "move", x, y - 60)
      await list.evaluate((el) => {
        el.scrollTop += 100
      })
      await touch(page, "cancel", x, y - 60)
      expect(await scrolled()).toBeGreaterThan(0)
    }
    // A drag that ends with pointerup over an option must not choose it either.
    const item = page.getByRole("option").nth(5)
    const ib = await item.boundingBox()
    if (!ib) throw new Error("option has no layout")
    const ix = ib.x + ib.width / 2
    const iy = ib.y + ib.height / 2
    await touch(page, "down", ix, iy)
    await touch(page, "move", ix, iy - 40)
    await touch(page, "up", ix, iy - 40)

    expect(await s.isOpen()).toBe(true)
    expect(await s.selected()).toEqual([])
    expect(await s.isPlaceholder()).toBe(true)
  })

  it("placement: a trigger 40 px above the viewport bottom opens the popup above", async () => {
    const page = await open()
    const trigger = page.getByRole("combobox", { name: "Low" })
    const box = await trigger.boundingBox()
    const vh = page.viewportSize()?.height ?? 0
    expect(box && vh - (box.y + box.height)).toBe(40)
    const s = getSelect(page, { name: "Low" })
    await s.open()
    await expect.poll(() => s.isPlaced()).toBe(true)
    await expect
      .poll(() =>
        page
          .locator('[data-scope="select"][data-part="content"]')
          .first()
          .getAttribute("data-side"),
      )
      .toBe("top")
  })
})
