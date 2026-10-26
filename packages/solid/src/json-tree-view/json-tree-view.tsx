/** @jsxImportSource solid-js */
// JSON Tree View (add-json-tree-view): a Tree View over `jsonTreeCollection`, rebuilt when the
// value or the expansion changes (only expanded containers have children), plus the JSON text
// parts inside each item and copy (Mod+C on the tree, or the CopyTrigger).
import {
  announcerCapability,
  type ClipboardMessages,
  type CollectionKey,
  clipboardCapability,
  clipboardMessages,
  type JsonNode,
  type JsonTreeViewMessages,
  jsonCopyText,
  jsonExpandedKeys,
  jsonItemConnect,
  jsonTreeCollection,
  jsonTreeViewMessages,
  type MessageOverrides,
  type PartProps,
  toKey,
} from "@rind-ui/core"
import {
  type Accessor,
  createContext,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  Show,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import {
  ItemIndicator,
  ItemText,
  Tree,
  Item as TreeItem,
  Root as TreeRoot,
  type TreeViewExpandedDetails,
  type TreeViewItemProps,
  type TreeViewRootProps,
  useTreeViewItemKey,
} from "../tree-view/tree-view"
import { useRootId } from "../use-ids"

declare module "../provider" {
  interface RindMessageScopes {
    "json-tree-view": JsonTreeViewMessages
  }
}

export type JsonCopyFormat = "json" | "value" | "pointer"
export type JsonCopyState = "idle" | "copying" | "copied" | "error"

/** What a function child of the Root receives. */
export interface JsonTreeViewApi {
  readonly copyState: JsonCopyState
  /**
   * Expands every container down to `depth` levels (default: one deeper than the deepest open
   * one), stopping before 5000 rows would be visible.
   */
  readonly expandAll: (options?: { readonly depth?: number | undefined }) => void
  /** Copies the highlighted item in `copyFormat` through the clipboard. */
  readonly copy: () => void
}

interface Ctx {
  readonly instance: Accessor<string>
  readonly node: (key: CollectionKey) => JsonNode | undefined
  readonly expanded: Accessor<ReadonlySet<string>>
  readonly messages: Accessor<JsonTreeViewMessages>
  readonly clipboardMessages: Accessor<ClipboardMessages>
  readonly maxPreviewItems: Accessor<number | undefined>
  readonly api: JsonTreeViewApi
  readonly copyFrom: (near: Element) => void
}
const JsonContext = createContext<Ctx>()
function useJson(part: string): Ctx {
  const ctx = useContext(JsonContext)
  if (!ctx) throw new Error(`JsonTreeView.${part} must be inside JsonTreeView.Root`)
  return ctx
}

/** The JSON node of the enclosing `TreeView.Item`. */
function useNode(part: string): { ctx: Ctx; node: Accessor<JsonNode | undefined> } {
  const ctx = useJson(part)
  const key = useTreeViewItemKey()
  if (!key) throw new Error(`JsonTreeView.${part} must be inside an item`)
  return { ctx, node: () => ctx.node(key()) }
}

/** Tree View's props that make sense for a JSON value (selection is off by default). */
type TreeProps<T> = T extends unknown
  ? Omit<
      T,
      | "items"
      | "collection"
      | "children"
      | "id"
      | "messages"
      | "expandedValue"
      | "defaultExpandedValue"
      | "onExpandedChange"
      | "onLoadChildren"
      | "movable"
      | "onMove"
    >
  : never

export type JsonTreeViewRootProps = TreeProps<TreeViewRootProps> & {
  /** The value to show. */
  readonly data: unknown
  /** Levels open on the first value; a new `data` keeps the user's expansion. Default 1. */
  readonly defaultExpandedDepth?: number | undefined
  /** More children than this are grouped in ranges. Default 100. */
  readonly groupSize?: number | undefined
  /** Keys previewed after a collapsed container. Default 3. */
  readonly maxPreviewItems?: number | undefined
  /** What a copy writes: the subtree as JSON (default), a leaf's raw value, or the pointer. */
  readonly copyFormat?: JsonCopyFormat | undefined
  /** How long `copied` / `error` last before `idle` (ms). Default 2000. */
  readonly copyFeedbackDuration?: number | undefined
  readonly expandedValue?: readonly string[] | undefined
  readonly defaultExpandedValue?: readonly string[] | undefined
  readonly onExpandedChange?:
    | ((keys: readonly string[], details: TreeViewExpandedDetails) => void)
    | undefined
  readonly messages?: MessageOverrides<JsonTreeViewMessages> | undefined
  /** Default: the provider's locale (the copy announcements' language). */
  readonly locale?: string | undefined
  readonly id?: string | undefined
  readonly class?: string | undefined
  readonly style?: JSX.CSSProperties | string | undefined
  readonly "aria-label"?: string | undefined
  readonly "aria-labelledby"?: string | undefined
  /** Custom markup (Tree View parts and the JSON parts); default: the whole tree. */
  readonly children?: JSX.Element | ((api: JsonTreeViewApi) => JSX.Element)
}

const MAX_EXPAND = 5000

function Root(props: JsonTreeViewRootProps) {
  const [own, tree] = splitProps(props, [
    "data",
    "defaultExpandedDepth",
    "groupSize",
    "maxPreviewItems",
    "copyFormat",
    "copyFeedbackDuration",
    "expandedValue",
    "defaultExpandedValue",
    "onExpandedChange",
    "messages",
    "locale",
    "id",
    "class",
    "style",
    "aria-label",
    "aria-labelledby",
    "children",
  ])
  const instance = useRootId(() => own.id)
  const env = useEnvironment(announcerCapability, clipboardCapability)
  const locale = useLocale(() => own.locale)
  const messages = useMessages("json-tree-view", jsonTreeViewMessages, () => own.messages)
  const copyMessages = useMessages("clipboard", clipboardMessages, () => undefined)
  // The first value's expansion only: later values keep the user's by key.
  const [inner, setInner] = createSignal<readonly string[]>(
    untrack(
      () =>
        own.defaultExpandedValue ??
        jsonExpandedKeys(own.data, own.defaultExpandedDepth ?? 1, {
          groupSize: own.groupSize,
          max: MAX_EXPAND,
        }),
    ),
  )
  const expandedKeys = () => own.expandedValue ?? inner()
  const expanded = createMemo<ReadonlySet<string>>(() => new Set(expandedKeys()))
  const collection = createMemo(() =>
    jsonTreeCollection(own.data, { expanded: expanded(), groupSize: own.groupSize }),
  )
  const setExpanded = (keys: readonly string[], details: TreeViewExpandedDetails) => {
    // The same keys again (a re-sync after a new collection): nothing changed.
    const now = untrack(expanded)
    if (keys.length === now.size && keys.every((k) => now.has(k))) return
    setInner(keys)
    own.onExpandedChange?.(keys, details)
  }
  const node = (key: CollectionKey) => collection().get(key)?.value as JsonNode | undefined

  const [copyState, setCopyState] = createSignal<JsonCopyState>("idle")
  let timer: ReturnType<typeof env.scheduler.setTimeout> | undefined
  onCleanup(() => {
    if (timer !== undefined) env.scheduler.clearTimeout(timer)
  })
  const settle = (ok: boolean) => {
    setCopyState(ok ? "copied" : "error")
    env.announcer.announce({
      message: ok ? copyMessages().copied : copyMessages().copyFailed,
      priority: "polite",
      key: `json-tree-view-${instance()}`,
      lang: locale().locale,
    })
    if (timer !== undefined) env.scheduler.clearTimeout(timer)
    timer = env.scheduler.setTimeout(() => {
      timer = undefined
      setCopyState("idle")
    }, own.copyFeedbackDuration ?? 2000)
  }
  let rootEl: HTMLElement | undefined
  /** The focused item, else the highlighted one (the tree's Tab stop). */
  const current = (): JsonNode | undefined => {
    const active = rootEl?.ownerDocument.activeElement
    const item =
      (active?.closest('[role="treeitem"][data-key]') as HTMLElement | null) ??
      rootEl?.querySelector<HTMLElement>('[role="treeitem"][tabindex="0"][data-key]') ??
      null
    const key = item?.getAttribute("data-key")
    return key == null ? undefined : node(toKey(key))
  }
  const textOf = (n: JsonNode | undefined) => {
    if (!n) throw new Error("[rind-ui] json-tree-view: no item to copy")
    return jsonCopyText(n, own.copyFormat ?? "json")
  }
  /** Through the Clipboard capability (the CopyTrigger, or a copy event without clipboardData). */
  const copyFrom = (near: Element) => {
    if (untrack(copyState) === "copying") return
    let text: string
    try {
      text = textOf(current())
    } catch {
      settle(false)
      return
    }
    setCopyState("copying")
    env.clipboard.writeText(text, { near }).then(
      () => settle(true),
      () => settle(false),
    )
  }
  // Mod+C on the tree: the native copy event's clipboardData (synchronous, no permission).
  const onCopy = (e: ClipboardEvent) => {
    const target = e.target as Element | null
    if (!target?.closest('[role="tree"]')) return
    // A text selection is the user's: the browser copies it.
    const selection = rootEl?.ownerDocument.getSelection()
    if (selection && !selection.isCollapsed && rootEl?.contains(selection.anchorNode)) return
    e.preventDefault()
    if (!e.clipboardData) {
      copyFrom(target)
      return
    }
    try {
      e.clipboardData.setData("text/plain", textOf(current()))
      settle(true)
    } catch {
      settle(false)
    }
  }
  const api: JsonTreeViewApi = {
    get copyState() {
      return copyState()
    },
    expandAll: (options) => {
      // One deeper than the deepest open container (levels are 0-based in the collection).
      let deepest = -1
      for (const key of untrack(expandedKeys)) {
        const level = untrack(collection).get(toKey(key))?.level
        if (level !== undefined && level > deepest) deepest = level
      }
      const depth = options?.depth ?? deepest + 2
      const keys = jsonExpandedKeys(
        untrack(() => own.data),
        depth,
        {
          groupSize: untrack(() => own.groupSize),
          max: MAX_EXPAND,
        },
      )
      setExpanded([...new Set([...untrack(expandedKeys), ...keys])], { reason: "all" })
    },
    copy: () => {
      if (rootEl) copyFrom(rootEl)
    },
  }
  const ctx: Ctx = {
    instance,
    node,
    expanded,
    messages,
    clipboardMessages: copyMessages,
    maxPreviewItems: () => own.maxPreviewItems,
    api,
    copyFrom,
  }
  const children = () => {
    const c = own.children
    if (typeof c === "function") return c(api)
    if (c !== undefined) return c
    return (
      <Tree aria-label={own["aria-label"]} aria-labelledby={own["aria-labelledby"]}>
        {(n) => (
          <Item value={n.key}>
            <ItemIndicator />
            <ItemText>
              <Content />
            </ItemText>
          </Item>
        )}
      </Tree>
    )
  }
  return (
    <JsonContext.Provider value={ctx}>
      <div
        data-scope="tree-view"
        data-part="root"
        data-instance={instance()}
        data-json-tree-view=""
        data-copy-state={copyState()}
        class={own.class}
        style={own.style}
        ref={(el) => {
          rootEl = el
        }}
        onCopy={onCopy}
      >
        <TreeRoot
          {...(tree as Record<string, unknown>)}
          selectionMode={
            (tree as { selectionMode?: "single" | "multiple" | "none" }).selectionMode ?? "none"
          }
          id={instance()}
          collection={collection()}
          expandedValue={expandedKeys()}
          onExpandedChange={setExpanded}
        >
          {children()}
        </TreeRoot>
      </div>
    </JsonContext.Provider>
  )
}

/** A Tree View item with the JSON attributes (`data-type`, `data-key`, `data-range`, …). */
function Item(props: TreeViewItemProps) {
  const ctx = useJson("Item")
  const attrs = createMemo((): PartProps => {
    const n = ctx.node(toKey(props.value))
    return n
      ? jsonItemConnect({ instance: ctx.instance(), node: n, messages: ctx.messages() }).item()
      : {}
  })
  // Fixed keys read through getters: the item element is created once (a spread of a changing
  // object would rebuild it, and the focus with it).
  const json = {
    get "data-type"() {
      return attrs()["data-type"]
    },
    get "data-key"() {
      return attrs()["data-key"]
    },
    get "data-range"() {
      return attrs()["data-range"]
    },
    get "data-empty"() {
      return attrs()["data-empty"]
    },
  }
  return <TreeItem {...json} {...props} />
}

type SpanProps = JSX.HTMLAttributes<HTMLSpanElement>

function useJsonPart(
  name: string,
  props: SpanProps,
  pick: (api: ReturnType<typeof jsonItemConnect>) => { attrs: PartProps; text: string | null },
) {
  const { ctx, node } = useNode(name)
  const [local, rest] = splitProps(props, ["children"])
  const api = createMemo(() => {
    const n = node()
    return n
      ? jsonItemConnect({
          instance: ctx.instance(),
          node: n,
          messages: ctx.messages(),
          maxPreviewItems: ctx.maxPreviewItems(),
        })
      : undefined
  })
  const picked = createMemo(() => {
    const a = api()
    return a ? pick(a) : undefined
  })
  return (
    <Show when={picked()}>
      {(p) => (
        <span {...mergeProps(normalizeProps(p().attrs), rest)}>{local.children ?? p().text}</span>
      )}
    </Show>
  )
}

/** The property name or index (a range: its bounds). */
function Key(props: SpanProps) {
  return useJsonPart("Key", props, (a) => ({ attrs: a.key(), text: a.keyText }))
}
/** `aria-hidden`; ":" (its content replaces it). */
function Separator(props: SpanProps) {
  return useJsonPart("Separator", props, (a) => ({ attrs: a.separator(), text: ":" }))
}
/** A leaf's value, escaped; strings carry `data-quoted`. */
function Value(props: SpanProps) {
  return useJsonPart("Value", props, (a) => ({ attrs: a.value(), text: a.valueText }))
}
/** `aria-hidden`; a container's glyph summary ("{4}", "[3]"). */
function Summary(props: SpanProps) {
  return useJsonPart("Summary", props, (a) => ({ attrs: a.summary(), text: a.summaryGlyph }))
}
/** Visually hidden; the spoken summary ("object, 4 entries"). */
function SummaryText(props: SpanProps) {
  return useJsonPart("SummaryText", props, (a) => ({
    attrs: a.summaryTextPart(),
    text: a.summaryText,
  }))
}
/** `aria-hidden`; a collapsed container's first keys. */
function Preview(props: SpanProps) {
  return useJsonPart("Preview", props, (a) => ({ attrs: a.preview(), text: a.previewText }))
}

/** An item's default text: Key, Separator, then Value or Summary, SummaryText and Preview. */
function Content() {
  const { ctx, node } = useNode("Content")
  return (
    <Show when={node()}>
      {(n) => (
        <>
          <Show when={n().label !== null || n().type === "range"}>
            <Key />
            <Show when={n().type !== "range"}>
              <Separator />
            </Show>
            {/* A space after the ":" separator: "name: Ada". */}{" "}
          </Show>
          <Show
            when={
              jsonItemConnect({ instance: "", node: n(), messages: ctx.messages() }).isContainer
            }
            fallback={
              <Show when={n().type !== "range"}>
                <Value />
              </Show>
            }
          >
            <Summary />
            <SummaryText />
            <Show when={!ctx.expanded().has(n().key) && n().count > 0}>
              <Preview />
            </Show>
          </Show>
        </>
      )}
    </Show>
  )
}

export type JsonTreeViewCopyTriggerProps = JSX.ButtonHTMLAttributes<HTMLButtonElement>

/** Copies the highlighted item in `copyFormat`; the result is announced. */
function CopyTrigger(props: JsonTreeViewCopyTriggerProps) {
  const ctx = useJson("CopyTrigger")
  const [local, rest] = splitProps(props, ["children"])
  return (
    <button
      {...mergeProps(
        {
          type: "button",
          "data-scope": "json-tree-view",
          "data-part": "copy-trigger",
          "data-instance": ctx.instance(),
          "data-copy-state": ctx.api.copyState,
          onClick: (e: MouseEvent) => ctx.copyFrom(e.currentTarget as Element),
        },
        rest,
      )}
    >
      {local.children ?? ctx.clipboardMessages().copy}
    </button>
  )
}

/** The parts, by name: `json-tree-view.parts.ts` re-exports them as the `JsonTreeView` namespace. */
export { CopyTrigger, Item, Key, Preview, Root, Separator, Summary, SummaryText, Value }
