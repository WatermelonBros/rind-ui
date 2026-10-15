/// <reference types="node" />
// Separator through the Playwright adapter, against the built Storybook: the driver, the
// browser accessibility tree, forced colors and the no-tone rule.
import { createReadStream, existsSync, mkdirSync } from "node:fs"
import { createServer, type Server } from "node:http"
import { extname, join, normalize } from "node:path"
import { separatorContract } from "@rind-ui/core"
import { type Browser, chromium, type Page } from "playwright"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { createDriverWith } from "../../src/index"

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
  await page.goto(`${base}/iframe.html?id=components-separator--${id}&viewMode=story`)
  await page.locator('[data-scope="separator"]').first().waitFor()
  return page
}
afterEach(async () => {
  for (const page of pages.splice(0)) await page.context().close()
})

const captures = join(import.meta.dirname, "../../../../.vitest/attachments/captures")

describe("separator driver through Playwright", () => {
  it("Same test in Playwright: a toolbar separator is vertical and exposed", {
    timeout: 60_000,
  }, async () => {
    const page = await open("in-toolbar")
    const s = createDriverWith(separatorContract, page.getByRole("toolbar"), [{}])
    expect(await s.orientation()).toBe("vertical")
    expect(await s.isDecorative()).toBe(false)
    expect(await s.isExposed()).toBe(true)
  })

  it("a named separator is found by role and name", { timeout: 60_000 }, async () => {
    const page = await open("labelled")
    const s = createDriverWith(separatorContract, page, [{ name: "Advanced settings" }])
    expect(await s.orientation()).toBe("horizontal")
  })

  it("a decorative separator is not exposed", { timeout: 60_000 }, async () => {
    const page = await open("decorative")
    const s = createDriverWith(separatorContract, page.locator("#storybook-root"), [{}])
    expect(await s.isDecorative()).toBe(true)
  })

  it("several matches fail naming the count", { timeout: 60_000 }, async () => {
    const page = await open("text-divider")
    const s = createDriverWith(separatorContract, page.locator("#storybook-root"), [{}])
    await expect(s.orientation()).rejects.toThrow(/2 elements match/)
  })

  it("listbox and decorative separators are not in Chromium's tree", {
    timeout: 60_000,
  }, async () => {
    for (const id of ["in-listbox", "decorative"]) {
      const page = await open(id)
      const cdp = await page.context().newCDPSession(page)
      await cdp.send("Accessibility.enable")
      const { nodes } = (await cdp.send("Accessibility.getFullAXTree")) as {
        nodes: { role?: { value?: string }; ignored?: boolean }[]
      }
      expect(
        nodes.some((n) => !n.ignored && n.role?.value === "separator"),
        id,
      ).toBe(false)
    }
  })
})

describe("separator theme captures", () => {
  it("forced colors: the line stays visible (a border, not a background)", {
    timeout: 60_000,
  }, async () => {
    const page = await open("horizontal")
    await page.emulateMedia({ forcedColors: "active" })
    const line = await page.locator('[data-scope="separator"]').evaluate((el) => {
      const s = getComputedStyle(el)
      return {
        style: s.borderTopStyle,
        width: Number.parseFloat(s.borderTopWidth),
        color: s.borderTopColor,
      }
    })
    expect(line.style).toBe("solid")
    expect(line.width).toBeGreaterThanOrEqual(1)
    expect(line.color).not.toBe("rgba(0, 0, 0, 0)")
    mkdirSync(captures, { recursive: true })
    await page.screenshot({ path: join(captures, "separator-forced-colors.png") })
  })

  it('data-tone="danger" has no effect by design', { timeout: 60_000 }, async () => {
    const page = await open("horizontal")
    const el = page.locator('[data-scope="separator"]')
    const read = () => el.evaluate((e) => getComputedStyle(e).borderTopColor)
    const before = await read()
    await el.evaluate((e) => e.setAttribute("data-tone", "danger"))
    expect(await read()).toBe(before)
    await page.screenshot({ path: join(captures, "separator-tone-danger.png") })
  })
})
