// Angle Slider's contract (spec "Angle Slider Contract"): keyboard actions press real keys on
// the input; `setAngle` presses the Control at the point of that angle (layout required).

import { contract } from "../../contract/contract"
import type { Env, Key } from "../../contract/env"
import { angleSliderMachine } from "./angle-slider.machine"

type P = "root" | "label" | "control" | "thumb" | "input" | "value" | "marker-group" | "marker"
type E = Env<P>

const value = async (env: E) => Number(await env.part("input").value())
const isDragging = async (env: E) => (await env.part("root").attr("data-dragging")) !== null

/** The point of `angle` on a ring at 40% of the Control's box (fractions of the box). */
const pointOf = (angle: number) => {
  const r = (angle * Math.PI) / 180
  return { x: 0.5 + 0.4 * Math.sin(r), y: 0.5 - 0.4 * Math.cos(r) }
}

const press = (kind: "mouse" | "touch") => async (env: E, angle: number) => {
  const control = env.part("control")
  if (!(await control.box())) {
    throw new Error("setAngle: the pointer step needs layout, which this environment does not have")
  }
  const at = pointOf(angle)
  await control.pointer("down", { at, pointerType: kind })
  await control.pointer("up", { at, pointerType: kind })
}

const keys = async (env: E, key: Key, times: number) => {
  for (let i = 0; i < times; i++) await env.part("input").press(key)
}

export const angleSliderContract = contract("angle-slider", {
  machine: angleSliderMachine,
  anatomy: ["root", "label", "control", "thumb", "input", "value", "marker-group", "marker"],
  locate: (anchor?: { readonly label: string | RegExp }) =>
    anchor ? { role: "slider", name: anchor.label } : { part: "root" },
  actions: {
    setAngle: {
      pointer: press("mouse"),
      touch: press("touch"),
      none: { keyboard: "a keyboard reaches an angle with step and toEdge" },
      done: async () => true,
    },
    step: {
      keyboard: async (env: E, steps: number) =>
        keys(env, steps < 0 ? "ArrowLeft" : "ArrowRight", Math.abs(steps)),
      none: { pointer: "a pointer sets an angle (setAngle)", touch: "a pointer sets an angle" },
      done: async () => true,
    },
    toEdge: {
      keyboard: async (env: E, edge: "min" | "max") =>
        env.part("input").press(edge === "min" ? "Home" : "End"),
      none: { pointer: "a pointer sets an angle (setAngle)", touch: "a pointer sets an angle" },
      done: async () => true,
    },
  },
  queries: {
    value,
    valueText: async (env: E) => (await env.part("input").attr("aria-valuetext")) ?? "",
    isDragging,
  },
  states: { idle: { isDragging: false }, dragging: { isDragging: true } },
  events: { STEP: "step", EDGE: "toEdge", "POINTER.DOWN": "setAngle" },
  traits: [],
})
