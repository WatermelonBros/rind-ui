// Tree View (design §2): wiring only. The machine owns highlight, expansion, selection,
// checking and lazy loads; the core connect owns every attribute and key.

import {
  type Collection,
  type CollectionKey,
  checkTreeView,
  createTreeCollection,
  expansionReason,
  type Href,
  keySetOf,
  type LinkCurrent,
  type LinkEnv,
  linkProps,
  type PartProps,
  type RouterOptions,
  type ScrollToIndexDetails,
  type TreeCollection,
  type TreeViewActionDetails,
  type TreeViewMessages,
  type TreeViewParts,
  type TreeViewValue,
  toKey,
  treeSelectionOf,
  treeViewConnect,
  treeViewIds,
  treeViewMachine,
  treeViewMessages,
  visibleOf,
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createContext,
  Fragment,
  memo,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

/** One node of a data-driven tree. */
export interface TreeViewItemData {
  readonly key: string
  readonly label: string
  /** Loaded children (empty or absent for a leaf or an unloaded branch). */
  readonly children?: readonly TreeViewItemData[]
  /** A branch even with no loaded children (lazy, or loaded and empty). */
  readonly isBranch?: boolean
  readonly disabled?: boolean
}

const fromData = (items: readonly TreeViewItemData[]) =>
  createTreeCollection<TreeViewItemData>({
    roots: items,
    getKey: (i) => i.key,
    getText: (i) => i.label,
    getChildren: (i) => i.children,
    hasUnloadedChildren: (i) => i.isBranch === true,
    isDisabled: (i) => i.disabled === true,
  })

export interface TreeViewChangeDetails {
  readonly reason: string
  readonly key: string | undefined
}

export interface TreeViewExpandedDetails {
  readonly reason: "key" | "press" | "api" | "siblings" | "all"
}

type Selection =
  | {
      readonly selectionMode?: "single"
      readonly value?: string | null
      readonly defaultValue?: string | null
      readonly onValueChange?: (value: string | null, details: TreeViewChangeDetails) => void
    }
  | {
      readonly selectionMode: "multiple"
      readonly value?: readonly string[]
      readonly defaultValue?: readonly string[]
      readonly onValueChange?: (value: readonly string[], details: TreeViewChangeDetails) => void
      /** The last selected item cannot be deselected. */
      readonly disallowEmptySelection?: boolean
    }
  | { readonly selectionMode: "none" }

export type TreeViewRootProps = {
  /** Base of the parts' generated ids (default: a `useId`). */
  readonly id?: string
  /** The tree's parts (Label, Tree, Empty). */
  readonly children?: ReactNode
  /** The tree's data; or `collection`, a tree collection you built. */
  readonly items?: readonly TreeViewItemData[]
  /** A tree collection you built, used instead of `items`. */
  readonly collection?: TreeCollection<unknown>
  readonly selectionBehavior?: "toggle" | "replace"
  readonly expandedValue?: readonly string[]
  readonly defaultExpandedValue?: readonly string[]
  readonly onExpandedChange?: (keys: readonly string[], details: TreeViewExpandedDetails) => void
  readonly checkable?: boolean
  readonly checkedValue?: readonly string[]
  readonly defaultCheckedValue?: readonly string[]
  readonly onCheckedChange?: (keys: readonly string[], details: TreeViewChangeDetails) => void
  readonly checkPropagation?: "both" | "none"
  readonly expandOnClick?: boolean
  readonly onAction?: (key: string, details: TreeViewActionDetails) => void
  readonly onLoadChildren?: (
    key: string,
    options: { readonly signal: AbortSignal },
  ) => Promise<unknown> | undefined
  readonly disabled?: boolean
  /** Disabled items (and a disabled tree) stay focusable and reachable by arrows; nothing toggles. */
  readonly focusableWhenDisabled?: boolean
  /** Arrow moves wrap at both ends. Default: false. */
  readonly loop?: boolean
  /** Typeahead reset delay in ms. Default: 1000. */
  readonly typeaheadTimeout?: number
  /** Overrides for the loading announcements and the Empty and Loading default texts. */
  readonly messages?: Partial<TreeViewMessages>
  /**
   * Rows are windowed by the consumer (`TreeView.Tree` `indexes`): keyboard moves call
   * `scrollToIndex`, never `scrollIntoView`.
   */
  readonly virtualized?: boolean
  /** Scrolls the highlighted row into view; `index` is its position in the visible list. */
  readonly scrollToIndex?: (details: ScrollToIndexDetails) => void
} & Selection

/** What a node render function receives (design §2). */
export interface TreeViewNodeState {
  readonly key: string
  /** The row's position in the visible list (what a virtualizer positions by). */
  readonly index: number
  /** The node's data (a `TreeViewItemData` with `items`). */
  readonly value: unknown
  readonly label: string
  /** 1 for roots. */
  readonly level: number
  readonly posInSet: number
  readonly setSize: number
  readonly isLast: boolean
  readonly parentKey: string | null
  readonly isBranch: boolean
  readonly expanded: boolean
  readonly selected: boolean
  readonly checked: "true" | "false" | "mixed" | undefined
  readonly loading: boolean
  readonly disabled: boolean
}

interface Host {
  readonly parts: TreeViewParts
  readonly tree: TreeCollection<unknown>
  /** The visible nodes (memoised per tree and expanded keys: stable while they are). */
  readonly visible: Collection<unknown>
  readonly focused: boolean
  readonly highlightedIndex: number | undefined
  readonly node: (key: CollectionKey) => TreeViewNodeState | undefined
  /** What a row renders from: changes only for the rows a state change affects. */
  readonly rowSignature: (key: CollectionKey) => string
  readonly messages: TreeViewMessages
  readonly env: LinkEnv
  readonly mountLabel: (on: boolean) => void
  readonly mountEmpty: (on: boolean) => void
  readonly mountText: (key: CollectionKey, on: boolean) => void
  readonly setHovered: (key: CollectionKey | null) => void
  readonly setPressed: (key: CollectionKey | null) => void
  readonly options: { readonly checkable: boolean; readonly selectionMode: string | undefined }
}

/**
 * The context value: stable for the tree's life, so a Root render re-renders no part by
 * itself. Each part subscribes to its own slice and re-renders only when that slice changes
 * (a highlight move re-renders the two rows involved, not the whole tree).
 */
interface HostStore {
  current: Host
  readonly subscribe: (listener: () => void) => () => void
  readonly notify: () => void
}

function createHostStore(host: Host): HostStore {
  const listeners = new Set<() => void>()
  return {
    current: host,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    notify: () => {
      for (const listener of listeners) listener()
    },
  }
}

const HostContext = createContext<HostStore | null>(null)
/** The store, subscribed to `slice` of the latest host (re-renders when the slice changes). */
const useHost = (part: string, slice: (host: Host) => string): HostStore => {
  const store = useContext(HostContext)
  if (!store) throw new Error(`TreeView.${part} must be inside TreeView.Root`)
  const get = () => slice(store.current)
  useSyncExternalStore(store.subscribe, get, get)
  return store
}

const objectIds = new WeakMap<object, number>()
let lastId = 0
/** A stable number per object identity (primitives as themselves), for signatures. */
const idOf = (value: unknown): unknown => {
  if ((typeof value !== "object" && typeof value !== "function") || value === null) return value
  let id = objectIds.get(value)
  if (id === undefined) {
    id = ++lastId
    objectIds.set(value, id)
  }
  return id
}

/** A part's attributes as a string (handlers excluded: they never change what renders). */
const attrs = (props: PartProps) =>
  JSON.stringify(props, (_, v) => (typeof v === "function" ? undefined : v))

/**
 * The handlers call the latest render's: a part that skipped a re-render (its attributes did
 * not change) never acts on the state of an older one.
 */
function live(props: PartProps, latest: () => PartProps): PartProps {
  const out: Record<string | symbol, unknown> = { ...props }
  for (const [name, value] of Object.entries(props)) {
    if (typeof value !== "function") continue
    out[name] = (...args: unknown[]) =>
      (latest()[name] as ((...a: unknown[]) => unknown) | undefined)?.(...args)
  }
  return out as PartProps
}
const ItemContext = createContext<CollectionKey | null>(null)
const useItemKey = (part: string) => {
  const key = useContext(ItemContext)
  if (key === null) throw new Error(`TreeView.${part} must be inside TreeView.Item`)
  return key
}

const EMPTY_TREE = fromData([])

function Root(all: TreeViewRootProps) {
  const { id, items, collection, children } = all
  const p = all as Record<string, unknown>
  const env = useEnvironment()
  const instance = useRootId(id)
  const data = useMemo(() => (items ? fromData(items) : null), [items])
  const tree = collection ?? data ?? EMPTY_TREE
  const ids = useMemo(() => treeViewIds(instance), [instance])
  const selectionMode =
    (p["selectionMode"] as "single" | "multiple" | "none" | undefined) ?? "single"
  // Sound: every key of the defaults is present; a partial override only replaces some.
  const messages = useMemo(
    () => ({ ...treeViewMessages, ...all.messages }) as TreeViewMessages,
    [all.messages],
  )
  const latest = useRef(all)
  latest.current = all
  const { service } = useMachine(treeViewMachine, {
    tree,
    ids: { list: ids.tree, item: ids.item },
    selectionMode,
    selectionBehavior: all.selectionBehavior,
    disallowEmptySelection: p["disallowEmptySelection"] as boolean | undefined,
    focusableWhenDisabled: all.focusableWhenDisabled,
    loop: all.loop,
    typeaheadTimeout: all.typeaheadTimeout,
    checkable: all.checkable,
    checkPropagation: all.checkPropagation,
    expandOnClick: all.expandOnClick,
    disabled: all.disabled,
    messages,
    ...("value" in all ? { value: p["value"] as TreeViewValue } : {}),
    defaultValue:
      (p["defaultValue"] as TreeViewValue | undefined) ??
      (selectionMode === "multiple" ? [] : null),
    onValueChange: (v, details) => {
      const e = details.event as { type: string; key?: string }
      const cb = (latest.current as { onValueChange?: (v: unknown, d: unknown) => void })
        .onValueChange
      cb?.(v, { reason: e.type, key: e.key })
    },
    ...(all.expandedValue !== undefined ? { expandedValue: all.expandedValue } : {}),
    defaultExpandedValue: all.defaultExpandedValue ?? [],
    onExpandedValueChange: (keys, details) =>
      latest.current.onExpandedChange?.(keys, { reason: expansionReason(details.event.type) }),
    ...(all.checkedValue !== undefined ? { checkedValue: all.checkedValue } : {}),
    defaultCheckedValue: all.defaultCheckedValue ?? [],
    onCheckedValueChange: (keys, details) => {
      const e = details.event as { type: string; key?: string }
      latest.current.onCheckedChange?.(keys, { reason: e.type, key: e.key })
    },
    onAction: all.onAction ? (key, d) => latest.current.onAction?.(key, d) : undefined,
    onLoadChildren: all.onLoadChildren
      ? (key, o) => latest.current.onLoadChildren?.(key, o)
      : undefined,
    virtualized: all.virtualized,
    scrollToIndex: all.scrollToIndex ? (d) => latest.current.scrollToIndex?.(d) : undefined,
  })
  const view = service.view()
  const [mounted, setMounted] = useState<{
    label: boolean
    empty: boolean
    texts: ReadonlySet<CollectionKey>
  }>({ label: false, empty: false, texts: new Set() })
  const [hovered, setHovered] = useState<CollectionKey | null>(null)
  const [pressed, setPressed] = useState<CollectionKey | null>(null)
  const [mounts] = useState(() => ({
    label: (on: boolean) => setMounted((m) => (m.label === on ? m : { ...m, label: on })),
    empty: (on: boolean) => setMounted((m) => (m.empty === on ? m : { ...m, empty: on })),
    text: (key: CollectionKey, on: boolean) =>
      setMounted((m) => {
        if (m.texts.has(key) === on) return m
        const texts = new Set(m.texts)
        if (on) texts.add(key)
        else texts.delete(key)
        return { ...m, texts }
      }),
  }))
  const focused = view.matches("focused")
  const modality = useModality(env.modality, focused)
  const expandedKeys = view.values.expandedValue as readonly string[] | undefined
  const visible = visibleOf(tree, expandedKeys)
  const expanded = keySetOf(expandedKeys)
  const checked = keySetOf(view.values.checkedValue as readonly string[] | undefined)
  const selection = treeSelectionOf(
    view.values.value as TreeViewValue | undefined,
    all.checkable ? "none" : selectionMode,
  )
  const ctx = view.context
  const parts = treeViewConnect(
    {
      instance,
      tree,
      visible,
      expanded,
      context: {
        highlightedKey: ctx.highlightedKey,
        highlightSource: ctx.highlightSource,
        loading: ctx.loading,
        failed: ctx.failed,
      },
      selection,
      selectionMode: all.checkable ? "none" : selectionMode,
      checkable: all.checkable === true,
      checked,
      checkPropagation: all.checkPropagation ?? "both",
      disabled: all.disabled === true,
      focusableWhenDisabled: all.focusableWhenDisabled,
      typingAhead: () => {
        const t = service.getSnapshot().context.typeahead
        return t.buffer !== "" && env.clock.now() - t.at <= (all.typeaheadTimeout ?? 1000)
      },
      focused,
      modality,
      hovered,
      pressed,
      mounted: {
        label: mounted.label,
        empty: mounted.empty,
        itemText: (key) => mounted.texts.has(key),
      },
      send: service.send,
    },
    env,
  )
  const signatures = new Map<CollectionKey, string>()
  const host: Host = {
    parts,
    tree,
    visible,
    focused,
    highlightedIndex:
      ctx.highlightedKey === null ? undefined : visible.get(ctx.highlightedKey)?.index,
    node: (key) => {
      const node = tree.get(key)
      if (!node) return undefined
      const item = parts.item(key)
      const check = item["aria-checked"] as "true" | "false" | "mixed" | undefined
      return {
        key,
        index: visible.get(key)?.index ?? -1,
        value: node.value,
        label: node.textValue,
        level: node.level + 1,
        posInSet: node.setIndex + 1,
        setSize: node.setSize,
        isLast: node.setIndex === node.setSize - 1,
        parentKey: node.parentKey,
        isBranch: node.hasChildren,
        expanded: node.hasChildren && expanded.has(key),
        selected: item["aria-selected"] === "true",
        checked: check,
        loading: ctx.loading.has(key),
        disabled: node.disabled,
      }
    },
    messages,
    env,
    mountLabel: mounts.label,
    mountEmpty: mounts.empty,
    mountText: mounts.text,
    setHovered,
    setPressed,
    options: { checkable: all.checkable === true, selectionMode: p["selectionMode"] as string },
    rowSignature: (key) => {
      // Once per key per render: every part of a row asks.
      let signature = signatures.get(key)
      if (signature === undefined) {
        const node = host.node(key)
        signature = node
          ? `${idOf(node.value)}|${idOf(messages)}|${JSON.stringify({ ...node, value: 0 })}|${attrs(parts.item(key))}`
          : ""
        signatures.set(key, signature)
      }
      return signature
    },
  }
  const [store] = useState(() => createHostStore(host))
  // Read during this render by the parts it renders; the others are notified after commit.
  store.current = host
  useIsoLayoutEffect(() => store.notify())
  return <HostContext value={store}>{children}</HostContext>
}

type Own<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  /** Another element or a render function receiving the props. */
  readonly render?: RenderProp<undefined>
}

