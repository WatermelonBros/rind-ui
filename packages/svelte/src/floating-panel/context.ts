import type { FloatingPanelEvent, floatingPanelConnect } from "@rind-ui/core"
import type { ResizeAxis } from "@rind-ui/core/internal"
import { createContext } from "../context"
import type { FloatingPanelRenderState } from "./types"

export const floatingPanelContext = createContext<{
  readonly api: () => ReturnType<typeof floatingPanelConnect>
  readonly send: (event: FloatingPanelEvent) => void
  readonly state: () => FloatingPanelRenderState
  readonly positioner: { current: HTMLElement | null }
  readonly dragTrigger: { current: HTMLElement | null }
  readonly body: { current: HTMLElement | null }
  readonly dir: () => "ltr" | "rtl"
  readonly startDrag: (e: PointerEvent, axis?: ResizeAxis) => void
  readonly cancelDrag: () => boolean
}>("floating-panel")
