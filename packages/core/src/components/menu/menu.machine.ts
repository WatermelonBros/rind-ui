// Menu (design §2): one flat graph per level — root or submenu — linked by the MenuTree. A
// level is closed, opening (a submenu waiting for its hover delay) or open. Everything that
// touches the DOM is injected: the overlay (layer, dismiss, inert, focus restore), the
// positioning, hover intent for submenus and the collection's navigation. Items activate
// through their `click` only (pointer release, a bare AT click, or Enter/Space dispatching
// one), so an element substituted with `render` runs its own click handler exactly once,
// and a touch selection closes the menu only after its click was dispatched.

import type { CollectionKey } from "../../collection/key"
import {
  type CollectionContext,
  type CollectionEnv,
  type CollectionProps,
  collectionPieces,
  initialCollectionContext,
} from "../../collection/machine"
import { move, navigableWhen } from "../../collection/navigation"
import type { Modality } from "../../contract/env"
import type { DismissRequest } from "../../dom/dismiss"
import { deepActiveElement, focusInitial } from "../../dom/focus-scope"
import { getLayerStack, type LayerId, layerId } from "../../dom/layer-stack"
import { overlayEffect } from "../../dom/overlay"
import { type PlacementState, placementFrom, unplaced } from "../../dom/position/connect"
import { positioningPresets, resolvePositioning } from "../../dom/position/options"
import type { DomEnvironment } from "../../env/dom-environment"
import type { HoverIntentEnv } from "../../env/hover-intent"
import type {
  Align,
  PositionEnv,
  PositioningOptions,
  PositioningProps,
  Side,
} from "../../env/position"
import { itemId, partId } from "../../ids"
import { setup, type } from "../../machine/setup"
import type { ChangeDetails } from "../../machine/types"
import type { MenuCloseReason, MenuLevelId, MenuTree, MenuTreeEvent } from "./menu-tree"

export type MenuItemKind = "item" | "checkbox-item" | "radio-item" | "link-item"

type Dismissal<K extends string> = { readonly type: K; readonly request: DismissRequest }

type Move = "next" | "previous" | "first" | "last"

export type MenuEvent =
  /** The root trigger, or (submenu level) its trigger item, was pressed. */
  | { readonly type: "TRIGGER_PRESS"; readonly modality: Modality }
  /** ArrowDown / ArrowUp on the closed root trigger: open on the first / last item. */
  | { readonly type: "TRIGGER_KEY"; readonly key: "first" | "last" }
  /** The expand key on this level's submenu trigger (sent by the parent level). */
  | { readonly type: "SUB_OPEN" }
  /** An item's click: the activation (pointer release, Enter, Space, a bare AT click). */
  | {
      readonly type: "ITEM_ACTIVATE"
      readonly key: CollectionKey
      readonly kind: MenuItemKind
      readonly closeOnSelect: boolean
      readonly modality: Modality
    }
  /** Enter or Space on the highlighted item: its own click follows. */
  | { readonly type: "KEY_ACTIVATE"; readonly space: boolean }
  | { readonly type: "KEY_ACTIVATE.END" }
  /** The expand / collapse key on this level's content (submenus, a hosting menubar). */
  | { readonly type: "EXPAND" }
  | { readonly type: "COLLAPSE" }
  | Dismissal<"ESCAPE_KEY">
  | Dismissal<"OUTSIDE_PRESS">
  | Dismissal<"OUTSIDE_FOCUS">
  | Dismissal<"PARENT_DISMISSED">
  | { readonly type: "TAB_KEY"; readonly shift: boolean }
  | { readonly type: "WINDOW_BLUR" }
  /** `zone`: from the open submenu's hover tracking; otherwise its trigger item's handlers. */
  | { readonly type: "HOVER.START"; readonly zone?: true }
  | { readonly type: "HOVER.END"; readonly zone?: true }
  | MenuTreeEvent
  | {
      readonly type: "POSITION.PLACED"
      readonly side: Side
      readonly align: Align
      readonly anchorHidden: boolean
      readonly first: boolean
    }
  /** Programmatic (`actionsRef`). */
  | { readonly type: "OPEN" }
  | { readonly type: "CLOSE" }
  | { readonly type: "NAVIGATE"; readonly move: Move }
  | {
      readonly type: "TYPEAHEAD"
      readonly char: string
      readonly composing: boolean
      readonly modifiers: { readonly ctrl: boolean; readonly meta: boolean; readonly alt: boolean }
    }
  | {
      readonly type: "HIGHLIGHT"
      readonly key: CollectionKey | null
      readonly source: "keyboard" | "pointer"
    }
  | { readonly type: "POINTER_MOVE"; readonly key: CollectionKey }
  /** The pointer left the content. */
  | { readonly type: "POINTER_LEAVE" }
  | { readonly type: "COLLECTION.CHANGE" }
  /** Context menu (a region root): a `contextmenu` on the region (`virtual`: no press). */
  | {
      readonly type: "REGION.CONTEXTMENU"
      readonly point: MenuPoint
      readonly target: Element | null
      readonly virtual: boolean
      readonly nativeEvent?: Event | undefined
    }
  | {
      readonly type: "REGION.LONG_PRESS"
      readonly point: MenuPoint
      readonly target: Element | null
      readonly nativeEvent?: Event | undefined
    }
  /** The context-menu key (Shift+F10, ContextMenu) on a focused element of the region. */
  | {
      readonly type: "REGION.KEY"
      readonly target: Element | null
      readonly nativeEvent?: Event | undefined
    }
  /** While open: a `contextmenu` anywhere but the region's own handlers. */
  | {
      readonly type: "DOCUMENT.CONTEXTMENU"
      readonly point: MenuPoint
      readonly target: Element | null
      readonly inRegion: boolean
    }
  /** Programmatic `openAt(point, target?)`. */
  | { readonly type: "OPEN_AT"; readonly point: MenuPoint; readonly target: Element | null }
  /** A non-modal region root: the page scrolled. */
  | { readonly type: "SCROLL" }

