// Key ownership needs a DOM: a row's checkbox input is a control (arrows are the grid's).
import { describe, expect, it } from "vitest"
import { owner } from "./grid"

describe("owner of a checkbox input", () => {
  it("a row's checkbox is a control, a text input is editable", () => {
    const row = document.createElement("div")
    row.innerHTML =
      '<span data-part="item-checkbox"><input type="checkbox"></span><input type="text">'
    const [box, text] = row.querySelectorAll("input")
    expect(owner(box ?? null, row)).toBe("control")
    expect(owner(text ?? null, row)).toBe("editable")
  })
})
