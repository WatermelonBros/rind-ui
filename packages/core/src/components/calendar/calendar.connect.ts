// Calendar parts (design §4): the APG date grid. The cell itself is the focusable element
// (no inner button, no role="application"); states are attributes, names are full dates.

import {
  type CalendarDate,
  GregorianCalendar,
  isSameDay,
  isWeekend,
  startOfWeek,
  toCalendar,
} from "@internationalized/date"
import { focusAttrs } from "../../a11y/focus"
import { type KeyDescription, toLogicalKey } from "../../a11y/keys"
import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import type { PlatformFlags } from "../../env/capabilities"
import { dateFormatter, dayText, fullDate } from "../../i18n/date"
import { inMonth } from "./calendar.grid"
import {
  type CalendarEvent,
  type CalendarProps,
  type CalendarValue,
  isSelectable,
  rangeOf,
  unavailable,
  valuesOf,
} from "./calendar.machine"
import { type CalendarMove, canPage, clamp } from "./calendar.navigation"
import { visibleRangeText } from "./calendar.pieces"
import { crossesUnavailable, makeRange, rangeEnds, rangeLength } from "./calendar.range"

export interface CalendarConnectInput extends CalendarProps {
  readonly instance: string
  readonly value: CalendarValue
  readonly focused: CalendarDate
  readonly visibleStart: CalendarDate
  readonly hovered: CalendarDate | null
  /** Range mode: the anchor while a range is being selected (display calendar). */
  readonly anchor: CalendarDate | null
  /** Focus is inside a grid (state `focused`). */
  readonly gridFocused: boolean
  readonly modality: Modality
  readonly today: CalendarDate
  readonly dir: "ltr" | "rtl"
  /** The consumer names the root (`aria-label` / `aria-labelledby`): the heading does not. */
  readonly consumerNamed: boolean
  readonly ids: {
    readonly heading: string
    readonly grid: (month: number) => string
    /** Range mode: the visually hidden prompt describing the focused cell. */
    readonly prompt?: string | undefined
  }
}

const GREGORIAN = new GregorianCalendar()
/** The ISO text a cell carries (`data-value`): gregorian (date-values "Serialisation"). */
export const isoOf = (date: CalendarDate) => toCalendar(date, GREGORIAN).toString()

/** The machine event for a key in the grid; null when the key is not the grid's. */
export function calendarKey(
  k: KeyDescription,
  dir: "ltr" | "rtl",
  platform: PlatformFlags,
): CalendarEvent | null {
  if (k.alt || k.ctrl || k.meta) return null
  if (k.key === "Enter" || k.key === " ") return { type: "SELECT_FOCUSED", composing: k.composing }
  const logical = toLogicalKey(k, { dir, orientation: "grid", platform })
  const moves: Partial<Record<NonNullable<typeof logical>, CalendarMove>> = {
    NEXT: "next-day",
    PREV: "previous-day",
    NEXT_ROW: "next-week",
    PREV_ROW: "previous-week",
    FIRST: "week-start",
    LAST: "week-end",
    PAGE_NEXT: k.shift ? "next-year" : "next-month",
    PAGE_PREV: k.shift ? "previous-year" : "previous-month",
  }
  const move = logical ? moves[logical] : undefined
  return move ? { type: "NAVIGATE", move, composing: k.composing } : null
}

const within = (date: CalendarDate, r: { start: CalendarDate; end: CalendarDate } | null) =>
  r !== null && date.compare(r.start) >= 0 && date.compare(r.end) <= 0

