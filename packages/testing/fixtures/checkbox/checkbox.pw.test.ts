/// <reference types="node" />
// Checkbox through the Playwright adapter, against the built Storybook: the driver in a real
// browser, forced colors, reduced motion, Enter in a form against a native checkbox in all
// three engines, and the generic invariants on every Checkbox story.
import { createReadStream, existsSync } from "node:fs"
import { createServer, type Server } from "node:http"
import { extname, join, normalize } from "node:path"
import { type Browser, type BrowserType, chromium, firefox, type Page, webkit } from "playwright"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { checkGeneric, getCheckbox, playwrightEnv } from "../../src/index"

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
  await page.goto(`${base}/iframe.html?id=components-checkbox--${id}&viewMode=story`)
  await page.locator('[data-scope="checkbox"]').first().waitFor()
  return page
}
afterEach(async () => {
  for (const page of pages.splice(0)) await page.context().close()
})

const control = (page: Page, name: string) => page.getByRole("checkbox", { name })

describe("checkbox driver through Playwright", () => {
  it("toggles by pointer, Space and the label", { timeout: 60_000 }, async () => {
    const page = await open("default")
    const box = getCheckbox(page, { name: "Accept the terms" })
    expect(await box.isChecked()).toBe(false)
    await box.check()
    expect(await box.isChecked()).toBe(true)
    await box.via("keyboard").uncheck()
    expect(await box.isChecked()).toBe(false)
    await box.clickLabel()
    expect(await box.isChecked()).toBe(true)
    await box.toggle()
    expect(await box.checkedState()).toBe(false)
  })

  it("Space on the focused control toggles; Enter does not", { timeout: 60_000 }, async () => {
    const page = await open("default")
    await page.keyboard.press("Tab")
    await page.keyboard.press("Space")
    expect(await control(page, "Accept the terms").getAttribute("aria-checked")).toBe("true")
    await page.keyboard.press("Enter")
    expect(await control(page, "Accept the terms").getAttribute("aria-checked")).toBe("true")
  })

  it("indeterminate reads mixed and becomes checked", { timeout: 60_000 }, async () => {
    const page = await open("indeterminate")
    const box = getCheckbox(page, { name: "Select all" })
    expect(await box.isIndeterminate()).toBe(true)
    await box.via("keyboard").toggle()
    expect(await box.checkedState()).toBe(true)
  })

  it("reads the form value from the hidden input's properties", { timeout: 60_000 }, async () => {
    const page = await open("in-form")
    const news = getCheckbox(page, { name: "Newsletter" })
    expect(await news.formValue()).toBe("yes")
    await news.uncheck()
    expect(await news.formValue()).toBeNull()
    await news.check()
    expect(await news.formValue()).toBe("yes")
  })

  it("a form reset restores the default", { timeout: 60_000 }, async () => {
    const page = await open("in-form")
    const news = getCheckbox(page, { name: "Newsletter" })
    const updates = getCheckbox(page, { name: "Updates" })
    await news.uncheck()
    await updates.check()
    await updates.resetForm()
    expect(await news.isChecked()).toBe(true)
    expect(await updates.isChecked()).toBe(false)
  })

  it("reduced motion: nothing transitions", { timeout: 60_000 }, async () => {
    const page = await open("checked", { reducedMotion: "reduce" })
    const duration = await page
      .locator('[data-scope="checkbox"][data-part="control"]')
      .evaluate((el) => getComputedStyle(el).transitionDuration)
    expect(Number.parseFloat(duration)).toBe(0)
  })
})

// Enter submits the form from the Control exactly as it does from a native checkbox
// (headlessui#2958), in every engine that is installed.
describe("Enter submits the form", () => {
  const engines: [string, BrowserType][] = [
    ["chromium", chromium],
    ["firefox", firefox],
    ["webkit", webkit],
  ]
  for (const [name, type] of engines) {
    it(name, { timeout: 60_000 }, async (ctx) => {
      let own: Browser
      try {
        own = await type.launch()
      } catch {
        ctx.skip()
        return
      }
      try {
        const page = await (await own.newContext()).newPage()
        await page.goto(`${base}/iframe.html?id=components-checkbox--in-form&viewMode=story`)
        await page.locator('[data-scope="checkbox"]').first().waitFor()
        await page.evaluate(() => {
          const form = document.querySelector("form") as HTMLFormElement
          const native = document.createElement("input")
          native.type = "checkbox"
          native.setAttribute("aria-label", "Native")
          form.prepend(native)
          const w = window as unknown as { submits: number }
          w.submits = 0
          form.addEventListener("submit", () => {
            w.submits += 1
          })
        })
        const submits = () =>
          page.evaluate(() => (window as unknown as { submits: number }).submits)
        await page.getByRole("checkbox", { name: "Native" }).focus()
        await page.keyboard.press("Enter")
        const native = await submits()
        expect(native, "a native checkbox submits on Enter").toBe(1)
        await control(page, "Newsletter").focus()
        await page.keyboard.press("Enter")
        expect((await submits()) - native).toBe(1)
        expect(await control(page, "Newsletter").getAttribute("aria-checked")).toBe("true")
      } finally {
        await own.close()
      }
    })
  }
})

