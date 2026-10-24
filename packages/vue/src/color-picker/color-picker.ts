// Color Picker parts (design §8): the coordinator machine owns the colour, the format and the
// open state; the Popover is its controlled child (re-scoped to `color-picker`), and every
// colour child (Area, Slider, Field, Channel Field, Swatch Picker, Swatch) is the component of
// its own, bound to the picker's colour. Wiring only.
import {
  announcerCapability,
  type Color,
  type ColorChangeDetails,
  type ColorChannel,
  type ColorFormat,
  type ColorInput,
  type ColorNameProp,
  type ColorPickerFormat,
  type ColorPickerMessages,
  type ColorPickerReason,
  type ColorSpace,
  colorPickerConnect,
  colorPickerMachine,
  colorPickerMessages,
  createFlushRegistry,
  focusAttrs,
  focusSafely,
  formatColor,
  isEyeDropperSupported,
  type MessageOverrides,
  nextFormat,
  PICKER_FORMATS,
  type PopoverProps,
  partId,
  pickerValueOf,
  pickerWorking,
  pickScreenColor,
} from "@rind-ui/core"
import {
  computed,
  defineComponent,
  Fragment,
  h,
  type InjectionKey,
  inject,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  type PropType,
  provide,
  type ShallowRef,
  type SlotsType,
  shallowRef,
  type VNodeChild,
  watch,
} from "vue"
import { ColorArea } from "../color-area/color-area"
import { ColorChannelField, ColorField, ColorFlushKey } from "../color-field/color-field"
import { colorProp, useColorProp } from "../color-input"
import { ColorSlider } from "../color-slider/color-slider"
import {
  ColorSwatch,
  TransparencyGrid as Grid,
  SwatchNamingKey,
} from "../color-swatch/color-swatch"
import { ColorSwatchPicker } from "../color-swatch-picker/color-swatch-picker"
import { FieldControlBoundary, useFieldControl } from "../field/field"
import { FieldHost, HostDescription, HostErrorMessage } from "../field/field-host"
import { joinHandlers } from "../join-handlers"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import * as Popover from "../popover/popover.parts"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { asChildProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

// Bundlers replace `process.env.NODE_ENV` and drop the dead branch in production builds.
declare const process: { env: { NODE_ENV?: string } }

declare module "../provider" {
  interface RindMessageScopes {
    "color-picker": ColorPickerMessages
  }
}

export interface ColorPickerState {
  readonly color: Color
  readonly format: ColorPickerFormat
  readonly open: boolean
  readonly inline: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
}

export interface ColorPickerChangeDetails extends ColorChangeDetails<ColorPickerReason> {
  /** The colour in the current format. */
  readonly valueAsString: string
  /** The channel an input or slider changed. */
  readonly channel?: string | undefined
}

type Send = ReturnType<typeof useMachine<typeof colorPickerMachine>>["send"]

interface Ctx {
  readonly instance: () => string
  readonly color: () => Color
  readonly format: () => ColorPickerFormat
  readonly state: () => ColorPickerState
  readonly send: Send
  readonly api: () => ReturnType<typeof colorPickerConnect>
  readonly messages: () => ColorPickerMessages
  readonly locale: () => string
  readonly dir: () => "ltr" | "rtl"
  readonly inline: boolean
  readonly colorName: () => ColorNameProp | undefined
  readonly registry: ReturnType<typeof createFlushRegistry>
  readonly setLabelRendered: (on: boolean) => void
  readonly setHiddenPart: (on: boolean) => void
  readonly hiddenPart: ShallowRef<boolean>
  readonly triggerEl: ShallowRef<Element | null>
  readonly formValue: () => string
}

const PickerKey: InjectionKey<Ctx> = Symbol("rind-ui.color-picker")
function usePicker(part: string): Ctx {
  const ctx = inject(PickerKey, null)
  if (!ctx) throw new Error(`ColorPicker.${part} must be inside ColorPicker.Root`)
  return ctx
}
/** Inside the Trigger: the ValueSwatch is decorative (the Trigger's name carries the colour). */
const InTriggerKey: InjectionKey<boolean> = Symbol("rind-ui.color-picker-in-trigger")

/** The default format of the first colour given: a hex string `hex`, otherwise its space. */
function firstFormat(input: ColorInput | undefined, color: Color | undefined): ColorPickerFormat {
  if (typeof input === "string" && input.trim().startsWith("#")) return "hex"
  return color ? color.space : "hex"
}

type Slots = SlotsType<{ default?: (state: ColorPickerState) => VNodeChild }>

/** A colour picker: a trigger and a popover (or an inline panel) bound to one colour. */
const Root = defineComponent({
  name: "ColorPickerRoot",
  inheritAttrs: false,
  props: {
    id: String,
    /** The colour (`v-model`). */
    modelValue: colorProp,
    /** Default `#000000`. */
    defaultValue: colorProp,
    /** The shown format (`v-model:format`). */
    format: String as PropType<ColorPickerFormat>,
    defaultFormat: String as PropType<ColorPickerFormat>,
    /** Controlled visibility (`v-model:open`). */
    open: { type: Boolean, default: undefined },
    defaultOpen: { type: Boolean, default: undefined },
    /** The content in place: no Popover, no layer, no positioning, no listeners. */
    inline: Boolean,
    closeOnSelect: Boolean,
    modal: { type: Boolean, default: undefined },
    /** The Popover's positioning: side, align, offsets, flip, shift, size, arrow and mode. */
    positioning: Object as PropType<PopoverProps["positioning"]>,
    /** Where focus goes once the Popover is placed: a function, or the overlay's rule. */
    initialFocus: {
      type: [Function, null] as PropType<PopoverProps["initialFocus"]>,
      default: undefined,
    },
    /** Elements whose presses and focus count as inside the Popover (a toast region). */
    persistentElements: Function as PropType<PopoverProps["persistentElements"]>,
    name: String,
    /** The id of the form the hidden input belongs to. */
    form: String,
    /** The submitted text's format (default the canonical hex). */
    formFormat: String as PropType<ColorFormat>,
    disabled: Boolean,
    readonly: Boolean,
    /** Marks the picker required (Field state, `data-required` on the hidden input). */
    required: Boolean,
    /** Marks the picker invalid (`data-invalid`, the Field's error state). */
    invalid: Boolean,
    /** A fixed name or a function replacing the computed colour name. */
    colorName: [String, Function] as PropType<ColorNameProp>,
    /** Formats the colour name and the numbers. Default: the provider's. */
    locale: String,
    /** Reading direction; mirrors the area and sliders. Default: the provider's. */
    dir: String as PropType<"ltr" | "rtl">,
    messages: Object as PropType<MessageOverrides<ColorPickerMessages>>,
  },
  emits: {
    valueChange: (_color: Color, _details: ColorPickerChangeDetails) => true,
    "update:modelValue": (_color: Color) => true,
    valueCommit: (_color: Color, _details: { readonly reason: ColorPickerReason }) => true,
    formatChange: (_format: ColorPickerFormat) => true,
    "update:format": (_format: ColorPickerFormat) => true,
    openChange: (_open: boolean, _details: { readonly reason: string }) => true,
    "update:open": (_open: boolean) => true,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots, emit }) {
    const instance = useRootId(() => props.id)
    const loc = useLocale(
      () => props.locale,
      () => props.dir,
    )
    const messages = useMessages("color-picker", colorPickerMessages, () => props.messages)
    const value = useColorProp(() => props.modelValue ?? undefined, "value", "color-picker")
    const defaultValue = useColorProp(
      () => props.defaultValue ?? undefined,
      "defaultValue",
      "color-picker",
    )
    const initialFormat =
      props.defaultFormat ??
      firstFormat(props.modelValue ?? props.defaultValue ?? undefined, value() ?? defaultValue())
    let latestFormat: ColorPickerFormat = initialFormat
    const inline = props.inline
    const machineProps = () => ({
      value: value(),
      defaultValue: defaultValue(),
      format: props.format,
      defaultFormat: initialFormat,
      open: inline ? undefined : props.open,
      defaultOpen: props.defaultOpen ?? false,
      inline,
      disabled: props.disabled,
      readOnly: props.readonly,
      closeOnSelect: props.closeOnSelect,
      onValueChange: (c: Color, d: { reason: string; event: unknown; cancel(): void }) => {
        const e = d.event as { reason?: ColorPickerReason; channel?: string }
        const reason = e.reason ?? (d.reason === "RESET" ? "RESET" : "INPUT")
        emit("valueChange", c, {
          reason,
          space: c.space,
          valueAsString: formatColor(c, latestFormat),
          channel: e.channel,
          cancel: d.cancel,
        })
        emit("update:modelValue", c)
      },
      onValueCommit: (c: Color, d: { readonly reason: ColorPickerReason }) =>
        emit("valueCommit", c, d),
      onFormatChange: (f: ColorPickerFormat) => {
        emit("formatChange", f)
        emit("update:format", f)
      },
      onOpenChange: (o: boolean, d: { reason: string; event: unknown }) => {
        const event = d.event as { type: string; reason?: string }
        // A transition's own reason ("select", "api") wins; else the Popover's, carried by the event.
        const reason = d.reason !== event.type ? d.reason : (event.reason ?? d.reason)
        emit("openChange", o, { reason })
        emit("update:open", o)
      },
    })
    const { view, send } = useMachine(colorPickerMachine, machineProps, {})
    const format = () => view.value.values.format
    const color = () => pickerWorking(machineProps(), view.value.context, view.value.values.value)
    const open = () => view.value.values.open === true
    const registry = createFlushRegistry()
    const labelRendered = shallowRef(false)
    const hiddenPart = shallowRef(false)
    const triggerEl = shallowRef<Element | null>(null)
    const api = computed(() => {
      latestFormat = format()
      const id = instance()
      return colorPickerConnect({
        instance: id,
        color: color(),
        format: format(),
        open: open(),
        inline,
        disabled: props.disabled,
        readOnly: props.readonly,
        invalid: props.invalid,
        dragging: false,
        messages: messages.value,
        locale: loc.value.locale,
        colorName: props.colorName,
        ids: {
          control: partId("color-picker", id, "control"),
          trigger: partId("color-picker", id, "trigger"),
          label: partId("color-picker", id, "label"),
          content: partId("color-picker", id, "content"),
          hiddenInput: partId("color-picker", id, "hidden-input"),
        },
        labelRendered: labelRendered.value,
        name: props.name,
        form: props.form,
        required: props.required,
        formFormat: props.formFormat,
        defaultValue:
          defaultValue() ?? pickerValueOf({ ...machineProps(), value: undefined }, undefined),
      })
    })
    const state = (): ColorPickerState => ({
      color: color(),
      format: format(),
      open: open(),
      inline,
      disabled: props.disabled,
      readOnly: props.readonly,
    })
    provide(PickerKey, {
      instance,
      color,
      format,
      state,
      send,
      api: () => api.value,
      messages: () => messages.value,
      locale: () => loc.value.locale,
      dir: () => loc.value.dir,
      inline,
      colorName: () => props.colorName,
      registry,
      setLabelRendered: (on) => (labelRendered.value = on),
      setHiddenPart: (on) => (hiddenPart.value = on),
      hiddenPart,
      triggerEl,
      formValue: () => api.value.formValue,
    })
    return () => {
      const rootProps = normalizeProps(api.value.root()) as { style?: unknown } & Record<
        string,
        unknown
      >
      const { style, ...rest } = attrs as Record<string, unknown>
      const body = () => [slots.default?.(state()), hiddenPart.value ? null : h(HiddenField)]
      return h(
        FieldHost,
        {
          scope: "color-picker",
          id: instance(),
          dir: loc.value.dir,
          disabled: props.disabled,
          readonly: props.readonly,
          required: props.required,
          invalid: props.invalid,
          ...rest,
          ...rootProps,
          style: [rootProps.style, style],
        },
        () =>
          inline
            ? body()
            : h(
                Popover.Root,
                {
                  id: instance(),
                  scope: "color-picker",
                  open: open(),
                  onOpenChange: (next: boolean, d: { reason: string }) => {
                    if (next) {
                      send({ type: "OPEN", reason: d.reason })
                      return
                    }
                    // Every pending draft commits first (react-spectrum#9748), then the close.
                    registry.flushAll()
                    send({ type: "CLOSE", reason: d.reason })
                  },
                  disabled: props.disabled,
                  ...(props.modal === undefined ? {} : { modal: props.modal }),
                  ...(props.positioning === undefined ? {} : { positioning: props.positioning }),
                  ...(props.initialFocus === undefined ? {} : { initialFocus: props.initialFocus }),
                  ...(props.persistentElements === undefined
                    ? {}
                    : { persistentElements: props.persistentElements }),
                },
                body,
              ),
      )
    }
  },
})

