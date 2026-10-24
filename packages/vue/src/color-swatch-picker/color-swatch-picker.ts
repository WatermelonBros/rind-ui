// Color Swatch Picker parts (design §7): a Radio Group whose value is the key of the swatch
// matching the colour. Wiring only: matching is core's `matchSwatch`, every keyboard, focus and
// form rule is the Radio Group's.
import {
  type Color,
  type ColorChangeDetails,
  type ColorInput,
  type ColorNameProp,
  type MessageOverrides,
  makeColor,
  resolveColorName,
  toSpace,
} from "@rind-ui/core"
import {
  COLOR_PICKER_SCOPE,
  type ColorSwatchPickerMessages,
  colorSwatchPickerMessages,
  colorVariables,
  matchSwatch,
  pickedColor,
  type SwatchItem,
  swatchColor,
  swatchGroupNaming,
  swatchKey,
} from "@rind-ui/core/internal"
import {
  defineComponent,
  h,
  type InjectionKey,
  inject,
  onMounted,
  type PropType,
  provide,
  shallowRef,
  watch,
} from "vue"
import { colorProp, useColorProp } from "../color-input"
import { useSwatchProps } from "../color-swatch/color-swatch"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useLocale, useMessages } from "../provider"
import { RadioGroupNamingKey } from "../radio-group/radio-group"
import * as RadioGroup from "../radio-group/radio-group.parts"
import { asChildProp, renderPart } from "../render"

declare module "../provider" {
  interface RindMessageScopes {
    "color-swatch-picker": ColorSwatchPickerMessages
  }
}

export interface ColorSwatchPickerChangeDetails extends ColorChangeDetails {
  /** The checked item's key. */
  readonly value: string
  readonly index: number
}

type Registered = SwatchItem & { readonly el: () => Element | null }

interface Ctx {
  readonly register: (item: Registered) => () => void
  readonly messages: () => ColorSwatchPickerMessages
  readonly locale: () => string
}
const PickerKey: InjectionKey<Ctx> = Symbol("rind-ui.color-swatch-picker")
function usePicker(part: string): Ctx {
  const ctx = inject(PickerKey, null)
  if (!ctx) throw new Error(`ColorSwatchPicker.${part} must be inside ColorSwatchPicker.Root`)
  return ctx
}
const ItemKey: InjectionKey<() => Color> = Symbol("rind-ui.color-swatch-picker-item")

/** The registered items in document order (a re-registered item would otherwise move last). */
function inDocumentOrder(items: readonly Registered[]): readonly Registered[] {
  return [...items].sort((a, b) => {
    const x = a.el()
    const y = b.el()
    if (!x || !y) return 0
    return x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
  })
}

/** A palette of colour swatches: at most one matches the colour (a Radio Group). */
const Root = defineComponent({
  name: "ColorSwatchPickerRoot",
  inheritAttrs: false,
  props: {
    /** The colour (`v-model`); null: no swatch checked. */
    modelValue: colorProp,
    /** Default `null`: no swatch checked. */
    defaultValue: colorProp,
    /** Formats the swatches' colour names. Default: the provider's. */
    locale: String,
    /** The group's label (`swatchPickerLabel`) and the colour words. */
    messages: Object as PropType<MessageOverrides<ColorSwatchPickerMessages>>,
  },
  emits: {
    /** A swatch was checked; `details.value` is its key, `details.index` its index. */
    valueChange: (_color: Color, _details: ColorSwatchPickerChangeDetails) => true,
    "update:modelValue": (_color: Color) => true,
  },
  setup(props, { attrs, slots, emit }) {
    const loc = useLocale(() => props.locale)
    const messages = useMessages(
      "color-swatch-picker",
      colorSwatchPickerMessages,
      () => props.messages,
    )
    const parsed = useColorProp(() => props.modelValue ?? undefined, "value", "color-swatch-picker")
    const parsedDefault = useColorProp(
      () => props.defaultValue ?? undefined,
      "defaultValue",
      "color-swatch-picker",
    )
    const internal = shallowRef<Color | null>(parsedDefault() ?? null)
    const controlled = () => props.modelValue !== undefined
    const color = () =>
      controlled() ? (props.modelValue === null ? null : (parsed() ?? null)) : internal.value
    const items = shallowRef<readonly Registered[]>([])
    const register = (item: Registered) => {
      items.value = [...items.value.filter((i) => i.key !== item.key), item]
      return () => {
        items.value = items.value.filter((i) => i.key !== item.key)
      }
    }
    let lastKey: string | null = null
    provide(PickerKey, { register, messages: () => messages.value, locale: () => loc.value.locale })
    provide(RadioGroupNamingKey, swatchGroupNaming)
    return () => {
      const ordered = inDocumentOrder(items.value)
      const current = color()
      const checked = matchSwatch(ordered, current, lastKey)
      const {
        "aria-label": ariaLabel,
        "aria-labelledby": ariaLabelledBy,
        ...rest
      } = attrs as Record<string, unknown>
      return h(
        RadioGroup.Root,
        {
          orientation: "horizontal",
          ...rest,
          "aria-label":
            ariaLabelledBy === undefined
              ? (ariaLabel ?? messages.value.swatchPickerLabel)
              : ariaLabel,
          "aria-labelledby": ariaLabelledBy,
          modelValue: checked,
          onValueChange: (key: string | null, details: { reason: string; cancel(): void }) => {
            const index = ordered.findIndex((i) => i.key === key)
            const item = ordered[index]
            if (!item || key === null) return
            const next = pickedColor(item.color, current)
            const emitted = current ? toSpace(next, current.space) : next
            let cancelled = false
            emit("valueChange", emitted, {
              reason: details.reason,
              space: emitted.space,
              value: key,
              index,
              cancel: () => {
                cancelled = true
                details.cancel()
              },
            })
            if (cancelled) return
            lastKey = key
            emit("update:modelValue", emitted)
            if (!controlled()) internal.value = emitted
          },
        },
        slots,
      )
    }
  },
})

