// Tabs parts (design "Connect"): a tablist that owns the arrow keys, button-like tabs with
// the roving tab stop and an explicit aria-selected, panels hidden for assistive
// technology (unmount, hidden or until-found), and the measured selection indicator.

import { focusAttrs } from "../../a11y/focus"
import { toLogicalKey } from "../../a11y/keys"
import { type CompositeEnv, tabStop } from "../../collection/composite"
import type { CollectionKey } from "../../collection/key"
import type { Collection } from "../../collection/list"
import { CRITICAL, dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import { describeKey } from "../../dom/keyboard"
import type { LinkEnv } from "../../dom/link"
import type { MeasuredIndicator } from "../../dom/selection-indicator"
import { itemId, partId } from "../../ids"
import { buttonLikeProps } from "../shared/button-like"
import { indicatorProps } from "../shared/indicator"
import type { TabsEvent } from "./tabs.machine"

export type TabsPart = "root" | "list" | "tab" | "panel" | "indicator"
export type InactivePanels = "unmount" | "hidden" | "until-found"

export const tabsIds = (root: string) => ({
  list: partId("tabs", root, "list"),
  tab: (key: CollectionKey) => itemId("tabs", root, "tab", key),
  panel: (key: CollectionKey) => itemId("tabs", root, "panel", key),
})

export interface TabsConnectInput {
  readonly instance: string
  readonly collection: Collection<unknown>
  readonly value: string | null
  readonly highlightedKey: CollectionKey | null
  /** Tabs not registered yet (server render): the tab stop is `pendingStop`. */
  readonly pending: boolean
  readonly pendingStop?: string | null | undefined
  readonly orientation: "horizontal" | "vertical"
  readonly activationMode: "automatic" | "manual"
  readonly inactivePanels: InactivePanels
  readonly disabled: boolean
  readonly focusableWhenDisabled: boolean
  readonly focusWithin: boolean
  /** Keys whose panel element is rendered (aria-controls never dangles: radix#1703). */
  readonly renderedPanels: ReadonlySet<string>
  readonly panelTabbable: Readonly<Record<string, boolean>>
  readonly direction: "next" | "previous" | "none"
  readonly indicator: MeasuredIndicator | null
  /** The panel revealed by find-in-page, until the next selection. */
  readonly revealed: string | null
}

export interface TabsTabState {
  readonly tag: string
  readonly itemDisabled: boolean
  readonly focused: boolean
  readonly modality: Modality
  readonly pressed: boolean
  readonly hovered: boolean
}

export function tabsConnect(
  input: TabsConnectInput,
  send: (event: TabsEvent) => void,
  env: CompositeEnv & LinkEnv,
) {
  const ids = tabsIds(input.instance)
  const c = input.collection
  const selected = input.value
  const vertical = input.orientation === "vertical"
  // A disabled root disables every tab: no tab can be the stop, the list is (spec "Tab Stop
  // And Focus"), unless disabled tabs stay focusable.
  const rootInert = input.disabled === true && input.focusableWhenDisabled !== true
  const stop = rootInert
    ? null
    : tabStop({
        collection: c,
        highlightedKey: input.highlightedKey,
        highlightSource: null,
        selection: new Set(selected === null ? [] : [selected as CollectionKey]), // keys as stored
        selectionMode: "single",
        focusableWhenDisabled: input.focusableWhenDisabled,
      })
  const common = { "data-orientation": input.orientation }
  return {
    root: (): PartProps => ({
      ...scopeAttrs("tabs", "root", input.instance),
      ...common,
      "data-activation-direction": input.direction,
    }),
    list: (): PartProps => ({
      ...scopeAttrs("tabs", "list", input.instance),
      ...common,
      id: ids.list,
      role: "tablist",
      "aria-orientation": vertical ? "vertical" : undefined,
      "data-activation-direction": input.direction,
      "data-focus": dataFlag(input.focusWithin),
      "data-disabled": dataFlag(input.disabled),
      // The list is the stop only when no tab can be (every tab disabled).
      tabindex: input.pending || stop !== null ? undefined : 0,
      onKeyDown: (event: unknown) => {
        const e = event as KeyboardEvent
        const target = e.target as Element | null
        // Only keys on a tab of this list (an input inside a tab, a nested Tabs: radix#2915).
        if (
          target?.getAttribute("data-part") !== "tab" ||
          target.getAttribute("data-instance") !== input.instance
        ) {
          return
        }
        const k = describeKey(e, env)
        if (k.composing || k.alt || k.ctrl || k.meta || k.shift) return
        const logical = toLogicalKey(k, {
          dir: env.locale.dir(),
          orientation: vertical ? "both" : "horizontal",
          platform: env.platform,
        })
        const move =
          logical === "NEXT"
            ? "next"
            : logical === "PREV"
              ? "previous"
              : logical === "FIRST"
                ? "first"
                : logical === "LAST"
                  ? "last"
                  : null
        if (move === null) return
        e.preventDefault()
        send({ type: "NAVIGATE", move })
      },
      onFocusOut: (event: unknown) => {
        const e = event as FocusEvent
        const list = e.currentTarget as Element | null
        if (!list?.contains(e.relatedTarget as Node | null)) send({ type: "BLUR" })
      },
    }),
    tab: (key: CollectionKey, s: TabsTabState): PartProps => {
      const node = c.get(key)
      const disabled = input.disabled || s.itemDisabled || node?.disabled === true
      const on = selected === key
      const tabindex = input.pending ? (key === input.pendingStop ? 0 : -1) : key === stop ? 0 : -1
      return {
        ...scopeAttrs("tabs", "tab", input.instance),
        ...buttonLikeProps(
          {
            role: "tab",
            tag: s.tag,
            disabled,
            focusableWhenDisabled: input.focusableWhenDisabled,
            type: "button",
          },
          env,
        ),
        // Always explicit (spec "Disabled Tabs"), also next to the native attribute.
        "aria-disabled": disabled ? "true" : undefined,
        ...common,
        id: ids.tab(key),
        role: "tab",
        tabindex,
        "aria-selected": String(on),
        "aria-controls": input.renderedPanels.has(key) ? ids.panel(key) : undefined,
        "data-key": key,
        "data-selected": dataFlag(on),
        "data-highlighted": dataFlag(input.highlightedKey === key),
        ...focusAttrs(s.focused, s.modality),
        "data-pressed": dataFlag(s.pressed),
        "data-hover": dataFlag(s.hovered),
        onFocus: () => send({ type: "FOCUS", key, modality: env.modality.modality() }),
        // The id is the part's: the panel's aria-labelledby and the roving focus resolve it.
        [CRITICAL]: ["aria-selected", "!id"],
      }
    },
    /** Whether the panel element of `key` renders at all. */
    panelRendered: (key: CollectionKey) => input.inactivePanels !== "unmount" || selected === key,
    panel: (key: CollectionKey): PartProps => {
      const on = selected === key
      // until-found is applied imperatively (core/dom/until-found); plain hidden until then.
      const hidden = on ? undefined : true
      return {
        ...scopeAttrs("tabs", "panel", input.instance),
        ...common,
        id: ids.panel(key),
        role: "tabpanel",
        "aria-labelledby": ids.tab(key),
        hidden,
        // A panel with nothing tabbable is itself a stop (reka-ui#2430).
        tabindex: on && input.panelTabbable[key] !== true ? 0 : undefined,
        "data-key": key,
        "data-selected": dataFlag(on),
        "data-reveal": on && input.revealed === key ? "find-in-page" : undefined,
      }
    },
    indicator: (): PartProps =>
      indicatorProps({
        scope: "tabs",
        instance: input.instance,
        orientation: input.orientation,
        selected: selected !== null,
        indicator: input.indicator,
      }),
  }
}
