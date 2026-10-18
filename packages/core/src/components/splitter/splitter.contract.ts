// The Splitter's contract (spec "Contract", design §6): keyboard actions press real keys on a
// handle, pointer actions drive each machine step of a drag with the pointer steps of
// `test-drivers`, moving by a percent of the panels' space from the press.

import { contract, type Invariant } from "../../contract/contract"
import type { Env, Part } from "../../contract/env"
import { type SplitterMachineProps, splitterMachine, splitterSizes } from "./splitter.machine"

type P = "root" | "panel" | "handle"
type E = Env<P>

const num = async (p: Part, name: string) => Number(await p.attr(name))

const sizes = async (env: E): Promise<number[]> =>
  Promise.all((await env.part("panel").all()).map((p) => num(p, "data-size")))

const orientation = async (env: E): Promise<"horizontal" | "vertical"> =>
  (await env.part("root").attr("data-orientation")) === "vertical" ? "vertical" : "horizontal"
const isDragging = async (env: E) => (await env.part("root").attr("data-dragging")) !== null
const handle = (env: E, index: number) => env.part("handle").nth(index)

const needsLayout = (action: string) =>
  new Error(`${action}: the pointer step needs layout, which this environment does not have`)

type Kind = "mouse" | "touch"
type At = { readonly x: number; readonly y: number }
/**
 * The gesture in progress: the pressed handle, its pointer type, where the press landed
 * (fractions of the Root's box) and where the pointer is now (`null`: not moved yet).
 */
let gesture: { kind: Kind; index: number; origin: At | null; at: At | null } | null = null

/** The Root's box, the axis, the direction and the share of it the panels take. */
async function geometry(env: E, action: string) {
  const root = await env.part("root").box()
  if (!root || root.width === 0 || root.height === 0) throw needsLayout(action)
  const vertical = (await orientation(env)) === "vertical"
  const rtl = (await env.part("root").attr("dir")) === "rtl"
  let handles = 0
  for (const each of await env.part("handle").all()) {
    const b = await each.box()
    handles += b ? (vertical ? b.height : b.width) : 0
  }
  const size = vertical ? root.height : root.width
  return { root, vertical, rtl, share: (size - handles) / size }
}

/** The centre of handle `index`, in fractions of the Root's box. */
async function centreOf(env: E, index: number, action: string): Promise<At> {
  const { root } = await geometry(env, action)
  const h = await handle(env, index).box()
  if (!h) throw needsLayout(action)
  return {
    x: (h.x + h.width / 2 - root.x) / root.width,
    y: (h.y + h.height / 2 - root.y) / root.height,
  }
}

/** Where (fractions of the Root's box) the pointer is `delta` percent from `origin`. */
async function positionOf(env: E, origin: At, delta: number, action: string): Promise<At> {
  const { vertical, rtl, share } = await geometry(env, action)
  const move = (delta / 100) * share
  if (vertical) return { x: origin.x, y: origin.y + move }
  return { x: rtl ? origin.x - move : origin.x + move, y: origin.y }
}

const pointerDown = (kind: Kind) => async (env: E, index: number) => {
  if (!(await handle(env, index).box())) throw needsLayout("pointerDown")
  const origin = await centreOf(env, index, "pointerDown")
  gesture = { kind, index, origin, at: null }
  await handle(env, index).pointer("down", { at: { x: 0.5, y: 0.5 }, pointerType: kind })
}
const pointerMove = (kind: Kind) => async (env: E, delta: number) => {
  const g = gesture ?? { kind, index: 0, origin: null, at: null }
  const origin = g.origin ?? (await centreOf(env, g.index, "pointerMove"))
  const at = await positionOf(env, origin, delta, "pointerMove")
  gesture = { ...g, origin, at }
  await env.part("root").pointer("move", { at, pointerType: g.kind })
}
const pointerEnd = (kind: Kind, phase: "up" | "cancel") => async (env: E) => {
  const g = gesture ?? { kind, index: 0, origin: null, at: null }
  gesture = null
  if (g.at === null) {
    const h = handle(env, g.index)
    if (!(await h.box())) throw needsLayout(phase === "up" ? "pointerUp" : "cancelDrag")
    return h.pointer(phase, { at: { x: 0.5, y: 0.5 }, pointerType: g.kind })
  }
  await env.part("root").pointer(phase, { at: g.at, pointerType: g.kind })
}

