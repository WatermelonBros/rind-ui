// Slider (design §2): `idle` and `dragging`, one controllable `value` (always an array here;
// the adapter converts the consumer's shape), and one write path (`settle`). Pointer events
// carry fractions measured by `pointer-drag`, so every transition runs in Node with numbers.
// Focus is context: no transition depends on it.

import type { BlurEvent, FocusEvent } from "../../a11y/events"
import type { Modality } from "../../contract/env"
import type { DragMessage, PointerDragCapability } from "../../dom/pointer-drag"
import { setup, type } from "../../machine/setup"
import type { ActionArgs, ChangeDetails } from "../../machine/types"
import {
  keyTarget,
  normalizeValues,
  pickThumb,
  type SliderRange,
  sameNumbers,
  settle,
  sliderRange,
  stackOf,
  stackPick,
  type ThumbCollision,
  valueAt,
} from "./slider.math"

/** The value keys of `keyboard-interactions` a thumb handles. */
export type SliderKey = "INCREASE" | "DECREASE" | "PAGE_PREV" | "PAGE_NEXT" | "FIRST" | "LAST"

export type SliderEvent =
  /** A press on the Control: `thumb` when it landed inside a Thumb, `fraction` null without layout. */
  | {
      readonly type: "POINTER.DOWN"
      readonly fraction: number | null
      readonly thumb: number | null
      readonly modality: Modality
    }
  | { readonly type: "POINTER.MOVE"; readonly fraction: number }
  | { readonly type: "POINTER.UP" }
  /** pointercancel, lost capture, a hidden document, Escape, or disabled mid-drag. */
  | { readonly type: "DRAG.CANCEL" }
  | {
      readonly type: SliderKey
      readonly thumb: number
      /** Shift: `largeStep` for the arrow keys. */
      readonly shift: boolean
      readonly modality: Modality
    }
  /** A native change to a thumb input we did not make (assistive technology). */
  | { readonly type: "INPUT.CHANGE"; readonly thumb: number; readonly value: number }
  /** The form's reset: restores the current `defaultValue` prop. */
  | { readonly type: "RESET" }
  /** The controlled `value` prop changed (onProps). */
  | { readonly type: "VALUE.SYNCED" }
  | (FocusEvent & { readonly thumb: number })
  | (BlurEvent & { readonly thumb: number })

export type SliderReason =
  | SliderEvent["type"]
  | "$reverted"
  | "$sync"
  | "$start"
  | `after:${string}`

export interface SliderCommitDetails {
  /** The event that ended the interaction (`POINTER.UP`, a key, `INPUT.CHANGE`). */
  readonly reason: SliderReason
}

export interface SliderMachineProps {
  readonly value?: readonly number[] | undefined
  /** Read at creation; later changes only change what a form reset restores. */
  readonly defaultValue?: readonly number[] | undefined
  readonly onValueChange?:
    | ((value: readonly number[], details: ChangeDetails<SliderEvent>) => void)
    | undefined
  readonly onValueCommit?:
    | ((value: readonly number[], details: SliderCommitDetails) => void)
    | undefined
  readonly min?: number | undefined
  readonly max?: number | undefined
  readonly step?: number | undefined
  readonly largeStep?: number | undefined
  readonly minStepsBetweenThumbs?: number | undefined
  readonly thumbCollision?: ThumbCollision | undefined
  readonly disabled?: boolean | undefined
  readonly readOnly?: boolean | undefined
  /** Per-thumb `disabled`, by index. */
  readonly thumbDisabled?: readonly boolean[] | undefined
}

/** The thumb inputs, written as properties; `dispatch[i]` fires input + change on input i. */
export interface SliderInputsCapability {
  sync(values: readonly number[], dispatch: readonly boolean[]): void
}

export interface SliderEnv {
  /** Absent where there is no DOM (a model test's oracle). */
  readonly inputs?: SliderInputsCapability | undefined
  readonly drag?: PointerDragCapability | undefined
  /** Focuses a thumb input with the given modality (pointer: no ring). */
  readonly focusThumb?: ((index: number, modality: Modality) => void) | undefined
}

