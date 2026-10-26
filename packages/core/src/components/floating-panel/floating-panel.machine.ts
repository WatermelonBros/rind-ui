// Floating Panel's rect (add-floating-panel design §1–§5): position, size and stage, clamped to a
// boundary. Open and close are the Dialog machine's (non-modal), composed by the parts. A drag is
// seen at its start and its end only: the parts write each move to CSS variables.

import {
  clampRect,
  type Point,
  type Rect,
  type RectLimits,
  type ResizeAxis,
  resizeRect,
  type Size,
} from "../../dom/rect-bounds"
import { setup, type } from "../../machine/setup"
import type { ActionArgs, ChangeDetails } from "../../machine/types"

export type PanelStage = "default" | "minimized" | "maximized"
export type PanelReason = "drag" | "resize" | "keyboard" | "boundary" | "api"

export type FloatingPanelEvent =
  | { readonly type: "DRAG.START"; readonly mode: "move" }
  | { readonly type: "DRAG.START"; readonly mode: "resize"; readonly axis: ResizeAxis }
  /** The drag's total offset from its start, in boundary pixels. */
  | { readonly type: "DRAG.END"; readonly dx: number; readonly dy: number }
  | { readonly type: "DRAG.CANCEL" }
  | {
      readonly type: "MOVE.STEP"
      readonly dx: -1 | 0 | 1
      readonly dy: -1 | 0 | 1
      readonly large: boolean
    }
  | {
      readonly type: "RESIZE.STEP"
      readonly dx: -1 | 0 | 1
      readonly dy: -1 | 0 | 1
      readonly large: boolean
    }
  | { readonly type: "STAGE"; readonly stage: PanelStage }
  | { readonly type: "STAGE.TOGGLE_MAXIMIZED" }
  | { readonly type: "BOUNDARY"; readonly width: number; readonly height: number }

export interface FloatingPanelProps {
  readonly position?: Point | undefined
  readonly defaultPosition?: Point | undefined
  readonly onPositionChange?:
    | ((position: Point, details: ChangeDetails<FloatingPanelEvent>) => void)
    | undefined
  readonly size?: Size | undefined
  readonly defaultSize?: Size | undefined
  readonly onSizeChange?:
    | ((size: Size, details: ChangeDetails<FloatingPanelEvent>) => void)
    | undefined
  readonly stage?: PanelStage | undefined
  readonly defaultStage?: PanelStage | undefined
  readonly onStageChange?:
    | ((stage: PanelStage, details: ChangeDetails<FloatingPanelEvent>) => void)
    | undefined
  readonly minSize?: Size | undefined
  readonly maxSize?: Size | undefined
  readonly minVisible?: number | undefined
  readonly step?: number | undefined
  readonly largeStep?: number | undefined
  readonly draggable?: boolean | undefined
  readonly resizable?: boolean | undefined
  readonly disabled?: boolean | undefined
}

export interface FloatingPanelContext {
  readonly boundary: Size
  /** The resize handle being dragged. */
  readonly axis: ResizeAxis | null
  /** The rect before maximising or minimising (restore brings it back). */
  readonly restore: Rect | null
}

type Types = {
  props: FloatingPanelProps
  events: FloatingPanelEvent
  env: object
  context: FloatingPanelContext
  values: "position" | "size" | "stage"
}
type Args = ActionArgs<Types>

export const DEFAULT_PANEL_SIZE: Size = { width: 360, height: 240 }
export const DEFAULT_MIN_SIZE: Size = { width: 200, height: 120 }

export const limitsOf = (props: FloatingPanelProps, boundary: Size): RectLimits => ({
  boundary,
  minSize: props.minSize ?? DEFAULT_MIN_SIZE,
  maxSize: props.maxSize,
  minVisible: props.minVisible ?? 48,
})

/** The current rect (unclamped values from the props, as the parts render them). */
export const rectOf = (props: FloatingPanelProps, position?: Point, size?: Size): Rect => ({
  ...(position ?? props.position ?? props.defaultPosition ?? { x: 0, y: 0 }),
  ...(size ?? props.size ?? props.defaultSize ?? DEFAULT_PANEL_SIZE),
})

const rect = (a: Pick<Args, "props" | "values">) =>
  rectOf(a.props, a.values.position, a.values.size)
const hasBoundary = (b: Size) => b.width > 0 && b.height > 0

function write(a: Args, next: Rect) {
  const r = hasBoundary(a.context.boundary)
    ? clampRect(next, limitsOf(a.props, a.context.boundary))
    : next
  const now = rect(a)
  if (r.x !== now.x || r.y !== now.y) a.set("position", { x: r.x, y: r.y })
  if (r.width !== now.width || r.height !== now.height)
    a.set("size", { width: r.width, height: r.height })
}

