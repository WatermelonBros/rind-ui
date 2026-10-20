import { contract } from "../../contract/contract"
import type { Env, Key } from "../../contract/env"
import { sortableMachine } from "./sortable.machine"

type P = "root" | "item" | "handle" | "indicator" | "move-button"
type E = Env<P>

/** The handle of the item whose handle is named "<prefix> <label>". */
const handleOf = async (env: E, label: string) => {
  for (const h of await env.part("handle").all()) {
    if ((await h.accessibleName()).endsWith(` ${label}`)) return h
  }
  throw new Error(`sortable: no handle for "${label}"`)
}
const step = async (env: E): Promise<{ next: Key; prev: Key }> =>
  (await env.part("root").attr("data-orientation")) === "horizontal"
    ? { next: "ArrowRight", prev: "ArrowLeft" }
    : { next: "ArrowDown", prev: "ArrowUp" }

/** Sortable's contract (spec "Contract"): located by the Root's name. */
export const sortableContract = contract("sortable", {
  machine: sortableMachine,
  anatomy: ["root", "item", "handle", "indicator", "move-button"],
  locate: (anchor?: { readonly name: string | RegExp }) =>
    anchor
      ? { role: ["list", "group", "grid", "tablist", "listbox"], name: anchor.name }
      : { part: "root" },
  actions: {
    /** Picks the item up by its handle (Space). */
    pickUp: {
      pointer: async (env, label: string) => {
        const h = await handleOf(env, label)
        await h.focus()
        await h.press("Space")
      },
      keyboard: async (env, label: string) => {
        const h = await handleOf(env, label)
        await h.focus()
        await h.press("Space")
      },
      done: async (): Promise<boolean> => true,
    },
    /** Moves the picked-up item `steps` positions (negative: back). */
    move: {
      pointer: async (env, steps: number) => {
        const { next, prev } = await step(env)
        for (let i = 0; i < Math.abs(steps); i++) await env.keyboard(steps > 0 ? next : prev)
      },
      keyboard: async (env, steps: number) => {
        const { next, prev } = await step(env)
        for (let i = 0; i < Math.abs(steps); i++) await env.keyboard(steps > 0 ? next : prev)
      },
      done: async (): Promise<boolean> => true,
    },
    drop: {
      pointer: async (env) => env.keyboard("Space"),
      keyboard: async (env) => env.keyboard("Space"),
      done: async (): Promise<boolean> => true,
    },
    cancel: {
      pointer: async (env) => env.keyboard("Escape"),
      keyboard: async (env) => env.keyboard("Escape"),
      done: async (): Promise<boolean> => true,
    },
    /** One place without a pick-up: Alt+Arrow, or the move buttons by pointer. */
    quickMove: {
      pointer: async (env, label: string, steps: number) => {
        for (let i = 0; i < Math.abs(steps); i++) {
          const name = `Move ${label} ${steps > 0 ? "down" : "up"}`
          await env.part("move-button", { role: "button", name }).click()
        }
      },
      keyboard: async (env, label: string, steps: number) => {
        const { next, prev } = await step(env)
        const h = await handleOf(env, label)
        await h.focus()
        for (let i = 0; i < Math.abs(steps); i++) {
          await h.press(steps > 0 ? next : prev, { alt: true })
        }
      },
      done: async (): Promise<boolean> => true,
    },
    /**
     * A pointer drag of the item's handle that carries the item's centre `steps` item sizes
     * along the axis (a quarter more, past the neighbour's midpoint).
     */
    drag: {
      pointer: async (env, label: string, steps: number) => {
        const h = await handleOf(env, label)
        const horizontal = (await env.part("root").attr("data-orientation")) === "horizontal"
        let item = null
        for (const it of await env.part("item").all()) {
          if ((await it.text()).includes(label)) item = await it.box()
        }
        const grip = await h.box()
        if (!item || !grip) throw new Error(`sortable: "${label}" has no box`)
        const size = horizontal ? item.width : item.height
        const from = horizontal ? grip.x + grip.width / 2 : grip.y + grip.height / 2
        const centre = horizontal ? item.x + item.width / 2 : item.y + item.height / 2
        const d = centre + steps * size + Math.sign(steps) * size * 0.25 - from
        await h.drag(horizontal ? { x: d, y: 0 } : { x: 0, y: d })
      },
      none: { keyboard: "pickUp, move and drop" },
      done: async (): Promise<boolean> => true,
    },
  },
  queries: {
    /** The items' labels in DOM order (from their handles). */
    order: async (env: E) => {
      const out: string[] = []
      for (const item of await env.part("item").all())
        out.push((await item.attr("data-value")) ?? "")
      return out
    },
    /** The picked-up or dragged key ("" when none). */
    active: async (env: E) => {
      for (const item of await env.part("item").all()) {
        if ((await item.attr("data-active")) !== null) return (await item.attr("data-value")) ?? ""
      }
      return ""
    },
    /** Whether some handle is pressed (a keyboard pick-up). */
    pressed: async (env: E) => {
      for (const h of await env.part("handle").all())
        if ((await h.attr("aria-pressed")) === "true") return true
      return false
    },
  },
  states: { idle: {}, moving: {}, dragging: {} },
  events: {
    PICK: { action: "pickUp", args: (() => ["Apple"]) as never, event: () => ({ key: "apple" }) },
    MOVE: { action: "move", args: (() => [1]) as never, event: () => ({ by: 1 }) },
    "MOVE.TO": { skip: "Home / End: the DOM tests" },
    DROP: "drop",
    CANCEL: "cancel",
    QUICK: {
      action: "quickMove",
      args: (() => ["Apple", 1]) as never,
      event: () => ({ key: "apple", by: 1 }),
    },
    "DRAG.START": { skip: "a drag is start, moves and end in one gesture: the DOM tests" },
    "DRAG.OVER": { skip: "part of a drag: the DOM tests" },
    "DRAG.END": { skip: "part of a drag: the DOM tests" },
    "ITEMS.SYNCED": { skip: "the consumer's items: the DOM tests" },
    "$props:items": { skip: "the consumer's order: the DOM tests" },
  },
  traits: [],
  // Moving focus off the picked-up handle drops it (spec "Keyboard Reorder"): focusing another
  // handle or a move button while moving commits; `pressed` reads it.
  commitsOnFocus: [
    ...(["idle", "moving"] as const).map((state) => ({ part: "handle" as const, state })),
    { part: "move-button" as const, state: "moving" as const },
  ],
})
