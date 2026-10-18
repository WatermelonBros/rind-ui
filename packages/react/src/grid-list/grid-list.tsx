// Grid List: the Root hosting the parts (design §3). Wiring only: the machine owns the
// highlight, the child position, selection and actions; connect owns every attribute and
// the key-ownership rule. Rows come from `items` data or from static Item parts.

import {
  type Collection,
  type CollectionKey,
  createListCollection,
  type GridListActionDetails,
  type GridListItemOptions,
  type GridListLayout,
  type GridListMessages,
  type GridListParts,
  type GridListValue,
  gridListConnect,
  gridListIds,
  gridListMachine,
  gridSelectionOf,
  toKey,
  warnForeignFocusables,
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createContext,
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
import {
  useCollectionIdentityWarning,
  useCollectionItems,
  useRegisterItem,
} from "../use-collection-items"
import { useRootId } from "../use-ids"
import { useMachine, useSelector } from "../use-machine"
import { useModality } from "../use-modality"

declare const process: { env: { NODE_ENV?: string } }

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

/** One row of a data-driven list. */
export interface GridListItemData {
  readonly key: string
  readonly label: string
  readonly disabled?: boolean
  /** A link row: Enter and a press follow it. */
  readonly href?: string
}

const fromData = (items: readonly GridListItemData[]) =>
  createListCollection({
    items,
    getKey: (i) => i.key,
    getText: (i) => i.label,
    isDisabled: (i) => i.disabled === true,
  })
const EMPTY = fromData([])

export interface GridListChangeDetails {
  readonly reason: string
  readonly key: string | undefined
}

type Common = {
  readonly id?: string
  readonly children?: ReactNode
  readonly disabled?: boolean
  readonly focusableWhenDisabled?: boolean
  readonly disabledBehavior?: "all" | "selection"
  /** Arrow keys wrap around. Default false. */
  readonly loop?: boolean
  readonly typeaheadTimeout?: number
  readonly disallowTypeAhead?: boolean
  readonly childNavigation?: "arrow" | "tab"
  readonly layout?: GridListLayout
  readonly items?: readonly GridListItemData[]
  readonly collection?: Collection<unknown>
  readonly onAction?: (key: string, details: GridListActionDetails) => void
  readonly onLoadMore?: () => void
  readonly messages?: Partial<GridListMessages>
}

type Selection =
  | { readonly selectionMode?: "none" }
  | {
      readonly selectionMode: "single"
      readonly selectionBehavior?: "toggle" | "replace"
      readonly value?: string | null
      readonly defaultValue?: string | null
      readonly onValueChange?: (value: string | null, details: GridListChangeDetails) => void
      readonly disallowEmptySelection?: boolean
    }
  | {
      readonly selectionMode: "multiple"
      readonly selectionBehavior?: "toggle" | "replace"
      readonly value?: readonly string[]
      readonly defaultValue?: readonly string[]
      readonly onValueChange?: (value: readonly string[], details: GridListChangeDetails) => void
      readonly disallowEmptySelection?: boolean
    }

export type GridListRootProps = Common & Selection

interface Host {
  readonly parts: GridListParts
  readonly collection: Collection<unknown>
  readonly registry: ReturnType<typeof useCollectionItems>["registry"] | null
  readonly service: ReturnType<typeof useMachine<typeof gridListMachine>>["service"]
  readonly mountLabel: (on: boolean) => void
  readonly mountDescription: (key: CollectionKey, on: boolean) => void
  readonly mountLink: (key: CollectionKey, href: string | null) => void
  readonly mountCheckbox: (key: CollectionKey, on: boolean) => void
  readonly hover: (key: CollectionKey | null) => void
  readonly press: (key: CollectionKey | null) => void
  readonly requestLoadMore: () => void
}

const HostContext = createContext<Host | null>(null)
const useHost = (part: string): Host => {
  const host = useContext(HostContext)
  if (!host) throw new Error(`GridList.${part} must be inside GridList.Root`)
  return host
}
const ItemContext = createContext<CollectionKey | null>(null)
const useItemKey = (part: string) => {
  const key = useContext(ItemContext)
  if (key === null) throw new Error(`GridList.${part} must be inside GridList.Item`)
  return key
}
const ListContext = createContext(false)

type Own<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  readonly render?: RenderProp<undefined>
}

