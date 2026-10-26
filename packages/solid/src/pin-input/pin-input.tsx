/** @jsxImportSource solid-js */
// Pin Input parts: wiring only. The machine owns the value and the caret; edit-plan decides
// every insertion; connect every attribute. Native listeners: `beforeinput` to plan
// insertions, `input` so script fills are seen (input-otp#152).
import {
  type FieldControlBinding,
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
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  type JSX,
  onCleanup,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { type FieldRootOptions, useFieldBindingPeek, useFieldControl } from "../field/context"
import { FieldHost, HostDescription, HostErrorMessage, HostLabel } from "../field/field-host"
import { useFieldsetDisabled } from "../fieldset/context"
import { afterMount } from "../lifecycle"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useMessages } from "../provider"
import { type RenderProp, reactive, renderPart, resolveChildren } from "../render"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare const process: { env: { NODE_ENV?: string } }

declare module "../provider" {
  interface RindMessageScopes {
    "pin-input": PinInputMessages
  }
}

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
type Rules = {
  readonly length: number
  readonly validationType: PinValidationType | undefined
  readonly pattern: RegExp | undefined
  readonly sanitize: ((t: string) => string) | undefined
}

interface Ctx {
  readonly instance: Accessor<string>
  readonly view: Machine["view"]
  readonly send: Machine["send"]
  readonly length: Accessor<number>
  readonly rules: Accessor<Rules>
  readonly mask: Accessor<boolean>
  readonly maskChar: Accessor<string>
  readonly autoComplete: Accessor<string>
  readonly enterKeyHint: Accessor<string | undefined>
  readonly form: Accessor<string | undefined>
  readonly dir: Accessor<"ltr" | "rtl" | undefined>
  readonly disabled: Accessor<boolean>
  readonly readOnly: Accessor<boolean>
  readonly modality: ReturnType<typeof useModality>
  readonly inputEl: Accessor<Element | null>
  readonly setInputEl: (el: Element | null) => void
  readonly pendingCaret: { current: number | null }
  readonly pendingSubmit: { current: boolean }
  /** The next value change is the user's (a reset or a parent's value is not). */
  readonly userChange: { current: boolean }
  readonly slots: { current: number }
}

const PinInputContext = createContext<Ctx>()
function usePinInput(part: string): Ctx {
  const ctx = useContext(PinInputContext)
  if (!ctx) throw new Error(`PinInput.${part} must be inside PinInput.Root`)
  return ctx
}
const asInput = (el: Element | null) => (el instanceof HTMLInputElement ? el : null)

export type PinInputRootProps = Omit<
  JSX.HTMLAttributes<HTMLDivElement>,
  "children" | "id" | "dir" | "defaultValue" | "onChange" | "onInput" | "enterkeyhint"
> &
  Omit<FieldRootOptions, "messages"> & {
    /** The Field parts, the Control and its Input and Slots. */
    readonly children?: JSX.Element
    /** The number of characters (a positive integer). */
    readonly length: number
    /** Controlled; `null` and `undefined` render empty (ark#3573). */
    readonly value?: string | null | undefined
    readonly defaultValue?: string | undefined
    readonly onValueChange?: ((value: string, details: PinInputChangeDetails) => void) | undefined
    /** An insertion was refused (its text). */
    readonly onValueInvalid?: ((text: string) => void) | undefined
    /** A user change completed the code. */
    readonly onValueComplete?: ((value: string) => void) | undefined
    /** Default `"numeric"`. */
    readonly validationType?: PinValidationType | undefined
    /** One accepted character (replaces `validationType`); characters of the Basic Multilingual Plane only (no emoji). */
    readonly pattern?: RegExp | undefined
    /** Applied after NFKC (e.g. `(t) => t.toUpperCase()`). */
    readonly sanitize?: ((text: string) => string) | undefined
    readonly mask?: boolean | undefined
    readonly maskChar?: string | undefined
    /** Default `"one-time-code"`. */
    readonly autoComplete?: string | undefined
    /** Submits the form once a user change completes the code (`requestSubmit`, no focus moves). */
    readonly autoSubmit?: boolean | undefined
    readonly enterKeyHint?:
      | "enter"
      | "done"
      | "go"
      | "next"
      | "previous"
      | "search"
      | "send"
      | undefined
    /** The id of the form the input belongs to. */
    readonly form?: string | undefined
    /** The consumer's direction; the code itself is always laid out left to right. Default: `"ltr"`. */
    readonly dir?: "ltr" | "rtl" | undefined
    /** Message overrides (the Pin Input has no string of its own; see `fieldMessages`). */
    readonly messages?: MessageOverrides<PinInputMessages> | undefined
    /** The Field's announcement and per-constraint messages. */
    readonly fieldMessages?: MessageOverrides<FieldMessages> | undefined
    readonly required?: boolean | undefined
    readonly validate?: Validate | undefined
    readonly validationMode?: ValidationMode | undefined
    readonly validationBehavior?: ValidationBehavior | undefined
  }

