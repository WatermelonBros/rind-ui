// Every transition and guard of the Field machine, in Node (openspec field-validation,
// design §2). The environment is fake: a recording announcer, a scheduler on vitest's fake
// timers and a validity capability over a fake ConstraintElement.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ConstraintElement, ValidityKey } from "../../dom/constraint-validity"
import { constraintValidity } from "../../dom/constraint-validity"
import type { Announcement } from "../../env"
import { createService } from "../../machine/service"
import { fieldDisplay } from "./field.connect"
import {
  type FieldEvent,
  type FieldProps,
  fieldIsDirty,
  fieldIsFilled,
  fieldMachine,
  type RegisteredControl,
  type ValidationResult,
} from "./field.machine"
import { fieldMessages } from "./field.messages"

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

/** A ConstraintElement stand-in: native keys from flags, one custom message. */
function fakeElement() {
  const s = { custom: "", keys: new Set<ValidityKey>(), messages: new Map<ValidityKey, string>() }
  const setCustomValidity = vi.fn((m: string) => {
    s.custom = m
  })
  const form = {} as HTMLFormElement
  const el = {
    form,
    willValidate: true,
    setCustomValidity,
    get validity() {
      const v: Record<string, boolean> = {}
      for (const k of [
        "valueMissing",
        "typeMismatch",
        "patternMismatch",
        "tooShort",
        "tooLong",
        "rangeUnderflow",
        "rangeOverflow",
        "stepMismatch",
        "badInput",
      ]) {
        v[k] = s.keys.has(k as ValidityKey)
      }
      v["customError"] = s.custom !== ""
      v["valid"] = !Object.values(v).includes(true)
      return v
    },
    get validationMessage() {
      if (s.custom) return s.custom
      const key = [...s.keys][0]
      return key ? (s.messages.get(key) ?? `native:${key}`) : ""
    },
  }
  return {
    el: el as unknown as ConstraintElement,
    setCustomValidity,
    /** Sets the native failures (and their browser messages). */
    fail: (...keys: ValidityKey[]) => {
      s.keys = new Set(keys)
    },
    pass: () => {
      s.keys = new Set()
    },
    foreign: (m: string) => {
      s.custom = m
    },
    custom: () => s.custom,
  }
}

interface Make {
  readonly props?: Partial<FieldProps>
  readonly value?: unknown
  /** `false`: the control is not registered. */
  readonly register?: boolean
  readonly firstInvalid?: boolean
}

function make(opts: Make = {}) {
  const log: Announcement[] = []
  const element = fakeElement()
  const state: { value: unknown } = { value: opts.value ?? "" }
  const focus = vi.fn()
  const control: RegisteredControl = {
    id: "c1",
    labelable: true,
    focus,
    validityElement: () => element.el,
    value: () => state.value,
  }
  // The registered control is read live through props (not kept in context).
  let registered: RegisteredControl | null = null
  let props: FieldProps = {
    control: () => registered,
    validationMode: "submit",
    validationBehavior: "native",
    messages: fieldMessages,
    label: () => "Email",
    formValues: () => ({ other: 1 }),
    ...opts.props,
  }
  const env = {
    announcer: {
      announce: (a: Announcement) => {
        log.push(a)
      },
      prepare: () => () => {},
      cancel: () => {},
    },
    scheduler: {
      setTimeout: (cb: () => void, ms: number) => setTimeout(cb, ms),
      clearTimeout: (h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>),
      requestAnimationFrame: (cb: () => void) => setTimeout(cb, 16),
      cancelAnimationFrame: (h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>),
    },
    validity: {
      ...constraintValidity,
      requiredMessage: () => "Please fill out this field.",
      firstInvalid: () => (opts.firstInvalid === false ? null : (element.el as Element)),
    },
  }
  const s = createService(fieldMachine, props, env as never)
  s.start()
  if (opts.register !== false) {
    registered = control
    s.send({ type: "CONTROL.REGISTER", control })
  }
  const api = {
    s,
    log,
    element,
    focus,
    control,
    state: () => s.getSnapshot().state,
    ctx: () => s.getSnapshot().context,
    setProps: (over: Partial<FieldProps>) => {
      // A new object each time: the service diffs against the previous props.
      props = { ...props, ...over }
      s.setProps(props)
    },
    send: (e: FieldEvent) => {
      if (e.type === "CONTROL.REGISTER") registered = e.control
      if (e.type === "CONTROL.UNREGISTER" && registered?.id === e.id) registered = null
      s.send(e)
    },
    registered: () => registered,
    /** A user edit: the control's value changes, then reports it. */
    type: (value: unknown, over: { user?: boolean; composing?: boolean } = {}) => {
      state.value = value
      s.send({
        type: "CONTROL.CHANGE",
        value,
        user: over.user ?? true,
        composing: over.composing ?? false,
      })
    },
    /** What the control shows now, without telling the Field. */
    shows: (value: unknown) => {
      state.value = value
    },
    reset: (value: unknown) => {
      state.value = value
      s.send({ type: "RESET" })
    },
    submit: () => s.send({ type: "SUBMIT.ATTEMPT" }),
    blur: () => {
      s.send({ type: "FOCUS.ENTER", modality: "keyboard" })
      s.send({ type: "FOCUS.LEAVE" })
    },
  }
  return api
}

