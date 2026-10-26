"use client"

// Mentions (add-mentions): a textarea that opens a listbox at a trigger character ("@", "#",
// "/"). The machine reconciles every input from the text before and after it; here the textarea
// reports input, caret moves and composition, the list parts are the listbox parts under scope
// "mentions" (as Combobox), and the Highlighter mirrors the text with the mentions painted.

import {
  announcerCapability,
  type ChangeDetails,
  type Collection,
  type CollectionKey,
  type ComboboxFilter,
  caretRect,
  createListCollection,
  domPositioning,
  isEmptyState,
  type LoadingStatus,
  layoutCapability,
  type MentionRange,
  type MentionsEvent,
  type MentionsMessages,
  type MentionsQuery,
  type MentionsSelectDetails,
  type MentionTrigger,
  type MessageOverrides,
  mentionsConnect,
  mentionsIds,
  mentionsMachine,
  mentionsMessages,
  type PositioningProps,
  patternResults,
  type Service,
} from "@rind-ui/core"
import {
  type ChangeEvent,
  type ComponentPropsWithRef,
  type CompositionEvent,
  createContext,
  type KeyboardEvent,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { createPopupParts } from "../combobox/popup-parts"
import { joinHandlers } from "../join-handlers"
import { createListboxParts, type ListboxHost } from "../listbox/parts"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useCollectionItems } from "../use-collection-items"
import { useRootId } from "../use-ids"
import { useMachine, useSelector } from "../use-machine"
import { useModality } from "../use-modality"

declare module "../provider" {
  interface RindMessageScopes {
    mentions: MentionsMessages
  }
}

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

const EMPTY = createListCollection({ items: [] as string[], getKey: (s) => s, getText: (s) => s })

/** What every part's `render` receives. */
export interface MentionsRenderState {
  readonly open: boolean
  /** The trigger id at the caret ("@", or a trigger's own id), null when closed. */
  readonly trigger: string | null
  /** The text typed after the trigger. */
  readonly query: string
}

type Api = ReturnType<typeof mentionsConnect>

interface Host extends ListboxHost {
  readonly api: Api
  readonly state: MentionsRenderState
  readonly send: (event: MentionsEvent) => void
  readonly open: boolean
  readonly keepMounted: boolean
  readonly setPresent: (present: boolean) => void
  readonly topLayer: boolean
  readonly textarea: { current: HTMLTextAreaElement | null }
  readonly highlighter: { current: HTMLElement | null }
  readonly selectOnTab: boolean
}

const HostContext = createContext<Host | null>(null)
const useHost = (part: string): Host => {
  const host = useContext(HostContext)
  if (!host) throw new Error(`Mentions.${part} must be inside Mentions.Root`)
  return host
}
/** A part that re-renders on every machine change. */
function useLive(part: string) {
  const host = useHost(part)
  useSelector(host.service, (v) => v)
  return host
}

type Own<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  /** Another element or a render function receiving the props and the state. */
  readonly render?: RenderProp<MentionsRenderState>
}

export type MentionsRootProps = Omit<Own<"div">, "defaultValue" | "onSelect"> & {
  /** Controlled text. */
  readonly value?: string
  /** Uncontrolled text. Default "". */
  readonly defaultValue?: string
  /** Every change of the text. */
  readonly onValueChange?: (value: string, details: ChangeDetails<MentionsEvent>) => void
  /** Controlled mention ranges. */
  readonly mentions?: readonly MentionRange[]
  /** Uncontrolled mention ranges. */
  readonly defaultMentions?: readonly MentionRange[]
  /** Mentions added, moved or removed. */
  readonly onMentionsChange?: (
    mentions: readonly MentionRange[],
    details: ChangeDetails<MentionsEvent>,
  ) => void
  /** `{ char, id?, behavior?: "insert" | "action", startOfInput?, allowSpaces?, appendSpace? }`. */
  readonly triggers: readonly MentionTrigger[]
  /** The options for the current query (default: the Item parts, filtered by the query). */
  readonly items?: Collection<unknown>
  /** The matcher for the Item parts; `null` lists them unfiltered. */
  readonly filter?: ComboboxFilter | null
  /** The trigger and query at the caret; null when it closes. */
  readonly onQueryChange?: (query: MentionsQuery | null) => void
  /** An "action" trigger's choice. */
  readonly onSelect?: (details: MentionsSelectDetails) => void
  /** The inserted label (default: the trigger char and the text). */
  readonly formatLabel?: (
    item: { readonly key: string; readonly text: string },
    trigger: string,
  ) => string
  /** Tab inserts the highlighted option. Default true. */
  readonly selectOnTab?: boolean
  /** Results are loading. */
  readonly loading?: LoadingStatus
  /** No editing; the list never opens. */
  readonly readOnly?: boolean
  /** Not editable or submitted. */
  readonly disabled?: boolean
  /** The list's placement at the trigger (default: below, flipping). */
  readonly positioning?: PositioningProps
  /** The list stays mounted (hidden) while closed. */
  readonly keepMounted?: boolean
  /** Overrides the strings (also through the provider). */
  readonly messages?: MessageOverrides<MentionsMessages>
}

