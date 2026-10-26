"use client"

// Pin Input parts: wiring only. The machine owns the value and the caret; edit-plan decides
// every insertion; connect every attribute. Native listeners (not React's synthetic ones):
// `beforeinput` to plan insertions, `input` so script fills are seen (input-otp#152).

import {
  type FieldMessages,
  focusSafely,
  injectStyle,
  type MessageOverrides,
  mergeFieldProps,
  type PinInputEvent,
  type PinInputMessages,
  type PinInputReason,
  type PinValidationType,
  pinInputConnect,
  pinInputMachine,
  pinInputMessages,
  pinInputStyle,
  planEdit,
  renderedValue,
  type Validate,
  type ValidationBehavior,
  type ValidationMode,
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createContext,
  type KeyboardEvent,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
} from "react"
import { useFieldBindingPeek, useFieldControl } from "../field/field"
import { FieldHost, HostDescription, HostErrorMessage, HostLabel } from "../field/use-field-host"
import { useFieldsetDisabled } from "../fieldset/fieldset"
import { joinHandlers } from "../join-handlers"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare const process: { env: { NODE_ENV?: string } }

declare module "../provider" {
  interface RindMessageScopes {
    "pin-input": PinInputMessages
  }
}

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect
export interface PinInputChangeDetails {
  readonly reason: PinInputReason
}

export interface PinInputState {
  readonly value: string
  readonly complete: boolean
  readonly composing: boolean
  readonly focused: boolean
}

type Machine = ReturnType<typeof useMachine<typeof pinInputMachine>>

interface Ctx {
  readonly instance: string
  readonly view: Machine["view"]
  readonly send: Machine["send"]
  readonly length: number
  readonly rules: {
    readonly length: number
    readonly validationType: PinValidationType | undefined
    readonly pattern: RegExp | undefined
    readonly sanitize: ((t: string) => string) | undefined
  }
  readonly mask: boolean
  readonly maskChar: string
  readonly autoComplete: string
  readonly enterKeyHint: string | undefined
  readonly form: string | undefined
  readonly dir: "ltr" | "rtl" | undefined
  readonly disabled: boolean
  readonly readOnly: boolean
  readonly defaultValue: string
  readonly inputEl: { current: HTMLInputElement | null }
  readonly pendingCaret: { current: number | null }
  readonly pendingSubmit: { current: boolean }
  readonly slots: { current: number }
  /** The next value change is the user's (a reset or a parent's value is not). */
  readonly userChange: { current: boolean }
}

const PinInputContext = createContext<Ctx | null>(null)
function usePinInput(part: string): Ctx {
  const ctx = useContext(PinInputContext)
  if (!ctx) throw new Error(`PinInput.${part} must be inside PinInput.Root`)
  return ctx
}

export type PinInputRootProps = Omit<
  ComponentPropsWithRef<"div">,
  "children" | "defaultValue" | "onChange" | "dir"
> & {
  /** The Field parts, the Control and its Input and Slots. */
  readonly children?: ReactNode
  /** The number of characters (a positive integer). */
  readonly length: number
  /** Controlled; `null` and `undefined` render empty (ark#3573). */
  readonly value?: string | null | undefined
  readonly defaultValue?: string
  readonly onValueChange?: (value: string, details: PinInputChangeDetails) => void
  /** An insertion was refused (its text). */
  readonly onValueInvalid?: (text: string) => void
  /** A user change completed the code. */
  readonly onValueComplete?: (value: string) => void
  /** Default `"numeric"`. */
  readonly validationType?: PinValidationType
  /** One accepted character (replaces `validationType`); characters of the Basic Multilingual Plane only (no emoji). */
  readonly pattern?: RegExp
  /** Applied after NFKC (e.g. `(t) => t.toUpperCase()`). */
  readonly sanitize?: (text: string) => string
  readonly mask?: boolean
  readonly maskChar?: string
  /** Default `"one-time-code"`. */
  readonly autoComplete?: string
  /** Submits the form once a user change completes the code (`requestSubmit`, no focus moves). */
  readonly autoSubmit?: boolean
  readonly enterKeyHint?: "enter" | "done" | "go" | "next" | "previous" | "search" | "send"
  /** The id of the form the input belongs to. */
  readonly form?: string
  /** The consumer's direction; the code itself is always laid out left to right. Default: `"ltr"`. */
  readonly dir?: "ltr" | "rtl"
  /** Message overrides (the Pin Input has no string of its own; see `fieldMessages`). */
  readonly messages?: MessageOverrides<PinInputMessages>
  // Field props (the Root is a Field when not inside one).
  /** The input's form name; the key of `validate`'s values. */
  readonly name?: string
  /** Disables the input; no validity is displayed. */
  readonly disabled?: boolean
  /** Makes the input read-only. */
  readonly readOnly?: boolean
  /** Native `required` (`aria-required` in `aria` behaviour): an incomplete code is invalid. */
  readonly required?: boolean
  /** `true` forces invalid, `false` valid; `undefined` validates. */
  readonly invalid?: boolean
  /** External errors (server): shown at once, cleared by the next change. */
  readonly errors?: readonly string[]
  /** Runs after native constraints pass. */
  readonly validate?: Validate
  /** When errors are displayed. Default: `"submit"`. */
  readonly validationMode?: ValidationMode
  /** Whether an invalid Field blocks submission. Default: `"native"`. */
  readonly validationBehavior?: ValidationBehavior
  /** Delays `validate` in `change` mode (ms). */
  readonly validationDebounce?: number
  /** The Field's announcement and per-constraint messages. */
  readonly fieldMessages?: MessageOverrides<FieldMessages>
}

