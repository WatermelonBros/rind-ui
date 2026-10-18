// Navigation Menu parts (design §3): a named `nav` landmark (a Sub level is a plain div), a
// list of items, disclosure buttons with `aria-expanded` (never menu roles or
// `aria-haspopup`), links built with link-navigation, contents with no role, an optional
// shared viewport and a decorative indicator. Arrow keys act only on the menu's own
// triggers and links; any other element in a panel keeps its keys.

import { focusAttrs } from "../../a11y/focus"
import { CRITICAL, dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import type { LinkEnv } from "../../dom/link"
import { type PlacementState, positionerProps } from "../../dom/position/connect"
import type { MeasuredIndicator } from "../../dom/selection-indicator"
import { buttonLikeProps } from "../shared/button-like"
import { indicatorProps } from "../shared/indicator"
import {
  type NavigationMenuEvent,
  type NavigationMenuFocusMove,
  navigationMenuIds,
} from "./navigation-menu.machine"
import type { NavigationMenuMessages } from "./navigation-menu.messages"

export type NavigationMenuPart =
  | "root"
  | "sub"
  | "list"
  | "item"
  | "trigger"
  | "content"
  | "link"
  | "indicator"
  | "viewport"
  | "positioner"

export interface NavigationMenuConnectInput {
  readonly instance: string
  /** The open item's key, or null. */
  readonly value: string | null
  /** The item open before the last switch (motion direction). */
  readonly previous: string | null
  /** The level's item keys in DOM order (motion direction). */
  readonly order: readonly string[]
  readonly orientation: "horizontal" | "vertical"
  readonly dir: "ltr" | "rtl"
  /** The last open skipped the open delay. */
  readonly instant: boolean
  readonly placement: PlacementState
  readonly indicator: MeasuredIndicator | null
  /** `positioning.mode` is manual. */
  readonly manual?: boolean | undefined
  readonly messages: NavigationMenuMessages
}

/** A trigger's own state (from the adapter). */
export interface NavigationMenuTriggerState {
  readonly focused: boolean
  readonly modality: Modality
  readonly pressed: boolean
  readonly hovered: boolean
  readonly tag: string
  readonly disabled: boolean
  /** Its panel holds the current page's link. */
  readonly current: boolean
  /** The content is in the document (aria-controls only then). */
  readonly contentMounted: boolean
  /** In a panel, not in the bar. */
  readonly inPanel: boolean
}

// Sound: without an href the link branch, the only reader of the link env, is never taken.
const NO_LINK = {} as LinkEnv

interface KeyLike {
  readonly key: string
  readonly altKey: boolean
  readonly ctrlKey: boolean
  readonly metaKey: boolean
  readonly keyCode?: number
  readonly nativeEvent?: { readonly isComposing?: boolean }
  readonly currentTarget: EventTarget | null
  preventDefault(): void
}

export function navigationMenuConnect(
  input: NavigationMenuConnectInput,
  send: (event: NavigationMenuEvent) => void,
) {
  const { instance } = input
  const ids = navigationMenuIds(instance)
  const scope = (part: NavigationMenuPart) => scopeAttrs("navigation-menu", part, instance)
  const state = (key: string) => (input.value === key ? "open" : "closed")
  const forward = input.dir === "rtl" ? "ArrowLeft" : "ArrowRight"
  const backward = input.dir === "rtl" ? "ArrowRight" : "ArrowLeft"

  /** Arrow, Home and End on a trigger or link: in the bar along its axis, in a panel down. */
  const keyMove = (
    e: KeyLike,
    inPanel: boolean,
    trigger: boolean,
  ): NavigationMenuFocusMove | null => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.nativeEvent?.isComposing || e.keyCode === 229)
      return null
    if (e.key === "Home") return "first"
    if (e.key === "End") return "last"
    const bar = !inPanel && input.orientation === "horizontal"
    const next = bar ? forward : "ArrowDown"
    const prev = bar ? backward : "ArrowUp"
    const into = bar ? "ArrowDown" : forward
    if (e.key === next) return "next"
    if (e.key === prev) return "prev"
    if (trigger && e.key === into) return "into"
    return null
  }
  const onKey = (inPanel: boolean, trigger: boolean) => (e: KeyLike) => {
    const to = keyMove(e, inPanel, trigger)
    const el = e.currentTarget
    if (!to || !(el instanceof Element) || !el.id) return
    e.preventDefault()
    send({ type: "FOCUS.MOVE", from: el.id, to })
  }

  /** `from-start` / `from-end` / `to-start` / `to-end` while a switch moves between items. */
  const motion = (key: string): string | undefined => {
    const { previous, value, order } = input
    if (previous === null || value === null) return undefined
    const a = order.indexOf(previous)
    const b = order.indexOf(value)
    if (a < 0 || b < 0) return undefined
    if (key === value) return b > a ? "from-end" : "from-start"
    if (key === previous) return b > a ? "to-start" : "to-end"
    return undefined
  }

  const dataState = input.value === null ? "closed" : "open"
  return {
    value: input.value,
    root: (own: { readonly labelledBy?: string | undefined }): PartProps => ({
      ...scope("root"),
      id: ids.root,
      "aria-label": own.labelledBy ? undefined : input.messages.label,
      "data-orientation": input.orientation,
      "data-state": dataState,
    }),
    sub: (): PartProps => ({
      ...scope("sub"),
      // The level's root element: the layer's and the keys' boundary.
      id: ids.root,
      "data-orientation": input.orientation,
      "data-state": dataState,
    }),
    list: (): PartProps => ({
      ...scope("list"),
      id: ids.list,
      "data-orientation": input.orientation,
    }),
    item: (key: string): PartProps => ({
      ...scope("item"),
      "data-state": state(key),
      "data-value": key,
    }),
    trigger: (key: string, s: NavigationMenuTriggerState): PartProps => ({
      ...scope("trigger"),
      ...buttonLikeProps(
        { role: "button", tag: s.tag, disabled: s.disabled, focusableWhenDisabled: false },
        NO_LINK,
      ),
      id: ids.trigger(key),
      "aria-expanded": String(input.value === key),
      "aria-controls": s.contentMounted ? ids.content(key) : undefined,
      "data-state": state(key),
      "data-value": key,
      "data-current": dataFlag(s.current),
      "data-hover": dataFlag(s.hovered),
      "data-pressed": dataFlag(s.pressed),
      ...focusAttrs(s.focused, s.modality),
      onKeyDown: onKey(s.inPanel, true),
      [CRITICAL]: ["aria-expanded"],
    }),
    /** Scope and keys for a Link part (link-navigation renders the rest). */
    link: (s: { readonly inPanel: boolean }): PartProps => ({
      ...scope("link"),
      onKeyDown: onKey(s.inPanel, false),
    }),
    content: (key: string): PartProps => ({
      ...scope("content"),
      id: ids.content(key),
      "data-state": state(key),
      "data-orientation": input.orientation,
      "data-motion": motion(key),
      "data-value": key,
    }),
    viewport: (): PartProps => ({
      ...scope("viewport"),
      id: ids.viewport,
      "data-state": dataState,
      "data-orientation": input.orientation,
      "data-instant": dataFlag(input.value !== null && input.instant),
    }),
    positioner: (): PartProps => ({
      ...scope("positioner"),
      ...positionerProps(
        input.placement,
        {
          positioner: ids.positioner,
          anchor: input.value === null ? ids.list : ids.trigger(input.value),
        },
        { dir: input.dir, manual: input.manual === true },
      ),
      "data-state": dataState,
    }),
    indicator: (): PartProps =>
      indicatorProps({
        scope: "navigation-menu",
        instance,
        orientation: input.orientation,
        selected: input.value !== null,
        indicator: input.indicator,
      }),
    /** Trigger presses (the adapter wires press interactions). */
    press: (key: string, modality: Modality) => send({ type: "PRESS", item: key, modality }),
    hoverStart: (key: string) => send({ type: "HOVER.START", item: key }),
    hoverEnd: (key: string) => send({ type: "HOVER.END", item: key }),
  }
}
