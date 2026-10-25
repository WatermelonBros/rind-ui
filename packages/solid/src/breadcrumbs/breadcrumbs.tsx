/** @jsxImportSource solid-js */
import {
  type BreadcrumbsCurrentValue,
  type BreadcrumbsItemState,
  type BreadcrumbsMessages,
  type BreadcrumbsTrail,
  type BreadcrumbsTrailItem,
  breadcrumbsConnect,
  breadcrumbsItemState,
  breadcrumbsMessages,
  deriveTrail,
  type Href,
  type ItemRegistry,
  type MessageOverrides,
  type RouterOptions,
  warnBreadcrumbsInPopup,
  warnCurrentWithoutAria,
} from "@rind-ui/core"
import {
  type Accessor,
  createComputed,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  on,
  Show,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { afterMount } from "../lifecycle"
import { Link, type LinkState } from "../link/link"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useMessages } from "../provider"
import { type RenderProp, reactive, renderPart, resolveChildren } from "../render"
import { useCollectionItems, useRegisterItem } from "../use-collection-items"
import { useRootId } from "../use-ids"

declare module "../provider" {
  interface RindMessageScopes {
    breadcrumbs: BreadcrumbsMessages
  }
}

/** What an Item's Link reports up: where it goes and its text (the ellipsis menu's item). */
interface ItemMeta {
  readonly current?: boolean | undefined
  readonly href?: Href | undefined
  readonly routerOptions?: RouterOptions | undefined
  readonly text?: string | undefined
}

interface RootCtx {
  readonly instance: Accessor<string>
  readonly connect: Accessor<ReturnType<typeof breadcrumbsConnect>>
  readonly trail: Accessor<BreadcrumbsTrail>
  readonly items: Accessor<readonly BreadcrumbsTrailItem[]>
  readonly currentValue: Accessor<BreadcrumbsCurrentValue>
  readonly messages: Accessor<BreadcrumbsMessages>
  /** Null with the data-driven `items` prop: nothing registers. */
  readonly registry: () => ItemRegistry | null
  readonly setMeta: (key: string, meta: ItemMeta) => void
}
const RootContext = createContext<RootCtx>()
function useRoot(part: string): RootCtx {
  const ctx = useContext(RootContext)
  if (!ctx) throw new Error(`Breadcrumbs.${part} must be inside Breadcrumbs.Root`)
  return ctx
}

interface ItemCtx {
  readonly key: Accessor<string>
  readonly state: Accessor<BreadcrumbsItemState>
  readonly setLinkMeta: (meta: ItemMeta) => void
}
const ItemContext = createContext<ItemCtx>()
function useItem(part: string): ItemCtx {
  const ctx = useContext(ItemContext)
  if (!ctx) throw new Error(`Breadcrumbs.${part} must be inside Breadcrumbs.Item`)
  return ctx
}

const sameMeta = (a: ItemMeta | undefined, b: ItemMeta) =>
  a !== undefined &&
  a.current === b.current &&
  a.href === b.href &&
  a.routerOptions === b.routerOptions &&
  a.text === b.text

export interface BreadcrumbsState {
  readonly collapsed: boolean
}

export type BreadcrumbsRootProps = Omit<JSX.HTMLAttributes<HTMLElement>, "children" | "id"> & {
  /** Collapse the middle items past this many. */
  readonly maxItems?: number | undefined
  /** Default 1. */
  readonly itemsBeforeCollapse?: number | undefined
  /** Default 1. */
  readonly itemsAfterCollapse?: number | undefined
  /** The current item's `aria-current`. Default `"page"`. */
  readonly currentValue?: BreadcrumbsCurrentValue | undefined
  /**
   * The trail as data: collapse is known while rendering (the server render collapses too).
   * Render one Item per entry, with the same `value`.
   */
  readonly items?: readonly BreadcrumbsTrailItem[] | undefined
  readonly messages?: MessageOverrides<BreadcrumbsMessages> | undefined
  readonly id?: string | undefined
  readonly render?: RenderProp<BreadcrumbsState> | undefined
  readonly children?: JSX.Element | ((state: BreadcrumbsState) => JSX.Element)
}

