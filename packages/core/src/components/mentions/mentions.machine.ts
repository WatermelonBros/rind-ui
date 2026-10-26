// Mentions (add-mentions design §2–§6): `closed | open` on the combobox pattern. The value is the
// textarea's plain text and the mentions a parallel list of ranges; every input is reconciled
// from the text before and after it (mentions.text), so typing, paste, cut, drag and IME behave
// alike. The list opens only from the field's own input at a trigger, anchored at the trigger.

import type { CollectionKey } from "../../collection/key"
import {
  type CollectionEnv,
  collectionPieces,
  initialCollectionContext,
} from "../../collection/machine"
import { layerId } from "../../dom/layer-stack"
import { overlayEffect } from "../../dom/overlay"
import { positioningPresets, resolvePositioning } from "../../dom/position/options"
import type { BaseDomEnvironment } from "../../env/base-environment"
import type { PositionEnv, VirtualAnchor } from "../../env/position"
import { setup, type } from "../../machine/setup"
import type { ActionArgs, ChangeDetails } from "../../machine/types"
import {
  highlightFirstTyped,
  initialPatternContext,
  type PatternContext,
  type PatternEvent,
  type PatternProps,
  patternIds,
  patternPieces,
} from "../combobox/pattern/machine"
import type { MentionsMessages } from "./mentions.messages"
import {
  applyEdit,
  insertMention,
  type MentionRange,
  type MentionTrigger,
  matchTrigger,
  removeMatch,
  type TriggerMatch,
  triggerId,
  validRanges,
} from "./mentions.text"

export type MentionsEvent =
  | PatternEvent
  /** The textarea's input: its new text and caret. */
  | {
      readonly type: "INPUT"
      readonly value: string
      readonly caret: number
      readonly composing: boolean
    }
  /** The caret moved without an edit (click, arrows that the list does not use). */
  | { readonly type: "CARET"; readonly caret: number }
  | { readonly type: "COMPOSITION.START" }
  | { readonly type: "COMPOSITION.END"; readonly value: string; readonly caret: number }
  | { readonly type: "ENTER"; readonly composing: boolean }
  | { readonly type: "TAB"; readonly composing: boolean }
  | { readonly type: "ESCAPE"; readonly composing: boolean }
  | { readonly type: "ITEM.CHOOSE"; readonly key: CollectionKey }
  | { readonly type: "INPUT.FOCUS" }
  | { readonly type: "INPUT.BLUR" }
  | { readonly type: "MENTION.REMOVE"; readonly id: string }
  | { readonly type: "CLOSE" }
  /** Sent after an input or a caret move: a trigger match is at the caret, or none is. */
  | { readonly type: "MATCHED" }
  | { readonly type: "UNMATCHED" }

export interface MentionsQuery {
  readonly trigger: string
  readonly query: string
}

export interface MentionsSelectDetails {
  readonly trigger: string
  readonly key: string
  readonly text: string
}

export interface MentionsProps extends PatternProps {
  readonly value?: string | undefined
  readonly defaultValue?: string | undefined
  readonly onValueChange?:
    | ((value: string, details: ChangeDetails<MentionsEvent>) => void)
    | undefined
  readonly mentions?: readonly MentionRange[] | undefined
  readonly defaultMentions?: readonly MentionRange[] | undefined
  readonly onMentionsChange?:
    | ((mentions: readonly MentionRange[], details: ChangeDetails<MentionsEvent>) => void)
    | undefined
  readonly triggers: readonly MentionTrigger[]
  /** The query at the caret (null when the list closes): the consumer filters or fetches. */
  readonly onQueryChange?: ((query: MentionsQuery | null) => void) | undefined
  /** An "action" trigger's choice (the query is removed from the text). */
  readonly onSelect?: ((details: MentionsSelectDetails) => void) | undefined
  /** The label inserted for an item (default: the trigger char and the item's text). */
  readonly formatLabel?:
    | ((item: { readonly key: string; readonly text: string }, trigger: string) => string)
    | undefined
  readonly selectOnTab?: boolean | undefined
  readonly readOnly?: boolean | undefined
  readonly disabled?: boolean | undefined
  readonly messages: MentionsMessages
  /** The trigger's position on screen (the parts' caret-rect measurement). */
  readonly anchor?: (() => VirtualAnchor | null) | undefined
}

export interface MentionsEnv {
  /** Puts the caret in the textarea after the value is rendered (the adapter's DOM). */
  readonly setCaret?: ((caret: number) => void) | undefined
}

export interface MentionsContext extends PatternContext {
  readonly match: TriggerMatch | null
  /** Escape closed the list for the match starting here: it stays closed while typing on. */
  readonly dismissedAt: number | null
  readonly caret: number
}

type Types = {
  props: MentionsProps
  events: MentionsEvent
  env: BaseDomEnvironment & PositionEnv & CollectionEnv & MentionsEnv
  context: MentionsContext
  values: "value" | "mentions"
}
type Args = ActionArgs<Types>

export const mentionsIds = (root: string) => patternIds("mentions", root)

