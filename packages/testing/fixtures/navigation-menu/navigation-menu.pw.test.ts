/// <reference types="node" />
// Navigation Menu through the Playwright adapter, against the site examples harness (task
// 4.2): the same driver calls as the DOM tests, with a real mouse and real time.

import { type Browser, chromium, type Page } from "playwright"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { getNavigationMenu } from "../../src/index"
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
async function open(id: string) {
  const context = await browser.newContext()
  const page = await context.newPage()
  pages.push(page)
  await openExample(page, site.base, "navigation-menu", id)
  await page.getByRole("navigation", { name: "Docs" }).waitFor()
  return page
}
afterEach(async () => {
  for (const page of pages.splice(0)) await page.context().close()
})

describe("navigation menu driver through Playwright", () => {
  it("opens, lists the panel's links, closes with Escape (the DOM test's round trip)", {
    timeout: 60_000,
  }, async () => {
    const page = await open("basic")
    const nav = getNavigationMenu(page, { name: "Docs" })
    await nav.open("Components")
    expect(await nav.openItem()).toBe("Components")
    expect(await nav.links("Components")).toEqual(["Button", "Dialog", "Tabs"])
    await nav.via("keyboard").pressEscape()
    expect(await nav.openItem()).toBe(null)
  })

  it("a real mouse opens by hover and switches at once", { timeout: 60_000 }, async () => {
    const page = await open("basic")
    const nav = getNavigationMenu(page, { name: "Docs" }).via("pointer")
    await nav.hover("Components")
    expect(await nav.openItem()).toBe("Components")
    await nav.hoverTrigger("Guides")
    await expect.poll(() => nav.openItem()).toBe("Guides")
  })
})
