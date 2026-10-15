import type { QuirksAffecting } from "../dom/quirks"
import type { AnyMachine, EventOf, MachinePropsOf, StateOf, View } from "../machine/types"
import type { By, Env, Modality } from "./env"
import type { GenericInvariantId } from "./invariant-ids"

/** Which generic invariants apply (see openspec model-based-testing). */
export type Trait =
  | "disclosure"
  | "layer"
  | "restores-focus"
  /** A modal layer (implies `layer` and `restores-focus`): outside inert, focus in, scroll locked. */
  | "modal"
  /** Content that animates out: data-state="closed" until removed, removed after its exit. */
  | "presence"
  | "composite-roving"
  | "composite-activedescendant"
  | "selectable"
  | "set-metadata"
  | "valued"
  | "live-region"
  | "timed"
  | "directional"

/** One modality's implementation of an action. */
export type ActionImpl<P extends string> = (env: Env<P>, ...args: never) => Promise<unknown>

type QueryFn<P extends string> = (env: Env<P>) => Promise<unknown>

/** Expected query results, by query name. */
export type Observations<Q> = {
  readonly [K in keyof Q]?: Q[K] extends (env: never) => Promise<infer R> ? R : never
}

/**
 * A postcondition: expected observations, or a predicate over the environment and the
 * action's arguments. Polled until it holds.
 */
export type Done<P extends string, Q> =
  | Observations<Q>
  | ((env: Env<P>, ...args: never) => Promise<boolean>)

interface Pointerish<P extends string> {
  readonly pointer?: ActionImpl<P>
  readonly touch?: ActionImpl<P>
}

/**
 * An action, per modality. Every action with a pointer or touch implementation also
 * declares a keyboard implementation, or `none.keyboard` with the reason there is none.
 * `virtual` is derived from `pointer`.
 */
export type ActionDef<P extends string, Q> = Pointerish<P> & {
  readonly done: Done<P, Q>
} & (
    | { readonly keyboard: ActionImpl<P>; readonly none?: never }
    | { readonly keyboard?: never; readonly none: { readonly keyboard: string } }
  )

/** An event deliberately not exercised; the reason is shown in the coverage report. */
export interface Skip {
  readonly skip: string
}

/** Maps an event to the action producing it, with the arguments taken from the oracle. */
export type EventMapping<A> =
  | Skip
  | Extract<keyof A, string>
  | {
      readonly [K in Extract<keyof A, string>]: {
        readonly action: K
        /** Default: none (an action without arguments). */
        readonly args?: (view: View) => ActionArgsOf<A[K]>
        /**
         * The event's payload as the oracle receives it (`{ move: "next" }` for NAVIGATE),
         * from the view before the step; the action produces the same event in the page.
         */
        readonly event?: (view: View) => Readonly<Record<string, unknown>>
      }
    }[Extract<keyof A, string>]

/**
 * One event produced differently per source state (`from`): e.g. a trigger's TOGGLE opens a
 * layer by a click but cannot close a modal one (the trigger is inert then): skip only there.
 * A state left out is unmapped.
 */
export interface ByState<A, S extends string> {
  readonly from: { readonly [K in S]?: EventMapping<A> }
}

/**
 * What one part must show: a value, or a function of the oracle's view and the element's
 * attributes (for items whose state depends on which item they are, e.g. the active tab).
 */
export type PartExpectation<T> = T | ((view: View, attrs: Readonly<Record<string, string>>) => T)

/** A prop step: the props a re-render applies to take a `$sync` / `$props` edge. */
export interface PropStep<Props, S extends string> {
  readonly props: (target: S) => Partial<Props>
}

/** The arguments an action takes after `env`. */
export type ActionArgsOf<A> = A extends {
  readonly pointer: (env: never, ...args: infer R) => unknown
}
  ? R
  : A extends { readonly keyboard: (env: never, ...args: infer R) => unknown }
    ? R
    : A extends { readonly touch: (env: never, ...args: infer R) => unknown }
      ? R
      : []

