/// <reference types="node" />
// The colour components through the Playwright adapter (add-color-picker 8.3, 10.2, 11.1): the
// same driver calls as the Vitest suites, then the themed captures (forced colors, RTL,
// vertical, alpha checkerboard, the popover content, reduced motion) and ARIA snapshots. The
// page is bundled here with rolldown from fixtures/color-picker/app.tsx.
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { type Browser, chromium, type Page } from "playwright"
import { rolldown } from "rolldown"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import {
  getColorArea,
  getColorChannelField,
  getColorField,
  getColorSlider,
  getColorSwatch,
  getColorSwatchPicker,
} from "../../src/components/color-parts"
import { getColorPicker } from "../../src/index"

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
  await page.getByRole("group", { name: "Fill" }).waitFor()
  return page
}

describe("colour drivers through Playwright (8.3)", () => {
  it("Color Area: keys, a press, a drag, native adjust, reset", { timeout: 60_000 }, async () => {
    const page = await open()
    const area = getColorArea(page, { name: "Fill" })
    await area.step("x", "increase")
    expect((await area.channels()).x.value).toBe(51)
    await area.pressAt({ x: 0.25, y: 0.75 })
    const pressed = await area.channels()
    expect(pressed.x.value).toBeCloseTo(25, 0)
    expect(pressed.y.value).toBeCloseTo(75, 0)
    await area.pointerDown({ x: 0.5, y: 0.5 })
    await area.pointerMove({ x: 0.9, y: 0.1 })
    await area.pointerUp()
    expect((await area.channels()).x.value).toBeCloseTo(90, 0)
    await area.adjustNative("y", 40)
    expect((await area.channels()).y.value).toBe(40)
    await area.resetForm()
    expect((await area.formValues()).map(Number)).toEqual([50, 50])
  })

  it("Color Slider: a step, a track press, the channel", { timeout: 60_000 }, async () => {
    const page = await open()
    const hue = getColorSlider(page, { name: "Hue" })
    await hue.step(0, "increase")
    expect(await hue.values()).toEqual([201])
    await hue.pressTrack(180)
    expect(await hue.values()).toEqual([180])
    expect(await hue.channel()).toBe("hue")
    expect(await hue.gradient()).toContain("linear-gradient(to right")
  })

  it("Color Field and Channel Field: fill commits; typed values clamp", {
    timeout: 60_000,
  }, async () => {
    const page = await open()
    const hex = getColorField(page, { name: "Hex" })
    await hex.fill("3366ff")
    expect(await hex.text()).toBe("#3366FF")
    expect(await hex.formValue()).toBe("#3366FF")
    const field = getColorChannelField(page, { name: "Hue" })
    await field.fill("999")
    expect(await field.channel()).toBe("hue")
    expect(await page.locator('[data-scope="number-input"][data-part="input"]').inputValue()).toBe(
      "360°",
    )
  })

  it("Color Swatch and Swatch Picker: names, a pick, a move", { timeout: 60_000 }, async () => {
    const page = await open()
    expect(await getColorSwatch(page, { name: "vibrant pink" }).color("hex")).toBe("#FF3D8B")
    const palette = getColorSwatchPicker(page, { name: "Palette" })
    await palette.pick("vibrant blue")
    expect((await palette.selected())?.name).toBe("vibrant blue")
    await palette.move("next")
    expect((await palette.selected())?.name).toBe("vibrant red")
  })

  it("Color Picker: open, hex, a swatch, close; the form value", { timeout: 60_000 }, async () => {
    const page = await open()
    const picker = getColorPicker(page, { name: "Background" })
    await picker.open()
    await picker.input("hex").fill("3366ff")
    expect(await picker.color("hex")).toBe("#3366FF")
    await picker.swatches().pick("vibrant red")
    expect(await picker.formValue()).toBe("#FF0000")
    await picker.close()
    expect(await picker.isOpen()).toBe(false)
    expect(
      await page
        .getByRole("button", { name: /Choose color/ })
        .evaluate((b) => b === document.activeElement),
    ).toBe(true)
  })
})

