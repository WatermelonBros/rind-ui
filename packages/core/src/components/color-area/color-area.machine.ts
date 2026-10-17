// Color Area (design §4): `idle` and `dragging`, one controllable colour in its emission space
// and a working colour in context (color-model "Controlled Colour Value"). Pointer events carry
// 2D fractions measured by pointer-drag, so every transition runs in Node with numbers.

import type { BlurEvent, FocusEvent } from "../../a11y/events"
import type { Modality } from "../../contract/env"
import type { DragMessage2D, DragPoint, PointerDragCapability2D } from "../../dom/pointer-drag"
import { setup, type } from "../../machine/setup"
import type { ActionArgs, ChangeDetails } from "../../machine/types"
import { getChannel } from "../shared/color/channels"
import type { Color, ColorMemory } from "../shared/color/color"
import { colorMemory, toSpace } from "../shared/color/convert"
import { isEqualColor } from "../shared/color/equal"
import { emittedChange, resolveWorking } from "../shared/color/value"
import {
  type AreaAxes,
  type AreaAxis,
  colorAtPoint,
  edgeAxis,
  setAxis,
  stepAxis,
} from "./color-area.axes"

export type ColorAreaEvent =
  /** A press on the Root; `point` null without layout; `onThumb`: the value stays. */
  | {
      readonly type: "POINTER.DOWN"
      readonly point: DragPoint | null
      readonly onThumb: boolean
      readonly modality: Modality
    }
  | { readonly type: "POINTER.MOVE"; readonly x: number; readonly y: number }
  | { readonly type: "POINTER.UP" }
  /** pointercancel, lost capture, a hidden document, Escape or disabled mid-drag. */
  | { readonly type: "DRAG.CANCEL" }
  | {
      readonly type: "STEP"
      readonly axis: AreaAxis
      readonly steps: 1 | -1
      readonly page: boolean
      readonly modality: Modality
    }
  | { readonly type: "EDGE"; readonly axis: AreaAxis; readonly edge: "min" | "max" }
  /** A native change to an input we did not make (assistive technology, autofill). */
  | { readonly type: "INPUT.CHANGE"; readonly axis: AreaAxis; readonly value: number }
  | { readonly type: "RESET" }
  | { readonly type: "VALUE.SYNCED" }
  | (FocusEvent & { readonly axis: AreaAxis })
  | (BlurEvent & { readonly axis: AreaAxis })

export type ColorAreaReason = ColorAreaEvent["type"] | "$reverted" | "$sync" | "$start"

export interface ColorAreaMachineProps {
  readonly value?: Color | undefined
  readonly defaultValue?: Color | undefined
  readonly onValueChange?:
    | ((value: Color, details: ChangeDetails<ColorAreaEvent>) => void)
    | undefined
  readonly onValueCommit?:
    | ((value: Color, details: { readonly reason: ColorAreaReason }) => void)
    | undefined
  readonly axes: AreaAxes
  /** Used when neither `value` nor `defaultValue` is given. */
  readonly fallback: Color
  readonly disabled?: boolean | undefined
  readonly readOnly?: boolean | undefined
}

export interface ColorAreaEnv {
  /** The two inputs, written as properties; `dispatch` fires input + change on each. */
  readonly inputs?:
    | {
        sync(x: number, y: number, dispatch: readonly [boolean, boolean]): void
      }
    | undefined
  readonly drag?: PointerDragCapability2D | undefined
  readonly focusAxis?: ((axis: AreaAxis, modality: Modality) => void) | undefined
}

export interface ColorAreaContext {
  /** The colour the controls show (in the axes' space); null until the first change. */
  working: Color | null
  memory: ColorMemory
  /** At the press: the working and the emitted colour (a cancel restores both). */
  start: { readonly working: Color; readonly emitted: Color } | null
  focused: AreaAxis | null
  /** The input that is the tab stop (the one focused last). */
  tabStop: AreaAxis
  /** What changed since focus came in (value text reads only that). */
  changed: AreaAxis | "both" | null
  /** The axis the machine is moving focus to (its FOCUS keeps `changed`). */
  focusing: AreaAxis | null
  /** The last emitted colour (a controlled proposal may not have arrived yet). */
  emitted: Color | null
  pendingCommit: { readonly color: Color; readonly reason: ColorAreaReason } | null
}

