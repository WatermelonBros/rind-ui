/// <reference types="node" />
// The layer driver through the Playwright adapter, against the built Storybook.
import { createReadStream, existsSync } from "node:fs"
import { createServer, type Server } from "node:http"
import { extname, join, normalize } from "node:path"
import { type Browser, chromium, type Page } from "playwright"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { createDriver, playwrightEnv, testMachine } from "../../src/index"
import { layerContract } from "./layer.contract"

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

const story = (id = "closed") =>
  `${base}/iframe.html?id=foundations-layer-fixture--${id}&viewMode=story`
const pages: Page[] = []
async function open(id: string) {
  const context = await browser.newContext({ hasTouch: true })
  const page = await context.newPage()
  pages.push(page)
  await page.goto(story(id))
  // Default-open stories have an inert (hidden) trigger: wait for the part, not the role.
  await page.locator('[data-part="trigger"]').first().waitFor({ state: "attached" })
  // Storybook's a11y addon styles <body> once it initialises; wait so the baseline is settled.
  await page
    .locator("#storybook-a11y-vision-filters")
    .waitFor({ state: "attached" })
    .catch(() => {})
  return page
}
afterEach(async () => {
  for (const page of pages.splice(0)) await page.context().close()
})

const dialogs = (page: Page) => page.getByRole("dialog")

describe("layer driver through Playwright", () => {
  it("opens by keyboard, traps focus, makes the outside inert, restores focus", {
    timeout: 60_000,
  }, async () => {
    const page = await open("closed")
    const layer = createDriver(layerContract, playwrightEnv(page), "Open").via("keyboard")
    await layer.open()
    expect(await dialogs(page).count()).toBe(1)
    expect(
      await page.evaluate(() => document.activeElement?.closest("[role=dialog]") !== null),
    ).toBe(true)
    // The app root is a sibling of the portal host; the modal makes it inert.
    expect(
      await page.locator("#storybook-root").evaluate((el) => el.closest("[inert]") !== null),
    ).toBe(true)
    await layer.pressEscape()
    await expect.poll(() => dialogs(page).count()).toBe(0)
    expect(await page.evaluate(() => document.activeElement?.textContent)).toBe("Open")
    expect(
      await page.locator("#storybook-root").evaluate((el) => el.closest("[inert]") !== null),
    ).toBe(false)
  })

  it("Escape closes only the inner of nested modals", { timeout: 60_000 }, async () => {
    const page = await open("nested-modals")
    await page.getByRole("dialog", { name: "Outer dialog" }).waitFor()
    await page.getByRole("button", { name: "Inner", exact: true }).click()
    await page.getByRole("dialog", { name: "Inner dialog" }).waitFor()
    await page.keyboard.press("Escape")
    await expect.poll(() => dialogs(page).count()).toBe(1)
    await page.getByRole("dialog", { name: "Outer dialog" }).waitFor()
  })

  it("clicking a top-layer toast does not close the modal", { timeout: 60_000 }, async () => {
    const page = await open("toast-above-modal")
    await page.getByRole("dialog", { name: "Modal with a toast" }).waitFor()
    await page.getByRole("button", { name: "Undo" }).click()
    expect(await dialogs(page).count()).toBe(1)
  })
})

describe("testMachine through Playwright", () => {
  testMachine(layerContract, {
    test: (name, fn) => it(name, { timeout: 60_000 }, () => fn()),
    setup: () => open("closed"),
    target: (page) => page,
    anchor: ["Open"],
    props: { open: undefined, root: "oracle" },
  })
})
