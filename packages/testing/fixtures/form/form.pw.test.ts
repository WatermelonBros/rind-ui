/// <reference types="node" />
// Form through the Playwright adapter, against the site examples harness: the driver in a real
// browser and the generic invariants on every Form story.
import { formContract } from "@rind-ui/core"
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
  await openExample(page, site.base, "form", id)
  await page.locator('[data-scope="form"]').first().waitFor()
  return page
}
afterEach(async () => {
  for (const page of pages.splice(0)) await page.context().close()
})

describe("form driver through Playwright", () => {
  it("two invalid fields, submit: invalidFields in tree order, first focused, one summary", {
    timeout: 60_000,
  }, async () => {
    // A story without a play function: nothing has been submitted yet.
    const page = await open("sign-up")
    const form = createDriverWith(formContract, page, [{ name: "Sign up" }])
    await page.getByRole("textbox", { name: "Email" }).fill("abc")
    await page.getByRole("textbox", { name: "Password", exact: true }).fill("short")
    await form.submit()
    await expect.poll(() => form.invalidFields()).toEqual(["email", "password", "confirm"])
    expect(await form.focusedField()).toBe("email")
    expect(await form.submissions()).toBe(0)
    const summaries = (await form.announcements()).filter((a) => a.key === "form-summary")
    expect(summaries).toHaveLength(1)
  })
})

const STORIES = [
  "sign-up",
  "async-username",
  "server-errors-story",
  "action-state",
  "values",
  "aria-behavior",
  "reset-form",
  "nested-form",
]

describe("generic invariants on every Form story", () => {
  for (const id of STORIES) {
    it(id, { timeout: 60_000 }, async () => {
      const page = await open(id)
      const env = playwrightEnv(page).create({
        scope: "form",
        anchor: { role: "form", name: id === "nested-form" ? "Outer" : "Sign up" },
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
