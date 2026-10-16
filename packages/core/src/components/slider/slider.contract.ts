// The Slider's contract (spec "Contract", design §6): keyboard actions press real keys,
// pointer actions drive each machine step of a drag with the pointer steps of
// `test-drivers` at the position of a value, and `adjustNative` sets a thumb input's value
// as assistive technology does.

import { contract, type Invariant } from "../../contract/contract"
import type { Env, Part } from "../../contract/env"
import { sliderMachine } from "./slider.machine"
import { sliderRange, thumbBounds } from "./slider.math"

type P =
  | "root"
  | "label"
  | "value-text"
  | "control"
  | "track"
  | "indicator"
  | "thumb"
  | "hidden-input"
  | "marker-group"
  | "marker"
  | "description"
type E = Env<P>

/** A pointer target on the axis: a value, or a fraction of the track (model steps). */
export type SliderTarget = number | { readonly fraction: number }

const inputs = (env: E) => env.part("hidden-input").all()
const num = async (p: Part, name: string) => Number(await p.attr(name))

const values = async (env: E): Promise<number[]> =>
  Promise.all((await inputs(env)).map((i) => num(i, "aria-valuenow")))

const orientation = async (env: E): Promise<"horizontal" | "vertical"> =>
  (await env.part("root").attr("data-orientation")) === "vertical" ? "vertical" : "horizontal"
const direction = async (env: E) => ((await env.part("root").attr("dir")) === "rtl" ? "rtl" : "ltr")
const isDragging = async (env: E) => (await env.part("root").attr("data-dragging")) !== null

const needsLayout = (action: string) =>
  new Error(`${action}: the pointer step needs layout, which this environment does not have`)

/**
 * The fraction of the track a value sits at, from what the page shows: the range starts at
 * the first thumb's minimum, and a thumb's `--rind-slider-thumb-percent` gives the scale.
 */
async function fractionOfValue(env: E, value: number): Promise<number> {
  const list = await inputs(env)
  const first = list[0]
  const last = list[list.length - 1]
  if (!first || !last) return 0
  const min = await num(first, "aria-valuemin")
  let max = await num(last, "aria-valuemax")
  for (const [i, thumb] of (await env.part("thumb").all()).entries()) {
    const percent = Number.parseFloat(
      /--rind-slider-thumb-percent:\s*([\d.]+)%/.exec((await thumb.attr("style")) ?? "")?.[1] ?? "",
    )
    const v = await num(list[i] ?? first, "aria-valuenow")
    if (percent > 0 && v > min) {
      max = min + ((v - min) * 100) / percent
      break
    }
  }
  return max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0
}

/** The position (fractions of the Control's box) of a target on the axis. */
async function positionOf(env: E, target: SliderTarget, action: string) {
  const box = await env.part("control").box()
  if (!box || box.width === 0 || box.height === 0) throw needsLayout(action)
  const vertical = (await orientation(env)) === "vertical"
  const rtl = (await direction(env)) === "rtl"
  const thumb = env.part("thumb").nth(0)
  // `contain`: thumbs stay inside, so the axis is shorter by one thumb.
  const contain = ((await thumb.attr("style")) ?? "").includes("--rind-slider-thumb-size")
  const thumbBox = contain ? await thumb.box() : null
  const size = vertical ? box.height : box.width
  const inset = thumbBox ? (vertical ? thumbBox.height : thumbBox.width) / 2 : 0
  const f = typeof target === "number" ? await fractionOfValue(env, target) : target.fraction
  const along = (inset + f * (size - 2 * inset)) / size
  return vertical ? { x: 0.5, y: 1 - along } : { x: rtl ? 1 - along : along, y: 0.5 }
}

type Kind = "mouse" | "touch"
type At = { readonly x: number; readonly y: number }
/**
 * The gesture in progress: its pointer type and where the pointer is, so `pointerUp` and
 * `cancelDrag` end it there (a real pointer released elsewhere would move first).
 */
let gesture: { kind: Kind; part: (env: E) => Part; at: At } | null = null

