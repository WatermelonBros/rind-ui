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
  type ComponentPropsWithRef,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from "react"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useLocale, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useRootId } from "../use-ids"

declare module "../provider" {
  interface RindMessageScopes {
    timeline: TimelineMessages
  }
}

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

/** What every part's `render` receives. */
export interface TimelineRenderState {
  readonly orientation: TimelineOrientation
  readonly align: TimelineAlign
  /** The Item's status (Item parts only). */
  readonly status?: TimelineStatus | undefined
}

type Api = ReturnType<typeof timelineConnect>

interface Ctx {
  readonly api: Api
  readonly state: TimelineRenderState
  readonly register: (index: number) => () => void
  readonly locale: string
}
const TimelineContext = createContext<Ctx | null>(null)
function useTimeline(part: string): Ctx {
  const ctx = useContext(TimelineContext)
  if (!ctx) throw new Error(`Timeline.${part} must be inside Timeline.Root`)
  return ctx
}
const ItemContext = createContext<TimelineItemInput | null>(null)
function useItem(part: string): TimelineItemInput {
  const item = useContext(ItemContext)
  if (!item) throw new Error(`Timeline.${part} must be inside Timeline.Item`)
  return item
}

export type TimelineRootProps = ComponentPropsWithRef<"ol"> & {
  /** The current event's index: earlier events are completed, later ones upcoming. */
  readonly current?: number
  readonly orientation?: TimelineOrientation
  /** Which side of the rail the content sits on; alternate switches per item. */
  readonly align?: TimelineAlign
  readonly messages?: MessageOverrides<TimelineMessages>
  /** Default: the provider's locale (Time's format). */
  readonly locale?: string
  readonly render?: RenderProp<TimelineRenderState>
}

function Root({
  current,
  orientation = "vertical",
  align = "start",
  messages: ownMessages,
  locale: ownLocale,
  render,
  id,
  children,
  ...rest
}: TimelineRootProps) {
  const instance = useRootId(id)
  const { locale } = useLocale(ownLocale)
  const messages = useMessages("timeline", timelineMessages, ownMessages)
  const [indexes, setIndexes] = useState<ReadonlySet<number>>(new Set())
  const register = useCallback((index: number) => {
    setIndexes((s) => (s.has(index) ? s : new Set(s).add(index)))
    return () =>
      setIndexes((s) => {
        const next = new Set(s)
        next.delete(index)
        return next
      })
  }, [])
  const api = timelineConnect({
    instance,
    orientation,
    align,
    current,
    count: indexes.size === 0 ? 0 : Math.max(...indexes) + 1,
    messages,
  })
  const state: TimelineRenderState = { orientation, align }
  const props = mergeProps(
    { ...normalizeProps(api.root()), ...(id === undefined ? {} : { id }) },
    rest,
  )
  return (
    <TimelineContext value={{ api, state, register, locale }}>
      {renderPart("ol", { ...props, children }, render, state)}
    </TimelineContext>
  )
}

type PartProps<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  /** Another element or a render function receiving the props and the state. */
  readonly render?: RenderProp<TimelineRenderState>
}

export type TimelineItemProps = PartProps<"li"> & {
  /** The event's index (0-based). */
  readonly index: number
  /** Its own status; wins over the Root's `current`. */
  readonly status?: TimelineStatus
}

function Item({ render, index, status, children, ...rest }: TimelineItemProps) {
  const ctx = useTimeline("Item")
  const { register } = ctx
  useIsoLayoutEffect(() => register(index), [register, index])
  const item: TimelineItemInput = { index, status }
  const state = { ...ctx.state, status: ctx.api.statusOf(item) }
  return (
    <ItemContext value={item}>
      {renderPart(
        "li",
        { ...mergeProps(normalizeProps(ctx.api.item(item)), rest), children },
        render,
        state,
      )}
    </ItemContext>
  )
}

/** An Item part: its props from connect, its status in the render state. */
function itemPart(
  name: "indicator" | "connector" | "content" | "description" | "opposite",
  tag: string,
) {
  return function ItemPart({ render, children, ...rest }: PartProps<"div">) {
    const ctx = useTimeline(name)
    const item = useItem(name)
    return renderPart(
      tag,
      { ...mergeProps(normalizeProps(ctx.api[name](item)), rest), children },
      render,
      { ...ctx.state, status: ctx.api.statusOf(item) },
    )
  }
}

function Title({ render, children, ...rest }: PartProps<"div">) {
  const ctx = useTimeline("Title")
  const item = useItem("Title")
  const text = ctx.api.statusText(item)
  return renderPart(
    "div",
    {
      ...mergeProps(normalizeProps(ctx.api.title(item)), rest),
      children: (
        <>
          {children}
          {text ? <span {...normalizeProps(ctx.api.statusProps())}>{text}</span> : null}
        </>
      ),
    },
    render,
    { ...ctx.state, status: ctx.api.statusOf(item) },
  )
}

export type TimelineTimeProps = Omit<PartProps<"time">, "dateTime"> & {
  /** The machine-readable date. */
  readonly dateTime: Date | string
}

function Time({ render, dateTime, children, ...rest }: TimelineTimeProps) {
  const ctx = useTimeline("Time")
  const iso = typeof dateTime === "string" ? dateTime : dateTime.toISOString()
  const shown =
    children ??
    new Intl.DateTimeFormat(ctx.locale, { dateStyle: "medium" }).format(
      typeof dateTime === "string" ? new Date(dateTime) : dateTime,
    )
  return renderPart(
    "time",
    { ...mergeProps(normalizeProps(ctx.api.time(iso)), rest), children: shown },
    render,
    ctx.state,
  )
}

export const Timeline = {
  Root,
  Item,
  Indicator: itemPart("indicator", "div"),
  Connector: itemPart("connector", "div"),
  Content: itemPart("content", "div"),
  Title,
  Description: itemPart("description", "div"),
  Time,
  Opposite: itemPart("opposite", "div"),
}
