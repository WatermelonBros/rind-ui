import { contract, type Invariant } from "../../contract/contract"
import type { Env, Part } from "../../contract/env"
import { toolbarMachine } from "./toolbar.machine"

type P = "root" | "button" | "link" | "item" | "group" | "separator"
type E = Env<P>

/** The control a FOCUS / PRESS step acts on, per argument class (set by a model test). */
export const toolbarArgs: { current: { readonly label: string } } = { current: { label: "" } }

/** Every control in document order: the toolbar's own and hosted items (`data-host`). */
const controls = (env: E) => env.part("root").withAttr("data-host", "toolbar").all()
const named = async (env: E, name: string | RegExp): Promise<Part | undefined> => {
  for (const c of await controls(env)) {
    const n = await c.accessibleName()
    if (typeof name === "string" ? n === name : name.test(n)) return c
  }
  return undefined
}
const control = async (env: E, name: string | RegExp): Promise<Part> => {
  const c = await named(env, name)
  if (!c) throw new Error(`toolbar: no control named ${String(name)}`)
  return c
}
const names = async (list: readonly Part[]) => {
  const out: string[] = []
  for (const p of list) out.push(await p.accessibleName())
  return out
}
const inert = async (p: Part) =>
  (await p.attr("disabled")) !== null || (await p.attr("aria-disabled")) === "true"
const vertical = async (env: E) => (await env.part("root").attr("aria-orientation")) === "vertical"
const focusedName = async (env: E) => {
  const f = env.focused()
  if (!(await f.exists()) || (await f.attr("data-host")) !== "toolbar") return null
  return f.accessibleName()
}

/** Arrows from the focused control until `name` is focused (bounded: one cycle). */
async function arrowTo(env: E, name: string | RegExp) {
  const all = await controls(env)
  const target = await control(env, name)
  if ((await focusedName(env)) === null) {
    for (const c of all) if ((await c.attr("tabindex")) === "0") await c.focus()
  }
  const key = (await vertical(env)) ? "ArrowDown" : "ArrowRight"
  for (let i = 0; i <= all.length && !(await target.isFocused()); i++) await env.keyboard(key)
}

/** Per-component invariants (spec "One Tab Stop With Focus Memory", "Data Attributes"). */
export const toolbarInvariants: readonly Invariant<P, string>[] = [
  {
    // One tab stop over every control, own and hosted (the generic one sees own parts).
    name: "toolbar-one-tab-stop",
    check: async ({ env }) => {
      const all = await controls(env)
      const stops: string[] = []
      for (const c of all)
        if ((await c.attr("tabindex")) === "0") stops.push(await c.accessibleName())
      if (all.length === 0 || stops.length === 1) return undefined
      return `${stops.length} controls have tabindex="0"${stops.length > 0 ? `: ${stops.join(", ")}` : ""}`
    },
  },
  {
    name: "toolbar-highlight-inside-only",
    check: async ({ env }) => {
      if ((await focusedName(env)) !== null) return undefined
      for (const c of await controls(env)) {
        if ((await c.attr("data-highlighted")) !== null) {
          return `"${await c.accessibleName()}" is data-highlighted while focus is outside`
        }
      }
      return undefined
    },
  },
]

const label = () => toolbarArgs.current.label

/** The Toolbar's contract (spec "Toolbar Contract"). */
export const toolbarContract = contract("toolbar", {
  machine: toolbarMachine,
  anatomy: ["root", "button", "link", "item", "group", "separator"],
  locate: ({ name }: { readonly name: string | RegExp }) => ({ role: "toolbar", name }),
  actions: {
    tabIn: {
      // Tab from the element before the toolbar (the fixture's "Before" button).
      keyboard: async (env) => {
        await env.find({ role: "button", name: "Before" }).focus()
        await env.keyboard("Tab")
      },
      done: async (env) => (await focusedName(env)) !== null,
    },
    moveTo: {
      // Keyboard only: a pointer focus is a press (`press`).
      keyboard: async (env, name: string | RegExp) => arrowTo(env, name),
      done: async (env, name: string | RegExp) => (await control(env, name)).isFocused(),
    },
    press: {
      pointer: async (env, name: string | RegExp) => (await control(env, name)).click(),
      touch: async (env, name: string | RegExp) => (await control(env, name)).tap(),
      keyboard: async (env, name: string | RegExp) => {
        await arrowTo(env, name)
        await (await control(env, name)).press("Enter")
      },
      // The activation itself is the control's own (its spy, aria-pressed, a menu).
      done: async () => true,
    },
    tabOut: {
      keyboard: async (env) => env.keyboard("Tab"),
      done: async (env) => (await focusedName(env)) === null,
    },
    /** The FOCUS mapping: focus alone (Tab, a script, the AT cursor), never a press. */
    focusControl: {
      keyboard: async (env, name: string | RegExp) => (await control(env, name)).focus(),
      done: async () => true,
    },
    arrowNext: {
      keyboard: async (env) => env.keyboard((await vertical(env)) ? "ArrowDown" : "ArrowRight"),
      done: async () => true,
    },
    leave: {
      keyboard: async (env) => env.find({ role: "button", name: "After" }).focus(),
      done: async () => true,
    },
  },
  queries: {
    items: async (env) => names(await controls(env)),
    focusedItem: focusedName,
    /** The control with tabindex="0" (the toolbar's single tab stop). */
    tabStop: async (env) => {
      for (const c of await controls(env)) {
        if ((await c.attr("tabindex")) === "0") return c.accessibleName()
      }
      return null
    },
    isDisabled: async (env, name: string | RegExp) => inert(await control(env, name)),
    orientation: async (env) => ((await vertical(env)) ? "vertical" : "horizontal"),
  },
  states: { idle: {}, focused: {} },
  events: {
    NAVIGATE: { action: "arrowNext", event: () => ({ move: "next" }) },
    FOCUS: {
      action: "focusControl",
      // The mapping's args type misses the action's own arguments (text-field's gap).
      args: (() => [label()]) as never,
      event: () => ({ key: label() }),
    },
    BLUR: "leave",
    FOCUS_TOOLBAR: { skip: "the programmatic focus() API: covered by the DOM tests" },
    "COLLECTION.CHANGE": { skip: "controls are static parts: covered by the DOM tests" },
    "$props:collection": { skip: "controls are static parts: covered by the DOM tests" },
  },
  traits: ["directional"],
  // Focus enters the toolbar (idle → focused) and moves focusedItem; it never activates.
  commitsOnFocus: [
    { part: "button", state: "idle" },
    { part: "button", state: "focused" },
    { part: "link", state: "idle" },
    { part: "link", state: "focused" },
    { part: "item", state: "idle" },
    { part: "item", state: "focused" },
  ],
  invariants: toolbarInvariants,
})