/** The modalities an action can run in (`virtual` whenever it has `pointer`). */
export type ModalitiesOf<A> =
  | Extract<keyof A, "pointer" | "keyboard" | "touch">
  | (A extends { readonly pointer: unknown } ? "virtual" : never)

/** Context an invariant runs with after each step. */
export interface InvariantContext<P extends string = string, S extends string = string> {
  readonly env: Env<P>
  /** The oracle's state after the step. */
  readonly state: S
  readonly modality: Modality
}
/** Resolves when the invariant holds; rejects or returns a message when it does not. */
export type Invariant<P extends string = string, S extends string = string> = {
  readonly name: string
  readonly check: (ctx: InvariantContext<P, S>) => Promise<string | undefined>
}

/** The roles some parts play, for generic invariants. */
export interface Semantics<P extends string> {
  /** Toggles the content; carries `aria-expanded` (traits `disclosure`, `restores-focus`). */
  readonly trigger?: P
  /** Shown when open (trait `disclosure`). */
  readonly content?: P
  /** Visible label or title whose text the accessible name must contain. */
  readonly label?: P
  /** Where focus goes after closing, when not the trigger (trait `restores-focus`). */
  readonly finalFocus?: P
}

export interface ContractDef<
  M extends AnyMachine,
  P extends string,
  L extends readonly unknown[],
  Q extends Readonly<Record<string, QueryFn<P>>>,
  A extends Readonly<Record<string, ActionDef<P, NoInfer<Q>>>>,
> {
  readonly machine: M
  readonly anatomy: readonly P[]
  /** The anchor: role + exact accessible name of an element of the instance. */
  readonly locate: (...args: L) => By
  readonly queries: Q
  readonly actions: A
  /** What must be observable in each machine state. */
  readonly states: { readonly [S in StateOf<M>]: Observations<NoInfer<Q>> }
  /**
   * `data-state` per machine state: one value for every part, or values per part. Parts
   * named `item` carry their own state and are never checked against it.
   */
  readonly dataState?: {
    readonly [S in StateOf<M>]: string | { readonly [K in NoInfer<P>]?: PartExpectation<string> }
  }
  /**
   * ARIA state attributes each part must carry per machine state (`null`: absent). Item
   * parts usually need a function of the oracle's view and the item's own attributes.
   */
  readonly attrs?: {
    readonly [S in StateOf<M>]?: {
      readonly [K in NoInfer<P>]?: PartExpectation<Readonly<Record<string, string | null>>>
    }
  }
  /**
   * Machine event → the action that produces it; `$sync:<value>` / `$props:<prop>` edges →
   * the props a re-render applies (the target state is passed in). Unmapped events and
   * prop edges are reported as uncovered and fail the coverage test.
   */
  readonly events: {
    readonly [E in EventOf<M>["type"]]?: EventMapping<NoInfer<A>> | ByState<NoInfer<A>, StateOf<M>>
  } & {
    readonly [E in `$sync:${string}` | `$props:${string}`]?:
      | Skip
      | PropStep<MachinePropsOf<M>, StateOf<M>>
  }
  readonly traits: readonly Trait[]
  readonly semantics?: Semantics<NoInfer<P>>
  /** Always checked for this contract, on top of the generic invariants. */
  readonly invariants?: readonly Invariant<NoInfer<P>, StateOf<M>>[]
  /**
   * Expected announcements (required with `composite-activedescendant`): functions from the
   * observed state (the queries' results) to the message, for drivers and the
   * announcement-parity invariant.
   */
  readonly announcements?: Announcements<NoInfer<Q>>
  /** Parts whose programmatic focus may change state in the given states (e.g. a tooltip opens). */
  readonly commitsOnFocus?: readonly { readonly part: NoInfer<P>; readonly state: StateOf<M> }[]
  /**
   * Invariant exceptions, only through a quirk entry that lists the invariant; the runner
   * skips that invariant for that part while the quirk applies, and reports it.
   */
  readonly exceptions?: readonly Exception<NoInfer<P>>[]
}