/** The hidden input: the value property mirrors the colour; reset and autofill. */
const HiddenField = defineComponent({
  name: "ColorPickerHiddenField",
  setup() {
    const ctx = usePicker("HiddenInput")
    const el = shallowRef<Element | null>(null)
    // The value property mirrors the colour after every commit (hidden-form-input); a reset
    // restores the default; a native change we did not make (autofill) is adopted.
    const sync = () => {
      const input = el.value as HTMLInputElement | null
      if (input && input.value !== ctx.formValue()) input.value = ctx.formValue()
    }
    onMounted(() => {
      sync()
      watch(ctx.formValue, sync, { flush: "post" })
      const input = el.value as HTMLInputElement | null
      const owner = input?.form
      const onReset = () => ctx.send({ type: "RESET" })
      const onChange = (e: Event) => {
        if (e.isTrusted) ctx.send({ type: "ADOPT", text: (e.target as HTMLInputElement).value })
      }
      owner?.addEventListener("reset", onReset)
      input?.addEventListener("change", onChange)
      onBeforeUnmount(() => {
        owner?.removeEventListener("reset", onReset)
        input?.removeEventListener("change", onChange)
      })
    })
    onUpdated(sync)
    return () => h("input", { ...normalizeProps(ctx.api().hiddenInput()), ref: refTo(el) })
  },
})

