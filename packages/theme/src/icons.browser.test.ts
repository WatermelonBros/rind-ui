// Icon tokens in a real browser: drawing, RTL mirroring convention, per-tenant override.
// Forced colors (`CanvasText`) cannot be emulated from Vitest browser mode: it is left to the
// Playwright task, which renders a themed Checkbox with `forcedColors: "active"`. Here only the
// shape of the contract is asserted (a mask over currentColor, nothing hard-coded).
import { afterEach, describe, expect, it } from "vitest"
import "./icons.css"
import { cleanup, files, indexCss, inject, mount as mountCss, q } from "./test-css"

// Component stylesheets do not exist yet: these rules are the CONVENTION they apply. An icon
// that means previous/next mirrors in RTL; caret-down/up and the rest never do.
const demo = document.createElement("style")
demo.textContent = `
  .icon { display: block; width: 1em; height: 1em; mask-image: var(--rind-icon-check); background-color: currentColor }
  [dir="rtl"] :is(.i-caret-left, .i-caret-right, .i-arrow-left, .i-arrow-right) { transform: scaleX(-1) }
  [data-rind-theme="t"] { --rind-icon-check: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E") }
`
document.head.append(demo)

const mount = (html: string) => {
  const host = document.createElement("div")
  host.innerHTML = html
  document.body.append(host)
  return host
}
const style = (el: Element) => getComputedStyle(el)
let hosts: Element[] = []
const add = (html: string) => {
  const host = mount(html)
  hosts.push(host)
  return host
}
afterEach(() => {
  for (const h of hosts) h.remove()
  hosts = []
})

describe("icon tokens", () => {
  it("an indicator masks the token over currentColor", () => {
    const el = add(`<span class="icon" style="color: rgb(1, 2, 3)"></span>`).firstElementChild
    expect(style(el as Element).maskImage).toMatch(/^url\("data:image\/svg\+xml,/)
    expect(style(el as Element).backgroundColor).toBe("rgb(1, 2, 3)")
  })

  it("mirrors only the previous/next icons under dir=rtl", () => {
    const names = ["caret-left", "caret-right", "arrow-left", "arrow-right", "caret-down", "check"]
    const html = names.map((n) => `<span class="icon i-${n}"></span>`).join("")
    const host = add(`<div dir="rtl">${html}</div>`)
    const ltr = add(`<div dir="ltr">${html}</div>`)
    const t = (root: Element, n: string) =>
      style(root.querySelector(`.i-${n}`) as Element).transform
    for (const n of names.slice(0, 4)) expect(t(host, n)).toBe("matrix(-1, 0, 0, 1, 0, 0)")
    for (const n of names.slice(4)) expect(t(host, n)).toBe("none")
    for (const n of names) expect(t(ltr, n)).toBe("none")
  })

  it("a per-tenant override changes the glyph inside the scope only", () => {
    const host = add(
      `<div data-rind-theme="t"><span class="icon" id="in"></span></div><span class="icon" id="out"></span>`,
    )
    const inside = style(host.querySelector("#in") as Element).maskImage
    const outside = style(host.querySelector("#out") as Element).maskImage
    expect(inside).toContain("%3Csvg")
    expect(inside).not.toBe(outside)
    expect(outside).toContain("viewBox")
  })
})

describe("icon tokens cascade", () => {
  afterEach(cleanup)
  const other = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' id='other'/%3E")`
  const mask = (el: Element) => getComputedStyle(el).maskImage

  it("a global :root override reaches an element inside a theme scope", () => {
    inject(files.icons)
    inject(`
      .icon { display: block; mask-image: var(--rind-icon-check) }
      :root { --rind-icon-check: ${other} }`)
    const host = mountCss(`<div data-rind-theme="g"><span class="icon"></span></div>`)
    expect(mask(q(host, ".icon"))).toContain("id='other'")
  })

  it("a tenant override on its own scope still wins inside it", () => {
    inject(files.icons)
    inject(`
      .icon { display: block; mask-image: var(--rind-icon-check) }
      :root { --rind-icon-check: ${other} }
      [data-rind-theme="g"] { --rind-icon-check: url("data:image/svg+xml,%3Csvg id='tenant'/%3E") }`)
    const host = mountCss(`<div data-rind-theme="g"><span class="icon"></span></div>`)
    expect(mask(q(host, ".icon"))).toContain("id='tenant'")
  })

  it("the plain import (index.css inlined) defines --rind-icon-check on :root", () => {
    inject(indexCss)
    expect(
      getComputedStyle(document.documentElement).getPropertyValue("--rind-icon-check"),
    ).toContain("data:image/svg+xml")
  })
})
