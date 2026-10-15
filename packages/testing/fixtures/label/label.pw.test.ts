/// <reference types="node" />
// Label through the Playwright adapter, against the built Storybook: the driver in a real
// browser and the generic invariants on every Label story.
import { createReadStream, existsSync } from "node:fs"
import { createServer, type Server } from "node:http"
import { extname, join, normalize } from "node:path"
import { labelContract } from "@rind-ui/core"
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
  await page.goto(`${base}/iframe.html?id=components-label--${id}&viewMode=story`)
  await page.locator('[data-scope="label"]').first().waitFor()
  return page
}
afterEach(async () => {
  for (const page of pages.splice(0)) await page.context().close()
})

describe("label driver through Playwright", () => {
  it("click focuses the control, doubleClick selects nothing, controlName", {
    timeout: 60_000,
  }, async () => {
    const page = await open("for-input")
    const label = createDriverWith(labelContract, page, [{ text: "Email" }])
    expect(await label.isControlFocused()).toBe(false)
    await label.click()
    expect(await label.isControlFocused()).toBe(true)
    await label.doubleClick()
    expect(await label.selectedText()).toBe("")
    expect(await label.controlName()).toBe("Email")
  })
})

const STORIES = [
  "for-input",
  "wrapping-input",
  "wrapping-checkbox-with-link",
  "for-popup-trigger",
  "non-labelable-target",
  "as-span",
  "danger",
  "driver-example",
]

describe("generic invariants on every Label story", () => {
  for (const id of STORIES) {
    it(id, { timeout: 60_000 }, async () => {
      const page = await open(id)
      const labels = await page.locator('[data-scope="label"]').all()
      for (const el of labels) {
        const name = ((await el.textContent()) ?? "").trim()
        expect(name, `${id}: a label without text`).not.toBe("")
        const env = playwrightEnv(page).create({
          scope: "label",
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
