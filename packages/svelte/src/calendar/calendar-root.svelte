<script lang="ts">
// Calendar parts: wiring only. The machine owns the value, the focused date and the visible
// range; connect every attribute and the key mapping; navigation is pure core logic.
import {
  announcerCapability,
  type CalendarDate,
  type CalendarValue,
  type CalendarView,
  calendarConnect,
  calendarMachine,
  calendarMessages,
  createCalendarDrag,
  type DateValue,
  dateClockCapability,
  display,
  focusSafely,
  initialCalendarFocus,
  isoOf,
  type Modality,
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
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { useMachine } from "../use-machine.svelte"
import { useModality } from "../use-modality.svelte"
import { calendarHost } from "./context"
import type { CalendarRootProps } from "./types"

let {
  value = $bindable(),
  defaultValue,
  onValueChange,
  selectionMode = "single",
  focusedValue = $bindable(),
  defaultFocusedValue,
  onFocusChange,
  onVisibleRangeChange,
  minValue = null,
  maxValue = null,
  isDateUnavailable,
  anchor = $bindable(),
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
  view: viewProp = $bindable(),
  defaultView,
  onViewChange,
  minView = "days",
  maxView = "years",
  yearsPerPage,
  columns,
  isMonthUnavailable,
  isYearUnavailable,
  id,
  child,
  children,
  ...rest
}: CalendarRootProps = $props()

const env = useEnvironment(announcerCapability, dateClockCapability)
const uid = $props.id()
const instance = $derived(id ?? uid)
const loc = useLocale(
  () => ownLocale,
  () => ownDir,
)
const messages = useMessages("calendar", calendarMessages, () => ownMessages)
const resolved = $derived(resolveCalendar(loc.current.locale, createCalendar))
const firstDay = $derived(weekStart(loc.current.locale, firstDayProp))
const show = (d: DateValue | null | undefined) => (d ? display(d, resolved.calendar) : null)
const nav = $derived({
  visibleMonths,
  pageBehavior,
  minValue: show(minValue),
  maxValue: show(maxValue),
  locale: loc.current.locale,
  firstDayOfWeek: firstDay,
})
const current = $derived(value === undefined ? defaultValue : value)
const today = $derived(todayOf(env.dateClock, todayZone(timeZone, valuesOf(current ?? null))))
// The first focus: the given one, else the value, else today (calendar-navigation).
const initial = untrack(
  () =>
    show(defaultFocusedValue) ??
    initialCalendarFocus(show(valuesOf(current ?? null)[0]), display(today, resolved.calendar), nav)
      .focused,
)
let pendingFocus: { date: CalendarDate; modality: string | undefined } | null = null
const range = $derived({ minRangeLength, maxRangeLength, allowsNonContiguousRanges, commitOnBlur })
// A fixed view (controlled, no listener) is the only view: the value is chosen there.
const viewBound = untrack(() => viewProp !== undefined)
const fixedView = $derived(
  viewProp !== undefined && onViewChange === undefined && !viewBound ? viewProp : undefined,
)
const periods = $derived({
  minView: fixedView ?? minView,
  maxView: fixedView ?? maxView,
  yearsPerPage,
  columns,
  isMonthUnavailable,
  isYearUnavailable,
})
const machine = useMachine(
  calendarMachine,
  () => ({
    ...nav,
    value,
    defaultValue,
    onValueChange: (v: CalendarValue, details: unknown) => {
      const d = details as { event: { type: string; modality?: string }; cancel(): void }
      onValueChange?.(v, {
        reason:
          d.event.type === "CELL.PRESS"
            ? "CELL.PRESS"
            : d.event.type === "DRAG.END"
              ? "DRAG"
              : "KEY",
        modality: d.event.modality ?? "keyboard",
        cancel: d.cancel,
      })
      if (value !== undefined) value = v
    },
    focusedValue: show(focusedValue) ?? undefined,
    defaultFocusedValue: initial,
    onFocusedValueChange: (date: CalendarDate) => {
      onFocusChange?.(date)
      if (focusedValue !== undefined) focusedValue = date
    },
    ...(anchor !== undefined ? { anchor: show(anchor) } : {}),
    ...(defaultAnchor !== undefined ? { defaultAnchor: show(defaultAnchor) } : {}),
    onAnchorChange: (a: CalendarDate | null) => {
      onAnchorChange?.(a)
      if (anchor !== undefined) anchor = a
    },
    onDateSelect: (date: CalendarDate, details: { readonly modality: Modality }) =>
      onDateSelect?.(date, details),
    ...range,
    ...periods,
    view: viewProp,
    defaultView: defaultView ?? minView,
    onViewChange: (v: CalendarView, details: unknown) => {
      const type = (details as { event: { type: string } }).event.type
      onViewChange?.(v, {
        reason:
          type === "VIEW.UP"
            ? "heading"
            : type === "VIEW.DOWN"
              ? "escape-key"
              : type === "CELL.PRESS" || type === "SELECT_FOCUSED"
                ? "select"
                : "api",
      })
      if (viewProp !== undefined) viewProp = v
    },
    selectionMode,
    isDateUnavailable,
    disabled,
    readOnly,
    invalid,
    calendar: resolved.calendar,
    formatLocale: resolved.formatLocale,
    messages: messages(),
    id: instance,
    focusCell: (date: CalendarDate, modality: string | undefined) => {
      pendingFocus = { date, modality }
    },
  }),
  env,
)
// Range mode's drag selection (spec "Drag Selection"): one per Root, wired to the machine.
let canStart: (date: CalendarDate) => boolean = () => false
const drag = createCalendarDrag({
  env,
  target: () => ({ instance, calendar: resolved.calendar }),
  canStart: (date) => canStart(date),
  delay: () => dragDelay,
  send: (e) => machine.send(e),
})
$effect(() => () => drag.dispose())
// The modality is tracked from mount: a pointer press that focuses a cell is seen as one.
$effect(() => env.modality.subscribe(() => {}))
const view = $derived(machine.view)
const modality = useModality(env.modality, () => view.matches("focused"))
const anchored = $derived(selectionMode === "range" ? (view.values.anchor ?? null) : null)
const api = $derived(
  calendarConnect({
    ...nav,
    ...range,
    ...periods,
    view: viewIn(view.values.view, periods),
    // Controlled and never changed: the heading is plain text (spec "View Drill-Down").
    viewFixed: fixedView !== undefined,
    anchor: anchored ? display(anchored, resolved.calendar) : null,
    selectionMode,
    isDateUnavailable,
    disabled,
    readOnly,
    invalid,
    calendar: resolved.calendar,
    formatLocale: resolved.formatLocale,
    messages: messages(),
    id: instance,
    instance,
    value: view.values.value ?? null,
    focused: view.values.focusedValue,
    visibleStart: view.context.visibleStart,
    hovered: view.context.hovered,
    dragging: view.context.dragging,
    gridFocused: view.matches("focused"),
    modality: modality.current,
    today: display(today, resolved.calendar),
    dir: loc.current.dir,
    consumerNamed: rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined,
    ids: {
      heading: `calendar-${instance}-heading`.replace(/:/g, ""),
      grid: (m) => `calendar-${instance}-grid-${m}`.replace(/:/g, ""),
      prompt: `calendar-${instance}-prompt`.replace(/:/g, ""),
    },
  }),
)
$effect.pre(() => {
  canStart = api.canDrag
})
const el = elementRef("div")
// After the step is rendered: DOM focus to the focused cell (keyboard and props only).
$effect(() => {
  void view
  const root = el.current
  untrack(() => {
    const pending = pendingFocus
    if (!pending) return
    pendingFocus = null
    const cell = root?.querySelector<HTMLElement>(
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
})
// Range mode: leaving the Calendar while anchored applies commitOnBlur (spec "Range Cancel And
// Leave"); inside is the root's subtree and the layers opened from it.
const isAnchored = $derived(anchored !== null)
$effect(() => {
  const root = el.current
  if (!isAnchored || !root) return
  return untrack(() => watchLeave(root, () => machine.send({ type: "LEAVE" })))
})
// Every change of the visible range is reported.
let reported: string | null = null
$effect(() => {
  const start = view.context.visibleStart
  untrack(() => {
    const key = start.toString()
    if (reported === key) return
    const first = reported === null
    reported = key
    if (!first) onVisibleRangeChange?.({ start, end: visibleEnd(start, nav) })
  })
})
// While dragging, a touch does not scroll the page (a native non-passive listener).
$effect(() => {
  const root = el.current
  return root ? untrack(() => drag.attach(root)) : undefined
})
calendarHost.set({
  view: () => machine.view,
  send: (e) => machine.send(e),
  api: () => api,
  instance: () => instance,
  dragConsumes: drag.consumes,
  grid: (offset) =>
    monthGrid(
      machine.view.context.visibleStart.add({ months: offset }),
      loc.current.locale,
      firstDay,
      fixedWeeks,
    ),
})
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...normalizeProps(api.root()),
        // Escape anywhere inside cancels a range in progress and is consumed; with no anchor
        // (and in minView) it bubbles (to an enclosing dialog).
        onkeydown: (e: KeyboardEvent) => {
          // Then, in a view above minView, it goes one view down before any outer layer.
          if (e.key !== "Escape" || e.defaultPrevented || !(isAnchored || api.escapeGoesDown))
            return
          e.preventDefault()
          e.stopPropagation()
          machine.send(isAnchored ? { type: "CANCEL" } : { type: "VIEW.DOWN" })
        },
        onpointerdown: (e: PointerEvent) => drag.pointerDown(e.currentTarget as Element, e),
        ...el.props,
      },
      rest,
    ),
  ),
)
const prompt = $derived(selectionMode === "range" ? api.prompt() : null)
</script>

<!-- Range mode: the focused cell's prompt, read as its description. -->
{#snippet content()}{@render children?.()}{#if prompt}<span
      {...attrs(normalizeProps({ ...prompt, style: visuallyHiddenStyle }))}
      >{prompt["children"] as string}</span
    >{/if}{/snippet}

{#if child}
  {@render child({ props: { ...merged, children: content }, state: undefined })}
{:else}
  <div {...attrs(merged)}>{@render content()}</div>
{/if}
