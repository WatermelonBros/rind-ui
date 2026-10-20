// add-sortable 3.1: the Sortable stylesheet alone: a list without markers, an empty handle
// draws its grip with a grab cursor, the active item is raised, the indicator is a line at
// its variable, no colour literals.
import { afterEach, describe, expect, it } from "vitest"
import sortable from "./sortable.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${sortable}`,
  )

const html = `
<ul data-scope="sortable" data-part="root" data-orientation="vertical" style="position:relative">
  <li data-scope="sortable" data-part="item" data-active><button data-scope="sortable" data-part="handle" aria-pressed="true" aria-label="Reorder A"></button>A</li>
  <li data-scope="sortable" data-part="item"><button data-scope="sortable" data-part="handle" aria-pressed="false" aria-label="Reorder B"></button>B</li>
  <li data-scope="sortable" data-part="indicator" data-orientation="vertical" aria-hidden="true" style="position:absolute;--rind-sortable-indicator:40px"></li>
</ul>`

describe("Sortable stylesheet", () => {
  it("a list without markers; a grab cursor on the handle", () => {
    sheet()
    const host = mount(html)
    expect(getComputedStyle(q(host, "ul")).listStyleType).toBe("none")
    expect(getComputedStyle(q(host, '[aria-pressed="false"]')).cursor).toBe("grab")
    expect(getComputedStyle(q(host, '[aria-pressed="false"]'), "::before").content).toBe('""')
  })

  it("the active item is raised; the indicator sits at its variable", () => {
    sheet()
    const host = mount(html)
    expect(getComputedStyle(q(host, "[data-active]")).boxShadow).not.toBe("none")
    const root = q(host, "ul").getBoundingClientRect()
    const line = q(host, '[data-part="indicator"]').getBoundingClientRect()
    expect(Math.round(line.top - root.top)).toBe(39)
    expect(Math.round(line.height)).toBe(2)
  })

  it("no colour literals", () => {
    expect(sortable).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(/i)
  })
})