/** A promise settled by the test, in any order. */
function deferred() {
  let resolve!: (r: ValidationResult) => void
  const promise = new Promise<ValidationResult>((res) => {
    resolve = res
  })
  return { promise, resolve }
}
const flush = () => vi.advanceTimersByTimeAsync(0)

describe("sources and their order", () => {
  it("invalid={true} forces invalid and beats every other source (no message of its own)", () => {
    const validate = vi.fn(() => "custom")
    const f = make({ props: { validate, errors: ["server"] } })
    f.element.fail("valueMissing")
    f.setProps({ invalid: true })
    expect(f.state()).toBe("invalid")
    expect(f.ctx().current).toEqual({ source: "invalid", messages: [], key: null })
    expect(validate).not.toHaveBeenCalled()
    // Native validity agrees: the form is blocked with the Field's generic message.
    expect(f.element.custom()).toBe(fieldMessages.invalid)
  })

  it("invalid={false} forces valid at once, whatever the other sources say", () => {
    const f = make({ props: { validate: () => "custom" } })
    f.element.fail("valueMissing")
    f.setProps({ invalid: false })
    expect(f.state()).toBe("valid")
    expect(f.ctx().current).toBeNull()
  })

  it("external errors beat native constraints and validate", () => {
    const validate = vi.fn(() => "custom")
    const f = make({ props: { validate } })
    validate.mockClear()
    f.element.fail("valueMissing")
    f.setProps({ errors: ["Not available"] })
    expect(f.state()).toBe("invalid")
    expect(f.ctx().current?.source).toBe("external")
    expect(f.ctx().current?.messages).toEqual(["Not available"])
    expect(validate).not.toHaveBeenCalled()
    expect(f.element.custom()).toBe("Not available")
  })

  it("external messages are joined with a newline on the native element", () => {
    const f = make()
    f.setProps({ errors: ["One", "Two"] })
    expect(f.element.custom()).toBe("One\nTwo")
  })

  it("native constraints beat validate, which has not run (base-ui#1904, ariakit#2282)", () => {
    const validate = vi.fn(() => "custom")
    const f = make({ props: { validate } })
    validate.mockClear()
    f.element.fail("valueMissing")
    f.submit()
    expect(f.state()).toBe("invalid")
    expect(f.ctx().current).toMatchObject({
      source: "native",
      key: "valueMissing",
      messages: ["native:valueMissing"],
    })
    expect(validate).not.toHaveBeenCalled()
  })

  it("a control-owned message counts as native, before validate (A.1)", () => {
    const validate = vi.fn(() => "custom")
    const f = make({ props: { validate } })
    validate.mockClear()
    // The control sets its own message on its validity element (e.g. Date Field badInput).
    f.element.foreign("Enter a real date")
    f.submit()
    expect(f.state()).toBe("invalid")
    expect(f.ctx().current).toMatchObject({
      source: "native",
      key: "customError",
      messages: ["Enter a real date"],
    })
    expect(validate).not.toHaveBeenCalled()
  })

  it("a control-owned message set before validate wins over a passing validate and survives", () => {
    const f = make({ props: { validationMode: "change", validate: () => null } })
    f.element.foreign("Enter a real date")
    f.type("2024-")
    expect(f.state()).toBe("invalid")
    expect(f.element.custom()).toBe("Enter a real date")
  })

  it("validate runs when native constraints pass and gets the form's values", () => {
    const validate = vi.fn(() => "Username taken")
    const f = make({ props: { validate } })
    f.type("bob")
    f.submit()
    expect(validate).toHaveBeenLastCalledWith("bob", { other: 1 })
    expect(f.ctx().current).toMatchObject({ source: "validate", messages: ["Username taken"] })
    expect(f.element.custom()).toBe("Username taken")
  })

  it("validate may return an array of messages", () => {
    const f = make({ props: { validate: () => ["a", "b"] } })
    f.submit()
    expect(f.ctx().current?.messages).toEqual(["a", "b"])
    expect(f.element.custom()).toBe("a\nb")
  })

  it("a validate returning null, undefined or an empty string is valid", () => {
    for (const result of [null, undefined, "", []] as const) {
      const f = make({ props: { validate: () => result } })
      f.submit()
      expect(f.state()).toBe("valid")
    }
  })

  it("validate receives the NEW value, not the previous one (base-ui#1844)", () => {
    const validate = vi.fn(() => null)
    const f = make({ props: { validationMode: "change", validate } })
    validate.mockClear()
    f.type("a")
    expect(validate).toHaveBeenCalledTimes(1)
    expect(validate).toHaveBeenLastCalledWith("a", expect.anything())
    f.type("ab")
    expect(validate).toHaveBeenLastCalledWith("ab", expect.anything())
  })

  it("validity messages can be overridden per key (the override is also the native message)", () => {
    const f = make({
      props: { messages: { ...fieldMessages, valueMissing: "Campo obbligatorio" } },
    })
    f.element.fail("valueMissing")
    f.submit()
    expect(f.ctx().current?.messages).toEqual(["Campo obbligatorio"])
    expect(f.element.custom()).toBe("Campo obbligatorio")
  })

  it("in aria behaviour nothing is written to native validity", () => {
    const f = make({ props: { validationBehavior: "aria", validate: () => "custom" } })
    f.submit()
    expect(f.state()).toBe("invalid")
    expect(f.element.setCustomValidity).not.toHaveBeenCalled()
  })

  it("custom validity is cleared when the fix passes validate", () => {
    let bad = true
    const f = make({ props: { validationMode: "change", validate: () => (bad ? "taken" : null) } })
    f.type("x")
    expect(f.element.custom()).toBe("taken")
    bad = false
    f.type("y")
    expect(f.state()).toBe("valid")
    expect(f.element.custom()).toBe("")
  })
})

