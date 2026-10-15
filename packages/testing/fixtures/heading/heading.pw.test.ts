/// <reference types="node" />
// Heading through the Playwright adapter, against the built Storybook: the driver, the
// accessibility level, computed sizes per level and the generic invariants on every story.
import { createReadStream, existsSync } from "node:fs"
import { createServer, type Server } from "node:http"
import { extname, join, normalize } from "node:path"
import { headingContract } from "@rind-ui/core"
import { type Browser, chromium, type Page } from "playwright"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { checkGeneric, createDriverWith, playwrightEnv } from "../../src/index"

const root = join(import.meta.dirname, "../../../../apps/storybook/storybook-static")
const types: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
}

let server: Server
let browser: Browser
let base = ""

beforeAll(async () => {
  if (!existsSync(root))
    throw new Error("Build Storybook first: pnpm --filter @rind-ui/storybook build")
  server = createServer((req, res) => {
    const path = normalize(decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/"))
    const file = join(root, path.endsWith("/") ? `${path}index.html` : path)
    if (!file.startsWith(root) || !existsSync(file)) {
      res.writeHead(404).end()
      return
    }
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" })
    createReadStream(file).pipe(res)
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`
  browser = await chromium.launch()
}, 60_000)

afterAll(async () => {
  await browser?.close()
  server?.close()
})

const pages: Page[] = []
async function open(id: string) {
  const context = await browser.newContext()
  const page = await context.newPage()
  pages.push(page)
  await page.goto(`${base}/iframe.html?id=components-heading--${id}&viewMode=story`)
  await page.locator('[data-scope="heading"]').first().waitFor()
  return page
}
afterEach(async () => {
  for (const page of pages.splice(0)) await page.context().close()
})

const size = (page: Page, level: number) =>
  page
    .getByRole("heading", { level })
    .first()
    .evaluate((el) => {
      const s = getComputedStyle(el)
      return { size: Number.parseFloat(s.fontSize), weight: Number(s.fontWeight) }
    })

describe("heading driver through Playwright", () => {
  it("Same test in Playwright: level of a nested heading", { timeout: 60_000 }, async () => {
    const page = await open("nested-sections")
    const heading = createDriverWith(headingContract, page, [{ name: "Profile" }])
    expect(await heading.level()).toBe(3)
  })

  it("several matches fail naming the count (3 in CardTitles with the heading above)", {
    timeout: 60_000,
  }, async () => {
    const page = await open("card-titles")
    const heading = createDriverWith(headingContract, page, [{ name: /./ }])
    await expect(heading.level()).rejects.toThrow(/heading: 3 elements match the anchor/)
  })

  it("level 2 on an h4 is exposed at level 2 in Chromium's tree", { timeout: 60_000 }, async () => {
    const page = await open("as-h-4")
    // Playwright's role locator reads the tag; the browser's own tree is what a screen reader gets.
    const cdp = await page.context().newCDPSession(page)
    await cdp.send("Accessibility.enable")
    const { nodes } = (await cdp.send("Accessibility.getFullAXTree")) as {
      nodes: {
        role?: { value?: string }
        name?: { value?: string }
        properties?: { name: string; value: { value: unknown } }[]
      }[]
    }
    const node = nodes.find(
      (n) => n.role?.value === "heading" && n.name?.value === "Level 2 on an h4",
    )
    expect(node?.properties?.find((p) => p.name === "level")?.value.value).toBe(2)
  })
})

describe("heading size follows the level, not the tag (adobe/react-spectrum#7671)", () => {
  it("Playwright captures per level and with a size override", { timeout: 60_000 }, async () => {
    const page = await open("nested-sections")
    // The theme styles on `data-level`: one probe per level, in the page's own cascade.
    const sizes = await page.evaluate(() =>
      [1, 2, 3, 4, 5, 6].map((n) => {
        const el = document.createElement(`h${n}`)
        el.setAttribute("data-scope", "heading")
        el.setAttribute("data-part", "root")
        el.setAttribute("data-level", String(n))
        document.body.append(el)
        return Number.parseFloat(getComputedStyle(el).fontSize)
      }),
    )
    for (let i = 1; i < sizes.length; i++)
      expect(sizes[i], `h${i + 1} <= h${i}`).toBeLessThanOrEqual(sizes[i - 1] ?? 0)
    expect(sizes[0]).toBeGreaterThan(sizes[5] ?? 0)
  })

  it("an overridden h2 has the h4 size and is still level 2", { timeout: 60_000 }, async () => {
    const nested = await open("nested-sections")
    const h4 = (await size(nested, 4)).size
    const page = await open("size-override")
    const card = page.getByRole("heading", { level: 2, name: "Card title" })
    const normal = page.getByRole("heading", { level: 2, name: "Normal title" })
    const px = (l: typeof card) =>
      l.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize))
    expect(await px(card)).toBe(h4)
    expect(await px(normal)).toBeGreaterThan(h4)
  })
})

const STORIES = [
  "nested-sections",
  "anchored-root",
  "card-titles",
  "in-popover",
  "as-div",
  "as-h-4",
  "depth-warning",
  "size-override",
  "driver-example",
]

describe("generic invariants on every Heading story", () => {
  for (const id of STORIES) {
    it(id, { timeout: 60_000 }, async () => {
      const page = await open(id)
      // Only Heading parts: a consumer's own `h3` (CardTitles) has no instance to anchor on.
      const headings = await page.locator('[data-scope="heading"]').all()
      expect(headings.length, `${id}: no headings`).toBeGreaterThan(0)
      for (const el of headings) {
        const name = (await el.textContent())?.trim() ?? ""
        expect(name, `${id}: a heading without a name`).not.toBe("")
        const env = playwrightEnv(page).create({
          scope: "heading",
          anchor: { text: name },
          modality: "virtual",
        })
        const snap = await env.collect()
        const problems = checkGeneric({
          before: null,
          after: snap,
          baseline: snap,
          from: null,
          state: "static",
          expected: () => ({}),
          open: false,
          atInitial: true,
          anchorCount: await env.anchorCount(),
          errors: await env.takeErrors(),
          traits: [],
          semantics: {},
          values: {},
        })
        expect(problems, `${id} / ${name}`).toEqual([])
      }
    })
  }
})
