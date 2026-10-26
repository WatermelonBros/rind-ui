// Calendar parts: wiring only. The machine owns the value, the focused date and the visible
// range; connect every attribute and the key mapping; navigation is pure core logic.
import {
  afterNextRender,
  afterRenderEffect,
  booleanAttribute,
  Component,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  effect,
  forwardRef,
  InjectionToken,
  inject,
  input,
  numberAttribute,
  output,
  PLATFORM_ID,
  type Signal,
  signal,
  untracked,
  ViewEncapsulation,
} from "@angular/core"
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
  type PartProps,
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
import { absentProps } from "../absent"
import { bindProps, joinHandlers } from "../bind-props"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectHover, injectModality, injectPress } from "../inject-press"
import { injectRendered } from "../layer-context"
import { injectEnvironment, injectLocale, injectMessages } from "../provider"
import { RindProps } from "../rind-props"

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

/** What a `valueChangeDetails` output emits. */
export interface CalendarValueEvent {
  readonly value: CalendarValue
  readonly details: CalendarChangeDetails
}

/** What a `viewChangeDetails` output emits. */
export interface CalendarViewEvent {
  readonly view: CalendarView
  readonly details: CalendarViewChangeDetails
}

/** What a `dateSelect` output emits. */
export interface CalendarDateSelectEvent {
  readonly date: CalendarDate
  readonly modality: Modality
}

const CALENDAR = new InjectionToken<CalendarRootBase>("rind-ui.calendar")

/** The provider a Calendar root (or a component built on it) declares for its parts. Internal. */
export const CALENDAR_ROOT = CALENDAR

/** The Calendar root's template: its content, then range mode's prompt. Internal. */
export const CALENDAR_TEMPLATE = `<ng-content />@if (mode() === "range") {<span [rindProps]="promptProps()"></span>}`
const GRID = new InjectionToken<CalendarGrid>("rind-ui.calendar-grid")

function injectCalendar(part: string): CalendarRootBase {
  const root = inject(CALENDAR, { optional: true })
  if (!root) throw new Error(`rindCalendar${part} must be inside rindCalendarRoot`)
  return root
}

const optionalBoolean = (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false)
const optionalNumber = (v: number | string | undefined) =>
  v === undefined ? undefined : numberAttribute(v)

/**
 * What a component built on the Calendar (a Date Field's picker) decides: each one it leaves
 * out stays the Calendar's input. Internal.
 */
export interface CalendarSource {
  /** Controlled (null: no value) when given. */
  readonly value?: () => CalendarValue
  readonly focusedValue?: () => CalendarDate
  readonly minValue?: () => DateValue | null
  readonly maxValue?: () => DateValue | null
  readonly isDateUnavailable?: () => ((date: CalendarDate) => boolean) | undefined
  readonly disabled?: () => boolean
  readonly readOnly?: () => boolean
  readonly invalid?: () => boolean
  readonly firstDayOfWeek?: () => DayOfWeek | undefined
  readonly selectionMode?: () => CalendarSelectionMode
  readonly defaultAnchor?: () => CalendarDate | null | undefined
  readonly commitOnBlur?: () => CalendarCommitOnBlur
  readonly allowsNonContiguousRanges?: () => boolean
  readonly onValueChange?: (value: CalendarValue, details: CalendarChangeDetails) => void
  readonly onFocusChange?: (date: CalendarDate) => void
  readonly onDateSelect?: (date: CalendarDate, details: { readonly modality: Modality }) => void
  /** The host field's locale, direction and calendar system (a picker shows the field's). */
  readonly locale?: () => string | undefined
  readonly dir?: () => "ltr" | "rtl" | undefined
  readonly createCalendar?: () => CreateCalendar | undefined
}

