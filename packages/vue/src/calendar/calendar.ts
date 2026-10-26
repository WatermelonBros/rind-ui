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
  type ComputedRef,
  computed,
  defineComponent,
  Fragment,
  h,
  type InjectionKey,
  inject,
  onBeforeUnmount,
  onMounted,
  type PropType,
  provide,
  type SlotsType,
  shallowRef,
  type VNodeChild,
  watch,
} from "vue"
import { joinHandlers } from "../join-handlers"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { asChildProp, renderPart } from "../render"
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
  readonly api: ComputedRef<ReturnType<typeof calendarConnect>>
  readonly grid: (offset: number) => MonthGrid
  readonly instance: () => string
  /** Range mode: a press that dragged has already been handled. */
  readonly dragConsumes: (press: { readonly pointerType: string }) => boolean
}
const CalendarKey: InjectionKey<Ctx> = Symbol("rind-ui.calendar")
function useCalendar(part: string): Ctx {
  const ctx = inject(CalendarKey, null)
  if (!ctx) throw new Error(`Calendar.${part} must be inside Calendar.Root`)
  return ctx
}
const GridKey: InjectionKey<() => number> = Symbol("rind-ui.calendar-grid")

type Slots<S = undefined> = SlotsType<{
  default?: S extends undefined ? () => VNodeChild : (state: S) => VNodeChild
}>
const fn = <T>() => Function as unknown as PropType<T>
/** A date prop: a `@internationalized/date` value, or null where null means none. */
const date = <T>() => ({ type: Object as PropType<T>, default: undefined })