describe("invalid prop transitions (base-ui#3777)", () => {
  it("true to undefined: nothing shown, then valid after the next validation", () => {
    const f = make({ props: { invalid: true, validationMode: "change" } })
    f.setProps({ invalid: undefined })
    expect(f.state()).toBe("idle")
    expect(f.ctx().shown).toBe("none")
    f.type("fine")
    expect(f.state()).toBe("valid")
  })

  it("true to false: valid at once", () => {
    const f = make({ props: { invalid: true } })
    f.setProps({ invalid: false })
    expect(f.state()).toBe("valid")
  })

  it("undefined to true: invalid at once, whatever the mode", () => {
    const f = make()
    f.setProps({ invalid: true })
    expect(f.state()).toBe("invalid")
  })

  it("true to undefined clears the custom validity the prop had set", () => {
    const f = make()
    f.setProps({ invalid: true })
    expect(f.element.custom()).toBe(fieldMessages.invalid)
    f.setProps({ invalid: undefined })
    expect(f.element.custom()).toBe("")
  })

  it("fieldDisplay pins the display to the prop, including before the first event", () => {
    const ctx = { shown: "none" } as const
    expect(fieldDisplay("idle", ctx, { disabled: false, invalid: true })).toBe("invalid")
    expect(fieldDisplay("idle", ctx, { disabled: false, invalid: false })).toBe("valid")
    expect(fieldDisplay("idle", ctx, { disabled: false, invalid: undefined })).toBe("none")
  })
})

describe("disabled", () => {
  it("is neither valid nor invalid and shows no error", () => {
    const f = make({ props: { validate: () => "bad" } })
    f.submit()
    expect(f.state()).toBe("invalid")
    f.setProps({ disabled: true })
    expect(fieldDisplay(f.state(), f.ctx(), { disabled: true, invalid: undefined })).toBe("none")
    f.type("x")
    expect(f.state()).toBe("idle")
    expect(f.ctx().shown).toBe("none")
  })

  it("not even invalid={true} shows while disabled", () => {
    expect(fieldDisplay("invalid", { shown: "invalid" }, { disabled: true, invalid: true })).toBe(
      "none",
    )
  })
})

