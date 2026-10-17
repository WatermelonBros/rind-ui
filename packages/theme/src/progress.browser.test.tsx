// add-progress 7.1: the Progress stylesheet alone: the fill from the inline size, the
// indeterminate segment (still and striped under reduced motion, animated otherwise), a
// partial ring arc, size variants, forced-colors rules (rendered captures:
// progress.pw.test.ts).
import { afterEach, describe, expect, it } from "vitest"
import progress from "./progress.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${files.variants}\n${progress}`,
  )

const attrs = (part: string, state: string, extra = "") =>
  `data-scope="progress" data-part="${part}" data-state="${state}" data-orientation="horizontal" ${extra}`

const bar = (state: string, fill = "") =>
  `<div ${attrs("root", state)} style="width:200px"><div ${attrs("track", state)}><div ${attrs("indicator", state)} style="${fill}"></div></div></div>`

describe("Progress stylesheet", () => {
  it("the fill is the inline percent of the track, painted with the accent", () => {
    sheet()
    const host = mount(bar("loading", "--rind-progress-percent:40;inline-size:40%"))
    const track = q(host, '[data-part="track"]')
    const ind = q(host, '[data-part="indicator"]')
    expect(ind.getBoundingClientRect().width).toBeCloseTo(track.clientWidth * 0.4, 0)
    expect(track.getBoundingClientRect().height).toBeGreaterThan(0)
    expect(getComputedStyle(ind).backgroundColor).not.toBe("rgba(0, 0, 0, 0)")
  })

  it("indeterminate: a 40% segment, striped, not a determinate fill", () => {
    sheet()
    const host = mount(bar("indeterminate"))
    const track = q(host, '[data-part="track"]')
    const ind = q(host, '[data-part="indicator"]')
    expect(ind.getBoundingClientRect().width).toBeCloseTo(track.clientWidth * 0.4, 0)
    expect(progress).toMatch(/repeating-linear-gradient/)
  })

  it("animates the indeterminate bar and ring only without reduced motion", () => {
    const motion = /@media \(prefers-reduced-motion: no-preference\) \{([\s\S]*?)\n {2}\}/.exec(
      progress,
    )?.[1]
    expect(motion).toMatch(/animation: rind-progress-slide/)
    expect(motion).toMatch(/animation: rind-progress-spin/)
    // No animation outside that block (keyframes are definitions, not uses).
    const outside = progress.replace(motion ?? "", "")
    expect(outside).not.toMatch(/animation:/)
  })

  it("indeterminate ring: a quarter arc (ZG#1716)", () => {
    sheet()
    const host = mount(
      `<svg ${attrs("circle", "indeterminate")} viewBox="0 0 100 100"><circle ${attrs("circle-indicator", "indeterminate")} cx="50" cy="50" r="45" pathLength="100" stroke-dasharray="100"></circle></svg>`,
    )
    expect(getComputedStyle(q(host, "circle")).strokeDashoffset).toBe("75px")
  })

  it("size variants change the track", () => {
    sheet()
    const sm = q(
      mount(bar("loading").replace('data-part="root"', 'data-part="root" data-size="sm"')),
      '[data-part="track"]',
    )
    const lg = q(
      mount(bar("loading").replace('data-part="root"', 'data-part="root" data-size="lg"')),
      '[data-part="track"]',
    )
    expect(lg.getBoundingClientRect().height).toBeGreaterThan(sm.getBoundingClientRect().height)
  })

  it("data-tone=danger re-points the fill", () => {
    sheet()
    const plain = q(mount(bar("loading", "inline-size:40%")), '[data-part="indicator"]')
    const danger = q(
      mount(`<div data-tone="danger">${bar("loading", "inline-size:40%")}</div>`),
      '[data-part="indicator"]',
    )
    expect(getComputedStyle(danger).backgroundColor).not.toBe(
      getComputedStyle(plain).backgroundColor,
    )
  })

  it("has forced-colors rules: Highlight fill, CanvasText track edge", () => {
    expect(progress).toMatch(/@media \(forced-colors: active\)[\s\S]*Highlight[\s\S]*CanvasText/)
  })
})
