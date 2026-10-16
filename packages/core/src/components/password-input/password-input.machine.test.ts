// The Password Input preset in Node: toggle in both Text Field states, controlled proposals,
// form submit/reset hiding through live props (radix#4157), announcements only with focus in
// the input, selection handed back after the toggle.
import { describe, expect, it, vi } from "vitest"
import type { Announcement } from "../../env"
import { createService } from "../../machine/service"
import { type PasswordInputOwnProps, passwordInputMachine } from "./password-input.machine"
import { passwordInputMessages } from "./password-input.messages"

type Over = Partial<PasswordInputOwnProps> & {
  readonly disabled?: boolean
  readonly readOnly?: boolean
  readonly focusableWhenDisabled?: boolean
}

function make(over: Over = {}) {
  const log: Announcement[] = []
  const form: { submit?: () => void; reset?: () => void } = {}
  const unwatch = vi.fn()
  const keepSelection = vi.fn()
  const onVisibleChange = vi.fn()
  const env = {
    announcer: {
      announce: (a: Announcement) => void log.push(a),
      prepare: () => () => {},
      cancel: () => {},
    },
  }
  const props = {
    messages: passwordInputMessages,
    id: "p1",
    clearInput: vi.fn(),
    keepSelection,
    onVisibleChange,
    watchForm: (on: { submit: () => void; reset: () => void }) => {
      form.submit = on.submit
      form.reset = on.reset
      return unwatch
    },
    ...over,
  }
  const s = createService(passwordInputMachine, props as never, env as never)
  s.start()
  return {
    s,
    log,
    form,
    unwatch,
    keepSelection,
    onVisibleChange,
    props,
    visible: () => s.view().values.visible,
    toggle: (inputFocused = false, selection: readonly [number, number] | null = null) =>
      s.send({ type: "VISIBILITY.TOGGLE", modality: "pointer", inputFocused, selection }),
  }
}

describe("visibility", () => {
  it("toggles in idle and while composing", () => {
    const m = make()
    expect(m.visible()).toBe(false)
    m.toggle()
    expect(m.visible()).toBe(true)
    m.s.send({ type: "COMPOSITION.START" })
    m.toggle()
    expect(m.visible()).toBe(false)
    expect(m.s.getSnapshot().state).toBe("composing")
  })

  it("defaultVisible starts revealed", () => {
    expect(make({ defaultVisible: true }).visible()).toBe(true)
  })

  it("disabled refuses, read-only allows", () => {
    const d = make({ disabled: true })
    d.toggle()
    expect(d.visible()).toBe(false)
    expect(make({ focusableWhenDisabled: true, disabled: true }).visible()).toBe(false)
    const r = make({ readOnly: true })
    r.toggle()
    expect(r.visible()).toBe(true)
  })

  it("controlled: proposes, and a refused proposal keeps the prop", () => {
    const m = make({ visible: false })
    m.toggle()
    expect(m.onVisibleChange).toHaveBeenCalledTimes(1)
    expect(m.onVisibleChange.mock.calls[0]?.[0]).toBe(true)
    expect(m.visible()).toBe(false)
  })

  it("hands the captured selection back for the restore", () => {
    const m = make()
    m.toggle(true, [4, 4])
    expect(m.keepSelection).toHaveBeenCalledWith([4, 4])
    m.toggle(false, null)
    expect(m.keepSelection).toHaveBeenCalledTimes(1)
  })
})

describe("form", () => {
  it("submit hides (Hidden after submit, GOV.UK)", () => {
    const m = make({ defaultVisible: true })
    m.form.submit?.()
    expect(m.visible()).toBe(false)
    expect(m.onVisibleChange).toHaveBeenCalledTimes(1)
    expect(m.onVisibleChange.mock.calls[0]?.[0]).toBe(false)
  })

  it("controlled reset proposes false through the live props (radix#4157)", () => {
    const m = make({ visible: true })
    const latest = vi.fn()
    m.s.setProps({ ...m.props, visible: true, onVisibleChange: latest } as never)
    m.form.reset?.()
    expect(latest).toHaveBeenCalledTimes(1)
    expect(latest.mock.calls[0]?.[0]).toBe(false)
    expect(m.onVisibleChange).not.toHaveBeenCalled()
  })

  it("a hidden field stays silent on submit; the watch ends with the service", () => {
    const m = make()
    m.form.submit?.()
    expect(m.onVisibleChange).not.toHaveBeenCalled()
    m.s.stop()
    expect(m.unwatch).toHaveBeenCalledTimes(1)
  })
})

describe("announcements", () => {
  it("only when focus is in the input, never the password", () => {
    const m = make()
    m.toggle(true)
    m.toggle(true)
    m.toggle(false)
    expect(m.log.map((a) => [a.message, a.priority])).toEqual([
      ["Password shown", "polite"],
      ["Password hidden", "polite"],
    ])
  })
})
