/// <reference types="node" />
// Avatar through the Playwright adapter (tasks 4.2, 6.2): the driver waits for a slow image
// served by a delayed route, the fallback delay, the one request carrying the element's own
// referrer policy and CORS mode, and theme captures (forced colors, group LTR/RTL). The page
// is bundled here with rolldown from fixtures/avatar/app.tsx.
import { mkdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { type Browser, chromium, type Page, type Request } from "playwright"
import { rolldown } from "rolldown"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { getAvatar } from "../../src/index"

const here = import.meta.dirname
const themeSrc = join(here, "../../../theme/src")
const captures = join(here, "../../../../.vitest/attachments/captures")
const face = readFileSync(join(here, "face.svg"))

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

/**
 * The page with its image routes. "slow" images are held until `release()`: the test decides
 * when they load, never a delay. `clock`: install Playwright's fake clock first, so the
 * page's timers (fallbackDelay) run only through `page.clock`.
 */
async function open({ clock = false } = {}) {
  const context = await browser.newContext()
  const page = await context.newPage()
  pages.push(page)
  if (clock) {
    // Paused: the page's time moves only through page.clock.runFor.
    await page.clock.install({ time: 0 })
    await page.clock.pauseAt(1000)
  }
  const requests: Request[] = []
  let release = () => {}
  const released = new Promise<void>((r) => {
    release = r
  })
  await page.route("https://img.rind.test/**", async (route) => {
    requests.push(route.request())
    const url = route.request().url()
    if (url.endsWith("missing.png")) return route.fulfill({ status: 404, body: "" })
    if (url.includes("slow")) await released
    return route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      headers: { "access-control-allow-origin": "*" },
      body: face,
    })
  })
  await page.setContent(html)
  await page.getByRole("img", { name: "Empty" }).waitFor()
  return { page, requests, release }
}

describe("avatar driver through Playwright", () => {
  it("waits for a slow image; the fallback is gone after", {
    timeout: 60_000,
  }, async () => {
    const { page, release } = await open()
    const slow = getAvatar(page, { name: "Slow" })
    expect(await slow.status()).toBe("loading")
    expect(await slow.isFallbackVisible()).toBe(true)
    release()
    await slow.waitForStatus("loaded")
    expect(await slow.isFallbackVisible()).toBe(false)
    expect(await slow.name()).toBe("Slow")
  })

  it("fallbackDelay 300 on a slow image: no fallback first, then the fallback", {
    timeout: 60_000,
  }, async () => {
    const { page } = await open({ clock: true })
    const a = getAvatar(page, { name: "Slow delayed" })
    expect(await a.isFallbackVisible()).toBe(false)
    await page.clock.runFor(299)
    expect(await a.isFallbackVisible()).toBe(false)
    await page.clock.runFor(1)
    expect(await a.isFallbackVisible()).toBe(true)
    expect(await a.status()).toBe("loading")
  })

  it("a broken image: error, fallback shown, same name", { timeout: 60_000 }, async () => {
    const { page } = await open()
    const a = getAvatar(page, { name: "Broken" })
    await a.waitForStatus("error")
    expect(await a.isFallbackVisible()).toBe(true)
    expect(await a.name()).toBe("Broken")
  })

  it("one request per image, with no referrer and in CORS mode (radix#1616, #3312)", {
    timeout: 60_000,
  }, async () => {
    const { page, requests, release } = await open()
    release()
    await getAvatar(page, { name: "Slow" }).waitForStatus("loaded")
    const slow = requests.filter((r) => r.url().endsWith("/slow.png"))
    expect(slow).toHaveLength(1)
    const headers = await slow[0]?.allHeaders()
    expect(headers?.["referer"]).toBeUndefined()
    expect(headers?.["origin"]).toBeDefined()
  })
})

describe("avatar theme captures", () => {
  it("each status, and forced colors: the fallback border is visible", {
    timeout: 60_000,
  }, async () => {
    const { page, release } = await open()
    release()
    await getAvatar(page, { name: "Slow" }).waitForStatus("loaded")
    mkdirSync(captures, { recursive: true })
    await page.screenshot({ path: join(captures, "avatar-statuses.png") })
    await page.emulateMedia({ forcedColors: "active" })
    const border = await page
      .getByRole("img", { name: "Empty" })
      .locator('[data-part="fallback"]')
      .evaluate((el) => {
        const s = getComputedStyle(el)
        return { style: s.borderTopStyle, width: Number.parseFloat(s.borderTopWidth) }
      })
    expect(border.style).toBe("solid")
    expect(border.width).toBeGreaterThanOrEqual(1)
    await page.screenshot({ path: join(captures, "avatar-forced-colors.png") })
  })

  it("group LTR and RTL: each avatar overlaps its neighbour on the reading side", {
    timeout: 60_000,
  }, async () => {
    const { page } = await open()
    const boxes = async (dir: string) =>
      Promise.all(
        ["Ada", "Alan"].map(async (n) => {
          const box = await page.getByRole("img", { name: `${n} ${dir}` }).boundingBox()
          if (!box) throw new Error(`${n} ${dir} has no box`)
          return box
        }),
      )
    const [a, b] = await boxes("ltr")
    expect(b?.x).toBeLessThan((a?.x ?? 0) + (a?.width ?? 0))
    expect(b?.x).toBeGreaterThan(a?.x ?? 0)
    const [c, d] = await boxes("rtl")
    expect((d?.x ?? 0) + (d?.width ?? 0)).toBeGreaterThan(c?.x ?? 0)
    expect(d?.x).toBeLessThan(c?.x ?? 0)
    await expect(
      page.getByRole("group", { name: "Reviewers rtl" }).textContent(),
    ).resolves.toContain("4 more")
    await page.screenshot({ path: join(captures, "avatar-group-ltr-rtl.png") })
  })
})
