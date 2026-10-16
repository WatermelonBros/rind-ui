// add-skeleton 6.1: the Skeleton stylesheet alone: a fill from tokens (light and dark), wrapped
// text kept in size but not drawn, the shimmer only while loading, and the forced-colors and
// reduced-motion rules (the rendered captures are in skeleton.pw.test.ts).
import { afterEach, describe, expect, it } from "vitest"
import skeleton from "./skeleton.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${skeleton}`,
  )

const item = (state: string, inner = "", extra = "data-animate") =>
  `<span data-scope="skeleton" data-part="item" data-state="${state}" ${extra}>${inner}</span>`

describe("Skeleton stylesheet", () => {
  it("an empty loading Item is a filled block line", () => {
    sheet()
    const el = q(mount(`<div style="width:200px">${item("loading")}</div>`), "span")
    const s = getComputedStyle(el)
    expect(s.display).toBe("block")
    expect(el.getBoundingClientRect().width).toBe(200)
    expect(el.getBoundingClientRect().height).toBeGreaterThan(0)
    expect(s.backgroundColor).not.toBe("rgba(0, 0, 0, 0)")
  })

  it("dark scheme reads the dark fill (mui/material-ui#19429)", () => {
    sheet()
    const light = q(mount(`<div style="color-scheme:light">${item("loading")}</div>`), "span")
    const dark = q(mount(`<div style="color-scheme:dark">${item("loading")}</div>`), "span")
    expect(getComputedStyle(dark).backgroundColor).not.toBe(getComputedStyle(light).backgroundColor)
  })

  it("wrapped text keeps its size, is not drawn, and is drawn again when loaded", () => {
    sheet()
    const host = mount(
      `<p style="width:120px">${item("loading", "Stale text that wraps over lines")}</p><p style="width:120px">${item("loaded", "Stale text that wraps over lines", "")}</p>`,
    )
    const [loading, loaded] = [...host.querySelectorAll("span")] as HTMLElement[]
    if (!loading || !loaded) throw new Error("items missing")
    expect(getComputedStyle(loading).color).toBe("rgba(0, 0, 0, 0)")
    expect(loading.getClientRects().length).toBeGreaterThan(1)
    expect(loading.getBoundingClientRect().height).toBe(loaded.getBoundingClientRect().height)
    expect(getComputedStyle(loaded).color).not.toBe("rgba(0, 0, 0, 0)")
    expect(getComputedStyle(loaded).backgroundColor).toBe("rgba(0, 0, 0, 0)")
  })

  it("hides wrapped elements without removing their box", () => {
    sheet()
    const host = mount(item("loading", '<button style="width:80px">Reply</button>'))
    const button = q(host, "button")
    expect(getComputedStyle(button).visibility).toBe("hidden")
    expect(button.getBoundingClientRect().width).toBe(80)
  })

  it("shimmers only while loading and animating", () => {
    sheet()
    const host = mount(`${item("loading")}${item("loading", "", "")}${item("loaded")}`)
    const [animated, still, loaded] = [...host.querySelectorAll("span")] as HTMLElement[]
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches
    expect(animated?.getAnimations().length).toBe(reduce ? 0 : 1)
    expect(still?.getAnimations()).toEqual([])
    expect(loaded?.getAnimations()).toEqual([])
  })

  it("reads --rind-skeleton-* tokens", () => {
    sheet()
    const el = q(
      mount(
        `<div style="--rind-skeleton-radius:9999px;--rind-skeleton-line-height:20px">${item("loading")}</div>`,
      ),
      "span",
    )
    expect(getComputedStyle(el).borderTopLeftRadius).toBe("9999px")
    expect(el.getBoundingClientRect().height).toBe(20)
  })

  it("has forced-colors and reduced-motion rules, ≥ 1.5 s, no variant/size/tone", () => {
    expect(skeleton).toMatch(/@media \(forced-colors: active\)[\s\S]*GrayText/)
    expect(skeleton).toMatch(/@media \(prefers-reduced-motion: no-preference\)[\s\S]*animation/)
    const duration = /--rind-skeleton-duration, ([\d.]+)s/.exec(skeleton)?.[1]
    expect(Number(duration)).toBeGreaterThanOrEqual(1.5)
    expect(skeleton).not.toMatch(/data-(variant|size|tone)/)
  })
})
