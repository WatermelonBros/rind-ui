// Public types of the machine runtime. Names are inferred from the definition and its
// implementations so that a typo in a target, event, action, guard, effect or delay name
// is a compile error (see openspec machine-runtime "Definitions Are Type-Checked").

import type { SchedulerEnv } from "../env/capabilities"

/** Every machine event is a member of a discriminated union on `type`. */
export interface EventObject {
  readonly type: string
}

/** Extracts the string members of a key union. */
export type Str<T> = Extract<T, string>

/** Declared (not inferred) machine types. Carried by `type<…>()`. */
export interface Types {
  readonly props: object
  readonly events: EventObject
  readonly env: object
  readonly context?: object
  /**
   * The controllable keys this machine declares (each a prop `K` with `defaultK` and
   * `onKChange`). Only these become `values` and are writable through `set`.
   */
  readonly values?: string
}

type Get<T, K extends PropertyKey, F> = T extends { readonly [P in K]?: infer V }
  ? undefined extends V
    ? F
    : V
  : F

export type PropsOf<T extends Types> = T["props"]
export type ContextOf<T extends Types> = Get<T, "context", Record<never, never>>
/** The controllable keys declared in `types.values`. */
export type ValueKeysOf<T extends Types> = Extract<Get<T, "values", never>, string>

/**
 * A prop `K` is controllable when the props also declare `defaultK` and
 * `onKChange(value, details)`. Names that do not follow the convention are not keys.
 */
export type ControllableName<P> = {
  [K in Str<keyof P>]-?: P[`default${Capitalize<K>}` & keyof P] extends P[K] | undefined
    ? `default${Capitalize<K>}` extends keyof P
      ? P[`on${Capitalize<K>}Change` & keyof P] extends
          | ((value: NonNullable<P[K]>, details: never) => unknown)
          | undefined
        ? `on${Capitalize<K>}Change` extends keyof P
          ? K
          : never
        : never
      : never
    : never
}[Str<keyof P>]

/** Resolved controllable values of the declared keys. */
export type ValuesOf<T extends Types> = {
  readonly [K in ValueKeysOf<T>]: NonNullable<T["props"][K & keyof T["props"]]>
}

/** Events the runtime produces itself. */
export type SyncEvent = { readonly type: "$sync"; readonly key: string; readonly value: unknown }
export type RevertedEvent = {
  readonly type: "$reverted"
  readonly key: string
  readonly value: unknown
}
export type DelayEvent = { readonly type: `after:${string}` }
export type PropsEvent = { readonly type: `$props:${string}` }
/** Entry actions of the initial state run on the first `start()` with this event. */
export type StartEvent = { readonly type: "$start" }
export type SystemEvent = SyncEvent | RevertedEvent | DelayEvent | StartEvent

/** Every event an implementation may observe: the declared union plus runtime events. */
export type AnyEventOf<T extends Types> = T["events"] | SystemEvent

/** Passed as the second argument of every `onXChange`. */
export interface ChangeDetails<E extends EventObject = EventObject> {
  /** The type of the event that caused the change (a declared or a runtime event). */
  readonly reason: (E | SystemEvent)["type"]
  readonly event: E | SystemEvent
  /** Prevents the change (uncontrolled) or refuses it (controlled). */
  cancel(): void
}

interface ReadArgs<T extends Types> {
  readonly props: Readonly<T["props"]>
  readonly context: Readonly<ContextOf<T>>
  readonly values: ValuesOf<T>
  readonly env: T["env"]
}

type Settable<T extends Types> = ContextOf<T> & ValuesOf<T>

export interface ActionArgs<T extends Types> extends ReadArgs<T> {
  readonly event: AnyEventOf<T>
  /** Writes context or a controllable value; later actions in the step see the write. */
  set<K extends Str<keyof Settable<T>>>(key: K, value: Settable<T>[K]): void
  /** Queued and processed after the current step, before the outer `send` returns. */
  send(event: T["events"]): void
}
export type GuardArgs<T extends Types> = ReadArgs<T> & { readonly event: AnyEventOf<T> }
/** Effects read live props, context and values; they can only send. */
export type EffectArgs<T extends Types> = ReadArgs<T> & {
  send(event: T["events"]): void
}

export type ActionFn<T extends Types> = (args: ActionArgs<T>) => void
export type GuardFn<T extends Types> = (args: GuardArgs<T>) => boolean
export type EffectFn<T extends Types> = (args: EffectArgs<T>) => undefined | (() => void)
/** A delay's duration, from the props and the context at the state's entry. */
export type DelayFn<T extends Types> = (args: {
  readonly props: Readonly<T["props"]>
  readonly context: Readonly<T["context"]>
}) => number