export type MenuOpenReason =
  | "trigger"
  | "trigger-key"
  | "api"
  | "context-menu"
  | "context-menu-key"
  | "long-press"

export interface MenuPoint {
  readonly x: number
  readonly y: number
}

/** Where a region root is anchored: the gesture's point, or the focused element. */
export type MenuAnchor =
  | {
      readonly kind: "point"
      readonly x: number
      readonly y: number
      readonly target: Element | null
    }
  | { readonly kind: "element"; readonly target: Element }

/** `onAnchorChange`'s details: a second gesture in the same region moved the open menu. */
export interface MenuAnchorDetails {
  readonly point: MenuPoint | null
  readonly target: Element | null
}

/** `onOpenChange`'s details: `reason` says why it opens or closes. */
export type MenuChangeDetails = Omit<ChangeDetails<MenuEvent>, "reason"> & {
  readonly reason: MenuOpenReason | MenuCloseReason
}

/** What a level asks its adapter when an item activates. */
export interface MenuActivation {
  readonly key: CollectionKey
  readonly kind: MenuItemKind
  readonly modality: Modality
  /** Enter or Space (keyboard), else null. */
  readonly via: "enter" | "space" | null
}

export interface MenuProps extends CollectionProps {
  readonly open?: boolean | undefined
  readonly defaultOpen?: boolean | undefined
  readonly onOpenChange?: ((open: boolean, details: MenuChangeDetails) => void) | undefined
  /** Default true (root only; submenus are non-modal child layers). */
  readonly modal?: boolean | undefined
  /** `root` or `submenu` (read-only: the adapter decides). */
  readonly level: "root" | "submenu"
  /** This level's id (part ids derive from it). */
  readonly levelId: MenuLevelId
  /** The parent level (submenus). */
  readonly parentLevel?: MenuLevelId | undefined
  /** The layer this level opens from (the adapter's layer context). */
  readonly parent?: LayerId | undefined
  /** The element that opens this level: the root trigger or the submenu's trigger item. */
  readonly getTrigger: () => HTMLElement | null
  /** Default 100 ms. */
  readonly submenuOpenDelay?: number | undefined
  /** Default 300 ms: resting inside a submenu's grace area this long ends it. */
  readonly submenuGraceTimeout?: number | undefined
  readonly positioning?: PositioningProps | undefined
  /**
   * An item activated: the adapter runs the item's own activation (toggle, radio select)
   * and its `onSelect`; returns false when `details.cancel()` kept the menu open.
   */
  readonly onActivate?: ((activation: MenuActivation) => boolean) | undefined
  /** The expand key on `key`: opens its submenu when it is a submenu trigger (true). */
  readonly openSubmenu?: ((key: CollectionKey) => boolean) | undefined
  /** A context menu: `getTrigger` is the region; it opens at a point (read-only). */
  readonly region?: boolean | undefined
  readonly onAnchorChange?: ((details: MenuAnchorDetails) => void) | undefined
}

export interface MenuContext extends CollectionContext {
  readonly placement: PlacementState
  /** How the level opened: decides initial focus. */
  readonly openModality: Modality | null
  /** Opened by ArrowUp: initial focus goes to the last item. */
  readonly openToLast: boolean
  readonly closeReason: MenuCloseReason | null
  /** Closing restores focus to the trigger (false: a sibling opened, the window blurred). */
  readonly restoreFocus: boolean
  /** The key activation whose click is being dispatched. */
  readonly keyActivation: "enter" | "space" | null
  /** Opened by hover intent: focus stays on the trigger item. */
  readonly hoverOpened: boolean
  /** The item the pointer stopped on while crossing toward a submenu (taken when it ends). */
  readonly pendingPointerKey: CollectionKey | null
  /** A region root's anchor (null: the region's top-left corner). */
  readonly regionAnchor: MenuAnchor | null
}

