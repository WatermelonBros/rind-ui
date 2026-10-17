// add-tour 7.1: the Tour stylesheet alone: the backdrop never takes pointer events, the
// spotlight rings the target, tokens are read, forced colors drop the scrim, reduced motion
// drops the transitions.
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, files, inject, mount, q } from "./test-css"
import tour from "./tour.css?inline"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${tour}`,
  )

describe("Tour stylesheet", () => {
  it("the backdrop dims without taking pointer events (inline from the component)", () => {
    sheet()
    const el = q(
      mount(
        `<div data-scope="tour" data-part="backdrop" data-state="open" style="position:fixed;inset:0;pointer-events:none"></div>`,
      ),
      '[data-part="backdrop"]',
    )
    const s = getComputedStyle(el)
    expect(s.pointerEvents).toBe("none")
    expect(s.backgroundColor).not.toBe("rgba(0, 0, 0, 0)")
  })

  it("the spotlight is a ring, and reads --rind-tour-ring-width", () => {
    sheet()
    const el = q(
      mount(
        `<div style="--rind-tour-ring-width:4px"><div data-scope="tour" data-part="spotlight" style="position:fixed;width:50px;height:20px"></div></div>`,
      ),
      '[data-part="spotlight"]',
    )
    expect(getComputedStyle(el).outlineWidth).toBe("4px")
    expect(getComputedStyle(el).outlineStyle).toBe("solid")
  })

  it("the card reads --rind-tour-* tokens", () => {
    sheet()
    const el = q(
      mount(
        `<div style="--rind-tour-padding:21px"><div data-scope="tour" data-part="content" data-state="open">Hi</div></div>`,
      ),
      '[data-part="content"]',
    )
    expect(getComputedStyle(el).paddingTop).toBe("21px")
  })

  it("the spotlight transitions only while a step change is marked", () => {
    sheet()
    const host = mount(`<div data-scope="tour" data-part="spotlight" style="position:fixed"></div>`)
    const el = q(host, '[data-part="spotlight"]')
    expect(getComputedStyle(el).transitionProperty).toBe("all")
    expect(getComputedStyle(el).transitionDuration).toBe("0s")
    el.setAttribute("data-step-changing", "")
    expect(getComputedStyle(el).transitionProperty).toContain("left")
  })

  it("has forced-colors and reduced-motion rules", () => {
    expect(tour).toMatch(/@media \(forced-colors: active\)[\s\S]*background: transparent/)
    expect(tour).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*transition: none/)
  })
})
