import type {
  CalendarCommitOnBlur,
  CalendarDate,
  CalendarMessages,
  CalendarSelectionMode,
  CalendarValue,
  CalendarView,
  CreateCalendar,
  DateValue,
  DayOfWeek,
  MessageOverrides,
  Modality,
  MonthGrid,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type {
  HTMLAttributes,
  HTMLButtonAttributes,
  HTMLTdAttributes,
  HTMLThAttributes,
} from "svelte/elements"
import type { ChildArgs } from "../child"

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

export interface CalendarGridState {
  readonly weeks: MonthGrid["weeks"]
  readonly month: CalendarDate
}

export interface CalendarCellState {
  readonly date: CalendarDate
  readonly selected: boolean
}

type Part<A, S = undefined> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<S>]> | undefined
  readonly children?: (S extends undefined ? Snippet : Snippet<[S]>) | undefined
}

export type CalendarRootProps = Part<Omit<HTMLAttributes<HTMLDivElement>, "dir" | "onchange">> & {
  /** The value; `bind:value` controls it. */
  value?: CalendarValue | undefined
  readonly defaultValue?: CalendarValue | undefined
  readonly onValueChange?:
    | ((value: CalendarValue, details: CalendarChangeDetails) => void)
    | undefined
  readonly selectionMode?: CalendarSelectionMode | undefined
  /** The focused date; `bind:focusedValue` controls it. */
  focusedValue?: DateValue | undefined
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
  /** Range mode: the first end while a range is being selected; `bind:anchor` controls it. */
  anchor?: CalendarDate | null | undefined
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
  /** Range mode, touch: how long (ms) a touch is held still before it starts a drag. */
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
  /** The shown view; `bind:view` controls it. */
  view?: CalendarView | undefined
  /** The view shown first (uncontrolled). Default: `minView`. */
  readonly defaultView?: CalendarView | undefined
  /** The view changed; a listener (or `bind:view`) makes a controlled view changeable. */
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

export type CalendarHeaderProps = Part<HTMLAttributes<HTMLDivElement>>
export type CalendarHeadingProps = Part<HTMLAttributes<HTMLHeadingElement>>
export type CalendarTriggerProps = Part<HTMLButtonAttributes>
export type CalendarGridProps = Omit<HTMLAttributes<HTMLTableElement>, "children"> & {
  readonly child?: Snippet<[ChildArgs<undefined>]> | undefined
  /** The month offset from the first visible month. */
  readonly month?: number | undefined
  /** The grid's content from its weeks; default: header and body. */
  readonly children?: Snippet<[CalendarGridState]> | undefined
}
export type CalendarGridHeaderProps = Part<HTMLAttributes<HTMLTableSectionElement>>
export type CalendarHeaderCellProps = Part<HTMLThAttributes> & {
  /** The weekday, 0-6 from the week's first day. */
  readonly day: number
}
export type CalendarGridBodyProps = Part<HTMLAttributes<HTMLTableSectionElement>>
export type CalendarRowProps = Part<HTMLAttributes<HTMLTableRowElement>>
export type CalendarCellProps = Part<HTMLTdAttributes, CalendarCellState> & {
  /** The date this cell shows and selects. */
  readonly date: CalendarDate
}