/** Places the hidden input (it replaces the automatic one). */
const HiddenInput = defineComponent({
  name: "ColorPickerHiddenInput",
  setup() {
    const ctx = usePicker("HiddenInput")
    onMounted(() => ctx.setHiddenPart(true))
    onBeforeUnmount(() => ctx.setHiddenPart(false))
    return () => h(HiddenField)
  },
})

/** Names the Control, the Trigger and the content; a press focuses the Trigger. */
const Label = defineComponent({
  name: "ColorPickerLabel",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = usePicker("Label")
    const env = useEnvironment()
    onMounted(() => ctx.setLabelRendered(true))
    onBeforeUnmount(() => ctx.setLabelRendered(false))
    return () =>
      renderPart(
        "label",
        mergeProps(
          joinHandlers(normalizeProps(ctx.api().label()), {
            onMousedown: (e: MouseEvent) => {
              // A pointer press focuses the Trigger (inline: the first text input) without a ring.
              e.preventDefault()
              const target =
                ctx.triggerEl.value ??
                document
                  .getElementById(ctx.api().inlineContent()["id"] as string)
                  ?.querySelector("input")
              if (target) void focusSafely(target as HTMLElement, env, "programmatic", "pointer")
            },
          }),
          attrs,
        ),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

/** `role="group"`: the Popover's anchor. */
const Control = defineComponent({
  name: "ColorPickerControl",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = usePicker("Control")
    return () => {
      const merged = mergeProps(normalizeProps(ctx.api().control()), attrs)
      if (ctx.inline) return renderPart("div", merged, slots.default?.(ctx.state()), props.asChild)
      // The Popover finds its anchor by the anchor's own id: an `id` here would replace it.
      const { id: _anchorOwnsTheId, ...anchor } = merged
      void _anchorOwnsTheId
      return h(Popover.Anchor, { ...anchor, asChild: props.asChild }, () =>
        slots.default?.(ctx.state()),
      )
    }
  },
})

/** Opens the content; named "Choose color, <colour>" and by the Label. */
const Trigger = defineComponent({
  name: "ColorPickerTrigger",
  inheritAttrs: false,
  props: { ...asChildProp },
  setup(props, { attrs, slots }) {
    const ctx = usePicker("Trigger")
    const env = useEnvironment()
    const binding = useFieldControl()
    provide(InTriggerKey, true)
    const triggerId = () => ctx.api().trigger()["aria-labelledby"]?.toString().split(" ")[0] ?? ""
    if (binding) {
      onMounted(() =>
        watch(
          triggerId,
          (id, _, onCleanup) => {
            if (!id) return
            onCleanup(
              binding.value.register(
                {
                  id,
                  labelable: true,
                  focus: (m) => {
                    if (ctx.triggerEl.value)
                      void focusSafely(ctx.triggerEl.value as HTMLElement, env, "programmatic", m)
                  },
                  validityElement: () => null,
                  value: () => ctx.formValue(),
                },
                id,
              ),
            )
          },
          { immediate: true },
        ),
      )
    }
    onMounted(() => {
      if (ctx.inline && process.env.NODE_ENV !== "production") {
        console.warn("[rind-ui] color-picker: an inline picker has no Trigger; it renders nothing")
      }
    })
    return () =>
      ctx.inline
        ? null
        : h(
            Popover.Trigger,
            {
              ...mergeProps(normalizeProps(ctx.api().trigger()), attrs),
              ref: refTo(ctx.triggerEl),
              asChild: props.asChild,
            },
            slots,
          )
  },
})

/** In place when inline; else the Popover's own part. */
function popoverPart(name: string, part: unknown) {
  return defineComponent({
    name: `ColorPicker${name}`,
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      const ctx = usePicker(name)
      return () => (ctx.inline ? h(Fragment, slots["default"]?.()) : h(part as never, attrs, slots))
    },
  })
}
const Portal = popoverPart("Portal", Popover.Portal)
const Positioner = popoverPart("Positioner", Popover.Positioner)

/** The content: the Popover's, or (inline) a `role="group"` in place. Children are embedded. */
const Content = defineComponent({
  name: "ColorPickerContent",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = usePicker("Content")
    provide(ColorFlushKey, ctx.registry)
    return () => {
      const {
        "aria-label": label,
        "aria-labelledby": labelledBy,
        ...rest
      } = attrs as Record<string, string | undefined>
      const name = ctx.api().contentName({ label, labelledBy })
      const body = () => h(FieldControlBoundary, null, () => slots.default?.(ctx.state()))
      if (ctx.inline) {
        return renderPart(
          "div",
          mergeProps(
            {
              ...normalizeProps(ctx.api().inlineContent()),
              "aria-label": name.label,
              "aria-labelledby": name.labelledBy,
            },
            rest,
          ),
          body(),
          props.asChild,
        )
      }
      return h(
        Popover.Content,
        {
          ...rest,
          ...(name.label === undefined ? {} : { "aria-label": name.label }),
          ...(name.labelledBy === undefined ? {} : { "aria-labelledby": name.labelledBy }),
          asChild: props.asChild,
        },
        body,
      )
    }
  },
})

