// The Menubar contract (design §6): the bar by its role and name, its items by their names.
// Each menu is driven by the menu contract located through its bar item
// (`menubarMenuContract`); the testing package's `getMenubar(…).menu(name)` returns it.

import { contract, type Invariant } from "../../contract/contract"
import type { Env, Part } from "../../contract/env"
import { menubarMachine } from "./menubar.machine"

type P = "root"
type E = Env<P>

/** The items a model step acts on, per argument class (set by a model test). */
export const menubarArgs: {
  current: {
    /** FOCUS / TRIGGER_PRESS / TRIGGER_KEY target. */
    readonly label: string
    /** TRIGGER_HOVER / MENU_NAVIGATE target (another item). */
    readonly other: string
  }
} = { current: { label: "", other: "" } }

/** The bar's items in document order (menu triggers in menubar mode). */
const items = (env: E) => env.part("root").withAttr("data-host", "menubar").all()
const names = async (list: readonly Part[]) => {
  const out: string[] = []
  for (const p of list) out.push(await p.accessibleName())
  return out
}
const item = async (env: E, name: string | RegExp): Promise<Part> => {
  for (const c of await items(env)) {
    const n = await c.accessibleName()
    if (typeof name === "string" ? n === name : name.test(n)) return c
  }
  throw new Error(`menubar: no item named ${String(name)}`)
}
const vertical = async (env: E) => (await env.part("root").attr("aria-orientation")) === "vertical"
const disabled = async (env: E, name: string | RegExp) =>
  (await (await item(env, name)).attr("aria-disabled")) === "true"
const focusedItem = async (env: E) => {
  const f = env.focused()
  if (!(await f.exists()) || (await f.attr("data-host")) !== "menubar") return null
  return f.accessibleName()
}
/** The item whose menu is open, or null. */
const currentMenu = async (env: E) => {
  for (const c of await items(env)) {
    if ((await c.attr("aria-expanded")) === "true") return c.accessibleName()
  }
  return null
}

/** Focus is in the open menu of the item `trigger` (its content or one of its items). */
async function focusInMenuOf(env: E, trigger: Part) {
  const f = env.focused()
  if (!(await f.exists()) || (await f.attr("data-scope")) !== "menu") return false
  if ((await f.attr("data-part")) === "trigger") return false
  return (await f.attr("data-instance")) === (await trigger.attr("data-instance"))
}

/**
 * Waits (bounded) until focus is in another top-level menu than the one of the item
 * `before` (its `data-instance`): the next key must reach the new menu. False when nothing
 * moved (a replayed step's env drops the keys).
 */
async function settledAway(env: E, before: string | null) {
  for (let t = 0; t < 20; t++) {
    const f = env.focused()
    if (
      (await f.exists()) &&
      (await f.attr("data-scope")) === "menu" &&
      (await f.attr("data-part")) !== "trigger" &&
      (await f.attr("data-instance")) !== before
    ) {
      return true
    }
    await env.advance(16)
  }
  return false
}

/**
 * `name`'s menu is open with focus inside it, or `name` cannot open (disabled). A press on
 * the open item closes it instead (`pressed` remembers which case the action started in).
 */
async function openedOrRefused(env: E, name: string | RegExp) {
  const it = await item(env, name)
  if ((await it.attr("aria-expanded")) === "true") return focusInMenuOf(env, it)
  return (await disabled(env, name)) || (await env.part("root").attr("data-disabled")) !== null
}

/** Whether the last openMenu pressed the item of the menu that was open (a toggle). */
let pressedOpen = false
const pressed = async (env: E, name: string | RegExp) => {
  pressedOpen = (await (await item(env, name)).attr("aria-expanded")) === "true"
}
const toggled = async (env: E, name: string | RegExp) =>
  pressedOpen ? (await currentMenu(env)) === null : openedOrRefused(env, name)

