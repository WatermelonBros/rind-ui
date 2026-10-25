/** @jsxImportSource solid-js */
import {
  type ChangeDetails,
  cssZoom,
  type MessageOverrides,
  partId,
  readingPosition,
  type TableOfContentsChangeReason,
  type TableOfContentsEvent,
  type TableOfContentsItem,
  type TableOfContentsMessages,
  tableOfContentsConnect,
  tableOfContentsMachine,
  tableOfContentsMessages,
} from "@rind-ui/core"
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { afterMount } from "../lifecycle"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useMessages } from "../provider"
import { type RenderProp, reactive, renderPart, resolveChildren } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare module "../provider" {
  interface RindMessageScopes {
    "table-of-contents": TableOfContentsMessages
  }
}

/** What every part's `render` receives. */
export interface TableOfContentsRenderState {
  /** The current section's id ("" for none). */
  readonly value: string
}

/** What `onValueChange` receives. */
export interface TableOfContentsChangeDetails {
  readonly reason: TableOfContentsChangeReason
  readonly event: ChangeDetails<TableOfContentsEvent>["event"]
}

type Api = ReturnType<typeof tableOfContentsConnect>
type Marker = { readonly top: number; readonly height: number } | null

interface Ctx {
  readonly api: Accessor<Api>
  readonly state: TableOfContentsRenderState
  readonly navigate: (id: string) => void
  readonly setTitled: (on: boolean) => void
  readonly setMarker: (marker: Marker) => void
}
const TocContext = createContext<Ctx>()
function useToc(part: string): Ctx {
  const ctx = useContext(TocContext)
  if (!ctx) throw new Error(`TableOfContents.${part} must be inside TableOfContents.Root`)
  return ctx
}
const ItemContext = createContext<Accessor<TableOfContentsItem>>()

export type TableOfContentsRootProps = Omit<JSX.HTMLAttributes<HTMLElement>, "children"> & {
  readonly children?: JSX.Element | ((state: TableOfContentsRenderState) => JSX.Element)
  /** The sections, in document order (`collectHeadings(root)` reads them from headings). */
  readonly items: readonly TableOfContentsItem[]
  /** Controlled current section id. */
  readonly value?: string | undefined
  readonly defaultValue?: string | undefined
  /** `details.reason`: "scroll" (the reading position) or "navigate" (a followed link). */
  readonly onValueChange?:
    | ((value: string, details: TableOfContentsChangeDetails) => void)
    | undefined
  /** The scrolling container (default: the window). */
  readonly scrollRoot?: HTMLElement | null | undefined
  /** Pixels hidden at the top by a sticky header (default 0). */
  readonly offset?: number | undefined
  /** The reading line, as a fraction of the scroll root below the offset (default 1/3). */
  readonly ratio?: number | undefined
  readonly messages?: MessageOverrides<TableOfContentsMessages> | undefined
  readonly render?: RenderProp<TableOfContentsRenderState> | undefined
}

function Root(props: TableOfContentsRootProps) {
  const [own, rest] = splitProps(props, [
    "items",
    "value",
    "defaultValue",
    "onValueChange",
    "scrollRoot",
    "offset",
    "ratio",
    "messages",
    "render",
    "children",
  ])
  const env = useEnvironment()
  const instance = useRootId(() => rest.id)
  const messages = useMessages("table-of-contents", tableOfContentsMessages, () => own.messages)
  const [titled, setTitled] = createSignal(false)
  const [marker, setMarkerState] = createSignal<Marker>(null, {
    equals: (a, b) => a?.top === b?.top && a?.height === b?.height,
  })
  const { view, send } = useMachine(
    tableOfContentsMachine,
    () => ({
      id: instance(),
      value: own.value,
      defaultValue: own.defaultValue,
      ...(own.onValueChange
        ? {
            onValueChange: (next: string, d: ChangeDetails<TableOfContentsEvent>) =>
              // Sound: every value-writing transition declares one of these reasons (machine).
              own.onValueChange?.(next, {
                reason: d.reason as unknown as TableOfContentsChangeReason,
                event: d.event,
              }),
          }
        : {}),
    }),
    env,
  )
  afterMount(() => {
    createEffect(() => {
      const scrollRoot = own.scrollRoot ?? null
      const offset = own.offset
      const ratio = own.ratio
      onCleanup(
        readingPosition(document, {
          ids: () => untrack(() => own.items.map((i) => i.id)),
          scrollRoot,
          offset,
          ratio,
          onPosition: (p) => send({ type: "POSITION", current: p.current, visible: p.visible }),
          onUserScroll: () => send({ type: "USER.SCROLL" }),
        }),
      )
    })
  })
  const api = createMemo(() =>
    tableOfContentsConnect({
      instance: instance(),
      value: view().values.value,
      visible: view().context.visible,
      titled: titled(),
      ids: { title: partId("table-of-contents", instance(), "title") },
      marker: marker(),
      messages: messages(),
    }),
  )
  const state = reactive<TableOfContentsRenderState>(() => ({ value: view().values.value }))
  const navigate = (target: string) => {
    // The activation's modality, read now: the focus moves after the browser's jump.
    const modality = env.modality.modality()
    send({ type: "NAVIGATE", id: target })
    if (modality !== "keyboard" && modality !== "virtual") return
    env.scheduler.requestAnimationFrame(() => {
      const heading = document.getElementById(target)
      if (!heading) return
      if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1")
      env.modality.markFocus(heading, "navigation", modality)
      // No scroll: the jump already placed the heading (and may still be scrolling smoothly).
      heading.focus({ preventScroll: true })
    })
  }
  const merged = createMemo(() =>
    mergeProps(
      { ...normalizeProps(api().root()), ...(rest.id === undefined ? {} : { id: rest.id }) },
      rest,
    ),
  )
  const children = () => resolveChildren(own.children, state)
  return (
    <TocContext.Provider value={{ api, state, navigate, setTitled, setMarker: setMarkerState }}>
      {renderPart(own.render, merged, state, children, (p) => (
        <nav {...p}>{children()}</nav>
      ))}
    </TocContext.Provider>
  )
}