/** The picker's Color Area (its own props, without a value: the picker owns it). */
const Area = defineComponent({
  name: "ColorPickerArea",
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    const ctx = usePicker("Area")
    onMounted(() => {
      if ("modelValue" in attrs && process.env.NODE_ENV !== "production") {
        console.error(
          "[rind-ui] color-picker: a bound ColorPicker.Area takes no `value` of its own",
        )
      }
    })
    return () => {
      const m = ctx.messages()
      const s = ctx.state()
      return h(
        ColorArea.Root,
        {
          colorSpace: "hsb",
          ...attrs,
          modelValue: ctx.color(),
          disabled: s.disabled,
          readOnly: s.readOnly,
          dir: ctx.dir(),
          locale: ctx.locale(),
          ...(ctx.colorName() === undefined ? {} : { colorName: ctx.colorName() }),
          messages: { ...m, valueText: m.areaValueText },
          onValueChange: (c: Color) => ctx.send({ type: "COLOR.SET", color: c, reason: "AREA" }),
          onValueCommit: () => ctx.send({ type: "COLOR.COMMIT", reason: "AREA" }),
          // The consumer's props hold `undefined` for absent ones (exactOptionalPropertyTypes).
        } as Record<string, unknown>,
        slots,
      )
    }
  },
})

