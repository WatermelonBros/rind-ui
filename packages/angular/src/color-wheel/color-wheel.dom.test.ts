// Color Wheel's Angular parts: one range input of the hue named by the Label; keys change the hue
// and keep the other channels; read-only changes nothing; only a press on the ring sets the hue
// (real layout); the hidden input submits the hex and a form reset restores the default.
import { Component } from "@angular/core"
import { formatColor } from "@rind-ui/core"
import axe from "axe-core"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { ColorWheel } from "./index"

/** A press needs layout: jsdom has no boxes. */
const jsdom = typeof navigator !== "undefined" && navigator.userAgent.includes("jsdom")

/** The fixture's configuration, for the next mount. */
let current = { readOnly: false, committed: (_v: string) => {} }

@Component({
  selector: "rind-f",
  imports: [ColorWheel],
  template: `<form>
    <div
      rindColorWheelRoot
      name="accent"
      defaultValue="hsl(120 80% 40%)"
      [readonly]="cfg.readOnly"
      (valueCommit)="cfg.committed(hsl($event.value))"
    >
      <label rindColorWheelLabel>Accent hue</label>
      <div rindColorWheelTrack style="width: 100px; height: 100px">
        <div rindColorWheelThumb><input rindColorWheelInput /></div>
      </div>
      <span rindColorWheelValue></span>
    </div>
  </form>`,
})
class Tree {
  readonly cfg = current
  readonly hsl = (c: Parameters<typeof formatColor>[0]) => formatColor(c, "hsl")
}

async function setup(p: { readOnly?: boolean } = {}) {
  const commits: string[] = []
  current = { readOnly: p.readOnly ?? false, committed: (v) => commits.push(v) }
  const m = await mount(Tree)
  const stable = () => m.rerender({})
  const q = (sel: string) => m.host.querySelector(sel) as HTMLElement
  const input = () => q('[data-part="input"]') as HTMLInputElement
  const hidden = () => (q('[data-part="hidden-input"]') as HTMLInputElement).value
  const key = async (k: string, init: KeyboardEventInit = {}) => {
    input().dispatchEvent(
      new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...init }),
    )
    await stable()
  }
  return { ...m, commits, stable, q, input, hidden, key }
}

describe("Angular ColorWheel", () => {
  it("is one range input of the hue in a group, named by the Label", async () => {
    const t = await setup()
    const input = t.input()
    expect(input.type).toBe("range")
    expect(input.value).toBe("120")
    expect(input.hasAttribute("name")).toBe(false)
    expect(input.getAttribute("aria-labelledby")).toBe(t.q('[data-part="label"]').id)
    expect(input.getAttribute("aria-valuetext")).toContain("120")
    expect(t.q('[data-part="root"]').getAttribute("role")).toBe("group")
    expect(t.q('[data-part="value"]').textContent?.trim()).toBe("120°")
    expect(t.hidden()).toMatch(/^#[0-9a-f]{6}$/i)
    expect((t.q('[data-part="hidden-input"]') as HTMLInputElement).name).toBe("accent")
    const { violations } = await axe.run(t.host, {
      rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
    })
    expect(violations.map((v) => v.id)).toEqual([])
  })

  it("keys change the hue and keep saturation and lightness; the hue wraps", async () => {
    const t = await setup()
    await t.key("ArrowRight")
    expect(t.input().value).toBe("121")
    await t.key("Home")
    await t.key("ArrowLeft")
    expect(t.input().value).toBe("359")
    expect(t.commits.at(-1)).toBe("hsl(359, 80%, 40%)")
  })

  it("read-only: keys change nothing", async () => {
    const t = await setup({ readOnly: true })
    await t.key("ArrowRight")
    expect(t.input().value).toBe("120")
    expect(t.commits).toEqual([])
  })

  it.skipIf(jsdom)("only a press on the ring sets the hue", async () => {
    const t = await setup()
    const track = t.q('[data-part="track"]')
    const r = track.getBoundingClientRect()
    const down = async (x: number, y: number) => {
      const at = { clientX: x, clientY: y, pointerId: 1, bubbles: true }
      track.dispatchEvent(
        new PointerEvent("pointerdown", { ...at, button: 0, pointerType: "mouse" }),
      )
      track.dispatchEvent(new PointerEvent("pointerup", { ...at, pointerType: "mouse" }))
      await t.stable()
    }
    // The centre is the hole: nothing changes.
    await down(r.left + r.width / 2, r.top + r.height / 2)
    expect(t.input().value).toBe("120")
    // The ring's right edge: 90 degrees clockwise from the top.
    await down(r.right - 2, r.top + r.height / 2)
    expect(Number(t.input().value)).toBeGreaterThanOrEqual(89)
    expect(Number(t.input().value)).toBeLessThanOrEqual(91)
    expect(document.activeElement).toBe(t.input())
  })

  it("a form reset restores the default colour", async () => {
    const t = await setup()
    const initial = t.hidden()
    await t.key("ArrowRight", { shiftKey: true })
    expect(t.hidden()).not.toBe(initial)
    ;(t.host.querySelector("form") as HTMLFormElement).reset()
    await vi.waitFor(async () => {
      await t.stable()
      expect(t.hidden()).toBe(initial)
      expect(t.q('[data-part="value"]').textContent?.trim()).toBe("120°")
    })
    expect(t.input().value).toBe("120")
  })
})