function Root({
  value,
  defaultValue,
  onValueChange,
  mentions,
  defaultMentions,
  onMentionsChange,
  triggers,
  items,
  filter,
  onQueryChange,
  onSelect,
  formatLabel,
  selectOnTab = true,
  loading,
  readOnly = false,
  disabled = false,
  positioning,
  keepMounted = false,
  messages: ownMessages,
  render,
  id,
  ref,
  children,
  ...rest
}: MentionsRootProps) {
  const instance = useRootId(id)
  const base = useEnvironment(announcerCapability, layoutCapability)
  const messages = useMessages("mentions", mentionsMessages, ownMessages)
  const textarea = useRef<HTMLTextAreaElement | null>(null)
  const highlighter = useRef<HTMLElement | null>(null)
  // The caret the machine asked for: put after the value it wrote is rendered.
  const caret = useRef<number | null>(null)
  const [placeCaret] = useState(() => () => {
    const el = textarea.current
    const c = caret.current
    if (!el || c === null) return
    caret.current = null
    el.setSelectionRange(c, c)
  })
  const env = useMemo(
    () => ({
      ...base,
      position: domPositioning(base),
      setCaret: (c: number) => {
        caret.current = c
        // No commit follows when the text did not change: the next microtask places it.
        queueMicrotask(placeCaret)
      },
    }),
    [base, placeCaret],
  )
  const { collection: registered, registry } = useCollectionItems()
  const latest = useRef({ onQueryChange, onSelect, formatLabel })
  latest.current = { onQueryChange, onSelect, formatLabel }
  // The query of the last render: the Item parts are filtered by it.
  const [query, setQuery] = useState<MentionsQuery | null>(null)
  const locale = base.locale.locale()
  const full = items ?? registered ?? EMPTY
  const results = useMemo(
    () => (items ? items : patternResults(full, query?.query ?? "", filter, locale)),
    [items, full, query, filter, locale],
  )
  const ids = useMemo(() => mentionsIds(instance), [instance])
  // The service, for the anchor (read while open, after it exists).
  const svc = useRef<Service<typeof mentionsMachine> | null>(null)
  const machineProps = {
    root: instance,
    ids,
    strategy: "active-descendant" as const,
    collection: results,
    loading,
    positioning,
    messages,
    triggers,
    value,
    defaultValue,
    onValueChange,
    mentions,
    defaultMentions,
    onMentionsChange,
    onQueryChange: (q: MentionsQuery | null) => {
      setQuery(q)
      latest.current.onQueryChange?.(q)
    },
    onSelect: (d: MentionsSelectDetails) => latest.current.onSelect?.(d),
    formatLabel: formatLabel
      ? (item: { readonly key: string; readonly text: string }, t: string) =>
          latest.current.formatLabel?.(item, t) ?? item.text
      : undefined,
    selectOnTab,
    readOnly,
    disabled,
    anchor: () => {
      const el = textarea.current
      const m = svc.current?.view().context.match
      if (!el || !m) return null
      const r = caretRect(el, m.start)
      return {
        getBoundingClientRect: () => ({
          x: r.left,
          y: r.top,
          left: r.left,
          top: r.top,
          width: 0,
          height: r.height,
          right: r.left,
          bottom: r.top + r.height,
        }),
      }
    },
  }
  const { service } = useMachine(mentionsMachine, machineProps, env)
  svc.current = service
  const view = service.view()
  const open = view.matches("open")
  const match = view.context.match
  useIsoLayoutEffect(placeCaret)
  const [, setPresent] = useState(false)
  // Known after mount: the server render and hydration never carry `popover`.
  const [topLayer, setTopLayer] = useState(false)
  useEffect(() => {
    setTopLayer(typeof HTMLElement !== "undefined" && "showPopover" in HTMLElement.prototype)
  }, [])
  const [mounted, setMounted] = useState<{
    label: boolean
    empty: boolean
    descriptions: ReadonlySet<CollectionKey>
  }>({ label: false, empty: false, descriptions: new Set() })
  const [mount] = useState(
    () => (part: "label" | "empty", on: boolean) =>
      setMounted((m) => (m[part] === on ? m : { ...m, [part]: on })),
  )
  const [mountDescription] = useState(
    () => (key: CollectionKey, on: boolean) =>
      setMounted((m) => {
        if (m.descriptions.has(key) === on) return m
        const next = new Set(m.descriptions)
        if (on) next.add(key)
        else next.delete(key)
        return { ...m, descriptions: next }
      }),
  )
  const modality = useModality(base.modality, view.context.focused)
  const exposure = { open, results, query: match?.query ?? "", loading }
  const api = mentionsConnect(
    {
      instance,
      open,
      empty: isEmptyState(exposure),
      results,
      context: view.context,
      disabled,
      loading,
      modality,
      dir: base.locale.dir(),
      mounted: {
        label: mounted.label,
        empty: mounted.empty,
        description: (key) => mounted.descriptions.has(key),
      },
      topLayer,
      blur: () => service.send({ type: "INPUT.BLUR" }),
      value: view.values.value ?? "",
      mentions: view.values.mentions ?? [],
      match,
      triggers: triggers.map((t) => t.char),
      readOnly,
      composing: view.context.composing,
      messages,
      send: service.send,
    },
    env,
  )
  const state: MentionsRenderState = {
    open,
    trigger: match?.trigger ?? null,
    query: match?.query ?? "",
  }
  const host: Host = {
    name: "Mentions",
    // Sound: the mentions api has every listbox part the shared React parts call.
    parts: { ...api, isEmpty: isEmptyState(exposure) } as unknown as ListboxHost["parts"],
    collection: results,
    registry: items ? null : registry,
    listed: (key: CollectionKey) => results.has(key),
    mount,
    mountDescription,
    requestLoadMore: () => {},
    service: service as unknown as ListboxHost["service"],
    itemSignature: (raw, key) => {
      // Sound: this host's service is the mentions machine's.
      const v = raw as ReturnType<typeof service.view>
      const c = v.context
      const highlighted = c.highlightedKey === key
      return [
        highlighted,
        highlighted ? c.highlightSource : null,
        v.matches("open"),
        results.has(key),
        results.get(key)?.setIndex,
        results.size,
      ].join("|")
    },
    api,
    state,
    send: service.send,
    open,
    keepMounted,
    setPresent,
    topLayer,
    textarea,
    highlighter,
    selectOnTab,
  }
  const props = mergeProps(
    { ...normalizeProps(api.root()), ...(id === undefined ? {} : { id }), ref },
    rest,
  )
  return (
    <HostContext value={host}>
      {renderPart("div", { ...props, children }, render, state)}
    </HostContext>
  )
}

