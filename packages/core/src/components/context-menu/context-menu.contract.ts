// The Context Menu's contract (design §5): the Menu contract with the region as the way in.
// Opening is by gesture at a point (right click, long press, the context-menu key, an AT's
// bare `contextmenu`), and a second gesture in the region re-anchors the open menu.

import { contract } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { positioningQueries } from "../../contract/positioning"
import { menuContract } from "../menu/menu.contract"
import { menuMachine } from "../menu/menu.machine"

type P = (typeof menuContract.anatomy)[number]
type E = Env<P>

const isOpen = async (env: E) => (await env.part("trigger").attr("data-state")) === "open"
const closed = async (env: E) => !(await isOpen(env))

const focusInMenu = async (env: E) => {
  const f = env.focused()
  if (!(await f.exists())) return false
  if ((await f.attr("role")) === "menu") return true
  const role = await f.attr("role")
  return role === "menuitem" || role === "menuitemcheckbox" || role === "menuitemradio"
}

/** Placed and focused: what every opening gesture ends with. */
const opened = async (env: E) =>
  (await isOpen(env)) && (await positioningQueries.isPlaced(env)) && (await focusInMenu(env))

/** A long press: a touch held for the press module's threshold (environment time). */
const longPress = (env: E, at: At) => env.part("trigger").longPress({ at })

type At = { readonly x: number; readonly y: number }
const CENTRE: At = { x: 0.5, y: 0.5 }

/** The oracle's payload for a gesture at a point (its position does not change the graph). */
const GESTURE = { point: { x: 0, y: 0 }, target: null, virtual: false }

function contextMenuContractWith(modal: boolean) {
  const base = menuContract
  return contract("menu", {
    machine: menuMachine,
    anatomy: base.anatomy,
    // The region, by a text it contains (a row's label): its instance is the menu's.
    locate: ({ text }: { readonly text: string | RegExp }) => ({ text }),
    queries: {
      ...base.queries,
      isOpen,
      /** The menu's top-left corner (where a pointer open put it). */
      anchorPoint: async (env: E) => {
        const box = await env.part("content").box()
        return box ? { x: box.x, y: box.y } : null
      },
    },
    actions: {
      ...base.actions,
      /** Opens it from the region (`at`: fractions of the region's box). */
      openAt: {
        pointer: async (env: E, at: At = CENTRE) => env.part("trigger").contextMenu({ at }),
        touch: async (env: E, at: At = CENTRE) => longPress(env, at),
        keyboard: async (env: E) => {
          await env.part("trigger").focus()
          await env.keyboard("F10", { shift: true })
        },
        done: opened,
      },
      /** A second right click in the region moves the open menu there. */
      reanchor: {
        pointer: async (env: E, at: At = CENTRE) => env.part("trigger").contextMenu({ at }),
        none: { keyboard: "a keyboard open anchors to the focused element: nothing to move" },
        done: isOpen,
      },
      close: {
        keyboard: async (env: E) => env.keyboard("Escape"),
        done: closed,
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
      // Sound: the same machine and every action the Menu's mappings name is spread above;
      // only the inferred argument types of the Menu's actions do not carry over.
      ...(base.events as Record<never, never>),
      "REGION.CONTEXTMENU": {
        from: {
          closed: { action: "openAt", event: () => GESTURE },
          open: modal
            ? { skip: "the region is inert under a modal menu: DOCUMENT.CONTEXTMENU, DOM tests" }
            : { action: "reanchor", event: () => GESTURE },
        },
      },
      "REGION.LONG_PRESS": {
        from: {
          closed: { action: "openAt", event: () => GESTURE },
          open: { skip: "a second long press: the DOM tests" },
        },
      },
      "REGION.KEY": { action: "openAt", event: () => ({ target: null }) },
      "DOCUMENT.CONTEXTMENU": { skip: "a right click elsewhere while open: the DOM tests" },
      TRIGGER_PRESS: { skip: "a region is no button: the opening gestures are REGION.*" },
      TRIGGER_KEY: { skip: "a region is no button: the context-menu key is REGION.KEY" },
      OPEN_AT: { skip: "programmatic (openAt): the DOM tests" },
      SCROLL: { skip: "a non-modal context menu and a page scroll: the DOM tests" },
    },
    traits: modal
      ? ["layer", "restores-focus", "presence", "anchored", "modal"]
      : ["layer", "restores-focus", "presence", "anchored"],
    exceptions: base.exceptions ?? [],
    commitsOnFocus: base.commitsOnFocus ?? [],
    // The region is no disclosure trigger (no aria-expanded): only the content and items.
    // Focus returns to what had it: the focused element inside the region.
    semantics: { content: "content", item: "item", finalFocus: "trigger" },
  })
}

/** A modal context menu (the default). */
export const contextMenuContract = contextMenuContractWith(true)
/** A non-modal context menu (`modal={false}`). */
export const nonModalContextMenuContract = contextMenuContractWith(false)