/** Machine events → the public reasons. */
function publicReason(event: PinInputEvent): PinInputReason {
  if (event.type === "EDIT") return event.edit.reason
  if (event.type === "INPUT") return event.reason
  if (event.type === "RESET") return "RESET"
  return "INPUT"
}

function Root(all: PinInputRootProps) {
  const {
    length,
    value,
    defaultValue = "",
    onValueChange,
    onValueInvalid,
    onValueComplete,
    validationType,
    pattern,
    sanitize,
    mask = false,
    maskChar = "•",
    autoComplete = "one-time-code",
    autoSubmit = false,
    enterKeyHint,
    form,
    dir,
    messages: ownMessages,
    fieldMessages: ownFieldMessages,
    children,
    id,
    ...fieldProps
  } = all
  const env = useEnvironment()
  const generated = useId()
  const instance = id ?? generated
  const messages = useMessages("pin-input", pinInputMessages, ownMessages)
  const enclosing = useFieldBindingPeek()
  const fieldsetDisabled = useFieldsetDisabled()
  const disabled =
    fieldProps.disabled === true || enclosing?.state.disabled === true || fieldsetDisabled
  const readOnly = fieldProps.readOnly === true || enclosing?.state.readOnly === true
  const rules = { length, validationType, pattern, sanitize }
  // `value` present but null/undefined is a controlled empty value (ark#3573).
  const controlled = "value" in all
  const shown = controlled ? renderedValue(rules, value) : undefined
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return
    if (!Number.isInteger(length) || length < 1) {
      console.warn(`[rind-ui] pin-input: length must be a positive integer (got ${length}).`)
    }
  }, [length])
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" &&
      controlled &&
      typeof value === "string" &&
      value !== shown
    ) {
      console.warn(
        `[rind-ui] pin-input: the controlled value "${value}" is rendered as "${shown}" (length ${length}, rejected characters dropped).`,
      )
    }
  }, [controlled, value, shown, length])
  const inputEl = useRef<HTMLInputElement | null>(null)
  const pendingCaret = useRef<number | null>(null)
  const pendingSubmit = useRef(false)
  const userChange = useRef(false)
  const slots = useRef(0)
  const latest = useRef({ onValueChange, onValueInvalid, onValueComplete })
  latest.current = { onValueChange, onValueInvalid, onValueComplete }
  const { view, send } = useMachine(pinInputMachine, {
    ...rules,
    value: shown,
    defaultValue: renderedValue(rules, defaultValue),
    onValueChange: (v, details) => {
      const event = (details as { event: PinInputEvent }).event
      userChange.current = event.type !== "RESET"
      latest.current.onValueChange?.(v, { reason: publicReason(event) })
    },
    onValueInvalid: (t) => latest.current.onValueInvalid?.(t),
    onValueComplete: (v) => latest.current.onValueComplete?.(v),
    autoSubmit,
    disabled,
    readOnly,
    messages,
    id: instance,
    writeCaret: (index) => {
      pendingCaret.current = index
    },
    resync: () => {
      // The value React renders is already right; the DOM may hold the browser's write.
      const el = inputEl.current
      const current = view.values.value
      if (el && el.value !== current) el.value = current
    },
    // After the completed value is rendered (the form must validate the full code).
    requestSubmit: () => {
      pendingSubmit.current = true
    },
  })
  // Every rendered slot counts; the number must match `length`.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" && slots.current !== length) {
      console.warn(
        `[rind-ui] pin-input: length is ${length} but ${slots.current} Slots are rendered.`,
      )
    }
  }, [length])
  const modality = useModality(env.modality, view.context.focused)
  const ctx: Ctx = {
    instance,
    view,
    send,
    length,
    rules,
    mask,
    maskChar,
    autoComplete,
    enterKeyHint,
    form,
    dir,
    disabled,
    readOnly,
    defaultValue,
    inputEl,
    pendingCaret,
    pendingSubmit,
    slots,
    userChange,
  }
  const api = useApi(ctx, enclosing, modality)
  const root = api.root()
  const rootData = Object.fromEntries(
    Object.entries(root).filter(
      ([k]) =>
        k.startsWith("data-") && k !== "data-scope" && k !== "data-part" && k !== "data-instance",
    ),
  )
  return (
    <FieldHost
      scope="pin-input"
      id={instance}
      dir={(root["dir"] as string | undefined) ?? "ltr"}
      {...fieldProps}
      {...(ownFieldMessages ? { messages: ownFieldMessages } : {})}
      {...rootData}
    >
      <PinInputContext value={ctx}>{children}</PinInputContext>
    </FieldHost>
  )
}

