/// <reference types="node" />
// Menubar through the Playwright adapter, against the site examples harness: the driver's
// round trip unchanged from the DOM tests (spec "Same test in Playwright"), hover switching
// with a real mouse, a vertical bar, and forced-colors captures of the open item.

import { mkdirSync } from "node:fs"
import { join } from "node:path"
import { type Browser, chromium, type Page } from "playwright"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { getMenubar } from "../../src/index"
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
  await openExample(page, site.base, "menubar", id)
  await page.getByRole("menubar").first().waitFor()
  return page
}
afterEach(async () => {
  for (const page of pages.splice(0)) await page.context().close()
})

const captures = join(import.meta.dirname, "../../../../.vitest/attachments/captures")

describe("menubar driver through Playwright", () => {
  it("opens, switches and runs an item (the DOM test's round trip)", {
    timeout: 60_000,
  }, async () => {
    const page = await open("driver-example")
    const bar = getMenubar(page, { name: "Application" })
    expect(await bar.items()).toEqual(["File", "Edit", "View"])
    await bar.openMenu("File")
    await bar.switchTo("Edit")
    await bar.menu("Edit").choose("Find…")
    await expect.poll(() => page.getByText("Ran: Find…").count()).toBe(1)
    expect(await bar.currentMenu()).toBeNull()
  })

  it("by keyboard: tab in, arrows, open, switch, Escape back to the bar", {
    timeout: 60_000,
  }, async () => {
    const page = await open("driver-example")
    const bar = getMenubar(page, { name: "Application" }).via("keyboard")
    await bar.tabIn()
    await bar.openMenu("File")
    await bar.switchTo("View")
    await bar.closeMenu()
    expect(await bar.focusedItem()).toBe("View")
    await bar.tabOut()
    expect(await bar.tabStop()).toBe("View")
  })

  it("a real mouse switches menus by hover once one is open", { timeout: 60_000 }, async () => {
    const page = await open("default")
    await page.getByRole("menuitem", { name: "Edit" }).hover()
    expect(await page.getByRole("menu").count()).toBe(0)
    await page.getByRole("menuitem", { name: "File" }).click()
    await page.getByRole("menu", { name: "File" }).waitFor()
    await page.getByRole("menuitem", { name: "View" }).hover()
    await page.getByRole("menu", { name: "View" }).waitFor()
    await expect.poll(() => page.getByRole("menu").count()).toBe(1)
  })

  it("vertical: ArrowDown moves along the bar, ArrowRight opens beside the item", {
    timeout: 60_000,
  }, async () => {
    const page = await open("vertical-bar")
    const bar = getMenubar(page, { name: "Application" }).via("keyboard")
    await bar.tabIn()
    await page.keyboard.press("ArrowDown")
    expect(await bar.focusedItem()).toBe("Edit")
    await page.keyboard.press("ArrowRight")
    const menu = page.getByRole("menu", { name: "Edit" })
    await menu.waitFor()
    const item = await page.getByRole("menuitem", { name: "Edit" }).boundingBox()
    const box = await menu.boundingBox()
    expect(box && item && box.x >= item.x + item.width - 1).toBe(true)
  })

  it("forced colors: the open item and the focus ring stay visible", {
    timeout: 60_000,
  }, async () => {
    mkdirSync(captures, { recursive: true })
    const page = await open("default", { forcedColors: "active" })
    const bar = getMenubar(page, { name: "Application" }).via("keyboard")
    await bar.tabIn()
    await page.screenshot({ path: join(captures, "menubar-forced-colors-focus.png") })
    await bar.openMenu("Edit")
    await page.screenshot({ path: join(captures, "menubar-forced-colors-open.png") })
    // box-shadow is dropped in forced colours: the open edge is an outline.
    const edge = await page
      .getByRole("menuitem", { name: "Edit" })
      .evaluate((el) => getComputedStyle(el).outlineStyle)
    expect(edge).not.toBe("none")
  })
})
