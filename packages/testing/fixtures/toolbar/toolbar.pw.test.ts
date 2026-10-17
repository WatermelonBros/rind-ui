/// <reference types="node" />
// Toolbar through the Playwright adapter, against the site examples harness: the driver in a
// real browser, forced colors on the focus ring, separators and pressed toggles, RTL, and the generic
// invariants on every Toolbar story.

import { mkdirSync } from "node:fs"
import { join } from "node:path"
import { type Browser, chromium, type Page } from "playwright"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { checkGeneric, getToolbar, playwrightEnv } from "../../src/index"
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
  await openExample(page, site.base, "toolbar", id)
  await page.locator('[data-scope="toolbar"]').first().waitFor()
  return page
}
afterEach(async () => {
  for (const page of pages.splice(0)) await page.context().close()
})

const captures = join(import.meta.dirname, "../../../../.vitest/attachments/captures")
const focusedName = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement
    const labelled = el?.getAttribute("aria-labelledby")
    return (
      el?.getAttribute("aria-label") ??
      (labelled ? document.getElementById(labelled)?.textContent : null) ??
      el?.textContent ??
      null
    )
  })

describe("toolbar driver through Playwright", () => {
  it("tabs in, moves, remembers the last control", { timeout: 60_000 }, async () => {
    const page = await open("default")
    const toolbar = getToolbar(page, { name: "Formatting" })
    expect(await toolbar.items()).toEqual([
      "Bold",
      "Italic",
      "Underline",
      "Left",
      "Center",
      "Right",
      "Help",
      "Font size",
    ])
    await toolbar.tabIn()
    expect(await toolbar.focusedItem()).toBe("Bold")
    await toolbar.moveTo("Underline")
    expect(await toolbar.focusedItem()).toBe("Underline")
    await toolbar.tabOut()
    expect(await toolbar.focusedItem()).toBeNull()
    expect(await toolbar.tabStop()).toBe("Underline")
    await toolbar.tabIn()
    expect(await toolbar.focusedItem()).toBe("Underline")
  })

  it("presses a hosted radio and a hosted toggle by pointer", { timeout: 60_000 }, async () => {
    const page = await open("default")
    const toolbar = getToolbar(page, { name: "Formatting" })
    await toolbar.press("Bold")
    expect(await page.getByRole("button", { name: "Bold" }).getAttribute("aria-pressed")).toBe(
      "true",
    )
    await toolbar.press("Center")
    expect(await page.getByRole("radio", { name: "Center" }).getAttribute("aria-checked")).toBe(
      "true",
    )
  })
})

describe("toolbar keyboard", () => {
  it("is one tab stop; arrows wrap and Home / End jump", { timeout: 60_000 }, async () => {
    const page = await open("default")
    await page.getByRole("button", { name: "Before" }).focus()
    await page.keyboard.press("Tab")
    expect(await focusedName(page)).toBe("Bold")
    await page.keyboard.press("ArrowRight")
    expect(await focusedName(page)).toBe("Italic")
    await page.keyboard.press("End")
    expect(await focusedName(page)).toBe("Font size")
    await page.keyboard.press("Shift+Tab") // leaves the toolbar backwards
    expect(await focusedName(page)).toBe("Before")
    await page.keyboard.press("Tab") // focus memory
    expect(await focusedName(page)).toBe("Font size")
    await page.getByRole("button", { name: "Bold" }).focus()
    await page.keyboard.press("ArrowLeft") // wraps to the text field
    expect(await focusedName(page)).toBe("Font size")
    await page.keyboard.press("Tab")
    expect(await focusedName(page)).toBe("After")
    await page.keyboard.press("Shift+Tab")
    expect(await focusedName(page)).toBe("Font size") // focus memory
  })

  it("arrows moving through a hosted radio group never check it", { timeout: 60_000 }, async () => {
    const page = await open("default")
    await page.getByRole("radio", { name: "Left" }).focus()
    await page.keyboard.press("ArrowRight")
    const center = page.getByRole("radio", { name: "Center" })
    expect(await center.evaluate((e) => e === document.activeElement)).toBe(true)
    expect(await center.getAttribute("aria-checked")).toBe("false")
    await page.keyboard.press("Enter")
    expect(await page.getByRole("radio", { name: "Center" }).getAttribute("aria-checked")).toBe(
      "true",
    )
  })

  it("vertical: Up and Down move", { timeout: 60_000 }, async () => {
    const page = await open("vertical-story")
    await page.getByRole("button", { name: "Before" }).focus()
    await page.keyboard.press("Tab")
    expect(await focusedName(page)).toBe("Cut")
    await page.keyboard.press("ArrowDown")
    expect(await focusedName(page)).toBe("Copy")
    await page.keyboard.press("ArrowRight") // not this axis
    expect(await focusedName(page)).toBe("Copy")
  })

  it("a text field keeps its caret keys", { timeout: 60_000 }, async () => {
    const page = await open("text-field-in-the-middle")
    const search = page.getByRole("textbox", { name: "Search" })
    // A static page hydrated by React leaves the caret at the start; a client-rendered input
    // (as the story was) has it at the end, so set it as the user's last click would have.
    await search.evaluate((el: HTMLInputElement) =>
      el.setSelectionRange(el.value.length, el.value.length),
    )
    await search.focus()
    // Focus keeps the caret at the end ("rind"): ArrowLeft moves it, the toolbar does not.
    await page.keyboard.press("ArrowLeft")
    expect(await focusedName(page)).toBe("Search")
    await page.keyboard.press("ArrowRight") // back at the end, still the field's key
    expect(await focusedName(page)).toBe("Search")
    await page.keyboard.press("ArrowRight") // at the end: the control moves
    expect(await focusedName(page)).toBe("Sort")
  })

  it("press without focus keeps the editor's selection", { timeout: 60_000 }, async () => {
    const page = await open("editor-toolbar")
    const editor = page.getByRole("textbox", { name: "Document" })
    await editor.focus()
    await page.keyboard.press("Control+A")
    await page.getByRole("button", { name: "Bold" }).click()
    expect(await editor.evaluate((e) => e === document.activeElement)).toBe(true)
    expect(await page.getByText("Toolbar presses: 1").count()).toBe(1)
  })

  it("RTL: ArrowRight goes to the previous control and the row is mirrored", {
    timeout: 60_000,
  }, async () => {
    const page = await open("rtl")
    await page.getByRole("button", { name: "Before" }).focus()
    await page.keyboard.press("Tab")
    expect(await focusedName(page)).toBe("Bold")
    await page.keyboard.press("ArrowLeft")
    expect(await focusedName(page)).toBe("Italic")
    await page.keyboard.press("ArrowRight")
    expect(await focusedName(page)).toBe("Bold")
    const bold = await page.getByRole("button", { name: "Bold" }).boundingBox()
    const help = await page.getByRole("link", { name: "Help" }).boundingBox()
    expect((bold?.x ?? 0) > (help?.x ?? 0)).toBe(true)
  })

  it("disabled controls stay reachable (aria-disabled) unless skipped", {
    timeout: 60_000,
  }, async () => {
    const page = await open("disabled-controls")
    await page.getByRole("button", { name: "Undo" }).focus()
    await page.keyboard.press("ArrowRight")
    expect(await focusedName(page)).toBe("Redo")
    const skipped = await open("disabled-skipped")
    await skipped.getByRole("button", { name: "Undo" }).focus()
    await skipped.keyboard.press("ArrowRight")
    expect(await focusedName(skipped)).toBe("Print")
  })
})