/** The picker's Color Slider for `channel`. */
const ChannelSlider = defineComponent({
  name: "ColorPickerChannelSlider",
  inheritAttrs: false,
  props: { channel: { type: String as PropType<ColorChannel>, required: true } },
  setup(props, { attrs, slots }) {
    const ctx = usePicker("ChannelSlider")
    return () => {
      const m = ctx.messages()
      const s = ctx.state()
      return h(
        ColorSlider.Root,
        {
          ...attrs,
          channel: props.channel,
          modelValue: ctx.color(),
          disabled: s.disabled,
          readonly: s.readOnly,
          dir: ctx.dir(),
          locale: ctx.locale(),
          ...(ctx.colorName() === undefined ? {} : { colorName: ctx.colorName() }),
          messages: { ...m, valueText: m.sliderValueText },
          onValueChange: (c: Color) =>
            ctx.send({ type: "COLOR.SET", color: c, reason: "SLIDER", channel: props.channel }),
          onValueCommit: () => ctx.send({ type: "COLOR.COMMIT", reason: "SLIDER" }),
          // The consumer's props hold `undefined` for absent ones (exactOptionalPropertyTypes).
        } as never,
        slots,
      )
    }
  },
})

/** A Color Field (`hex`, `css`) or a Color Channel Field, bound to the picker. */
const ChannelInput = defineComponent({
  name: "ColorPickerChannelInput",
  inheritAttrs: false,
  props: {
    /** A colour channel (a Color Channel Field), or `hex` / `css` (a Color Field). */
    channel: { type: String as PropType<ColorChannel | "hex" | "css">, required: true },
    /** Accept and show 8-digit hex (default: when the colour has alpha below 1). */
    alpha: { type: Boolean, default: undefined },
  },
  setup(props, { attrs }) {
    const ctx = usePicker("ChannelInput")
    return () => {
      const m = ctx.messages()
      const s = ctx.state()
      const { "aria-label": ariaLabel, ...rest } = attrs as Record<string, unknown>
      const channel = props.channel
      if (channel === "hex" || channel === "css") {
        return h(
          ColorField.Root,
          {
            modelValue: ctx.color(),
            format: channel,
            alpha: props.alpha ?? ctx.color().alpha < 1,
            disabled: s.disabled,
            readonly: s.readOnly,
            messages: m,
            onValueChange: (c: Color | null) => {
              if (!c) return
              ctx.send({ type: "COLOR.SET", color: c, reason: "INPUT", channel })
              ctx.send({ type: "COLOR.COMMIT", reason: "INPUT" })
            },
          },
          () => h(ColorField.Input, { "aria-label": ariaLabel ?? m.formatName(channel), ...rest }),
        )
      }
      return h(
        ColorChannelField.Root,
        {
          channel,
          modelValue: ctx.color(),
          disabled: s.disabled,
          readonly: s.readOnly,
          locale: ctx.locale(),
          onValueChange: (c: Color) =>
            ctx.send({ type: "COLOR.SET", color: c, reason: "INPUT", channel }),
          onValueCommit: () => ctx.send({ type: "COLOR.COMMIT", reason: "INPUT" }),
        },
        () =>
          h(ColorChannelField.Input, {
            "aria-label": ariaLabel ?? m.channelName(channel),
            ...rest,
          }),
      )
    }
  },
})

