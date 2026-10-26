// Pin Input parts: wiring only. The machine owns the value and the caret; edit-plan decides
// every insertion; connect every attribute. Native listeners: `beforeinput` to plan
// insertions, `input` so script fills are seen (input-otp#152).
import {
  type FieldControlBinding,
  type FieldMessages,
  focusSafely,
  injectStyle,
  type MessageOverrides,
  type Modality,
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
} from "@rind-ui/core"
import {
  type ComputedRef,
  defineComponent,
  getCurrentInstance,
  h,
  type InjectionKey,
  inject,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  type PropType,
  provide,
  type Ref,
  type SlotsType,
  shallowRef,
  useId,
  type VNodeChild,
  watch,
} from "vue"
import { fieldRootProps, useFieldBindingPeek, useFieldControl } from "../field/context"
import { FieldHost, HostDescription, HostErrorMessage, HostLabel } from "../field/field-host"
import { useFieldsetDisabled } from "../fieldset/context"
import { joinHandlers } from "../join-handlers"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useMessages } from "../provider"
import { asChildProp, renderPart } from "../render"
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
  readonly instance: () => string
  readonly view: () => Machine["view"]["value"]
  readonly send: Machine["send"]
  readonly length: () => number
  readonly rules: () => Rules
  readonly mask: () => boolean
  readonly maskChar: () => string
  readonly autoComplete: () => string
  readonly enterKeyHint: () => string | undefined
  readonly form: () => string | undefined
  readonly dir: () => "ltr" | "rtl" | undefined
  readonly disabled: () => boolean
  readonly readOnly: () => boolean
  readonly inputEl: { value: Element | null }
  readonly pendingCaret: { current: number | null }
  readonly pendingSubmit: { current: boolean }
  /** The next value change is the user's (a reset or a parent's value is not). */
  readonly userChange: { current: boolean }
  readonly slots: { current: number }
}
const PinInputKey: InjectionKey<Ctx> = Symbol("rind-ui.pin-input")
function usePinInput(part: string): Ctx {
  const ctx = inject(PinInputKey, null)
  if (!ctx) throw new Error(`PinInput.${part} must be inside PinInput.Root`)
  return ctx
}
const asInput = (el: Element | null) => (el instanceof HTMLInputElement ? el : null)

/** Machine events → the public reasons. */
function publicReason(event: PinInputEvent): PinInputReason {
  if (event.type === "EDIT") return event.edit.reason
  if (event.type === "INPUT") return event.reason
  if (event.type === "RESET") return "RESET"
  return "INPUT"
}

