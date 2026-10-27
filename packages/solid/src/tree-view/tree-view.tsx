/** @jsxImportSource solid-js */
// Tree View (design §2): wiring only. The machine owns highlight, expansion, selection,
// checking and lazy loads; the core connect owns every attribute and key.
import {
  announcerCapability,
  type Collection,
  type CollectionKey,
  checkTreeView,
  createTreeCollection,
  expansionReason,
  type Href,
  isMovable,
  keySetOf,
  type LinkCurrent,
  type LinkEnv,
  layoutCapability,
  linkProps,
  pointerTarget,
  type RouterOptions,
  type ScrollToIndexDetails,
  type TreeCollection,
  type TreeDropZone,
  type TreeViewActionDetails,
  type TreeViewMessages,
  type TreeViewMoveDetails,
  type TreeViewParts,
  type TreeViewValue,
  toKey,
  treeDrag,
  treeSelectionOf,
  treeViewConnect,
  treeViewIds,
  treeViewMachine,
  treeViewMessages,
  visibleOf,
} from "@rind-ui/core"
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  For,
  type JSX,
  on,
  onCleanup,
  Show,
  splitProps,
  useContext,
} from "solid-js"
import { useKeepFocus } from "../keep-focus"
import { afterMount } from "../lifecycle"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { type RenderProp, reactive, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

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
const EMPTY_TREE = fromData([])

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
  /** Base of the parts' generated ids (default: generated). */
  readonly id?: string | undefined
  /** The tree's parts (Label, Tree, Empty). */
  readonly children?: JSX.Element
  /** The tree's data; or `collection`, a tree collection you built. */
  readonly items?: readonly TreeViewItemData[] | undefined
  /** A tree collection you built, used instead of `items`. */
  readonly collection?: TreeCollection<unknown> | undefined
  readonly selectionBehavior?: "toggle" | "replace" | undefined
  readonly expandedValue?: readonly string[] | undefined
  readonly defaultExpandedValue?: readonly string[] | undefined
  readonly onExpandedChange?:
    | ((keys: readonly string[], details: TreeViewExpandedDetails) => void)
    | undefined
  readonly checkable?: boolean | undefined
  readonly checkedValue?: readonly string[] | undefined
  readonly defaultCheckedValue?: readonly string[] | undefined
  readonly onCheckedChange?:
    | ((keys: readonly string[], details: TreeViewChangeDetails) => void)
    | undefined
  readonly checkPropagation?: "both" | "none" | undefined
  readonly expandOnClick?: boolean | undefined
  readonly onAction?: ((key: string, details: TreeViewActionDetails) => void) | undefined
  readonly onLoadChildren?:
    | ((key: string, options: { readonly signal: AbortSignal }) => Promise<unknown> | undefined)
    | undefined
  readonly disabled?: boolean | undefined
  /** Disabled items (and a disabled tree) stay focusable and reachable by arrows; nothing toggles. */
  readonly focusableWhenDisabled?: boolean | undefined
  /** Arrow moves wrap at both ends. Default: false. */
  readonly loop?: boolean | undefined
  /** Typeahead reset delay in ms. Default: 1000. */
  readonly typeaheadTimeout?: number | undefined
  /** Overrides for the loading announcements and the Empty and Loading default texts. */
  readonly messages?: Partial<TreeViewMessages> | undefined
  /**
   * Rows are windowed by the consumer (`TreeView.Tree` `indexes`): keyboard moves call
   * `scrollToIndex`, never `scrollIntoView`.
   */
  readonly virtualized?: boolean | undefined
  /** Scrolls the highlighted row into view; `index` is its position in the visible list. */
  readonly scrollToIndex?: ((details: ScrollToIndexDetails) => void) | undefined
  /** Nodes can be moved (Alt+arrows, pointer drags): all, or those the predicate allows. */
  readonly movable?: boolean | ((key: string) => boolean) | undefined
  /** A node moved: apply it to `items` with `moveNode(items, key, details)`. */
  readonly onMove?: ((key: string, details: TreeViewMoveDetails) => void) | undefined
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
  readonly parts: Accessor<TreeViewParts>
  readonly tree: Accessor<TreeCollection<unknown>>
  readonly visible: Accessor<Collection<unknown>>
  readonly focused: Accessor<boolean>
  readonly highlightedIndex: Accessor<number | undefined>
  readonly node: (key: CollectionKey) => TreeViewNodeState | undefined
  readonly messages: Accessor<TreeViewMessages>
  readonly env: LinkEnv
  readonly mountLabel: (on: boolean) => void
  readonly mountEmpty: (on: boolean) => void
  readonly mountText: (key: CollectionKey, on: boolean) => void
  readonly setHovered: (key: CollectionKey | null) => void
  readonly setPressed: (key: CollectionKey | null) => void
  readonly options: Accessor<{
    readonly checkable: boolean
    readonly selectionMode: string | undefined
  }>
  /** Moving (add-tree-view-dnd): whether a row may be dragged, and its pointer drag. */
  readonly canMove: (key: CollectionKey) => boolean
  readonly startDrag: (key: CollectionKey, event: PointerEvent) => void
  /** The drop line's place (px from the tree's top, and the target level), or null. */
  readonly dropAt: Accessor<{ readonly top: number; readonly level: number } | null>
}

