import type { RatingEvent, ratingConnect } from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import { createContext } from "../context"
import type { RatingState } from "./types"

export const ratingContext = createContext<{
  readonly instance: () => string
  readonly api: () => ReturnType<typeof ratingConnect>
  readonly state: () => RatingState
  readonly send: (e: RatingEvent) => void
  readonly registry: PartRegistry<"label">
  readonly input: { current: HTMLInputElement | null }
  readonly carrier: { current: HTMLInputElement | null }
  readonly control: { current: Element | null }
  readonly inField: boolean
  readonly dir: () => "ltr" | "rtl"
}>("rating")
