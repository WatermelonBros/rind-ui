"use client"

import {
  type ChangeDetails,
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
  type ComponentPropsWithRef,
  createContext,
  type RefObject,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { joinHandlers } from "../join-handlers"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare module "../provider" {
  interface RindMessageScopes {
    "table-of-contents": TableOfContentsMessages
  }
}

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

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
  readonly api: Api
  readonly state: TableOfContentsRenderState
  readonly navigate: (id: string) => void
  readonly setTitled: (on: boolean) => void
  readonly setMarker: (marker: Marker) => void
}
const TocContext = createContext<Ctx | null>(null)
function useToc(part: string): Ctx {
  const ctx = useContext(TocContext)
  if (!ctx) throw new Error(`TableOfContents.${part} must be inside TableOfContents.Root`)
  return ctx
}
const ItemContext = createContext<TableOfContentsItem | null>(null)

export type TableOfContentsRootProps = ComponentPropsWithRef<"nav"> & {
  /** The sections, in document order (`collectHeadings(root)` reads them from headings). */
  readonly items: readonly TableOfContentsItem[]
  /** Controlled current section id. */
  readonly value?: string
  readonly defaultValue?: string
  /** `details.reason`: "scroll" (the reading position) or "navigate" (a followed link). */
  readonly onValueChange?: (value: string, details: TableOfContentsChangeDetails) => void
  /** The scrolling container (default: the window). */
  readonly scrollRoot?: RefObject<HTMLElement | null>
  /** Pixels hidden at the top by a sticky header (default 0). */
  readonly offset?: number
  /** The reading line, as a fraction of the scroll root below the offset (default 1/3). */
  readonly ratio?: number
  readonly messages?: MessageOverrides<TableOfContentsMessages>
  readonly render?: RenderProp<TableOfContentsRenderState>
}

function Root({
  items,
  value,
  defaultValue,
  onValueChange,
  scrollRoot,
  offset,
  ratio,
  messages: ownMessages,
  render,
  id,
  ref,
  children,
  ...rest
}: TableOfContentsRootProps) {
  const env = useEnvironment()
  const instance = useRootId(id)
  const messages = useMessages("table-of-contents", tableOfContentsMessages, ownMessages)
  const [titled, setTitled] = useState(false)
  const [marker, setMarker] = useState<Marker>(null)
  const { view, send } = useMachine(
    tableOfContentsMachine,
    {
      id: instance,
      value,
      defaultValue,
      ...(onValueChange
        ? {
            onValueChange: (next: string, d: ChangeDetails<TableOfContentsEvent>) =>
              // Sound: every value-writing transition declares one of these reasons (machine).
              onValueChange(next, {
                reason: d.reason as unknown as TableOfContentsChangeReason,
                event: d.event,
              }),
          }
        : {}),
    },
    env,
  )
  const ids = useRef(items.map((i) => i.id))
  ids.current = items.map((i) => i.id)
  useEffect(
    () =>
      readingPosition(document, {
        ids: () => ids.current,
        scrollRoot: scrollRoot?.current ?? null,
        offset,
        ratio,
        onPosition: (p) => send({ type: "POSITION", current: p.current, visible: p.visible }),
        onUserScroll: () => send({ type: "USER.SCROLL" }),
      }),
    [send, scrollRoot, offset, ratio],
  )
  const current = view.values.value
  const api = tableOfContentsConnect({
    instance,
    value: current,
    visible: view.context.visible,
    titled,
    ids: { title: partId("table-of-contents", instance, "title") },
    marker,
    messages,
  })
  const state: TableOfContentsRenderState = { value: current }
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
  const props = mergeProps(
    { ...normalizeProps(api.root()), ref, ...(id === undefined ? {} : { id }) },
    rest,
  )
  return (
    <TocContext value={{ api, state, navigate, setTitled, setMarker }}>
      {renderPart("nav", { ...props, children }, render, state)}
    </TocContext>
  )
}