function Root(props: BreadcrumbsRootProps) {
  const [local, rest] = splitProps(props, [
    "maxItems",
    "itemsBeforeCollapse",
    "itemsAfterCollapse",
    "currentValue",
    "items",
    "messages",
    "id",
    "render",
    "children",
  ])
  const instance = useRootId(() => local.id)
  const messages = useMessages("breadcrumbs", breadcrumbsMessages, () => local.messages)
  const { collection, registry } = useCollectionItems()
  const meta = new Map<string, ItemMeta>()
  const [version, setVersion] = createSignal(0)
  const setMeta = (key: string, next: ItemMeta) => {
    if (sameMeta(meta.get(key), next)) return
    meta.set(key, next)
    setVersion((v) => v + 1)
  }
  const items = createMemo((): readonly BreadcrumbsTrailItem[] => {
    if (local.items) return local.items
    version()
    const c = collection()
    return Array.from({ length: c?.size ?? 0 }, (_, i) => {
      const it = c?.at(i)?.value
      const m = it ? meta.get(it.key) : undefined
      return {
        key: it?.key ?? "",
        current: m?.current,
        disabled: it?.disabled,
        href: m?.href,
        routerOptions: m?.routerOptions,
        textValue: m?.text ?? it?.textValue ?? "",
      }
    })
  })
  const trail = createMemo(() =>
    deriveTrail({
      items: items(),
      maxItems: local.maxItems,
      itemsBeforeCollapse: local.itemsBeforeCollapse,
      itemsAfterCollapse: local.itemsAfterCollapse,
    }),
  )
  const connect = createMemo(() =>
    breadcrumbsConnect({
      instance: instance(),
      trail: trail(),
      labelled: rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined,
      label: messages().label,
    }),
  )
  const [el, setEl] = createSignal<Element | null>(null)
  afterMount(() => {
    const node = el()
    if (node instanceof HTMLElement) warnBreadcrumbsInPopup(node)
  })
  const state = reactive<BreadcrumbsState>(() => ({ collapsed: trail().collapsed.length > 0 }))
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps(connect().root()),
        ...(local.id === undefined ? {} : { id: local.id }),
        ref: setEl,
      },
      rest,
    ),
  )
  const children = () => resolveChildren(local.children, state)
  return (
    <RootContext.Provider
      value={{
        instance,
        connect,
        trail,
        items,
        currentValue: () => local.currentValue ?? "page",
        messages,
        registry: () => (local.items ? null : registry),
        setMeta,
      }}
    >
      {renderPart(local.render, merged, state, children, (p) => (
        <nav {...p}>{children()}</nav>
      ))}
    </RootContext.Provider>
  )
}

export type BreadcrumbsListProps = Omit<JSX.HTMLAttributes<HTMLOListElement>, "children"> & {
  readonly render?: RenderProp<BreadcrumbsState> | undefined
  readonly children?: JSX.Element | ((state: BreadcrumbsState) => JSX.Element)
}

function List(props: BreadcrumbsListProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const root = useRoot("List")
  const state = reactive<BreadcrumbsState>(() => ({ collapsed: root.trail().collapsed.length > 0 }))
  const merged = createMemo(() => mergeProps(normalizeProps(root.connect().list()), rest))
  const children = () => resolveChildren(local.children, state)
  return renderPart(local.render, merged, state, children, (p) => <ol {...p}>{children()}</ol>)
}

export type BreadcrumbsItemProps = Omit<
  JSX.LiHTMLAttributes<HTMLLIElement>,
  "children" | "value"
> & {
  /** The Item's key: stable across updates, so the trail keeps its DOM nodes. */
  readonly value: string
  /** `true` makes it current; `false` on the last Item opts out of the default. */
  readonly current?: boolean | undefined
  readonly disabled?: boolean | undefined
  /** Its text in the ellipsis menu; default its Link's text. */
  readonly textValue?: string | undefined
  readonly render?: RenderProp<BreadcrumbsItemState> | undefined
  readonly children?: JSX.Element | ((state: BreadcrumbsItemState) => JSX.Element)
}

