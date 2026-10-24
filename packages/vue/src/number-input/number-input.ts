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
  type ComputedRef,
  computed,
  defineComponent,
  h,
  type InjectionKey,
  inject,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  type PropType,
  provide,
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
import { useEnvironment, useLocale, useMessages } from "../provider"
import { asChildProp, renderPart } from "../render"
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
  readonly instance: () => string
  readonly view: () => Machine["view"]["value"]
  readonly send: Machine["send"]
  readonly parser: () => ReturnType<typeof createNumberParser>
  readonly messages: () => NumberInputMessages
  readonly disabled: () => boolean
  readonly readOnly: () => boolean
  readonly min: () => number | undefined
  readonly max: () => number | undefined
  readonly step: () => number | undefined
  readonly defaultValue: () => number | null
  readonly allowWheel: () => boolean
  readonly form: () => string | undefined
  readonly dir: () => "ltr" | "rtl"
  readonly inputEl: { value: Element | null }
  readonly hiddenEl: { value: Element | null }
  readonly formInput: ReturnType<typeof hiddenFormInput>
  readonly mounted: () => boolean
  readonly pressed: () => { increment: boolean; decrement: boolean }
  readonly setPressed: (t: NumberInputTrigger, on: boolean) => void
  readonly ids: () => { input: string; increment: string; decrement: string; hiddenInput: string }
  readonly setInputId: (id: string) => void
}
const NumberInputKey: InjectionKey<Ctx> = Symbol("rind-ui.number-input")
/**
 * Internal (not exported from the package): set by a component that renders a Number Input as
 * its part (Color Picker's channel input): the host's scope and part names.
 */
export const NumberInputNamingKey: InjectionKey<PartNaming<NumberInputPart>> = Symbol(
  "rind-ui.number-input-naming",
)
function useNumberInput(part: string): Ctx {
  const ctx = inject(NumberInputKey, null)
  if (!ctx) throw new Error(`NumberInput.${part} must be inside NumberInput.Root`)
  return ctx
}
const asInput = (el: Element | null) => (el instanceof HTMLInputElement ? el : null)
const stateOf = (ctx: Ctx): NumberInputState => ({
  value: ctx.view().values.value ?? null,
  text: ctx.view().context.text,
  spinning: ctx.view().matches("spinning"),
  composing: ctx.view().matches("composing"),
  disabled: ctx.disabled(),
  readOnly: ctx.readOnly(),
})
type Slots = SlotsType<{ default?: (state: NumberInputState) => VNodeChild }>

