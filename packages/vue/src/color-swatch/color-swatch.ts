// Color Swatch parts: wiring only; connect decides role, name and the inline colour.
import type { Color, ColorInput, ColorNameProp, MessageOverrides } from "@rind-ui/core"
import {
  type ColorSwatchMessages,
  colorSwatchConnect,
  colorSwatchMessages,
  swatchColor,
  transparencyGridProps,
} from "@rind-ui/core/internal"
import {
  defineComponent,
  type InjectionKey,
  inject,
  type PropType,
  type SlotsType,
  type VNodeChild,
} from "vue"
import { colorProp } from "../color-input"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useLocale, useMessages } from "../provider"
import { asChildProp, renderPart } from "../render"
import { useRootId } from "../use-ids"

declare module "../provider" {
  interface RindMessageScopes {
    "color-swatch": ColorSwatchMessages
  }
}

export interface ColorSwatchState {
  readonly color: Color
  readonly transparent: boolean
}

/**
 * Internal (not exported from the package): set by the Color Picker's swatch parts, whose
 * swatches render under the picker's scope (`swatch`, `value-swatch`).
 */
export const SwatchNamingKey: InjectionKey<{ readonly scope: string; readonly part: string }> =
  Symbol("rind-ui.swatch-naming")

/** The swatch's props for a colour (getters); shared with the parts that show one. Call in setup. */
export function useSwatchProps(options: {
  readonly id?: () => string | undefined
  readonly color: () => ColorInput | undefined
  readonly respectAlpha?: () => boolean | undefined
  readonly colorName?: () => ColorNameProp | undefined
  readonly locale?: () => string | undefined
  readonly messages?: () => MessageOverrides<ColorSwatchMessages> | undefined
  readonly ariaLabel?: () => string | undefined
  readonly decorative?: boolean
}) {
  const instance = useRootId(options.id ?? (() => undefined))
  const loc = useLocale(options.locale ?? (() => undefined))
  const messages = useMessages("color-swatch", colorSwatchMessages, options.messages)
  return () => {
    const color = swatchColor(options.color())
    const api = colorSwatchConnect({
      instance: instance(),
      color,
      respectAlpha: options.respectAlpha?.(),
      messages: messages.value,
      locale: loc.value.locale,
      colorName: options.colorName?.(),
      ariaLabel: options.ariaLabel?.(),
      decorative: options.decorative,
    })
    return { color, api }
  }
}

const Root = defineComponent({
  name: "ColorSwatchRoot",
  inheritAttrs: false,
  props: {
    ...asChildProp,
    id: String,
    /** Default transparent black. */
    color: colorProp,
    /** `false`: the opaque colour (default true). */
    respectAlpha: { type: Boolean, default: undefined },
    /** A fixed name (a design token) or a function replacing the computed name. */
    colorName: [String, Function] as PropType<ColorNameProp>,
    /** Formats the transparency percentage. Default: the provider's locale. */
    locale: String,
    /** The role description and the colour words. */
    messages: Object as PropType<MessageOverrides<ColorSwatchMessages>>,
  },
  slots: Object as SlotsType<{ default?: (state: ColorSwatchState) => VNodeChild }>,
  setup(props, { attrs, slots }) {
    const swatch = useSwatchProps({
      id: () => props.id,
      color: () => props.color ?? undefined,
      respectAlpha: () => props.respectAlpha,
      colorName: () => props.colorName,
      locale: () => props.locale,
      messages: () => props.messages,
      ariaLabel: () => attrs["aria-label"] as string | undefined,
    })
    const naming = inject(SwatchNamingKey, null)
    return () => {
      const { color, api } = swatch()
      const { "aria-label": _label, ...rest } = attrs
      void _label
      return renderPart(
        "div",
        mergeProps(normalizeProps(naming ? api.root(naming.scope, naming.part) : api.root()), rest),
        slots.default?.({
          color,
          transparent: (props.respectAlpha === false ? 1 : color.alpha) < 1,
        }),
        props.asChild,
      )
    }
  },
})

/** A decorative checkerboard filling its parent, under a colour that has transparency. */
export const TransparencyGrid = defineComponent({
  name: "ColorSwatchTransparencyGrid",
  inheritAttrs: false,
  props: {
    ...asChildProp,
    /** The `data-scope` it carries (default `"color-swatch"`). */
    scope: { type: String, default: "color-swatch" },
  },
  setup(props, { attrs, slots }) {
    const instance = useRootId(() => undefined)
    return () =>
      renderPart(
        "div",
        mergeProps(normalizeProps(transparencyGridProps(props.scope, instance())), attrs),
        slots["default"]?.(),
        props.asChild,
      )
  },
})

/** A chip that shows a colour and names it for assistive technology. */
export const ColorSwatch = { Root, TransparencyGrid }