const HostContext = createContext<Host>()
const useHost = (part: string): Host => {
  const host = useContext(HostContext)
  if (!host) throw new Error(`TreeView.${part} must be inside TreeView.Root`)
  return host
}
const ItemContext = createContext<Accessor<CollectionKey>>()
/** The enclosing `TreeView.Item`'s key, or undefined outside one (parts built on Tree View). */
export const useTreeViewItemKey = (): Accessor<CollectionKey> | undefined => useContext(ItemContext)
const useItemKey = (part: string) => {
  const key = useContext(ItemContext)
  if (!key) throw new Error(`TreeView.${part} must be inside TreeView.Item`)
  return key
}

function Root(all: TreeViewRootProps) {
  const p = all as Record<string, unknown> & TreeViewRootProps
  const env = useEnvironment(announcerCapability, layoutCapability)
  const instance = useRootId(() => p.id)
  const data = createMemo(() => (p.items ? fromData(p.items) : null))
  const tree = createMemo<TreeCollection<unknown>>(() => p.collection ?? data() ?? EMPTY_TREE)
  const ids = createMemo(() => treeViewIds(instance()))
  const selectionMode = () =>
    (p["selectionMode"] as "single" | "multiple" | "none" | undefined) ?? "single"
  // Sound: every key of the defaults is present; a partial override only replaces some.
  const messages = createMemo(() => ({ ...treeViewMessages, ...p.messages }) as TreeViewMessages)
  const { view, service } = useMachine(
    treeViewMachine,
    () => ({
      tree: tree(),
      ids: { list: ids().tree, item: ids().item },
      selectionMode: selectionMode(),
      selectionBehavior: p.selectionBehavior,
      disallowEmptySelection: p["disallowEmptySelection"] as boolean | undefined,
      focusableWhenDisabled: p.focusableWhenDisabled,
      loop: p.loop,
      typeaheadTimeout: p.typeaheadTimeout,
      checkable: p.checkable,
      checkPropagation: p.checkPropagation,
      expandOnClick: p.expandOnClick,
      disabled: p.disabled,
      messages: messages(),
      ...("value" in all ? { value: p["value"] as TreeViewValue } : {}),
      defaultValue:
        (p["defaultValue"] as TreeViewValue | undefined) ??
        (selectionMode() === "multiple" ? [] : null),
      onValueChange: (v: TreeViewValue, details: { event: unknown }) => {
        const e = details.event as { type: string; key?: string }
        ;(p["onValueChange"] as ((v: unknown, d: unknown) => void) | undefined)?.(v, {
          reason: e.type,
          key: e.key,
        })
      },
      ...(p.expandedValue !== undefined ? { expandedValue: p.expandedValue } : {}),
      defaultExpandedValue: p.defaultExpandedValue ?? [],
      onExpandedValueChange: (keys: readonly string[], details: { event: { type: string } }) =>
        p.onExpandedChange?.(keys, { reason: expansionReason(details.event.type as never) }),
      ...(p.checkedValue !== undefined ? { checkedValue: p.checkedValue } : {}),
      defaultCheckedValue: p.defaultCheckedValue ?? [],
      onCheckedValueChange: (keys: readonly string[], details: { event: unknown }) => {
        const e = details.event as { type: string; key?: string }
        p.onCheckedChange?.(keys, { reason: e.type, key: e.key })
      },
      onAction: p.onAction
        ? (key: string, d: TreeViewActionDetails) => p.onAction?.(key, d)
        : undefined,
      onLoadChildren: p.onLoadChildren
        ? (key: string, o: { readonly signal: AbortSignal }) => p.onLoadChildren?.(key, o)
        : undefined,
      virtualized: p.virtualized,
      scrollToIndex: p.scrollToIndex
        ? (d: ScrollToIndexDetails) => p.scrollToIndex?.(d)
        : undefined,
      movable: p.movable,
      onMove: p.onMove ? (key: string, d: TreeViewMoveDetails) => p.onMove?.(key, d) : undefined,
    }),
    env,
  )
  const send = service.send
  const [label, setLabel] = createSignal(false)
  const [empty, setEmpty] = createSignal(false)
  const [texts, setTexts] = createSignal<ReadonlySet<CollectionKey>>(new Set())
  const [hovered, setHovered] = createSignal<CollectionKey | null>(null)
  const [pressed, setPressed] = createSignal<CollectionKey | null>(null)
  const [dropAt, setDropAt] = createSignal<ReturnType<Host["dropAt"]>>(null)
  const canMove = (key: CollectionKey) =>
    isMovable({ movable: p.movable, disabled: p.disabled }, key)
  const focused = () => view().matches("focused")
  const modality = useModality(env.modality, focused)
  const expandedKeys = createMemo(
    () => view().values.expandedValue as readonly string[] | undefined,
  )
  const expanded = createMemo(() => keySetOf(expandedKeys()))
  const visible = createMemo(() => visibleOf(tree(), expandedKeys()))
  const parts = createMemo(() => {
    const ctx = view().context
    const mode = p.checkable ? "none" : selectionMode()
    return treeViewConnect(
      {
        instance: instance(),
        tree: tree(),
        visible: visible(),
        expanded: expanded(),
        context: {
          highlightedKey: ctx.highlightedKey,
          highlightSource: ctx.highlightSource,
          loading: ctx.loading,
          failed: ctx.failed,
        },
        selection: treeSelectionOf(view().values.value as TreeViewValue | undefined, mode),
        selectionMode: mode,
        checkable: p.checkable === true,
        checked: keySetOf(view().values.checkedValue as readonly string[] | undefined),
        checkPropagation: p.checkPropagation ?? "both",
        disabled: p.disabled === true,
        focusableWhenDisabled: p.focusableWhenDisabled,
        typingAhead: () => {
          const t = service.getSnapshot().context.typeahead
          return t.buffer !== "" && env.clock.now() - t.at <= (p.typeaheadTimeout ?? 1000)
        },
        focused: focused(),
        modality: modality(),
        hovered: hovered(),
        pressed: pressed(),
        mounted: {
          label: label(),
          empty: empty(),
          itemText: (key: CollectionKey) => texts().has(key),
        },
        send,
        canMove,
        movable: p.movable !== undefined && p.movable !== false,
        drag: ctx.drag,
        moveInstructions: messages().moveInstructions,
      },
      env,
    )
  })
  const node = (key: CollectionKey): TreeViewNodeState | undefined => {
    const n = tree().get(key)
    if (!n) return undefined
    const item = parts().item(key)
    return {
      key,
      index: visible().get(key)?.index ?? -1,
      value: n.value,
      label: n.textValue,
      level: n.level + 1,
      posInSet: n.setIndex + 1,
      setSize: n.setSize,
      isLast: n.setIndex === n.setSize - 1,
      parentKey: n.parentKey,
      isBranch: n.hasChildren,
      expanded: n.hasChildren && expanded().has(key),
      selected: item["aria-selected"] === "true",
      checked: item["aria-checked"] as "true" | "false" | "mixed" | undefined,
      loading: view().context.loading.has(key),
      disabled: n.disabled,
    }
  }
  const host: Host = {
    parts,
    tree,
    visible,
    focused,
    highlightedIndex: () => {
      const k = view().context.highlightedKey
      return k === null ? undefined : visible().get(k)?.index
    },
    node,
    messages,
    env,
    mountLabel: setLabel,
    mountEmpty: setEmpty,
    mountText: (key, on) =>
      setTexts((m) => {
        if (m.has(key) === on) return m
        const next = new Set(m)
        if (on) next.add(key)
        else next.delete(key)
        return next
      }),
    setHovered,
    setPressed,
    options: () => ({
      checkable: p.checkable === true,
      selectionMode: p["selectionMode"] as string,
    }),
    canMove,
    dropAt,
    startDrag: (key, event) => {
      const treeEl = (event.currentTarget as HTMLElement).closest<HTMLElement>('[role="tree"]')
      if (!treeEl || (event.pointerType === "mouse" && event.button !== 0)) return
      let auto: { key: CollectionKey; timer: ReturnType<typeof env.scheduler.setTimeout> } | null =
        null
      const stopAuto = () => {
        if (auto) env.scheduler.clearTimeout(auto.timer)
        auto = null
      }
      treeDrag(event, {
        tree: treeEl,
        onStart: () => send({ type: "DRAG.START", key }),
        onOver: (row, fraction) => {
          // The latest tree and expansion: a branch may have opened during the drag.
          const raw = row?.getAttribute("data-key")
          const over = raw ? toKey(raw) : null
          const n = over === null ? undefined : node(over)
          if (over === null || !n || !row) {
            stopAuto()
            setDropAt(null)
            send({ type: "DRAG.OVER", over: null, zone: null, target: null })
            return
          }
          const zone: TreeDropZone =
            fraction < 0.25
              ? "before"
              : fraction > 0.75
                ? "after"
                : n.isBranch
                  ? "inside"
                  : fraction < 0.5
                    ? "before"
                    : "after"
          const target = pointerTarget(tree(), key, over, zone, n.expanded)
          send({ type: "DRAG.OVER", over, zone, target })
          // A collapsed branch held over its middle opens (a drop inside it can then be aimed).
          if (zone === "inside" && n.isBranch && !n.expanded && target) {
            if (auto?.key !== over) {
              stopAuto()
              auto = {
                key: over,
                timer: env.scheduler.setTimeout(() => send({ type: "EXPAND", key: over }), 700),
              }
            }
          } else stopAuto()
          if (!target || zone === "inside") {
            setDropAt(null)
            return
          }
          const box = row.getBoundingClientRect()
          const parent = target.parent === null ? undefined : node(toKey(target.parent))
          setDropAt({
            top: (zone === "before" ? box.top : box.bottom) - treeEl.getBoundingClientRect().top,
            level: parent ? parent.level + 1 : 1,
          })
        },
        onEnd: (drop) => {
          stopAuto()
          setDropAt(null)
          send(drop ? { type: "DRAG.END" } : { type: "DRAG.CANCEL" })
        },
      })
    },
  }
  return (
    <HostContext.Provider value={host}>
      {p.children}
      <Show when={p.movable}>
        <span {...normalizeProps(parts().moveInstructions())}>{parts().moveInstructionsText}</span>
      </Show>
    </HostContext.Provider>
  )
}