/** The Calendar's inputs, outputs and wiring: CalendarRoot and a picker's Calendar. Internal. */
@Directive()
export abstract class CalendarRootBase {
  /** The base of the parts' ids. Default: generated. */
  readonly id = input<string>()
  /** The value (`[(value)]`). */
  readonly value = input<CalendarValue>()
  readonly defaultValue = input<CalendarValue>()
  readonly selectionMode = input<CalendarSelectionMode>("single")
  /** The focused date (`[(focusedValue)]`). */
  readonly focusedValue = input<DateValue>()
  readonly defaultFocusedValue = input<DateValue>()
  readonly minValue = input<DateValue | null>(null)
  readonly maxValue = input<DateValue | null>(null)
  /** `anchor`: in range mode, the first end while a range is being selected, else null. */
  readonly isDateUnavailable =
    input<(date: CalendarDate, details: { readonly anchor: CalendarDate | null }) => boolean>()
  /** Range mode: the first end while a range is being selected (`[(anchor)]`). */
  readonly anchor = input<CalendarDate | null>()
  readonly defaultAnchor = input<CalendarDate | null>()
  /** Range mode: length bounds in days, both ends included. */
  readonly minRangeLength = input<number | undefined, number | string | undefined>(undefined, {
    transform: optionalNumber,
  })
  /** Range mode: longest range in days (ends included); farther ends are disabled. */
  readonly maxRangeLength = input<number | undefined, number | string | undefined>(undefined, {
    transform: optionalNumber,
  })
  /** Range mode: a range may contain unavailable dates (default false). */
  readonly allowsNonContiguousRanges = input(false, { transform: booleanAttribute })
  /** Range mode: what leaving while anchored does (default "reset"). */
  readonly commitOnBlur = input<CalendarCommitOnBlur>("reset")
  /** Range mode, touch: how long (ms) a touch is held still before it starts a drag. */
  readonly dragDelay = input(200, { transform: numberAttribute })
  /** Months shown side by side. Default: 1. */
  readonly visibleMonths = input(1, { transform: numberAttribute })
  /** A trigger pages by all visible months, or by one. Default: "visible". */
  readonly pageBehavior = input<"visible" | "single">("visible")
  /** Always six weeks per month. */
  readonly fixedWeeks = input(false, { transform: booleanAttribute })
  readonly firstDayOfWeek = input<DayOfWeek>()
  readonly locale = input<string>()
  /** Reading direction; RTL mirrors the arrow keys. Default: the provider's. */
  readonly dir = input<"ltr" | "rtl">()
  /** Calendar systems other than gregorian (`createCalendar` from @internationalized/date). */
  readonly createCalendar = input<CreateCalendar>()
  /** The zone "today" is read in (default: the value's, then the viewer's). */
  readonly timeZone = input<string>()
  readonly disabled = input(false, { transform: booleanAttribute })
  readonly readOnly = input(false, { transform: booleanAttribute })
  /** Shown invalid whatever the value (a host field's own validity). */
  readonly invalid = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** Every string reaching assistive technology. */
  readonly messages = input<MessageOverrides<CalendarMessages>>()
  /** The shown view (`[(view)]`): days, the months of a year, or a page of years. */
  readonly view = input<CalendarView>()
  /** The view shown first (uncontrolled). Default: `minView`. */
  readonly defaultView = input<CalendarView>()
  /** The lowest view (default "days"): the value is chosen there; higher views drill down. */
  readonly minView = input<CalendarView>("days")
  /** The highest view the heading drills up to (default "years"). */
  readonly maxView = input<CalendarView>("years")
  /** A controlled `view` that never changes: the only view, the heading plain text. */
  readonly fixedView = input(false, { transform: booleanAttribute })
  /** Years per page in the years view (default 12). */
  readonly yearsPerPage = input<number | undefined, number | string | undefined>(undefined, {
    transform: optionalNumber,
  })
  /** Cells per row in the month and year views (default 4). */
  readonly columns = input<number | undefined, number | string | undefined>(undefined, {
    transform: optionalNumber,
  })
  /** Month view availability, told the month's first day. */
  readonly isMonthUnavailable = input<(month: CalendarDate) => boolean>()
  /** Year view availability, told the year's first day. */
  readonly isYearUnavailable = input<(year: CalendarDate) => boolean>()
  readonly valueChangeDetails = output<CalendarValueEvent>()
  /** The value, for `[(value)]`. */
  readonly valueChange = output<CalendarValue>()
  /** The focused date, for `[(focusedValue)]`. */
  readonly focusedValueChange = output<CalendarDate>()
  /** The visible months changed. */
  readonly visibleRangeChange = output<{ start: CalendarDate; end: CalendarDate }>()
  /** The anchor, for `[(anchor)]`. */
  readonly anchorChange = output<CalendarDate | null>()
  /**
   * A date was chosen (single) or a range completed (range), also when the value did not
   * change: a picker closes on it.
   */
  readonly dateSelect = output<CalendarDateSelectEvent>()
  readonly viewChangeDetails = output<CalendarViewEvent>()
  /** The view, for `[(view)]`. */
  readonly viewChange = output<CalendarView>()

