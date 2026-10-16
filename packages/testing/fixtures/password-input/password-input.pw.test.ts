/// <reference types="node" />
// Password Input through the Playwright adapter: the driver calls of the Vitest suites in real
// Chromium, plus what only a browser shows: caret kept on a mouse press, a touch tap that takes
// no focus, the type at submit time. The page is bundled with rolldown from app.tsx.
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { type Browser, chromium, type Page } from "playwright"
import { rolldown } from "rolldown"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { getPasswordInput } from "../../src/index"

const here = import.meta.dirname
const themeSrc = join(here, "../../../theme/src")

/** index.css with its @imports inlined (fonts are not needed). */
function themeCss(file = join(themeSrc, "index.css")): string {
  return readFileSync(file, "utf8").replace(/@import\s+"(.+?)";/g, (_, path: string) =>
    path.includes("fonts") ? "" : themeCss(join(dirname(file), path)),
  )
}

let browser: Browser
let html = ""

beforeAll(async () => {
  const bundle = await rolldown({
    input: join(here, "app.tsx"),
    platform: "browser",
    resolve: { conditionNames: ["@rind-ui/source", "browser", "import", "default"] },
    transform: { define: { "process.env.NODE_ENV": '"development"' } },
    logLevel: "silent",
  })
  const { output } = await bundle.generate({ format: "iife" })
  const script = output[0].code.replaceAll("</script", "<\\/script")
  html = `<!doctype html><html lang="en"><head><style>${themeCss()}</style></head><body><div id="root"></div><script>${script}</script></body></html>`
  browser = await chromium.launch()
}, 120_000)

afterAll(async () => {
  await browser?.close()
})

const pages: Page[] = []
afterEach(async () => {
  for (const p of pages.splice(0)) await p.context().close()
})

async function open(options: Parameters<Browser["newContext"]>[0] = {}) {
  const context = await browser.newContext({ hasTouch: true, ...options })
  const page = await context.newPage()
  pages.push(page)
  await page.setContent(html)
  await page.getByLabel("Password", { exact: true }).waitFor()
  return page
}

const input = (page: Page) => page.getByLabel("Password", { exact: true })
const typeOf = (page: Page) => input(page).evaluate((el) => (el as HTMLInputElement).type)

describe("password input driver through Playwright", () => {
  it("Same test in both environments: toggle reveals", async () => {
    const page = await open()
    const pw = getPasswordInput(page, { name: "Password" })
    await pw.toggleVisibility()
    expect(await pw.isVisible()).toBe(true)
    expect(await pw.inputType()).toBe("text")
  })

  it("a keyboard toggle keeps focus on the trigger", async () => {
    const page = await open()
    await getPasswordInput(page, { name: "Password" }).via("keyboard").toggleVisibility()
    expect(await typeOf(page)).toBe("text")
    const trigger = page.getByRole("button", { name: "Show password" })
    await expect.poll(() => trigger.evaluate((el) => el === document.activeElement)).toBe(true)
  })

  it("a mouse toggle keeps focus and the caret in the input", async () => {
    const page = await open()
    const pw = getPasswordInput(page, { name: "Password" })
    await pw.type("hunter2")
    await input(page).evaluate((el) => (el as HTMLInputElement).setSelectionRange(4, 4))
    await pw.toggleVisibility()
    expect(await typeOf(page)).toBe("text")
    const state = await page.evaluate(() => {
      const el = document.activeElement as HTMLInputElement
      return { type: el.type, start: el.selectionStart, end: el.selectionEnd }
    })
    expect(state).toEqual({ type: "text", start: 4, end: 4 })
  })

  it("a touch tap toggles and moves no focus", async () => {
    const page = await open()
    await getPasswordInput(page, { name: "Password" }).via("touch").toggleVisibility()
    expect(await typeOf(page)).toBe("text")
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true)
  })

  it("submit hides, and the type is password when the form is submitted", async () => {
    const page = await open()
    const pw = getPasswordInput(page, { name: "Password" })
    await pw.toggleVisibility()
    expect(await typeOf(page)).toBe("text")
    await pw.submitForm()
    await expect
      .poll(() => page.evaluate(() => document.body.dataset["typeAtSubmit"]))
      .toBe("password")
    expect(await pw.isVisible()).toBe(false)
  })

  it("reset hides", async () => {
    const page = await open()
    const pw = getPasswordInput(page, { name: "Password" })
    await pw.toggleVisibility()
    await pw.resetForm()
    await expect.poll(() => typeOf(page)).toBe("password")
  })

  it("spellcheck is off in both states", async () => {
    const page = await open()
    const pw = getPasswordInput(page, { name: "Password" })
    const spellcheck = () => input(page).evaluate((el) => (el as HTMLInputElement).spellcheck)
    expect(await spellcheck()).toBe(false)
    await pw.toggleVisibility()
    expect(await spellcheck()).toBe(false)
  })
})
