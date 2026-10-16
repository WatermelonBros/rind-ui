// The Number Input machine in Node (task 2.5): commits, steps, press-and-hold on fake
// timers, touch tap vs cancel, controlled proposals, announcements, reset and adoption.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { recordingFormInput } from "../../dom/hidden-input"
import type { Announcement } from "../../env"
import { createNumberParser } from "../../i18n/number-parser"
import { createService } from "../../machine/service"
import {
  type NumberInputEvent,
  type NumberInputProps,
  numberInputMachine,
  type Trigger,
} from "./number-input.machine"
import { canStep, nextStep, snapValue } from "./number-input.math"
import { numberInputMessages } from "./number-input.messages"

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

type Over = Partial<Omit<NumberInputProps, "parser">> & {
  locale?: string
  formatOptions?: Intl.NumberFormatOptions
}

function make(over: Over = {}) {
  const { locale = "en-US", formatOptions = {}, ...rest } = over
  const onValueChange = vi.fn()
  const onValueCommit = vi.fn()
  const onInputValueChange = vi.fn()
  const announced: Announcement[] = []
  const rec = recordingFormInput()
  let props: NumberInputProps = {
    onValueChange,
    onValueCommit,
    onInputValueChange,
    parser: createNumberParser(locale, formatOptions),
    messages: numberInputMessages,
    id: "n",
    ...rest,
  }
  const env = {
    formInput: rec.capability,
    announcer: {
      announce: (a: Announcement) => announced.push(a),
      prepare: () => () => {},
      cancel: () => {},
    },
    scheduler: {
      // fake-time: the fake scheduler under test (vi.useFakeTimers)
      setTimeout: (cb: () => void, ms: number) => setTimeout(cb, ms),
      clearTimeout: (h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>),
      // fake-time: the fake scheduler under test (vi.useFakeTimers)
      requestAnimationFrame: (cb: () => void) => setTimeout(cb, 16),
      cancelAnimationFrame: (h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>),
    },
  }
  const s = createService(numberInputMachine, props as never, env as never)
  s.start()
  const send = (e: NumberInputEvent) => s.send(e as never)
  const press = (
    type: "PRESS.START" | "PRESS.END" | "PRESS" | "PRESS.CANCEL",
    trigger: Trigger,
    pointerType = "mouse",
  ) =>
    send({
      type,
      trigger,
      pointerType,
      modality:
        pointerType === "touch" ? "touch" : pointerType === "virtual" ? "virtual" : "pointer",
    } as never)
  return {
    s,
    rec,
    announced,
    onValueChange,
    onValueCommit,
    onInputValueChange,
    send,
    press,
    value: () => s.view(props as never).values.value ?? null,
    text: () => s.getSnapshot().context.text,
    state: () => s.getSnapshot().state,
    type: (text: string) => send({ type: "INPUT", text }),
    blur: () => send({ type: "BLUR" }),
    key: (
      type: "INCREASE" | "DECREASE" | "PAGE_PREV" | "PAGE_NEXT" | "FIRST" | "LAST",
      large = false,
    ) => send({ type, large, modality: "keyboard" }),
    setProps: (p: Partial<NumberInputProps>) => {
      props = { ...props, ...p }
      s.setProps(props as never)
    },
  }
}

describe("math", () => {
  it("steps to the next grid line, from empty to 0 clamped", () => {
    expect(nextStep(40, 1, "step", { step: 0.1 })).toBe(40.1)
    expect(nextStep(40.1, 1, "step", { step: 0.1 })).toBe(40.2)
    expect(nextStep(18.98, 1, "step", { step: 1 })).toBe(19)
    expect(nextStep(18.98, -1, "step", { step: 1 })).toBe(18)
    expect(nextStep(null, -1, "step", { min: 18, max: 120 })).toBe(18)
    expect(nextStep(null, 1, "step", {})).toBe(0)
    expect(nextStep(95, 1, "large", { max: 100 })).toBe(100)
    expect(nextStep(10.5, 1, "step", {})).toBe(11)
  })
  it("snaps and clamps at commit; knows the bounds", () => {
    expect(snapValue(103, { min: 0, max: 100, step: 5 })).toBe(100)
    expect(snapValue(12, { step: 5 })).toBe(10)
    expect(snapValue(10, { min: 0, max: 10, step: 4 })).toBe(8)
    expect(snapValue(1.239, {})).toBe(1.239)
    expect(canStep(100, 1, { max: 100 })).toBe(false)
    expect(canStep(null, 1, { max: 100 })).toBe(true)
  })
})

