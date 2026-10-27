/// <reference types="node" />
// Menu through the Playwright adapter: the same driver calls as the Vitest suites, plus forced
// colors and reduced motion on the themed component. The page is bundled with rolldown from app.tsx.
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { type Browser, chromium, type Page } from "playwright"
import { rolldown } from "rolldown"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { getContextMenu, getMenu } from "../../src/index"

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

async function open(options: Parameters<Browser["newContext"]>[0] = {}) {
  const context = await browser.newContext(options)
  const page = await context.newPage()
  pages.push(page)
  await page.setContent(html)
  await page.getByRole("button", { name: "Encoding" }).waitFor()
  return page
}

const last = (page: Page) => page.getByLabel("Last")

describe("menu driver through Playwright", () => {
  for (const modality of ["pointer", "keyboard"] as const) {
    it(`Same test in Playwright: Encoding > Reopen with > UTF-16 (${modality})`, {
      timeout: 60_000,
    }, async () => {
      const page = await open()
      const m = getMenu(page, { name: "Encoding" }).via(modality)
      await m.open()
      await m.openSubmenu("Reopen with")
      await m.choose("UTF-16")
      await expect.poll(() => m.isOpen()).toBe(false)
      await expect.poll(() => last(page).textContent()).toBe("UTF-16")
    })
  }

  it("keyboard: ArrowDown wraps; Escape restores focus to the trigger", {
    timeout: 60_000,
  }, async () => {
    const page = await open()
    const m = getMenu(page, { name: "Encoding" }).via("keyboard")
    await m.open()
    expect(await m.focusedItem()).toBe("Save with encoding")
    await m.arrowDown()
    expect(await m.focusedItem()).toBe("Reopen with")
    await m.arrowDown()
    expect(await m.focusedItem()).toBe("Save with encoding")
    await m.pressEscape()
    await expect.poll(() => m.isOpen()).toBe(false)
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.textContent?.trim()))
      .toBe("Encoding")
  })

  it("a checkbox toggle keeps the menu open", { timeout: 60_000 }, async () => {
    const page = await open()
    const m = getMenu(page, { name: "View" }).via("pointer")
    await m.open()
    await m.toggle("Minimap")
    await expect.poll(() => m.isChecked("Minimap")).toBe(true)
    expect(await m.isOpen()).toBe(true)
    await expect.poll(() => last(page).textContent()).toBe("Minimap:true")
    expect(await m.isDisabled("Reset")).toBe(true)
  })

  it("reduced motion: the content does not transition", { timeout: 60_000 }, async () => {
    const page = await open({ reducedMotion: "reduce" })
    const m = getMenu(page, { name: "Encoding" })
    await m.open()
    const d = await page
      .locator('[data-scope="menu"][data-part="content"]')
      .first()
      .evaluate((el) => {
        const s = getComputedStyle(el)
        return [s.transitionDuration, s.animationDuration].join(",")
      })
    expect(d.split(",").every((x) => Number.parseFloat(x) === 0)).toBe(true)
  })
})

describe("context menu driver through Playwright", () => {
  for (const modality of ["pointer", "keyboard", "virtual"] as const) {
    it(`Same test in Playwright: openAt, choose Rename (${modality})`, {
      timeout: 60_000,
    }, async () => {
      const page = await open()
      const c = getContextMenu(page, { text: "notes.txt" }).via(modality)
      await c.openAt()
      await c.choose("Rename")
      await expect.poll(() => c.isOpen()).toBe(false)
      await expect.poll(() => last(page).textContent()).toBe("Rename")
    })
  }

  it("a real right click prevents the browser's menu and opens at the pointer", {
    timeout: 60_000,
  }, async () => {
    const page = await open()
    const region = page.getByText("notes.txt")
    const box = await region.boundingBox()
    if (!box) throw new Error("no box")
    await page.mouse.click(box.x + 30, box.y + 20, { button: "right" })
    const content = page.getByRole("menu", { name: "File actions" })
    await content.waitFor()
    // Within a pixel: the positioner snaps to device pixels, so rounding each side alone can
    // land a half-pixel origin on either neighbour (339 vs 340).
    await expect
      .poll(async () => {
        const b = await content.boundingBox()
        return b ? Math.max(Math.abs(b.x - (box.x + 30)), Math.abs(b.y - (box.y + 20))) : null
      })
      .toBeLessThanOrEqual(1)
  })
})

describe("forced colors", () => {
  it("the highlighted item and the separator stay visible", { timeout: 60_000 }, async () => {
    const page = await open({ forcedColors: "active" })
    const m = getMenu(page, { name: "View" }).via("keyboard")
    await m.open()
    await m.arrowDown()
    await expect.poll(() => m.highlighted()).not.toBeNull()
    const item = page.locator('[data-scope="menu"][data-highlighted]').first()
    const style = await item.evaluate((el) => {
      const s = getComputedStyle(el)
      return { outline: s.outlineStyle, bg: s.backgroundColor }
    })
    // menu.css: Highlight background plus a 2px outline.
    expect(style.outline).not.toBe("none")
    const sep = page.locator('[data-scope="menu"][data-part="separator"]').first()
    const box = await sep.boundingBox()
    expect(box?.height).toBeGreaterThan(0)
    expect(box?.width).toBeGreaterThan(0)
  })
})
