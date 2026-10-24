import type { Color, FlushRegistry, hiddenFormInput, Service } from "@rind-ui/core"
import type { colorFieldConnect, colorFieldMachine } from "@rind-ui/core/internal"
import { createContext } from "../context"
import type { ColorFieldState } from "./types"

/** The flush registry an owner (the Color Picker) provides: each field registers its `flush`. */
export const colorFlush = createContext<FlushRegistry>("color-flush")

export const colorField = createContext<{
  readonly api: () => ReturnType<typeof colorFieldConnect>
  readonly state: () => ColorFieldState
  readonly send: Service<typeof colorFieldMachine>["send"]
  readonly inputEl: { current: HTMLInputElement | null }
  readonly hiddenEl: { current: HTMLInputElement | null }
  readonly formInput: ReturnType<typeof hiddenFormInput>
  readonly format: () => "hex" | "css"
  readonly alpha: () => boolean
  readonly setFocused: (on: boolean) => void
  readonly invalidMessage: () => string
  readonly value: () => Color | null
}>("color-field")
export const colorChannel = createContext<() => string>("color-channel-field")