type Args = ActionArgs<{
  props: ColorAreaMachineProps
  events: ColorAreaEvent
  env: ColorAreaEnv
  context: ColorAreaContext
  values: "value"
}>

/** The emitted colour: `value`, else `defaultValue`, else the fallback. */
export const areaValueOf = (props: ColorAreaMachineProps, value: Color | undefined): Color =>
  value ?? props.value ?? props.defaultValue ?? props.fallback

/** The colour the controls show. */
export const areaWorking = (
  props: ColorAreaMachineProps,
  context: Pick<ColorAreaContext, "working" | "memory">,
  value: Color | undefined,
): Color =>
  resolveWorking(areaValueOf(props, value), context.working, props.axes.space, context.memory)

const working = (args: Pick<Args, "props" | "context" | "values">) =>
  areaWorking(args.props, args.context, args.values.value)
const emittedNow = (args: Pick<Args, "props" | "context" | "values">) =>
  args.context.emitted ?? areaValueOf(args.props, args.values.value)

function syncInputs(
  args: Pick<Args, "env" | "props" | "context" | "values">,
  dispatch: [boolean, boolean],
) {
  const w = working(args)
  const { axes } = args.props
  args.env.inputs?.sync(
    getChannel(w, axes.x, args.context.memory),
    getChannel(w, axes.y, args.context.memory),
    dispatch,
  )
}

/** The one write: the working colour, then the emission when the emitted colour changes. */
function write(args: Args, next: Color, changed: AreaAxis | "both" | null, dispatch: boolean) {
  const { context, props, set } = args
  const before = working(args)
  const inSpace = toSpace(next, props.axes.space, context.memory)
  if (isEqualColor(before, inSpace)) return false
  const memory = colorMemory(inSpace, context.memory)
  set("working", inSpace)
  set("memory", memory)
  if (changed) set("changed", changed)
  const emitted = emittedChange(emittedNow(args), inSpace, memory)
  if (emitted) {
    set("emitted", emitted)
    set("value", emitted)
  }
  const ax = props.axes
  const moved: [boolean, boolean] = [
    dispatch && getChannel(before, ax.x) !== getChannel(inSpace, ax.x),
    dispatch && getChannel(before, ax.y) !== getChannel(inSpace, ax.y),
  ]
  syncInputs(args, moved)
  return emitted !== null
}

/** Commits the last emission now, or when the controlled value arrives. */
function commit(args: Args, reason: ColorAreaReason) {
  const { props, set } = args
  const color = emittedNow(args)
  if (props.value !== undefined && !isEqualColor(props.value, color)) {
    set("pendingCommit", { color, reason })
    return
  }
  props.onValueCommit?.(color, { reason })
}

const canChange = (props: ColorAreaMachineProps) =>
  props.disabled !== true && props.readOnly !== true

