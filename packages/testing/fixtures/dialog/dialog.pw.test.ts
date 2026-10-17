/// <reference types="node" />
// Dialog through the Playwright adapter, against the site examples harness: the driver in a real
// browser, forced colors, reduced motion, the generic invariants on every Dialog story, and
// the model-based run against the exit-animation story (reopen during the exit).

import { mkdirSync } from "node:fs"
import { join } from "node:path"
import { dialogContract } from "@rind-ui/core"
import { type Browser, chromium, type Page } from "playwright"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { checkGeneric, getDialog, playwrightEnv, testMachine } from "../../src/index"
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
  const context = await browser.newContext({ hasTouch: true, ...options })
  const page = await context.newPage()
  pages.push(page)
  await openExample(page, site.base, "dialog", id)
  await page.locator('[data-scope="dialog"][data-part="trigger"]').first().waitFor()
  return page
}
afterEach(async () => {
  for (const page of pages.splice(0)) await page.context().close()
})

const captures = join(import.meta.dirname, "../../../../.vitest/attachments/captures")
const dialogs = (page: Page) => page.getByRole("dialog")

describe("dialog driver through Playwright", () => {
  it("opens, names itself, closes, restores focus", { timeout: 60_000 }, async () => {
    const page = await open("default")
    const dialog = getDialog(page, { name: "Edit profile" })
    expect(await dialog.isOpen()).toBe(false)
    await dialog.open()
    expect(await dialog.isOpen()).toBe(true)
    expect(await dialog.isModal()).toBe(true)
    expect(await dialog.title()).toBe("Edit profile")
    expect(await dialog.description()).toBe("Make changes to your profile here.")
    expect(await dialog.hasFocus()).toBe(true)
    await dialog.pressEscape()
    expect(await dialog.isOpen()).toBe(false)
    expect(await dialog.closeReason()).toBe("escape-key")
    expect(await page.evaluate(() => document.activeElement?.textContent)).toBe("Edit profile")
  })

  it("keyboard and pointer round trips", { timeout: 60_000 }, async () => {
    const page = await open("default")
    const dialog = getDialog(page, { name: "Edit profile" })
    await dialog.via("keyboard").open()
    expect(await dialog.isOpen()).toBe(true)
    await dialog.via("keyboard").close()
    expect(await dialog.isOpen()).toBe(false)
    await dialog.via("pointer").open()
    await dialog.via("pointer").pressOutside()
    expect(await dialog.isOpen()).toBe(false)
    expect(await dialog.closeReason()).toBe("outside-press")
  })

  it("Escape closes only the inner of nested dialogs", { timeout: 60_000 }, async () => {
    const page = await open("nested-story")
    await page.getByRole("button", { name: "Open outer" }).click()
    await page.getByRole("dialog", { name: "Outer dialog" }).waitFor()
    await page.getByRole("button", { name: "Open inner" }).click()
    await page.getByRole("dialog", { name: "Inner dialog" }).waitFor()
    await page.keyboard.press("Escape")
    await expect.poll(() => dialogs(page).count()).toBe(1)
    await page.getByRole("dialog", { name: "Outer dialog" }).waitFor()
  })

  it("a submit-type close trigger closes when the form submits; Enter submits", {
    timeout: 60_000,
  }, async () => {
    const page = await open("form-inside")
    await page.getByRole("button", { name: "Rename" }).click()
    const field = page.getByRole("textbox", { name: "Name" })
    await field.fill("Grace")
    await page.keyboard.press("Enter")
    await expect.poll(() => dialogs(page).count()).toBe(0)
    expect(await page.getByText("Saved: Grace").count()).toBe(1)
  })

  it("a non-modal dialog leaves the page usable", { timeout: 60_000 }, async () => {
    const page = await open("non-modal-story")
    const dialog = getDialog(page, { name: "Notes", modal: false })
    await page.getByRole("button", { name: "Notes" }).click()
    await page.getByRole("dialog").waitFor()
    expect(await dialog.isOpen()).toBe(true)
    await page.getByRole("textbox").last().focus()
    expect(await dialogs(page).count()).toBe(1)
  })
})

describe("forced colors", () => {
  it("the content keeps a border and the close trigger a focus ring", {
    timeout: 60_000,
  }, async () => {
    const page = await open("closed", { forcedColors: "active" })
    mkdirSync(captures, { recursive: true })
    await page.keyboard.press("Tab")
    await page.keyboard.press("Enter")
    const content = page.locator('[data-scope="dialog"][data-part="content"]')
    await content.waitFor()
    const border = await content.evaluate((el) => {
      const s = getComputedStyle(el)
      return {
        style: s.borderTopStyle,
        width: Number.parseFloat(s.borderTopWidth),
        color: s.borderTopColor,
      }
    })
    expect(border.style).toBe("solid")
    expect(border.width).toBeGreaterThanOrEqual(1)
    expect(border.color).not.toBe("rgba(0, 0, 0, 0)")
    await page.keyboard.press("Tab")
    await page.keyboard.press("Tab")
    const ring = await page.evaluate(() => {
      const s = getComputedStyle(document.activeElement as Element)
      return { style: s.outlineStyle, width: Number.parseFloat(s.outlineWidth) }
    })
    expect(ring.style).not.toBe("none")
    expect(ring.width).toBeGreaterThan(0)
    await page.screenshot({ path: join(captures, "dialog-forced-colors.png") })
  })
})

describe("reduced motion", () => {
  it("the theme's transitions are off and the dialog still opens and closes", {
    timeout: 60_000,
  }, async () => {
    const page = await open("open", { reducedMotion: "reduce" })
    const content = page.locator('[data-scope="dialog"][data-part="content"]')
    await content.waitFor()
    expect(await content.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe("0s")
    await page.keyboard.press("Escape")
    await expect.poll(() => dialogs(page).count()).toBe(0)
    mkdirSync(captures, { recursive: true })
    await page.screenshot({ path: join(captures, "dialog-reduced-motion.png") })
  })
})

const STORIES: Record<string, string> = {
  default: "Edit profile",
  closed: "Edit profile",
  "controlled-story": "Settings",
  "non-modal-story": "Notes",
  "nested-story": "Open outer",
  "form-inside": "Rename",
  "long-content-story": "Terms",
  "two-triggers": "First trigger",
  "keep-mounted": "Keep mounted",
  "exit-animation": "Slow exit",
  "driver-example": "Edit profile",
}

describe("generic invariants on every Dialog story", () => {
  for (const [id, name] of Object.entries(STORIES)) {
    it(id, { timeout: 60_000 }, async () => {
      const page = await open(id)
      const env = playwrightEnv(page).create({
        scope: "dialog",
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
      expect(problems, id).toEqual([])
    })
  }
})

describe("testMachine through Playwright (400ms exit)", () => {
  testMachine(dialogContract, {
    test: (name, fn) => it(name, { timeout: 60_000 }, () => fn()),
    setup: () => open("exit-animation"),
    target: (page) => page,
    anchor: [{ name: "Slow exit" }],
    props: {
      open: undefined,
      closeOnEscape: undefined,
      closeOnInteractOutside: undefined,
      modal: undefined,
      root: "oracle",
    },
  })
})
