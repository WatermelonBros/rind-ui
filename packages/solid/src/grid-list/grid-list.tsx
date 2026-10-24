/** @jsxImportSource solid-js */
// Grid List: the Root hosting the parts (design §3). Wiring only: the machine owns the
// highlight, the child position, selection and actions; connect owns every attribute and
// the key-ownership rule. Rows come from `items` data or from static Item parts.
import {
  announcerCapability,
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
  layoutCapability,
  toKey,
  warnForeignFocusables,
} from "@rind-ui/core"
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  For,
  type JSX,
  onCleanup,
  Show,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { afterMount } from "../lifecycle"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useCollectionItems, useRegisterItem } from "../use-collection-items"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare const process: { env: { NODE_ENV?: string } }

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
  /** The base the parts' ids derive from. Default: generated. */
  readonly id?: string | undefined
  /** The list's parts (Label, List). */
  readonly children?: JSX.Element
  readonly disabled?: boolean | undefined
  /** Disabled rows stay navigable, and a disabled list keeps its Tab stop. */
  readonly focusableWhenDisabled?: boolean | undefined
  /** "selection": a disabled row is not selectable but still acts. Default: "all". */
  readonly disabledBehavior?: "all" | "selection" | undefined
  /** Arrow keys wrap around. Default false. */
  readonly loop?: boolean | undefined
  /** Milliseconds of idle time that end a typeahead search. Default: 1000. */
  readonly typeaheadTimeout?: number | undefined
  readonly disallowTypeAhead?: boolean | undefined
  readonly childNavigation?: "arrow" | "tab" | undefined
  readonly layout?: GridListLayout | undefined
  readonly items?: readonly GridListItemData[] | undefined
  /** A collection built by the consumer (wins over `items` and Item parts). */
  readonly collection?: Collection<unknown> | undefined
  readonly onAction?: ((key: string, details: GridListActionDetails) => void) | undefined
  /** Presses select on pointer up (for lists inside popups). Default false. */
  readonly selectOnPressUp?: boolean | undefined
  /** Focus the selected row (else the first) on mount. */
  readonly autoFocus?: boolean | undefined
  readonly onLoadMore?: (() => void) | undefined
  /** Selection announcements and the checkboxes' names. */
  readonly messages?: Partial<GridListMessages> | undefined
}

type Selection =
  | { readonly selectionMode?: "none" }
  | {
      readonly selectionMode: "single"
      readonly selectionBehavior?: "toggle" | "replace"
      readonly value?: string | null
      readonly defaultValue?: string | null
      readonly onValueChange?: (value: string | null, details: GridListChangeDetails) => void
      /** No user action leaves the selection empty. */
      readonly disallowEmptySelection?: boolean
    }
  | {
      readonly selectionMode: "multiple"
      readonly selectionBehavior?: "toggle" | "replace"
      readonly value?: readonly string[]
      readonly defaultValue?: readonly string[]
      readonly onValueChange?: (value: readonly string[], details: GridListChangeDetails) => void
      /** No user action leaves the selection empty. */
      readonly disallowEmptySelection?: boolean
    }

export type GridListRootProps = Common & Selection

interface Host {
  readonly parts: Accessor<GridListParts>
  readonly collection: Accessor<Collection<unknown>>
  readonly registry: ReturnType<typeof useCollectionItems>["registry"] | null
  readonly mountLabel: (on: boolean) => void
  readonly mountDescription: (key: CollectionKey, on: boolean) => void
  readonly mountLink: (key: CollectionKey, href: string | null) => void
  readonly mountCheckbox: (key: CollectionKey, on: boolean) => void
  readonly mountRowAction: (
    key: CollectionKey,
    fn: ((details: GridListActionDetails) => void) | null,
  ) => void
  readonly hover: (key: CollectionKey | null) => void
  readonly press: (key: CollectionKey | null) => void
  readonly requestLoadMore: () => void
}

const HostContext = createContext<Host>()
const useHost = (part: string): Host => {
  const host = useContext(HostContext)
  if (!host) throw new Error(`GridList.${part} must be inside GridList.Root`)
  return host
}
const ItemContext = createContext<Accessor<CollectionKey>>()
const useItemKey = (part: string) => {
  const key = useContext(ItemContext)
  if (!key) throw new Error(`GridList.${part} must be inside GridList.Item`)
  return key
}
const ListContext = createContext(false)

type Own<A> = Omit<A, "children"> & {
  /** Another element: a function receiving the props to spread. */
  readonly render?: RenderProp<undefined> | undefined
  readonly children?: JSX.Element
}

