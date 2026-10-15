/// <reference types="node" />
// Checkbox Group through the Playwright adapter, against the built Storybook: the driver in a
// real browser, the select-all cycle, forced colors on the mixed Parent, and the generic
// invariants on every Checkbox Group story.
import { createReadStream, existsSync } from "node:fs"
import { createServer, type Server } from "node:http"
import { extname, join, normalize } from "node:path"
import { type Browser, chromium, type Page } from "playwright"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { checkGeneric, getCheckboxGroup, playwrightEnv } from "../../src/index"

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
async function open(id: string, options: Parameters<Browser["newContext"]>[0] = {}) {
  const context = await browser.newContext(options)
  const page = await context.newPage()
  pages.push(page)
  await page.goto(`${base}/iframe.html?id=components-checkboxgroup--${id}&viewMode=story`)
  await page.locator('[data-scope="checkbox-group"]').first().waitFor()
  return page
}
afterEach(async () => {
  for (const page of pages.splice(0)) await page.context().close()
})

const box = (page: Page, name: string) => page.getByRole("checkbox", { name, exact: true })
const parentPaint = (page: Page) =>
  page.locator('[data-parent][data-part="control"]').evaluate((el) => {
    const s = getComputedStyle(el)
    return { bg: s.backgroundColor, border: `${s.borderTopStyle} ${s.borderTopColor}` }
  })

describe("checkbox group driver through Playwright", () => {
  it("toggles items and walks the select-all cycle", { timeout: 60_000 }, async () => {
    const page = await open("with-parent")
    const group = getCheckboxGroup(page, { name: "Toppings" })
    expect(await group.value()).toEqual(["ham"])
    expect(await group.parentState()).toBe("mixed")
    await group.toggle("Cheese")
    expect(await group.value()).toEqual(["ham", "cheese"])
    await group.toggle("Cheese")
    await group.toggleParent()
    expect(await group.parentState()).toBe("checked")
    await group.via("keyboard").toggleParent()
    expect(await group.value()).toEqual([])
    await group.toggleParent()
    expect(await group.value()).toEqual(["ham"])
  })

  it("Tab visits each item once and arrows do nothing", { timeout: 60_000 }, async () => {
    const page = await open("default")
    await page.keyboard.press("Tab")
    await page.keyboard.press("Tab")
    expect(await box(page, "Cheese").evaluate((el) => el === document.activeElement)).toBe(true)
    await page.keyboard.press("ArrowDown")
    expect(await box(page, "Cheese").evaluate((el) => el === document.activeElement)).toBe(true)
    expect(await box(page, "Olives").getAttribute("aria-checked")).toBe("false")
  })

  it("submits only the checked values and reset restores the default", {
    timeout: 60_000,
  }, async () => {
    const page = await open("in-form-with-reset")
    const group = getCheckboxGroup(page, { name: "Toppings" })
    await group.toggle("Ham")
    await page.getByRole("button", { name: "Submit" }).click()
    expect(await page.locator("output").textContent()).toBe('["ham","cheese"]')
    await page.getByRole("button", { name: "Reset" }).click()
    expect(await group.value()).toEqual(["cheese"])
  })
})

// The mixed Parent must differ from the other two states with only system colours.
describe("forced colors", () => {
  it("unchecked, mixed and checked Parents are distinguishable", { timeout: 60_000 }, async () => {
    const paint = async (id: string) => {
      const page = await open(id, { forcedColors: "active" })
      const control = page.locator('[data-parent][data-part="control"]')
      return {
        style: await parentPaint(page),
        image: (await control.screenshot()).toString("base64"),
      }
    }
    const [off, mixed, on] = await Promise.all(
      ["parent-unchecked", "parent-mixed", "parent-checked"].map(paint),
    )
    for (const state of [off, mixed, on]) expect(state?.style.border).toMatch(/^solid /)
    expect(new Set([off?.image, mixed?.image, on?.image]).size).toBe(3)
    expect(mixed?.style.bg).toBe(on?.style.bg)
    expect(mixed?.style.bg).not.toBe(off?.style.bg)
  })
})

const STORIES = [
  "default",
  "with-parent",
  "parent-unchecked",
  "parent-mixed",
  "parent-checked",
  "disabled-item",
  "disabled-group",
  "read-only",
  "required-with-error",
  "controlled",
  "in-form-with-reset",
  "fieldset",
  "driver-example",
]

describe("generic invariants on every Checkbox Group story", () => {
  for (const id of STORIES) {
    it(id, { timeout: 60_000 }, async () => {
      const page = await open(id)
      const env = playwrightEnv(page).create({
        scope: "checkbox-group",
        anchor: { role: "group", name: "Toppings" },
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
        traits: ["form-associated"],
        semantics: {},
        values: {},
      })
      expect(problems, id).toEqual([])
    })
  }
})
