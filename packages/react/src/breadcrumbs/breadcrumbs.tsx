"use client"

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
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { Link, type LinkProps, type LinkState } from "../link/link"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useCollectionItems, useRegisterItem } from "../use-collection-items"
import { useRootId } from "../use-ids"

declare module "../provider" {
  interface RindMessageScopes {
    breadcrumbs: BreadcrumbsMessages
  }
}

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

/** What an Item's Link reports up: where it goes and its text (the ellipsis menu's item). */
interface ItemMeta {
  readonly current?: boolean | undefined
  readonly href?: Href | undefined
  readonly routerOptions?: RouterOptions | undefined
  readonly text?: string | undefined
}

interface RootCtx {
  readonly instance: string
  readonly connect: ReturnType<typeof breadcrumbsConnect>
  readonly trail: BreadcrumbsTrail
  readonly items: readonly BreadcrumbsTrailItem[]
  readonly currentValue: BreadcrumbsCurrentValue
  readonly messages: BreadcrumbsMessages
  /** Null with the data-driven `items` prop: nothing registers. */
  readonly registry: ItemRegistry | null
  readonly setMeta: (key: string, meta: ItemMeta) => void
}
const RootContext = createContext<RootCtx | null>(null)
function useRoot(part: string): RootCtx {
  const ctx = useContext(RootContext)
  if (!ctx) throw new Error(`Breadcrumbs.${part} must be inside Breadcrumbs.Root`)
  return ctx
}

interface ItemCtx {
  readonly key: string
  readonly state: BreadcrumbsItemState
}
const ItemContext = createContext<ItemCtx | null>(null)
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

export type BreadcrumbsRootProps = ComponentPropsWithRef<"nav"> & {
  /** Collapse the middle items past this many. */
  readonly maxItems?: number
  /** Default 1. */
  readonly itemsBeforeCollapse?: number
  /** Default 1. */
  readonly itemsAfterCollapse?: number
  /** The current item's `aria-current`. Default `"page"`. */
  readonly currentValue?: BreadcrumbsCurrentValue
  /**
   * The trail as data: collapse is known while rendering (the server render collapses too).
   * Render one Item per entry, with the same `value`.
   */
  readonly items?: readonly BreadcrumbsTrailItem[]
  readonly messages?: MessageOverrides<BreadcrumbsMessages>
  readonly render?: RenderProp<BreadcrumbsState>
}

function Root({
  maxItems,
  itemsBeforeCollapse,
  itemsAfterCollapse,
  currentValue = "page",
  items: data,
  messages: ownMessages,
  render,
  id,
  ref,
  ...rest
}: BreadcrumbsRootProps) {
  const instance = useRootId(id)
  const messages = useMessages("breadcrumbs", breadcrumbsMessages, ownMessages)
  const { collection, registry } = useCollectionItems()
  const meta = useRef(new Map<string, ItemMeta>())
  const [, setVersion] = useState(0)
  const setMeta = useCallback((key: string, next: ItemMeta) => {
    if (sameMeta(meta.current.get(key), next)) return
    meta.current.set(key, next)
    setVersion((v) => v + 1)
  }, [])
  const items: readonly BreadcrumbsTrailItem[] =
    data ??
    Array.from({ length: collection?.size ?? 0 }, (_, i) => {
      const it = collection?.at(i)?.value
      const m = it ? meta.current.get(it.key) : undefined
      return {
        key: it?.key ?? "",
        current: m?.current,
        disabled: it?.disabled,
        href: m?.href,
        routerOptions: m?.routerOptions,
        textValue: m?.text ?? it?.textValue ?? "",
      }
    })
  const trail = deriveTrail({ items, maxItems, itemsBeforeCollapse, itemsAfterCollapse })
  const labelled = rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined
  const connect = breadcrumbsConnect({ instance, trail, labelled, label: messages.label })
  const el = useRef<HTMLElement | null>(null)
  useIsoLayoutEffect(() => {
    if (el.current) warnBreadcrumbsInPopup(el.current)
  }, [])
  const ctx: RootCtx = {
    instance,
    connect,
    trail,
    items,
    currentValue,
    messages,
    registry: data ? null : registry,
    setMeta,
  }
  const props = mergeProps(
    {
      ...normalizeProps(connect.root()),
      ...(id === undefined ? {} : { id }),
      ref: composeRefs(el, ref),
    },
    rest,
  )
  return (
    <RootContext value={ctx}>
      {renderPart("nav", props, render, { collapsed: trail.collapsed.length > 0 })}
    </RootContext>
  )
}

export type BreadcrumbsListProps = ComponentPropsWithRef<"ol"> & {
  readonly render?: RenderProp<BreadcrumbsState>
}

function List({ render, ...rest }: BreadcrumbsListProps) {
  const { connect, trail } = useRoot("List")
  const props = mergeProps(normalizeProps(connect.list()), rest)
  return renderPart("ol", props, render, { collapsed: trail.collapsed.length > 0 })
}

export type BreadcrumbsItemProps = Omit<ComponentPropsWithRef<"li">, "children" | "value"> & {
  /** The Item's key: stable across renders, so the trail keeps its DOM nodes. */
  readonly value: string
  /** `true` makes it current; `false` on the last Item opts out of the default. */
  readonly current?: boolean
  readonly disabled?: boolean
  /** Its text in the ellipsis menu; default its Link's text. */
  readonly textValue?: string
  /** Nodes, or a function of the Item's state (a non-link control sets `aria-current`). */
  readonly children?: ReactNode | ((state: BreadcrumbsItemState) => ReactNode)
  readonly render?: RenderProp<BreadcrumbsItemState>
}

