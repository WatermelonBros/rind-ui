// add-stepper 4.1: the Stepper stylesheet alone: a row horizontally and a column vertically,
// a completed step drawn as a check (shape), the current one filled, steps at least 24 px.
import { afterEach, describe, expect, it } from "vitest"
import stepper from "./stepper.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${files.variants}\n${files.icons}\n${stepper}`,
  )

const STATUS = ["completed", "current", "upcoming"]
const markup = (orientation: string) => {
  const a = (part: string, i?: number) =>
    `data-scope="stepper" data-part="${part}" data-instance="s" data-orientation="${orientation}"${i === undefined ? "" : ` data-index="${i}" data-status="${STATUS[i]}"`}`
  const items = STATUS.map(
    (_, i) =>
      `<li ${a("item", i)}><button type="button" ${a("trigger", i)}><span aria-hidden="true" ${a("indicator", i)}></span><span ${a("title", i)}>Step ${i}</span></button>${i < 2 ? `<div aria-hidden="true" ${a("separator", i)}></div>` : ""}</li>`,
  ).join("")
  return `<div style="inline-size:600px" role="group" aria-label="Steps" ${a("root")}><ol ${a("list")}>${items}</ol></div>`
}

describe("Stepper stylesheet", () => {
  it("a row horizontally, a column vertically", () => {
    sheet()
    let host = mount(markup("horizontal"))
    const [h0, h1] = [0, 1].map((i) =>
      q(host, `[data-part="item"][data-index="${i}"]`).getBoundingClientRect(),
    )
    expect(h1?.left).toBeGreaterThan(h0?.left ?? 0)
    cleanup()
    sheet()
    host = mount(markup("vertical"))
    const [v0, v1] = [0, 1].map((i) =>
      q(host, `[data-part="item"][data-index="${i}"]`).getBoundingClientRect(),
    )
    expect(v1?.top).toBeGreaterThan(v0?.top ?? 0)
  })

  it("completed draws a check; current is filled; triggers are at least 24 px", () => {
    sheet()
    const host = mount(markup("horizontal"))
    const done = q(host, '[data-part="indicator"][data-status="completed"]')
    expect(getComputedStyle(done, "::before").maskImage).toContain("data:image/svg+xml")
    const current = getComputedStyle(q(host, '[data-part="indicator"][data-status="current"]'))
    const upcoming = getComputedStyle(q(host, '[data-part="indicator"][data-status="upcoming"]'))
    expect(current.backgroundColor).not.toBe(upcoming.backgroundColor)
    expect(q(host, '[data-part="trigger"]').getBoundingClientRect().height).toBeGreaterThanOrEqual(
      24,
    )
  })

  it("forced colours use system colours", () => {
    expect(stepper).toMatch(/@media \(forced-colors: active\)[\s\S]*Highlight/)
  })
})
