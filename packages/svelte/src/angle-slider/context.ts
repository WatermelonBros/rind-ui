import type { AngleSliderEvent, angleSliderConnect, hiddenFormInput } from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import { createContext } from "../context"
import type { AngleSliderRenderState } from "./types"

export const angleSliderContext = createContext<{
  readonly api: () => ReturnType<typeof angleSliderConnect>
  readonly send: (event: AngleSliderEvent) => void
  readonly state: () => AngleSliderRenderState
  readonly registry: PartRegistry<"label">
  readonly labelId: () => string
  readonly input: { current: HTMLInputElement | null }
  readonly thumb: { current: HTMLElement | null }
  readonly press: (e: PointerEvent) => void
  readonly setFocused: (focused: boolean) => void
  readonly formInput: {
    track: ReturnType<typeof hiddenFormInput>["track"]
  }
}>("angle-slider")
