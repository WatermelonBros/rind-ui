// The Color Picker's colour, for the colour parts it is built on (Area, Channel Slider, Channel
// Input, Swatch Group): a part inside a picker is bound to it. Internal.
import { InjectionToken, inject } from "@angular/core"
import type {
  Color,
  ColorNameProp,
  ColorPickerMessages,
  ColorPickerReason,
  FlushRegistry,
} from "@rind-ui/core"

export interface ColorBinding {
  readonly color: () => Color
  readonly disabled: () => boolean
  readonly readOnly: () => boolean
  readonly dir: () => "ltr" | "rtl"
  readonly locale: () => string
  readonly colorName: () => ColorNameProp | undefined
  readonly messages: () => ColorPickerMessages
  /** A working colour (a drag, a key, a typed channel). */
  readonly set: (color: Color, reason: ColorPickerReason, channel?: string) => void
  /** The end of an interaction that changed the colour. */
  readonly commit: (reason: ColorPickerReason) => void
}

export const COLOR_BINDING = new InjectionToken<ColorBinding>("rind-ui.color-binding")

/** The picker this part is bound to, or null for a part of its own. */
export const injectColorBinding = () => inject(COLOR_BINDING, { optional: true }) ?? null

/** The flush registry an owner (the Color Picker) provides: each field registers its `flush`. */
export const COLOR_FLUSH = new InjectionToken<FlushRegistry>("rind-ui.color-flush")