export interface SliderContext {
  /** The thumb whose input has focus. */
  focused: number | null
  /** The thumb used last (stacking order). */
  active: number | null
  /** The dragged thumb; null on a stack until the first move decides. */
  dragging: number | null
  /** A press on stacked thumbs: the candidates, decided by the first move's direction. */
  stacked: readonly number[] | null
  /** The values at the press, restored by a cancel. */
  start: readonly number[] | null
  /**
   * A controlled proposal not yet applied: when it arrives, the inputs flagged in `dispatch`
   * fire input/change and `commit` calls onValueCommit (a refused change does neither).
   */
  pending: {
    readonly value: readonly number[]
    readonly dispatch: readonly boolean[]
    readonly commit: SliderReason | null
  } | null
}

type Args = ActionArgs<{
  props: SliderMachineProps
  events: SliderEvent
  env: SliderEnv
  context: SliderContext
  values: "value"
}>

/** The resolved range and the current values, normalised for rendering. */
export function resolveSlider(props: SliderMachineProps, value: readonly number[] | undefined) {
  const range = sliderRange(props)
  // No value yet (the runtime's empty fallback): the default, then `min`.
  const given = value !== undefined && value.length > 0 ? value : props.defaultValue
  return { range, values: normalizeValues(given ?? [range.min], range) }
}

const current = ({ props, values }: Pick<Args, "props" | "values">) =>
  resolveSlider(props, values.value)

const thumbEnabled = (props: SliderMachineProps) => (i: number) =>
  props.disabled !== true && props.thumbDisabled?.[i] !== true

const controlled = (props: SliderMachineProps) => props.value !== undefined

/** Calls onValueCommit with the machine's latest value. */
function commit(props: SliderMachineProps, value: readonly number[], reason: SliderReason) {
  props.onValueCommit?.(value, { reason })
}

/**
 * The one write: proposes `next`; uncontrolled, an accepted value is mirrored on the inputs
 * (dispatching for user changes) and committed now; controlled, both wait for the prop.
 */
function write(
  args: Args,
  next: readonly number[],
  options: {
    readonly user: boolean
    readonly commit: SliderReason | null
    readonly dispatch?: boolean
  },
) {
  const { props, set, env } = args
  // What the inputs show: a pending proposal already counts (a native input + change pair,
  // a drag repeating a value while the parent re-renders: proposed once).
  const before = latest(args)
  if (sameNumbers(before, next)) return
  const user = options.user && options.dispatch !== false
  const dispatch = next.map((v, i) => user && v !== before[i])
  set("value", next)
  if (controlled(props)) {
    set("pending", { value: next, dispatch, commit: options.commit })
    return
  }
  const after = current(args).values
  // Refused through details.cancel(): nothing changed.
  if (!sameNumbers(after, next)) return
  env.inputs?.sync(after, dispatch)
  if (options.commit !== null) commit(props, after, options.commit)
}

/** The latest value of the machine: an unanswered controlled proposal, else the value. */
const latest = (args: Args) => args.context.pending?.value ?? current(args).values

function setFromFraction(args: Args, fraction: number, range: SliderRange) {
  const { context, props, set, env } = args
  const values = latest(args)
  const target = valueAt(fraction, range)
  let index = context.dragging
  if (index === null && context.stacked) {
    const at = values[context.stacked[0] ?? 0] ?? target
    const pick = stackPick(context.stacked, at, target)
    if (pick === "stack") return
    index = pick
    set("dragging", index)
    set("stacked", null)
    set("active", index)
  }
  if (index === null) return
  const settled = settle(values, index, target, range, props.thumbCollision ?? "stop")
  write(args, settled.values, { user: true, commit: null })
  if (settled.index !== index) {
    // A swap: the drag (and focus) follow the value to its new thumb (RX#730, RX#2247).
    set("dragging", settled.index)
    set("active", settled.index)
    env.focusThumb?.(settled.index, "pointer")
  }
}

const KEYS = ["INCREASE", "DECREASE", "PAGE_PREV", "PAGE_NEXT", "FIRST", "LAST"] as const
const isKey = (t: string): t is SliderKey => (KEYS as readonly string[]).includes(t)