describe("validation mode: submit (default)", () => {
  it("is quiet through change and blur until the first submit attempt (base-ui#2142)", () => {
    const f = make({ props: { validate: (v) => (v === "bad" ? "Not an email" : null) } })
    f.type("bad")
    f.blur()
    expect(f.state()).toBe("idle")
    expect(f.ctx().shown).toBe("none")
    f.submit()
    expect(f.state()).toBe("invalid")
  })

  it("re-validates on every change after the attempt and clears at once (react-spectrum#6983)", () => {
    const f = make({ props: { validate: (v) => (v === "ok@x.io" ? null : "Not an email") } })
    f.type("ok@")
    f.submit()
    expect(f.state()).toBe("invalid")
    f.type("ok@x")
    expect(f.state()).toBe("invalid")
    f.type("ok@x.io")
    expect(f.state()).toBe("valid")
    expect(f.ctx().shown).toBe("valid")
    f.type("nope")
    expect(f.state()).toBe("invalid")
  })

  it("the native invalid event is a submit attempt", () => {
    const f = make()
    f.element.fail("valueMissing")
    f.send({ type: "INVALID" })
    expect(f.ctx().attempted).toBe(true)
    expect(f.state()).toBe("invalid")
  })

  it("a valid field is shown valid after the attempt", () => {
    const f = make()
    f.submit()
    expect(f.state()).toBe("valid")
  })
})

describe("validation mode: blur", () => {
  it("shows an error when focus leaves after the value changed", () => {
    const f = make({ props: { validationMode: "blur", validate: () => "bad" } })
    f.send({ type: "FOCUS.ENTER", modality: "keyboard" })
    f.type("a")
    expect(f.state()).toBe("idle")
    f.send({ type: "FOCUS.LEAVE" })
    expect(f.state()).toBe("invalid")
    expect(f.ctx().touched).toBe(true)
  })

  it("then updates on every change", () => {
    let bad = true
    const f = make({ props: { validationMode: "blur", validate: () => (bad ? "bad" : null) } })
    f.type("a")
    f.blur()
    bad = false
    f.type("ab")
    expect(f.state()).toBe("valid")
  })

  it("does not show a missing value while tabbing through (base-ui#1425)", () => {
    const f = make({ props: { validationMode: "blur" } })
    f.element.fail("valueMissing")
    f.blur()
    f.blur()
    expect(f.state()).toBe("idle")
    f.submit()
    expect(f.state()).toBe("invalid")
    expect(f.ctx().current?.key).toBe("valueMissing")
  })

  it("shows a missing value once the value was changed at least once", () => {
    const f = make({ props: { validationMode: "blur" } })
    f.type("a")
    f.element.fail("valueMissing")
    f.type("")
    f.blur()
    expect(f.state()).toBe("invalid")
  })

  it("a parent's change does not count as the user changing the value", () => {
    const f = make({ props: { validationMode: "blur", validate: () => "bad" } })
    f.type("a", { user: false })
    f.blur()
    expect(f.state()).toBe("idle")
  })
})

describe("validation mode: change", () => {
  it("shows the error on every user change", () => {
    const f = make({ props: { validationMode: "change", validate: (v) => (v ? "bad" : null) } })
    f.type("a")
    expect(f.state()).toBe("invalid")
    f.type("")
    expect(f.state()).toBe("valid")
  })

  it("does not show a missing value while only tabbing", () => {
    const f = make({ props: { validationMode: "change" } })
    f.element.fail("valueMissing")
    f.blur()
    expect(f.state()).toBe("idle")
  })

  it("shows on a submit attempt", () => {
    const f = make({ props: { validationMode: "change" } })
    f.element.fail("valueMissing")
    f.submit()
    expect(f.state()).toBe("invalid")
  })

  it("a parent's change shows nothing until something was displayed (still quiet)", () => {
    const f = make({ props: { validationMode: "change", validate: () => "bad" } })
    f.type("a", { user: false })
    expect(f.state()).toBe("idle")
  })

  it("a displayed error re-validates on a parent's change and clears (react-spectrum#8659)", () => {
    let bad = true
    const f = make({ props: { validationMode: "change", validate: () => (bad ? "bad" : null) } })
    f.type("a")
    expect(f.state()).toBe("invalid")
    bad = false
    f.type("fixed", { user: false })
    expect(f.state()).toBe("valid")
    expect(f.element.custom()).toBe("")
  })

  it("the commit re-runs the sources", () => {
    const validate = vi.fn(() => null)
    const f = make({ props: { validate } })
    validate.mockClear()
    f.send({ type: "CONTROL.COMMIT" })
    expect(validate).toHaveBeenCalledTimes(1)
  })
})

