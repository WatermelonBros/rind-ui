import { contract, type Invariant } from "../../contract/contract"
import type { Env, Part } from "../../contract/env"
import { toggleGroupMachine } from "./toggle-group.machine"

type P = "root" | "item"
type E = Env<P>

/** The item an item event acts on, per argument class (set by a model test). */
export const toggleGroupArgs: { current: { readonly key: string; readonly label: string } } = {
  current: { key: "", label: "" },
}

const item = (env: E, name: string | RegExp) => env.part("item", { role: "button", name })
const items = (env: E) => env.part("item").all()
const names = async (list: readonly Part[]) => {
  const out: string[] = []
  for (const p of list) out.push(await p.accessibleName())
  return out
}
const pressedItems = async (env: E) => {
  const out: Part[] = []
  for (const p of await items(env)) if ((await p.attr("aria-pressed")) === "true") out.push(p)
  return out
}
const inert = async (p: Part) =>
  (await p.attr("disabled")) !== null || (await p.attr("aria-disabled")) === "true"

/** The pressed state before a toggle, read by its postcondition (the runner is sequential). */
let before: string | null = null

/** Per-component invariant (spec "Contract"): explicit aria-pressed = the oracle's value. */
export const toggleGroupInvariants: readonly Invariant<P, string>[] = [
  {
    name: "toggle-group-aria-pressed",
    check: async ({ env, props, values }) => {
      const want = new Set((values["value"] as readonly string[] | undefined) ?? [])
      let pressed = 0
      for (const p of await items(env)) {
        const a = await p.attr("aria-pressed")
        if (a !== "true" && a !== "false")
          return `${await p.accessibleName()} has no explicit aria-pressed`
        const key = (await p.attr("data-key")) ?? ""
        if ((a === "true") !== want.has(key)) {
          return `"${await p.accessibleName()}" is ${a === "true" ? "" : "not "}pressed; the value is ${JSON.stringify([...want])}`
        }
        if (a === "true") pressed += 1
      }
      return props["selectionMode"] !== "multiple" && pressed > 1
        ? `${pressed} items are pressed in single mode`
        : undefined
    },
  },
  {
    // The root is never the tab stop while an item is navigable (spec "Tab Stop And Focus").
    name: "toggle-group-item-tab-stop",
    check: async ({ env }) => {
      if ((await env.part("root").attr("tabindex")) !== "0") return undefined
      for (const p of await items(env)) {
        if (!(await inert(p))) return "the root is a tab stop while an item is navigable"
      }
      return undefined
    },
  },
]

/** The Toggle Group's contract (spec "Contract"). */
export const toggleGroupContract = contract("toggle-group", {
  machine: toggleGroupMachine,
  anatomy: ["root", "item"],
  locate: ({ name }: { readonly name: string | RegExp }) => ({ role: "group", name }),
  actions: {
    toggle: {
      pointer: async (env, name: string | RegExp) => {
        before = await item(env, name).attr("aria-pressed")
        await item(env, name).click()
      },
      touch: async (env, name: string | RegExp) => {
        before = await item(env, name).attr("aria-pressed")
        await item(env, name).tap()
      },
      // Arrows to the item (bounded: one cycle), then Space.
      keyboard: async (env, name: string | RegExp) => {
        const target = item(env, name)
        before = await target.attr("aria-pressed")
        if ((await target.attr("disabled")) !== null) return
        const all = await items(env)
        let stop: Part | undefined
        for (const p of all) if ((await p.attr("tabindex")) === "0") stop = p
        await (stop ?? target).focus()
        for (let i = 0; i <= all.length && !(await target.isFocused()); i++) {
          const vertical = (await env.part("root").attr("data-orientation")) === "vertical"
          await env.keyboard(vertical ? "ArrowDown" : "ArrowRight")
        }
        // A disabled item never takes focus: Space would press another one.
        if (await target.isFocused()) await target.press("Space")
      },
      // Flipped, unless the item ignores activation (or the only pressed one stays).
      done: async (env, name: string | RegExp) => {
        const p = item(env, name)
        return (await inert(p)) || (await p.attr("aria-pressed")) !== before || before === "true"
      },
    },
    /** One activation of the item (the PRESS mapping; `toggle` arrows for the driver). */
    press: {
      pointer: async (env, name: string | RegExp) => item(env, name).click(),
      touch: async (env, name: string | RegExp) => item(env, name).tap(),
      keyboard: async (env, name: string | RegExp) => {
        const p = item(env, name)
        await p.focus()
        await p.press("Space")
      },
      done: async () => true,
    },
    focusItem: {
      // Focus alone never presses: Tab, a script, a dialog or the AT cursor.
      keyboard: async (env, name: string | RegExp) => item(env, name).focus(),
      done: async () => true,
    },
    arrowNext: {
      keyboard: async (env) => {
        const vertical = (await env.part("root").attr("data-orientation")) === "vertical"
        await env.keyboard(vertical ? "ArrowDown" : "ArrowRight")
      },
      done: async () => true,
    },
    leave: {
      keyboard: async (env) => env.find({ role: "button", name: "After" }).focus(),
      done: async () => true,
    },
  },
  queries: {
    items: async (env) => names(await items(env)),
    pressed: async (env) => names(await pressedItems(env)),
    focusedItem: async (env) => {
      const f = env.focused()
      if (!(await f.exists()) || (await f.attr("data-part")) !== "item") return null
      return f.accessibleName()
    },
    isDisabled: async (env, name: string | RegExp) => inert(item(env, name)),
  },
  states: { idle: {}, focused: {} },
  events: {
    PRESS: {
      action: "press",
      // The mapping's args type misses the action's own arguments (text-field's gap).
      args: (() => [toggleGroupArgs.current.label]) as never,
      event: () => ({ key: toggleGroupArgs.current.key }),
    },
    FOCUS: {
      action: "focusItem",
      args: (() => [toggleGroupArgs.current.label]) as never,
      event: () => ({ key: toggleGroupArgs.current.key }),
    },
    NAVIGATE: { action: "arrowNext", event: () => ({ move: "next" }) },
    BLUR: "leave",
    "COLLECTION.CHANGE": { skip: "items are static parts: covered by the DOM tests" },
    "$props:collection": { skip: "items are static parts: covered by the DOM tests" },
  },
  traits: ["composite-roving", "directional"],
  // Focus enters the group (idle → focused) and moves focusedItem; it never presses (the
  // aria-pressed invariant compares every item with the oracle's value after each step).
  commitsOnFocus: [
    { part: "item", state: "idle" },
    { part: "item", state: "focused" },
  ],
  invariants: toggleGroupInvariants,
})
