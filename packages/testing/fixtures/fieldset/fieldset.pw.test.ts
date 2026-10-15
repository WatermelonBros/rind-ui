/// <reference types="node" />
// Fieldset through the Playwright adapter, against the built Storybook: the driver in a real
// browser and the generic invariants on every Fieldset story.
import { createReadStream, existsSync } from "node:fs"
import { createServer, type Server } from "node:http"
import { extname, join, normalize } from "node:path"
import { fieldsetContract } from "@rind-ui/core"
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
  await page.goto(`${base}/iframe.html?id=components-fieldset--${id}&viewMode=story`)
  await page.locator('[data-scope="fieldset"]').first().waitFor()
  return page
}
afterEach(async () => {
  for (const page of pages.splice(0)) await page.context().close()
})

describe("fieldset driver through Playwright", () => {
  it("name, description, disabled, invalid and errors", { timeout: 60_000 }, async () => {
    const page = await open("disabled")
    const disabled = createDriverWith(fieldsetContract, page, [{ name: "Shipping address" }])
    expect(await disabled.isDisabled()).toBe(true)
    expect(await disabled.name()).toBe("Shipping address")
    const plain = await open("address-group")
    const group = createDriverWith(fieldsetContract, plain, [{ name: "Shipping address" }])
    expect(await group.isDisabled()).toBe(false)
    expect(await group.description()).toBe("Where we send the parcel.")
    expect(await group.errors()).toBe(null)
    const bad = await open("invalid")
    const invalid = createDriverWith(fieldsetContract, bad, [{ name: "Delivery speed" }])
    expect(await invalid.isInvalid()).toBe(true)
    expect(await invalid.errors()).toBe("Choose a delivery speed.")
  })
})

const STORIES = [
  "address-group",
  "radio-set",
  "disabled",
  "nested-disabled",
  "legend-with-select-all",
  "invalid",
  "substituted-legend",
  "danger",
]

describe("generic invariants on every Fieldset story", () => {
  for (const id of STORIES) {
    it(id, { timeout: 60_000 }, async () => {
      const page = await open(id)
      // The outermost fieldset: its legend text anchors it (nested ones are covered by the same check).
      const legends = await page.locator('[data-scope="fieldset"][data-part="legend"]').all()
      for (const el of legends) {
        const name = ((await el.textContent()) ?? "").trim()
        expect(name, `${id}: a legend without text`).not.toBe("")
        const env = playwrightEnv(page).create({
          scope: "fieldset",
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
