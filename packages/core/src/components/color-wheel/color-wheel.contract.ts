// Color Wheel's contract (spec "Color Wheel Contract"): keys on the input, `setHue` a press on
// the ring at that angle (layout required).

import { contract } from "../../contract/contract"
import type { Env, Key } from "../../contract/env"
import { angleSliderMachine } from "../angle-slider/angle-slider.machine"

type P = "root" | "label" | "track" | "thumb" | "input" | "value" | "hidden-input"
type E = Env<P>

/** The point of `hue` on the ring, at 43% of the box from the centre (fractions of the box). */
const pointOf = (hue: number) => {
  const r = (hue * Math.PI) / 180
  return { x: 0.5 + 0.43 * Math.sin(r), y: 0.5 - 0.43 * Math.cos(r) }
}

const press = (kind: "mouse" | "touch") => async (env: E, hue: number) => {
  const track = env.part("track")
  if (!(await track.box())) {
    throw new Error("setHue: the pointer step needs layout, which this environment does not have")
  }
  const at = pointOf(hue)
  await track.pointer("down", { at, pointerType: kind })
  await track.pointer("up", { at, pointerType: kind })
}

const keys = async (env: E, key: Key, times: number) => {
  for (let i = 0; i < times; i++) await env.part("input").press(key)
}

export const colorWheelContract = contract("color-wheel", {
  machine: angleSliderMachine,
  anatomy: ["root", "label", "track", "thumb", "input", "value", "hidden-input"],
  locate: (anchor?: { readonly label: string | RegExp }) =>
    anchor ? { role: "slider", name: anchor.label } : { part: "root" },
  actions: {
    setHue: {
      pointer: press("mouse"),
      touch: press("touch"),
      none: { keyboard: "a keyboard reaches a hue with step and toEdge" },
      done: async () => true,
    },
    step: {
      keyboard: async (env: E, steps: number) =>
        keys(env, steps < 0 ? "ArrowLeft" : "ArrowRight", Math.abs(steps)),
      none: { pointer: "a pointer sets a hue (setHue)", touch: "a pointer sets a hue" },
      done: async () => true,
    },
    toEdge: {
      keyboard: async (env: E, edge: "min" | "max") =>
        env.part("input").press(edge === "min" ? "Home" : "End"),
      none: { pointer: "a pointer sets a hue (setHue)", touch: "a pointer sets a hue" },
      done: async () => true,
    },
  },
  queries: {
    hue: async (env: E) => Number(await env.part("input").value()),
    value: async (env: E) => env.part("hidden-input").value(),
    valueText: async (env: E) => (await env.part("input").attr("aria-valuetext")) ?? "",
    isDragging: async (env: E) => (await env.part("root").attr("data-dragging")) !== null,
  },
  states: { idle: { isDragging: false }, dragging: { isDragging: true } },
  events: { STEP: "step", EDGE: "toEdge", "POINTER.DOWN": "setHue" },
  traits: [],
})
