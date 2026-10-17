/// <reference types="node" />
// The public Tags Input through the Playwright adapter: driver calls plus real keyboard and
// pointer behaviour (form submit, page scroll, label click). The page is bundled with rolldown
// from app.tsx.
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { type Browser, chromium, type Page } from "playwright"
import { rolldown } from "rolldown"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { getTagsInput } from "../../src/index"

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
  await page.getByRole("textbox", { name: "City", exact: true }).waitFor()
  return page
}

const city = (page: Page, modality?: "keyboard" | "pointer") =>
  getTagsInput(page, { name: "City" }, modality ? { modality } : undefined)
const cities = (page: Page, modality?: "keyboard" | "pointer") =>
  getTagsInput(page, { name: "Cities" }, modality ? { modality } : undefined)
const input = (page: Page, name = "City") => page.getByRole("textbox", { name, exact: true })
const submits = (page: Page) =>
  page.evaluate(() => (window as unknown as { submits: number }).submits)
const scrollY = (page: Page) => page.evaluate(() => window.scrollY)

describe("tags input through Playwright", () => {
  it("addTag does not submit the form; an empty Enter submits once", {
    timeout: 60_000,
  }, async () => {
    const page = await open()
    const tags = city(page)
    await tags.addTag("rome")
    await expect.poll(() => tags.tags()).toEqual(["rome"])
    await expect.poll(() => tags.inputValue()).toBe("")
    expect(await submits(page)).toBe(0)
    await page.keyboard.press("Enter")
    await expect.poll(() => submits(page)).toBe(1)
  })

  it("paste splits a list into tags", { timeout: 60_000 }, async () => {
    const page = await open()
    const tags = city(page)
    await tags.paste("a, b")
    await expect.poll(() => tags.tags()).toEqual(["a", "b"])
    await expect.poll(() => tags.inputValue()).toBe("")
  })

  it("typing a delimiter creates the tag", { timeout: 60_000 }, async () => {
    const page = await open()
    const tags = city(page)
    await tags.type("rome,")
    await expect.poll(() => tags.tags()).toEqual(["rome"])
    await expect.poll(() => tags.inputValue()).toBe("")
  })

  it("Backspace twice in the empty input removes the last tag", { timeout: 60_000 }, async () => {
    const page = await open()
    const tags = cities(page)
    await expect.poll(() => tags.tags()).toEqual(["rom", "paris"])
    await input(page, "Cities").focus()
    await page.keyboard.press("Backspace")
    await expect.poll(() => tags.tags()).toEqual(["rom", "paris"])
    await page.keyboard.press("Backspace")
    await expect.poll(() => tags.tags()).toEqual(["rom"])
  })

  for (const modality of ["keyboard", "pointer"] as const) {
    it(`removeTag with the ${modality} modality`, { timeout: 60_000 }, async () => {
      const page = await open()
      const tags = cities(page, modality)
      await tags.removeTag("rom")
      await expect.poll(() => tags.tags()).toEqual(["paris"])
    })
  }

  it("editTag replaces a tag with the keyboard", { timeout: 60_000 }, async () => {
    const page = await open()
    const tags = cities(page, "keyboard")
    await tags.editTag("rom", "rome")
    await expect.poll(() => tags.tags()).toEqual(["rome", "paris"])
    await expect.poll(() => tags.isEditing()).toBe(false)
  })

  it("navigation keys never scroll the page", { timeout: 60_000 }, async () => {
    const page = await open()
    expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight)).toBe(
      true,
    )
    await input(page, "Cities").focus()
    for (const key of [
      "ArrowLeft",
      "ArrowRight",
      "ArrowLeft",
      "Home",
      "End",
      "ArrowDown",
      "ArrowUp",
    ])
      await page.keyboard.press(key)
    await expect.poll(() => scrollY(page)).toBe(0)
  })
})
