// Grid List parts (design §3). Tag Group's grid shape (a `grid` of `row`s with one `gridcell`
// each, an empty list as a named `group`, no set metadata on grid rows) plus collection-grid:
// the key-ownership rule decides which keys the grid handles from a row, a control, an
// editable element or a nested composite; controls take part in child navigation.

import { focusAttrs } from "../../a11y/focus"
import { type CompositeEnv, composite } from "../../collection/composite"
import { type ChildNavigation, gridHandlesOnControl, owner } from "../../collection/grid"
import type { CollectionKey } from "../../collection/key"
import type { Collection } from "../../collection/list"
import type { CollectionContext } from "../../collection/machine"
import { isSelected, type SelectionValue } from "../../collection/selection"
import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import { spatialTarget } from "../../dom/grid-layout"
import { describeKey } from "../../dom/keyboard"
import { activateLink, type LinkEnv } from "../../dom/link"
import { controlsOf } from "../../dom/row-controls"
import { itemId, partId } from "../../ids"
import type { GridListEvent } from "./grid-list.machine"
import { type GridListMessages, gridListMessages } from "./grid-list.messages"

export type GridListLayout = "stack" | "grid"

export interface GridListView {
  readonly instance: string
  readonly collection: Collection<unknown>
  readonly context: Pick<CollectionContext, "highlightedKey" | "highlightSource"> & {
    readonly childIndex: number
  }
  readonly selection: SelectionValue
  readonly selectionMode: "none" | "single" | "multiple"
  readonly selectionBehavior: "toggle" | "replace"
  readonly childNavigation: ChildNavigation
  readonly layout: GridListLayout
  readonly actions: boolean
  /** Rows with `href`: activated as links. */
  readonly links: ReadonlyMap<CollectionKey, string>
  readonly disabled: boolean
  readonly focusableWhenDisabled?: boolean | undefined
  readonly disabledBehavior?: "all" | "selection" | undefined
  readonly disallowTypeAhead: boolean
  readonly pending: boolean
  readonly focused: boolean
  readonly modality: Modality
  readonly hoveredKey: CollectionKey | null
  readonly pressedKey: CollectionKey | null
  readonly typingAhead: () => boolean
  readonly mounted: {
    readonly label: boolean
    readonly description: (key: CollectionKey) => boolean
  }
  readonly messages?: Partial<GridListMessages> | undefined
  readonly send: (event: GridListEvent) => void
}

export const gridListIds = (instance: string) => ({
  list: partId("grid-list", instance, "list"),
  label: partId("grid-list", instance, "label"),
  empty: partId("grid-list", instance, "empty"),
  item: (key: CollectionKey) => itemId("grid-list", instance, "item", key),
  text: (key: CollectionKey) => itemId("grid-list", instance, "item-text", key),
  description: (key: CollectionKey) => itemId("grid-list", instance, "item-description", key),
  checkbox: (key: CollectionKey) => itemId("grid-list", instance, "item-checkbox", key),
})

export interface GridListNaming {
  readonly "aria-label"?: string | undefined
  readonly "aria-labelledby"?: string | undefined
}

export interface GridListItemOptions extends GridListNaming {
  /** `aria-current` / `data-current` (a link row for the current page). */
  readonly current?: boolean | "page" | "step" | "location" | "date" | "time" | undefined
}

const ROW = '[role="row"]'