/** The text field: a textbox, a combobox while its list is open. */
function Textarea({ render, ref, ...rest }: Own<"textarea">) {
  const host = useLive("Textarea")
  const { send, api } = host
  const at = (el: HTMLTextAreaElement) => el.selectionStart ?? el.value.length
  const syncScroll = (el: HTMLTextAreaElement) => {
    const h = host.highlighter.current
    if (h) {
      h.scrollTop = el.scrollTop
      h.scrollLeft = el.scrollLeft
    }
  }
  const own = normalizeProps(api.textarea())
  const props = mergeProps(
    {
      ...joinHandlers(own, {
        onChange: (e: ChangeEvent<HTMLTextAreaElement>) => {
          const el = e.currentTarget
          send({
            type: "INPUT",
            value: el.value,
            caret: at(el),
            composing: (e.nativeEvent as InputEvent).isComposing === true,
          })
        },
        onSelect: (e: { currentTarget: HTMLTextAreaElement }) =>
          send({ type: "CARET", caret: at(e.currentTarget) }),
        onClick: (e: { currentTarget: HTMLTextAreaElement }) =>
          send({ type: "CARET", caret: at(e.currentTarget) }),
        onKeyUp: (e: KeyboardEvent<HTMLTextAreaElement>) => {
          // Only caret keys: an input already reported its caret.
          if (/^(Arrow|Home|End|Page)/.test(e.key) && !host.open) {
            send({ type: "CARET", caret: at(e.currentTarget) })
          }
        },
        onCompositionStart: () => send({ type: "COMPOSITION.START" }),
        onCompositionEnd: (e: CompositionEvent<HTMLTextAreaElement>) => {
          const el = e.currentTarget
          send({ type: "COMPOSITION.END", value: el.value, caret: at(el) })
        },
        onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => {
          // Closed: the textarea's own keys (no interception).
          if (!host.open) return
          const composing = e.nativeEvent.isComposing || e.keyCode === 229
          if (composing) return
          const c = host.service.view().context as { highlightedKey: CollectionKey | null }
          switch (e.key) {
            case "ArrowDown":
            case "ArrowUp":
              e.preventDefault()
              send({
                type: "ARROW",
                key: e.key === "ArrowDown" ? "NEXT" : "PREV",
                alt: e.altKey,
                composing,
              })
              return
            case "Enter":
              if (c.highlightedKey === null) return
              e.preventDefault()
              send({ type: "ENTER", composing })
              return
            case "Tab":
              // Tab inserts only a highlighted option; otherwise focus moves on.
              if (!host.selectOnTab || c.highlightedKey === null) return
              e.preventDefault()
              send({ type: "TAB", composing })
              return
            case "Escape":
              e.preventDefault()
              // The list closes; a surrounding dialog stays open.
              e.stopPropagation()
              send({ type: "ESCAPE", composing })
              return
          }
        },
        onScroll: (e: { currentTarget: HTMLTextAreaElement }) => syncScroll(e.currentTarget),
        onFocus: () => send({ type: "INPUT.FOCUS" }),
        onBlur: () => send({ type: "INPUT.BLUR" }),
      }),
      ref: composeRefs(host.textarea, ref),
    },
    rest,
  )
  return renderPart("textarea", props, render, host.state)
}

