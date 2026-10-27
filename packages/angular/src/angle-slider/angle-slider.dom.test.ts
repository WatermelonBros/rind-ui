// Angle Slider's Angular parts: one native range input named by the Label and announced in
// degrees; keys step (Shift: a large step), wrap and reach the edges; read-only changes nothing;
// a press on the dial sets the angle (real layout only); a form reset restores the default.
import { Component } from "@angular/core"
import axe from "axe-core"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { AngleSlider } from "./angle-slider"

/** A press needs layout: jsdom has no boxes. */
const jsdom = typeof navigator !== "undefined" && navigator.userAgent.includes("jsdom")

/** The fixture's configuration, for the next mount. */
let current: { readOnly: boolean; defaultValue: number; committed: (v: number) => void } = {
  readOnly: false,
  defaultValue: 0,
  committed: () => {},
}

@Component({
  selector: "rind-f",
  imports: [AngleSlider],
  template: `<form>
    <div
      rindAngleSliderRoot
      name="heading"
      [defaultValue]="cfg.defaultValue"
      [readonly]="cfg.readOnly"
      (valueCommit)="cfg.committed($event.value)"
    >
      <label rindAngleSliderLabel>Heading</label>
      <div rindAngleSliderControl style="width: 100px; height: 100px">
        <div rindAngleSliderThumb></div>
        <div rindAngleSliderMarkerGroup>
          <div rindAngleSliderMarker value="0"></div>
          <div rindAngleSliderMarker value="90"></div>
        </div>
      </div>
      <input rindAngleSliderInput />
      <span rindAngleSliderValue></span>
    </div>
  </form>`,
})
class Tree {
  readonly cfg = current
}

async function setup(p: { readOnly?: boolean; defaultValue?: number } = {}) {
  const commits: number[] = []
  current = {
    readOnly: p.readOnly ?? false,
    defaultValue: p.defaultValue ?? 0,
    committed: (v) => commits.push(v),
  }
  const m = await mount(Tree)
  const stable = () => m.rerender({})
  const q = (sel: string) => m.host.querySelector(sel) as HTMLElement
  const input = () => q('[data-part="input"]') as HTMLInputElement
  const key = async (k: string, init: KeyboardEventInit = {}) => {
    input().dispatchEvent(
      new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...init }),
    )
    await stable()
  }
  return { ...m, commits, stable, q, input, key }
}

describe("Angular AngleSlider", () => {
  it("is one range input named by the Label, announced in degrees", async () => {
    const t = await setup({ defaultValue: 90 })
    const input = t.input()
    expect(input.type).toBe("range")
    expect(input.max).toBe("359")
    expect(input.getAttribute("aria-labelledby")).toBe(t.q('[data-part="label"]').id)
    expect(input.getAttribute("aria-valuetext")).toBe("90 degrees")
    // Not aria-hidden: the Input may render inside the Thumb.
    expect(t.q('[data-part="thumb"]').hasAttribute("aria-hidden")).toBe(false)
    expect(t.q('[data-part="value"]').textContent?.trim()).toBe("90°")
    expect(t.q('[data-part="marker"][data-value="0"]').dataset["state"]).toBe("under-value")
    const { violations } = await axe.run(t.host, {
      rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
    })
    expect(violations.map((v) => v.id)).toEqual([])
  })

  it("steps with arrows, a large step with Shift, wraps, and reaches the edges", async () => {
    const t = await setup()
    await t.key("ArrowRight")
    expect(t.input().value).toBe("1")
    await t.key("ArrowUp", { shiftKey: true })
    expect(t.input().value).toBe("16")
    await t.key("Home")
    await t.key("ArrowLeft")
    expect(t.input().value).toBe("359")
    await t.key("End")
    expect(t.input().getAttribute("aria-valuetext")).toBe("359 degrees")
    expect(t.commits).toEqual([1, 16, 0, 359])
  })

  it("read-only: keys change nothing", async () => {
    const t = await setup({ readOnly: true, defaultValue: 45 })
    await t.key("ArrowRight")
    expect(t.input().value).toBe("45")
    expect(t.input().getAttribute("aria-readonly")).toBe("true")
  })

  it.skipIf(jsdom)("a press on the dial sets the angle from the pointer", async () => {
    const t = await setup()
    const control = t.q('[data-part="control"]')
    const r = control.getBoundingClientRect()
    const at = { clientX: r.right - 2, clientY: r.top + r.height / 2, pointerId: 1, bubbles: true }
    control.dispatchEvent(
      new PointerEvent("pointerdown", { ...at, button: 0, pointerType: "mouse" }),
    )
    control.dispatchEvent(new PointerEvent("pointerup", { ...at, pointerType: "mouse" }))
    await t.stable()
    expect(Number(t.input().value)).toBeGreaterThanOrEqual(89)
    expect(Number(t.input().value)).toBeLessThanOrEqual(91)
    expect(document.activeElement).toBe(t.input())
  })

  it("a form reset restores the default", async () => {
    const t = await setup({ defaultValue: 30 })
    await t.key("ArrowRight")
    expect(t.input().value).toBe("31")
    ;(t.host.querySelector("form") as HTMLFormElement).reset()
    await vi.waitFor(async () => {
      await t.stable()
      expect(t.input().value).toBe("30")
    })
    expect(t.input().getAttribute("aria-valuetext")).toBe("30 degrees")
    // The Value keeps its bound text through the reset (an <output> lost it in WebKit).
    expect(t.q('[data-part="value"]').textContent?.trim()).toBe("30°")
  })
})