/** Arrows along the bar from the focused item until `name` is focused (one cycle). */
async function arrowTo(env: E, name: string | RegExp) {
  const all = await items(env)
  const target = await item(env, name)
  if ((await focusedItem(env)) === null) {
    for (const c of all) if ((await c.attr("tabindex")) === "0") await c.focus()
  }
  const key = (await vertical(env)) ? "ArrowDown" : "ArrowRight"
  for (let i = 0; i <= all.length && !(await target.isFocused()); i++) await env.keyboard(key)
}

/** Per-component invariants (spec "One Tab Stop", "Switching Between Open Menus"). */
export const menubarInvariants: readonly Invariant<P, string>[] = [
  {
    name: "menubar-one-tab-stop",
    check: async ({ env }) => {
      const all = await items(env)
      if (all.length === 0) return "the menubar has no menu items"
      const stops: string[] = []
      for (const c of all) {
        if ((await c.attr("tabindex")) === "0") stops.push(await c.accessibleName())
      }
      if (stops.length === 1) return undefined
      return `${stops.length} items have tabindex="0"${stops.length > 0 ? `: ${stops.join(", ")}` : ""}`
    },
  },
  {
    name: "menubar-at-most-one-open",
    check: async ({ env }) => {
      const open: string[] = []
      for (const c of await items(env)) {
        if ((await c.attr("aria-expanded")) === "true") open.push(await c.accessibleName())
      }
      return open.length <= 1 ? undefined : `${open.length} menus are open: ${open.join(", ")}`
    },
  },
  {
    name: "menubar-state-matches-open-menu",
    check: async ({ env }) => {
      const state = await env.part("root").attr("data-state")
      const open = (await currentMenu(env)) !== null
      return (state === "open") === open
        ? undefined
        : `root data-state="${state}" while ${open ? "a" : "no"} menu is open`
    },
  },
]

const label = () => menubarArgs.current.label
const other = () => menubarArgs.current.other