/** The picker's swatches (a Color Swatch Picker bound to its colour). */
const SwatchGroup = defineComponent({
  name: "ColorPickerSwatchGroup",
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    const ctx = usePicker("SwatchGroup")
    return () => {
      const s = ctx.state()
      return h(
        ColorSwatchPicker.Root,
        {
          ...attrs,
          modelValue: ctx.color(),
          disabled: s.disabled,
          readonly: s.readOnly,
          messages: ctx.messages(),
          onValueChange: (c: Color) => {
            ctx.send({ type: "COLOR.SET", color: c, reason: "SWATCH" })
            ctx.send({ type: "COLOR.COMMIT", reason: "SWATCH" })
          },
        },
        slots,
      )
    }
  },
})

const SwatchTrigger = defineComponent({
  name: "ColorPickerSwatchTrigger",
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    usePicker("SwatchTrigger")
    return () => h(ColorSwatchPicker.Item, attrs as never, slots)
  },
})

const SWATCH = { scope: "color-picker", part: "swatch" } as const
const VALUE_SWATCH = { scope: "color-picker", part: "value-swatch" } as const

/** Provides the picker's swatch naming to the swatch below. */
const Naming = defineComponent({
  name: "ColorPickerSwatchNaming",
  props: { naming: { type: Object as PropType<{ scope: string; part: string }>, required: true } },
  setup(props, { slots }) {
    provide(SwatchNamingKey, props.naming)
    return () => slots["default"]?.()
  },
})