const Root = defineComponent({
  name: "CalendarRoot",
  inheritAttrs: false,
  props: {
    ...asChildProp,
    /** The base of the parts' ids. Default: generated. */
    id: String,
    /** The value (`v-model`). */
    modelValue: date<CalendarValue>(),
    defaultValue: date<CalendarValue>(),
    selectionMode: { type: String as PropType<CalendarSelectionMode>, default: "single" },
    /** The focused date (`v-model:focusedValue`). */
    focusedValue: date<DateValue>(),
    defaultFocusedValue: date<DateValue>(),
    minValue: { type: Object as PropType<DateValue | null>, default: null },
    maxValue: { type: Object as PropType<DateValue | null>, default: null },
    /** `anchor`: in range mode, the first end while a range is being selected, else null. */
    isDateUnavailable:
      fn<(date: CalendarDate, details: { readonly anchor: CalendarDate | null }) => boolean>(),
    /** Range mode: the first end while a range is being selected (`v-model:anchor`). */
    anchor: date<CalendarDate | null>(),
    defaultAnchor: date<CalendarDate | null>(),
    /** Range mode: length bounds in days, both ends included. */
    minRangeLength: Number,
    /** Range mode: longest range in days (ends included); farther ends are disabled. */
    maxRangeLength: Number,
    /** Range mode: a range may contain unavailable dates (default false). */
    allowsNonContiguousRanges: Boolean,
    /** Range mode: what leaving while anchored does (default "reset"). */
    commitOnBlur: { type: String as PropType<CalendarCommitOnBlur>, default: "reset" },
    /** Range mode, touch: how long (ms) a touch is held still before it starts a drag. */
    dragDelay: { type: Number, default: 200 },
    /** Months shown side by side. Default: 1. */
    visibleMonths: { type: Number, default: 1 },
    /** A trigger pages by all visible months, or by one. Default: "visible". */
    pageBehavior: { type: String as PropType<"visible" | "single">, default: "visible" },
    /** Always six weeks per month. */
    fixedWeeks: Boolean,
    firstDayOfWeek: String as PropType<DayOfWeek>,
    locale: String,
    /** Reading direction; RTL mirrors the arrow keys. Default: the provider's. */
    dir: String as PropType<"ltr" | "rtl">,
    /** Calendar systems other than gregorian (`createCalendar` from @internationalized/date). */
    createCalendar: fn<CreateCalendar>(),
    /** The zone "today" is read in (default: the value's, then the viewer's). */
    timeZone: String,
    disabled: Boolean,
    readOnly: Boolean,
    /** Shown invalid whatever the value (a host field's own validity). */
    invalid: { type: Boolean, default: undefined },
    /** Every string reaching assistive technology. */
    messages: Object as PropType<MessageOverrides<CalendarMessages>>,
    /** The shown view (`v-model:view`): days, the months of a year, or a page of years. */
    view: String as PropType<CalendarView>,
    /** The view shown first (uncontrolled). Default: `minView`. */
    defaultView: String as PropType<CalendarView>,
    /** The lowest view (default "days"): the value is chosen there; higher views drill down. */
    minView: { type: String as PropType<CalendarView>, default: "days" },
    /** The highest view the heading drills up to (default "years"). */
    maxView: { type: String as PropType<CalendarView>, default: "years" },
    /** Years per page in the years view (default 12). */
    yearsPerPage: Number,
    /** Cells per row in the month and year views (default 4). */
    columns: Number,
    /** Month view availability, told the month's first day. */
    isMonthUnavailable: fn<(month: CalendarDate) => boolean>(),
    /** Year view availability, told the year's first day. */
    isYearUnavailable: fn<(year: CalendarDate) => boolean>(),
    /** A listener makes the view changeable: without one, a controlled `view` is fixed. */
    onViewChange: fn<(view: CalendarView, details: CalendarViewChangeDetails) => void>(),
    "onUpdate:view": fn<(view: CalendarView) => void>(),
  },
  emits: {
    valueChange: (_value: CalendarValue, _details: CalendarChangeDetails) => true,
    "update:modelValue": (_value: CalendarValue) => true,
    focusChange: (_date: CalendarDate) => true,
    "update:focusedValue": (_date: CalendarDate) => true,
    /** The visible months changed. */
    visibleRangeChange: (_range: { start: CalendarDate; end: CalendarDate }) => true,
    /** The anchor was set or cleared. */
    anchorChange: (_anchor: CalendarDate | null) => true,
    "update:anchor": (_anchor: CalendarDate | null) => true,
    /**
     * A date was chosen (single) or a range completed (range), also when the value did not
     * change: a picker closes on it.
     */
    dateSelect: (_date: CalendarDate, _details: { readonly modality: Modality }) => true,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots, emit }) {
    const env = useEnvironment(announcerCapability, dateClockCapability)
    const instance = useRootId(() => props.id)
    const loc = useLocale(
      () => props.locale,
      () => props.dir,
    )
    const messages = useMessages("calendar", calendarMessages, () => props.messages)
    const resolved = computed(() => resolveCalendar(loc.value.locale, props.createCalendar))
    const firstDay = computed(() => weekStart(loc.value.locale, props.firstDayOfWeek))
    const show = (d: DateValue | null | undefined) =>
      d ? display(d, resolved.value.calendar) : null
    const nav = () => ({
      visibleMonths: props.visibleMonths,
      pageBehavior: props.pageBehavior,
      minValue: show(props.minValue),
      maxValue: show(props.maxValue),
      locale: loc.value.locale,
      firstDayOfWeek: firstDay.value,
    })
    const current = () => (props.modelValue === undefined ? props.defaultValue : props.modelValue)
    const today = () =>
      todayOf(env.dateClock, todayZone(props.timeZone, valuesOf(current() ?? null)))
    // The first focus: the given one, else the value, else today (calendar-navigation).
    const initial =
      show(props.defaultFocusedValue) ??
      initialCalendarFocus(
        show(valuesOf(current() ?? null)[0]),
        display(today(), resolved.value.calendar),
        nav(),
      ).focused
    let pendingFocus: { date: CalendarDate; modality: string | undefined } | null = null
    const range = () => ({
      minRangeLength: props.minRangeLength,
      maxRangeLength: props.maxRangeLength,
      allowsNonContiguousRanges: props.allowsNonContiguousRanges,
      commitOnBlur: props.commitOnBlur,
    })
    // A fixed view (controlled, no listener) is the only view: the value is chosen there.
    const fixedView = () =>
      props.view !== undefined && !props.onViewChange && !props["onUpdate:view"]
        ? props.view
        : undefined
    const periods = () => ({
      minView: fixedView() ?? props.minView,
      maxView: fixedView() ?? props.maxView,
      yearsPerPage: props.yearsPerPage,
      columns: props.columns,
      isMonthUnavailable: props.isMonthUnavailable,
      isYearUnavailable: props.isYearUnavailable,
    })
    const { view, send } = useMachine(
      calendarMachine,
      () => ({
        ...nav(),
        value: props.modelValue,
        defaultValue: props.defaultValue,
        onValueChange: (v: CalendarValue, details: unknown) => {
          const d = details as { event: { type: string; modality?: string }; cancel(): void }
          emit("valueChange", v, {
            reason:
              d.event.type === "CELL.PRESS"
                ? "CELL.PRESS"
                : d.event.type === "DRAG.END"
                  ? "DRAG"
                  : "KEY",
            modality: d.event.modality ?? "keyboard",
            cancel: d.cancel,
          })
          emit("update:modelValue", v)
        },
        focusedValue: show(props.focusedValue) ?? undefined,
        defaultFocusedValue: initial,
        onFocusedValueChange: (d: CalendarDate) => {
          emit("focusChange", d)
          emit("update:focusedValue", d)
        },
        ...(props.anchor !== undefined ? { anchor: show(props.anchor) } : {}),
        ...(props.defaultAnchor !== undefined ? { defaultAnchor: show(props.defaultAnchor) } : {}),
        onAnchorChange: (a: CalendarDate | null) => {
          emit("anchorChange", a)
          emit("update:anchor", a)
        },
        onDateSelect: (d: CalendarDate, details: { readonly modality: Modality }) =>
          emit("dateSelect", d, details),
        ...range(),
        ...periods(),
        view: props.view,
        defaultView: props.defaultView ?? props.minView,
        onViewChange: (v: CalendarView, details: unknown) => {
          const type = (details as { event: { type: string } }).event.type
          props.onViewChange?.(v, {
            reason:
              type === "VIEW.UP"
                ? "heading"
                : type === "VIEW.DOWN"
                  ? "escape-key"
                  : type === "CELL.PRESS" || type === "SELECT_FOCUSED"
                    ? "select"
                    : "api",
          })
          props["onUpdate:view"]?.(v)
        },
        selectionMode: props.selectionMode,
        isDateUnavailable: props.isDateUnavailable,
        disabled: props.disabled,
        readOnly: props.readOnly,
        invalid: props.invalid,
        calendar: resolved.value.calendar,
        formatLocale: resolved.value.formatLocale,
        messages: messages.value,
        id: instance(),
        focusCell: (d: CalendarDate, modality: string | undefined) => {
          pendingFocus = { date: d, modality }
        },
      }),
      env,
    )
    // Range mode's drag selection (spec "Drag Selection"): one per Root, wired to the machine.
    let canStart: (d: CalendarDate) => boolean = () => false
    const drag = createCalendarDrag({
      env,
      target: () => ({ instance: instance(), calendar: resolved.value.calendar }),
      canStart: (d) => canStart(d),
      delay: () => props.dragDelay,
      send: (e) => send(e),
    })
    onBeforeUnmount(() => drag.dispose())
    // The modality is tracked from mount: a pointer press that focuses a cell is seen as one.
    // Server markup marks no day as today (the server's day or zone may not be the viewer's).
    const mounted = shallowRef(false)
    onMounted(() => {
      mounted.value = true
      onBeforeUnmount(env.modality.subscribe(() => {}))
    })
    const modality = useModality(env.modality, () => view.value.matches("focused"))
    const anchored = () =>
      props.selectionMode === "range" ? (view.value.values.anchor ?? null) : null
    const api = computed(() => {
      const v = view.value
      const a = anchored()
      const { calendar, formatLocale } = resolved.value
      const id = instance()
      return calendarConnect({
        ...nav(),
        ...range(),
        ...periods(),
        view: viewIn(v.values.view, periods()),
        // Controlled and never changed: the heading is plain text (spec "View Drill-Down").
        viewFixed: fixedView() !== undefined,
        anchor: a ? display(a, calendar) : null,
        selectionMode: props.selectionMode,
        isDateUnavailable: props.isDateUnavailable,
        disabled: props.disabled,
        readOnly: props.readOnly,
        invalid: props.invalid,
        calendar,
        formatLocale,
        messages: messages.value,
        id,
        instance: id,
        value: v.values.value ?? null,
        focused: v.values.focusedValue,
        visibleStart: v.context.visibleStart,
        hovered: v.context.hovered,
        dragging: v.context.dragging,
        gridFocused: v.matches("focused"),
        modality: modality.value,
        today: mounted.value ? display(today(), calendar) : null,
        dir: loc.value.dir,
        consumerNamed: attrs["aria-label"] !== undefined || attrs["aria-labelledby"] !== undefined,
        ids: {
          heading: `calendar-${id}-heading`.replace(/:/g, ""),
          grid: (m) => `calendar-${id}-grid-${m}`.replace(/:/g, ""),
          prompt: `calendar-${id}-prompt`.replace(/:/g, ""),
        },
      })
    })
    const root = shallowRef<Element | null>(null)
    onMounted(() => {
      // After the step is rendered: DOM focus to the focused cell (keyboard and props only).
      watch(
        () => view.value,
        () => {
          const pending = pendingFocus
          if (!pending) return
          pendingFocus = null
          const cell = root.value?.querySelector<HTMLElement>(
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
        },
        { flush: "post", immediate: true },
      )
      // Range mode: leaving the Calendar while anchored applies commitOnBlur (spec "Range
      // Cancel And Leave"); inside is the root's subtree and the layers opened from it.
      watch(
        [() => anchored() !== null, root],
        ([on, el], _, onCleanup) => {
          if (on && el) onCleanup(watchLeave(el, () => send({ type: "LEAVE" })))
        },
        { immediate: true },
      )
      // Every change of the visible range is reported.
      watch(
        () => view.value.context.visibleStart.toString(),
        () => {
          const start = view.value.context.visibleStart
          emit("visibleRangeChange", { start, end: visibleEnd(start, nav()) })
        },
      )
      // While dragging, a touch does not scroll the page (a native non-passive listener).
      watch(
        root,
        (el, _, onCleanup) => {
          if (el) onCleanup(drag.attach(el))
        },
        { immediate: true },
      )
    })
    provide(CalendarKey, {
      view,
      send,
      api,
      instance,
      dragConsumes: drag.consumes,
      grid: (offset) =>
        monthGrid(
          view.value.context.visibleStart.add({ months: offset }),
          loc.value.locale,
          firstDay.value,
          props.fixedWeeks,
        ),
    })
    return () => {
      const a = api.value
      canStart = a.canDrag
      const isAnchored = anchored() !== null
      const merged = mergeProps(
        {
          ...normalizeProps(a.root()),
          // Escape anywhere inside cancels a range in progress and is consumed; with no anchor
          // (and in minView) it bubbles (to an enclosing dialog).
          onKeydown: (e: KeyboardEvent) => {
            // Then, in a view above minView, it goes one view down before any outer layer.
            if (e.key !== "Escape" || e.defaultPrevented || !(isAnchored || a.escapeGoesDown))
              return
            e.preventDefault()
            e.stopPropagation()
            send(isAnchored ? { type: "CANCEL" } : { type: "VIEW.DOWN" })
          },
          onPointerdown: (e: PointerEvent) => drag.pointerDown(e.currentTarget as Element, e),
          ref: refTo(root),
        },
        attrs,
      )
      // Range mode: the focused cell's prompt, read as its description.
      const prompt =
        props.selectionMode === "range"
          ? renderPart(
              "span",
              normalizeProps({ ...a.prompt(), style: visuallyHiddenStyle }),
              undefined,
            )
          : null
      return renderPart("div", merged, h(Fragment, [slots.default?.(), prompt]), props.asChild)
    }
  },
})