function Root(all: GridListRootProps) {
  const p = all as Record<string, unknown> & Common
  const env = useEnvironment(announcerCapability, layoutCapability)
  const instance = useRootId(() => p.id)
  const { collection: registered, registry } = useCollectionItems()
  const data = createMemo(() => (p.items ? fromData(p.items) : null))
  const collection = createMemo(() => p.collection ?? data() ?? registered() ?? EMPTY)
  const ids = createMemo(() => gridListIds(instance()))
  const disabled = () => p.disabled === true
  const selectionMode = () =>
    (p["selectionMode"] as "single" | "multiple" | "none" | undefined) ?? "none"
  const selectionBehavior = () =>
    (p["selectionBehavior"] as "toggle" | "replace" | undefined) ?? "toggle"
  const [staticLinks, setStaticLinks] = createSignal<ReadonlyMap<CollectionKey, string>>(new Map())
  const links = createMemo(() => {
    const out = new Map(staticLinks())
    for (const i of p.items ?? []) if (i.href !== undefined) out.set(toKey(i.key), i.href)
    return out
  })
  const [checkboxes, setCheckboxes] = createSignal<ReadonlySet<CollectionKey>>(new Set())
  // Per-row actions (Item `onAction`): any of them makes the list actionable.
  const rowActions = new Map<CollectionKey, (details: GridListActionDetails) => void>()
  // Bumped whenever a row gains or loses its action (keys can swap at the same count).
  const [rowActionVersion, setRowActionVersion] = createSignal(0)
  const mountRowAction = (
    key: CollectionKey,
    fn: ((details: GridListActionDetails) => void) | null,
  ) => {
    const had = rowActions.has(key)
    if (fn) rowActions.set(key, fn)
    else rowActions.delete(key)
    if (had !== (fn !== null)) setRowActionVersion((n) => n + 1)
  }
  const actionable = () => {
    rowActionVersion()
    return p.onAction !== undefined || rowActions.size > 0
  }
  // Only the Item actions: the rows that have one (the Root's acts on every row).
  const actionRows = createMemo(() => {
    rowActionVersion()
    return p.onAction ? undefined : new Set(rowActions.keys())
  })
  const { view, service } = useMachine(
    gridListMachine,
    () => ({
      collection: collection(),
      ids: ids(),
      strategy: "roving" as const,
      selectionMode: selectionMode(),
      selectionBehavior: selectionBehavior(),
      disallowEmptySelection: p["disallowEmptySelection"] as boolean | undefined,
      disabledBehavior: p.disabledBehavior,
      focusableWhenDisabled: p.focusableWhenDisabled,
      disabled: disabled(),
      loop: p.loop ?? false,
      typeaheadTimeout: p.typeaheadTimeout,
      checkboxes: checkboxes(),
      messages: p.messages,
      ...("value" in all ? { value: p["value"] as GridListValue } : {}),
      defaultValue:
        (p["defaultValue"] as GridListValue | undefined) ??
        (selectionMode() === "multiple" ? [] : null),
      onValueChange: (v: GridListValue, details: { event: unknown }) => {
        const e = details.event as { type: string; key?: string }
        ;(p["onValueChange"] as ((v: unknown, d: unknown) => void) | undefined)?.(v, {
          reason: e.type,
          key: e.key,
        })
      },
      actionRows: actionRows(),
      onAction: actionable()
        ? (key: string, d: GridListActionDetails) => {
            rowActions.get(toKey(key))?.(d)
            p.onAction?.(key, d)
          }
        : undefined,
    }),
    env,
  )
  // autoFocus: the selected row, else the first (the machine's tab stop), once rows exist.
  afterMount(() => {
    let autoFocused = false
    createEffect(() => {
      if (!p.autoFocus || autoFocused || collection().size === 0) return
      autoFocused = true
      untrack(() => service.send({ type: "FOCUS", modality: env.modality.modality() }))
    })
  })
  const [label, setLabel] = createSignal(false)
  const [descriptions, setDescriptions] = createSignal<ReadonlySet<CollectionKey>>(new Set())
  const mountDescription = (key: CollectionKey, on: boolean) =>
    setDescriptions((m) => {
      if (m.has(key) === on) return m
      const next = new Set(m)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })
  const mountLink = (key: CollectionKey, href: string | null) =>
    setStaticLinks((m) => {
      if ((m.get(key) ?? null) === href) return m
      const next = new Map(m)
      if (href === null) next.delete(key)
      else next.set(key, href)
      return next
    })
  const mountCheckbox = (key: CollectionKey, on: boolean) =>
    setCheckboxes((m) => {
      if (m.has(key) === on) return m
      const next = new Set(m)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })
  const [hovered, setHovered] = createSignal<CollectionKey | null>(null)
  const [pressed, setPressed] = createSignal<CollectionKey | null>(null)
  const focused = () => view().matches("focused")
  const modality = useModality(env.modality, focused)
  let loadedFor: Collection<unknown> | null = null
  const parts = createMemo(() =>
    gridListConnect(
      {
        instance: instance(),
        collection: collection(),
        context: view().context,
        selection: gridSelectionOf(view().values.value as GridListValue),
        selectionMode: selectionMode(),
        selectionBehavior: selectionBehavior(),
        childNavigation: p.childNavigation ?? "arrow",
        layout: p.layout ?? "stack",
        actions: (key: CollectionKey) => {
          const rows = actionRows()
          return actionable() && (rows === undefined || rows.has(key))
        },
        selectOnPressUp: p.selectOnPressUp === true,
        links: links(),
        disabled: disabled(),
        focusableWhenDisabled: p.focusableWhenDisabled,
        disabledBehavior: p.disabledBehavior,
        disallowTypeAhead: p.disallowTypeAhead ?? false,
        pending: !p.collection && !data() && registered() === null,
        focused: focused(),
        modality: modality(),
        hoveredKey: hovered(),
        pressedKey: pressed(),
        typingAhead: () => {
          const t = service.getSnapshot().context.typeahead
          return t.buffer !== "" && env.clock.now() - t.at <= (p.typeaheadTimeout ?? 1000)
        },
        mounted: { label: label(), description: (key: CollectionKey) => descriptions().has(key) },
        messages: p.messages,
        send: service.send,
      },
      env,
    ),
  )
  const host: Host = {
    parts,
    collection,
    registry: p.collection || p.items ? null : registry,
    mountLabel: setLabel,
    mountDescription,
    mountLink,
    mountCheckbox,
    mountRowAction,
    hover: setHovered,
    press: setPressed,
    requestLoadMore: () => {
      if (loadedFor === collection()) return
      loadedFor = collection()
      p.onLoadMore?.()
    },
  }
  return <HostContext.Provider value={host}>{p.children}</HostContext.Provider>
}

