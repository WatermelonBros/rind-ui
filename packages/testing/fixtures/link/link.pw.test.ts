/// <reference types="node" />
// Link through the Playwright adapter, against the site examples harness: the driver and
// `navigated()` (in-page router log, URL change, new page), and the generic invariants on
// every Link story (accessible name, no aria-hidden focusables, one navigation per bare click).
import { linkContract, platforms } from "@rind-ui/core"
import { type Browser, chromium, type Page } from "playwright"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { checkGeneric, createDriverWith, playwrightEnv } from "../../src/index"
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
async function open(id: string) {
  const context = await browser.newContext()
  const page = await context.newPage()
  pages.push(page)
  await openExample(page, site.base, "link", id)
  await page.locator('[data-scope="link"]').first().waitFor()
  return page
}
afterEach(async () => {
  for (const page of pages.splice(0)) await page.context().close()
})

const routerCalls = (page: Page) =>
  page.evaluate(
    () =>
      (Reflect.get(globalThis, Symbol.for("rind-ui.navigations")) as unknown[] | undefined)
        ?.length ?? 0,
  )

describe("link driver through Playwright", () => {
  it("follow, keyboard twin and new tab", { timeout: 60_000 }, async () => {
    const page = await open("standalone")
    const link = createDriverWith(linkContract, page, [{ name: "Documentation" }], {
      platform: process.platform === "darwin" ? platforms.apple : platforms.linux,
    })
    const before = await routerCalls(page)
    await link.follow()
    await link.via("keyboard").follow()
    expect(await routerCalls(page)).toBe(before + 2)
    // ⌘/Ctrl+click: the browser opens a new page, the router is not called.
    const popup = page.context().waitForEvent("page")
    await link.followInNewTab()
    await popup
    expect(await routerCalls(page)).toBe(before + 2)
  })

  it("follow on a disabled link fails naming isDisabled", { timeout: 60_000 }, async () => {
    const page = await open("disabled-story")
    const link = createDriverWith(linkContract, page, [{ name: "Documentation" }])
    await expect(link.follow()).rejects.toThrow(/link\.follow \[pointer\].*"isDisabled":true/)
  })
})

const STORIES = [
  "inline",
  "standalone",
  "external-story",
  "current-story",
  "disabled-story",
  "focusable-when-disabled",
  "as-div",
  "danger",
  "render-router-link",
  "rtl",
  "followed-with-driver",
  "queries",
  "disabled-query",
]

describe("generic invariants on every Link story", () => {
  for (const id of STORIES) {
    it(id, { timeout: 60_000 }, async () => {
      const page = await open(id)
      const links = await page.locator('[data-scope="link"]').all()
      for (const el of links) {
        const name = (await el.textContent())?.trim() ?? ""
        expect(name, `${id}: a link without a name`).not.toBe("")
        const env = playwrightEnv(page).create({
          scope: "link",
          anchor: { text: name },
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
        // A bare click (assistive technology) on a same-tab link navigates exactly once.
        const sameTab = await el.evaluate(
          (a) =>
            a.getAttribute("aria-disabled") !== "true" &&
            (a.getAttribute("target") ?? "_self") === "_self" &&
            !a.hasAttribute("data-external"),
        )
        if (!sameTab) continue
        const before = await routerCalls(page)
        await el.dispatchEvent("click", { detail: 0 })
        await expect.poll(() => routerCalls(page)).toBe(before + 1)
        // And no second activation: drained, not waited for.
        await frames(page)
        expect(await routerCalls(page)).toBe(before + 1)
      }
    })
  }
})
