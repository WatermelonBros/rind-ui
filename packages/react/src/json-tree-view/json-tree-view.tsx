"use client"

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
  type ComponentPropsWithRef,
  type CSSProperties,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
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
  type TreeViewRootProps,
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
  readonly instance: string
  readonly node: (key: CollectionKey) => JsonNode | undefined
  readonly expanded: ReadonlySet<string>
  readonly messages: JsonTreeViewMessages
  readonly clipboardMessages: ClipboardMessages
  readonly maxPreviewItems: number | undefined
  readonly api: JsonTreeViewApi
  readonly copyFrom: (near: Element) => void
}
const JsonContext = createContext<Ctx | null>(null)
function useJson(part: string): Ctx {
  const ctx = useContext(JsonContext)
  if (!ctx) throw new Error(`JsonTreeView.${part} must be inside JsonTreeView.Root`)
  return ctx
}
/** The key of the enclosing `JsonTreeView.Item`. */
const ItemKeyContext = createContext<CollectionKey | null>(null)
function useNode(part: string): { ctx: Ctx; node: JsonNode | undefined } {
  const ctx = useJson(part)
  const key = useContext(ItemKeyContext)
  if (key === null) throw new Error(`JsonTreeView.${part} must be inside JsonTreeView.Item`)
  return { ctx, node: ctx.node(key) }
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
  readonly defaultExpandedDepth?: number
  /** More children than this are grouped in ranges. Default 100. */
  readonly groupSize?: number
  /** Keys previewed after a collapsed container. Default 3. */
  readonly maxPreviewItems?: number
  /** What a copy writes: the subtree as JSON (default), a leaf's raw value, or the pointer. */
  readonly copyFormat?: JsonCopyFormat
  /** How long `copied` / `error` last before `idle` (ms). Default 2000. */
  readonly copyFeedbackDuration?: number
  /** The expanded containers' keys, controlled. */
  readonly expandedValue?: readonly string[]
  /** The expanded containers' keys, uncontrolled (instead of `defaultExpandedDepth`). */
  readonly defaultExpandedValue?: readonly string[]
  /** When a container opens or closes. */
  readonly onExpandedChange?: (keys: readonly string[], details: TreeViewExpandedDetails) => void
  /** Overrides the strings (also through the provider). */
  readonly messages?: MessageOverrides<JsonTreeViewMessages>
  /** Default: the provider's locale (the copy announcements' language). */
  readonly locale?: string
  /** Base of the parts' generated ids (default: a `useId`). */
  readonly id?: string
  /** On the wrapper element. */
  readonly className?: string
  /** On the wrapper element. */
  readonly style?: CSSProperties
  /** Names the tree when there is no Tree View Label. */
  readonly "aria-label"?: string
  /** Names the tree by another element's text. */
  readonly "aria-labelledby"?: string
  /** Custom markup (Tree View parts and the JSON parts); default: the whole tree. */
  readonly children?: ReactNode | ((api: JsonTreeViewApi) => ReactNode)
}

const MAX_EXPAND = 5000