export interface Implementations<T extends Types> {
  readonly actions?: Readonly<Record<string, ActionFn<T>>>
  readonly guards?: Readonly<Record<string, GuardFn<T>>>
  readonly effects?: Readonly<Record<string, EffectFn<T>>>
  /** Delays need a scheduler in the environment. */
  readonly delays?: T["env"] extends SchedulerEnv ? Readonly<Record<string, DelayFn<T>>> : never
}

export type ActionName<I> = I extends { readonly actions?: infer A } ? Str<keyof A> : never
export type GuardName<I> = I extends { readonly guards?: infer G } ? Str<keyof G> : never
export type EffectName<I> = I extends { readonly effects?: infer F } ? Str<keyof F> : never
export type DelayName<I> = I extends { readonly delays?: infer D } ? Str<keyof D> : never

export type GuardExpr<G extends string> =
  | G
  | { readonly not: GuardExpr<G> }
  | { readonly and: readonly GuardExpr<G>[] }
  | { readonly or: readonly GuardExpr<G>[] }

export interface TransitionDef<S extends string, A extends string, G extends string> {
  /** Omitted: an internal transition that only runs actions. */
  readonly target?: S
  readonly guard?: GuardExpr<G>
  readonly actions?: readonly A[]
  /** Exit and re-enter when the target is the current state. */
  readonly reenter?: boolean
  /**
   * Reported as `details.reason` of the controllable change this transition makes, instead
   * of the event type (a delayed open is a "hover", not an `after:` event).
   */
  readonly reason?: string
}

/** A target, one transition, or guarded alternatives (the first whose guard passes wins). */
export type Transitions<S extends string, A extends string, G extends string> =
  | S
  | TransitionDef<S, A, G>
  | readonly TransitionDef<S, A, G>[]

type On<S extends string, T extends Types, I> = {
  readonly [K in T["events"]["type"] | "$reverted"]?: Transitions<S, ActionName<I>, GuardName<I>>
}

export interface StateDef<S extends string, T extends Types, I> {
  readonly tags?: readonly string[]
  readonly entry?: readonly ActionName<I>[]
  readonly exit?: readonly ActionName<I>[]
  readonly effects?: readonly EffectName<I>[]
  readonly on?: On<S, T, I>
  readonly after?: { readonly [K in DelayName<I>]?: Transitions<S, ActionName<I>, GuardName<I>> }
}

/** Binds a prop-driven value; `states` maps every machine state to the value it implies. */
export interface ControllableDef<V, S extends string> {
  readonly fallback: V
  readonly equal?: (a: V, b: V) => boolean
  readonly states?: { readonly [St in S]: V }
}

/** A read-only binding to a prop only the parent controls (no default, no callback). */
export interface PropBinding<V, S extends string> {
  readonly readOnly: true
  readonly fallback?: V
  readonly equal?: (a: V, b: V) => boolean
  readonly states: { readonly [St in S]: V }
}

export type ControllablesDef<T extends Types, S extends string> = {
  readonly [K in ValueKeysOf<T>]: K extends ControllableName<T["props"]>
    ? ControllableDef<NonNullable<T["props"][K & keyof T["props"]]>, S>
    : `prop "${K}" needs "default${Capitalize<K>}" and "on${Capitalize<K>}Change"`
}

export type MachineDef<
  S extends string,
  T extends Types,
  I,
  CP extends Record<string, unknown> = Record<never, never>,
> = MachineDefBase<S, T, I, CP> &
  ([ValueKeysOf<T>] extends [never]
    ? { readonly values?: BindingsDef<T, NoInfer<S>> }
    : { readonly values: ControllablesDef<T, NoInfer<S>> & BindingsDef<T, NoInfer<S>> }) &
  (keyof ContextOf<T> extends never
    ? { readonly context?: (props: T["props"]) => ContextOf<T> }
    : { readonly context: (props: T["props"]) => ContextOf<T> })

/** Read-only prop bindings, keyed by prop name. */
export type BindingsDef<T extends Types, S extends string> = {
  readonly [K in Exclude<Str<keyof T["props"]>, ValueKeysOf<T>>]?: PropBinding<
    NonNullable<T["props"][K]>,
    S
  >
}

/** Event types that need no payload (every other field optional). */
type BareEventType<E extends EventObject> = E extends EventObject
  ? { readonly type: E["type"] } extends E
    ? E["type"]
    : never
  : never

export interface MachineDefBase<
  S extends string,
  T extends Types,
  I,
  CP extends Record<string, unknown> = Record<never, never>,
