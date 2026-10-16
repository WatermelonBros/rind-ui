// Menu parts (design §6): the trigger (a button, or a bar item when a menubar hosts the
// level), the positioned `menu` content named by its trigger, items of every kind with
// their checked state, submenu triggers, groups, labels and separators. Key handling acts
// only on keys whose target is the content or one of this level's items (radix#3232).

import { focusAttrs } from "../../a11y/focus"
import { toLogicalKeyEvent } from "../../a11y/keys"
import type { CollectionKey } from "../../collection/key"
import type { Collection } from "../../collection/list"
import { CRITICAL, dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import { describeKey, isTypeaheadKey } from "../../dom/keyboard"
import type { LayerMeta } from "../../dom/layer-stack"
import type { LinkEnv } from "../../dom/link"
import { pointerMoved } from "../../dom/pointer-guard"
import {
  anchorProps,
  arrowProps,
  contentPlacementProps,
  type PlacementState,
  positionerProps,
} from "../../dom/position/connect"
import { quirkActive } from "../../dom/quirks"
import type { ModalityEnv, PlatformInfo } from "../../env/capabilities"
import { separatorProps } from "../separator/separator.connect"
import { buttonLikeProps } from "../shared/button-like"
import type { MenuEvent, MenuItemKind } from "./menu.machine"
import { menuIds } from "./menu.machine"
import type { MenuCloseReason } from "./menu-tree"

export type MenuPart =
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

export type MenuConnectEnv = PlatformInfo &
  ModalityEnv & { readonly locale: { dir(): "ltr" | "rtl" } }

export interface MenuConnectInput {
  /** This level's id. */
  readonly instance: string
  readonly level: "root" | "submenu"
  readonly open: boolean
  readonly modal: boolean
  readonly placement: PlacementState
  readonly closeReason: MenuCloseReason | null
  readonly collection: Collection<unknown>
  readonly highlightedKey: CollectionKey | null
  readonly highlightSource: string | null
  /** A typeahead search is in progress (read at key time): Space extends it. */
  readonly typingAhead: () => boolean
  /** The content is in the document (aria-controls only then). */
  readonly contentMounted: boolean
  /** The element that names a submenu's content: its trigger item. */
  readonly labelledBy?: string | undefined
  /** Default vertical. */
  readonly orientation?: "vertical" | "horizontal" | undefined
  readonly meta?: LayerMeta | undefined
  readonly dir?: "ltr" | "rtl" | undefined
  readonly manual?: boolean | undefined
  /** The root trigger is a menubar item (add-menubar). */
  readonly inMenubar?: boolean | undefined
}

/** One button-like part's own state. */
export interface MenuTriggerState {
  readonly focused: boolean
  readonly modality: Modality
  readonly pressed: boolean
  readonly tag: string
  readonly disabled?: boolean | undefined
  /** Menubar mode: the bar's roving tabindex. */
  readonly tabIndex?: number | undefined
}

export interface MenuItemState {
  readonly kind: MenuItemKind
  readonly disabled: boolean
  readonly closeOnSelect: boolean
  /** Checkbox and radio items. */
  readonly checked?: boolean | undefined
  /** The item has focus (a submenu trigger keeps its highlight only then). */
  readonly focused?: boolean | undefined
}

export interface MenuSubmenuTriggerState {
  readonly disabled: boolean
  readonly focused: boolean
  /** The submenu's own state. */
  readonly open: boolean
  readonly contentId: string
  readonly contentMounted: boolean
}

// Sound: without an href the link branch, the only reader of the link env, is never taken.
const NO_LINK = {} as LinkEnv

type NativeKey = KeyboardEvent

/** The key's target is the content itself or one of this level's own items. */
function ownTarget(e: Event, instance: string): boolean {
  const target = e.target as Element | null
  if (!target || target === e.currentTarget) return target !== null
  return (
    target.getAttribute("data-scope") === "menu" &&
    target.getAttribute("data-instance") === instance &&
    ITEM_PARTS.has(target.getAttribute("data-part") ?? "")
  )
}

const ITEM_PARTS = new Set(["item", "checkbox-item", "radio-item", "submenu-trigger"])

const ROLE: Record<MenuItemKind, string> = {
  item: "menuitem",
  "link-item": "menuitem",
  "checkbox-item": "menuitemcheckbox",
  "radio-item": "menuitemradio",
}

export function menuConnect(
  input: MenuConnectInput,
  send: (event: MenuEvent) => void,
  env: MenuConnectEnv,
) {
  const { instance } = input
  const ids = menuIds(instance)
  const dataState = input.open ? "open" : "closed"
  const orientation = input.orientation ?? "vertical"
  const closeReason = !input.open ? (input.closeReason ?? undefined) : undefined

  const isHighlighted = (key: CollectionKey) =>
    input.highlightedKey === key && input.collection.has(key)

  const onContentKeyDown = (event: unknown) => {
    const e = event as NativeKey
    if (!ownTarget(e, instance)) return
    const k = describeKey(e, env)
    if (k.composing) return
    if (k.key === "Tab") {
      // No preventDefault: the browser's Tab moves on from the root trigger.
      send({ type: "TAB_KEY", shift: k.shift })
      return
    }
    if (k.key === " " && input.typingAhead()) {
      send({ type: "TYPEAHEAD", char: " ", composing: false, modifiers: k })
      e.preventDefault()
      return
    }
    const logical = toLogicalKeyEvent(k, {
      dir: env.locale.dir(),
      orientation,
      platform: env.platform,
    })
    switch (logical?.type) {
      case "NEXT":
      case "PREV":
      case "FIRST":
      case "LAST": {
        const moves = { NEXT: "next", PREV: "previous", FIRST: "first", LAST: "last" } as const
        send({ type: "NAVIGATE", move: moves[logical.type] })
        e.preventDefault()
        return
      }
      case "EXPAND":
        send({ type: "EXPAND" })
        e.preventDefault()
        return
      case "COLLAPSE":
        send({ type: "COLLAPSE" })
        e.preventDefault()
        return
      case "ACTIVATE": {
        if (logical.ctrl || logical.meta || logical.alt) return
        const target = e.target as Element | null
        // A link's Enter is the browser's own activation (one navigation, any target).
        if (k.key === "Enter" && target?.tagName === "A" && target.hasAttribute("href")) return
        // Space never scrolls the page; Enter never reaches a native button (one click).
        e.preventDefault()
        if (target !== e.currentTarget) send({ type: "KEY_ACTIVATE", space: k.key === " " })
        return
      }
      default:
        if (isTypeaheadKey(k)) {
          send({ type: "TYPEAHEAD", char: k.key, composing: false, modifiers: k })
          e.preventDefault()
        }
    }
  }

  /** Pointer handlers shared by every item kind. */
  const itemPointer = (key: CollectionKey, disabled: boolean): PartProps => ({
    onPointerMove: (event: unknown) => {
      const e = event as PointerEvent
      if (!input.open || e.pointerType === "touch") return
      // Zero-delta moves (content scrolled under a resting pointer) are not movement.
      const view = (e.currentTarget as Element | null)?.ownerDocument.defaultView
      if (view && !pointerMoved(view, e.clientX, e.clientY)) return
      // A disabled item takes no pointer highlight, and the previous one goes.
      send(disabled ? { type: "POINTER_LEAVE" } : { type: "POINTER_MOVE", key })
    },
    onFocus: () => {
      if (input.highlightedKey === key) return
      const m = env.modality.modality()
      send({
        type: "HIGHLIGHT",
        key,
        source: m === "pointer" || m === "touch" ? "pointer" : "keyboard",
      })
    },
  })

  const itemBase = (
    part: string,
    key: CollectionKey,
    disabled: boolean,
    highlighted: boolean,
  ): PartProps => ({
    ...scopeAttrs("menu", part, instance),
    id: ids.item(key),
    tabindex: -1,
    "data-key": key,
    "data-highlighted": dataFlag(highlighted),
    "data-disabled": dataFlag(disabled),
    "data-focus-visible": dataFlag(
      highlighted &&
        (input.highlightSource === "keyboard" || input.highlightSource === "typeahead"),
    ),
    "aria-disabled": disabled ? "true" : undefined,
    ...itemPointer(key, disabled),
  })

  return {
    open: input.open,
    trigger: (s: MenuTriggerState): PartProps => {
      const menubar = input.inMenubar === true
      return {
        ...scopeAttrs("menu", "trigger", instance),
        ...anchorProps(ids.trigger),
        ...(menubar
          ? {
              role: "menuitem",
              tabindex: s.tabIndex ?? -1,
              "aria-disabled": s.disabled ? "true" : undefined,
            }
          : buttonLikeProps(
              {
                role: "button",
                tag: s.tag,
                disabled: s.disabled === true,
                focusableWhenDisabled: false,
              },
              NO_LINK,
            )),
        id: ids.trigger,
        "aria-haspopup": "menu",
        "aria-expanded": String(input.open),
        "aria-controls": input.contentMounted ? ids.content : undefined,
        "data-state": dataState,
        "data-disabled": dataFlag(s.disabled === true),
        ...focusAttrs(s.focused, s.modality),
        "data-pressed": dataFlag(s.pressed),
        [CRITICAL]: ["aria-expanded"],
        onKeyDown: (event: unknown) => {
          const e = event as NativeKey
          if (menubar || s.disabled || input.open || e.target !== e.currentTarget) return
          if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return
          if (e.altKey || e.ctrlKey || e.metaKey || e.isComposing) return
          e.preventDefault()
          send({ type: "TRIGGER_KEY", key: e.key === "ArrowDown" ? "first" : "last" })
        },
      }
    },
    positioner: (): PartProps => ({
      ...scopeAttrs("menu", "positioner", instance),
      ...positionerProps(
        input.placement,
        { positioner: ids.positioner, anchor: ids.trigger },
        { dir: input.dir, manual: input.manual === true },
      ),
      "data-state": dataState,
    }),
    content: (own: { label?: string | undefined; labelledBy?: string | undefined }): PartProps => {
      const meta = input.meta
      const named = own.label !== undefined || own.labelledBy !== undefined
      return {
        ...scopeAttrs("menu", "content", instance),
        ...contentPlacementProps(input.placement),
        id: ids.content,
        role: "menu",
        tabindex: -1,
        "aria-orientation": orientation === "horizontal" ? "horizontal" : undefined,
        "aria-label": own.label,
        "aria-labelledby":
          own.labelledBy ?? (named ? undefined : (input.labelledBy ?? ids.trigger)),
        "data-state": dataState,
        "data-orientation": orientation,
        "data-modal": dataFlag(input.level === "root" && input.modal),
        "data-close-reason": closeReason,
        ...(meta
          ? {
              "data-nested": dataFlag(meta.nested),
              "data-has-nested": dataFlag(meta.hasNested),
              style: {
                ...(input.placement.placed ? {} : { "animation-name": "none" }),
                "--layer-index": String(meta.index),
                "--nested-layer-count": String(meta.nestedCount),
              },
            }
          : {}),
        onKeyDown: onContentKeyDown,
        onPointerLeave: (event: unknown) => {
          const e = event as PointerEvent
          if (!input.open || e.pointerType === "touch") return
          send({ type: "POINTER_LEAVE" })
        },
      }
    },
    arrow: (): PartProps => ({
      ...scopeAttrs("menu", "arrow", instance),
      ...arrowProps(input.placement, ids.arrow),
    }),
    /** An item of any kind; link items add `linkProps` (the adapter merges them). */
    item: (key: CollectionKey, s: MenuItemState): PartProps => {
      const part = s.kind === "link-item" ? "item" : s.kind
      const checkable = s.kind === "checkbox-item" || s.kind === "radio-item"
      return {
        ...itemBase(part, key, s.disabled, isHighlighted(key)),
        role: ROLE[s.kind],
        "aria-checked": checkable ? String(s.checked === true) : undefined,
        "data-state": checkable ? (s.checked ? "checked" : "unchecked") : undefined,
        onClick: (event: unknown) => {
          const e = event as MouseEvent
          if (s.disabled) {
            e.preventDefault()
            return
          }
          // Links activate through linkProps' onActivate (same-tab only).
          if (s.kind === "link-item") return
          send({
            type: "ITEM_ACTIVATE",
            key,
            kind: s.kind,
            closeOnSelect: s.closeOnSelect,
            modality: env.modality.modality(),
          })
        },
      }
    },
    /** A link item's same-tab activation (linkProps' onActivate). */
    activateLink: (key: CollectionKey, modality: Modality) =>
      send({ type: "ITEM_ACTIVATE", key, kind: "link-item", closeOnSelect: true, modality }),
    submenuTrigger: (key: CollectionKey, s: MenuSubmenuTriggerState): PartProps => {
      const highlighted = isHighlighted(key) && (!s.open || s.focused)
      // VoiceOver reads the submenu's first item only without the state change.
      const omitExpanded = s.open && quirkActive("vo-submenu-expanded", env)
      return {
        ...itemBase("submenu-trigger", key, s.disabled, highlighted),
        role: "menuitem",
        "aria-haspopup": "menu",
        "aria-expanded": omitExpanded ? undefined : String(s.open),
        "aria-controls": s.contentMounted ? s.contentId : undefined,
        "data-state": s.open ? "open" : "closed",
      }
    },
    radioGroup: (s: { disabled: boolean; labelledBy?: string | undefined }): PartProps => ({
      ...scopeAttrs("menu", "radio-group", instance),
      role: "group",
      "aria-labelledby": s.labelledBy,
      "data-disabled": dataFlag(s.disabled),
    }),
    itemIndicator: (checked: boolean): PartProps => ({
      ...scopeAttrs("menu", "item-indicator", instance),
      "aria-hidden": "true",
      "data-state": checked ? "checked" : "unchecked",
    }),
    itemText: (): PartProps => scopeAttrs("menu", "item-text", instance),
    group: (labelId: string | undefined): PartProps => ({
      ...scopeAttrs("menu", "group", instance),
      role: "group",
      "aria-labelledby": labelId,
    }),
    groupLabel: (id: string): PartProps => ({
      ...scopeAttrs("menu", "group-label", instance),
      id,
      role: "none",
    }),
    separator: (s: { orientation?: unknown; tag: string }): PartProps =>
      separatorProps({
        context: "menu",
        scope: "menu",
        instance,
        tag: s.tag,
        orientation: s.orientation,
        defaultOrientation: orientation === "vertical" ? "horizontal" : "vertical",
      }),
    /** The root trigger's press (the adapter wires press interactions). */
    pressTrigger: (modality: Modality) => send({ type: "TRIGGER_PRESS", modality }),
  }
}
