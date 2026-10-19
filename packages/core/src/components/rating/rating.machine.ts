// Rating (design "Machine"): one value in [0, count] on a grid of whole or half stars, 0 meaning
// "no rating". States `idle` and `previewing` (a pointer hovering the stars shows a preview
// that never changes the value). Pointer events carry the star index and the pointer's
// fraction across it, so every transition runs in Node with numbers.

import type { BlurEvent, FocusEvent } from "../../a11y/events"
import type { Modality } from "../../contract/env"
import { setup, type } from "../../machine/setup"
import type { ActionArgs, ChangeDetails } from "../../machine/types"

/** The value keys of `keyboard-interactions` the Rating handles. */
export type RatingKey = "INCREASE" | "DECREASE" | "PAGE_PREV" | "PAGE_NEXT" | "FIRST" | "LAST"

export type RatingEvent =
  /** A pointer (never touch) over star `index` (1-based), `fraction` across it in reading order. */
  | { readonly type: "POINTER.MOVE"; readonly index: number; readonly fraction: number }
  /** The pointer left the stars, or the Rating stopped accepting changes. */
  | { readonly type: "POINTER.LEAVE" }
  /** A click or tap on star `index` (activation on release). */
  | {
      readonly type: "PRESS"
      readonly index: number
      readonly fraction: number
      readonly modality: Modality
    }
  | { readonly type: RatingKey; readonly modality: Modality }
  /** A native change to the range input we did not make (assistive technology). */
  | { readonly type: "INPUT.CHANGE"; readonly value: number }
  /** The form's reset: restores the current `defaultValue` prop. */
  | { readonly type: "RESET" }
  /** The controlled `value` prop changed (onProps). */
  | { readonly type: "VALUE.SYNCED" }
  | FocusEvent
  | BlurEvent

export interface RatingMachineProps {
  readonly value?: number | undefined
  /** Read at creation; later changes only change what a form reset restores. */
  readonly defaultValue?: number | undefined
  readonly onValueChange?:
    | ((value: number, details: ChangeDetails<RatingEvent>) => void)
    | undefined
  /** The number of stars (default 5). */
  readonly count?: number | undefined
  /** Half stars: every change moves on a grid of 0.5. */
  readonly allowHalf?: boolean | undefined
  /** The user can go back to 0: pressing the current value, or the keys below the first star. */
  readonly allowClear?: boolean | undefined
  readonly disabled?: boolean | undefined
  readonly readOnly?: boolean | undefined
}

/** The range input and the form carrier, written as properties; `dispatch` fires input + change. */
export interface RatingInputsCapability {
  sync(value: number, dispatch: boolean): void
}

export interface RatingEnv {
  /** Absent where there is no DOM (a model test's oracle). */
  readonly inputs?: RatingInputsCapability | undefined
  /** Focuses the range input with the given modality (pointer: no ring). */
  readonly focusInput?: ((modality: Modality) => void) | undefined
}

export interface RatingContext {
  /** The previewed value while a pointer hovers the stars; null otherwise. */
  preview: number | null
  focused: boolean
  /**
   * A controlled proposal not yet applied: when it arrives, the inputs fire input/change if
   * `dispatch` (a refused change does neither).
   */
  pending: { readonly value: number; readonly dispatch: boolean } | null
}

/** The resolved count and step. */
export interface RatingRange {
  readonly count: number
  readonly step: 0.5 | 1
  /** The lowest value a user change may reach: 0 when allowClear, else one step. */
  readonly floor: number
}

export function ratingRange(props: RatingMachineProps): RatingRange {
  const raw = props.count ?? 5
  const count = Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 5
  const step = props.allowHalf === true ? 0.5 : 1
  return { count, step, floor: props.allowClear === true ? 0 : step }
}

/** A value on the grid: clamped to [0, count], rounded to the nearest step (0 stays 0). */
export function normalizeRating(value: number | undefined, range: RatingRange): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) return 0
  const snapped = Math.round(value / range.step) * range.step
  return Math.min(range.count, snapped)
}

