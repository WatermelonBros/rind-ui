/// <reference types="node" />
// Shared setup of the ported Storybook play functions: one server, one browser, a fresh
// context per test (closed afterwards), each example opened in the theme-calm skin.
import { type Browser, chromium, type Page } from "playwright"
import { afterAll, afterEach, beforeAll } from "vitest"
import { openExample, type SiteServer, serveSite } from "../harness"

export function playHarness(slug: string) {
  let site: SiteServer
  let browser: Browser
  const pages: Page[] = []

  beforeAll(async () => {
    site = await serveSite()
    browser = await chromium.launch()
  }, 60_000)
  afterAll(async () => {
    await browser?.close()
    site?.close()
  })
  afterEach(async () => {
    for (const page of pages.splice(0)) await page.context().close()
  })

  return async function open(example: string): Promise<Page> {
    const context = await browser.newContext()
    const page = await context.newPage()
    pages.push(page)
    await openExample(page, site.base, slug, example)
    return page
  }
}
