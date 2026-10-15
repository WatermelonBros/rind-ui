// Every transition and guard of the Button machine, in Node (openspec button, design §2).
import { describe, expect, it, vi } from "vitest"
import type { PressEvent } from "../../a11y"
import type { Announcement } from "../../env"
import { createService } from "../../machine/service"
import { type ButtonProps, buttonMachine } from "./button.machine"

function make(over: Partial<ButtonProps> = {}) {
  const log: Announcement[] = []
  const calls = { press: vi.fn(), start: vi.fn(), end: vi.fn() }
  const props: ButtonProps = {
    messages: { pending: "Loading" },
    id: "b1",
    onPress: calls.press,
    onPressStart: calls.start,
    onPressEnd: calls.end,
    ...over,
  }
  const env = {
    announcer: {
      announce: (a: Announcement) => {
        log.push(a)
      },
      prepare: () => () => {},
      cancel: () => {},
    },
  }
  const s = createService(buttonMachine, props, env)
  s.start()
  return { s, calls, log, props }
}
const press = (type: PressEvent["type"], over: Partial<PressEvent> = {}): PressEvent => ({
  type,
  modality: "pointer",
  pointerType: "mouse",
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...over,
})
const focus = { type: "FOCUS", modality: "keyboard", cause: "key" } as const
const blur = { type: "BLUR", modality: "keyboard" } as const

describe("PRESS", () => {
  it("calls onPress once with modality and modifiers when idle", () => {
    const { s, calls } = make()
    s.send(press("PRESS", { modality: "keyboard", pointerType: "keyboard", shiftKey: true }))
    expect(calls.press).toHaveBeenCalledOnce()
    expect(calls.press).toHaveBeenCalledWith({
      modality: "keyboard",
      shiftKey: true,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
    })
  })

  it("is ignored when disabled by prop (base-ui#1312: no handler order can bypass it)", () => {
    const { s, calls } = make({ disabled: true })
    s.send(press("PRESS"))
    s.send(press("PRESS.START"))
    expect(calls.press).not.toHaveBeenCalled()
    expect(calls.start).not.toHaveBeenCalled()
  })

  it("follows a prop that changes after creation", () => {
    const { s, calls, props } = make()
    s.setProps({ ...props, disabled: true })
    s.send(press("PRESS"))
    s.setProps({ ...props, disabled: false })
    s.send(press("PRESS"))
    expect(calls.press).toHaveBeenCalledOnce()
  })

  it("is ignored when a disabled fieldset says so, and works again when it is enabled", () => {
    const { s, calls } = make()
    s.send({ type: "FIELDSET.CHANGE", disabled: true })
    expect(s.getSnapshot().context.fieldsetDisabled).toBe(true)
    s.send(press("PRESS"))
    expect(calls.press).not.toHaveBeenCalled()
    s.send({ type: "FIELDSET.CHANGE", disabled: false })
    s.send(press("PRESS"))
    expect(calls.press).toHaveBeenCalledOnce()
  })

  it("is ignored while pending, and works again after", () => {
    const { s, calls, props } = make({ pending: true })
    expect(s.getSnapshot().state).toBe("pending")
    s.send(press("PRESS"))
    s.send(press("PRESS.START"))
    expect(calls.press).not.toHaveBeenCalled()
    expect(calls.start).not.toHaveBeenCalled()
    s.setProps({ ...props, pending: false })
    expect(s.getSnapshot().state).toBe("idle")
    s.send(press("PRESS"))
    expect(calls.press).toHaveBeenCalledOnce()
  })
})

describe("PRESS.START / END / CANCEL pairing", () => {
  it("onPressStart then onPressEnd", () => {
    const { s, calls } = make()
    s.send(press("PRESS.START"))
    expect(calls.start).toHaveBeenCalledOnce()
    expect(s.getSnapshot().context.pressing).toBe(true)
    s.send(press("PRESS.END"))
    expect(calls.end).toHaveBeenCalledOnce()
    expect(s.getSnapshot().context.pressing).toBe(false)
  })

  it("a cancelled press also ends", () => {
    const { s, calls } = make()
    s.send(press("PRESS.START"))
    s.send(press("PRESS.CANCEL"))
    expect(calls.end).toHaveBeenCalledOnce()
    expect(s.getSnapshot().context.pressing).toBe(false)
  })

  it("onPressEnd only after a start", () => {
    const { s, calls } = make()
    s.send(press("PRESS.END"))
    s.send(press("PRESS.CANCEL"))
    expect(calls.end).not.toHaveBeenCalled()
  })

  it("one end per start", () => {
    const { s, calls } = make()
    s.send(press("PRESS.START"))
    s.send(press("PRESS.END"))
    s.send(press("PRESS.END"))
    expect(calls.end).toHaveBeenCalledOnce()
  })

  it("a press started while idle still ends if the Button became pending meanwhile", () => {
    const { s, calls, props } = make()
    s.send(press("PRESS.START"))
    s.setProps({ ...props, pending: true })
    s.send(press("PRESS.END"))
    expect(calls.end).toHaveBeenCalledOnce()
  })

  it("PRESS.UP is not handled and changes nothing", () => {
    const { s, calls } = make()
    const before = s.getSnapshot()
    s.send(press("PRESS.UP"))
    expect(s.getSnapshot()).toBe(before)
    expect(calls.press).not.toHaveBeenCalled()
  })
})

describe("pending announcement", () => {
  it("one polite, keyed announcement when focused", () => {
    const { s, log, props } = make()
    s.send(focus)
    s.setProps({ ...props, pending: true })
    expect(log).toEqual([{ message: "Loading", priority: "polite", key: "button-b1-pending" }])
  })

  it("none when not focused", () => {
    const { s, log, props } = make()
    s.setProps({ ...props, pending: true })
    expect(log).toEqual([])
  })

  it("none after blur", () => {
    const { s, log, props } = make()
    s.send(focus)
    s.send(blur)
    s.setProps({ ...props, pending: true })
    expect(log).toEqual([])
  })

  it("none when ending pending, one per new pending edge", () => {
    const { s, log, props } = make()
    s.send(focus)
    s.setProps({ ...props, pending: true })
    s.setProps({ ...props, pending: false })
    expect(log).toHaveLength(1)
    s.setProps({ ...props, pending: true })
    expect(log).toHaveLength(2)
  })

  it("uses the resolved messages.pending (localised)", () => {
    const { s, log, props } = make({ messages: { pending: "Caricamento" } })
    s.send(focus)
    s.setProps({ ...props, pending: true })
    expect(log[0]?.message).toBe("Caricamento")
  })

  it("the key follows the instance id", () => {
    const { s, log, props } = make({ id: "zz" })
    s.send(focus)
    s.setProps({ ...props, pending: true })
    expect(log[0]?.key).toBe("button-zz-pending")
  })
})

describe("context events", () => {
  it("FOCUS and BLUR set and clear focused", () => {
    const { s } = make()
    s.send(focus)
    expect(s.getSnapshot().context.focused).toBe(true)
    s.send(blur)
    expect(s.getSnapshot().context.focused).toBe(false)
  })
})