function Root(all: GridListRootProps) {
  const {
    id,
    items,
    collection: given,
    children,
    disabled = false,
    childNavigation = "arrow",
    layout = "stack",
    loop = false,
    disallowTypeAhead = false,
  } = all
  const p = all as Record<string, unknown>
  const env = useEnvironment()
  const instance = useRootId(id)
  const { collection: registered, registry } = useCollectionItems()
  const data = useMemo(() => (items ? fromData(items) : null), [items])
  const collection = given ?? data ?? registered ?? EMPTY
  useCollectionIdentityWarning(collection, "GridList")
  const ids = useMemo(() => gridListIds(instance), [instance])
  const selectionMode = (p["selectionMode"] as "single" | "multiple" | "none" | undefined) ?? "none"
  const selectionBehavior = (p["selectionBehavior"] as "toggle" | "replace" | undefined) ?? "toggle"
  const [staticLinks, setStaticLinks] = useState<ReadonlyMap<CollectionKey, string>>(new Map())
  const links = useMemo(() => {
    const out = new Map(staticLinks)
    for (const i of items ?? []) if (i.href !== undefined) out.set(toKey(i.key), i.href)
    return out
  }, [items, staticLinks])
  const [checkboxes, setCheckboxes] = useState<ReadonlySet<CollectionKey>>(new Set())
  const latest = useRef({
    onValueChange: p["onValueChange"] as ((v: unknown, d: unknown) => void) | undefined,
    onAction: all.onAction,
  })
  latest.current = {
    onValueChange: p["onValueChange"] as ((v: unknown, d: unknown) => void) | undefined,
    onAction: all.onAction,
  }
  const { service } = useMachine(gridListMachine, {
    collection,
    ids,
    strategy: "roving",
    selectionMode,
    selectionBehavior,
    disallowEmptySelection: p["disallowEmptySelection"] as boolean | undefined,
    disabledBehavior: all.disabledBehavior,
    focusableWhenDisabled: all.focusableWhenDisabled,
    disabled,
    loop,
    typeaheadTimeout: all.typeaheadTimeout,
    checkboxes,
    messages: all.messages,
    ...("value" in all ? { value: p["value"] as GridListValue } : {}),
    defaultValue:
      (p["defaultValue"] as GridListValue | undefined) ??
      (selectionMode === "multiple" ? [] : null),
    onValueChange: (v, details) => {
      const e = details.event as { type: string; key?: string }
      latest.current.onValueChange?.(v, { reason: e.type, key: e.key })
    },
    onAction: all.onAction ? (key, d) => latest.current.onAction?.(key, d) : undefined,
  })
  const view = service.view()
  const [label, setLabel] = useState(false)
  const [descriptions, setDescriptions] = useState<ReadonlySet<CollectionKey>>(new Set())
  const [mountDescription] = useState(
    () => (key: CollectionKey, on: boolean) =>
      setDescriptions((m) => {
        if (m.has(key) === on) return m
        const next = new Set(m)
        if (on) next.add(key)
        else next.delete(key)
        return next
      }),
  )
  const [mountLink] = useState(
    () => (key: CollectionKey, href: string | null) =>
      setStaticLinks((m) => {
        if ((m.get(key) ?? null) === href) return m
        const next = new Map(m)
        if (href === null) next.delete(key)
        else next.set(key, href)
        return next
      }),
  )
  const [mountCheckbox] = useState(
    () => (key: CollectionKey, on: boolean) =>
      setCheckboxes((m) => {
        if (m.has(key) === on) return m
        const next = new Set(m)
        if (on) next.add(key)
        else next.delete(key)
        return next
      }),
  )
  const [hovered, setHovered] = useState<CollectionKey | null>(null)
  const [pressed, setPressed] = useState<CollectionKey | null>(null)
  const focused = view.matches("focused")
  const modality = useModality(env.modality, focused)
  const loadedFor = useRef<Collection<unknown> | null>(null)
  const parts = gridListConnect(
    {
      instance,
      collection,
      context: view.context,
      selection: gridSelectionOf(view.values.value as GridListValue),
      selectionMode,
      selectionBehavior,
      childNavigation,
      layout,
      actions: all.onAction !== undefined,
      links,
      disabled,
      focusableWhenDisabled: all.focusableWhenDisabled,
      disabledBehavior: all.disabledBehavior,
      disallowTypeAhead,
      pending: !given && !data && registered === null,
      focused,
      modality,
      hoveredKey: hovered,
      pressedKey: pressed,
      typingAhead: () => {
        const t = service.getSnapshot().context.typeahead
        return t.buffer !== "" && env.clock.now() - t.at <= (all.typeaheadTimeout ?? 1000)
      },
      mounted: { label, description: (key) => descriptions.has(key) },
      messages: all.messages,
      send: service.send,
    },
    env,
  )
  const host: Host = {
    parts,
    collection,
    registry: given || data ? null : registry,
    service,
    mountLabel: setLabel,
    mountDescription,
    mountLink,
    mountCheckbox,
    hover: setHovered,
    press: setPressed,
    requestLoadMore: () => {
      if (loadedFor.current === collection) return
      loadedFor.current = collection
      all.onLoadMore?.()
    },
  }
  return <HostContext value={host}>{children}</HostContext>
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

function List({ render, children, ...rest }: Own<"div">) {
  const host = useHost("List")
  useSelector(host.service, (v) => v)
  const el = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const node = el.current
    if (process.env.NODE_ENV === "production" || !node) return
    if (!node.hasAttribute("aria-label") && !node.hasAttribute("aria-labelledby")) {
      console.warn(
        "[rind-ui] GridList: the list has no accessible name; render a Label or pass aria-label / aria-labelledby.",
      )
    }
  }, [])
  const naming = { "aria-label": rest["aria-label"], "aria-labelledby": rest["aria-labelledby"] }
  const props = mergeProps({ ...normalizeProps(host.parts.list(naming)), ref: el }, rest)
  return renderPart(
    "div",
    { ...props, children: <ListContext value={true}>{children}</ListContext> },
    render,
    undefined,
  )
}