// Captures: the focus ring, the separators and a pressed toggle must stay visible with
// system colours only.
describe("forced colors", () => {
  it("focus ring, separators and pressed toggles are visible", { timeout: 60_000 }, async () => {
    const page = await open("default", { forcedColors: "active" })
    mkdirSync(captures, { recursive: true })
    await page.getByRole("button", { name: "Before" }).focus()
    await page.keyboard.press("Tab")
    const ring = await page.evaluate(() => {
      const s = getComputedStyle(document.activeElement as Element)
      return {
        style: s.outlineStyle,
        width: Number.parseFloat(s.outlineWidth),
        color: s.outlineColor,
      }
    })
    expect(ring.style).not.toBe("none")
    expect(ring.width).toBeGreaterThan(0)
    expect(ring.color).not.toBe("rgba(0, 0, 0, 0)")

    const sep = await page
      .locator('[data-scope="toolbar"][data-part="separator"]')
      .first()
      .evaluate((el) => {
        const s = getComputedStyle(el)
        return {
          style: s.borderInlineStartStyle,
          width: Number.parseFloat(s.borderInlineStartWidth),
          color: s.borderInlineStartColor,
        }
      })
    expect(sep.style).toBe("solid")
    expect(sep.width).toBeGreaterThanOrEqual(1)
    expect(sep.color).not.toBe("rgba(0, 0, 0, 0)")

    const bold = page.getByRole("button", { name: "Bold" })
    const paint = () =>
      bold.evaluate((el) => {
        const s = getComputedStyle(el)
        return `${s.backgroundColor}|${s.outlineStyle}|${s.color}`
      })
    const off = await paint()
    await bold.click()
    expect(await paint()).not.toBe(off)
    await page.screenshot({ path: join(captures, "toolbar-forced-colors.png") })
  })
})

const STORIES: Record<string, string> = {
  default: "Formatting",
  vertical: "Tools",
  "text-field-last": "Search tools",
  "text-field-in-the-middle": "Search tools",
  "disabled-controls": "Actions",
  "disabled-skipped": "Actions",
  "all-disabled": "Actions",
  "editor-toolbar": "Editor tools",
  rtl: "Formatting",
  "driver-example": "Formatting",
}

describe("generic invariants on every Toolbar story", () => {
  for (const [id, name] of Object.entries(STORIES)) {
    it(id, { timeout: 60_000 }, async () => {
      const page = await open(id)
      const env = playwrightEnv(page).create({
        scope: "toolbar",
        anchor: { role: "toolbar", name },
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
        traits: ["directional"],
        semantics: {},
        values: {},
      })
      expect(problems, id).toEqual([])
    })
  }
})