export type MenuEnv = DomEnvironment &
  PositionEnv &
  HoverIntentEnv &
  CollectionEnv & { readonly menuTree: MenuTree }

export const menuIds = (levelId: string) => ({
  trigger: partId("menu", levelId, "trigger"),
  positioner: partId("menu", levelId, "positioner"),
  content: partId("menu", levelId, "content"),
  arrow: partId("menu", levelId, "arrow"),
  item: (key: CollectionKey) => itemId("menu", levelId, "item", key),
  group: (key: string) => itemId("menu", levelId, "group", key),
  groupLabel: (key: string) => itemId("menu", levelId, "group-label", key),
})

export const menuLayerId = (levelId: string) => layerId(`menu-${levelId}`)

/**
 * The `dropdown` preset at the root, `submenu` for nested levels, `pointer` for a region
 * root at a point (a keyboard open drops down from the focused element), under the consumer's.
 */
export const menuPositioning = (
  props: Pick<MenuProps, "positioning" | "level" | "region">,
  anchor: MenuAnchor | null = null,
): PositioningOptions =>
  resolvePositioning(
    props.positioning,
    props.level === "submenu"
      ? positioningPresets.submenu
      : props.region && anchor?.kind !== "element"
        ? positioningPresets.pointer
        : positioningPresets.dropdown,
  )

const initialPlacement = (props: Pick<MenuProps, "positioning" | "level" | "region">) => {
  const o = menuPositioning(props)
  const side = o.side === "inline-start" ? "left" : o.side === "inline-end" ? "right" : o.side
  return unplaced(side, o.align)
}

const pieces = collectionPieces({})
type Args = Parameters<typeof pieces.actions.navigate>[0]

const docOf = (env: MenuEnv) => {
  const root = env.dom.getRootNode()
  return "body" in root ? root : root.ownerDocument
}

/** The anchor an opening or re-anchoring event carries. */
function anchorOf(event: { readonly type: string }): MenuAnchor | null {
  const e = event as MenuEvent // a narrowing by type follows
  switch (e.type) {
    case "REGION.CONTEXTMENU":
    case "REGION.LONG_PRESS":
    case "DOCUMENT.CONTEXTMENU":
    case "OPEN_AT":
      return { kind: "point", x: e.point.x, y: e.point.y, target: e.target }
    case "REGION.KEY":
      return e.target ? { kind: "element", target: e.target } : null
    default:
      return null
  }
}

const DISMISS_TYPE = {
  "escape-key": "ESCAPE_KEY",
  "outside-press": "OUTSIDE_PRESS",
  "outside-focus": "OUTSIDE_FOCUS",
  "parent-dismissed": "PARENT_DISMISSED",
} as const

const isTextEntry = (el: Element | null) =>
  el !== null &&
  (el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    (el as HTMLElement).isContentEditable === true)

/** The close reason an event carries. */
function reasonOf(event: {
  readonly type: string
  readonly reason?: unknown
}): MenuCloseReason | null {
  switch (event.type) {
    case "TREE.CLOSE":
      // TREE.CLOSE always carries one (MenuTreeEvent).
      return event.reason as MenuCloseReason
    case "TRIGGER_PRESS":
      return "trigger"
    case "COLLAPSE":
    case "ESCAPE_KEY":
      return "escape-key"
    case "OUTSIDE_PRESS":
      return "outside-press"
    case "OUTSIDE_FOCUS":
      return "outside-focus"
    case "PARENT_DISMISSED":
      return "parent-dismissed"
    case "WINDOW_BLUR":
      return "window-blur"
    case "TAB_KEY":
      return "tab-key"
    case "CLOSE":
      return "api"
    case "SCROLL":
      return "scroll"
    case "DOCUMENT.CONTEXTMENU":
      return "outside-press"
    default:
      return null
  }
}

const treeClose =
  (reason: MenuCloseReason) =>
  ({ event }: { readonly event: { readonly type: string; readonly reason?: unknown } }) =>
    event.type === "TREE.CLOSE" && event.reason === reason

/** The root closes itself (its submenus follow as child layers); a submenu asks the tree. */
function closeTree(
  props: MenuProps,
  env: MenuEnv,
  send: (event: MenuEvent) => void,
  reason: MenuCloseReason,
) {
  if (props.level === "root") send({ type: "TREE.CLOSE", reason })
  else env.menuTree.closeTree(reason)
}