const value = (a: Pick<Args, "values">) => a.values.value ?? ""
const ranges = (a: Pick<Args, "values">) => a.values.mentions ?? []
const sameRanges = (x: readonly MentionRange[], y: readonly MentionRange[]) =>
  x.length === y.length &&
  x.every((r, i) => {
    const o = y[i]
    return (
      o !== undefined &&
      r.id === o.id &&
      r.start === o.start &&
      r.end === o.end &&
      r.trigger === o.trigger
    )
  })
const editable = (p: MentionsProps) => p.disabled !== true && p.readOnly !== true

const pieces = collectionPieces({})
const pattern = patternPieces({ scope: "mentions", selected: () => [], collection: pieces.actions })

/** Recomputes the match at the caret and reports a query change. */
function rematch(a: Args, text: string, caret: number) {
  a.set("caret", caret)
  const dismissedAt = a.context.dismissedAt
  // A dismissal holds while the caret stays in the match it closed.
  const m = matchTrigger(text, caret, a.props.triggers, { mentions: ranges(a), dismissedAt })
  const keepDismissal =
    dismissedAt !== null &&
    matchTrigger(text, caret, a.props.triggers, { mentions: ranges(a) })?.start === dismissedAt
  if (!keepDismissal) a.set("dismissedAt", null)
  const before = a.context.match
  a.set("match", m)
  a.send(m ? { type: "MATCHED" } : { type: "UNMATCHED" })
  if (
    before?.trigger !== m?.trigger ||
    before?.query !== m?.query ||
    (before === null) !== (m === null)
  ) {
    a.props.onQueryChange?.(m ? { trigger: m.trigger, query: m.query } : null)
  }
}