function Label({ render, ...rest }: Own<"span">) {
  const host = useHost("Label", (h) => attrs(h.parts.label())).current
  const { mountLabel } = host
  useIsoLayoutEffect(() => {
    mountLabel(true)
    return () => mountLabel(false)
  }, [mountLabel])
  return renderPart("span", mergeProps(normalizeProps(host.parts.label()), rest), render, undefined)
}

/**
 * The tree. `children` renders one visible node (usually a `TreeView.Item`); it is called
 * per visible node, in order, as a flat list. A loading branch is followed by `loading`.
 */
function Tree({
  children,
  loading,
  indexes,
  render,
  ...rest
}: Omit<Own<"div">, "children"> & {
  /** Called once per visible node with its state; returns its row (usually a `TreeView.Item`). */
  readonly children: (node: TreeViewNodeState) => ReactNode
  /** Under a loading branch (default: the Loading part with the loading text). */
  readonly loading?: (node: TreeViewNodeState) => ReactNode
  /**
   * Virtualized: the visible-list indexes to render (a virtualizer's window plus
   * `TreeView.useVisibleRows().persistedIndexes`). Default: every visible node.
   */
  readonly indexes?: readonly number[]
}) {
  const naming = { "aria-label": rest["aria-label"], "aria-labelledby": rest["aria-labelledby"] }
  const store = useHost("Tree", (h) => `${idOf(h.visible)}|${attrs(h.parts.tree(naming))}`)
  const host = store.current
  const ref = useRef<HTMLDivElement | null>(null)
  const { checkable, selectionMode } = host.options
  // After the re-render a Label's registration causes (a layout effect), not on the first commit.
  useEffect(() => {
    const node = ref.current
    queueMicrotask(() => {
      if (node?.isConnected) checkTreeView(node, { checkable, selectionMode })
    })
  }, [checkable, selectionMode])
  const own = live(host.parts.tree(naming), () => store.current.parts.tree(naming))
  const props = mergeProps({ ...normalizeProps(own), ref }, rest)
  const { visible } = host
  const rows: ReactNode[] = []
  const add = (index: number) => {
    const node = visible.at(index)
    if (node) rows.push(<Row key={node.key} nodeKey={node.key} row={children} loading={loading} />)
  }
  if (indexes) for (const index of indexes) add(index)
  else for (let index = 0; index < visible.size; index++) add(index)
  return renderPart("div", { ...props, children: rows }, render, undefined)
}

