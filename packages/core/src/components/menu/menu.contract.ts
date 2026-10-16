import { contract } from "../../contract/contract"
import type { Env, Part } from "../../contract/env"
import { positioningQueries } from "../../contract/positioning"
import { menuMachine } from "./menu.machine"

type P =
  | "trigger"
  | "positioner"
  | "content"
  | "arrow"
  | "item"
  | "checkbox-item"
  | "radio-group"
  | "radio-item"
  | "item-indicator"
  | "item-text"
  | "group"
  | "group-label"
  | "separator"
  | "submenu-trigger"
type E = Env<P>

/** The item an activation acts on in a model run (set by the model test). */
export const menuArgs: { current: { readonly key: string; readonly label: string } } = {
  current: { key: "", label: "" },
}

const ITEM_ROLES = ["menuitem", "menuitemcheckbox", "menuitemradio"] as const

const isOpen = async (env: E) => (await env.part("trigger").attr("aria-expanded")) === "true"
const closed = async (env: E) => !(await isOpen(env))

/** An item of any level and kind, by its exact name. */
async function itemNamed(env: E, name: string | RegExp): Promise<Part> {
  for (const role of ITEM_ROLES) {
    const p = env.find({ role, name })
    if (await p.exists()) return p
  }
  return env.find({ role: "menuitem", name })
}

/** Every item element of the open levels, in document order. */
async function allItems(env: E): Promise<readonly Part[]> {
  const out: Part[] = []
  for (const role of ITEM_ROLES) out.push(...(await env.find({ role }).all()))
  return out
}

const names = async (list: readonly Part[]) => {
  const out: string[] = []
  for (const p of list) out.push(await p.accessibleName())
  return out
}

/** Arrows from wherever focus is in the menu to `target` (bounded: one full cycle). */
async function arrowTo(env: E, target: Part) {
  const count = (await allItems(env)).length
  for (let i = 0; i <= count && !(await target.isFocused()); i++) await env.keyboard("ArrowDown")
}

/** The open submenu triggers, outermost first. */
async function openPath(env: E) {
  const out: string[] = []
  for (const p of await env.find({ role: "menuitem" }).all()) {
    if (
      (await p.attr("data-part")) === "submenu-trigger" &&
      (await p.attr("data-state")) === "open"
    )
      out.push(await p.accessibleName())
  }
  return out
}

const focusedItem = async (env: E) => {
  const f = env.focused()
  if (!(await f.exists())) return null
  const role = await f.attr("role")
  return role && (ITEM_ROLES as readonly string[]).includes(role) ? f.accessibleName() : null
}

const focusInMenu = async (env: E) =>
  (await focusedItem(env)) !== null || (await env.part("content").isFocused())

