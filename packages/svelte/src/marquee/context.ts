import type { MarqueeEvent, marqueeConnect } from "@rind-ui/core"
import { createContext } from "../context"
import type { MarqueeRenderState } from "./types"

export const marqueeContext = createContext<{
  readonly api: () => ReturnType<typeof marqueeConnect>
  readonly send: (event: MarqueeEvent) => void
  readonly state: () => MarqueeRenderState
  readonly copies: () => number
}>("marquee")
