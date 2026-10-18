// Splitter (design §2): `idle` and `dragging`, one controllable `sizes` array in percent and
// one write path. Pointer moves arrive as percent deltas measured by the parts through
// pointer-drag, so every transition runs in Node. No hover or focus state: keys are guarded
// by props only (zag#3223), hover is CSS (reka#2893, Ark#3337).

import type { BlurEvent, FocusEvent } from "../../a11y/events"
import type { Modality } from "../../contract/env"
import { setup, type } from "../../machine/setup"
import type { ActionArgs, ChangeDetails } from "../../machine/types"
import {
  isCollapsed,
  type ResizeTrigger,
  resizeAt,
  resolveSizes,
  type SplitterConstraints,
  sameSizes,
} from "./splitter.math"

export type SplitterEvent =
  /** A press on handle `handle`. */
  | { readonly type: "POINTER.DOWN"; readonly handle: number; readonly modality: Modality }
  /** The pointer moved `delta` percent from the press (positive grows the primary panel). */
  | { readonly type: "POINTER.MOVE"; readonly delta: number }
  | { readonly type: "POINTER.UP" }
  /** pointercancel, lost capture, a hidden document, Escape, or disabled mid-drag. */
  | { readonly type: "DRAG.CANCEL" }
  /** An arrow key: `direction` 1 grows the primary panel by `step`, -1 shrinks it. */
  | { readonly type: "STEP"; readonly handle: number; readonly direction: 1 | -1 }
  /** Home (`min`) or End (`max`): the primary panel's smallest or largest reachable size. */
  | { readonly type: "TO_EDGE"; readonly handle: number; readonly edge: "min" | "max" }
  /** Enter: collapses the primary panel, or restores it. */
  | { readonly type: "TOGGLE"; readonly handle: number }
  /** The constraints changed (a resize re-resolved pixel ones): sizes are clamped again. */
  | { readonly type: "LAYOUT.SYNCED" }
  | (FocusEvent & { readonly handle: number })
  | (BlurEvent & { readonly handle: number })

export type SplitterReason = "POINTER.UP" | "STEP" | "TO_EDGE" | "TOGGLE"

export interface SplitterCommitDetails {
  /** The event that ended the interaction. */
  readonly reason: SplitterReason
}

export interface SplitterMachineProps {
  readonly sizes?: readonly number[] | undefined
  readonly defaultSizes?: readonly number[] | undefined
  readonly onSizesChange?:
    | ((sizes: readonly number[], details: ChangeDetails<SplitterEvent>) => void)
    | undefined
  readonly onSizesCommit?:
    | ((sizes: readonly number[], details: SplitterCommitDetails) => void)
    | undefined
  /** One entry per panel, resolved to percentages. */
  readonly panels: readonly SplitterConstraints[]
  /** Percent per arrow key (default 5). */
  readonly step?: number | undefined
  readonly disabled?: boolean | undefined
  /** Per-handle `disabled`, by index. */
  readonly handleDisabled?: readonly boolean[] | undefined
}

export type SplitterDragMessage =
  | { readonly type: "move"; readonly delta: number }
  | { readonly type: "up" }
  | { readonly type: "cancel" }

/** What the drag effect reaches the press through (the parts convert fractions to deltas). */
export interface SplitterDragCapability {
  track(send: (m: SplitterDragMessage) => void): () => void
}

export interface SplitterEnv {
  /** Absent where there is no DOM (a model test's oracle). */
  readonly drag?: SplitterDragCapability | undefined
  /** Focuses a handle with the given modality (pointer: no ring). */
  readonly focusHandle?: ((index: number, modality: Modality) => void) | undefined
}

export interface SplitterContext {
  /** The handle with DOM focus. */
  focused: number | null
  /** The dragged handle. */
  handle: number | null
  /** The sizes at the press, restored by a cancel. */
  start: readonly number[] | null
  /** Each collapsible panel's size before it last collapsed (restored by Enter). */
  expanded: readonly (number | undefined)[]
}

type Args = ActionArgs<{
  props: SplitterMachineProps
  events: SplitterEvent
  env: SplitterEnv
  context: SplitterContext
  values: "sizes"
}>

/** The sizes to render from the props and the machine's value. */
export const splitterSizes = (props: SplitterMachineProps, value: readonly number[] | undefined) =>
  resolveSizes(value, props.defaultSizes, props.panels)

const current = (args: Pick<Args, "props" | "values">) =>
  splitterSizes(args.props, args.values.sizes)

/** The one write: remembers what collapsed, proposes `next`, commits an accepted change. */
function write(args: Args, next: readonly number[], commit: SplitterReason | null) {
  const { props, set, context } = args
  const before = current(args)
  if (sameSizes(before, next)) return
  const expanded = props.panels.map((c, i) =>
    isCollapsed(c, next[i]) && !isCollapsed(c, before[i]) ? before[i] : context.expanded[i],
  )
  set("expanded", expanded)
  set("sizes", next)
  // Refused through details.cancel() (uncontrolled): nothing changed, nothing to commit.
  if (props.sizes === undefined && !sameSizes(current(args), next)) return
  if (commit !== null) props.onSizesCommit?.(next, { reason: commit })
}

function resizeBy(args: Args, handle: number, delta: number, trigger: ResizeTrigger) {
  return resizeAt(current(args), args.props.panels, handle, delta, trigger)
}

