// Tag Group parts (design §2): the role set follows interactivity and emptiness (`grid` of
// `row`s with one `gridcell` each; an empty interactive list is a named `group`; display-only
// tags are a `list` of `listitem`s), one roving Tab stop, Enter/Space activation, Delete and
// Backspace removal, the removal hint and the remove button. The grid-with-one-cell roles,
// the empty `group` and the never-`display: contents` List are what Grid List reuses.

import { focusAttrs } from "../../a11y/focus"
import { type CompositeEnv, composite } from "../../collection/composite"
import type { CollectionKey } from "../../collection/key"
import type { Collection } from "../../collection/list"
import type { CollectionContext } from "../../collection/machine"
import type { SelectionValue } from "../../collection/selection"
import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import { describeKey } from "../../dom/keyboard"
import { isWithinId } from "../../dom/tag-group-host"
import { itemId, partId } from "../../ids"
import type { TagGroupEvent } from "./tag-group.machine"
import { tagLinkId } from "./tag-group.machine"
import { type TagGroupMessages, tagGroupMessages } from "./tag-group.messages"

export interface TagGroupView {
  readonly instance: string
  readonly collection: Collection<unknown>
  readonly context: Pick<CollectionContext, "highlightedKey" | "highlightSource">
  readonly selection: SelectionValue
  readonly selectionMode: "none" | "single" | "multiple"
  readonly removable: boolean
  readonly actions: boolean
  readonly links: ReadonlySet<CollectionKey>
  readonly disabled: boolean
  /** Default true: disabled tags stay reachable and announced as dimmed. */
  readonly focusableWhenDisabled: boolean
  /** Static tag parts have not registered yet (server render, first paint). */
  readonly pending: boolean
  /** Focus is inside the group. */
  readonly focused: boolean
  readonly modality: Modality
  /** iOS and Android: no removal hint (a touch screen reader has the button). */
  readonly touchDevice: boolean
  readonly hoveredKey: CollectionKey | null
  readonly pressedKey: CollectionKey | null
  readonly typingAhead: () => boolean
  readonly mounted: { readonly label: boolean; readonly description: boolean }
  readonly messages?: Partial<TagGroupMessages> | undefined
  readonly send: (event: TagGroupEvent) => void
}

export const tagGroupIds = (instance: string) => ({
  root: partId("tag-group", instance, "root"),
  list: partId("tag-group", instance, "list"),
  label: partId("tag-group", instance, "label"),
  description: partId("tag-group", instance, "description"),
  empty: partId("tag-group", instance, "empty"),
  hint: partId("tag-group", instance, "hint"),
  item: (key: CollectionKey) => itemId("tag-group", instance, "item", key),
  text: (key: CollectionKey) => tagLinkId(instance, key),
})

/** The consumer names the list itself (the Label part then does not). */
export interface TagListNaming {
  readonly "aria-label"?: string | undefined
  readonly "aria-labelledby"?: string | undefined
}

/** Keys the group acts on besides navigation: their default action is prevented. */
const REMOVE_KEYS: Readonly<Record<string, "delete" | "backspace">> = {
  Delete: "delete",
  Backspace: "backspace",
}