/** The value a pointer at `fraction` across star `index` points at. */
export function ratingAt(index: number, fraction: number, range: RatingRange): number {
  const i = Math.min(range.count, Math.max(1, Math.round(index)))
  return range.step === 0.5 && fraction < 0.5 ? i - 0.5 : i
}

/** The value a key moves to from `value`. */
export function ratingKeyTarget(key: RatingKey, value: number, range: RatingRange): number {
  // Below the floor only by the allowClear path; an unrated Rating stays unrated going down.
  const low = Math.min(value, range.floor)
  const down = (by: number) => Math.max(low, value - by)
  const up = (by: number) => Math.min(range.count, Math.max(range.floor, value + by))
  switch (key) {
    case "INCREASE":
      return up(range.step)
    case "DECREASE":
      return down(range.step)
    // PageUp / PageDown: a whole star.
    case "PAGE_PREV":
      return up(1)
    case "PAGE_NEXT":
      return down(1)
    case "FIRST":
      return range.floor
    case "LAST":
      return range.count
    default: {
      const never: never = key
      return never
    }
  }
}

type Args = ActionArgs<{
  props: RatingMachineProps
  events: RatingEvent
  env: RatingEnv
  context: RatingContext
  values: "value"
}>

/** The current value, normalised for rendering (the runtime's fallback is the default). */
export function resolveRating(props: RatingMachineProps, value: number | undefined) {
  const range = ratingRange(props)
  return { range, value: normalizeRating(value ?? props.defaultValue, range) }
}

const controlled = (props: RatingMachineProps) => props.value !== undefined
/** The latest value: an unanswered controlled proposal, else the value. */
const latest = (args: Args) =>
  args.context.pending?.value ?? resolveRating(args.props, args.values.value).value

/**
 * The one write: proposes `next`; uncontrolled, an accepted value is mirrored on the inputs
 * now (dispatching for user changes); controlled, the mirroring waits for the prop.
 */
function write(args: Args, next: number, user: boolean) {
  const { props, set, env } = args
  if (latest(args) === next) return
  set("value", next)
  if (controlled(props)) {
    set("pending", { value: next, dispatch: user })
    return
  }
  const after = resolveRating(props, args.values.value).value
  // Refused through details.cancel(): nothing changed.
  if (after !== next) return
  env.inputs?.sync(after, user)
}

const KEYS = ["INCREASE", "DECREASE", "PAGE_PREV", "PAGE_NEXT", "FIRST", "LAST"] as const
const isKey = (t: string): t is RatingKey => (KEYS as readonly string[]).includes(t)
const keyTransition = { guard: "canChange", target: "idle", actions: ["stepKey"] } as const