export type GridListSpanProps = Own<JSX.HTMLAttributes<HTMLSpanElement>>
export type GridListDivProps = Own<JSX.HTMLAttributes<HTMLDivElement>>

function Label(props: GridListSpanProps) {
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

function List(props: GridListDivProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const host = useHost("List")
  const env = useEnvironment()
  // The modality is tracked from mount: the first press on a row is seen as a pointer press.
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const [el, setEl] = createSignal<HTMLElement | null>(null)
  // After the re-render a Label's registration causes, not on the first commit.
  afterMount(() => {
    const node = el()
    if (process.env.NODE_ENV === "production" || !node) return
    queueMicrotask(() => {
      if (!node.isConnected) return
      if (!node.hasAttribute("aria-label") && !node.hasAttribute("aria-labelledby")) {
        console.warn(
          "[rind-ui] GridList: the list has no accessible name; render a Label or pass aria-label / aria-labelledby.",
        )
      }
    })
  })
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps(
          host.parts().list({
            "aria-label": rest["aria-label"],
            "aria-labelledby": rest["aria-labelledby"],
          }),
        ),
        ref: setEl,
      },
      rest,
    ),
  )
  const children = () => <ListContext.Provider value={true}>{local.children}</ListContext.Provider>
  return renderPart(local.render, merged, undefined, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

export type GridListItemProps = Own<Omit<JSX.HTMLAttributes<HTMLDivElement>, "onAction">> & {
  /** The row key. */
  readonly value: string
  /** The row's text for typeahead and announcements. Default: its ItemText's text. */
  readonly textValue?: string | undefined
  /** Disables this row: it cannot be selected and, unless the Root's `disabledBehavior` is `"selection"`, it does not act. */
  readonly disabled?: boolean | undefined
  /** A link row: Enter and a press follow it (role stays `row`). */
  readonly href?: string | undefined
  /** Marks the row current (`aria-current`, `data-current`), e.g. a link row for the current page. */
  readonly current?: GridListItemOptions["current"] | undefined
  /** This row's action (with the Root's `onAction`, both run). */
  readonly onAction?: ((details: GridListActionDetails) => void) | undefined
}

function Item(props: GridListItemProps) {
  const [local, rest] = splitProps(props, [
    "value",
    "textValue",
    "disabled",
    "href",
    "current",
    "onAction",
    "render",
    "children",
  ])
  const host = useHost("Item")
  const key = createMemo(() => toKey(local.value))
  createEffect(() => {
    if (local.onAction === undefined) return
    const k = key()
    host.mountRowAction(k, (d) => local.onAction?.(d))
    onCleanup(() => host.mountRowAction(k, null))
  })
  const [el, setEl] = createSignal<HTMLElement | null>(null)
  // The row's text is its ItemText, not its controls' labels (typeahead, announcements).
  const [ownText, setOwnText] = createSignal<string | undefined>(undefined)
  afterMount(() => {
    const node = el()
    if (!node) return
    // Development: a focusable the grid cannot reach (not an ItemControl) is named.
    warnForeignFocusables(node, "GridList")
    const read = () =>
      setOwnText(
        node.querySelector('[data-scope="grid-list"][data-part="item-text"]')?.textContent?.trim(),
      )
    read()
    const observer = new MutationObserver(read)
    observer.observe(node, { childList: true, characterData: true, subtree: true })
    onCleanup(() => observer.disconnect())
  })
  useRegisterItem(
    host.registry,
    () => ({ key: local.value, textValue: local.textValue ?? ownText(), disabled: local.disabled }),
    el,
  )
  createEffect(() => {
    const href = local.href
    if (href === undefined) return
    const k = key()
    host.mountLink(k, href)
    onCleanup(() => host.mountLink(k, null))
  })
  const merged = createMemo(() =>
    mergeProps(
      {
        // Connect's own pointer-down (the press commit) runs with the pressed-state tracking.
        ...joinHandlers(
          normalizeProps(
            host.parts().item(key(), {
              "aria-label": rest["aria-label"],
              "aria-labelledby": rest["aria-labelledby"],
              current: local.current,
            }),
          ),
          {
            onPointerEnter: () => host.hover(key()),
            onPointerLeave: () => host.hover(null),
            onPointerDown: () => host.press(key()),
            onPointerUp: () => host.press(null),
            onPointerCancel: () => host.press(null),
          },
        ),
        ref: setEl,
      },
      rest,
    ),
  )
  const children = () => <div {...normalizeProps(host.parts().itemCell())}>{local.children}</div>
  return (
    <ItemContext.Provider value={key}>
      {renderPart(local.render, merged, undefined, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </ItemContext.Provider>
  )
}

function ItemText(props: GridListSpanProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const host = useHost("ItemText")
  const key = useItemKey("ItemText")
  const merged = createMemo(() => mergeProps(normalizeProps(host.parts().itemText(key())), rest))
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

function ItemDescription(props: GridListSpanProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const host = useHost("ItemDescription")
  const key = useItemKey("ItemDescription")
  createEffect(() => {
    const k = key()
    host.mountDescription(k, true)
    onCleanup(() => host.mountDescription(k, false))
  })
  const merged = createMemo(() =>
    mergeProps(normalizeProps(host.parts().itemDescription(key())), rest),
  )
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

export type GridListCheckboxProps = Omit<
  Own<JSX.InputHTMLAttributes<HTMLInputElement>>,
  "children"
> & {
  /** The select-all checkbox (outside the rows, multiple mode) instead of a row's. */
  readonly all?: boolean | undefined
}

/**
 * The row's selection checkbox; with `all` (outside the rows, multiple mode) the select-all
 * checkbox: checked, mixed or unchecked from the selection.
 */
function ItemCheckbox(props: GridListCheckboxProps) {
  const [local, rest] = splitProps(props, ["all"])
  return (
    <Show when={local.all} fallback={<RowCheckbox {...rest} />}>
      <SelectAllCheckbox {...rest} />
    </Show>
  )
}

function SelectAllCheckbox(props: Omit<GridListCheckboxProps, "all">) {
  const [local, rest] = splitProps(props, ["render"])
  const host = useHost("ItemCheckbox")
  const [el, setEl] = createSignal<HTMLInputElement | null>(null)
  const own = createMemo(
    () => normalizeProps(host.parts().selectAllCheckbox()) as Record<string, unknown>,
  )
  // `indeterminate` is a DOM property, not an attribute.
  createEffect(() => {
    const node = el()
    if (node) node.indeterminate = own()["aria-checked"] === "mixed"
  })
  const merged = createMemo(() => mergeProps({ ...own(), ref: setEl }, rest))
  return renderPart(
    local.render,
    merged,
    undefined,
    () => undefined,
    (p) => <input {...p} />,
  )
}

/** A control's focus and modality (its ring). */
function useControlFocus() {
  const env = useEnvironment()
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  return {
    state: () => ({ focused: focused(), modality: modality() }),
    handlers: { onFocusIn: () => setFocused(true), onFocusOut: () => setFocused(false) },
  }
}

function RowCheckbox(props: Omit<GridListCheckboxProps, "all">) {
  const [local, rest] = splitProps(props, ["render"])
  const host = useHost("ItemCheckbox")
  const key = useItemKey("ItemCheckbox")
  const focus = useControlFocus()
  createEffect(() => {
    const k = key()
    host.mountCheckbox(k, true)
    onCleanup(() => host.mountCheckbox(k, false))
  })
  const merged = createMemo(() =>
    mergeProps(
      { ...normalizeProps(host.parts().itemCheckbox(key(), focus.state())), ...focus.handlers },
      rest,
    ),
  )
  return renderPart(
    local.render,
    merged,
    undefined,
    () => undefined,
    (p) => <input {...p} />,
  )
}

export type GridListControlProps = Own<JSX.ButtonHTMLAttributes<HTMLButtonElement>>

/** A control of the row: render your button, link or field through it (`render`). */
function ItemControl(props: GridListControlProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const host = useHost("ItemControl")
  const key = useItemKey("ItemControl")
  const focus = useControlFocus()
  const merged = createMemo(() =>
    mergeProps(
      {
        // `type="button"` only for the default element: a rendered field keeps its own type.
        ...(local.render === undefined ? { type: "button" } : {}),
        ...normalizeProps(host.parts().itemControl(key(), focus.state())),
        ...focus.handlers,
      },
      rest,
    ),
  )
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

function Empty(props: GridListDivProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const host = useHost("Empty")
  const inList = useContext(ListContext)
  afterMount(() => {
    if (process.env.NODE_ENV !== "production" && !inList) {
      console.warn("[rind-ui] GridList: Empty is outside List; render it inside GridList.List.")
    }
  })
  const merged = createMemo(() => mergeProps(normalizeProps(host.parts().empty()), rest))
  const children = () => local.children
  return (
    <Show when={host.parts().isEmpty}>
      {renderPart(local.render, merged, undefined, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </Show>
  )
}

/** A `row` sentinel: `onLoadMore` once per collection when it scrolls into view. */
function LoadMore(props: GridListDivProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const host = useHost("LoadMore")
  const [el, setEl] = createSignal<HTMLElement | null>(null)
  afterMount(() => {
    const node = el()
    if (!node || typeof IntersectionObserver === "undefined") return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) host.requestLoadMore()
    })
    observer.observe(node)
    onCleanup(() => observer.disconnect())
  })
  const merged = createMemo(() =>
    mergeProps({ ...normalizeProps(host.parts().loadMore()), ref: setEl }, rest),
  )
  // The row's one cell (a row holds cells); the row itself is the focus target.
  const children = () => (
    // biome-ignore lint/a11y/useFocusableInteractive: a gridcell inside a focusable row
    // biome-ignore lint/a11y/useSemanticElements: an ARIA grid, not a table
    <div role="gridcell">{local.children}</div>
  )
  return renderPart(local.render, merged, undefined, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

export interface GridListItemsProps {
  /** Renders a row's content from its text and key. Default: an ItemText with the text. */
  readonly children?: (label: string, key: string) => JSX.Element
}

/** Data mode: every row of `items`, with its text. */
function Items(props: GridListItemsProps) {
  const host = useHost("Items")
  const nodes = createMemo(() => [...host.collection()].filter((n) => n.type === "item"))
  return (
    <For each={nodes()}>
      {(node) => (
        <Item value={node.key} textValue={node.textValue} disabled={node.disabled}>
          {props.children ? (
            props.children(node.textValue, node.key)
          ) : (
            <ItemText>{node.textValue}</ItemText>
          )}
        </Item>
      )}
    </For>
  )
}

/** Rows that are selected, acted on or followed, and may hold buttons, links and fields. */
/** The parts, by name: `grid-list.parts.ts` re-exports them as the `GridList` namespace. */
export {
  Empty,
  Item,
  ItemCheckbox,
  ItemControl,
  ItemDescription,
  Items,
  ItemText,
  Label,
  List,
  LoadMore,
  Root,
}
