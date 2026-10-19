// The Navigation Menu contract (design §6): the landmark by its exact name, triggers by
// their button names, links by theirs. Delays are waited out in small time steps until the
// page shows the change, so the same actions work with fake time and in real browsers.

import { contract, type Invariant } from "../../contract/contract"
import type { Env, Part } from "../../contract/env"
import { positioningQueries } from "../../contract/positioning"
import { navigationMenuMachine } from "./navigation-menu.machine"

type P = "root" | "list" | "trigger" | "content" | "link" | "viewport" | "indicator" | "positioner"
type E = Env<P>
type Name = string | RegExp

/** The items a model step acts on (set by a model test). */
export const navigationMenuArgs: {
  current: { readonly item: string; readonly link: string }
} = { current: { item: "", link: "" } }

const matches = (n: string, name: Name) => (typeof name === "string" ? n === name : name.test(n))

const triggers = (env: E) => env.part("trigger").all()
/** Every level's triggers: the root's, then the nested levels' inside its panels. */
const allTriggers = async (env: E) => [
  ...(await triggers(env)),
  ...(await env.part("root").scoped("navigation-menu", "trigger").all()),
]
const trigger = async (env: E, name: Name): Promise<Part> => {
  for (const t of await allTriggers(env)) if (matches(await t.accessibleName(), name)) return t
  throw new Error(`navigation-menu: no trigger named ${String(name)}`)
}
const link = async (env: E, name: Name): Promise<Part> => {
  for (const l of await env.part("link").all()) {
    if ((await l.exists()) && matches(await l.accessibleName(), name)) return l
  }
  throw new Error(`navigation-menu: no visible link named ${String(name)}`)
}
/** The content an item's trigger controls (by its key). */
const contentOf = async (env: E, name: Name): Promise<Part | null> => {
  const key = await (await trigger(env, name)).attr("data-value")
  for (const c of await env.part("content").all())
    if ((await c.attr("data-value")) === key) return c
  return null
}

const isOpen = async (env: E, name: Name) =>
  (await (await trigger(env, name)).attr("aria-expanded")) === "true"
/** The open top-level item's trigger name, or null. */
const openItem = async (env: E) => {
  for (const t of await triggers(env)) {
    if ((await t.attr("aria-expanded")) === "true") return t.accessibleName()
  }
  return null
}
const closed = async (env: E) => (await openItem(env)) === null
const disabled = async (env: E, name: Name) => {
  const t = await trigger(env, name)
  return (await t.attr("data-disabled")) !== null
}
const openedOrRefused = async (env: E, name: Name) =>
  (await isOpen(env, name)) || (await disabled(env, name))

/** Advances time in 50 ms steps (fake time, or real waits) until `done`, up to 5 s. */
async function waitOut(env: E, done: () => Promise<boolean>) {
  for (let t = 0; t < 5000 && !(await done()); t += 50) await env.advance(50)
}

/** Whether the last toggle pressed an open item (it closes instead). */
let wasOpen = false
const before = async (env: E, name: Name) => {
  wasOpen = await isOpen(env, name)
}
const toggled = async (env: E, name: Name) =>
  wasOpen ? !(await isOpen(env, name)) : openedOrRefused(env, name)

/** Keyboard focus on `name`'s trigger: Tab onto it unless it already has focus. */
const tabTo = async (env: E, name: Name) => {
  const t = await trigger(env, name)
  if (!(await t.isFocused())) await t.focusWithTab()
}

const names = async (list: readonly Part[]) => {
  const out: string[] = []
  for (const p of list) if (await p.exists()) out.push(await p.accessibleName())
  return out
}

const FORBIDDEN_ROLES = ["menu", "menubar", "menuitem", "menuitemcheckbox", "menuitemradio"]

