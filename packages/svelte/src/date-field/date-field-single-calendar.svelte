<script lang="ts">
import {
  CalendarDate,
  type DateValue,
  dayOf,
  draftFocus,
  draftHint,
  type FieldValue,
  type Modality,
  pickedValue,
  Time,
} from "@rind-ui/core"
import { untrack } from "svelte"
import CalendarRoot from "../calendar/calendar-root.svelte"
import { popoverHost } from "../popover/context.svelte"
import { single, useDateField } from "./context"
import type { DatePickerCalendarProps } from "./types"

const props: DatePickerCalendarProps = $props()
const ctx = useDateField("Calendar")
const host = single.maybe() ?? null
const popover = popoverHost.maybe() ?? null
/** A value the calendar can show: a time of day has no day (a time field has no picker). */
const onCalendar = (v: FieldValue | null | undefined): DateValue | null =>
  v == null || v instanceof Time ? null : v
const value = $derived(onCalendar(ctx.view().values.value))
const placeholder = onCalendar(ctx.picker.placeholder)
let focused = $state<CalendarDate>(
  untrack(() => dayOf(value ?? placeholder ?? new CalendarDate(2001, 1, 1))),
)
// Typing while open: the value, or a draft's year and month, moves the calendar.
const hint = $derived(draftHint(ctx.view().context.draft))
let followed = untrack(() => `${value?.toString() ?? ""}|${hint.year}|${hint.month}`)
$effect(() => {
  const key = `${value?.toString() ?? ""}|${hint.year}|${hint.month}`
  untrack(() => {
    if (followed === key) return
    followed = key
    if (value) focused = dayOf(value)
    else focused = draftFocus(hint, focused) ?? focused
  })
})
// A pick that changed nothing (the selected date again) never ran onValueChange: an earlier
// refusal must not keep the popover open.
let changed = false
const close = (modality: Modality) => {
  if (!changed) ctx.picker.cancelled.current = false
  changed = false
  // After the field's onValueChange ran: a refused pick keeps the popover open.
  queueMicrotask(() => {
    if (!ctx.picker.cancelled.current && ctx.picker.closeOnSelect()) {
      popover?.service.send({ type: "select", modality })
    }
  })
}
const base = $derived(ctx.base())
const firstDay = $derived(ctx.picker.firstDayOfWeek())
// The field's locale, direction and calendar system (spec "Picker — Calendar Binding").
const calendarSystem = $derived(ctx.picker.createCalendar())
const onValueChange = (v: unknown, details: { modality: string | undefined }) => {
  if (v === null || Array.isArray(v) || !("calendar" in (v as object)) || "start" in (v as object))
    return
  changed = true
  ctx.send({
    type: "PICK",
    value: pickedValue(dayOf(v as DateValue), value, placeholder, base.granularity),
    modality: details.modality as Modality,
  })
}
const invalid = $derived((host?.api().validity.message ?? "") !== "" || ctx.own().invalid === true)
</script>

<CalendarRoot
  {...props}
  {value}
  {onValueChange}
  onDateSelect={(_d, d) => close(d.modality)}
  focusedValue={focused}
  onFocusChange={(d) => {
    focused = d
  }}
  minValue={onCalendar(base.minValue)}
  maxValue={onCalendar(base.maxValue)}
  {...base.isDateUnavailable ? { isDateUnavailable: base.isDateUnavailable } : {}}
  disabled={ctx.disabled()}
  readOnly={ctx.readOnly()}
  {invalid}
  {...firstDay ? { firstDayOfWeek: firstDay } : {}}
  locale={ctx.picker.locale()}
  dir={ctx.dir()}
  {...calendarSystem ? { createCalendar: calendarSystem } : {}}
/>