/** One visible node: re-renders only when its own signature changes. */
const Row = memo(function Row({
  nodeKey,
  row,
  loading,
}: {
  readonly nodeKey: CollectionKey
  readonly row: (node: TreeViewNodeState) => ReactNode
  readonly loading: ((node: TreeViewNodeState) => ReactNode) | undefined
}) {
  const host = useHost("Tree", (h) => h.rowSignature(nodeKey)).current
  const node = host.node(nodeKey)
  if (!node) return null
  return (
    <Fragment>
      {row(node)}
      {node.loading ? (
        loading ? (
          loading(node)
        ) : (
          <Loading>{host.messages.loadingLabel}</Loading>
        )
      ) : null}
    </Fragment>
  )
})

/**
 * For a virtualizer inside `TreeView.Root`: the visible row count and the indexes it must keep
 * rendered (the highlighted row, so focus and the keyboard never lose it).
 */
function useVisibleRows(): {
  readonly count: number
  readonly persistedIndexes: readonly number[]
} {
  const host = useHost("useVisibleRows", (h) => `${h.visible.size}|${h.highlightedIndex}`).current
  const count = host.visible.size
  const index = host.highlightedIndex
  return useMemo(
    () => ({ count, persistedIndexes: index === undefined ? [] : [index] }),
    [count, index],
  )
}

