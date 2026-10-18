// Tree View (design §2): wiring only. The machine owns highlight, expansion, selection,
// checking and lazy loads; the core connect owns every attribute and key.

import {
  type CollectionKey,
  checkTreeView,
  createTreeCollection,
  expansionReason,
  type Href,
  keySetOf,
  type LinkCurrent,
  type LinkEnv,
  linkProps,
  type RouterOptions,
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
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine, useSelector } from "../use-machine"
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
      readonly disallowEmptySelection?: boolean
    }
  | { readonly selectionMode: "none" }

export type TreeViewRootProps = {
  readonly id?: string
  readonly children?: ReactNode
  /** The tree's data; or `collection`, a tree collection you built. */
  readonly items?: readonly TreeViewItemData[]
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
  readonly focusableWhenDisabled?: boolean
  readonly loop?: boolean
  readonly typeaheadTimeout?: number
  readonly messages?: Partial<TreeViewMessages>
} & Selection

/** What a node render function receives (design §2). */
export interface TreeViewNodeState {
  readonly key: string
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
  readonly visibleKeys: readonly CollectionKey[]
  readonly node: (key: CollectionKey) => TreeViewNodeState | undefined
  readonly messages: TreeViewMessages
  readonly env: LinkEnv
  readonly mountLabel: (on: boolean) => void
  readonly mountEmpty: (on: boolean) => void
  readonly mountText: (key: CollectionKey, on: boolean) => void
  readonly setHovered: (key: CollectionKey | null) => void
  readonly setPressed: (key: CollectionKey | null) => void
  readonly options: { readonly checkable: boolean; readonly selectionMode: string | undefined }
  readonly service: Parameters<typeof useSelector>[0]
}

const HostContext = createContext<Host | null>(null)
const useHost = (part: string): Host => {
  const host = useContext(HostContext)
  if (!host) throw new Error(`TreeView.${part} must be inside TreeView.Root`)
  return host
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
  const visibleKeys: CollectionKey[] = []
  for (let i = 0; i < visible.size; i++) {
    const node = visible.at(i)
    if (node) visibleKeys.push(node.key)
  }
  const host: Host = {
    parts,
    tree,
    visibleKeys,
    node: (key) => {
      const node = tree.get(key)
      if (!node) return undefined
      const item = parts.item(key)
      const check = item["aria-checked"] as "true" | "false" | "mixed" | undefined
      return {
        key,
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
    service: service as unknown as Host["service"],
  }
  return <HostContext value={host}>{children}</HostContext>
}

type Own<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  readonly render?: RenderProp<undefined>
}

function Label({ render, ...rest }: Own<"span">) {
  const host = useHost("Label")
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
  render,
  ...rest
}: Omit<Own<"div">, "children"> & {
  readonly children: (node: TreeViewNodeState) => ReactNode
  /** Under a loading branch (default: the Loading part with the loading text). */
  readonly loading?: (node: TreeViewNodeState) => ReactNode
}) {
  const host = useHost("Tree")
  useSelector(host.service, (v) => v)
  const ref = useRef<HTMLDivElement | null>(null)
  const { checkable, selectionMode } = host.options
  useEffect(
    () => checkTreeView(ref.current, { checkable, selectionMode }),
    [checkable, selectionMode],
  )
  const naming = { "aria-label": rest["aria-label"], "aria-labelledby": rest["aria-labelledby"] }
  const props = mergeProps({ ...normalizeProps(host.parts.tree(naming)), ref }, rest)
  const rows = host.visibleKeys.map((key) => {
    const node = host.node(key)
    if (!node) return null
    return (
      <Fragment key={key}>
        {children(node)}
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
  return renderPart("div", { ...props, children: rows }, render, undefined)
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
  readonly children?: ReactNode
  /** Renders a native `<a role="treeitem">` (link navigation). */
  readonly href?: Href | undefined
  readonly target?: string | undefined
  readonly rel?: string | undefined
  readonly current?: LinkCurrent | undefined
  readonly routerOptions?: RouterOptions | undefined
}) {
  const host = useHost("Item")
  const key = toKey(value)
  const own = normalizeProps(host.parts.item(key))
  const { setHovered, setPressed } = host
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
    const props = mergeProps(link, own, wiring, rest)
    return (
      <ItemContext value={key}>
        {renderPart("a", { ...props, children }, render as RenderProp<undefined>, undefined)}
      </ItemContext>
    )
  }
  const props = mergeProps(own, wiring, rest)
  return (
    <ItemContext value={key}>
      {renderPart("div", { ...props, children }, render, undefined)}
    </ItemContext>
  )
}

function ItemText({ render, ...rest }: Own<"span">) {
  const host = useHost("ItemText")
  const key = useItemKey("ItemText")
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
  const host = useHost("ItemIndicator")
  const key = useItemKey("ItemIndicator")
  return renderPart(
    "span",
    mergeProps(normalizeProps(host.parts.itemIndicator(key)), rest),
    render,
    undefined,
  )
}

function ItemCheckbox({ render, ...rest }: Own<"span">) {
  const host = useHost("ItemCheckbox")
  const key = useItemKey("ItemCheckbox")
  return renderPart(
    "span",
    mergeProps(normalizeProps(host.parts.itemCheckbox(key)), rest),
    render,
    undefined,
  )
}

function Loading({ render, ...rest }: Own<"span">) {
  const host = useHost("Loading")
  return renderPart(
    "span",
    mergeProps(normalizeProps(host.parts.loading()), rest),
    render,
    undefined,
  )
}

function Empty({ render, children, ...rest }: Own<"div">) {
  const host = useHost("Empty")
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
}