function Item(props: BreadcrumbsItemProps) {
  const [local, rest] = splitProps(props, [
    "value",
    "current",
    "disabled",
    "textValue",
    "render",
    "children",
  ])
  const root = useRoot("Item")
  const [el, setEl] = createSignal<Element | null>(null)
  // The registry is fixed by the Root's mode (data-driven or registered).
  useRegisterItem(
    untrack(root.registry),
    () => ({ key: local.value, textValue: local.textValue, disabled: local.disabled === true }),
    el,
  )
  const state = createMemo(() =>
    breadcrumbsItemState(root.trail(), local.value, local.disabled === true, root.currentValue()),
  )
  const [linkMeta, setLinkMeta] = createSignal<ItemMeta>({})
  // The Item's own `current` with its Link's.
  afterMount(() =>
    createEffect(() =>
      root.setMeta(local.value, {
        ...linkMeta(),
        current: local.current,
        text: local.textValue ?? linkMeta().text,
      }),
    ),
  )
  afterMount(() =>
    createEffect(() => {
      const node = el()
      if (state().current && node instanceof HTMLElement) {
        // Once the update that made it current reached the DOM (this runs in the same flush).
        queueMicrotask(() => {
          if (node.isConnected) warnCurrentWithoutAria(node)
        })
      }
    }),
  )
  const merged = createMemo(() =>
    mergeProps({ ...normalizeProps(root.connect().item(state())), ref: setEl }, rest),
  )
  const stateView = reactive<BreadcrumbsItemState>(state)
  const children = () => resolveChildren(local.children, stateView)
  return (
    <ItemContext.Provider value={{ key: () => local.value, state, setLinkMeta }}>
      {renderPart(local.render, merged, stateView, children, (p) => (
        <li {...p}>{children()}</li>
      ))}
    </ItemContext.Provider>
  )
}

export type BreadcrumbsLinkProps = Omit<
  JSX.AnchorHTMLAttributes<HTMLAnchorElement>,
  "children" | "href"
> & {
  readonly href?: Href | undefined
  readonly routerOptions?: RouterOptions | undefined
  readonly render?: RenderProp<LinkState> | undefined
  readonly children?: JSX.Element | ((state: LinkState) => JSX.Element)
}

/**
 * The crumb's link (link-navigation), or, for the current item without `href`, its text in a
 * `<span aria-current tabindex="-1">` (design §3): selectable, focusable, never a link.
 */
function CrumbLink(props: BreadcrumbsLinkProps) {
  const [local, rest] = splitProps(props, ["href", "routerOptions", "render", "children"])
  const root = useRoot("Link")
  const item = useItem("Link")
  const [el, setEl] = createSignal<Element | null>(null)
  const asText = createMemo(() => item.state().current && local.href === undefined)
  afterMount(() =>
    createEffect(() =>
      item.setLinkMeta({
        href: local.href,
        routerOptions: local.routerOptions,
        text: el()?.textContent?.trim() ?? "",
      }),
    ),
  )
  // A focused link that becomes the current text is a new element (an <a> becomes a <span>):
  // read the focus while the old element is still in the document, and give it back after
  // the update (react-spectrum#2592, #5294).
  let hadFocus = false
  createComputed(
    on(
      asText,
      () => {
        const node = untrack(el)
        hadFocus = node !== null && node === node.ownerDocument.activeElement
      },
      { defer: true },
    ),
  )
  afterMount(() =>
    createEffect(
      on(
        asText,
        () => {
          const node = el()
          if (hadFocus && node instanceof HTMLElement) node.focus()
          hadFocus = false
        },
        { defer: true },
      ),
    ),
  )
  const linkState = reactive<LinkState>(() => ({
    disabled: item.state().disabled,
    current: true,
    pressed: false,
    hovered: false,
    focusVisible: false,
  }))
  const textProps = createMemo(() =>
    mergeProps({ ...normalizeProps(root.connect().currentText(item.state())), ref: setEl }, rest),
  )
  const textChildren = () => resolveChildren(local.children, linkState)
  const linkProps = createMemo(() => ({
    ...rest,
    ref: setEl,
    ...(local.href === undefined ? {} : { href: local.href }),
    ...(local.routerOptions === undefined ? {} : { routerOptions: local.routerOptions }),
    disabled: item.state().disabled,
    ...(item.state().current ? { current: item.state().currentValue } : {}),
    "data-scope": "breadcrumbs",
    "data-part": "link",
    "data-instance": root.instance(),
  }))
  return (
    <Show
      when={asText()}
      fallback={
        <Link {...(linkProps() as object)} render={local.render}>
          {local.children as JSX.Element}
        </Link>
      }
    >
      {renderPart(local.render, textProps, linkState, textChildren, (p) => (
        <span {...p}>{textChildren()}</span>
      ))}
    </Show>
  )
}

