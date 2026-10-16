// add-meter 6.1: the Meter stylesheet alone: the fill from the inline size, each zone with
// its own palette and a non-colour cue (pattern, edge), size variants, forced-colors rules
// (rendered captures: meter.pw.test.ts).
import { afterEach, describe, expect, it } from "vitest"
import meter from "./meter.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${files.variants}\n${meter}`,
  )

const bar = (zone: string | null, root = "") => {
  const z = zone === null ? "" : `data-zone="${zone}"`
  const a = (part: string) =>
    `data-scope="meter" data-part="${part}" data-orientation="horizontal" ${z}`
  return `<div ${a("root")} ${root} style="width:200px"><div ${a("track")}><div ${a("indicator")} style="--rind-meter-percent:50;inline-size:50%"></div></div></div>`
}
const indicator = (zone: string | null) =>
  getComputedStyle(q(mount(bar(zone)), '[data-part="indicator"]'))

describe("Meter stylesheet", () => {
  it("the fill is the inline percent of the track", () => {
    sheet()
    const host = mount(bar(null))
    const track = q(host, '[data-part="track"]')
    expect(q(host, '[data-part="indicator"]').getBoundingClientRect().width).toBeCloseTo(
      track.clientWidth / 2,
      0,
    )
  })

  it("each zone has its own fill, pattern and edge: never colour alone", () => {
    sheet()
    const optimum = indicator("optimum")
    const sub = indicator("suboptimum")
    const worse = indicator("even-less-good")
    expect(new Set([optimum, sub, worse].map((s) => s.backgroundColor)).size).toBe(3)
    expect(optimum.backgroundImage).toBe("none")
    expect(sub.backgroundImage).toMatch(/repeating-linear-gradient/)
    expect(worse.backgroundImage).toMatch(/repeating-linear-gradient/)
    expect(sub.backgroundImage).not.toBe(worse.backgroundImage)
    expect(Number.parseFloat(sub.borderRightWidth)).toBe(2)
    expect(Number.parseFloat(worse.borderRightWidth)).toBe(4)
    expect(Number.parseFloat(optimum.borderRightWidth)).toBe(0)
  })

  it("size variants change the track", () => {
    sheet()
    const sm = q(mount(bar(null, 'data-size="sm"')), '[data-part="track"]')
    const lg = q(mount(bar(null, 'data-size="lg"')), '[data-part="track"]')
    expect(lg.getBoundingClientRect().height).toBeGreaterThan(sm.getBoundingClientRect().height)
  })

  it("forced colors keep the zones apart by border style", () => {
    const fc = /@media \(forced-colors: active\) \{([\s\S]*)\}\s*\}\s*$/.exec(meter)?.[1] ?? ""
    expect(fc).toMatch(/Highlight/)
    expect(fc).toMatch(/CanvasText/)
    expect(fc).toMatch(/suboptimum[\s\S]*dashed/)
    expect(fc).toMatch(/even-less-good[\s\S]*double/)
  })
})
