/** @jsxImportSource solid-js */
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
  type Accessor,
  createContext,
  createMemo,
  createSignal,
  For,
  type JSX,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { isServer } from "solid-js/web"
import { createPopupParts } from "../combobox/popup-parts"
import { afterMount } from "../lifecycle"
import { createListboxParts, type ListboxHost } from "../listbox/parts"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useMessages } from "../provider"
import { type RenderProp, reactive, renderPart, resolveChildren } from "../render"
import { useCollectionItems } from "../use-collection-items"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare module "../provider" {
  interface RindMessageScopes {
    mentions: MentionsMessages
  }
}

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
  readonly api: Accessor<Api>
  readonly state: MentionsRenderState
  readonly send: (event: MentionsEvent) => void
  readonly service: Service<typeof mentionsMachine>
  readonly open: Accessor<boolean>
  readonly keepMounted: Accessor<boolean>
  readonly setPresent: (present: boolean) => void
  readonly topLayer: Accessor<boolean>
  readonly setTextarea: (el: HTMLTextAreaElement | null) => void
  readonly highlighter: { current: HTMLElement | null }
  readonly selectOnTab: Accessor<boolean>
}

const HostContext = createContext<Host>()
const useHost = (part: string): Host => {
  const host = useContext(HostContext)
  if (!host) throw new Error(`Mentions.${part} must be inside Mentions.Root`)
  return host
}

type Own<A> = Omit<A, "children"> & {
  /** Another element: a function receiving the props to spread and the state. */
  readonly render?: RenderProp<MentionsRenderState> | undefined
  readonly children?: JSX.Element | ((state: MentionsRenderState) => JSX.Element)
}

export type MentionsRootProps = Omit<
  Own<JSX.HTMLAttributes<HTMLDivElement>>,
  "onSelect" | "defaultValue"
> & {
  /** Controlled text. */
  readonly value?: string | undefined
  /** Uncontrolled text. Default "". */
  readonly defaultValue?: string | undefined
  /** Every change of the text. */
  readonly onValueChange?:
    | ((value: string, details: ChangeDetails<MentionsEvent>) => void)
    | undefined
  /** Controlled mention ranges. */
  readonly mentions?: readonly MentionRange[] | undefined
  /** Uncontrolled mention ranges. */
  readonly defaultMentions?: readonly MentionRange[] | undefined
  /** Mentions added, moved or removed. */
  readonly onMentionsChange?:
    | ((mentions: readonly MentionRange[], details: ChangeDetails<MentionsEvent>) => void)
    | undefined
  /** `{ char, id?, behavior?: "insert" | "action", startOfInput?, allowSpaces?, appendSpace? }`. */
  readonly triggers: readonly MentionTrigger[]
  /** The options for the current query (default: the Item parts, filtered by the query). */
  readonly items?: Collection<unknown> | undefined
  /** The matcher for the Item parts; `null` lists them unfiltered. */
  readonly filter?: ComboboxFilter | null | undefined
  /** The trigger and query at the caret; null when it closes. */
  readonly onQueryChange?: ((query: MentionsQuery | null) => void) | undefined
  /** An "action" trigger's choice. */
  readonly onSelect?: ((details: MentionsSelectDetails) => void) | undefined
  /** The inserted label (default: the trigger char and the text). */
  readonly formatLabel?:
    | ((item: { readonly key: string; readonly text: string }, trigger: string) => string)
    | undefined
  /** Tab inserts the highlighted option. Default true. */
  readonly selectOnTab?: boolean | undefined
  /** Results are loading. */
  readonly loading?: LoadingStatus | undefined
  /** No editing; the list never opens. */
  readonly readOnly?: boolean | undefined
  /** Not editable or submitted. */
  readonly disabled?: boolean | undefined
  /** The list's placement at the trigger (default: below, flipping). */
  readonly positioning?: PositioningProps | undefined
  /** The list stays mounted (hidden) while closed. */
  readonly keepMounted?: boolean | undefined
  /** Overrides the strings (also through the provider). */
  readonly messages?: MessageOverrides<MentionsMessages> | undefined
}

