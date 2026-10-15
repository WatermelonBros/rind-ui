// The Switch machine in Node, with a recording hidden input: transitions, guards,
// controlled proposals, user-vs-programmatic dispatch, reset and the props wrapper.
import { describe, expect, it, vi } from "vitest"
import { recordingFormInput } from "../../dom/hidden-input"
import { createService } from "../../machine/service"
import {
  type SwitchEvent,
  type SwitchProps,
  switchMachine,
  switchMachineProps,
} from "./switch.machine"

function make(over: SwitchProps = {}) {
  const onCheckedChange = vi.fn()
  const rec = recordingFormInput()
  let props: SwitchProps = { onCheckedChange, ...over }
  const s = createService(switchMachine, props as never, { formInput: rec.capability } as never)
  s.start()
  return {
    s,
    rec,
    onCheckedChange,
    state: () => s.getSnapshot().state,
    send: (e: SwitchEvent) => s.send(e as never),
    setProps: (p: Partial<SwitchProps>) => {
      props = { ...props, ...p }
      s.setProps(props as never)
    },
    dispatches: () => rec.calls.filter((c) => c.dispatch).length,
  }
}
const toggle = { type: "TOGGLE", modality: "pointer" } as const
const reset = { type: "RESET" } as const

describe("transitions", () => {
  it("unchecked -> checked -> unchecked, reporting each", () => {
    const m = make()
    expect(m.state()).toBe("unchecked")
    m.send(toggle)
    expect(m.state()).toBe("checked")
    m.send(toggle)
    expect(m.state()).toBe("unchecked")
    expect(m.onCheckedChange.mock.calls.map((c) => c[0])).toEqual([true, false])
    expect(m.onCheckedChange.mock.calls[0]?.[1].reason).toBe("TOGGLE")
  })

  it("starts from defaultChecked and mirrors it without dispatching", () => {
    const m = make({ defaultChecked: true })
    expect(m.state()).toBe("checked")
    expect(m.rec.calls).toEqual([
      { value: { checked: true, indeterminate: false }, dispatch: false },
    ])
  })

  it("a user change syncs the input once, dispatching", () => {
    const m = make()
    m.send(toggle)
    expect(m.rec.calls.at(-1)).toEqual({
      value: { checked: true, indeterminate: false },
      dispatch: true,
    })
    expect(m.dispatches()).toBe(1)
  })

  it("focus and blur change no value", () => {
    const m = make()
    m.send({ type: "FOCUS", modality: "keyboard" } as never)
    m.send({ type: "BLUR" } as never)
    expect(m.state()).toBe("unchecked")
    expect(m.onCheckedChange).not.toHaveBeenCalled()
  })
})

describe("guards", () => {
  it.each([["readOnly"], ["disabled"]] as const)("%s ignores TOGGLE", (flag) => {
    const m = make({ [flag]: true })
    m.send(toggle)
    expect(m.state()).toBe("unchecked")
    expect(m.onCheckedChange).not.toHaveBeenCalled()
    expect(m.dispatches()).toBe(0)
  })
})

describe("controlled", () => {
  it("proposes the opposite value and stays put until the parent applies it", () => {
    const m = make({ checked: false })
    m.send(toggle)
    expect(m.onCheckedChange).toHaveBeenCalledTimes(1)
    expect(m.onCheckedChange.mock.calls[0]?.[0]).toBe(true)
    expect(m.state()).toBe("unchecked")
    m.setProps({ checked: true })
    expect(m.state()).toBe("checked")
  })

  it("a refusal keeps the state and syncs the input back without dispatching", () => {
    const m = make({ checked: false })
    m.send(toggle)
    m.setProps({ checked: false })
    expect(m.state()).toBe("unchecked")
    expect(m.dispatches()).toBe(0)
    expect(m.rec.calls.at(-1)?.value).toEqual({ checked: false, indeterminate: false })
  })

  it("$sync after a proposal dispatches exactly once (the user's change)", () => {
    const m = make({ checked: false })
    m.send(toggle)
    m.setProps({ checked: true })
    expect(m.dispatches()).toBe(1)
    expect(m.rec.calls.at(-1)).toEqual({
      value: { checked: true, indeterminate: false },
      dispatch: true,
    })
  })

  it("a parent-only change dispatches nothing (radix#4102)", () => {
    const m = make({ checked: false })
    m.setProps({ checked: true })
    expect(m.state()).toBe("checked")
    expect(m.dispatches()).toBe(0)
    expect(m.onCheckedChange).not.toHaveBeenCalled()
  })

  it("an external change then a click proposes the opposite of the new value (ark#2608)", () => {
    const m = make({ checked: false })
    m.setProps({ checked: true })
    m.send(toggle)
    expect(m.onCheckedChange.mock.calls[0]?.[0]).toBe(false)
  })
})

