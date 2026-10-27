// Angle Slider (add-angle-slider design §2): `idle` and `dragging`, one controllable angle.
// Pointer events carry angles measured by dom/pointer-angle, so every transition runs in Node
// with numbers. A cancel restores the value at the press; a commit runs once per interaction.

import type { Modality } from "../../contract/env"
import type { AngleMessage, PointerAngleCapability } from "../../dom/pointer-angle"
import { setup, type } from "../../machine/setup"
import type { ActionArgs, ChangeDetails } from "../../machine/types"
import { angleMax, normalizeAngle, stepAngle } from "./angle-slider.math"

export type AngleSliderEvent =
  /** A press on the Control; `angle` null at the centre or without layout. */
  | {
      readonly type: "POINTER.DOWN"
      readonly angle: number | null
      readonly onThumb: boolean
      readonly modality: Modality
    }
  | { readonly type: "POINTER.MOVE"; readonly angle: number }
  | { readonly type: "POINTER.UP" }
  /** pointercancel, lost capture, a hidden document, Escape or disabled mid-drag. */
  | { readonly type: "DRAG.CANCEL" }
  | { readonly type: "STEP"; readonly steps: 1 | -1; readonly page: boolean }
  | { readonly type: "EDGE"; readonly edge: "min" | "max" }
  /** A native change to the input we did not make (assistive technology, autofill). */
  | { readonly type: "INPUT.CHANGE"; readonly value: number }
  | { readonly type: "RESET" }

export type AngleSliderReason = "drag" | "press" | "keyboard" | "input" | "reset"

export interface AngleSliderProps {
  readonly value?: number | undefined
  readonly defaultValue?: number | undefined
  readonly onValueChange?:
    | ((value: number, details: ChangeDetails<AngleSliderEvent>) => void)
    | undefined
  readonly onValueCommit?:
    | ((value: number, details: { readonly reason: AngleSliderReason }) => void)
    | undefined
  readonly step?: number | undefined
  readonly largeStep?: number | undefined
  readonly wrap?: boolean | undefined
  readonly disabled?: boolean | undefined
  readonly readOnly?: boolean | undefined
}

export interface AngleSliderEnv {
  readonly drag?: PointerAngleCapability | undefined
  /** Moves focus to the input after a press (the adapter's DOM). */
  readonly focusInput?: ((modality: Modality) => void) | undefined
}

export interface AngleSliderContext {
  /** The value at the press (a cancel restores it); null while idle. */
  start: number | null
  /** A move arrived since the press: the commit is a drag, else a press. */
  moved: boolean
}

type Types = {
  props: AngleSliderProps
  events: AngleSliderEvent
  env: AngleSliderEnv
  context: AngleSliderContext
  values: "value"
}
type Args = ActionArgs<Types>

const stepOf = (p: AngleSliderProps) => (p.step !== undefined && p.step > 0 ? p.step : 1)
/** The current angle, normalised. */
export const angleValueOf = (p: AngleSliderProps, value: number | undefined) =>
  normalizeAngle(value ?? p.value ?? p.defaultValue ?? 0, stepOf(p))

const current = (a: Pick<Args, "props" | "values">) => angleValueOf(a.props, a.values.value)

function write(a: Args, next: number) {
  const v = normalizeAngle(next, stepOf(a.props))
  if (v === current(a)) return false
  a.set("value", v)
  return true
}

export const angleSliderMachine = /* @__PURE__ */ setup({
  types: type<Types>(),
  guards: {
    canChange: ({ props }) => props.disabled !== true && props.readOnly !== true,
    enabled: ({ props }) => props.disabled !== true,
  },
  actions: {
    recordStart: (a) => {
      a.set("start", current(a))
      a.set("moved", false)
    },
    focusInput: ({ env, event }) => {
      const m = event.type === "POINTER.DOWN" ? event.modality : "pointer"
      env.focusInput?.(m === "keyboard" || m === "virtual" ? m : "pointer")
    },
    setFromPress: (a) => {
      const e = a.event
      if (e.type !== "POINTER.DOWN" || e.onThumb || e.angle === null) return
      write(a, e.angle)
    },
    setFromPointer: (a) => {
      if (a.event.type !== "POINTER.MOVE") return
      a.set("moved", true)
      write(a, a.event.angle)
    },
    commitIfChanged: (a) => {
      const start = a.context.start
      a.set("start", null)
      if (start !== null && start !== current(a)) {
        a.props.onValueCommit?.(current(a), { reason: a.context.moved ? "drag" : "press" })
      }
    },
    restoreStart: (a) => {
      const start = a.context.start
      a.set("start", null)
      if (start !== null) write(a, start)
    },
    step: (a) => {
      const { event, props } = a
      const s = stepOf(props)
      let next: number
      if (event.type === "STEP") {
        const k = event.page ? Math.max(1, Math.round((props.largeStep ?? 15) / s)) : 1
        next = stepAngle(current(a), event.steps * k, s, props.wrap !== false)
      } else if (event.type === "EDGE") {
        next = event.edge === "min" ? 0 : angleMax(s)
      } else return
      if (write(a, next)) props.onValueCommit?.(current(a), { reason: "keyboard" })
    },
    setFromInput: (a) => {
      if (a.event.type !== "INPUT.CHANGE") return
      if (write(a, a.event.value)) a.props.onValueCommit?.(current(a), { reason: "input" })
    },
    restoreDefault: (a) => {
      a.set("start", null)
      if (a.props.value === undefined) a.set("value", angleValueOf(a.props, a.props.defaultValue))
    },
  },
  effects: {
    trackDrag: ({ env, send }) =>
      env.drag?.track((m: AngleMessage) => {
        if (m.type === "move") send({ type: "POINTER.MOVE", angle: m.angle })
        else if (m.type === "up") send({ type: "POINTER.UP" })
        else send({ type: "DRAG.CANCEL" })
      }),
  },
}).machine({
  id: "angle-slider",
  initial: "idle",
  context: () => ({ start: null, moved: false }),
  values: { value: { fallback: 0 } },
  onProps: { disabled: "DRAG.CANCEL" },
  on: { RESET: { target: "idle", actions: ["restoreDefault"] } },
  states: {
    idle: {
      on: {
        "POINTER.DOWN": [
          {
            guard: "canChange",
            target: "dragging",
            actions: ["recordStart", "focusInput", "setFromPress"],
          },
          // Read-only: the press focuses the input and changes nothing.
          { guard: "enabled", actions: ["focusInput"] },
        ],
        STEP: { guard: "canChange", actions: ["step"] },
        EDGE: { guard: "canChange", actions: ["step"] },
        "INPUT.CHANGE": { guard: "canChange", actions: ["setFromInput"] },
      },
    },
    dragging: {
      effects: ["trackDrag"],
      on: {
        "POINTER.MOVE": { actions: ["setFromPointer"] },
        "POINTER.UP": { target: "idle", actions: ["commitIfChanged"] },
        "DRAG.CANCEL": { target: "idle", actions: ["restoreStart"] },
      },
    },
  },
})

export type AngleSliderMachine = typeof angleSliderMachine
export type AngleSliderState = "idle" | "dragging"
