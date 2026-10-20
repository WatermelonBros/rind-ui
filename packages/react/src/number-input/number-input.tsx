"use client"

// Number Input parts: wiring only. The machine owns the value and the text; connect every
// attribute, the insertion plan and the key mapping. The Root is a Field when not inside one
// (the shared Field host); the hidden number input carries name, constraints and reset.

import {
  canStepNumber,
  createNumberParser,
  describeKey,
  type FieldMessages,
  focusSafely,
  hiddenFormInput,
  inputModeOf,
  type MessageOverrides,
  mergeFieldProps,
  type NumberInputCommitDetails,
  type NumberInputEvent,
  type NumberInputMessages,
  type NumberInputPart,
  type NumberInputReason,
  type NumberInputTrigger,
  numberInputConnect,
  numberInputKey,
  numberInputMachine,
  numberInputMessages,
  type PartNaming,
  partId,
  planInsertion,
  quirkActive,
  type Validate,
  type ValidationBehavior,
  type ValidationMode,
} from "@rind-ui/core"
import {
  type ClipboardEvent,
  type ComponentPropsWithRef,
  createContext,
  type KeyboardEvent,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { useFieldBindingPeek, useFieldControl } from "../field/field"
import { FieldHost, HostDescription, HostErrorMessage, HostLabel } from "../field/use-field-host"
import { useFieldsetDisabled } from "../fieldset/fieldset"
import { joinHandlers } from "../join-handlers"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { usePress } from "../use-press"

declare module "../provider" {
  interface RindMessageScopes {
    "number-input": NumberInputMessages
  }
}

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

/** Machine reasons → the public ones (spec "Value And Callbacks"). */
function publicReason(type: string): NumberInputReason {
  if (type.startsWith("after:")) return "SPIN"
  switch (type) {
    case "FIRST":
    case "LAST":
      return "EDGE"
    case "WHEEL":
      return "WHEEL"
    case "PASTE":
      return "PASTE"
    case "RESET":
      return "RESET"
    case "COMMIT":
    case "INPUT.ADOPT":
      return "INPUT.COMMIT"
    default:
      return "STEP"
  }
}

export interface NumberInputChangeDetails {
  readonly reason: NumberInputReason
  readonly modality: string | undefined
  cancel(): void
}

export interface NumberInputState {
  readonly value: number | null
  readonly text: string
  readonly spinning: boolean
  readonly composing: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
}

type Machine = ReturnType<typeof useMachine<typeof numberInputMachine>>

interface Ctx {
  readonly instance: string
  readonly view: Machine["view"]
  readonly send: Machine["send"]
  readonly parser: ReturnType<typeof createNumberParser>
  readonly messages: NumberInputMessages
  readonly disabled: boolean
  readonly readOnly: boolean
  readonly min: number | undefined
  readonly max: number | undefined
  readonly step: number | undefined
  readonly defaultValue: number | null
  readonly allowWheel: boolean
  readonly form: string | undefined
  readonly dir: "ltr" | "rtl"
  readonly inputEl: { current: HTMLInputElement | null }
  readonly hiddenEl: { current: HTMLInputElement | null }
  readonly formInput: ReturnType<typeof hiddenFormInput>
  readonly mounted: boolean
  readonly pressed: { increment: boolean; decrement: boolean }
  readonly setPressed: (t: NumberInputTrigger, on: boolean) => void
  readonly ids: { input: string; increment: string; decrement: string; hiddenInput: string }
  readonly setInputId: (id: string) => void
}

const NumberInputContext = createContext<Ctx | null>(null)
/**
 * Internal (not exported from the package): set by a component that renders a Number Input as
 * its part (Color Picker's channel input): the host's scope and part names.
 */
export const NumberInputNaming = createContext<PartNaming<NumberInputPart> | null>(null)
function useNumberInput(part: string): Ctx {
  const ctx = useContext(NumberInputContext)
  if (!ctx) throw new Error(`NumberInput.${part} must be inside NumberInput.Root`)
  return ctx
}

export type NumberInputRootProps = Omit<
  ComponentPropsWithRef<"div">,
  "children" | "defaultValue" | "onChange" | "dir"
> & {
  /** The number input's parts: label, control, input, triggers, description and error message. */
  readonly children?: ReactNode
  readonly value?: number | null
  /** Read at creation (default empty); a later change only changes what a form reset restores. */
  readonly defaultValue?: number | null
  readonly onValueChange?: (value: number | null, details: NumberInputChangeDetails) => void
  /** Once per interaction that changed the value (key, stepper release, wheel tick, blur/Enter). */
  readonly onValueCommit?: (value: number | null, details: NumberInputCommitDetails) => void
  /** Every accepted edit of the text (the value only changes at commit points). */
  readonly onInputValueChange?: (text: string) => void
  readonly min?: number
  readonly max?: number
  /** Default 1 (0.01 for percent). A commit snaps to an explicit step only. */
  readonly step?: number
  readonly largeStep?: number
  readonly formatOptions?: Intl.NumberFormatOptions
  readonly locale?: string
  readonly dir?: "ltr" | "rtl"
  readonly commitBehavior?: "snap" | "validate"
  readonly allowWheel?: boolean
  readonly spinOnPress?: boolean
  readonly spinDelay?: number
  readonly spinInterval?: number
  readonly form?: string
  readonly messages?: MessageOverrides<NumberInputMessages>
  // Field props (the Root is a Field when not inside one).
  readonly name?: string
  readonly disabled?: boolean
  readonly readOnly?: boolean
  readonly required?: boolean
  readonly invalid?: boolean
  /** External errors (server): shown at once, cleared by the next change. */
  readonly errors?: readonly string[]
  /** Runs after native constraints pass. */
  readonly validate?: Validate
  /** When errors are displayed. Default: the enclosing Form's, else `"submit"`. */
  readonly validationMode?: ValidationMode
  /** Whether an invalid Field blocks submission. Default: the enclosing Form's, else `"native"`. */
  readonly validationBehavior?: ValidationBehavior
  /** Delays `validate` in `change` mode (ms). Default: 0. */
  readonly validationDebounce?: number
  readonly fieldMessages?: MessageOverrides<FieldMessages>
}

function Root({
  value,
  defaultValue = null,
  onValueChange,
  onValueCommit,
  onInputValueChange,
  min,
  max,
  step,
  largeStep,
  formatOptions,
  locale: ownLocale,
  dir: ownDir,
  commitBehavior,
  allowWheel = false,
  spinOnPress,
  spinDelay,
  spinInterval,
  form,
  messages: ownMessages,
  fieldMessages: ownFieldMessages,
  children,
  id,
  ...fieldProps
}: NumberInputRootProps) {
  const hostNaming = useContext(NumberInputNaming)
  const env = useEnvironment()
  const generated = useId()
  const instance = id ?? generated
  const { locale, dir } = useLocale(ownLocale, ownDir)
  const messages = useMessages("number-input", numberInputMessages, ownMessages)
  // Cached by value: an inline options object each render keeps the parser (RX#1893).
  const parser = createNumberParser(locale, formatOptions)
  const enclosing = useFieldBindingPeek()
  const fieldsetDisabled = useFieldsetDisabled()
  const disabled =
    fieldProps.disabled === true || enclosing?.state.disabled === true || fieldsetDisabled
  const readOnly = fieldProps.readOnly === true || enclosing?.state.readOnly === true
  const inputEl = useRef<HTMLInputElement | null>(null)
  const hiddenEl = useRef<HTMLInputElement | null>(null)
  const [formInput] = useState(() =>
    hiddenFormInput({ input: () => hiddenEl.current, control: () => inputEl.current }, env),
  )
  // The service is created once: the provider's scheduler and announcer, plus the input.
  const [machineEnv] = useState(() => ({
    scheduler: env.scheduler,
    announcer: env.announcer,
    formInput,
  }))
  const latest = useRef({ onValueChange, onValueCommit, onInputValueChange })
  latest.current = { onValueChange, onValueCommit, onInputValueChange }
  const { view, send } = useMachine(
    numberInputMachine,
    {
      value,
      defaultValue,
      onValueChange: (v, details) =>
        latest.current.onValueChange?.(v, {
          reason: publicReason(details.reason),
          modality: (details.event as { modality?: string }).modality,
          cancel: details.cancel,
        }),
      onValueCommit: (v, d) => latest.current.onValueCommit?.(v, d),
      onInputValueChange: (t) => latest.current.onInputValueChange?.(t),
      min,
      max,
      step,
      largeStep,
      commitBehavior,
      spinOnPress,
      spinDelay,
      spinInterval,
      disabled,
      readOnly,
      parser,
      messages,
      id: instance,
    },
    machineEnv,
  )
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const [pressed, setPressedState] = useState({ increment: false, decrement: false })
  const [setPressed] = useState(
    () => (t: NumberInputTrigger, on: boolean) =>
      setPressedState((p) => (p[t] === on ? p : { ...p, [t]: on })),
  )
  const [inputId, setInputId] = useState(partId("number-input", instance, "input"))
  const ids = {
    input: inputId,
    increment: partId("number-input", instance, "increment-trigger"),
    decrement: partId("number-input", instance, "decrement-trigger"),
    hiddenInput: partId("number-input", instance, "hidden-input"),
  }
  const modality = useModality(env.modality, view.context.focused)
  const rootData = {
    "data-focus": view.context.focused ? "" : undefined,
    "data-focus-visible":
      view.context.focused && modality !== "pointer" && modality !== "touch" ? "" : undefined,
    "data-spinning": view.matches("spinning") ? "" : undefined,
    "data-composing": view.matches("composing") ? "" : undefined,
  }
  const ctx: Ctx = {
    instance,
    view,
    send,
    parser,
    messages,
    disabled,
    readOnly,
    min,
    max,
    step,
    defaultValue,
    allowWheel,
    form,
    dir,
    inputEl,
    hiddenEl,
    formInput,
    mounted,
    pressed,
    setPressed,
    ids,
    setInputId,
  }
  return (
    <FieldHost
      scope={hostNaming?.scope ?? "number-input"}
      {...(hostNaming ? { rootPart: hostNaming.part("root") } : {})}
      id={instance}
      dir={dir}
      {...fieldProps}
      {...(ownFieldMessages ? { messages: ownFieldMessages } : {})}
      {...rootData}
    >
      <NumberInputContext value={ctx}>
        {children}
        <HiddenInput />
      </NumberInputContext>
    </FieldHost>
  )
}

/** The api of a part, with the Field binding merged. */
function useApi(ctx: Ctx, binding: ReturnType<typeof useFieldBindingPeek>) {
  const env = useEnvironment()
  const field = mergeFieldProps(
    {
      role: "spinbutton",
      labelable: true,
      disabled: ctx.disabled,
      readOnly: ctx.readOnly,
    },
    binding,
  )
  const modality = useModality(env.modality, ctx.view.context.focused)
  const value = ctx.view.values.value ?? null
  const naming = useContext(NumberInputNaming)
  return numberInputConnect(
    {
      instance: ctx.instance,
      ...(naming ? { naming } : {}),
      value,
      text: ctx.view.context.text,
      defaultValue: ctx.defaultValue,
      focused: ctx.view.context.focused,
      modality,
      composing: ctx.view.matches("composing"),
      spinning: ctx.view.matches("spinning"),
      field,
      fieldData: binding?.data,
      ids: ctx.ids,
      labelId: binding?.ids.label,
      min: ctx.min,
      max: ctx.max,
      step: ctx.step,
      canIncrement: canStepNumber(value, 1, ctx),
      canDecrement: canStepNumber(value, -1, ctx),
      pressed: ctx.pressed,
      parser: ctx.parser,
      messages: ctx.messages,
      plainTextbox: quirkActive("ios-vo-spinbutton-input", env),
      inputMode: inputModeOf(
        {
          fractions: ctx.parser.allowsFraction || (ctx.step !== undefined && ctx.step % 1 !== 0),
          allowNegative: ctx.min === undefined || ctx.min < 0,
          mounted: ctx.mounted,
        },
        env.platform,
      ),
      form: ctx.form,
      dir: ctx.dir,
    },
    env,
  )
}

/** The hidden `<input type="number">`: name, constraints, validity, reset, autofill. */
function HiddenInput() {
  const ctx = useNumberInput("Root")
  const binding = useFieldBindingPeek()
  const api = useApi(ctx, binding)
  const { send, formInput } = ctx
  const value = ctx.view.values.value ?? null
  const latest = useRef(value)
  latest.current = value
  // Stable: it reads the latest value through the ref.
  const [mirror] = useState(() => () => ({
    value: latest.current === null ? "" : String(latest.current),
  }))
  // After every commit: the input shows the value (hydration, a parent's change); no events.
  useIsoLayoutEffect(() => {
    formInput.sync(mirror(), { dispatch: false })
  })
  useEffect(
    () =>
      formInput.track({
        onReset: () => send({ type: "RESET" }),
        current: mirror,
        onNativeInput: (input) => {
          const n = input.value === "" ? null : Number(input.value)
          send({ type: "INPUT.ADOPT", value: n !== null && Number.isFinite(n) ? n : null })
          return true
        },
      }),
    [formInput, send, mirror],
  )
  const field = mergeFieldProps(
    {
      role: "spinbutton",
      labelable: true,
      disabled: ctx.disabled,
      readOnly: ctx.readOnly,
      ...(binding?.name === undefined ? {} : { name: binding.name }),
    },
    binding,
  )
  const props = { ...api.hiddenInput(), name: field.name, required: field.required || undefined }
  return <input {...normalizeProps(props)} ref={ctx.hiddenEl} />
}

function Control({
  render,
  ...rest
}: ComponentPropsWithRef<"div"> & {
  /** Another element or a render function receiving the props and the number input's state. */
  readonly render?: RenderProp<NumberInputState>
}) {
  const ctx = useNumberInput("Control")
  const api = useApi(ctx, useFieldBindingPeek())
  return renderPart("div", mergeProps(normalizeProps(api.control()), rest), render, stateOf(ctx))
}

const stateOf = (ctx: Ctx): NumberInputState => ({
  value: ctx.view.values.value ?? null,
  text: ctx.view.context.text,
  spinning: ctx.view.matches("spinning"),
  composing: ctx.view.matches("composing"),
  disabled: ctx.disabled,
  readOnly: ctx.readOnly,
})

function Input({
  render,
  ref,
  id,
  inputMode,
  ...rest
}: Omit<ComponentPropsWithRef<"input">, "value" | "defaultValue"> & {
  /** Another element or a render function receiving the props and the number input's state. */
  readonly render?: RenderProp<NumberInputState>
}) {
  const ctx = useNumberInput("Input")
  const env = useEnvironment()
  const binding = useFieldControl()
  const api = useApi(ctx, binding)
  const controlId = id ?? binding?.controlId ?? ctx.ids.input
  const { send, setInputId } = ctx
  useIsoLayoutEffect(() => setInputId(controlId), [controlId, setInputId])
  const register = binding?.register
  useIsoLayoutEffect(() => {
    if (!register) return
    return register(
      {
        id: controlId,
        labelable: true,
        focus: (m) => {
          if (ctx.inputEl.current) void focusSafely(ctx.inputEl.current, env, "programmatic", m)
        },
        validityElement: () => ctx.hiddenEl.current,
        value: () => ctx.view.values.value ?? null,
      },
      controlId,
    )
  }, [register, controlId, env])
  // Each applied change is reported to the Field once (spec "Field Integration").
  const value = ctx.view.values.value ?? null
  const reported = useRef(value)
  const report = binding?.report
  useEffect(() => {
    if (Object.is(reported.current, value)) return
    reported.current = value
    report?.({ type: "change", value, user: true, composing: false })
  }, [value, report])
  // Insertions are checked before they apply (`beforeinput` is not React's onBeforeInput).
  const caret = useRef<number | null>(null)
  const keypadLocale = quirkActive("keypad-decimal-separator", env)
    ? (globalThis.navigator?.language ?? "en")
    : undefined
  const latest = useRef({ ctx, keypadLocale })
  latest.current = { ctx, keypadLocale }
  useEffect(() => {
    const el = ctx.inputEl.current
    if (!el) return
    const onBeforeInput = (e: Event) => {
      const ie = e as InputEvent
      const { ctx: c, keypadLocale: kl } = latest.current
      if (c.view.matches("composing") || ie.isComposing) return
      const plan = planInsertion(
        {
          text: el.value,
          selectionStart: el.selectionStart ?? el.value.length,
          selectionEnd: el.selectionEnd ?? el.value.length,
          data: ie.data,
          inputType: ie.inputType,
        },
        c.parser,
        { allowNegative: c.min === undefined || c.min < 0, keypadLocale: kl },
      )
      if (plan.kind === "accept") return
      e.preventDefault()
      if (plan.kind === "replace") {
        caret.current = plan.caret
        c.send({ type: "INPUT", text: plan.text })
      }
    }
    el.addEventListener("beforeinput", onBeforeInput)
    return () => el.removeEventListener("beforeinput", onBeforeInput)
  }, [ctx.inputEl])
  useIsoLayoutEffect(() => {
    const el = ctx.inputEl.current
    if (caret.current === null || !el) return
    el.setSelectionRange(caret.current, caret.current)
    caret.current = null
  })
  // The wheel steps the focused input only, vertically, without Ctrl (react-spectrum#1792).
  const focused = ctx.view.context.focused
  useEffect(() => {
    const el = ctx.inputEl.current
    if (!el || !focused || !ctx.allowWheel) return
    const onWheel = (e: WheelEvent) => {
      const c = latest.current.ctx
      if (e.ctrlKey || c.disabled || c.readOnly) return
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || e.deltaY === 0) return
      e.preventDefault()
      c.send({ type: "WHEEL", direction: e.deltaY < 0 ? 1 : -1, large: e.shiftKey })
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [focused, ctx.allowWheel, ctx.inputEl])
  const handlers = {
    onChange: (e: { currentTarget: HTMLInputElement }) =>
      send({ type: "INPUT", text: e.currentTarget.value }),
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.defaultPrevented) return
      const event = numberInputKey(describeKey(e.nativeEvent, env), {
        hasMin: ctx.min !== undefined,
        hasMax: ctx.max !== undefined,
      })
      if (!event) return
      if (event.type === "COMMIT") {
        // Commit first, then the browser's implicit submission sends the new value.
        send(event)
        report?.({ type: "commit" })
        return
      }
      e.preventDefault()
      send(event)
    },
    onPaste: (e: ClipboardEvent<HTMLInputElement>) => {
      const el = e.currentTarget
      const whole =
        el.value === "" ||
        ((el.selectionStart ?? 0) === 0 && (el.selectionEnd ?? 0) === el.value.length)
      if (!whole || ctx.disabled || ctx.readOnly) return
      const text = e.clipboardData.getData("text")
      e.preventDefault()
      if (ctx.parser.parse(text) !== null) send({ type: "PASTE", text })
    },
    onCompositionStart: () => send({ type: "COMPOSITION.START" }),
    onCompositionEnd: (e: { currentTarget: HTMLInputElement }) =>
      send({ type: "COMPOSITION.END", text: e.currentTarget.value }),
    onFocus: () => send({ type: "FOCUS", modality: env.modality.modality() }),
    onBlur: () => send({ type: "BLUR" }),
  }
  const own = normalizeProps({
    ...api.input(),
    id: controlId,
    ...(inputMode === undefined ? {} : { inputmode: inputMode }),
  })
  const props = mergeProps(
    {
      ...joinHandlers(own, handlers),
      // The server's locale may differ: the text is reformatted after hydration (design §5).
      suppressHydrationWarning: true,
      ref: composeRefs(ctx.inputEl, ref),
    },
    rest,
  )
  return renderPart("input", props, render, stateOf(ctx))
}