/** Machine events → the public reasons. */
function publicReason(event: PinInputEvent): PinInputReason {
  if (event.type === "EDIT") return event.edit.reason
  if (event.type === "INPUT") return event.reason
  if (event.type === "RESET") return "RESET"
  return "INPUT"
}

function Root(props: PinInputRootProps) {
  const [own, rest] = splitProps(props, [
    "length",
    "value",
    "defaultValue",
    "onValueChange",
    "onValueInvalid",
    "onValueComplete",
    "validationType",
    "pattern",
    "sanitize",
    "mask",
    "maskChar",
    "autoComplete",
    "autoSubmit",
    "enterKeyHint",
    "form",
    "dir",
    "messages",
    "fieldMessages",
    "children",
  ])
  const env = useEnvironment()
  const generated = createUniqueId()
  const instance = createMemo(() => rest.id ?? generated)
  const messages = useMessages("pin-input", pinInputMessages, () => own.messages)
  const enclosing = useFieldBindingPeek()
  const fieldsetDisabled = useFieldsetDisabled()
  const disabled = () =>
    rest.disabled === true || enclosing?.().state.disabled === true || fieldsetDisabled()
  const readOnly = () => rest.readOnly === true || enclosing?.().state.readOnly === true
  const rules = createMemo<Rules>(() => ({
    length: own.length,
    validationType: own.validationType,
    pattern: own.pattern,
    sanitize: own.sanitize,
  }))
  // `value` present but null/undefined is a controlled empty value (ark#3573).
  const controlled = () => "value" in props
  const shown = createMemo(() => (controlled() ? renderedValue(rules(), own.value) : undefined))
  afterMount(() => {
    if (process.env.NODE_ENV === "production") return
    createEffect(() => {
      const length = own.length
      if (!Number.isInteger(length) || length < 1) {
        console.warn(`[rind-ui] pin-input: length must be a positive integer (got ${length}).`)
      }
    })
    createEffect(() => {
      const value = own.value
      const rendered = shown()
      if (controlled() && typeof value === "string" && value !== rendered) {
        console.warn(
          `[rind-ui] pin-input: the controlled value "${value}" is rendered as "${rendered}" (length ${own.length}, rejected characters dropped).`,
        )
      }
    })
  })
  const [inputEl, setInputEl] = createSignal<Element | null>(null)
  const pendingCaret = { current: null as number | null }
  const pendingSubmit = { current: false }
  const userChange = { current: false }
  const slots = { current: 0 }
  const { view, send } = useMachine(pinInputMachine, () => ({
    ...rules(),
    value: shown(),
    defaultValue: renderedValue(rules(), own.defaultValue ?? ""),
    onValueChange: (v: string, details) => {
      const event = (details as { event: PinInputEvent }).event
      userChange.current = event.type !== "RESET"
      own.onValueChange?.(v, { reason: publicReason(event) })
    },
    onValueInvalid: (t: string) => own.onValueInvalid?.(t),
    onValueComplete: (v: string) => own.onValueComplete?.(v),
    autoSubmit: own.autoSubmit ?? false,
    disabled: disabled(),
    readOnly: readOnly(),
    messages: messages(),
    id: instance(),
    writeCaret: (index: number) => {
      pendingCaret.current = index
    },
    resync: () => {
      // The value Solid renders is already right; the DOM may hold the browser's write.
      const el = asInput(untrack(inputEl))
      const current = untrack(view).values.value
      if (el && el.value !== current) el.value = current
    },
    // After the completed value is rendered (the form must validate the full code).
    requestSubmit: () => {
      pendingSubmit.current = true
    },
  }))
  // Every rendered slot counts; the number must match `length`. One microtask later: the
  // Slots register as they mount.
  afterMount(() => {
    if (process.env.NODE_ENV === "production") return
    createEffect(() => {
      const length = own.length
      queueMicrotask(() => {
        if (slots.current !== length) {
          console.warn(
            `[rind-ui] pin-input: length is ${length} but ${slots.current} Slots are rendered.`,
          )
        }
      })
    })
  })
  const modality = useModality(env.modality, () => view().context.focused)
  const ctx: Ctx = {
    instance,
    view,
    send,
    length: () => own.length,
    rules,
    mask: () => own.mask === true,
    maskChar: () => own.maskChar ?? "•",
    autoComplete: () => own.autoComplete ?? "one-time-code",
    enterKeyHint: () => own.enterKeyHint,
    form: () => own.form,
    dir: () => own.dir,
    disabled,
    readOnly,
    modality,
    inputEl,
    setInputEl,
    pendingCaret,
    pendingSubmit,
    userChange,
    slots,
  }
  const rootApi = useApi(ctx, enclosing)
  const root = createMemo(() => rootApi().root())
  const rootData = createMemo(() =>
    Object.fromEntries(
      Object.entries(root()).filter(
        ([k]) =>
          k.startsWith("data-") && k !== "data-scope" && k !== "data-part" && k !== "data-instance",
      ),
    ),
  )
  return (
    <FieldHost
      {...rest}
      scope="pin-input"
      id={instance()}
      dir={(root()["dir"] as "ltr" | "rtl" | undefined) ?? "ltr"}
      messages={own.fieldMessages}
      attrs={rootData}
    >
      <PinInputContext.Provider value={ctx}>{own.children}</PinInputContext.Provider>
    </FieldHost>
  )
}

