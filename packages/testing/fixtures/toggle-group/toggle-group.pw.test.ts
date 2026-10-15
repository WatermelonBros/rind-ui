/// <reference types="node" />
// Toggle Group through the Playwright adapter, against the built Storybook: the driver in a
// real browser, forced colors on a pressed item, RTL, and the generic invariants on every
// Toggle Group story.
import { createReadStream, existsSync } from "node:fs"
import { createServer, type Server } from "node:http"
import { extname, join, normalize } from "node:path"
import { type Browser, chromium, type Page } from "playwright"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { checkGeneric, getToggleGroup, playwrightEnv } from "../../src/index"

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
  await page.goto(`${base}/iframe.html?id=components-togglegroup--${id}&viewMode=story`)
  await page.locator('[data-scope="toggle-group"]').first().waitFor()
  return page
}
afterEach(async () => {
  for (const page of pages.splice(0)) await page.context().close()
})

const item = (page: Page, name: string) => page.getByRole("button", { name, exact: true })
const focused = (page: Page, name: string) =>
  item(page, name).evaluate((el) => el === document.activeElement)
const pressed = (page: Page) =>
  page
    .locator('[data-part="item"]')
    .evaluateAll((els) =>
      els.filter((e) => e.getAttribute("aria-pressed") === "true").map((e) => e.textContent),
    )

describe("toggle group driver through Playwright", () => {
  it("toggles by pointer and keyboard and reads the pressed set", { timeout: 60_000 }, async () => {
    const page = await open("driver-example")
    const group = getToggleGroup(page, { name: "Format" })
    expect(await group.items()).toEqual(["Bold", "Italic", "Underline"])
    // The story's own play function has run: it ends on Italic and Underline.
    expect(await group.pressed()).toEqual(["Italic", "Underline"])
    await group.toggle("Bold")
    expect(await group.pressed()).toEqual(["Bold", "Italic", "Underline"])
    await group.via("keyboard").toggle("Italic")
    expect(await group.pressed()).toEqual(["Bold", "Underline"])
    await group.focusItem("Italic")
    expect(await group.pressed()).toEqual(["Bold", "Underline"])
  })

  it("is one tab stop, arrows only move, Space presses", { timeout: 60_000 }, async () => {
    const page = await open("single")
    await page.keyboard.press("Tab")
    expect(await focused(page, "Italic")).toBe(true)
    await page.keyboard.press("ArrowRight")
    expect(await focused(page, "Underline")).toBe(true)
    expect(await pressed(page)).toEqual(["Italic"])
    await page.keyboard.press("Space")
    expect(await pressed(page)).toEqual(["Underline"])
    await page.keyboard.press("Tab")
    expect(
      await page
        .getByRole("button", { name: "After" })
        .evaluate((e) => e === document.activeElement),
    ).toBe(true)
  })

  it("RTL: ArrowRight goes to the previous item and the row is mirrored", {
    timeout: 60_000,
  }, async () => {
    const page = await open("rtl")
    await page.keyboard.press("Tab")
    expect(await focused(page, "Italic")).toBe(true)
    await page.keyboard.press("ArrowRight")
    expect(await focused(page, "Bold")).toBe(true)
    const bold = await item(page, "Bold").boundingBox()
    const underline = await item(page, "Underline").boundingBox()
    expect((bold?.x ?? 0) > (underline?.x ?? 0)).toBe(true)
  })
})

// A pressed and an unpressed item must stay visible and different with system colours only,
// and only the item (not the group) is repainted.
describe("forced colors", () => {
  it("pressed and unpressed items are distinguishable", { timeout: 60_000 }, async () => {
    const page = await open("single", { forcedColors: "active" })
    const paint = (state: string) =>
      page
        .locator(`[data-part="item"][data-state="${state}"]`)
        .first()
        .evaluate((el) => {
          const s = getComputedStyle(el)
          return { border: s.borderTopStyle, bg: s.backgroundColor, color: s.color }
        })
    const [on, off] = [await paint("on"), await paint("off")]
    expect(on.border).toBe("solid")
    expect(off.border).toBe("solid")
    expect(on.bg).not.toBe(off.bg)
    const shot = async (state: string) =>
      (
        await page.locator(`[data-part="item"][data-state="${state}"]`).first().screenshot()
      ).toString("base64")
    expect(await shot("on")).not.toBe(await shot("off"))
    // The group itself is not painted as a pressed part.
    const root = await page
      .locator('[data-part="root"]')
      .evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(root).not.toBe(on.bg)
  })

  it("a disabled item is repainted in GrayText", { timeout: 60_000 }, async () => {
    const page = await open("disabled-item", { forcedColors: "active" })
    const color = (name: string) =>
      item(page, name).evaluate((el) => getComputedStyle(el).borderTopColor)
    expect(await color("Italic")).not.toBe(await color("Underline"))
  })
})

const STORIES = [
  "single",
  "multiple",
  "disallow-empty",
  "vertical",
  "disabled-item",
  "focusable-when-disabled",
  "icon-only",
  "rtl",
  "controlled",
  "driver-example",
]

// Source bug (connect): with `disabled` + `focusableWhenDisabled` every item gets tabindex -1
// (`input.disabled ? -1 : ...`) and the root has no tabindex either, so the group has no tab
// stop. This flips to a failure when fixed; then delete the entry.

describe("generic invariants on every Toggle Group story", () => {
  for (const id of STORIES) {
    it(id, { timeout: 60_000 }, async () => {
      const page = await open(id)
      const env = playwrightEnv(page).create({
        scope: "toggle-group",
        anchor: { role: "group", name: "Format" },
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
        traits: ["composite-roving", "directional"],
        semantics: {},
        values: {},
      })
      expect(problems, id).toEqual([])
    })
  }
})
