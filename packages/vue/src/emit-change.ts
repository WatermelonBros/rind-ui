import type { ChangeDetails, EventObject } from "@rind-ui/core"

/**
 * A machine's `on<Value>Change` callback as two Vue events: `<name>Change` (with the details,
 * whose `cancel()` vetoes the change) first, then `update:<name>` for `v-model`, only when no
 * listener cancelled.
 */
export function changeEmitter<V, E extends EventObject>(
  change: (value: V, details: ChangeDetails<E>) => void,
  update: (value: V) => void,
) {
  return (value: V, details: ChangeDetails<E>) => {
    let cancelled = false
    change(value, {
      ...details,
      cancel() {
        cancelled = true
        details.cancel()
      },
    })
    if (!cancelled) update(value)
  }
}
