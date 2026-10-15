// add-switch 6.1: the Switch stylesheet alone: track size, thumb position, RTL mirror, states.
import { afterEach, describe, expect, it } from "vitest"
import switchCss from "./switch.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const markup = (
  state = "unchecked",
  dir = "ltr",
) => `<div dir="${dir}" data-scope="switch" data-part="root" data-state="${state}">
  <button type="button" role="switch" data-scope="switch" data-part="control" data-rind-pressable data-state="${state}"><span data-scope="switch" data-part="thumb" data-state="${state}"></span></button>
  <label data-scope="switch" data-part="label">Wi-Fi</label>
</div>`

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${switchCss}`,
  )

const parts = (html: string) => {
  const host = mount(html)
  const thumb = q(host, '[data-part="thumb"]')
  thumb.style.transition = "none" // measure the end position, not a frame of the transition
  return { control: q(host, '[data-part="control"]'), thumb }
}

/** Distance from the track's inline-start edge to the thumb's, in the reading direction. */
const offset = (control: HTMLElement, thumb: HTMLElement, rtl: boolean) => {
  const c = control.getBoundingClientRect()
  const t = thumb.getBoundingClientRect()
  return rtl ? c.right - t.right : t.left - c.left
}

describe("Switch stylesheet", () => {
  it("the track is 2.5rem x 1.5rem, at least 24px, with a border", () => {
    sheet()
    const { control } = parts(markup())
    const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
    const r = control.getBoundingClientRect()
    expect(r.width).toBeCloseTo(2.5 * rem, 0)
    expect(r.height).toBeCloseTo(1.5 * rem, 0)
    expect(r.height).toBeGreaterThanOrEqual(24)
    expect(getComputedStyle(control).borderTopStyle).toBe("solid")
  })

  it("checked moves the thumb along the inline axis and changes the fill", () => {
    sheet()
    const { control, thumb } = parts(markup())
    const bg = getComputedStyle(control).backgroundColor
    const off = offset(control, thumb, false)
    control.setAttribute("data-state", "checked")
    thumb.setAttribute("data-state", "checked")
    expect(offset(control, thumb, false)).toBeGreaterThan(off + 8)
    expect(getComputedStyle(control).backgroundColor).not.toBe(bg)
  })

  it("RTL mirrors the thumb with no extra rule", () => {
    sheet()
    for (const state of ["unchecked", "checked"]) {
      const ltr = parts(markup(state, "ltr"))
      const a = offset(ltr.control, ltr.thumb, false)
      cleanup()
      sheet()
      const rtl = parts(markup(state, "rtl"))
      expect(offset(rtl.control, rtl.thumb, true), state).toBeCloseTo(a, 0)
      const c = rtl.control.getBoundingClientRect()
      const t = rtl.thumb.getBoundingClientRect()
      expect(t.left >= c.left && t.right <= c.right, `${state} stays inside the track`).toBe(true)
      cleanup()
      sheet()
    }
  })

  it("the label is part of the target", () => {
    sheet()
    const host = mount(markup())
    expect(q(host, "label").getBoundingClientRect().height).toBeGreaterThanOrEqual(24)
  })

  it("disabled changes the cursor", () => {
    sheet()
    const { control } = parts(markup())
    const enabled = getComputedStyle(control).cursor
    control.setAttribute("data-disabled", "")
    expect(getComputedStyle(control).cursor).not.toBe(enabled)
  })

  it("has no [hidden] override, uses duration tokens and logical thumb placement", () => {
    const css = switchCss.replace(/\/\*[\s\S]*?\*\//g, "")
    expect(css).not.toMatch(/\[hidden\]/)
    expect(css).toMatch(/--rind-duration-fast/)
    expect(css).toMatch(/inset-inline-start/)
    expect(css).not.toMatch(/\b(left|right):/)
  })
})
