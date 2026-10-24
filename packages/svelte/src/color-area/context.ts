import type { hiddenFormInput } from "@rind-ui/core"
import type { ColorAreaEvent, colorAreaConnect } from "@rind-ui/core/internal"
import { createContext } from "../context"
import type { ColorAreaState } from "./types"

export type Axis = "x" | "y"

export const colorArea = createContext<{
  readonly api: () => ReturnType<typeof colorAreaConnect>
  readonly state: () => ColorAreaState
  readonly send: (e: ColorAreaEvent) => void
  readonly inputs: Record<Axis, HTMLInputElement | null>
  readonly formInput: (axis: Axis) => ReturnType<typeof hiddenFormInput>
  readonly shown: () => { x: number; y: number }
  readonly thumb: { current: HTMLElement | null }
  readonly dir: () => "ltr" | "rtl"
}>("color-area")