/** A Color Swatch (a colour to show, named by its colour name). */
const Swatch = defineComponent({
  name: "ColorPickerSwatch",
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    const ctx = usePicker("Swatch")
    return () =>
      h(Naming, { naming: SWATCH }, () =>
        h(ColorSwatch.Root, { messages: ctx.messages(), ...attrs }, slots),
      )
  },
})

/** The picker's colour as a swatch (decorative inside the Trigger). */
const ValueSwatch = defineComponent({
  name: "ColorPickerValueSwatch",
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    const ctx = usePicker("ValueSwatch")
    const inTrigger = inject(InTriggerKey, false)
    return () =>
      h(Naming, { naming: VALUE_SWATCH }, () =>
        h(
          ColorSwatch.Root,
          {
            color: ctx.color(),
            messages: ctx.messages(),
            ...(inTrigger ? { "aria-hidden": "true", role: "presentation" } : {}),
            ...attrs,
          },
          slots,
        ),
      )
  },
})

/** The colour in the current format. Not a live region. */
const ValueText = defineComponent({
  name: "ColorPickerValueText",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = usePicker("ValueText")
    return () =>
      renderPart(
        "span",
        mergeProps(normalizeProps(ctx.api().valueTextPart()), attrs),
        slots.default?.(ctx.state()) ?? ctx.api().valueText,
        props.asChild,
      )
  },
})

/** `data-focus` / `data-focus-visible` for a picker-owned control, with its focus handlers. */
function useFocusAttrs() {
  const env = useEnvironment()
  const focused = shallowRef(false)
  const modality = useModality(env.modality, () => focused.value)
  return () => ({
    ...focusAttrs(focused.value, modality.value),
    onFocus: () => (focused.value = true),
    onBlur: () => (focused.value = false),
  })
}