describe("typing and commit", () => {
  it("Typing then blur commits once", () => {
    const m = make()
    m.type("4")
    m.type("42")
    expect(m.value()).toBeNull()
    expect(m.onInputValueChange.mock.calls.map((c) => c[0])).toEqual(["4", "42"])
    m.blur()
    expect(m.value()).toBe(42)
    expect(m.onValueChange).toHaveBeenCalledTimes(1)
    expect(m.onValueCommit).toHaveBeenCalledWith(42, { reason: "INPUT.COMMIT" })
    expect(m.onValueChange.mock.calls[0]?.[1].reason).toBe("COMMIT")
  })

  it("Blur without change commits nothing (react-spectrum#9444)", () => {
    const m = make({ defaultValue: 5 })
    m.blur()
    expect(m.onValueChange).not.toHaveBeenCalled()
    expect(m.onValueCommit).not.toHaveBeenCalled()
  })

  it("Garbage restores (react-spectrum#3862)", () => {
    const m = make({ defaultValue: 10 })
    m.type(",")
    m.blur()
    expect(m.text()).toBe("10")
    expect(m.value()).toBe(10)
  })

  it("Snap on commit, announced as a rewrite (react-spectrum#4967)", () => {
    const m = make({ min: 0, max: 100, step: 5 })
    m.type("103")
    m.blur()
    expect(m.value()).toBe(100)
    expect(m.text()).toBe("100")
    expect(m.announced.map((a) => a.message)).toEqual(["100"])
    m.type("40")
    m.blur()
    expect(m.announced).toHaveLength(1)
  })

  it("Validate keeps the typed value (base-ui#1845)", () => {
    const m = make({ max: 100, commitBehavior: "validate" })
    m.type("150")
    m.blur()
    expect(m.value()).toBe(150)
  })

  it("empty text commits null", () => {
    const m = make({ defaultValue: 3 })
    m.type("")
    m.blur()
    expect(m.value()).toBeNull()
    expect(m.text()).toBe("")
  })

  it("Explicit rounding: what you see is what is committed", () => {
    const m = make({ formatOptions: { maximumFractionDigits: 2 } })
    m.type("1.239")
    m.blur()
    expect(m.value()).toBe(1.24)
    expect(m.text()).toBe("1.24")
  })

  it("composing: typing goes to the text, no commit until it ends", () => {
    const m = make()
    m.send({ type: "COMPOSITION.START" })
    expect(m.state()).toBe("composing")
    m.send({ type: "INPUT", text: "１" })
    m.send({ type: "COMPOSITION.END", text: "１２" })
    expect(m.state()).toBe("idle")
    m.blur()
    expect(m.value()).toBe(12)
  })

  it("a blur mid-composition commits once the composition ends (no lost input)", () => {
    const m = make()
    m.type("4")
    m.send({ type: "COMPOSITION.START" })
    m.send({ type: "INPUT", text: "42" })
    m.blur()
    expect(m.value()).toBeNull()
    m.send({ type: "COMPOSITION.END", text: "42" })
    expect(m.value()).toBe(42)
    expect(m.onValueCommit).toHaveBeenCalledTimes(1)
  })

  it("a blur while a trigger is held commits the typed text", () => {
    const m = make()
    m.type("7")
    m.press("PRESS.START", "increment", "touch")
    expect(m.state()).toBe("pressing")
    m.blur()
    expect(m.value()).toBe(7)
    expect(m.text()).toBe("7")
  })

  it("Paste a formatted amount", () => {
    const m = make({ formatOptions: { style: "currency", currency: "USD" } })
    m.send({ type: "PASTE", text: "$1,234.50" })
    expect(m.value()).toBe(1234.5)
    expect(m.text()).toBe("$1,234.50")
    expect(m.onValueCommit).toHaveBeenCalledWith(1234.5, { reason: "PASTE" })
  })
})

