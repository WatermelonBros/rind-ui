import type { ColorInput, ColorNameProp, MessageOverrides } from "@rind-ui/core"
import {
  type ColorSwatchMessages,
  colorSwatchConnect,
  colorSwatchMessages,
  swatchColor,
} from "@rind-ui/core/internal"
import { createContext } from "../context"
import { useLocale, useMessages } from "../provider"

declare module "../provider" {
  interface RindMessageScopes {
    "color-swatch": ColorSwatchMessages
  }
}

/**
 * Internal (not exported from the package): set by the Color Picker's swatch parts, whose
 * swatches render under the picker's scope (`swatch`, `value-swatch`).
 */
export const swatchNaming = createContext<{ readonly scope: string; readonly part: string }>(
  "swatch-naming",
)

/** The swatch's props for a colour (getters); shared with the parts that show one. Call at init. */
export function useSwatchProps(options: {
  readonly instance: () => string
  readonly color: () => ColorInput | undefined
  readonly respectAlpha?: () => boolean | undefined
  readonly colorName?: () => ColorNameProp | undefined
  readonly locale?: () => string | undefined
  readonly messages?: () => MessageOverrides<ColorSwatchMessages> | undefined
  readonly ariaLabel?: () => string | undefined
  readonly decorative?: boolean
}) {
  const loc = useLocale(options.locale ?? (() => undefined))
  const messages = useMessages("color-swatch", colorSwatchMessages, options.messages)
  return () => {
    const color = swatchColor(options.color())
    const api = colorSwatchConnect({
      instance: options.instance(),
      color,
      respectAlpha: options.respectAlpha?.(),
      messages: messages(),
      locale: loc.current.locale,
      colorName: options.colorName?.(),
      ariaLabel: options.ariaLabel?.(),
      decorative: options.decorative,
    })
    return { color, api }
  }
}
