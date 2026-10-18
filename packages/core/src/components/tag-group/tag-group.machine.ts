// Tag Group (design §1): a collection of tags that are browsed with one Tab stop and
// optionally selected, acted on, followed or removed. Navigation, typeahead, selection and
// focus repair are the collection pieces; this adds activation precedence, removal by key
// and its announcement. Removal is the collections repair applied to a consumer-owned
// collection: the consumer drops the keys, `COLLECTION.CHANGE` repairs focus and announces.

import type { Modality } from "../../a11y/events"
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
import { isSelected, type SelectionValue, selectedKeys } from "../../collection/selection"
import { itemId } from "../../ids"
import { setup, type } from "../../machine/setup"
import type { ChangeDetails } from "../../machine/types"
import { type TagGroupMessages, tagGroupMessages } from "./tag-group.messages"

/** The public value: one key or null (single), keys (multiple). */
export type TagGroupValue = string | null | readonly string[]

export type TagGroupRemoveVia = "delete" | "backspace" | "enter" | "space" | "button"
export type TagGroupActivateVia = "enter" | "space" | "press"

export interface TagGroupRemoveDetails {
  readonly reason: TagGroupRemoveVia
}

export interface TagGroupActionDetails {
  readonly modality: Modality
  readonly via: TagGroupActivateVia
}

export type TagGroupEvent =
  | CollectionEvent
  | { readonly type: "FOCUS"; readonly modality?: Modality }
  | {
      readonly type: "ACTIVATE"
      readonly key: CollectionKey
      readonly modality: Modality
      readonly via: TagGroupActivateVia
    }
  | { readonly type: "REMOVE"; readonly key: CollectionKey; readonly via: TagGroupRemoveVia }

export interface TagGroupProps extends CollectionProps {
  readonly value?: TagGroupValue | undefined
  readonly defaultValue?: TagGroupValue | undefined
  readonly onValueChange?:
    | ((value: TagGroupValue, details: ChangeDetails<TagGroupEvent>) => void)
    | undefined
  /** Removal: the consumer drops the keys from its data (or keeps them: nothing happens). */
  readonly onRemove?:
    | ((keys: readonly string[], details: TagGroupRemoveDetails) => void)
    | undefined
  readonly onAction?: ((key: string, details: TagGroupActionDetails) => void) | undefined
  /** Keys of tags that are links (their TagText is an anchor). */
  readonly links?: ReadonlySet<CollectionKey> | undefined
  readonly disabled?: boolean | undefined
  /** The instance id: the link anchors are found by it. */
  readonly instance: string
  readonly messages?: Partial<TagGroupMessages> | undefined
}

export interface TagGroupContext extends CollectionContext {
  /** The last removal request: the keys and their texts (the items will be gone). */
  readonly pendingRemoval: {
    readonly keys: readonly CollectionKey[]
    readonly texts: readonly string[]
  } | null
}

/** The value as a selection. */
export function tagSelectionOf(value: TagGroupValue | undefined): SelectionValue {
  if (value === null || value === undefined) return new Set()
  return new Set((typeof value === "string" ? [value] : value).map(toKey))
}

/** A selection in the public shape of the mode: keys in collection order. */
export function tagGroupValueOf(
  s: SelectionValue,
  props: Pick<TagGroupProps, "selectionMode" | "collection">,
): TagGroupValue {
  const keys = selectedKeys(props.collection, s)
  const order = (k: string) => props.collection.get(toKey(k))?.index ?? Number.MAX_SAFE_INTEGER
  const sorted = [...keys].sort((a, b) => order(a) - order(b))
  return props.selectionMode === "multiple" ? sorted : (sorted[0] ?? null)
}

/** Set equality: a parent passing a new array with the same keys is not a change. */
export function sameTagValue(a: TagGroupValue, b: TagGroupValue): boolean {
  if (a === b) return true
  const x = tagSelectionOf(a)
  const y = tagSelectionOf(b)
  if (x === "all" || y === "all") return x === y
  return x.size === y.size && [...x].every((k) => y.has(k))
}

/** The anchor of a link tag's text (TagText renders it with this id). */
export const tagLinkId = (instance: string, key: CollectionKey) =>
  itemId("tag-group", instance, "item-text", key)

const pieces = collectionPieces({
  selection: {
    read: (values) => tagSelectionOf(values["value"] as TagGroupValue | undefined),
    write: (s, collection, props) =>
      tagGroupValueOf(s, { selectionMode: props.selectionMode, collection }),
  },
})

/** null as the runtime's fallback: no selection (a controlled null is a value). */
const EMPTY = null as unknown as string

const mode = (props: TagGroupProps) => props.selectionMode ?? "none"
const enabled = (props: TagGroupProps, key: CollectionKey) => {
  const node = props.collection.get(key)
  return node !== undefined && !node.disabled && props.disabled !== true
}

