/// <reference types="node" />
// The public Listbox through the Playwright adapter ("Same test in Playwright"): the driver
// calls of listbox.dom.test.tsx plus real keyboard and pointer behaviour. The page is bundled
// with rolldown from app.tsx.
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { platforms } from "@rind-ui/core"
import { type Browser, chromium, type Page } from "playwright"
import { rolldown } from "rolldown"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { getListbox } from "../../src/index"

const here = import.meta.dirname
const themeSrc = join(here, "../../../theme/src")
// The page runs on the host: the `mod` key must match its platform.
const platform = process.platform === "darwin" ? platforms.apple : platforms.linux
const mod = process.platform === "darwin" ? "Meta" : "Control"

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

async function open(lang = "en") {
  const context = await browser.newContext()
  const page = await context.newPage()
  pages.push(page)
  await page.setContent(html.replace('<html lang="en">', `<html lang="${lang}">`))
  await page.getByRole("listbox", { name: "Toppings" }).waitFor()
  return page
}

const lb = (page: Page, name: string) => getListbox(page, { name }, { platform })
const selected = (page: Page, name: string) =>
  page.getByRole("listbox", { name }).getByRole("option", { selected: true })
const focusedName = (page: Page) => page.evaluate(() => document.activeElement?.textContent ?? null)
// Playwright's `expect` is not Vitest's: poll the selected options' text.
const selectedNames = (page: Page, name: string) => selected(page, name).allTextContents()
const actions = (page: Page) =>
  page.evaluate(() => ({
    last: document.body.dataset["lastAction"] ?? null,
    count: Number(document.body.dataset["actions"] ?? "0"),
  }))

describe("listbox through Playwright", () => {
  it("driver round trip: toggle then a range", { timeout: 60_000 }, async () => {
    const page = await open()
    const t = lb(page, "Toppings")
    await t.toggle("olives")
    await t.chooseRange("ham", "olives")
    expect(await t.selected()).toEqual(["ham", "egg", "olives"])
  })

  it("real keyboard: Tab focuses the first item, arrows, Space, Shift+Arrow, mod+A", {
    timeout: 60_000,
  }, async () => {
    const page = await open()
    await page.keyboard.press("Tab")
    expect(await focusedName(page)).toBe("ham")
    await page.keyboard.press("ArrowDown")
    expect(await focusedName(page)).toBe("egg")
    await page.keyboard.press("Space")
    await expect.poll(() => selectedNames(page, "Toppings")).toEqual(["egg"])
    await page.keyboard.press("Shift+ArrowDown")
    await expect.poll(() => selectedNames(page, "Toppings")).toEqual(["egg", "olives"])
    await page.keyboard.press(`${mod}+a`)
    await expect.poll(() => selected(page, "Toppings").count()).toBe(5)
  })

  it("navigation keys do not scroll the page (react-spectrum#10720)", {
    timeout: 60_000,
  }, async () => {
    const page = await open()
    // The page can scroll, and PageDown outside the list does scroll it (the control).
    expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight)).toBe(
      true,
    )
    await page.evaluate(() => {
      const log: [string, boolean][] = []
      ;(window as unknown as { keys: typeof log }).keys = log
      window.addEventListener("keydown", (e) => log.push([e.key, e.defaultPrevented]))
    })
    await page.keyboard.press("Tab")
    expect(
      await page.evaluate(
        () =>
          document.activeElement?.closest('[role="listbox"]')?.getAttribute("aria-label") ??
          document.activeElement?.closest('[role="listbox"]')?.id ??
          null,
      ),
    ).not.toBe(null)
    for (const key of ["Space", "PageDown", "End", "Home"]) await page.keyboard.press(key)
    // Every key reached the page already prevented by the list: none can scroll it.
    expect(
      await page.evaluate(() => (window as unknown as { keys: [string, boolean][] }).keys),
    ).toEqual([
      ["Tab", false],
      [" ", true],
      ["PageDown", true],
      ["End", true],
      ["Home", true],
    ])
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    await page.keyboard.press("PageDown")
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  })

  it("Shift+click selects a range and selects no text", { timeout: 60_000 }, async () => {
    const page = await open()
    const files = page.getByRole("listbox", { name: "Files" })
    await files.getByRole("option", { name: "b" }).click()
    for (const n of ["c", "d", "e"]) await files.getByRole("option", { name: n }).hover()
    await files.getByRole("option", { name: "d" }).click({ modifiers: ["Shift"] })
    await expect.poll(() => selectedNames(page, "Files")).toEqual(["b", "c", "d"])
    expect(await page.evaluate(() => getSelection()?.toString())).toBe("")
  })

  it("double click in a replace list acts once", { timeout: 60_000 }, async () => {
    const page = await open()
    await page.getByRole("option", { name: "b" }).dblclick()
    await expect.poll(() => actions(page)).toEqual({ last: "b", count: 1 })
  })

  it("Enter in an action list acts", { timeout: 60_000 }, async () => {
    const page = await open()
    await page.getByRole("option", { name: "r2" }).focus()
    await page.keyboard.press("Enter")
    await expect.poll(() => actions(page)).toEqual({ last: "r2", count: 1 })
  })

  it("RTL horizontal: ArrowLeft moves to the second item", { timeout: 60_000 }, async () => {
    // The direction comes from <html lang>, not from the nearest dir attribute.
    const page = await open("ar")
    await page.getByRole("option", { name: "one" }).focus()
    await page.keyboard.press("ArrowLeft")
    await expect.poll(() => focusedName(page)).toBe("two")
  })

  it("Escape is not prevented", { timeout: 60_000 }, async () => {
    const page = await open()
    await page.evaluate(() => {
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") document.body.dataset["escPrevented"] = String(e.defaultPrevented)
      })
    })
    await page.keyboard.press("Tab")
    await page.keyboard.press("Escape")
    await expect
      .poll(() => page.evaluate(() => document.body.dataset["escPrevented"]))
      .toBe("false")
  })
})