/** A zero-size rectangle at a point (a point anchor through the virtual anchor kind). */
function pointRect(x: number, y: number) {
  return { x, y, left: x, top: y, right: x, bottom: y, width: 0, height: 0 } as DOMRect // the fields positioning reads
}

/**
 * While a region root is open: a `contextmenu` elsewhere (the region's own handlers see the
 * ones on it) re-anchors when its point is inside the region's boxes (a modal menu makes
 * the region inert, so the event targets the page) and closes otherwise; a non-modal one
 * closes when the page scrolls. Presses inside the menu's own layers are left alone.
 */
function watchRegion(
  a: {
    readonly props: MenuProps
    readonly env: MenuEnv
    send(event: MenuEvent): void
  },
  doc: Document,
  modal: boolean,
): () => void {
  const inMenu = (t: EventTarget | null) => {
    const layer = getLayerStack(doc).get(menuLayerId(a.props.levelId))
    return layer?.contains(t) === true
  }
  const onContextMenu = (e: MouseEvent) => {
    const region = a.props.getTrigger()
    const t = e.target as Element | null
    if (!region || (t && region.contains(t)) || inMenu(t)) return
    const inRegion = [...region.getClientRects()].some(
      (r) =>
        e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom,
    )
    if (inRegion) e.preventDefault()
    a.send({
      type: "DOCUMENT.CONTEXTMENU",
      point: { x: e.clientX, y: e.clientY },
      target: t,
      inRegion,
    })
  }
  const onScroll = (e: Event) => {
    if (!inMenu(e.target)) a.send({ type: "SCROLL" })
  }
  doc.addEventListener("contextmenu", onContextMenu, true)
  if (!modal) doc.addEventListener("scroll", onScroll, { capture: true, passive: true })
  return () => {
    doc.removeEventListener("contextmenu", onContextMenu, true)
    if (!modal) doc.removeEventListener("scroll", onScroll, { capture: true })
  }
}