/** The api of a part, with the Field binding merged. Call in a component; read in a memo. */
function useApi(ctx: Ctx, binding: Accessor<FieldControlBinding> | null) {
  return () => {
    const view = ctx.view()
    const b = binding?.() ?? null
    const field = mergeFieldProps(
      { role: "textbox", labelable: true, disabled: ctx.disabled(), readOnly: ctx.readOnly() },
      b,
    )
    return pinInputConnect({
      ...ctx.rules(),
      instance: ctx.instance(),
      value: view.values.value,
      caret: view.context.caret,
      focused: view.context.focused,
      modality: ctx.modality(),
      composing: view.matches("composing"),
      field,
      fieldData: b?.data,
      mask: ctx.mask(),
      maskChar: ctx.maskChar(),
      autoComplete: ctx.autoComplete(),
      enterKeyHint: ctx.enterKeyHint(),
      form: ctx.form(),
      dir: ctx.dir(),
    })
  }
}

const stateOf = (ctx: Ctx) =>
  reactive<PinInputState>(() => ({
    value: ctx.view().values.value,
    complete: ctx.view().values.value.length === ctx.length(),
    composing: ctx.view().matches("composing"),
    focused: ctx.view().context.focused,
  }))

type PartProps<A> = Omit<A, "children"> & {
  /** Another element: a function receiving the props to spread and the Pin Input's state. */
  readonly render?: RenderProp<PinInputState> | undefined
  readonly children?: JSX.Element | ((state: PinInputState) => JSX.Element)
}

