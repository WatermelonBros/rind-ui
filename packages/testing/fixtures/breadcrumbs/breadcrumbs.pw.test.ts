/// <reference types="node" />
// Breadcrumbs through the Playwright adapter (tasks 4.2, 5.2, 6.1): the same driver calls as
// the Vitest suites, Chromium's accessibility tree (no separator nodes, the list size is the
// visible crumbs), the 24 px target and forced colors on the themed trail. The page is bundled
// here with rolldown from fixtures/breadcrumbs/app.tsx (Storybook is being retired).
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { type Browser, chromium, type Page } from "playwright"
import { rolldown } from "rolldown"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { getBreadcrumbs } from "../../src/index"

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
  await page.getByRole("navigation", { name: "Breadcrumbs" }).waitFor()
  return page
}

describe("breadcrumbs driver through Playwright", () => {
  it("Driver in both environments: current() resolves the last item", {
    timeout: 60_000,
  }, async () => {
    const page = await open()
    const d = getBreadcrumbs(page, { name: "Breadcrumbs" })
    expect(await d.current()).toEqual({ name: "Link", value: "page" })
    expect(await d.items()).toEqual(["Home", "Docs", "Link"])
    expect(await d.href("Docs")).toBe("#Docs")
  })

  it("collapsed: items, count, and following a collapsed item", { timeout: 60_000 }, async () => {
    const page = await open()
    const d = getBreadcrumbs(page, { name: "Long trail" })
    expect(await d.collapsedCount()).toBe(4)
    expect(await d.items()).toEqual(["Home", "Show 4 more breadcrumbs", "Page"])
    await d.followCollapsed("Guides")
    expect(page.url()).toMatch(/#Guides$/)
  })

  it("the accessibility tree has no separators; the list holds the visible crumbs", {
    timeout: 60_000,
  }, async () => {
    const page = await open()
    const snapshot = await page.getByRole("navigation", { name: "Breadcrumbs" }).ariaSnapshot()

    expect(snapshot).not.toContain("›")
    expect(snapshot.match(/- listitem/g)).toHaveLength(3)
    const long = await page.getByRole("navigation", { name: "Long trail" }).ariaSnapshot()
    expect(long.match(/- listitem/g)).toHaveLength(3)
    expect(long).toContain('button "Show 4 more breadcrumbs"')
  })
})

describe("breadcrumbs theme", () => {
  it("links meet the 24 px target; the trailing separator is hidden", {
    timeout: 60_000,
  }, async () => {
    const page = await open()
    const box = await page.getByRole("link", { name: "Docs" }).first().boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(24)
    const last = page.locator('[data-part="separator"][data-last]').first()
    expect(await last.isVisible()).toBe(false)
  })

  it("forced colors: links keep LinkText, the current item CanvasText", {
    timeout: 60_000,
  }, async () => {
    const page = await open({ forcedColors: "active" })
    const link = await page
      .getByRole("link", { name: "Docs" })
      .first()
      .evaluate((el) => getComputedStyle(el).color)
    const current = await page
      .getByText("Link", { exact: true })
      .first()
      .evaluate((el) => getComputedStyle(el).color)
    expect(link).not.toBe(current)
  })
})