/** Names the triggers ("Type @ to insert a mention"); the textarea's description. */
function Description({ render, children, ...rest }: Own<"p">) {
  const host = useHost("Description")
  const props = mergeProps(normalizeProps(host.api.descriptionPart()), rest)
  return renderPart(
    "p",
    { ...props, children: children ?? host.api.description },
    render,
    host.state,
  )
}

export type MentionsHighlighterProps = Omit<Own<"div">, "children"> & {
  /** A mention's content (default: its label). */
  readonly children?: (mention: MentionRange, text: string) => ReactNode
}

/** The text mirrored under the textarea, the mentions painted (hidden from assistive technology). */
function Highlighter({ render, ref, children, ...rest }: MentionsHighlighterProps) {
  const host = useLive("Highlighter")
  const segments = host.api.segments.map((s, i) =>
    s.kind === "text" ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: segments are positional
      <span key={i}>{s.text}</span>
    ) : (
      <mark
        key={`${s.mention.id}-${s.mention.start}`}
        {...normalizeProps(host.api.mention(s.mention))}
      >
        {children ? children(s.mention, s.text) : s.text}
      </mark>
    ),
  )
  return renderPart(
    "div",
    mergeProps(
      {
        ...normalizeProps(host.api.highlighter()),
        ref: composeRefs(host.highlighter, ref),
        children: segments,
      },
      rest,
    ),
    render,
    host.state,
  )
}

/** Loading content: a sibling of the List, shown while loading. */
function Loading({ render, ...rest }: Own<"div">) {
  const host = useLive("Loading")
  return renderPart("div", mergeProps(normalizeProps(host.api.loading()), rest), render, host.state)
}

const list = createListboxParts(useHost)
const popup = createPopupParts(useLive)

/** Positions the list at the trigger. */
const Positioner = popup.Positioner
/** The list's surface. */
const Popup = popup.Popup
/** The listbox. */
const List = list.List
/** An option (`value` is its key). */
const Item = list.Item
/** An option's text. */
const ItemText = list.ItemText
/** A group of options (`section`), with its label. */
const Group = list.Section
/** Shown when no option matches. */
const Empty = list.Empty
/** One Item per option of the collection (`items`), grouped by section. */
const Items = list.Items

export {
  Description,
  Empty,
  Group,
  Highlighter,
  Item,
  Items,
  ItemText,
  List,
  Loading,
  Popup,
  Positioner,
  Root,
  Textarea,
}
