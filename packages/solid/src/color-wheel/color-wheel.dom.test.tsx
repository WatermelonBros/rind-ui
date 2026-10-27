/** @jsxImportSource solid-js */
// Color Wheel's Solid parts: one range input of the hue named by the Label; keys change the hue
// and keep the other channels; read-only changes nothing; only a press on the ring sets the hue
// (real layout); the hidden input submits the hex and a form reset restores the default.
import { formatColor } from "@rind-ui/core"
import axe from "axe-core"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { ColorWheel } from "./index"

/** Lets mount effects run (microtasks, no elapsed time). */
const settle = async () => {
  for (let i = 0; i < 3; i++) await Promise.resolve()
}
/** A press needs layout: jsdom has no boxes. */
const jsdom = typeof navigator !== "undefined" && navigator.userAgent.includes("jsdom")

function setup(p: { readOnly?: boolean; defaultValue?: string } = {}) {
  const commits: string[] = []
  const m = mount(() => (
    <form>
      <ColorWheel.Root
        name="accent"
        defaultValue={p.defaultValue ?? "hsl(120 80% 40%)"}
        readOnly={p.readOnly}
        onValueCommit={(c) => commits.push(formatColor(c, "hsl"))}
      >
        <ColorWheel.Label>Accent hue</ColorWheel.Label>
        <ColorWheel.Track style={{ width: "100px", height: "100px" }}>
          <ColorWheel.Thumb>
            <ColorWheel.Input />
          </ColorWheel.Thumb>
        </ColorWheel.Track>
        <ColorWheel.Value />
      </ColorWheel.Root>
    </form>
  ))
  const q = (sel: string) => m.host.querySelector(sel) as HTMLElement
  const input = () => q('[data-part="input"]') as HTMLInputElement
  const hidden = () => (q('[data-part="hidden-input"]') as HTMLInputElement).value
  const key = (k: string, init: KeyboardEventInit = {}) =>
    input().dispatchEvent(
      new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...init }),
    )
  return { ...m, commits, q, input, hidden, key }
}

describe("Solid ColorWheel", () => {
  it("is one range input of the hue in a group, named by the Label", async () => {
    const t = setup()
    await settle()
    const input = t.input()
    expect(input.type).toBe("range")
    expect(input.value).toBe("120")
    expect(input.hasAttribute("name")).toBe(false)
    expect(input.getAttribute("aria-labelledby")).toBe(t.q('[data-part="label"]').id)
    expect(input.getAttribute("aria-valuetext")).toContain("120")
    expect(t.q('[data-part="root"]').getAttribute("role")).toBe("group")
    expect(t.q('[data-part="value"]').textContent).toBe("120°")
    expect(t.hidden()).toMatch(/^#[0-9a-f]{6}$/i)
    const { violations } = await axe.run(t.host, {
      rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
    })
    expect(violations.map((v) => v.id)).toEqual([])
  })

  it("keys change the hue and keep saturation and lightness; the hue wraps", async () => {
    const t = setup()
    await settle()
    t.key("ArrowRight")
    expect(t.input().value).toBe("121")
    t.key("Home")
    t.key("ArrowLeft")
    expect(t.input().value).toBe("359")
    expect(t.commits.at(-1)).toBe("hsl(359, 80%, 40%)")
    expect(t.q('[data-part="root"]').style.getPropertyValue("--rind-color-wheel-angle")).toBe(
      "359deg",
    )
  })

  it("read-only: keys change nothing", async () => {
    const t = setup({ readOnly: true })
    await settle()
    t.key("ArrowRight")
    expect(t.input().value).toBe("120")
    expect(t.commits).toEqual([])
  })

  it.skipIf(jsdom)("only a press on the ring sets the hue", async () => {
    const t = setup()
    await settle()
    const track = t.q('[data-part="track"]')
    const r = track.getBoundingClientRect()
    const down = (x: number, y: number) => {
      const at = { clientX: x, clientY: y, pointerId: 1, bubbles: true }
      track.dispatchEvent(
        new PointerEvent("pointerdown", { ...at, button: 0, pointerType: "mouse" }),
      )
      track.dispatchEvent(new PointerEvent("pointerup", { ...at, pointerType: "mouse" }))
    }
    // The centre is the hole: nothing changes.
    down(r.left + r.width / 2, r.top + r.height / 2)
    await settle()
    expect(t.input().value).toBe("120")
    // The ring's right edge: 90 degrees clockwise from the top.
    down(r.right - 2, r.top + r.height / 2)
    await settle()
    expect(Number(t.input().value)).toBeGreaterThanOrEqual(89)
    expect(Number(t.input().value)).toBeLessThanOrEqual(91)
    expect(document.activeElement).toBe(t.input())
  })

  it("a form reset restores the default colour", async () => {
    const t = setup()
    await settle()
    const initial = t.hidden()
    t.key("ArrowRight", { shiftKey: true })
    expect(t.hidden()).not.toBe(initial)
    ;(t.host.querySelector("form") as HTMLFormElement).reset()
    await vi.waitFor(() => expect(t.hidden()).toBe(initial))
    expect(t.input().value).toBe("120")
    expect(t.q('[data-part="value"]').textContent).toBe("120°")
  })
})
