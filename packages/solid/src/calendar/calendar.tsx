/** @jsxImportSource solid-js */
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
  untrack,
  useContext,
} from "solid-js"
import { afterMount } from "../lifecycle"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, reactive, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { useHover, usePress } from "../use-press"

declare module "../provider" {
  interface RindMessageScopes {
    calendar: CalendarMessages
  }
}

export interface CalendarChangeDetails {
  /** A cell's press, a key, or the release of a drag selection. */
  readonly reason: "CELL.PRESS" | "KEY" | "DRAG"
  readonly modality: string | undefined
  cancel(): void
}

export interface CalendarViewChangeDetails {
  /** The heading button, a period chosen (drill-down), Escape, or a parent's change. */
  readonly reason: "heading" | "select" | "escape-key" | "api"
}

type Machine = ReturnType<typeof useMachine<typeof calendarMachine>>

interface Ctx {
  readonly view: Machine["view"]
  readonly send: Machine["send"]
  readonly api: Accessor<ReturnType<typeof calendarConnect>>
  /** Reads the machine's view: call in a computation. */
  readonly grid: (offset: number) => MonthGrid
  readonly instance: Accessor<string>
  /** Range mode: a press that dragged has already been handled. */
  readonly dragConsumes: (press: { readonly pointerType: string }) => boolean
}
const CalendarContext = createContext<Ctx>()
function useCalendar(part: string): Ctx {
  const ctx = useContext(CalendarContext)
  if (!ctx) throw new Error(`Calendar.${part} must be inside Calendar.Root`)
  return ctx
}
const GridContext = createContext<Accessor<number>>(() => 0)

export type CalendarRootProps = Omit<
  JSX.HTMLAttributes<HTMLDivElement>,
  "children" | "defaultValue" | "onChange" | "dir"
> & {
  /** The calendar's parts (header, grids). */
  readonly children?: JSX.Element
  readonly value?: CalendarValue | undefined
  readonly defaultValue?: CalendarValue | undefined
  readonly onValueChange?:
    | ((value: CalendarValue, details: CalendarChangeDetails) => void)
    | undefined
  readonly selectionMode?: CalendarSelectionMode | undefined
  readonly focusedValue?: DateValue | undefined
  readonly defaultFocusedValue?: DateValue | undefined
  readonly onFocusChange?: ((date: CalendarDate) => void) | undefined
  /** The visible months changed. */
  readonly onVisibleRangeChange?:
    | ((range: { start: CalendarDate; end: CalendarDate }) => void)
    | undefined
  readonly minValue?: DateValue | null | undefined
  readonly maxValue?: DateValue | null | undefined
  /** `anchor`: in range mode, the first end while a range is being selected, else null. */
  readonly isDateUnavailable?:
    | ((date: CalendarDate, details: { readonly anchor: CalendarDate | null }) => boolean)
    | undefined
  /** Range mode: the first end while a range is being selected (controllable). */
  readonly anchor?: CalendarDate | null | undefined
  /** Uncontrolled anchor. */
  readonly defaultAnchor?: CalendarDate | null | undefined
  /** The anchor was set or cleared. */
  readonly onAnchorChange?: ((anchor: CalendarDate | null) => void) | undefined
  /** Range mode: length bounds in days, both ends included. */
  readonly minRangeLength?: number | undefined
  /** Range mode: longest range in days (ends included); farther ends are disabled. */
  readonly maxRangeLength?: number | undefined
  /** Range mode: a range may contain unavailable dates (default false). */
  readonly allowsNonContiguousRanges?: boolean | undefined
  /** Range mode: what leaving while anchored does (default "reset"). */
  readonly commitOnBlur?: CalendarCommitOnBlur | undefined
  /**
   * Range mode, touch: how long (ms) a touch is held still before it starts a drag selection
   * (default 200). A shorter touch is a tap; one that moves first scrolls.
   */
  readonly dragDelay?: number | undefined
  /** Months shown side by side. Default: 1. */
  readonly visibleMonths?: number | undefined
  /** A trigger pages by all visible months, or by one. Default: "visible". */
  readonly pageBehavior?: "visible" | "single" | undefined
  /** Always six weeks per month. */
  readonly fixedWeeks?: boolean | undefined
  readonly firstDayOfWeek?: DayOfWeek | undefined
  readonly locale?: string | undefined
  /** Reading direction; RTL mirrors the arrow keys. Default: the provider's. */
  readonly dir?: "ltr" | "rtl" | undefined
  /** Calendar systems other than gregorian (`createCalendar` from @internationalized/date). */
  readonly createCalendar?: CreateCalendar | undefined
  /** The zone "today" is read in (default: the value's, then the viewer's). */
  readonly timeZone?: string | undefined
  readonly disabled?: boolean | undefined
  readonly readOnly?: boolean | undefined
  /** Shown invalid whatever the value (a host field's own validity). */
  readonly invalid?: boolean | undefined
  /**
   * A date was chosen (single) or a range completed (range), also when the value did not
   * change: a picker closes on it.
   */
  readonly onDateSelect?:
    | ((date: CalendarDate, details: { readonly modality: Modality }) => void)
    | undefined
  /** Every string reaching assistive technology. */
  readonly messages?: MessageOverrides<CalendarMessages> | undefined
  /** The shown view: days, the months of a year, or a page of years (controllable). */
  readonly view?: CalendarView | undefined
  /** The view shown first (uncontrolled). Default: `minView`. */
  readonly defaultView?: CalendarView | undefined
  /** The view changed; `reason` is `heading`, `select` (a period drilled into), `escape-key` or `api`. */
  readonly onViewChange?:
    | ((view: CalendarView, details: CalendarViewChangeDetails) => void)
    | undefined
  /** The lowest view (default "days"): the value is chosen there; higher views drill down. */
  readonly minView?: CalendarView | undefined
  /** The highest view the heading drills up to (default "years"). */
  readonly maxView?: CalendarView | undefined
  /** Years per page in the years view (default 12). */
  readonly yearsPerPage?: number | undefined
  /** Cells per row in the month and year views (default 4). */
  readonly columns?: number | undefined
  /** Month view availability, told the month's first day. */
  readonly isMonthUnavailable?: ((month: CalendarDate) => boolean) | undefined
  /** Year view availability, told the year's first day. */
  readonly isYearUnavailable?: ((year: CalendarDate) => boolean) | undefined
}