type Own<A> = Omit<A, "children"> & {
  /** Another element: a function receiving the props to spread. */
  readonly render?: RenderProp<undefined> | undefined
  readonly children?: JSX.Element
}
export type TreeViewSpanProps = Own<JSX.HTMLAttributes<HTMLSpanElement>>
export type TreeViewDivProps = Own<JSX.HTMLAttributes<HTMLDivElement>>

function Label(props: TreeViewSpanProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const host = useHost("Label")
  createEffect(() => {
    host.mountLabel(true)
    onCleanup(() => host.mountLabel(false))
  })
  const merged = createMemo(() => mergeProps(normalizeProps(host.parts().label()), rest))
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

function Loading(props: TreeViewSpanProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const host = useHost("Loading")
  const merged = createMemo(() => mergeProps(normalizeProps(host.parts().loading()), rest))
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

export type TreeViewTreeProps = Omit<Own<JSX.HTMLAttributes<HTMLDivElement>>, "children"> & {
  /** Called once per visible node with its state; returns its row (usually a `TreeView.Item`). */
  readonly children: (node: TreeViewNodeState) => JSX.Element
  /** Under a loading branch (default: the Loading part with the loading text). */
  readonly loading?: ((node: TreeViewNodeState) => JSX.Element) | undefined
  /**
   * Virtualized: the visible-list indexes to render (a virtualizer's window plus
   * `TreeView.useVisibleRows().persistedIndexes`). Default: every visible node.
   */
  readonly indexes?: readonly number[] | undefined
}

/** One visible node: its row, then the loading row of a loading branch. */
function Row(props: {
  readonly nodeKey: CollectionKey
  readonly row: (node: TreeViewNodeState) => JSX.Element
  readonly loading: ((node: TreeViewNodeState) => JSX.Element) | undefined
}) {
  const host = useHost("Tree")
  const exists = createMemo(() => host.node(props.nodeKey) !== undefined)
  let last: TreeViewNodeState | undefined
  // A reactive view of the node: reads track the node's state; it outlives a removal briefly.
  const node = reactive<TreeViewNodeState>(() => {
    last = host.node(props.nodeKey) ?? last
    return last as TreeViewNodeState
  })
  return (
    <Show when={exists()}>
      {props.row(node)}
      <Show when={node.loading}>
        {props.loading ? props.loading(node) : <Loading>{host.messages().loadingLabel}</Loading>}
      </Show>
    </Show>
  )
}

/**
 * The tree. `children` renders one visible node (usually a `TreeView.Item`); it is called
 * per visible node, in order, as a flat list. A loading branch is followed by `loading`.
 */
function Tree(props: TreeViewTreeProps) {
  const [local, rest] = splitProps(props, ["children", "loading", "indexes", "render"])
  const host = useHost("Tree")
  const [el, setEl] = createSignal<HTMLElement | null>(null)
  // A moved node keeps its focus (Alt+arrows reorder the rows under it).
  useKeepFocus(el, host.visible)
  // After the re-render a Label's registration causes, not on the first commit.
  afterMount(() => {
    createEffect(
      on(host.options, (o) => {
        const node = el()
        queueMicrotask(() => {
          if (node?.isConnected) checkTreeView(node, o)
        })
      }),
    )
  })
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps(
          host.parts().tree({
            "aria-label": rest["aria-label"],
            "aria-labelledby": rest["aria-labelledby"],
          }),
        ),
        ref: setEl,
      },
      rest,
    ),
  )
  const keys = createMemo(() => {
    const visible = host.visible()
    const out: CollectionKey[] = []
    const add = (index: number) => {
      const node = visible.at(index)
      if (node) out.push(node.key)
    }
    if (local.indexes) for (const index of local.indexes) add(index)
    else for (let index = 0; index < visible.size; index++) add(index)
    return out
  })
  const children = () => (
    <For each={keys()}>
      {(key) => <Row nodeKey={key} row={local.children} loading={local.loading} />}
    </For>
  )
  return renderPart(local.render, merged, undefined, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

/**
 * For a virtualizer inside `TreeView.Root`: the visible row count and the indexes it must keep
 * rendered (the highlighted row, so focus and the keyboard never lose it).
 */
function useVisibleRows(): Accessor<{
  readonly count: number
  readonly persistedIndexes: readonly number[]
}> {
  const host = useHost("useVisibleRows")
  return createMemo(() => {
    const index = host.highlightedIndex()
    return { count: host.visible().size, persistedIndexes: index === undefined ? [] : [index] }
  })
}

export type TreeViewItemProps = TreeViewDivProps & {
  /** The node key. */
  readonly value: string
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
}

function Item(props: TreeViewItemProps) {
  const [local, rest] = splitProps(props, [
    "value",
    "href",
    "target",
    "rel",
    "current",
    "routerOptions",
    "render",
    "children",
  ])
  const host = useHost("Item")
  const key = createMemo(() => toKey(local.value))
  const [el, setEl] = createSignal<HTMLElement | null>(null)
  // Virtualized: a row highlighted by a key press mounts after the scroll. Focus left on the
  // tree, on the previous row, or dropped to the body when that row unmounted moves to it.
  const highlighted = createMemo(() => host.parts().item(key())["data-highlighted"] !== undefined)
  afterMount(() => {
    createEffect(
      on(highlighted, (isHighlighted) => {
        const node = el()
        if (!node || !isHighlighted || !host.focused()) return
        const doc = node.ownerDocument
        const active = doc.activeElement
        if (active === node) return
        const treeEl = node.closest('[role="tree"]')
        const dropped = active === null || active === doc.body
        const inTree =
          active !== null &&
          treeEl !== null &&
          (active === treeEl ||
            (active.getAttribute("role") === "treeitem" &&
              active.closest('[role="tree"]') === treeEl))
        if (dropped || inTree) node.focus({ preventScroll: true })
      }),
    )
  })
  const wiring = {
    onPointerEnter: () => host.setHovered(key()),
    onPointerLeave: () => host.setHovered(null),
    onPointerDown: (e: PointerEvent) => {
      host.setPressed(key())
      if (host.canMove(key())) host.startDrag(key(), e)
    },
    onPointerUp: () => host.setPressed(null),
    onPointerCancel: () => host.setPressed(null),
  }
  const merged = createMemo(() => {
    const own = normalizeProps(host.parts().item(key()))
    if (local.href === undefined) return mergeProps({ ...own, ref: setEl }, wiring, rest)
    const link = normalizeProps(
      linkProps(
        {
          href: local.href,
          target: local.target,
          rel: local.rel,
          current: local.current,
          routerOptions: local.routerOptions,
          tag: "a",
          origin: typeof location === "undefined" ? undefined : location.origin,
        },
        host.env,
      ),
    )
    // The tree's roving tabindex and role win over the link's.
    return mergeProps(link, { ...own, ref: setEl }, wiring, rest)
  })
  const children = () => local.children
  return (
    <ItemContext.Provider value={key}>
      {renderPart(local.render, merged, undefined, children, (p) => (
        <Show when={local.href !== undefined} fallback={<div {...p}>{children()}</div>}>
          <a {...p}>{children()}</a>
        </Show>
      ))}
    </ItemContext.Provider>
  )
}

/** The drop line of a pointer drag: render it beside `TreeView.Tree` in a positioned wrapper. */
function DropIndicator(props: TreeViewDivProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const host = useHost("DropIndicator")
  const merged = createMemo(() =>
    mergeProps(normalizeProps(host.parts().dropIndicator(host.dropAt())), rest),
  )
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

function ItemText(props: TreeViewSpanProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const key = useItemKey("ItemText")
  const host = useHost("ItemText")
  createEffect(() => {
    const k = key()
    host.mountText(k, true)
    onCleanup(() => host.mountText(k, false))
  })
  const merged = createMemo(() => mergeProps(normalizeProps(host.parts().itemText(key())), rest))
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

function ItemIndicator(props: TreeViewSpanProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const key = useItemKey("ItemIndicator")
  const host = useHost("ItemIndicator")
  const merged = createMemo(() =>
    mergeProps(normalizeProps(host.parts().itemIndicator(key())), rest),
  )
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

function ItemCheckbox(props: TreeViewSpanProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const key = useItemKey("ItemCheckbox")
  const host = useHost("ItemCheckbox")
  const merged = createMemo(() =>
    mergeProps(normalizeProps(host.parts().itemCheckbox(key())), rest),
  )
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

function Empty(props: TreeViewDivProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const host = useHost("Empty")
  const shown = createMemo(() => host.parts().isEmpty)
  createEffect(() => {
    if (!shown()) return
    host.mountEmpty(true)
    onCleanup(() => host.mountEmpty(false))
  })
  const merged = createMemo(() => mergeProps(normalizeProps(host.parts().empty()), rest))
  const children = () => local.children ?? host.messages().emptyLabel
  return (
    <Show when={shown()}>
      {renderPart(local.render, merged, undefined, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </Show>
  )
}

/** A hierarchy the user expands, navigates and selects or checks (openspec tree-view). */
/** The parts, by name: `tree-view.parts.ts` re-exports them as the `TreeView` namespace. */
export {
  DropIndicator,
  Empty,
  Item,
  ItemCheckbox,
  ItemIndicator,
  ItemText,
  Label,
  Loading,
  Root,
  Tree,
  useVisibleRows,
}