// Chromium emulates forced colors: the three states must differ by more than the page can fake
// (react-spectrum#4029).
describe("forced colors", () => {
  const paint = async (id: string) => {
    const page = await open(id, { forcedColors: "active" })
    const box = page.locator('[data-scope="checkbox"][data-part="control"]')
    const style = await box.evaluate((el) => {
      const s = getComputedStyle(el)
      const glyph = el.querySelector("svg path")
      const indicator = el.querySelector('[data-part="indicator"]') as HTMLElement
      return {
        bg: s.backgroundColor,
        color: s.color,
        border: `${s.borderTopStyle} ${s.borderTopColor}`,
        visibility: getComputedStyle(indicator).visibility,
        glyph: glyph?.getAttribute("d") ?? "",
      }
    })
    return { style, image: (await box.screenshot()).toString("base64") }
  }

  it("unchecked, checked and indeterminate are all different and visible", {
    timeout: 60_000,
  }, async () => {
    const [off, on, mixed] = await Promise.all(["default", "checked", "indeterminate"].map(paint))
    for (const state of [off, on, mixed]) expect(state?.style.border).toMatch(/^solid /)
    const images = new Set([off?.image, on?.image, mixed?.image])
    expect(images.size).toBe(3)
    expect(on?.style.bg).not.toBe(off?.style.bg)
    expect(on?.style.visibility).toBe("visible")
    expect(off?.style.visibility).toBe("hidden")
    expect(mixed?.style.glyph).not.toBe(on?.style.glyph)
  })

  it("checked and mixed use Highlight; disabled is GrayText", { timeout: 60_000 }, async () => {
    const page = await open("disabled", { forcedColors: "active" })
    const [color, gray] = await Promise.all([
      page
        .locator('[data-scope="checkbox"][data-part="control"]')
        .first()
        .evaluate((el) => getComputedStyle(el).color),
      page.evaluate(() => {
        const span = document.createElement("span")
        span.style.color = "GrayText"
        document.body.append(span)
        return getComputedStyle(span).color
      }),
    ])
    expect(color).toBe(gray)
    const checked = await open("checked", { forcedColors: "active" })
    const [bg, highlight] = await Promise.all([
      checked
        .locator('[data-scope="checkbox"][data-part="control"]')
        .evaluate((el) => getComputedStyle(el).backgroundColor),
      checked.evaluate(() => {
        const span = document.createElement("span")
        span.style.color = "Highlight"
        document.body.append(span)
        return getComputedStyle(span).color
      }),
    ])
    expect(bg).toBe(highlight)
  })

  it("the focus ring is visible", { timeout: 60_000 }, async () => {
    const page = await open("default", { forcedColors: "active" })
    await page.keyboard.press("Tab")
    const ring = await page
      .locator('[data-scope="checkbox"][data-part="control"]')
      .evaluate((el) => getComputedStyle(el).outlineStyle)
    expect(ring).toBe("solid")
  })
})

const STORIES = [
  "default",
  "checked",
  "with-description",
  "indeterminate",
  "disabled",
  "focusable-disabled",
  "read-only",
  "required-invalid",
  "in-form",
  "controlled",
  "wrapped-in-label",
  "render-as-div",
  "in-scrollable-container",
  "driver-example",
]

describe("generic invariants on every Checkbox story", () => {
  for (const id of STORIES) {
    it(id, { timeout: 60_000 }, async () => {
      const page = await open(id)
      const roots = await page.locator('[data-scope="checkbox"][data-part="control"]').all()
      expect(roots.length, `${id}: no checkbox`).toBeGreaterThan(0)
      for (const el of roots) {
        // The label the browser computes: a `for` or wrapping label, else aria-labelledby.
        const name = await el.evaluate((node) => {
          const labels = (node as HTMLButtonElement).labels
          const text = labels?.[0]?.textContent
          const by = node.getAttribute("aria-labelledby")
          return (text ?? (by ? document.getElementById(by)?.textContent : null) ?? "").trim()
        })
        expect(name, `${id}: a checkbox without a name`).not.toBe("")
        const env = playwrightEnv(page).create({
          scope: "checkbox",
          anchor: { role: "checkbox", name },
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
        expect(problems, `${id} / ${name}`).toEqual([])
      }
    })
  }
})