describe("external errors", () => {
  it("are shown at once, whatever the mode", () => {
    for (const validationMode of ["submit", "blur", "change"] as const) {
      const f = make({ props: { validationMode } })
      f.setProps({ errors: ["Not available"] })
      expect(f.state()).toBe("invalid")
    }
  })

  it("are not cleared by a blur (react-spectrum#9444), a commit or a non-user change", () => {
    const f = make()
    f.setProps({ errors: ["Not available"] })
    f.blur()
    expect(f.state()).toBe("invalid")
    f.send({ type: "CONTROL.COMMIT" })
    expect(f.state()).toBe("invalid")
    f.type("other", { user: false })
    expect(f.state()).toBe("invalid")
    expect(f.ctx().external).toEqual(["Not available"])
  })

  it("are cleared by the next user change, which then runs validate (base-ui#1745, base-ui#4095)", () => {
    const validate = vi.fn((v: unknown) => (v === "b" ? "Too short" : null))
    const f = make({ props: { validate } })
    f.setProps({ errors: ["Not available"] })
    f.type("b")
    expect(f.ctx().external).toEqual([])
    expect(f.state()).toBe("invalid")
    expect(f.ctx().current).toMatchObject({ source: "validate", messages: ["Too short"] })
    expect(validate).toHaveBeenCalledWith("b", expect.anything())
  })

  it("a passing change after the server error is valid", () => {
    const f = make()
    f.setProps({ errors: ["Not available"] })
    f.type("c")
    expect(f.state()).toBe("valid")
  })

  it("removing the errors prop clears them", () => {
    const f = make()
    f.setProps({ errors: ["x"] })
    f.setProps({ errors: undefined })
    expect(f.ctx().external).toEqual([])
    expect(f.state()).toBe("valid")
  })
})

describe("async validation", () => {
  it("enters validating, keeps what is displayed, then applies the result", async () => {
    const pending: ReturnType<typeof deferred>[] = []
    const validate = () => {
      const d = deferred()
      pending.push(d)
      return d.promise
    }
    const f = make({ props: { validate, validationMode: "change" } })
    f.type("a")
    expect(f.state()).toBe("validating")
    // Nothing displayed yet.
    expect(fieldDisplay(f.state(), f.ctx(), { disabled: false, invalid: undefined })).toBe("none")
    pending.at(-1)?.resolve("Taken")
    await flush()
    expect(f.state()).toBe("invalid")
    f.type("ab")
    expect(f.state()).toBe("validating")
    // The error already displayed stays until the result arrives.
    expect(f.ctx().shown).toBe("invalid")
    expect(fieldDisplay(f.state(), f.ctx(), { disabled: false, invalid: undefined })).toBe(
      "invalid",
    )
    pending.at(-1)?.resolve(null)
    await flush()
    expect(f.state()).toBe("valid")
    expect(f.element.custom()).toBe("")
  })

  it("writes an async error to native validity", async () => {
    const f = make({ props: { validate: async () => "Taken" } })
    f.submit()
    await flush()
    expect(f.element.custom()).toBe("Taken")
  })

  it("drops a stale result: 'ab' resolving after 'abc' (spec scenario)", async () => {
    const byValue = new Map<string, ReturnType<typeof deferred>>()
    const validate = (v: unknown) => {
      const d = deferred()
      byValue.set(v as string, d)
      return d.promise
    }
    const f = make({ props: { validate, validationMode: "change" } })
    f.type("ab")
    f.type("abc")
    byValue.get("abc")?.resolve(null)
    await flush()
    expect(f.state()).toBe("valid")
    byValue.get("ab")?.resolve("Taken")
    await flush()
    expect(f.state()).toBe("valid")
    expect(f.ctx().current).toBeNull()
    expect(f.element.custom()).toBe("")
  })

  it("drops a stale result that arrives before the newer one is shown", async () => {
    const byValue = new Map<string, ReturnType<typeof deferred>>()
    const validate = (v: unknown) => {
      const d = deferred()
      byValue.set(v as string, d)
      return d.promise
    }
    const f = make({ props: { validate, validationMode: "change" } })
    f.type("ab")
    f.type("abc")
    byValue.get("ab")?.resolve("Taken")
    await flush()
    expect(f.state()).toBe("validating")
    byValue.get("abc")?.resolve(null)
    await flush()
    expect(f.state()).toBe("valid")
  })

  it("a rejected promise is shown as its message instead of being swallowed", async () => {
    // The mount call's promise is not awaited; the machine handles its rejection.
    const reject = () => Promise.reject(new Error("Network down"))
    const f = make({ props: { validate: reject } })
    f.submit()
    await flush()
    expect(f.state()).toBe("invalid")
    expect(f.ctx().current?.messages).toEqual(["Network down"])
  })

  it("REGISTER runs the sources silently: a failing validate sets native validity, stays idle", () => {
    const f = make({ props: { validate: () => "Taken" } })
    expect(f.state()).toBe("idle")
    expect(f.ctx().current).toMatchObject({ source: "validate", messages: ["Taken"] })
    expect(f.element.setCustomValidity).toHaveBeenCalled()
    expect(f.element.custom()).toBe("Taken")
  })

  it("an async validate at REGISTER is not awaited: pending stays null, state idle", async () => {
    const d = deferred()
    const f = make({ props: { validate: () => d.promise } })
    expect(f.ctx().pending).toBeNull()
    expect(f.state()).toBe("idle")
    d.resolve("Taken")
    await flush()
    expect(f.state()).toBe("idle")
    expect(f.ctx().current).toBeNull()
  })

  it("aria behaviour: required + empty is the native valueMissing cause, nothing written natively", () => {
    const f = make({ props: { validationBehavior: "aria", required: true } })
    f.submit()
    expect(f.ctx().current).toMatchObject({
      key: "valueMissing",
      messages: ["Please fill out this field."],
    })
    expect(f.element.setCustomValidity).not.toHaveBeenCalled()
  })

  it("a reset while validating drops the pending result", async () => {
    const d = deferred()
    const f = make({ props: { validate: () => d.promise } })
    f.submit()
    expect(f.state()).toBe("validating")
    f.reset("")
    d.resolve("Taken")
    await flush()
    expect(f.state()).toBe("idle")
    expect(f.element.custom()).toBe("")
  })

  it("validationDebounce 300, three characters 100 ms apart: validate runs once, 300 ms after the last", async () => {
    const validate = vi.fn(async () => null)
    const f = make({ props: { validate, validationMode: "change", validationDebounce: 300 } })
    validate.mockClear()
    f.type("a")
    await vi.advanceTimersByTimeAsync(100)
    f.type("ab")
    await vi.advanceTimersByTimeAsync(100)
    f.type("abc")
    expect(f.state()).toBe("validating")
    await vi.advanceTimersByTimeAsync(299)
    expect(validate).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(validate).toHaveBeenCalledTimes(1)
    expect(validate).toHaveBeenCalledWith("abc", expect.anything())
    await flush()
    expect(f.state()).toBe("valid")
  })

  it("a synchronous validate is debounced too and reports through the same path", async () => {
    const validate = vi.fn(() => "Taken")
    const f = make({ props: { validate, validationMode: "change", validationDebounce: 200 } })
    validate.mockClear()
    f.type("a")
    expect(validate).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(200)
    expect(validate).toHaveBeenCalledTimes(1)
    expect(f.state()).toBe("invalid")
  })

  it("an empty value is not debounced", () => {
    const validate = vi.fn(() => null)
    const f = make({ props: { validate, validationMode: "change", validationDebounce: 300 } })
    validate.mockClear()
    f.type("")
    expect(validate).toHaveBeenCalledTimes(1)
    expect(f.state()).toBe("valid")
  })

  it("is not debounced outside change mode", () => {
    const validate = vi.fn(() => null)
    const f = make({ props: { validate, validationDebounce: 300 } })
    validate.mockClear()
    f.type("abc")
    f.submit()
    expect(validate).toHaveBeenCalledTimes(2)
  })

  it("a change during the debounce cancels the earlier timer when it unmounts the state", async () => {
    const validate = vi.fn(async () => null)
    const f = make({ props: { validate, validationMode: "change", validationDebounce: 300 } })
    validate.mockClear()
    f.type("a")
    f.s.stop()
    await vi.advanceTimersByTimeAsync(1000)
    expect(validate).not.toHaveBeenCalled()
  })
})

