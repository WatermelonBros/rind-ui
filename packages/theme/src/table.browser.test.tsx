// add-table 6.2: the Table stylesheet alone, on the markup core renders: native display of every
// table part at 320 px, the sticky head never hiding a focused link, the sticky first column in
// LTR and RTL, scroll shadows, a 24 px sort trigger, indicator shapes, forced colors.
import { afterEach, describe, expect, it } from "vitest"
import table from "./table.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${files.variants}\n${table}`,
  )

const a = (part: string, extra = "") => `data-scope="table" data-part="${part}" ${extra}`
const COLS = ["Plan", "Seats", "Storage", "Support", "SSO", "Audit", "API", "Price"]

const markup = (opts: { rootAttrs?: string; rows?: number; link?: boolean } = {}) => `
<div ${a("root", opts.rootAttrs ?? "")} style="inline-size: 320px; block-size: 200px">
  <table ${a("table")}>
    <caption ${a("caption")}>Plans</caption>
    <thead ${a("head")}><tr ${a("row")}>
      <th ${a("column-header", 'scope="col" data-sortable')}><button type="button" ${a("sort-trigger", 'data-direction="ascending"')}>Plan<span aria-hidden="true" ${a("sort-indicator", 'data-direction="ascending"')}></span></button></th>
      ${COLS.slice(1)
        .map(
          (c) =>
            `<th ${a("column-header", 'scope="col" data-sortable')}><button type="button" ${a("sort-trigger", 'data-direction="none"')}>${c}<span aria-hidden="true" ${a("sort-indicator", 'data-direction="none"')}></span></button></th>`,
        )
        .join("")}
    </tr></thead>
    <tbody ${a("body")}>
      ${Array.from({ length: opts.rows ?? 12 }, (_, r) => {
        const last = r === (opts.rows ?? 12) - 1
        return `<tr ${a("row")}><th ${a("row-header", 'scope="row"')}>Row ${r}</th>${COLS.slice(1)
          .map((c, i) =>
            last && opts.link && i === 0
              ? `<td ${a("cell")}><a href="#x" id="last-link">Link</a></td>`
              : `<td ${a("cell")} style="white-space: nowrap">${c} value ${r}</td>`,
          )
          .join("")}</tr>`
      }).join("")}
    </tbody>
  </table>
</div>`

describe("Table stylesheet", () => {
  it("every table part keeps its native display at 320 px; the table scrolls inside the Root", () => {
    sheet()
    const host = mount(markup())
    const display = (sel: string) => getComputedStyle(q(host, sel)).display
    expect(display("table")).toBe("table")
    expect(display("caption")).toBe("table-caption")
    expect(display("thead")).toBe("table-header-group")
    expect(display("tbody")).toBe("table-row-group")
    expect(display("tr")).toBe("table-row")
    expect(display("th")).toBe("table-cell")
    expect(display("td")).toBe("table-cell")
    const root = q(host, '[data-part="root"]')
    expect(root.scrollWidth).toBeGreaterThan(root.clientWidth)
    expect(getComputedStyle(q(host, "table")).borderCollapse).toBe("separate")
  })

  it("the sticky head never hides a focused link in the last row (react-spectrum#5621)", async () => {
    sheet()
    const host = mount(markup({ link: true }))
    const root = q(host, '[data-part="root"]') as HTMLElement
    const head = q(host, "thead") as HTMLElement
    root.style.setProperty("--rind-table-head-height", `${head.offsetHeight}px`)
    const link = q(host, "#last-link") as HTMLElement
    link.focus()
    link.scrollIntoView({ block: "nearest" })
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
    expect(getComputedStyle(q(host, "thead th")).position).toBe("sticky")
    expect(link.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      head.getBoundingClientRect().bottom - 1,
    )
  })

  it("sticky first column stays at the inline start, in LTR and RTL", () => {
    for (const dir of ["ltr", "rtl"] as const) {
      sheet()
      const host = mount(
        `<div dir="${dir}">${markup({ rootAttrs: "data-sticky-first-column" })}</div>`,
      )
      const root = q(host, '[data-part="root"]') as HTMLElement
      root.scrollLeft = dir === "rtl" ? -root.scrollWidth : root.scrollWidth
      const cell = q(host, "tbody th").getBoundingClientRect()
      const box = root.getBoundingClientRect()
      if (dir === "ltr") expect(Math.abs(cell.left - box.left)).toBeLessThan(3)
      else expect(Math.abs(cell.right - box.right)).toBeLessThan(3)
      cleanup()
    }
  })

  it("scroll shadows follow the overflow edges", () => {
    sheet()
    const host = mount(markup({ rootAttrs: "data-overflow-x-end" }))
    expect(getComputedStyle(q(host, '[data-part="root"]')).boxShadow).not.toBe("none")
    cleanup()
    sheet()
    const plain = mount(markup())
    expect(getComputedStyle(q(plain, '[data-part="root"]')).boxShadow).toBe("none")
  })

  it("the sort trigger is at least 24 px and fills its cell", () => {
    sheet()
    const host = mount(markup())
    const trigger = q(host, '[data-part="sort-trigger"]').getBoundingClientRect()
    const cell = q(host, "thead th").getBoundingClientRect()
    expect(trigger.height).toBeGreaterThanOrEqual(24)
    expect(Math.abs(trigger.width - cell.width)).toBeLessThan(2)
  })

  it("indicator shapes differ: up, down, both", () => {
    const shapes = ["ascending", "descending", "none"].map((d) => {
      sheet()
      const host = mount(
        `<span aria-hidden="true" ${a("sort-indicator", `data-direction="${d}"`)}></span>`,
      )
      const s = getComputedStyle(q(host, '[data-part="sort-indicator"]'), "::before").clipPath
      cleanup()
      return s
    })
    expect(new Set(shapes).size).toBe(3)
  })

  it("pinned cells stick at their edge; the expanded frame covers the viewport", () => {
    sheet()
    const host = mount(`
      <div ${a("frame", "data-expanded")}>
        <div ${a("header")}><button type="button" ${a("expand-trigger", "data-expanded")}></button></div>
        <div ${a("root")}><table ${a("table")}><tbody><tr ${a("row")}>
          <td ${a("cell")} data-pinned="start" style="--rind-table-pin-offset: 40px">a</td>
          <td ${a("cell")} data-pinned="end" style="--rind-table-pin-offset: 0px">b</td>
        </tr></tbody></table></div>
      </div>`)
    const start = getComputedStyle(q(host, '[data-pinned="start"]'))
    expect(start.position).toBe("sticky")
    expect(start.insetInlineStart).toBe("40px")
    expect(getComputedStyle(q(host, '[data-pinned="end"]')).insetInlineEnd).toBe("0px")
    const frame = getComputedStyle(q(host, '[data-part="frame"]'))
    expect(frame.position).toBe("fixed")
    const trigger = q(host, '[data-part="expand-trigger"]').getBoundingClientRect()
    expect(trigger.width).toBeGreaterThanOrEqual(24)
    expect(trigger.height).toBeGreaterThanOrEqual(24)
  })

  it("forced colors use system colours; logical directions only", () => {
    expect(table).toMatch(/@media \(forced-colors: active\)[\s\S]*CanvasText[\s\S]*Highlight/)
    expect(table).not.toMatch(/(margin|padding|border|inset)-(left|right)\b/)
  })
})
