// Collection behaviour is not a machine of its own: these are the events, context fields,
// actions and guards a component machine spreads into `setup()`. Collections arrive as a
// prop (`onProps: { collection: "COLLECTION.CHANGE" }`); the snapshot holds keys only, plus
// `lastCollection`, a pointer kept to repair the highlight against the previous order.

import type { Modality } from "../contract/env"
import { quirkActive } from "../dom/quirks"
import type {
  AnnouncerEnv,
  ClockEnv,
  CollectionLayoutEnv,
  DomEnv,
  LocaleEnv,
  ModalityEnv,
  PlatformInfo,
} from "../env/capabilities"
import { collator } from "../i18n/messages"
import type { EventObject } from "../machine/types"
import type { CollectionKey } from "./key"
import type { Collection, ItemNode } from "./list"
import { type Move, move, type Navigable, navigableWhen, repair, treeMove } from "./navigation"
import {
  type Anchor,
  canSelect,
  clearSelection,
  deselect,
  rememberTexts,
  type SelectionConfig,
  type SelectionValue,
  select,
  toggleSelectAll,
} from "./selection"
import type { TreeCollection } from "./tree"
import { idleTypeahead, type TypeaheadState, typeahead } from "./typeahead"

export type HighlightSource = "keyboard" | "typeahead" | "typing" | "pointer" | "programmatic"

export interface Modifiers {
  readonly ctrl: boolean
  readonly meta: boolean
  readonly alt: boolean
}

export type CollectionEvent =
  | { readonly type: "NAVIGATE"; readonly move: Move; readonly extend?: boolean }
  | {
      readonly type: "HIGHLIGHT"
      readonly key: CollectionKey | null
      readonly source: HighlightSource
      /** A popup opening on its selected item: scrolled to the centre. */
      readonly open?: boolean
    }
  | { readonly type: "POINTER_MOVE"; readonly key: CollectionKey }
  | {
      readonly type: "TYPEAHEAD"
      readonly char: string
      readonly composing: boolean
      readonly modifiers: Modifiers
    }
  | {
      readonly type: "SELECT"
      readonly key: CollectionKey
      readonly modality: Modality
      readonly shift: boolean
      readonly mod: boolean
    }
  | { readonly type: "SELECT_ALL" }
  | { readonly type: "CLEAR_SELECTION" }
  | { readonly type: "DESELECT"; readonly key: CollectionKey }
  | { readonly type: "EXPAND"; readonly key: CollectionKey }
  | { readonly type: "COLLAPSE"; readonly key: CollectionKey }
  | { readonly type: "COLLECTION.CHANGE" }
  | { readonly type: "COMPOSITE.BLUR" }

export type FocusStrategy = "roving" | "active-descendant"
export type LoadingStatus = "idle" | "loading" | "loading-more" | "error"

export interface ScrollToIndexDetails {
  readonly index: number
  readonly key: CollectionKey
  readonly reason: "navigation" | "typeahead" | "open"
  /** `center` when a popup opens on its selected item, else `nearest`. */
  readonly align: "nearest" | "center"
}

/** Props every collection component accepts (its own props extend these). */
export interface CollectionProps {
  readonly collection: Collection<unknown>
  readonly strategy: FocusStrategy
  readonly selectionMode?: SelectionConfig["mode"] | undefined
  readonly selectionBehavior?: SelectionConfig["behavior"] | undefined
  readonly disallowEmptySelection?: boolean | undefined
  readonly disabledBehavior?: SelectionConfig["disabledBehavior"] | undefined
  readonly focusableWhenDisabled?: boolean | undefined
  readonly loop?: boolean | undefined
  /** Default 1000 ms (the provider's typeahead timeout). */
  readonly typeaheadTimeout?: number | undefined
  readonly loading?: LoadingStatus | undefined
  readonly onLoadMore?: (() => void) | undefined
  readonly virtualized?: boolean | undefined
  readonly scrollToIndex?: ((details: ScrollToIndexDetails) => void) | undefined
  /** Element ids: the list (container) and each item. */
  readonly ids: { readonly list: string; item(key: CollectionKey): string }
  /** Announcement strings (Apple active-descendant). */
  readonly collectionMessages?: CollectionMessages | undefined
}