export const splitterMachine = setup({
  types: type<{
    props: SplitterMachineProps
    events: SplitterEvent
    env: SplitterEnv
    context: SplitterContext
    values: "sizes"
  }>(),
  guards: {
    /** The event's handle exists and accepts changes. */
    canResize: ({ props, event }) => {
      if (props.disabled === true) return false
      const handle = "handle" in event ? event.handle : null
      return (
        typeof handle === "number" &&
        handle >= 0 &&
        handle < props.panels.length - 1 &&
        props.handleDisabled?.[handle] !== true
      )
    },
  },
  actions: {
    startDrag: (args) => {
      const { event, set, env } = args
      if (event.type !== "POINTER.DOWN") return
      set("handle", event.handle)
      set("start", current(args))
      env.focusHandle?.(event.handle, event.modality === "touch" ? "touch" : "pointer")
    },
    dragTo: (args) => {
      const { event, context } = args
      if (event.type !== "POINTER.MOVE" || context.start === null || context.handle === null) return
      const next = resizeAt(
        context.start,
        args.props.panels,
        context.handle,
        event.delta,
        "pointer",
      )
      write(args, next, null)
    },
    /** A release whose sizes differ from the press commits once. */
    commitIfChanged: (args) => {
      const { context, props, set } = args
      const start = context.start
      set("start", null)
      set("handle", null)
      const sizes = current(args)
      if (start !== null && !sameSizes(start, sizes)) {
        props.onSizesCommit?.(sizes, { reason: "POINTER.UP" })
      }
    },
    /** A cancelled drag restores the press sizes and commits nothing. */
    restoreStart: (args) => {
      const start = args.context.start
      args.set("start", null)
      args.set("handle", null)
      if (start) write(args, start, null)
    },
    step: (args) => {
      const { event, props } = args
      if (event.type !== "STEP") return
      const delta = event.direction * (props.step ?? 5)
      write(args, resizeBy(args, event.handle, delta, "keyboard"), "STEP")
    },
    toEdge: (args) => {
      const { event } = args
      if (event.type !== "TO_EDGE") return
      const delta = event.edge === "min" ? -100 : 100
      write(args, resizeBy(args, event.handle, delta, "keyboard"), "TO_EDGE")
    },
    /** Collapses a collapsible primary panel, or restores its size before collapse. */
    toggle: (args) => {
      const { event, props, context } = args
      if (event.type !== "TOGGLE") return
      const i = event.handle
      const c = props.panels[i]
      if (c?.collapsible !== true) return
      const sizes = current(args)
      const size = sizes[i] ?? 0
      const target = isCollapsed(c, size)
        ? Math.max(context.expanded[i] ?? c.min ?? 0, c.min ?? 0)
        : (c.collapsedSize ?? 0)
      write(args, resizeBy(args, i, target - size, "api"), "TOGGLE")
    },
    /** New constraints: the sizes clamped to them (no commit: not an interaction). */
    revalidate: (args) => {
      // What renders is always validated; the stored value follows (and a parent hears).
      const raw = args.values.sizes
      const next = current(args)
      if (raw.length > 0 && !sameSizes(raw, next)) args.set("sizes", next)
    },
    setFocused: ({ event, set }) => {
      if (event.type === "FOCUS") set("focused", event.handle)
    },
    clearFocused: ({ event, context, set }) => {
      if (event.type === "BLUR" && context.focused === event.handle) set("focused", null)
    },
  },
  effects: {
    trackDrag: ({ env, send }) =>
      env.drag?.track((m) => {
        if (m.type === "move") send({ type: "POINTER.MOVE", delta: m.delta })
        else if (m.type === "up") send({ type: "POINTER.UP" })
        else send({ type: "DRAG.CANCEL" })
      }),
  },
}).machine({
  id: "splitter",
  initial: "idle",
  context: () => ({ focused: null, handle: null, start: null, expanded: [] }),
  values: { sizes: { fallback: [], equal: sameSizes } },
  onProps: {
    panels: { event: "LAYOUT.SYNCED", equal: sameConstraints },
    disabled: "DRAG.CANCEL",
  },
  on: {
    FOCUS: { actions: ["setFocused"] },
    BLUR: { actions: ["clearFocused"] },
    "LAYOUT.SYNCED": { actions: ["revalidate"] },
  },
  states: {
    idle: {
      on: {
        "POINTER.DOWN": { guard: "canResize", target: "dragging", actions: ["startDrag"] },
        STEP: { guard: "canResize", actions: ["step"] },
        TO_EDGE: { guard: "canResize", actions: ["toEdge"] },
        TOGGLE: { guard: "canResize", actions: ["toggle"] },
      },
    },
    dragging: {
      effects: ["trackDrag"],
      on: {
        "POINTER.MOVE": { actions: ["dragTo"] },
        "POINTER.UP": { target: "idle", actions: ["commitIfChanged"] },
        "DRAG.CANCEL": { target: "idle", actions: ["restoreStart"] },
      },
    },
  },
})

/** Two constraint lists are the same (a new array with the same content is no change). */
export function sameConstraints(
  a: readonly SplitterConstraints[],
  b: readonly SplitterConstraints[],
): boolean {
  return (
    a.length === b.length &&
    a.every((c, i) => {
      const d = b[i]
      return (
        d !== undefined &&
        c.min === d.min &&
        c.max === d.max &&
        c.collapsible === d.collapsible &&
        c.collapsedSize === d.collapsedSize
      )
    })
  )
}

export type SplitterMachine = typeof splitterMachine
