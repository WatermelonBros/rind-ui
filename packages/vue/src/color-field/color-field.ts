// Color Field and Color Channel Field parts (design §6): wiring only. The Color Field's
// machine owns the draft and the commit points; the text filter runs on the resulting text in
// `beforeinput` and again in `input` (react-spectrum#3985). The Channel Field is a Number Input
// with props computed from the channel.
import {
  type Color,
  type ColorChangeDetails,
  type ColorChannel,
  type ColorSpace,
  colorValueMachine,
  colorValueOf,
  describeKey,
  type FieldMessages,
  type FlushRegistry,
  focusSafely,
  hiddenFormInput,
  type MessageOverrides,
  makeColor,
  mergeFieldProps,
  partId,
  withChannel,
  workingOf,
} from "@rind-ui/core"
import {
  acceptColorText,
  COLOR_PICKER_SCOPE,
  type ColorFieldFormat,
  type ColorFieldMessages,
  channelInputNaming,
  colorChannelFieldProps,
  colorFieldConnect,
  colorFieldFormValue,
  colorFieldKeyEvent,
  colorFieldMachine,
  colorFieldMessages,
  colorFieldPart,
  colorFieldValue,
  colorVariables,
} from "@rind-ui/core/internal"
import {
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
  type ShallowRef,
  shallowRef,
  watch,
} from "vue"
import { colorProp, useColorProp } from "../color-input"
import { fieldRootProps, useFieldBindingPeek, useFieldControl } from "../field/context"
import { FieldHost, HostDescription, HostErrorMessage, HostLabel } from "../field/field-host"
import { useFieldsetDisabled } from "../fieldset/context"
import { joinHandlers } from "../join-handlers"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { NumberInputNamingKey } from "../number-input/number-input"
import * as NumberInput from "../number-input/number-input.parts"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { asChildProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare module "../provider" {
  interface RindMessageScopes {
    "color-field": ColorFieldMessages
  }
}

/** The flush registry an owner (the Color Picker) provides: each field registers its `flush`. */
export const ColorFlushKey: InjectionKey<FlushRegistry> = Symbol("rind-ui.color-flush")

// --- Color Field ---

export interface ColorFieldState {
  readonly value: Color | null
  readonly text: string
  readonly dirty: boolean
  readonly invalid: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
}

export type ColorFieldReason = "INPUT.COMMIT" | "RESET" | "ADOPT"

interface FieldCtx {
  readonly api: () => ReturnType<typeof colorFieldConnect>
  readonly state: () => ColorFieldState
  readonly send: ReturnType<typeof useMachine<typeof colorFieldMachine>>["send"]
  readonly inputEl: ShallowRef<Element | null>
  readonly hiddenEl: ShallowRef<Element | null>
  readonly formInput: ReturnType<typeof hiddenFormInput>
  readonly format: () => ColorFieldFormat
  readonly alpha: () => boolean
  readonly setFocused: (on: boolean) => void
  readonly invalidMessage: () => string
  readonly value: () => Color | null
}
const FieldKey: InjectionKey<FieldCtx> = Symbol("rind-ui.color-field")
function useColorField(part: string): FieldCtx {
  const ctx = inject(FieldKey, null)
  if (!ctx) throw new Error(`ColorField.${part} must be inside ColorField.Root`)
  return ctx
}

const reasonOf = (r: string): ColorFieldReason =>
  r === "RESET" ? "RESET" : r === "ADOPT" ? "ADOPT" : "INPUT.COMMIT"
const { messages: _fieldMessages, ...fieldProps } = fieldRootProps
void _fieldMessages
const input = (el: Element | null) => (el instanceof HTMLInputElement ? el : null)

/** A text input for a whole colour: hex by default, any CSS colour with `format="css"`. */
const Root = defineComponent({
  name: "ColorFieldRoot",
  inheritAttrs: false,
  props: {
    ...fieldProps,
    /** The colour (`v-model`); null: no colour. */
    modelValue: colorProp,
    /** Default `null` (no colour). */
    defaultValue: colorProp,
    /** `hex` (default): hex digits with an optional `#`; `css`: any CSS colour. */
    format: { type: String as PropType<ColorFieldFormat>, default: "hex" },
    /** Accept and show 8-digit hex (default false: the alpha never changes). */
    alpha: Boolean,
    colorSpace: String as PropType<ColorSpace>,
    /** The id of the form the hidden input belongs to. */
    form: String,
    /** Sets the direction when `dir` is not given. Default: the provider's. */
    locale: String,
    /** Reading direction of the root. Default: the locale's, else the provider's. */
    dir: String as PropType<"ltr" | "rtl">,
    messages: Object as PropType<MessageOverrides<ColorFieldMessages>>,
    /** The Field's messages when the Root is the Field. */
    fieldMessages: Object as PropType<MessageOverrides<FieldMessages>>,
  },
  emits: {
    valueChange: (
      _color: Color | null,
      _details: ColorChangeDetails<ColorFieldReason> & { readonly modality?: string | undefined },
    ) => true,
    "update:modelValue": (_color: Color | null) => true,
    /** Every accepted edit of the text (the value changes only at commit points). */
    inputValueChange: (_text: string) => true,
  },
  setup(props, { attrs, slots, emit }) {
    const env = useEnvironment()
    const instance = useRootId(() => props.id)()
    const loc = useLocale(
      () => props.locale,
      () => props.dir,
    )
    const messages = useMessages("color-field", colorFieldMessages, () => props.messages)
    const parsedValue = useColorProp(() => props.modelValue ?? undefined, "value", "color-field")
    const parsedDefault = useColorProp(
      () => props.defaultValue ?? undefined,
      "defaultValue",
      "color-field",
    )
    const value = () => (props.modelValue === null ? null : parsedValue())
    const defaultValue = () => (props.defaultValue === null ? null : (parsedDefault() ?? null))
    const enclosing = useFieldBindingPeek()
    const fieldsetDisabled = useFieldsetDisabled()
    const disabled = () =>
      props.disabled === true || enclosing?.value.state.disabled === true || fieldsetDisabled.value
    const readOnly = () => props.readonly === true || enclosing?.value.state.readOnly === true
    const inputEl = shallowRef<Element | null>(null)
    const hiddenEl = shallowRef<Element | null>(null)
    const formInput = hiddenFormInput(
      { input: () => input(hiddenEl.value), control: () => input(inputEl.value) },
      env,
    )
    const { view, send } = useMachine(
      colorFieldMachine,
      () => ({
        value: value(),
        defaultValue: defaultValue(),
        format: props.format,
        alpha: props.alpha,
        colorSpace: props.colorSpace,
        disabled: disabled(),
        readOnly: readOnly(),
        onValueChange: (c: Color | null, d: { reason: string; cancel(): void }) => {
          // Uncontrolled: the form value is current before an implicit submission reads it.
          if (props.modelValue === undefined) {
            formInput.sync({ value: colorFieldFormValue(c) }, { dispatch: false })
          }
          emit("valueChange", c, {
            reason: reasonOf(d.reason),
            space: c?.space ?? props.colorSpace ?? "rgb",
            cancel: d.cancel,
          })
          emit("update:modelValue", c)
        },
        onInputValueChange: (t: string) => emit("inputValueChange", t),
      }),
      {},
    )
    const focused = shallowRef(false)
    const modality = useModality(env.modality, () => focused.value)
    // The modality tracker must see the key or pointer that comes before the input's focus.
    onMounted(() => onBeforeUnmount(env.modality.subscribe(() => {})))
    const field = computed(() =>
      mergeFieldProps(
        {
          role: "textbox",
          labelable: true,
          disabled: disabled(),
          readOnly: readOnly(),
          required: props.required === true,
          invalid: props.invalid === true,
          ...(props.name === undefined ? {} : { name: props.name }),
        },
        enclosing?.value ?? null,
      ),
    )
    const current = () =>
      colorFieldValue(
        { value: value(), defaultValue: defaultValue(), format: props.format, alpha: props.alpha },
        view.value.values.value,
      )
    const api = computed(() => {
      const dirty = view.value.state !== "idle"
      return colorFieldConnect({
        instance,
        value: current(),
        draft: dirty ? view.value.context.draft : null,
        invalidDraft: view.value.state === "invalid",
        format: props.format,
        alpha: props.alpha,
        field: field.value,
        focused: focused.value,
        modality: modality.value,
        ids: {
          input: partId("color-field", instance, "input"),
          hiddenInput: partId("color-field", instance, "hidden-input"),
        },
        form: props.form,
        defaultValue: defaultValue(),
      })
    })
    const state = (): ColorFieldState => {
      const dirty = view.value.state !== "idle"
      return {
        value: current(),
        text: api.value.text,
        dirty,
        invalid: view.value.state === "invalid" || field.value.invalid,
        disabled: disabled(),
        readOnly: readOnly(),
      }
    }
    // An owner's flush (a picker closing) commits a valid draft first.
    const registry = inject(ColorFlushKey, null)
    if (registry) {
      onMounted(() => onBeforeUnmount(registry.register(() => send({ type: "FLUSH" }))))
    }
    provide(FieldKey, {
      api: () => api.value,
      state,
      send,
      inputEl,
      hiddenEl,
      formInput,
      format: () => props.format,
      alpha: () => props.alpha,
      setFocused: (on) => (focused.value = on),
      invalidMessage: () => messages.value.invalid,
      value: current,
    })
    return () => {
      const own = Object.fromEntries(
        Object.keys(fieldProps)
          .filter((k) => k !== "id")
          .map((k) => [k, (props as Record<string, unknown>)[k]]),
      )
      return h(
        FieldHost,
        {
          ...attrs,
          ...own,
          scope: COLOR_PICKER_SCOPE,
          rootPart: colorFieldPart("root"),
          id: instance,
          dir: loc.value.dir,
          ...(props.fieldMessages ? { messages: props.fieldMessages } : {}),
          ...api.value.rootData,
        },
        () => [slots["default"]?.(), h(HiddenInput)],
      )
    }
  },
})

/** The hidden input: name, `required`, validity, reset, autofill. */
const HiddenInput = defineComponent({
  name: "ColorFieldHiddenInput",
  setup() {
    const ctx = useColorField("Root")
    const mirror = () => ({ value: colorFieldFormValue(ctx.value()) })
    const sync = () => {
      ctx.formInput.sync(mirror(), { dispatch: false })
      // A committed text that is not a colour makes the field invalid (the Field's badInput).
      const s = ctx.state()
      input(ctx.hiddenEl.value)?.setCustomValidity(s.dirty && s.invalid ? ctx.invalidMessage() : "")
    }
    onMounted(() => {
      sync()
      onBeforeUnmount(
        ctx.formInput.track({
          onReset: () => ctx.send({ type: "RESET" }),
          current: mirror,
          onNativeInput: (el) => {
            ctx.send({ type: "ADOPT", text: el.value })
            return true
          },
        }),
      )
      watch(() => [mirror().value, ctx.state().dirty, ctx.state().invalid].join("|"), sync, {
        flush: "post",
      })
    })
    onUpdated(sync)
    return () =>
      h("input", { ...normalizeProps(ctx.api().hiddenInput()), ref: refTo(ctx.hiddenEl) })
  },
})

/** The text input: free text until Enter, blur or a flush. */
const Input = defineComponent({
  name: "ColorFieldInput",
  inheritAttrs: false,
  props: { ...asChildProp },
  setup(props, { attrs }) {
    const ctx = useColorField("Input")
    const env = useEnvironment()
    const binding = useFieldControl()
    const controlId = () =>
      (attrs["id"] as string | undefined) ??
      binding?.value.controlId ??
      (ctx.api().input()["id"] as string)
    if (binding) {
      onMounted(() =>
        watch(
          controlId,
          (id, _, onCleanup) => {
            onCleanup(
              binding.value.register(
                {
                  id,
                  labelable: true,
                  focus: (m) => {
                    const el = input(ctx.inputEl.value)
                    if (el) void focusSafely(el, env, "programmatic", m)
                  },
                  validityElement: () => input(ctx.hiddenEl.value),
                  value: () => ctx.value(),
                },
                id,
              ),
            )
          },
          { immediate: true },
        ),
      )
    }
    // The resulting text is checked before it applies.
    onMounted(() =>
      watch(
        ctx.inputEl,
        (node, _, onCleanup) => {
          const el = input(node)
          if (!el) return
          const onBeforeInput = (e: Event) => {
            const ie = e as InputEvent
            const start = el.selectionStart ?? el.value.length
            const end = el.selectionEnd ?? el.value.length
            const pasted = ie.inputType === "insertFromPaste" || ie.inputType === "insertFromDrop"
            if (!ie.inputType.startsWith("insert") || ie.data === null) return
            const data = pasted ? ie.data.trim() : ie.data
            const next = el.value.slice(0, start) + data + el.value.slice(end)
            if (acceptColorText(next, ctx.format(), ctx.alpha())) {
              if (pasted && data !== ie.data) {
                e.preventDefault()
                ctx.send({ type: "INPUT", text: next })
              }
              return
            }
            e.preventDefault()
          }
          el.addEventListener("beforeinput", onBeforeInput)
          onCleanup(() => el.removeEventListener("beforeinput", onBeforeInput))
        },
        { immediate: true },
      ),
    )
    const handlers = {
      // Devices that do not cancel `beforeinput` (Android composition): checked again here.
      onInput: (e: Event) => {
        const el = e.currentTarget as HTMLInputElement
        const text = el.value
        if (acceptColorText(text, ctx.format(), ctx.alpha())) ctx.send({ type: "INPUT", text })
        else el.value = ctx.api().text
      },
      onKeydown: (e: KeyboardEvent) => {
        if (e.defaultPrevented) return
        const event = colorFieldKeyEvent(describeKey(e, env), ctx.state().dirty)
        if (!event) return
        // Escape reverts a dirty draft only: the layer around stays open (handled Escape).
        if (event.type === "ESCAPE") e.preventDefault()
        ctx.send(event)
      },
      onFocus: () => ctx.setFocused(true),
      onBlur: () => {
        ctx.setFocused(false)
        ctx.send({ type: "BLUR" })
      },
    }
    return () => {
      const { id: _id, ...rest } = attrs
      void _id
      const own = normalizeProps({ ...ctx.api().input(), id: controlId() })
      return renderPart(
        "input",
        mergeProps({ ...joinHandlers(own, handlers), ref: refTo(ctx.inputEl) }, rest),
        undefined,
        props.asChild,
      )
    }
  },
})

export const ColorField = {
  Root,
  Label: HostLabel,
  Description: HostDescription,
  ErrorMessage: HostErrorMessage,
  Input,
}

// --- Color Channel Field: a Number Input bound to one channel ---

const CHANNEL_DEFAULT = makeColor("hsb", [0, 100, 100])
const ChannelKey: InjectionKey<() => string> = Symbol("rind-ui.color-channel-field")

/** A numeric input for one channel of a colour (a Number Input). */
const ChannelRoot = defineComponent({
  name: "ColorChannelFieldRoot",
  inheritAttrs: false,
  props: {
    channel: { type: String as PropType<ColorChannel>, required: true },
    /** The colour (`v-model`). */
    modelValue: colorProp,
    /** Default `hsb(0, 100%, 100%)`. */
    defaultValue: colorProp,
    colorSpace: String as PropType<ColorSpace>,
  },
  emits: {
    valueChange: (_color: Color, _details: ColorChangeDetails) => true,
    "update:modelValue": (_color: Color) => true,
    valueCommit: (_color: Color, _details: { readonly reason: string }) => true,
  },
  setup(props, { attrs, slots, emit }) {
    const value = useColorProp(() => props.modelValue ?? undefined, "value", "color-channel-field")
    const defaultValue = useColorProp(
      () => props.defaultValue ?? undefined,
      "defaultValue",
      "color-channel-field",
    )
    const first = value() ?? defaultValue()
    const channel = props.channel
    const space: ColorSpace =
      props.colorSpace ??
      (first && (channel === "alpha" || withChannel(first, channel, 0).space === first.space)
        ? first.space
        : channel === "red" || channel === "green" || channel === "blue"
          ? "rgb"
          : channel === "lightness"
            ? "hsl"
            : "hsb")
    const machineProps = () => ({
      value: value(),
      defaultValue: defaultValue(),
      space,
      fallback: CHANNEL_DEFAULT,
      onValueChange: (c: Color, d: { reason: string; event: unknown; cancel(): void }) => {
        emit("valueChange", c, {
          reason: (d.event as { reason?: string }).reason ?? d.reason,
          space,
          cancel: d.cancel,
        })
        emit("update:modelValue", c)
      },
      onValueCommit: (c: Color, d: { readonly reason: string }) => emit("valueCommit", c, d),
    })
    const { view, send } = useMachine(colorValueMachine, machineProps, {})
    const color = () =>
      workingOf(
        machineProps(),
        view.value.context,
        colorValueOf(machineProps(), view.value.values.value),
      )
    const messages = useMessages("color-field", colorFieldMessages)
    provide(ChannelKey, () => messages.value.channelName(props.channel))
    provide(NumberInputNamingKey, channelInputNaming)
    return () => {
      const c = color()
      const memory = view.value.context.memory
      const {
        "data-channel": dataChannel,
        value: n,
        ...numberProps
      } = colorChannelFieldProps(c, props.channel, memory)
      const vars = normalizeProps({ style: colorVariables(c) }) as { style?: object }
      const { style, ...rest } = attrs as Record<string, unknown>
      return h(
        NumberInput.Root,
        {
          ...rest,
          ...numberProps,
          modelValue: n,
          "data-channel": dataChannel,
          style: [vars.style, style],
          // A colour always has every channel: an empty commit is refused (the text returns).
          onValueChange: (v: number | null) => {
            if (v === null) return
            send({
              type: "SET",
              color: withChannel(color(), props.channel, v, view.value.context.memory),
              reason: "INPUT",
            })
          },
          onValueCommit: (_n: number | null, d: { reason: unknown }) =>
            send({ type: "COMMIT", reason: String(d.reason) }),
        },
        slots,
      )
    }
  },
})

/** Named by the channel when there is no Label (a Label's `aria-labelledby` wins). */
const ChannelInput = defineComponent({
  name: "ColorChannelFieldInput",
  inheritAttrs: false,
  setup(_, { attrs }) {
    const channelName = inject(ChannelKey, () => "")
    return () => h(NumberInput.Input, { "aria-label": channelName(), ...attrs })
  },
})

/** The channel field's own parts; its Label, Control and triggers are the Number Input's. */
export const ColorChannelField = { Root: ChannelRoot, Input: ChannelInput }
