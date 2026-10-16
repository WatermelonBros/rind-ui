// add-avatar 6.1: the Avatar stylesheet alone: Image stacked over the Fallback in one grid
// cell, `hidden` still hides the Image, soft default and the outline variant, sizes, group
// overlap mirrored in RTL, and the forced-colors border (rendered captures:
// fixtures/avatar/avatar.pw.test.ts).
import { afterEach, describe, expect, it } from "vitest"
import avatar from "./avatar.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${files.variants}\n${avatar}`,
  )

const DATA =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="

const root = (attrs = "", inner = "") =>
  `<span data-scope="avatar" data-part="root" role="img" aria-label="Ada" ${attrs}>${inner}</span>`
const fallback = '<span data-scope="avatar" data-part="fallback">AL</span>'
const image = (attrs = "") =>
  `<img data-scope="avatar" data-part="image" alt="" src="${DATA}" ${attrs}>`

describe("Avatar stylesheet", () => {
  it("Image and Fallback share one cell, the Image on top", () => {
    sheet()
    const host = mount(root("", `${image()}${fallback}`))
    const img = q(host, "img").getBoundingClientRect()
    const fb = q(host, '[data-part="fallback"]').getBoundingClientRect()
    expect([img.x, img.y, img.width, img.height]).toEqual([fb.x, fb.y, fb.width, fb.height])
    expect(Number(getComputedStyle(q(host, "img")).zIndex)).toBeGreaterThan(0)
  })

  it("a hidden Image stays hidden", () => {
    sheet()
    const host = mount(root("", `${image("hidden")}${fallback}`))
    expect(getComputedStyle(q(host, "img")).display).toBe("none")
  })

  it("soft default tints the Fallback; outline draws a border instead", () => {
    sheet()
    const host = mount(`${root("", fallback)}${root('data-variant="outline"', fallback)}`)
    const [soft, outline] = [...host.querySelectorAll('[data-part="fallback"]')].map((e) =>
      getComputedStyle(e),
    )
    expect(soft?.backgroundColor).not.toBe("rgba(0, 0, 0, 0)")
    expect(outline?.backgroundColor).toBe("rgba(0, 0, 0, 0)")
    expect(outline?.borderTopColor).not.toBe("rgba(0, 0, 0, 0)")
  })

  it("sizes grow from sm to lg, and initials scale with the avatar", () => {
    sheet()
    const host = mount(["sm", "md", "lg"].map((s) => root(`data-size="${s}"`, fallback)).join(""))
    const roots = [...host.querySelectorAll('[data-part="root"]')] as HTMLElement[]
    const widths = roots.map((r) => r.getBoundingClientRect().width)
    expect(widths[0]).toBeLessThan(widths[1] ?? 0)
    expect(widths[1]).toBeLessThan(widths[2] ?? 0)
    const fonts = roots.map((r) => Number.parseFloat(getComputedStyle(r).fontSize))
    expect(fonts[0]).toBeLessThan(fonts[2] ?? 0)
  })

  it("reads --rind-avatar-size", () => {
    sheet()
    const host = mount(root('style="--rind-avatar-size:64px"', fallback))
    expect(q(host, '[data-part="root"]').getBoundingClientRect().width).toBe(64)
  })

  it("group overlap mirrors in RTL: each avatar overlaps the one to its right", () => {
    sheet()
    const group = (dir: string) =>
      `<div dir="${dir}" data-scope="avatar" data-part="group" role="group" aria-label="R">${root("", fallback)}${root("", fallback)}</div>`
    const host = mount(`${group("ltr")}${group("rtl")}`)
    const [ltr, rtl] = [...host.querySelectorAll('[data-part="group"]')].map((g) =>
      [...g.querySelectorAll('[data-part="root"]')].map((r) => r.getBoundingClientRect()),
    )
    if (!ltr?.[0] || !ltr[1] || !rtl?.[0] || !rtl[1]) throw new Error("avatars missing")
    expect(ltr[1].left).toBeLessThan(ltr[0].right)
    expect(ltr[1].left).toBeGreaterThan(ltr[0].left)
    expect(rtl[1].right).toBeGreaterThan(rtl[0].left)
    expect(rtl[1].right).toBeLessThan(rtl[0].right)
  })

  it("has a forced-colors CanvasText border on the Fallback", () => {
    expect(avatar).toMatch(/@media \(forced-colors: active\)[\s\S]*fallback[\s\S]*CanvasText/)
  })
})
