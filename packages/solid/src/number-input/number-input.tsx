/** @jsxImportSource solid-js */
// Number Input parts: wiring only. The machine owns the value and the text; connect every
// attribute, the insertion plan and the key mapping. The Root is a Field when not inside one
// (the shared Field host); the hidden number input carries name, constraints and reset.
import {
  announcerCapability,
  canStepNumber,
  createNumberParser,
  describeKey,
  type FieldControlBinding,
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
} from "@rind-ui/core"
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  type JSX,
  on,
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
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, reactive, renderPart, resolveChildren } from "../render"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { usePress } from "../use-press"

declare module "../provider" {
  interface RindMessageScopes {
    "number-input": NumberInputMessages
  }
}

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
  readonly instance: Accessor<string>
  readonly view: Machine["view"]
  readonly send: Machine["send"]
  readonly parser: Accessor<ReturnType<typeof createNumberParser>>
  readonly messages: Accessor<NumberInputMessages>
  readonly disabled: Accessor<boolean>
  readonly readOnly: Accessor<boolean>
  readonly min: Accessor<number | undefined>
  readonly max: Accessor<number | undefined>
  readonly step: Accessor<number | undefined>
  readonly defaultValue: Accessor<number | null>
  readonly allowWheel: Accessor<boolean>
  readonly form: Accessor<string | undefined>
  readonly dir: Accessor<"ltr" | "rtl">
  readonly inputEl: Accessor<Element | null>
  readonly setInputEl: (el: Element | null) => void
  readonly hiddenEl: Accessor<Element | null>
  readonly setHiddenEl: (el: Element | null) => void
  readonly formInput: ReturnType<typeof hiddenFormInput>
  readonly mounted: Accessor<boolean>
  readonly pressed: Accessor<{ increment: boolean; decrement: boolean }>
  readonly setPressed: (t: NumberInputTrigger, on: boolean) => void
  readonly ids: Accessor<{
    input: string
    increment: string
    decrement: string
    hiddenInput: string
  }>
  readonly setInputId: (id: string) => void
}
const NumberInputContext = createContext<Ctx>()
/**
 * Internal (not exported from the package): set by a component that renders a Number Input as
 * its part (Color Picker's channel input): the host's scope and part names.
 */
export const NumberInputNamingContext = createContext<PartNaming<NumberInputPart> | null>(null)
function useNumberInput(part: string): Ctx {
  const ctx = useContext(NumberInputContext)
  if (!ctx) throw new Error(`NumberInput.${part} must be inside NumberInput.Root`)
  return ctx
}
const asInput = (el: Element | null) => (el instanceof HTMLInputElement ? el : null)
const stateOf = (ctx: Ctx) =>
  reactive<NumberInputState>(() => ({
    value: ctx.view().values.value ?? null,
    text: ctx.view().context.text,
    spinning: ctx.view().matches("spinning"),
    composing: ctx.view().matches("composing"),
    disabled: ctx.disabled(),
    readOnly: ctx.readOnly(),
  }))

export type NumberInputRootProps = Omit<
  JSX.HTMLAttributes<HTMLDivElement>,
  "children" | "id" | "dir" | "defaultValue" | "onInput"
> &
  Omit<FieldRootOptions, "messages"> & {
    /** Controlled value; `null` is empty. */
    readonly value?: number | null | undefined
    /** Read at creation (default empty); a later change only changes what a form reset restores. */
    readonly defaultValue?: number | null | undefined
    readonly onValueChange?:
      | ((value: number | null, details: NumberInputChangeDetails) => void)
      | undefined
    /** Once per interaction that changed the value (key, stepper release, wheel tick, blur/Enter). */
    readonly onValueCommit?:
      | ((value: number | null, details: NumberInputCommitDetails) => void)
      | undefined
    /** Every accepted edit of the text (the value only changes at commit points). */
    readonly onInputValueChange?: ((text: string) => void) | undefined
    readonly min?: number | undefined
    readonly max?: number | undefined
    /** Default 1 (0.01 for percent). A commit snaps to an explicit step only. */
    readonly step?: number | undefined
    readonly largeStep?: number | undefined
    readonly formatOptions?: Intl.NumberFormatOptions | undefined
    readonly locale?: string | undefined
    readonly dir?: "ltr" | "rtl" | undefined
    readonly commitBehavior?: "snap" | "validate" | undefined
    readonly allowWheel?: boolean | undefined
    readonly spinOnPress?: boolean | undefined
    readonly spinDelay?: number | undefined
    readonly spinInterval?: number | undefined
    readonly form?: string | undefined
    readonly messages?: MessageOverrides<NumberInputMessages> | undefined
    readonly fieldMessages?: MessageOverrides<FieldMessages> | undefined
    readonly children?: JSX.Element
  }

