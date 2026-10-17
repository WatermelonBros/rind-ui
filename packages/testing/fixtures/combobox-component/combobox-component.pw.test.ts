/// <reference types="node" />
// The public Combobox through the Playwright adapter: driver calls plus real keyboard and
// pointer behaviour (form submit, page scroll, label click). The page is bundled with rolldown
// from app.tsx.
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { type Browser, chromium, type Page } from "playwright"
import { rolldown } from "rolldown"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { getCombobox } from "../../src/index"

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
  await page.getByRole("combobox", { name: "City" }).waitFor()
  return page
}

const city = (page: Page, modality?: "keyboard" | "pointer") =>
  getCombobox(page, { name: "City" }, modality ? { modality } : undefined)
const cities = (page: Page, modality?: "keyboard" | "pointer") =>
  getCombobox(page, { name: "Cities" }, modality ? { modality } : undefined)
const input = (page: Page, name = "City") => page.getByRole("combobox", { name, exact: true })
const submits = (page: Page) =>
  page.evaluate(() => (window as unknown as { submits: number }).submits)
const scrollY = (page: Page) => page.evaluate(() => window.scrollY)
const inputFocused = (page: Page, name = "City") =>
  input(page, name).evaluate((el) => el === document.activeElement)

describe("combobox through Playwright", () => {
  for (const [modality, label] of [
    ["keyboard", "Prague"],
    ["pointer", "Paris"],
  ] as const) {
    it(`choose ${label} with the ${modality} modality`, { timeout: 60_000 }, async () => {
      const page = await open()
      const cb = city(page, modality)
      await city(page).type("p")
      await cb.choose(label)
      await expect.poll(() => cb.inputValue()).toBe(label)
      await expect.poll(() => cb.value()).toEqual([label])
      await expect.poll(() => cb.isOpen()).toBe(false)
      await expect.poll(() => inputFocused(page)).toBe(true)
    })
  }

  it("Enter with the popup open does not submit; closed it submits once", {
    timeout: 60_000,
  }, async () => {
    const page = await open()
    const cb = city(page)
    await input(page).focus()
    await page.keyboard.press("ArrowDown")
    await expect.poll(() => cb.isOpen()).toBe(true)
    await page.keyboard.press("ArrowDown")
    await page.keyboard.press("Enter")
    await expect.poll(() => cb.isOpen()).toBe(false)
    expect(await submits(page)).toBe(0)
    await page.keyboard.press("Enter")
    await expect.poll(() => submits(page)).toBe(1)
  })

  it("Escape closes the popup and navigation keys never scroll the page", {
    timeout: 60_000,
  }, async () => {
    const page = await open()
    expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight)).toBe(
      true,
    )
    const cb = city(page)
    await input(page).focus()
    for (const key of ["ArrowDown", "ArrowUp", "ArrowDown"]) await page.keyboard.press(key)
    await expect.poll(() => cb.isOpen()).toBe(true)
    await page.keyboard.press("Escape")
    await expect.poll(() => cb.isOpen()).toBe(false)
    await page.keyboard.press("ArrowDown")
    await page.keyboard.press("ArrowUp")
    await expect.poll(() => scrollY(page)).toBe(0)
  })

  it("no match shows the empty state outside the listbox", { timeout: 60_000 }, async () => {
    const page = await open()
    const cb = city(page)
    await cb.type("zz")
    await expect.poll(() => cb.isEmpty()).toBe(true)
    await expect.poll(() => input(page).getAttribute("aria-expanded")).toBe("false")
    await expect(page.getByText("No results").isVisible()).resolves.toBe(true)
    expect(await page.getByRole("listbox").getByText("No results").count()).toBe(0)
  })

  it("chips: removeChip by keyboard, then Backspace removes the last", {
    timeout: 60_000,
  }, async () => {
    const page = await open()
    const cb = cities(page, "keyboard")
    await expect.poll(() => cb.chips()).toEqual(["Rome", "Paris"])
    await cb.removeChip("Rome")
    await expect.poll(() => cb.chips()).toEqual(["Paris"])
    await input(page, "Cities").focus()
    await page.keyboard.press("Backspace")
    await page.keyboard.press("Backspace")
    await expect.poll(() => cb.chips()).toEqual([])
  })

  it("a click on the label focuses the input and does not open", { timeout: 60_000 }, async () => {
    const page = await open()
    await page.getByText("City", { exact: true }).click()
    await expect.poll(() => inputFocused(page)).toBe(true)
    expect(await city(page).isOpen()).toBe(false)
  })
})
