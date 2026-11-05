import type { ChangeDetails, EventObject } from "@rind-ui/core"

/** What a `<value>ChangeDetails` output emits: the proposed value and why it changes. */
export interface ChangeEvent<
  V,
  E extends EventObject,
  R extends string = ChangeDetails<E>["reason"],
> {
  readonly value: V
  /** `details.cancel()`, called synchronously, vetoes the change. */
  readonly details: ChangeDetails<E, R>
}

/**
 * A machine's `on<Value>Change` callback as two Angular outputs: `<value>ChangeDetails` (whose
 * `details.cancel()` vetoes the change) first, then `<value>Change` for `[(<value>)]`, only when
 * no listener cancelled.
 */
export function changeEmitter<
  V,
  E extends EventObject,
  R extends string = ChangeDetails<E>["reason"],
>(details: { emit(event: ChangeEvent<V, E, R>): void }, change: { emit(value: V): void }) {
  return (value: V, d: ChangeDetails<E, R>) => {
    let cancelled = false
    details.emit({
      value,
      details: {
        ...d,
        cancel() {
          cancelled = true
          d.cancel()
        },
      },
    })
    if (!cancelled) change.emit(value)
  }
}