describe("announcements", () => {
  const changeMode = (over: Partial<FieldProps> = {}) => ({
    validationMode: "change" as const,
    validate: (v: unknown) => (v === "" ? null : `bad:${String(v).length > 2 ? "long" : "short"}`),
    ...over,
  })

  it("announces the error once, politely, keyed per Field, with the label", () => {
    const f = make({ props: changeMode() })
    f.type("a")
    expect(f.log).toEqual([
      { message: "Email: bad:short", priority: "polite", key: "field-c1-error" },
    ])
  })

  it("does not repeat the same message while the user keeps typing (same message twice)", () => {
    const f = make({ props: changeMode() })
    f.type("a")
    f.type("ab")
    f.type("ab")
    expect(f.log).toHaveLength(1)
  })

  it("announces again when the displayed message changes", () => {
    const f = make({ props: changeMode() })
    f.type("a")
    f.type("abcd")
    expect(f.log.map((a) => a.message)).toEqual(["Email: bad:short", "Email: bad:long"])
  })

  it("makes no announcement when the error is cleared", () => {
    const f = make({ props: changeMode() })
    f.type("a")
    f.type("")
    expect(f.state()).toBe("valid")
    expect(f.log).toHaveLength(1)
  })

  it("announces the same message again after it was cleared in between", () => {
    const f = make({ props: changeMode() })
    f.type("a")
    f.type("")
    f.type("b")
    expect(f.log).toHaveLength(2)
  })

  it("blur mode: one announcement when the error appears after tabbing on", () => {
    const f = make({ props: changeMode({ validationMode: "blur" }) })
    f.send({ type: "FOCUS.ENTER", modality: "keyboard" })
    f.type("a")
    expect(f.log).toHaveLength(0)
    f.send({ type: "FOCUS.LEAVE" })
    expect(f.log.map((a) => a.message)).toEqual(["Email: bad:short"])
  })

  it("is skipped while the control is composing, and spoken once the composition ends", () => {
    const f = make({ props: changeMode() })
    f.type("あ", { composing: true })
    expect(f.state()).toBe("invalid")
    expect(f.log).toHaveLength(0)
    f.type("あい", { composing: false })
    expect(f.log).toHaveLength(1)
  })

  it("a failed submit that moved focus to the control makes no announcement", () => {
    const f = make({ props: { validate: () => "bad" } })
    f.send({ type: "INVALID" })
    expect(f.focus).toHaveBeenCalledWith("keyboard")
    expect(f.state()).toBe("invalid")
    expect(f.log).toHaveLength(0)
    // The flag is per step: the next change speaks normally.
    f.setProps({ validate: () => "worse" })
    f.type("x")
    expect(f.log).toHaveLength(1)
  })

  it("a failed submit does not focus (nor silence) a Field that is not first in tree order", () => {
    const f = make({ props: { validate: () => "bad" }, firstInvalid: false })
    f.send({ type: "INVALID" })
    expect(f.focus).not.toHaveBeenCalled()
    expect(f.log).toHaveLength(1)
  })

  // The control already has focus: focusing it moves nothing, so the error must be spoken
  // (react-spectrum#8328). The machine sets `focusMoved` whenever it asks the control to focus.
  it("a native invalid event on the already focused control announces once", () => {
    const f = make({ props: { validate: () => "bad" } })
    f.send({ type: "FOCUS.ENTER", modality: "keyboard" })
    f.send({ type: "INVALID" })
    expect(f.log).toHaveLength(1)
  })

  it("an attempt that does not move focus (Enter in the focused field) announces once", () => {
    const f = make({ props: { validate: () => "bad" } })
    f.send({ type: "FOCUS.ENTER", modality: "keyboard" })
    f.submit()
    expect(f.log).toHaveLength(1)
  })

  it("an asynchronous result announces when it arrives", async () => {
    const f = make({ props: { validate: async () => "Taken" } })
    f.submit()
    expect(f.log).toHaveLength(0)
    await flush()
    expect(f.log.map((a) => a.message)).toEqual(["Email: Taken"])
  })

  it("an external error that did not move focus is announced", () => {
    const f = make()
    f.setProps({ errors: ["Not available"] })
    expect(f.log.map((a) => a.message)).toEqual(["Email: Not available"])
  })

  it("uses messages.errorAnnouncement", () => {
    const f = make({
      props: {
        ...changeMode(),
        messages: { ...fieldMessages, errorAnnouncement: (l, m) => `${m} (${l})` },
      },
    })
    f.type("a")
    expect(f.log[0]?.message).toBe("bad:short (Email)")
  })

  it("an unlabelled Field announces the bare message", () => {
    const f = make({ props: changeMode({ label: () => "" }) })
    f.type("a")
    expect(f.log[0]?.message).toBe("bad:short")
  })
})

