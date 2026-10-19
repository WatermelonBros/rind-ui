// add-rating: the Rating stylesheet alone, on the markup core renders: star sizes per data-size
// (each at least 24 px), an outline that is always drawn, the fill by data-state (half from
// the reading start, mirrored in RTL), the preview tone, and the forced-colors rules.
import { afterEach, describe, expect, it } from "vitest"
import rating from "./rating.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${files.variants}\n${rating}`,
  )

const attrs = (part: string, extra = "") =>
  `data-scope="rating" data-part="${part}" data-instance="r" ${extra}`

const markup = (rootAttrs = "", value = 2.5) => `<div ${attrs("root", rootAttrs)}>
  <label ${attrs("label")}>Score</label>
  <div ${attrs("control")} style="position:relative;display:inline-flex">
    ${[1, 2, 3, 4, 5]
      .map((i) => {
        const state = value >= i ? "full" : value >= i - 0.5 ? "half" : "empty"
        return `<span ${attrs("item", `data-index="${i}" data-state="${state}" aria-hidden="true"`)}></span>`
      })
      .join("")}
    <input type="range" aria-label="Score" style="position:absolute;opacity:0;pointer-events:none">
  </div>
</div>`

const star = (host: HTMLElement, i: number) => q(host, `[data-part="item"][data-index="${i}"]`)
const fill = (el: Element) => getComputedStyle(el, "::after")

describe("Rating stylesheet", () => {
  it("every star is a 24 px target at every size, and sizes grow", () => {
    const widths = ["sm", "", "lg"].map((s) => {
      sheet()
      const host = mount(markup(s ? `data-size="${s}"` : ""))
      const w = star(host, 1).getBoundingClientRect().width
      cleanup()
      return w
    })
    for (const w of widths) expect(w).toBeGreaterThanOrEqual(24)
    expect(widths[0]).toBeLessThan(widths[1] ?? 0)
    expect(widths[1]).toBeLessThan(widths[2] ?? 0)
  })

  it("the outline is drawn on every star; the fill only on full and half ones", () => {
    sheet()
    const host = mount(markup())
    for (const i of [1, 3, 5]) {
      expect(getComputedStyle(star(host, i), "::before").clipPath).toContain("polygon")
    }
    expect(fill(star(host, 1)).backgroundColor).not.toBe("rgba(0, 0, 0, 0)")
    expect(fill(star(host, 3)).backgroundImage).toContain("linear-gradient")
    expect(fill(star(host, 5)).backgroundColor).toBe("rgba(0, 0, 0, 0)")
    expect(fill(star(host, 5)).backgroundImage).toBe("none")
  })

  it("a half star fills from the reading start (mirrored in RTL)", () => {
    sheet()
    const ltr = fill(star(mount(markup()), 3)).backgroundImage
    cleanup()
    sheet()
    const rtl = fill(star(mount(markup('dir="rtl"')), 3)).backgroundImage
    expect(ltr).not.toBe(rtl)
  })

  it("the preview has its own tone", () => {
    sheet()
    const host = mount(markup())
    const plain = fill(star(host, 1)).backgroundColor
    star(host, 1).setAttribute("data-previewed", "")
    expect(fill(star(host, 1)).backgroundColor).not.toBe(plain)
  })

  it("forced colors, logical direction, duration tokens, no [hidden] rule", () => {
    const css = rating.replace(/\/\*[\s\S]*?\*\//g, "")
    expect(css).toMatch(/@media \(forced-colors: active\)[\s\S]*CanvasText[\s\S]*Highlight/)
    expect(css).toMatch(/forced-color-adjust: none/)
    expect(css).toMatch(/--rind-duration-fast/)
    expect(css).not.toMatch(/\[hidden\]/)
    expect(css).not.toMatch(/(^|[\s;{])(left|right):/)
  })
})
