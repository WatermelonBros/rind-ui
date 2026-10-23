import type {
  createNumberParser,
  hiddenFormInput,
  NumberInputEvent,
  NumberInputPart,
  NumberInputTrigger,
  numberInputMachine,
  PartNaming,
} from "@rind-ui/core"
import { createContext } from "../context"
import type { useMachine } from "../use-machine.svelte"

type Machine = ReturnType<typeof useMachine<typeof numberInputMachine>>

export const numberInputContext = createContext<{
  readonly instance: () => string
  readonly view: () => Machine["view"]
  readonly send: (e: NumberInputEvent) => void
  readonly parser: () => ReturnType<typeof createNumberParser>
  readonly messages: () => import("@rind-ui/core").NumberInputMessages
  readonly disabled: () => boolean
  readonly readOnly: () => boolean
  readonly min: () => number | undefined
  readonly max: () => number | undefined
  readonly step: () => number | undefined
  readonly defaultValue: () => number | null
  readonly allowWheel: () => boolean
  readonly form: () => string | undefined
  readonly dir: () => "ltr" | "rtl"
  readonly inputEl: { current: HTMLInputElement | null }
  readonly hiddenEl: { current: HTMLInputElement | null }
  readonly formInput: ReturnType<typeof hiddenFormInput>
  readonly mounted: () => boolean
  readonly pressed: () => { increment: boolean; decrement: boolean }
  readonly setPressed: (t: NumberInputTrigger, on: boolean) => void
  readonly ids: () => { input: string; increment: string; decrement: string; hiddenInput: string }
  readonly setInputId: (id: string) => void
}>("number-input")
/**
 * Internal (not exported from the package): set by a component that renders a Number Input as
 * its part (Color Picker's channel input): the host's scope and part names.
 */
export const numberInputNaming = createContext<PartNaming<NumberInputPart>>("number-input-naming")
