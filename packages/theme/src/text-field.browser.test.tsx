// add-text-field 8.1: the Text Field stylesheet alone, boundary contrast and target size.
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, files, inject, mount, q, ratio, rgba } from "./test-css"
import textField from "./text-field.css?inline"

afterEach(cleanup)

const markup = (variant?: string) => `<div data-scope="text-field" data-part="root"${
  variant ? ` data-variant="${variant}"` : ""
}>
  <label data-scope="text-field" data-part="label">Name</label>
  <input data-scope="text-field" data-part="input" aria-label="Name" value="x">
  <button data-scope="text-field" data-part="clear-trigger" type="button" aria-label="Clear"></button></div>`

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.variants}\n${files.icons}\n${textField}`,
  )

/** Contrast of the control's border against its own background. */
function boundary(input: HTMLElement) {
  const style = getComputedStyle(input)
  const canvas = document.createElement("canvas").getContext("2d", { willReadFrequently: true })
  if (!canvas) throw new Error("no 2d canvas")
  const px = (css: string) => {
    canvas.clearRect(0, 0, 1, 1)
    canvas.fillStyle = css
    canvas.fillRect(0, 0, 1, 1)
    const [r = 0, g = 0, b = 0, a = 0] = canvas.getImageData(0, 0, 1, 1).data
    return [r, g, b, a] as const
  }
  return ratio(px(style.borderTopColor), px(style.backgroundColor))
}

describe("Text Field stylesheet", () => {
  it("outline: a 1px border at 3:1 or more against the background", () => {
    sheet()
    const input = q(mount(markup()), "input")
    expect(getComputedStyle(input).borderTopWidth).toBe("1px")
    expect(boundary(input)).toBeGreaterThanOrEqual(3)
  })

  it("soft: the accent tint as background, boundary still 3:1", () => {
    sheet()
    const host = mount(markup("soft"))
    const input = q(host, "input")
    const outline = getComputedStyle(q(mount(markup()), "input")).backgroundColor
    expect(getComputedStyle(input).backgroundColor).not.toBe(outline)
    expect(rgba(input, "--rind-color-accent-soft")[3]).toBe(255)
    expect(boundary(input)).toBeGreaterThanOrEqual(3)
  })

  it("invalid: a doubled border, not colour alone", () => {
    sheet()
    const host = mount(markup().replace('data-part="root"', 'data-part="root" data-invalid'))
    expect(getComputedStyle(q(host, "input")).borderTopWidth).toBe("2px")
  })

  it("ClearTrigger is at least 24x24", () => {
    sheet()
    const box = q(mount(markup()), "button").getBoundingClientRect()
    expect(box.width).toBeGreaterThanOrEqual(24)
    expect(box.height).toBeGreaterThanOrEqual(24)
  })

  it("CharacterCount over the limit reads the danger role", () => {
    sheet()
    const host = mount(
      '<span data-scope="text-field" data-part="character-count" data-over-limit>5/3</span>',
    )
    const count = q(host, "span")
    const danger = document.createElement("span")
    danger.style.color = "var(--rind-color-danger-text)"
    host.append(danger)
    expect(getComputedStyle(count).color).toBe(getComputedStyle(danger).color)
  })
})