describe("keys", () => {
  it("Decimal steps (kobalte#451) and one commit per key (each repeat included)", () => {
    const m = make({ defaultValue: 40, step: 0.1 })
    m.key("INCREASE")
    m.key("INCREASE")
    expect(m.onValueChange.mock.calls.map((c) => c[0])).toEqual([40.1, 40.2])
    expect(m.onValueCommit).toHaveBeenCalledTimes(2)
    expect(m.onValueCommit.mock.calls[0]?.[1]).toEqual({ reason: "STEP" })
  })

  it("Empty field with a minimum", () => {
    const m = make({ min: 18, max: 120 })
    m.key("DECREASE")
    expect(m.value()).toBe(18)
  })

  it("large steps, pages, edges", () => {
    const m = make({ defaultValue: 5, min: 0, max: 100 })
    m.key("INCREASE", true)
    expect(m.value()).toBe(15)
    m.key("PAGE_PREV")
    expect(m.value()).toBe(25)
    m.key("LAST")
    expect(m.value()).toBe(100)
    m.key("FIRST")
    expect(m.onValueCommit.mock.calls.at(-1)).toEqual([0, { reason: "EDGE" }])
  })

  it("Step from edited text (ark#1838): parses 10,50 then the next grid line", () => {
    const m = make({ locale: "fr-FR", formatOptions: { style: "currency", currency: "EUR" } })
    m.type("10,50")
    m.press("PRESS.START", "increment")
    m.press("PRESS.END", "increment")
    expect(m.value()).toBe(11)
    expect(m.text()).toBe(
      new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(11),
    )
  })

  it("Held key does not flood (react-spectrum#4157)", () => {
    const m = make({ defaultValue: 0 })
    for (let i = 0; i < 20; i++) m.key("INCREASE")
    expect(m.value()).toBe(20)
    expect(m.announced).toEqual([])
  })

  it("read-only and disabled ignore keys, wheel, paste", () => {
    for (const p of [{ readOnly: true }, { disabled: true }]) {
      const m = make({ defaultValue: 3, ...p })
      m.key("INCREASE")
      m.send({ type: "WHEEL", direction: 1, large: false })
      m.send({ type: "PASTE", text: "9" })
      expect(m.value()).toBe(3)
    }
  })

  it("wheel ticks each commit", () => {
    const m = make({ defaultValue: 3 })
    m.send({ type: "WHEEL", direction: 1, large: false })
    m.send({ type: "WHEEL", direction: -1, large: true })
    expect(m.value()).toBe(-6)
    expect(m.onValueCommit.mock.calls.map((c) => c[1].reason)).toEqual(["WHEEL", "WHEEL"])
  })
})

describe("steppers and press-and-hold", () => {
  it("One change per click (base-ui#2588)", () => {
    const m = make({ defaultValue: 0 })
    m.press("PRESS.START", "increment")
    m.press("PRESS.END", "increment")
    m.press("PRESS", "increment")
    expect(m.onValueChange).toHaveBeenCalledTimes(1)
    expect(m.onValueCommit).toHaveBeenCalledTimes(1)
    expect(m.value()).toBe(1)
  })

  it("Hold with fake timers: 400 + 3 × 60 ms gives 4", () => {
    const m = make({ defaultValue: 0 })
    m.press("PRESS.START", "increment")
    vi.advanceTimersByTime(400 + 3 * 60)
    expect(m.state()).toBe("spinning")
    m.press("PRESS.END", "increment")
    m.press("PRESS", "increment")
    expect(m.value()).toBe(4)
    expect(m.onValueChange).toHaveBeenCalledTimes(4)
    expect(m.onValueCommit).toHaveBeenCalledTimes(1)
    expect(m.onValueCommit).toHaveBeenCalledWith(4, { reason: "STEP" })
  })

  it("Hold stops at max (base-ui#3887)", () => {
    const m = make({ defaultValue: 0, max: 3 })
    m.press("PRESS.START", "increment")
    vi.advanceTimersByTime(2000)
    expect(m.value()).toBe(3)
    expect(m.state()).toBe("idle")
    expect(m.onValueChange).toHaveBeenCalledTimes(3)
    expect(m.onValueCommit).toHaveBeenCalledTimes(1)
  })

  it("Disabled mid-hold (base-ui#5434)", () => {
    const m = make({ defaultValue: 0, disabled: false })
    m.press("PRESS.START", "increment")
    vi.advanceTimersByTime(460)
    m.setProps({ disabled: true })
    const v = m.value()
    vi.advanceTimersByTime(1000)
    expect(m.value()).toBe(v)
    expect(m.state()).toBe("idle")
  })

  it("Touch scroll (react-spectrum#8472): pointercancel never steps", () => {
    const m = make({ defaultValue: 0 })
    m.press("PRESS.START", "increment", "touch")
    m.press("PRESS.CANCEL", "increment", "touch")
    expect(m.value()).toBe(0)
    expect(m.onValueChange).not.toHaveBeenCalled()
  })

  it("touch tap steps on release, announced (focus is not on the input)", () => {
    const m = make({ defaultValue: 0 })
    m.press("PRESS.START", "increment", "touch")
    expect(m.value()).toBe(0)
    m.press("PRESS.END", "increment", "touch")
    m.press("PRESS", "increment", "touch")
    expect(m.value()).toBe(1)
    expect(m.onValueCommit).toHaveBeenCalledTimes(1)
    expect(m.announced.map((a) => a.message)).toEqual(["1"])
    expect(m.announced[0]?.priority).toBe("polite")
  })

  it("touch hold repeats after 600 ms and does not step again on release", () => {
    const m = make({ defaultValue: 0 })
    m.press("PRESS.START", "increment", "touch")
    vi.advanceTimersByTime(599)
    expect(m.state()).toBe("pressing")
    vi.advanceTimersByTime(1 + 60)
    m.press("PRESS.END", "increment", "touch")
    m.press("PRESS", "increment", "touch")
    expect(m.value()).toBe(1)
  })

  it("Screen reader stepper presses: each announced, keyed (the debounce keeps the last)", () => {
    const m = make({ defaultValue: 0 })
    for (let i = 0; i < 3; i++) {
      m.press("PRESS.START", "increment", "virtual")
      m.press("PRESS.END", "increment", "virtual")
      m.press("PRESS", "increment", "virtual")
    }
    expect(m.value()).toBe(3)
    expect(new Set(m.announced.map((a) => a.key)).size).toBe(1)
    expect(m.announced.at(-1)?.message).toBe("3")
  })

  it("No hold", () => {
    const m = make({ defaultValue: 0, spinOnPress: false })
    m.press("PRESS.START", "increment")
    vi.advanceTimersByTime(1000)
    m.press("PRESS.END", "increment")
    m.press("PRESS", "increment")
    expect(m.value()).toBe(1)
  })

  it("leaving a held trigger stops the repeat and commits", () => {
    const m = make({ defaultValue: 0 })
    m.press("PRESS.START", "increment")
    vi.advanceTimersByTime(460)
    m.send({ type: "PRESS.LEAVE" })
    vi.advanceTimersByTime(500)
    expect(m.value()).toBe(2)
    expect(m.onValueCommit).toHaveBeenCalledTimes(1)
  })

  it("a trigger at its bound ignores presses", () => {
    const m = make({ defaultValue: 10, max: 10 })
    m.press("PRESS.START", "increment")
    expect(m.state()).toBe("idle")
    expect(m.onValueChange).not.toHaveBeenCalled()
  })
})