export interface Announcements<Q> {
  readonly focusAnnouncement: (observed: Observations<Q>) => string
  readonly countAnnouncement: (observed: Observations<Q>) => string
  readonly selectionAnnouncement: (observed: Observations<Q>) => string
  /**
   * Entering a section (its label and option count), announced where VoiceOver is silent on
   * section changes (quirk vo-section-entry); checked when declared.
   */
  readonly sectionAnnouncement?: (observed: Observations<Q>) => string
}

/** One exception: the quirk must list the invariant (QuirksAffecting). */
export type Exception<P extends string> = {
  readonly [I in GenericInvariantId]: {
    readonly part: P
    readonly invariant: I
    readonly quirk: QuirksAffecting<I>
  }
}[GenericInvariantId]

export interface Contract<
  M extends AnyMachine = AnyMachine,
  P extends string = string,
  L extends readonly unknown[] = readonly unknown[],
  Q extends Readonly<Record<string, QueryFn<P>>> = Readonly<Record<string, QueryFn<P>>>,
  A extends Readonly<Record<string, ActionDef<P, Q>>> = Readonly<Record<string, ActionDef<P, Q>>>,
> extends ContractDef<M, P, L, Q, A> {
  readonly scope: string
}

/** Any contract, for code that accepts every contract. */
export interface AnyContract {
  readonly scope: string
  readonly machine: AnyMachine
  readonly anatomy: readonly string[]
  readonly locate: (...args: never) => By
  readonly queries: Readonly<Record<string, (env: never) => Promise<unknown>>>
  readonly actions: Readonly<Record<string, object>>
  readonly states: Readonly<Record<string, object>>
  readonly dataState?: Readonly<Record<string, string | Readonly<Record<string, unknown>>>>
  readonly attrs?: Readonly<Record<string, Readonly<Record<string, unknown>> | undefined>>
  readonly events: Readonly<Record<string, unknown>>
  readonly traits: readonly Trait[]
  readonly semantics?: Semantics<string>
  readonly announcements?: Announcements<Readonly<Record<string, unknown>>>
  readonly commitsOnFocus?: readonly { readonly part: string; readonly state: string }[]
  readonly exceptions?: readonly {
    readonly part: string
    readonly invariant: GenericInvariantId
    readonly quirk: string
  }[]
  readonly invariants?: readonly {
    readonly name: string
    readonly check: (ctx: never) => unknown
  }[]
}

/**
 * Declares a component's contract. Part, state, event and action names are checked
 * against the anatomy, the machine and the declared actions.
 */
type Modal = "pointer" | "keyboard" | "touch"

/**
 * Checks one action beyond its shape: only known keys (a misspelled `pointr` would bypass
 * the keyboard-twin rule), at least one implementation, a non-empty reason in `none`, and
 * one argument list shared by every implementation and by `done`.
 */
export type CheckedAction<P extends string, X> = [Extract<keyof X, Modal>] extends [never]
  ? "an action needs a pointer, keyboard or touch implementation"
  : {
      readonly [K in keyof X]: K extends Modal
        ? (env: Env<P>, ...args: ActionArgsOf<X>) => Promise<unknown>
        : K extends "done"
          ? X[K] extends (...args: never) => unknown
            ? (env: Env<P>, ...args: ActionArgsOf<X>) => Promise<boolean>
            : X[K]
          : K extends "none"
            ? X[K] extends { readonly keyboard: "" }
              ? { readonly keyboard: "state why there is no keyboard implementation" }
              : X[K]
            : never
    }

export function contract<
  const M extends AnyMachine,
  const P extends string,
  const L extends readonly unknown[],
  const Q extends Readonly<Record<string, QueryFn<P>>>,
  const A extends Readonly<Record<string, ActionDef<P, NoInfer<Q>>>>,
  const T extends readonly Trait[],
>(
  scope: string,
  def: ContractDef<M, P, L, Q, A> & {
    readonly actions: { readonly [K in keyof A]: CheckedAction<P, A[K]> }
    readonly traits: T
  } & ([Trait] extends [T[number]]
      ? unknown // traits widened (e.g. spread from another contract): nothing to decide
      : "composite-activedescendant" extends T[number]
        ? { readonly announcements: Announcements<NoInfer<Q>> }
        : unknown),
): Contract<M, P, L, Q, A> {
  return { scope, ...def }
}
