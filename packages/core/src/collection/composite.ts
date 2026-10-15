// Connect helpers shared by every collection component: list, item, section and separator
// props for both focus strategies (roving tabindex, aria-activedescendant), the single tab
// stop (with the server-render fallback), set metadata, every collection `data-*`, and the
// key/pointer handlers that turn native input into collection events.

import { isMod, toLogicalKeyEvent } from "../a11y/keys"
import { dataFlag, type PartProps, scopeAttrs } from "../connect/props"
import { describeKey, isTypeaheadKey } from "../dom/keyboard"
import { pointerMoved } from "../dom/pointer-guard"
import type { ModalityEnv, PlatformInfo } from "../env/capabilities"
import { encodeKey } from "../ids"
import type { CollectionKey } from "./key"
import type { Collection, ItemNode, SectionNode } from "./list"
import type { CollectionEvent, FocusStrategy, HighlightSource, LoadingStatus } from "./machine"
import { navigableWhen } from "./navigation"
import { isSelected, type SelectionValue } from "./selection"
import type { TreeCollection } from "./tree"

export interface CompositeState {
  /** The visible collection (a tree's visible nodes). */
  readonly collection: Collection<unknown>
  readonly highlightedKey: CollectionKey | null
  readonly highlightSource: HighlightSource | null
  readonly selection: SelectionValue
  readonly selectionMode: "none" | "single" | "multiple"
  readonly focusableWhenDisabled?: boolean | undefined
  /** `selection`: disabled items are reachable (not selectable). Default `all`. */
  readonly disabledBehavior?: "all" | "selection" | undefined
  /** The whole composite is disabled: nothing in it is a tab stop. */
  readonly disabled?: boolean | undefined
  readonly loading?: LoadingStatus | undefined
  /** A typeahead search is in progress now (read at key time): Space extends it. */
  readonly typingAhead?: (() => boolean) | undefined
  /** Static item parts have not registered yet (server render, first paint). */
  readonly pending?: boolean | undefined
  /** Tree: expanded keys (branches get `aria-expanded`). */
  readonly expanded?: ReadonlySet<CollectionKey> | undefined
  /** Tree: the full tree, so a selected node under a collapsed branch maps to its row. */
  readonly tree?: TreeCollection<unknown> | undefined
}

export interface CompositeOptions {
  readonly scope: string
  /** The instance (root) id, for `data-instance`. */
  readonly instance: string
  readonly ids: { readonly list: string; item(key: CollectionKey): string }
  readonly strategy: FocusStrategy
  readonly orientation: "vertical" | "horizontal" | "both"
  readonly listRole: string
  readonly itemRole: string
  /** How selection is exposed: `aria-selected` (listbox, tree, grid) or a checked state. */
  readonly selectionAttr?: "aria-selected" | "aria-checked" | "aria-pressed" | undefined
  /** Which keys select the highlighted item. Default "both". */
  readonly selectKeys?: "enter" | "space" | "both" | undefined
  /** A tree: the cross axis expands and collapses. */
  readonly tree?: boolean | undefined
}

export type CompositeEnv = PlatformInfo &
  ModalityEnv & { readonly locale: { dir(): "ltr" | "rtl" } }

/** The roving tab stop, or null when the container (or nothing) is. */
export function tabStop(state: CompositeState): CollectionKey | null {
  const { collection: c, highlightedKey: h } = state
  const navigable = navigableWhen(
    state.focusableWhenDisabled === true || state.disabledBehavior === "selection",
  )
  const ok = (node: ItemNode<unknown> | undefined): node is ItemNode<unknown> =>
    node !== undefined && navigable(node)
  if (h !== null && ok(c.get(h))) return h
  // A selected node hidden by a collapsed ancestor counts as that ancestor (the visible row).
  const { tree, expanded } = state
  const hiddenSelected =
    tree && expanded && state.selection !== "all"
      ? new Set(
          [...state.selection]
            .filter((k) => !c.has(k))
            .map((k) => tree.nearestVisible(k, expanded))
            .filter((k): k is CollectionKey => k !== null),
        )
      : null
  let first: CollectionKey | null = null
  for (let i = 0; i < c.size; i++) {
    const node = c.at(i)
    if (!ok(node)) continue
    if (isSelected(c, state.selection, node.key) || hiddenSelected?.has(node.key)) return node.key
    first ??= node.key
  }
  return first
}