describe("flags: touched, dirty, filled", () => {
  it("touched after focus has left, not before", () => {
    const f = make()
    f.send({ type: "FOCUS.ENTER", modality: "pointer" })
    expect(f.ctx()).toMatchObject({ focused: true, touched: false })
    f.send({ type: "FOCUS.LEAVE" })
    expect(f.ctx()).toMatchObject({ focused: false, touched: true })
  })

  it("dirty is a comparison with the first registered value: back to initial is not dirty", () => {
    const f = make({ value: "hello" })
    const initial = { value: "hello" }
    expect(fieldIsDirty(f.ctx(), initial)).toBe(false)
    f.type("hello!")
    expect(fieldIsDirty(f.ctx(), initial)).toBe(true)
    f.type("hello")
    expect(fieldIsDirty(f.ctx(), initial)).toBe(false)
  })

  it("compares arrays and objects by content", () => {
    const f = make({ value: ["a", "b"] })
    const initial = { value: ["a", "b"] }
    f.type(["a", "b"])
    expect(fieldIsDirty(f.ctx(), initial)).toBe(false)
    f.type(["a"])
    expect(fieldIsDirty(f.ctx(), initial)).toBe(true)
  })

  it("the baseline is captured once per Field, not per registration", () => {
    const f = make({ value: "first" })
    f.send({ type: "CONTROL.UNREGISTER", id: "c1" })
    f.type("changed")
    f.send({ type: "CONTROL.REGISTER", control: f.control })
    // The baseline lives in the React Root and is passed in: typed while unregistered, the value
    // differs from the baseline kept from the first mount.
    expect(fieldIsDirty(f.ctx(), { value: "first" })).toBe(true)
  })

  // A remounted control shows its own value: the Field reads it again (only the baseline is
  // kept from the first registration).
  it("re-registering re-reads the value from the new control", () => {
    const f = make({ value: "first" })
    f.send({ type: "CONTROL.UNREGISTER", id: "c1" })
    f.type("first!")
    // The new control starts at the baseline text again.
    f.shows("first")
    f.send({ type: "CONTROL.REGISTER", control: f.control })
    expect(fieldIsDirty(f.ctx(), { value: "first" })).toBe(false)
  })

  it("a Field that never registered is not dirty", () => {
    const f = make({ register: false })
    expect(fieldIsDirty(f.ctx(), null)).toBe(false)
  })

  it("filled is a non-empty value", () => {
    const f = make()
    expect(fieldIsFilled(f.ctx())).toBe(false)
    f.type("a")
    expect(fieldIsFilled(f.ctx())).toBe(true)
    f.type("")
    expect(fieldIsFilled(f.ctx())).toBe(false)
    f.type([])
    expect(fieldIsFilled(f.ctx())).toBe(false)
    f.type(["x"])
    expect(fieldIsFilled(f.ctx())).toBe(true)
    f.type(null)
    expect(fieldIsFilled(f.ctx())).toBe(false)
    f.type(0)
    expect(fieldIsFilled(f.ctx())).toBe(true)
  })

  it("unregistering another control's id keeps the registration", () => {
    const f = make()
    f.send({ type: "CONTROL.UNREGISTER", id: "other" })
    expect(f.registered()).toBe(f.control)
    f.send({ type: "CONTROL.UNREGISTER", id: "c1" })
    expect(f.registered()).toBeNull()
  })
})