function Control(props: PartProps<JSX.HTMLAttributes<HTMLDivElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = usePinInput("Control")
  const apiFor = useApi(ctx, useFieldBindingPeek())
  const state = stateOf(ctx)
  const merged = createMemo(() => mergeProps(normalizeProps(apiFor().control()), rest))
  const children = () => resolveChildren(local.children, state)
  return renderPart(local.render, merged, state, children, (p) => <div {...p}>{children()}</div>)
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

export type PinInputInputProps = Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  "children" | "value" | "type"
> & {
  /** Another element: a function receiving the props to spread and the Pin Input's state. */
  readonly render?: RenderProp<PinInputState> | undefined
}

function Input(props: PinInputInputProps) {
  const [local, rest] = splitProps(props, ["id", "render"])
  const ctx = usePinInput("Input")
  const env = useEnvironment()
  const binding = useFieldControl()
  const apiFor = useApi(ctx, binding)
  // A memo: the binding changes on every registration, the id (compared by value) does not.
  const controlId = createMemo(
    () =>
      local.id ?? binding?.().controlId ?? `pin-input-${ctx.instance()}-input`.replace(/:/g, ""),
  )
  const report = (e: Parameters<FieldControlBinding["report"]>[0]) =>
    untrack(() => binding?.().report(e))
  const value = () => ctx.view().values.value
  // After every commit: the DOM shows the value, the planned caret is placed, and a pending
  // auto-submit runs against the full code.
  const afterRender = () => {
    const el = asInput(ctx.inputEl())
    if (!el) return
    const now = value()
    // The DOM text follows the value between compositions (an IME owns it meanwhile).
    if (el.value !== now && !ctx.view().matches("composing")) el.value = now
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
  }
  afterMount(() => {
    const el = asInput(untrack(ctx.inputEl))
    injectStyle(el?.ownerDocument, "pin-input", pinInputStyle, env)
    if (binding) {
      createEffect(() => {
        const id = controlId()
        onCleanup(
          untrack(() =>
            binding().register(
              {
                id,
                labelable: true,
                focus: (m) => {
                  const input = asInput(ctx.inputEl())
                  if (input) void focusSafely(input, env, "programmatic", m)
                },
                // The input is the form control: its own validity (valueMissing, patternMismatch).
                validityElement: () => asInput(ctx.inputEl()),
                value: () => untrack(value),
              },
              id,
            ),
          ),
        )
      })
    }
    // Each applied change is reported to the Field once.
    let reported = untrack(value)
    createEffect(() => {
      const now = value()
      if (reported === now) return
      reported = now
      // A reset or a parent's value is reported too, but not as the user's (RA#6830).
      const user = ctx.userChange.current
      ctx.userChange.current = false
      report({ type: "change", value: now, user, composing: false })
    })
    createEffect(() => {
      ctx.view()
      untrack(afterRender)
    })
    if (!el) return
    const onBeforeInput = (e: Event) => {
      const ie = e as InputEvent
      if (ctx.view().matches("composing") || ie.isComposing) return
      if (ie.inputType === "insertCompositionText") return
      const data = ie.data ?? ie.dataTransfer?.getData("text/plain") ?? null
      const start = el.selectionStart ?? el.value.length
      const end = el.selectionEnd ?? start
      const plan = planEdit(value(), [start, end], { inputType: ie.inputType, data }, ctx.rules())
      if (plan.accept && plan.edit === null) return
      e.preventDefault()
      ctx.send(
        plan.accept ? { type: "EDIT", edit: plan.edit } : { type: "INVALID", text: plan.text },
      )
    }
    const onInput = (e: Event) => {
      const ie = e as Partial<InputEvent>
      if (ctx.view().matches("composing") || ie.isComposing) return
      if (el.value === value()) return
      const native = typeof ie.inputType === "string" && /^(delete|history)/.test(ie.inputType)
      ctx.send({ type: "INPUT", text: el.value, reason: native ? "INPUT" : "AUTOFILL" })
    }
    // A key an IME owns (isComposing, keyCode 229) never moves the active slot. Its
    // selectionchange arrives as a later task, so the flag holds until the next own key,
    // a press or the composition's end.
    let imeKey = false
    const onKeyDown = (e: Event) => {
      const k = e as KeyboardEvent
      imeKey = k.isComposing || k.keyCode === 229
    }
    const onSettled = () => {
      imeKey = false
    }
    const onSelection = () => {
      if (imeKey || el.ownerDocument.activeElement !== el || el.selectionStart === null) return
      if (el.selectionStart !== ctx.view().context.caret)
        ctx.send({ type: "CARET", index: el.selectionStart })
    }
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || ctx.disabled()) return
      const index = slotAt(el, ctx.instance(), e.clientX)
      if (index === null) return
      // No native caret placement: the caret goes to the slot under the press.
      e.preventDefault()
      if (el.ownerDocument.activeElement !== el) void focusSafely(el, env, "programmatic")
      ctx.send({
        type: "SLOT.PRESS",
        index,
        modality: e.pointerType === "touch" ? "touch" : "pointer",
      })
    }
    // A form reset: the current defaultValue comes back (read once dispatch ended).
    const formEl = el.form
    const onReset = (e: Event) =>
      env.scheduler.setTimeout(() => {
        if (!e.defaultPrevented) ctx.send({ type: "RESET" })
      }, 0)
    el.addEventListener("beforeinput", onBeforeInput)
    el.addEventListener("input", onInput)
    el.addEventListener("pointerdown", onPointerDown)
    el.addEventListener("keydown", onKeyDown, true)
    el.addEventListener("pointerdown", onSettled, true)
    el.addEventListener("compositionend", onSettled)
    el.ownerDocument.addEventListener("selectionchange", onSelection)
    formEl?.addEventListener("reset", onReset)
    onCleanup(() => {
      el.removeEventListener("beforeinput", onBeforeInput)
      el.removeEventListener("input", onInput)
      el.removeEventListener("pointerdown", onPointerDown)
      el.removeEventListener("keydown", onKeyDown, true)
      el.removeEventListener("pointerdown", onSettled, true)
      el.removeEventListener("compositionend", onSettled)
      el.ownerDocument.removeEventListener("selectionchange", onSelection)
      formEl?.removeEventListener("reset", onReset)
    })
  })
  const handlers = {
    onKeyDown: (e: KeyboardEvent) => {
      // Enter is never prevented (zag#3381); outside an IME it commits for the Field.
      if (e.key === "Enter" && !e.isComposing && e.keyCode !== 229) report({ type: "commit" })
    },
    onCompositionStart: (e: CompositionEvent) => {
      const el = e.currentTarget instanceof HTMLInputElement ? e.currentTarget : null
      ctx.send({ type: "COMPOSITION.START", caret: el?.selectionStart ?? value().length })
    },
    onCompositionEnd: (e: CompositionEvent) => ctx.send({ type: "COMPOSITION.END", text: e.data }),
    onFocusIn: () => {
      // Focus (Tab selects the text natively) lands on the collapsed caret, unless a press
      // already planned one.
      if (ctx.pendingCaret.current === null) {
        ctx.pendingCaret.current = Math.min(ctx.view().context.caret, value().length)
      }
      ctx.send({ type: "FOCUS", modality: env.modality.modality() })
    },
    onFocusOut: () => ctx.send({ type: "BLUR" }),
  }
  const state = stateOf(ctx)
  const merged = createMemo(() => {
    const ownProps = normalizeProps({ ...apiFor().input(), id: controlId() })
    return mergeProps({ ...joinHandlers(ownProps, handlers), ref: ctx.setInputEl }, rest)
  })
  return renderPart(
    local.render,
    merged,
    state,
    () => undefined,
    (p) => <input {...p} />,
  )
}

