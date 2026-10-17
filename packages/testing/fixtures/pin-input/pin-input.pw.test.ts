/// <reference types="node" />
// Pin Input through the Playwright adapter: the driver calls of the Vitest suites in real
// Chromium, plus what only a browser shows: real typing, one tab stop, caret by press, the
// autofill paint, autoSubmit with an invalid sibling, IME and RTL. Bundled with rolldown.
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { type Browser, chromium, type Page } from "playwright"
import { rolldown } from "rolldown"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { getPinInput } from "../../src/index"

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

async function open() {
  const context = await browser.newContext()
  const page = await context.newPage()
  pages.push(page)
  await page.setContent(html)
  await page.getByLabel("Verification code").waitFor()
  return page
}

const mod = process.platform === "darwin" ? "Meta" : "Control"
const verification = (page: Page) => page.getByLabel("Verification code")
const backup = (page: Page) => page.getByLabel("Backup code")
const pin = (page: Page, name = "Verification code") => getPinInput(page, { name })
const submits = (page: Page) => page.evaluate(() => document.body.dataset["submits"] ?? "0")
const slotAttr = (page: Page, i: number, attr: string) =>
  verification(page).evaluate(
    (el, [index, a]) =>
      el.parentElement
        ?.querySelector(`[data-part="slot"][data-index="${index}"]`)
        ?.hasAttribute(a as string),
    [i, attr],
  )

describe("pin input driver through Playwright", { timeout: 60_000 }, () => {
  it("Same test in both environments: fill completes the code", async () => {
    const page = await open()
    const pw = pin(page)
    await pw.fill("123456")
    expect(await pw.value()).toBe("123456")
    expect(await pw.isComplete()).toBe(true)
  })

  it("real typing fills the slots in order", async () => {
    const page = await open()
    await verification(page).click()
    await page.keyboard.type("1234")
    await expect.poll(() => pin(page).slots()).toEqual(["1", "2", "3", "4", "", ""])
  })

  it("one tab stop: Email, the code, then out to the next field", async () => {
    const page = await open()
    await page.getByLabel("Email").focus()
    await page.keyboard.press("Tab")
    await expect
      .poll(() => verification(page).evaluate((el) => el === document.activeElement))
      .toBe(true)
    await page.keyboard.press("Tab")
    await expect.poll(() => backup(page).evaluate((el) => el === document.activeElement)).toBe(true)
  })

  it("a press on a filled slot places the caret there", async () => {
    const page = await open()
    const pw = pin(page)
    await verification(page).click()
    await page.keyboard.type("12345")
    const slot = page.locator('[data-part="slot"][data-index="1"]').first()
    const box = await slot.boundingBox()
    if (!box) throw new Error("no slot geometry")
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await expect.poll(() => pw.activeSlot()).toBe(1)
    await page.keyboard.type("9")
    await expect.poll(() => pw.value()).toBe("19345")
  })

  it("a press past the value puts the caret at the end", async () => {
    const page = await open()
    const pw = pin(page)
    await verification(page).click()
    await page.keyboard.type("123")
    const box = await page.locator('[data-part="slot"][data-index="5"]').first().boundingBox()
    if (!box) throw new Error("no slot geometry")
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await expect.poll(() => pw.activeSlot()).toBe(3)
  })

  it("mod+Backspace clears the code and every filled flag", async () => {
    const page = await open()
    await verification(page).click()
    await page.keyboard.type("1234")
    await expect.poll(() => pin(page).value()).toBe("1234")
    await page.keyboard.press(`${mod}+Backspace`)
    await expect.poll(() => pin(page).value()).toBe("")
    for (let i = 0; i < 6; i++) expect(await slotAttr(page, i, "data-filled")).toBe(false)
  })

  it("a script autofill is applied", async () => {
    const page = await open()
    await verification(page).evaluate((el) => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
      set?.call(el, "654321")
      el.dispatchEvent(new Event("input", { bubbles: true }))
    })
    await expect.poll(() => pin(page).value()).toBe("654321")
    expect(await pin(page).slots()).toEqual(["6", "5", "4", "3", "2", "1"])
  })

  it("the autofill paint is transparent and the style is injected", async () => {
    const page = await open()
    await expect
      .poll(() => verification(page).evaluate((el) => getComputedStyle(el).color))
      .toBe("rgba(0, 0, 0, 0)")
    expect(await page.locator('style[data-rind-style="pin-input"]').count()).toBe(1)
  })

  it("autoSubmit does not fire while the form is invalid; focus goes to the first invalid field", async () => {
    const page = await open()
    await pin(page).paste("123456")
    await expect.poll(() => pin(page).value()).toBe("123456")
    await expect
      .poll(() => page.evaluate(() => (document.activeElement as HTMLInputElement | null)?.type))
      .toBe("email")
    expect(await submits(page)).toBe("0")
  })

  it("Enter on an incomplete required code is blocked and shows the error", async () => {
    const page = await open()
    await page.getByLabel("Email").fill("a@b.co")
    const pw = pin(page, "Backup code")
    await backup(page).click()
    await page.keyboard.type("123")
    await backup(page).press("Enter")
    await expect.poll(() => backup(page).evaluate((el) => el.matches(":invalid"))).toBe(true)
    await expect.poll(() => pw.isInvalid()).toBe(true)
    expect(await submits(page)).toBe("0")
    await expect.poll(() => backup(page).evaluate((el) => el.matches(":invalid"))).toBe(true)
    await expect.poll(() => pw.isInvalid()).toBe(true)
    await expect.poll(() => submits(page)).toBe("0")
    await expect
      .poll(() =>
        page.evaluate(() => {
          const el = document.querySelector('[data-scope="field"][data-part="error-message"]')
          return !!el && (el as HTMLElement).offsetParent !== null && !!el.textContent
        }),
      )
      .toBe(true)
  })

  it("reset restores the empty code", async () => {
    const page = await open()
    const pw = pin(page)
    await pw.fill("123456")
    await page.getByRole("button", { name: "Reset" }).click()
    await expect.poll(() => pw.value()).toBe("")
  })

  it("an IME composition of full-width digits commits as ASCII", async () => {
    const page = await open()
    const pw = pin(page)
    await verification(page).focus()
    await pw.compose("１２３", "１２３")
    await expect.poll(() => pw.value()).toBe("123")
  })

  it("right-to-left page: the first slot, leftmost, shows the first character", async () => {
    const page = await open()
    await page.evaluate(() => {
      document.documentElement.dir = "rtl"
    })
    await pin(page).fill("123456")
    const xs = await page
      .locator('[data-part="slot"][data-instance]')
      .evaluateAll((els) =>
        els.slice(0, 6).map((e) => [e.getBoundingClientRect().x, e.textContent]),
      )
    expect(xs[0]?.[1]).toBe("1")
    expect(Math.min(...xs.map((p) => p[0] as number))).toBe(xs[0]?.[0])
  })
})