const nativeKey = (e: unknown) => e as KeyboardEvent

/** The props of each collection part. */
export interface CompositeParts {
  /** The list (container): role, keyboard, and the tab stop when no item can be. */
  list(): PartProps
  /** For an input that keeps focus (combobox): the active descendant. */
  activeDescendant(): PartProps
  item(key: CollectionKey): PartProps
  section(section: SectionNode): PartProps
  sectionLabel(section: SectionNode): PartProps
  separator(): PartProps
}

export function composite(
  state: CompositeState,
  send: (event: CollectionEvent) => void,
  env: CompositeEnv,
  o: CompositeOptions,
): CompositeParts {
  const c = state.collection
  const roving = o.strategy === "roving"
  const inert = state.disabled === true && state.focusableWhenDisabled !== true
  const stop = inert || state.pending ? null : tabStop(state)
  const highlighted = state.highlightedKey !== null && c.has(state.highlightedKey)
  const selectionAttr = o.selectionAttr ?? "aria-selected"
  const selectKeys = o.selectKeys ?? "both"
  const firstSelected = state.selection === "all" ? undefined : [...state.selection][0]

  const onKeyDown = (event: unknown) => {
    const e = nativeKey(event)
    if (inert) return
    const k = describeKey(e, env)
    if (k.composing) return
    const logical = toLogicalKeyEvent(k, {
      dir: env.locale.dir(),
      orientation: o.orientation,
      platform: env.platform,
    })
    const handled = () => e.preventDefault()
    const h = state.highlightedKey
    if (isMod(k, env.platform) && !k.shift && !k.alt && k.key.toLowerCase() === "a") {
      if (state.selectionMode === "multiple") {
        send({ type: "SELECT_ALL" })
        handled()
      }
      return
    }
    // Space continues a typeahead search in progress instead of selecting.
    if (k.key === " " && state.typingAhead?.()) {
      send({ type: "TYPEAHEAD", char: " ", composing: false, modifiers: k })
      handled()
      return
    }
    switch (logical?.type) {
      case "NEXT":
      case "PREV":
      case "FIRST":
      case "LAST":
      case "PAGE_NEXT":
      case "PAGE_PREV": {
        const move = {
          NEXT: "next",
          PREV: "previous",
          FIRST: "first",
          LAST: "last",
          PAGE_NEXT: "page-next",
          PAGE_PREV: "page-previous",
        } as const
        send({ type: "NAVIGATE", move: move[logical.type], extend: logical.shift })
        handled()
        return
      }
      case "EXPAND":
      case "COLLAPSE":
        if (!o.tree) return
        send({ type: "NAVIGATE", move: logical.type === "EXPAND" ? "expand" : "collapse" })
        handled()
        return
      case "ACTIVATE": {
        const space = k.key === " "
        const selects = selectKeys === "both" || (selectKeys === "space") === space
        if (!selects || h === null) return
        send({
          type: "SELECT",
          key: h,
          modality: "keyboard",
          shift: logical.shift,
          mod: logical.mod,
        })
        handled()
        return
      }
      default:
        if (isTypeaheadKey(k)) {
          send({ type: "TYPEAHEAD", char: k.key, composing: false, modifiers: k })
          handled()
        }
    }
  }

  const activeDescendant = (): PartProps => ({
    "aria-activedescendant":
      !roving && highlighted && state.highlightedKey !== null
        ? o.ids.item(state.highlightedKey)
        : undefined,
  })

  return {
    /** The list (container): role, keyboard, and the tab stop when no item can be. */
    list: (): PartProps => ({
      ...scopeAttrs(o.scope, "list", o.instance),
      id: o.ids.list,
      role: o.listRole,
      "aria-orientation": o.orientation === "both" ? undefined : o.orientation,
      "aria-multiselectable": state.selectionMode === "multiple" ? "true" : undefined,
      "aria-busy":
        state.loading === "loading" || state.loading === "loading-more" ? "true" : undefined,
      "aria-disabled": state.disabled ? "true" : undefined,
      "data-orientation": o.orientation,
      "data-loading": dataFlag(state.loading === "loading" || state.loading === "loading-more"),
      "data-empty": dataFlag(!state.pending && c.size === 0),
      "data-disabled": dataFlag(state.disabled === true),
      // Roving: the container is the stop only when no item is; active descendant: always.
      tabindex: inert
        ? undefined
        : roving
          ? state.pending
            ? firstSelected === undefined
              ? 0
              : -1
            : stop === null
              ? 0
              : -1
          : 0,
      ...activeDescendant(),
      onKeyDown,
      onFocusOut: (event: unknown) => {
        const e = event as FocusEvent
        const list = e.currentTarget as Element | null
        if (!list?.contains(e.relatedTarget as Node | null)) send({ type: "COMPOSITE.BLUR" })
      },
    }),
    /** For an input that keeps focus (combobox): the active descendant. */
    activeDescendant,
    item: (key: CollectionKey): PartProps => {
      const node = c.get(key)
      const isHighlighted = state.highlightedKey === key && node !== undefined
      const selected = isSelected(c, state.selection, key)
      const disabled = node?.disabled === true
      const selectable = state.selectionMode !== "none"
      const expanded = state.expanded
      const tabindex = !roving
        ? undefined
        : inert
          ? -1
          : state.pending || !node
            ? key === firstSelected
              ? 0
              : -1
            : key === stop
              ? 0
              : -1
      return {
        ...scopeAttrs(o.scope, "item", o.instance),
        id: o.ids.item(key),
        role: o.itemRole,
        tabindex,
        "data-key": key,
        "data-highlighted": dataFlag(isHighlighted),
        "data-selected": dataFlag(selected),
        "data-disabled": dataFlag(disabled),
        "data-focus-visible": dataFlag(
          isHighlighted &&
            (state.highlightSource === "keyboard" || state.highlightSource === "typeahead"),
        ),
        [selectionAttr]: selectable ? String(selected) : undefined,
        "aria-disabled": disabled ? "true" : undefined,
        "aria-posinset": node ? node.setIndex + 1 : undefined,
        "aria-setsize": node ? node.setSize : undefined,
        "aria-level": o.tree && node ? node.level + 1 : undefined,
        "aria-expanded":
          o.tree && node?.hasChildren ? String(expanded?.has(key) === true) : undefined,
        onClick: (event: unknown) => {
          const e = event as MouseEvent
          if (inert || !node) return
          const modality = env.modality.modality()
          send({ type: "HIGHLIGHT", key, source: modality === "keyboard" ? "keyboard" : "pointer" })
          send({
            type: "SELECT",
            key,
            modality,
            shift: e.shiftKey,
            // platform-convention: the selection modifier is ⌘ on Apple, Control elsewhere
            mod: env.platform.apple ? e.metaKey : e.ctrlKey,
          })
        },
        onPointerMove: (event: unknown) => {
          const e = event as PointerEvent
          if (inert || e.pointerType === "touch") return
          // Zero-delta moves (content scrolled under a resting pointer) are not movement.
          const view = (e.currentTarget as Element | null)?.ownerDocument.defaultView
          if (view && !pointerMoved(view, e.clientX, e.clientY)) return
          send({ type: "POINTER_MOVE", key })
        },
        // Tab into a roving item, or a click that focused it: the highlight follows focus.
        onFocus: () => {
          if (roving && state.highlightedKey !== key && node) {
            // A click or tap is a pointer highlight (no scroll, no ring); any other focus
            // (Tab, programmatic, assistive technology) shows the ring.
            const m = env.modality.modality()
            const byPointer = m === "pointer" || m === "touch"
            send({ type: "HIGHLIGHT", key, source: byPointer ? "pointer" : "keyboard" })
          }
        },
      }
    },
    section: (section: SectionNode): PartProps => ({
      ...scopeAttrs(o.scope, "section", o.instance),
      role: "group",
      "aria-labelledby": `${o.ids.list}-section-${encodeKey(section.key)}`,
    }),
    sectionLabel: (section: SectionNode): PartProps => ({
      ...scopeAttrs(o.scope, "section-label", o.instance),
      id: `${o.ids.list}-section-${encodeKey(section.key)}`,
      role: "presentation",
    }),
    separator: (): PartProps => ({
      ...scopeAttrs(o.scope, "separator", o.instance),
      role: "separator",
    }),
  }
}