const stepOf = (a: Args, large: boolean) =>
  large ? (a.props.largeStep ?? 50) : (a.props.step ?? 10)

export const floatingPanelMachine = /* @__PURE__ */ setup({
  types: type<Types>(),
  guards: {
    canMove: ({ props, values }) =>
      props.disabled !== true && props.draggable !== false && values.stage !== "maximized",
    canResize: ({ props, values }) =>
      props.disabled !== true &&
      props.resizable !== false &&
      (values.stage ?? "default") === "default",
    enabled: ({ props }) => props.disabled !== true,
    isMove: ({ event }) => event.type === "DRAG.START" && event.mode === "move",
  },
  actions: {
    recordAxis: ({ event, set }) =>
      set("axis", event.type === "DRAG.START" && event.mode === "resize" ? event.axis : null),
    endMove: (a) => {
      if (a.event.type !== "DRAG.END") return
      const r = rect(a)
      write(a, { ...r, x: r.x + a.event.dx, y: r.y + a.event.dy })
    },
    endResize: (a) => {
      const axis = a.context.axis
      a.set("axis", null)
      if (a.event.type !== "DRAG.END" || !axis) return
      write(
        a,
        resizeRect(rect(a), axis, a.event.dx, a.event.dy, limitsOf(a.props, a.context.boundary)),
      )
    },
    clearAxis: ({ set }) => set("axis", null),
    moveStep: (a) => {
      if (a.event.type !== "MOVE.STEP") return
      const s = stepOf(a, a.event.large)
      const r = rect(a)
      write(a, { ...r, x: r.x + a.event.dx * s, y: r.y + a.event.dy * s })
    },
    resizeStep: (a) => {
      if (a.event.type !== "RESIZE.STEP") return
      const s = stepOf(a, a.event.large)
      write(
        a,
        resizeRect(
          rect(a),
          "se",
          a.event.dx * s,
          a.event.dy * s,
          limitsOf(a.props, a.context.boundary),
        ),
      )
    },
    setStage: (a) => {
      const now = a.values.stage ?? "default"
      const next: PanelStage =
        a.event.type === "STAGE"
          ? a.event.stage
          : a.event.type === "STAGE.TOGGLE_MAXIMIZED"
            ? now === "maximized"
              ? "default"
              : "maximized"
            : now
      if (next === now) return
      if (now === "default") a.set("restore", rect(a))
      a.set("stage", next)
      if (next === "default" && a.context.restore) {
        write(a, a.context.restore)
        a.set("restore", null)
      }
    },
    setBoundary: (a) => {
      if (a.event.type !== "BOUNDARY") return
      a.set("boundary", { width: a.event.width, height: a.event.height })
      write(a, rect(a))
    },
  },
}).machine({
  id: "floating-panel",
  initial: "idle",
  context: () => ({ boundary: { width: 0, height: 0 }, axis: null, restore: null }),
  values: {
    position: { fallback: { x: 0, y: 0 }, equal: (a, b) => a.x === b.x && a.y === b.y },
    size: {
      fallback: DEFAULT_PANEL_SIZE,
      equal: (a, b) => a.width === b.width && a.height === b.height,
    },
    stage: { fallback: "default" },
  },
  on: {
    BOUNDARY: { actions: ["setBoundary"] },
    STAGE: { guard: "enabled", actions: ["setStage"] },
    "STAGE.TOGGLE_MAXIMIZED": { guard: "enabled", actions: ["setStage"] },
  },
  states: {
    idle: {
      on: {
        "DRAG.START": [
          { guard: { and: ["canMove", "isMove"] }, target: "moving" },
          { guard: "canResize", target: "resizing", actions: ["recordAxis"] },
        ],
        "MOVE.STEP": { guard: "canMove", actions: ["moveStep"] },
        "RESIZE.STEP": { guard: "canResize", actions: ["resizeStep"] },
      },
    },
    moving: {
      on: {
        "DRAG.END": { target: "idle", actions: ["endMove"] },
        "DRAG.CANCEL": { target: "idle" },
      },
    },
    resizing: {
      on: {
        "DRAG.END": { target: "idle", actions: ["endResize"] },
        "DRAG.CANCEL": { target: "idle", actions: ["clearAxis"] },
      },
    },
  },
})

export type FloatingPanelMachine = typeof floatingPanelMachine
export type FloatingPanelState = "idle" | "moving" | "resizing"