export const colorAreaMachine = setup({
  types: type<{
    props: ColorAreaMachineProps
    events: ColorAreaEvent
    env: ColorAreaEnv
    context: ColorAreaContext
    values: "value"
  }>(),
  guards: {
    canChange: ({ props }) => canChange(props),
    enabled: ({ props }) => props.disabled !== true,
  },
  actions: {
    recordStart: (args) => args.set("start", { working: working(args), emitted: emittedNow(args) }),
    focusX: ({ env, event, set }) => {
      const modality = event.type === "POINTER.DOWN" ? event.modality : "pointer"
      set("focusing", "x")
      set("tabStop", "x")
      env.focusAxis?.("x", modality === "keyboard" || modality === "virtual" ? modality : "pointer")
    },
    setFromPress: (args) => {
      const { event, props, context } = args
      if (event.type !== "POINTER.DOWN" || event.onThumb || !event.point) return
      write(
        args,
        colorAtPoint(working(args), props.axes, event.point, context.memory),
        "both",
        true,
      )
    },
    setFromPointer: (args) => {
      const { event, props, context } = args
      if (event.type !== "POINTER.MOVE") return
      write(args, colorAtPoint(working(args), props.axes, event, context.memory), "both", true)
    },
    commitIfChanged: (args) => {
      const start = args.context.start
      args.set("start", null)
      if (start && !isEqualColor(start.emitted, emittedNow(args))) commit(args, "POINTER.UP")
    },
    restoreStart: (args) => {
      const { context, set, props } = args
      const start = context.start
      set("start", null)
      if (!start) return
      set("working", start.working)
      set("emitted", start.emitted)
      if (!isEqualColor(start.emitted, areaValueOf(props, args.values.value))) {
        set("value", start.emitted)
      }
      syncInputs(args, [false, false])
    },
    step: (args) => {
      const { event, props, context, env, set } = args
      if (event.type !== "STEP" && event.type !== "EDGE") return
      const w = working(args)
      const next =
        event.type === "STEP"
          ? stepAxis(w, props.axes, event.axis, event.steps, event.page, context.memory)
          : edgeAxis(w, props.axes, event.axis, event.edge, context.memory)
      // Focus follows a cross-axis step, so assistive technology reads the changed value.
      if (context.focused !== null && context.focused !== event.axis) {
        set("focusing", event.axis)
        set("tabStop", event.axis)
        env.focusAxis?.(event.axis, "keyboard")
      }
      if (write(args, next, event.axis, true)) commit(args, event.type)
    },
    setFromInput: (args) => {
      const { event, props } = args
      if (event.type !== "INPUT.CHANGE") return
      const next = setAxis(working(args), props.axes, event.axis, event.value)
      // The native input already dispatched its own input and change.
      if (write(args, next, event.axis, false)) commit(args, "INPUT.CHANGE")
      syncInputs(args, [false, false])
    },
    resyncInputs: (args) => syncInputs(args, [false, false]),
    restoreDefault: (args) => {
      const { props, set } = args
      set("working", null)
      set("emitted", null)
      set("pendingCommit", null)
      // Reported with reason RESET (the adapter keeps the consumer silent); never committed.
      if (props.value === undefined) set("value", props.defaultValue ?? props.fallback)
      syncInputs(args, [false, false])
    },
    applySynced: (args) => {
      const { props, context, set } = args
      // A value from the parent: our last emission is answered (or superseded).
      set("emitted", null)
      const pending = context.pendingCommit
      if (pending && props.value !== undefined) {
        set("pendingCommit", null)
        if (isEqualColor(props.value, pending.color)) {
          props.onValueCommit?.(props.value, { reason: pending.reason })
        }
      }
      syncInputs(args, [false, false])
    },
    revert: (args) => {
      args.set("emitted", null)
      args.set("pendingCommit", null)
      args.set("working", args.context.start?.working ?? null)
      syncInputs(args, [false, false])
    },
    setFocused: ({ event, context, set }) => {
      if (event.type !== "FOCUS") return
      set("focused", event.axis)
      set("tabStop", event.axis)
      if (context.focusing === event.axis) set("focusing", null)
      else set("changed", null)
    },
    clearFocused: ({ event, context, set }) => {
      if (event.type !== "BLUR") return
      if (context.focused === event.axis) set("focused", null)
      if (context.focusing === event.axis) set("focusing", null)
    },
  },
  effects: {
    trackDrag: ({ env, send }) =>
      env.drag?.track((m: DragMessage2D) => {
        if (m.type === "move") send({ type: "POINTER.MOVE", x: m.x, y: m.y })
        else if (m.type === "up") send({ type: "POINTER.UP" })
        else send({ type: "DRAG.CANCEL" })
      }),
  },
}).machine({
  id: "color-area",
  initial: "idle",
  context: () => ({
    working: null,
    memory: {},
    start: null,
    focused: null,
    tabStop: "x",
    changed: null,
    focusing: null,
    emitted: null,
    pendingCommit: null,
  }),
  // No fallback colour here: `areaValueOf` resolves a missing value from the props (sound:
  // every reader goes through it).
  values: { value: { fallback: undefined as never, equal: (a, b) => isEqualColor(a, b) } },
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
        "POINTER.DOWN": [
          {
            guard: "canChange",
            target: "dragging",
            actions: ["recordStart", "focusX", "setFromPress"],
          },
          // Read-only: the press focuses the x input and changes nothing.
          { guard: "enabled", actions: ["focusX"] },
        ],
        STEP: { guard: "canChange", actions: ["step"] },
        EDGE: { guard: "canChange", actions: ["step"] },
        "INPUT.CHANGE": [
          { guard: "canChange", actions: ["setFromInput"] },
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

export type ColorAreaMachine = typeof colorAreaMachine