const pointerDown = (kind: Kind) => async (env: E, index: number) => {
  const thumb = env.part("thumb").nth(index)
  if (!(await thumb.box())) throw needsLayout("pointerDown")
  const at = { x: 0.5, y: 0.5 }
  gesture = { kind, part: (e) => e.part("thumb").nth(index), at }
  await thumb.pointer("down", { at, pointerType: kind })
}
const pointerMove = (kind: Kind) => async (env: E, target: SliderTarget) => {
  const at = await positionOf(env, target, "pointerMove")
  const pointerType = gesture?.kind ?? kind
  gesture = { kind: pointerType, part: (e) => e.part("control"), at }
  await env.part("control").pointer("move", { at, pointerType })
}
const pointerEnd = (kind: Kind, phase: "up" | "cancel") => async (env: E) => {
  if (!(await env.part("control").box()))
    throw needsLayout(phase === "up" ? "pointerUp" : "cancelDrag")
  const g = gesture ?? { kind, part: (e: E) => e.part("control"), at: { x: 0.5, y: 0.5 } }
  gesture = null
  await g.part(env).pointer(phase, { at: g.at, pointerType: g.kind })
}
const pressTrack = (kind: Kind) => async (env: E, value: number) => {
  const at = await positionOf(env, value, "pressTrack")
  gesture = null
  await env.part("control").pointer("down", { at, pointerType: kind })
  await env.part("control").pointer("up", { at, pointerType: kind })
}

/**
 * The arrow that increases or decreases on this Slider's axis, written for left-to-right:
 * drivers mirror horizontal arrows in right-to-left runs (`directional`).
 */
async function arrow(env: E, increase: boolean) {
  if ((await orientation(env)) === "vertical") return increase ? "ArrowUp" : "ArrowDown"
  return increase ? "ArrowRight" : "ArrowLeft"
}

export interface SliderStepOptions {
  /** Shift + arrow: `largeStep`. */
  readonly large?: boolean
  /** PageUp / PageDown instead of an arrow. */
  readonly page?: boolean
}
async function stepKey(
  env: E,
  index: number,
  dir: "increase" | "decrease",
  o: SliderStepOptions = {},
) {
  const input = env.part("hidden-input").nth(index)
  if (o.page) return input.press(dir === "increase" ? "PageUp" : "PageDown")
  return input.press(await arrow(env, dir === "increase"), { shift: o.large === true })
}

/** Steps until the thumb shows `value` or stops moving. */
async function stepTo(env: E, index: number, value: number) {
  const input = env.part("hidden-input").nth(index)
  for (let guard = 0; guard < 10_000; guard++) {
    const now = await num(input, "aria-valuenow")
    if (now === value) return
    await stepKey(env, index, value > now ? "increase" : "decrease")
    if ((await num(input, "aria-valuenow")) === now) return
  }
}

/** Values before an action, read by its postcondition (the runner is sequential). */
let before: readonly number[] = []
const recording =
  <A extends unknown[]>(fn: (env: E, ...args: A) => Promise<unknown>) =>
  async (env: E, ...args: A) => {
    before = await values(env)
    await fn(env, ...args)
  }

const ignoresChanges = async (env: E, index: number) =>
  (await env.part("hidden-input").nth(index).attr("disabled")) !== null ||
  (await env.part("root").attr("data-readonly")) !== null

/** Changed, unless the thumb ignores changes or already sat at the bound it moved toward. */
const steppedOrStuck = async (env: E, index: number) => {
  if ((await values(env)).join() !== before.join()) return true
  const input = env.part("hidden-input").nth(index)
  const v = await num(input, "aria-valuenow")
  return (
    (await ignoresChanges(env, index)) ||
    v === (await num(input, "aria-valuemin")) ||
    v === (await num(input, "aria-valuemax"))
  )
}

const sorted = (vs: readonly number[]) => vs.every((v, i) => i === 0 || v >= (vs[i - 1] ?? v))

/** Per-contract invariants (spec "Slider Invariants"; event counts are step invariants). */
export const sliderInvariants: readonly Invariant<P, string>[] = [
  {
    name: "slider-values-valid",
    check: async ({ env, props }) => {
      const vs = await values(env)
      const r = sliderRange(props)
      if (!sorted(vs)) return `values are not sorted: [${vs.join(", ")}]`
      for (const [i, v] of vs.entries()) {
        if (!(v >= r.min && v <= r.top)) return `value ${i} (${v}) is outside [${r.min}, ${r.top}]`
        const k = (v - r.min) / r.step
        if (Math.abs(k - Math.round(k)) > 1e-6) return `value ${i} (${v}) is off the step grid`
        const prev = vs[i - 1]
        if (prev !== undefined && v - prev < r.gap - 1e-9) {
          return `values ${i - 1} and ${i} are closer than the minimum gap ${r.gap}`
        }
      }
      return undefined
    },
  },
  {
    name: "slider-input-mirrors-aria",
    check: async ({ env, props }) => {
      const list = await inputs(env)
      const vs = await values(env)
      const r = sliderRange(props)
      for (const [i, input] of list.entries()) {
        const now = await input.attr("aria-valuenow")
        const value = await input.value()
        if (Number(value) !== Number(now))
          return `thumb input ${i} has value ${value}, aria-valuenow ${now}`
        const [lo, hi] = thumbBounds(vs, i, r)
        const [min, max] = [await num(input, "aria-valuemin"), await num(input, "aria-valuemax")]
        if (min !== lo || max !== hi) {
          return `thumb input ${i} has bounds [${min}, ${max}], its neighbours give [${lo}, ${hi}]`
        }
      }
      return undefined
    },
  },
  {
    name: "slider-one-slider-per-thumb",
    check: async ({ env }) => {
      const thumbs = await env.part("thumb").all()
      for (const [i, thumb] of thumbs.entries()) {
        const sliders = await thumb.withAttr("data-part", "hidden-input").count()
        if (sliders !== 1) return `thumb ${i} renders ${sliders} thumb inputs`
      }
      // Other sliders or focusable elements inside the Slider are a DOM step invariant
      // (`sliderStepInvariants` in @rind-ui/testing): the part API sees only parts.
      return undefined
    },
  },
  {
    name: "slider-no-nan-position",
    check: async ({ env }) => {
      for (const name of ["thumb", "indicator", "marker"] as const) {
        for (const p of await env.part(name).all()) {
          const style = (await p.attr("style")) ?? ""
          if (style.includes("NaN")) return `a ${name} position contains NaN: ${style}`
        }
      }
      return undefined
    },
  },
]

