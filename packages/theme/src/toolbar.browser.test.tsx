// add-toolbar 6.1: the Toolbar stylesheet alone: a gapped row, a column when vertical,
// perpendicular separators that stretch, 24x24 targets, tokens, forced-colors mapping (the
// rendered capture is in toolbar.pw.test.ts).
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, files, inject, mount, q } from "./test-css"
import toolbar from "./toolbar.css?inline"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${toolbar}`,
  )

const control = (name: string, part = "button") =>
  `<button type="button" data-scope="toolbar" data-part="${part}" data-host="toolbar" style="padding:0;border:0">${name}</button>`

const markup = (orientation: "horizontal" | "vertical", attrs = "") => {
  const sepOrientation = orientation === "horizontal" ? "vertical" : "horizontal"
  return `<div role="toolbar" aria-label="Format" data-scope="toolbar" data-part="root" data-orientation="${orientation}" ${attrs}>${control("")}<div role="separator" data-scope="toolbar" data-part="separator" data-orientation="${sepOrientation}"></div><div role="group" data-scope="toolbar" data-part="group" data-orientation="${orientation}">${control("B")}${control("I")}</div></div>`
}

describe("Toolbar stylesheet", () => {
  it("is a row with a gap, a column when vertical", () => {
    sheet()
    const row = getComputedStyle(q(mount(markup("horizontal")), '[data-part="root"]'))
    expect(row.display).toBe("flex")
    expect(row.flexDirection).toBe("row")
    expect(Number.parseFloat(row.columnGap)).toBeGreaterThan(0)
    const col = getComputedStyle(q(mount(markup("vertical")), '[data-part="root"]'))
    expect(col.flexDirection).toBe("column")
  })

  it("a vertical separator in a horizontal toolbar stretches (a border, not a background)", () => {
    sheet()
    const host = mount(markup("horizontal", 'style="align-items:flex-start;block-size:80px"'))
    const sep = q(host, '[data-part="separator"]')
    const s = getComputedStyle(sep)
    expect(Number.parseFloat(s.borderInlineStartWidth)).toBe(1)
    expect(s.backgroundColor).toBe("rgba(0, 0, 0, 0)")
    const root = q(host, '[data-part="root"]').getBoundingClientRect()
    expect(sep.getBoundingClientRect().height).toBeGreaterThan(root.height - 20)
  })

  it("a horizontal separator in a vertical toolbar is a block border", () => {
    sheet()
    const sep = q(mount(markup("vertical")), '[data-part="separator"]')
    expect(Number.parseFloat(getComputedStyle(sep).borderBlockStartWidth)).toBe(1)
    expect(Number.parseFloat(getComputedStyle(sep).borderInlineStartWidth)).toBe(0)
  })

  it("controls are at least 24x24, even when empty", () => {
    sheet()
    for (const b of mount(markup("horizontal")).querySelectorAll('[data-host="toolbar"]')) {
      const r = b.getBoundingClientRect()
      expect(r.width).toBeGreaterThanOrEqual(24)
      expect(r.height).toBeGreaterThanOrEqual(24)
    }
  })

  it("groups use their own gap token", () => {
    sheet()
    const host = mount(`<div style="--rind-toolbar-group-gap:13px">${markup("horizontal")}</div>`)
    expect(getComputedStyle(q(host, '[data-part="group"]')).columnGap).toBe("13px")
  })

  it("reads the --rind-toolbar-* container tokens", () => {
    sheet()
    const host = mount(
      `<div style="--rind-toolbar-bg:rgb(1, 2, 3);--rind-toolbar-padding:11px;--rind-toolbar-radius:7px;--rind-toolbar-gap:9px">${markup("horizontal")}</div>`,
    )
    const s = getComputedStyle(q(host, '[data-part="root"]'))
    expect(s.backgroundColor).toBe("rgb(1, 2, 3)")
    expect(s.paddingTop).toBe("11px")
    expect(s.borderTopLeftRadius).toBe("7px")
    expect(s.columnGap).toBe("9px")
  })

  it("the separator colour falls back to --rind-separator-color, then its own token wins", () => {
    sheet()
    const inherited = mount(
      `<div style="--rind-separator-color:rgb(10, 20, 30)">${markup("horizontal")}</div>`,
    )
    expect(getComputedStyle(q(inherited, '[data-part="separator"]')).color).toBe("rgb(10, 20, 30)")
    const own = mount(
      `<div style="--rind-separator-color:rgb(10, 20, 30);--rind-toolbar-separator-color:rgb(40, 50, 60)">${markup("horizontal")}</div>`,
    )
    expect(getComputedStyle(q(own, '[data-part="separator"]')).color).toBe("rgb(40, 50, 60)")
  })

  it("has a forced-colors rule and no variant, size or tone rules", () => {
    expect(toolbar).toMatch(/@media \(forced-colors: active\)[\s\S]*CanvasText/)
    expect(toolbar).not.toMatch(/data-(variant|size|tone)/)
  })
})
