/// <reference types="node" />
// Radio Group through the Playwright adapter, against the built Storybook: the driver in a
// real browser, forced colors on checked/unchecked radios (radix#2993), RTL, and the generic
// invariants on every Radio Group story.
import { createReadStream, existsSync } from "node:fs"
import { createServer, type Server } from "node:http"
import { extname, join, normalize } from "node:path"
import { type Browser, chromium, type Page } from "playwright"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { checkGeneric, getRadioGroup, playwrightEnv } from "../../src/index"

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
  await page.goto(`${base}/iframe.html?id=components-radiogroup--${id}&viewMode=story`)
  await page.locator('[data-scope="radio-group"]').first().waitFor()
  return page
}
afterEach(async () => {
  for (const page of pages.splice(0)) await page.context().close()
})

const radio = (page: Page, name: string) => page.getByRole("radio", { name, exact: true })
const focused = (page: Page, name: string) =>
  radio(page, name).evaluate((el) => el === document.activeElement)
const ring = (page: Page, state: "checked" | "unchecked") =>
  page
    .locator(`[data-part="item-control"][data-state="${state}"]`)
    .first()
    .evaluate((el) => {
      const s = getComputedStyle(el)
      return { border: `${s.borderTopStyle} ${s.borderTopColor}`, bg: s.backgroundColor }
    })

describe("radio group driver through Playwright", () => {
  it("checks by pointer and keyboard and reads the form value", { timeout: 60_000 }, async () => {
    const page = await open("driver-example")
    const group = getRadioGroup(page, { name: "Size" })
    expect(await group.radios()).toEqual(["Small", "Medium", "Large"])
    // The story's own play function has run: it ends on Large.
    expect(await group.checked()).toBe("Large")
    await group.check("Medium")
    expect(await group.checked()).toBe("Medium")
    expect(await group.formValue()).toEqual([["size", "medium"]])
    await group.via("keyboard").check("Small")
    expect(await group.checked()).toBe("Small")
    expect(await group.formValue()).toEqual([["size", "small"]])
    await group.focusRadio("Large")
    expect(await group.checked()).toBe("Small")
  })

  it("is one tab stop and arrows move and check", { timeout: 60_000 }, async () => {
    const page = await open("default")
    await page.keyboard.press("Tab")
    expect(await focused(page, "Medium")).toBe(true)
    await page.keyboard.press("ArrowDown")
    expect(await focused(page, "Large")).toBe(true)
    expect(await radio(page, "Large").getAttribute("aria-checked")).toBe("true")
    await page.keyboard.press("ArrowDown")
    expect(await focused(page, "Small")).toBe(true)
    await page.keyboard.press("Tab")
    expect(
      await page
        .getByRole("button", { name: "After" })
        .evaluate((e) => e === document.activeElement),
    ).toBe(true)
  })

  it("submits the checked value and reset restores the default", { timeout: 60_000 }, async () => {
    const page = await open("in-form")
    const group = getRadioGroup(page, { name: "Size" })
    await group.check("Large")
    await page.getByRole("button", { name: "Submit" }).click()
    expect(await page.locator("output").textContent()).toBe('{"size":"large"}')
    await page.getByRole("button", { name: "Reset" }).click()
    expect(await group.checked()).toBe("Small")
  })

  it("RTL: ArrowRight goes to the previous radio and the row is mirrored", {
    timeout: 60_000,
  }, async () => {
    const page = await open("rtl")
    await page.keyboard.press("Tab")
    expect(await focused(page, "Medium")).toBe(true)
    await page.keyboard.press("ArrowRight")
    expect(await focused(page, "Small")).toBe(true)
    const small = await radio(page, "Small").boundingBox()
    const large = await radio(page, "Large").boundingBox()
    expect((small?.x ?? 0) > (large?.x ?? 0)).toBe(true)
  })
})

// A checked and an unchecked radio must stay visible and different with system colours only.
describe("forced colors", () => {
  it("checked and unchecked radios are distinguishable (radix#2993)", {
    timeout: 60_000,
  }, async () => {
    const page = await open("default", { forcedColors: "active" })
    const [on, off] = [await ring(page, "checked"), await ring(page, "unchecked")]
    expect(on.border).toMatch(/^solid /)
    expect(off.border).toMatch(/^solid /)
    const control = (state: string) =>
      page.locator(`[data-part="item-control"][data-state="${state}"]`).first()
    const [onImage, offImage] = await Promise.all(
      ["checked", "unchecked"].map(async (s) => (await control(s).screenshot()).toString("base64")),
    )
    expect(onImage).not.toBe(offImage)
    // The dot is visible against the ring's own fill.
    const dot = await page
      .locator('[data-part="item-indicator"]')
      .evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(dot).not.toBe(on.bg)
  })

  it("a disabled radio is repainted in GrayText", { timeout: 60_000 }, async () => {
    const page = await open("disabled-group", { forcedColors: "active" })
    const enabled = await open("default", { forcedColors: "active" })
    const color = (p: Page) =>
      p
        .locator('[data-part="item-control"]')
        .first()
        .evaluate((el) => getComputedStyle(el).borderTopColor)
    expect(await color(page)).not.toBe(await color(enabled))
  })
})

const STORIES = [
  "default",
  "horizontal",
  "with-descriptions",
  "disabled-item",
  "disabled-group",
  "read-only",
  "in-form",
  "rtl",
  "controlled",
  "driver-example",
  "required-invalid",
]

// Source bug (connect): the radios carry data-invalid but no aria-invalid (the role does not
// support it), which the "state attributes agree" invariant flags. Flips to a failure when fixed.

describe("generic invariants on every Radio Group story", () => {
  for (const id of STORIES) {
    it(id, { timeout: 60_000 }, async () => {
      const page = await open(id)
      const env = playwrightEnv(page).create({
        scope: "radio-group",
        anchor: { role: "radiogroup", name: "Size" },
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
