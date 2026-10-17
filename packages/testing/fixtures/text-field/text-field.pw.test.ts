/// <reference types="node" />
// Text Field through the Playwright adapter, against the site examples harness: the driver in a real
// browser and the generic invariants on every TextField story.
import { textFieldContract } from "@rind-ui/core"
import { type Browser, chromium, type Page } from "playwright"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { checkGeneric, createDriverWith, playwrightEnv } from "../../src/index"
import { openExample, type SiteServer, serveSite } from "../harness"

let site: SiteServer
let browser: Browser

beforeAll(async () => {
  site = await serveSite()
  browser = await chromium.launch()
}, 60_000)

afterAll(async () => {
  await browser?.close()
  site?.close()
})

const pages: Page[] = []
async function open(id: string, options: Parameters<Browser["newContext"]>[0] = {}) {
  const context = await browser.newContext(options)
  const page = await context.newPage()
  pages.push(page)
  await openExample(page, site.base, "text-field", id)
  await page.locator('[data-scope="text-field"]').first().waitFor()
  return page
}
afterEach(async () => {
  for (const page of pages.splice(0)) await page.context().close()
})

describe("text field driver through Playwright", () => {
  // The same test runs in the browser and jsdom projects (text-field.dom.test.tsx).
  it("Same test in both environments: fill then value", { timeout: 60_000 }, async () => {
    const page = await open("required-email")
    const field = createDriverWith(textFieldContract, page, [{ name: "Email" }])
    await field.fill("a@b.co")
    expect(await field.value()).toBe("a@b.co")
  })

  // Chromium emulates forced colors: borders stay visible and use system colours.
  it("Forced colors: default, focused, invalid, disabled", { timeout: 60_000 }, async () => {
    const paint = async (id: string, name: string, focus = false, submit = false) => {
      const page = await open(id, { forcedColors: "active" })
      expect(await page.evaluate(() => matchMedia("(forced-colors: active)").matches)).toBe(true)
      const input = page.getByRole("textbox", { name })
      if (focus) await page.keyboard.press("Tab")
      if (submit) await page.getByRole("button", { name: "Send" }).click()
      return input.evaluate((el) => {
        const s = getComputedStyle(el)
        return {
          border: s.borderTopColor,
          width: Number.parseFloat(s.borderTopWidth),
          style: s.borderTopStyle,
          color: s.color,
          outline: s.outlineStyle,
          outlineColor: s.outlineColor,
        }
      })
    }
    const normal = await paint("input", "Name")
    expect(normal.style).toBe("solid")
    expect(normal.width).toBeGreaterThanOrEqual(1)
    // A system colour, not transparent: the text and the edge are painted alike (FieldText).
    expect(normal.border).not.toBe("rgba(0, 0, 0, 0)")
    expect(normal.border).toBe(normal.color)
    const focused = await paint("input", "Name", true)
    expect(focused.outline).toBe("solid")
    expect(focused.outlineColor).not.toBe(focused.border)
    const invalid = await paint("required-email", "Email", false, true)
    expect(invalid.width).toBeGreaterThan(normal.width)
    const disabled = await paint("focusable-disabled", "Plan")
    expect(disabled.border).not.toBe(normal.border)
    expect(disabled.width).toBeGreaterThanOrEqual(1)
  })
})

const STORIES = [
  "input",
  "textarea",
  "autosize",
  "with-description-and-error",
  "required-email",
  "search-box",
  "character-count-hard",
  "character-count-soft",
  "controlled-story",
  "read-only",
  "focusable-disabled",
  "inside-field",
  "inside-fieldset",
  "action-form",
  "variants-story",
  "driver-example",
]

describe("generic invariants on every TextField story", () => {
  for (const id of STORIES) {
    it(id, { timeout: 60_000 }, async () => {
      const page = await open(id)
      const boxes = await page.getByRole("textbox").all()
      expect(boxes.length, `${id}: no textbox`).toBeGreaterThan(0)
      for (const box of boxes) {
        const name = await box.evaluate((el) => {
          const labelled = (el as HTMLInputElement).labels?.[0]?.textContent
          return (labelled ?? el.getAttribute("aria-label") ?? "").trim()
        })
        expect(name, `${id}: a textbox without a name`).not.toBe("")
        const env = playwrightEnv(page).create({
          scope: "text-field",
          anchor: { role: "textbox", name },
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
