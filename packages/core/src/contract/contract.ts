import type { QuirksAffecting } from "../dom/quirk-meta"
import { setup, type } from "../machine/setup"
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
  /** An anchored popup (positioner part): placed before focus, and laid out next to its anchor. */
  | "anchored"
  | "composite-roving"
  | "composite-activedescendant"
  | "selectable"
  | "set-metadata"
  | "valued"
  | "live-region"
  | "timed"
  | "directional"
  /** A form control: inside a Field, it follows the Field (field-control trait). */
  | "field-associated"
  /** Takes part in forms through a hidden native input (hidden-form-input). */
  | "form-associated"

/** One modality's implementation of an action. */
export type ActionImpl<P extends string> = (env: Env<P>, ...args: never) => Promise<unknown>

/** A query; one with arguments (`isDisabled(label)`) is read by drivers, not by snapshots. */
type QueryFn<P extends string> = (env: Env<P>, ...args: never) => Promise<unknown>

/** The arguments a query takes after `env`. */
export type QueryArgsOf<Q> = Q extends (env: never, ...args: infer R) => unknown ? R : never

/** Expected query results, by query name. */
export type Observations<Q> = {
  readonly [K in keyof Q]?: Q[K] extends (env: never, ...args: never) => Promise<infer R>
    ? R
    : never
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
 * `none.touch` says why a pointer action has no touch form (hover). `virtual` is derived
 * from `pointer`.
 */
export type ActionDef<P extends string, Q> = Pointerish<P> & {
  readonly done: Done<P, Q>
} & (
    | { readonly keyboard: ActionImpl<P>; readonly none?: never }
    | { readonly keyboard: ActionImpl<P>; readonly none: { readonly touch: string } }
    | {
        readonly keyboard?: never
        readonly none: { readonly keyboard: string; readonly touch?: string }
      }
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
  /** The props the instance was rendered with (the oracle's), for mode-dependent rules. */
  readonly props: Readonly<Record<string, unknown>>
  /** The oracle's resolved values after the step (a selection to compare the page with). */
  readonly values: Readonly<Record<string, unknown>>
  /** The oracle's context after the step (what the page should show but not expose). */
  readonly context?: Readonly<Record<string, unknown>> | undefined
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
  /**
   * The composite's item: the part that rovingly takes focus and carries the selection
   * (traits `composite-*`, `selectable`, `set-metadata`). Default `item`; a Radio Group's
   * is `item-control` (its `item` is a wrapper).
   */
  readonly item?: P
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
  /**
   * Rendered as another component's part (a Slider inside a Color Picker): the `data-part` each
   * anatomy part carries under the host's scope. The adapters locate parts through it; absent,
   * a part's `data-part` is its anatomy name.
   */
  readonly partName?: ((part: P) => string) | undefined
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
   * the props a re-render applies (the target state is passed in). A machine event the
   * parent's props drive (an internal routing event after a prop change) takes props too.
   * Unmapped events and prop edges are reported as uncovered and fail the coverage test.
   */
  readonly events: {
    readonly [E in EventOf<M>["type"]]?:
      | EventMapping<NoInfer<A>>
      | ByState<NoInfer<A>, StateOf<M>>
      | PropStep<MachinePropsOf<M>, StateOf<M>>
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
   * States in which the whole component is unmounted (a dismissed Alert, a Toast after it
   * left): the runner expects no element to match the anchor there and skips the part-based
   * invariants and the state's queries. Omitted: the component is always mounted.
   */
  readonly absentIn?: readonly StateOf<M>[]
  /**
   * Invariant exceptions, only through a quirk entry that lists the invariant; the runner
   * skips that invariant for that part while the quirk applies, and reports it.
   */
  readonly exceptions?: readonly Exception<NoInfer<P>>[]
  /** The `form-associated` trait: what the hidden input must hold, and silent events. */
  readonly formInput?: FormInputDecl
  /** The `valued` trait's expectations (model-based-testing "Valued Trait Expectations"). */
  readonly valued?: ValuedDecl
}

/**
 * Expected values of a `valued` contract, matched in DOM order to the elements carrying
 * `aria-valuenow` or a valued role (one per thumb); `null`: no value (indeterminate).
 */
export interface ValuedDecl {
  /** `props`: the oracle's props (a range or a formatter the view does not carry). */
  readonly values: (
    view: View,
    props: Readonly<Record<string, unknown>>,
  ) => readonly (number | null)[]
  /**
   * Each element's expected `aria-valuetext` (also for a `null` entry, e.g. "Empty");
   * otherwise only a plain `String(value)` is compared.
   */
  readonly valueText?: (
    view: View,
    index: number,
    props: Readonly<Record<string, unknown>>,
  ) => string
}

/**
 * A form-associated contract's hidden input (hidden-form-input "Form-Associated Trait"):
 * the DOM properties it must hold for the oracle's values, and the events that change the
 * value without the user (dispatching no `change`, e.g. a form reset).
 */
export interface FormInputDecl {
  /**
   * The controllable values the form carries (default: all of them). A step changing only
   * another value (a select's `open`) is no user change of the form's value.
   */
  readonly values?: readonly string[]
  /** One hidden input per item (a group): each is compared, and their events summed. */
  readonly multiple?: boolean
  /**
   * The inputs are themselves the accessible controls (hidden-form-input "Accessible Native
   * Input", Slider thumbs): exempt from the aria-hidden, tabIndex and never-focused checks.
   */
  readonly accessible?: boolean
  readonly expected: (
    values: Readonly<Record<string, unknown>>,
    /** The input compared (its submitted `value` and its position among the inputs). */
    input?: { readonly value: string; readonly index: number },
  ) => {
    readonly checked?: boolean
    readonly indeterminate?: boolean
    readonly value?: string
  }
  readonly silentEvents?: readonly string[]
  /**
   * Events whose action makes the browser dispatch one `change` itself (assistive technology
   * adjusting an accessible native input): one change each, whether or not the value changes.
   */
  readonly nativeEvents?: readonly string[]
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
  readonly partName?: ((part: never) => string) | undefined
  readonly locate: (...args: never) => By
  readonly queries: Readonly<Record<string, (env: never, ...args: never) => Promise<unknown>>>
  readonly actions: Readonly<Record<string, object>>
  readonly states: Readonly<Record<string, object>>
  readonly dataState?: Readonly<Record<string, string | Readonly<Record<string, unknown>>>>
  readonly attrs?: Readonly<Record<string, Readonly<Record<string, unknown>> | undefined>>
  readonly events: Readonly<Record<string, unknown>>
  readonly traits: readonly Trait[]
  readonly semantics?: Semantics<string>
  readonly announcements?: Announcements<Readonly<Record<string, unknown>>>
  readonly commitsOnFocus?: readonly { readonly part: string; readonly state: string }[]
  readonly absentIn?: readonly string[]
  readonly exceptions?: readonly {
    readonly part: string
    readonly invariant: GenericInvariantId
    readonly quirk: string
  }[]
  readonly invariants?: readonly {
    readonly name: string
    readonly check: (ctx: never) => unknown
  }[]
  readonly formInput?: FormInputDecl
  readonly valued?: ValuedDecl
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

/* @__NO_SIDE_EFFECTS__ */
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
  // The scope given wins over one spread in from another contract (a hosted contract).
  return { ...def, scope }
}

/** The one-state machine behind every stateless component's contract (Link, Separator). */
export const STATIC_MACHINE = /* @__PURE__ */ setup({
  types: type<{
    props: Record<never, never>
    events: { type: "$none" }
    env: Record<never, never>
  }>(),
}).machine({
  id: "static",
  initial: "static",
  states: { static: {} },
})
type StaticMachine = typeof STATIC_MACHINE

/**
 * A stateless component's contract: no machine, no states and no events (design: Link has
 * no machine). It carries the one-state STATIC_MACHINE, so every tool reading contracts
 * keeps one shape; there is no model-based test to run on it.
 */
/* @__NO_SIDE_EFFECTS__ */
export function staticContract<
  const P extends string,
  const L extends readonly unknown[],
  const Q extends Readonly<Record<string, QueryFn<P>>>,
  const A extends Readonly<Record<string, ActionDef<P, NoInfer<Q>>>>,
  const T extends readonly Trait[],
>(
  scope: string,
  def: Omit<
    ContractDef<StaticMachine, P, L, Q, A>,
    "machine" | "states" | "events" | "dataState" | "attrs" | "commitsOnFocus" | "absentIn"
  > & {
    readonly actions: { readonly [K in keyof A]: CheckedAction<P, A[K]> }
    readonly traits: T
  },
): Contract<StaticMachine, P, L, Q, A> {
  return { ...def, scope, machine: STATIC_MACHINE, states: { static: {} }, events: {} }
}
