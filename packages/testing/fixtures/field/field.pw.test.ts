/// <reference types="node" />
// Field through the Playwright adapter, against the site examples harness: the driver in a real
// browser and the generic invariants on every Field story.
import { fieldContract } from "@rind-ui/core"
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
  await openExample(page, site.base, "field", id)
  await page.locator('[data-scope="field"]').first().waitFor()
  return page
}
afterEach(async () => {
  for (const page of pages.splice(0)) await page.context().close()
})

describe("field driver through Playwright", () => {
  it("invalid email, submit: isInvalid, errors, controlName", { timeout: 60_000 }, async () => {
    // A story without a play function: nothing has been submitted yet.
    const page = await open("submit")
    const field = createDriverWith(fieldContract, page, [{ label: "Email" }])
    expect(await field.isInvalid()).toBe(false)
    await page.getByRole("textbox", { name: "Email" }).fill("abc")
    await page.getByRole("button", { name: "Send" }).click()
    // Queries read now: wait for the submit to be handled.
    await expect.poll(() => field.isInvalid()).toBe(true)
    expect((await field.errors()).length).toBeGreaterThan(0)
    expect(await field.controlName()).toBe("Email")
  })

  // Chromium emulates forced colors; the stylesheet-only check lives in field.browser.test.tsx.
  it("Error visible in forced colors", { timeout: 60_000 }, async () => {
    const page = await open("invalid", { forcedColors: "active" })
    expect(await page.evaluate(() => matchMedia("(forced-colors: active)").matches)).toBe(true)
    const error = page.locator('[data-part="error-message"]')
    expect(await error.isVisible()).toBe(true)
    const painted = await error.evaluate((el) => {
      const text = getComputedStyle(el)
      const icon = getComputedStyle(el, "::before")
      return {
        text: text.color,
        mask: icon.maskImage,
        background: icon.backgroundColor,
        width: Number.parseFloat(icon.width),
      }
    })
    expect(painted.mask).toMatch(/^url\(/)
    expect(painted.width).toBeGreaterThan(0)
    // The icon is a system colour, not transparent: the same CanvasText the text uses.
    expect(painted.background).toBe(painted.text)
  })
})

const STORIES = [
  "with-description-and-error",
  "submit",
  "blur",
  "change",
  "aria-behavior",
  "async-validate",
  "match-messages",
  "disabled",
  "read-only",
  "required",
  "inside-disabled-fieldset",
  "no-error-message",
  "idle",
  "valid",
  "invalid",
]

describe("generic invariants on every Field story", () => {
  for (const id of STORIES) {
    it(id, { timeout: 60_000 }, async () => {
      const page = await open(id)
      const labels = await page.locator('[data-scope="field"][data-part="label"]').all()
      expect(labels.length, `${id}: no Field label`).toBeGreaterThan(0)
      for (const el of labels) {
        const name = ((await el.textContent()) ?? "").trim()
        expect(name, `${id}: a label without text`).not.toBe("")
        const env = playwrightEnv(page).create({
          scope: "field",
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