function Root(props: MentionsRootProps) {
  const [own, rest] = splitProps(props, [
    "value",
    "defaultValue",
    "onValueChange",
    "mentions",
    "defaultMentions",
    "onMentionsChange",
    "triggers",
    "items",
    "filter",
    "onQueryChange",
    "onSelect",
    "formatLabel",
    "selectOnTab",
    "loading",
    "readOnly",
    "disabled",
    "positioning",
    "keepMounted",
    "messages",
    "render",
    "children",
  ])
  const instance = useRootId(() => rest.id)
  const base = useEnvironment(announcerCapability, layoutCapability)
  const messages = useMessages("mentions", mentionsMessages, () => own.messages)
  let textarea: HTMLTextAreaElement | null = null
  const highlighter: { current: HTMLElement | null } = { current: null }
  // The caret the machine asked for: placed once the value it wrote is rendered (Solid renders
  // synchronously, so the next microtask sees it).
  let caret: number | null = null
  const placeCaret = () => {
    const el = textarea
    const c = caret
    if (!el || c === null) return
    caret = null
    el.setSelectionRange(c, c)
  }
  const env = {
    ...base,
    position: domPositioning(base),
    setCaret: (c: number) => {
      caret = c
      queueMicrotask(placeCaret)
    },
  }
  const { collection: registered, registry } = useCollectionItems()
  // The query of the machine: the Item parts are filtered by it.
  const [query, setQuery] = createSignal<MentionsQuery | null>(null)
  const results = createMemo(() => {
    if (own.items) return own.items
    const full = registered() ?? EMPTY
    return patternResults(full, query()?.query ?? "", own.filter, base.locale.locale())
  })
  const ids = createMemo(() => mentionsIds(instance()))
  // The service, for the anchor (read while open, after it exists).
  let svc: Service<typeof mentionsMachine> | null = null
  const machineProps = createMemo(() => ({
    root: instance(),
    ids: ids(),
    strategy: "active-descendant" as const,
    collection: results(),
    loading: own.loading,
    positioning: own.positioning,
    messages: messages(),
    triggers: own.triggers,
    value: own.value,
    defaultValue: own.defaultValue,
    onValueChange: own.onValueChange,
    mentions: own.mentions,
    defaultMentions: own.defaultMentions,
    onMentionsChange: own.onMentionsChange,
    onQueryChange: (q: MentionsQuery | null) => {
      setQuery(q)
      own.onQueryChange?.(q)
    },
    onSelect: (d: MentionsSelectDetails) => own.onSelect?.(d),
    ...(own.formatLabel
      ? {
          formatLabel: (item: { readonly key: string; readonly text: string }, t: string) =>
            own.formatLabel?.(item, t) ?? item.text,
        }
      : {}),
    selectOnTab: own.selectOnTab !== false,
    readOnly: own.readOnly === true,
    disabled: own.disabled === true,
    anchor: () => {
      const el = textarea
      const m = svc?.view().context.match
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
  }))
  const { view, service } = useMachine(mentionsMachine, machineProps, env)
  svc = service
  const open = createMemo(() => view().matches("open"))
  const match = () => view().context.match
  const [, setPresent] = createSignal(false)
  // Known after mount: the server render and hydration never carry `popover`.
  const [topLayer, setTopLayer] = createSignal(false)
  afterMount(() =>
    setTopLayer(typeof HTMLElement !== "undefined" && "showPopover" in HTMLElement.prototype),
  )
  const [mounted, setMounted] = createSignal<{
    label: boolean
    empty: boolean
    descriptions: ReadonlySet<CollectionKey>
  }>({ label: false, empty: false, descriptions: new Set() })
  const mount = (part: "label" | "empty", on: boolean) =>
    setMounted((m) => (m[part] === on ? m : { ...m, [part]: on }))
  const mountDescription = (key: CollectionKey, on: boolean) =>
    setMounted((m) => {
      if (m.descriptions.has(key) === on) return m
      const next = new Set(m.descriptions)
      if (on) next.add(key)
      else next.delete(key)
      return { ...m, descriptions: next }
    })
  const modality = useModality(base.modality, () => view().context.focused)
  const exposure = () => ({
    open: open(),
    results: results(),
    query: match()?.query ?? "",
    loading: own.loading,
  })
  const api = createMemo(() => {
    const v = view()
    const m = mounted()
    return mentionsConnect(
      {
        instance: instance(),
        open: open(),
        empty: isEmptyState(exposure()),
        results: results(),
        context: v.context,
        disabled: own.disabled === true,
        loading: own.loading,
        modality: modality(),
        dir: base.locale.dir(),
        mounted: {
          label: m.label,
          empty: m.empty,
          description: (key) => m.descriptions.has(key),
        },
        topLayer: topLayer(),
        blur: () => service.send({ type: "INPUT.BLUR" }),
        value: v.values.value ?? "",
        mentions: v.values.mentions ?? [],
        match: v.context.match,
        triggers: own.triggers.map((t) => t.char),
        readOnly: own.readOnly === true,
        composing: v.context.composing,
        messages: messages(),
        send: service.send,
      },
      env,
    )
  })
  const state = reactive<MentionsRenderState>(() => ({
    open: open(),
    trigger: match()?.trigger ?? null,
    query: match()?.query ?? "",
  }))
  const host: Host = {
    name: "Mentions",
    // Sound: the mentions api has every listbox part the shared parts call.
    parts: createMemo(
      () =>
        ({ ...api(), isEmpty: isEmptyState(exposure()) }) as unknown as ReturnType<
          ListboxHost["parts"]
        >,
    ),
    collection: results,
    registry: own.items ? null : registry,
    listed: (key: CollectionKey) => results().has(key),
    mount,
    mountDescription,
    requestLoadMore: () => {},
    api,
    state,
    send: service.send,
    service,
    open,
    keepMounted: () => own.keepMounted === true,
    setPresent,
    topLayer,
    setTextarea: (el) => {
      textarea = el
    },
    highlighter,
    selectOnTab: () => own.selectOnTab !== false,
  }
  const merged = createMemo(() => mergeProps(normalizeProps(api().root()), rest))
  const children = () => resolveChildren(own.children, state)
  return (
    <HostContext.Provider value={host}>
      {renderPart(own.render, merged, state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </HostContext.Provider>
  )
}

export type MentionsTextareaProps = Omit<
  Own<JSX.TextareaHTMLAttributes<HTMLTextAreaElement>>,
  "children"
>

/** The text field: a textbox, a combobox while its list is open. */
function Textarea(props: MentionsTextareaProps) {
  const [local, rest] = splitProps(props, ["render"])
  const host = useHost("Textarea")
  const send = host.send
  const at = (el: HTMLTextAreaElement) => el.selectionStart ?? el.value.length
  const syncScroll = (el: HTMLTextAreaElement) => {
    const h = host.highlighter.current
    if (h) {
      h.scrollTop = el.scrollTop
      h.scrollLeft = el.scrollLeft
    }
  }
  // A textarea's text is its content (as React's markup); the value stays a property, never the
  // `value` attribute a server render would otherwise write.
  const initial = untrack(() => String(host.api().textarea()["value"] ?? ""))
  const own = () => {
    const p = normalizeProps(host.api().textarea())
    if (isServer) delete p["value"]
    return p
  }
  const merged = createMemo(() =>
    mergeProps(
      {
        ...joinHandlers(own(), {
          onInput: (e: InputEvent) => {
            const el = e.currentTarget as HTMLTextAreaElement
            send({ type: "INPUT", value: el.value, caret: at(el), composing: e.isComposing })
          },
          onSelect: (e: Event) =>
            send({ type: "CARET", caret: at(e.currentTarget as HTMLTextAreaElement) }),
          onClick: (e: MouseEvent) =>
            send({ type: "CARET", caret: at(e.currentTarget as HTMLTextAreaElement) }),
          onKeyUp: (e: KeyboardEvent) => {
            // Only caret keys: an input already reported its caret.
            if (/^(Arrow|Home|End|Page)/.test(e.key) && !untrack(host.open)) {
              send({ type: "CARET", caret: at(e.currentTarget as HTMLTextAreaElement) })
            }
          },
          onCompositionStart: () => send({ type: "COMPOSITION.START" }),
          onCompositionEnd: (e: CompositionEvent) => {
            const el = e.currentTarget as HTMLTextAreaElement
            send({ type: "COMPOSITION.END", value: el.value, caret: at(el) })
          },
          onKeyDown: (e: KeyboardEvent) => {
            // Closed: the textarea's own keys (no interception).
            if (!untrack(host.open)) return
            const composing = e.isComposing || e.keyCode === 229
            if (composing) return
            const highlighted = host.service.view().context.highlightedKey
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
                if (highlighted === null) return
                e.preventDefault()
                send({ type: "ENTER", composing })
                return
              case "Tab":
                // Tab inserts only a highlighted option; otherwise focus moves on.
                if (!host.selectOnTab() || highlighted === null) return
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
          onScroll: (e: Event) => syncScroll(e.currentTarget as HTMLTextAreaElement),
          onFocusIn: () => send({ type: "INPUT.FOCUS" }),
          onFocusOut: () => send({ type: "INPUT.BLUR" }),
        }),
        ref: host.setTextarea,
      },
      rest,
    ),
  )
  return renderPart(
    local.render,
    merged,
    host.state,
    () => undefined,
    (p) => <textarea {...p}>{initial}</textarea>,
  )
}

export type MentionsDescriptionProps = Own<JSX.HTMLAttributes<HTMLParagraphElement>>

/** Names the triggers ("Type @ to insert a mention"); the textarea's description. */
function Description(props: MentionsDescriptionProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const host = useHost("Description")
  const merged = createMemo(() => mergeProps(normalizeProps(host.api().descriptionPart()), rest))
  const children = () => resolveChildren(local.children, host.state) ?? host.api().description
  return renderPart(local.render, merged, host.state, children, (p) => <p {...p}>{children()}</p>)
}

export type MentionsHighlighterProps = Omit<Own<JSX.HTMLAttributes<HTMLDivElement>>, "children"> & {
  /** A mention's content (default: its label). */
  readonly children?: ((mention: MentionRange, text: string) => JSX.Element) | undefined
}

/** The text mirrored under the textarea, the mentions painted (hidden from assistive technology). */
function Highlighter(props: MentionsHighlighterProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const host = useHost("Highlighter")
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps(host.api().highlighter()),
        ref: (el: HTMLElement) => {
          host.highlighter.current = el
        },
      },
      rest,
    ),
  )
  const children = () => (
    <For each={host.api().segments}>
      {(s) =>
        s.kind === "text" ? (
          <span>{s.text}</span>
        ) : (
          <mark {...normalizeProps(host.api().mention(s.mention))}>
            {local.children ? local.children(s.mention, s.text) : s.text}
          </mark>
        )
      }
    </For>
  )
  return renderPart(local.render, merged, host.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

export type MentionsLoadingProps = Own<JSX.HTMLAttributes<HTMLDivElement>>

/** Loading content: a sibling of the List, shown while loading. */
function Loading(props: MentionsLoadingProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const host = useHost("Loading")
  const merged = createMemo(() => mergeProps(normalizeProps(host.api().loading()), rest))
  const children = () => resolveChildren(local.children, host.state)
  return renderPart(local.render, merged, host.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

const list = createListboxParts(useHost)
const popup = createPopupParts(useHost)

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