/** The arrow that grows the primary panel, written for left-to-right (drivers mirror it). */
const growKey = async (env: E, grow: boolean) =>
  (await orientation(env)) === "vertical"
    ? grow
      ? "ArrowDown"
      : "ArrowUp"
    : grow
      ? "ArrowRight"
      : "ArrowLeft"

const value = (env: E, index: number) => num(handle(env, index), "aria-valuenow")
const ignoresChanges = async (env: E, index: number) =>
  (await handle(env, index).attr("aria-disabled")) === "true"

/** Values before an action, read by its postcondition (the runner is sequential). */
let before: readonly number[] = []

/** Changed, unless the handle ignores changes or its panel already sat at a bound. */
const changedOrStuck = async (env: E, index: number) => {
  if ((await sizes(env)).join() !== before.join()) return true
  const h = handle(env, index)
  const v = await num(h, "aria-valuenow")
  return (
    (await ignoresChanges(env, index)) ||
    v === (await num(h, "aria-valuemin")) ||
    v === (await num(h, "aria-valuemax"))
  )
}

/** Steps toward `target` (the primary panel's size) until there or stuck. */
async function stepTo(env: E, index: number, target: number) {
  for (let guard = 0; guard < 200; guard++) {
    const now = await value(env, index)
    if (Math.abs(now - target) < 1) return
    await handle(env, index).press(await growKey(env, target > now))
    const after = await value(env, index)
    if (after === now || (target > now ? after > target : after < target)) return
  }
}

/** Per-contract invariants (spec "Contract"). */
export const splitterInvariants: readonly Invariant<P, string>[] = [
  {
    name: "splitter-sizes-total",
    check: async ({ env }) => {
      const s = await sizes(env)
      const total = s.reduce((a, b) => a + b, 0)
      return s.length > 0 && Math.abs(total - 100) > 0.01
        ? `panel sizes sum to ${total}: [${s.join(", ")}]`
        : undefined
    },
  },
  {
    name: "splitter-value-in-bounds",
    check: async ({ env }) => {
      for (const [i, h] of (await env.part("handle").all()).entries()) {
        const [now, min, max] = [
          await num(h, "aria-valuenow"),
          await num(h, "aria-valuemin"),
          await num(h, "aria-valuemax"),
        ]
        if (!(min <= now && now <= max)) return `handle ${i}: ${now} outside [${min}, ${max}]`
      }
      return undefined
    },
  },
  {
    name: "splitter-controls-panel",
    check: async ({ env }) => {
      const ids = new Set<string | null>()
      for (const p of await env.part("panel").all()) ids.add(await p.attr("id"))
      for (const [i, h] of (await env.part("handle").all()).entries()) {
        const controls = await h.attr("aria-controls")
        if (!ids.has(controls)) return `handle ${i} controls "${controls}", no rendered panel`
      }
      return undefined
    },
  },
]

/** Why the drag steps have no keyboard implementation (2.5.7's alternative is `step`). */
const DRAG_ONLY = "dragging is pointer-only; `step` and `toEdge` are the keyboard path"

const keyEvent = () => ({ handle: 0 })