/** Opens the browser's eye dropper; hidden where there is none (ark#2764). */
const EyeDropperTrigger = defineComponent({
  name: "ColorPickerEyeDropperTrigger",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = usePicker("EyeDropperTrigger")
    const env = useEnvironment(announcerCapability)
    const supported = shallowRef(false)
    const focus = useFocusAttrs()
    // After mount: the server and the first client render agree (hidden).
    onMounted(() => (supported.value = isEyeDropperSupported(globalThis.window)))
    return () =>
      renderPart(
        "button",
        mergeProps(
          joinHandlers(
            { ...normalizeProps(ctx.api().eyeDropperTrigger(supported.value)), ...focus() },
            {
              onClick: async () => {
                const hex = await pickScreenColor(globalThis.window)
                if (!hex) return
                ctx.send({ type: "EYEDROPPER.RESULT", hex })
                env.announcer.announce({
                  message: ctx.messages().picked({ colorName: ctx.api().colorName }),
                  priority: "polite",
                  key: `color-picker-${ctx.instance()}`,
                  lang: ctx.locale(),
                })
              },
            },
          ),
          attrs,
        ),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

/** A native select of the formats. */
const FormatSelect = defineComponent({
  name: "ColorPickerFormatSelect",
  inheritAttrs: false,
  props: { ...asChildProp },
  setup(props, { attrs }) {
    const ctx = usePicker("FormatSelect")
    const el = shallowRef<Element | null>(null)
    const focus = useFocusAttrs()
    // The value is set as a property.
    const sync = () => {
      if (el.value) (el.value as HTMLSelectElement).value = ctx.format()
    }
    onMounted(sync)
    onUpdated(sync)
    return () =>
      renderPart(
        "select",
        mergeProps(
          {
            ...joinHandlers(normalizeProps(ctx.api().formatSelect()), {
              onChange: (e: Event) =>
                ctx.send({
                  type: "FORMAT.SET",
                  format: (e.currentTarget as HTMLSelectElement).value as ColorPickerFormat,
                }),
            }),
            ...focus(),
            ref: refTo(el),
          },
          attrs,
        ),
        PICKER_FORMATS.map((f) =>
          h(
            "option",
            { key: f, value: f, selected: f === ctx.format() || undefined },
            ctx.messages().formatOptions(f),
          ),
        ),
        props.asChild,
      )
  },
})

/** Cycles hex → rgb → hsl → hsb and announces the new format. */
const FormatTrigger = defineComponent({
  name: "ColorPickerFormatTrigger",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = usePicker("FormatTrigger")
    const env = useEnvironment(announcerCapability)
    const focus = useFocusAttrs()
    return () => {
      const m = ctx.messages()
      const next = nextFormat(ctx.format())
      return renderPart(
        "button",
        mergeProps(
          joinHandlers(
            {
              ...focus(),
              "data-scope": "color-picker",
              "data-part": "format-trigger",
              "data-instance": ctx.instance(),
              type: "button",
              "aria-label": m.formatTrigger({
                current: m.formatOptions(ctx.format()),
                next: m.formatOptions(next),
              }),
              disabled: ctx.state().disabled || undefined,
            },
            {
              onClick: () => {
                ctx.send({ type: "FORMAT.SET", format: next })
                env.announcer.announce({
                  message: m.formatChanged({ format: m.formatOptions(next) }),
                  priority: "polite",
                  key: `color-picker-format-${ctx.instance()}`,
                  lang: ctx.locale(),
                })
              },
            },
          ),
          attrs,
        ),
        slots.default?.(ctx.state()) ?? m.formatOptions(ctx.format()),
        props.asChild,
      )
    }
  },
})

/** Renders its slot only while the picker's format is `format`. */
const View = defineComponent({
  name: "ColorPickerView",
  inheritAttrs: false,
  props: {
    ...asChildProp,
    /** The format this view is for: the slot renders only while it is the picker's. */
    format: { type: String as PropType<ColorPickerFormat>, required: true },
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = usePicker("View")
    return () =>
      ctx.format() !== props.format
        ? null
        : renderPart(
            "div",
            mergeProps(normalizeProps(ctx.api().view(props.format)), attrs),
            slots.default?.(ctx.state()),
            props.asChild,
          )
  },
})

const TransparencyGrid = defineComponent({
  name: "ColorPickerTransparencyGrid",
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    usePicker("TransparencyGrid")
    // The picker's scope last: a consumer prop never moves the part out of it.
    return () => h(Grid, { ...attrs, scope: "color-picker" }, slots)
  },
})

const ChannelSliderLabel = ColorSlider.Label
const ChannelSliderValueText = ColorSlider.ValueText
const ChannelSliderTrack = ColorSlider.Track
const ChannelSliderThumb = ColorSlider.Thumb
const SwatchIndicator = ColorSwatchPicker.Indicator
const Description = HostDescription
const ErrorMessage = HostErrorMessage

export { Background as AreaBackground, Thumb as AreaThumb } from "../color-area/color-area"
export type { ColorSpace }
/** The parts, by name: `color-picker.parts.ts` re-exports them as the `ColorPicker` namespace. */
export {
  Area,
  ChannelInput,
  ChannelSlider,
  ChannelSliderLabel,
  ChannelSliderThumb,
  ChannelSliderTrack,
  ChannelSliderValueText,
  Content,
  Control,
  Description,
  ErrorMessage,
  EyeDropperTrigger,
  FormatSelect,
  FormatTrigger,
  HiddenInput,
  Label,
  Portal,
  Positioner,
  Root,
  Swatch,
  SwatchGroup,
  SwatchIndicator,
  SwatchTrigger,
  TransparencyGrid,
  Trigger,
  ValueSwatch,
  ValueText,
  View,
}