function Root(props: NumberInputRootProps) {
  const [own, rest] = splitProps(props, [
    "value",
    "defaultValue",
    "onValueChange",
    "onValueCommit",
    "onInputValueChange",
    "min",
    "max",
    "step",
    "largeStep",
    "formatOptions",
    "locale",
    "dir",
    "commitBehavior",
    "allowWheel",
    "spinOnPress",
    "spinDelay",
    "spinInterval",
    "form",
    "messages",
    "fieldMessages",
    "children",
  ])
  const naming = useContext(NumberInputNamingContext)
  const env = useEnvironment(announcerCapability)
  const generated = createUniqueId()
  const instance = () => rest.id ?? generated
  const locale = useLocale(
    () => own.locale,
    () => own.dir,
  )
  const messages = useMessages("number-input", numberInputMessages, () => own.messages)
  // Cached by value: an inline options object each update keeps the parser (RX#1893).
  const parser = createMemo(() => createNumberParser(locale().locale, own.formatOptions))
  const enclosing = useFieldBindingPeek()
  const fieldsetDisabled = useFieldsetDisabled()
  const disabled = () =>
    rest.disabled === true || enclosing?.().state.disabled === true || fieldsetDisabled()
  const readOnly = () => rest.readOnly === true || enclosing?.().state.readOnly === true
  const [inputEl, setInputEl] = createSignal<Element | null>(null)
  const [hiddenEl, setHiddenEl] = createSignal<Element | null>(null)
  const formInput = hiddenFormInput(
    { input: () => asInput(hiddenEl()), control: () => asInput(inputEl()) },
    env,
  )
  const { view, send } = useMachine(
    numberInputMachine,
    () => ({
      value: own.value,
      defaultValue: own.defaultValue ?? null,
      onValueChange: (v: number | null, details) => {
        own.onValueChange?.(v, {
          reason: publicReason(details.reason),
          modality: (details.event as { modality?: string }).modality,
          cancel: () => details.cancel(),
        })
      },
      onValueCommit: (v: number | null, d: NumberInputCommitDetails) => own.onValueCommit?.(v, d),
      onInputValueChange: (t: string) => own.onInputValueChange?.(t),
      min: own.min,
      max: own.max,
      step: own.step,
      largeStep: own.largeStep,
      commitBehavior: own.commitBehavior,
      spinOnPress: own.spinOnPress,
      spinDelay: own.spinDelay,
      spinInterval: own.spinInterval,
      disabled: disabled(),
      readOnly: readOnly(),
      parser: parser(),
      messages: messages(),
      id: instance(),
    }),
    // The service is created once: the provider's scheduler and announcer, plus the input.
    { scheduler: env.scheduler, announcer: env.announcer, formInput },
  )
  const [mounted, setMounted] = createSignal(false)
  afterMount(() => setMounted(true))
  const [pressed, setPressedState] = createSignal({ increment: false, decrement: false })
  const setPressed = (t: NumberInputTrigger, on: boolean) => {
    if (untrack(pressed)[t] !== on) setPressedState((p) => ({ ...p, [t]: on }))
  }
  const [inputId, setInputId] = createSignal<string | null>(null)
  const ids = () => ({
    input: inputId() ?? partId("number-input", instance(), "input"),
    increment: partId("number-input", instance(), "increment-trigger"),
    decrement: partId("number-input", instance(), "decrement-trigger"),
    hiddenInput: partId("number-input", instance(), "hidden-input"),
  })
  const modality = useModality(env.modality, () => view().context.focused)
  const rootData = createMemo(() => {
    const focused = view().context.focused
    return {
      "data-focus": focused ? "" : undefined,
      "data-focus-visible":
        focused && modality() !== "pointer" && modality() !== "touch" ? "" : undefined,
      "data-spinning": view().matches("spinning") ? "" : undefined,
      "data-composing": view().matches("composing") ? "" : undefined,
    }
  })
  const ctx: Ctx = {
    instance,
    view,
    send,
    parser,
    messages,
    disabled,
    readOnly,
    min: () => own.min,
    max: () => own.max,
    step: () => own.step,
    defaultValue: () => own.defaultValue ?? null,
    allowWheel: () => own.allowWheel === true,
    form: () => own.form,
    dir: () => locale().dir,
    inputEl,
    setInputEl,
    hiddenEl,
    setHiddenEl,
    formInput,
    mounted,
    pressed,
    setPressed,
    ids,
    setInputId,
  }
  return (
    <FieldHost
      {...rest}
      scope={naming?.scope ?? "number-input"}
      {...(naming ? { rootPart: naming.part("root") } : {})}
      id={instance()}
      dir={locale().dir}
      messages={own.fieldMessages}
      attrs={rootData}
    >
      <NumberInputContext.Provider value={ctx}>
        {own.children}
        <HiddenInput />
      </NumberInputContext.Provider>
    </FieldHost>
  )
}