/** A part with no state of its own. */
function simplePart(
  name: string,
  tag: string,
  pick: (a: ReturnType<typeof calendarConnect>) => Record<string, unknown>,
) {
  return defineComponent({
    name: `Calendar${name}`,
    inheritAttrs: false,
    props: { ...asChildProp },
    slots: Object as Slots,
    setup(props, { attrs, slots }) {
      const ctx = useCalendar(name)
      return () =>
        renderPart(
          tag,
          mergeProps(normalizeProps(pick(ctx.api.value) as never), attrs),
          slots.default?.(),
          props.asChild,
        )
    },
  })
}

const Header = simplePart("Header", "div", (a) => a.header())
const GridHeader = simplePart("GridHeader", "thead", (a) => a.gridHeader())
const GridBody = simplePart("GridBody", "tbody", (a) => a.gridBody())
const Row = simplePart("Row", "tr", (a) => a.row())

const ViewTrigger = defineComponent({
  name: "CalendarViewTrigger",
  setup() {
    const ctx = useCalendar("Heading")
    const env = useEnvironment()
    const focused = shallowRef(false)
    const modality = useModality(env.modality, () => focused.value)
    const press = usePress({
      env,
      send: (e) => {
        if (e.type === "PRESS") ctx.send({ type: "VIEW.UP", modality: e.modality })
      },
    })
    return () => {
      const own = ctx.api.value.viewTrigger({ focused: focused.value, modality: modality.value })
      if (!own) return null
      const props = joinHandlers(normalizeProps(own), press.props, {
        onFocus: () => (focused.value = true),
        onBlur: () => (focused.value = false),
      })
      const { children: text, ...span } = normalizeProps(ctx.api.value.viewTriggerText())
      return h("button", { ...props, type: "button" }, [h("span", span, text as string)])
    }
  },
})