function menuContractWith(modal: boolean) {
  return contract("menu", {
    machine: menuMachine,
    anatomy: [
      "trigger",
      "positioner",
      "content",
      "arrow",
      "item",
      "checkbox-item",
      "radio-group",
      "radio-item",
      "item-indicator",
      "item-text",
      "group",
      "group-label",
      "separator",
      "submenu-trigger",
    ],
    // Located through its trigger: a closed menu has no content to find.
    locate: ({ name }: { readonly name: string | RegExp }) => ({ role: "button" as const, name }),
    queries: {
      ...positioningQueries,
      isOpen,
      items: async (env: E) =>
        (await env.part("content").exists()) ? names(await allItems(env)) : [],
      highlighted: async (env: E) => {
        for (const p of await allItems(env)) {
          if ((await p.attr("data-highlighted")) !== null) return p.accessibleName()
        }
        return null
      },
      focusedItem,
      isChecked: async (env: E, name: string | RegExp) =>
        (await (await itemNamed(env, name)).attr("aria-checked")) === "true",
      isDisabled: async (env: E, name: string | RegExp) =>
        (await (await itemNamed(env, name)).attr("aria-disabled")) === "true",
      openPath,
      /** The last close reason ("escape-key"), until the next open. */
      closeReason: async (env: E) =>
        (await env.part("content").exists()) ? env.part("content").attr("data-close-reason") : null,
    },
    actions: {
      open: {
        pointer: async (env: E) => env.part("trigger").click(),
        touch: async (env: E) => env.part("trigger").tap(),
        keyboard: async (env: E) => env.part("trigger").press("Enter"),
        // Placed, then focused (never the other way round).
        done: async (env: E) =>
          (await isOpen(env)) &&
          (await positioningQueries.isPlaced(env)) &&
          (await focusInMenu(env)),
      },
      openWithArrowUp: {
        keyboard: async (env: E) => env.part("trigger").press("ArrowUp"),
        done: async (env: E) => (await isOpen(env)) && (await focusedItem(env)) !== null,
      },
      /** Presses the trigger of the open menu. */
      close: {
        pointer: async (env: E) => env.part("trigger").click(),
        touch: async (env: E) => env.part("trigger").tap(),
        keyboard: async (env: E) => env.keyboard("Escape"),
        done: closed,
      },
      /** Activates the item named `name` (any level, any kind). */
      choose: {
        pointer: async (env: E, name: string | RegExp) => (await itemNamed(env, name)).click(),
        touch: async (env: E, name: string | RegExp) => (await itemNamed(env, name)).tap(),
        keyboard: async (env: E, name: string | RegExp) => {
          const item = await itemNamed(env, name)
          await arrowTo(env, item)
          await env.keyboard("Enter")
        },
        done: async () => true,
      },
      /** Toggles a checkbox item or selects a radio item; the menu stays open. */
      toggle: {
        pointer: async (env: E, name: string | RegExp) => (await itemNamed(env, name)).click(),
        touch: async (env: E, name: string | RegExp) => (await itemNamed(env, name)).tap(),
        keyboard: async (env: E, name: string | RegExp) => {
          const item = await itemNamed(env, name)
          await arrowTo(env, item)
          await env.keyboard("Space")
        },
        done: async () => true,
      },
      /** Opens the submenu of the trigger item named `name`. */
      openSubmenu: {
        pointer: async (env: E, name: string | RegExp) => (await itemNamed(env, name)).hover(),
        keyboard: async (env: E, name: string | RegExp) => {
          const item = await itemNamed(env, name)
          await arrowTo(env, item)
          await env.keyboard("ArrowRight")
        },
        // Open and placed: every open level is a visible menu (an unplaced one is hidden).
        done: async (env: E, name: string | RegExp) => {
          const path = await openPath(env)
          if (!path.some((n) => (typeof name === "string" ? n === name : name.test(n))))
            return false
          if ((await env.find({ role: "menu" }).count()) !== path.length + 1) return false
          // The expand key moves focus into the submenu (after its placement); hover does not.
          if (env.modality === "pointer" || env.modality === "touch") return true
          const focused = await focusedItem(env)
          return focused !== null && focused !== name
        },
      },
      /** The collapse key in the open submenu. */
      closeSubmenu: {
        keyboard: async (env: E) => env.keyboard("ArrowLeft"),
        done: async () => true,
      },
      arrowDown: {
        keyboard: async (env: E) => env.keyboard("ArrowDown"),
        done: async () => true,
      },
      pressEscape: {
        keyboard: async (env: E) => env.keyboard("Escape"),
        done: async () => true,
      },
      pressOutside: {
        pointer: async (env: E) => env.pointerOutside(),
        none: { keyboard: "an outside press is a pointer interaction" },
        done: closed,
      },
      tabOut: { keyboard: async (env: E) => env.keyboard("Tab"), done: closed },
      typeahead: {
        keyboard: async (env: E, text: string) => {
          await env.focused().type(text)
        },
        done: async () => true,
      },
    },
    states: {
      open: { isOpen: true, isPlaced: true },
      opening: { isOpen: false },
      closed: { isOpen: false },
    },
    dataState: {
      open: { trigger: "open", positioner: "open", content: "open" },
      opening: { trigger: "closed" },
      closed: { trigger: "closed" },
    },
    events: {
      TRIGGER_PRESS: {
        from: {
          closed: "open",
          open: "close",
          opening: { skip: "a submenu level waiting for its hover delay: the browser tests" },
        },
      },
      TRIGGER_KEY: { action: "openWithArrowUp", event: () => ({ key: "last" }) },
      ITEM_ACTIVATE: {
        action: "choose",
        // The mapping's args type misses the action's own arguments (text-field's gap).
        args: (() => [menuArgs.current.label]) as never,
        event: () => ({ key: menuArgs.current.key, kind: "item", closeOnSelect: true }),
      },
      NAVIGATE: { action: "arrowDown", event: () => ({ move: "next" }) },
      ESCAPE_KEY: "pressEscape",
      OUTSIDE_PRESS: "pressOutside",
      TAB_KEY: "tabOut",
      SUB_OPEN: { skip: "a submenu level: covered by the submenu DOM tests" },
      EXPAND: { skip: "no submenu at the model fixture's root: covered by the submenu DOM tests" },
      COLLAPSE: { skip: "a submenu or menubar level: covered by the submenu DOM tests" },
      KEY_ACTIVATE: { skip: "dispatches the item's click: choose's keyboard twin" },
      "KEY_ACTIVATE.END": { skip: "internal: ends a key activation" },
      TYPEAHEAD: { skip: "the shared typeahead: covered by the DOM tests" },
      HIGHLIGHT: { skip: "focus follows the highlight: every keyboard step" },
      POINTER_MOVE: { skip: "pointer paths: covered by the browser tests" },
      POINTER_LEAVE: { skip: "pointer paths: covered by the browser tests" },
      "HOVER.START": { skip: "submenu pointer intent: covered by the browser tests" },
      "HOVER.END": { skip: "submenu pointer intent: covered by the browser tests" },
      OUTSIDE_FOCUS: { skip: "non-modal focus leaving: covered by the DOM tests" },
      PARENT_DISMISSED: { skip: "closing the parent layer: covered by the nesting DOM tests" },
      WINDOW_BLUR: { skip: "window focus: covered by the DOM tests" },
      "TREE.CLOSE": { skip: "the menu tree: covered by the tree unit tests" },
      "TREE.SIBLING_OPENED": { skip: "the menu tree: covered by the tree unit tests" },
      OPEN: { skip: "programmatic (actionsRef.open): covered by the machine tests" },
      CLOSE: { skip: "programmatic (actionsRef.close): covered by the machine tests" },
      "POSITION.PLACED": {
        skip: "sent by the position capability, not a gesture (fakePositioning in the node tests)",
      },
      "COLLECTION.CHANGE": { skip: "static item parts: covered by the DOM tests" },
      "$props:collection": { skip: "static item parts: covered by the DOM tests" },
      "$sync:open": { props: (target) => ({ open: target === "open" }) },
    },
    traits: modal
      ? ["layer", "restores-focus", "presence", "anchored", "modal"]
      : ["layer", "restores-focus", "presence", "anchored"],
    exceptions: [
      { part: "submenu-trigger", invariant: "state-attrs", quirk: "vo-submenu-expanded" },
    ],
    // Focus moving inside the open menu is navigation by definition.
    commitsOnFocus: [
      { part: "trigger", state: "open" },
      { part: "content", state: "open" },
      { part: "item", state: "open" },
    ],
    semantics: { trigger: "trigger", content: "content", item: "item" },
  })
}

/** A modal menu (the default). */
export const menuContract = menuContractWith(true)
/** A non-modal menu (`modal={false}`). */
export const nonModalMenuContract = menuContractWith(false)
