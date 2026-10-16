// add-dialog 6.2: the Dialog stylesheet on top of overlay.css and positioner.css: a fixed
// backdrop, a centred scrolling positioner, a bordered rounded surface, tokens, nested toning,
// reduced motion and the forced-colors mapping.
import { afterEach, describe, expect, it } from "vitest"
import dialog from "./dialog.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${files.overlay}\n${files.positioner}\n${dialog}`,
  )

const markup = (attrs = "", contentAttrs = "") =>
  `<div data-scope="dialog" data-part="backdrop" data-state="open" aria-hidden="true" ${attrs}></div><div data-scope="dialog" data-part="positioner" data-state="open"><div role="dialog" aria-label="D" data-scope="dialog" data-part="content" data-state="open" ${contentAttrs}><button data-scope="dialog" data-part="close-trigger" aria-label="Close"></button>Body</div></div>`

describe("Dialog stylesheet", () => {
  it("the backdrop is fixed over the viewport", () => {
    sheet()
    const s = getComputedStyle(q(mount(markup()), '[data-part="backdrop"]'))
    expect(s.position).toBe("fixed")
    expect(s.top).toBe("0px")
    expect(s.left).toBe("0px")
  })

  it("the positioner is a fixed, centring, scrollable grid", () => {
    sheet()
    const s = getComputedStyle(q(mount(markup()), '[data-part="positioner"]'))
    expect(s.position).toBe("fixed")
    expect(s.display).toBe("grid")
    expect(s.placeItems).toMatch(/center/)
    expect(s.overflowY).toBe("auto")
    expect(s.overscrollBehaviorY).toBe("contain")
  })

  it("the content has a border and a radius, and is centred", () => {
    sheet()
    const host = mount(markup())
    const c = q(host, '[data-part="content"]')
    const s = getComputedStyle(c)
    expect(Number.parseFloat(s.borderTopWidth)).toBeGreaterThan(0)
    expect(Number.parseFloat(s.borderTopLeftRadius)).toBeGreaterThan(0)
    expect(Math.abs(c.offsetLeft + c.offsetWidth / 2 - innerWidth / 2)).toBeLessThan(10)
  })

  it("the close trigger is at least 24x24", () => {
    sheet()
    // Layout size: getBoundingClientRect would include the entry transform mid-transition.
    const b = q(mount(markup()), '[data-part="close-trigger"]')
    expect(b.offsetWidth).toBeGreaterThanOrEqual(24)
    expect(b.offsetHeight).toBeGreaterThanOrEqual(24)
  })

  it("reads the --rind-dialog-* tokens", () => {
    sheet()
    const host = mount(
      `<div style="--rind-dialog-bg:rgb(1, 2, 3);--rind-dialog-radius:7px;--rind-dialog-padding:11px;--rind-dialog-max-width:300px">${markup()}</div>`,
    )
    const c = getComputedStyle(q(host, '[data-part="content"]'))
    expect(c.backgroundColor).toBe("rgb(1, 2, 3)")
    expect(c.borderTopLeftRadius).toBe("7px")
    expect(c.paddingTop).toBe("11px")
    expect(c.maxWidth).toBe("300px")
  })

  it("a nested backdrop is toned by its own token", () => {
    sheet()
    const host = mount(
      `<div style="--rind-dialog-nested-backdrop:rgb(4, 5, 6)">${markup("data-nested")}</div>`,
    )
    expect(getComputedStyle(q(host, '[data-part="backdrop"]')).backgroundColor).toBe("rgb(4, 5, 6)")
  })

  it("has a forced-colors rule and a reduced-motion rule (no transition)", () => {
    expect(dialog).toMatch(/@media \(forced-colors: active\)[\s\S]*border-color: CanvasText/)
    expect(dialog).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*transition: none/)
    expect(dialog).not.toMatch(/data-(variant|size|tone)/)
  })
})