export interface CollectionMessages {
  /** "Vegetables, 3 options" when the highlight enters a section. */
  readonly sectionEntered: (label: string, count: number) => string
  readonly selected: string
  readonly notSelected: string
}

export const defaultCollectionMessages: CollectionMessages = {
  sectionEntered: (label, count) => `${label}, ${count} ${count === 1 ? "option" : "options"}`,
  selected: "selected",
  notSelected: "not selected",
}

export interface CollectionContext {
  readonly highlightedKey: CollectionKey | null
  readonly highlightSource: HighlightSource | null
  /** Why the last highlight should scroll ("open" centres it). */
  readonly scrollReason: ScrollToIndexDetails["reason"] | null
  readonly anchor: Anchor | null
  readonly typeahead: TypeaheadState
  readonly lastCollection: Collection<unknown> | null
  /** The collection a load-more was requested for (one request per instance). */
  readonly pendingLoadMore: Collection<unknown> | null
  /** Last known texts of selected keys (labels of filtered-out or unloaded items). */
  readonly texts: ReadonlyMap<CollectionKey, string>
  /** The section of the last announced highlight. */
  readonly announcedSection: CollectionKey | null
}

export const initialCollectionContext = (): CollectionContext => ({
  highlightedKey: null,
  highlightSource: null,
  scrollReason: null,
  anchor: null,
  typeahead: idleTypeahead,
  lastCollection: null,
  pendingLoadMore: null,
  texts: new Map(),
  announcedSection: null,
})

export type CollectionEnv = DomEnv &
  ClockEnv &
  CollectionLayoutEnv &
  LocaleEnv &
  PlatformInfo &
  AnnouncerEnv &
  ModalityEnv

/** Reads and writes the component's selection in its own public value shape. */
export interface SelectionPort {
  read(values: Readonly<Record<string, unknown>>, props: CollectionProps): SelectionValue
  /** The value to `set` for a new selection (the component maps sets to its shape). */
  write(selection: SelectionValue, collection: Collection<unknown>): unknown
  /** The controllable key holding the selection (default "value"). */
  readonly key?: string
}

/** Expanded keys of a tree component (a second controllable). */
export interface ExpansionPort {
  read(values: Readonly<Record<string, unknown>>): ReadonlySet<CollectionKey>
  write(expanded: ReadonlySet<CollectionKey>): unknown
  readonly key: string
  /** Children of a node declared as having unloaded children are requested once. */
  readonly loadChildren?: (key: CollectionKey) => void
}

/** What the collection guards read: any machine whose types extend these. */
export interface CollectionReadArgs {
  readonly props: CollectionProps
  readonly context: CollectionContext
  readonly values: Readonly<Record<string, unknown>>
  readonly env: CollectionEnv
  readonly event: EventObject
}
/** What the collection actions read and write. */
export interface CollectionArgs extends CollectionReadArgs {
  set(key: string, value: unknown): void
}

const configOf = (p: CollectionProps): SelectionConfig => ({
  mode: p.selectionMode ?? "none",
  behavior: p.selectionBehavior ?? "toggle",
  disallowEmpty: p.disallowEmptySelection === true,
  disabledBehavior: p.disabledBehavior ?? "all",
})
/** Disabled items stay reachable with `focusableWhenDisabled` or `disabledBehavior: "selection"`. */
const navigableOf = (p: CollectionProps): Navigable =>
  navigableWhen(p.focusableWhenDisabled === true || p.disabledBehavior === "selection")
/** Narrows a runtime event to one of the collection events by type. */
const is = <T extends CollectionEvent["type"]>(
  e: EventObject,
  type: T,
): e is Extract<CollectionEvent, { type: T }> => e.type === type

export type CollectionPieces = ReturnType<typeof collectionPieces>

