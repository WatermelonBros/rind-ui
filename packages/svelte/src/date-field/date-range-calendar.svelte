<script lang="ts">
import {
  type CalendarDate,
  type DateValue,
  dateClockCapability,
  dayOf,
  type FieldValue,
  type Modality,
  pickedValue,
  Time,
  today as todayOf,
  todayZone,
} from "@rind-ui/core"
import { untrack } from "svelte"
import CalendarRoot from "../calendar/calendar-root.svelte"
import { popoverHost } from "../popover/context.svelte"
import { useEnvironment } from "../provider"
import { useDateRange } from "./context"
import type { DatePickerCalendarProps } from "./types"

const props: DatePickerCalendarProps = $props()
const range = useDateRange()
if (!range) throw new Error("unreachable: RangeCalendar outside a range Root")
const ctx = range
const popover = popoverHost.maybe() ?? null
const env = useEnvironment(dateClockCapability)
/** A value the calendar can show: a time of day has no day (a time field has no picker). */
const onCalendar = (v: FieldValue | null | undefined): DateValue | null =>
  v == null || v instanceof Time ? null : v
const value = $derived(ctx.view().values.value ?? null)
const start = $derived((ctx.view().context.startValue as DateValue | null) ?? null)
const end = $derived((ctx.view().context.endValue as DateValue | null) ?? null)
// Resume (spec "Picker — Range: Resume"): a committed start without a valid end is the anchor
// when the popover opens (the content mounts per open), so a press sets the end.
const anchor = untrack(() =>
  start !== null && (end === null || ctx.state().invalidEdge === "end") ? dayOf(start) : null,
)
// Typing while open (spec "Picker — Range: Typing And Clearing"): the calendar shows the
// range's start, else the end last typed.
let focused = $state<CalendarDate>(
  untrack(() => {
    if (value) return dayOf(value.start as DateValue)
    if (start) return dayOf(start)
    // Today (or the placeholder), within minValue / maxValue.
    const today = dayOf(
      onCalendar(ctx.placeholderValue()) ?? todayOf(env.dateClock, todayZone(undefined, null)),
    )
    const [lo, hi] = [onCalendar(ctx.end().minValue), onCalendar(ctx.end().maxValue)]
    const min = lo ? dayOf(lo) : null
    const max = hi ? dayOf(hi) : null
    return min && today.compare(min) < 0 ? min : max && today.compare(max) > 0 ? max : today
  }),
)
let previous = untrack(() => ({ value, start, end }))
$effect(() => {
  const now = { value, start, end }
  untrack(() => {
    const before = previous
    previous = now
    const moved = now.value
      ? (now.value.start as DateValue)
      : now.end && now.end !== before.end
        ? now.end
        : now.start && now.start !== before.start
          ? now.start
          : null
    if (moved) focused = dayOf(moved)
  })
})
let changed = false
const onValueChange = (v: unknown) => {
  if (v === null || !("start" in (v as object))) return
  changed = true
  const r = v as { start: DateValue; end: DateValue }
  // Each end keeps its own type, time of day and zone (spec "Picker — Select").
  const pick = (day: DateValue, current: unknown) =>
    pickedValue(
      dayOf(day),
      (current as DateValue | null) ?? null,
      onCalendar(ctx.placeholderValue()),
      ctx.granularity() ?? "day",
    )
  ctx.send({
    type: "PICK",
    start: pick(r.start, ctx.view().context.startValue),
    end: pick(r.end, ctx.view().context.endValue),
  })
}
const onDateSelect = (_d: CalendarDate, d: { readonly modality: Modality }) => {
  if (!changed) ctx.cancelled.current = false
  changed = false
  queueMicrotask(() => {
    if (!ctx.cancelled.current && ctx.closeOnSelect()) {
      popover?.service.send({ type: "select", modality: d.modality })
    }
  })
}
const endProps = $derived(ctx.end())
const firstDay = $derived(ctx.firstDayOfWeek())
</script>

<CalendarRoot
  {...props}
  selectionMode="range"
  value={value as never}
  {...anchor ? { defaultAnchor: anchor } : {}}
  focusedValue={focused}
  onFocusChange={(d) => {
    focused = d
  }}
  {onValueChange}
  {onDateSelect}
  commitOnBlur="reset"
  minValue={onCalendar(endProps.minValue)}
  maxValue={onCalendar(endProps.maxValue)}
  {...endProps.isDateUnavailable ? { isDateUnavailable: endProps.isDateUnavailable } : {}}
  allowsNonContiguousRanges={ctx.allowsNonContiguousRanges()}
  disabled={endProps.disabled}
  readOnly={endProps.readOnly}
  invalid={ctx.state().message !== ""}
  {...firstDay ? { firstDayOfWeek: firstDay } : {}}
  {...endProps.locale ? { locale: endProps.locale } : {}}
  {...endProps.dir ? { dir: endProps.dir } : {}}
/>
