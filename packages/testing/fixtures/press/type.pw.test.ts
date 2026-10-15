// Part.type through the Playwright adapter: a focused text input keeps its caret at the end.
import { type Browser, chromium } from "playwright"
import { afterAll, beforeAll, expect, it } from "vitest"
import { playwrightEnv } from "../../src/index"

let browser: Browser
beforeAll(async () => {
  browser = await chromium.launch()
}, 60_000)
afterAll(async () => {
  await browser?.close()
})

it("typing X into a focused <input value='abc'> gives 'abcX'", { timeout: 60_000 }, async () => {
  const page = await browser.newPage()
  await page.setContent('<input aria-label="Name" value="abc">')
  await page.focus("input")
  const env = playwrightEnv(page).create({
    scope: "field",
    anchor: { role: "textbox", name: "Name" },
    modality: "keyboard",
  })
  await env.focused().type("X")
  expect(await page.inputValue("input")).toBe("abcX")
  await page.close()
})