export const tagGroupMachine = setup({
  types: type<{
    props: TagGroupProps
    events: TagGroupEvent
    env: CollectionEnv
    context: TagGroupContext
    values: "value"
  }>(),
  actions: {
    ...pieces.actions,
    /** Entering the group: the last highlight, else the first selected, else the first tag. */
    highlightInitial: ({ context, props, values, event, set }) => {
      if (context.highlightedKey !== null && props.collection.has(context.highlightedKey)) return
      const key = tabStop({
        collection: props.collection,
        highlightedKey: null,
        highlightSource: null,
        selection: tagSelectionOf(values.value),
        selectionMode: mode(props),
        focusableWhenDisabled: props.focusableWhenDisabled,
        disabledBehavior: props.disabledBehavior,
      })
      set("highlightedKey", key)
      const m = event.type === "FOCUS" ? event.modality : undefined
      const keyboard = m !== undefined && m !== "pointer" && m !== "touch"
      set("highlightSource", keyboard ? "keyboard" : "programmatic")
      set("scrollReason", null)
    },
    /** Link, then action, then selection, then (keyboard, removable) removal. */
    activate: (a) => {
      const { event, props, env, send } = a
      if (event.type !== "ACTIVATE" || !enabled(props, event.key)) return
      if (props.links?.has(event.key)) {
        // A press on the anchor itself follows natively; connect only sends the others.
        env.dom.getById(tagLinkId(props.instance, event.key))?.click()
        return
      }
      if (props.onAction) {
        props.onAction(event.key, { modality: event.modality, via: event.via })
        return
      }
      if (mode(props) !== "none") {
        send({ type: "SELECT", key: event.key, modality: event.modality, shift: false, mod: false })
        return
      }
      if (props.onRemove && event.via !== "press") {
        send({ type: "REMOVE", key: event.key, via: event.via })
      }
    },
    /**
     * The keys of a removal request: the selection minus disabled tags when a selected tag
     * is removed by a key, else the tag alone. Removed selected keys are deselected.
     */
    requestRemoval: (a) => {
      const { event, props, values, context, set } = a
      if (event.type !== "REMOVE" || !props.onRemove || !enabled(props, event.key)) return
      const selection = tagSelectionOf(values.value)
      const bySelection =
        event.via !== "button" && isSelected(props.collection, selection, event.key)
      const keys = bySelection
        ? selectedKeys(props.collection, selection).filter((k) => enabled(props, k))
        : [event.key]
      if (bySelection || isSelected(props.collection, selection, event.key)) {
        const remaining = new Set([...selectedKeys(props.collection, selection)])
        for (const k of keys) remaining.delete(k)
        // Sound: the value stores the public shape, where null is a value (see EMPTY).
        set("value", tagGroupValueOf(remaining, props) as string)
      }
      // A removal by its button highlights its tag: focus repairs from there.
      if (event.via === "button" && context.highlightedKey !== event.key) {
        set("highlightedKey", event.key)
        set("highlightSource", "pointer")
      }
      set("pendingRemoval", {
        keys,
        texts: keys.map((k) => props.collection.get(k)?.textValue ?? k),
      })
      props.onRemove(keys, { reason: event.via })
    },
    /** The keys of the last request that left the collection are announced, once. */
    announceRemoved: ({ context, props, env, set }) => {
      const pending = context.pendingRemoval
      if (!pending) return
      set("pendingRemoval", null)
      const gone = pending.keys
        .map((k, i) => ({ key: k, text: pending.texts[i] ?? k }))
        .filter((x) => !props.collection.has(x.key))
      if (gone.length === 0) return
      const messages = { ...tagGroupMessages, ...props.messages }
      env.announcer.announce({
        message:
          gone.length === 1
            ? messages.removedAnnouncement(gone[0]?.text ?? "")
            : messages.removedCountAnnouncement(gone.length),
        priority: "polite",
        key: `${props.ids.list}:removed`,
        lang: env.locale.locale(),
      })
    },
  },
  guards: {
    ...pieces.guards,
    selectEnabled: ({ event, props }) =>
      event.type === "SELECT" && mode(props) !== "none" && enabled(props, event.key),
  },
}).machine({
  id: "tag-group",
  initial: "idle",
  context: (props) => ({
    ...initialCollectionContext(),
    lastCollection: props.collection,
    pendingRemoval: null,
  }),
  values: { value: { fallback: EMPTY, equal: sameTagValue as never } },
  onProps: { collection: "COLLECTION.CHANGE" },
  on: {
    "COLLECTION.CHANGE": { actions: ["repairCollection", "announceRemoved"] },
    // A TagRemove press may arrive before the group's FOCUS (a virtual cursor click).
    REMOVE: { actions: ["requestRemoval"] },
    ACTIVATE: { actions: ["activate"] },
  },
  states: {
    idle: {
      on: {
        FOCUS: { target: "focused", actions: ["highlightInitial", "focusHighlighted"] },
        HIGHLIGHT: { actions: ["highlight"] },
        SELECT: { guard: "selectEnabled", actions: ["select"] },
      },
    },
    focused: {
      exit: ["resetTypeahead"],
      on: {
        "COMPOSITE.BLUR": "idle",
        "COLLECTION.CHANGE": {
          actions: ["repairCollection", "keepFocusInside", "announceRemoved"],
        },
        FOCUS: { actions: ["focusHighlighted"] },
        NAVIGATE: { actions: ["navigate", "scrollToHighlighted", "focusHighlighted"] },
        HIGHLIGHT: { actions: ["highlight", "scrollToHighlighted", "focusHighlighted"] },
        TYPEAHEAD: { actions: ["typeahead", "scrollToHighlighted", "focusHighlighted"] },
        SELECT: { guard: "selectEnabled", actions: ["select"] },
        SELECT_ALL: { actions: ["selectAll"] },
      },
    },
  },
})
export type TagGroupMachine = typeof tagGroupMachine