const Heading = defineComponent({
  name: "CalendarHeading",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useCalendar("Heading")
    return () => {
      const own = normalizeProps(ctx.api.value.heading())
      // With a higher view, the heading's text is a button one view up (spec "View Drill-Down").
      const content = ctx.api.value.viewTrigger() ? h(ViewTrigger) : slots.default?.()
      return renderPart("h2", mergeProps(own, attrs), content, props.asChild)
    }
  },
})

function trigger(direction: 1 | -1, name: string) {
  return defineComponent({
    name: `Calendar${name}`,
    inheritAttrs: false,
    props: { ...asChildProp },
    slots: Object as Slots,
    setup(props, { attrs, slots }) {
      const ctx = useCalendar(name)
      const env = useEnvironment()
      const focused = shallowRef(false)
      const modality = useModality(env.modality, () => focused.value)
      const own = () =>
        ctx.api.value.trigger(direction, { focused: focused.value, modality: modality.value })
      const press = usePress({
        env,
        disabled: () => own()["aria-disabled"] === "true",
        send: (e) => {
          if (e.type === "PRESS") ctx.send({ type: "PAGE", direction, modality: e.modality })
        },
      })
      return () =>
        renderPart(
          "button",
          mergeProps(
            joinHandlers(normalizeProps(own()), press.props, {
              onFocus: () => (focused.value = true),
              onBlur: () => (focused.value = false),
            }),
            attrs,
          ),
          slots.default?.(),
          props.asChild,
        )
    },
  })
}

