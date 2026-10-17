// A page visibility for tests: hidden or shown by the test, no DOM read (page-visibility
// "Test without a DOM"). Pass it as `domEnvironment({ visibility })` or in a machine env.

import type { PageVisibility } from "@rind-ui/core"

export interface FakeVisibility extends PageVisibility {
  /** Hides or shows the page; subscribers hear a change only. */
  set(hidden: boolean): void
}

export function fakeVisibility(initiallyHidden = false): FakeVisibility {
  let hidden = initiallyHidden
  const listeners = new Set<(hidden: boolean) => void>()
  return {
    hidden: () => hidden,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    set(next) {
      if (next === hidden) return
      hidden = next
      for (const l of listeners) l(hidden)
    },
  }
}
