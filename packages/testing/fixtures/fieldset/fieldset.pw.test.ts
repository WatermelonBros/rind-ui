/// <reference types="node" />
// Fieldset through the Playwright adapter, against the site examples harness: the driver in a real
// browser and the generic invariants on every Fieldset story.
import { fieldsetContract } from "@rind-ui/core"
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
  await openExample(page, site.base, "fieldset", id)
  await page.locator('[data-scope="fieldset"]').first().waitFor()
  return page
}
afterEach(async () => {
  for (const page of pages.splice(0)) await page.context().close()
})

describe("fieldset driver through Playwright", () => {
  it("name, description, disabled, invalid and errors", { timeout: 60_000 }, async () => {
    const page = await open("disabled-story")
    const disabled = createDriverWith(fieldsetContract, page, [{ name: "Shipping address" }])
    expect(await disabled.isDisabled()).toBe(true)
    expect(await disabled.name()).toBe("Shipping address")
    const plain = await open("address-group")
    const group = createDriverWith(fieldsetContract, plain, [{ name: "Shipping address" }])
    expect(await group.isDisabled()).toBe(false)
    expect(await group.description()).toBe("Where we send the parcel.")
    expect(await group.errors()).toBe(null)
    const bad = await open("invalid-story")
    const invalid = createDriverWith(fieldsetContract, bad, [{ name: "Delivery speed" }])
    expect(await invalid.isInvalid()).toBe(true)
    expect(await invalid.errors()).toBe("Choose a delivery speed.")
  })
})

const STORIES = [
  "address-group",
  "radio-set",
  "disabled-story",
  "nested-disabled",
  "legend-with-select-all",
  "invalid-story",
  "substituted-legend",
  "danger",
]

describe("generic invariants on every Fieldset story", () => {
  for (const id of STORIES) {
    it(id, { timeout: 60_000 }, async () => {
      const page = await open(id)
      // The outermost fieldset: its legend text anchors it (nested ones are covered by the same check).
      const legends = await page.locator('[data-scope="fieldset"][data-part="legend"]').all()
      for (const el of legends) {
        const name = ((await el.textContent()) ?? "").trim()
        expect(name, `${id}: a legend without text`).not.toBe("")
        const env = playwrightEnv(page).create({
          scope: "fieldset",
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
