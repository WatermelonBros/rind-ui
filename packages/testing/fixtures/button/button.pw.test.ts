/// <reference types="node" />
// Button through the Playwright adapter, against the built Storybook: the driver in both
// environments, forced colors, and the generic invariants on every Button story.
import { createReadStream, existsSync } from "node:fs"
import { createServer, type Server } from "node:http"
import { extname, join, normalize } from "node:path"
import { buttonContract } from "@rind-ui/core"
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
  await page.goto(`${base}/iframe.html?id=components-button--${id}&viewMode=story`)
  await page.locator('[data-scope="button"]').first().waitFor()
  return page
}
afterEach(async () => {
  for (const page of pages.splice(0)) await page.context().close()
})

describe("button driver through Playwright", () => {
  it("press: pointer and keyboard twin each count once", { timeout: 60_000 }, async () => {
    const page = await open("driver-example")
    // The story's play function already pressed once.
    await page.getByText("Pressed: 1").waitFor()
    const button = createDriverWith(buttonContract, page, [{ name: "Save" }])
    await button.press()
    await page.getByText("Pressed: 2").waitFor()
    await button.via("keyboard").press()
    await page.getByText("Pressed: 3").waitFor()
  })

  it("submits and resets a form", { timeout: 60_000 }, async () => {
    const page = await open("inside-form")
    const submit = createDriverWith(buttonContract, page, [{ name: "Submit" }])
    await submit.press()
    await page.getByText("Submits: 1").waitFor()
    await submit.via("keyboard").press()
    await page.getByText("Submits: 2").waitFor()
    await page.getByLabel("Name").fill("Grace")
    await createDriverWith(buttonContract, page, [{ name: "Reset" }]).press()
    expect(await page.getByLabel("Name").inputValue()).toBe("Ada")
  })
})

describe("forced colors", () => {
  it("keeps a border and paints disabled as GrayText", { timeout: 60_000 }, async () => {
    for (const [id, disabled] of [
      ["default", false],
      ["disabled", true],
    ] as const) {
      const page = await open(id)
      await page.emulateMedia({ forcedColors: "active" })
      const root = page.locator('[data-scope="button"][data-part="root"]').first()
      const border = await root.evaluate((el) => getComputedStyle(el).borderTopStyle)
      expect(border, `${id}: border`).not.toBe("none")
      if (!disabled) continue
      const [color, gray] = await Promise.all([
        root.evaluate((el) => getComputedStyle(el).color),
        page.evaluate(() => {
          const span = document.createElement("span")
          span.style.color = "GrayText"
          document.body.append(span)
          return getComputedStyle(span).color
        }),
      ])
      expect(color).toBe(gray)
    }
  })
})

const STORIES = [
  "default",
  "variants",
  "icon-only",
  "disabled",
  "focusable-when-disabled",
  "pending",
  "pending-state",
  "as-link",
  "as-div",
  "inside-form",
  "danger",
  "driver-example",
]

describe("generic invariants on every Button story", () => {
  for (const id of STORIES) {
    it(id, { timeout: 60_000 }, async () => {
      const page = await open(id)
      const buttons = await page.locator('[data-scope="button"]').all()
      for (const el of buttons) {
        const name =
          ((await el.getAttribute("aria-label")) ?? (await el.textContent()))?.trim() ?? ""
        expect(name, `${id}: a button without a name`).not.toBe("")
        const env = playwrightEnv(page).create({
          scope: "button",
          anchor: { role: (await el.evaluate((n) => n.tagName)) === "A" ? "link" : "button", name },
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