type PartProps<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  /** Another element or a render function receiving the props and the state. */
  readonly render?: RenderProp<TableOfContentsRenderState>
}

function Title({ render, children, ...rest }: PartProps<"h2">) {
  const ctx = useToc("Title")
  const { setTitled } = ctx
  useIsoLayoutEffect(() => {
    setTitled(true)
    return () => setTitled(false)
  }, [setTitled])
  return renderPart(
    "h2",
    { ...mergeProps(normalizeProps(ctx.api.title()), rest), children },
    render,
    ctx.state,
  )
}

function List({ render, ref, children, ...rest }: PartProps<"ol">) {
  const ctx = useToc("List")
  const el = useRef<HTMLOListElement | null>(null)
  const { setMarker } = ctx
  const current = ctx.state.value
  // The current link: the Indicator's box, and kept in view when the List scrolls (Starlight
  // #3617), by the List's own scrollTop only (scrollIntoView would move the page too).
  useIsoLayoutEffect(() => {
    const list = el.current
    const link = list?.querySelector<HTMLElement>('[aria-current="location"]')
    if (!list || !link) {
      setMarker(null)
      return
    }
    const box = list.getBoundingClientRect()
    const own = link.getBoundingClientRect()
    const top = own.top - box.top + list.scrollTop
    setMarker({ top, height: own.height })
    if (list.scrollHeight > list.clientHeight) {
      if (top < list.scrollTop) list.scrollTop = top
      else if (top + own.height > list.scrollTop + list.clientHeight) {
        list.scrollTop = top + own.height - list.clientHeight
      }
    }
  }, [current, setMarker])
  return renderPart(
    "ol",
    {
      ...mergeProps(normalizeProps(ctx.api.list()), rest, { ref: composeRefs(el, ref) }),
      children,
    },
    render,
    ctx.state,
  )
}

export type TableOfContentsItemProps = PartProps<"li"> & {
  /** The section this item lists. */
  readonly item: TableOfContentsItem
}

function Item({ render, item, children, ...rest }: TableOfContentsItemProps) {
  const ctx = useToc("Item")
  return (
    <ItemContext value={item}>
      {renderPart(
        "li",
        { ...mergeProps(normalizeProps(ctx.api.item(item)), rest), children },
        render,
        ctx.state,
      )}
    </ItemContext>
  )
}

/** The link's own focus, tracked from mount so the focusing key is already known. */
function useFocusState() {
  const env = useEnvironment()
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  return {
    focus: { focused, modality },
    onFocus: (e: React.FocusEvent) => {
      if (e.target === e.currentTarget) setFocused(true)
    },
    onBlur: (e: React.FocusEvent) => {
      if (e.target === e.currentTarget) setFocused(false)
    },
  }
}

function Link({ render, children, ...rest }: PartProps<"a">) {
  const ctx = useToc("Link")
  const item = useContext(ItemContext)
  const { focus, onFocus, onBlur } = useFocusState()
  if (!item) throw new Error("TableOfContents.Link must be inside TableOfContents.Item")
  const props = mergeProps(
    joinHandlers(normalizeProps(ctx.api.link(item, focus)), {
      onFocus,
      onBlur,
      onClick: (e: React.MouseEvent) => {
        // New tab, new window, download: the browser's, not a jump on this page.
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
        ctx.navigate(item.id)
      },
    }),
    rest,
  )
  return renderPart("a", { ...props, children: children ?? item.label }, render, ctx.state)
}

function Indicator({ render, ...rest }: PartProps<"span">) {
  const ctx = useToc("Indicator")
  return renderPart(
    "span",
    mergeProps(normalizeProps(ctx.api.indicator()), rest),
    render,
    ctx.state,
  )
}

/** The parts, by name: `table-of-contents.parts.ts` re-exports them as the `TableOfContents` namespace. */
export { Indicator, Item, Link, List, Root, Title }