export const mentionsMachine = /* @__PURE__ */ setup({
  types: type<Types>(),
  guards: {
    ...pattern.guards,
    editable: ({ props }) => editable(props),
    matched: ({ context }) => context.match !== null,
    tabChooses: ({ props, context }) =>
      props.selectOnTab !== false &&
      context.highlightedKey !== null &&
      props.collection.has(context.highlightedKey),
  },
  actions: {
    ...pieces.actions,
    ...pattern.actions,
    /** The input: reconcile the ranges, maybe remove a mention whole, then match at the caret. */
    input: (a) => {
      const e = a.event
      if (e.type !== "INPUT" && e.type !== "COMPOSITION.END") return
      const r = applyEdit(value(a), e.value, ranges(a), e.caret)
      if (r.value !== value(a)) a.set("value", r.value)
      if (!sameRanges(r.ranges, ranges(a))) a.set("mentions", r.ranges)
      const caret = r.caret ?? e.caret
      if (r.caret !== null) a.env.setCaret?.(r.caret)
      a.set("dirty", true)
      if (!(e.type === "INPUT" && e.composing)) rematch(a, r.value, caret)
    },
    caret: (a) => {
      if (a.event.type === "CARET") rematch(a, value(a), a.event.caret)
    },
    choose: (a) => {
      const e = a.event
      const key = e.type === "ITEM.CHOOSE" ? e.key : a.context.highlightedKey
      const m = a.context.match
      if (key === null || m === null) return
      const node = a.props.collection.get(key)
      if (!node || node.disabled) return
      const trigger = a.props.triggers.find((t) => triggerId(t) === m.trigger)
      if (!trigger) return
      const text = node.textValue
      if (trigger.behavior === "action") {
        const r = removeMatch(value(a), m, ranges(a))
        a.set("value", r.value)
        if (!sameRanges(r.ranges, ranges(a))) a.set("mentions", r.ranges)
        a.env.setCaret?.(r.caret)
        a.props.onSelect?.({ trigger: m.trigger, key: String(key), text })
      } else {
        const label =
          a.props.formatLabel?.({ key: String(key), text }, m.trigger) ?? `${trigger.char}${text}`
        const r = insertMention(value(a), m, ranges(a), {
          id: String(key),
          label,
          appendSpace: trigger.appendSpace,
        })
        a.set("value", r.value)
        a.set("mentions", r.ranges)
        a.env.setCaret?.(r.caret)
      }
      a.set("match", null)
      a.props.onQueryChange?.(null)
    },
    dismiss: (a) => {
      a.set("dismissedAt", a.context.match?.start ?? null)
      a.set("match", null)
      a.props.onQueryChange?.(null)
    },
    unmatch: (a) => {
      if (a.context.match !== null) a.props.onQueryChange?.(null)
      a.set("match", null)
    },
    removeMention: (a) => {
      if (a.event.type !== "MENTION.REMOVE") return
      const id = a.event.id
      const r = ranges(a).find((m) => m.id === id)
      if (!r) return
      const text = value(a)
      const end = text[r.end] === " " ? r.end + 1 : r.end
      const len = end - r.start
      a.set("value", text.slice(0, r.start) + text.slice(end))
      a.set(
        "mentions",
        ranges(a)
          .filter((m) => m !== r)
          .map((m) => (m.start >= end ? { ...m, start: m.start - len, end: m.end - len } : m)),
      )
    },
    syncRanges: (a) => {
      const v = validRanges(value(a), ranges(a))
      if (!sameRanges(v, ranges(a))) a.set("mentions", v)
    },
    /** The first option is highlighted as results come (default on: design §1, Tab-to-accept). */
    autoHighlight: (a) => {
      if (a.props.autoHighlight !== false && !a.context.composing && !a.props.stale) {
        highlightFirstTyped(a)
      }
    },
    setFocused: ({ set }) => set("focused", true),
    clearFocused: ({ set }) => set("focused", false),
  },
  effects: {
    /** The non-modal listbox layer, positioned at the trigger. */
    overlay: (a) => {
      const ids = mentionsIds(a.props.root)
      const { env, send } = a
      if (typeof document === "undefined") return undefined
      const byId = (id: string) => env.dom.getById(id) as HTMLElement | null
      const stop = overlayEffect(env, {
        id: layerId(`mentions-${a.props.root}`),
        kind: "listbox",
        family: "listbox",
        modal: false,
        opener: () => byId(ids.input),
        elements: () =>
          [byId(ids.input), byId(ids.positioner), byId(ids.popup)].filter(
            (e): e is HTMLElement => e !== null,
          ),
        container: () => byId(ids.popup),
        initialFocus: () => false,
        finalFocus: () => false,
        modality: env.modality.modality(),
        dismiss: {
          escape: false,
          outsidePress: true,
          outsideFocus: false,
          onRequest: (request) => send({ type: "OUTSIDE_PRESS", request }),
        },
      })
      const track = env.position.track({
        anchor: { kind: "virtual", get: () => a.props.anchor?.() ?? null },
        positioner: ids.positioner,
        arrow: `${ids.positioner}-arrow`,
        options: () => resolvePositioning(a.props.positioning, positioningPresets.dropdown),
        onPlacement: (p, first) => send({ type: "POSITION.PLACED", ...p, first }),
      })
      return () => {
        track.stop()
        stop()
      }
    },
  },
}).machine({
  id: "mentions",
  initial: "closed",
  context: (props) => ({
    ...initialCollectionContext(),
    ...initialPatternContext(),
    lastCollection: props.collection,
    match: null,
    dismissedAt: null,
    caret: 0,
  }),
  values: {
    value: { fallback: "" },
    mentions: { fallback: [], equal: sameRanges },
  },
  onProps: { collection: "COLLECTION.CHANGE", loading: "LOADING.SYNC" },
  on: {
    "INPUT.FOCUS": { actions: ["setFocused"] },
    "COMPOSITION.START": { actions: ["startComposition"] },
    "MENTION.REMOVE": { guard: "editable", actions: ["removeMention"] },
  },
  states: {
    closed: {
      entry: ["clearHighlight", "endLag", "resetPlacement"],
      on: {
        INPUT: { guard: "editable", actions: ["input"] },
        "COMPOSITION.END": { actions: ["endComposition", "input"] },
        CARET: { actions: ["caret"] },
        "INPUT.BLUR": { actions: ["clearFocused"] },
        "COLLECTION.CHANGE": { actions: ["repairCollection"] },
        MATCHED: { guard: "editable", target: "open" },
      },
    },
    open: {
      entry: ["autoHighlight", "announceOpen"],
      effects: ["overlay"],
      on: {
        INPUT: { guard: "editable", actions: ["input"] },
        "COMPOSITION.END": { actions: ["endComposition", "input"] },
        CARET: { actions: ["caret"] },
        ARROW: { guard: "keyable", actions: ["arrow"] },
        NAVIGATE: { actions: ["endLag", "navigate", "scrollToHighlighted", "announceHighlight"] },
        HIGHLIGHT: { actions: ["endLag", "highlight"] },
        POINTER_MOVE: { actions: ["endLag", "pointerMove"] },
        "LIST.POINTER_LEAVE": { guard: "leaveClears", actions: ["clearHighlight"] },
        "ITEM.CHOOSE": { target: "closed", actions: ["choose"] },
        ENTER: {
          guard: { and: ["keyable", "hasHighlight"] },
          target: "closed",
          actions: ["choose"],
        },
        TAB: { guard: { and: ["keyable", "tabChooses"] }, target: "closed", actions: ["choose"] },
        ESCAPE: { guard: "keyable", target: "closed", actions: ["dismiss"] },
        OUTSIDE_PRESS: { target: "closed", actions: ["unmatch"] },
        "INPUT.BLUR": { target: "closed", actions: ["clearFocused", "unmatch"] },
        CLOSE: { target: "closed", actions: ["unmatch"] },
        "COLLECTION.CHANGE": { actions: ["results", "autoHighlight"] },
        "LOADING.SYNC": { actions: ["announceLoading"] },
        "POSITION.PLACED": { actions: ["placed"] },
        "ACTIVEDESCENDANT.FLUSH": { actions: ["flush"] },
        UNMATCHED: { target: "closed" },
      },
    },
  },
})

export type MentionsMachine = typeof mentionsMachine
export type MentionsState = "closed" | "open"
