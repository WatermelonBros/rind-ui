// The Rating's contract (spec "Contract"): keyboard actions press real keys on the range
// input, pointer actions press a star (its first half for a half value, mirrored in RTL),
// `hover` previews, and `adjustNative` sets the range input as assistive technology does.

import { contract, type Invariant } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { type RatingMachineProps, ratingMachine, ratingRange } from "./rating.machine"

type P = "root" | "label" | "control" | "item" | "input" | "hidden-input"
type E = Env<P>

const input = (env: E) => env.part("input")
const num = async (env: E, name: string) => Number(await input(env).attr(name))
const value = (env: E) => num(env, "aria-valuenow")
const rtl = async (env: E) => (await env.part("root").attr("dir")) === "rtl"
const ignoresChanges = async (env: E) =>
  (await input(env).attr("disabled")) !== null ||
  (await env.part("root").attr("data-readonly")) !== null
const isPreviewing = async (env: E) => (await env.part("root").attr("data-previewing")) !== null

/** The star a value is pressed on, and where across it (fractions of its box). */
async function spot(env: E, v: number) {
  const index = Math.ceil(v)
  const half = index - v === 0.5
  // A quarter into the half that means `v`: clear of the middle, where rounding decides.
  const x = half ? 0.25 : 0.75
  return { star: env.part("item").nth(index - 1), at: { x: (await rtl(env)) ? 1 - x : x, y: 0.5 } }
}

/**
 * Presses the star of `v` where `v` lies (0: the current value's star, clearing it with
 * allowClear). Without layout a plain click lands on a zero-size star: a whole star.
 */
const press = (kind: "mouse" | "touch") => async (env: E, v: number) => {
  const { star, at } = await spot(env, v === 0 ? await value(env) : v)
  const box = await star.box()
  const placeless = env.modality === "virtual" || !box || box.width === 0
  if (placeless && !Number.isInteger(v))
    throw new Error("rate: a half-star press needs layout, which this environment does not have")
  // Assistive technology activates with a bare click: a whole star, with no position.
  if (env.modality === "virtual") return star.click()
  if (!box || box.width === 0) return kind === "touch" ? star.tap() : star.click()
  await star.pointer("down", { at, pointerType: kind })
  await star.pointer("up", { at, pointerType: kind })
}

/** The arrow that increases, written for left-to-right: drivers mirror it in RTL runs. */
const arrow = (increase: boolean) => (increase ? "ArrowRight" : "ArrowLeft")

/** Focuses the input, then steps until it shows `v` or stops moving. */
async function stepTo(env: E, v: number) {
  await input(env).focus()
  for (let guard = 0; guard < 100; guard++) {
    const now = await value(env)
    if (now === v) return
    await input(env).press(arrow(v > now))
    if ((await value(env)) === now) return
  }
}

/** Per-contract invariants (spec "Rating Invariants"). */
export const ratingInvariants: readonly Invariant<P, string>[] = [
  {
    name: "rating-value-on-grid",
    check: async ({ env, props }) => {
      const v = await value(env)
      const r = ratingRange(props)
      if (!(v >= 0 && v <= r.count)) return `value ${v} is outside [0, ${r.count}]`
      if (Math.abs(v / r.step - Math.round(v / r.step)) > 1e-9) return `value ${v} is off the grid`
      return undefined
    },
  },
  {
    // The stars draw the value (or the preview), the inputs carry it.
    name: "rating-stars-and-inputs-agree",
    check: async ({ env }) => {
      const v = await value(env)
      if (Number(await input(env).value()) !== v) {
        return `the range input has value ${await input(env).value()}, aria-valuenow ${v}`
      }
      const carried = await env.part("hidden-input").value()
      if (carried !== (v === 0 ? "" : String(v))) return `the form carries "${carried}" for ${v}`
      if (await isPreviewing(env)) return undefined
      for (const [i, star] of (await env.part("item").all()).entries()) {
        const want = v >= i + 1 ? "full" : v >= i + 0.5 ? "half" : "empty"
        const have = await star.attr("data-state")
        if (have !== want) return `star ${i + 1} is ${have}, expected ${want} at ${v}`
      }
      return undefined
    },
  },
]

const HOVER_ONLY = "the preview follows a hovering pointer; the keyboard changes the value itself"

