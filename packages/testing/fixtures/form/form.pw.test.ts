/// <reference types="node" />
// Form through the Playwright adapter, against the built Storybook: the driver in a real
// browser and the generic invariants on every Form story.
import { createReadStream, existsSync } from "node:fs"
import { createServer, type Server } from "node:http"
import { extname, join, normalize } from "node:path"
import { formContract } from "@rind-ui/core"
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
  await page.goto(`${base}/iframe.html?id=components-form--${id}&viewMode=story`)
  await page.locator('[data-scope="form"]').first().waitFor()
  return page
}
afterEach(async () => {
  for (const page of pages.splice(0)) await page.context().close()
})

describe("form driver through Playwright", () => {
  it("two invalid fields, submit: invalidFields in tree order, first focused, one summary", {
    timeout: 60_000,
  }, async () => {
    // A story without a play function: nothing has been submitted yet.
    const page = await open("sign-up")
    const form = createDriverWith(formContract, page, [{ name: "Sign up" }])
    await page.getByRole("textbox", { name: "Email" }).fill("abc")
    await page.getByRole("textbox", { name: "Password", exact: true }).fill("short")
    await form.submit()
    await expect.poll(() => form.invalidFields()).toEqual(["email", "password", "confirm"])
    expect(await form.focusedField()).toBe("email")
    expect(await form.submissions()).toBe(0)
    const summaries = (await form.announcements()).filter((a) => a.key === "form-summary")
    expect(summaries).toHaveLength(1)
  })
})

const STORIES = [
  "sign-up",
  "async-username",
  "server-errors",
  "action-state",
  "values",
  "aria-behavior",
  "reset-form",
  "nested-form",
]

describe("generic invariants on every Form story", () => {
  for (const id of STORIES) {
    it(id, { timeout: 60_000 }, async () => {
      const page = await open(id)
      const env = playwrightEnv(page).create({
        scope: "form",
        anchor: { role: "form", name: id === "nested-form" ? "Outer" : "Sign up" },
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
      expect(problems, id).toEqual([])
    })
  }
})