/** The Splitter's contract (spec "Contract"). */
export const splitterContract = contract("splitter", {
  machine: splitterMachine,
  anatomy: ["root", "panel", "handle"],
  locate: ({ name }: { readonly name: string | RegExp }) => ({ role: "separator", name }),
  actions: {
    focusHandle: {
      keyboard: async (env, index: number) => handle(env, index).focus(),
      done: async (env, index: number) => handle(env, index).isFocused(),
    },
    step: {
      keyboard: async (env, index: number, dir: "increase" | "decrease") => {
        before = await sizes(env)
        await handle(env, index).press(await growKey(env, dir === "increase"))
      },
      done: async (env, index: number) => changedOrStuck(env, index),
    },
    toEdge: {
      keyboard: async (env, index: number, edge: "min" | "max") =>
        handle(env, index).press(edge === "min" ? "Home" : "End"),
      done: async (env, index: number, edge: "min" | "max") => {
        if (await ignoresChanges(env, index)) return true
        const h = handle(env, index)
        const bound = edge === "min" ? "aria-valuemin" : "aria-valuemax"
        return (await num(h, "aria-valuenow")) === (await num(h, bound))
      },
    },
    toggleCollapse: {
      keyboard: async (env, index: number) => handle(env, index).press("Enter"),
      done: async () => true,
    },
    setSize: {
      keyboard: async (env, index: number, size: number) => stepTo(env, index, size),
      pointer: async (env, index: number, size: number) => {
        const delta = size - (await value(env, index))
        await pointerDown("mouse")(env, index)
        await pointerMove("mouse")(env, delta)
        await pointerEnd("mouse", "up")(env)
      },
      touch: async (env, index: number, size: number) => {
        const delta = size - (await value(env, index))
        await pointerDown("touch")(env, index)
        await pointerMove("touch")(env, delta)
        await pointerEnd("touch", "up")(env)
      },
      done: { isDragging: false },
    },
    pointerDown: {
      pointer: async (env, index: number) => pointerDown("mouse")(env, index),
      touch: async (env, index: number) => pointerDown("touch")(env, index),
      none: { keyboard: DRAG_ONLY },
      done: async (env, index: number) =>
        (await isDragging(env)) || (await ignoresChanges(env, index)),
    },
    pointerMove: {
      pointer: async (env, delta: number) => pointerMove("mouse")(env, delta),
      touch: async (env, delta: number) => pointerMove("touch")(env, delta),
      none: { keyboard: DRAG_ONLY },
      done: async (_env, _delta: number) => true,
    },
    pointerUp: {
      pointer: async (env) => pointerEnd("mouse", "up")(env),
      touch: async (env) => pointerEnd("touch", "up")(env),
      none: { keyboard: DRAG_ONLY },
      done: { isDragging: false },
    },
    cancelDrag: {
      // Escape on the dragged handle; the pointer twin is the browser's pointercancel.
      keyboard: async (env) => env.focused().press("Escape"),
      pointer: async (env) => pointerEnd("mouse", "cancel")(env),
      touch: async (env) => pointerEnd("touch", "cancel")(env),
      done: { isDragging: false },
    },
  },
  queries: {
    sizes,
    isDragging,
    orientation,
    // Arguments keep these out of state snapshots: drivers read them.
    isCollapsed: async (env, index: number) =>
      (await env.part("panel").nth(index).attr("data-state")) === "collapsed",
    bounds: async (env, index: number) => {
      const h = handle(env, index)
      return [await num(h, "aria-valuemin"), await num(h, "aria-valuemax")] as const
    },
  },
  states: {
    idle: { isDragging: false },
    dragging: { isDragging: true },
  },
  events: {
    "POINTER.DOWN": {
      action: "pointerDown",
      args: (() => [0]) as never,
      event: () => ({ handle: 0, modality: "pointer" }),
    },
    // 10 % of the panels' space: away from the collapse thresholds of the model fixtures.
    "POINTER.MOVE": {
      action: "pointerMove",
      args: (() => [10]) as never,
      event: () => ({ delta: 10 }),
    },
    "POINTER.UP": "pointerUp",
    "DRAG.CANCEL": "cancelDrag",
    STEP: {
      action: "step",
      args: (() => [0, "increase"]) as never,
      event: () => ({ handle: 0, direction: 1 }),
    },
    TO_EDGE: {
      action: "toEdge",
      args: (() => [0, "max"]) as never,
      event: () => ({ handle: 0, edge: "max" }),
    },
    TOGGLE: { action: "toggleCollapse", args: (() => [0]) as never, event: keyEvent },
    "LAYOUT.SYNCED": { skip: "a constraint change: the parent's prop (a group resize)" },
    FOCUS: { skip: "not a user event: focus alone changes no size" },
    BLUR: { skip: "not a user event" },
    "$props:panels": { skip: "the parent's prop change; covered by the browser tests" },
    "$props:disabled": { skip: "disabled mid-drag is a scenario test (a re-render during a drag)" },
  },
  traits: ["valued", "directional"],
  valued: {
    values: (view, props) => {
      // Sound: the model test's oracle is this machine, so its props are SplitterMachineProps.
      const machineProps = props as unknown as SplitterMachineProps
      const s = splitterSizes(machineProps, view.values["sizes"] as readonly number[] | undefined)
      return s.slice(0, -1).map((v) => Math.round(v))
    },
  },
  invariants: splitterInvariants,
})