export function tagGroupConnect(v: TagGroupView, env: CompositeEnv) {
  const ids = tagGroupIds(v.instance)
  const messages = { ...tagGroupMessages, ...v.messages }
  const c = v.collection
  const interactive = v.removable || v.selectionMode !== "none" || v.actions || v.links.size > 0
  const empty = !v.pending && c.size === 0
  const scoped = (part: string) => scopeAttrs("tag-group", part, v.instance)
  const inert = v.disabled
  const parts = composite(
    {
      collection: c,
      highlightedKey: v.context.highlightedKey,
      highlightSource: v.context.highlightSource,
      selection: v.selection,
      selectionMode: v.selectionMode,
      // Disabled tags stay reachable; a disabled group is inert (no Tab stop at all).
      focusableWhenDisabled: !v.disabled && v.focusableWhenDisabled,
      disabled: v.disabled,
      pending: v.pending,
      typingAhead: v.typingAhead,
    },
    v.send,
    env,
    {
      scope: "tag-group",
      instance: v.instance,
      ids,
      strategy: "roving",
      orientation: "both",
      listRole: empty ? "group" : "grid",
      itemRole: "row",
    },
  )
  const textOf = (key: CollectionKey) => c.get(key)?.textValue ?? key
  const tagEnabled = (key: CollectionKey) => !inert && c.get(key)?.disabled !== true
  const hinted =
    v.removable && !v.touchDevice && (v.modality === "keyboard" || v.modality === "virtual")
  const listFocusedItself = v.focused && v.context.highlightedKey === null

  return {
    ids,
    isEmpty: empty,
    interactive,
    root: (): PartProps => ({
      ...scoped("root"),
      id: ids.root,
      "data-empty": dataFlag(empty),
      "data-disabled": dataFlag(v.disabled),
    }),
    label: (): PartProps => ({
      ...scoped("label"),
      id: ids.label,
      "data-disabled": dataFlag(v.disabled),
    }),
    description: (): PartProps => ({ ...scoped("description"), id: ids.description }),
    list: (naming: TagListNaming = {}): PartProps => {
      const named = naming["aria-label"] !== undefined || naming["aria-labelledby"] !== undefined
      const shared = {
        "aria-labelledby": named ? undefined : v.mounted.label ? ids.label : undefined,
        "aria-describedby": v.mounted.description ? ids.description : undefined,
        "data-empty": dataFlag(empty),
        "data-disabled": dataFlag(v.disabled),
        "data-selection-mode": v.selectionMode === "none" ? undefined : v.selectionMode,
      }
      if (!interactive) {
        return { ...scoped("list"), id: ids.list, role: "list", ...shared }
      }
      const own = parts.list()
      const keyDown = own["onKeyDown"] as ((e: unknown) => void) | undefined
      return {
        ...own,
        ...shared,
        // An empty group is a container, not a grid: no selection state of its own.
        "aria-multiselectable": empty ? undefined : own["aria-multiselectable"],
        "data-focus-visible": focusAttrs(listFocusedItself, v.modality)["data-focus-visible"],
        onFocusIn: () => v.send({ type: "FOCUS", modality: env.modality.modality() }),
        onKeyDown: (e: unknown) => {
          const k = e as KeyboardEvent
          const key = v.context.highlightedKey
          if (inert) return
          const d = describeKey(k, env)
          if (d.composing) return
          const plain = !d.shift && !d.alt && !d.ctrl && !d.meta
          const removeVia = REMOVE_KEYS[k.key]
          if (removeVia && plain && key !== null) {
            // Repeats remove one tag each: the repaired highlight is the next target.
            v.send({ type: "REMOVE", key, via: removeVia })
            k.preventDefault()
            return
          }
          if ((k.key === "Enter" || k.key === " ") && plain && key !== null && !k.repeat) {
            if (k.key === " " && v.typingAhead()) {
              keyDown?.(e)
              return
            }
            v.send({
              type: "ACTIVATE",
              key,
              modality: "keyboard",
              via: k.key === "Enter" ? "enter" : "space",
            })
            k.preventDefault()
            return
          }
          // Escape is left to the page (a dialog around the group closes).
          if (k.key === "Escape") return
          keyDown?.(e)
        },
      }
    },
    item: (key: CollectionKey, naming: TagListNaming = {}): PartProps => {
      const removable = v.removable && tagEnabled(key)
      const link = v.links.has(key)
      const extra = {
        "data-hover": dataFlag(interactive && v.hoveredKey === key),
        "data-pressed": dataFlag(interactive && v.pressedKey === key),
        "data-removable": dataFlag(v.removable),
        "data-link": dataFlag(link),
      }
      if (!interactive) {
        return {
          ...scoped("item"),
          id: ids.item(key),
          role: "listitem",
          "data-key": key,
          "data-disabled": dataFlag(c.get(key)?.disabled === true),
          ...extra,
        }
      }
      const own = parts.item(key)
      const named = naming["aria-label"] !== undefined || naming["aria-labelledby"] !== undefined
      return {
        ...own,
        ...extra,
        // A link tag is never selectable: no selection state on it.
        "aria-selected": link ? undefined : own["aria-selected"],
        // Set metadata belongs to treegrid rows; a grid row takes none.
        "aria-posinset": undefined,
        "aria-setsize": undefined,
        "aria-labelledby": named ? undefined : ids.text(key),
        "aria-describedby": removable && hinted ? ids.hint : undefined,
        onClick: (event: unknown) => {
          const e = event as MouseEvent
          if (inert || !c.has(key)) return
          const modality = env.modality.modality()
          v.send({
            type: "HIGHLIGHT",
            key,
            source: modality === "keyboard" ? "keyboard" : "pointer",
          })
          // A press on the tag's own anchor follows natively; any other press clicks it once.
          if (link && isWithinId(e.target as Element | null, ids.text(key))) return
          v.send({ type: "ACTIVATE", key, modality, via: "press" })
        },
      }
    },
    itemCell: (): PartProps => ({
      ...scoped("item-cell"),
      role: interactive ? "gridcell" : undefined,
    }),
    itemText: (key: CollectionKey): PartProps => ({
      ...scoped("item-text"),
      id: ids.text(key),
      // A link's anchor is reached through its row, never by Tab.
      tabIndex: v.links.has(key) ? -1 : undefined,
    }),
    itemRemove: (key: CollectionKey): PartProps => {
      const off = !tagEnabled(key)
      return {
        ...scoped("item-remove"),
        type: "button",
        tabIndex: -1,
        "aria-label": messages.removeLabel(textOf(key)),
        disabled: off ? true : undefined,
        "data-disabled": dataFlag(off),
        // The press focuses the tag, not the button: removal repairs focus from the tag.
        onPointerDown: (event: unknown) => {
          const e = event as PointerEvent
          if (off) return
          e.preventDefault()
          v.send({ type: "HIGHLIGHT", key, source: "pointer" })
        },
        onClick: (event: unknown) => {
          const e = event as MouseEvent
          // Neither the tag's selection nor its action: only the removal.
          e.stopPropagation()
          if (off) return
          v.send({ type: "REMOVE", key, via: "button" })
        },
      }
    },
    /** The hidden description of removable tags (keyboard and virtual modality). */
    /** Rendered only while removable tags reference it (keyboard or virtual, not touch). */
    hinted,
    hint: (): PartProps => ({ ...scoped("hint"), id: ids.hint, hidden: true }),
    hintText: messages.removeHint,
    empty: (): PartProps => ({ ...scoped("empty"), id: ids.empty }),
  }
}

export type TagGroupParts = ReturnType<typeof tagGroupConnect>