export function calendarConnect(input: CalendarConnectInput) {
  const isRange = input.selectionMode === "range"
  const show = (v: import("@internationalized/date").DateValue) =>
    toCalendar(v, input.calendar) as CalendarDate
  const committed = rangeOf(input.value)
  const range = committed ? makeRange(show(committed.start), show(committed.end)) : null
  const anchor = isRange ? input.anchor : null
  const selected = isRange ? [] : valuesOf(input.value)
  const isSelected = (date: CalendarDate) =>
    isRange ? within(date, range) : selected.some((v) => isSameDay(v, date))
  const outOfRange = (date: CalendarDate) => !isSameDay(clamp(date, input), date)
  // A controlled focusedValue outside min/max (also at mount) focuses the nearest bound.
  const focusedDate = clamp(input.focused, input)
  const isUnavailable = (date: CalendarDate) => unavailable(input, date, anchor)
  // The preview: from the anchor to the hovered date, else the focused one while focus is in
  // a grid (spec "Range Preview": nothing once the pointer and focus are both elsewhere).
  const previewEnd = input.hovered ?? (input.gridFocused ? focusedDate : null)
  const preview = anchor && previewEnd ? makeRange(anchor, previewEnd) : null
  // The ends a range from the anchor may take: contiguity bounds found once per render.
  const endsOk = anchor
    ? rangeEnds(anchor, {
        minRangeLength: input.minRangeLength,
        maxRangeLength: input.maxRangeLength,
        isUnavailable: (d) => isUnavailable(d),
        allowsNonContiguousRanges: input.allowsNonContiguousRanges,
      })
    : null
  const rangeInvalid =
    range !== null &&
    (outOfRange(range.start) ||
      outOfRange(range.end) ||
      isUnavailable(range.start) ||
      isUnavailable(range.end) ||
      (!input.allowsNonContiguousRanges && crossesUnavailable(range, isUnavailable)) ||
      (input.minRangeLength !== undefined && rangeLength(range) < input.minRangeLength) ||
      (input.maxRangeLength !== undefined && rangeLength(range) > input.maxRangeLength))
  const invalid = isRange
    ? rangeInvalid
    : selected.some((v) => outOfRange(show(v)) || isUnavailable(show(v)))
  const state = {
    "data-disabled": dataFlag(input.disabled === true),
    "data-readonly": dataFlag(input.readOnly === true),
    "data-invalid": dataFlag(invalid),
    "data-anchored": dataFlag(anchor !== null),
    ...focusAttrs(input.gridFocused, input.modality),
  }
  const visible = visibleRangeText(input.visibleStart, input)
  const month = (offset: number) => input.visibleStart.add({ months: offset })
  const monthName = (offset: number) =>
    input.messages.monthLabel({
      formatted: dateFormatter(input.formatLocale, {
        month: "long",
        year: "numeric",
        calendar: input.calendar.identifier,
        timeZone: "UTC",
      }).format(
        new Date(
          Date.UTC(
            toCalendar(month(offset), GREGORIAN).year,
            toCalendar(month(offset), GREGORIAN).month - 1,
            15,
          ),
        ),
      ),
    })
  const gridIds = Array.from({ length: input.visibleMonths }, (_, i) => input.ids.grid(i)).join(" ")
  return {
    visibleRange: visible,
    root: (): PartProps => ({
      ...scopeAttrs("calendar", "root", input.instance),
      ...state,
      role: "group",
      dir: input.dir,
      lang: input.locale,
      "aria-labelledby": input.consumerNamed ? undefined : input.ids.heading,
    }),
    header: (): PartProps => scopeAttrs("calendar", "header", input.instance),
    heading: (): PartProps => ({
      ...scopeAttrs("calendar", "heading", input.instance),
      id: input.ids.heading,
      children: visible,
    }),
    /** `focus`: the trigger's own focus and the modality it came with (its ring). */
    trigger: (
      direction: 1 | -1,
      focus: { readonly focused: boolean; readonly modality: Modality } = {
        focused: false,
        modality: "keyboard",
      },
    ): PartProps => {
      const off = input.disabled === true || !canPage(input.visibleStart, direction, input)
      return {
        ...scopeAttrs("calendar", direction > 0 ? "next-trigger" : "prev-trigger", input.instance),
        type: "button",
        "aria-label": direction > 0 ? input.messages.next : input.messages.previous,
        // Focusable at the bound, so focus is never lost (spec "Triggers").
        "aria-disabled": off ? "true" : undefined,
        "data-disabled": dataFlag(off),
        "aria-controls": gridIds,
        disabled: input.disabled === true || undefined,
        ...focusAttrs(focus.focused, focus.modality),
      }
    },
    grid: (offset: number): PartProps => ({
      ...scopeAttrs("calendar", "grid", input.instance),
      ...state,
      id: input.ids.grid(offset),
      role: "grid",
      "data-month": String(offset),
      ...(input.visibleMonths === 1
        ? { "aria-labelledby": input.ids.heading }
        : { "aria-label": monthName(offset) }),
      "aria-multiselectable": input.selectionMode !== "single" ? "true" : undefined,
      "aria-readonly": input.readOnly ? "true" : undefined,
      "aria-disabled": input.disabled ? "true" : undefined,
    }),
    // The weekday row is hidden: every cell's name has its weekday (bits-ui#902: only this row).
    gridHeader: (): PartProps => ({
      ...scopeAttrs("calendar", "grid-header", input.instance),
      "aria-hidden": "true",
    }),
    headerCell: (day: number): PartProps => {
      const date = startOfWeek(input.visibleStart, input.locale, input.firstDayOfWeek).add({
        days: day,
      })
      const g = toCalendar(date, GREGORIAN)
      const at = new Date(Date.UTC(g.year, g.month - 1, g.day, 12))
      const format = (weekday: "narrow" | "long") =>
        dateFormatter(input.formatLocale, { weekday, timeZone: "UTC" }).format(at)
      return {
        ...scopeAttrs("calendar", "header-cell", input.instance),
        scope: "col",
        abbr: format("long"),
        children: format("narrow"),
      }
    },
    gridBody: (): PartProps => scopeAttrs("calendar", "grid-body", input.instance),
    row: (): PartProps => scopeAttrs("calendar", "row", input.instance),
    cell: (date: CalendarDate, offset: number): PartProps => {
      const placeholder = !inMonth(date, month(offset))
      const off =
        !isUnavailable(date) && (!isSelectable(date, input) || (endsOk !== null && !endsOk(date)))
      // While anchored, dates no range from the anchor may end on are disabled too.
      const disabled =
        placeholder || input.disabled === true || outOfRange(date) || (anchor !== null && off)
      const cellUnavailable = !disabled && isUnavailable(date)
      // Range mode: only selectable cells of the committed range are selected.
      const sel = !placeholder && isSelected(date) && (!isRange || (!disabled && !cellUnavailable))
      const today = isSameDay(date, input.today)
      const isFocused = !placeholder && isSameDay(date, focusedDate)
      const focusHere = isFocused && input.gridFocused
      const cellInvalid = isRange
        ? !placeholder && within(date, range) && invalid
        : sel && (outOfRange(date) || isUnavailable(date))
      const inPreview = !placeholder && within(date, preview)
      const ranged = !placeholder && isRange
      const formatted = fullDate(date, input.formatLocale, input.calendar)
      return {
        ...scopeAttrs("calendar", "cell", input.instance),
        role: "gridcell",
        "data-value": isoOf(date),
        // One tab stop: the focused date; other enabled cells -1; disabled cells none. Dates
        // disabled only by the range in progress stay reachable (the arrows move onto them).
        tabindex:
          placeholder || input.disabled === true || outOfRange(date)
            ? undefined
            : isFocused
              ? 0
              : -1,
        "aria-label": input.messages.cellLabel({ date, formatted, today }),
        "aria-selected": sel ? "true" : "false",
        "aria-disabled": disabled || cellUnavailable ? "true" : undefined,
        "aria-describedby": isRange && isFocused && input.ids.prompt ? input.ids.prompt : undefined,
        "aria-current": today && !placeholder ? "date" : undefined,
        "aria-invalid": cellInvalid ? "true" : undefined,
        "data-selected": dataFlag(sel),
        "data-today": dataFlag(today && !placeholder),
        "data-weekend": dataFlag(isWeekend(date, input.locale)),
        "data-outside-month": dataFlag(placeholder),
        "data-disabled": dataFlag(disabled),
        "data-unavailable": dataFlag(cellUnavailable),
        "data-invalid": dataFlag(cellInvalid),
        "data-hover": dataFlag(
          !disabled && input.hovered !== null && isSameDay(date, input.hovered),
        ),
        ...focusAttrs(focusHere, input.modality),
        // Range mode (placeholders carry none: spec "Data Attributes").
        "data-in-range": dataFlag(ranged && within(date, range)),
        "data-range-start": dataFlag(ranged && range !== null && isSameDay(date, range.start)),
        "data-range-end": dataFlag(ranged && range !== null && isSameDay(date, range.end)),
        "data-anchor": dataFlag(ranged && anchor !== null && isSameDay(date, anchor)),
        "data-preview": dataFlag(ranged && inPreview),
        "data-preview-start": dataFlag(
          ranged && preview !== null && inPreview && isSameDay(date, preview.start),
        ),
        "data-preview-end": dataFlag(
          ranged && preview !== null && inPreview && isSameDay(date, preview.end),
        ),
        children: dayText(date, input.formatLocale, input.calendar),
      }
    },
    isSelectable: (date: CalendarDate) => isSelectable(date, input, anchor),
    /** Range mode: the visually hidden prompt for the focused cell. */
    prompt: (): PartProps => ({
      ...scopeAttrs("calendar", "prompt", input.instance),
      id: input.ids.prompt,
      children: anchor
        ? input.messages.endPrompt({
            anchor: fullDate(anchor, input.formatLocale, input.calendar),
            minRangeLength: input.minRangeLength,
            maxRangeLength: input.maxRangeLength,
            contiguous:
              input.isDateUnavailable !== undefined && input.allowsNonContiguousRanges !== true,
          })
        : input.messages.startPrompt,
    }),
  }
}
