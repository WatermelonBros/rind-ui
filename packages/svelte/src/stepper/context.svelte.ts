import type { StepperEvent, StepperMessages, stepperConnect } from "@rind-ui/core"
import { createContext } from "../context"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import type { StepperRenderState } from "./types"

export interface Registry {
  disabled(index: number, on: boolean): () => void
  completed(index: number, value: boolean | undefined): () => void
  title(index: number, text: string): () => void
}
export const stepperContext = createContext<{
  readonly api: () => ReturnType<typeof stepperConnect>
  readonly state: () => StepperRenderState
  readonly send: (event: StepperEvent) => void
  readonly registry: Registry
  readonly messages: () => StepperMessages
}>("stepper")
export const stepperItem = createContext<{
  readonly index: () => number
  /** A Description is rendered: the Trigger is described by it. */
  readonly described: () => boolean
  readonly setDescribed: (on: boolean) => void
}>("stepper-item")

/** A focusable part's own focus, tracked from mount so the focusing press is already known. */
export function useFocusState() {
  const env = useEnvironment()
  $effect(() => env.modality.subscribe(() => {}))
  let focused = $state(false)
  const modality = useModality(env.modality, () => focused)
  return {
    focus: () => ({ focused, modality: modality.current }),
    handlers: {
      onfocus: (e: FocusEvent) => {
        if (e.target === e.currentTarget) focused = true
      },
      onblur: (e: FocusEvent) => {
        if (e.target === e.currentTarget) focused = false
      },
    },
  }
}