/** One swatch: a Radio Group item and its control (`role="radio"`), named by its colour. */
const Item = defineComponent({
  name: "ColorSwatchPickerItem",
  inheritAttrs: false,
  props: {
    /** The swatch's colour: a colour, or a string `parseColor` reads. */
    color: { ...colorProp, required: true },
    /** The item's key (default the canonical `#RRGGBBAA`). */
    value: String,
    /** Disables this swatch only. */
    disabled: Boolean,
    /** A fixed name or a function replacing the computed colour name (the swatch's accessible name). */
    colorName: [String, Function] as PropType<ColorNameProp>,
  },
  setup(props, { attrs, slots }) {
    const ctx = usePicker("Item")
    const color = () => swatchColor(props.color as ColorInput)
    const key = () => props.value ?? swatchKey(color())
    const el = shallowRef<Element | null>(null)
    provide(ItemKey, color)
    // The colour is compared by its key: a fresh object for the same colour re-registers nothing.
    onMounted(() =>
      watch(
        [key, () => swatchKey(color()), () => props.disabled],
        (_, __, onCleanup) => {
          onCleanup(
            ctx.register({
              key: key(),
              color: color(),
              disabled: props.disabled,
              el: () => el.value,
            }),
          )
        },
        { immediate: true },
      ),
    )
    return () => {
      const c = color()
      const opaque = makeColor(c.space, c.channels, 1)
      const name = resolveColorName(
        c.alpha < 1 ? c : opaque,
        ctx.messages(),
        ctx.locale(),
        props.colorName,
      )
      const { "aria-label": ariaLabel, style, ...rest } = attrs as Record<string, unknown>
      const vars = normalizeProps({ style: colorVariables(c) }) as { style?: object }
      return h(RadioGroup.Item, { value: key(), disabled: props.disabled, textValue: name }, () =>
        h(
          RadioGroup.ItemControl,
          {
            ...rest,
            ref: refTo(el),
            "data-value": key(),
            "aria-label": ariaLabel ? `${name}, ${ariaLabel}` : name,
            style: [vars.style, style],
          },
          slots,
        ),
      )
    }
  },
})

/** The item's colour: a decorative Color Swatch (the item's name carries the colour). */
const Swatch = defineComponent({
  name: "ColorSwatchPickerSwatch",
  inheritAttrs: false,
  props: { ...asChildProp },
  setup(props, { attrs }) {
    const color = inject(ItemKey, null)
    if (!color) throw new Error("ColorSwatchPicker.Swatch must be inside ColorSwatchPicker.Item")
    const swatch = useSwatchProps({ color, decorative: true })
    return () =>
      renderPart(
        "div",
        mergeProps(normalizeProps(swatch().api.root(COLOR_PICKER_SCOPE, "swatch")), attrs),
        undefined,
        props.asChild,
      )
  },
})

/** Mounted only while the item is checked: the one selected mark, decorative. */
const Indicator = defineComponent({
  name: "ColorSwatchPickerIndicator",
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => h(RadioGroup.ItemIndicator, { "aria-hidden": "true", ...attrs }, slots)
  },
})

export const ColorSwatchPicker = { Root, Item, Swatch, Indicator }
