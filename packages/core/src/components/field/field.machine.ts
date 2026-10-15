// Field (design §2). States are the DISPLAY, not the realtime result: the current error is
// always computed (`evaluate`) and written to native validity, but the machine only moves to
// `valid` / `invalid` when the display gate allows it. Every input event first updates the
// context and runs the sources, then queues DECIDE, whose guards read the fresh context.

import type { Modality } from "../../contract/env"
import type { ConstraintElement, ValidityKey } from "../../dom/constraint-validity"
import type { AnnouncerEnv, SchedulerEnv } from "../../env/capabilities"
import type { ValidityEnv } from "../../env/dom-environment"
import { setup, type } from "../../machine/setup"
import type { FieldMessages } from "./field.messages"

export type ValidationResult = string | readonly string[] | null | undefined
export type Validate = (
  value: unknown,
  values: Readonly<Record<string, unknown>>,
) => ValidationResult | Promise<ValidationResult>

export type ValidationMode = "submit" | "blur" | "change"
export type ValidationBehavior = "native" | "aria"

/** What a form control gives its Field when it registers (field-control). */
export interface RegisteredControl {
  readonly id: string
  /** Whether its focusable element is labelable (`for`), else `aria-labelledby`. */
  readonly labelable: boolean
  /** Moves focus to the element a user would fix, with this modality. */
  focus(modality: Modality): void
  /** The native validity element: the input itself, or its hidden input. */
  validityElement(): ConstraintElement | null
  /** The typed value now. */
  value(): unknown
}

export type FieldEvent =
  | { readonly type: "CONTROL.REGISTER"; readonly control: RegisteredControl }
  | { readonly type: "CONTROL.UNREGISTER"; readonly id: string }
  | {
      readonly type: "CONTROL.CHANGE"
      readonly value: unknown
      readonly user: boolean
      readonly composing: boolean
    }
  | { readonly type: "CONTROL.COMMIT" }
  | { readonly type: "FOCUS.ENTER"; readonly modality: Modality }
  | { readonly type: "FOCUS.LEAVE" }
  | { readonly type: "INVALID" }
  | { readonly type: "SUBMIT.ATTEMPT" }
  | { readonly type: "VALIDATED"; readonly token: number; readonly result: ValidationResult }
  | { readonly type: "ERRORS.EXTERNAL" }
  | { readonly type: "INVALID.PROP" }
  /** `disabled` or `validationMode` changed: re-evaluate the display. */
  | { readonly type: "PROPS.CHANGE" }
  | { readonly type: "RESET" }
  | { readonly type: "DECIDE" }

export interface FieldProps {
  readonly name?: string | undefined
  readonly disabled?: boolean | undefined
  readonly readOnly?: boolean | undefined
  readonly required?: boolean | undefined
  /** `true` forces invalid (no message), `false` forces valid, `undefined` validates. */
  readonly invalid?: boolean | undefined
  /** External errors (server errors from Form): shown at once, cleared by the next change. */
  readonly errors?: readonly string[] | undefined
  readonly validate?: Validate | undefined
  readonly validationMode: ValidationMode
  readonly validationBehavior: ValidationBehavior
  /** Delays `validate` for non-empty values typed in `change` mode (ms). */
  readonly validationDebounce?: number | undefined
  readonly messages: FieldMessages
  /** The Label's text, for the announcement. */
  readonly label: () => string
  /** Every named Field's value in the same form. */
  readonly formValues: () => Readonly<Record<string, unknown>>
  /**
   * The registered control, read live (not an event: a StrictMode stop/start between a
   * registration and the next input would drop it).
   */
  readonly control: () => RegisteredControl | null
}

/** The current (realtime) error and where it came from. */
export interface FieldError {
  readonly source: "invalid" | "external" | "native" | "validate"
  readonly messages: readonly string[]
  readonly key: ValidityKey | null
}

