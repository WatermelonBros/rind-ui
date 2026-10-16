/// <reference types="node" />
// Meter through the Playwright adapter (add-meter 4.2, 6.2): the same driver calls as the
// Vitest suites, and the themed captures of each zone, with and without forced colors. The
// page is bundled from fixtures/meter/app.tsx.
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { type Browser, chromium, type Page } from "playwright"
import { rolldown } from "rolldown"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { getMeter } from "../../src/index"

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
  await page.getByRole("meter", { name: "Battery low" }).waitFor()
  return page
}

const look = (page: Page, id: string) =>
  page.getByTestId(id).evaluate((el) => {
    const s = getComputedStyle(el)
    return `${s.backgroundColor} ${s.backgroundImage} ${s.borderRightStyle} ${s.borderRightWidth}`
  })

const names = ["Battery full", "Battery half", "Battery low"]

describe("Meter (Playwright)", () => {
  it("the driver reads the same as in Vitest", async () => {
    const page = await open()
    const low = getMeter(page, { name: "Battery low" })
    expect(await low.value()).toBe(10)
    expect(await low.valueText()).toBe("10%")
    expect(await low.zone()).toBe("even-less-good")
    expect(await getMeter(page, { name: "Battery half" }).zone()).toBe("suboptimum")
    expect(await getMeter(page, { name: "Battery full" }).zone()).toBe("optimum")
  })

  it("each zone looks different, in colour and without it", async () => {
    const page = await open()
    const looks = await Promise.all(names.map((n) => look(page, n)))
    expect(new Set(looks).size).toBe(3)
    for (const n of names) {
      expect((await page.getByTestId(n).screenshot()).byteLength).toBeGreaterThan(0)
    }
  })

  it("forced colors: the zones stay distinguishable (spec: Zone without colour)", async () => {
    const page = await open({ forcedColors: "active" })
    const styles = await Promise.all(
      names.map((n) => page.getByTestId(n).evaluate((el) => getComputedStyle(el).borderRightStyle)),
    )
    expect(styles).toEqual(["solid", "dashed", "double"])
  })
})
