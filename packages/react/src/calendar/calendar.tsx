"use client"

// Calendar parts: wiring only. The machine owns the value, the focused date and the visible
// range; connect every attribute and the key mapping; navigation is pure core logic.

import {
  announcerCapability,
  type CalendarCommitOnBlur,
  type CalendarDate,
  type CalendarMessages,
  type CalendarSelectionMode,
  type CalendarValue,
  type CalendarView,
  type CreateCalendar,
  calendarConnect,
  calendarKey,
  calendarMachine,
  calendarMessages,
  createCalendarDrag,
  type DateValue,
  type DayOfWeek,
  dateClockCapability,
  describeKey,
  display,
  focusSafely,
  initialCalendarFocus,
  isoOf,
  type MessageOverrides,
  type Modality,
  type MonthGrid,
  monthGrid,
  resolveCalendar,
  today as todayOf,
  todayZone,
  valuesOf,
  viewIn,
  visibleEnd,
  visuallyHiddenStyle,
  watchLeave,
  firstDayOfWeek as weekStart,
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { joinHandlers } from "../join-handlers"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { useHover, usePress } from "../use-press"

declare module "../provider" {
  interface RindMessageScopes {
    calendar: CalendarMessages
  }
}

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

export interface CalendarChangeDetails {
  /** A cell's press, a key, or the release of a drag selection. */
  readonly reason: "CELL.PRESS" | "KEY" | "DRAG"
  readonly modality: string | undefined
  cancel(): void
}

type Machine = ReturnType<typeof useMachine<typeof calendarMachine>>

interface Ctx {
  readonly view: Machine["view"]
  readonly send: Machine["send"]
  readonly api: ReturnType<typeof calendarConnect>
  readonly grid: (offset: number) => MonthGrid
  readonly instance: string
  /** Range mode: a press that dragged has already been handled. */
  readonly dragConsumes: (press: { readonly pointerType: string }) => boolean
}
const CalendarContext = createContext<Ctx | null>(null)
function useCalendar(part: string): Ctx {
  const ctx = useContext(CalendarContext)
  if (!ctx) throw new Error(`Calendar.${part} must be inside Calendar.Root`)
  return ctx
}
const GridContext = createContext<number>(0)

export type CalendarRootProps = Omit<
  ComponentPropsWithRef<"div">,
  "children" | "defaultValue" | "onChange" | "dir"
> & {
  /** The calendar's parts (header, grids). */
  readonly children?: ReactNode
  readonly value?: CalendarValue
  readonly defaultValue?: CalendarValue
  readonly onValueChange?: (value: CalendarValue, details: CalendarChangeDetails) => void
  readonly selectionMode?: CalendarSelectionMode
  readonly focusedValue?: DateValue
  readonly defaultFocusedValue?: DateValue
  readonly onFocusChange?: (date: CalendarDate) => void
  /** The visible months changed. */
  readonly onVisibleRangeChange?: (range: { start: CalendarDate; end: CalendarDate }) => void
  readonly minValue?: DateValue | null
  readonly maxValue?: DateValue | null
  /** `anchor`: in range mode, the first end while a range is being selected, else null. */
  readonly isDateUnavailable?: (
    date: CalendarDate,
    details: { readonly anchor: CalendarDate | null },
  ) => boolean
  /** Range mode: the first end while a range is being selected (controllable). */
  readonly anchor?: CalendarDate | null
  /** Uncontrolled anchor. */
  readonly defaultAnchor?: CalendarDate | null
  /** The anchor was set or cleared. */
  readonly onAnchorChange?: (anchor: CalendarDate | null) => void
  /** Range mode: length bounds in days, both ends included. */
  readonly minRangeLength?: number
  /** Range mode: longest range in days (ends included); farther ends are disabled. */
  readonly maxRangeLength?: number
  /** Range mode: a range may contain unavailable dates (default false). */
  readonly allowsNonContiguousRanges?: boolean
  /** Range mode: what leaving while anchored does (default "reset"). */
  readonly commitOnBlur?: CalendarCommitOnBlur
  /**
   * Range mode, touch: how long (ms) a touch is held still before it starts a drag selection
   * (default 200). A shorter touch is a tap; one that moves first scrolls.
   */
  readonly dragDelay?: number
  /** Months shown side by side. Default: 1. */
  readonly visibleMonths?: number
  /** A trigger pages by all visible months, or by one. Default: "visible". */
  readonly pageBehavior?: "visible" | "single"
  /** Always six weeks per month. */
  readonly fixedWeeks?: boolean
  readonly firstDayOfWeek?: DayOfWeek
  readonly locale?: string
  /** Reading direction; RTL mirrors the arrow keys. Default: the provider's. */
  readonly dir?: "ltr" | "rtl"
  /** Calendar systems other than gregorian (`createCalendar` from @internationalized/date). */
  readonly createCalendar?: CreateCalendar
  /** The zone "today" is read in (default: the value's, then the viewer's). */
  readonly timeZone?: string
  readonly disabled?: boolean
  readonly readOnly?: boolean
  /** Shown invalid whatever the value (a host field's own validity). */
  readonly invalid?: boolean
  /**
   * A date was chosen (single) or a range completed (range), also when the value did not
   * change: a picker closes on it.
   */
  readonly onDateSelect?: (date: CalendarDate, details: { readonly modality: Modality }) => void
  /** Every string reaching assistive technology. */
  readonly messages?: MessageOverrides<CalendarMessages>
  /** The shown view: days, the months of a year, or a page of years (controllable). */
  readonly view?: CalendarView
  /** The view shown first (uncontrolled). Default: `minView`. */
  readonly defaultView?: CalendarView
  /** The view changed; `reason` is `heading`, `select` (a period drilled into), `escape-key` or `api`. */
  readonly onViewChange?: (view: CalendarView, details: CalendarViewChangeDetails) => void
  /** The lowest view (default "days"): the value is chosen there; higher views drill down. */
  readonly minView?: CalendarView
  /** The highest view the heading drills up to (default "years"). */
  readonly maxView?: CalendarView
  /** Years per page in the years view (default 12). */
  readonly yearsPerPage?: number
  /** Cells per row in the month and year views (default 4). */
  readonly columns?: number
  /** Month view availability, told the month's first day. */
  readonly isMonthUnavailable?: (month: CalendarDate) => boolean
  /** Year view availability, told the year's first day. */
  readonly isYearUnavailable?: (year: CalendarDate) => boolean
}

export interface CalendarViewChangeDetails {
  /** The heading button, a period chosen (drill-down), Escape, or a parent's change. */
  readonly reason: "heading" | "select" | "escape-key" | "api"
}

function Root({
  value,
  defaultValue,
  onValueChange,
  selectionMode = "single",
  focusedValue,
  defaultFocusedValue,
  onFocusChange,
  onVisibleRangeChange,
  minValue = null,
  maxValue = null,
  isDateUnavailable,
  anchor,
  defaultAnchor,
  onAnchorChange,
  minRangeLength,
  maxRangeLength,
  allowsNonContiguousRanges = false,
  commitOnBlur = "reset",
  dragDelay = 200,
  visibleMonths = 1,
  pageBehavior = "visible",
  fixedWeeks = false,
  firstDayOfWeek: firstDayProp,
  locale: ownLocale,
  dir: ownDir,
  createCalendar,
  timeZone,
  disabled = false,
  readOnly = false,
  invalid,
  onDateSelect,
  messages: ownMessages,
  view: viewProp,
  defaultView,
  onViewChange,
  minView = "days",
  maxView = "years",
  yearsPerPage,
  columns,
  isMonthUnavailable,
  isYearUnavailable,
  children,
  id,
  render,
  ...rest
}: CalendarRootProps & {
  /** Another element or a render function receiving the props. */
  readonly render?: RenderProp<undefined>
}) {
  const env = useEnvironment(announcerCapability, dateClockCapability)
  const generated = useId()
  const instance = id ?? generated
  const { locale, dir } = useLocale(ownLocale, ownDir)
  const messages = useMessages("calendar", calendarMessages, ownMessages)
  const { calendar, formatLocale } = resolveCalendar(locale, createCalendar)
  const firstDay = weekStart(locale, firstDayProp)
  const show = (d: DateValue | null | undefined) => (d ? display(d, calendar) : null)
  const nav = {
    visibleMonths,
    pageBehavior,
    minValue: show(minValue),
    maxValue: show(maxValue),
    locale,
    firstDayOfWeek: firstDay,
  }
  const current = value === undefined ? defaultValue : value
  const today = todayOf(env.dateClock, todayZone(timeZone, valuesOf(current ?? null)))
  // The first focus: the given one, else the value, else today (calendar-navigation).
  const [initial] = useState(
    () =>
      show(defaultFocusedValue) ??
      initialCalendarFocus(show(valuesOf(current ?? null)[0]), display(today, calendar), nav)
        .focused,
  )
  const pendingFocus = useRef<{ date: CalendarDate; modality: string | undefined } | null>(null)
  const latest = useRef({
    onValueChange,
    onFocusChange,
    onAnchorChange,
    onDateSelect,
    onViewChange,
  })
  latest.current = { onValueChange, onFocusChange, onAnchorChange, onDateSelect, onViewChange }
  const range = {
    minRangeLength,
    maxRangeLength,
    allowsNonContiguousRanges,
    commitOnBlur,
  }
  // A fixed view (controlled, no onViewChange) is the only view: the value is chosen there.
  const fixedView = viewProp !== undefined && onViewChange === undefined ? viewProp : undefined
  const periods = {
    minView: fixedView ?? minView,
    maxView: fixedView ?? maxView,
    yearsPerPage,
    columns,
    isMonthUnavailable,
    isYearUnavailable,
  }
  const { view, send } = useMachine(
    calendarMachine,
    {
      ...nav,
      value,
      defaultValue,
      onValueChange: (v, details) => {
        const d = details as { event: { type: string; modality?: string }; cancel(): void }
        latest.current.onValueChange?.(v, {
          reason:
            d.event.type === "CELL.PRESS"
              ? "CELL.PRESS"
              : d.event.type === "DRAG.END"
                ? "DRAG"
                : "KEY",
          modality: d.event.modality ?? "keyboard",
          cancel: d.cancel,
        })
      },
      focusedValue: show(focusedValue) ?? undefined,
      defaultFocusedValue: initial,
      onFocusedValueChange: (date) => latest.current.onFocusChange?.(date),
      ...(anchor !== undefined ? { anchor: show(anchor) } : {}),
      ...(defaultAnchor !== undefined ? { defaultAnchor: show(defaultAnchor) } : {}),
      onAnchorChange: (a) => latest.current.onAnchorChange?.(a),
      onDateSelect: (date, details) => latest.current.onDateSelect?.(date, details),
      ...range,
      ...periods,
      view: viewProp,
      defaultView: defaultView ?? minView,
      onViewChange: (v, details) => {
        const type = (details as { event: { type: string } }).event.type
        latest.current.onViewChange?.(v, {
          reason:
            type === "VIEW.UP"
              ? "heading"
              : type === "VIEW.DOWN"
                ? "escape-key"
                : type === "CELL.PRESS" || type === "SELECT_FOCUSED"
                  ? "select"
                  : "api",
        })
      },
      selectionMode,
      isDateUnavailable,
      disabled,
      readOnly,
      invalid,
      calendar,
      formatLocale,
      messages,
      id: instance,
      focusCell: (date, modality) => {
        pendingFocus.current = { date, modality }
      },
    },
    env,
  )
  const drag = useCellDrag(env, instance, calendar, dragDelay, send)
  // The modality is tracked from mount: a pointer press that focuses a cell is seen as one.
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const gridFocused = view.matches("focused")
  const modality = useModality(env.modality, gridFocused)
  const anchored = selectionMode === "range" ? (view.values.anchor ?? null) : null
  const api = calendarConnect({
    ...nav,
    ...range,
    ...periods,
    view: viewIn(view.values.view, periods),
    // Controlled and never changed: the heading is plain text (spec "View Drill-Down").
    viewFixed: fixedView !== undefined,
    anchor: anchored ? display(anchored, calendar) : null,
    selectionMode,
    isDateUnavailable,
    disabled,
    readOnly,
    invalid,
    calendar,
    formatLocale,
    messages,
    id: instance,
    instance,
    value: view.values.value ?? null,
    focused: view.values.focusedValue,
    visibleStart: view.context.visibleStart,
    hovered: view.context.hovered,
    dragging: view.context.dragging,
    gridFocused,
    modality,
    today: display(today, calendar),
    dir,
    consumerNamed: rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined,
    ids: {
      heading: `calendar-${instance}-heading`.replace(/:/g, ""),
      grid: (m) => `calendar-${instance}-grid-${m}`.replace(/:/g, ""),
      prompt: `calendar-${instance}-prompt`.replace(/:/g, ""),
    },
  })
  // After the step is rendered: DOM focus to the focused cell (keyboard and props only).
  const root = useRef<HTMLDivElement | null>(null)
  useIsoLayoutEffect(() => {
    const pending = pendingFocus.current
    if (!pending) return
    pendingFocus.current = null
    const cell = root.current?.querySelector<HTMLElement>(
      `[data-part="cell"][data-value="${isoOf(pending.date)}"]:not([data-outside-month])`,
    )
    if (cell) {
      void focusSafely(
        cell,
        env,
        "navigation",
        pending.modality as Parameters<typeof focusSafely>[3],
      )
    }
  })
  // Range mode: leaving the Calendar while anchored applies commitOnBlur (spec "Range Cancel And
  // Leave"); inside is the root's subtree and the layers opened from it.
  const isAnchored = anchored !== null
  useEffect(() => {
    const el = root.current
    if (!isAnchored || !el) return
    return watchLeave(el, () => send({ type: "LEAVE" }))
  }, [isAnchored, send])
  // Every change of the visible range is reported.
  const start = view.context.visibleStart
  const reported = useRef<string | null>(null)
  useEffect(() => {
    const key = start.toString()
    if (reported.current === key) return
    const first = reported.current === null
    reported.current = key
    if (!first) onVisibleRangeChange?.({ start, end: visibleEnd(start, nav) })
  })
  drag.canStart.current = api.canDrag
  // While dragging, a touch does not scroll the page (a native non-passive listener).
  useEffect(() => {
    const el = root.current
    return el ? drag.handle.attach(el) : undefined
  }, [drag.handle])
  const ctx: Ctx = {
    view,
    send,
    api,
    instance,
    dragConsumes: drag.handle.consumes,
    grid: (offset) => monthGrid(start.add({ months: offset }), locale, firstDay, fixedWeeks),
  }
  const props = mergeProps(
    {
      ...normalizeProps(api.root()),
      // Escape anywhere inside cancels a range in progress and is consumed; with no anchor
      // (and in minView) it bubbles (to an enclosing dialog).
      onKeyDown: (e: KeyboardEvent) => {
        // Then, in a view above minView, it goes one view down before any outer layer.
        if (e.key !== "Escape" || e.defaultPrevented || !(isAnchored || api.escapeGoesDown)) return
        e.preventDefault()
        e.stopPropagation()
        send(isAnchored ? { type: "CANCEL" } : { type: "VIEW.DOWN" })
      },
      onPointerDown: (e: PointerEvent) => drag.handle.pointerDown(e.currentTarget as Element, e),
      ref: root,
    },
    rest,
  )
  // Range mode: the focused cell's prompt, read as its description.
  const prompt =
    selectionMode === "range" ? (
      <span {...normalizeProps({ ...api.prompt(), style: visuallyHiddenStyle })} />
    ) : null
  return (
    <CalendarContext value={ctx}>
      {renderPart(
        "div",
        {
          ...props,
          children: (
            <>
              {children}
              {prompt}
            </>
          ),
        },
        render,
        undefined,
      )}
    </CalendarContext>
  )
}

/** Range mode's drag selection (spec "Drag Selection"): one per Root, wired to the machine. */
function useCellDrag(
  env: ReturnType<typeof useEnvironment>,
  instance: string,
  calendar: ReturnType<typeof resolveCalendar>["calendar"],
  dragDelay: number,
  send: Machine["send"],
) {
  const canStart = useRef<(date: CalendarDate) => boolean>(() => false)
  const latest = useRef({ env, instance, calendar, dragDelay, send })
  latest.current = { env, instance, calendar, dragDelay, send }
  const [handle] = useState(() =>
    createCalendarDrag({
      get env() {
        return latest.current.env
      },
      target: () => latest.current,
      canStart: (date) => canStart.current(date),
      delay: () => latest.current.dragDelay,
      send: (e) => latest.current.send(e),
    }),
  )
  useEffect(() => () => handle.dispose(), [handle])
  return { handle, canStart }
}

type PartP<T extends keyof HTMLElementTagNameMap> = ComponentPropsWithRef<T> & {
  /** Another element or a render function receiving the props. */
  readonly render?: RenderProp<undefined>
}

function Header({ render, ...rest }: PartP<"div">) {
  const { api } = useCalendar("Header")
  return renderPart("div", mergeProps(normalizeProps(api.header()), rest), render, undefined)
}

function Heading({ render, ...rest }: PartP<"h2">) {
  const { api } = useCalendar("Heading")
  const own = normalizeProps(api.heading())
  // With a higher view, the heading's text is a button one view up (spec "View Drill-Down").
  const content = api.viewTrigger() ? { children: <ViewTrigger /> } : {}
  return renderPart("h2", mergeProps({ ...own, ...content }, rest), render, undefined)
}

function ViewTrigger() {
  const ctx = useCalendar("Heading")
  const env = useEnvironment()
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const own = ctx.api.viewTrigger({ focused, modality })
  const press = usePress({
    env,
    send: (e) => {
      if (e.type === "PRESS") ctx.send({ type: "VIEW.UP", modality: e.modality })
    },
  })
  if (!own) return null
  const props = joinHandlers(normalizeProps(own), press.props, {
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  })
  return (
    <button {...props} type="button">
      <span {...normalizeProps(ctx.api.viewTriggerText())} />
    </button>
  )
}

function useTrigger(direction: 1 | -1, part: string) {
  const ctx = useCalendar(part)
  const env = useEnvironment()
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const props = ctx.api.trigger(direction, { focused, modality })
  const off = props["aria-disabled"] === "true"
  const press = usePress({
    env,
    disabled: () => off,
    send: (e) => {
      if (e.type === "PRESS") ctx.send({ type: "PAGE", direction, modality: e.modality })
    },
  })
  return joinHandlers(normalizeProps(props), press.props, {
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  })
}

function PrevTrigger({ render, ...rest }: PartP<"button">) {
  return renderPart("button", mergeProps(useTrigger(-1, "PrevTrigger"), rest), render, undefined)
}

function NextTrigger({ render, ...rest }: PartP<"button">) {
  return renderPart("button", mergeProps(useTrigger(1, "NextTrigger"), rest), render, undefined)
}

export interface CalendarGridState {
  readonly weeks: MonthGrid["weeks"]
  readonly month: CalendarDate
}

function Grid({
  month = 0,
  children,
  render,
  ...rest
}: Omit<PartP<"table">, "children"> & {
  /** The month offset from the first visible month. */
  readonly month?: number
  /** The grid's content from its weeks; default: header and body. */
  readonly children?: ReactNode | ((state: CalendarGridState) => ReactNode)
}) {
  const ctx = useCalendar("Grid")
  const env = useEnvironment()
  // The month and year views have one grid per page: its rows are the page's periods.
  const days = ctx.api.view === "days"
  const g = days ? ctx.grid(month) : { weeks: ctx.api.periodRows(), month: ctx.grid(0).month }
  const { send } = ctx
  const handlers = {
    onFocus: (e: { target: EventTarget }) => {
      const cell = (e.target as HTMLElement).closest?.('[data-part="cell"]')
      if (!ctx.view.matches("focused"))
        send({ type: "GRID.FOCUS", modality: env.modality.modality() })
      const iso = cell?.getAttribute("data-value")
      if (!iso) return
      const date = g.weeks.flat().find((d) => isoOf(d) === iso)
      if (date) send({ type: "CELL.FOCUS", date, modality: env.modality.modality() })
    },
    onBlur: (e: { relatedTarget: EventTarget | null }) => {
      const next = e.relatedTarget as HTMLElement | null
      const inside = next?.closest?.(
        `[data-scope="calendar"][data-part="grid"][data-instance="${CSS.escape(ctx.instance)}"]`,
      )
      if (!inside) send({ type: "GRID.BLUR" })
    },
    onKeyDown: (e: KeyboardEvent & { nativeEvent: KeyboardEvent }) => {
      const event = calendarKey(
        describeKey(e.nativeEvent, env),
        ctx.api.root()["dir"] === "rtl" ? "rtl" : "ltr",
        env.platform,
        ctx.api.view,
      )
      if (!event) return
      e.preventDefault()
      send(event)
    },
    onPointerLeave: () => send({ type: "GRID.HOVER_END" }),
  }
  const content =
    typeof children === "function"
      ? children({ weeks: g.weeks, month: g.month })
      : (children ?? (
          <>
            {days ? (
              <GridHeader>
                <tr>
                  {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                    <HeaderCell key={i} day={i} />
                  ))}
                </tr>
              </GridHeader>
            ) : null}
            <GridBody>
              {g.weeks.map((week) => (
                <Row key={isoOf(week[0] as CalendarDate)}>
                  {week.map((date) => (
                    <Cell key={isoOf(date)} date={date} />
                  ))}
                </Row>
              ))}
            </GridBody>
          </>
        ))
  const own = joinHandlers(normalizeProps(ctx.api.grid(month)), handlers)
  if (!days && month > 0) return null
  return (
    <GridContext value={month}>
      {renderPart("table", { ...mergeProps(own, rest), children: content }, render, undefined)}
    </GridContext>
  )
}