const Root = defineComponent({
  name: "NumberInputRoot",
  inheritAttrs: false,
  props: {
    ...fieldRootProps,
    /** Controlled value (`v-model`); `null` is empty. */
    modelValue: { type: Number as PropType<number | null>, default: undefined },
    /** Read at creation (default empty); a later change only changes what a form reset restores. */
    defaultValue: { type: Number as PropType<number | null>, default: null },
    min: Number,
    max: Number,
    /** Default 1 (0.01 for percent). A commit snaps to an explicit step only. */
    step: Number,
    largeStep: Number,
    formatOptions: Object as PropType<Intl.NumberFormatOptions>,
    locale: String,
    dir: String as PropType<"ltr" | "rtl">,
    commitBehavior: String as PropType<"snap" | "validate">,
    allowWheel: Boolean,
    spinOnPress: { type: Boolean, default: undefined },
    spinDelay: Number,
    spinInterval: Number,
    form: String,
    messages: Object as PropType<MessageOverrides<NumberInputMessages>>,
    fieldMessages: Object as PropType<MessageOverrides<FieldMessages>>,
  },
  emits: {
    valueChange: (_value: number | null, _details: NumberInputChangeDetails) => true,
    "update:modelValue": (_value: number | null) => true,
    /** Once per interaction that changed the value (key, stepper release, wheel tick, blur/Enter). */
    valueCommit: (_value: number | null, _details: NumberInputCommitDetails) => true,
    /** Every accepted edit of the text (the value only changes at commit points). */
    inputValueChange: (_text: string) => true,
  },
  setup(props, { attrs, slots, emit }) {
    const naming = inject(NumberInputNamingKey, null)
    const env = useEnvironment(announcerCapability)
    const generated = useId()
    const instance = () => props.id ?? generated
    const locale = useLocale(
      () => props.locale,
      () => props.dir,
    )
    const messages = useMessages("number-input", numberInputMessages, () => props.messages)
    // Cached by value: an inline options object each render keeps the parser (RX#1893).
    const parser = computed(() => createNumberParser(locale.value.locale, props.formatOptions))
    const enclosing = useFieldBindingPeek()
    const fieldsetDisabled = useFieldsetDisabled()
    const disabled = () =>
      props.disabled || enclosing?.value.state.disabled === true || fieldsetDisabled.value
    const readOnly = () => props.readonly || enclosing?.value.state.readOnly === true
    const inputEl = shallowRef<Element | null>(null)
    const hiddenEl = shallowRef<Element | null>(null)
    const formInput = hiddenFormInput(
      { input: () => asInput(hiddenEl.value), control: () => asInput(inputEl.value) },
      env,
    )
    const { view, send } = useMachine(
      numberInputMachine,
      () => ({
        value: props.modelValue,
        defaultValue: props.defaultValue,
        onValueChange: (v: number | null, details) => {
          let cancelled = false
          emit("valueChange", v, {
            reason: publicReason(details.reason),
            modality: (details.event as { modality?: string }).modality,
            cancel: () => {
              cancelled = true
              details.cancel()
            },
          })
          if (!cancelled) emit("update:modelValue", v)
        },
        onValueCommit: (v: number | null, d: NumberInputCommitDetails) => emit("valueCommit", v, d),
        onInputValueChange: (t: string) => emit("inputValueChange", t),
        min: props.min,
        max: props.max,
        step: props.step,
        largeStep: props.largeStep,
        commitBehavior: props.commitBehavior,
        spinOnPress: props.spinOnPress,
        spinDelay: props.spinDelay,
        spinInterval: props.spinInterval,
        disabled: disabled(),
        readOnly: readOnly(),
        parser: parser.value,
        messages: messages.value,
        id: instance(),
      }),
      // The service is created once: the provider's scheduler and announcer, plus the input.
      { scheduler: env.scheduler, announcer: env.announcer, formInput },
    )
    const mounted = shallowRef(false)
    onMounted(() => (mounted.value = true))
    const pressed = shallowRef({ increment: false, decrement: false })
    const setPressed = (t: NumberInputTrigger, on: boolean) => {
      if (pressed.value[t] !== on) pressed.value = { ...pressed.value, [t]: on }
    }
    const inputId = shallowRef<string | null>(null)
    const ids = () => ({
      input: inputId.value ?? partId("number-input", instance(), "input"),
      increment: partId("number-input", instance(), "increment-trigger"),
      decrement: partId("number-input", instance(), "decrement-trigger"),
      hiddenInput: partId("number-input", instance(), "hidden-input"),
    })
    const modality = useModality(env.modality, () => view.value.context.focused)
    provide(NumberInputKey, {
      instance,
      view: () => view.value,
      send,
      parser: () => parser.value,
      messages: () => messages.value,
      disabled,
      readOnly,
      min: () => props.min,
      max: () => props.max,
      step: () => props.step,
      defaultValue: () => props.defaultValue,
      allowWheel: () => props.allowWheel,
      form: () => props.form,
      dir: () => locale.value.dir,
      inputEl,
      hiddenEl,
      formInput,
      mounted: () => mounted.value,
      pressed: () => pressed.value,
      setPressed,
      ids,
      setInputId: (id) => (inputId.value = id),
    })
    return () => {
      const focused = view.value.context.focused
      const rootData = {
        "data-focus": focused ? "" : undefined,
        "data-focus-visible":
          focused && modality.value !== "pointer" && modality.value !== "touch" ? "" : undefined,
        "data-spinning": view.value.matches("spinning") ? "" : undefined,
        "data-composing": view.value.matches("composing") ? "" : undefined,
      }
      const field = Object.fromEntries(
        Object.keys(fieldRootProps)
          .filter((k) => k !== "messages" && k !== "id")
          .map((k) => [k, (props as Record<string, unknown>)[k]]),
      )
      return h(
        FieldHost,
        {
          ...attrs,
          ...field,
          scope: naming?.scope ?? "number-input",
          ...(naming ? { rootPart: naming.part("root") } : {}),
          id: instance(),
          dir: locale.value.dir,
          ...(props.fieldMessages ? { messages: props.fieldMessages } : {}),
          ...rootData,
        },
        { default: () => [slots["default"]?.(), h(HiddenInput)] },
      )
    }
  },
})

