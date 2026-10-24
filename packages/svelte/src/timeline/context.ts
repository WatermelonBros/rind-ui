import type { TimelineItemInput, timelineConnect } from "@rind-ui/core"
import { createContext } from "../context"
import type { TimelineRenderState } from "./types"

export const timelineContext = createContext<{
  readonly api: () => ReturnType<typeof timelineConnect>
  readonly state: () => TimelineRenderState
  readonly register: (index: number) => () => void
  readonly locale: () => string
}>("timeline")
export const timelineItem = createContext<() => TimelineItemInput>("timeline-item")
