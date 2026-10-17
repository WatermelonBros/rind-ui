/// <reference types="node" />
// QR Code through the Playwright adapter (add-qr-code 5.2, 6.3): the same driver calls as the
// Vitest suites with the download observed through Playwright's `download` event, and the
// themed symbol staying dark on light under forced colors in a dark scheme. The page is
// bundled with rolldown from fixtures/qr-code/app.tsx.
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { type Browser, type BrowserType, chromium, firefox, type Page, webkit } from "playwright"
import { rolldown } from "rolldown"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { getQrCode, playwrightEnv } from "../../src/index"

const here = import.meta.dirname
const themeSrc = join(here, "../../../theme/src")

function themeCss(file = join(themeSrc, "index.css")): string {
  return readFileSync(file, "utf8").replace(/@import\s+"(.+?)";/g, (_, path: string) =>
    path.includes("fonts") ? "" : themeCss(join(dirname(file), path)),
  )
}

let html = ""
const launched = new Map<BrowserType, Browser>()

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
  html = `<!doctype html><html lang="en"><head><title>QR Code</title><style>${themeCss()}</style></head><body><div id="root"></div><script>${script}</script></body></html>`
}, 120_000)

afterAll(async () => {
  for (const b of launched.values()) await b.close()
})

const pages: Page[] = []
afterEach(async () => {
  for (const p of pages.splice(0)) await p.context().close()
})

async function open(engine: BrowserType, options: Parameters<Browser["newContext"]>[0] = {}) {
  let browser = launched.get(engine)
  if (!browser) {
    browser = await engine.launch()
    launched.set(engine, browser)
  }
  const context = await browser.newContext({ acceptDownloads: true, ...options })
  const page = await context.newPage()
  pages.push(page)
  await page.setContent(html)
  await page.getByRole("img", { name: "QR code" }).waitFor()
  return page
}

describe.each([
  ["chromium", chromium],
  ["firefox", firefox],
  ["webkit", webkit],
] as const)("QR Code (Playwright, %s)", (_, engine) => {
  it("driver round trip: setValue, download (Playwright's download event), decode", {
    timeout: 60_000,
  }, async () => {
    const page = await open(engine)
    // A download renders, rasterises and saves: on a loaded CI runner it can take longer than
    // the default 5 s deadline (measured 1.6 s at a 20× CPU slowdown), so this driver waits
    // on the same conditions with a longer failure deadline.
    const q = getQrCode(playwrightEnv(page, { timeout: 20_000 }))
    await q.setValue("hello")
    const [download] = await Promise.all([page.waitForEvent("download"), q.download()])
    expect(download.suggestedFilename()).toBe("reado.png")
    expect(await q.lastDownload()).toBe("reado.png")
    expect(await q.decoded()).toBe("hello")
    expect(await q.version()).toBe(1)
  })

  it("ARIA per state (ready with value text and overlay, empty, invalid) and axe", {
    timeout: 60_000,
  }, async () => {
    const page = await open(engine)
    const root = page.locator('[data-scope="qr-code"][data-part="root"]')
    const value = page.getByLabel("Value")
    const axe = readFileSync(join(here, "../../../../node_modules/axe-core/axe.min.js"), "utf8")
    const violations = async () => {
      await page.addScriptTag({ content: axe })
      return page.evaluate(async () => {
        const w = window as unknown as {
          axe: { run: (d: Document, o: object) => Promise<{ violations: { id: string }[] }> }
        }
        const r = await w.axe.run(document, { rules: { region: { enabled: false } } })
        return r.violations.map((v) => v.id)
      })
    }
    await value.fill("WIFI:T:WPA;S:Home;P:secret;;")
    expect(await root.ariaSnapshot()).toBe(
      '- img "QR code"\n- text: WIFI:T:WPA;S:Home;P:secret;;\n- button "Download"',
    )
    expect(
      await page.getByRole("img", { name: "QR code" }).getAttribute("aria-describedby"),
    ).toBeTruthy()
    expect(await violations()).toEqual([])
    await value.fill("")
    expect(await root.ariaSnapshot()).toBe('- button "Download" [disabled]')
    expect(await violations()).toEqual([])
    await value.fill("é".repeat(3000))
    expect(await root.getAttribute("data-state")).toBe("invalid")
    expect(await root.ariaSnapshot()).toBe('- button "Download" [disabled]')
  })

  it("forced colors in a dark scheme: dark modules on a light ground", {
    timeout: 60_000,
  }, async () => {
    const page = await open(engine, { forcedColors: "active", colorScheme: "dark" })
    const colours = await page.evaluate(() => {
      const frame = document.querySelector('[data-part="frame"]') as Element
      const path = document.querySelector('[data-part="pattern"]') as Element
      return { bg: getComputedStyle(frame).backgroundColor, fill: getComputedStyle(path).fill }
    })
    const lightness = (c: string) => {
      const n = c.match(/[\d.]+/g)?.map(Number) ?? []
      // rgb(r, g, b) or oklch(l c h) / color(srgb r g b)
      return c.startsWith("rgb") ? ((n[0] ?? 0) + (n[1] ?? 0) + (n[2] ?? 0)) / 765 : (n[0] ?? 0)
    }
    expect(lightness(colours.bg)).toBeGreaterThan(0.9)
    expect(lightness(colours.fill)).toBeLessThan(0.1)
  })
})