/** Per-contract invariants (spec "Navigation Menu Contract"). */
export const navigationMenuInvariants: readonly Invariant<P, string>[] = [
  {
    name: "navigation-menu-at-most-one-open",
    // Per level: every level (the root and each Sub) has its own instance.
    check: async ({ env }) => {
      const open = new Map<string, string[]>()
      const all = await allTriggers(env)
      const seen = new Set<string>()
      for (const t of all) {
        const id = (await t.attr("id")) ?? ""
        if (seen.has(id) || (await t.attr("aria-expanded")) !== "true") continue
        seen.add(id)
        const level = (await t.attr("data-instance")) ?? ""
        open.set(level, [...(open.get(level) ?? []), await t.accessibleName()])
      }
      for (const [level, names] of open) {
        if (names.length > 1)
          return `${names.length} items of level ${level} are open: ${names.join(", ")}`
      }
      return undefined
    },
  },
  {
    name: "navigation-menu-expanded-matches-state",
    check: async ({ env }) => {
      for (const t of await triggers(env)) {
        const expanded = (await t.attr("aria-expanded")) === "true"
        const state = await t.attr("data-state")
        if (expanded !== (state === "open")) {
          return `trigger "${await t.accessibleName()}" has aria-expanded=${expanded} and data-state="${state}"`
        }
      }
      return undefined
    },
  },
  {
    name: "navigation-menu-top-level-tabbable",
    check: async ({ env }) => {
      for (const t of [...(await triggers(env)), ...(await env.part("link").all())]) {
        if (!(await t.exists())) continue
        if ((await t.attr("tabindex")) === "-1") {
          return `"${await t.accessibleName()}" is out of the Tab order (tabindex="-1")`
        }
      }
      return undefined
    },
  },
  {
    name: "navigation-menu-closed-content-hidden",
    check: async ({ env }) => {
      for (const c of await env.part("content").all()) {
        if ((await c.attr("aria-hidden")) !== null) return "a content carries aria-hidden"
        if ((await c.attr("data-state")) === "closed" && (await c.exists())) {
          // Exiting content is inert while its animation runs.
          if (!(await c.isInert()))
            return `closed content "${await c.attr("data-value")}" is visible`
        }
      }
      return undefined
    },
  },
  {
    name: "navigation-menu-no-menu-semantics",
    check: async ({ env }) => {
      const parts: [string, Part][] = [
        ["root", env.part("root")],
        ["list", env.part("list")],
        ...(await triggers(env)).map((t) => ["trigger", t] as [string, Part]),
        ...(await env.part("content").all()).map((c) => ["content", c] as [string, Part]),
      ]
      for (const [name, p] of parts) {
        if ((await p.count()) === 0) continue
        const role = await p.attr("role")
        if (role && FORBIDDEN_ROLES.includes(role)) return `the ${name} part has role="${role}"`
        for (const a of ["aria-orientation", "aria-haspopup", "aria-owns"]) {
          if ((await p.attr(a)) !== null) return `the ${name} part carries ${a}`
        }
      }
      return undefined
    },
  },
]

const item = () => navigationMenuArgs.current.item
const linkName = () => navigationMenuArgs.current.link

/** `data-state` of the root follows the open value (a controlled run proposes first). */
const rootState = (view: { readonly values: Readonly<Record<string, unknown>> }) =>
  view.values["value"] === null || view.values["value"] === undefined ? "closed" : "open"

