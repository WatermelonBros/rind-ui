import type { AngleSliderEvent, colorWheelConnect, hiddenFormInput } from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import { createContext } from "../context"
import type { ColorWheelRenderState } from "./types"

export const colorWheelContext = createContext<{
  readonly api: () => ReturnType<typeof colorWheelConnect>
  readonly send: (event: AngleSliderEvent) => void
  readonly state: () => ColorWheelRenderState
  readonly registry: PartRegistry<"label">
  readonly labelId: () => string
  readonly input: { current: HTMLInputElement | null }
  readonly thumb: { current: HTMLElement | null }
  readonly press: (e: PointerEvent) => void
  readonly setFocused: (focused: boolean) => void
  readonly rangeInput: { track: ReturnType<typeof hiddenFormInput>["track"] }
}>("color-wheel")