  /** @internal */
  api!: Signal<ReturnType<typeof calendarConnect>>
  /** @internal */
  machineView!: ReturnType<typeof injectMachine<typeof calendarMachine>>["view"]
  /** @internal */
  send!: ReturnType<typeof injectMachine<typeof calendarMachine>>["send"]
  /** @internal */
  instance!: () => string
  /** @internal Range mode: a press that dragged has already been handled. */
  dragConsumes!: (press: { readonly pointerType: string }) => boolean
  /** @internal */
  grid!: (offset: number) => MonthGrid
  /** @internal */
  protected promptProps!: Signal<PartProps>
  /** @internal */
  protected mode!: () => CalendarSelectionMode

  /** @internal The picker's own values, else the inputs. Call it from the constructor. */
  protected wire(src: CalendarSource = {}): void {
    const value_ = () => (src.value ? src.value() : this.value())
    const focusedValue_ = () => (src.focusedValue ? src.focusedValue() : this.focusedValue())
    const minValue_ = () => (src.minValue ? src.minValue() : this.minValue())
    const maxValue_ = () => (src.maxValue ? src.maxValue() : this.maxValue())
    const isDateUnavailable_ = () =>
      src.isDateUnavailable ? src.isDateUnavailable() : this.isDateUnavailable()
    const disabled_ = () => (src.disabled ? src.disabled() : this.disabled())
    const readOnly_ = () => (src.readOnly ? src.readOnly() : this.readOnly())
    const invalid_ = () => (src.invalid ? src.invalid() : this.invalid())
    const firstDayOfWeek_ = () =>
      src.firstDayOfWeek ? src.firstDayOfWeek() : this.firstDayOfWeek()
    const selectionMode_ = () => (src.selectionMode ? src.selectionMode() : this.selectionMode())
    const defaultAnchor_ = () => (src.defaultAnchor ? src.defaultAnchor() : this.defaultAnchor())
    const commitOnBlur_ = () => (src.commitOnBlur ? src.commitOnBlur() : this.commitOnBlur())
    const allows_ = () =>
      src.allowsNonContiguousRanges
        ? src.allowsNonContiguousRanges()
        : this.allowsNonContiguousRanges()
    this.mode = selectionMode_
    const env = injectEnvironment(announcerCapability, dateClockCapability)
    const el: Element = inject(ElementRef).nativeElement
    const instance = injectRootId(() => this.id())
    this.instance = instance
    const loc = injectLocale(
      () => (src.locale ? src.locale() : this.locale()),
      () => (src.dir ? src.dir() : this.dir()),
    )
    const messages = injectMessages("calendar", calendarMessages, () => this.messages())
    const resolved = computed(() =>
      resolveCalendar(
        loc().locale,
        src.createCalendar ? src.createCalendar() : this.createCalendar(),
      ),
    )
    const firstDay = computed(() => weekStart(loc().locale, firstDayOfWeek_()))
    const show = (d: DateValue | null | undefined) => (d ? display(d, resolved().calendar) : null)
    const nav = () => ({
      visibleMonths: this.visibleMonths(),
      pageBehavior: this.pageBehavior(),
      minValue: show(minValue_()),
      maxValue: show(maxValue_()),
      locale: loc().locale,
      firstDayOfWeek: firstDay(),
    })
    const current = () => (value_() === undefined ? this.defaultValue() : value_())
    const rendered = injectRendered()
    const today = () =>
      todayOf(env.dateClock, todayZone(this.timeZone(), valuesOf(current() ?? null)))
    // The first focus: the given one, else the value, else today (calendar-navigation).
    let initial: CalendarDate | undefined
    const initialFocus = () => {
      initial ??=
        show(untracked(this.defaultFocusedValue)) ??
        initialCalendarFocus(
          show(valuesOf(untracked(current) ?? null)[0]),
          display(untracked(today), untracked(resolved).calendar),
          untracked(nav),
        ).focused
      return initial
    }
    let pendingFocus: { date: CalendarDate; modality: string | undefined } | null = null
    const range = () => ({
      minRangeLength: this.minRangeLength(),
      maxRangeLength: this.maxRangeLength(),
      allowsNonContiguousRanges: allows_(),
      commitOnBlur: commitOnBlur_(),
    })
    // A fixed view (controlled, never changing) is the only view: the value is chosen there.
    const fixed = () => {
      const v = this.view()
      return v !== undefined && this.fixedView() ? v : undefined
    }
    const periods = () => ({
      minView: fixed() ?? this.minView(),
      maxView: fixed() ?? this.maxView(),
      yearsPerPage: this.yearsPerPage(),
      columns: this.columns(),
      isMonthUnavailable: this.isMonthUnavailable(),
      isYearUnavailable: this.isYearUnavailable(),
    })
    const { view, send } = injectMachine(
      calendarMachine,
      () => {
        const anchor = this.anchor()
        const defaultAnchor = defaultAnchor_()
        return {
          ...nav(),
          value: value_(),
          defaultValue: this.defaultValue(),
          onValueChange: (v: CalendarValue, details: unknown) => {
            const d = details as { event: { type: string; modality?: string }; cancel(): void }
            const out: CalendarChangeDetails = {
              reason:
                d.event.type === "CELL.PRESS"
                  ? "CELL.PRESS"
                  : d.event.type === "DRAG.END"
                    ? "DRAG"
                    : "KEY",
              modality: d.event.modality ?? "keyboard",
              cancel: d.cancel,
            }
            src.onValueChange?.(v, out)
            this.valueChangeDetails.emit({ value: v, details: out })
            this.valueChange.emit(v)
          },
          focusedValue: show(focusedValue_()) ?? undefined,
          defaultFocusedValue: initialFocus(),
          onFocusedValueChange: (d: CalendarDate) => {
            src.onFocusChange?.(d)
            this.focusedValueChange.emit(d)
          },
          ...(anchor !== undefined ? { anchor: show(anchor) } : {}),
          ...(defaultAnchor !== undefined ? { defaultAnchor: show(defaultAnchor) } : {}),
          onAnchorChange: (a: CalendarDate | null) => this.anchorChange.emit(a),
          onDateSelect: (d: CalendarDate, details: { readonly modality: Modality }) => {
            src.onDateSelect?.(d, details)
            this.dateSelect.emit({ date: d, modality: details.modality })
          },
          ...range(),
          ...periods(),
          view: this.view(),
          defaultView: this.defaultView() ?? this.minView(),
          onViewChange: (v: CalendarView, details: unknown) => {
            const type = (details as { event: { type: string } }).event.type
            this.viewChangeDetails.emit({
              view: v,
              details: {
                reason:
                  type === "VIEW.UP"
                    ? "heading"
                    : type === "VIEW.DOWN"
                      ? "escape-key"
                      : type === "CELL.PRESS" || type === "SELECT_FOCUSED"
                        ? "select"
                        : "api",
              },
            })
            this.viewChange.emit(v)
          },
          selectionMode: selectionMode_(),
          isDateUnavailable: isDateUnavailable_(),
          disabled: disabled_(),
          readOnly: readOnly_(),
          invalid: invalid_(),
          calendar: resolved().calendar,
          formatLocale: resolved().formatLocale,
          messages: messages(),
          id: instance(),
          focusCell: (d: CalendarDate, modality: string | undefined) => {
            pendingFocus = { date: d, modality }
          },
        }
      },
      env,
    )
    this.machineView = view
    this.send = send
    // Range mode's drag selection (spec "Drag Selection"): one per Root, wired to the machine.
    let canStart: (d: CalendarDate) => boolean = () => false
    const drag = createCalendarDrag({
      env,
      target: () => ({ instance: untracked(instance), calendar: untracked(resolved).calendar }),
      canStart: (d) => canStart(d),
      delay: () => untracked(this.dragDelay),
      send: (e) => send(e),
    })
    this.dragConsumes = drag.consumes
    inject(DestroyRef).onDestroy(() => drag.dispose())
    const modality = injectModality(env.modality, () => view().matches("focused"))
    const anchored = () => (selectionMode_() === "range" ? (view().values.anchor ?? null) : null)
    let named = false
    this.api = computed(() => {
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
        viewFixed: fixed() !== undefined,
        anchor: a ? display(a, calendar) : null,
        selectionMode: selectionMode_(),
        isDateUnavailable: isDateUnavailable_(),
        disabled: disabled_(),
        readOnly: readOnly_(),
        invalid: invalid_(),
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
        gridFocused: v.matches("focused"),
        modality: modality(),
        // Server markup marks no day as today (the server's day or zone may not be the viewer's).
        today: rendered() ? display(today(), calendar) : null,
        dir: loc().dir,
        consumerNamed: named,
        ids: {
          heading: `calendar-${id}-heading`.replace(/:/g, ""),
          grid: (m) => `calendar-${id}-grid-${m}`.replace(/:/g, ""),
          prompt: `calendar-${id}-prompt`.replace(/:/g, ""),
        },
      })
    })
    this.grid = (offset) =>
      monthGrid(
        view().context.visibleStart.add({ months: offset }),
        loc().locale,
        firstDay(),
        this.fixedWeeks(),
      )
    this.promptProps = computed(() => ({ ...this.api().prompt(), style: visuallyHiddenStyle }))
    const { statics } = bindProps(
      () => {
        const a = this.api()
        canStart = a.canDrag
        const isAnchored = anchored() !== null
        return joinHandlers(a.root(), {
          // Escape anywhere inside cancels a range in progress and is consumed; with no anchor
          // (and in minView) it bubbles (to an enclosing dialog). In a view above minView, it
          // goes one view down before any outer layer.
          onKeyDown: (e: KeyboardEvent) => {
            if (e.key !== "Escape" || e.defaultPrevented || !(isAnchored || a.escapeGoesDown)) {
              return
            }
            e.preventDefault()
            e.stopPropagation()
            send(isAnchored ? { type: "CANCEL" } : { type: "VIEW.DOWN" })
          },
          onPointerDown: (e: PointerEvent) => drag.pointerDown(e.currentTarget as Element, e),
        })
      },
      {
        owns: [
          "id",
          "selectionmode",
          "visiblemonths",
          "pagebehavior",
          "fixedweeks",
          "firstdayofweek",
          "locale",
          "dir",
          "timezone",
          "disabled",
          "readonly",
          "minview",
          "maxview",
          "defaultview",
          "fixedview",
          "commitonblur",
          "dragdelay",
          "allowsnoncontiguousranges",
        ],
      },
    )
    named = statics.has("aria-label") || statics.has("aria-labelledby")
    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    // The modality is tracked from render: a pointer press that focuses a cell is seen as one.
    afterNextRender(() => destroy.onDestroy(env.modality.subscribe(() => {})))
    // After the step is rendered: DOM focus to the focused cell (keyboard and props only).
    afterRenderEffect(() => {
      view()
      const pending = pendingFocus
      if (!pending) return
      pendingFocus = null
      const cell = el.querySelector<HTMLElement>(
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
    // Range mode: leaving the Calendar while anchored applies commitOnBlur (spec "Range
    // Cancel And Leave"); inside is the root's subtree and the layers opened from it.
    const ready = injectRendered()
    effect((onCleanup) => {
      if (!ready() || anchored() === null) return
      onCleanup(watchLeave(el, () => send({ type: "LEAVE" })))
    })
    // Every change of the visible range is reported.
    let lastStart: string | undefined
    effect(() => {
      const start = view().context.visibleStart
      const key = start.toString()
      if (!ready()) {
        lastStart = key
        return
      }
      if (key === lastStart) return
      lastStart = key
      untracked(() => this.visibleRangeChange.emit({ start, end: visibleEnd(start, nav()) }))
    })
    // While dragging, a touch does not scroll the page (a native non-passive listener).
    afterNextRender(() => destroy.onDestroy(drag.attach(el)))
  }
}

/**
 * A month grid to pick a date, several dates or a range: `<div rindCalendarRoot>` with a
 * Header (PrevTrigger, Heading, NextTrigger) and one Grid per visible month.
 */
@Component({
  selector: "[rindCalendarRoot]",
  exportAs: "rindCalendarRoot",
  imports: [RindProps],
  encapsulation: ViewEncapsulation.None,
  providers: [{ provide: CALENDAR, useExisting: forwardRef(() => CalendarRoot) }],
  // Range mode: the focused cell's prompt, read as its description.
  template: CALENDAR_TEMPLATE,
})
export class CalendarRoot extends CalendarRootBase {
  constructor() {
    super()
    this.wire()
  }
}

/** A part with no state of its own. */
@Directive()
abstract class SimplePart {
  protected wire(name: string, pick: (a: ReturnType<typeof calendarConnect>) => PartProps) {
    const ctx = injectCalendar(name)
    bindProps(() => pick(ctx.api()))
  }
}

@Directive({ selector: "[rindCalendarHeader]", exportAs: "rindCalendarHeader" })
export class CalendarHeader extends SimplePart {
  constructor() {
    super()
    this.wire("Header", (a) => a.header())
  }
}

@Directive({ selector: "[rindCalendarGridHeader]", exportAs: "rindCalendarGridHeader" })
export class CalendarGridHeader extends SimplePart {
  constructor() {
    super()
    this.wire("GridHeader", (a) => a.gridHeader())
  }
}

@Directive({ selector: "[rindCalendarGridBody]", exportAs: "rindCalendarGridBody" })
export class CalendarGridBody extends SimplePart {
  constructor() {
    super()
    this.wire("GridBody", (a) => a.gridBody())
  }
}

@Directive({ selector: "[rindCalendarRow]", exportAs: "rindCalendarRow" })
export class CalendarRow extends SimplePart {
  constructor() {
    super()
    this.wire("Row", (a) => a.row())
  }
}

/**
 * The visible period: `<h2 rindCalendarHeading>`. With a higher view, its text is a button
 * one view up (spec "View Drill-Down").
 */
@Component({
  selector: "[rindCalendarHeading]",
  exportAs: "rindCalendarHeading",
  imports: [RindProps],
  encapsulation: ViewEncapsulation.None,
  template: `<ng-content>@if (trigger(); as t) {<button type="button" [rindProps]="t"><span [rindProps]="triggerText()"></span></button>} @else {{{ text() }}}</ng-content>`,
})
export class CalendarHeading {
  /** @internal */
  protected readonly trigger: Signal<PartProps | null>
  /** @internal */
  protected readonly triggerText: Signal<PartProps>
  /** @internal */
  protected readonly text: Signal<unknown>
  constructor() {
    const ctx = injectCalendar("Heading")
    const env = injectEnvironment()
    const focused = signal(false)
    const modality = injectModality(env.modality, focused)
    const press = injectPress({
      env,
      send: (e) => {
        if (e.type === "PRESS") ctx.send({ type: "VIEW.UP", modality: e.modality })
      },
    })
    this.trigger = computed(() => {
      const own = ctx.api().viewTrigger({ focused: focused(), modality: modality() })
      return own
        ? joinHandlers(own, press.props, {
            onFocus: () => focused.set(true),
            onBlur: () => focused.set(false),
          })
        : null
    })
    this.triggerText = computed(() => ctx.api().viewTriggerText())
    this.text = computed(() => ctx.api().heading()["children"])
    // The text is the template's (the button replaces it): the heading's own props only.
    bindProps(() => {
      const { children: _children, ...own } = ctx.api().heading()
      return own
    })
  }
}

/** Pages back or forward: `<button rindCalendarPrevTrigger>` / `rindCalendarNextTrigger`. */
@Directive()
abstract class PageTrigger {
  protected wire(direction: 1 | -1, name: string) {
    const ctx = injectCalendar(name)
    const env = injectEnvironment()
    const focused = signal(false)
    const modality = injectModality(env.modality, focused)
    const own = () => ctx.api().trigger(direction, { focused: focused(), modality: modality() })
    const press = injectPress({
      env,
      disabled: () => untracked(own)["aria-disabled"] === "true",
      send: (e) => {
        if (e.type === "PRESS") ctx.send({ type: "PAGE", direction, modality: e.modality })
      },
    })
    bindProps(() =>
      joinHandlers(own(), press.props, {
        onFocus: () => focused.set(true),
        onBlur: () => focused.set(false),
      }),
    )
  }
}

@Directive({ selector: "[rindCalendarPrevTrigger]", exportAs: "rindCalendarPrevTrigger" })
export class CalendarPrevTrigger extends PageTrigger {
  constructor() {
    super()
    this.wire(-1, "PrevTrigger")
  }
}

@Directive({ selector: "[rindCalendarNextTrigger]", exportAs: "rindCalendarNextTrigger" })
export class CalendarNextTrigger extends PageTrigger {
  constructor() {
    super()
    this.wire(1, "NextTrigger")
  }
}

/** A weekday's heading: `<th rindCalendarHeaderCell [day]="0">` (0-6 from the week's first day). */
@Directive({ selector: "[rindCalendarHeaderCell]", exportAs: "rindCalendarHeaderCell" })
export class CalendarHeaderCell {
  /** The weekday, 0-6 from the week's first day. */
  readonly day = input.required<number>()
  constructor() {
    const ctx = injectCalendar("HeaderCell")
    bindProps(() => ctx.api().headerCell(this.day()), { owns: ["day"] })
  }
}

export interface CalendarCellState {
  readonly date: CalendarDate
  readonly selected: boolean
}

/** A day (or a month, a year): `<td rindCalendarCell [date]="d">`. */
@Directive({ selector: "[rindCalendarCell]", exportAs: "rindCalendarCell" })
export class CalendarCell {
  /** The date this cell shows and selects. */
  readonly date = input.required<CalendarDate>()
  /** The cell's state, for the template. */
  readonly state: Signal<CalendarCellState>
  constructor() {
    const ctx = injectCalendar("Cell")
    const env = injectEnvironment()
    const grid = inject(GRID, { optional: true })
    const own = computed(() => ctx.api().cell(this.date(), grid?.month() ?? 0))
    const placeholder = () => own()["data-outside-month"] !== undefined
    const disabled = () => own()["data-disabled"] !== undefined
    const press = injectPress({
      env,
      disabled: () => untracked(placeholder) || untracked(disabled),
      send: (e) => {
        // A placeholder never selects (react-spectrum#3257); release, not press, selects.
        // Enter and Space are the grid's keys (SELECT_FOCUSED): a key press here would select
        // twice (a multiple selection toggles back).
        // A press that dragged was handled by the drag (its release is not a second click).
        if (
          e.type === "PRESS" &&
          e.pointerType !== "keyboard" &&
          !untracked(placeholder) &&
          !untracked(disabled) &&
          !ctx.dragConsumes(e)
        ) {
          ctx.send({ type: "CELL.PRESS", date: untracked(this.date), modality: e.modality })
        }
      },
    })
    const hover = injectHover({
      env,
      disabled: () => untracked(disabled),
      send: (e) => {
        if (e.type === "HOVER.START") ctx.send({ type: "CELL.HOVER", date: untracked(this.date) })
      },
    })
    this.state = computed(() => ({
      date: this.date(),
      selected: own()["data-selected"] !== undefined,
    }))
    bindProps(() => ({
      ...joinHandlers(own(), press.props, hover.props),
      "data-pressed": press.pressed() ? "" : undefined,
    }))
  }
}

export interface CalendarGridState {
  readonly weeks: MonthGrid["weeks"]
  readonly month: CalendarDate
}

/**
 * One month (or the month or year view's page): `<table rindCalendarGrid [month]="0">`. Empty,
 * it renders its weekday headers, rows and cells itself; `#g="rindCalendarGrid"`,
 * `g.state().weeks`, for cells of your own.
 */
@Component({
  selector: "[rindCalendarGrid]",
  exportAs: "rindCalendarGrid",
  imports: [
    forwardRef(() => CalendarGridHeader),
    forwardRef(() => CalendarGridBody),
    forwardRef(() => CalendarRow),
    forwardRef(() => CalendarHeaderCell),
    forwardRef(() => CalendarCell),
  ],
  encapsulation: ViewEncapsulation.None,
  providers: [{ provide: GRID, useExisting: forwardRef(() => CalendarGrid) }],
  template: `<ng-content>@if (shown()) {@if (days()) {<thead rindCalendarGridHeader><tr>@for (i of weekdays; track i) {<th rindCalendarHeaderCell [day]="i"></th>}</tr></thead>}<tbody rindCalendarGridBody>@for (week of state().weeks; track key(week[0])) {<tr rindCalendarRow>@for (d of week; track key(d)) {<td rindCalendarCell [date]="d"></td>}</tr>}</tbody>}</ng-content>`,
})
export class CalendarGrid {
  /** The month offset from the first visible month. */
  readonly month = input(0, { transform: numberAttribute })
  /** The grid's weeks and month, for the template. */
  readonly state: Signal<CalendarGridState>
  /** @internal */
  protected readonly days: Signal<boolean>
  /** @internal The month and year views have one grid: a later month's grid is absent. */
  protected readonly shown: Signal<boolean>
  /** @internal */
  protected readonly weekdays = [0, 1, 2, 3, 4, 5, 6]
  /** @internal */
  protected readonly key = (d: CalendarDate | undefined) => (d ? isoOf(d) : "")

  constructor() {
    const ctx = injectCalendar("Grid")
    const env = injectEnvironment()
    // The month and year views have one grid per page: its rows are the page's periods.
    this.days = computed(() => ctx.api().view === "days")
    this.shown = computed(() => this.days() || this.month() === 0)
    this.state = computed(() =>
      this.days()
        ? ctx.grid(this.month())
        : { weeks: ctx.api().periodRows(), month: ctx.grid(0).month },
    )
    const send = ctx.send
    bindProps(
      () => {
        const api = ctx.api()
        if (!this.shown()) return absentProps("calendar", ctx.instance())
        const g = this.state()
        return joinHandlers(api.grid(this.month()), {
          // React's onFocus / onBlur bubble: here, focusin / focusout.
          onFocusIn: (e: FocusEvent) => {
            const cell = (e.target as HTMLElement).closest?.('[data-part="cell"]')
            if (!untracked(ctx.machineView).matches("focused")) {
              send({ type: "GRID.FOCUS", modality: env.modality.modality() })
            }
            const iso = cell?.getAttribute("data-value")
            if (!iso) return
            const d = g.weeks.flat().find((x) => isoOf(x) === iso)
            if (d) send({ type: "CELL.FOCUS", date: d, modality: env.modality.modality() })
          },
          onFocusOut: (e: FocusEvent) => {
            const next = e.relatedTarget as HTMLElement | null
            const inside = next?.closest?.(
              `[data-scope="calendar"][data-part="grid"][data-instance="${CSS.escape(untracked(ctx.instance))}"]`,
            )
            if (!inside) send({ type: "GRID.BLUR" })
          },
          onKeyDown: (e: KeyboardEvent) => {
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
        })
      },
      { owns: ["month"] },
    )
  }
}

/** The Calendar's parts, for a standalone component's `imports`. */
export const Calendar = [
  CalendarRoot,
  CalendarHeader,
  CalendarHeading,
  CalendarPrevTrigger,
  CalendarNextTrigger,
  CalendarGrid,
  CalendarGridHeader,
  CalendarGridBody,
  CalendarRow,
  CalendarHeaderCell,
  CalendarCell,
] as const
