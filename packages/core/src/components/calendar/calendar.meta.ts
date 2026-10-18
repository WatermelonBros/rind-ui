// The Calendar's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked
// against the code in calendar.meta.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"calendar"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
})
const state = {
  "data-disabled": "While disabled.",
  "data-readonly": "While read-only.",
  "data-invalid": "A selected date is out of range or unavailable.",
  "data-focus": "Focus is in the grid.",
  "data-focus-visible": "Keyboard focus is in the grid.",
  "data-anchored": "Range mode: an anchor is set (a range is being selected).",
  "data-view": '`"days"`, `"months"` or `"years"`: the shown view.',
}

export const calendarMeta = {
  scope: "calendar",
  name: "Calendar",
  stateless: false,
  parts: [
    {
      name: "Calendar.Root",
      part: "root",
      element: "div",
      description: '`role="group"` named by `aria-label` (never `application`); holds the state.',
    },
    {
      name: "Calendar.Header",
      part: "header",
      element: "div",
      description: "Holds the heading and the triggers.",
    },
    {
      name: "Calendar.Heading",
      part: "heading",
      element: "h2",
      description:
        'The visible range ("October 2026", "2026", "2016 – 2027"); announced when a trigger pages. With a higher view its text is the view trigger.',
    },
    {
      name: "(rendered by Calendar.Heading)",
      part: "view-trigger",
      element: "button",
      description:
        'One view up (days, months, years), named by the heading and `messages.viewUp` ("October 2026, Choose month"); absent at `maxView` or with a fixed `view`.',
    },
    {
      name: "Calendar.PrevTrigger",
      part: "prev-trigger",
      element: "button",
      description: '"Previous"; `aria-disabled` at the minimum, still focusable.',
    },
    {
      name: "Calendar.NextTrigger",
      part: "next-trigger",
      element: "button",
      description: '"Next"; `aria-disabled` at the maximum, still focusable.',
    },
    {
      name: "Calendar.Grid",
      part: "grid",
      element: "table",
      description:
        '`role="grid"` for one month (`month` offset); children may be a render function with the weeks.',
    },
    {
      name: "Calendar.GridHeader",
      part: "grid-header",
      element: "thead",
      description: "The weekday row.",
    },
    {
      name: "Calendar.HeaderCell",
      part: "header-cell",
      element: "th",
      description: "A weekday: short label shown, full name for assistive technology.",
    },
    { name: "Calendar.GridBody", part: "grid-body", element: "tbody", description: "The weeks." },
    { name: "Calendar.Row", part: "row", element: "tr", description: "A week." },
    {
      name: "Calendar.Cell",
      part: "cell",
      element: "td",
      description:
        '`role="gridcell"`: one Tab stop (roving), explicit `aria-selected`, named by its full date.',
    },
    {
      name: "(rendered by Calendar.Root)",
      part: "prompt",
      element: "span",
      description:
        "Range mode: visually hidden, describes the focused cell (start or end the range).",
    },
  ],
  props: {
    value: {
      type: "DateValue | DateValue[] | { start, end } | null",
      description: "Controlled selection.",
    },
    defaultValue: {
      type: "DateValue | DateValue[] | { start, end } | null",
      description: "Uncontrolled selection.",
    },
    onValueChange: {
      type: "(value, { reason, modality }) => void",
      description: "Reasons `CELL.PRESS` (a press) and `KEY` (Enter or Space).",
    },
    selectionMode: {
      type: '"single" | "multiple" | "range"',
      default: '"single"',
      description: "One date, several, or a range selected in two steps (anchor, then end).",
    },
    anchor: {
      type: "DateValue | null",
      description: "Range mode: the first end while a range is selected (controllable).",
    },
    defaultAnchor: { type: "DateValue | null", description: "Uncontrolled anchor." },
    onAnchorChange: { type: "(anchor) => void", description: "The anchor was set or cleared." },
    minRangeLength: {
      type: "number",
      description: "Range mode: shortest range in days (ends included); closer ends are disabled.",
    },
    maxRangeLength: {
      type: "number",
      description: "Range mode: longest range in days (ends included); farther ends are disabled.",
    },
    allowsNonContiguousRanges: {
      type: "boolean",
      default: "false",
      description: "Range mode: a range may contain unavailable dates.",
    },
    commitOnBlur: {
      type: '"reset" | "select" | "clear"',
      default: '"reset"',
      description:
        "Range mode: leaving while anchored keeps the value, commits the preview, or clears it.",
    },
    focusedValue: { type: "DateValue", description: "Controlled focused date (pages to show it)." },
    defaultFocusedValue: {
      type: "DateValue",
      description: "Uncontrolled focused date (default: the selection, else today).",
    },
    onFocusChange: { type: "(date) => void", description: "The focused date changed." },
    onVisibleRangeChange: {
      type: "({ start, end }) => void",
      description: "The visible months changed.",
    },
    minValue: { type: "DateValue | null", description: "Earlier dates are disabled." },
    maxValue: { type: "DateValue | null", description: "Later dates are disabled." },
    isDateUnavailable: {
      type: "(date, { anchor }) => boolean",
      description:
        "Focusable but not selectable (booked days), unlike disabled; told the range anchor.",
    },
    visibleMonths: { type: "number", default: "1", description: "Months shown side by side." },
    pageBehavior: {
      type: '"visible" | "single"',
      default: '"visible"',
      description: "A trigger pages by all visible months, or by one.",
    },
    fixedWeeks: { type: "boolean", default: "false", description: "Always six weeks per month." },
    firstDayOfWeek: { type: '"sun" | "mon" | …', description: "Default: the locale's." },
    locale: { type: "string", description: "Default: the provider's." },
    createCalendar: {
      type: "(identifier) => Calendar",
      description: "From `@internationalized/date`: enables calendar systems other than gregorian.",
    },
    timeZone: { type: "string", description: "The time zone `today` is computed in." },
    disabled: { type: "boolean", default: "false", description: "Nothing focuses or changes." },
    readOnly: { type: "boolean", default: "false", description: "Navigable; nothing is selected." },
    view: {
      type: '"days" | "months" | "years"',
      description: "Controlled view: days, the months of a year, or a page of years.",
    },
    defaultView: { type: '"days" | "months" | "years"', description: "Default: `minView`." },
    onViewChange: {
      type: "(view, { reason }) => void",
      description: "Reasons `heading`, `select` (a period drilled into), `escape-key`, `api`.",
    },
    minView: {
      type: '"days" | "months" | "years"',
      default: '"days"',
      description:
        'The value is chosen in this view (a month picker: `"months"`); higher views drill down.',
    },
    maxView: {
      type: '"days" | "months" | "years"',
      default: '"years"',
      description: "The highest view the heading opens.",
    },
    yearsPerPage: {
      type: "number",
      default: "12",
      description: "Years per page in the years view.",
    },
    columns: {
      type: "number",
      default: "4",
      description: "Cells per row in the month and year views.",
    },
    isMonthUnavailable: {
      type: "(month) => boolean",
      description: "Month view: told the month's first day; never derived from its days.",
    },
    isYearUnavailable: {
      type: "(year) => boolean",
      description: "Year view: told the year's first day.",
    },
    messages: {
      type: "Partial<CalendarMessages>",
      description: "Every string reaching assistive technology.",
    },
  },
  dataAttributes: {
    root: { ...base("root"), ...state },
    "prev-trigger": { ...base("prev-trigger"), "data-disabled": "Cannot page further." },
    cell: {
      ...base("cell"),
      "data-value": "The date (ISO); a period's first day in the month and year views.",
      "data-selected": "Selected.",
      "data-today": "Today (the current month or year in those views).",
      "data-weekend": "A weekend day in the locale.",
      "data-outside-month": "A placeholder of another month (inert).",
      "data-disabled": "Out of range, or the calendar is disabled.",
      "data-unavailable": "Unavailable (focusable, not selectable).",
      "data-invalid": "Selected but out of range or unavailable.",
      "data-hover": "Under the pointer.",
      "data-focus": "Focused.",
      "data-focus-visible": "Keyboard focus.",
      "data-in-range": "Range mode: inside the committed range (ends included).",
      "data-range-start": "Range mode: the committed range's first day.",
      "data-range-end": "Range mode: the committed range's last day.",
      "data-anchor": "Range mode: the anchor, while a range is being selected.",
      "data-preview": "Range mode: between the anchor and the hovered or focused date.",
      "data-preview-start": "Range mode: the preview's first day.",
      "data-preview-end": "Range mode: the preview's last day.",
    },
  },
  keyboard: [
    ["ArrowLeft / ArrowRight", "Previous / next day (mirrored in RTL); crosses months."],
    ["ArrowUp / ArrowDown", "Previous / next week."],
    ["Home / End", "First / last day of the week."],
    ["PageUp / PageDown", "Previous / next month."],
    ["Shift + PageUp / PageDown", "Previous / next year."],
    ["Enter / Space", "Select the focused date (range mode: set the anchor, then the end)."],
    [
      "Month and year views",
      "Arrows move by one period, Up / Down by a row, Home / End to the page's first / last, PageUp / PageDown by a page.",
    ],
    [
      "Escape",
      "Range mode: cancel the range in progress; above `minView`: one view down; else it bubbles.",
    ],
  ],
  states: {
    idle: "Focus is outside the grid: a trigger's paging is announced.",
    focused: "Focus is in the grid: keys move the focused date.",
  },
  contract: {
    actions: {
      select: ["pointer", "keyboard", "virtual"],
      focusDate: ["keyboard"],
      nextPage: ["pointer", "keyboard", "virtual"],
      previousPage: ["pointer", "keyboard", "virtual"],
      selectRange: ["pointer", "keyboard", "touch", "virtual"],
      startRange: ["pointer", "keyboard", "virtual"],
      cancel: ["keyboard"],
      viewUp: ["pointer", "keyboard", "virtual"],
      viewDown: ["keyboard"],
      press: ["keyboard"],
    },
    queries: [
      "value",
      "focusedDate",
      "heading",
      "visibleMonths",
      "isSelected",
      "isUnavailable",
      "isDisabled",
      "today",
      "isInvalid",
      "isFocused",
      "range",
      "anchor",
      "preview",
      "isAnchored",
      "view",
    ],
    traits: ["selectable", "composite-roving"],
  },
} as const satisfies ComponentMeta