/** The api of a part, with the Field binding merged. Call in a component; read in a memo. */
function useApi(ctx: Ctx, binding: Accessor<FieldControlBinding> | null) {
  const env = useEnvironment()
  const naming = useContext(NumberInputNamingContext)
  const modality = useModality(env.modality, () => ctx.view().context.focused)
  return () => {
    const view = ctx.view()
    const b = binding?.() ?? null
    const field = mergeFieldProps(
      { role: "spinbutton", labelable: true, disabled: ctx.disabled(), readOnly: ctx.readOnly() },
      b,
    )
    const value = view.values.value ?? null
    const parser = ctx.parser()
    const range = { min: ctx.min(), max: ctx.max(), step: ctx.step() }
    return numberInputConnect(
      {
        instance: ctx.instance(),
        ...(naming ? { naming } : {}),
        value,
        text: view.context.text,
        defaultValue: ctx.defaultValue(),
        focused: view.context.focused,
        modality: modality(),
        composing: view.matches("composing"),
        spinning: view.matches("spinning"),
        field,
        fieldData: b?.data,
        ids: ctx.ids(),
        labelId: b?.ids.label,
        ...range,
        canIncrement: canStepNumber(value, 1, range),
        canDecrement: canStepNumber(value, -1, range),
        pressed: ctx.pressed(),
        parser,
        messages: ctx.messages(),
        plainTextbox: quirkActive("ios-vo-spinbutton-input", env),
        inputMode: inputModeOf(
          {
            fractions: parser.allowsFraction || (range.step !== undefined && range.step % 1 !== 0),
            allowNegative: range.min === undefined || range.min < 0,
            mounted: ctx.mounted(),
          },
          env.platform,
        ),
        form: ctx.form(),
        dir: ctx.dir(),
      },
      env,
    )
  }
}

/** The hidden `<input type="number">`: name, constraints, validity, reset, autofill. */
function HiddenInput() {
  const ctx = useNumberInput("Root")
  const binding = useFieldBindingPeek()
  const apiFor = useApi(ctx, binding)
  const mirror = () => {
    const v = ctx.view().values.value ?? null
    return { value: v === null ? "" : String(v) }
  }
  afterMount(() => {
    // The input shows the value (hydration, a parent's change); no events.
    createEffect(() => {
      ctx.hiddenEl()
      ctx.formInput.sync(mirror(), { dispatch: false })
    })
    onCleanup(
      ctx.formInput.track({
        onReset: () => ctx.send({ type: "RESET" }),
        current: () => untrack(mirror),
        onNativeInput: (input) => {
          const n = input.value === "" ? null : Number(input.value)
          ctx.send({ type: "INPUT.ADOPT", value: n !== null && Number.isFinite(n) ? n : null })
          return true
        },
      }),
    )
  })
  const props = createMemo(() => {
    const b = binding?.() ?? null
    const field = mergeFieldProps(
      {
        role: "spinbutton",
        labelable: true,
        disabled: ctx.disabled(),
        readOnly: ctx.readOnly(),
        ...(b?.name === undefined ? {} : { name: b.name }),
      },
      b,
    )
    return normalizeProps({
      ...apiFor().hiddenInput(),
      name: field.name,
      required: field.required || undefined,
    })
  })
  return <input {...props()} ref={ctx.setHiddenEl} />
}

type PartProps<A> = Omit<A, "children"> & {
  readonly render?: RenderProp<NumberInputState> | undefined
  readonly children?: JSX.Element | ((state: NumberInputState) => JSX.Element)
}