function useApi(
  ctx: Ctx,
  binding: ReturnType<typeof useFieldBindingPeek>,
  modality: ReturnType<typeof useModality>,
) {
  const field = mergeFieldProps(
    { role: "textbox", labelable: true, disabled: ctx.disabled, readOnly: ctx.readOnly },
    binding,
  )
  return pinInputConnect({
    ...ctx.rules,
    instance: ctx.instance,
    value: ctx.view.values.value,
    caret: ctx.view.context.caret,
    focused: ctx.view.context.focused,
    modality,
    composing: ctx.view.matches("composing"),
    field,
    fieldData: binding?.data,
    mask: ctx.mask,
    maskChar: ctx.maskChar,
    autoComplete: ctx.autoComplete,
    enterKeyHint: ctx.enterKeyHint,
    form: ctx.form,
    dir: ctx.dir,
  })
}

const stateOf = (ctx: Ctx): PinInputState => ({
  value: ctx.view.values.value,
  complete: ctx.view.values.value.length === ctx.length,
  composing: ctx.view.matches("composing"),
  focused: ctx.view.context.focused,
})

function Control({
  render,
  ...rest
}: ComponentPropsWithRef<"div"> & {
  /** Another element or a render function receiving the props and the Pin Input's state. */
  readonly render?: RenderProp<PinInputState>
}) {
  const ctx = usePinInput("Control")
  const env = useEnvironment()
  const modality = useModality(env.modality, ctx.view.context.focused)
  const api = useApi(ctx, useFieldBindingPeek(), modality)
  return renderPart("div", mergeProps(normalizeProps(api.control()), rest), render, stateOf(ctx))
}

/** The slot whose box holds `x` (nearest when between two), by `data-instance`. */
function slotAt(input: HTMLInputElement, instance: string, x: number): number | null {
  const control = input.parentElement
  if (!control) return null
  // A press outside the control (a synthetic click without coordinates) is not on a slot.
  const box = control.getBoundingClientRect()
  if (box.width > 0 && (x < box.left || x > box.right)) return null
  let best: { index: number; distance: number } | null = null
  let laidOut = false
  for (const el of control.querySelectorAll<HTMLElement>(
    `[data-scope="pin-input"][data-part="slot"][data-instance="${CSS.escape(instance)}"]`,
  )) {
    const r = el.getBoundingClientRect()
    if (r.width > 0) laidOut = true
    const distance = x < r.left ? r.left - x : x > r.right ? x - r.right : 0
    const index = Number(el.dataset["index"])
    if (!best || distance < best.distance) best = { index, distance }
  }
  // No layout (jsdom): the browser's own caret placement stands.
  return laidOut ? (best?.index ?? null) : null
}