export interface FieldContext {
  value: unknown
  touched: boolean
  focused: boolean
  /** A submit attempt happened (submit, native `invalid`, Form's `validate()`). */
  attempted: boolean
  /** The value was changed by the user at least once (the pristine `valueMissing` rule). */
  changed: boolean
  composing: boolean
  external: readonly string[]
  current: FieldError | null
  /** A validation result is awaited: a promise, or "debounce" before `validate` runs. */
  pending: Promise<ValidationResult> | "debounce" | null
  token: number
  /** What is displayed (kept while validating). */
  shown: "none" | "valid" | "invalid"
  announced: string | null
  /** A failed submission moved focus to the control in this step: no announcement. */
  focusMoved: boolean
}

type Env = AnnouncerEnv & SchedulerEnv & ValidityEnv

const isEmpty = (v: unknown) =>
  v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)

const toMessages = (r: ValidationResult): readonly string[] =>
  r === null || r === undefined ? [] : typeof r === "string" ? (r ? [r] : []) : r

const isThenable = (v: unknown): v is Promise<ValidationResult> =>
  typeof (v as { then?: unknown } | null)?.then === "function"

/** Whether `a` and `b` are the same value (arrays and plain objects by content). */
const same = (a: unknown, b: unknown) =>
  Object.is(a, b) ||
  (typeof a === "object" && typeof b === "object" && JSON.stringify(a) === JSON.stringify(b))

/** The value differs from the baseline (the value at the Field's first registration). */
export const fieldIsDirty = (
  c: Pick<FieldContext, "value">,
  initial: { readonly value: unknown } | null,
) => initial !== null && !same(c.value, initial.value)
export const fieldIsFilled = (c: Pick<FieldContext, "value">) => !isEmpty(c.value)

