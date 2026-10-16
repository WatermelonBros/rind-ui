/// <reference types="node" />
// Slider through the Playwright adapter (tasks 5.1, 6.3, 8.2): the adapter's pointer steps,
// geometry and native fill; the same driver calls as the Vitest suites; forced colors, RTL,
// vertical, contain and reduced motion on the themed component. The page is bundled here with
// rolldown from fixtures/slider/app.tsx (Storybook is being retired).
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { type Browser, chromium, type Page } from "playwright"
import { rolldown } from "rolldown"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { getSlider, playwrightEnv } from "../../src/index"

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

async function open(options: Parameters<Browser["newContext"]>[0] = {}) {
  const context = await browser.newContext({ hasTouch: true, ...options })
  const page = await context.newPage()
  pages.push(page)
  await page.setContent(html)
  await page.getByRole("group", { name: "Volume" }).waitFor()
  return page
}

describe("adapter pointer steps, geometry and native values (Playwright)", () => {
  async function plain() {
    const context = await browser.newContext({ hasTouch: true })
    const page = await context.newPage()
    pages.push(page)
    await page.setContent(
      '<div role="group" aria-label="G" data-scope="p" data-part="root" data-instance="1">' +
        '<div data-scope="p" data-part="surface" data-instance="1" style="width:200px;height:20px;margin:10px"></div>' +
        '<input type="range" aria-label="R" data-scope="p" data-part="input" data-instance="1" value="10"></div>',
    )
    const env = playwrightEnv(page).create({
      scope: "p",
      anchor: { role: "group", name: "G" },
      modality: "pointer",
    })
    return { page, env }
  }

  it("Native adjust: fill sets the property, one input and one change, no keydown", async () => {
    const { page, env } = await plain()
    await page.evaluate(() => {
      const input = document.querySelector("input") as HTMLInputElement
      const w = window as unknown as { seen: string[] }
      w.seen = []
      for (const t of ["input", "change", "keydown"])
        input.addEventListener(t, () => w.seen.push(t))
    })
    await env.part("input").fill("35")
    expect(await page.locator("input").inputValue()).toBe("35")
    expect(await page.evaluate(() => (window as unknown as { seen: string[] }).seen)).toEqual([
      "input",
      "change",
    ])
  })

  it("Box in a browser: 200 × 20", async () => {
    const { env } = await plain()
    const box = await env.part("surface").box()
    expect([box?.width, box?.height]).toEqual([200, 20])
  })

  it("pointer steps land at the fraction (mouse and touch)", async () => {
    const { page, env } = await plain()
    await page.evaluate(() => {
      const s = document.querySelector('[data-part="surface"]') as HTMLElement
      const w = window as unknown as { seen: string[] }
      w.seen = []
      for (const t of ["pointerdown", "pointermove", "pointerup", "pointercancel"]) {
        s.addEventListener(t, (e) => {
          const p = e as PointerEvent
          w.seen.push(
            `${t} ${p.pointerType} ${Math.round(p.clientX - s.getBoundingClientRect().left)}`,
          )
        })
      }
    })
    const part = env.part("surface")
    await part.pointer("down", { at: { x: 0.25, y: 0.5 } })
    await part.pointer("up", { at: { x: 0.25, y: 0.5 } })
    await part.pointer("down", { at: { x: 0.5, y: 0.5 }, pointerType: "touch" })
    await part.pointer("cancel", { at: { x: 0.5, y: 0.5 }, pointerType: "touch" })
    const seen = await page.evaluate(() => (window as unknown as { seen: string[] }).seen)
    // The real mouse moves before it presses: only the presses are asserted in order.
    expect(seen.filter((e) => !e.startsWith("pointermove"))).toEqual([
      "pointerdown mouse 50",
      "pointerup mouse 50",
      "pointerdown touch 100",
      "pointercancel touch 100",
    ])
    expect(seen).toContain("pointermove mouse 50")
  })
})