/** The connect output, with the Field binding merged. Call in setup; read in render. */
function useApi(
  ctx: Ctx,
  binding: ComputedRef<FieldControlBinding> | null,
  modality: Ref<Modality>,
) {
  return () => {
    const view = ctx.view()
    const b = binding?.value ?? null
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
      modality: modality.value,
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

const stateOf = (ctx: Ctx): PinInputState => ({
  value: ctx.view().values.value,
  complete: ctx.view().values.value.length === ctx.length(),
  composing: ctx.view().matches("composing"),
  focused: ctx.view().context.focused,
})

const Root = defineComponent({
  name: "PinInputRoot",
  inheritAttrs: false,
  props: {
    ...fieldRootProps,
    /** The number of characters (a positive integer). */
    length: { type: Number, required: true },
    /** Controlled (`v-model`); `null` renders empty (ark#3573). */
    modelValue: { type: String as PropType<string | null>, default: undefined },
    defaultValue: { type: String, default: "" },
    /** Default `"numeric"`. */
    validationType: String as PropType<PinValidationType>,
    /** One accepted character (replaces `validationType`); characters of the Basic Multilingual Plane only (no emoji). */
    pattern: RegExp,
    /** Applied after NFKC (e.g. `(t) => t.toUpperCase()`). */
    sanitize: Function as PropType<(text: string) => string>,
    mask: Boolean,
    maskChar: { type: String, default: "•" },
    /** Default `"one-time-code"`. */
    autocomplete: { type: String, default: "one-time-code" },
    /** Submits the form once a user change completes the code (`requestSubmit`, no focus moves). */
    autoSubmit: Boolean,
    enterkeyhint: String as PropType<
      "enter" | "done" | "go" | "next" | "previous" | "search" | "send"
    >,
    /** The id of the form the input belongs to. */
    form: String,
    /** The consumer's direction; the code itself is always laid out left to right. Default: `"ltr"`. */
    dir: String as PropType<"ltr" | "rtl">,
    messages: Object as PropType<MessageOverrides<PinInputMessages>>,
    fieldMessages: Object as PropType<MessageOverrides<FieldMessages>>,
  },
  emits: {
    valueChange: (_value: string, _details: PinInputChangeDetails) => true,
    "update:modelValue": (_value: string) => true,
    /** An insertion was refused (its text). */
    valueInvalid: (_text: string) => true,
    /** A user change completed the code. */
    valueComplete: (_value: string) => true,
  },
  setup(props, { attrs, slots, emit }) {
    const env = useEnvironment()
    const generated = useId()
    const instance = () => props.id ?? generated
    const messages = useMessages("pin-input", pinInputMessages, () => props.messages)
    const enclosing = useFieldBindingPeek()
    const fieldsetDisabled = useFieldsetDisabled()
    const disabled = () =>
      props.disabled || enclosing?.value.state.disabled === true || fieldsetDisabled.value
    const readOnly = () => props.readonly || enclosing?.value.state.readOnly === true
    const rules = (): Rules => ({
      length: props.length,
      validationType: props.validationType,
      pattern: props.pattern,
      sanitize: props.sanitize,
    })
    // A `modelValue` passed, even null or undefined, is a controlled value (ark#3573).
    const vnode = getCurrentInstance()?.vnode
    const controlled = () => vnode?.props != null && "modelValue" in vnode.props
    const shown = () => (controlled() ? renderedValue(rules(), props.modelValue) : undefined)
    const inputEl = shallowRef<Element | null>(null)
    const pendingCaret = { current: null as number | null }
    const pendingSubmit = { current: false }
    const userChange = { current: false }
    const slotCount = { current: 0 }
    const { view, send } = useMachine(pinInputMachine, () => ({
      ...rules(),
      value: shown(),
      defaultValue: renderedValue(rules(), props.defaultValue),
      onValueChange: (v: string, details) => {
        const event = (details as { event: PinInputEvent }).event
        userChange.current = event.type !== "RESET"
        emit("valueChange", v, { reason: publicReason(event) })
        emit("update:modelValue", v)
      },
      onValueInvalid: (t: string) => emit("valueInvalid", t),
      onValueComplete: (v: string) => emit("valueComplete", v),
      autoSubmit: props.autoSubmit,
      disabled: disabled(),
      readOnly: readOnly(),
      messages: messages.value,
      id: instance(),
      writeCaret: (index: number) => {
        pendingCaret.current = index
      },
      resync: () => {
        // The value Vue renders is already right; the DOM may hold the browser's write.
        const el = asInput(inputEl.value)
        const current = view.value.values.value
        if (el && el.value !== current) el.value = current
      },
      // After the completed value is rendered (the form must validate the full code).
      requestSubmit: () => {
        pendingSubmit.current = true
      },
    }))
    onMounted(() => {
      if (process.env.NODE_ENV === "production") return
      watch(
        () => props.length,
        (length) => {
          if (!Number.isInteger(length) || length < 1) {
            console.warn(`[rind-ui] pin-input: length must be a positive integer (got ${length}).`)
          }
          // Every rendered slot counts; the number must match `length`.
          if (slotCount.current !== length) {
            console.warn(
              `[rind-ui] pin-input: length is ${length} but ${slotCount.current} Slots are rendered.`,
            )
          }
        },
        { immediate: true },
      )
      watch(
        () => [props.modelValue, shown()] as const,
        ([value, rendered]) => {
          if (controlled() && typeof value === "string" && value !== rendered) {
            console.warn(
              `[rind-ui] pin-input: the controlled value "${value}" is rendered as "${rendered}" (length ${props.length}, rejected characters dropped).`,
            )
          }
        },
        { immediate: true },
      )
    })
    const ctx: Ctx = {
      instance,
      view: () => view.value,
      send,
      length: () => props.length,
      rules,
      mask: () => props.mask,
      maskChar: () => props.maskChar,
      autoComplete: () => props.autocomplete,
      enterKeyHint: () => props.enterkeyhint,
      form: () => props.form,
      dir: () => props.dir,
      disabled,
      readOnly,
      inputEl,
      pendingCaret,
      pendingSubmit,
      userChange,
      slots: slotCount,
    }
    provide(PinInputKey, ctx)
    const modality = useModality(env.modality, () => view.value.context.focused)
    const apiFor = useApi(ctx, enclosing, modality)
    return () => {
      const root = apiFor().root()
      const rootData = Object.fromEntries(
        Object.entries(root).filter(
          ([k]) =>
            k.startsWith("data-") &&
            k !== "data-scope" &&
            k !== "data-part" &&
            k !== "data-instance",
        ),
      )
      const field = Object.fromEntries(
        Object.keys(fieldRootProps)
          .filter((k) => k !== "messages" && k !== "id")
          .map((k) => [k, (props as Record<string, unknown>)[k]]),
      )
      return h(
        FieldHost,
        {
          ...attrs,
          scope: "pin-input",
          id: instance(),
          dir: (root["dir"] as string | undefined) ?? "ltr",
          ...field,
          ...(props.fieldMessages ? { messages: props.fieldMessages } : {}),
          ...rootData,
        },
        slots,
      )
    }
  },
})

type Slots = SlotsType<{ default?: (state: PinInputState) => VNodeChild }>

const Control = defineComponent({
  name: "PinInputControl",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = usePinInput("Control")
    const env = useEnvironment()
    const modality = useModality(env.modality, () => ctx.view().context.focused)
    const apiFor = useApi(ctx, useFieldBindingPeek(), modality)
    return () =>
      renderPart(
        "div",
        mergeProps(normalizeProps(apiFor().control()), attrs),
        slots.default?.(stateOf(ctx)),
        props.asChild,
      )
  },
})

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

const Input = defineComponent({
  name: "PinInputInput",
  inheritAttrs: false,
  props: { id: String, ...asChildProp },
  setup(props, { attrs }) {
    const ctx = usePinInput("Input")
    const env = useEnvironment()
    const binding = useFieldControl()
    const modality = useModality(env.modality, () => ctx.view().context.focused)
    const apiFor = useApi(ctx, binding, modality)
    const controlId = () =>
      props.id ?? binding?.value.controlId ?? `pin-input-${ctx.instance()}-input`.replace(/:/g, "")
    const report = (e: Parameters<FieldControlBinding["report"]>[0]) => binding?.value.report(e)
    const value = () => ctx.view().values.value
    // After every update: the DOM shows the value, the planned caret is placed, and a pending
    // auto-submit runs against the full code.
    const afterRender = () => {
      const el = asInput(ctx.inputEl.value)
      if (!el) return
      // The DOM text follows the value between compositions (an IME owns it meanwhile).
      if (el.value !== value() && !ctx.view().matches("composing")) el.value = value()
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
    onUpdated(afterRender)
    onMounted(() => {
      const el = asInput(ctx.inputEl.value)
      injectStyle(el?.ownerDocument, "pin-input", pinInputStyle, env)
      if (binding) {
        watch(
          controlId,
          (id, _old, onCleanup) =>
            onCleanup(
              binding.value.register(
                {
                  id,
                  labelable: true,
                  focus: (m) => {
                    const input = asInput(ctx.inputEl.value)
                    if (input) void focusSafely(input, env, "programmatic", m)
                  },
                  // The input is the form control: its own validity (valueMissing, patternMismatch).
                  validityElement: () => asInput(ctx.inputEl.value),
                  value,
                },
                id,
              ),
            ),
          { immediate: true },
        )
      }
      // Each applied change is reported to the Field once.
      let reported = value()
      watch(value, (now) => {
        if (reported === now) return
        reported = now
        // A reset or a parent's value is reported too, but not as the user's (RA#6830).
        const user = ctx.userChange.current
        ctx.userChange.current = false
        report({ type: "change", value: now, user, composing: false })
      })
      afterRender()
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
      onBeforeUnmount(() => {
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
      onKeydown: (e: KeyboardEvent) => {
        // Enter is never prevented (zag#3381); outside an IME it commits for the Field.
        if (e.key === "Enter" && !e.isComposing && e.keyCode !== 229) report({ type: "commit" })
      },
      onCompositionstart: (e: CompositionEvent) => {
        const el = e.currentTarget instanceof HTMLInputElement ? e.currentTarget : null
        ctx.send({ type: "COMPOSITION.START", caret: el?.selectionStart ?? value().length })
      },
      onCompositionend: (e: CompositionEvent) =>
        ctx.send({ type: "COMPOSITION.END", text: e.data }),
      onFocusin: () => {
        // Focus (Tab selects the text natively) lands on the collapsed caret, unless a press
        // already planned one.
        if (ctx.pendingCaret.current === null) {
          ctx.pendingCaret.current = Math.min(ctx.view().context.caret, value().length)
        }
        ctx.send({ type: "FOCUS", modality: env.modality.modality() })
      },
      onFocusout: () => ctx.send({ type: "BLUR" }),
    }
    return () =>
      renderPart(
        "input",
        mergeProps(
          {
            ...joinHandlers(normalizeProps({ ...apiFor().input(), id: controlId() }), handlers),
            ref: refTo(ctx.inputEl),
          },
          attrs,
        ),
        undefined,
        props.asChild,
      )
  },
})

const Slot = defineComponent({
  name: "PinInputSlot",
  inheritAttrs: false,
  props: {
    /** The slot's position, from 0. */
    index: { type: Number, required: true },
    ...asChildProp,
  },
  slots: Object as SlotsType<{
    default?: (state: PinInputState & { readonly char: string | undefined }) => VNodeChild
  }>,
  setup(props, { attrs, slots }) {
    const ctx = usePinInput("Slot")
    const env = useEnvironment()
    const modality = useModality(env.modality, () => ctx.view().context.focused)
    const apiFor = useApi(ctx, useFieldBindingPeek(), modality)
    ctx.slots.current += 1
    onBeforeUnmount(() => {
      ctx.slots.current -= 1
    })
    return () =>
      renderPart(
        "div",
        mergeProps(normalizeProps(apiFor().slot(props.index)), attrs),
        slots.default?.({ ...stateOf(ctx), char: ctx.view().values.value[props.index] }),
        props.asChild,
      )
  },
})

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