/** Why the drag steps have no keyboard implementation (WCAG 2.5.7's alternative is `step`). */
const DRAG_ONLY = "dragging is pointer-only; `step` is the 2.5.7 alternative"

const lastThumb = (view: { values: Record<string, unknown> }) =>
  Math.max(0, ((view.values["value"] as readonly number[] | undefined)?.length ?? 1) - 1)

const keyEvent = () => ({ thumb: 0, shift: false })

/** The Slider's contract (spec "Contract"). */
export const sliderContract = contract("slider", {
  machine: sliderMachine,
  anatomy: [
    "root",
    "label",
    "value-text",
    "control",
    "track",
    "indicator",
    "thumb",
    "hidden-input",
    "marker-group",
    "marker",
    "description",
  ],
  locate: ({ name }: { readonly name: string | RegExp }) => ({ role: "group", name }),
  actions: {
    focusThumb: {
      keyboard: async (env, index: number) => env.part("hidden-input").nth(index).focus(),
      done: async (env, index: number) => env.part("hidden-input").nth(index).isFocused(),
    },
    step: {
      keyboard: async (env, index: number, dir: "increase" | "decrease", o?: SliderStepOptions) =>
        recording(stepKey)(env, index, dir, o),
      done: async (env, index: number) => steppedOrStuck(env, index),
    },
    toEdge: {
      keyboard: async (env, index: number, edge: "min" | "max") =>
        env
          .part("hidden-input")
          .nth(index)
          .press(edge === "min" ? "Home" : "End"),
      done: async (env, index: number, edge: "min" | "max") => {
        if (await ignoresChanges(env, index)) return true
        const input = env.part("hidden-input").nth(index)
        const bound = edge === "min" ? "aria-valuemin" : "aria-valuemax"
        return (await num(input, "aria-valuenow")) === (await num(input, bound))
      },
    },
    setValue: {
      keyboard: async (env, index: number, value: number) => stepTo(env, index, value),
      pointer: async (env, index: number, value: number) => {
        await pointerDown("mouse")(env, index)
        await pointerMove("mouse")(env, value)
        await pointerEnd("mouse", "up")(env)
      },
      touch: async (env, index: number, value: number) => {
        await pointerDown("touch")(env, index)
        await pointerMove("touch")(env, value)
        await pointerEnd("touch", "up")(env)
      },
      done: { isDragging: false },
    },
    pressTrack: {
      pointer: async (env, value: number) => pressTrack("mouse")(env, value),
      touch: async (env, value: number) => pressTrack("touch")(env, value),
      // The keyboard twin: the nearest thumb, stepped to the value.
      keyboard: async (env, value: number) => {
        const vs = await values(env)
        let index = 0
        vs.forEach((v, i) => {
          if (Math.abs(v - value) < Math.abs((vs[index] ?? v) - value)) index = i
        })
        await stepTo(env, index, value)
      },
      done: { isDragging: false },
    },
    pointerDown: {
      pointer: async (env, index: number) => pointerDown("mouse")(env, index),
      touch: async (env, index: number) => pointerDown("touch")(env, index),
      none: { keyboard: DRAG_ONLY },
      done: async (env, _index: number) =>
        (await isDragging(env)) ||
        (await env.part("root").attr("data-disabled")) !== null ||
        (await env.part("root").attr("data-readonly")) !== null,
    },
    pointerMove: {
      pointer: async (env, target: SliderTarget) => pointerMove("mouse")(env, target),
      touch: async (env, target: SliderTarget) => pointerMove("touch")(env, target),
      none: { keyboard: DRAG_ONLY },
      done: async (_env, _target: SliderTarget) => true,
    },
    pointerUp: {
      pointer: async (env) => pointerEnd("mouse", "up")(env),
      touch: async (env) => pointerEnd("touch", "up")(env),
      none: { keyboard: DRAG_ONLY },
      done: { isDragging: false },
    },
    cancelDrag: {
      // Escape on the dragged thumb's input; the pointer twin is the browser's pointercancel.
      keyboard: async (env) => env.focused().press("Escape"),
      pointer: async (env) => pointerEnd("mouse", "cancel")(env),
      touch: async (env) => pointerEnd("touch", "cancel")(env),
      done: { isDragging: false },
    },
    adjustNative: {
      // Assistive technology sets the value with no key or pointer event (TalkBack, iOS VO).
      keyboard: async (env, index: number, value: number) =>
        env.part("hidden-input").nth(index).fill(String(value)),
      done: async () => true,
    },
    resetForm: {
      pointer: async (env) => env.find({ role: "button", name: "Reset" }).click(),
      keyboard: async (env) => env.find({ role: "button", name: "Reset" }).press("Enter"),
      // Back at the default: each input's `value` attribute.
      done: async (env) => {
        for (const input of await inputs(env)) {
          if ((await input.value()) !== (await input.attr("value"))) return false
        }
        return true
      },
    },
  },
  queries: {
    values,
    valueText: async (env, index: number) =>
      (await env.part("hidden-input").nth(index).attr("aria-valuetext")) ?? "",
    bounds: async (env, index: number) => {
      const input = env.part("hidden-input").nth(index)
      return [await num(input, "aria-valuemin"), await num(input, "aria-valuemax")] as const
    },
    // Focus is what it reads, so it is no state snapshot: the second parameter keeps the
    // runner from observing it (it reads only queries without arguments).
    focusedThumb: async (env, _driverOnly?: never) => {
      for (const [i, input] of (await inputs(env)).entries()) if (await input.isFocused()) return i
      return null
    },
    isDragging,
    orientation,
    /** What the thumb inputs would submit, in thumb order. */
    formValues: async (env) => {
      const out: string[] = []
      for (const input of await inputs(env)) {
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
    // A press on the last thumb (the first may be the disabled one): the value stays, so the
    // oracle needs no fraction.
    "POINTER.DOWN": {
      action: "pointerDown",
      args: ((view: { values: Record<string, unknown> }) => [lastThumb(view)]) as never,
      event: (view) => ({ thumb: lastThumb(view), fraction: null }),
    },
    // The middle of the track, which page and oracle map to the same value.
    "POINTER.MOVE": {
      action: "pointerMove",
      args: (() => [{ fraction: 0.5 }]) as never,
      event: () => ({ fraction: 0.5 }),
    },
    "POINTER.UP": "pointerUp",
    "DRAG.CANCEL": "cancelDrag",
    INCREASE: { action: "step", args: (() => [0, "increase"]) as never, event: keyEvent },
    DECREASE: { action: "step", args: (() => [0, "decrease"]) as never, event: keyEvent },
    PAGE_PREV: {
      action: "step",
      args: (() => [0, "increase", { page: true }]) as never,
      event: keyEvent,
    },
    PAGE_NEXT: {
      action: "step",
      args: (() => [0, "decrease", { page: true }]) as never,
      event: keyEvent,
    },
    FIRST: { action: "toEdge", args: (() => [0, "min"]) as never, event: keyEvent },
    LAST: { action: "toEdge", args: (() => [0, "max"]) as never, event: keyEvent },
    // 35 is inside the default range; the browser clamps it to the input's bounds like the
    // machine bounds it, so page and oracle agree for any range.
    "INPUT.CHANGE": {
      from: {
        idle: {
          action: "adjustNative",
          args: (() => [0, 35]) as never,
          event: () => ({ thumb: 0, value: 35 }),
        },
        dragging: { skip: "assistive technology does not adjust a thumb a pointer is dragging" },
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
  traits: ["valued", "directional", "form-associated", "field-associated"],
  valued: { values: (view) => (view.values["value"] as readonly number[] | undefined) ?? [] },
  semantics: { label: "label" },
  invariants: sliderInvariants,
  formInput: {
    multiple: true,
    accessible: true,
    expected: (vals, input) => {
      const vs = (vals["value"] as readonly number[] | undefined) ?? []
      return { value: String(vs[input?.index ?? 0]) }
    },
    // A reset dispatches nothing; an adjustment dispatches the browser's own change, once,
    // whatever the Slider does with it.
    silentEvents: ["RESET"],
    nativeEvents: ["INPUT.CHANGE"],
  },
})