function Item({
  value,
  current,
  disabled = false,
  textValue,
  children,
  render,
  ref,
  ...rest
}: BreadcrumbsItemProps) {
  const root = useRoot("Item")
  const el = useRef<HTMLElement | null>(null)
  useRegisterItem(root.registry, { key: value, textValue, disabled }, el)
  const state = breadcrumbsItemState(root.trail, value, disabled, root.currentValue)
  const { setMeta } = root
  const linkMeta = useRef<ItemMeta>({})
  // After the Link's effect (children run first): the Item's own `current` with its Link's.
  useIsoLayoutEffect(() => {
    setMeta(value, { ...linkMeta.current, current, text: textValue ?? linkMeta.current.text })
  })
  useIsoLayoutEffect(() => {
    if (state.current && el.current) warnCurrentWithoutAria(el.current)
  }, [state.current])
  const ctx: ItemCtx & { readonly linkMeta: typeof linkMeta } = { key: value, state, linkMeta }
  const props = mergeProps(
    {
      ...normalizeProps(root.connect.item(state)),
      ref: composeRefs(el, ref),
      children: typeof children === "function" ? children(state) : children,
    },
    rest,
  )
  return <ItemContext value={ctx}>{renderPart("li", props, render, state)}</ItemContext>
}

/** Link's props; `current` and `disabled` come from the Item. */
export type BreadcrumbsLinkProps = Omit<LinkProps, "current" | "disabled">

/**
 * The crumb's link (link-navigation), or, for the current item without `href`, its text in a
 * `<span aria-current tabindex="-1">` (design §3): selectable, focusable, never a link.
 */
function CrumbLink({ href, routerOptions, render, children, ref, ...rest }: BreadcrumbsLinkProps) {
  const root = useRoot("Link")
  const item = useItem("Link") as ItemCtx & { readonly linkMeta: { current: ItemMeta } }
  const el = useRef<HTMLElement | null>(null)
  useIsoLayoutEffect(() => {
    item.linkMeta.current = { href, routerOptions, text: el.current?.textContent?.trim() ?? "" }
  })
  const { state } = item
  const asText = state.current && href === undefined
  // A focused link that becomes the current text is a new element (an <a> becomes a <span>):
  // read the focus while the old element is still in the document, and give it back after
  // the commit (react-spectrum#2592, #5294).
  const hadFocus = useRef(false)
  if (typeof document !== "undefined") {
    hadFocus.current = el.current !== null && el.current === document.activeElement
  }
  const wasText = useRef(asText)
  useIsoLayoutEffect(() => {
    if (wasText.current !== asText && hadFocus.current) el.current?.focus()
    wasText.current = asText
  }, [asText])
  if (asText) {
    const props = mergeProps(
      { ...normalizeProps(root.connect.currentText(state)), ref: composeRefs(el, ref), children },
      rest,
    )
    const linkState: LinkState = {
      disabled: state.disabled,
      current: true,
      pressed: false,
      hovered: false,
      focusVisible: false,
    }
    return renderPart("span", props, render, linkState)
  }
  return (
    <Link
      {...rest}
      ref={composeRefs<HTMLAnchorElement>((node: HTMLElement | null) => {
        el.current = node
      }, ref)}
      {...(href === undefined ? {} : { href })}
      {...(routerOptions === undefined ? {} : { routerOptions })}
      disabled={state.disabled}
      {...(state.current ? { current: state.currentValue } : {})}
      data-scope="breadcrumbs"
      data-part="link"
      data-instance={root.instance}
      {...(render === undefined ? {} : { render })}
    >
      {children}
    </Link>
  )
}

export type BreadcrumbsSeparatorProps = ComponentPropsWithRef<"span"> & {
  readonly render?: RenderProp<BreadcrumbsItemState>
}

/** A glyph after the crumb, `aria-hidden`; no default content. */
function Separator({ render, ...rest }: BreadcrumbsSeparatorProps) {
  const root = useRoot("Separator")
  const { state } = useItem("Separator")
  const props = mergeProps(normalizeProps(root.connect.separator(state)), rest)
  return renderPart("span", props, render, state)
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

export type BreadcrumbsEllipsisProps = Omit<ComponentPropsWithRef<"li">, "children"> & {
  /** Usually a function: render a Menu (or Popover) whose trigger is named `label`. */
  readonly children?: ReactNode | ((state: BreadcrumbsEllipsisState) => ReactNode)
  readonly render?: RenderProp<BreadcrumbsEllipsisState>
}

/**
 * The collapsed items' place in the list, only while items are collapsed. Place it after the
 * first `itemsBeforeCollapse` Items.
 */
function Ellipsis({ children, render, ...rest }: BreadcrumbsEllipsisProps) {
  const root = useRoot("Ellipsis")
  const count = root.trail.collapsed.length
  const label = root.messages.showCollapsed(count)
  const own = root.connect.ellipsis(label)
  if (!own) return null
  const state: BreadcrumbsEllipsisState = {
    items: root.trail.collapsed.flatMap((key) => {
      const it = root.items.find((i) => i.key === key)
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
    label,
    count,
  }
  const props = mergeProps(
    {
      ...normalizeProps(own),
      children: typeof children === "function" ? children(state) : children,
    },
    rest,
  )
  return renderPart("li", props, render, state)
}

/** A navigation landmark with the trail to the current location (openspec breadcrumbs). */
export const Breadcrumbs = { Root, List, Item, Link: CrumbLink, Separator, Ellipsis }