function Root(props: JsonTreeViewRootProps) {
  const {
    data,
    defaultExpandedDepth,
    groupSize,
    maxPreviewItems,
    copyFormat = "json",
    copyFeedbackDuration = 2000,
    expandedValue,
    defaultExpandedValue,
    onExpandedChange,
    messages: ownMessages,
    locale: ownLocale,
    id,
    className,
    style,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    children,
    ...tree
  } = props
  const instance = useRootId(id)
  const env = useEnvironment(announcerCapability, clipboardCapability)
  const { locale } = useLocale(ownLocale)
  const messages = useMessages("json-tree-view", jsonTreeViewMessages, ownMessages)
  const copyMessages = useMessages("clipboard", clipboardMessages, undefined)
  // The first value's expansion only: later values keep the user's by key.
  const [inner, setInner] = useState<readonly string[]>(
    () =>
      defaultExpandedValue ??
      jsonExpandedKeys(data, defaultExpandedDepth ?? 1, { groupSize, max: MAX_EXPAND }),
  )
  const expandedKeys = expandedValue ?? inner
  const expanded = useMemo<ReadonlySet<string>>(() => new Set(expandedKeys), [expandedKeys])
  const collection = useMemo(
    () => jsonTreeCollection(data, { expanded, groupSize }),
    [data, expanded, groupSize],
  )
  const latest = useRef({ expanded, collection, data, groupSize, expandedKeys, copyFormat })
  latest.current = { expanded, collection, data, groupSize, expandedKeys, copyFormat }
  const setExpanded = (keys: readonly string[], details: TreeViewExpandedDetails) => {
    // The same keys again (a re-sync after a new collection): nothing changed.
    const now = latest.current.expanded
    if (keys.length === now.size && keys.every((k) => now.has(k))) return
    setInner(keys)
    onExpandedChange?.(keys, details)
  }
  const node = (key: CollectionKey) => collection.get(key)?.value as JsonNode | undefined

  const [copyState, setCopyState] = useState<JsonCopyState>("idle")
  const copying = useRef(false)
  const timer = useRef<ReturnType<typeof env.scheduler.setTimeout> | undefined>(undefined)
  useEffect(
    () => () => {
      if (timer.current !== undefined) env.scheduler.clearTimeout(timer.current)
    },
    [env],
  )
  const settle = (ok: boolean) => {
    copying.current = false
    setCopyState(ok ? "copied" : "error")
    env.announcer.announce({
      message: ok ? copyMessages.copied : copyMessages.copyFailed,
      priority: "polite",
      key: `json-tree-view-${instance}`,
      lang: locale,
    })
    if (timer.current !== undefined) env.scheduler.clearTimeout(timer.current)
    timer.current = env.scheduler.setTimeout(() => {
      timer.current = undefined
      setCopyState("idle")
    }, copyFeedbackDuration)
  }
  const rootEl = useRef<HTMLDivElement | null>(null)
  /** The focused item, else the highlighted one (the tree's Tab stop). */
  const current = (): JsonNode | undefined => {
    const root = rootEl.current
    const active = root?.ownerDocument.activeElement
    const item =
      (active?.closest('[role="treeitem"][data-key]') as HTMLElement | null) ??
      root?.querySelector<HTMLElement>('[role="treeitem"][tabindex="0"][data-key]') ??
      null
    const key = item?.getAttribute("data-key")
    return key == null
      ? undefined
      : (latest.current.collection.get(toKey(key))?.value as JsonNode | undefined)
  }
  const textOf = (n: JsonNode | undefined) => {
    if (!n) throw new Error("[rind-ui] json-tree-view: no item to copy")
    return jsonCopyText(n, latest.current.copyFormat)
  }
  /** Through the Clipboard capability (the CopyTrigger, or a copy event without clipboardData). */
  const copyFrom = (near: Element) => {
    if (copying.current) return
    let text: string
    try {
      text = textOf(current())
    } catch {
      settle(false)
      return
    }
    copying.current = true
    setCopyState("copying")
    env.clipboard.writeText(text, { near }).then(
      () => settle(true),
      () => settle(false),
    )
  }
  // Mod+C on the tree: the native copy event's clipboardData (synchronous, no permission).
  const onCopy = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const target = e.target as Element | null
    if (!target?.closest('[role="tree"]')) return
    // A text selection is the user's: the browser copies it.
    const root = rootEl.current
    const selection = root?.ownerDocument.getSelection()
    if (selection && !selection.isCollapsed && root?.contains(selection.anchorNode)) return
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
    copyState,
    expandAll: (options) => {
      const l = latest.current
      // One deeper than the deepest open container (levels are 0-based in the collection).
      let deepest = -1
      for (const key of l.expandedKeys) {
        const level = l.collection.get(toKey(key))?.level
        if (level !== undefined && level > deepest) deepest = level
      }
      const depth = options?.depth ?? deepest + 2
      const keys = jsonExpandedKeys(l.data, depth, { groupSize: l.groupSize, max: MAX_EXPAND })
      setExpanded([...new Set([...l.expandedKeys, ...keys])], { reason: "all" })
    },
    copy: () => {
      if (rootEl.current) copyFrom(rootEl.current)
    },
  }
  const ctx: Ctx = {
    instance,
    node,
    expanded,
    messages,
    clipboardMessages: copyMessages,
    maxPreviewItems,
    api,
    copyFrom,
  }
  const content =
    typeof children === "function" ? (
      children(api)
    ) : children !== undefined ? (
      children
    ) : (
      <Tree aria-label={ariaLabel} aria-labelledby={ariaLabelledBy}>
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
  const selectionMode = (tree as { selectionMode?: "single" | "multiple" | "none" }).selectionMode
  return (
    <JsonContext value={ctx}>
      <div
        data-scope="tree-view"
        data-part="root"
        data-instance={instance}
        data-json-tree-view=""
        data-copy-state={copyState}
        className={className}
        style={style}
        ref={rootEl}
        onCopy={onCopy}
      >
        <TreeRoot
          {...(tree as Record<string, unknown>)}
          selectionMode={selectionMode ?? "none"}
          id={instance}
          collection={collection}
          expandedValue={expandedKeys}
          onExpandedChange={setExpanded}
        >
          {content}
        </TreeRoot>
      </div>
    </JsonContext>
  )
}

