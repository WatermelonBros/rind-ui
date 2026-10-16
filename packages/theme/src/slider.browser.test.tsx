// add-slider 8.1: the Slider stylesheet alone, on the markup core renders: track and thumb
// sizes per data-size, a 24 px thumb hit area, a 3:1 thumb edge role, vertical layout, soft
// variant, no transitions while dragging, forced-colors rules (captured in slider.pw.test.ts).
import { afterEach, describe, expect, it } from "vitest"
import slider from "./slider.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${files.variants}\n${slider}`,
  )

const attrs = (part: string, extra = "") =>
  `data-scope="slider" data-part="${part}" data-instance="s" data-orientation="horizontal" ${extra}`

const markup = (
  rootAttrs = "",
  thumbAttrs = "",
) => `<div ${attrs("root", rootAttrs)} role="group" style="width:300px">
  <label ${attrs("label")}>Volume</label>
  <div ${attrs("control")} style="position:relative">
    <div ${attrs("track")}><div ${attrs("indicator")} style="position:absolute;inset-inline-start:0;inline-size:40%"></div></div>
    <div ${attrs("thumb", thumbAttrs)} style="position:absolute;inset-inline-start:40%;translate:-50% 0"><input type="range" aria-label="Volume"></div>
  </div>
</div>`

const parts = (html: string) => {
  const host = mount(html)
  return {
    root: q(host, '[data-part="root"]'),
    control: q(host, '[data-part="control"]'),
    track: q(host, '[data-part="track"]'),
    indicator: q(host, '[data-part="indicator"]'),
    thumb: q(host, '[data-part="thumb"]'),
  }
}

describe("Slider stylesheet", () => {
  it("the control is a 24 px target and the thumb's hit area is at least 24 × 24", () => {
    sheet()
    const { control, thumb } = parts(markup())
    expect(control.getBoundingClientRect().height).toBeGreaterThanOrEqual(24)
    const before = getComputedStyle(thumb, "::before")
    expect(Number.parseFloat(before.width)).toBeGreaterThanOrEqual(24)
    expect(Number.parseFloat(before.height)).toBeGreaterThanOrEqual(24)
  })

  it("the thumb has a solid border and is centred on the track", () => {
    sheet()
    const { thumb, track } = parts(markup())
    expect(getComputedStyle(thumb).borderTopStyle).toBe("solid")
    const t = thumb.getBoundingClientRect()
    const r = track.getBoundingClientRect()
    expect(t.top + t.height / 2).toBeCloseTo(r.top + r.height / 2, 0)
  })

  it("data-size changes track and thumb sizes", () => {
    const size = (s: string) => {
      sheet()
      const { thumb, track } = parts(markup(s ? `data-size="${s}"` : ""))
      const out = [thumb.getBoundingClientRect().width, track.getBoundingClientRect().height]
      cleanup()
      return out
    }
    const [sm, md, lg] = [size("sm"), size(""), size("lg")]
    expect(sm[0]).toBeLessThan(md[0] ?? 0)
    expect(md[0]).toBeLessThan(lg[0] ?? 0)
    expect(sm[1]).toBeLessThan(lg[1] ?? 0)
  })

  it("--rind-slider-thumb-size sizes the thumb (contain reads the same token)", () => {
    sheet()
    const { thumb } = parts(markup('style="width:300px;--rind-slider-thumb-size:30px"'))
    expect(thumb.getBoundingClientRect().width).toBe(30)
  })

  it("soft variant tints the indicator differently from solid", () => {
    sheet()
    const solid = getComputedStyle(parts(markup()).indicator).backgroundColor
    cleanup()
    sheet()
    const soft = getComputedStyle(parts(markup('data-variant="soft"')).indicator).backgroundColor
    expect(soft).not.toBe(solid)
  })

  it("no transition while dragging", () => {
    sheet()
    const { thumb } = parts(markup("data-dragging", "data-dragging"))
    expect(
      getComputedStyle(thumb)
        .transitionDuration.split(",")
        .every((d) => Number.parseFloat(d) === 0),
    ).toBe(true)
  })

  it("vertical: the control is taller than wide", () => {
    sheet()
    const html = markup().replaceAll('data-orientation="horizontal"', 'data-orientation="vertical"')
    const { control } = parts(html)
    const r = control.getBoundingClientRect()
    expect(r.height).toBeGreaterThan(r.width)
  })

  it("forced colors, logical properties, duration tokens, no [hidden] rule", () => {
    const css = slider.replace(/\/\*[\s\S]*?\*\//g, "")
    expect(css).toMatch(/@media \(forced-colors: active\)[\s\S]*CanvasText[\s\S]*Highlight/)
    expect(css).toMatch(/--rind-duration-fast/)
    expect(css).not.toMatch(/\[hidden\]/)
    expect(css).not.toMatch(/(^|[\s;{])(left|right):/)
  })
})