describe("slider driver through Playwright", () => {
  it("Same driver in both environments: step from 50 gives [51]", { timeout: 60_000 }, async () => {
    const page = await open()
    const volume = getSlider(page, { name: "Volume" })
    await volume.step(0, "increase")
    expect(await volume.values()).toEqual([51])
  })

  it("presses the track, drags by mouse and touch, adjusts natively, resets", {
    timeout: 60_000,
  }, async () => {
    const page = await open()
    const volume = getSlider(page, { name: "Volume" })
    await volume.pressTrack(75)
    expect(await volume.values()).toEqual([75])
    await volume.setValue(0, 30)
    expect(await volume.values()).toEqual([30])
    const price = getSlider(page, { name: "Price" })
    await price.via("touch").setValue(1, 60)
    expect(await price.values()).toEqual([20, 60])
    await price.adjustNative(0, 35)
    expect(await price.values()).toEqual([35, 60])
    expect(await price.formValues()).toEqual(["35", "60"])
    await price.resetForm()
    expect(await price.values()).toEqual([20, 80])
    expect(await volume.values()).toEqual([50])
  })

  it("RTL: a press 25 % from the right edge gives 25; vertical grows upward", {
    timeout: 60_000,
  }, async () => {
    const page = await open()
    const balance = getSlider(page, { name: "Balance" })
    await balance.pressTrack(70)
    expect(await balance.values()).toEqual([70])
    const thumb = page.getByRole("group", { name: "Balance" }).locator('[data-part="thumb"]')
    const control = page.getByRole("group", { name: "Balance" }).locator('[data-part="control"]')
    const [t, c] = [await thumb.boundingBox(), await control.boundingBox()]
    // 70 % from the right edge.
    expect(
      ((c?.x ?? 0) + (c?.width ?? 0) - ((t?.x ?? 0) + (t?.width ?? 0) / 2)) / (c?.width ?? 1),
    ).toBeCloseTo(0.7, 1)
    const height = getSlider(page, { name: "Height" })
    await height.pressTrack(75)
    expect(await height.values()).toEqual([75])
  })

  it("contain keeps the thumb inside the Control at both ends", { timeout: 60_000 }, async () => {
    const page = await open()
    const zoom = getSlider(page, { name: "Zoom" })
    const group = page.getByRole("group", { name: "Zoom" })
    for (const edge of ["min", "max"] as const) {
      await zoom.toEdge(0, edge)
      const [t, c] = [
        await group.locator('[data-part="thumb"]').boundingBox(),
        await group.locator('[data-part="control"]').boundingBox(),
      ]
      expect((t?.x ?? 0) >= (c?.x ?? 0) - 0.5).toBe(true)
      expect((t?.x ?? 0) + (t?.width ?? 0) <= (c?.x ?? 0) + (c?.width ?? 0) + 0.5).toBe(true)
    }
    await zoom.pressTrack(50)
    expect(await zoom.values()).toEqual([50])
  })

  it("reduced motion: thumbs do not transition", { timeout: 60_000 }, async () => {
    const page = await open({ reducedMotion: "reduce" })
    const d = await page
      .locator('[data-part="thumb"]')
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration)
    expect(d.split(",").every((x) => Number.parseFloat(x) === 0)).toBe(true)
  })
})

// ARK#3421, RX#2993: under forced colors the track, indicator and thumbs stay visible and the
// focused thumb shows an outline.
describe("forced colors", () => {
  it("track, indicator and thumb are visible; the focused thumb is outlined", {
    timeout: 60_000,
  }, async () => {
    const page = await open({ forcedColors: "active" })
    await getSlider(page, { name: "Volume" }).via("keyboard").step(0, "increase")
    const group = page.getByRole("group", { name: "Volume" })
    const style = await group.evaluate((root) => {
      const css = (sel: string) => getComputedStyle(root.querySelector(sel) as Element)
      return {
        track: css('[data-part="track"]').borderTopStyle,
        indicator: css('[data-part="indicator"]').backgroundColor,
        thumb: `${css('[data-part="thumb"]').borderTopStyle} ${css('[data-part="thumb"]').borderTopColor}`,
        outline: css('[data-part="thumb"]').outlineStyle,
      }
    })
    expect(style.track).toBe("solid")
    expect(style.indicator).not.toBe("rgba(0, 0, 0, 0)")
    expect(style.thumb).toMatch(/^solid rgb/)
    expect(style.outline).toBe("solid")
    const shot = await group.screenshot()
    expect(shot.byteLength).toBeGreaterThan(0)
  })
})