function Item({
  value,
  textValue,
  disabled,
  href,
  current,
  render,
  children,
  ...rest
}: Own<"div"> & {
  /** The row key. */
  readonly value: string
  readonly textValue?: string | undefined
  readonly disabled?: boolean | undefined
  /** A link row: Enter and a press follow it (role stays `row`). */
  readonly href?: string | undefined
  readonly current?: GridListItemOptions["current"]
}) {
  const host = useHost("Item")
  const key = toKey(value)
  const ref = useRef<HTMLDivElement | null>(null)
  // The row's text is its ItemText, not its controls' labels (typeahead, announcements).
  const [ownText, setOwnText] = useState<string | undefined>(undefined)
  useIsoLayoutEffect(() => {
    const text = ref.current
      ?.querySelector('[data-scope="grid-list"][data-part="item-text"]')
      ?.textContent?.trim()
    if (text !== ownText) setOwnText(text)
  })
  useRegisterItem(host.registry, { key: value, textValue: textValue ?? ownText, disabled }, ref)
  const { mountLink, hover, press } = host
  useIsoLayoutEffect(() => {
    if (href === undefined) return
    mountLink(key, href)
    return () => mountLink(key, null)
  }, [mountLink, key, href])
  useEffect(() => {
    if (ref.current) warnForeignFocusables(ref.current, "GridList")
  })
  useSelector(host.service, (v) => v)
  const own = host.parts.item(key, {
    "aria-label": rest["aria-label"],
    "aria-labelledby": rest["aria-labelledby"],
    current,
  })
  const props = mergeProps(
    {
      ...normalizeProps(own),
      ref,
      onPointerEnter: () => hover(key),
      onPointerLeave: () => hover(null),
      onPointerDown: () => press(key),
      onPointerUp: () => press(null),
      onPointerCancel: () => press(null),
    },
    rest,
  )
  const cell = <div {...normalizeProps(host.parts.itemCell())}>{children}</div>
  return (
    <ItemContext value={key}>
      {renderPart("div", { ...props, children: cell }, render, undefined)}
    </ItemContext>
  )
}