describe("cancel", () => {
  it("cancel() vetoes the change: no dispatch, and the input is synced back", () => {
    const m = make({ onCheckedChange: (_c, d) => d.cancel() })
    m.send(toggle)
    expect(m.state()).toBe("unchecked")
    expect(m.dispatches()).toBe(0)
    expect(m.rec.calls.at(-1)).toEqual({
      value: { checked: false, indeterminate: false },
      dispatch: false,
    })
  })

  it("a cancelled controlled proposal is not applied later either", () => {
    const m = make({ checked: false, onCheckedChange: (_c, d) => d.cancel() })
    m.send(toggle)
    m.setProps({ checked: false })
    expect(m.dispatches()).toBe(0)
  })
})

describe("RESET", () => {
  it("uncontrolled: restores defaultChecked, with reason RESET, without dispatching", () => {
    const m = make({ defaultChecked: true })
    m.send(toggle)
    expect(m.state()).toBe("unchecked")
    m.onCheckedChange.mockClear()
    const before = m.dispatches()
    m.send(reset)
    expect(m.state()).toBe("checked")
    expect(m.onCheckedChange.mock.calls[0]?.[0]).toBe(true)
    expect(m.onCheckedChange.mock.calls[0]?.[1].reason).toBe("RESET")
    expect(m.dispatches()).toBe(before)
  })

  it("restores an unchecked default after a toggle", () => {
    const b = make()
    b.send(toggle)
    b.send(reset)
    expect(b.state()).toBe("unchecked")
    expect(b.onCheckedChange.mock.calls.at(-1)?.[1].reason).toBe("RESET")
  })

  it("restores the CURRENT defaultChecked, not the creation one", () => {
    const m = make({ defaultChecked: false })
    m.setProps({ defaultChecked: true })
    expect(m.state()).toBe("unchecked")
    m.send(reset)
    expect(m.state()).toBe("checked")
    expect(m.onCheckedChange.mock.calls.at(-1)?.[1].reason).toBe("RESET")
  })

  it("controlled: proposes the default and waits for the parent", () => {
    const m = make({ checked: false, defaultChecked: true })
    m.send(reset)
    expect(m.onCheckedChange.mock.calls[0]?.[0]).toBe(true)
    expect(m.onCheckedChange.mock.calls[0]?.[1].reason).toBe("RESET")
    expect(m.state()).toBe("unchecked")
    m.setProps({ checked: true })
    expect(m.state()).toBe("checked")
    expect(m.dispatches()).toBe(0)
  })
})

describe("switchMachineProps", () => {
  it("uncontrolled: the input is synced before the consumer's callback (headlessui#3760)", () => {
    const order: string[] = []
    const rec = recordingFormInput()
    const sync = rec.capability.sync
    rec.capability.sync = (v, o) => {
      order.push("sync")
      sync(v, o)
    }
    const props = switchMachineProps(
      { onCheckedChange: () => order.push("consumer") },
      rec.capability,
    )
    const s = createService(switchMachine, props as never, { formInput: rec.capability } as never)
    s.start()
    order.length = 0
    s.send(toggle as never)
    expect(order.slice(0, 2)).toEqual(["sync", "consumer"])
    expect(rec.calls.find((c) => c.value.checked)).toBeDefined()
  })

  it("controlled: the props are returned as they are", () => {
    const rec = recordingFormInput()
    const props: SwitchProps = { checked: true, onCheckedChange: () => {} }
    expect(switchMachineProps(props, rec.capability)).toBe(props)
  })
})
