// Toggle Group parts (design "Connect"): a group root that owns the arrow keys (focus
// only), and items that are Toggles (toggleConnect) with the pressed state the group owns,
// plus the roving tab index of the collections and the group's scope.

import { toLogicalKey } from "../../a11y/keys"
import { type CompositeEnv, tabStop } from "../../collection/composite"
import type { CollectionKey } from "../../collection/key"
import type { Collection } from "../../collection/list"
import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import { describeKey } from "../../dom/keyboard"
import type { LinkEnv } from "../../dom/link"
import { itemId, partId } from "../../ids"
import { toggleConnect } from "../toggle/toggle.connect"
import type { ToggleGroupEvent } from "./toggle-group.machine"

export type ToggleGroupPart = "root" | "item"

export const toggleGroupIds = (root: string) => ({
  list: partId("toggle-group", root, "root"),
  item: (key: CollectionKey) => itemId("toggle-group", root, "item", key),
})

export interface ToggleGroupConnectInput {
  readonly instance: string
  readonly collection: Collection<unknown>
  readonly value: readonly string[]
  readonly highlightedKey: CollectionKey | null
  /** Items not registered yet (server render): the tab stop comes from the value. */
  readonly pending: boolean
  /** The server tab stop (first enabled declared item that is selected, else the first). */
  readonly pendingStop?: string | null | undefined
  readonly orientation: "horizontal" | "vertical"
  readonly selectionMode: "single" | "multiple"
  readonly disabled: boolean
  readonly focusableWhenDisabled: boolean
  /** An item has focus (the root's data-focus). */
  readonly focusWithin: boolean
  /** Hosted by a composite (a Toolbar): the host owns the arrows and the tab stop. */
  readonly hosted?: boolean | undefined
}

export interface ToggleGroupItemState {
  readonly tag: string
  readonly itemDisabled: boolean
  readonly focused: boolean
  readonly modality: Modality
  readonly pressed: boolean
  readonly hovered: boolean
}

export function toggleGroupConnect(
  input: ToggleGroupConnectInput,
  send: (event: ToggleGroupEvent) => void,
  env: CompositeEnv & LinkEnv,
) {
  const ids = toggleGroupIds(input.instance)
  const c = input.collection
  const selection = new Set(input.value)
  const inert = input.disabled && !input.focusableWhenDisabled
  const stop = inert
    ? null
    : tabStop({
        collection: c,
        highlightedKey: input.highlightedKey,
        highlightSource: null,
        selection: new Set([...selection].map((v) => v as CollectionKey)), // keys as stored
        selectionMode: input.selectionMode,
        focusableWhenDisabled: input.focusableWhenDisabled,
      })
  return {
    root: (): PartProps => ({
      ...scopeAttrs("toggle-group", "root", input.instance),
      id: ids.list,
      role: "group",
      "data-orientation": input.orientation,
      "data-selection-mode": input.selectionMode,
      "data-focus": dataFlag(input.focusWithin),
      "data-disabled": dataFlag(input.disabled),
      // The root is the stop only when no item is navigable.
      tabindex: inert || input.pending || stop !== null || input.hosted ? undefined : 0,
      onKeyDown: (event: unknown) => {
        if (input.hosted) return
        const e = event as KeyboardEvent
        const target = e.target as Element | null
        // Only keys on an item of this group (a descendant's keys stay its own).
        if (
          inert ||
          target?.getAttribute("data-part") !== "item" ||
          target.getAttribute("data-instance") !== input.instance
        ) {
          return
        }
        const k = describeKey(e, env)
        if (k.composing || k.alt || k.ctrl || k.meta) return
        const logical = toLogicalKey(k, {
          dir: env.locale.dir(),
          // A vertical group accepts both arrow pairs; a horizontal one only its own.
          orientation: input.orientation === "vertical" ? "both" : "horizontal",
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
        const root = e.currentTarget as Element | null
        if (!root?.contains(e.relatedTarget as Node | null)) send({ type: "BLUR" })
      },
    }),
    item: (key: CollectionKey, s: ToggleGroupItemState): PartProps => {
      const node = c.get(key)
      const disabled = input.disabled || s.itemDisabled || node?.disabled === true
      const on = selection.has(key)
      const toggle = toggleConnect(
        {
          instance: input.instance,
          tag: s.tag,
          on,
          disabled,
          focusableWhenDisabled: input.focusableWhenDisabled,
          focused: s.focused,
          modality: s.modality,
          pressed: s.pressed,
          hovered: s.hovered,
        },
        env,
      ).root()
      // Server render (items not registered): the first selected item, else the first.
      // A disabled group has no tab stop, unless its items stay focusable.
      const tabindex = inert
        ? -1
        : input.pending
          ? key === input.pendingStop
            ? 0
            : -1
          : key === stop
            ? 0
            : -1
      return {
        ...toggle,
        ...scopeAttrs("toggle-group", "item", input.instance),
        id: ids.item(key),
        tabindex,
        "data-key": key,
        "data-orientation": input.orientation,
        "data-highlighted": dataFlag(input.highlightedKey === key),
        onFocus: () => send({ type: "FOCUS", key, modality: env.modality.modality() }),
      }
    },
    /** An item's indicator: decorative, its state the item's (as a lone toggle's). */
    itemIndicator: (
      key: CollectionKey,
      s: Pick<ToggleGroupItemState, "itemDisabled">,
    ): PartProps => {
      const node = c.get(key)
      const disabled = input.disabled || s.itemDisabled || node?.disabled === true
      return {
        ...scopeAttrs("toggle-group", "item-indicator", input.instance),
        "aria-hidden": "true",
        "data-state": selection.has(key) ? "on" : "off",
        "data-disabled": dataFlag(disabled),
      }
    },
  }
}