export const ratingMachine = setup({
  types: type<{
    props: RatingMachineProps
    events: RatingEvent
    env: RatingEnv
    context: RatingContext
    values: "value"
  }>(),
  guards: {
    canChange: ({ props }) => props.disabled !== true && props.readOnly !== true,
    canChangeByPointer: ({ props, event }) =>
      props.disabled !== true &&
      props.readOnly !== true &&
      event.type === "PRESS" &&
      event.modality === "pointer",
  },
  actions: {
    setPreview: ({ event, props, set }) => {
      if (event.type !== "POINTER.MOVE" && event.type !== "PRESS") return
      set("preview", ratingAt(event.index, event.fraction, ratingRange(props)))
    },
    clearPreview: ({ set }) => set("preview", null),
    /** A press sets its value; pressing the current value clears it when allowClear. */
    setFromPress: (args) => {
      const { event, props } = args
      if (event.type !== "PRESS") return
      const range = ratingRange(props)
      const target = ratingAt(event.index, event.fraction, range)
      const next = props.allowClear === true && target === latest(args) ? 0 : target
      write(args, next, true)
    },
    /** Focus follows a press to the range input: keys work next, with no ring for a pointer. */
    focusPressed: ({ event, env }) => {
      if (event.type !== "PRESS") return
      env.focusInput?.(event.modality === "keyboard" ? "keyboard" : "pointer")
    },
    stepKey: (args) => {
      const { event, props } = args
      if (!isKey(event.type)) return
      write(args, ratingKeyTarget(event.type, latest(args), ratingRange(props)), true)
    },
    /** Adopts an assistive-technology change on the grid; below the floor is refused. */
    setFromInput: (args) => {
      const { event, env, props } = args
      if (event.type !== "INPUT.CHANGE") return
      const range = ratingRange(props)
      const next = normalizeRating(event.value, range)
      const now = latest(args)
      // A user change of the form value: the carrier dispatches (the range input already did).
      if (next >= range.floor || next === now) write(args, next, true)
      // Snapped, refused or unchanged: the inputs show the Rating's value again.
      env.inputs?.sync(latest(args), false)
    },
    resyncInputs: (args) => args.env.inputs?.sync(latest(args), false),
    restoreDefault: (args) => {
      write(args, normalizeRating(args.props.defaultValue, ratingRange(args.props)), false)
    },
    /** The controlled value arrived: the pending proposal's events run now. */
    applySynced: (args) => {
      const { context, env, props, set, values } = args
      const pending = context.pending
      const value = resolveRating(props, values.value).value
      set("pending", null)
      env.inputs?.sync(value, pending !== null && pending.value === value && pending.dispatch)
    },
    /** A refused proposal: forget it, and put the inputs back. */
    revert: (args) => {
      args.set("pending", null)
      args.env.inputs?.sync(resolveRating(args.props, args.values.value).value, false)
    },
    setFocused: ({ set }) => set("focused", true),
    clearFocused: ({ set }) => set("focused", false),
  },
}).machine({
  id: "rating",
  initial: "idle",
  context: () => ({ preview: null, focused: false, pending: null }),
  values: { value: { fallback: 0 } },
  onProps: { value: "VALUE.SYNCED", disabled: "POINTER.LEAVE", readOnly: "POINTER.LEAVE" },
  on: {
    // A mouse or pen press leaves the pointer over the stars: they preview what it points at.
    // A tap or a bare click does not hover.
    PRESS: [
      {
        guard: "canChangeByPointer",
        target: "previewing",
        actions: ["setFromPress", "setPreview", "focusPressed"],
      },
      { guard: "canChange", target: "idle", actions: ["setFromPress", "focusPressed"] },
      // Read-only: the press still focuses (the value can be read and copied, not changed).
      { target: "idle", actions: ["focusPressed"] },
    ],
    INCREASE: keyTransition,
    DECREASE: keyTransition,
    PAGE_PREV: keyTransition,
    PAGE_NEXT: keyTransition,
    FIRST: keyTransition,
    LAST: keyTransition,
    // Any change that is not the pointer's ends a preview, so the stars show the value.
    "INPUT.CHANGE": [
      { guard: "canChange", target: "idle", actions: ["setFromInput"] },
      { target: "idle", actions: ["resyncInputs"] },
    ],
    RESET: { target: "idle", actions: ["restoreDefault"] },
    "VALUE.SYNCED": { actions: ["applySynced"] },
    $reverted: { actions: ["revert"] },
    FOCUS: { actions: ["setFocused"] },
    BLUR: { actions: ["clearFocused"] },
  },
  states: {
    idle: {
      on: {
        "POINTER.MOVE": { guard: "canChange", target: "previewing", actions: ["setPreview"] },
      },
    },
    previewing: {
      exit: ["clearPreview"],
      on: {
        "POINTER.MOVE": [{ guard: "canChange", actions: ["setPreview"] }, { target: "idle" }],
        "POINTER.LEAVE": "idle",
      },
    },
  },
})

export type RatingMachine = typeof ratingMachine

/** Whether a logical key event type is one the Rating handles. */
export const isRatingKey = isKey