/** The Rating's contract (spec "Contract"). */
export const ratingContract = contract("rating", {
  machine: ratingMachine,
  anatomy: ["root", "label", "control", "item", "input", "hidden-input"],
  locate: ({ name }: { readonly name: string | RegExp }) => ({ role: "slider", name }),
  actions: {
    focus: {
      keyboard: async (env) => input(env).focus(),
      done: async (env) => input(env).isFocused(),
    },
    /** Sets the value: a press on its star, or the arrows from the current value. */
    rate: {
      pointer: async (env, v: number) => press("mouse")(env, v),
      touch: async (env, v: number) => press("touch")(env, v),
      keyboard: async (env, v: number) => stepTo(env, v),
      done: async (env, v: number) => (await value(env)) === v || (await ignoresChanges(env)),
    },
    /** One press on star `index` (1-based) at its middle: the PRESS mapping. */
    pressStar: {
      pointer: async (env, index: number) => press("mouse")(env, index),
      touch: async (env, index: number) => press("touch")(env, index),
      none: { keyboard: "a star is no key target: `step` and `rate` are the keyboard twins" },
      done: async () => true,
    },
    step: {
      keyboard: async (env, dir: "increase" | "decrease") =>
        input(env).press(arrow(dir === "increase")),
      done: async () => true,
    },
    toEdge: {
      keyboard: async (env, edge: "first" | "last") =>
        input(env).press(edge === "first" ? "Home" : "End"),
      done: async () => true,
    },
    /** A pointer over star `index` (1-based), on its first half when `half`. */
    hover: {
      pointer: async (env, index: number, half?: boolean) => {
        const x = half ? 0.25 : 0.75
        const at = { x: (await rtl(env)) ? 1 - x : x, y: 0.5 }
        const star = env.part("item").nth(index - 1)
        // Onto the star first (a tracked move), so the pointer's way out later leaves it.
        await star.hover()
        await star.pointer("move", { at })
      },
      none: { keyboard: HOVER_ONLY },
      done: async () => true,
    },
    leave: {
      pointer: async (env) => env.pointerAway(),
      none: { keyboard: HOVER_ONLY },
      done: { isPreviewing: false },
    },
    adjustNative: {
      // Assistive technology sets the value with no key or pointer event (TalkBack, iOS VO):
      // a touch screen reader's swipe, so no keyboard focus ring follows.
      touch: async (env, v: number) => input(env).fill(String(v)),
      none: { keyboard: "a keyboard changes the value by keys: `step`" },
      done: async () => true,
    },
    resetForm: {
      pointer: async (env) => env.find({ role: "button", name: "Reset" }).click(),
      keyboard: async (env) => env.find({ role: "button", name: "Reset" }).press("Enter"),
      done: async (env) =>
        (await env.part("hidden-input").value()) ===
        ((await env.part("hidden-input").attr("value")) ?? ""),
    },
  },
  queries: {
    value,
    valueText: async (env) => (await input(env).attr("aria-valuetext")) ?? "",
    /** Each star's `data-state`, in order. */
    stars: async (env) => {
      const out: string[] = []
      for (const star of await env.part("item").all())
        out.push((await star.attr("data-state")) ?? "")
      return out
    },
    isPreviewing,
    isDisabled: async (env) => (await input(env).attr("disabled")) !== null,
    isReadOnly: async (env) => (await input(env).attr("aria-readonly")) === "true",
    /** What the owning form would submit: [name, value] while named and enabled. */
    formValue: async (env) => {
      const carrier = env.part("hidden-input")
      const name = await carrier.attr("name")
      if (name === null || (await carrier.attr("disabled")) !== null) return null
      return [name, await carrier.value()] as const
    },
  },
  states: {
    idle: { isPreviewing: false },
    previewing: { isPreviewing: true },
  },
  events: {
    // The second star's second half: the value 2 on any grid.
    "POINTER.MOVE": {
      action: "hover",
      args: (() => [2]) as never,
      event: () => ({ index: 2, fraction: 0.75 }),
    },
    "POINTER.LEAVE": "leave",
    // The second half of star 3: the value 3 on any grid (or 0 when allowClear and already 3).
    PRESS: {
      action: "pressStar",
      args: (() => [3]) as never,
      event: () => ({ index: 3, fraction: 0.75 }),
    },
    INCREASE: { action: "step", args: (() => ["increase"]) as never },
    DECREASE: { action: "step", args: (() => ["decrease"]) as never },
    FIRST: { action: "toEdge", args: (() => ["first"]) as never },
    LAST: { action: "toEdge", args: (() => ["last"]) as never },
    PAGE_PREV: { skip: "PageUp is a whole-star INCREASE: covered by the machine and DOM tests" },
    PAGE_NEXT: { skip: "PageDown is a whole-star DECREASE: covered by the machine and DOM tests" },
    // 2 is on every grid; the browser clamps like the machine does.
    "INPUT.CHANGE": {
      action: "adjustNative",
      args: (() => [2]) as never,
      event: () => ({ value: 2 }),
    },
    RESET: "resetForm",
    FOCUS: { skip: "not a user event: focus alone changes no value" },
    BLUR: { skip: "not a user event" },
    "VALUE.SYNCED": { skip: "the parent's prop change; walked by the controlled configuration" },
    "$props:value": { skip: "the parent's prop change; walked by the controlled configuration" },
    "$props:disabled": { skip: "a prop change: covered by the DOM tests" },
    "$props:readOnly": { skip: "a prop change: covered by the DOM tests" },
  },
  traits: ["valued", "directional", "form-associated", "field-associated"],
  valued: {
    values: (view) => [(view.values["value"] as number | undefined) ?? 0],
    valueText: (view, _i, props) => {
      const v = (view.values["value"] as number | undefined) ?? 0
      // The oracle's props are the machine's, typed loosely by the runner.
      const { count } = ratingRange(props as RatingMachineProps)
      return v === 0 ? "No rating" : `${v} of ${count} stars`
    },
  },
  semantics: { label: "label" },
  invariants: ratingInvariants,
  formInput: {
    accessible: false,
    expected: (vals) => {
      const v = (vals["value"] as number | undefined) ?? 0
      return { value: v === 0 ? "" : String(v) }
    },
    silentEvents: ["RESET"],
  },
})
