// The Color Area's contract (spec "Contract", "Color Area Invariants"): keyboard actions press
// real keys on the axis inputs, pointer actions drive each machine step of a drag at a point
// of the surface, `adjustNative` sets an input's value as assistive technology does.

import { contract, type Invariant } from "../../contract/contract"
import type { Env, Part } from "../../contract/env"
import { areaPart, COLOR_PICKER_SCOPE } from "../color-picker/color-picker.naming"
import { cssColorOf } from "../color-swatch/color-swatch.contract"
import type { ColorFormat } from "../shared/color/color"
import { formatColor } from "../shared/color/format"
import { parseColor } from "../shared/color/parse"
import type { AreaAxis } from "./color-area.axes"
import { colorAreaMachine } from "./color-area.machine"

type P = "root" | "background" | "thumb" | "input"
type E = Env<P>

const inputOf = (env: E, axis: AreaAxis): Part => env.part("input").nth(axis === "x" ? 0 : 1)
const num = async (p: Part, name: string) => Number(await p.attr(name))
const isDragging = async (env: E) => (await env.part("root").attr("data-dragging")) !== null
const ignores = async (env: E) =>
  (await env.part("root").attr("data-disabled")) !== null ||
  (await env.part("root").attr("data-readonly")) !== null

const needsLayout = (action: string) =>
  new Error(`${action}: the pointer step needs layout, which this environment does not have`)

async function channels(env: E) {
  const read = async (axis: AreaAxis) => {
    const input = inputOf(env, axis)
    return {
      channel: (await input.attr("data-channel")) ?? "",
      value: await num(input, "aria-valuenow"),
    }
  }
  return { x: await read("x"), y: await read("y") }
}

/** The pointer position of a point on the surface (fractions of the Root's box). */
async function at(env: E, point: { readonly x: number; readonly y: number }, action: string) {
  const box = await env.part("root").box()
  if (!box || box.width === 0 || box.height === 0) throw needsLayout(action)
  const rtl = (await env.part("root").attr("dir")) === "rtl"
  // A point on the very edge hits whatever is next to the surface: keep it 0.05 px inside.
  const inside = (f: number, size: number) => Math.min(Math.max(f, 0.05 / size), 1 - 0.05 / size)
  return {
    x: inside(rtl ? 1 - point.x : point.x, box.width),
    y: inside(1 - point.y, box.height),
  }
}

type Kind = "mouse" | "touch"
let gesture: { kind: Kind; at: { x: number; y: number } } | null = null

const pointerDown = (kind: Kind) => async (env: E, point?: { x: number; y: number }) => {
  const thumb = env.part("thumb")
  if (!point) {
    if (!(await thumb.box())) throw needsLayout("pointerDown")
    gesture = { kind, at: { x: 0.5, y: 0.5 } }
    await thumb.pointer("down", { at: gesture.at, pointerType: kind })
    return
  }
  const pos = await at(env, point, "pointerDown")
  gesture = { kind, at: pos }
  await env.part("root").pointer("down", { at: pos, pointerType: kind })
}
const pointerMove = (kind: Kind) => async (env: E, point: { x: number; y: number }) => {
  const pos = await at(env, point, "pointerMove")
  const pointerType = gesture?.kind ?? kind
  gesture = { kind: pointerType, at: pos }
  await env.part("root").pointer("move", { at: pos, pointerType })
}
const pointerEnd = (kind: Kind, phase: "up" | "cancel") => async (env: E) => {
  if (!(await env.part("root").box()))
    throw needsLayout(phase === "up" ? "pointerUp" : "cancelDrag")
  const g = gesture ?? { kind, at: { x: 0.5, y: 0.5 } }
  gesture = null
  await env.part("root").pointer(phase, { at: g.at, pointerType: g.kind })
}

const arrow = (axis: AreaAxis, dir: "increase" | "decrease") =>
  axis === "x"
    ? dir === "increase"
      ? ("ArrowRight" as const)
      : ("ArrowLeft" as const)
    : dir === "increase"
      ? ("ArrowUp" as const)
      : ("ArrowDown" as const)

async function stepTo(env: E, axis: AreaAxis, value: number) {
  const input = inputOf(env, axis)
  for (let guard = 0; guard < 1000; guard++) {
    const now = await num(input, "aria-valuenow")
    if (Math.abs(now - value) < 1e-9) return
    await input.press(arrow(axis, value > now ? "increase" : "decrease"))
    if ((await num(input, "aria-valuenow")) === now) return
  }
}

let before = ""
const snapshot = async (env: E) => JSON.stringify(await channels(env))

