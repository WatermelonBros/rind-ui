// Menubar (design §2): roving focus and typeahead over the bar's items, and one open-menu
// value. `closed` ⇔ value null; "open mode" is simply `open`, so nothing depends on how a
// menu opened (kobaltedev/kobalte#333). The menus are ordinary menu root levels: the bar
// opens, switches and closes them through the adapter's `menus` port, and hears their own
// closes as MENU_CLOSED.

import { tabStop } from "../../collection/composite"
import { type CollectionKey, toKey } from "../../collection/key"
import {
  type CollectionContext,
  type CollectionEnv,
  type CollectionEvent,
  type CollectionProps,
  collectionPieces,
  initialCollectionContext,
} from "../../collection/machine"
import { move, navigableWhen } from "../../collection/navigation"
import type { Modality } from "../../contract/env"
import { setup, type } from "../../machine/setup"
import type { ChangeDetails } from "../../machine/types"
import type { MenuCloseReason } from "../menu/menu-tree"

/** How a menu opens: its modality, and the item focus lands on for the keyboard. */
export interface MenubarOpening {
  readonly modality: Modality
  /** Keyboard openings: the first or last item; pointer openings focus the content. */
  readonly edge?: "first" | "last" | undefined
}

/** The adapter's handle on the bar's menus (each a menu root level). */
export interface MenubarMenus {
  open(key: CollectionKey, how: MenubarOpening): void
  /** `switching`: another menu opens next (no focus restore on this close). */
  close(key: CollectionKey, options: { readonly switching: boolean }): void
}

export type MenubarEvent =
  | Extract<CollectionEvent, { type: "NAVIGATE" | "TYPEAHEAD" | "COLLECTION.CHANGE" }>
  | { readonly type: "FOCUS"; readonly key: CollectionKey; readonly modality: Modality }
  | { readonly type: "BLUR" }
  | { readonly type: "TRIGGER_PRESS"; readonly key: CollectionKey; readonly modality: Modality }
  | { readonly type: "TRIGGER_KEY"; readonly key: CollectionKey; readonly edge: "first" | "last" }
  | { readonly type: "TRIGGER_HOVER"; readonly key: CollectionKey }
  /** An expand / collapse key the open menu did not use. */
  | {
      readonly type: "MENU_NAVIGATE"
      readonly from: CollectionKey
      readonly direction: "next" | "previous" | "collapse"
    }
  /** A menu closed by itself (item, Escape, Tab, outside, window blur). */
  | { readonly type: "MENU_CLOSED"; readonly key: CollectionKey; readonly reason: MenuCloseReason }
  /** The `value` prop changed (a controlled menubar). */
  | { readonly type: "VALUE.SYNC" }
  /** Programmatic `focus()`: the tab stop, programmatic source. */
  | { readonly type: "FOCUS_MENUBAR" }
  | { readonly type: "OPEN"; readonly key: CollectionKey }
  /** Programmatic, or Tab on a bar item while its menu is open (`tab-key`). */
  | { readonly type: "CLOSE"; readonly reason?: "tab-key" | undefined }

/** `onValueChange`'s reasons (kebab case). */
export type MenubarValueReason =
  | "trigger"
  | "trigger-key"
  | "hover"
  | "menu-navigate"
  | MenuCloseReason
  | "api"

export interface MenubarProps extends CollectionProps {
  readonly value?: string | null | undefined
  readonly defaultValue?: string | null | undefined
  readonly onValueChange?:
    | ((
        value: string | null,
        details: Omit<ChangeDetails<MenubarEvent>, "reason"> & { reason: MenubarValueReason },
      ) => void)
    | undefined
  readonly orientation?: "horizontal" | "vertical" | undefined
  /** Default true. */
  readonly loop?: boolean | undefined
  /** Default true (passed to every menu). */
  readonly modal?: boolean | undefined
  readonly disabled?: boolean | undefined
  /** The adapter's port to the menus. */
  readonly menus: MenubarMenus
}

export interface MenubarContext extends CollectionContext {
  /**
   * The menu a mouse hover just opened: the press that follows on that item (the same
   * pointer arriving to click) keeps it open instead of closing it.
   */
  readonly hoverOpened: CollectionKey | null
}

const pieces = collectionPieces({})
type Args = Parameters<typeof pieces.actions.navigate>[0]
// Sound: the bar's arguments are the collection pieces' with a wider event union.
const asPieces = (a: unknown) => a as Args