/** The api of a part, with the Field binding merged. Call in setup; read in render. */
function useApi(ctx: Ctx, binding: ComputedRef<FieldControlBinding> | null) {
  const env = useEnvironment()
  const naming = inject(NumberInputNamingKey, null)
  const modality = useModality(env.modality, () => ctx.view().context.focused)
  return () => {
    const view = ctx.view()
    const b = binding?.value ?? null
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
        modality: modality.value,
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
const HiddenInput = defineComponent({
  name: "NumberInputHiddenInput",
  setup() {
    const ctx = useNumberInput("Root")
    const binding = useFieldBindingPeek()
    const apiFor = useApi(ctx, binding)
    const mirror = () => {
      const v = ctx.view().values.value ?? null
      return { value: v === null ? "" : String(v) }
    }
    // After every update: the input shows the value (hydration, a parent's change); no events.
    const sync = () => ctx.formInput.sync(mirror(), { dispatch: false })
    onMounted(() => {
      sync()
      onBeforeUnmount(
        ctx.formInput.track({
          onReset: () => ctx.send({ type: "RESET" }),
          current: mirror,
          onNativeInput: (input) => {
            const n = input.value === "" ? null : Number(input.value)
            ctx.send({ type: "INPUT.ADOPT", value: n !== null && Number.isFinite(n) ? n : null })
            return true
          },
        }),
      )
    })
    onUpdated(sync)
    return () => {
      const b = binding?.value ?? null
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
      return h("input", {
        ...normalizeProps({
          ...apiFor().hiddenInput(),
          name: field.name,
          required: field.required || undefined,
        }),
        ref: refTo(ctx.hiddenEl),
      })
    }
  },
})

const Control = defineComponent({
  name: "NumberInputControl",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useNumberInput("Control")
    const apiFor = useApi(ctx, useFieldBindingPeek())
    return () =>
      renderPart(
        "div",
        mergeProps(normalizeProps(apiFor().control()), attrs),
        slots.default?.(stateOf(ctx)),
        props.asChild,
      )
  },
})

const Input = defineComponent({
  name: "NumberInputInput",
  inheritAttrs: false,
  props: { id: String, inputmode: String, ...asChildProp },
  setup(props, { attrs }) {
    const ctx = useNumberInput("Input")
    const env = useEnvironment()
    const binding = useFieldControl()
    const apiFor = useApi(ctx, binding)
    const controlId = () =>
      props.id ?? binding?.value.controlId ?? partId("number-input", ctx.instance(), "input")
    // After mount, as React: the server HTML keeps the provisional id (docs/review-backlog.md).
    onMounted(() => watch(controlId, (id) => ctx.setInputId(id), { immediate: true }))
    const report = (e: Parameters<FieldControlBinding["report"]>[0]) => binding?.value.report(e)
    // Insertions are checked before they apply.
    let caret: number | null = null
    const keypadLocale = () =>
      quirkActive("keypad-decimal-separator", env)
        ? (globalThis.navigator?.language ?? "en")
        : undefined
    onMounted(() => {
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
                    const el = asInput(ctx.inputEl.value)
                    if (el) void focusSafely(el, env, "programmatic", m)
                  },
                  validityElement: () => asInput(ctx.hiddenEl.value),
                  value: () => ctx.view().values.value ?? null,
                },
                id,
              ),
            ),
          { immediate: true },
        )
      }
      // Each applied change is reported to the Field once (spec "Field Integration").
      let reported = ctx.view().values.value ?? null
      watch(
        () => ctx.view().values.value ?? null,
        (value) => {
          if (Object.is(reported, value)) return
          reported = value
          report({ type: "change", value, user: true, composing: false })
        },
      )
      const el = asInput(ctx.inputEl.value)
      if (!el) return
      const onBeforeInput = (e: Event) => {
        const ie = e as InputEvent
        if (ctx.view().matches("composing") || ie.isComposing) return
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
      onBeforeUnmount(() => el.removeEventListener("beforeinput", onBeforeInput))
      // The wheel steps the focused input only, vertically, without Ctrl (react-spectrum#1792).
      watch(
        () => ctx.view().context.focused && ctx.allowWheel(),
        (on, _old, onCleanup) => {
          if (!on) return
          const onWheel = (e: WheelEvent) => {
            if (e.ctrlKey || ctx.disabled() || ctx.readOnly()) return
            if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || e.deltaY === 0) return
            e.preventDefault()
            ctx.send({ type: "WHEEL", direction: e.deltaY < 0 ? 1 : -1, large: e.shiftKey })
          }
          el.addEventListener("wheel", onWheel, { passive: false })
          onCleanup(() => el.removeEventListener("wheel", onWheel))
        },
        { immediate: true },
      )
    })
    onUpdated(() => {
      const el = asInput(ctx.inputEl.value)
      if (caret === null || !el) return
      el.setSelectionRange(caret, caret)
      caret = null
    })
    const handlers = {
      onInput: (e: Event) => {
        if (e.currentTarget instanceof HTMLInputElement)
          ctx.send({ type: "INPUT", text: e.currentTarget.value })
      },
      onKeydown: (e: KeyboardEvent) => {
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
      onCompositionstart: () => ctx.send({ type: "COMPOSITION.START" }),
      onCompositionend: (e: CompositionEvent) => {
        if (e.currentTarget instanceof HTMLInputElement)
          ctx.send({ type: "COMPOSITION.END", text: e.currentTarget.value })
      },
      onFocusin: () => ctx.send({ type: "FOCUS", modality: env.modality.modality() }),
      onFocusout: () => ctx.send({ type: "BLUR" }),
    }
    return () => {
      const own = normalizeProps({
        ...apiFor().input(),
        id: controlId(),
        ...(props.inputmode === undefined ? {} : { inputmode: props.inputmode }),
      })
      return renderPart(
        "input",
        mergeProps({ ...joinHandlers(own, handlers), ref: refTo(ctx.inputEl) }, attrs),
        undefined,
        props.asChild,
      )
    }
  },
})

function trigger(t: NumberInputTrigger, part: string) {
  return defineComponent({
    name: `NumberInput${part}`,
    inheritAttrs: false,
    props: { ...asChildProp },
    setup(props, { attrs, slots }) {
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
            const input = asInput(ctx.inputEl.value)
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
      onMounted(() => {
        watch(press.pressed, (p) => ctx.setPressed(t, p), { immediate: true })
        // The pointer left a held trigger: repeats stop (the press itself goes on).
        watch(press.pressed, (p, was) => {
          const view = ctx.view()
          const holding = view.matches("pressing", "spinning") && view.context.trigger === t
          if (was && !p && holding) ctx.send({ type: "PRESS.LEAVE" })
        })
      })
      return () =>
        renderPart(
          "button",
          mergeProps({ ...normalizeProps(own()), ...press.props }, attrs),
          slots["default"]?.(stateOf(ctx)),
          props.asChild,
        )
    },
  })
}

const IncrementTrigger = trigger("increment", "IncrementTrigger")
const DecrementTrigger = trigger("decrement", "DecrementTrigger")

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