/**
 * The actions and guards, bound to how this component stores its selection and, for
 * trees, its expanded keys. The visible collection of a tree is `props.collection` itself
 * (the component derives it with `tree.visible(expanded)`); `tree` is the full one.
 */
export function collectionPieces(options: {
  readonly selection?: SelectionPort
  readonly expansion?: ExpansionPort & {
    readonly tree: (props: CollectionProps) => TreeCollection<unknown>
  }
}) {
  const { selection, expansion } = options
  const selectionKey = selection?.key ?? "value"
  const readSelection = (a: CollectionArgs) => selection?.read(a.values, a.props) ?? new Set()
  const writeSelection = (a: CollectionArgs, s: SelectionValue) => {
    if (!selection) return
    a.set(selectionKey, selection.write(s, a.props.collection))
    a.set("texts", rememberTexts(a.context.texts, a.props.collection, s))
  }
  const setHighlight = (
    a: CollectionArgs,
    key: CollectionKey | null,
    source: HighlightSource,
    reason: ScrollToIndexDetails["reason"] | null,
  ) => {
    a.set("highlightedKey", key)
    a.set("highlightSource", source)
    a.set("scrollReason", reason)
  }
  /** One load-more per collection instance, when the last item is reached while idle. */
  const maybeLoadMore = (a: CollectionArgs, key: CollectionKey | null) => {
    const { collection, loading, onLoadMore } = a.props
    if (!onLoadMore || (loading ?? "idle") !== "idle") return
    if (key === null || key !== collection.lastKey()) return
    if (a.context.pendingLoadMore === collection) return
    a.set("pendingLoadMore", collection)
    onLoadMore()
  }
  const expandKey = (a: CollectionArgs, key: CollectionKey) => {
    if (!expansion) return
    const expanded = expansion.read(a.values)
    const tree = expansion.tree(a.props)
    if (expanded.has(key) || !tree.get(key)?.hasChildren) return
    a.set(expansion.key, expansion.write(new Set([...expanded, key])))
    // Unloaded children: the component requests them (once, until they arrive).
    if (tree.children(key).length === 0) expansion.loadChildren?.(key)
  }
  const collapseKey = (a: CollectionArgs, key: CollectionKey) => {
    if (!expansion) return
    const expanded = expansion.read(a.values)
    if (!expanded.has(key)) return
    const next = new Set(expanded)
    next.delete(key)
    a.set(expansion.key, expansion.write(next))
  }
  const itemElement = (a: CollectionArgs, key: CollectionKey) =>
    a.env.dom.getById(a.props.ids.item(key))

  /** Roving: DOM focus follows the highlight (the container when there is none). */
  const focusHighlighted = (a: CollectionArgs) => {
    if (a.props.strategy !== "roving") return
    const key = a.context.highlightedKey
    const target = key === null ? a.env.dom.getById(a.props.ids.list) : itemElement(a, key)
    if (target && a.env.dom.activeElement() !== target) {
      a.env.modality.markFocus(target, "navigation")
      target.focus({ preventScroll: true })
    }
  }

  const actions = {
    navigate: (a) => {
      if (!is(a.event, "NAVIGATE")) return
      const { collection } = a.props
      const navigable = navigableOf(a.props)
      const from = a.context.highlightedKey
      let target: CollectionKey | null
      if (a.event.move === "expand" || a.event.move === "collapse") {
        if (!expansion) return
        const expanded = expansion.read(a.values)
        const r = treeMove(expansion.tree(a.props), expanded, from, a.event.move, navigable)
        if (r.expand) expandKey(a, r.expand)
        if (r.collapse) collapseKey(a, r.collapse)
        target = r.highlight
      } else {
        const page = a.event.move === "page-next" || a.event.move === "page-previous"
        const pageTarget =
          page && from !== null
            ? a.env.layout.pageTarget(
                a.props.ids.list,
                from,
                a.event.move === "page-next" ? "next" : "previous",
              )
            : null
        target = move(collection, from, a.event.move, {
          loop: a.props.loop === true,
          navigable,
          pageTarget,
        })
      }
      setHighlight(a, target, "keyboard", "navigation")
      // Shift+arrows extend the range from the anchor.
      if (a.event.extend && target !== null && configOf(a.props).mode === "multiple") {
        const r = select(
          collection,
          readSelection(a),
          a.context.anchor ?? (from === null ? null : { key: from, rangeEnd: null }),
          { key: target, modality: "keyboard", shift: true, mod: false },
          configOf(a.props),
        )
        a.set("anchor", r.anchor)
        writeSelection(a, r.value)
      }
      maybeLoadMore(a, target)
    },
    highlight: (a) => {
      if (!is(a.event, "HIGHLIGHT")) return
      const key = a.event.key
      const node = key === null ? undefined : a.props.collection.get(key)
      if (key !== null && (!node || !navigableOf(a.props)(node))) return
      const reason = a.event.open ? "open" : a.event.source === "pointer" ? null : "navigation"
      setHighlight(a, key, a.event.source, reason)
    },
    /** Connect forwards only real moves (pointer-guard), so this is a real move. */
    pointerMove: (a) => {
      if (!is(a.event, "POINTER_MOVE")) return
      const node = a.props.collection.get(a.event.key)
      if (!node || !navigableOf(a.props)(node) || a.context.highlightedKey === a.event.key) {
        // A real move ends a keyboard session even where it highlights nothing (no ring).
        if (a.context.highlightSource !== "pointer") a.set("highlightSource", "pointer")
        return
      }
      setHighlight(a, a.event.key, "pointer", null)
    },
    typeahead: (a) => {
      if (!is(a.event, "TYPEAHEAD")) return
      const { modifiers, composing, char } = a.event
      // Re-checked here so the rule holds without a DOM (connect drops these first).
      if (composing || modifiers.ctrl || modifiers.meta || modifiers.alt) return
      const r = typeahead(
        a.context.typeahead,
        { char, now: a.env.clock.now() },
        a.props.collection,
        a.context.highlightedKey,
        {
          timeout: a.props.typeaheadTimeout ?? 1000,
          collator: collator(a.env.locale.locale()),
          navigable: navigableOf(a.props),
        },
      )
      a.set("typeahead", r.state)
      if (r.key !== null) setHighlight(a, r.key, "typeahead", "typeahead")
    },
    resetTypeahead: (a) => a.set("typeahead", idleTypeahead),
    select: (a) => {
      if (!is(a.event, "SELECT")) return
      const { key, modality, shift, mod } = a.event
      const r = select(
        a.props.collection,
        readSelection(a),
        a.context.anchor,
        { key, modality, shift, mod },
        configOf(a.props),
      )
      a.set("anchor", r.anchor)
      if (r.value !== readSelection(a)) writeSelection(a, r.value)
    },
    selectAll: (a) => {
      const s = readSelection(a)
      const next = toggleSelectAll(a.props.collection, s, configOf(a.props))
      if (next !== s) writeSelection(a, next)
    },
    clearSelection: (a) => {
      const s = readSelection(a)
      const next = clearSelection(s, configOf(a.props))
      if (next !== s) writeSelection(a, next)
    },
    deselect: (a) => {
      if (!is(a.event, "DESELECT")) return
      const s = readSelection(a)
      const next = deselect(a.props.collection, s, a.event.key)
      if (next !== s) writeSelection(a, next)
    },
    expand: (a) => {
      if (is(a.event, "EXPAND")) expandKey(a, a.event.key)
    },
    collapse: (a) => {
      if (is(a.event, "COLLAPSE")) collapseKey(a, a.event.key)
    },
    /**
     * The collection changed: the highlight moves to the nearest surviving key (data
     * driven; unmounting elements never repair), the texts of selected keys are kept.
     */
    repairCollection: (a) => {
      const next = a.props.collection
      const prev = a.context.lastCollection
      if (prev === next) return
      const key = a.context.highlightedKey
      let repaired = repair(prev, next, key, navigableOf(a.props))
      // A tree node hidden by a collapsed ancestor (absent from the visible collection, not
      // merely disabled): its nearest visible ancestor, when that one is navigable.
      if (key !== null && !next.has(key) && expansion) {
        const visible = expansion.tree(a.props).nearestVisible(key, expansion.read(a.values))
        const node = visible === null ? undefined : next.get(visible)
        if (visible !== null && node && navigableOf(a.props)(node)) repaired = visible
      }
      if (repaired !== key) {
        a.set("highlightedKey", repaired)
        // No scroll for a collection change.
        a.set("scrollReason", null)
      }
      a.set("lastCollection", next)
      a.set("texts", rememberTexts(a.context.texts, next, readSelection(a)))
    },
    /** Navigation, typeahead and programmatic highlights scroll; pointer and changes do not. */
    scrollToHighlighted: (a) => {
      const key = a.context.highlightedKey
      const reason = a.context.scrollReason
      if (key === null || reason === null) return
      const node = a.props.collection.get(key)
      if (!node) return
      const align = reason === "open" ? "center" : "nearest"
      if (a.props.virtualized || a.props.scrollToIndex) {
        a.props.scrollToIndex?.({ index: node.index, key, reason, align })
        return
      }
      itemElement(a, key)?.scrollIntoView?.({
        block: align,
        inline: "nearest",
        behavior: "instant",
      })
    },
    focusHighlighted,
    /**
     * Roving, after a collection change while the list has focus: focus follows the
     * repaired highlight (the container when there is none), never to <body>.
     */
    keepFocusInside: (a) => {
      if (a.props.strategy !== "roving") return
      const list = a.env.dom.getById(a.props.ids.list)
      const active = a.env.dom.activeElement()
      // Run while the list has focus: a removed focused item leaves focus on <body>.
      const lost = !active || active === active.ownerDocument.body
      if (list && (lost || list.contains(active))) focusHighlighted(a)
    },
    /**
     * Apple, active-descendant, keyboard highlights only: the item text (with the section
     * and its count when the section changed) and its selected state.
     */
    announceHighlighted: (a) => {
      if (a.props.strategy !== "active-descendant") return
      // VoiceOver in Safari does not read activedescendant changes (the quirk's platforms).
      if (a.context.highlightSource !== "keyboard" || !quirkActive("vo-activedescendant", a.env)) {
        return
      }
      const key = a.context.highlightedKey
      const node = key === null ? undefined : a.props.collection.get(key)
      if (!node || key === null) return
      const m = a.props.collectionMessages ?? defaultCollectionMessages
      const section = a.props.collection.sectionOf(key)
      const parts: string[] = []
      if (section && section.key !== a.context.announcedSection) {
        let count = 0
        for (let i = 0; i < a.props.collection.size; i++) {
          if (a.props.collection.at(i)?.parentKey === section.key) count++
        }
        parts.push(m.sectionEntered(section.label, count))
      }
      a.set("announcedSection", section?.key ?? null)
      parts.push(node.textValue)
      if (configOf(a.props).mode !== "none") {
        parts.push(isSelectedNode(a, node) ? m.selected : m.notSelected)
      }
      a.env.announcer.announce({
        message: parts.join(", "),
        key: `${a.props.ids.list}:highlight`,
        lang: a.env.locale.locale(),
      })
    },
  } satisfies Record<string, (args: CollectionArgs) => void>
  const isSelectedNode = (a: CollectionArgs, node: ItemNode<unknown>) => {
    const s = readSelection(a)
    return s === "all" ? !node.disabled : s.has(node.key)
  }

  const guards = {
    hasHighlight: (a) => a.context.highlightedKey !== null,
    isEmpty: (a) => a.props.collection.size === 0,
    canSelect: (a) =>
      is(a.event, "SELECT") && canSelect(a.props.collection, a.event.key, configOf(a.props)),
    /** A search is in progress: Space extends it instead of selecting. */
    isTypingAhead: (a) =>
      a.context.typeahead.buffer !== "" &&
      a.env.clock.now() - a.context.typeahead.at <= (a.props.typeaheadTimeout ?? 1000),
  } satisfies Record<string, (args: CollectionReadArgs) => boolean>
  return { actions, guards }
}
