// add-badge 6.1/6.2: the Badge stylesheet: an inline pill that never stretches, grows with
// its text at zoom, keeps a border under forced colors, and reaches 4.5:1 for its text in
// every tone × variant in both presets.
import { afterEach, describe, expect, it } from "vitest"
import badge from "./badge.css?inline"
import { cleanup, files, indexCss, inject, mount, paint, q, ratio, rgba } from "./test-css"

afterEach(cleanup)

const sheet = (preset = files.calm) => inject(`${indexCss.replace(files.calm, preset)}\n${badge}`)

const b = (attrs = "", text = "3") =>
  `<span data-scope="badge" data-part="root" data-instance="i" ${attrs}>${text}</span>`

describe("Badge stylesheet", () => {
  it("is an inline pill with centred text and min inline size = block size", () => {
    sheet()
    const el = q(mount(`<p>${b()}</p>`), '[data-scope="badge"]')
    const s = getComputedStyle(el)
    expect(s.display).toBe("inline-flex")
    expect(s.justifyContent).toBe("center")
    const r = el.getBoundingClientRect()
    expect(Math.round(r.width)).toBeGreaterThanOrEqual(Math.round(r.height))
  })

  it("keeps its own width as the child of a vertical flex card (ariakit#7604)", () => {
    sheet()
    const host = mount(`<div style="display:flex;flex-direction:column;width:300px">${b()}</div>`)
    expect(q(host, '[data-scope="badge"]').getBoundingClientRect().width).toBeLessThan(100)
  })

  it("'99+' at 200 % zoom is not clipped (mui/material-ui#49441)", () => {
    sheet()
    const host = mount(`<div style="font-size:200%">${b("", "99+")}</div>`)
    const el = q(host, '[data-scope="badge"]')
    expect(el.scrollWidth).toBeLessThanOrEqual(el.clientWidth)
    expect(el.scrollHeight).toBeLessThanOrEqual(el.clientHeight)
  })

  it("sizes grow in order", () => {
    sheet()
    const host = mount(b('data-size="sm"') + b() + b('data-size="lg"'))
    const [sm, md, lg] = Array.from(host.querySelectorAll("span"), (e) =>
      Number.parseFloat(getComputedStyle(e).fontSize),
    )
    expect(sm).toBeLessThan(md ?? 0)
    expect(md).toBeLessThan(lg ?? 0)
  })

  it("reads --rind-badge-* tokens", () => {
    sheet()
    const el = q(
      mount(b('style="--rind-badge-radius:3px;--rind-badge-font-weight:400"')),
      '[data-scope="badge"]',
    )
    expect(getComputedStyle(el).borderTopLeftRadius).toBe("3px")
    expect(getComputedStyle(el).fontWeight).toBe("400")
  })

  it("has a forced-colors border rule (ariakit#7591)", () => {
    expect(badge).toMatch(/@media \(forced-colors: active\)[\s\S]*border-color: CanvasText/)
  })

  const tones = ["accent", "neutral", "danger", "warning", "success"]
  const variants = {
    soft: ["--rind-color-accent-text", "--rind-color-accent-soft"],
    solid: ["--rind-color-accent-on-solid", "--rind-color-accent-solid"],
    outline: ["--rind-color-accent-text", "--rind-color-bg"],
  } as const
  const presets = { calm: files.calm, crisp: files.crisp }
  const cases = Object.keys(presets).flatMap((preset) =>
    ["light", "dark"].flatMap((scheme) =>
      tones.flatMap((tone) =>
        Object.keys(variants).map((variant) => ({ preset, scheme, tone, variant })),
      ),
    ),
  )

  it.each(cases)("text reaches 4.5:1: $preset $scheme $tone $variant", (c) => {
    sheet(presets[c.preset as keyof typeof presets])
    const [fg, bg] = variants[c.variant as keyof typeof variants]
    const host = mount(
      `<div data-theme="${c.scheme}">${b(`data-tone="${c.tone}" data-variant="${c.variant}"`)}</div>`,
    )
    const el = q(host, '[data-scope="badge"]')
    // The stylesheet paints the badge with the pair under test.
    expect(getComputedStyle(el).color).toBe(paint(el, fg))
    expect(ratio(rgba(el, fg), rgba(el, bg))).toBeGreaterThanOrEqual(4.5)
  })
})
