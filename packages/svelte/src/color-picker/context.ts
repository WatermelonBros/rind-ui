import type {
  Color,
  ColorNameProp,
  ColorPickerFormat,
  ColorPickerMessages,
  colorPickerConnect,
  colorPickerMachine,
  createFlushRegistry,
  Service,
} from "@rind-ui/core"
import { createContext } from "../context"
import type { ColorPickerState } from "./types"

export interface PickerCtx {
  readonly instance: () => string
  readonly color: () => Color
  readonly format: () => ColorPickerFormat
  readonly state: () => ColorPickerState
  readonly send: Service<typeof colorPickerMachine>["send"]
  readonly api: () => ReturnType<typeof colorPickerConnect>
  readonly messages: () => ColorPickerMessages
  readonly locale: () => string
  readonly dir: () => "ltr" | "rtl"
  readonly inline: boolean
  readonly colorName: () => ColorNameProp | undefined
  readonly registry: ReturnType<typeof createFlushRegistry>
  readonly setLabelRendered: (on: boolean) => void
  readonly setHiddenPart: (on: boolean) => void
  readonly triggerEl: { current: HTMLElement | null }
  readonly formValue: () => string
}
export const colorPicker = createContext<PickerCtx>("color-picker")
/** Inside the Trigger: the ValueSwatch is decorative (the Trigger's name carries the colour). */
export const inTrigger = createContext<boolean>("color-picker-in-trigger")
export const SWATCH = { scope: "color-picker", part: "swatch" } as const
export const VALUE_SWATCH = { scope: "color-picker", part: "value-swatch" } as const