describe("reset", () => {
  it("clears the displayed error, the flags, the custom validity and the external errors", () => {
    const f = make({ value: "x", props: { validate: () => "bad" } })
    f.setProps({ errors: ["Server"] })
    f.type("y")
    f.blur()
    f.submit()
    expect(f.ctx()).toMatchObject({ touched: true, attempted: true, changed: true })
    f.reset("")
    expect(f.state()).toBe("idle")
    expect(f.ctx()).toMatchObject({
      touched: false,
      attempted: false,
      changed: false,
      external: [],
      current: null,
      shown: "none",
      announced: null,
    })
    expect(f.element.custom()).toBe("")
  })

  it("re-reads filled and the value from the control after it reset (base-ui#5765)", () => {
    const f = make({ value: "text" })
    f.type("text2")
    expect(fieldIsFilled(f.ctx())).toBe(true)
    f.reset("")
    expect(fieldIsFilled(f.ctx())).toBe(false)
  })

  it("is quiet again afterwards (submit mode needs a new attempt)", () => {
    const f = make({ props: { validate: () => "bad" } })
    f.submit()
    f.reset("")
    f.type("x")
    expect(f.state()).toBe("idle")
  })

  it("announces the same message again after a reset", () => {
    const f = make({ props: { validate: () => "bad" } })
    f.submit()
    f.reset("")
    f.submit()
    expect(f.log).toHaveLength(2)
  })
})

describe("robustness", () => {
  it("events with no registered control do not throw (base-ui#2228)", () => {
    const f = make({ register: false, props: { validate: () => "bad" } })
    for (const type of ["INVALID", "SUBMIT.ATTEMPT", "FOCUS.LEAVE", "CONTROL.COMMIT"] as const) {
      expect(() => f.send({ type })).not.toThrow()
    }
    expect(() => f.send({ type: "RESET" })).not.toThrow()
  })

  it("a removed control is not focused on a later failed submit", () => {
    const f = make({ props: { validate: () => "bad" } })
    f.send({ type: "CONTROL.UNREGISTER", id: "c1" })
    f.send({ type: "INVALID" })
    expect(f.focus).not.toHaveBeenCalled()
  })

  it("a control whose element left its form is not focused", () => {
    const f = make()
    ;(f.element.el as { form: unknown }).form = null
    f.send({ type: "INVALID" })
    expect(f.focus).not.toHaveBeenCalled()
  })
})