function useTrigger(t: NumberInputTrigger, part: string) {
  const ctx = useNumberInput(part)
  const env = useEnvironment()
  const api = useApi(ctx, useFieldBindingPeek())
  const { send, setPressed } = ctx
  const latest = useRef(ctx)
  latest.current = ctx
  const props = t === "increment" ? api.incrementTrigger() : api.decrementTrigger()
  const off = props["aria-disabled"] === "true"
  const press = usePress({
    env,
    // Pressing never takes focus (press without focus): a mouse moves it to the input.
    focusOnPress: false,
    suppressTouchContextMenu: true,
    disabled: () => off,
    send: (e) => {
      if (
        e.type !== "PRESS.START" &&
        e.type !== "PRESS" &&
        e.type !== "PRESS.END" &&
        e.type !== "PRESS.CANCEL"
      )
        return
      // A mouse press moves focus to the input; touch and stylus never do (a stylus tap must
      // not open the tablet keyboard: base-ui#1528).
      if (e.type === "PRESS.START" && e.pointerType === "mouse") {
        const input = latest.current.inputEl.current
        if (input && input.ownerDocument.activeElement !== input) {
          void focusSafely(input, env, "programmatic", "pointer")
        }
      }
      send({
        type: e.type,
        trigger: t,
        pointerType: e.pointerType,
        modality: e.modality,
      } as NumberInputEvent)
    },
  })
  useEffect(() => setPressed(t, press.pressed), [t, press.pressed, setPressed])
  // The pointer left a held trigger: repeats stop (the press itself goes on).
  const holding = ctx.view.matches("pressing", "spinning") && ctx.view.context.trigger === t
  const wasPressed = useRef(false)
  useEffect(() => {
    if (wasPressed.current && !press.pressed && holding) send({ type: "PRESS.LEAVE" })
    wasPressed.current = press.pressed
  }, [press.pressed, holding, send])
  return { own: { ...normalizeProps(props), ...press.props }, state: stateOf(ctx) }
}

type TriggerProps = ComponentPropsWithRef<"button"> & {
  /** Another element or a render function receiving the props and the number input's state. */
  readonly render?: RenderProp<NumberInputState>
}

function IncrementTrigger({ render, children, ...rest }: TriggerProps) {
  const { own, state } = useTrigger("increment", "IncrementTrigger")
  return renderPart("button", { ...mergeProps(own, rest), children }, render, state)
}

function DecrementTrigger({ render, children, ...rest }: TriggerProps) {
  const { own, state } = useTrigger("decrement", "DecrementTrigger")
  return renderPart("button", { ...mergeProps(own, rest), children }, render, state)
}

export const NumberInput = {
  Root,
  Label: HostLabel,
  Description: HostDescription,
  ErrorMessage: HostErrorMessage,
  Control,
  Input,
  IncrementTrigger,
  DecrementTrigger,
}
