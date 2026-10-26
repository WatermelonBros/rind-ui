// combobox-pattern machine pieces (design §2): the guards and actions every input-driven
// listbox host spreads into its own machine — highlight while typing with its
// ACTIVEDESCENDANT.FLUSH lag, collection repair, count and no-results announcements, the
// Apple highlight announcement, composition tracking and placement. Combobox and Tags Input
// use them; the popup layer is not here (`popupOverlay` is called from the host's own effect).

import type { CollectionKey } from "../../../collection/key"
import { toKey } from "../../../collection/key"
import type {
  CollectionArgs,
  CollectionContext,
  CollectionEnv,
  CollectionEvent,
  CollectionProps,
} from "../../../collection/machine"
import type { DismissRequest } from "../../../dom/dismiss"
import { layerId } from "../../../dom/layer-stack"
import { overlayEffect } from "../../../dom/overlay"
import { type PlacementState, placementFrom, unplaced } from "../../../dom/position/connect"
import { positioningPresets, resolvePositioning } from "../../../dom/position/options"
import { quirkActive } from "../../../dom/quirk-conditions"
import type { BaseDomEnvironment } from "../../../env/base-environment"
import type { SchedulerEnv } from "../../../env/capabilities"
import type { Align, PositionEnv, PositioningProps, Side } from "../../../env/position"
import { partId } from "../../../ids"
import type { EventObject } from "../../../machine/types"
import { listboxIds } from "../../listbox/listbox.parts"

/** The pattern's messages (combobox-pattern "Pattern Messages"), shared by every host. */
export interface PatternMessages {
  /** The listbox's name when no Label part is rendered. */
  readonly listboxLabel: string
  readonly count: (n: number) => string
  readonly noResults: string
  readonly loading: string
  readonly focusAnnouncement: (item: string, selected: boolean, section?: string) => string
  readonly selectedAnnouncement: (item: string) => string
}

export const patternMessages: PatternMessages = {
  listboxLabel: "Suggestions",
  count: (n) => `${n} ${n === 1 ? "result" : "results"}`,
  noResults: "No results",
  loading: "Loading…",
  focusAnnouncement: (item, selected, section) =>
    [section, item, selected ? "selected" : undefined].filter(Boolean).join(", "),
  selectedAnnouncement: (item) => `${item}, selected`,
}

/** The ids of the pattern's parts under a host's scope. */
export const patternIds = (scope: string, root: string) => ({
  ...listboxIds(scope, root),
  control: partId(scope, root, "control"),
  input: partId(scope, root, "input"),
  positioner: partId(scope, root, "positioner"),
  popup: partId(scope, root, "popup"),
})

/** The events the pattern's pieces handle or send (each host adds its own). */
export type PatternEvent =
  | CollectionEvent
  | {
      readonly type: "ARROW"
      readonly key: "NEXT" | "PREV"
      readonly alt: boolean
      readonly composing: boolean
    }
  /** The pointer left the list. */
  | { readonly type: "LIST.POINTER_LEAVE" }
  | { readonly type: "OUTSIDE_PRESS"; readonly request: DismissRequest }
  | {
      readonly type: "POSITION.PLACED"
      readonly first: boolean
      readonly side: Side
      readonly align: Align
      readonly anchorHidden: boolean
    }
  /** The typing pause ended: the typing highlight reaches aria-activedescendant. */
  | { readonly type: "ACTIVEDESCENDANT.FLUSH"; readonly token: number }
  | { readonly type: "LOADING.SYNC" }

export interface PatternProps extends CollectionProps {
  readonly root: string
  readonly messages: PatternMessages
  readonly autoHighlight?: boolean | undefined
  readonly keepHighlight?: boolean | undefined
  /** The results answer an older query (async): no highlight, count or empty state. */
  readonly stale?: boolean | undefined
  /** How long a typing highlight waits before it reaches `aria-activedescendant` (500 ms). */
  readonly typingPause?: number | undefined
  readonly positioning?: PositioningProps | undefined
}

export interface PatternContext extends CollectionContext {
  readonly focused: boolean
  readonly composing: boolean
  /** Text typed since the last commit (auto highlight applies to typed results only). */
  readonly dirty: boolean
  /** A typing highlight not yet exposed as the active descendant; its flush token. */
  readonly typingLag: number | null
  readonly placement: PlacementState
}

export const initialPatternContext = () => ({
  focused: false,
  composing: false,
  dirty: false,
  typingLag: null,
  placement: unplaced("bottom", "start"),
})