/** Per-contract invariants (spec "Color Area Invariants"). */
export const colorAreaInvariants: readonly Invariant<P, string>[] = [
  {
    name: "color-area-inputs-mirror-aria",
    check: async ({ env }) => {
      for (const axis of ["x", "y"] as const) {
        const input = inputOf(env, axis)
        const now = Number(await input.attr("aria-valuenow"))
        const value = Number(await input.value())
        // The native value rounds to the step; aria-valuenow is exact (design §4).
        const step = Number(await input.attr("step")) || 1
        if (Math.abs(now - value) > step / 2 + 1e-9) {
          return `the ${axis} input has value ${value}, aria-valuenow ${now}`
        }
      }
      return undefined
    },
  },
  {
    name: "color-area-two-sliders-one-tab-stop",
    check: async ({ env }) => {
      const inputs = await env.part("input").all()
      if (inputs.length !== 2) return `the Area renders ${inputs.length} inputs, not 2`
      let stops = 0
      for (const input of inputs) {
        const t = await input.attr("tabindex")
        if (t === null || Number(t) >= 0) stops++
      }
      if (stops !== 1) return `the Area has ${stops} tab stops among its inputs, not 1`
      return undefined
    },
  },
  {
    name: "color-area-thumb-at-value",
    check: async ({ env }) => {
      const style = (await env.part("thumb").attr("style")) ?? ""
      if (style.includes("NaN")) return `the thumb's style contains NaN: ${style}`
      const bg = (await env.part("background").attr("style")) ?? ""
      if (bg.includes("NaN")) return `the background contains NaN: ${bg}`
      for (const axis of ["x", "y"] as const) {
        const input = inputOf(env, axis)
        const [v, min, max] = [
          await num(input, "aria-valuenow"),
          await num(input, "aria-valuemin"),
          await num(input, "aria-valuemax"),
        ]
        const want = Math.round(((v - min) / (max - min)) * 10000) / 100
        const got = Number(
          new RegExp(`--rind-color-area-${axis}:\\s*([\\d.]+)`).exec(style)?.[1] ?? Number.NaN,
        )
        if (Math.abs(got - want) > 0.01) {
          return `--rind-color-area-${axis} is ${got}, the ${axis} channel gives ${want}`
        }
      }
      return undefined
    },
  },
]

const DRAG_ONLY = "dragging is pointer-only; `step` is the 2.5.7 alternative"
type Point = { readonly x: number; readonly y: number }

