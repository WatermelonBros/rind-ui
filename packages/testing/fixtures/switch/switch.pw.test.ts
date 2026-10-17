/// <reference types="node" />
// Switch through the Playwright adapter, against the site examples harness: the driver in a real
// browser, forced colors, reduced motion, RTL thumb position, and the generic invariants on every Switch story.
import { type Browser, chromium, type Page } from "playwright"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { checkGeneric, getSwitch, playwrightEnv } from "../../src/index"
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
  await openExample(page, site.base, "switch", id)
  await page.locator('[data-scope="switch"]').first().waitFor()
  return page
}
afterEach(async () => {
  for (const page of pages.splice(0)) await page.context().close()
})

const control = (page: Page, name: string) => page.getByRole("switch", { name })
const ctl = '[data-scope="switch"][data-part="control"]'

describe("switch driver through Playwright", () => {
  it("toggles by pointer, Space and the label", { timeout: 60_000 }, async () => {
    const page = await open("default")
    const sw = getSwitch(page, { name: "Wi-Fi" })
    expect(await sw.isChecked()).toBe(false)
    await sw.toggle()
    expect(await sw.isChecked()).toBe(true)
    await sw.via("keyboard").toggle()
    expect(await sw.isChecked()).toBe(false)
    await sw.clickLabel()
    expect(await sw.isChecked()).toBe(true)
  })

  it("Space toggles; Enter does not", { timeout: 60_000 }, async () => {
    const page = await open("default")
    await page.keyboard.press("Tab")
    await page.keyboard.press("Space")
    expect(await control(page, "Wi-Fi").getAttribute("aria-checked")).toBe("true")
    await page.keyboard.press("Enter")
    expect(await control(page, "Wi-Fi").getAttribute("aria-checked")).toBe("true")
  })

  it("reads the form value and resets to the default", { timeout: 60_000 }, async () => {
    const page = await open("in-form-story")
    const news = getSwitch(page, { name: "Notifications" })
    const sounds = getSwitch(page, { name: "Sounds" })
    expect(await news.formValue()).toBe("yes")
    await news.toggle()
    expect(await news.formValue()).toBeNull()
    await sounds.toggle()
    await sounds.resetForm()
    expect(await news.isChecked()).toBe(true)
    expect(await sounds.isChecked()).toBe(false)
  })

  it("reduced motion: nothing transitions", { timeout: 60_000 }, async () => {
    const page = await open("checked", { reducedMotion: "reduce" })
    const [track, thumb] = await Promise.all(
      [ctl, '[data-scope="switch"][data-part="thumb"]'].map((sel) =>
        page.locator(sel).evaluate((el) => getComputedStyle(el).transitionDuration),
      ),
    )
    expect(Number.parseFloat(track ?? "")).toBe(0)
    expect(Number.parseFloat(thumb ?? "")).toBe(0)
  })
})

// ARK#3421: under forced colors both states must stay distinguishable and the track visible.
describe("forced colors", () => {
  const paint = async (id: string) => {
    const page = await open(id, { forcedColors: "active" })
    const box = page.locator(ctl).first()
    const style = await box.evaluate((el) => {
      const s = getComputedStyle(el)
      const thumb = getComputedStyle(el.querySelector('[data-part="thumb"]') as HTMLElement)
      return {
        bg: s.backgroundColor,
        border: `${s.borderTopStyle} ${s.borderTopWidth} ${s.borderTopColor}`,
        thumb: thumb.backgroundColor,
      }
    })
    return { style, image: (await box.screenshot()).toString("base64") }
  }

  it("unchecked and checked differ and the track border is visible", {
    timeout: 60_000,
  }, async () => {
    const [off, on] = await Promise.all(["default", "checked"].map(paint))
    for (const state of [off, on]) {
      expect(state?.style.border).toMatch(/^solid [1-9]/)
    }
    expect(off?.image).not.toBe(on?.image)
    expect(on?.style.bg).not.toBe(off?.style.bg)
  })

  it("checked uses Highlight; disabled uses GrayText", { timeout: 60_000 }, async () => {
    const sys = (page: Page, name: string, prop: "color" | "borderTopColor") =>
      page.evaluate(
        ([n, p]) => {
          const span = document.createElement("span")
          span.style.color = n as string
          span.style.borderColor = n as string
          document.body.append(span)
          return getComputedStyle(span)[p as "color"]
        },
        [name, prop],
      )
    const checked = await open("checked", { forcedColors: "active" })
    const bg = await checked.locator(ctl).evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(bg).toBe(await sys(checked, "Highlight", "color"))
    const disabled = await open("disabled", { forcedColors: "active" })
    const border = await disabled
      .locator(ctl)
      .first()
      .evaluate((el) => getComputedStyle(el).borderTopColor)
    expect(border).toBe(await sys(disabled, "GrayText", "color"))
  })

  it("the focus ring is visible", { timeout: 60_000 }, async () => {
    const page = await open("default", { forcedColors: "active" })
    await page.keyboard.press("Tab")
    const ring = await page.locator(ctl).evaluate((el) => getComputedStyle(el).outlineStyle)
    expect(ring).toBe("solid")
  })
})

// The thumb sits at the inline start when off and moves to the inline end when on, mirrored in RTL.
describe("RTL thumb", () => {
  it("mirrors the thumb and stays inside the track", { timeout: 60_000 }, async () => {
    const page = await open("rtl")
    const rects = await page.locator(ctl).evaluateAll((els) =>
      els.map((el) => {
        const c = el.getBoundingClientRect()
        const t = (el.querySelector('[data-part="thumb"]') as HTMLElement).getBoundingClientRect()
        return { cl: c.left, cr: c.right, tl: t.left, tr: t.right }
      }),
    )
    const [off, on] = rects
    expect(off && on).toBeTruthy()
    if (!off || !on) return
    // Off hugs the right edge (inline start), on hugs the left edge (inline end).
    expect(off.cr - off.tr).toBeLessThan(on.cr - on.tr)
    expect(on.tl - on.cl).toBeLessThan(off.tl - off.cl)
    for (const r of rects) expect(r.tl >= r.cl && r.tr <= r.cr).toBe(true)
    const doc = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    )
    expect(doc, "no horizontal overflow in RTL").toBe(true)
  })
})

const STORIES = [
  "default",
  "checked",
  "disabled",
  "focusable-when-disabled",
  "read-only",
  "in-form-story",
  "with-description-story",
  "rtl",
  "driver-example",
]

describe("generic invariants on every Switch story", () => {
  for (const id of STORIES) {
    it(id, { timeout: 60_000 }, async () => {
      const page = await open(id)
      const roots = await page.locator(ctl).all()
      expect(roots.length, `${id}: no switch`).toBeGreaterThan(0)
      for (const el of roots) {
        const name = await el.evaluate((node) => {
          const text = (node as HTMLButtonElement).labels?.[0]?.textContent
          const by = node.getAttribute("aria-labelledby")
          return (text ?? (by ? document.getElementById(by)?.textContent : null) ?? "").trim()
        })
        expect(name, `${id}: a switch without a name`).not.toBe("")
        const env = playwrightEnv(page).create({
          scope: "switch",
          anchor: { role: "switch", name },
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
