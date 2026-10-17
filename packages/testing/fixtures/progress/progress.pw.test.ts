/// <reference types="node" />
// Progress through the Playwright adapter (add-progress 5.3, 7.2): the same driver calls as
// the Vitest suites, and the themed captures: forced colors (RS#4069), reduced motion, the
// indeterminate bar and ring (ZG#1716). The page is bundled from fixtures/progress/app.tsx.
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { type Browser, chromium, type Page } from "playwright"
import { rolldown } from "rolldown"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { getProgress } from "../../src/index"

const here = import.meta.dirname
const themeSrc = join(here, "../../../theme/src")

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
  await page.getByRole("progressbar", { name: "Uploading" }).waitFor()
  return page
}

const bg = (page: Page, id: string) =>
  page.getByTestId(id).evaluate((el) => getComputedStyle(el).backgroundColor)
const animations = (page: Page, id: string) =>
  page.getByTestId(id).evaluate((el) => el.getAnimations().length)

describe("Progress (Playwright)", () => {
  it("the driver reads the same as in Vitest, and announces completion once", async () => {
    const page = await open()
    const p = getProgress(page, { name: "Uploading" })
    expect(await p.value()).toBe(40)
    expect(await p.valueText()).toBe("40%")
    expect(await p.state()).toBe("loading")
    expect(await getProgress(page, { name: "Connecting" }).value()).toBeNull()
    expect(await p.announcements()).toEqual([])
    await page.getByRole("button", { name: "Advance" }).click()
    await page.getByRole("button", { name: "Advance" }).click()
    expect(await p.value()).toBe(100)
    expect((await p.announcements()).map((a) => a.message)).toEqual(["Complete"])
  })

  it("forced colors: the fill is visible against the track (RS#4069)", async () => {
    const page = await open({ forcedColors: "active" })
    expect(await bg(page, "fill")).not.toBe(await bg(page, "track"))
    const edge = await page
      .getByTestId("track")
      .evaluate((el) => getComputedStyle(el).borderTopStyle)
    expect(edge).toBe("solid")
    expect((await page.getByTestId("track").screenshot()).byteLength).toBeGreaterThan(0)
  })

  it("indeterminate bar and ring animate without reduced motion (ZG#1716)", async () => {
    const page = await open({ reducedMotion: "no-preference" })
    expect(await animations(page, "busy")).toBe(1)
    expect(await animations(page, "ring")).toBe(1)
    const offset = await page
      .getByTestId("arc")
      .evaluate((el) => getComputedStyle(el).strokeDashoffset)
    expect(offset).toBe("75px")
    expect(
      (await page.getByTestId("ring").screenshot({ animations: "disabled" })).byteLength,
    ).toBeGreaterThan(0)
  })

  it("reduced motion: nothing runs, the segment is still and striped", async () => {
    const page = await open({ reducedMotion: "reduce" })
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0)
    const stripes = await page
      .getByTestId("busy")
      .evaluate((el) => getComputedStyle(el).backgroundImage)
    expect(stripes).toMatch(/repeating-linear-gradient/)
  })
})
