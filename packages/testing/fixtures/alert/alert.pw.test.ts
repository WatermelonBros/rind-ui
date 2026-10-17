/// <reference types="node" />
// Alert through the Playwright adapter (tasks 4.2, 6.2): the driver round trip with the
// announcement log, a keyboard dismissal keeping focus off body, removal in the same step
// under reduced motion, and the tone × variant, RTL and forced-colors captures. The page is
// bundled here with rolldown from fixtures/alert/app.tsx (Storybook is being retired).
import { mkdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { type Browser, chromium, type Page } from "playwright"
import { rolldown } from "rolldown"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { getAlert } from "../../src/index"

const here = import.meta.dirname
const themeSrc = join(here, "../../../theme/src")
const captures = join(here, "../../../../.vitest/attachments/captures")

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
  const context = await browser.newContext(options)
  const page = await context.newPage()
  pages.push(page)
  await page.setContent(html)
  await page.getByRole("button", { name: "Save" }).waitFor()
  return page
}

describe("alert driver through Playwright", () => {
  it("Same test in Playwright: one assertive announcement, dismiss, focus not on body", {
    timeout: 60_000,
  }, async () => {
    const page = await open()
    const a = getAlert(page, { title: "Couldn't save" }, { modality: "keyboard" })
    expect(await a.announcements()).toEqual([])
    await page.getByRole("button", { name: "Save" }).click()
    expect(await a.isOpen()).toBe(true)
    expect((await a.announcements()).map((x) => [x.message, x.priority])).toEqual([
      ["Error. Couldn't save. Disk full.", "assertive"],
    ])
    await a.dismiss()
    expect(await a.isOpen()).toBe(false)
    const focused = await page.evaluate(() => document.activeElement?.textContent)
    expect(focused).toBe("Retry")
    expect(await a.announcements()).toHaveLength(1)
  })

  it("reduced motion: dismissed and removed in the same step", { timeout: 60_000 }, async () => {
    const page = await open({ reducedMotion: "reduce" })
    await page.getByRole("button", { name: "Save" }).click()
    await getAlert(page, { title: "Couldn't save" }).dismiss()
    expect(await page.getByText("Couldn't save").count()).toBe(0)
  })
})

describe("alert theme captures", () => {
  it("every tone × variant, and RTL puts the CloseTrigger at the left", {
    timeout: 60_000,
  }, async () => {
    const page = await open()
    const rtl = page.getByTestId("rtl")
    const close = await rtl.locator('[data-part="close-trigger"]').boundingBox()
    const title = await rtl.locator('[data-part="title"]').boundingBox()
    expect((close?.x ?? 0) + (close?.width ?? 0)).toBeLessThanOrEqual(title?.x ?? 0)
    expect(await rtl.getByRole("button", { name: "Dismiss" }).count()).toBe(1)
    mkdirSync(captures, { recursive: true })
    await page.getByTestId("tones").screenshot({ path: join(captures, "alert-tones.png") })
    await rtl.screenshot({ path: join(captures, "alert-rtl.png") })
  })

  it("forced colors: the alert keeps a visible border", { timeout: 60_000 }, async () => {
    const page = await open({ forcedColors: "active" })
    const border = await page
      .locator('[data-scope="alert"][data-part="root"]')
      .first()
      .evaluate((el) => {
        const s = getComputedStyle(el)
        return { style: s.borderTopStyle, width: Number.parseFloat(s.borderTopWidth) }
      })
    expect(border.style).toBe("solid")
    expect(border.width).toBeGreaterThanOrEqual(1)
    mkdirSync(captures, { recursive: true })
    await page.screenshot({ path: join(captures, "alert-forced-colors.png") })
  })
})