const ROOT_KEYS = [
  "value",
  "defaultValue",
  "onValueChange",
  "selectionMode",
  "focusedValue",
  "defaultFocusedValue",
  "onFocusChange",
  "onVisibleRangeChange",
  "minValue",
  "maxValue",
  "isDateUnavailable",
  "anchor",
  "defaultAnchor",
  "onAnchorChange",
  "minRangeLength",
  "maxRangeLength",
  "allowsNonContiguousRanges",
  "commitOnBlur",
  "dragDelay",
  "visibleMonths",
  "pageBehavior",
  "fixedWeeks",
  "firstDayOfWeek",
  "locale",
  "dir",
  "createCalendar",
  "timeZone",
  "disabled",
  "readOnly",
  "invalid",
  "onDateSelect",
  "messages",
  "view",
  "defaultView",
  "onViewChange",
  "minView",
  "maxView",
  "yearsPerPage",
  "columns",
  "isMonthUnavailable",
  "isYearUnavailable",
  "children",
  "id",
  "render",
] as const

function Root(
  props: CalendarRootProps & {
    /** Another element: a function receiving the props to spread. */
    readonly render?: RenderProp<undefined> | undefined
  },
) {
  const [o, rest] = splitProps(props, ROOT_KEYS)
  const env = useEnvironment(announcerCapability, dateClockCapability)
  const instance = useRootId(() => o.id)
  const loc = useLocale(
    () => o.locale,
    () => o.dir,
  )
  const messages = useMessages("calendar", calendarMessages, () => o.messages)
  const resolved = createMemo(() => resolveCalendar(loc().locale, o.createCalendar))
  const firstDay = createMemo(() => weekStart(loc().locale, o.firstDayOfWeek))
  const show = (d: DateValue | null | undefined) => (d ? display(d, resolved().calendar) : null)
  const selectionMode = () => o.selectionMode ?? "single"
  const nav = () => ({
    visibleMonths: o.visibleMonths ?? 1,
    pageBehavior: o.pageBehavior ?? "visible",
    minValue: show(o.minValue ?? null),
    maxValue: show(o.maxValue ?? null),
    locale: loc().locale,
    firstDayOfWeek: firstDay(),
  })
  const current = () => (o.value === undefined ? o.defaultValue : o.value)
  const today = () => todayOf(env.dateClock, todayZone(o.timeZone, valuesOf(current() ?? null)))
  // The first focus: the given one, else the value, else today (calendar-navigation).
  const initial = untrack(
    () =>
      show(o.defaultFocusedValue) ??
      initialCalendarFocus(
        show(valuesOf(current() ?? null)[0]),
        display(today(), resolved().calendar),
        nav(),
      ).focused,
  )
  let pendingFocus: { date: CalendarDate; modality: string | undefined } | null = null
  const range = () => ({
    minRangeLength: o.minRangeLength,
    maxRangeLength: o.maxRangeLength,
    allowsNonContiguousRanges: o.allowsNonContiguousRanges ?? false,
    commitOnBlur: o.commitOnBlur ?? "reset",
  })
  // A fixed view (controlled, no onViewChange) is the only view: the value is chosen there.
  const fixedView = () =>
    o.view !== undefined && o.onViewChange === undefined ? o.view : undefined
  const periods = () => ({
    minView: fixedView() ?? o.minView ?? "days",
    maxView: fixedView() ?? o.maxView ?? "years",
    yearsPerPage: o.yearsPerPage,
    columns: o.columns,
    isMonthUnavailable: o.isMonthUnavailable,
    isYearUnavailable: o.isYearUnavailable,
  })
  const machineProps = createMemo(
    () =>
      ({
        ...nav(),
        value: o.value,
        defaultValue: o.defaultValue,
        onValueChange: (v: CalendarValue, details: unknown) => {
          const d = details as { event: { type: string; modality?: string }; cancel(): void }
          o.onValueChange?.(v, {
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
        focusedValue: show(o.focusedValue) ?? undefined,
        defaultFocusedValue: initial,
        onFocusedValueChange: (date: CalendarDate) => o.onFocusChange?.(date),
        ...(o.anchor !== undefined ? { anchor: show(o.anchor) } : {}),
        ...(o.defaultAnchor !== undefined ? { defaultAnchor: show(o.defaultAnchor) } : {}),
        onAnchorChange: (a: CalendarDate | null) => o.onAnchorChange?.(a),
        onDateSelect: (date: CalendarDate, details: { readonly modality: Modality }) =>
          o.onDateSelect?.(date, details),
        ...range(),
        ...periods(),
        view: o.view,
        defaultView: o.defaultView ?? o.minView ?? "days",
        onViewChange: (v: CalendarView, details: unknown) => {
          const type = (details as { event: { type: string } }).event.type
          o.onViewChange?.(v, {
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
        selectionMode: selectionMode(),
        isDateUnavailable: o.isDateUnavailable,
        disabled: o.disabled ?? false,
        readOnly: o.readOnly ?? false,
        invalid: o.invalid,
        calendar: resolved().calendar,
        formatLocale: resolved().formatLocale,
        messages: messages(),
        id: instance(),
        focusCell: (date: CalendarDate, modality: string | undefined) => {
          pendingFocus = { date, modality }
        },
      }) as unknown as Parameters<
        typeof useMachine<typeof calendarMachine>
      >[1] extends () => infer P
        ? P
        : never,
  )
  const { view, send } = useMachine(calendarMachine, machineProps, env)
  // Range mode's drag selection (spec "Drag Selection"): one per Root, wired to the machine.
  const drag = createCalendarDrag({
    env,
    target: () => ({ instance: instance(), calendar: resolved().calendar }),
    canStart: (date) => untrack(api).canDrag(date),
    delay: () => o.dragDelay ?? 200,
    send: (e) => send(e),
  })
  onCleanup(() => drag.dispose())
  // The modality is tracked from mount: a pointer press that focuses a cell is seen as one.
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  // Server markup marks no day as today (the server's day or zone may not be the viewer's).
  const [mounted, setMounted] = createSignal(false)
  afterMount(() => setMounted(true))
  const gridFocused = createMemo(() => view().matches("focused"))
  const modality = useModality(env.modality, gridFocused)
  const anchored = createMemo(() =>
    selectionMode() === "range" ? (view().values.anchor ?? null) : null,
  )
  const api = createMemo(() => {
    const v = view()
    const a = anchored()
    const { calendar, formatLocale } = resolved()
    const id = instance()
    return calendarConnect({
      ...nav(),
      ...range(),
      ...periods(),
      view: viewIn(v.values.view, periods()),
      // Controlled and never changed: the heading is plain text (spec "View Drill-Down").
      viewFixed: fixedView() !== undefined,
      anchor: a ? display(a, calendar) : null,
      selectionMode: selectionMode(),
      isDateUnavailable: o.isDateUnavailable,
      disabled: o.disabled ?? false,
      readOnly: o.readOnly ?? false,
      invalid: o.invalid,
      calendar,
      formatLocale,
      messages: messages(),
      id,
      instance: id,
      value: v.values.value ?? null,
      focused: v.values.focusedValue,
      visibleStart: v.context.visibleStart,
      hovered: v.context.hovered,
      dragging: v.context.dragging,
      gridFocused: gridFocused(),
      modality: modality(),
      today: mounted() ? display(today(), calendar) : null,
      dir: loc().dir,
      consumerNamed: rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined,
      ids: {
        heading: `calendar-${id}-heading`.replace(/:/g, ""),
        grid: (m) => `calendar-${id}-grid-${m}`.replace(/:/g, ""),
        prompt: `calendar-${id}-prompt`.replace(/:/g, ""),
      },
    } as Parameters<typeof calendarConnect>[0])
  })
  const [root, setRoot] = createSignal<Element | null>(null)
  afterMount(() => {
    // After the step is rendered: DOM focus to the focused cell (keyboard and props only).
    createEffect(() => {
      view()
      const pending = pendingFocus
      if (!pending) return
      pendingFocus = null
      const cell = root()?.querySelector<HTMLElement>(
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
    // Range mode: leaving the Calendar while anchored applies commitOnBlur (spec "Range Cancel
    // And Leave"); inside is the root's subtree and the layers opened from it.
    const isAnchored = createMemo(() => anchored() !== null)
    createEffect(() => {
      const el = root()
      if (isAnchored() && el) onCleanup(watchLeave(el, () => send({ type: "LEAVE" })))
    })
    // Every change of the visible range is reported.
    const startKey = createMemo(() => view().context.visibleStart.toString())
    createEffect(
      on(
        startKey,
        () => {
          const start = untrack(view).context.visibleStart
          o.onVisibleRangeChange?.({ start, end: visibleEnd(start, untrack(nav)) })
        },
        { defer: true },
      ),
    )
    // While dragging, a touch does not scroll the page (a native non-passive listener).
    createEffect(() => {
      const el = root()
      if (el) onCleanup(drag.attach(el))
    })
  })
  const ctx: Ctx = {
    view,
    send,
    api,
    instance,
    dragConsumes: drag.consumes,
    grid: (offset) =>
      monthGrid(
        view().context.visibleStart.add({ months: offset }),
        loc().locale,
        firstDay(),
        o.fixedWeeks === true,
      ),
  }
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps(api().root()),
        // Escape anywhere inside cancels a range in progress and is consumed; with no anchor
        // (and in minView) it bubbles (to an enclosing dialog).
        onKeyDown: (e: KeyboardEvent) => {
          // Then, in a view above minView, it goes one view down before any outer layer.
          const isAnchored = untrack(anchored) !== null
          if (
            e.key !== "Escape" ||
            e.defaultPrevented ||
            !(isAnchored || untrack(api).escapeGoesDown)
          )
            return
          e.preventDefault()
          e.stopPropagation()
          send(isAnchored ? { type: "CANCEL" } : { type: "VIEW.DOWN" })
        },
        onPointerDown: (e: PointerEvent) => drag.pointerDown(e.currentTarget as Element, e),
        ref: setRoot,
      },
      rest,
    ),
  )
  // Range mode: the focused cell's prompt, read as its description.
  const prompt = createMemo(() => api().prompt())
  const promptProps = reactive(() => normalizeProps({ ...prompt(), style: visuallyHiddenStyle }))
  const children = () => (
    <>
      {o.children}
      <Show when={selectionMode() === "range"}>
        <span {...promptProps}>{contentOf(prompt())}</span>
      </Show>
    </>
  )
  return (
    <CalendarContext.Provider value={ctx}>
      {renderPart(o.render, merged, undefined, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </CalendarContext.Provider>
  )
}

/** The content connect gives a part (text, a label), which normalizeProps leaves out. */
const contentOf = (own: object) => (own as Record<string, unknown>)["children"] as JSX.Element

type Own<A, S = undefined> = Omit<A, "children"> & {
  /** Another element: a function receiving the props to spread and the part's state. */
  readonly render?: RenderProp<S> | undefined
  readonly children?: JSX.Element
}

function Header(props: Own<JSX.HTMLAttributes<HTMLDivElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useCalendar("Header")
  const own = createMemo(() => ctx.api().header())
  const merged = createMemo(() => mergeProps(normalizeProps(own()), rest))
  const children = () => local.children ?? contentOf(own())
  return renderPart(local.render, merged, undefined, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

function ViewTrigger() {
  const ctx = useCalendar("Heading")
  const env = useEnvironment()
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  const press = usePress({
    env,
    send: (e) => {
      if (e.type === "PRESS") ctx.send({ type: "VIEW.UP", modality: e.modality })
    },
  })
  const props = createMemo(() => {
    const own = ctx.api().viewTrigger({ focused: focused(), modality: modality() })
    return own
      ? joinHandlers(normalizeProps(own), press.props, {
          onFocusIn: () => setFocused(true),
          onFocusOut: () => setFocused(false),
        })
      : null
  })
  const text = createMemo(() => ctx.api().viewTriggerText())
  return (
    <Show when={props()}>
      <button {...(props() ?? {})} type="button">
        <span {...normalizeProps(text())}>{text()["children"] as JSX.Element}</span>
      </button>
    </Show>
  )
}

function Heading(props: Own<JSX.HTMLAttributes<HTMLHeadingElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useCalendar("Heading")
  const own = createMemo(() => ctx.api().heading())
  const merged = createMemo(() => mergeProps(normalizeProps(own()), rest))
  // With a higher view, the heading's text is a button one view up (spec "View Drill-Down").
  const hasTrigger = createMemo(() => !!ctx.api().viewTrigger())
  const children = () => (
    <Show when={hasTrigger()} fallback={local.children ?? contentOf(own())}>
      <ViewTrigger />
    </Show>
  )
  return renderPart(local.render, merged, undefined, children, (p) => <h2 {...p}>{children()}</h2>)
}

function useTrigger(direction: 1 | -1, part: string) {
  const ctx = useCalendar(part)
  const env = useEnvironment()
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  const own = () => ctx.api().trigger(direction, { focused: focused(), modality: modality() })
  const press = usePress({
    env,
    disabled: () => own()["aria-disabled"] === "true",
    send: (e) => {
      if (e.type === "PRESS") ctx.send({ type: "PAGE", direction, modality: e.modality })
    },
  })
  return (rest: Record<string | symbol, unknown>) => ({
    content: () => contentOf(own()),
    merged: createMemo(() =>
      mergeProps(
        joinHandlers(normalizeProps(own()), press.props, {
          onFocusIn: () => setFocused(true),
          onFocusOut: () => setFocused(false),
        }),
        rest,
      ),
    ),
  })
}

function PrevTrigger(props: Own<JSX.ButtonHTMLAttributes<HTMLButtonElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const { merged, content } = useTrigger(-1, "PrevTrigger")(rest)
  const children = () => local.children ?? content()
  return renderPart(local.render, merged, undefined, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

function NextTrigger(props: Own<JSX.ButtonHTMLAttributes<HTMLButtonElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const { merged, content } = useTrigger(1, "NextTrigger")(rest)
  const children = () => local.children ?? content()
  return renderPart(local.render, merged, undefined, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

export interface CalendarGridState {
  readonly weeks: MonthGrid["weeks"]
  readonly month: CalendarDate
}

type GridContent = { readonly weeks: MonthGrid["weeks"]; readonly month: CalendarDate }
const sameGrid = (a: GridContent, b: GridContent) =>
  a.month.toString() === b.month.toString() &&
  a.weeks.length === b.weeks.length &&
  a.weeks.every(
    (w, i) =>
      w.length === b.weeks[i]?.length &&
      w.every((d, j) => isoOf(d) === isoOf(b.weeks[i]?.[j] as never)),
  )

function Grid(
  props: Omit<Own<JSX.HTMLAttributes<HTMLTableElement>>, "children"> & {
    /** The month offset from the first visible month. */
    readonly month?: number | undefined
    /** The grid's content from its weeks; default: header and body. */
    readonly children?: JSX.Element | ((state: CalendarGridState) => JSX.Element)
  },
) {
  const [local, rest] = splitProps(props, ["month", "children", "render"])
  const ctx = useCalendar("Grid")
  const env = useEnvironment()
  const month = () => local.month ?? 0
  // The month and year views have one grid per page: its rows are the page's periods.
  const days = createMemo(() => ctx.api().view === "days")
  // The same object while the dates are the same: the cells are not rebuilt on every change.
  const compute = (): GridContent =>
    days() ? ctx.grid(month()) : { weeks: ctx.api().periodRows(), month: ctx.grid(0).month }
  const g = createMemo<GridContent>(compute, untrack(compute), { equals: sameGrid })
  const { send } = ctx
  const handlers = {
    // Focus events bubble as focusin / focusout.
    onFocusIn: (e: FocusEvent) => {
      const cell = (e.target as HTMLElement).closest?.('[data-part="cell"]')
      if (!untrack(ctx.view).matches("focused"))
        send({ type: "GRID.FOCUS", modality: env.modality.modality() })
      const iso = cell?.getAttribute("data-value")
      if (!iso) return
      const date = untrack(g)
        .weeks.flat()
        .find((d) => isoOf(d) === iso)
      if (date) send({ type: "CELL.FOCUS", date, modality: env.modality.modality() })
    },
    onFocusOut: (e: FocusEvent) => {
      const next = e.relatedTarget as HTMLElement | null
      const inside = next?.closest?.(
        `[data-scope="calendar"][data-part="grid"][data-instance="${CSS.escape(untrack(ctx.instance))}"]`,
      )
      if (!inside) send({ type: "GRID.BLUR" })
    },
    onKeyDown: (e: KeyboardEvent) => {
      const api = untrack(ctx.api)
      const event = calendarKey(
        describeKey(e, env),
        api.root()["dir"] === "rtl" ? "rtl" : "ltr",
        env.platform,
        api.view,
      )
      if (!event) return
      e.preventDefault()
      send(event)
    },
    onPointerLeave: () => send({ type: "GRID.HOVER_END" }),
  }
  const merged = createMemo(() =>
    mergeProps(joinHandlers(normalizeProps(ctx.api().grid(month())), handlers), rest),
  )
  const content = (): JSX.Element => {
    const c = local.children
    if (typeof c === "function") return (c as (s: CalendarGridState) => JSX.Element)(g())
    return (
      c ?? (
        <>
          <Show when={days()}>
            <GridHeader>
              <tr>
                <For each={[0, 1, 2, 3, 4, 5, 6]}>{(i) => <HeaderCell day={i} />}</For>
              </tr>
            </GridHeader>
          </Show>
          <GridBody>
            <For each={g().weeks}>
              {(week) => (
                <Row>
                  <For each={week}>{(date) => <Cell date={date} />}</For>
                </Row>
              )}
            </For>
          </GridBody>
        </>
      )
    )
  }
  return (
    <Show when={days() || month() === 0}>
      <GridContext.Provider value={month}>
        {untrack(() =>
          renderPart(local.render, merged, undefined, content, (p) => (
            <table {...p}>{content()}</table>
          )),
        )}
      </GridContext.Provider>
    </Show>
  )
}

function GridHeader(props: Own<JSX.HTMLAttributes<HTMLTableSectionElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useCalendar("GridHeader")
  const own = createMemo(() => ctx.api().gridHeader())
  const merged = createMemo(() => mergeProps(normalizeProps(own()), rest))
  const children = () => local.children ?? contentOf(own())
  return renderPart(local.render, merged, undefined, children, (p) => (
    <thead {...p}>{children()}</thead>
  ))
}

function HeaderCell(
  props: Own<JSX.ThHTMLAttributes<HTMLTableCellElement>> & {
    /** The weekday, 0-6 from the week's first day. */
    readonly day: number
  },
) {
  const [local, rest] = splitProps(props, ["day", "render", "children"])
  const ctx = useCalendar("HeaderCell")
  const own = createMemo(() => ctx.api().headerCell(local.day))
  const merged = createMemo(() => mergeProps(normalizeProps(own()), rest))
  const children = () => local.children ?? contentOf(own())
  return renderPart(local.render, merged, undefined, children, (p) => <th {...p}>{children()}</th>)
}

function GridBody(props: Own<JSX.HTMLAttributes<HTMLTableSectionElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useCalendar("GridBody")
  const own = createMemo(() => ctx.api().gridBody())
  const merged = createMemo(() => mergeProps(normalizeProps(own()), rest))
  const children = () => local.children ?? contentOf(own())
  return renderPart(local.render, merged, undefined, children, (p) => (
    <tbody {...p}>{children()}</tbody>
  ))
}

function Row(props: Own<JSX.HTMLAttributes<HTMLTableRowElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useCalendar("Row")
  const own = createMemo(() => ctx.api().row())
  const merged = createMemo(() => mergeProps(normalizeProps(own()), rest))
  const children = () => local.children ?? contentOf(own())
  return renderPart(local.render, merged, undefined, children, (p) => <tr {...p}>{children()}</tr>)
}

export interface CalendarCellState {
  readonly date: CalendarDate
  readonly selected: boolean
}

function Cell(
  props: Own<JSX.TdHTMLAttributes<HTMLTableCellElement>, CalendarCellState> & {
    /** The date this cell shows and selects. */
    readonly date: CalendarDate
  },
) {
  const [local, rest] = splitProps(props, ["date", "render", "children"])
  const ctx = useCalendar("Cell")
  const env = useEnvironment()
  const month = useContext(GridContext)
  const own = createMemo(() => ctx.api().cell(local.date, month()))
  const placeholder = () => own()["data-outside-month"] !== undefined
  const disabled = () => own()["data-disabled"] !== undefined
  const press = usePress({
    env,
    disabled: () => placeholder() || disabled(),
    send: (e) => {
      // A placeholder never selects (react-spectrum#3257); release, not press, selects.
      // Enter and Space are the grid's keys (SELECT_FOCUSED): a key press here would select
      // twice (a multiple selection toggles back).
      // A press that dragged was handled by the drag (its release is not a second click).
      if (
        e.type === "PRESS" &&
        e.pointerType !== "keyboard" &&
        !placeholder() &&
        !disabled() &&
        !ctx.dragConsumes(e)
      ) {
        ctx.send({ type: "CELL.PRESS", date: local.date, modality: e.modality })
      }
    },
  })
  const hover = useHover({
    env,
    disabled,
    send: (e) => {
      if (e.type === "HOVER.START") ctx.send({ type: "CELL.HOVER", date: local.date })
    },
  })
  const merged = createMemo(() =>
    mergeProps(
      {
        ...joinHandlers(normalizeProps(own()), press.props, hover.props),
        "data-pressed": press.pressed() ? "" : undefined,
      },
      rest,
    ),
  )
  const state = reactive<CalendarCellState>(() => ({
    date: local.date,
    selected: own()["data-selected"] !== undefined,
  }))
  const children = () => local.children ?? contentOf(own())
  return renderPart(local.render, merged, state, children, (p) => <td {...p}>{children()}</td>)
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
