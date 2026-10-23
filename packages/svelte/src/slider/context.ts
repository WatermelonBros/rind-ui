import type {
  hiddenFormInput,
  PartNaming,
  SliderEvent,
  SliderOrientation,
  SliderPart,
  sliderConnect,
} from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import { createContext } from "../context"
import type { SliderState } from "./types"

export const sliderContext = createContext<{
  readonly instance: () => string
  readonly api: () => ReturnType<typeof sliderConnect>
  readonly state: () => SliderState
  readonly send: (e: SliderEvent) => void
  readonly registry: PartRegistry<"label" | "description">
  readonly inputs: (HTMLInputElement | null)[]
  readonly thumbs: (Element | null)[]
  readonly control: { current: Element | null }
  readonly values: () => readonly number[]
  readonly formInput: (index: number) => ReturnType<typeof hiddenFormInput>
  readonly setThumbDisabled: (index: number, disabled: boolean | undefined) => void
  readonly press: (e: PointerEvent) => void
  readonly inField: boolean
  readonly orientation: () => SliderOrientation
  readonly dir: () => "ltr" | "rtl"
}>("slider")
/**
 * Internal (not exported from the package): set by Color Slider, whose Root is the pointer
 * surface when there is no Control. A plain Slider's Root never starts a drag.
 */
export const sliderRootSurface = createContext<boolean>("slider-root-surface")
/**
 * Internal (not exported from the package): set by a component that renders a Slider as its
 * part (Color Picker's channel slider): the host's scope and part names.
 */
export const sliderNaming = createContext<PartNaming<SliderPart>>("slider-naming")
