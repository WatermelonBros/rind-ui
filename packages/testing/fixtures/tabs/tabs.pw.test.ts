/// <reference types="node" />
// Tabs through the Playwright adapter, against the built Storybook: the driver in a
// real browser, forced colors on the selected tab, RTL, and the generic invariants on every
// Tabs story.
import { createReadStream, existsSync } from "node:fs"
import { createServer, type Server } from "node:http"
import { extname, join, normalize } from "node:path"
import { type Browser, chromium, type Page } from "playwright"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { checkGeneric, getTabs, playwrightEnv } from "../../src/index"

const root = join(import.meta.dirname, "../../../../apps/storybook/storybook-static")
const types: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
}

let server: Server
let browser: Browser
let base = ""

beforeAll(async () => {
  if (!existsSync(root))
    throw new Error("Build Storybook first: pnpm --filter @rind-ui/storybook build")
  server = createServer((req, res) => {
    const path = normalize(decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/"))
    const file = join(root, path.endsWith("/") ? `${path}index.html` : path)
    if (!file.startsWith(root) || !existsSync(file)) {
      res.writeHead(404).end()
      return
    }
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" })
    createReadStream(file).pipe(res)
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`
  browser = await chromium.launch()
}, 60_000)

afterAll(async () => {
  await browser?.close()
  server?.close()
})

const pages: Page[] = []
async function open(id: string, options: Parameters<Browser["newContext"]>[0] = {}) {
  const context = await browser.newContext(options)
  const page = await context.newPage()
  pages.push(page)
  await page.goto(`${base}/iframe.html?id=components-tabs--${id}&viewMode=story`)
  await page.locator('[data-scope="tabs"]').first().waitFor()
  return page
}
afterEach(async () => {
  for (const page of pages.splice(0)) await page.context().close()
})

const tab = (page: Page, name: string) => page.getByRole("tab", { name, exact: true })
const focused = (page: Page, name: string) =>
  tab(page, name).evaluate((el) => el === document.activeElement)
const selected = (page: Page) =>
  page
    .locator('[role="tab"]')
    .evaluateAll((els) =>
      els.filter((e) => e.getAttribute("aria-selected") === "true").map((e) => e.textContent),
    )

describe("tabs driver through Playwright", () => {
  it("selects by pointer and keyboard and reads the panel", { timeout: 60_000 }, async () => {
    const page = await open("driver-example")
    const tabs = getTabs(page, { name: "Sections" })
    expect(await tabs.tabs()).toEqual(["Account", "Billing", "Team"])
    // The story's own play function has run: it ends on Team.
    expect(await tabs.selected()).toBe("Team")
    await tabs.select("Account")
    expect(await tabs.selected()).toBe("Account")
    expect(await tabs.panel()).toMatchObject({ text: "Account settings" })
    await tabs.focusTab("Billing")
    expect(await tabs.selected()).toBe("Account") // focus alone never selects
    await tabs.via("keyboard").select("Billing")
    expect(await tabs.selected()).toBe("Billing")
  })

  it("is one tab stop; arrows select in automatic mode", { timeout: 60_000 }, async () => {
    const page = await open("default")
    await page.keyboard.press("Tab")
    expect(await focused(page, "Account")).toBe(true)
    await page.keyboard.press("ArrowRight")
    expect(await focused(page, "Billing")).toBe(true)
    expect(await selected(page)).toEqual(["Billing"])
    await page.keyboard.press("Tab")
    expect(
      await page
        .getByRole("tabpanel")
        .evaluate((e) => e === document.activeElement || e.contains(document.activeElement)),
    ).toBe(true)
  })

  it("manual: arrows only move focus, Enter selects", { timeout: 60_000 }, async () => {
    const page = await open("manual-activation")
    await page.keyboard.press("Tab")
    await page.keyboard.press("ArrowRight")
    expect(await focused(page, "Billing")).toBe(true)
    expect(await selected(page)).toEqual(["Account"])
    await page.keyboard.press("Enter")
    expect(await selected(page)).toEqual(["Billing"])
  })

  it("RTL: ArrowRight goes to the previous tab and the row is mirrored", {
    timeout: 60_000,
  }, async () => {
    const page = await open("rtl")
    await page.keyboard.press("Tab")
    expect(await focused(page, "Billing")).toBe(true)
    await page.keyboard.press("ArrowRight")
    expect(await focused(page, "Account")).toBe(true)
    const account = await tab(page, "Account").boundingBox()
    const team = await tab(page, "Team").boundingBox()
    expect((account?.x ?? 0) > (team?.x ?? 0)).toBe(true)
  })
})

// The selected tab must stay distinguishable with system colours only, indicator aside.
describe("forced colors", () => {
  it("selected and unselected tabs are distinguishable", { timeout: 60_000 }, async () => {
    const page = await open("default", { forcedColors: "active" })
    const paint = (state: string) =>
      page
        .locator(`[role="tab"][aria-selected="${state}"]`)
        .first()
        .evaluate((el) => {
          const s = getComputedStyle(el)
          return { borderColor: s.borderBlockEndColor, width: s.borderBlockEndWidth }
        })
    const [on, off] = [await paint("true"), await paint("false")]
    expect(on.width).not.toBe("0px")
    expect(on.borderColor).not.toBe(off.borderColor)
  })
})

describe("reduced motion", () => {
  it("the indicator does not transition", { timeout: 60_000 }, async () => {
    const page = await open("with-indicator", { reducedMotion: "reduce" })
    const duration = await page
      .locator('[data-part="indicator"]')
      .evaluate((el) => getComputedStyle(el).transitionDuration)
    expect(duration.split(",").every((d) => Number.parseFloat(d) === 0)).toBe(true)
  })
})

const STORIES = [
  "default",
  "vertical",
  "manual-activation",
  "disabled-tab",
  "focusable-when-disabled",
  "inactive-panels-hidden",
  "inactive-panels-until-found",
  "with-indicator",
  "scrollable-list",
  "rtl",
  "controlled",
  "driver-example",
]

describe("generic invariants on every Tabs story", () => {
  for (const id of STORIES) {
    it(id, { timeout: 60_000 }, async () => {
      const page = await open(id)
      const env = playwrightEnv(page).create({
        scope: "tabs",
        anchor: { role: "tablist", name: "Sections" },
        modality: "virtual",
      })
      const snap = await env.collect()
      const problems = checkGeneric({
        before: null,
        after: snap,
        baseline: snap,
        from: null,
        state: "static",
        expected: () => ({}),
        open: false,
        atInitial: true,
        anchorCount: await env.anchorCount(),
        errors: await env.takeErrors(),
        traits: ["composite-roving", "selectable", "directional"],
        semantics: {},
        values: {},
      })
      expect(problems, id).toEqual([])
    })
  }
})
