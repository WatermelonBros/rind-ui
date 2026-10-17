// add-qr-code 7.1: the QR Code stylesheet alone: black modules on a white ground in both
// colour schemes (scanners need dark on light), a default size, the overlay sized from its
// token, and the forced-colors rule with `forced-color-adjust: none` on the frame only (the
// rendered forced-colors check is in qr-code.pw.test.ts).
import { afterEach, describe, expect, it } from "vitest"
import qr from "./qr-code.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${qr}`,
  )

const symbol = (scheme: string, state = "ready") =>
  // The inline layout connect writes: a one-column grid, frame and overlay in cell 1 / 1.
  `<div style="color-scheme:${scheme};display:inline-grid" data-scope="qr-code" data-part="root" data-state="${state}"><svg style="grid-area:1 / 1" data-scope="qr-code" data-part="frame" data-state="${state}" viewBox="0 0 29 29"><path data-scope="qr-code" data-part="pattern" d="M4 4h7v1H4z"/></svg><div style="grid-area:1 / 1;place-self:center" data-scope="qr-code" data-part="overlay"></div></div>`

describe("QR Code stylesheet", () => {
  it.each(["light", "dark"])("dark on light in the %s scheme", (scheme) => {
    sheet()
    const host = mount(symbol(scheme))
    expect(getComputedStyle(q(host, '[data-part="frame"]')).backgroundColor).toMatch(
      /^(rgb\(255, 255, 255\)|oklch\(1 0 0\)|color\(srgb 1 1 1\))$/,
    )
    expect(getComputedStyle(q(host, '[data-part="pattern"]')).fill).toMatch(
      /^(rgb\(0, 0, 0\)|oklch\(0 0 0\)|color\(srgb 0 0 0\))$/,
    )
  })

  it("the frame has a default size and the overlay a quarter of it", () => {
    sheet()
    const host = mount(symbol("light"))
    const frame = q(host, '[data-part="frame"]').getBoundingClientRect()
    const overlay = q(host, '[data-part="overlay"]').getBoundingClientRect()
    expect(frame.width).toBeGreaterThan(100)
    expect(frame.width).toBe(frame.height)
    expect(Math.round(overlay.width)).toBe(Math.round(frame.width / 4))
  })

  it("an empty frame keeps its size", () => {
    sheet()
    const ready = q(mount(symbol("light")), '[data-part="frame"]').getBoundingClientRect()
    const empty = q(mount(symbol("light", "empty")), '[data-part="frame"]').getBoundingClientRect()
    expect(empty.width).toBe(ready.width)
  })

  it("reads --rind-qr-code-* tokens", () => {
    sheet()
    const host = mount(`<div style="--rind-qr-code-size:200px">${symbol("light")}</div>`)
    expect(q(host, '[data-part="frame"]').getBoundingClientRect().width).toBe(200)
  })

  it("the download trigger is at least the 24 px hit area", () => {
    sheet()
    const host = mount(
      `<button data-scope="qr-code" data-part="download-trigger"><svg width="12" height="12"></svg></button>`,
    )
    const box = q(host, "button").getBoundingClientRect()
    expect(box.width).toBeGreaterThanOrEqual(24)
    expect(box.height).toBeGreaterThanOrEqual(24)
  })

  it("forced colors: explicit colours and forced-color-adjust none on the frame only", () => {
    const forced = /@media \(forced-colors: active\) \{([\s\S]*)\}\s*\}\s*$/.exec(qr)?.[1] ?? ""
    expect(forced).toMatch(/data-part="frame"[\s\S]*forced-color-adjust: none/)
    const rules = qr.replace(/\/\*[\s\S]*?\*\//g, "")
    expect(rules.match(/forced-color-adjust: none/g)).toHaveLength(1)
    expect(qr).not.toMatch(/data-(variant|size|tone)/)
  })
})
