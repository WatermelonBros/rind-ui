/// <reference types="node" />
// Search Field through the Playwright adapter: Escape and Enter on a real page, inside a
// Dialog, the native cancel button hidden, and a real IME composition (CDP) that Enter must not
// submit. The page is bundled with rolldown from app.tsx.
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { type Browser, chromium, type Page } from "playwright"
import { rolldown } from "rolldown"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { getSearchField } from "../../src/index"

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
let bareHtml = ""

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
  // Without the theme, which also hides the native button: only the component's own rule acts.
  bareHtml = html.replace(/<style>[\s\S]*?<\/style>/, "")
  browser = await chromium.launch()
}, 120_000)

afterAll(async () => {
  await browser?.close()
})

const pages: Page[] = []
afterEach(async () => {
  for (const p of pages.splice(0)) await p.context().close()
})

type Log = { submits: string[]; form: string | null }
const readLog = (page: Page) => page.evaluate(() => Reflect.get(window, "__log") as Log)

async function open(markup = html) {
  const context = await browser.newContext()
  const page = await context.newPage()
  pages.push(page)
  await page.setContent(markup)
  await page.getByRole("searchbox", { name: "Search books" }).waitFor()
  return page
}

const focused = (page: Page, name: string) =>
  page.getByRole("searchbox", { name }).evaluate((el) => el === document.activeElement)

describe("search field driver through Playwright", () => {
  it("Escape clears and keeps focus", async () => {
    const page = await open()
    const s = getSearchField(page, { name: "Search books" })
    await s.type("tolkien")
    await s.escape()
    expect(await s.value()).toBe("")
    expect(await focused(page, "Search books")).toBe(true)
  })

  it("in a dialog Escape clears first, then an empty field closes it", async () => {
    const page = await open()
    await page.getByRole("button", { name: "Find" }).click()
    const dialog = page.getByRole("dialog", { name: "Find" })
    await dialog.waitFor()
    const s = getSearchField(page, { name: "Search shelf" })
    await s.type("dune")
    await s.escape()
    expect(await s.value()).toBe("")
    expect(await dialog.isVisible()).toBe(true)
    await s.escape()
    await dialog.waitFor({ state: "hidden" })
  })

  it("Enter calls onSubmit once and the form submits with q", async () => {
    const page = await open()
    const s = getSearchField(page, { name: "Search books" })
    await s.type("dune")
    await s.submit()
    await expect.poll(async () => (await readLog(page)).form).toBe("dune")
    expect((await readLog(page)).submits).toEqual(["dune"])
  })

  it("the native cancel button is hidden with a ClearTrigger", async () => {
    const page = await open(bareHtml)
    await getSearchField(page, { name: "Search books" }).type("x")
    const box = page.getByRole("searchbox", { name: "Search books" })
    // Chromium's getComputedStyle ignores author rules on this UA pseudo, so compare pixels:
    // the opted-in input must differ from the same input with the opt-in removed.
    await box.hover()
    const hidden = await box.screenshot()
    await box.evaluate((el) => el.removeAttribute("data-custom-clear"))
    await page.evaluate(() => new Promise(requestAnimationFrame))
    const native = await box.screenshot()
    expect(hidden.equals(native)).toBe(false)
  })

  it("Enter while composing is not a search", async () => {
    const page = await open()
    const s = getSearchField(page, { name: "Search books" })
    await s.part("input").compose(["被", "被送"])
    await s.part("input").press("Enter")
    expect((await readLog(page)).submits).toEqual([])
    await s.part("input").compose([], "被送出")
    await s.submit()
    await expect.poll(async () => (await readLog(page)).submits).toEqual(["被送出"])
  })
})