export const menuMachine = setup({
  types: type<{
    props: MenuProps
    events: MenuEvent
    env: MenuEnv
    context: MenuContext
    values: "open"
  }>(),
  guards: {
    isRoot: ({ props }) => props.level === "root",
    isRegion: ({ props }) => props.region === true,
    inRegion: ({ event }) => event.type === "DOCUMENT.CONTEXTMENU" && event.inRegion,
    isSubmenu: ({ props }) => props.level === "submenu",
    fromZone: ({ event }) => "zone" in event && event.zone === true,
    treeTrigger: treeClose("trigger"),
    treeItemSelect: treeClose("item-select"),
    treeEscapeKey: treeClose("escape-key"),
    treeTabKey: treeClose("tab-key"),
    treeOutsidePress: treeClose("outside-press"),
    treeOutsideFocus: treeClose("outside-focus"),
    treeWindowBlur: treeClose("window-blur"),
    treeParentDismissed: treeClose("parent-dismissed"),
    treeApi: treeClose("api"),
    hostedByMenubar: ({ env }) => env.menuTree.parentKind() === "menubar",
    /** A pointer crossing items on its way into an open submenu does not move the highlight. */
    inTransit: ({ env }) => {
      if (typeof document === "undefined") return false
      return env.hoverIntent.isInTransit(docOf(env))
    },
    /** A submenu of this level is open: its trigger keeps the highlight. */
    childOpen: ({ env, props }) => {
      const path = env.menuTree.openPath()
      const at = props.level === "root" ? -1 : path.indexOf(props.levelId)
      return path.length > at + 1
    },
  },
  actions: {
    navigate: (a) => pieces.actions.navigate(a as unknown as Args), // same args, wider event union
    highlight: (a) => pieces.actions.highlight(a as unknown as Args), // as above
    pointerMove: (a) => pieces.actions.pointerMove(a as unknown as Args), // as above
    typeahead: (a) => pieces.actions.typeahead(a as unknown as Args), // as above
    resetTypeahead: (a) => pieces.actions.resetTypeahead(a as unknown as Args), // as above
    repairCollection: (a) => pieces.actions.repairCollection(a as unknown as Args), // as above
    scrollToHighlighted: (a) => pieces.actions.scrollToHighlighted(a as unknown as Args), // as above
    focusHighlighted: (a) => pieces.actions.focusHighlighted(a as unknown as Args), // as above
    enterOpen: ({ event, set }) => {
      const modality =
        event.type === "TRIGGER_PRESS"
          ? event.modality
          : event.type === "TRIGGER_KEY" || event.type === "SUB_OPEN" || event.type === "REGION.KEY"
            ? "keyboard"
            : event.type === "REGION.CONTEXTMENU"
              ? event.virtual
                ? "virtual"
                : "pointer"
              : event.type === "REGION.LONG_PRESS"
                ? "touch"
                : event.type === "OPEN_AT"
                  ? "pointer"
                  : null
      set("openModality", modality)
      set("openToLast", event.type === "TRIGGER_KEY" && event.key === "last")
      set("closeReason", null)
      set("restoreFocus", true)
      set("highlightedKey", null)
      set("highlightSource", null)
      set("keyActivation", null)
      set("hoverOpened", event.type.startsWith("after:"))
      set("pendingPointerKey", null)
    },
    /** A region root's anchor from the opening gesture (or `openAt`). */
    setAnchor: ({ event, set }) => {
      const anchor = anchorOf(event)
      if (anchor) set("regionAnchor", anchor)
    },
    /**
     * A second gesture in the same region: the open menu moves (no close, no new entry
     * animation), the highlight goes and the content takes focus.
     */
    reanchor: ({ env, event, props, set }) => {
      const anchor = anchorOf(event)
      if (!anchor) return
      set("regionAnchor", anchor)
      set("highlightedKey", null)
      set("highlightSource", null)
      const ids = menuIds(props.levelId)
      env.position.reposition(ids.positioner)
      env.dom.getById(ids.content)?.focus({ preventScroll: true })
      props.onAnchorChange?.({
        point: anchor.kind === "point" ? { x: anchor.x, y: anchor.y } : null,
        target: anchor.target,
      })
    },
    /** Joins the open path (closing an open sibling) and leaves it on close. */
    openInTree: ({ env, props }) => {
      if (props.parentLevel) env.menuTree.openChild(props.parentLevel, props.levelId)
    },
    leaveTree: ({ env, event, props }) =>
      env.menuTree.childClosed(props.levelId, {
        // Only an open submenu whose grace area ended, never one still waiting to open.
        byHover: event.type === "HOVER.END" && "zone" in event && event.zone === true,
      }),
    rememberPointer: ({ event, set }) => {
      if (event.type === "POINTER_MOVE") set("pendingPointerKey", event.key)
    },
    forgetPointer: ({ set }) => set("pendingPointerKey", null),
    /** The grace area ended without reaching the submenu: the item under the pointer. */
    takePendingPointer: ({ context, env, props, set }) => {
      const key = context.pendingPointerKey
      set("pendingPointerKey", null)
      const node = key === null ? undefined : props.collection.get(key)
      if (key === null || !node || node.disabled) return
      set("highlightedKey", key)
      set("highlightSource", "pointer")
      set("scrollReason", null)
      if (isTextEntry(env.dom.activeElement())) return
      env.dom.getById(menuIds(props.levelId).item(key))?.focus({ preventScroll: true })
    },
    resetPlacement: ({ props, set }) => set("placement", initialPlacement(props)),
    setCloseReason: ({ event, set }) => {
      const reason = reasonOf(event)
      if (reason) set("closeReason", reason)
    },
    /**
     * Exit action (it runs before the layer's cleanup reads it): a sibling opening or the
     * window blurring keeps focus where it goes; the pointer leaving returns focus to the
     * trigger only from inside the submenu (focus on the trigger stays for the parent, which
     * highlights the item under the pointer).
     */
    decideRestore: ({ env, event, props, set }) => {
      if (event.type === "TREE.SIBLING_OPENED" || event.type === "WINDOW_BLUR") {
        set("restoreFocus", false)
        return
      }
      if (event.type === "HOVER.END") {
        const content = env.dom.getById(menuIds(props.levelId).content)
        const active = env.dom.activeElement()
        set("restoreFocus", content !== null && active !== null && content.contains(active))
      }
    },
    setPlacement: ({ event, set }) => {
      if (event.type === "POSITION.PLACED") set("placement", placementFrom(event))
    },
    /** Pointer moves focus to the item it highlights, unless a text field inside has focus. */
    focusPointerHighlight: ({ context, env, props }) => {
      if (context.highlightSource !== "pointer" || context.highlightedKey === null) return
      if (isTextEntry(env.dom.activeElement())) return
      const el = env.dom.getById(menuIds(props.levelId).item(context.highlightedKey))
      el?.focus({ preventScroll: true })
    },
    /** The pointer left: a pointer-made highlight goes, the content keeps focus. */
    leaveContent: ({ context, env, props, set }) => {
      if (context.highlightSource !== "pointer" || context.highlightedKey === null) return
      set("highlightedKey", null)
      if (isTextEntry(env.dom.activeElement())) return
      env.dom.getById(menuIds(props.levelId).content)?.focus({ preventScroll: true })
    },
    /** Enter or Space: the highlighted item's own click is the activation. */
    clickHighlighted: ({ context, env, event, props, send, set }) => {
      const key = context.highlightedKey
      if (key === null || event.type !== "KEY_ACTIVATE") return
      set("keyActivation", event.space ? "space" : "enter")
      env.dom.getById(menuIds(props.levelId).item(key))?.click()
      // After the click's ITEM_ACTIVATE (queued first): a refused click leaves nothing behind.
      send({ type: "KEY_ACTIVATE.END" })
    },
    endKeyActivation: ({ set }) => set("keyActivation", null),
    select: ({ context, env, event, props, send }) => {
      if (event.type !== "ITEM_ACTIVATE") return
      const via = event.modality === "keyboard" ? context.keyActivation : null
      const kept = props.onActivate?.({
        key: event.key,
        kind: event.kind,
        modality: event.modality,
        via,
      })
      // Space on a checkbox or radio item never closes (native menus keep them open).
      const checkable = event.kind === "checkbox-item" || event.kind === "radio-item"
      if (kept === false || !event.closeOnSelect || (checkable && via === "space")) return
      closeTree(props, env, send, "item-select")
    },
    /**
     * Tab closes the tree and focuses the root trigger; the key's default then moves on
     * from it (Shift+Tab lands before it).
     */
    tabOut: ({ env, props, send }) => {
      closeTree(props, env, send, "tab-key")
      env.menuTree.rootTrigger()?.focus({ preventScroll: true })
    },
    focusRootTrigger: ({ env }) => env.menuTree.rootTrigger()?.focus({ preventScroll: true }),
    expand: ({ context, env, props }) => {
      const key = context.highlightedKey
      if (key !== null && props.openSubmenu?.(key)) return
      if (env.menuTree.parentKind() === "menubar") {
        env.menuTree.parentNavigate({ from: props.levelId, direction: "expand" })
      }
    },
    collapseToParent: ({ env, props }) =>
      env.menuTree.parentNavigate({ from: props.levelId, direction: "collapse" }),
  },
  delays: {
    submenuOpenDelay: ({ props }) => props.submenuOpenDelay ?? 100,
  },
  effects: {
    /** While open: the layer, positioning, initial focus, hover intent (submenus), blur. */
    open: (a) => {
      const { env, send } = a
      if (typeof document === "undefined") return undefined
      const ids = menuIds(a.props.levelId)
      const byId = (id: string) => env.dom.getById(id)
      const content = () => byId(ids.content)
      const root = a.props.level === "root"
      const modal = root && a.props.modal !== false
      const id = menuLayerId(a.props.levelId)
      const doc = docOf(env)
      const focusAtOpen = deepActiveElement(doc)
      let cancelFocus = () => {}
      const stopLayer = overlayEffect(env, {
        id,
        kind: "menu",
        family: "menu",
        modal,
        parent: a.props.parent,
        // A region is no opener: focus returns to what had it when the menu opened.
        ...(a.props.region ? {} : { opener: a.props.getTrigger }),
        // The trigger is inside: it stays out of the inert set (its name labels the menu)
        // and pressing it toggles, never dismisses and reopens. A hosting menubar too. A
        // region is the page: inert under a modal menu, a press on it is outside.
        elements: () =>
          [
            byId(ids.positioner),
            content(),
            a.props.region ? null : a.props.getTrigger(),
            ...(root ? env.menuTree.parentElements() : []),
          ].filter((e): e is HTMLElement => e !== null),
        container: content,
        initialFocus: () => false,
        finalFocus: () => (a.context.restoreFocus ? null : false),
        modality: env.modality.modality(),
        dismiss: {
          escape: true,
          outsidePress: true,
          outsideFocus: !modal,
          onRequest: (request) => {
            // The event type is the reason's (DISMISS_TYPE maps every reason).
            send({ type: DISMISS_TYPE[request.reason], request } as MenuEvent)
            // Escape acted on: the key is the menu's (a dialog or fullscreen keeps it).
            if (request.reason === "escape-key") request.event?.preventDefault()
          },
        },
      })
      const layer = getLayerStack(doc).get(id)
      const stopHover =
        !root && layer
          ? env.hoverIntent.track({
              trigger: a.props.getTrigger,
              elements: () =>
                [byId(ids.positioner), content()].filter((e): e is HTMLElement => e !== null),
              layer,
              // The submenu as placed (flipped or shifted), not the requested side.
              target: () => content()?.getBoundingClientRect() ?? null,
              restMs: a.props.submenuGraceTimeout ?? 300,
              onLeave: () => send({ type: "HOVER.END", zone: true }),
              onEnter: () => send({ type: "HOVER.START", zone: true }),
            })
          : () => {}
      const track = env.position.track({
        // By reference: a submenu's trigger is an item of its parent.
        anchor: {
          kind: "virtual",
          get: () => {
            const el = a.props.getTrigger()
            if (!el) return null
            if (!a.props.region) {
              return { getBoundingClientRect: () => el.getBoundingClientRect(), contextElement: el }
            }
            const anchor = a.context.regionAnchor
            if (anchor?.kind === "element") {
              const t = anchor.target
              return { getBoundingClientRect: () => t.getBoundingClientRect(), contextElement: t }
            }
            // A point (the region's top-left corner when opened without one).
            const box = el.getBoundingClientRect()
            const x = anchor?.x ?? box.left
            const y = anchor?.y ?? box.top
            return { getBoundingClientRect: () => pointRect(x, y), contextElement: el }
          },
        },
        positioner: ids.positioner,
        arrow: ids.arrow,
        options: () => menuPositioning(a.props, a.context.regionAnchor),
        onPlacement: (p, first) => {
          send({ type: "POSITION.PLACED", ...p, first })
          const el = content()
          if (!first || !el) return
          // Placed, then focused (an unplaced popup scrolls the page). Keyboard and
          // assistive technology land on the first (ArrowUp: the last) navigable item, whose
          // focus highlights it; a pointer open focuses the content, nothing highlighted.
          const { openModality, openToLast, hoverOpened } = a.context
          if (hoverOpened) return
          const pointer = openModality === "pointer" || openModality === "touch"
          const key = pointer
            ? null
            : move(a.props.collection, null, openToLast ? "last" : "first", {
                loop: false,
                navigable: navigableWhen(a.props.focusableWhenDisabled === true),
              })
          // The highlight is the machine's own, not left to the item's focus event: a key
          // pressed before that event arrives navigates from the right item.
          if (key !== null) send({ type: "HIGHLIGHT", key, source: "keyboard" })
          const pick = () => (key === null ? el : byId(ids.item(key)))
          cancelFocus = focusInitial(env, el, pick, openModality ?? undefined, focusAtOpen)
        },
      })
      const view = doc.defaultView
      const onBlur = () => send({ type: "WINDOW_BLUR" })
      if (root) view?.addEventListener("blur", onBlur)
      const stopRegion = a.props.region ? watchRegion(a, doc, modal) : () => {}
      return () => {
        stopRegion()
        if (root) view?.removeEventListener("blur", onBlur)
        cancelFocus()
        track.stop()
        stopHover()
        stopLayer()
      }
    },
    /** Registered with the tree for the life of the service. */
    tree: ({ env, props, send }) =>
      env.menuTree.register({
        id: props.levelId,
        parent: props.parentLevel ?? null,
        trigger: () => props.getTrigger(),
        send: (e) => send(e),
      }),
  },
}).machine({
  id: "menu",
  initial: "closed",
  context: (props) => ({
    ...initialCollectionContext(),
    lastCollection: props.collection,
    placement: initialPlacement(props),
    openModality: null,
    openToLast: false,
    closeReason: null,
    restoreFocus: true,
    keyActivation: null,
    hoverOpened: false,
    pendingPointerKey: null,
    regionAnchor: null,
  }),
  values: { open: { fallback: false, states: { open: true, closed: false, opening: false } } },
  onProps: { collection: "COLLECTION.CHANGE" },
  effects: ["tree"],
  on: { "COLLECTION.CHANGE": { actions: ["repairCollection"] } },
  states: {
    closed: {
      entry: ["leaveTree"],
      on: {
        TRIGGER_PRESS: { target: "open", reason: "trigger", actions: ["enterOpen"] },
        TRIGGER_KEY: {
          guard: "isRoot",
          target: "open",
          reason: "trigger-key",
          actions: ["enterOpen"],
        },
        SUB_OPEN: { guard: "isSubmenu", target: "open", reason: "trigger", actions: ["enterOpen"] },
        "HOVER.START": { guard: "isSubmenu", target: "opening" },
        OPEN: { target: "open", reason: "api", actions: ["enterOpen"] },
        "REGION.CONTEXTMENU": {
          guard: "isRegion",
          target: "open",
          reason: "context-menu",
          actions: ["enterOpen", "setAnchor"],
        },
        "REGION.LONG_PRESS": {
          guard: "isRegion",
          target: "open",
          reason: "long-press",
          actions: ["enterOpen", "setAnchor"],
        },
        "REGION.KEY": {
          guard: "isRegion",
          target: "open",
          reason: "context-menu-key",
          actions: ["enterOpen", "setAnchor"],
        },
        OPEN_AT: { target: "open", reason: "api", actions: ["enterOpen", "setAnchor"] },
      },
    },
    opening: {
      after: {
        submenuOpenDelay: { target: "open", reason: "trigger", actions: ["enterOpen"] },
      },
      on: {
        "HOVER.END": { guard: { not: "fromZone" }, target: "closed" },
        TRIGGER_PRESS: { target: "open", reason: "trigger", actions: ["enterOpen"] },
        SUB_OPEN: { target: "open", reason: "trigger", actions: ["enterOpen"] },
        "TREE.SIBLING_OPENED": "closed",
        "TREE.CLOSE": "closed",
        PARENT_DISMISSED: "closed",
        OPEN: { target: "open", reason: "api", actions: ["enterOpen"] },
        CLOSE: "closed",
      },
    },
    open: {
      entry: ["openInTree"],
      effects: ["open"],
      exit: ["decideRestore", "resetTypeahead", "resetPlacement"],
      on: {
        TRIGGER_PRESS: { target: "closed", reason: "trigger", actions: ["setCloseReason"] },
        ESCAPE_KEY: { target: "closed", reason: "escape-key", actions: ["setCloseReason"] },
        OUTSIDE_PRESS: { target: "closed", reason: "outside-press", actions: ["setCloseReason"] },
        OUTSIDE_FOCUS: { target: "closed", reason: "outside-focus", actions: ["setCloseReason"] },
        PARENT_DISMISSED: {
          target: "closed",
          reason: "parent-dismissed",
          actions: ["setCloseReason"],
        },
        TAB_KEY: [
          {
            guard: "isRoot",
            target: "closed",
            reason: "tab-key",
            actions: ["setCloseReason", "focusRootTrigger"],
          },
          { actions: ["tabOut"] },
        ],
        WINDOW_BLUR: {
          guard: "isRoot",
          target: "closed",
          reason: "window-blur",
          actions: ["setCloseReason"],
        },
        // One arm per reason: `onOpenChange` reports the reason the tree closed with.
        "TREE.CLOSE": [
          {
            guard: "treeTrigger",
            target: "closed",
            reason: "trigger",
            actions: ["setCloseReason"],
          },
          {
            guard: "treeItemSelect",
            target: "closed",
            reason: "item-select",
            actions: ["setCloseReason"],
          },
          {
            guard: "treeEscapeKey",
            target: "closed",
            reason: "escape-key",
            actions: ["setCloseReason"],
          },
          { guard: "treeTabKey", target: "closed", reason: "tab-key", actions: ["setCloseReason"] },
          {
            guard: "treeOutsidePress",
            target: "closed",
            reason: "outside-press",
            actions: ["setCloseReason"],
          },
          {
            guard: "treeOutsideFocus",
            target: "closed",
            reason: "outside-focus",
            actions: ["setCloseReason"],
          },
          {
            guard: "treeWindowBlur",
            target: "closed",
            reason: "window-blur",
            actions: ["setCloseReason"],
          },
          {
            guard: "treeParentDismissed",
            target: "closed",
            reason: "parent-dismissed",
            actions: ["setCloseReason"],
          },
          { guard: "treeApi", target: "closed", reason: "api", actions: ["setCloseReason"] },
        ],
        "TREE.SIBLING_OPENED": "closed",
        "HOVER.END": { guard: "fromZone", target: "closed" },
        CLOSE: { target: "closed", reason: "api", actions: ["setCloseReason"] },
        ITEM_ACTIVATE: { actions: ["select"] },
        KEY_ACTIVATE: { actions: ["clickHighlighted"] },
        "KEY_ACTIVATE.END": { actions: ["endKeyActivation"] },
        EXPAND: { actions: ["expand"] },
        COLLAPSE: [
          {
            guard: "isSubmenu",
            target: "closed",
            reason: "escape-key",
            actions: ["setCloseReason"],
          },
          { guard: "hostedByMenubar", actions: ["collapseToParent"] },
        ],
        NAVIGATE: {
          actions: ["forgetPointer", "navigate", "scrollToHighlighted", "focusHighlighted"],
        },
        TYPEAHEAD: { actions: ["typeahead", "scrollToHighlighted", "focusHighlighted"] },
        HIGHLIGHT: { actions: ["highlight"] },
        POINTER_MOVE: [
          { guard: "inTransit", actions: ["rememberPointer"] },
          { actions: ["pointerMove", "focusPointerHighlight"] },
        ],
        POINTER_LEAVE: [{ guard: "childOpen" }, { actions: ["forgetPointer", "leaveContent"] }],
        "TREE.CHILD_LEFT": { actions: ["takePendingPointer"] },
        "POSITION.PLACED": { actions: ["setPlacement"] },
        "REGION.CONTEXTMENU": { actions: ["reanchor"] },
        "REGION.LONG_PRESS": { actions: ["reanchor"] },
        OPEN_AT: { actions: ["reanchor"] },
        "DOCUMENT.CONTEXTMENU": [
          { guard: "inRegion", actions: ["reanchor"] },
          { target: "closed", reason: "outside-press", actions: ["setCloseReason"] },
        ],
        SCROLL: { target: "closed", reason: "scroll", actions: ["setCloseReason"] },
      },
    },
  },
})

export type MenuMachine = typeof menuMachine
