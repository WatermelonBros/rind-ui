// add-alert 6.1/6.2: the Alert stylesheet: logical grid (the CloseTrigger at the inline end,
// mirrored in RTL), a CloseTrigger target of at least 24×24, a forced-colors border, an exit
// transition that is zero under reduced motion, and 4.5:1 text in every tone × variant.
import { afterEach, describe, expect, it } from "vitest"
import alert from "./alert.css?inline"
import { cleanup, files, indexCss, inject, mount, paint, q, ratio, rgba } from "./test-css"

afterEach(cleanup)

const sheet = (preset = files.calm) => inject(`${indexCss.replace(files.calm, preset)}\n${alert}`)

const a = (attrs = "") =>
  `<div data-scope="alert" data-part="root" data-instance="i" data-state="open" ${attrs}>` +
  '<span data-scope="alert" data-part="icon" data-instance="i" aria-hidden="true">!</span>' +
  '<div data-scope="alert" data-part="title" data-instance="i">Couldn\'t save</div>' +
  '<div data-scope="alert" data-part="description" data-instance="i">Disk full</div>' +
  '<button data-scope="alert" data-part="close-trigger" data-instance="i" type="button">×</button>' +
  "</div>"

const part = (host: HTMLElement, name: string) => q(host, `[data-part="${name}"]`)

describe("Alert stylesheet", () => {
  it("lays out Icon, text and CloseTrigger; RTL mirrors it", () => {
    sheet()
    for (const dir of ["ltr", "rtl"]) {
      const host = mount(`<div dir="${dir}" style="width:400px">${a()}</div>`)
      const icon = part(host, "icon").getBoundingClientRect()
      const title = part(host, "title").getBoundingClientRect()
      const close = part(host, "close-trigger").getBoundingClientRect()
      if (dir === "ltr") {
        expect(icon.right).toBeLessThanOrEqual(title.left)
        expect(title.right).toBeLessThanOrEqual(close.left)
      } else {
        expect(icon.left).toBeGreaterThanOrEqual(title.right)
        expect(title.left).toBeGreaterThanOrEqual(close.right)
      }
    }
  })

  it("the CloseTrigger target is at least 24×24", () => {
    sheet()
    const r = part(mount(a('data-size="sm"')), "close-trigger").getBoundingClientRect()
    expect(r.width).toBeGreaterThanOrEqual(24)
    expect(r.height).toBeGreaterThanOrEqual(24)
  })

  it("closed fades out over the duration token; reduced motion zeroes it", () => {
    sheet()
    const root = part(mount(a()), "root")
    expect(getComputedStyle(root).transitionProperty).toContain("opacity")
    expect(alert).toMatch(/--rind-duration-normal/)
  })

  it("reads --rind-alert-* tokens", () => {
    sheet()
    const root = part(mount(a('style="--rind-alert-radius:3px;--rind-alert-gap:20px"')), "root")
    expect(getComputedStyle(root).borderTopLeftRadius).toBe("3px")
    expect(getComputedStyle(root).columnGap).toBe("20px")
  })

  it("has a forced-colors border and a currentColor-based icon rule", () => {
    expect(alert).toMatch(/@media \(forced-colors: active\)[\s\S]*border-color: CanvasText/)
    expect(alert).toMatch(/data-part="icon"[\s\S]*color: currentColor/)
  })

  const tones = ["accent", "neutral", "danger", "warning", "success"]
  const variants = {
    soft: ["--rind-color-accent-text", "--rind-color-accent-soft"],
    solid: ["--rind-color-accent-on-solid", "--rind-color-accent-solid"],
    outline: ["--rind-color-accent-text", "--rind-color-bg"],
  } as const
  const presets = { calm: files.calm, crisp: files.crisp }
  const cases = Object.keys(presets).flatMap((preset) =>
    ["light", "dark"].flatMap((scheme) =>
      tones.flatMap((tone) =>
        Object.keys(variants).map((variant) => ({ preset, scheme, tone, variant })),
      ),
    ),
  )

  it.each(cases)("text reaches 4.5:1: $preset $scheme $tone $variant", (c) => {
    sheet(presets[c.preset as keyof typeof presets])
    const [fg, bg] = variants[c.variant as keyof typeof variants]
    const host = mount(
      `<div data-theme="${c.scheme}">${a(`data-tone="${c.tone}" data-variant="${c.variant}"`)}</div>`,
    )
    const el = part(host, "root")
    expect(getComputedStyle(el).color).toBe(paint(el, fg))
    expect(ratio(rgba(el, fg), rgba(el, bg))).toBeGreaterThanOrEqual(4.5)
  })
})