describe("controlled, reset, adoption", () => {
  it("Parent clamps (zag#3444): the text shows the controlled value right after", () => {
    const m = make({ value: 5 })
    m.type("100")
    m.blur()
    m.setProps({ value: 10 })
    expect(m.text()).toBe("10")
    expect(m.onValueCommit).not.toHaveBeenCalled()
  })

  it("Parent refuses a step: text stays, no commit", () => {
    const m = make({ value: 5 })
    m.key("INCREASE")
    expect(m.onValueChange).toHaveBeenCalledWith(6, expect.anything())
    m.setProps({ value: 5 })
    expect(m.text()).toBe("5")
    expect(m.onValueCommit).not.toHaveBeenCalled()
  })

  it("an applied step commits when it arrives, and dispatches on the hidden input", () => {
    const m = make({ value: 5 })
    m.key("INCREASE")
    m.setProps({ value: 6 })
    expect(m.onValueCommit).toHaveBeenCalledWith(6, { reason: "STEP" })
    expect(m.rec.calls.at(-1)).toEqual({ value: { value: "6" }, dispatch: true })
  })

  it("a parent's own change shows, even while focused", () => {
    const m = make({ value: 5 })
    m.send({ type: "FOCUS", modality: "keyboard" })
    m.setProps({ value: 8 })
    expect(m.text()).toBe("8")
  })

  it("reset restores the current default without a commit", () => {
    const m = make({ defaultValue: 3 })
    m.key("INCREASE")
    m.setProps({ defaultValue: 7 })
    m.send({ type: "RESET" })
    expect(m.value()).toBe(7)
    expect(m.onValueCommit).toHaveBeenCalledTimes(1)
    expect(m.rec.calls.at(-1)?.dispatch).toBe(false)
  })

  it("autofill is adopted as a commit; read-only re-syncs instead", () => {
    const m = make({ defaultValue: 3 })
    m.send({ type: "INPUT.ADOPT", value: 9 })
    expect(m.value()).toBe(9)
    expect(m.onValueCommit).toHaveBeenCalledWith(9, { reason: "INPUT.COMMIT" })
    const r = make({ defaultValue: 3, readOnly: true })
    r.send({ type: "INPUT.ADOPT", value: 9 })
    expect(r.value()).toBe(3)
    expect(r.rec.calls.at(-1)).toEqual({ value: { value: "3" }, dispatch: false })
  })

  it("a user step mirrors the hidden input, dispatching", () => {
    const m = make({ defaultValue: 3 })
    m.key("INCREASE")
    expect(m.rec.calls.at(-1)).toEqual({ value: { value: "4" }, dispatch: true })
  })
})
