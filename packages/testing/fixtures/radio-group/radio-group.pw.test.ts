/// <reference types="node" />
// Radio Group through the Playwright adapter, against the site examples harness: the driver in a
// real browser, forced colors on checked/unchecked radios (radix#2993), RTL, and the generic
// invariants on every Radio Group story.
import { type Browser, chromium, type Page } from "playwright"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { checkGeneric, getRadioGroup, playwrightEnv } from "../../src/index"
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
  await openExample(page, site.base, "radio-group", id)
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
    expect(await group.checked()).toBeNull()
    // Walk to Large the way the story's former play function did.
    await group.check("Medium")
    await group.via("keyboard").check("Large")
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
    const page = await open("in-form-story")
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
  "horizontal-story",
  "with-descriptions-story",
  "disabled-item",
  "disabled-group",
  "read-only",
  "in-form-story",
  "rtl",
  "controlled-story",
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
