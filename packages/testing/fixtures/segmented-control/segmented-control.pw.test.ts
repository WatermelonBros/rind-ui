/// <reference types="node" />
// Segmented Control through the Playwright adapter, against the built Storybook: the driver in a
// real browser, forced colors on the selected segment, reduced motion, RTL, and the generic invariants on
// every Segmented Control story.
import { createReadStream, existsSync } from "node:fs"
import { createServer, type Server } from "node:http"
import { extname, join, normalize } from "node:path"
import { type Browser, chromium, type Page } from "playwright"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { checkGeneric, getSegmentedControl, playwrightEnv } from "../../src/index"

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
  await page.goto(`${base}/iframe.html?id=components-segmentedcontrol--${id}&viewMode=story`)
  if (!id.includes("conditional-mount"))
    await page.locator('[data-scope="segmented-control"]').first().waitFor()
  return page
}
afterEach(async () => {
  for (const page of pages.splice(0)) await page.context().close()
})

const radio = (page: Page, name: string) => page.getByRole("radio", { name, exact: true })
const focused = (page: Page, name: string) =>
  radio(page, name).evaluate((el) => el === document.activeElement)
const selected = (page: Page) =>
  page
    .locator('[role="radio"]')
    .evaluateAll((els) =>
      els.filter((e) => e.getAttribute("aria-checked") === "true").map((e) => e.textContent),
    )

describe("segmented control driver through Playwright", () => {
  it("selects by pointer and keyboard and reads the form value", { timeout: 60_000 }, async () => {
    const page = await open("driver-example")
    const control = getSegmentedControl(page, { name: "Range" })
    expect(await control.segments()).toEqual(["Day", "Week", "Month"])
    // The story's own play function has run: it ends on Month.
    expect(await control.selected()).toBe("Month")
    await control.select("Day")
    expect(await control.selected()).toBe("Day")
    expect(await control.formValue()).toEqual([["range", "day"]])
    await control.focusSegment("Week")
    expect(await control.selected()).toBe("Day") // focus alone never selects
    await control.via("keyboard").select("Week")
    expect(await control.selected()).toBe("Week")
  })

  it("is one tab stop; every arrow moves and selects, Space selects", {
    timeout: 60_000,
  }, async () => {
    const page = await open("default")
    await page.keyboard.press("Tab")
    expect(await focused(page, "Day")).toBe(true)
    expect(await selected(page)).toEqual(["Day"])
    await page.keyboard.press("ArrowRight")
    expect(await focused(page, "Week")).toBe(true)
    expect(await selected(page)).toEqual(["Week"])
    await page.keyboard.press("ArrowDown")
    expect(await selected(page)).toEqual(["Month"])
    await page.keyboard.press("ArrowLeft")
    await page.keyboard.press("ArrowUp")
    expect(await selected(page)).toEqual(["Day"])
    await page.keyboard.press("Space")
    expect(await selected(page)).toEqual(["Day"])
    await page.keyboard.press("Tab")
    expect(
      await page
        .getByRole("button", { name: "After" })
        .evaluate((e) => e === document.activeElement),
    ).toBe(true)
  })

  it("Enter submits the form and never selects", { timeout: 60_000 }, async () => {
    const page = await open("in-form")
    await page.keyboard.press("Tab")
    await page.keyboard.press("ArrowRight")
    await page.keyboard.press("Enter")
    await expect.poll(() => page.locator("output").textContent()).toBe('{"range":"week"}')
    expect(await selected(page)).toEqual(["Week"])
  })

  it("RTL: ArrowRight goes to the previous segment and the row is mirrored", {
    timeout: 60_000,
  }, async () => {
    const page = await open("rtl")
    await page.keyboard.press("Tab")
    expect(await focused(page, "Week")).toBe(true)
    await page.keyboard.press("ArrowRight")
    expect(await focused(page, "Day")).toBe(true)
    expect(await selected(page)).toEqual(["Day"])
    const day = await radio(page, "Day").boundingBox()
    const month = await radio(page, "Month").boundingBox()
    expect((day?.x ?? 0) > (month?.x ?? 0)).toBe(true)
  })

  it("the indicator sits under the selected segment, also in RTL", {
    timeout: 60_000,
  }, async () => {
    for (const id of ["with-indicator", "rtl", "conditional-mount"]) {
      const page = await open(id)
      if (id === "conditional-mount")
        await page.getByRole("button", { name: "Toggle control" }).click()
      await page.locator('[data-part="indicator"][data-state="visible"]').waitFor()
      await page.waitForTimeout(400) // past the transition
      const [ind, on] = await Promise.all([
        page.locator('[data-part="indicator"]').boundingBox(),
        page.locator('[role="radio"][aria-checked="true"]').boundingBox(),
      ])
      expect(Math.abs((ind?.x ?? 0) - (on?.x ?? 99))).toBeLessThan(1.5)
      expect(Math.abs((ind?.width ?? 0) - (on?.width ?? 99))).toBeLessThan(1.5)
    }
  })
})

// The selected segment must stay distinguishable with system colours only, indicator aside.
describe("forced colors", () => {
  it("selected and unselected segments are distinguishable", { timeout: 60_000 }, async () => {
    const page = await open("with-indicator", { forcedColors: "active" })
    const paint = (state: string) =>
      page
        .locator(`[role="radio"][aria-checked="${state}"]`)
        .first()
        .evaluate((el) => {
          const s = getComputedStyle(el)
          return { borderColor: s.borderBlockEndColor, width: s.borderBlockEndWidth }
        })
    const [on, off] = [await paint("true"), await paint("false")]
    expect(on.width).not.toBe("0px")
    expect(on.borderColor).not.toBe(off.borderColor)
  })
})

describe("reduced motion", () => {
  it("the indicator does not transition", { timeout: 60_000 }, async () => {
    const page = await open("with-indicator", { reducedMotion: "reduce" })
    const duration = await page
      .locator('[data-part="indicator"]')
      .evaluate((el) => getComputedStyle(el).transitionDuration)
    expect(duration.split(",").every((d) => Number.parseFloat(d) === 0)).toBe(true)
  })
})

const STORIES = [
  "default",
  "with-indicator",
  "with-label",
  "vertical",
  "icon-segments",
  "disabled-segment",
  "read-only",
  "in-form",
  "rtl",
  "controlled",
  "conditional-mount",
  "driver-example",
]

describe("generic invariants on every Segmented Control story", () => {
  for (const id of STORIES) {
    it(id, { timeout: 60_000 }, async () => {
      const page = await open(id)
      // ConditionalMount starts without the control.
      if (id === "conditional-mount") {
        await page.getByRole("button", { name: "Toggle control" }).click()
        await page.locator('[data-scope="segmented-control"]').first().waitFor()
      }
      const env = playwrightEnv(page).create({
        scope: "segmented-control",
        anchor: { role: "radiogroup", name: id === "icon-segments" ? "View" : "Range" },
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
        traits: ["composite-roving", "selectable", "directional", "form-associated"],
        semantics: {},
        values: {},
      })
      expect(problems, id).toEqual([])
    })
  }
})