/** What the pattern guards read: any machine whose types extend these. */
export interface PatternReadArgs {
  readonly props: PatternProps
  readonly context: PatternContext
  readonly values: Readonly<Record<string, unknown>>
  readonly env: CollectionEnv & SchedulerEnv
  readonly event: EventObject
}
/** What the pattern actions read and write. */
export interface PatternArgs extends PatternReadArgs {
  set(key: string, value: unknown): void
  send(event: PatternEvent): void
}

const is = <T extends PatternEvent["type"]>(
  e: EventObject,
  type: T,
): e is Extract<PatternEvent, { type: T }> => e.type === type

const firstNavigable = (c: CollectionProps["collection"]) =>
  [...c].find((n) => n.type === "item" && !n.disabled)

/** A typing highlight: data-highlighted at once, the active descendant after the pause. */
export function typingHighlight(a: PatternArgs, key: CollectionKey) {
  a.set("highlightedKey", key)
  a.set("highlightSource", "typing")
  a.set("scrollReason", null)
  // The typed character is spoken first: the active descendant waits for the pause.
  const token = (a.context.typingLag ?? 0) + 1
  a.set("typingLag", token)
  a.env.scheduler.setTimeout(
    () => a.send({ type: "ACTIVEDESCENDANT.FLUSH", token }),
    a.props.typingPause ?? 500,
  )
}

/** The first navigable listed item as a typing highlight; none clears the highlight. */
export function highlightFirstTyped(a: PatternArgs) {
  const first = firstNavigable(a.props.collection)
  if (first) return typingHighlight(a, first.key)
  a.set("highlightedKey", null)
  a.set("highlightSource", null)
}

export function announceCount(a: PatternArgs, scope: string) {
  const { props } = a
  if (props.stale || props.loading === "loading" || props.loading === "loading-more") return
  const n = props.collection.size
  a.env.announcer.announce({
    message: n === 0 ? props.messages.noResults : props.messages.count(n),
    priority: "polite",
    key: `${scope}-count:${props.root}`,
  })
}

/**
 * The guards and actions, bound to the host's scope (announcement keys) and to how it reads
 * the selected option keys (none for a host whose options are never selected).
 */
