// add-clipboard 6.2: the Clipboard stylesheet alone, on the markup core renders: the Indicator's
// icon shape per state (copy, check, x), a standalone Trigger of at least 24 px, the success and
// danger tones, the forced-colors and reduced-motion rules.
import { afterEach, describe, expect, it } from "vitest"
import clipboard from "./clipboard.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${files.variants}\n${files.icons}\n${clipboard}`,
  )

const attrs = (part: string, state: string) =>
  `data-scope="clipboard" data-part="${part}" data-instance="c" data-state="${state}"`

const bare = (state: string) => `<div ${attrs("root", state)}>
  <button type="button" aria-label="Copy" ${attrs("trigger", state)}><span aria-hidden="true" ${attrs("indicator", state)}></span></button>
</div>`

const field = (state: string) => `<div ${attrs("root", state)}>
  <label ${attrs("label", state)}>API key</label>
  <div ${attrs("control", state)}>
    <input readonly value="sk-123" ${attrs("input", state)}>
    <button type="button" aria-label="Copy" ${attrs("trigger", state)}><span aria-hidden="true" ${attrs("indicator", state)}></span></button>
  </div>
</div>`

const icon = (host: HTMLElement) =>
  getComputedStyle(q(host, '[data-part="indicator"]'), "::before").maskImage

describe("Clipboard stylesheet", () => {
  it("the icon's shape changes per state: copy, check, copy, x", () => {
    const shapes = ["idle", "copied", "idle", "error"].map((state) => {
      sheet()
      const host = mount(bare(state))
      const mask = icon(host)
      cleanup()
      return mask
    })
    for (const m of shapes) expect(m).toContain("data:image/svg+xml")
    expect(shapes[0]).toBe(shapes[2])
    expect(new Set([shapes[0], shapes[1], shapes[3]]).size).toBe(3)
  })

  it("a standalone Trigger is at least 24 x 24 px", () => {
    sheet()
    const box = q(mount(bare("idle")), '[data-part="trigger"]').getBoundingClientRect()
    expect(box.width).toBeGreaterThanOrEqual(24)
    expect(box.height).toBeGreaterThanOrEqual(24)
  })

  it("copied and error take different tones from idle", () => {
    const colors = ["idle", "copied", "error"].map((state) => {
      sheet()
      const c = getComputedStyle(q(mount(field(state)), '[data-part="trigger"]')).color
      cleanup()
      return c
    })
    expect(new Set(colors).size).toBe(3)
  })

  it("the Input fills the Control; the Trigger sits inside it", () => {
    sheet()
    const host = mount(`<div style="inline-size: 320px">${field("idle")}</div>`)
    const control = q(host, '[data-part="control"]').getBoundingClientRect()
    const trigger = q(host, '[data-part="trigger"]').getBoundingClientRect()
    const input = q(host, '[data-part="input"]').getBoundingClientRect()
    expect(trigger.right).toBeLessThanOrEqual(control.right)
    expect(input.width).toBeGreaterThan(control.width / 2)
    expect(input.height).toBeGreaterThanOrEqual(24)
  })

  it("forced colors paint the icon with a system colour; reduced motion drops transitions", () => {
    expect(clipboard).toMatch(/@media \(forced-colors: active\)[\s\S]*ButtonText/)
    expect(clipboard).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*transition: none/)
  })
})
