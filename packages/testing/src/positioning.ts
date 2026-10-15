// A fake `position` capability for machine tests in Node: records what was tracked and
// lets the test emit placements, as the DOM implementation would.

import type { Placement, PositionHandle, Positioning, PositionRequest } from "@rind-ui/core"

export interface FakePositioning extends Positioning {
  /** Requests currently tracked (stopped ones removed). */
  readonly requests: readonly PositionRequest[]
  /** How many times `reposition` reached a tracked request. */
  readonly repositions: number
  /** Reports a placement to every tracked request (or the one for `positioner`). */
  emit(
    placement: Placement,
    options?: { readonly first?: boolean; readonly positioner?: string },
  ): void
}

export function fakePositioning(): FakePositioning {
  const live = new Set<PositionRequest>()
  let repositions = 0
  return {
    get requests() {
      return [...live]
    },
    get repositions() {
      return repositions
    },
    track(request): PositionHandle {
      live.add(request)
      return {
        reposition: () => {
          if (live.has(request)) repositions++
        },
        stop: () => {
          live.delete(request)
        },
      }
    },
    reposition(positioner) {
      for (const r of live) if (r.positioner === positioner) repositions++
    },
    emit(placement, options = {}) {
      for (const r of [...live]) {
        if (options.positioner && r.positioner !== options.positioner) continue
        r.onPlacement(placement, options.first ?? true)
      }
    },
  }
}
