// add-image 6.1: the Image stylesheet alone: Img and Fallback stacked in one cell, the ratio
// and fit tokens, Root's box kept when the Img is hidden (error), `hidden` still hides the
// Img, no transition, a forced-colors border, no variant/size/tone rules (rendered captures:
// fixtures/image/image.pw.test.ts).
import { afterEach, describe, expect, it } from "vitest"
import image from "./image.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${image}`,
  )

const DATA =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="

const root = (style = "", inner = "") =>
  `<span data-scope="image" data-part="root" style="${style}">${inner}</span>`
const fallback = '<span data-scope="image" data-part="fallback" aria-hidden="true">…</span>'
const img = (attrs = "") =>
  `<img data-scope="image" data-part="img" alt="A red bicycle" src="${DATA}" ${attrs}>`

describe("Image stylesheet", () => {
  it("Img and Fallback share one cell, the Img on top", () => {
    sheet()
    const host = mount(root("--rind-image-aspect-ratio:16/9;width:320px", `${img()}${fallback}`))
    const a = q(host, "img").getBoundingClientRect()
    const b = q(host, '[data-part="fallback"]').getBoundingClientRect()
    expect([a.x, a.y, a.width, a.height]).toEqual([b.x, b.y, b.width, b.height])
    expect(Number(getComputedStyle(q(host, "img")).zIndex)).toBeGreaterThan(0)
  })

  it("the ratio token sizes Root, and an error (Img hidden) keeps the box", () => {
    sheet()
    const host = mount(
      root("--rind-image-aspect-ratio:16/9;width:320px", `${img("hidden")}${fallback}`),
    )
    const box = q(host, '[data-part="root"]').getBoundingClientRect()
    expect([box.width, box.height]).toEqual([320, 180])
    expect(getComputedStyle(q(host, "img")).display).toBe("none")
    expect(q(host, '[data-part="fallback"]').getBoundingClientRect().height).toBe(180)
  })

  it("fit defaults to cover and reads --rind-image-fit", () => {
    sheet()
    const host = mount(root("", img()))
    expect(getComputedStyle(q(host, "img")).objectFit).toBe("cover")
    const other = mount(root("--rind-image-fit:contain", img()))
    expect(getComputedStyle(q(other, "img")).objectFit).toBe("contain")
  })

  it("no fade: the Img has no transition or animation", () => {
    sheet()
    const s = getComputedStyle(q(mount(root("", img())), "img"))
    expect(s.transitionDuration).toBe("0s")
    expect(s.animationName).toBe("none")
  })

  it("forced-colors border, no [hidden] override, no variant/size/tone rules", () => {
    expect(image).toMatch(/@media \(forced-colors: active\)[\s\S]*CanvasText/)
    expect(image).not.toMatch(/\[hidden\]/)
    expect(image).not.toMatch(/data-(variant|size|tone)/)
  })
})
