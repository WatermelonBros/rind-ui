/// <reference types="node" />
// Badge through the Playwright adapter (tasks 4.2, 6.2): the same driver calls as the Vitest
// suites, the host's name and description in Chromium's tree, and the forced-colors, 200 %
// zoom and danger-tone captures. The page is bundled here with rolldown from
// fixtures/badge/app.tsx (Storybook is being retired).
import { mkdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { type Browser, chromium, type Page } from "playwright"
import { rolldown } from "rolldown"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { getBadge } from "../../src/index"

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
  await page.getByRole("button", { name: "Comments 3 unread" }).waitFor()
  return page
}

describe("badge driver through Playwright", () => {
  it("Same test in Playwright: the driver reads the spoken text", { timeout: 60_000 }, async () => {
    const page = await open()
    const b = getBadge(page, { within: page.getByRole("button", { name: "Comments 3 unread" }) })
    expect(await b.text()).toBe("3 unread")
    expect(await b.isExposed()).toBe(true)
  })

  it("a host with aria-label gets the count as its description", { timeout: 60_000 }, async () => {
    const page = await open()
    const host = page.getByRole("button", { name: "Notifications", exact: true })
    await expect.poll(() => host.evaluate((el) => el.getAttribute("aria-describedby"))).toBe("n")
    expect(await getBadge(page, { within: host }).text()).toBe("more than 99 notifications")
  })

  it("several matches fail naming the count", { timeout: 60_000 }, async () => {
    const page = await open()
    await expect(getBadge(page, { within: page.locator("#root") }).text()).rejects.toThrow(
      /3 elements match/,
    )
  })
})

describe("badge theme captures", () => {
  it("forced colors: the badge keeps a visible border (ariakit#7591)", {
    timeout: 60_000,
  }, async () => {
    const page = await open({ forcedColors: "active" })
    const border = await page
      .locator('[data-scope="badge"]')
      .first()
      .evaluate((el) => {
        const s = getComputedStyle(el)
        return { style: s.borderTopStyle, width: Number.parseFloat(s.borderTopWidth) }
      })
    expect(border.style).toBe("solid")
    expect(border.width).toBeGreaterThanOrEqual(1)
    mkdirSync(captures, { recursive: true })
    await page.screenshot({ path: join(captures, "badge-forced-colors.png") })
  })

  it("200 % zoom: '99+' is not clipped (mui/material-ui#49441)", { timeout: 60_000 }, async () => {
    const page = await open()
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%"
    })
    const el = page.locator('[data-scope="badge"][data-tone="danger"]')
    const fits = await el.evaluate(
      (e) => e.scrollWidth <= e.clientWidth && e.scrollHeight <= e.clientHeight,
    )
    expect(fits).toBe(true)
    mkdirSync(captures, { recursive: true })
    await page.screenshot({ path: join(captures, "badge-zoom-200.png") })
  })

  it('data-tone="danger" repaints the badge', { timeout: 60_000 }, async () => {
    const page = await open()
    const read = (sel: string) =>
      page.locator(sel).evaluate((e) => getComputedStyle(e).backgroundColor)
    const accent = await read('[data-scope="badge"]:not([data-tone]):not([data-variant])')
    const danger = await read('[data-scope="badge"][data-tone="danger"]')
    expect(danger).not.toBe(accent)
    mkdirSync(captures, { recursive: true })
    await page.screenshot({ path: join(captures, "badge-tone-danger.png") })
  })
})
