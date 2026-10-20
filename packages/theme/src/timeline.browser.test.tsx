// add-timeline 3.1: the Timeline stylesheet alone: a list without markers, statuses told apart
// by shape (filled, ringed, hollow), the last connector hidden, alternate sides mirrored, no
// colour literals.
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, files, inject, mount, q } from "./test-css"
import timeline from "./timeline.css?inline"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${timeline}`,
  )

const item = (i: number, status: string, last = false, side = "start") => `
<li data-scope="timeline" data-part="item" data-index="${i}" data-status="${status}" data-side="${side}">
  <div data-scope="timeline" data-part="indicator" data-status="${status}" aria-hidden="true"></div>
  <div data-scope="timeline" data-part="connector" data-status="${status}" aria-hidden="true" ${last ? "data-last" : ""}></div>
  <div data-scope="timeline" data-part="content" data-status="${status}"><div data-scope="timeline" data-part="title" data-status="${status}">E${i}</div></div>
</li>`

const list = (align = "start") => `
<ol data-scope="timeline" data-part="root" data-orientation="vertical" data-align="${align}">
  ${item(0, "completed")}${item(1, "current", false, "end")}${item(2, "upcoming", true)}
</ol>`

describe("Timeline stylesheet", () => {
  it("a list without markers; the last connector hidden", () => {
    sheet()
    const host = mount(list())
    expect(getComputedStyle(q(host, "ol")).listStyleType).toBe("none")
    expect(getComputedStyle(q(host, "[data-last]")).display).toBe("none")
  })

  it("statuses differ by shape, not only colour", () => {
    sheet()
    const host = mount(list())
    const dot = (s: string) =>
      getComputedStyle(q(host, `[data-part="indicator"][data-status="${s}"]`))
    expect(dot("completed").backgroundColor).not.toBe(dot("upcoming").backgroundColor)
    expect(dot("current").boxShadow).not.toBe("none")
    expect(dot("upcoming").boxShadow).toBe("none")
  })

  it("alternate: items on the end side put the content first", () => {
    sheet()
    const host = mount(list("alternate"))
    const end = getComputedStyle(q(host, '[data-side="end"]'))
    expect(end.gridTemplateAreas).toContain('"content rail opposite"')
  })

  it("no colour literals", () => {
    expect(timeline).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(/i)
  })
})
