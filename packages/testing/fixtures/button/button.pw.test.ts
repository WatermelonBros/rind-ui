/// <reference types="node" />
// Button through the Playwright adapter, against the site examples harness: the driver in both
// environments, forced colors, and the generic invariants on every Button story.
import { buttonContract } from "@rind-ui/core"
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
  await openExample(page, site.base, "button", id)
  await page.locator('[data-scope="button"]').first().waitFor()
  return page
}
afterEach(async () => {
  for (const page of pages.splice(0)) await page.context().close()
})

describe("button driver through Playwright", () => {
  it("press: pointer and keyboard twin each count once", { timeout: 60_000 }, async () => {
    const page = await open("driver-example")
    await page.getByText("Pressed: 0").waitFor()
    const button = createDriverWith(buttonContract, page, [{ name: "Save" }])
    await button.press()
    await page.getByText("Pressed: 1").waitFor()
    await button.via("keyboard").press()
    await page.getByText("Pressed: 2").waitFor()
  })

  it("submits and resets a form", { timeout: 60_000 }, async () => {
    const page = await open("inside-form")
    const submit = createDriverWith(buttonContract, page, [{ name: "Submit" }])
    await submit.press()
    await page.getByText("Submits: 1").waitFor()
    await submit.via("keyboard").press()
    await page.getByText("Submits: 2").waitFor()
    await page.getByLabel("Name").fill("Grace")
    await createDriverWith(buttonContract, page, [{ name: "Reset" }]).press()
    expect(await page.getByLabel("Name").inputValue()).toBe("Ada")
  })
})

describe("forced colors", () => {
  it("keeps a border and paints disabled as GrayText", { timeout: 60_000 }, async () => {
    for (const [id, disabled] of [
      ["default", false],
      ["disabled-story", true],
    ] as const) {
      const page = await open(id)
      await page.emulateMedia({ forcedColors: "active" })
      const root = page.locator('[data-scope="button"][data-part="root"]').first()
      const border = await root.evaluate((el) => getComputedStyle(el).borderTopStyle)
      expect(border, `${id}: border`).not.toBe("none")
      if (!disabled) continue
      const [color, gray] = await Promise.all([
        root.evaluate((el) => getComputedStyle(el).color),
        page.evaluate(() => {
          const span = document.createElement("span")
          span.style.color = "GrayText"
          document.body.append(span)
          return getComputedStyle(span).color
        }),
      ])
      expect(color).toBe(gray)
    }
  })
})

const STORIES = [
  "default",
  "variants-story",
  "icon-only",
  "disabled-story",
  "focusable-when-disabled",
  "pending-story",
  "pending-state",
  "as-link-story",
  "as-div",
  "inside-form",
  "danger",
  "driver-example",
]

describe("generic invariants on every Button story", () => {
  for (const id of STORIES) {
    it(id, { timeout: 60_000 }, async () => {
      const page = await open(id)
      const buttons = await page.locator('[data-scope="button"]').all()
      for (const el of buttons) {
        const name =
          ((await el.getAttribute("aria-label")) ?? (await el.textContent()))?.trim() ?? ""
        expect(name, `${id}: a button without a name`).not.toBe("")
        const env = playwrightEnv(page).create({
          scope: "button",
          anchor: { role: (await el.evaluate((n) => n.tagName)) === "A" ? "link" : "button", name },
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
