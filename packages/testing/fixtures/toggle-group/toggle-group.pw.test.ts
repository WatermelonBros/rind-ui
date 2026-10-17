/// <reference types="node" />
// Toggle Group through the Playwright adapter, against the site examples harness: the driver in a
// real browser, forced colors on a pressed item, RTL, and the generic invariants on every
// Toggle Group story.
import { type Browser, chromium, type Page } from "playwright"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { checkGeneric, getToggleGroup, playwrightEnv } from "../../src/index"
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
  await openExample(page, site.base, "toggle-group", id)
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
    expect(await group.pressed()).toEqual([])
    // Press Italic and Underline the way the story's former play function did.
    await group.toggle("Italic")
    await group.via("keyboard").toggle("Underline")
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
    const page = await open("disabled-item-story", { forcedColors: "active" })
    const color = (name: string) =>
      item(page, name).evaluate((el) => getComputedStyle(el).borderTopColor)
    expect(await color("Italic")).not.toBe(await color("Underline"))
  })
})

const STORIES = [
  "single",
  "multiple-story",
  "disallow-empty",
  "vertical-story",
  "disabled-item-story",
  "focusable-when-disabled",
  "icon-only",
  "rtl",
  "controlled-story",
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