function Item({
  value,
  href,
  target,
  rel,
  current,
  routerOptions,
  render,
  children,
  ...rest
}: Omit<Own<"div">, "children"> & {
  /** The node key. */
  readonly value: string
  /** The row's content (ItemText, ItemIndicator, ItemCheckbox). */
  readonly children?: ReactNode
  /** Renders a native `<a role="treeitem">` (link navigation). */
  readonly href?: Href | undefined
  /** With `href`: passed to the anchor; not `_self` opens elsewhere. */
  readonly target?: string | undefined
  /** With `href`: passed to the anchor. */
  readonly rel?: string | undefined
  /** With `href`: sets `aria-current` and `data-current`; the link still navigates. */
  readonly current?: LinkCurrent | undefined
  /** With `href`: passed unchanged to the router's `navigate`. */
  readonly routerOptions?: RouterOptions | undefined
}) {
  const key = toKey(value)
  const store = useHost("Item", (h) => h.rowSignature(key))
  const host = store.current
  const item = host.parts.item(key)
  const own = normalizeProps(live(item, () => store.current.parts.item(key)))
  const { setHovered, setPressed } = host
  const ref = useRef<HTMLElement | null>(null)
  // Virtualized: a row highlighted by a key press mounts after the scroll. Focus left on the
  // tree, on the previous row, or dropped to the body when that row unmounted moves to it.
  const highlighted = item["data-highlighted"] !== undefined
  const treeFocused = host.focused
  useIsoLayoutEffect(() => {
    const node = ref.current
    if (!node || !highlighted || !treeFocused) return
    const doc = node.ownerDocument
    const active = doc.activeElement
    if (active === node) return
    const treeEl = node.closest('[role="tree"]')
    const dropped = active === null || active === doc.body
    const inTree =
      active !== null &&
      treeEl !== null &&
      (active === treeEl ||
        (active.getAttribute("role") === "treeitem" && active.closest('[role="tree"]') === treeEl))
    if (dropped || inTree) node.focus({ preventScroll: true })
  }, [highlighted])
  const wiring = {
    onPointerEnter: () => setHovered(key),
    onPointerLeave: () => setHovered(null),
    onPointerDown: () => setPressed(key),
    onPointerUp: () => setPressed(null),
    onPointerCancel: () => setPressed(null),
  }
  if (href !== undefined) {
    const link = normalizeProps(
      linkProps(
        {
          href,
          target,
          rel,
          current,
          routerOptions,
          tag: "a",
          origin: typeof location === "undefined" ? undefined : location.origin,
        },
        host.env,
      ),
    )
    // The tree's roving tabindex and role win over the link's.
    const props = mergeProps(link, { ...own, ref }, wiring, rest)
    return (
      <ItemContext value={key}>
        {renderPart("a", { ...props, children }, render as RenderProp<undefined>, undefined)}
      </ItemContext>
    )
  }
  const props = mergeProps({ ...own, ref }, wiring, rest)
  return (
    <ItemContext value={key}>
      {renderPart("div", { ...props, children }, render, undefined)}
    </ItemContext>
  )
}

