import type { Color } from "@rind-ui/core"
import type { ColorSwatchPickerMessages, SwatchItem } from "@rind-ui/core/internal"
import { createContext } from "../context"

declare module "../provider" {
  interface RindMessageScopes {
    "color-swatch-picker": ColorSwatchPickerMessages
  }
}

export type Registered = SwatchItem & { readonly el: () => Element | null }

export const swatchPicker = createContext<{
  readonly register: (item: Registered) => () => void
  readonly messages: () => ColorSwatchPickerMessages
  readonly locale: () => string
}>("color-swatch-picker")
export const swatchItem = createContext<() => Color>("color-swatch-picker-item")