/** The Color Area's contract (spec "Contract"). */
export const colorAreaContract = contract(COLOR_PICKER_SCOPE, {
  partName: areaPart,
  machine: colorAreaMachine,
  anatomy: ["root", "background", "thumb", "input"],
  locate: ({ name }: { readonly name: string | RegExp }) => ({ role: "group", name }),
  actions: {
    focusAxis: {
      keyboard: async (env, axis: AreaAxis) => inputOf(env, axis).focus(),
      done: async (env, axis: AreaAxis) => inputOf(env, axis).isFocused(),
    },
    step: {
      keyboard: async (
        env,
        axis: AreaAxis,
        dir: "increase" | "decrease",
        o?: { readonly large?: boolean },
      ) => {
        before = await snapshot(env)
        await inputOf(env, axis).press(arrow(axis, dir), { shift: o?.large === true })
      },
      done: async (env, axis: AreaAxis) => {
        if ((await snapshot(env)) !== before || (await ignores(env))) return true
        const input = inputOf(env, axis)
        const v = await num(input, "aria-valuenow")
        return (
          v === (await num(input, "aria-valuemin")) || v === (await num(input, "aria-valuemax"))
        )
      },
    },
    toEdge: {
      // Home and End act on the x axis (value keys, as Slider).
      keyboard: async (env, edge: "min" | "max") =>
        inputOf(env, "x").press(edge === "min" ? "Home" : "End"),
      done: async (env, edge: "min" | "max") => {
        if (await ignores(env)) return true
        const input = inputOf(env, "x")
        return (
          (await num(input, "aria-valuenow")) ===
          (await num(input, edge === "min" ? "aria-valuemin" : "aria-valuemax"))
        )
      },
    },
    setChannels: {
      keyboard: async (env, target: { readonly x?: number; readonly y?: number }) => {
        if (target.x !== undefined) await stepTo(env, "x", target.x)
        if (target.y !== undefined) await stepTo(env, "y", target.y)
      },
      pointer: async (env, target: { readonly x?: number; readonly y?: number }) => {
        const c = await channels(env)
        const frac = async (axis: AreaAxis, v: number | undefined) => {
          const input = inputOf(env, axis)
          const [min, max] = [await num(input, "aria-valuemin"), await num(input, "aria-valuemax")]
          return ((v ?? c[axis].value) - min) / (max - min)
        }
        await pointerDown("mouse")(env)
        await pointerMove("mouse")(env, {
          x: await frac("x", target.x),
          y: await frac("y", target.y),
        })
        await pointerEnd("mouse", "up")(env)
      },
      done: { isDragging: false },
    },
    pressAt: {
      pointer: async (env, point: Point) => {
        await pointerDown("mouse")(env, point)
        await pointerEnd("mouse", "up")(env)
      },
      touch: async (env, point: Point) => {
        await pointerDown("touch")(env, point)
        await pointerEnd("touch", "up")(env)
      },
      // The keyboard twin: steps toward the point's channel values.
      keyboard: async (env, point: Point) => {
        for (const axis of ["x", "y"] as const) {
          const input = inputOf(env, axis)
          const [min, max] = [await num(input, "aria-valuemin"), await num(input, "aria-valuemax")]
          await stepTo(env, axis, Math.round(min + point[axis] * (max - min)))
        }
      },
      done: { isDragging: false },
    },
    pointerDown: {
      pointer: async (env, point?: Point) => pointerDown("mouse")(env, point),
      touch: async (env, point?: Point) => pointerDown("touch")(env, point),
      none: { keyboard: DRAG_ONLY },
      done: async (env, _point?: Point) => (await isDragging(env)) || (await ignores(env)),
    },
    pointerMove: {
      pointer: async (env, point: Point) => pointerMove("mouse")(env, point),
      touch: async (env, point: Point) => pointerMove("touch")(env, point),
      none: { keyboard: DRAG_ONLY },
      done: async (_env, _point: Point) => true,
    },
    pointerUp: {
      pointer: async (env) => pointerEnd("mouse", "up")(env),
      touch: async (env) => pointerEnd("touch", "up")(env),
      none: { keyboard: DRAG_ONLY },
      done: { isDragging: false },
    },
    cancelDrag: {
      keyboard: async (env) => env.focused().press("Escape"),
      pointer: async (env) => pointerEnd("mouse", "cancel")(env),
      touch: async (env) => pointerEnd("touch", "cancel")(env),
      done: { isDragging: false },
    },
    adjustNative: {
      keyboard: async (env, axis: AreaAxis, value: number) =>
        inputOf(env, axis).fill(String(value)),
      done: async () => true,
    },
    resetForm: {
      pointer: async (env) => env.find({ role: "button", name: "Reset" }).click(),
      keyboard: async (env) => env.find({ role: "button", name: "Reset" }).press("Enter"),
      done: async (env) => {
        for (const input of await env.part("input").all()) {
          if ((await input.value()) !== (await input.attr("value"))) return false
        }
        return true
      },
    },
  },
  queries: {
    channels,
    color: async (env, format: ColorFormat = "hex") =>
      formatColor(parseColor(await cssColorOf(await env.part("root").attr("style"))), format),
    valueText: async (env, axis: AreaAxis) =>
      (await inputOf(env, axis).attr("aria-valuetext")) ?? "",
    colorName: async (env) => {
      const text = (await inputOf(env, "x").attr("aria-valuetext")) ?? ""
      return text.split(", ").at(-1) ?? ""
    },
    // Focus is what it reads: the second parameter keeps the runner from observing it.
    focusedAxis: async (env, _driverOnly?: never) => {
      if (await inputOf(env, "x").isFocused()) return "x" as const
      if (await inputOf(env, "y").isFocused()) return "y" as const
      return null
    },
    isDragging,
    formValues: async (env) => {
      const out: string[] = []
      for (const input of await env.part("input").all()) {
        if ((await input.attr("disabled")) !== null || (await input.attr("name")) === null) continue
        out.push(await input.value())
      }
      return out
    },
  },
  states: {
    idle: { isDragging: false },
    dragging: { isDragging: true },
  },
  events: {
    "POINTER.DOWN": {
      action: "pointerDown",
      args: (() => []) as never,
      event: () => ({ point: null, onThumb: true }),
    },
    "POINTER.MOVE": {
      action: "pointerMove",
      args: (() => [{ x: 0.5, y: 0.5 }]) as never,
      event: () => ({ x: 0.5, y: 0.5 }),
    },
    "POINTER.UP": "pointerUp",
    "DRAG.CANCEL": "cancelDrag",
    STEP: {
      action: "step",
      args: (() => ["x", "increase"]) as never,
      event: () => ({ axis: "x", steps: 1, page: false }),
    },
    EDGE: {
      action: "toEdge",
      args: (() => ["max"]) as never,
      event: () => ({ axis: "x", edge: "max" }),
    },
    "INPUT.CHANGE": {
      from: {
        idle: {
          action: "adjustNative",
          args: (() => ["x", 35]) as never,
          event: () => ({ axis: "x", value: 35 }),
        },
        dragging: { skip: "assistive technology does not adjust an input a pointer is dragging" },
      },
    },
    RESET: {
      from: {
        idle: "resetForm",
        dragging: { skip: "the Reset button cannot be pressed by the pointer that is dragging" },
      },
    },
    FOCUS: { skip: "not a user event: focus alone changes no value" },
    BLUR: { skip: "not a user event" },
    "VALUE.SYNCED": { skip: "the parent's prop change; walked by the controlled configurations" },
    "$props:value": { skip: "the parent's prop change; walked by the controlled configurations" },
    "$props:disabled": { skip: "disabled mid-drag is a scenario test (a re-render during a drag)" },
  },
  traits: ["directional", "form-associated"],
  invariants: colorAreaInvariants,
})
