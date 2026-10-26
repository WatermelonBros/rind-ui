/** @jsxImportSource solid-js */
// Angle Slider's Solid parts: one native range input named by the Label and announced in
// degrees; keys step (Shift: a large step), wrap and reach the edges; read-only changes nothing;
// a press on the dial sets the angle (real layout only); a form reset restores the default.
import axe from "axe-core"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { AngleSlider } from "./index"

/** Lets mount effects run (microtasks, no elapsed time). */
const settle = async () => {
  for (let i = 0; i < 3; i++) await Promise.resolve()
}
/** A press needs layout: jsdom has no boxes. */
const jsdom = typeof navigator !== "undefined" && navigator.userAgent.includes("jsdom")

function setup(p: { readOnly?: boolean; defaultValue?: number } = {}) {
  const commits: number[] = []
  const m = mount(() => (
    <form>
      <AngleSlider.Root
        name="heading"
        defaultValue={p.defaultValue ?? 0}
        readOnly={p.readOnly}
        onValueCommit={(v) => commits.push(v)}
      >
        <AngleSlider.Label>Heading</AngleSlider.Label>
        <AngleSlider.Control style={{ width: "100px", height: "100px" }}>
          <AngleSlider.Thumb />
          <AngleSlider.MarkerGroup>
            <AngleSlider.Marker value={0} />
            <AngleSlider.Marker value={90} />
          </AngleSlider.MarkerGroup>
        </AngleSlider.Control>
        <AngleSlider.Input />
        <AngleSlider.Value />
      </AngleSlider.Root>
    </form>
  ))
  const q = (sel: string) => m.host.querySelector(sel) as HTMLElement
  const input = () => q('[data-part="input"]') as HTMLInputElement
  const key = (k: string, init: KeyboardEventInit = {}) =>
    input().dispatchEvent(
      new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...init }),
    )
  return { ...m, commits, q, input, key }
}

describe("Solid AngleSlider", () => {
  it("is one range input named by the Label, announced in degrees", async () => {
    const t = setup({ defaultValue: 90 })
    await settle()
    const input = t.input()
    expect(input.type).toBe("range")
    expect(input.max).toBe("359")
    expect(input.getAttribute("aria-labelledby")).toBe(t.q('[data-part="label"]').id)
    expect(input.getAttribute("aria-valuetext")).toBe("90 degrees")
    // Not aria-hidden: the Input may render inside the Thumb.
    expect(t.q('[data-part="thumb"]').hasAttribute("aria-hidden")).toBe(false)
    expect(t.q('[data-part="value"]').textContent).toBe("90°")
    expect(t.q('[data-part="root"]').style.getPropertyValue("--rind-angle-slider-angle")).toBe(
      "90deg",
    )
    expect(t.q('[data-part="marker"][data-value="0"]').dataset["state"]).toBe("under-value")
    const { violations } = await axe.run(t.host, {
      rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
    })
    expect(violations.map((v) => v.id)).toEqual([])
  })

  it("steps with arrows, a large step with Shift, wraps, and reaches the edges", async () => {
    const t = setup()
    await settle()
    t.key("ArrowRight")
    expect(t.input().value).toBe("1")
    t.key("ArrowUp", { shiftKey: true })
    expect(t.input().value).toBe("16")
    t.key("Home")
    t.key("ArrowLeft")
    expect(t.input().value).toBe("359")
    t.key("End")
    expect(t.input().getAttribute("aria-valuetext")).toBe("359 degrees")
    expect(t.commits).toEqual([1, 16, 0, 359])
  })

  it("read-only: keys change nothing", async () => {
    const t = setup({ readOnly: true, defaultValue: 45 })
    await settle()
    t.key("ArrowRight")
    expect(t.input().value).toBe("45")
    expect(t.input().getAttribute("aria-readonly")).toBe("true")
  })

  it.skipIf(jsdom)("a press on the dial sets the angle from the pointer", async () => {
    const t = setup()
    await settle()
    const control = t.q('[data-part="control"]')
    const r = control.getBoundingClientRect()
    // The right edge of the dial: 90 degrees clockwise from the top.
    const at = { clientX: r.right - 2, clientY: r.top + r.height / 2, pointerId: 1, bubbles: true }
    control.dispatchEvent(
      new PointerEvent("pointerdown", { ...at, button: 0, pointerType: "mouse" }),
    )
    control.dispatchEvent(new PointerEvent("pointerup", { ...at, pointerType: "mouse" }))
    await settle()
    expect(Number(t.input().value)).toBeGreaterThanOrEqual(89)
    expect(Number(t.input().value)).toBeLessThanOrEqual(91)
    expect(document.activeElement).toBe(t.input())
  })

  it("a form reset restores the default", async () => {
    const t = setup({ defaultValue: 30 })
    await settle()
    t.key("ArrowRight")
    expect(t.input().value).toBe("31")
    ;(t.host.querySelector("form") as HTMLFormElement).reset()
    await vi.waitFor(() => expect(t.input().value).toBe("30"))
    expect(t.input().getAttribute("aria-valuetext")).toBe("30 degrees")
    // The Value keeps its bound text through the reset (an <output> lost it in WebKit).
    expect(t.q('[data-part="value"]').textContent?.trim()).toBe("30°")
  })
})