const PrevTrigger = trigger(-1, "PrevTrigger")
const NextTrigger = trigger(1, "NextTrigger")

const HeaderCell = defineComponent({
  name: "CalendarHeaderCell",
  inheritAttrs: false,
  props: {
    ...asChildProp,
    /** The weekday, 0-6 from the week's first day. */
    day: { type: Number, required: true },
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useCalendar("HeaderCell")
    return () =>
      renderPart(
        "th",
        mergeProps(normalizeProps(ctx.api.value.headerCell(props.day)), attrs),
        slots.default?.(),
        props.asChild,
      )
  },
})

export interface CalendarCellState {
  readonly date: CalendarDate
  readonly selected: boolean
}

const Cell = defineComponent({
  name: "CalendarCell",
  inheritAttrs: false,
  props: {
    ...asChildProp,
    /** The date this cell shows and selects. */
    date: { type: Object as PropType<CalendarDate>, required: true },
  },
  slots: Object as Slots<CalendarCellState>,
  setup(props, { attrs, slots }) {
    const ctx = useCalendar("Cell")
    const env = useEnvironment()
    const month = inject(GridKey, () => 0)
    const own = () => ctx.api.value.cell(props.date, month())
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
          ctx.send({ type: "CELL.PRESS", date: props.date, modality: e.modality })
        }
      },
    })
    const hover = useHover({
      env,
      disabled,
      send: (e) => {
        if (e.type === "HOVER.START") ctx.send({ type: "CELL.HOVER", date: props.date })
      },
    })
    return () => {
      const p = own()
      return renderPart(
        "td",
        mergeProps(
          {
            ...joinHandlers(normalizeProps(p), press.props, hover.props),
            "data-pressed": press.pressed.value ? "" : undefined,
          },
          attrs,
        ),
        slots.default?.({ date: props.date, selected: p["data-selected"] !== undefined }),
        props.asChild,
      )
    }
  },
})

