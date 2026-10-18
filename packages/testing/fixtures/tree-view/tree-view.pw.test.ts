/// <reference types="node" />
// Tree View through the Playwright adapter (tasks 4.2, 6.2): the same driver calls as the
// Vitest suites (name paths with a repeated name), and forced colors on the themed tree. The
// page is bundled here with rolldown from fixtures/tree-view/app.tsx.
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { type Browser, chromium, firefox, type Page, webkit } from "playwright"
import { rolldown } from "rolldown"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { getTreeView } from "../../src/index"

const here = import.meta.dirname
const themeSrc = join(here, "../../../theme/src")

/** index.css with its @imports inlined (fonts are not needed). */
function themeCss(file = join(themeSrc, "index.css")): string {
  return readFileSync(file, "utf8").replace(/@import\s+"(.+?)";/g, (_, path: string) =>
    path.includes("fonts") ? "" : themeCss(join(dirname(file), path)),
  )
}

const engines = [chromium, firefox, webkit].filter((e) =>
  (process.env["RIND_BROWSERS"] ?? "chromium,firefox,webkit").split(",").includes(e.name()),
)
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
  for (const engine of engines) browsers.push(await engine.launch())
}, 120_000)

afterAll(async () => {
  for (const b of browsers) await b.close()
})

const pages: Page[] = []
afterEach(async () => {
  for (const p of pages.splice(0)) await p.context().close()
})

async function open(browser: Browser, options: Parameters<Browser["newContext"]>[0] = {}) {
  const context = await browser.newContext(options)
  const page = await context.newPage()
  pages.push(page)
  await page.setContent(html)
  await page.getByRole("tree", { name: "Files" }).waitFor()
  return page
}

describe("tree view driver through Playwright", () => {
  for (const [i, engine] of engines.entries()) {
    it(`${engine.name()}: name paths (a repeated name), act, collapse`, {
      timeout: 60_000,
    }, async () => {
      const browser = browsers[i] as Browser
      const page = await open(browser)
      const t = getTreeView(page, { name: "Files" })
      expect(await page.getByRole("treeitem", { name: "src" }).getAttribute("tabindex")).toBe("0")
      // "index.ts" exists in both folders: the path picks the one under "docs".
      await t.act(["docs", "index.ts"])
      expect(await page.evaluate(() => window.actions)).toEqual(["index.ts-docs"])
      expect(await t.isExpanded("docs")).toBe(true)
      await t.collapse("docs")
      expect(await t.expandedNames()).toEqual([])
    })
  }

  it("forced colors: the selected, highlighted row keeps a visible ring and fill", {
    timeout: 60_000,
  }, async () => {
    const browser = browsers[0] as Browser
    const page = await open(browser, { forcedColors: "active" })
    const t = getTreeView(page, { name: "Files" })
    await t.expand("src")
    const row = page.getByRole("treeitem", { name: "a.ts" })
    await row.focus()
    await page.keyboard.press("ArrowDown")
    await page.keyboard.press("ArrowUp")
    const style = await row.evaluate((el) => {
      const s = getComputedStyle(el)
      return { outline: s.outlineStyle, bg: s.backgroundColor }
    })
    expect(style.outline).toBe("solid")
    expect(style.bg).not.toBe("rgba(0, 0, 0, 0)")
  })
})
