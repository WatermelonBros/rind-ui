/** @jsxImportSource solid-js */
import {
  type MessageOverrides,
  type TimelineAlign,
  type TimelineItemInput,
  type TimelineMessages,
  type TimelineOrientation,
  type TimelineStatus,
  timelineConnect,
  timelineMessages,
} from "@rind-ui/core"
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  Show,
  splitProps,
  useContext,
} from "solid-js"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useLocale, useMessages } from "../provider"
import { type RenderProp, reactive, renderPart, resolveChildren } from "../render"
import { useRootId } from "../use-ids"

declare module "../provider" {
  interface RindMessageScopes {
    timeline: TimelineMessages
  }
}

/** What every part's `render` receives. */
export interface TimelineRenderState {
  readonly orientation: TimelineOrientation
  readonly align: TimelineAlign
  /** The Item's status (Item parts only). */
  readonly status?: TimelineStatus | undefined
}

type Api = ReturnType<typeof timelineConnect>

interface Ctx {
  readonly api: Accessor<Api>
  readonly state: Accessor<TimelineRenderState>
  readonly register: (index: number) => () => void
  readonly locale: Accessor<string>
}
const TimelineContext = createContext<Ctx>()
function useTimeline(part: string): Ctx {
  const ctx = useContext(TimelineContext)
  if (!ctx) throw new Error(`Timeline.${part} must be inside Timeline.Root`)
  return ctx
}
const ItemContext = createContext<Accessor<TimelineItemInput>>()
function useItem(part: string): Accessor<TimelineItemInput> {
  const item = useContext(ItemContext)
  if (!item) throw new Error(`Timeline.${part} must be inside Timeline.Item`)
  return item
}

export type TimelineRootProps = Omit<JSX.OlHTMLAttributes<HTMLOListElement>, "children"> & {
  readonly children?: JSX.Element | ((state: TimelineRenderState) => JSX.Element)
  /** The current event's index: earlier events are completed, later ones upcoming. */
  readonly current?: number | undefined
  readonly orientation?: TimelineOrientation | undefined
  /** Which side of the rail the content sits on; alternate switches per item. */
  readonly align?: TimelineAlign | undefined
  readonly messages?: MessageOverrides<TimelineMessages> | undefined
  /** Default: the provider's locale (Time's format). */
  readonly locale?: string | undefined
  readonly render?: RenderProp<TimelineRenderState> | undefined
}

function Root(props: TimelineRootProps) {
  const [own, rest] = splitProps(props, [
    "current",
    "orientation",
    "align",
    "messages",
    "locale",
    "render",
    "children",
  ])
  const instance = useRootId(() => rest.id)
  const locale = useLocale(() => own.locale)
  const messages = useMessages("timeline", timelineMessages, () => own.messages)
  const [indexes, setIndexes] = createSignal<ReadonlySet<number>>(new Set())
  const register = (index: number) => {
    setIndexes((s) => (s.has(index) ? s : new Set(s).add(index)))
    return () =>
      setIndexes((s) => {
        const next = new Set(s)
        next.delete(index)
        return next
      })
  }
  const orientation = () => own.orientation ?? "vertical"
  const align = () => own.align ?? "start"
  const api = createMemo(() =>
    timelineConnect({
      instance: instance(),
      orientation: orientation(),
      align: align(),
      current: own.current,
      count: indexes().size === 0 ? 0 : Math.max(...indexes()) + 1,
      messages: messages(),
    }),
  )
  const state = reactive<TimelineRenderState>(() => ({
    orientation: orientation(),
    align: align(),
  }))
  const merged = createMemo(() =>
    mergeProps(
      { ...normalizeProps(api().root()), ...(rest.id === undefined ? {} : { id: rest.id }) },
      rest,
    ),
  )
  const children = () => resolveChildren(own.children, state)
  return (
    <TimelineContext.Provider
      value={{ api, state: () => state, register, locale: () => locale().locale }}
    >
      {renderPart(own.render, merged, state, children, (p) => (
        <ol {...p}>{children()}</ol>
      ))}
    </TimelineContext.Provider>
  )
}