function GridHeader({ render, ...rest }: PartP<"thead">) {
  const { api } = useCalendar("GridHeader")
  return renderPart("thead", mergeProps(normalizeProps(api.gridHeader()), rest), render, undefined)
}

function HeaderCell({
  day,
  render,
  ...rest
}: PartP<"th"> & {
  /** The weekday, 0-6 from the week's first day. */
  readonly day: number
}) {
  const { api } = useCalendar("HeaderCell")
  return renderPart("th", mergeProps(normalizeProps(api.headerCell(day)), rest), render, undefined)
}

function GridBody({ render, ...rest }: PartP<"tbody">) {
  const { api } = useCalendar("GridBody")
  return renderPart("tbody", mergeProps(normalizeProps(api.gridBody()), rest), render, undefined)
}

function Row({ render, ...rest }: PartP<"tr">) {
  const { api } = useCalendar("Row")
  return renderPart("tr", mergeProps(normalizeProps(api.row()), rest), render, undefined)
}

export interface CalendarCellState {
  readonly date: CalendarDate
  readonly selected: boolean
}

function Cell({
  date,
  render,
  ...rest
}: Omit<ComponentPropsWithRef<"td">, "children"> & {
  /** The date this cell shows and selects. */
  readonly date: CalendarDate
  /** Another element or a render function receiving the props and the cell's state. */
  readonly render?: RenderProp<CalendarCellState>
}) {
  const ctx = useCalendar("Cell")
  const env = useEnvironment()
  const month = useContext(GridContext)
  const own = ctx.api.cell(date, month)
  const placeholder = own["data-outside-month"] !== undefined
  const disabled = own["data-disabled"] !== undefined
  const press = usePress({
    env,
    disabled: () => placeholder || disabled,
    send: (e) => {
      // A placeholder never selects (react-spectrum#3257); release, not press, selects.
      // Enter and Space are the grid's keys (SELECT_FOCUSED): a key press here would select
      // twice (a multiple selection toggles back).
      // A press that dragged was handled by the drag (its release is not a second click).
      if (
        e.type === "PRESS" &&
        e.pointerType !== "keyboard" &&
        !placeholder &&
        !disabled &&
        !ctx.dragConsumes(e)
      ) {
        ctx.send({ type: "CELL.PRESS", date, modality: e.modality })
      }
    },
  })
  const hover = useHover({
    env,
    disabled: () => disabled,
    send: (e) => {
      if (e.type === "HOVER.START") ctx.send({ type: "CELL.HOVER", date })
    },
  })
  const props = {
    ...joinHandlers(normalizeProps(own), press.props, hover.props),
    "data-pressed": press.pressed ? "" : undefined,
  }
  return renderPart("td", mergeProps(props, rest), render, {
    date,
    selected: own["data-selected"] !== undefined,
  })
}

/** The parts, by name: `calendar.parts.ts` re-exports them as the `Calendar` namespace. */
export {
  Cell,
  Grid,
  GridBody,
  GridHeader,
  Header,
  HeaderCell,
  Heading,
  NextTrigger,
  PrevTrigger,
  Root,
  Row,
}
