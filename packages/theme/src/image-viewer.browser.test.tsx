// add-image-viewer 3.1: the Image Viewer stylesheet alone: a grab cursor once zoomed,
// grabbing while dragged, drawn glyphs in empty buttons, no colour literals.
import { afterEach, describe, expect, it } from "vitest"
import viewer from "./image-viewer.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${viewer}`,
  )

const html = (attrs: string) => `
<div data-scope="image-viewer" data-part="root">
  <div data-scope="image-viewer" data-part="viewport" ${attrs} style="width:200px;height:100px"></div>
  <button data-scope="image-viewer" data-part="zoom-in" aria-label="Zoom in"></button>
</div>`

describe("Image Viewer stylesheet", () => {
  it("grab once zoomed, grabbing while dragged", () => {
    sheet()
    expect(getComputedStyle(q(mount(html("")), '[data-part="viewport"]')).cursor).toBe("auto")
    cleanup()
    sheet()
    expect(getComputedStyle(q(mount(html("data-zoomed")), '[data-part="viewport"]')).cursor).toBe(
      "grab",
    )
    cleanup()
    sheet()
    expect(
      getComputedStyle(q(mount(html("data-zoomed data-panning")), '[data-part="viewport"]')).cursor,
    ).toBe("grabbing")
  })

  it("an empty button draws its glyph", () => {
    sheet()
    const button = q(mount(html("")), '[data-part="zoom-in"]')
    expect(getComputedStyle(button, "::before").content).toBe('"+"')
  })

  it("no colour literals", () => {
    expect(viewer).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(/i)
  })
})
