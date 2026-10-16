/// <reference types="node" />
// Link through the Playwright adapter, against the built Storybook: the driver and
// `navigated()` (in-page router log, URL change, new page), and the generic invariants on
// every Link story (accessible name, no aria-hidden focusables, one navigation per bare click).
import { createReadStream, existsSync } from "node:fs"
import { createServer, type Server } from "node:http"
import { extname, join, normalize } from "node:path"
import { linkContract, platforms } from "@rind-ui/core"
import { type Browser, chromium, type Page } from "playwright"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { checkGeneric, createDriverWith, playwrightEnv } from "../../src/index"

/** Drains animation frames in the page (a condition-free "let it settle"). */
const frames = (page: Page, count = 6) =>
  page.evaluate(
    (n) =>
      new Promise<void>((resolve) => {
        const step = (left: number) =>
          left <= 0 ? resolve() : requestAnimationFrame(() => step(left - 1))
        step(n)
      }),
    count,
  )

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
  await page.goto(`${base}/iframe.html?id=components-link--${id}&viewMode=story`)
  await page.locator('[data-scope="link"]').first().waitFor()
  // Its play function follows the link itself: let it finish before counting navigations.
  if (id === "followed-with-driver") await page.getByText("Router calls: /docs, /docs").waitFor()
  return page
}
afterEach(async () => {
  for (const page of pages.splice(0)) await page.context().close()
})

const routerCalls = (page: Page) =>
  page.evaluate(
    () =>
      (Reflect.get(globalThis, Symbol.for("rind-ui.navigations")) as unknown[] | undefined)
        ?.length ?? 0,
  )

describe("link driver through Playwright", () => {
  it("follow, keyboard twin and new tab", { timeout: 60_000 }, async () => {
    const page = await open("standalone")
    const link = createDriverWith(linkContract, page, [{ name: "Documentation" }], {
      platform: process.platform === "darwin" ? platforms.apple : platforms.linux,
    })
    const before = await routerCalls(page)
    await link.follow()
    await link.via("keyboard").follow()
    expect(await routerCalls(page)).toBe(before + 2)
    // ⌘/Ctrl+click: the browser opens a new page, the router is not called.
    const popup = page.context().waitForEvent("page")
    await link.followInNewTab()
    await popup
    expect(await routerCalls(page)).toBe(before + 2)
  })

  it("follow on a disabled link fails naming isDisabled", { timeout: 60_000 }, async () => {
    const page = await open("disabled")
    const link = createDriverWith(linkContract, page, [{ name: "Documentation" }])
    await expect(link.follow()).rejects.toThrow(/link\.follow \[pointer\].*"isDisabled":true/)
  })
})

const STORIES = [
  "inline",
  "standalone",
  "external",
  "current",
  "disabled",
  "focusable-when-disabled",
  "as-div",
  "danger",
  "render-router-link",
  "rtl",
  "followed-with-driver",
  "queries",
  "disabled-query",
]

describe("generic invariants on every Link story", () => {
  for (const id of STORIES) {
    it(id, { timeout: 60_000 }, async () => {
      const page = await open(id)
      const links = await page.locator('[data-scope="link"]').all()
      for (const el of links) {
        const name = (await el.textContent())?.trim() ?? ""
        expect(name, `${id}: a link without a name`).not.toBe("")
        const env = playwrightEnv(page).create({
          scope: "link",
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
        // A bare click (assistive technology) on a same-tab link navigates exactly once.
        const sameTab = await el.evaluate(
          (a) =>
            a.getAttribute("aria-disabled") !== "true" &&
            (a.getAttribute("target") ?? "_self") === "_self" &&
            !a.hasAttribute("data-external"),
        )
        if (!sameTab) continue
        const before = await routerCalls(page)
        await el.dispatchEvent("click", { detail: 0 })
        await expect.poll(() => routerCalls(page)).toBe(before + 1)
        await frames(page)
        expect(await routerCalls(page)).toBe(before + 1)
      }
    })
  }
})