type PartProps<A> = Omit<A, "children"> & {
  /** Another element: a function receiving the props to spread and the state. */
  readonly render?: RenderProp<TimelineRenderState> | undefined
  readonly children?: JSX.Element | ((state: TimelineRenderState) => JSX.Element)
}

export type TimelineItemProps = PartProps<JSX.LiHTMLAttributes<HTMLLIElement>> & {
  /** The event's index (0-based). */
  readonly index: number
  /** Its own status; wins over the Root's `current`. */
  readonly status?: TimelineStatus | undefined
}

/** The render state of an Item part: the Root's plus the Item's status. */
function itemState(ctx: Ctx, item: Accessor<TimelineItemInput>) {
  return reactive<TimelineRenderState>(() => ({
    ...ctx.state(),
    status: ctx.api().statusOf(item()),
  }))
}

function Item(props: TimelineItemProps) {
  const [local, rest] = splitProps(props, ["render", "index", "status", "children"])
  const ctx = useTimeline("Item")
  createEffect(() => onCleanup(ctx.register(local.index)))
  const item = createMemo<TimelineItemInput>(() => ({ index: local.index, status: local.status }))
  const state = itemState(ctx, item)
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().item(item())), rest))
  const children = () => resolveChildren(local.children, state)
  return (
    <ItemContext.Provider value={item}>
      {renderPart(local.render, merged, state, children, (p) => (
        <li {...p}>{children()}</li>
      ))}
    </ItemContext.Provider>
  )
}

export type TimelinePartProps = PartProps<JSX.HTMLAttributes<HTMLDivElement>>

/** An Item part: its props from connect, its status in the render state. */
function itemPart(name: "indicator" | "connector" | "content" | "description" | "opposite") {
  return function ItemPart(props: TimelinePartProps) {
    const [local, rest] = splitProps(props, ["render", "children"])
    const ctx = useTimeline(name)
    const item = useItem(name)
    const state = itemState(ctx, item)
    const merged = createMemo(() => mergeProps(normalizeProps(ctx.api()[name](item())), rest))
    const children = () => resolveChildren(local.children, state)
    return renderPart(local.render, merged, state, children, (p) => <div {...p}>{children()}</div>)
  }
}

function Title(props: TimelinePartProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useTimeline("Title")
  const item = useItem("Title")
  const state = itemState(ctx, item)
  const text = () => ctx.api().statusText(item())
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().title(item())), rest))
  const children = () => (
    <>
      {resolveChildren(local.children, state)}
      <Show when={text()}>
        <span {...normalizeProps(ctx.api().statusProps())}>{text()}</span>
      </Show>
    </>
  )
  return renderPart(local.render, merged, state, children, (p) => <div {...p}>{children()}</div>)
}

export type TimelineTimeProps = Omit<
  PartProps<JSX.TimeHTMLAttributes<HTMLTimeElement>>,
  "dateTime"
> & {
  /** The machine-readable date. */
  readonly dateTime: Date | string
}

function Time(props: TimelineTimeProps) {
  const [local, rest] = splitProps(props, ["render", "dateTime", "children"])
  const ctx = useTimeline("Time")
  const state = reactive(() => ctx.state())
  const iso = () =>
    typeof local.dateTime === "string" ? local.dateTime : local.dateTime.toISOString()
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().time(iso())), rest))
  const children = () =>
    resolveChildren(local.children, state) ??
    new Intl.DateTimeFormat(ctx.locale(), { dateStyle: "medium" }).format(
      typeof local.dateTime === "string" ? new Date(local.dateTime) : local.dateTime,
    )
  return renderPart(local.render, merged, state, children, (p) => <time {...p}>{children()}</time>)
}

const Indicator = itemPart("indicator")
const Connector = itemPart("connector")
const Content = itemPart("content")
const Description = itemPart("description")
const Opposite = itemPart("opposite")

/** The parts, by name: `timeline.parts.ts` re-exports them as the `Timeline` namespace. */
export { Connector, Content, Description, Indicator, Item, Opposite, Root, Time, Title }