const definition = {
  machine: navigationMenuMachine,
  anatomy: ["root", "list", "trigger", "content", "link", "viewport", "indicator", "positioner"],
  locate: ({ name }: { readonly name: string | RegExp }) => ({ role: "navigation", name }),
  queries: {
    /** The open top-level item's trigger name, or null. */
    openItem,
    isOpen,
    /** The visible links' names: of `item`'s panel, or of the whole menu. */
    links: async (env: E, name?: Name) => {
      if (name === undefined) return names(await env.part("link").all())
      const c = await contentOf(env, name)
      return c ? names(await c.scoped("navigation-menu", "link").all()) : []
    },
    /** The name of the link with `aria-current`, or null. */
    currentLink: async (env: E) => {
      for (const l of await env.part("link").all()) {
        if ((await l.attr("aria-current")) !== null) return l.accessibleName()
      }
      return null
    },
    contentText: async (env: E, name: Name) => {
      const c = await contentOf(env, name)
      return c && (await c.exists()) ? c.text() : null
    },
  },
  actions: {
    /** Opens `name`'s panel (a no-op when it is open). */
    open: {
      pointer: async (env: E, name: Name) => {
        if (!(await isOpen(env, name))) await (await trigger(env, name)).click()
      },
      keyboard: async (env: E, name: Name) => {
        if (await isOpen(env, name)) return
        await tabTo(env, name)
        await env.keyboard("Enter")
      },
      done: openedOrRefused,
    },
    /** Closes the open panel: an outside press, or Escape. */
    close: {
      pointer: async (env: E) => env.pointerOutside(),
      keyboard: async (env: E) => env.keyboard("Escape"),
      done: closed,
    },
    /** Presses `name`'s trigger: opens it, or closes it when it is open. */
    toggle: {
      pointer: async (env: E, name: Name) => {
        await before(env, name)
        await (await trigger(env, name)).click()
      },
      touch: async (env: E, name: Name) => {
        await before(env, name)
        await (await trigger(env, name)).tap()
      },
      keyboard: async (env: E, name: Name) => {
        await before(env, name)
        await tabTo(env, name)
        await env.keyboard("Enter")
      },
      done: toggled,
    },
    /** Rests the pointer on `name` until it opens (keyboard: Enter on it). */
    hover: {
      none: { touch: "hover intent is mouse/pen only" },
      pointer: async (env: E, name: Name) => {
        await (await trigger(env, name)).hover()
        await waitOut(env, () => openedOrRefused(env, name))
      },
      keyboard: async (env: E, name: Name) => {
        if (await isOpen(env, name)) return
        await tabTo(env, name)
        await env.keyboard("Enter")
      },
      done: openedOrRefused,
    },
    /** The pointer moves onto `name`: the open delay starts (nothing opens yet). */
    hoverTrigger: {
      pointer: async (env: E, name: Name) => (await trigger(env, name)).hover(),
      none: { keyboard: "hover intent is a pointer interaction" },
      done: async () => true,
    },
    /** The pointer leaves the trigger and the panel (the close delay starts). */
    pointerAway: {
      pointer: async (env: E) => env.pointerAway(),
      none: { keyboard: "the pointer leaving is a pointer interaction" },
      done: async () => true,
    },
    followLink: {
      pointer: async (env: E, name: Name) => (await link(env, name)).click(),
      keyboard: async (env: E, name: Name) => (await link(env, name)).press("Enter"),
      done: closed,
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
    /**
     * Leaves the menu for the fixture's "After" link: a press on it, or focus moved to it.
     * Focus lands somewhere real, so the close keeps it there.
     */
    leave: {
      // A bare click (virtual) presses nothing outside: focus moves there instead.
      pointer: async (env: E) => {
        const after = env.find({ role: "link", name: "After" })
        await after.click()
        if (await closed(env)) return
        // From the menu (where the screen reader's focus is) to the link: focus leaves it.
        const open = await openItem(env)
        if (open !== null) await (await trigger(env, open)).focus()
        await after.focus()
      },
      keyboard: async (env: E) => env.find({ role: "link", name: "After" }).focus(),
      done: closed,
    },
    /** ArrowDown on `name`'s open trigger: focus moves to its panel's first link. */
    enterContent: {
      keyboard: async (env: E, name: Name) => {
        await (await trigger(env, name)).focus()
        await env.keyboard("ArrowDown")
      },
      done: async (env: E) =>
        (await env.focused().exists()) && (await env.focused().attr("data-part")) !== "trigger",
    },
  },
  states: {
    closed: { openItem: null },
    warm: { openItem: null },
    opening: { openItem: null },
    open: {},
    closing: {},
  },
  dataState: {
    closed: { root: rootState },
    warm: { root: rootState },
    opening: { root: rootState },
    open: { root: rootState },
    closing: { root: rootState },
  },
  events: {
    "HOVER.START": {
      from: {
        closed: {
          action: "hoverTrigger",
          args: (() => [item()]) as never,
          event: () => ({ item: item() }),
        },
        warm: { skip: "hovering within the warm window: the DOM tests" },
        opening: { skip: "already waiting for the open delay" },
        open: { skip: "switching by hover: the DOM tests" },
        closing: { skip: "re-entering within the close delay: the DOM tests" },
      },
    },
    "HOVER.END": { skip: "leaving the hover zone, then the close delay: the DOM tests" },
    PRESS: {
      action: "toggle",
      args: (() => [item()]) as never,
      event: () => ({ item: item(), modality: "pointer" }),
    },
    ESCAPE: "pressEscape",
    DISMISS: { action: "leave", event: () => ({ reason: "outside-press" }) },
    "LINK.ACTIVATE": { action: "followLink", args: (() => [linkName()]) as never },
    "PARENT.CLOSE": { skip: "internal tree event: the nested DOM tests" },
    OPEN: { skip: "api only: the machine tests" },
    CLOSE: { skip: "api only: the machine tests" },
    "FOCUS.MOVE": { skip: "focus-only; driven by enterContent and the keyboard DOM tests" },
    "VALUE.SYNC": { skip: "sent by the $props:value step" },
    // A parent's value: the target state's open item, or none.
    "$props:value": {
      props: (target: string) => ({
        value: target === "open" || target === "closing" ? "products" : null,
      }),
    },
    "$sync:value": {
      props: (target: string) => ({
        value: target === "open" || target === "closing" ? "products" : null,
      }),
    },
    DISABLED: { skip: "the disabled prop step ($props:disabled)" },
    "$props:disabled": { props: () => ({ disabled: true }) },
    "INDICATOR.MEASURE": { skip: "sent by the selection indicator, not a user step" },
    "POSITION.PLACED": { skip: "sent by the position capability, not a user step" },
  },
  invariants: navigationMenuInvariants,
} as const

/** The Navigation Menu's contract (spec "Navigation Menu Contract"). */
export const navigationMenuContract = contract("navigation-menu", {
  ...definition,
  traits: ["layer", "presence", "timed"],
})

/** The same contract for a menu that renders a Positioner: placed panels (`anchored`). */
export const anchoredNavigationMenuContract = contract("navigation-menu", {
  ...definition,
  queries: { ...definition.queries, ...positioningQueries },
  traits: ["layer", "presence", "timed", "anchored"],
})
