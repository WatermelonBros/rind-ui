// The Toggle machine in Node: uncontrolled and controlled pressing, cancel, mode switch.
import { describe, expect, it, vi } from "vitest"
import type { PressEvent } from "../../a11y"
import { createService } from "../../machine/service"
import { type TogglePressEvent, type ToggleProps, toggleMachine } from "./toggle.machine"

function make(over: ToggleProps = {}) {
  const onPressedChange = vi.fn()
  const props: ToggleProps = { onPressedChange, ...over }
  const s = createService(toggleMachine, props, {})
  s.start()
  return { s, onPressedChange, props, state: () => s.getSnapshot().state }
}
const press = (over: Partial<PressEvent> = {}): TogglePressEvent => ({
  modality: "keyboard",
  pointerType: "keyboard",
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...over,
  type: "PRESS",
})

describe("uncontrolled", () => {
  it("PRESS toggles off -> on -> off, reporting each", () => {
    const m = make()
    expect(m.state()).toBe("off")
    m.s.send(press())
    expect(m.state()).toBe("on")
    m.s.send(press())
    expect(m.state()).toBe("off")
    expect(m.onPressedChange.mock.calls.map((c) => c[0])).toEqual([true, false])
  })

  it("defaultPressed starts on", () => {
    expect(make({ defaultPressed: true }).state()).toBe("on")
  })

  it("cancel() vetoes the change", () => {
    const m = make({ onPressedChange: (_p, d) => d.cancel() })
    m.s.send(press())
    expect(m.state()).toBe("off")
  })
})

describe("controlled", () => {
  it("proposes the opposite value with the PRESS event and modality, and stays put on refusal", () => {
    const m = make({ pressed: false })
    m.s.send(press({ modality: "pointer" }))
    expect(m.onPressedChange).toHaveBeenCalledTimes(1)
    const [value, details] = m.onPressedChange.mock.calls[0] ?? []
    expect(value).toBe(true)
    expect(details.reason).toBe("PRESS")
    expect(details.event).toMatchObject({ type: "PRESS", modality: "pointer" })
    // The parent keeps passing false: refused.
    m.s.setProps({ ...m.props, pressed: false })
    expect(m.state()).toBe("off")
  })

  it("follows the parent when it accepts", () => {
    const m = make({ pressed: false })
    m.s.send(press())
    m.s.setProps({ ...m.props, pressed: true })
    expect(m.state()).toBe("on")
  })

  it("pressed={undefined} warns naming `pressed`, stays controlled; the next press proposes again (radix#721)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const m = make({ pressed: true })
    m.s.setProps({ ...m.props, pressed: undefined })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('"pressed"')
    expect(m.state()).toBe("on")
    m.s.send(press())
    m.s.send(press())
    expect(m.onPressedChange.mock.calls.map((c) => c[0])).toEqual([false, false])
    expect(m.state()).toBe("on")
    warn.mockRestore()
  })
})

describe("focus", () => {
  it("FOCUS and BLUR set context.focused", () => {
    const m = make()
    m.s.send({ type: "FOCUS", modality: "keyboard", cause: "key" })
    expect(m.s.getSnapshot().context.focused).toBe(true)
    m.s.send({ type: "BLUR", modality: "keyboard" })
    expect(m.s.getSnapshot().context.focused).toBe(false)
    expect(m.state()).toBe("off")
  })
})