/** The Menubar's contract (spec "Menubar Contract"). */
export const menubarContract = contract("menubar", {
  machine: menubarMachine,
  anatomy: ["root"],
  locate: ({ name }: { readonly name: string | RegExp }) => ({ role: "menubar", name }),
  actions: {
    tabIn: {
      // Tab from the element before the menubar (the fixture's "Before" button).
      keyboard: async (env) => {
        await env.find({ role: "button", name: "Before" }).focus()
        await env.keyboard("Tab")
      },
      done: async (env) => (await focusedItem(env)) !== null,
    },
    moveTo: {
      // Keyboard only: a pointer focus is a press (`openMenu`).
      keyboard: async (env, name: string | RegExp) => arrowTo(env, name),
      done: async (env, name: string | RegExp) => (await item(env, name)).isFocused(),
    },
    /** Opens `name`'s menu, or closes it when it is the open one. */
    openMenu: {
      pointer: async (env, name: string | RegExp) => {
        await pressed(env, name)
        await (await item(env, name)).click()
      },
      touch: async (env, name: string | RegExp) => {
        await pressed(env, name)
        await (await item(env, name)).tap()
      },
      // With a menu open, focus is in it: the item is focused directly (the bar stays
      // reachable), then pressed.
      keyboard: async (env, name: string | RegExp) => {
        await pressed(env, name)
        if ((await currentMenu(env)) === null) await arrowTo(env, name)
        else await (await item(env, name)).focus()
        await env.keyboard("Enter")
      },
      done: toggled,
    },
    /**
     * Horizontal bars: ArrowUp opens the menu on its last item. A vertical bar has no
     * such key: its expand key opens on the first item (ArrowRight, else ArrowLeft in RTL).
     */
    openMenuOnLast: {
      keyboard: async (env, name: string | RegExp) => {
        await arrowTo(env, name)
        if (!(await vertical(env))) return env.keyboard("ArrowUp")
        await env.keyboard("ArrowRight")
        if ((await currentMenu(env)) === null) await env.keyboard("ArrowLeft")
      },
      done: openedOrRefused,
    },
    /** From an open menu to `name`'s. */
    switchTo: {
      pointer: async (env, name: string | RegExp) => (await item(env, name)).hover(),
      touch: async (env, name: string | RegExp) => (await item(env, name)).tap(),
      // The expand key inside the open menu until `name`'s menu is open (one cycle); a
      // vertical bar has no switching key: Escape, then the bar's arrows and Enter.
      keyboard: async (env, name: string | RegExp) => {
        if (await vertical(env)) {
          await env.keyboard("Escape")
          await arrowTo(env, name)
          await env.keyboard("Enter")
          return
        }
        const all = await items(env)
        for (let i = 0; i <= all.length; i++) {
          if (await openedOrRefused(env, name)) return
          const open = await currentMenu(env)
          if (open === null) return
          const before = await (await item(env, open)).attr("data-instance")
          await env.keyboard("ArrowRight")
          if (!(await settledAway(env, before))) return
        }
      },
      done: openedOrRefused,
    },
    closeMenu: {
      keyboard: async (env) => env.keyboard("Escape"),
      done: async (env) => (await currentMenu(env)) === null,
    },
    typeahead: {
      // Each character on the focused item.
      keyboard: async (env, text: string) => {
        for (const ch of text) await env.keyboard(ch as Parameters<E["keyboard"]>[0]) // a printable key
      },
      done: async () => true,
    },
    tabOut: {
      keyboard: async (env) => env.keyboard("Tab"),
      done: async (env) => (await focusedItem(env)) === null,
    },
    /** The FOCUS mapping: focus alone (Tab, a script, the AT cursor), never a press. */
    focusItem: {
      keyboard: async (env, name: string | RegExp) => (await item(env, name)).focus(),
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
    items: async (env) => names(await items(env)),
    currentMenu,
    focusedItem,
    /** The item with tabindex="0" (the menubar's single tab stop). */
    tabStop: async (env) => {
      for (const c of await items(env)) {
        if ((await c.attr("tabindex")) === "0") return c.accessibleName()
      }
      return null
    },
    isDisabled: disabled,
    orientation: async (env) => ((await vertical(env)) ? "vertical" : "horizontal"),
  },
  states: { closed: {}, open: {} },
  events: {
    NAVIGATE: { action: "arrowNext", event: () => ({ move: "next" }) },
    TYPEAHEAD: { skip: "text matching: the typeahead action and the DOM tests" },
    FOCUS: {
      action: "focusItem",
      // The mapping's args type misses the action's own arguments (text-field's gap).
      args: (() => [label()]) as never,
      event: () => ({ key: label() }),
    },
    BLUR: "leave",
    TRIGGER_PRESS: {
      action: "openMenu",
      args: (() => [label()]) as never,
      event: () => ({ key: label(), modality: "pointer" }),
    },
    TRIGGER_KEY: {
      action: "openMenuOnLast",
      args: (() => [label()]) as never,
      event: () => ({ key: label(), edge: "last" }),
    },
    TRIGGER_HOVER: {
      action: "switchTo",
      args: (() => [other()]) as never,
      event: () => ({ key: other() }),
    },
    MENU_NAVIGATE: { skip: "the expand key inside a menu: switchTo's keyboard path" },
    MENU_CLOSED: {
      action: "closeMenu",
      event: () => ({ key: label(), reason: "escape-key" }),
    },
    "VALUE.SYNC": { skip: "a parent's value: the DOM tests" },
    "$props:value": { skip: "a parent's value: the DOM tests" },
    FOCUS_MENUBAR: { skip: "the programmatic focus() API: covered by the DOM tests" },
    OPEN: { skip: "programmatic: covered by the DOM tests" },
    CLOSE: { skip: "programmatic: covered by the DOM tests" },
    "COLLECTION.CHANGE": { skip: "items are static parts: covered by the DOM tests" },
    "$props:collection": { skip: "items are static parts: covered by the DOM tests" },
  },
  traits: ["directional"],
  // Focus on an item moves focusedItem; it never opens a menu.
  commitsOnFocus: [
    { part: "root", state: "closed" },
    { part: "root", state: "open" },
  ],
  invariants: menubarInvariants,
})