> {
  readonly id: string
  /** Overridden by a controllable bound to states (e.g. `defaultOpen` → `open`). */
  readonly initial: NoInfer<S>
  /** Derived values, memoised per view. Never decide transitions. */
  readonly computed?: { readonly [K in keyof CP]: (view: BaseView<T, NoInfer<S>>) => CP[K] }
  /**
   * Prop-change events: when the prop's identity changes, the event is sent. An object-valued
   * prop passes `equal` so a new object with the same content (an inline `value={{ … }}`) is
   * no change.
   */
  readonly onProps?: {
    readonly [K in Str<keyof T["props"]>]?:
      | BareEventType<T["events"]>
      | {
          readonly event: BareEventType<T["events"]>
          readonly equal: (a: T["props"][K], b: T["props"][K]) => boolean
        }
  }
  /** Effects active for the whole life of the started service. */
  readonly effects?: readonly EffectName<I>[]
  /** Transitions available in every state, after the state's own. */
  readonly on?: On<NoInfer<S>, T, I>
  /** State names must not contain "." (reserved for hierarchical states). */
  readonly states: {
    readonly [K in S]: K extends `${string}.${string}` ? never : StateDef<NoInfer<S>, T, I>
  }
}

/** What every machine carries, for code that accepts any machine. */
export interface AnyMachine {
  readonly def: unknown
  readonly impl: unknown
  /** Phantom type carrier; never set at runtime. Covariant, so every machine fits. */
  readonly "~machine"?: {
    readonly state: string
    readonly types: Types
    readonly computed: unknown
  }
}

/**
 * A machine: its definition plus implementations. `S`, `T` and `CP` are carried so
 * services, views, contracts and graphs are typed from it.
 */
export interface Machine<
  S extends string = string,
  T extends Types = Types,
  I = unknown,
  CP extends Record<string, unknown> = Record<string, unknown>,
> extends AnyMachine {
  readonly def: MachineDef<S, T, I, CP>
  readonly impl: Implementations<T>
  readonly "~machine"?: { readonly state: S; readonly types: T; readonly computed: CP }
}

type Phantom<M extends AnyMachine> = NonNullable<M["~machine"]>
export type StateOf<M extends AnyMachine> = Phantom<M>["state"]
export type TypesOf<M extends AnyMachine> = Phantom<M>["types"]
export type MachinePropsOf<M extends AnyMachine> = TypesOf<M>["props"]
export type EventOf<M extends AnyMachine> = TypesOf<M>["events"]
export type EnvOf<M extends AnyMachine> = TypesOf<M>["env"]
export type ComputedOf<M extends AnyMachine> = Phantom<M>["computed"]

export interface Snapshot<T extends Types = Types, S extends string = string> {
  readonly state: S
  readonly context: Readonly<ContextOf<T>>
  /** Uncontrolled values, by key. Controlled values live in props. */
  readonly internal: Readonly<Record<string, unknown>>
  /**
   * Internal but observable: controlled values proposed to the parent and not yet
   * applied. Changing it makes adapters re-render, so `setProps` can emit `$reverted`.
   */
  readonly proposed: Readonly<Record<string, unknown>>
}

export interface BaseView<T extends Types = Types, S extends string = string>
  extends Snapshot<T, S> {
  readonly values: ValuesOf<T>
  matches(...states: S[]): boolean
  hasTag(tag: string): boolean
}

export interface View<T extends Types = Types, S extends string = string, CP = unknown>
  extends BaseView<T, S> {
  readonly computed: Readonly<CP>
}

/** One processed transition, as seen by `inspect`. */
export interface Step<S extends string = string, E extends EventObject = EventObject> {
  readonly event: E | SystemEvent
  readonly source: S
  /** `null` for internal transitions (actions only). */
  readonly target: S | null
  readonly actions: readonly string[]
}

export interface Service<M extends AnyMachine> {
  /** Same reference until something in it changed. */
  getSnapshot(): Snapshot<TypesOf<M>, StateOf<M>>
  /** Notified once per outer `send` / `setProps`, after every queued event ran. */
  subscribe(listener: () => void): () => void
  /** Synchronous run-to-completion; re-entrant sends are queued. */
  send(event: EventOf<M>): void
  /** Diff against the previous props: `$sync`, `$reverted`, `onProps` events. */
  setProps(props: MachinePropsOf<M>): void
  /** Snapshot plus resolved values and memoised computed values. */
  view(props?: MachinePropsOf<M>): View<TypesOf<M>, StateOf<M>, ComputedOf<M>>
  /** Idempotent. Activates effects and delays of the current state. */
  start(): void
  /** Idempotent. Runs every cleanup, cancels delays, revokes `send`. */
  stop(): void
  inspect(listener: (step: Step<StateOf<M>, EventOf<M>>) => void): () => void
  readonly machine: M
}