export const sliderMachine = setup({
  types: type<{
    props: SliderMachineProps
    events: SliderEvent
    env: SliderEnv
    context: SliderContext
    values: "value"
  }>(),
  guards: {
    canInteract: ({ props }) => props.disabled !== true && props.readOnly !== true,
    /** The event's thumb exists, is enabled, and the Slider accepts changes. */
    canChangeThumb: ({ props, values, event }) => {
      if (props.disabled === true || props.readOnly === true) return false
      const thumb = "thumb" in event ? event.thumb : null
      return (
        typeof thumb === "number" &&
        thumb < resolveSlider(props, values.value).values.length &&
        props.thumbDisabled?.[thumb] !== true
      )
    },
  },
  actions: {
    /** The pressed thumb if enabled (a stack decides on the first move), else the nearest. */
    pickThumb: (args) => {
      const { event, props, set } = args
      if (event.type !== "POINTER.DOWN") return
      const { range, values } = current(args)
      const enabled = thumbEnabled(props)
      set("stacked", null)
      set("dragging", null)
      if (event.thumb !== null && enabled(event.thumb)) {
        const stack = stackOf(values, event.thumb, enabled)
        if (stack.length > 1) {
          set("stacked", stack)
          // Focus goes to the pressed one until the stack is decided.
          set("active", event.thumb)
          return
        }
        set("dragging", event.thumb)
        set("active", event.thumb)
        return
      }
      if (event.fraction === null) return
      const pick = pickThumb(values, valueAt(event.fraction, range), enabled)
      if (pick === null) return
      if (pick === "stack") {
        const at = valueAt(event.fraction, range)
        const stack = values.flatMap((v, i) => (v === at && enabled(i) ? [i] : []))
        set("stacked", stack)
        set("active", stack[stack.length - 1] ?? null)
        return
      }
      set("dragging", pick)
      set("active", pick)
    },
    recordStart: (args) => args.set("start", latest(args)),
    /** A press outside the thumbs moves the picked thumb to the press (reason POINTER.DOWN). */
    setFromPress: (args) => {
      const { event } = args
      if (event.type !== "POINTER.DOWN" || event.fraction === null) return
      // A press on an enabled thumb keeps its value; on a disabled one it is a track press.
      if (event.thumb !== null && thumbEnabled(args.props)(event.thumb)) return
      setFromFraction(args, event.fraction, current(args).range)
    },
    setFromPointer: (args) => {
      if (args.event.type !== "POINTER.MOVE") return
      setFromFraction(args, args.event.fraction, current(args).range)
    },
    focusPressed: ({ context, env, event }) => {
      const index = context.dragging ?? context.active
      if (index === null) return
      const modality = event.type === "POINTER.DOWN" ? event.modality : "pointer"
      // A touch press is still a pointer: no ring.
      env.focusThumb?.(
        index,
        modality === "keyboard" || modality === "virtual" ? modality : "pointer",
      )
    },
    /** A release whose values differ from the press commits once (BU#5772, KB#322). */
    commitIfChanged: (args) => {
      const { context, props, set } = args
      const start = context.start
      set("start", null)
      set("dragging", null)
      set("stacked", null)
      const value = latest(args)
      if (start === null || sameNumbers(start, value)) return
      if (context.pending) set("pending", { ...context.pending, commit: "POINTER.UP" })
      else commit(props, value, "POINTER.UP")
    },
    /** A cancelled drag restores the press values and commits nothing (BU#5637). */
    restoreStart: (args) => {
      const { context, set } = args
      const start = context.start
      set("dragging", null)
      set("stacked", null)
      set("start", null)
      if (start) write(args, start, { user: true, commit: null })
    },
    stepThumb: (args) => {
      const { event, set } = args
      if (!isKey(event.type) || !("thumb" in event) || !("shift" in event)) return
      const { range } = current(args)
      const values = latest(args)
      const target = keyTarget(event.type, values, event.thumb, range, event.shift)
      set("active", event.thumb)
      write(args, settle(values, event.thumb, target, range).values, {
        user: true,
        commit: event.type,
      })
    },
    /** Adopts an assistive-technology change, bounded like a key step; re-syncs the rest. */
    setFromInput: (args) => {
      const { event, env, set } = args
      if (event.type !== "INPUT.CHANGE") return
      const { range } = current(args)
      const values = latest(args)
      const next = settle(values, event.thumb, event.value, range).values
      set("active", event.thumb)
      // The native input already dispatched its own input and change.
      write(args, next, { user: true, commit: "INPUT.CHANGE", dispatch: false })
      // Snapped, bounded or refused: the input shows the Slider's value again.
      env.inputs?.sync(latest(args), [])
    },
    resyncInputs: (args) => args.env.inputs?.sync(latest(args), []),
    restoreDefault: (args) => {
      const { range } = current(args)
      write(args, normalizeValues(args.props.defaultValue ?? [range.min], range), {
        user: false,
        commit: null,
      })
    },
    /** The controlled value arrived: the pending proposal's events and commit run now. */
    applySynced: (args) => {
      const { context, env, props, set } = args
      const pending = context.pending
      const values = current(args).values
      if (pending === null || !sameNumbers(pending.value, values)) {
        env.inputs?.sync(values, [])
        return
      }
      set("pending", null)
      env.inputs?.sync(values, pending.dispatch)
      if (pending.commit !== null) commit(props, values, pending.commit)
    },
    /** A refused proposal: forget it (and its commit), and put the inputs back. */
    revert: (args) => {
      args.set("pending", null)
      args.env.inputs?.sync(current(args).values, [])
    },
    setFocused: ({ event, set }) => {
      if (event.type === "FOCUS") set("focused", event.thumb)
    },
    clearFocused: ({ event, context, set }) => {
      if (event.type === "BLUR" && context.focused === event.thumb) set("focused", null)
    },
  },
  effects: {
    trackDrag: ({ env, send }) =>
      env.drag?.track((m: DragMessage) => {
        if (m.type === "move") send({ type: "POINTER.MOVE", fraction: m.fraction })
        else if (m.type === "up") send({ type: "POINTER.UP" })
        else send({ type: "DRAG.CANCEL" })
      }),
  },
}).machine({
  id: "slider",
  initial: "idle",
  context: () => ({
    focused: null,
    active: null,
    dragging: null,
    stacked: null,
    start: null,
    pending: null,
  }),
  values: { value: { fallback: [], equal: sameNumbers } },
  onProps: { value: "VALUE.SYNCED", disabled: "DRAG.CANCEL" },
  on: {
    FOCUS: { actions: ["setFocused"] },
    BLUR: { actions: ["clearFocused"] },
    RESET: { actions: ["restoreDefault"] },
    "VALUE.SYNCED": { actions: ["applySynced"] },
    $reverted: { actions: ["revert"] },
  },
  states: {
    idle: {
      on: {
        "POINTER.DOWN": {
          guard: "canInteract",
          target: "dragging",
          actions: ["pickThumb", "recordStart", "setFromPress", "focusPressed"],
        },
        INCREASE: { guard: "canChangeThumb", actions: ["stepThumb"] },
        DECREASE: { guard: "canChangeThumb", actions: ["stepThumb"] },
        PAGE_PREV: { guard: "canChangeThumb", actions: ["stepThumb"] },
        PAGE_NEXT: { guard: "canChangeThumb", actions: ["stepThumb"] },
        FIRST: { guard: "canChangeThumb", actions: ["stepThumb"] },
        LAST: { guard: "canChangeThumb", actions: ["stepThumb"] },
        "INPUT.CHANGE": [
          { guard: "canChangeThumb", actions: ["setFromInput"] },
          { actions: ["resyncInputs"] },
        ],
      },
    },
    dragging: {
      effects: ["trackDrag"],
      on: {
        "POINTER.MOVE": { actions: ["setFromPointer"] },
        "POINTER.UP": { target: "idle", actions: ["commitIfChanged"] },
        "DRAG.CANCEL": { target: "idle", actions: ["restoreStart"] },
        "INPUT.CHANGE": { actions: ["resyncInputs"] },
      },
    },
  },
})

export type SliderMachine = typeof sliderMachine

/** Whether a logical key event type is one a thumb handles. */
export const isSliderKey = isKey
