import { contract, type Invariant } from "../../contract/contract"
import type { AriaRole, Env } from "../../contract/env"
import { marqueeMachine } from "./marquee.machine"

type P = "root" | "pause-trigger" | "viewport" | "content"
type E = Env<P>

const state = async (env: E) => (await env.part("root").attr("data-state")) ?? ""
const isPaused = async (env: E) => {
  const t = env.part("pause-trigger")
  return (await t.exists()) && (await t.attr("data-paused")) !== null
}
const copies = async (env: E) => env.part("content").count()

/**
 * Marquee invariants (spec "Marquee Invariants"): one exposed copy, the rest hidden (no tab
 * stop inside them is axe's `aria-hidden-focus`, run with every model step); the trigger's name agrees with the pause; `static` has one copy and no trigger;
 * `running` is neither user-paused nor hovered-paused.
 */
const invariants: readonly Invariant<P>[] = [
  {
    name: "marquee-one-exposed-copy",
    check: async ({ env }) => {
      let exposed = 0
      for (const c of await env.part("content").all()) {
        if ((await c.attr("aria-hidden")) !== "true") {
          exposed++
          continue
        }
        if ((await c.attr("data-copy")) === null) return "a hidden copy has no data-copy"
      }
      return exposed === 1 ? undefined : `${exposed} copies are exposed`
    },
  },
  {
    name: "marquee-trigger-name-agrees",
    check: async ({ env }) => {
      const t = env.part("pause-trigger")
      if (!(await t.exists()) || (await t.attr("hidden")) !== null) return undefined
      const paused = (await t.attr("data-paused")) !== null
      const name = await t.accessibleName()
      return /play/i.test(name) === paused ? undefined : `"${name}" while paused=${paused}`
    },
  },
  {
    name: "marquee-static-is-still",
    check: async ({ env }) => {
      if ((await state(env)) !== "static") return undefined
      if ((await copies(env)) !== 1) return "static with more than one copy"
      const t = env.part("pause-trigger")
      if ((await t.exists()) && (await t.attr("hidden")) === null) return "static with a trigger"
      return undefined
    },
  },
]

/**
 * Marquee's contract (spec "Contract"): the Root has no role of its own; located by
 * `data-part="root"`, or by the role and name the consumer gave it.
 */
export const marqueeContract = contract("marquee", {
  machine: marqueeMachine,
  anatomy: ["root", "pause-trigger", "viewport", "content"],
  locate: (anchor?: { readonly name: string | RegExp; readonly role?: AriaRole }) =>
    anchor ? { role: anchor.role ?? "region", name: anchor.name } : { part: "root" },
  actions: {
    /** The first measurement lands on the next animation frame (advanced on a fake clock). */
    measure: {
      pointer: async (env) => env.advance(20),
      keyboard: async (env) => env.advance(20),
      done: async () => true,
    },
    togglePause: {
      pointer: async (env) => env.part("pause-trigger").click(),
      keyboard: async (env) => {
        await env.part("pause-trigger").focus()
        await env.part("pause-trigger").press("Enter")
      },
      done: async () => true,
    },
    hover: {
      pointer: async (env) => env.part("viewport").hover(),
      none: { keyboard: "a hover is a pointer gesture", touch: "a touch never hovers" },
      done: async () => true,
    },
    leave: {
      pointer: async (env) => env.pointerAway(),
      none: { keyboard: "a hover is a pointer gesture", touch: "a touch never hovers" },
      done: async () => true,
    },
    /** Focus into the band: Tab from the trigger, or the element by role and name. */
    focusContent: {
      keyboard: async (
        env,
        target?: { readonly role: AriaRole; readonly name: string | RegExp },
      ) => {
        if (target) {
          await env.find(target).focusWithTab()
          return
        }
        await env.part("pause-trigger").focus()
        await env.keyboard("Tab")
      },
      done: async () => true,
    },
  },
  queries: {
    state,
    isPaused,
    triggerLabel: async (env: E) => env.part("pause-trigger").accessibleName(),
    copies,
    /** `--rind-marquee-duration` on the Viewport, in seconds (null before a measurement). */
    duration: async (env: E) => {
      const style = (await env.part("viewport").attr("style")) ?? ""
      const m = /--rind-marquee-duration:\s*([\d.]+)s/.exec(style)
      return m?.[1] === undefined ? null : Number(m[1])
    },
  },
  states: {
    // Idle lasts until the first frame's measurement, which any wait for a step may run, so
    // it is not checked; the pause and hover the oracle carries are, once measured.
    idle: {},
    running: { state: "running" },
    paused: { state: "paused" },
    static: { state: "static" },
  },
  events: {
    "TRIGGER.PRESS": "togglePause",
    "POINTER.ENTER": "hover",
    "POINTER.LEAVE": "leave",
    "FOCUS.ENTER": "focusContent",
    // The model's fake layout: a 400 px viewport, a 150 px copy (see marquee.model tests).
    MEASURED: { action: "measure", event: () => ({ viewport: 400, content: 150 }) },
    "MOTION.CHANGED": {
      skip: "the Environment's MotionPreference: the reduced-motion configuration",
    },
    "PAUSED.SYNCED": { skip: "the parent's prop change: the controlled DOM tests" },
    "$props:paused": { skip: "the parent's prop change: the controlled DOM tests" },
    "$props:pauseOnHover": { skip: "a prop change: the machine tests" },
    SETTLE: { skip: "internal: follows every other event" },
  },
  traits: ["directional"],
  invariants,
})