/* @__NO_SIDE_EFFECTS__ */
export function patternPieces(options: {
  readonly scope: string
  readonly selected: (a: PatternReadArgs) => readonly string[]
  /** The host's collection pieces (highlight repair, scrolling). */
  readonly collection: {
    readonly repairCollection: (a: CollectionArgs) => void
    readonly scrollToHighlighted: (a: CollectionArgs) => void
  }
}) {
  const { scope, selected, collection } = options

  /** The first or last navigable option, or the selected one (arrow and keyboard opens). */
  const highlightEntry = (a: PatternArgs, edge: "first" | "last") => {
    const c = a.props.collection
    // A disabled selected option is never highlighted by keyboard: the first enabled is.
    const sel = selected(a).find((k) => {
      const n = c.get(toKey(k))
      return n !== undefined && !n.disabled
    })
    let key: CollectionKey | null = sel === undefined ? null : toKey(sel)
    if (key === null) {
      const step = edge === "first" ? 1 : -1
      for (let i = edge === "first" ? 0 : c.size - 1; i >= 0 && i < c.size; i += step) {
        const n = c.at(i)
        if (n && !n.disabled) {
          key = n.key
          break
        }
      }
    }
    a.set("highlightedKey", key)
    a.set("highlightSource", "keyboard")
    a.set("scrollReason", "open")
  }

  const guards = {
    /** A key reaches the input: it is focused and no composition is in progress. */
    keyable: ({ event, context }) =>
      context.focused && !context.composing && !("composing" in event && event.composing === true),
    hasHighlight: ({ context, props }) =>
      context.highlightedKey !== null && props.collection.has(context.highlightedKey),
    leaveClears: ({ context, props }) =>
      context.highlightSource === "pointer" && props.keepHighlight !== true,
  } satisfies Record<string, (a: PatternReadArgs) => boolean>

  const actions = {
    /** ArrowDown / ArrowUp (not Alt+ArrowDown) opening the popup highlight the entry. */
    highlightOnArrowOpen: (a) => {
      if (!is(a.event, "ARROW") || a.event.alt) return
      highlightEntry(a, a.event.key === "NEXT" ? "first" : "last")
    },
    arrow: (a) => {
      if (!is(a.event, "ARROW")) return
      a.send({ type: "NAVIGATE", move: a.event.key === "NEXT" ? "next" : "previous" })
    },
    clearHighlight: ({ set }) => {
      set("highlightedKey", null)
      set("highlightSource", null)
    },
    startComposition: ({ set }) => set("composing", true),
    endComposition: ({ set }) => set("composing", false),
    /** New results while open: repair, auto highlight a typing result, count. */
    results: (a) => {
      collection.repairCollection(a)
      const { props, context } = a
      if (props.autoHighlight && context.dirty && !context.composing && !props.stale) {
        const first = firstNavigable(props.collection)
        if (first) typingHighlight(a, first.key)
      }
      announceCount(a, scope)
    },
    /** VoiceOver in Safari ignores activedescendant: keyboard highlights are announced. */
    announceHighlight: (a) => {
      const { context, props } = a
      if (context.highlightSource !== "keyboard" || !quirkActive("vo-activedescendant", a.env)) {
        return
      }
      const key = context.highlightedKey
      const node = key === null ? undefined : props.collection.get(key)
      if (!node || key === null) return
      const section = props.collection.sectionOf(key)
      const entered =
        section && section.key !== context.announcedSection ? section.label : undefined
      a.set("announcedSection", section?.key ?? null)
      a.env.announcer.announce({
        message: props.messages.focusAnnouncement(
          node.textValue,
          selected(a).includes(key),
          entered,
        ),
        key: `${scope}-${props.root}:highlight`,
        lang: a.env.locale.locale(),
      })
    },
    announceOpen: (a) => {
      if (a.context.highlightedKey === null) announceCount(a, scope)
    },
    /** The listed count, as the list is exposed (a host whose open never re-lists). */
    announceCount: (a) => announceCount(a, scope),
    announceLoading: (a) => {
      if (a.props.loading === "loading" || a.props.loading === "loading-more") {
        a.env.announcer.announce({
          message: a.props.messages.loading,
          priority: "polite",
          key: `${scope}-count:${a.props.root}`,
        })
      }
    },
    flush: (a) => {
      if (is(a.event, "ACTIVEDESCENDANT.FLUSH") && a.event.token === a.context.typingLag) {
        a.set("typingLag", null)
      }
    },
    endLag: ({ set }) => set("typingLag", null),
    placed: (a) => {
      if (!is(a.event, "POSITION.PLACED")) return
      a.set("placement", placementFrom(a.event))
      if (a.event.first) collection.scrollToHighlighted(a)
    },
    resetPlacement: ({ set }) => set("placement", unplaced("bottom", "start")),
  } satisfies Record<string, (a: PatternArgs) => void>

  return { guards, actions, highlightEntry }
}

/**
 * The non-modal listbox layer and its positioning (combobox-pattern "Popup Placement"),
 * for a host's own open-state effect: the pattern's effects never include it.
 */
export function popupOverlay(
  a: {
    readonly env: BaseDomEnvironment & PositionEnv
    readonly props: { readonly positioning?: PositioningProps | undefined }
    send(event: PatternEvent): void
  },
  scope: string,
  root: string,
) {
  const ids = patternIds(scope, root)
  const { env, send } = a
  if (typeof document === "undefined") return undefined
  const byId = (id: string) => env.dom.getById(id) as HTMLElement | null
  const stop = overlayEffect(env, {
    id: layerId(`${scope}-${root}`),
    kind: "listbox",
    family: "listbox",
    modal: false,
    opener: () => byId(ids.input),
    // The control (input, buttons, chips) is inside: its presses never dismiss.
    elements: () =>
      [byId(ids.control), byId(ids.positioner), byId(ids.popup)].filter(
        (e): e is HTMLElement => e !== null,
      ),
    container: () => byId(ids.popup),
    initialFocus: () => false,
    finalFocus: () => false,
    modality: env.modality.modality(),
    dismiss: {
      // Escape is the input's key (the machine decides and prevents only when it acted).
      escape: false,
      outsidePress: true,
      outsideFocus: false,
      onRequest: (request: DismissRequest) => send({ type: "OUTSIDE_PRESS", request }),
    },
  })
  const track = env.position.track({
    anchor: { kind: "element", id: ids.control },
    positioner: ids.positioner,
    arrow: `${ids.positioner}-arrow`,
    options: () => resolvePositioning(a.props.positioning, positioningPresets.dropdown),
    onPlacement: (p, first) => send({ type: "POSITION.PLACED", ...p, first }),
  })
  return () => {
    track.stop()
    stop()
  }
}