export type BreadcrumbsSeparatorProps = Omit<JSX.HTMLAttributes<HTMLSpanElement>, "children"> & {
  readonly render?: RenderProp<BreadcrumbsItemState> | undefined
  readonly children?: JSX.Element | ((state: BreadcrumbsItemState) => JSX.Element)
}

/** A glyph after the crumb, `aria-hidden`; no default content. */
function Separator(props: BreadcrumbsSeparatorProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const root = useRoot("Separator")
  const item = useItem("Separator")
  const merged = createMemo(() =>
    mergeProps(normalizeProps(root.connect().separator(item.state())), rest),
  )
  const state = reactive<BreadcrumbsItemState>(item.state)
  const children = () => resolveChildren(local.children, state)
  return renderPart(local.render, merged, state, children, (p) => <span {...p}>{children()}</span>)
}

/** One collapsed item, for the ellipsis menu. */
export type BreadcrumbsCollapsedItem = Pick<
  BreadcrumbsTrailItem,
  "key" | "textValue" | "href" | "routerOptions" | "disabled"
>

export interface BreadcrumbsEllipsisState {
  readonly items: readonly BreadcrumbsCollapsedItem[]
  /** The trigger's accessible name: `messages.showCollapsed(count)`. */
  readonly label: string
  readonly count: number
}

export type BreadcrumbsEllipsisProps = Omit<JSX.HTMLAttributes<HTMLLIElement>, "children"> & {
  readonly render?: RenderProp<BreadcrumbsEllipsisState> | undefined
  readonly children?: JSX.Element | ((state: BreadcrumbsEllipsisState) => JSX.Element)
}

/**
 * The collapsed items' place in the list, only while items are collapsed. Place it after the
 * first `itemsBeforeCollapse` Items; its children usually render a Menu (or Popover) whose
 * trigger is named `label`.
 */
function Ellipsis(props: BreadcrumbsEllipsisProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const root = useRoot("Ellipsis")
  const label = () => root.messages().showCollapsed(root.trail().collapsed.length)
  const own = () => root.connect().ellipsis(label())
  const state = reactive<BreadcrumbsEllipsisState>(() => {
    const trail = root.trail()
    const items = root.items()
    return {
      items: trail.collapsed.flatMap((key) => {
        const it = items.find((i) => i.key === key)
        return it
          ? [
              {
                key: it.key,
                textValue: it.textValue,
                href: it.href,
                routerOptions: it.routerOptions,
                disabled: it.disabled,
              },
            ]
          : []
      }),
      label: label(),
      count: trail.collapsed.length,
    }
  })
  const merged = createMemo(() => mergeProps(normalizeProps(own() ?? {}), rest))
  const children = () => resolveChildren(local.children, state)
  return (
    <Show when={own()}>
      {renderPart(local.render, merged, state, children, (p) => (
        <li {...p}>{children()}</li>
      ))}
    </Show>
  )
}

/** The parts, by name: `breadcrumbs.parts.ts` re-exports them as the `Breadcrumbs` namespace. */
export { CrumbLink as Link, Ellipsis, Item, List, Root, Separator }