export type JsonTreeViewItemProps = Parameters<typeof TreeItem>[0]

/** A Tree View item with the JSON attributes (`data-type`, `data-key`, `data-range`, …). */
function Item(props: JsonTreeViewItemProps) {
  const ctx = useJson("Item")
  const key = toKey(props.value)
  const n = ctx.node(key)
  const json = n
    ? normalizeProps(
        jsonItemConnect({ instance: ctx.instance, node: n, messages: ctx.messages }).item(),
      )
    : {}
  return (
    <ItemKeyContext value={key}>
      <TreeItem {...json} {...props} />
    </ItemKeyContext>
  )
}

type SpanProps = ComponentPropsWithRef<"span">

function JsonPart({
  name,
  props: { children, ...rest },
  pick,
}: {
  readonly name: string
  readonly props: SpanProps
  readonly pick: (api: ReturnType<typeof jsonItemConnect>) => {
    attrs: PartProps
    text: string | null
  }
}) {
  const { ctx, node } = useNode(name)
  if (!node) return null
  const p = pick(
    jsonItemConnect({
      instance: ctx.instance,
      node,
      messages: ctx.messages,
      maxPreviewItems: ctx.maxPreviewItems,
    }),
  )
  return <span {...mergeProps(normalizeProps(p.attrs), rest)}>{children ?? p.text}</span>
}

/** The property name or index (a range: its bounds). */
function Key(props: SpanProps) {
  return <JsonPart name="Key" props={props} pick={(a) => ({ attrs: a.key(), text: a.keyText })} />
}
/** ":" (its content replaces it). */
function Separator(props: SpanProps) {
  return (
    <JsonPart name="Separator" props={props} pick={(a) => ({ attrs: a.separator(), text: ":" })} />
  )
}
/** A leaf's value, escaped; strings carry `data-quoted`. */
function Value(props: SpanProps) {
  return (
    <JsonPart name="Value" props={props} pick={(a) => ({ attrs: a.value(), text: a.valueText })} />
  )
}
/** `aria-hidden`; a container's glyph summary ("{4}", "[3]"). */
function Summary(props: SpanProps) {
  return (
    <JsonPart
      name="Summary"
      props={props}
      pick={(a) => ({ attrs: a.summary(), text: a.summaryGlyph })}
    />
  )
}
/** Visually hidden; the spoken summary ("object, 4 entries"). */
function SummaryText(props: SpanProps) {
  return (
    <JsonPart
      name="SummaryText"
      props={props}
      pick={(a) => ({ attrs: a.summaryTextPart(), text: a.summaryText })}
    />
  )
}
/** `aria-hidden`; a collapsed container's first keys. */
function Preview(props: SpanProps) {
  return (
    <JsonPart
      name="Preview"
      props={props}
      pick={(a) => ({ attrs: a.preview(), text: a.previewText })}
    />
  )
}

/** An item's default text: Key, Separator, then Value or Summary, SummaryText and Preview. */
function Content() {
  const { ctx, node: n } = useNode("Content")
  if (!n) return null
  const container = jsonItemConnect({ instance: "", node: n, messages: ctx.messages }).isContainer
  return (
    <>
      {n.label !== null || n.type === "range" ? (
        <>
          <Key />
          {n.type !== "range" ? <Separator /> : null}
          {/* A space after the ":" separator: "name: Ada". */}{" "}
        </>
      ) : null}
      {container ? (
        <>
          <Summary />
          <SummaryText />
          {!ctx.expanded.has(n.key) && n.count > 0 ? <Preview /> : null}
        </>
      ) : n.type !== "range" ? (
        <Value />
      ) : null}
    </>
  )
}

export type JsonTreeViewCopyTriggerProps = ComponentPropsWithRef<"button">

/** Copies the highlighted item in `copyFormat`; the result is announced. */
function CopyTrigger({ children, ...rest }: JsonTreeViewCopyTriggerProps) {
  const ctx = useJson("CopyTrigger")
  return (
    <button
      {...mergeProps(
        {
          type: "button",
          "data-scope": "json-tree-view",
          "data-part": "copy-trigger",
          "data-instance": ctx.instance,
          "data-copy-state": ctx.api.copyState,
          onClick: (e: React.MouseEvent<HTMLButtonElement>) => ctx.copyFrom(e.currentTarget),
        },
        rest,
      )}
    >
      {children ?? ctx.clipboardMessages.copy}
    </button>
  )
}

/** The parts, by name: `json-tree-view.parts.ts` re-exports them as the `JsonTreeView` namespace. */
export { CopyTrigger, Item, Key, Preview, Root, Separator, Summary, SummaryText, Value }
