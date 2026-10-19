// add-image-cropper 4.1: the Image Cropper stylesheet alone: the outside of the crop is
// dimmed, the circle shape, handles visible inside their 24 px hit areas, the focus ring.
import { afterEach, describe, expect, it } from "vitest"
import cropper from "./image-cropper.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${files.variants}\n${cropper}`,
  )

const a = (part: string, extra = "") =>
  `data-scope="image-cropper" data-part="${part}" data-instance="c" ${extra}`
const markup = (shape = "rectangle", focus = "") => `<div ${a("root")}>
  <div style="position:relative;overflow:hidden;width:400px;height:200px" ${a("viewport")}>
    <div role="slider" tabindex="0" aria-label="Crop area" style="position:absolute;left:100px;top:50px;width:100px;height:100px" ${a("selection", `data-shape="${shape}" ${focus}`)}>
      <div aria-hidden="true" style="position:absolute;left:100%;top:100%;width:24px;height:24px;transform:translate(-50%,-50%)" ${a("handle", 'data-position="se"')}></div>
    </div>
  </div>
</div>`

describe("Image Cropper stylesheet", () => {
  it("dims outside the crop; circle shape rounds it", () => {
    sheet()
    let sel = q(mount(markup()), '[data-part="selection"]')
    expect(getComputedStyle(sel).boxShadow).toContain("0px 0px 0px")
    cleanup()
    sheet()
    sel = q(mount(markup("circle")), '[data-part="selection"]')
    expect(getComputedStyle(sel).borderTopLeftRadius).toBe("50%")
  })

  it("a handle draws a visible square inside its 24 px hit area", () => {
    sheet()
    const handle = q(mount(markup()), '[data-part="handle"]')
    expect(handle.getBoundingClientRect().width).toBeGreaterThanOrEqual(24)
    const dot = getComputedStyle(handle, "::before")
    expect(dot.content).toBe('""')
  })

  it("keyboard focus shows a ring; forced colours use system colours", () => {
    sheet()
    const sel = q(mount(markup("rectangle", "data-focus-visible")), '[data-part="selection"]')
    expect(getComputedStyle(sel).outlineStyle).toBe("solid")
    expect(cropper).toMatch(/@media \(forced-colors: active\)[\s\S]*Highlight/)
  })
})
