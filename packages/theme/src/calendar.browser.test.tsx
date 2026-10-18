// add-calendar: the Calendar stylesheet alone: target sizes, states that are not only colour,
// tokens, invalid, rtl, forced-colors rules.
import { afterEach, describe, expect, it } from "vitest"
import calendar from "./calendar.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const a = (part: string, extra = "") => `data-scope="calendar" data-part="${part}" ${extra}`

const markup = (root = "") => `<div ${a("root", `role="group" ${root}`)}>
  <div ${a("header")}>
    <button type="button" aria-label="Previous month" ${a("prev-trigger")}></button>
    <h2 ${a("heading")}>October 2026</h2>
    <button type="button" aria-label="Next month" ${a("next-trigger")}></button>
  </div>
  <table role="grid" ${a("grid")}>
    <thead ${a("grid-header")}><tr><th ${a("header-cell")}>S</th><th ${a("header-cell")}>M</th></tr></thead>
    <tbody ${a("grid-body")}><tr ${a("row")}>
      <td ${a("cell", 'data-outside-month data-disabled id="outside"')}>30</td>
      <td ${a("cell", 'id="plain"')}>1</td>
      <td ${a("cell", 'data-today id="today"')}>2</td>
      <td ${a("cell", 'data-selected aria-selected="true" id="selected"')}>3</td>
      <td ${a("cell", 'data-unavailable id="unavailable"')}>4</td>
      <td ${a("cell", 'data-disabled id="disabled"')}>5</td>
      <td ${a("cell", 'data-selected data-invalid id="bad"')}>6</td>
    </tr></tbody>
  </table>
</div>`

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${files.variants}\n${files.icons}\n${calendar}`,
  )

const style = (host: HTMLElement, id: string) => getComputedStyle(q(host, `#${id}`))

