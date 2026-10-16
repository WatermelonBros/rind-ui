import type { Placement, Positioning, PositionRequest } from "@rind-ui/core"
export interface FakePositioning extends Positioning {
  /** Requests currently tracked (stopped ones removed). */
  readonly requests: readonly PositionRequest[]
  /** How many times `reposition` reached a tracked request. */
  readonly repositions: number
  /** Reports a placement to every tracked request (or the one for `positioner`). */
  emit(
    placement: Placement,
    options?: {
      readonly first?: boolean
      readonly positioner?: string
    },
  ): void
}
export declare function fakePositioning(): FakePositioning
