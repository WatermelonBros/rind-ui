/// <reference types="node" />
// Pagination through the Playwright adapter (tasks 4.2, 5.3): the same driver calls as the
// Vitest suites, and link mode in Chromium, Firefox and WebKit — a ⌘/Ctrl click and a middle
// click leave the page as it is, Enter follows the link once. The page is served from a
// routed origin so links resolve; it is bundled here with rolldown from app.tsx.
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { type Browser, chromium, firefox, type Page, webkit } from "playwright"
import { rolldown } from "rolldown"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { getPagination } from "../../src/index"

const here = import.meta.dirname
const themeSrc = join(here, "../../../theme/src")
const ORIGIN = "http://rind.test"

/** index.css with its @imports inlined (fonts are not needed). */
function themeCss(file = join(themeSrc, "index.css")): string {
  return readFileSync(file, "utf8").replace(/@import\s+"(.+?)";/g, (_, path: string) =>
    path.includes("fonts") ? "" : themeCss(join(dirname(file), path)),
  )
}

const engines = { chromium, firefox, webkit }
const browsers: Partial<Record<keyof typeof engines, Browser>> = {}
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
  for (const [name, engine] of Object.entries(engines)) {
    browsers[name as keyof typeof engines] = await engine.launch()
  }
}, 120_000)

afterAll(async () => {
  for (const b of Object.values(browsers)) await b?.close()
})

const pages: Page[] = []
afterEach(async () => {
  for (const p of pages.splice(0)) await p.context().close()
})

/** Opens the app at `path`; every document request under the origin is counted. */
async function open(engine: keyof typeof engines, path = "/") {
  const browser = browsers[engine]
  if (!browser) throw new Error(`${engine} did not launch`)
  const context = await browser.newContext()
  const requests: string[] = []
  await context.route(`${ORIGIN}/**`, (route) => {
    if (route.request().resourceType() === "document") requests.push(route.request().url())
    return route.fulfill({ contentType: "text/html", body: html })
  })
  const page = await context.newPage()
  pages.push(page)
  await page.goto(`${ORIGIN}${path}`)
  await page.getByRole("navigation", { name: "Posts" }).waitFor()
  return { page, context, requests }
}

const current = (page: Page, name: string) =>
  page.getByRole("navigation", { name }).locator('[aria-current="page"]').getAttribute("data-value")

describe("pagination driver through Playwright", () => {
  it("Driver in both environments: next() then currentPage() is 2", {
    timeout: 60_000,
  }, async () => {
    const { page } = await open("chromium")
    const p = getPagination(page, { name: "Results" })
    await p.next()
    expect(await p.currentPage()).toBe(2)
    await p.via("keyboard").goTo(4)
    expect(await p.currentPage()).toBe(4)
  })
})

describe.each(Object.keys(engines) as (keyof typeof engines)[])("link mode in %s", (engine) => {
  it("a modifier click opens elsewhere: not prevented, the page stays", {
    timeout: 60_000,
  }, async () => {
    const { page } = await open(engine)
    const link = page.getByRole("link", { name: "Page 3" })
    expect(await link.getAttribute("href")).toBe("/posts?page=3")
    // Record whether anything prevented the click, without preventing it ourselves.
    await page.evaluate(() => {
      document.addEventListener("click", (e) => {
        document.body.dataset["prevented"] = String(e.defaultPrevented)
      })
    })
    await link.click({ modifiers: ["ControlOrMeta"] })
    await expect.poll(() => page.evaluate(() => document.body.dataset["prevented"])).toBe("false")
    expect(await current(page, "Posts")).toBe("1")
    expect(await page.evaluate(() => window.changes)).toEqual([])
    expect(new URL(page.url()).search).toBe("")
  })

  // Headless WebKit under Playwright follows a middle click in the same tab even on a bare
  // <a> without script (checked with a plain anchor): not the pagination's behaviour.
  it.skipIf(engine === "webkit")(
    "a middle click leaves the page as it is",
    {
      timeout: 60_000,
    },
    async () => {
      const { page } = await open(engine)
      await page.getByRole("link", { name: "Page 3" }).click({ button: "middle" })
      expect(await current(page, "Posts")).toBe("1")
      expect(await page.evaluate(() => window.changes)).toEqual([])
      expect(new URL(page.url()).search).toBe("")
    },
  )

  it("Enter on a link follows it once", { timeout: 60_000 }, async () => {
    const { page, requests } = await open(engine)
    const link = page.getByRole("link", { name: "Page 3" })
    await link.focus()
    await Promise.all([page.waitForURL(`${ORIGIN}/posts?page=3`), page.keyboard.press("Enter")])
    await page.getByRole("navigation", { name: "Posts" }).waitFor()
    expect(requests.filter((u) => u.endsWith("/posts?page=3"))).toHaveLength(1)
    expect(await current(page, "Posts")).toBe("3")
  })
})
