/// <reference types="node" />
// Tag Group through the Playwright adapter (tasks 4.2, 6.2): the same driver calls as the
// Vitest suites in Chromium, Firefox and WebKit, locating by the role set, and the
// forced-colors capture of a focused, selected tag. The page is bundled here with rolldown
// from fixtures/tag-group/app.tsx.
import { mkdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { type Browser, type BrowserType, chromium, firefox, type Page, webkit } from "playwright"
import { rolldown } from "rolldown"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { getTagGroup } from "../../src/index"

const here = import.meta.dirname
const themeSrc = join(here, "../../../theme/src")
const captures = join(here, "../../../../.vitest/attachments/captures")

/** index.css with its @imports inlined (fonts are not needed). */
function themeCss(file = join(themeSrc, "index.css")): string {
  return readFileSync(file, "utf8").replace(/@import\s+"(.+?)";/g, (_, path: string) =>
    path.includes("fonts") ? "" : themeCss(join(dirname(file), path)),
  )
}

let html = ""
const browsers = new Map<string, Browser>()

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
  for (const b of browsers.values()) await b.close()
})

const pages: Page[] = []
afterEach(async () => {
  for (const p of pages.splice(0)) await p.context().close()
})

async function open(type: BrowserType, options: Parameters<Browser["newContext"]>[0] = {}) {
  let browser = browsers.get(type.name())
  if (!browser) {
    browser = await type.launch()
    browsers.set(type.name(), browser)
  }
  const context = await browser.newContext(options)
  const page = await context.newPage()
  pages.push(page)
  await page.setContent(html)
  await page.getByRole("grid", { name: "Cities" }).waitFor()
  return page
}

for (const type of [chromium, firefox, webkit]) {
  describe(`tag group driver through Playwright (${type.name()})`, () => {
    it("remove by keyboard: gone, focus on the neighbour", { timeout: 60_000 }, async () => {
      const page = await open(type)
      const cities = getTagGroup(page, { name: "Cities" }, { modality: "keyboard" })
      await cities.remove("Rome")
      expect(await cities.tags()).toEqual(["Paris", "Oslo"])
      expect(await cities.focusedItem()).toBe("Paris")
    })

    it("remove by pointer, then the selection with Delete; the empty group is still found", {
      timeout: 60_000,
    }, async () => {
      const page = await open(type)
      const cities = getTagGroup(page, { name: "Cities" })
      await cities.remove("Oslo")
      expect(await cities.tags()).toEqual(["Rome", "Paris"])
      await cities.removeSelected()
      expect(await cities.tags()).toEqual(["Rome"])
      await getTagGroup(page, { name: "Cities" }, { modality: "keyboard" }).remove("Rome")
      expect(await cities.isEmpty()).toBe(true)
      expect(await page.getByRole("group", { name: "Cities" }).count()).toBe(1)
    })
  })
}

describe("tag group theme captures", () => {
  it("forced colors: a focused, selected tag keeps its ring and selection", {
    timeout: 60_000,
  }, async () => {
    const page = await open(chromium, { forcedColors: "active" })
    await page.getByRole("button", { name: "Before" }).focus()
    await page.keyboard.press("Tab")
    const tag = page.getByRole("row", { name: "Paris" })
    const style = await tag.evaluate((el) => {
      const s = getComputedStyle(el)
      return { outline: s.outlineStyle, border: s.borderTopWidth }
    })
    expect(style.outline).not.toBe("none")
    expect(Number.parseFloat(style.border)).toBeGreaterThan(1)
    mkdirSync(captures, { recursive: true })
    await page.screenshot({ path: join(captures, "tag-group-forced-colors.png") })
  })
})