export interface CalendarGridState {
  readonly weeks: MonthGrid["weeks"]
  readonly month: CalendarDate
}

const Grid = defineComponent({
  name: "CalendarGrid",
  inheritAttrs: false,
  props: {
    ...asChildProp,
    /** The month offset from the first visible month. */
    month: { type: Number, default: 0 },
  },
  slots: Object as Slots<CalendarGridState>,
  setup(props, { attrs, slots }) {
    const ctx = useCalendar("Grid")
    const env = useEnvironment()
    provide(GridKey, () => props.month)
    return () => {
      const api = ctx.api.value
      // The month and year views have one grid per page: its rows are the page's periods.
      const days = api.view === "days"
      if (!days && props.month > 0) return null
      const g = days ? ctx.grid(props.month) : { weeks: api.periodRows(), month: ctx.grid(0).month }
      const { send } = ctx
      const handlers = {
        // React's onFocus / onBlur bubble: here, focusin / focusout.
        onFocusin: (e: FocusEvent) => {
          const cell = (e.target as HTMLElement).closest?.('[data-part="cell"]')
          if (!ctx.view.value.matches("focused"))
            send({ type: "GRID.FOCUS", modality: env.modality.modality() })
          const iso = cell?.getAttribute("data-value")
          if (!iso) return
          const d = g.weeks.flat().find((x) => isoOf(x) === iso)
          if (d) send({ type: "CELL.FOCUS", date: d, modality: env.modality.modality() })
        },
        onFocusout: (e: FocusEvent) => {
          const next = e.relatedTarget as HTMLElement | null
          const inside = next?.closest?.(
            `[data-scope="calendar"][data-part="grid"][data-instance="${CSS.escape(ctx.instance())}"]`,
          )
          if (!inside) send({ type: "GRID.BLUR" })
        },
        onKeydown: (e: KeyboardEvent) => {
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
        onPointerleave: () => send({ type: "GRID.HOVER_END" }),
      }
      const content = slots.default
        ? slots.default({ weeks: g.weeks, month: g.month })
        : [
            days
              ? h(GridHeader, null, () =>
                  h(
                    "tr",
                    [0, 1, 2, 3, 4, 5, 6].map((i) => h(HeaderCell, { key: i, day: i })),
                  ),
                )
              : null,
            h(GridBody, null, () =>
              g.weeks.map((week) =>
                h(Row, { key: isoOf(week[0] as CalendarDate) }, () =>
                  week.map((d) => h(Cell, { key: isoOf(d), date: d })),
                ),
              ),
            ),
          ]
      return renderPart(
        "table",
        mergeProps(joinHandlers(normalizeProps(api.grid(props.month)), handlers), attrs),
        content,
        props.asChild,
      )
    }
  },
})

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