type PartProps<A> = Omit<A, "children"> & {
  /** Another element: a function receiving the props to spread and the state. */
  readonly render?: RenderProp<TableOfContentsRenderState> | undefined
  readonly children?: JSX.Element | ((state: TableOfContentsRenderState) => JSX.Element)
}

export type TableOfContentsTitleProps = PartProps<JSX.HTMLAttributes<HTMLHeadingElement>>

function Title(props: TableOfContentsTitleProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useToc("Title")
  createEffect(() => {
    ctx.setTitled(true)
    onCleanup(() => ctx.setTitled(false))
  })
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().title()), rest))
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => <h2 {...p}>{children()}</h2>)
}

export type TableOfContentsListProps = PartProps<JSX.OlHTMLAttributes<HTMLOListElement>>

function List(props: TableOfContentsListProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useToc("List")
  const [el, setEl] = createSignal<Element | null>(null)
  // The current link: the Indicator's box, and kept in view when the List scrolls (Starlight
  // #3617), by the List's own scrollTop only (scrollIntoView would move the page too).
  afterMount(() => {
    createEffect(() => {
      ctx.state.value
      const list = el()
      const link = list?.querySelector<HTMLElement>('[aria-current="location"]')
      if (!(list instanceof HTMLElement) || !link) {
        ctx.setMarker(null)
        return
      }
      const box = list.getBoundingClientRect()
      const own = link.getBoundingClientRect()
      // rects are viewport pixels; the marker is placed in the list's own (zoomed) ones
      const z = cssZoom(list)
      const top = (own.top - box.top) / z + list.scrollTop
      const height = own.height / z
      ctx.setMarker({ top, height })
      if (list.scrollHeight > list.clientHeight) {
        if (top < list.scrollTop) list.scrollTop = top
        else if (top + height > list.scrollTop + list.clientHeight) {
          list.scrollTop = top + height - list.clientHeight
        }
      }
    })
  })
  const merged = createMemo(() =>
    mergeProps(normalizeProps(ctx.api().list()), rest, { ref: setEl }),
  )
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => <ol {...p}>{children()}</ol>)
}

export type TableOfContentsItemProps = PartProps<JSX.LiHTMLAttributes<HTMLLIElement>> & {
  /** The section this item lists. */
  readonly item: TableOfContentsItem
}

function Item(props: TableOfContentsItemProps) {
  const [local, rest] = splitProps(props, ["render", "item", "children"])
  const ctx = useToc("Item")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().item(local.item)), rest))
  const children = () => resolveChildren(local.children, ctx.state)
  return (
    <ItemContext.Provider value={() => local.item}>
      {renderPart(local.render, merged, ctx.state, children, (p) => (
        <li {...p}>{children()}</li>
      ))}
    </ItemContext.Provider>
  )
}

/** The link's own focus, tracked from mount so the focusing key is already known. */
function useFocusState() {
  const env = useEnvironment()
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  return {
    focus: () => ({ focused: focused(), modality: modality() }),
    onFocusIn: (e: FocusEvent) => {
      if (e.target === e.currentTarget) setFocused(true)
    },
    onFocusOut: (e: FocusEvent) => {
      if (e.target === e.currentTarget) setFocused(false)
    },
  }
}

export type TableOfContentsLinkProps = PartProps<JSX.AnchorHTMLAttributes<HTMLAnchorElement>>

function Link(props: TableOfContentsLinkProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useToc("Link")
  const item = useContext(ItemContext)
  const { focus, onFocusIn, onFocusOut } = useFocusState()
  if (!item) throw new Error("TableOfContents.Link must be inside TableOfContents.Item")
  const merged = createMemo(() =>
    mergeProps(
      joinHandlers(normalizeProps(ctx.api().link(item(), focus())), {
        onFocusIn,
        onFocusOut,
        onClick: (e: MouseEvent) => {
          // New tab, new window, download: the browser's, not a jump on this page.
          if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
          ctx.navigate(item().id)
        },
      }),
      rest,
    ),
  )
  const children = () => resolveChildren(local.children, ctx.state) ?? item().label
  return renderPart(local.render, merged, ctx.state, children, (p) => <a {...p}>{children()}</a>)
}

export type TableOfContentsIndicatorProps = PartProps<JSX.HTMLAttributes<HTMLSpanElement>>

function Indicator(props: TableOfContentsIndicatorProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useToc("Indicator")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().indicator()), rest))
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

/** The parts, by name: `table-of-contents.parts.ts` re-exports them as the `TableOfContents` namespace. */
export { Indicator, Item, Link, List, Root, Title }