describe("colour theme captures (10.2)", () => {
  it("forced colors: thumbs ringed, the swatch bordered, colours kept", {
    timeout: 60_000,
  }, async () => {
    const page = await open({ forcedColors: "active" })
    const css = await page.evaluate(() => {
      const q = (s: string) => getComputedStyle(document.querySelector(s) as Element)
      return {
        thumb: q('[data-scope="color-area"][data-part="thumb"]').boxShadow,
        swatch: q('[data-scope="color-swatch"][data-part="root"]').borderTopStyle,
        swatchColor: q('[data-scope="color-swatch"][data-part="root"]').backgroundColor,
        adjust: q('[data-scope="color-area"][data-part="background"]').forcedColorAdjust,
      }
    })
    expect(css.thumb).not.toBe("none")
    expect(css.swatch).toBe("solid")
    expect(css.swatchColor).toBe("rgb(255, 61, 139)")
    expect(css.adjust).toBe("none")
    expect(
      (await page.getByRole("group", { name: "Fill" }).screenshot()).byteLength,
    ).toBeGreaterThan(0)
  })

  it("RTL alpha: the gradient runs to the left; the opaque end is at the left", {
    timeout: 60_000,
  }, async () => {
    // No transition: the thumb's box is read right after the key.
    const page = await open({ reducedMotion: "reduce" })
    const opacity = getColorSlider(page, { name: "Opacity" })
    expect(await opacity.gradient()).toContain("to left")
    await opacity.toEdge(0, "max")
    const group = page.getByRole("group", { name: "Opacity" })
    const [t, c] = [
      await group.locator('[data-part="thumb"]').boundingBox(),
      await group.locator('[data-part="control"]').boundingBox(),
    ]
    expect((t?.x ?? 0) - (c?.x ?? 0)).toBeLessThan((c?.width ?? 0) / 4)
  })

  it("alpha checkerboard: the grid under the track is drawn", { timeout: 60_000 }, async () => {
    const page = await open()
    const grid = page
      .getByRole("group", { name: "Opacity" })
      .locator('[data-part="transparency-grid"]')
    expect(await grid.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain(
      "conic-gradient",
    )
    expect(
      await page
        .locator('[data-scope="color-swatch"][data-transparent]')
        .evaluate((el) => getComputedStyle(el).backgroundImage),
    ).toContain("conic-gradient")
  })

  it("vertical: the gradient runs to the top and a press near the top is near 360", {
    timeout: 60_000,
  }, async () => {
    const page = await open()
    const vertical = getColorSlider(page, { name: "Vertical hue" })
    expect(await vertical.gradient()).toContain("to top")
    await vertical.pressTrack(340)
    expect((await vertical.values())[0]).toBeGreaterThan(330)
  })

  it("the themed popover content is a raised panel", { timeout: 60_000 }, async () => {
    const page = await open()
    await getColorPicker(page, { name: "Background" }).open()
    const content = page.locator('[data-scope="color-picker"][data-part="content"]')
    const style = await content.evaluate((el) => ({
      bg: getComputedStyle(el).backgroundColor,
      shadow: getComputedStyle(el).boxShadow,
    }))
    expect(style.bg).not.toBe("rgba(0, 0, 0, 0)")
    expect(style.shadow).not.toBe("none")
    expect((await content.screenshot()).byteLength).toBeGreaterThan(0)
  })

  it("reduced motion: the area thumb does not transition", { timeout: 60_000 }, async () => {
    const page = await open({ reducedMotion: "reduce" })
    const d = await page
      .locator('[data-scope="color-area"][data-part="thumb"]')
      .evaluate((el) => getComputedStyle(el).transitionDuration)
    expect(d.split(",").every((x) => Number.parseFloat(x) === 0)).toBe(true)
  })
})

describe("ARIA snapshots (11.1)", () => {
  it("the area, the palette and the picker's trigger and content", {
    timeout: 60_000,
  }, async () => {
    const page = await open()
    const area = await page.getByRole("group", { name: "Fill" }).ariaSnapshot()
    expect(area).toContain('slider "Fill Saturation"')
    expect(area).toContain('slider "Fill Brightness"')
    const palette = await page.getByRole("radiogroup", { name: "Palette" }).ariaSnapshot()
    expect(palette.match(/- radio "/g)).toHaveLength(3)
    expect(palette).toContain('radio "vibrant red" [checked]')
    const picker = getColorPicker(page, { name: "Background" })
    expect(await page.getByRole("button", { name: /Choose color/ }).ariaSnapshot()).toMatch(
      /button "Choose color, .+"/,
    )
    await picker.open()
    const content = await page.getByRole("dialog").ariaSnapshot()
    expect(content).toContain('slider "Hue"')
    expect(content).toContain("textbox")
    expect(content).toContain("combobox")
  })
})