export const fieldMachine = setup({
  types: type<{
    props: FieldProps
    events: FieldEvent
    env: Env
    context: FieldContext
  }>(),
  guards: {
    pendingAsync: ({ context }) => context.pending !== null,
    /** `invalid` went back to undefined: nothing shown until the next validation (base-ui#3777). */
    invalidReleased: ({ props }) => props.invalid === undefined,
    isStale: ({ context, event }) => event.type === "VALIDATED" && event.token !== context.token,
    hasError: ({ context }) => context.current !== null,
    displayAllowed: ({ context, props }) => {
      if (props.disabled) return false
      if (props.invalid !== undefined || context.external.length > 0) return true
      // Once displayed, every change re-validates and updates the display.
      if (context.shown !== "none" || context.attempted) return true
      if (props.validationMode === "submit") return false
      // A missing value is not shown while tabbing through (base-ui#1425).
      if (!context.changed) return false
      return props.validationMode === "change" || context.touched
    },
  },
  actions: {
    /** A (re)registered control: its value now (a remount may have changed it). */
    syncValue: ({ props, set }) => {
      const control = props.control()
      if (control) set("value", control.value())
    },
    recordChange: ({ event, set }) => {
      if (event.type !== "CONTROL.CHANGE") return
      set("value", event.value)
      set("composing", event.composing)
      if (event.user) {
        set("changed", true)
        // External errors go with the next accepted user change (base-ui#1745).
        set("external", [])
      }
    },
    enter: ({ set }) => set("focused", true),
    leave: ({ set }) => {
      set("focused", false)
      set("touched", true)
    },
    attempt: ({ set }) => set("attempted", true),
    takeExternal: ({ props, set }) => set("external", props.errors ?? []),
    /** Runs the sources in order and writes the result to native validity. */
    evaluate: ({ context, props, env, event, set }) => {
      const el = props.control()?.validityElement() ?? null
      const native = props.validationBehavior === "native"
      const write = (messages: readonly string[]) => {
        if (el && native && messages.length > 0) env.validity.setOwn(el, messages.join("\n"))
      }
      // Our own message must not mask the native constraints we read next.
      if (el) env.validity.clearOwn(el)
      set("token", context.token + 1)
      set("pending", null)
      if (props.invalid === true) {
        set("current", { source: "invalid", messages: [], key: null })
        write([props.messages.invalid])
        return
      }
      if (props.invalid === false) return set("current", null)
      const external = event.type === "ERRORS.EXTERNAL" ? (props.errors ?? []) : context.external
      if (external.length > 0) {
        set("current", { source: "external", messages: external, key: null })
        return write(external)
      }
      const reading = el ? env.validity.read(el) : null
      if (reading && !reading.valid) {
        const override = reading.key ? props.messages[reading.key] : undefined
        set("current", {
          source: "native",
          messages: [override ?? reading.message],
          key: reading.key,
        })
        if (override) write([override])
        return
      }
      // `aria` behaviour sets no `required` attribute: an empty required value is still the
      // native "valueMissing" cause, with the browser's message.
      if (props.validationBehavior === "aria" && props.required && isEmpty(context.value)) {
        set("current", {
          source: "native",
          messages: [
            props.messages.valueMissing ??
              (el ? env.validity.requiredMessage(el) : props.messages.invalid),
          ],
          key: "valueMissing",
        })
        return
      }
      if (!props.validate) return set("current", null)
      const debounce =
        (props.validationDebounce ?? 0) > 0 &&
        props.validationMode === "change" &&
        event.type === "CONTROL.CHANGE" &&
        event.user &&
        !isEmpty(context.value)
      if (debounce) return set("pending", "debounce")
      const result = props.validate(context.value, props.formValues())
      if (isThenable(result)) return set("pending", result)
      const messages = toMessages(result)
      set("current", messages.length ? { source: "validate", messages, key: null } : null)
      write(messages)
    },
    applyValidated: ({ event, props, env, set }) => {
      if (event.type !== "VALIDATED") return
      set("pending", null)
      const messages = toMessages(event.result)
      set("current", messages.length ? { source: "validate", messages, key: null } : null)
      const el = props.control()?.validityElement() ?? null
      if (el && props.validationBehavior === "native" && messages.length > 0) {
        env.validity.setOwn(el, messages.join("\n"))
      }
    },
    /** A failed submission focuses only the first invalid control in tree order. */
    focusIfFirst: ({ context, props, env, set }) => {
      const control = props.control()
      const el = control?.validityElement()
      if (!control || !el?.form) return
      if (env.validity.firstInvalid(el.form) !== el) return
      control.focus("keyboard")
      // Only a real move speaks the error itself; Enter in the focused field did not move
      // focus, so it is announced (react-spectrum#8328).
      if (!context.focused) set("focusMoved", true)
    },
    decide: ({ send }) => send({ type: "DECIDE" }),
    /** A mount-time check never enters `validating` (an async result is not awaited). */
    dropPending: ({ context, set }) => {
      // Not awaited: a rejection must not surface as an unhandled one.
      if (context.pending instanceof Promise) context.pending.catch(() => {})
      set("pending", null)
    },
    showInvalid: ({ set }) => set("shown", "invalid"),
    showValid: ({ set }) => {
      set("shown", "valid")
      set("announced", null)
    },
    showNone: ({ set }) => {
      set("shown", "none")
      set("announced", null)
    },
    /** Once per distinct displayed message; never after focus moved, never while composing. */
    announce: ({ context, props, env, set }) => {
      const message = context.current?.messages.join(" ") ?? ""
      const skip =
        !message || context.focusMoved || context.composing || message === context.announced
      set("focusMoved", false)
      if (skip) return
      set("announced", message)
      env.announcer.announce({
        message: props.messages.errorAnnouncement(props.label(), message),
        priority: "polite",
        key: `field-${props.control()?.id ?? props.name ?? "field"}-error`,
      })
    },
    clearStepFlags: ({ set }) => set("focusMoved", false),
    reset: ({ context, props, env, set }) => {
      const el = props.control()?.validityElement() ?? null
      if (el) env.validity.clearOwn(el)
      set("touched", false)
      set("attempted", false)
      set("changed", false)
      set("external", [])
      set("current", null)
      set("pending", null)
      set("token", context.token + 1)
      set("shown", "none")
      set("announced", null)
      // Re-read after the control reset (the adapter sends RESET after it).
      const control = props.control()
      if (control) set("value", control.value())
    },
  },
  effects: {
    /** External errors given at mount are shown at once (onProps only sees changes). */
    initialErrors: ({ props, send }) => {
      if (props.errors?.length) send({ type: "ERRORS.EXTERNAL" })
      return undefined
    },
    /** Awaits the pending result (after the debounce), then reports it with its token. */
    awaitValidation: ({ context, props, env, send }) => {
      const token = context.token
      let live = true
      const report = (result: ValidationResult) => {
        if (live) send({ type: "VALIDATED", token, result })
      }
      const settle = (p: Promise<ValidationResult>) =>
        p.then(report, (e: unknown) => report(e instanceof Error ? e.message : String(e)))
      let timer: ReturnType<Env["scheduler"]["setTimeout"]> | null = null
      if (context.pending === "debounce") {
        timer = env.scheduler.setTimeout(() => {
          const r = props.validate?.(context.value, props.formValues())
          if (isThenable(r)) void settle(r)
          else report(r)
        }, props.validationDebounce ?? 0)
      } else if (context.pending) void settle(context.pending)
      return () => {
        live = false
        if (timer !== null) env.scheduler.clearTimeout(timer)
      }
    },
  },
}).machine({
  id: "field",
  initial: "idle",
  onProps: {
    errors: "ERRORS.EXTERNAL",
    invalid: "INVALID.PROP",
    disabled: "PROPS.CHANGE",
    validationMode: "PROPS.CHANGE",
  },
  effects: ["initialErrors"],
  context: () => ({
    value: undefined,
    touched: false,
    focused: false,
    attempted: false,
    changed: false,
    composing: false,
    external: [],
    current: null,
    pending: null,
    token: 0,
    shown: "none",
    announced: null,
    focusMoved: false,
  }),
  on: {
    // Evaluated at once (nothing displayed): native validity is right from mount, so an
    // untouched Field with a failing `validate` blocks submission.
    "CONTROL.REGISTER": { actions: ["syncValue", "evaluate", "dropPending"] },
    "CONTROL.UNREGISTER": {},
    "CONTROL.CHANGE": { actions: ["recordChange", "evaluate", "decide"] },
    "CONTROL.COMMIT": { actions: ["evaluate", "decide"] },
    "FOCUS.ENTER": { actions: ["enter"] },
    "FOCUS.LEAVE": { actions: ["leave", "evaluate", "decide"] },
    INVALID: { actions: ["attempt", "evaluate", "focusIfFirst", "decide"] },
    "SUBMIT.ATTEMPT": { actions: ["attempt", "evaluate", "decide"] },
    "ERRORS.EXTERNAL": { actions: ["takeExternal", "evaluate", "decide"] },
    "INVALID.PROP": [
      { guard: "invalidReleased", target: "idle", actions: ["evaluate", "showNone"] },
      { actions: ["evaluate", "decide"] },
    ],
    VALIDATED: [{ guard: "isStale" }, { actions: ["applyValidated", "decide"] }],
    "PROPS.CHANGE": { actions: ["evaluate", "decide"] },
    RESET: { target: "idle", actions: ["reset"] },
    DECIDE: [
      { guard: "pendingAsync", target: "validating", reenter: true },
      { guard: { not: "displayAllowed" }, target: "idle", actions: ["showNone"] },
      { guard: "hasError", target: "invalid", actions: ["showInvalid", "announce"] },
      { target: "valid", actions: ["showValid", "clearStepFlags"] },
    ],
  },
  states: {
    idle: {},
    validating: { effects: ["awaitValidation"] },
    valid: {},
    invalid: {},
  },
})

export type FieldMachine = typeof fieldMachine