function Input({
  render,
  ref,
  id,
  ...rest
}: Omit<ComponentPropsWithRef<"input">, "value" | "defaultValue" | "type"> & {
  /** Another element or a render function receiving the props and the Pin Input's state. */
  readonly render?: RenderProp<PinInputState>
}) {
  const ctx = usePinInput("Input")
  const env = useEnvironment()
  const binding = useFieldControl()
  const modality = useModality(env.modality, ctx.view.context.focused)
  const api = useApi(ctx, binding, modality)
  const controlId = id ?? binding?.controlId ?? `pin-input-${ctx.instance}-input`.replace(/:/g, "")
  const { send } = ctx
  const register = binding?.register
  useIsoLayoutEffect(() => {
    injectStyle(ctx.inputEl.current?.ownerDocument, "pin-input", pinInputStyle, env)
    if (!register) return
    return register(
      {
        id: controlId,
        labelable: true,
        focus: (m) => {
          if (ctx.inputEl.current) void focusSafely(ctx.inputEl.current, env, "programmatic", m)
        },
        // The input is the form control: its own validity (valueMissing, patternMismatch).
        validityElement: () => ctx.inputEl.current,
        value: () => ctx.view.values.value,
      },
      controlId,
    )
  }, [register, controlId, env])
  // Each applied change is reported to the Field once.
  const value = ctx.view.values.value
  const reported = useRef(value)
  const report = binding?.report
  useEffect(() => {
    if (reported.current === value) return
    reported.current = value
    // A reset or a parent's value is reported too, but not as the user's (RA#6830).
    const user = ctx.userChange.current
    ctx.userChange.current = false
    report?.({ type: "change", value, user, composing: false })
  }, [value, report, ctx.userChange])
  // After every commit: the DOM shows the value, the planned caret is placed, and a pending
  // auto-submit runs against the full code.
  useIsoLayoutEffect(() => {
    const el = ctx.inputEl.current
    if (!el) return
    // The DOM text follows the value between compositions (an IME owns it meanwhile).
    if (el.value !== value && !ctx.view.matches("composing")) el.value = value
    // Kept until the input has focus (a press focuses it after the caret was planned).
    const caret = ctx.pendingCaret.current
    if (caret !== null && el.ownerDocument.activeElement === el) {
      el.setSelectionRange(caret, caret)
      ctx.pendingCaret.current = null
    }
    if (ctx.pendingSubmit.current) {
      ctx.pendingSubmit.current = false
      el.form?.requestSubmit()
    }
  })
  const latest = useRef(ctx)
  latest.current = ctx
  useEffect(() => {
    const el = ctx.inputEl.current
    if (!el) return
    const onBeforeInput = (e: Event) => {
      const ie = e as InputEvent
      const c = latest.current
      if (c.view.matches("composing") || ie.isComposing) return
      if (ie.inputType === "insertCompositionText") return
      const data = ie.data ?? ie.dataTransfer?.getData("text/plain") ?? null
      const start = el.selectionStart ?? el.value.length
      const end = el.selectionEnd ?? start
      const plan = planEdit(
        c.view.values.value,
        [start, end],
        { inputType: ie.inputType, data },
        c.rules,
      )
      if (plan.accept && plan.edit === null) return
      e.preventDefault()
      c.send(plan.accept ? { type: "EDIT", edit: plan.edit } : { type: "INVALID", text: plan.text })
    }
    const onInput = (e: Event) => {
      const c = latest.current
      const ie = e as Partial<InputEvent>
      if (c.view.matches("composing") || ie.isComposing) return
      if (el.value === c.view.values.value) return
      const native = typeof ie.inputType === "string" && /^(delete|history)/.test(ie.inputType)
      c.send({ type: "INPUT", text: el.value, reason: native ? "INPUT" : "AUTOFILL" })
    }
    // A key an IME owns (isComposing, keyCode 229) never moves the active slot. Its
    // selectionchange arrives as a later task, so the flag holds until the next own key,
    // a press or the composition's end.
    let imeKey = false
    const onKeyDown = (e: Event) => {
      const k = e as globalThis.KeyboardEvent
      imeKey = k.isComposing || k.keyCode === 229
    }
    const onSettled = () => {
      imeKey = false
    }
    const onSelection = () => {
      const c = latest.current
      if (imeKey || el.ownerDocument.activeElement !== el || el.selectionStart === null) return
      if (el.selectionStart !== c.view.context.caret) {
        c.send({ type: "CARET", index: el.selectionStart })
      }
    }
    const onPointerDown = (e: PointerEvent) => {
      const c = latest.current
      if (e.button !== 0 || c.disabled) return
      const index = slotAt(el, c.instance, e.clientX)
      if (index === null) return
      // No native caret placement: the caret goes to the slot under the press.
      e.preventDefault()
      if (el.ownerDocument.activeElement !== el) void focusSafely(el, env, "programmatic")
      c.send({
        type: "SLOT.PRESS",
        index,
        modality: e.pointerType === "touch" ? "touch" : "pointer",
      })
    }
    // A form reset: the current defaultValue comes back (read once dispatch ended).
    const formEl = el.form
    const onReset = (e: Event) =>
      env.scheduler.setTimeout(() => {
        if (!e.defaultPrevented) latest.current.send({ type: "RESET" })
      }, 0)
    el.addEventListener("beforeinput", onBeforeInput)
    el.addEventListener("input", onInput)
    el.addEventListener("pointerdown", onPointerDown)
    el.addEventListener("keydown", onKeyDown, true)
    el.addEventListener("pointerdown", onSettled, true)
    el.addEventListener("compositionend", onSettled)
    el.ownerDocument.addEventListener("selectionchange", onSelection)
    formEl?.addEventListener("reset", onReset)
    return () => {
      el.removeEventListener("beforeinput", onBeforeInput)
      el.removeEventListener("input", onInput)
      el.removeEventListener("pointerdown", onPointerDown)
      el.removeEventListener("keydown", onKeyDown, true)
      el.removeEventListener("pointerdown", onSettled, true)
      el.removeEventListener("compositionend", onSettled)
      el.ownerDocument.removeEventListener("selectionchange", onSelection)
      formEl?.removeEventListener("reset", onReset)
    }
  }, [ctx.inputEl, env])
  const handlers = {
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => {
      // Enter is never prevented (zag#3381); outside an IME it commits for the Field.
      if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) {
        report?.({ type: "commit" })
      }
    },
    onCompositionStart: (e: { currentTarget: HTMLInputElement }) =>
      send({ type: "COMPOSITION.START", caret: e.currentTarget.selectionStart ?? value.length }),
    onCompositionEnd: (e: { data: string }) => send({ type: "COMPOSITION.END", text: e.data }),
    onFocus: () => {
      // Focus (Tab selects the text natively) lands on the collapsed caret, unless a press
      // already planned one.
      if (ctx.pendingCaret.current === null) {
        ctx.pendingCaret.current = Math.min(ctx.view.context.caret, value.length)
      }
      send({ type: "FOCUS", modality: env.modality.modality() })
    },
    onBlur: () => send({ type: "BLUR" }),
  }
  const own = normalizeProps({ ...api.input(), id: controlId })
  const props = mergeProps(
    { ...joinHandlers(own, handlers), ref: composeRefs(ctx.inputEl, ref) },
    rest,
  )
  return renderPart("input", props, render, stateOf(ctx))
}

function Slot({
  index,
  render,
  ...rest
}: Omit<ComponentPropsWithRef<"div">, "children"> & {
  /** The slot's position, from 0. */
  readonly index: number
  /** Another element or a render function receiving the props and the Pin Input's state plus the slot's `char`. */
  readonly render?: RenderProp<PinInputState & { readonly char: string | undefined }>
}) {
  const ctx = usePinInput("Slot")
  const env = useEnvironment()
  const modality = useModality(env.modality, ctx.view.context.focused)
  const api = useApi(ctx, useFieldBindingPeek(), modality)
  const { slots } = ctx
  useIsoLayoutEffect(() => {
    slots.current += 1
    return () => {
      slots.current -= 1
    }
  }, [slots])
  return renderPart("div", mergeProps(normalizeProps(api.slot(index)), rest), render, {
    ...stateOf(ctx),
    char: ctx.view.values.value[index],
  })
}

/** The parts, by name: `pin-input.parts.ts` re-exports them as the `PinInput` namespace. */
export {
  Control,
  HostDescription as Description,
  HostErrorMessage as ErrorMessage,
  HostLabel as Label,
  Input,
  Root,
  Slot,
}
