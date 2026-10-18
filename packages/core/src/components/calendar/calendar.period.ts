// period-navigation (spec): pages of months or years and the moves between them, as pure date
// logic over CalendarDates in the display calendar — no DOM, no current time. A period is the
// date of its first day; `set` constrains a field to the calendar's (and era's) bounds, so a
// year's first day inside an era that starts mid-year is the era's first day.

import type { CalendarDate } from "@internationalized/date"

export type CalendarView = "days" | "months" | "years"
export type PeriodView = Exclude<CalendarView, "days">

export type PeriodMove =
  | "next"
  | "previous"
  | "next-row"
  | "previous-row"
  | "first"
  | "last"
  | "next-page"
  | "previous-page"

export interface PeriodOptions {
  /** Years per page in the years view (default 12). */
  readonly yearsPerPage?: number | undefined
  /** Cells per row (default 4). */
  readonly columns?: number | undefined
  readonly minValue: CalendarDate | null
  readonly maxValue: CalendarDate | null
}

const VIEWS: readonly CalendarView[] = ["days", "months", "years"]

/** The view's rank: days 0, months 1, years 2. */
export const viewRank = (view: CalendarView) => VIEWS.indexOf(view)

/** `view` inside [minView, maxView]. */
export function clampView(view: CalendarView, min: CalendarView, max: CalendarView) {
  const rank = Math.min(
    Math.max(viewRank(view), viewRank(min)),
    Math.max(viewRank(max), viewRank(min)),
  )
  return VIEWS[rank] ?? "days"
}

/** One view up (days → months → years) or down; null past the end. */
export const viewStep = (view: CalendarView, by: 1 | -1): CalendarView | null =>
  VIEWS[viewRank(view) + by] ?? null

/** The first day of the period containing `date`. */
export const periodStart = (date: CalendarDate, view: CalendarView): CalendarDate =>
  view === "days" ? date : view === "months" ? date.set({ day: 1 }) : date.set({ month: 1, day: 1 })

/** The last day of the period starting at `start`. */
export const periodEnd = (start: CalendarDate, view: CalendarView): CalendarDate =>
  view === "days"
    ? start
    : view === "months"
      ? start.set({ day: 99 })
      : start.set({ month: 99, day: 99 })

const yearsPerPage = (o: PeriodOptions) => Math.max(1, o.yearsPerPage ?? 12)
export const columnsOf = (o: Pick<PeriodOptions, "columns">) => Math.max(1, o.columns ?? 4)

/**
 * The periods of the page containing `date`, in time order: a year's months, or a fixed block
 * of `yearsPerPage` years counted within the era and truncated at its first and last year.
 */
export function pageOf(date: CalendarDate, view: PeriodView, o: PeriodOptions): CalendarDate[] {
  if (view === "months") {
    const year = date.set({ month: 1, day: 1 })
    const count = date.calendar.getMonthsInYear(year)
    return Array.from({ length: count }, (_, i) => year.set({ month: i + 1, day: 1 }))
  }
  const n = yearsPerPage(o)
  const first = Math.max(1, Math.floor(date.year / n) * n)
  const last = Math.min(Math.floor(date.year / n) * n + n - 1, date.calendar.getYearsInEra(date))
  const years: CalendarDate[] = []
  for (let y = first; y <= last; y++) years.push(date.set({ year: y, month: 1, day: 1 }))
  // Eras counted backwards (BC) list their years from the earliest.
  return years.sort((a, b) => a.compare(b))
}

/** Whether a period has a day inside [minValue, maxValue]. */
export function periodAllowed(start: CalendarDate, view: CalendarView, o: PeriodOptions) {
  const min = o.minValue && periodStart(o.minValue, "days")
  const max = o.maxValue
  if (min && periodEnd(start, view).compare(min) < 0) return false
  if (max && start.compare(max) > 0) return false
  return true
}

/** The nearest allowed period. */
export function clampPeriod(start: CalendarDate, view: CalendarView, o: PeriodOptions) {
  if (o.minValue && periodEnd(start, view).compare(o.minValue) < 0)
    return periodStart(o.minValue, view)
  if (o.maxValue && start.compare(o.maxValue) > 0) return periodStart(o.maxValue, view)
  return start
}

/** The adjacent page (its periods), through the day after its last or before its first. */
function adjacentPage(
  page: readonly CalendarDate[],
  view: PeriodView,
  by: 1 | -1,
  o: PeriodOptions,
) {
  const edge =
    by > 0
      ? periodEnd(page[page.length - 1] as CalendarDate, view).add({ days: 1 })
      : (page[0] as CalendarDate).subtract({ days: 1 })
  return pageOf(edge, view, o)
}

/** Whether paging in `direction` reaches a page with an allowed period. */
export function canPagePeriod(
  focused: CalendarDate,
  view: PeriodView,
  by: 1 | -1,
  o: PeriodOptions,
) {
  const page = pageOf(focused, view, o)
  if (by > 0) {
    const last = page[page.length - 1] as CalendarDate
    return !o.maxValue || periodEnd(last, view).compare(o.maxValue) < 0
  }
  const first = page[0] as CalendarDate
  return !o.minValue || first.compare(o.minValue) > 0
}

function target(focused: CalendarDate, view: PeriodView, m: PeriodMove, o: PeriodOptions) {
  const page = pageOf(focused, view, o)
  const start = periodStart(focused, view)
  const i = Math.max(
    0,
    page.findIndex((p) => p.compare(start) === 0),
  )
  const c = columnsOf(o)
  const col = i % c
  const at = (p: readonly CalendarDate[], k: number) => p[Math.min(Math.max(k, 0), p.length - 1)]
  switch (m) {
    case "next":
      return i + 1 < page.length ? page[i + 1] : adjacentPage(page, view, 1, o)[0]
    case "previous":
      return i > 0 ? page[i - 1] : adjacentPage(page, view, -1, o).at(-1)
    case "next-row": {
      // A next row on this page (perhaps shorter); else the next page's first row.
      if (i - col + c < page.length) return at(page, i + c)
      return at(adjacentPage(page, view, 1, o), col)
    }
    case "previous-row": {
      if (i - c >= 0) return page[i - c]
      const prev = adjacentPage(page, view, -1, o)
      return at(prev, Math.floor((prev.length - 1) / c) * c + col)
    }
    case "first":
      return page[0]
    case "last":
      return page.at(-1)
    case "next-page":
      return at(adjacentPage(page, view, 1, o), i)
    case "previous-page":
      return at(adjacentPage(page, view, -1, o), i)
    default: {
      const never: never = m
      return never
    }
  }
}

/** One move: the next focused period, clamped to the constraints (unavailable stays reachable). */
export function movePeriod(
  focused: CalendarDate,
  view: PeriodView,
  m: PeriodMove,
  o: PeriodOptions,
): CalendarDate {
  const next = target(focused, view, m, o) ?? periodStart(focused, view)
  return clampPeriod(next, view, o)
}
