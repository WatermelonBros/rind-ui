/// <reference types="node" />
// Collapsible through the Playwright adapter, against the site examples harness: the driver in a real
// browser and the generic invariants on every Collapsible story.
import { type Browser, chromium, type Page } from "playwright"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { checkGeneric, getCollapsible, playwrightEnv } from "../../src/index"
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
  await openExample(page, site.base, "collapsible", id)
  await page.locator('[data-scope="collapsible"]').first().waitFor()
  return page
}
afterEach(async () => {
  for (const page of pages.splice(0)) await page.context().close()
})

describe("collapsible driver through Playwright", () => {
  it("opens, closes and toggles by pointer and keyboard", { timeout: 60_000 }, async () => {
    const page = await open("default")
    const section = getCollapsible(page, { name: /Details/ })
    expect(await section.isOpen()).toBe(false)
    await section.open()
    expect(await section.isOpen()).toBe(true)
    await section.close()
    expect(await section.isOpen()).toBe(false)
    await page.getByRole("button", { name: /Details/ }).focus()
    await page.keyboard.press("Enter")
    expect(await section.isOpen()).toBe(true)
    await page.keyboard.press("Space")
    expect(await section.isOpen()).toBe(false)
  })

  it("find-in-page: a beforematch on closed content opens it", { timeout: 60_000 }, async () => {
    const page = await open("find-in-page")
    const trigger = page.getByRole("button", { name: /Hidden section/ })
    expect(await trigger.getAttribute("aria-expanded")).toBe("false")
    await page.locator('[data-part="content"]').dispatchEvent("beforematch")
    expect(await trigger.getAttribute("aria-expanded")).toBe("true")
  })

  it("reduced motion: the content height changes without a transition", {
    timeout: 60_000,
  }, async () => {
    const page = await open("default", { reducedMotion: "reduce" })
    await page.getByRole("button", { name: /Details/ }).click()
    const duration = await page
      .locator('[data-part="content"]')
      .evaluate((el) => getComputedStyle(el).transitionDuration)
    expect(Number.parseFloat(duration)).toBe(0)
  })

  // Chromium emulates forced colors: the trigger is painted in a system colour.
  it("Forced colors: the trigger text is a system colour", { timeout: 60_000 }, async () => {
    const page = await open("default", { forcedColors: "active" })
    const color = await page
      .getByRole("button", { name: /Details/ })
      .evaluate((el) => getComputedStyle(el).color)
    expect(color).not.toBe("rgba(0, 0, 0, 0)")
  })
})

const STORIES = [
  "default",
  "initially-open",
  "disabled-story",
  "closed-content-until-found",
  "closed-content-hidden",
  "closed-content-unmount",
  "controlled-story",
  "nested",
  "list-reorder",
  "find-in-page",
  "driver-example",
]

describe("generic invariants on every Collapsible story", () => {
  for (const id of STORIES) {
    it(id, { timeout: 60_000 }, async () => {
      const page = await open(id)
      const triggers = await page.locator('[data-scope="collapsible"][data-part="trigger"]').all()
      expect(triggers.length, `${id}: no trigger`).toBeGreaterThan(0)
      for (const trigger of triggers) {
        const name = ((await trigger.textContent()) ?? "").replace("▸", "").trim()
        expect(name, `${id}: a trigger without a name`).not.toBe("")
        const env = playwrightEnv(page).create({
          scope: "collapsible",
          anchor: { role: "button", name },
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