export function gridListConnect(v: GridListView, env: CompositeEnv & LinkEnv) {
  const ids = gridListIds(v.instance)
  const messages = { ...gridListMessages, ...v.messages }
  const c = v.collection
  const empty = !v.pending && c.size === 0
  const scoped = (part: string) => scopeAttrs("grid-list", part, v.instance)
  const inert = v.disabled && v.focusableWhenDisabled !== true
  const enterActs = v.actions
  const parts = composite(
    {
      collection: c,
      highlightedKey: v.context.highlightedKey,
      highlightSource: v.context.highlightSource,
      selection: v.selection,
      selectionMode: v.selectionMode,
      focusableWhenDisabled: !v.disabled && v.focusableWhenDisabled === true,
      disabledBehavior: v.disabledBehavior,
      disabled: v.disabled,
      pending: v.pending,
      typingAhead: v.typingAhead,
    },
    v.send,
    env,
    {
      scope: "grid-list",
      instance: v.instance,
      ids,
      strategy: "roving",
      // Stack: Up/Down move rows. Grid: Left/Right move in collection order (Up/Down are
      // spatial, handled here before the composite).
      orientation: v.layout === "grid" ? "horizontal" : "vertical",
      listRole: empty ? "group" : "grid",
      itemRole: "row",
    },
  )
  const rowEnabled = (key: CollectionKey) => !v.disabled && c.get(key)?.disabled !== true
  const highlighted = v.context.highlightedKey

  /** Keys on a row's controls, editable elements and nested composites. */
  const onKeyDown = (event: unknown) => {
    const e = event as KeyboardEvent
    if (inert) return
    const target = e.target as Element | null
    const row = target?.closest(ROW) ?? null
    const listEl = e.currentTarget as Element | null
    if (!row || !listEl || row.closest('[role="grid"], [role="group"]') !== listEl) {
      // The list itself (empty, or before a row registers): the composite's keys.
      ;(parts.list()["onKeyDown"] as (e: unknown) => void)(e)
      return
    }
    const key = row.getAttribute("data-key") as CollectionKey | null
    if (key === null) return
    const d = describeKey(e, env)
    if (d.composing) return
    const who = owner(target, row)
    const rtl = env.locale.dir() === "rtl"
    const count = () => controlsOf(row).length
    const handled = () => e.preventDefault()
    if (who === "nested" || who === "other") return
    if (who === "editable") {
      // Every key belongs to the field; Escape returns to the row.
      if (d.key === "Escape") {
        v.send({ type: "NAVIGATE_CHILD", direction: "row", count: count() })
        handled()
      }
      return
    }
    const vertical = d.key === "ArrowUp" || d.key === "ArrowDown"
    if (vertical && v.layout === "grid" && !d.shift && !d.ctrl && !d.meta && !d.alt) {
      const items = [...listEl.querySelectorAll(`:scope ${ROW}[data-key]`)]
      const target = spatialTarget(items, key, d.key === "ArrowDown" ? "down" : "up")
      v.send({
        type: "NAVIGATE_SPATIAL",
        direction: d.key === "ArrowDown" ? "down" : "up",
        target: target as CollectionKey | null,
      })
      handled()
      return
    }
    if (who === "control") {
      if (!gridHandlesOnControl(d.key, v.childNavigation)) return
      if (d.key === "Escape") {
        v.send({ type: "NAVIGATE_CHILD", direction: "row", count: count() })
      } else if (vertical) {
        v.send({ type: "NAVIGATE", move: d.key === "ArrowDown" ? "next" : "previous" })
      } else {
        const forward = (d.key === "ArrowRight") !== rtl
        v.send({ type: "NAVIGATE_CHILD", direction: forward ? "next" : "previous", count: count() })
      }
      handled()
      return
    }
    // The row is the target.
    const plain = !d.shift && !d.ctrl && !d.meta && !d.alt
    if (d.key === "ArrowLeft" || d.key === "ArrowRight") {
      if (v.layout === "grid") {
        ;(parts.list()["onKeyDown"] as (e: unknown) => void)(e)
        return
      }
      // Tab mode keeps Left/Right free for the consumer.
      if (v.childNavigation === "tab" || !plain) return
      const forward = (d.key === "ArrowRight") !== rtl
      if (forward) v.send({ type: "NAVIGATE_CHILD", direction: "next", count: count() })
      handled()
      return
    }
    // ⌘/Ctrl+Shift+Arrow is not a range extension (react-spectrum#6904): only Shift is.
    if (vertical && d.shift && (d.ctrl || d.meta)) return
    if (d.key === "Escape") return
    if (d.key === "Enter" && plain && !e.repeat) {
      const href = v.links.get(key)
      if (href !== undefined) {
        activateLink({ href, tag: "div" }, row, keyPress(e), env)
      } else if (enterActs) {
        v.send({ type: "ACTION", key, modality: "keyboard", via: "enter" })
      } else if (v.selectionMode !== "none") {
        v.send({ type: "SELECT", key, modality: "keyboard", shift: false, mod: false })
      }
      handled()
      return
    }
    if (d.key === " " && !v.typingAhead()) {
      if (v.selectionMode !== "none" && !v.links.has(key)) {
        v.send({ type: "SELECT", key, modality: "keyboard", shift: d.shift, mod: true })
      }
      handled()
      return
    }
    if (v.disallowTypeAhead && d.key.length === 1 && d.key !== " " && plain) return
    ;(parts.list()["onKeyDown"] as (e: unknown) => void)(e)
  }

  return {
    ids,
    isEmpty: empty,
    list: (naming: GridListNaming = {}): PartProps => {
      const own = parts.list()
      const named = naming["aria-label"] !== undefined || naming["aria-labelledby"] !== undefined
      return {
        ...own,
        "aria-multiselectable": empty ? undefined : own["aria-multiselectable"],
        "aria-orientation": undefined,
        "aria-labelledby": named ? undefined : v.mounted.label ? ids.label : undefined,
        ...focusAttrs(v.focused, v.modality),
        "data-layout": v.layout,
        "data-selection-mode": v.selectionMode,
        "data-child-navigation": v.childNavigation,
        onFocusIn: () => v.send({ type: "FOCUS", modality: env.modality.modality() }),
        onKeyDown,
      }
    },
    label: (): PartProps => ({ ...scoped("label"), id: ids.label }),
    item: (key: CollectionKey, options: GridListItemOptions = {}): PartProps => {
      const own = parts.item(key)
      const selectable = v.selectionMode !== "none" && !v.links.has(key)
      const selected = isSelected(c, v.selection, key)
      const childFocused = highlighted === key && v.context.childIndex > 0
      const named = options["aria-label"] !== undefined || options["aria-labelledby"] !== undefined
      const pressRow = (e: MouseEvent, modality: Modality) => {
        const href = v.links.get(key)
        if (href !== undefined) {
          activateLink(
            { href, tag: "div" },
            e.currentTarget as Element,
            mousePress(e, modality),
            env,
          )
          return
        }
        v.send({
          type: "PRESS_ROW",
          key,
          modality,
          shift: e.shiftKey,
          // platform-convention: the selection modifier is ⌘ on Apple, Control elsewhere
          mod: env.platform.apple ? e.metaKey : e.ctrlKey,
        })
      }
      return {
        ...own,
        "aria-selected": selectable ? String(selected) : undefined,
        // Set metadata belongs to treegrid rows (virtualized lists add it back).
        "aria-posinset": undefined,
        "aria-setsize": undefined,
        "aria-labelledby": named ? undefined : ids.text(key),
        "aria-describedby": v.mounted.description(key) ? ids.description(key) : undefined,
        "aria-current": options.current
          ? options.current === true
            ? "true"
            : options.current
          : undefined,
        "data-state": v.selectionMode === "none" ? undefined : selected ? "selected" : "unselected",
        "data-child-focused": dataFlag(childFocused),
        "data-focus-visible-within": dataFlag(
          childFocused && v.modality !== "pointer" && v.modality !== "touch",
        ),
        "data-hover": dataFlag(v.hoveredKey === key),
        "data-pressed": dataFlag(v.pressedKey === key),
        "data-current": dataFlag(options.current !== undefined && options.current !== false),
        onClick: (event: unknown) => {
          const e = event as MouseEvent
          const row = e.currentTarget as Element
          if (inert || !c.has(key)) return
          // A press that began on a control, a field or a nested composite is theirs, even
          // when they stop propagation on click (react-spectrum#4928).
          if (
            owner(e.target as Element, row) !== "row" &&
            owner(e.target as Element, row) !== "other"
          )
            return
          const modality = env.modality.modality()
          v.send({
            type: "HIGHLIGHT",
            key,
            source: modality === "keyboard" ? "keyboard" : "pointer",
          })
          pressRow(e, modality)
        },
        onDoubleClick: (event: unknown) => {
          const e = event as MouseEvent
          if (inert || !enterActs || v.selectionBehavior !== "replace") return
          if (owner(e.target as Element, e.currentTarget as Element) === "control") return
          v.send({ type: "ACTION", key, modality: env.modality.modality(), via: "double-press" })
        },
        // DOM focus on the row or inside it: which child it is (index 0: the row).
        onFocus: (event: unknown) => {
          const e = event as FocusEvent
          const row = e.currentTarget as Element
          const t = e.target as Element
          const who = owner(t, row)
          if (who === "nested") return
          const index =
            who === "row" ? 0 : controlsOf(row).findIndex((x) => x === t || x.contains(t)) + 1
          const m = env.modality.modality()
          v.send({
            type: "FOCUS_CHILD",
            key,
            index: Math.max(index, 0),
            pointer: m === "pointer" || m === "touch",
          })
        },
      }
    },
    itemCell: (): PartProps => ({ ...scoped("item-cell"), role: "gridcell" }),
    itemText: (key: CollectionKey): PartProps => ({ ...scoped("item-text"), id: ids.text(key) }),
    itemDescription: (key: CollectionKey): PartProps => ({
      ...scoped("item-description"),
      id: ids.description(key),
    }),
    /** A row control: in the tab order only in tab mode on the highlighted row. */
    itemControl: (key: CollectionKey): PartProps => {
      const off = !rowEnabled(key)
      return {
        ...scoped("item-control"),
        tabIndex: v.childNavigation === "tab" && highlighted === key && !off ? 0 : -1,
        "aria-disabled": off ? "true" : undefined,
        "data-disabled": dataFlag(off),
        // A disabled row's controls are not pressable.
        onClickCapture: (event: unknown) => {
          if (!off) return
          const e = event as MouseEvent
          e.preventDefault()
          e.stopPropagation()
        },
      }
    },
    /** The selection checkbox: a native checkbox that always toggles its row. */
    itemCheckbox: (key: CollectionKey): PartProps => {
      const off = !rowEnabled(key) || v.selectionMode === "none"
      const selected = isSelected(c, v.selection, key)
      return {
        ...scoped("item-checkbox"),
        id: ids.checkbox(key),
        type: "checkbox",
        checked: selected,
        disabled: off ? true : undefined,
        tabIndex: v.childNavigation === "tab" && highlighted === key && !off ? 0 : -1,
        "aria-label": messages.checkboxLabel,
        "aria-labelledby": `${ids.checkbox(key)} ${ids.text(key)}`,
        "data-state": selected ? "checked" : "unchecked",
        "data-disabled": dataFlag(off),
        onChange: () => {
          if (off) return
          // A checkbox toggles in every behaviour (a documented difference from rows).
          v.send({
            type: "SELECT",
            key,
            modality: env.modality.modality(),
            shift: false,
            mod: true,
          })
        },
      }
    },
    empty: (): PartProps => ({ ...scoped("empty"), id: ids.empty }),
    loadMore: (): PartProps => ({ ...scoped("load-more"), role: "row", "aria-hidden": "true" }),
  }
}

export type GridListParts = ReturnType<typeof gridListConnect>

/** A keyboard Enter as a press (for link activation). */
const keyPress = (e: KeyboardEvent) => ({
  type: "PRESS" as const,
  modality: "keyboard" as const,
  pointerType: "keyboard" as const,
  shiftKey: e.shiftKey,
  ctrlKey: e.ctrlKey,
  metaKey: e.metaKey,
  altKey: e.altKey,
})
/** A click as a press (for link activation). */
const mousePress = (e: MouseEvent, modality: Modality) => ({
  type: "PRESS" as const,
  modality,
  pointerType: "mouse" as const,
  shiftKey: e.shiftKey,
  ctrlKey: e.ctrlKey,
  metaKey: e.metaKey,
  altKey: e.altKey,
})