describe("Calendar stylesheet", () => {
  it("cells and triggers are at least 24px", () => {
    sheet()
    const host = mount(markup())
    for (const s of [
      "#plain",
      "#selected",
      '[data-part="prev-trigger"]',
      '[data-part="next-trigger"]',
    ]) {
      expect(q(host, s).offsetWidth, s).toBeGreaterThanOrEqual(24)
      expect(q(host, s).offsetHeight, s).toBeGreaterThanOrEqual(24)
    }
  })

  it("selected differs from plain by more than colour", () => {
    sheet()
    const host = mount(markup())
    const [on, off] = [style(host, "selected"), style(host, "plain")]
    expect(on.backgroundColor).not.toBe(off.backgroundColor)
    expect(Number(on.fontWeight)).toBeGreaterThan(Number(off.fontWeight))
    expect(on.boxShadow).not.toBe("none")
  })

  it("today has a border, unavailable is struck through, placeholders are muted", () => {
    sheet()
    const host = mount(markup())
    expect(style(host, "today").borderTopColor).not.toBe(style(host, "plain").borderTopColor)
    expect(style(host, "unavailable").textDecorationLine).toBe("line-through")
    expect(style(host, "plain").textDecorationLine).toBe("none")
    expect(style(host, "outside").color).not.toBe(style(host, "plain").color)
    expect(style(host, "disabled").color).not.toBe(style(host, "plain").color)
  })

  it("a selected date that is invalid takes the danger colours", () => {
    sheet()
    const host = mount(markup())
    expect(style(host, "bad").backgroundColor).not.toBe(style(host, "selected").backgroundColor)
  })

  it("an invalid root doubles the border", () => {
    sheet()
    const w = (root: string) =>
      Number.parseFloat(
        getComputedStyle(q(mount(markup(root)), '[data-part="root"]')).borderTopWidth,
      )
    expect(w("data-invalid")).toBeGreaterThan(w(""))
  })

  it("reads the --rind-calendar-* tokens", () => {
    sheet()
    const host = mount(
      `<div style="--rind-calendar-bg:rgb(1, 2, 3);--rind-calendar-radius:9px;--rind-calendar-cell-size:40px">${markup()}</div>`,
    )
    const root = getComputedStyle(q(host, '[data-part="root"]'))
    expect(root.backgroundColor).toBe("rgb(1, 2, 3)")
    expect(root.borderTopLeftRadius).toBe("9px")
    expect(q(host, "#plain").offsetHeight).toBe(40)
  })

  it("data-size changes the cell size", () => {
    sheet()
    const h = (s: string) =>
      q(mount(`<div data-size="${s}">${markup()}</div>`), "#plain").offsetHeight
    expect(h("lg")).toBeGreaterThan(h("sm"))
  })

  it("rtl mirrors the paging chevrons", () => {
    sheet()
    const host = mount(markup('dir="rtl"'))
    expect(getComputedStyle(q(host, '[data-part="next-trigger"]')).scale).toBe("-1 1")
    expect(getComputedStyle(q(mount(markup()), '[data-part="next-trigger"]')).scale).toBe("none")
  })

  it("forced colors: selected, today, focus, unavailable and disabled each have a rule", () => {
    const css = calendar.replace(/\/\*[\s\S]*?\*\//g, "")
    const forced = css.slice(css.indexOf("@media (forced-colors: active)"))
    expect(forced).toMatch(/data-selected\][\s\S]*?Highlight;[\s\S]*?HighlightText/)
    expect(forced).toMatch(/data-today\]\) \{[\s\S]*?border/)
    expect(forced).toMatch(/data-focus-visible\]\) \{[\s\S]*?outline/)
    expect(forced).toMatch(/data-unavailable\]\) \{[\s\S]*?GrayText/)
    expect(forced).toMatch(/data-disabled[\s\S]*?GrayText/)
    expect(css).not.toMatch(/\[hidden\]/)
  })

  it("range: middle days are a square band with edges, the ends cap it, the preview is dashed", () => {
    sheet()
    const row = `<div ${a("root", 'role="group"')}><table role="grid" ${a("grid")}><tbody ${a("grid-body")}><tr ${a("row")}>
      <td ${a("cell", 'data-selected data-in-range data-range-start id="start"')}>10</td>
      <td ${a("cell", 'data-selected data-in-range id="middle"')}>11</td>
      <td ${a("cell", 'data-selected data-in-range data-range-end id="end"')}>12</td>
      <td ${a("cell", 'data-preview id="preview"')}>13</td>
      <td ${a("cell", 'id="plain"')}>14</td>
    </tr></tbody></table></div>`
    const host = mount(row)
    const middle = style(host, "middle")
    expect(middle.borderTopLeftRadius).toBe("0px")
    expect(middle.backgroundColor).not.toBe(style(host, "plain").backgroundColor)
    // Edges, not colour alone; the gap before it painted by the band.
    expect(middle.boxShadow).toMatch(/inset/)
    expect(style(host, "start").borderTopRightRadius).toBe("0px")
    expect(style(host, "start").borderTopLeftRadius).not.toBe("0px")
    expect(style(host, "end").borderTopLeftRadius).toBe("0px")
    expect(style(host, "preview").outlineStyle).toBe("dashed")
    expect(style(host, "preview").backgroundColor).toBe(style(host, "plain").backgroundColor)
  })

  it("month view: four long-month columns fit 320 px; the view trigger has a hit area and a ring", () => {
    sheet()
    const months = ["September", "February", "November", "December"]
      .map((m, i) => `<td ${a("cell", `id="m${i}"`)}>${m}</td>`)
      .join("")
    const host =
      mount(`<div style="inline-size:320px"><div ${a("root", 'role="group" data-view="months"')}>
      <div ${a("header")}><h2 ${a("heading")}><button type="button" ${a("view-trigger", 'data-focus-visible id="up"')}>2026</button></h2></div>
      <table role="grid" ${a("grid", 'data-view="months"')}><tbody ${a("grid-body")}><tr ${a("row")}>${months}</tr></tbody></table>
    </div></div>`)
    const grid = q(host, '[data-part="grid"]')
    expect(grid.offsetWidth).toBeLessThanOrEqual(320)
    for (const id of ["m0", "m1", "m2", "m3"]) {
      const c = q(host, `#${id}`)
      // The text fits its cell (no overflow of a short month name).
      expect(c.scrollWidth).toBeLessThanOrEqual(c.clientWidth)
      expect(c.offsetWidth).toBeGreaterThanOrEqual(40)
    }
    const up = q(host, "#up")
    expect(up.offsetHeight).toBeGreaterThanOrEqual(24)
    expect(getComputedStyle(up).outlineStyle).toBe("solid")
  })

  it("forced colors (months and years views): the range, current, unavailable and focus rules apply to period cells", () => {
    // Period cells are cells: the same forced-colors rules (no view-specific override).
    const css = calendar.replace(/\/\*[\s\S]*?\*\//g, "")
    const forced = css.slice(css.indexOf("@media (forced-colors: active)"))
    expect(forced).not.toMatch(/data-view/)
    expect(forced).toMatch(/data-in-range\][\s\S]*?Highlight;/)
    expect(forced).toMatch(/data-today\]\) \{[\s\S]*?border/)
  })

  it("forced colors: the range uses Highlight, the preview a dashed outline", () => {
    const css = calendar.replace(/\/\*[\s\S]*?\*\//g, "")
    const forced = css.slice(css.indexOf("@media (forced-colors: active)"))
    expect(forced).toMatch(/data-in-range\][\s\S]*?Highlight;/)
    expect(forced).toMatch(/data-preview\][\s\S]*?dashed/)
  })
})
