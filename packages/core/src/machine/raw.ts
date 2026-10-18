// The name-erased shape of a machine definition, as the runtime and tools (graph
// extraction, docs) read it. The typed shape lives in `types.ts`.

import type { EventObject } from "./types"

export type RawGuard =
  | string
  | { readonly not: RawGuard }
  | { readonly and: readonly RawGuard[] }
  | { readonly or: readonly RawGuard[] }

export interface RawTransition {
  readonly target?: string
  readonly guard?: RawGuard
  readonly actions?: readonly string[]
  readonly reenter?: boolean
  readonly reason?: string
}
export type RawTransitions = string | RawTransition | readonly RawTransition[]

export interface RawStateDef {
  readonly tags?: readonly string[]
  readonly entry?: readonly string[]
  readonly exit?: readonly string[]
  readonly effects?: readonly string[]
  readonly on?: Readonly<Record<string, RawTransitions>>
  readonly after?: Readonly<Record<string, RawTransitions>>
}

/** A controllable value, or (`readOnly`) a binding to a prop only the parent controls. */
export interface RawValue {
  readonly readOnly?: boolean
  readonly fallback?: unknown
  readonly equal?: (a: unknown, b: unknown) => boolean
  readonly states?: Readonly<Record<string, unknown>>
}

export interface RawMachineDef {
  readonly id: string
  readonly initial: string
  readonly context?: (props: Record<string, unknown>) => Record<string, unknown>
  readonly values?: Readonly<Record<string, RawValue>>
  readonly computed?: Readonly<Record<string, (view: Readonly<Record<string, unknown>>) => unknown>>
  readonly onProps?: Readonly<
    Record<
      string,
      string | { readonly event: string; readonly equal: (a: never, b: never) => boolean }
    >
  >
  readonly effects?: readonly string[]
  readonly on?: Readonly<Record<string, RawTransitions>>
  readonly states: Readonly<Record<string, RawStateDef>>
}

type Args = Readonly<Record<string, unknown>> & { readonly event?: EventObject }
export interface RawImplementations {
  readonly actions?: Readonly<Record<string, (args: Args) => void>>
  readonly guards?: Readonly<Record<string, (args: Args) => boolean>>
  readonly effects?: Readonly<Record<string, (args: Args) => unknown>>
  readonly delays?: Readonly<Record<string, (args: { props: unknown; context: unknown }) => number>>
}
