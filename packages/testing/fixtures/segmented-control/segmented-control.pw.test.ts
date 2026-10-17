/// <reference types="node" />
// Segmented Control through the Playwright adapter, against the site examples harness: the driver in a
// real browser, forced colors on the selected segment, reduced motion, RTL, and the generic invariants on
// every Segmented Control story.
import { type Browser, chromium, type Page } from "playwright"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { checkGeneric, getSegmentedControl, playwrightEnv } from "../../src/index"
import { openExample, type SiteServer, serveSite } from "../harness"

/** Drains animation frames in the page (a condition-free "let it settle"). */
const frames = (page: Page, count = 6) =>
  page.evaluate(
    (n) =>
      new Promise<void>((resolve) => {
        const step = (left: number) =>
          left <= 0 ? resolve() : requestAnimationFrame(() => step(left - 1))
        step(n)
      }),
    count,
  )

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
  await openExample(page, site.base, "segmented-control", id)
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
    // Walk to Month the way the story's former play function did.
    await control.select("Week")
    await control.via("keyboard").select("Month")
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
    const page = await open("in-form-story")
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
      // Past the transition: every running animation/transition has finished.
      await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)))
      await frames(page)
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
  "with-label-story",
  "vertical",
  "icon-segments",
  "disabled-segment",
  "read-only",
  "in-form-story",
  "rtl",
  "controlled-story",
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
