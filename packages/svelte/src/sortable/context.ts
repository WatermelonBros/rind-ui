import type { Service, SortableOrientation, sortableConnect, sortableMachine } from "@rind-ui/core"
import { createContext } from "../context"
import type { SortableRenderState } from "./types"

export interface SortableHost {
  readonly api: () => ReturnType<typeof sortableConnect>
  readonly state: () => SortableRenderState
  readonly send: Service<typeof sortableMachine>["send"]
  readonly orientation: () => SortableOrientation
  readonly handleDrags: () => boolean
  readonly register: (key: string, label: string | undefined, disabled: boolean) => void
  readonly startDrag: (key: string, e: PointerEvent) => void
  readonly isMovable: (key: string) => boolean
}
export const sortableHost = createContext<SortableHost>("sortable")
/** The enclosing Item's key. */
export const sortableItem = createContext<() => string>("sortable-item")
