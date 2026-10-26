import type { TimerEvent, TimerMessages, TimerUnit, timerConnect } from "@rind-ui/core"
import { createContext } from "../context"
import type { TimerRenderState } from "./types"

export const timerContext = createContext<{
  readonly api: () => ReturnType<typeof timerConnect>
  readonly send: (event: TimerEvent) => void
  readonly state: () => TimerRenderState
  readonly messages: () => TimerMessages
}>("timer")

/** The unit of the enclosing Item, for its ItemValue and ItemLabel. */
export const timerUnitContext = createContext<() => TimerUnit>("timer-unit")

/** A part's unit: its own `type`, else its Item's. */
export function useUnit(part: string, own: () => TimerUnit | undefined): () => TimerUnit {
  const inherited = timerUnitContext.maybe()
  return () => {
    const unit = own() ?? inherited?.()
    if (!unit) throw new Error(`[rind-ui] Timer.${part} needs a type, or to be inside Timer.Item`)
    return unit
  }
}
