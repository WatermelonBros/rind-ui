/// <reference types="node" />
// Label through the Playwright adapter, against the site examples harness: the driver in a real
// browser and the generic invariants on every Label story.
import { labelContract } from "@rind-ui/core"
import { type Browser, chromium, type Page } from "playwright"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { checkGeneric, createDriverWith, playwrightEnv } from "../../src/index"
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
  await openExample(page, site.base, "label", id)
  await page.locator('[data-scope="label"]').first().waitFor()
  return page
}
afterEach(async () => {
  for (const page of pages.splice(0)) await page.context().close()
})

describe("label driver through Playwright", () => {
  it("click focuses the control, doubleClick selects nothing, controlName", {
    timeout: 60_000,
  }, async () => {
    const page = await open("for-input")
    const label = createDriverWith(labelContract, page, [{ text: "Email" }])
    expect(await label.isControlFocused()).toBe(false)
    await label.click()
    expect(await label.isControlFocused()).toBe(true)
    await label.doubleClick()
    expect(await label.selectedText()).toBe("")
    expect(await label.controlName()).toBe("Email")
  })
})

const STORIES = [
  "for-input",
  "wrapping-input",
  "wrapping-checkbox-with-link",
  "for-popup-trigger",
  "non-labelable-target",
  "as-span",
  "danger",
  "driver-example",
]

describe("generic invariants on every Label story", () => {
  for (const id of STORIES) {
    it(id, { timeout: 60_000 }, async () => {
      const page = await open(id)
      const labels = await page.locator('[data-scope="label"]').all()
      for (const el of labels) {
        const name = ((await el.textContent()) ?? "").trim()
        expect(name, `${id}: a label without text`).not.toBe("")
        const env = playwrightEnv(page).create({
          scope: "label",
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
      }
    })
  }
})