/** The value the runtime falls back to: no menu open. */
const NONE = null as unknown as string

const enabled = (props: MenubarProps, key: CollectionKey) =>
  props.disabled !== true && props.collection.get(key)?.disabled !== true

/** The enabled item next to `from` in `direction`, wrapping with `loop`. */
function neighbour(props: MenubarProps, from: CollectionKey, direction: "next" | "previous") {
  const navigable = navigableWhen(false)
  return move(props.collection, from, direction, { loop: props.loop !== false, navigable })
}

const focusItem = (
  a: { env: CollectionEnv; props: MenubarProps },
  key: CollectionKey,
  source: "navigation" | "programmatic",
) => {
  const el = a.env.dom.getById(a.props.ids.item(key))
  if (!el) return
  a.env.modality.markFocus(el, source)
  el.focus({ preventScroll: true })
}

export interface MenubarTypes {
  props: MenubarProps
  events: MenubarEvent
  env: CollectionEnv
  context: MenubarContext
  values: "value"
}

export const menubarMachine = /* @__PURE__ */ setup({
  types: type<MenubarTypes>(),
  guards: {
    /** The pressed / keyed item can open (not disabled). */
    canOpen: ({ event, props }) =>
      (event.type === "TRIGGER_PRESS" || event.type === "TRIGGER_KEY" || event.type === "OPEN") &&
      enabled(props, event.key),
    /** The press is on the open menu's item: it closes it. */
    isOpenItem: ({ event, values }) => event.type === "TRIGGER_PRESS" && event.key === values.value,
    /** The pointer press that completes a hover switch onto this item. */
    isHoverOpenedItem: ({ event, context }) =>
      event.type === "TRIGGER_PRESS" &&
      (event.modality === "pointer" || event.modality === "touch") &&
      event.key === context.hoverOpened,
    vertical: ({ props }) => props.orientation === "vertical",
    syncedOpen: ({ values }) => values.value !== null && values.value !== undefined,
    /** Its own menu closed (not one the bar already switched away from). */
    isOpenMenu: ({ event, values }) => event.type === "MENU_CLOSED" && event.key === values.value,
  },
  actions: {
    navigate: (a) => pieces.actions.navigate(asPieces(a)),
    typeahead: (a) => pieces.actions.typeahead(asPieces(a)),
    focusHighlighted: (a) => pieces.actions.focusHighlighted(asPieces(a)),
    repairCollection: (a) => pieces.actions.repairCollection(asPieces(a)),
    highlightFocused: ({ event, props, set }) => {
      if (event.type !== "FOCUS" || !props.collection.has(event.key)) return
      set("highlightedKey", event.key)
      set("highlightSource", event.modality === "pointer" ? "pointer" : "keyboard")
      set("scrollReason", null)
    },
    focusStop: (a) => {
      const key = tabStop({
        collection: a.props.collection,
        highlightedKey: a.context.highlightedKey,
        highlightSource: null,
        selection: new Set(),
        selectionMode: "none",
        focusableWhenDisabled: a.props.focusableWhenDisabled !== false,
      })
      if (key === null) return
      a.set("highlightedKey", key)
      focusItem(a, key, "programmatic")
    },
    /** Opens the event's menu (press: by its modality; key: on its edge item). */
    openMenu: ({ event, props, set }) => {
      if (event.type === "TRIGGER_PRESS") {
        set("value", event.key)
        set("highlightedKey", event.key)
        props.menus.open(event.key, { modality: event.modality })
      } else if (event.type === "TRIGGER_KEY") {
        set("value", event.key)
        set("highlightedKey", event.key)
        props.menus.open(event.key, { modality: "keyboard", edge: event.edge })
      } else if (event.type === "OPEN") {
        set("value", event.key)
        props.menus.open(event.key, { modality: "keyboard", edge: "first" })
      }
    },
    /** One step from the open menu to another (no state with none or two open). */
    switchTo: ({ event, props, set, values }) => {
      const from = values.value
      let to: CollectionKey | null = null
      let how: MenubarOpening = { modality: "pointer" }
      if (event.type === "TRIGGER_HOVER" || event.type === "TRIGGER_PRESS") {
        to = event.key
        how = { modality: event.type === "TRIGGER_PRESS" ? event.modality : "pointer" }
      } else if (event.type === "MENU_NAVIGATE" && event.direction !== "collapse") {
        to = neighbour(props, event.from, event.direction)
        how = { modality: "keyboard", edge: "first" }
      }
      if (to === null || to === from || !enabled(props, to)) return
      if (from !== null && from !== undefined) props.menus.close(toKey(from), { switching: true })
      set("value", to)
      set("highlightedKey", to)
      set("hoverOpened", event.type === "TRIGGER_HOVER" ? to : null)
      props.menus.open(to, how)
    },
    /** The bar closes its open menu (a press on its item, a collapse, programmatic). */
    closeMenu: ({ props, values }) => {
      const key = values.value
      if (key !== null && key !== undefined) props.menus.close(toKey(key), { switching: false })
    },
    clearValue: ({ set }) => {
      set("value", NONE)
      set("hoverOpened", null)
    },
    clearHoverOpened: ({ set }) => set("hoverOpened", null),
    /** A parent's value: the menus follow it. */
    syncMenus: ({ props, values }) => {
      const key = values.value
      // Every other menu closes; the value's menu opens (keyboard, its first item).
      for (let i = 0; i < props.collection.size; i++) {
        const k = props.collection.at(i)?.key
        if (k !== undefined && k !== key) props.menus.close(k, { switching: true })
      }
      if (key !== null && key !== undefined) {
        props.menus.open(toKey(key), { modality: "keyboard", edge: "first" })
      }
    },
  },
}).machine({
  id: "menubar",
  initial: "closed",
  context: (props) => ({
    ...initialCollectionContext(),
    lastCollection: props.collection,
    hoverOpened: null,
  }),
  values: { value: { fallback: NONE } },
  onProps: { collection: "COLLECTION.CHANGE", value: "VALUE.SYNC" },
  on: {
    "COLLECTION.CHANGE": { actions: ["repairCollection"] },
    FOCUS: { actions: ["highlightFocused"] },
    FOCUS_MENUBAR: { actions: ["focusStop"] },
    // A parent's value, or a refused proposal: the menus follow the value.
    $reverted: [
      { guard: "syncedOpen", target: "open", actions: ["syncMenus"] },
      { target: "closed", actions: ["syncMenus"] },
    ],
    "VALUE.SYNC": [
      { guard: "syncedOpen", target: "open", actions: ["syncMenus"] },
      { target: "closed", actions: ["syncMenus"] },
    ],
  },
  states: {
    closed: {
      on: {
        NAVIGATE: { actions: ["navigate", "focusHighlighted"] },
        TYPEAHEAD: { actions: ["typeahead", "focusHighlighted"] },
        TRIGGER_PRESS: {
          guard: "canOpen",
          target: "open",
          reason: "trigger",
          actions: ["openMenu"],
        },
        TRIGGER_KEY: {
          guard: "canOpen",
          target: "open",
          reason: "trigger-key",
          actions: ["openMenu"],
        },
        OPEN: { guard: "canOpen", target: "open", reason: "api", actions: ["openMenu"] },
      },
    },
    open: {
      on: {
        TRIGGER_PRESS: [
          { guard: "isHoverOpenedItem", actions: ["clearHoverOpened"] },
          {
            guard: "isOpenItem",
            target: "closed",
            reason: "trigger",
            actions: ["closeMenu", "clearValue"],
          },
          { guard: "canOpen", reason: "trigger", actions: ["switchTo"] },
        ],
        TRIGGER_HOVER: { reason: "hover", actions: ["switchTo"] },
        MENU_NAVIGATE: [
          // Vertical bars: the collapse key closes the menu (the overlay restores focus
          // to the item); horizontal bars switch.
          {
            guard: "vertical",
            target: "closed",
            reason: "escape-key",
            actions: ["closeMenu", "clearValue"],
          },
          { reason: "menu-navigate", actions: ["switchTo"] },
        ],
        // The menu's own close reason is the value's.
        MENU_CLOSED: {
          guard: "isOpenMenu",
          target: "closed",
          reason: (e: MenubarEvent) => (e.type === "MENU_CLOSED" ? e.reason : "api"),
          actions: ["clearValue"],
        },
        CLOSE: {
          target: "closed",
          reason: (e: MenubarEvent) => (e.type === "CLOSE" && e.reason ? e.reason : "api"),
          actions: ["closeMenu", "clearValue"],
        },
      },
    },
  },
})

export type MenubarMachine = typeof menubarMachine
