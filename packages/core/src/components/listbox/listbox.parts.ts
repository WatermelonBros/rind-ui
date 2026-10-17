// The reusable listbox parts (design §2): every attribute, the keyboard map and the pointer
// handling of a list of options, parametrised by scope so Select (and later Combobox,
// Autocomplete, Command) render them under their own `data-scope`. Built on the collection
// composite; no behaviour of their own.

import { focusAttrs } from "../../a11y/focus"
import { type CompositeEnv, composite } from "../../collection/composite"
import type { CollectionKey } from "../../collection/key"
import type { Collection } from "../../collection/list"
import type { CollectionContext, FocusStrategy, LoadingStatus } from "../../collection/machine"
import type { SelectionValue } from "../../collection/selection"
import { isSelected } from "../../collection/selection"
import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import { itemId, partId } from "../../ids"
import { separatorProps } from "../separator/separator.connect"
import type { ListboxEvent } from "./listbox.machine"

/** What a host component's connect supplies to the listbox parts. */
export interface ListboxPartsView {
  readonly scope: string
  readonly instance: string
  readonly collection: Collection<unknown>
  readonly context: Pick<CollectionContext, "highlightedKey" | "highlightSource">
  readonly selection: SelectionValue
  readonly selectionMode: "single" | "multiple" | "none"
  readonly selectionBehavior: "toggle" | "replace"
  readonly orientation: "vertical" | "horizontal"
  readonly strategy?: FocusStrategy | undefined
  readonly disabled: boolean
  readonly focusableWhenDisabled?: boolean | undefined
  readonly disabledBehavior?: "all" | "selection" | undefined
  readonly loading?: LoadingStatus | undefined
  /** Static item parts have not registered yet (server render, first paint). */
  readonly pending?: boolean | undefined
  readonly typingAhead: () => boolean
  /** An `onAction` is given (replace: Enter and a double press act). */
  readonly actions: boolean
  /** Focus is in the list (its `data-focus` / `data-focus-visible`). */
  readonly focused: boolean
  readonly modality: Modality
  /** Mounted parts: a label, the empty part, item descriptions. */
  readonly mounted: {
    readonly label: boolean
    readonly empty: boolean
    readonly description: (key: CollectionKey) => boolean
  }
  readonly send: (event: ListboxEvent) => void
}

export const listboxIds = (scope: string, instance: string) => ({
  list: partId(scope, instance, "list"),
  label: partId(scope, instance, "label"),
  empty: partId(scope, instance, "empty"),
  item: (key: CollectionKey) => itemId(scope, instance, "item", key),
  description: (key: CollectionKey) => itemId(scope, instance, "item-description", key),
})

/** The consumer names the list itself (the label part then does not). */
export interface ListNaming {
  readonly "aria-label"?: string | undefined
  readonly "aria-labelledby"?: string | undefined
}

export function listboxParts(v: ListboxPartsView, env: CompositeEnv) {
  const ids = listboxIds(v.scope, v.instance)
  const mode = v.selectionMode
  // Replace with actions: Enter acts, Space selects; otherwise both keys select.
  const enterActs = v.selectionBehavior === "replace" && v.actions && mode !== "none"
  const parts = composite(
    {
      collection: v.collection,
      highlightedKey: v.context.highlightedKey,
      highlightSource: v.context.highlightSource,
      selection: v.selection,
      selectionMode: mode,
      focusableWhenDisabled: v.focusableWhenDisabled,
      disabledBehavior: v.disabledBehavior,
      disabled: v.disabled,
      loading: v.loading,
      pending: v.pending,
      typingAhead: v.typingAhead,
    },
    v.send,
    env,
    {
      scope: v.scope,
      instance: v.instance,
      ids,
      strategy: v.strategy ?? "roving",
      orientation: v.orientation,
      listRole: "listbox",
      itemRole: "option",
      selectKeys: enterActs ? "space" : "both",
    },
  )
  const empty = !v.pending && v.collection.size === 0 && (v.loading ?? "idle") === "idle"
  const scoped = (part: string) => scopeAttrs(v.scope, part, v.instance)
  const inert = v.disabled && v.focusableWhenDisabled !== true
  return {
    ids,
    isEmpty: empty,
    list: (naming: ListNaming = {}): PartProps => {
      const own = parts.list()
      const keyDown = own["onKeyDown"] as ((e: unknown) => void) | undefined
      return {
        ...own,
        ...focusAttrs(v.focused, v.context.highlightSource === "pointer" ? "pointer" : v.modality),
        // Vertical is the listbox default: the attribute only says horizontal.
        "aria-orientation": v.orientation === "horizontal" ? "horizontal" : undefined,
        "data-selection-mode": mode,
        "aria-labelledby":
          naming["aria-label"] !== undefined || naming["aria-labelledby"] !== undefined
            ? undefined
            : v.mounted.label
              ? ids.label
              : undefined,
        "aria-describedby": empty && v.mounted.empty ? ids.empty : undefined,
        // Focus anywhere in the list (the list itself or a roving item) enters it.
        onFocusIn: () => v.send({ type: "FOCUS", modality: env.modality.modality() }),
        onKeyDown: (e: unknown) => {
          const k = e as KeyboardEvent
          const key = v.context.highlightedKey
          if (enterActs && !inert && k.key === "Enter" && !k.isComposing && key !== null) {
            v.send({ type: "ACTION", key, modality: "keyboard", via: "enter" })
            k.preventDefault()
            return
          }
          keyDown?.(e)
        },
      }
    },
    label: (): PartProps => ({
      ...scoped("label"),
      id: ids.label,
      "data-disabled": dataFlag(v.disabled),
    }),
    item: (key: CollectionKey): PartProps => {
      const own = parts.item(key)
      const selected = mode !== "none" && isSelected(v.collection, v.selection, key)
      return {
        ...own,
        "data-state": mode === "none" ? undefined : selected ? "selected" : "unselected",
        "aria-describedby": v.mounted.description(key) ? ids.description(key) : undefined,
        ...(enterActs
          ? {
              onDoubleClick: () => {
                if (!inert)
                  v.send({
                    type: "ACTION",
                    key,
                    modality: env.modality.modality(),
                    via: "double-press",
                  })
              },
            }
          : {}),
      }
    },
    itemText: (): PartProps => scoped("item-text"),
    // Referenced from the option's aria-describedby; hidden so it is not part of the name.
    itemDescription: (key: CollectionKey): PartProps => ({
      ...scoped("item-description"),
      id: ids.description(key),
      "aria-hidden": "true",
    }),
    itemIndicator: (key: CollectionKey): PartProps => ({
      ...scoped("item-indicator"),
      "aria-hidden": "true",
      "data-state": isSelected(v.collection, v.selection, key) ? "selected" : "unselected",
    }),
    section: parts.section,
    sectionLabel: parts.sectionLabel,
    // listbox allows only option and group children: a decorative separator (A.1).
    separator: (): PartProps =>
      separatorProps({
        context: "listbox",
        tag: "div",
        scope: v.scope,
        instance: v.instance,
        defaultOrientation: v.orientation === "horizontal" ? "vertical" : "horizontal",
      }),
    empty: (): PartProps => ({
      ...scoped("empty"),
      id: ids.empty,
      "data-disabled": dataFlag(v.disabled),
    }),
    loadMore: (): PartProps => ({ ...scoped("load-more"), "aria-hidden": "true" }),
  }
}

export type ListboxParts = ReturnType<typeof listboxParts>