function ItemText({ render, ...rest }: Own<"span">) {
  const host = useHost("ItemText")
  const key = useItemKey("ItemText")
  return renderPart(
    "span",
    mergeProps(normalizeProps(host.parts.itemText(key)), rest),
    render,
    undefined,
  )
}

function ItemDescription({ render, ...rest }: Own<"span">) {
  const host = useHost("ItemDescription")
  const key = useItemKey("ItemDescription")
  const { mountDescription } = host
  useIsoLayoutEffect(() => {
    mountDescription(key, true)
    return () => mountDescription(key, false)
  }, [mountDescription, key])
  return renderPart(
    "span",
    mergeProps(normalizeProps(host.parts.itemDescription(key)), rest),
    render,
    undefined,
  )
}

function ItemCheckbox({ render, ...rest }: Own<"input">) {
  const host = useHost("ItemCheckbox")
  const key = useItemKey("ItemCheckbox")
  const { mountCheckbox } = host
  useIsoLayoutEffect(() => {
    mountCheckbox(key, true)
    return () => mountCheckbox(key, false)
  }, [mountCheckbox, key])
  return renderPart(
    "input",
    mergeProps(normalizeProps(host.parts.itemCheckbox(key)), rest),
    render,
    undefined,
  )
}

/** A control of the row: render your button, link or field through it (`render`). */
function ItemControl({ render, ...rest }: Own<"button">) {
  const host = useHost("ItemControl")
  const key = useItemKey("ItemControl")
  return renderPart(
    "button",
    // `type="button"` only for the default element: a rendered field keeps its own type.
    mergeProps(
      {
        ...(render === undefined ? { type: "button" } : {}),
        ...normalizeProps(host.parts.itemControl(key)),
      },
      rest,
    ),
    render,
    undefined,
  )
}

function Empty({ render, ...rest }: Own<"div">) {
  const host = useHost("Empty")
  const inList = useContext(ListContext)
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" && !inList) {
      console.warn("[rind-ui] GridList: Empty is outside List; render it inside GridList.List.")
    }
  }, [inList])
  if (!host.parts.isEmpty) return null
  return renderPart("div", mergeProps(normalizeProps(host.parts.empty()), rest), render, undefined)
}

/** A `row` sentinel: `onLoadMore` once per collection when it scrolls into view. */
function LoadMore({ render, children, ...rest }: Own<"div">) {
  const host = useHost("LoadMore")
  const ref = useRef<HTMLDivElement | null>(null)
  const latest = useRef(host.requestLoadMore)
  latest.current = host.requestLoadMore
  useEffect(() => {
    const node = ref.current
    if (!node || typeof IntersectionObserver === "undefined") return
    // The nearest scroll container, else the viewport (never <html> as an explicit root).
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) latest.current()
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  const props = mergeProps({ ...normalizeProps(host.parts.loadMore()), ref }, rest)
  return renderPart(
    "div",
    { ...props, children: <div role="gridcell">{children}</div> },
    render,
    undefined,
  )
}

/** Data mode: every row of `items`, with its text. */
function Items({ children }: { readonly children?: (label: string, key: string) => ReactNode }) {
  const host = useHost("Items")
  const out: ReactNode[] = []
  for (const node of host.collection) {
    if (node.type !== "item") continue
    out.push(
      <Item key={node.key} value={node.key} textValue={node.textValue} disabled={node.disabled}>
        {children ? children(node.textValue, node.key) : <ItemText>{node.textValue}</ItemText>}
      </Item>,
    )
  }
  return out
}

/** Rows that are selected, acted on or followed, and may hold buttons, links and fields. */
export const GridList = {
  Root,
  Label,
  List,
  Item,
  ItemText,
  ItemDescription,
  ItemCheckbox,
  ItemControl,
  Empty,
  LoadMore,
  Items,
}