export type PinInputSlotProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "children"> & {
  /** The slot's position, from 0. */
  readonly index: number
  /** Another element: a function receiving the props to spread and the state plus the slot's `char`. */
  readonly render?: RenderProp<PinInputState & { readonly char: string | undefined }> | undefined
  readonly children?:
    | JSX.Element
    | ((state: PinInputState & { readonly char: string | undefined }) => JSX.Element)
}

function Slot(props: PinInputSlotProps) {
  const [local, rest] = splitProps(props, ["index", "render", "children"])
  const ctx = usePinInput("Slot")
  const apiFor = useApi(ctx, useFieldBindingPeek())
  afterMount(() => {
    ctx.slots.current += 1
    onCleanup(() => {
      ctx.slots.current -= 1
    })
  })
  const base = stateOf(ctx)
  const state = reactive(() => ({
    value: base.value,
    complete: base.complete,
    composing: base.composing,
    focused: base.focused,
    char: ctx.view().values.value[local.index] as string | undefined,
  }))
  const own = createMemo(() => apiFor().slot(local.index))
  const merged = createMemo(() => mergeProps(normalizeProps(own()), rest))
  // The slot's character, unless the consumer renders its own children.
  const children = () =>
    local.children === undefined
      ? // connect's children are the character (a string or null): a valid JSX child.
        (own()["children"] as JSX.Element)
      : resolveChildren(local.children, state)
  return renderPart(local.render, merged, state, children, (p) => <div {...p}>{children()}</div>)
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