function ItemText({ render, ...rest }: Own<"span">) {
  const key = useItemKey("ItemText")
  const host = useHost("ItemText", (h) => h.rowSignature(key)).current
  const { mountText } = host
  useIsoLayoutEffect(() => {
    mountText(key, true)
    return () => mountText(key, false)
  }, [mountText, key])
  return renderPart(
    "span",
    mergeProps(normalizeProps(host.parts.itemText(key)), rest),
    render,
    undefined,
  )
}

function ItemIndicator({ render, ...rest }: Own<"span">) {
  const key = useItemKey("ItemIndicator")
  const host = useHost("ItemIndicator", (h) => h.rowSignature(key)).current
  return renderPart(
    "span",
    mergeProps(normalizeProps(host.parts.itemIndicator(key)), rest),
    render,
    undefined,
  )
}

function ItemCheckbox({ render, ...rest }: Own<"span">) {
  const key = useItemKey("ItemCheckbox")
  const host = useHost("ItemCheckbox", (h) => h.rowSignature(key)).current
  return renderPart(
    "span",
    mergeProps(normalizeProps(host.parts.itemCheckbox(key)), rest),
    render,
    undefined,
  )
}

function Loading({ render, ...rest }: Own<"span">) {
  const host = useHost("Loading", (h) => attrs(h.parts.loading())).current
  return renderPart(
    "span",
    mergeProps(normalizeProps(host.parts.loading()), rest),
    render,
    undefined,
  )
}

function Empty({ render, children, ...rest }: Own<"div">) {
  const host = useHost(
    "Empty",
    (h) => `${h.parts.isEmpty}|${h.messages.emptyLabel}|${attrs(h.parts.empty())}`,
  ).current
  const { mountEmpty } = host
  const shown = host.parts.isEmpty
  useIsoLayoutEffect(() => {
    if (!shown) return
    mountEmpty(true)
    return () => mountEmpty(false)
  }, [mountEmpty, shown])
  if (!shown) return null
  return renderPart(
    "div",
    mergeProps(normalizeProps(host.parts.empty()), rest, {
      children: children ?? host.messages.emptyLabel,
    }),
    render,
    undefined,
  )
}

/** A hierarchy the user expands, navigates and selects or checks (openspec tree-view). */
export const TreeView = {
  Root,
  Label,
  Tree,
  Item,
  ItemText,
  ItemIndicator,
  ItemCheckbox,
  Loading,
  Empty,
  useVisibleRows,
}
