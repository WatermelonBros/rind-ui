// Date Field picker parts (date-field spec "Picker Parts", "Picker — …"): wiring only. The
// field's machine owns the one value; the Popover (re-scoped to `date-field`) owns the open
// state; the Calendar is a bound view whose pick commits through the field (`PICK`).
import {
  afterNextRender,
  Component,
  DestroyRef,
  Directive,
  effect,
  forwardRef,
  inject,
  PLATFORM_ID,
  signal,
  untracked,
  ViewEncapsulation,
} from "@angular/core"
import {
  CalendarDate,
  type CalendarValue,
  type DateValue,
  dateClockCapability,
  dayOf,
  draftFocus,
  draftHint,
  type FieldValue,
  focusSafely,
  type Modality,
  pickedValue,
  Time,
  today as todayOf,
  todayZone,
} from "@rind-ui/core"
import { bindProps } from "../bind-props"
import {
  CALENDAR_ROOT,
  CALENDAR_TEMPLATE,
  CalendarRootBase,
  type CalendarSource,
} from "../calendar/calendar"
import { injectFieldBindingPeek } from "../field/context"
import {
  injectPopoverControls,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "../popover/popover"
import { injectEnvironment } from "../provider"
import { RindProps } from "../rind-props"
import { IN_CONTROL, injectDateField, injectDateRange, SINGLE } from "./context"

/**
 * The group around the Input and the triggers: `<div rindDateFieldControl>`; the popover is
 * placed against it.
 */
@Directive({
  selector: "[rindDateFieldControl]",
  exportAs: "rindDateFieldControl",
  hostDirectives: [PopoverAnchor],
  providers: [
    // Range: the pair's group is the Input itself; the Control only anchors and holds triggers.
    { provide: IN_CONTROL, useFactory: () => injectDateRange() === null },
  ],
})
export class DateFieldControl {
  constructor() {
    const range = injectDateRange()
    const single = inject(SINGLE, { optional: true })
    bindProps(() => {
      const own = range ? {} : (single?.api().control() ?? {})
      const { id: _id, ...rest } = own
      return rest
    })
  }
}

/** Opens the popover: `<button rindDateFieldTrigger>`; counted so Alt+ArrowDown opens only a picker. */
@Directive({
  selector: "[rindDateFieldTrigger]",
  exportAs: "rindDateFieldTrigger",
  hostDirectives: [PopoverTrigger],
})
export class DateFieldTrigger {
  constructor() {
    const range = injectDateRange()
    const binding = injectFieldBindingPeek()
    const single = inject(SINGLE, { optional: true })
    const count = range?.triggers ?? single?.ctx.picker.triggers ?? null
    if (count && inject(PLATFORM_ID) === "browser") {
      afterNextRender(() => count.update((n) => n + 1))
      inject(DestroyRef).onDestroy(() => count.update((n) => n - 1))
    }
    bindProps(() =>
      range
        ? range.api(binding?.() ?? null).trigger({ range: true })
        : (single?.api().trigger() ?? {}),
    )
  }
}

/** Clears the value and every draft segment, then focuses the first segment. */
@Directive({ selector: "[rindDateFieldClearTrigger]", exportAs: "rindDateFieldClearTrigger" })
export class DateFieldClearTrigger {
  constructor() {
    const range = injectDateRange()
    const binding = injectFieldBindingPeek()
    const single = inject(SINGLE, { optional: true })
    const env = injectEnvironment()
    const clear = () => {
      if (range) range.send({ type: "CLEAR" })
      else single?.ctx.send({ type: "CLEAR" })
      const scope = range ? range.inputEl : single?.ctx.inputEl
      const first = scope?.value?.querySelector<HTMLElement>("input[data-editable]")
      if (first) void focusSafely(first, env, "programmatic", env.modality.modality())
    }
    bindProps(() => ({
      ...(range
        ? range.api(binding?.() ?? null).clearTrigger()
        : (single?.api().clearTrigger() ?? {})),
      onClick: clear,
    }))
  }
}

/** The popover's dialog, named by the trigger's name and the Label unless named otherwise. */
@Directive({
  selector: "[rindDateFieldContent]",
  exportAs: "rindDateFieldContent",
  hostDirectives: [PopoverContent],
})
export class DateFieldContent {
  constructor() {
    const range = injectDateRange()
    const binding = injectFieldBindingPeek()
    const single = inject(SINGLE, { optional: true })
    const { statics } = bindProps(() => {
      if (statics.has("aria-label") || statics.has("aria-labelledby")) return {}
      const own = range
        ? range.api(binding?.() ?? null).contentLabelledBy()
        : single?.api().contentLabelledBy()
      return { "aria-labelledby": own }
    })
  }
}

/** A value the calendar can show: a time of day has no day (a time field has no picker). */
const onCalendar = (v: FieldValue | null | undefined): DateValue | null =>
  v == null || v instanceof Time ? null : v

/** The single field's Calendar source. Call it in a constructor. */
function injectSingleSource(): CalendarSource {
  const ctx = injectDateField("Calendar")
  const single = inject(SINGLE, { optional: true })
  const popover = injectPopoverControls()
  const value = () => onCalendar(ctx.view().values.value)
  const placeholder = () => onCalendar(ctx.picker.placeholder())
  const focused = signal<CalendarDate>(
    dayOf(untracked(value) ?? untracked(placeholder) ?? new CalendarDate(2001, 1, 1)),
  )
  // Typing while open: the value, or a draft's year and month, moves the calendar.
  let last: string | undefined
  effect(() => {
    const v = value()
    const hint = draftHint(ctx.view().context.draft)
    const key = `${v?.toString() ?? ""}|${hint.year}|${hint.month}`
    if (key === last) return
    const first = last === undefined
    last = key
    if (first) return
    untracked(() => {
      if (v) {
        focused.set(dayOf(v))
        return
      }
      focused.set(draftFocus(hint, focused()) ?? focused())
    })
  })
  // A pick that changed nothing (the selected date again) never ran onValueChange: an
  // earlier refusal must not keep the popover open.
  let changed = false
  return {
    value: () => value() as CalendarValue,
    focusedValue: () => focused(),
    minValue: () => onCalendar(ctx.base().minValue),
    maxValue: () => onCalendar(ctx.base().maxValue),
    isDateUnavailable: () => ctx.base().isDateUnavailable,
    disabled: () => ctx.disabled(),
    readOnly: () => ctx.readOnly(),
    invalid: () => (single?.api().validity.message ?? "") !== "" || ctx.own().invalid === true,
    firstDayOfWeek: () => ctx.picker.firstDayOfWeek(),
    // The field's locale, direction and calendar system (spec "Picker — Calendar Binding").
    locale: () => ctx.picker.locale(),
    dir: () => ctx.dir(),
    createCalendar: () => ctx.picker.createCalendar(),
    onValueChange: (v, details) => {
      if (v === null || Array.isArray(v) || !("calendar" in (v as object)) || "start" in v) return
      changed = true
      ctx.send({
        type: "PICK",
        value: pickedValue(
          dayOf(v as DateValue),
          untracked(value),
          untracked(placeholder),
          untracked(ctx.base).granularity,
        ),
        modality: details.modality as Modality,
      })
    },
    onFocusChange: (d) => focused.set(d),
    onDateSelect: (_d, d) => {
      if (!changed) ctx.picker.cancelled.current = false
      changed = false
      // After the field's onValueChange ran: a refused pick keeps the popover open.
      queueMicrotask(() => {
        if (!ctx.picker.cancelled.current && ctx.picker.closeOnSelect()) {
          popover?.send({ type: "select", modality: d.modality })
        }
      })
    },
  }
}

/** The range's Calendar source. Call it in a constructor. */
function injectRangeSource(): CalendarSource {
  const ctx = injectDateRange()
  if (!ctx) throw new Error("unreachable: a range Calendar outside a range Root")
  const popover = injectPopoverControls()
  const env = injectEnvironment(dateClockCapability)
  const start = () => (ctx.view().context.startValue as DateValue | null) ?? null
  const end = () => (ctx.view().context.endValue as DateValue | null) ?? null
  const value = () => ctx.view().values.value ?? null
  // Resume (spec "Picker — Range: Resume"): a committed start without a valid end is the
  // anchor when the popover opens (the content renders per open), so a press sets the end.
  const s0 = untracked(start)
  const anchor =
    s0 !== null && (untracked(end) === null || untracked(ctx.state).invalidEdge === "end")
      ? dayOf(s0)
      : null
  // Typing while open (spec "Picker — Range: Typing And Clearing"): the calendar shows the
  // range's start, else the end last typed.
  const initial = (): CalendarDate => {
    const v = value()
    if (v) return dayOf(v.start as DateValue)
    const s = start()
    if (s) return dayOf(s)
    // Today (or the placeholder), within minValue / maxValue.
    const today = dayOf(
      onCalendar(ctx.placeholderValue()) ?? todayOf(env.dateClock, todayZone(undefined, null)),
    )
    const [lo, hi] = [onCalendar(ctx.end().minValue), onCalendar(ctx.end().maxValue)]
    const min = lo ? dayOf(lo) : null
    const max = hi ? dayOf(hi) : null
    return min && today.compare(min) < 0 ? min : max && today.compare(max) > 0 ? max : today
  }
  const focused = signal<CalendarDate>(untracked(initial))
  let previous: { s: DateValue | null; e: DateValue | null } = {
    s: untracked(start),
    e: untracked(end),
  }
  let lastValue = untracked(value)
  effect(() => {
    const v = value()
    const s = start()
    const e = end()
    const ps = previous.s
    const pe = previous.e
    if (s === ps && e === pe && v === lastValue) return
    previous = { s, e }
    lastValue = v
    const moved = v ? (v.start as DateValue) : e && e !== pe ? e : s && s !== ps ? s : null
    if (moved) untracked(() => focused.set(dayOf(moved)))
  })
  let changed = false
  return {
    selectionMode: () => "range",
    value: () => value() as CalendarValue,
    defaultAnchor: () => anchor,
    focusedValue: () => focused(),
    onFocusChange: (d) => focused.set(d),
    onValueChange: (v) => {
      if (v === null || !("start" in (v as object))) return
      changed = true
      const r = v as { start: DateValue; end: DateValue }
      // Each end keeps its own type, time of day and zone (spec "Picker — Select").
      const pick = (day: DateValue, current: unknown) =>
        pickedValue(
          dayOf(day),
          (current as DateValue | null) ?? null,
          onCalendar(untracked(ctx.placeholderValue)),
          untracked(ctx.granularity) ?? "day",
        )
      ctx.send({
        type: "PICK",
        start: pick(r.start, untracked(ctx.view).context.startValue),
        end: pick(r.end, untracked(ctx.view).context.endValue),
      })
    },
    onDateSelect: (_d, d) => {
      if (!changed) ctx.cancelled.current = false
      changed = false
      queueMicrotask(() => {
        if (!ctx.cancelled.current && ctx.closeOnSelect()) {
          popover?.send({ type: "select", modality: d.modality })
        }
      })
    },
    // The picker forces "reset": leaving the calendar never commits half a range.
    commitOnBlur: () => "reset",
    minValue: () => onCalendar(ctx.end().minValue),
    maxValue: () => onCalendar(ctx.end().maxValue),
    isDateUnavailable: () => ctx.end().isDateUnavailable,
    allowsNonContiguousRanges: () => ctx.allowsNonContiguousRanges(),
    disabled: () => ctx.end().disabled,
    readOnly: () => ctx.end().readOnly,
    invalid: () => ctx.state().message !== "",
    firstDayOfWeek: () => ctx.firstDayOfWeek(),
    // The field's locale and direction (spec "Picker — Calendar Binding").
    locale: () => ctx.end().locale,
    dir: () => ctx.end().dir,
  }
}

/**
 * The Calendar bound to the picker: `<div rindDateFieldCalendar>` with the Calendar's parts;
 * its data come from the field, its view inputs are its own.
 */
@Component({
  selector: "[rindDateFieldCalendar]",
  exportAs: "rindDateFieldCalendar",
  imports: [RindProps],
  encapsulation: ViewEncapsulation.None,
  providers: [{ provide: CALENDAR_ROOT, useExisting: forwardRef(() => DateFieldCalendar) }],
  template: CALENDAR_TEMPLATE,
})
export class DateFieldCalendar extends CalendarRootBase {
  constructor() {
    super()
    this.wire(injectDateRange() ? injectRangeSource() : injectSingleSource())
  }
}