function Control(props: PartProps<JSX.HTMLAttributes<HTMLDivElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useNumberInput("Control")
  const apiFor = useApi(ctx, useFieldBindingPeek())
  const state = stateOf(ctx)
  const merged = createMemo(() => mergeProps(normalizeProps(apiFor().control()), rest))
  const children = () => resolveChildren(local.children, state)
  return renderPart(local.render, merged, state, children, (p) => <div {...p}>{children()}</div>)
}

export type NumberInputInputProps = Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "children"> & {
  readonly render?: RenderProp<NumberInputState> | undefined
}

function Input(props: NumberInputInputProps) {
  const [local, rest] = splitProps(props, ["id", "inputmode", "render"])
  const ctx = useNumberInput("Input")
  const env = useEnvironment()
  const binding = useFieldControl()
  const apiFor = useApi(ctx, binding)
  // A memo: the binding changes on every registration, the id (compared by value) does not.
  const controlId = createMemo(
    () => local.id ?? binding?.().controlId ?? partId("number-input", ctx.instance(), "input"),
  )
  const report = (e: Parameters<FieldControlBinding["report"]>[0]) => binding?.().report(e)
  // Insertions are checked before they apply.
  let caret: number | null = null
  const keypadLocale = () =>
    quirkActive("keypad-decimal-separator", env)
      ? (globalThis.navigator?.language ?? "en")
      : undefined
  afterMount(() => {
    // After mount, as React: the server HTML keeps the provisional id (docs/review-backlog.md).
    createEffect(() => ctx.setInputId(controlId()))
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
                  const el = asInput(ctx.inputEl())
                  if (el) void focusSafely(el, env, "programmatic", m)
                },
                validityElement: () => asInput(ctx.hiddenEl()),
                value: () => untrack(() => ctx.view().values.value ?? null),
              },
              id,
            ),
          ),
        )
      })
    }
    // Each applied change is reported to the Field once (spec "Field Integration").
    let reported = untrack(() => ctx.view().values.value ?? null)
    createEffect(() => {
      const value = ctx.view().values.value ?? null
      if (Object.is(reported, value)) return
      reported = value
      untrack(() => report({ type: "change", value, user: true, composing: false }))
    })
    const el = asInput(untrack(ctx.inputEl))
    if (!el) return
    const onBeforeInput = (e: Event) => {
      const ie = e as InputEvent
      if (untrack(() => ctx.view().matches("composing")) || ie.isComposing) return
      const min = ctx.min()
      const plan = planInsertion(
        {
          text: el.value,
          selectionStart: el.selectionStart ?? el.value.length,
          selectionEnd: el.selectionEnd ?? el.value.length,
          data: ie.data,
          inputType: ie.inputType,
        },
        ctx.parser(),
        { allowNegative: min === undefined || min < 0, keypadLocale: keypadLocale() },
      )
      if (plan.kind === "accept") return
      e.preventDefault()
      if (plan.kind === "replace") {
        caret = plan.caret
        ctx.send({ type: "INPUT", text: plan.text })
      }
    }
    el.addEventListener("beforeinput", onBeforeInput)
    onCleanup(() => el.removeEventListener("beforeinput", onBeforeInput))
    // The wheel steps the focused input only, vertically, without Ctrl (react-spectrum#1792).
    createEffect(() => {
      if (!(ctx.view().context.focused && ctx.allowWheel())) return
      const onWheel = (e: WheelEvent) => {
        if (e.ctrlKey || ctx.disabled() || ctx.readOnly()) return
        if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || e.deltaY === 0) return
        e.preventDefault()
        ctx.send({ type: "WHEEL", direction: e.deltaY < 0 ? 1 : -1, large: e.shiftKey })
      }
      el.addEventListener("wheel", onWheel, { passive: false })
      onCleanup(() => el.removeEventListener("wheel", onWheel))
    })
    // After the text is in the DOM: the caret an insertion plan asked for.
    createEffect(() => {
      ctx.view().context.text
      const input = asInput(ctx.inputEl())
      if (caret === null || !input) return
      input.setSelectionRange(caret, caret)
      caret = null
    })
  })
  const handlers = {
    onInput: (e: Event) => {
      if (e.currentTarget instanceof HTMLInputElement)
        ctx.send({ type: "INPUT", text: e.currentTarget.value })
    },
    onKeyDown: (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      const event = numberInputKey(describeKey(e, env), {
        hasMin: ctx.min() !== undefined,
        hasMax: ctx.max() !== undefined,
      })
      if (!event) return
      if (event.type === "COMMIT") {
        // Commit first, then the browser's implicit submission sends the new value.
        ctx.send(event)
        report({ type: "commit" })
        return
      }
      e.preventDefault()
      ctx.send(event)
    },
    onPaste: (e: ClipboardEvent) => {
      const el = e.currentTarget
      if (!(el instanceof HTMLInputElement)) return
      const whole =
        el.value === "" ||
        ((el.selectionStart ?? 0) === 0 && (el.selectionEnd ?? 0) === el.value.length)
      if (!whole || ctx.disabled() || ctx.readOnly()) return
      const text = e.clipboardData?.getData("text") ?? ""
      e.preventDefault()
      if (ctx.parser().parse(text) !== null) ctx.send({ type: "PASTE", text })
    },
    onCompositionStart: () => ctx.send({ type: "COMPOSITION.START" }),
    onCompositionEnd: (e: CompositionEvent) => {
      if (e.currentTarget instanceof HTMLInputElement)
        ctx.send({ type: "COMPOSITION.END", text: e.currentTarget.value })
    },
    onFocusIn: () => ctx.send({ type: "FOCUS", modality: env.modality.modality() }),
    onFocusOut: () => ctx.send({ type: "BLUR" }),
  }
  const state = stateOf(ctx)
  const merged = createMemo(() => {
    const ownProps = normalizeProps({
      ...apiFor().input(),
      id: controlId(),
      ...(local.inputmode === undefined ? {} : { inputmode: local.inputmode }),
    })
    // Like React's controlled input, the `value` attribute follows the text: it is what a
    // form reset restores, and what the markup shows (also when empty).
    if (typeof ownProps["value"] === "string") ownProps["attr:value"] = ownProps["value"]
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

function trigger(t: NumberInputTrigger, part: string) {
  return function Trigger(props: PartProps<JSX.ButtonHTMLAttributes<HTMLButtonElement>>) {
    const [local, rest] = splitProps(props, ["render", "children"])
    const ctx = useNumberInput(part)
    const env = useEnvironment()
    const apiFor = useApi(ctx, useFieldBindingPeek())
    const own = () =>
      t === "increment" ? apiFor().incrementTrigger() : apiFor().decrementTrigger()
    const press = usePress({
      env,
      // Pressing never takes focus (press without focus): a mouse moves it to the input.
      focusOnPress: false,
      suppressTouchContextMenu: true,
      disabled: () => own()["aria-disabled"] === "true",
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
          const input = asInput(ctx.inputEl())
          if (input && input.ownerDocument.activeElement !== input)
            void focusSafely(input, env, "programmatic", "pointer")
        }
        ctx.send({
          type: e.type,
          trigger: t,
          pointerType: e.pointerType,
          modality: e.modality,
        } as NumberInputEvent)
      },
    })
    afterMount(() => {
      createEffect(() => ctx.setPressed(t, press.pressed()))
      // The pointer left a held trigger: repeats stop (the press itself goes on).
      createEffect(
        on(
          press.pressed,
          (p, was) => {
            const view = untrack(ctx.view)
            const holding = view.matches("pressing", "spinning") && view.context.trigger === t
            if (was && !p && holding) ctx.send({ type: "PRESS.LEAVE" })
          },
          { defer: true },
        ),
      )
    })
    const state = stateOf(ctx)
    const merged = createMemo(() => mergeProps({ ...normalizeProps(own()), ...press.props }, rest))
    const children = () => resolveChildren(local.children, state)
    return renderPart(local.render, merged, state, children, (p) => (
      <button {...p}>{children()}</button>
    ))
  }
}

const IncrementTrigger = trigger("increment", "IncrementTrigger")
const DecrementTrigger = trigger("decrement", "DecrementTrigger")

export type NumberInputControlProps = PartProps<JSX.HTMLAttributes<HTMLDivElement>>
export type NumberInputTriggerProps = PartProps<JSX.ButtonHTMLAttributes<HTMLButtonElement>>

/** The parts, by name: `number-input.parts.ts` re-exports them as the `NumberInput` namespace. */
export {
  Control,
  DecrementTrigger,
  HostDescription as Description,
  HostErrorMessage as ErrorMessage,
  HostLabel as Label,
  IncrementTrigger,
  Input,
  Root,
}
