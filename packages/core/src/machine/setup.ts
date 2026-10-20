import type { Implementations, Machine, MachineDef, PropBinding, Types } from "./types"

/**
 * Declares a machine's types and implementations; `.machine()` then takes the static
 * definition, whose state, action, guard, effect and delay names are checked against them.
 */
/* @__NO_SIDE_EFFECTS__ */
export function setup<T extends Types, const I extends Implementations<T>>(
  config: { readonly types: T } & I,
): {
  machine<const S extends string, CP extends Record<string, unknown> = Record<never, never>>(
    def: MachineDef<S, T, I, CP>,
  ): Machine<S, T, I, CP>
} {
  return {
    // `def` was checked as MachineDef<S, T, I, CP> above; Machine only stores it.
    machine: (def) => ({ def, impl: config }) as never,
  }
}

/** Phantom carrier for declared types. The cast is sound: the value is never read. */
export const type = <T extends Types>(): T => ({}) as T

/** Narrows an event inside an action; throws if the event has another type. */
export function assertEvent<E extends { readonly type: string }, K extends E["type"]>(
  event: E,
  type: K,
): asserts event is Extract<E, { type: K }> {
  if (event.type !== type) throw new Error(`Expected event "${type}", got "${event.type}"`)
}

/** Binds machine states to a prop only the parent controls (e.g. `pending`). */
export function bindProp<V, S extends string>(binding: {
  readonly fallback?: V
  readonly equal?: (a: V, b: V) => boolean
  readonly states: { readonly [St in S]: V }
}): PropBinding<V, S> {
  return { readOnly: true, ...binding }
}
