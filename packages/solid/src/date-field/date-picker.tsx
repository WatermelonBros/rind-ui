/** @jsxImportSource solid-js */
// Date Field picker parts (date-field spec "Picker Parts", "Picker — …"): wiring only. The
// field's machine owns the one value; the Popover (re-scoped to `date-field`) owns the open
// state; the Calendar is a bound view whose pick commits through the field (`PICK`).
import {
  CalendarDate,
  type DateValue,
  type DayOfWeek,
  dateClockCapability,
  dayOf,
  draftFocus,
  draftHint,
  type FieldValue,
  focusSafely,
  type Modality,
  partId,
  pickedValue,
  Time,
  today as todayOf,
  todayZone,
} from "@rind-ui/core"
import {
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  on,
  onCleanup,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import type { CalendarRootProps } from "../calendar"
import * as Calendar from "../calendar/calendar.parts"
import { useFieldBindingPeek } from "../field/context"
import { afterMount } from "../lifecycle"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { Popover, type PopoverRootProps } from "../popover"
import { usePopoverControls } from "../popover/popover"
import { useEnvironment } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { InControlContext, SingleContext, useApi, useDateField, useDateRange } from "./context"

export type DatePickerCloseReason =
  | "trigger"
  | "close-trigger"
  | "select"
  | "escape-key"
  | "outside-press"
  | "outside-focus"
  | "parent-dismissed"
  | "api"

export interface DatePickerOpenChangeDetails {
  readonly reason: "trigger" | DatePickerCloseReason
  /** Keeps the open state (uncontrolled) or refuses the change (controlled). */
  cancel(): void
}

/**
 * The picker's Root props (spec "Picker Parts"): the Popover's open state and layer options,
 * and the Calendar data props a picker forwards. One type, so none is dropped.
 */
export interface DatePickerProps
  extends Pick<
    PopoverRootProps,
    "modal" | "initialFocus" | "finalFocus" | "positioning" | "persistentElements"
  > {
  /** Controlled open state of the calendar popover. */
  readonly open?: boolean | undefined
  /** Initial open state of the calendar popover. Default: false. */
  readonly defaultOpen?: boolean | undefined
  /** Every open or close request, with `details.reason` and `details.cancel()`. */
  readonly onOpenChange?:
    | ((open: boolean, details: DatePickerOpenChangeDetails) => void)
    | undefined
  /** A pick closes the popover (default true). */
  readonly closeOnSelect?: boolean | undefined
  /** The calendar's first day of the week. */
  readonly firstDayOfWeek?: DayOfWeek | undefined
}

/** The calendar's tab stop in the open content: the initial focus (spec "Initial Focus"). */
export const calendarTabStop = (instance: string) => (): HTMLElement | null =>
  (typeof document === "undefined"
    ? null
    : document
        .getElementById(partId("date-field", instance, "content"))
        ?.querySelector<HTMLElement>('[data-scope="calendar"][data-part="cell"][tabindex="0"]')) ??
  null

/** The picker's Control is the anchor and dismissal-inside element (spec "Dismissal"). */
export const controlElement = (instance: string): HTMLElement | null =>
  typeof document === "undefined"
    ? null
    : document.getElementById(partId("date-field", instance, "anchor"))

type Own<A> = Omit<A, "children"> & {
  /** Another element: a function receiving the props to spread. */
  readonly render?: RenderProp<undefined> | undefined
  readonly children?: JSX.Element
}

/** The single Root's parts provider (Root renders it around its children). */
export function SinglePicker(props: { readonly children?: JSX.Element }) {
  const ctx = useDateField("Root")
  const api = useApi(ctx)
  return <SingleContext.Provider value={{ ctx, api }}>{props.children}</SingleContext.Provider>
}

/** The group around the Input and the triggers; the popover is placed against it. */
export function PickerControl(props: Own<JSX.HTMLAttributes<HTMLDivElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const range = useDateRange()
  const single = useContext(SingleContext)
  // Range: the pair's group is the Input itself; the Control only anchors and holds triggers.
  const merged = createMemo(() => {
    const own = range ? {} : normalizeProps(single?.api().control() ?? {})
    const { id: _id, ...ownRest } = own as Record<string, unknown>
    void _id
    return mergeProps(ownRest, rest)
  })
  return (
    <Popover.Anchor {...merged()} render={local.render}>
      <InControlContext.Provider value={!range}>{local.children}</InControlContext.Provider>
    </Popover.Anchor>
  )
}

/** Opens the popover; counted so Alt+ArrowDown opens only a picker. */
export function PickerTrigger(props: Parameters<typeof Popover.Trigger>[0]) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const range = useDateRange()
  const binding = useFieldBindingPeek()
  const single = useContext(SingleContext)
  const setTriggers = range?.setTriggers ?? single?.ctx.picker.setTriggers ?? null
  afterMount(() => {
    if (!setTriggers) return
    setTriggers((n) => n + 1)
    onCleanup(() => setTriggers((n) => n - 1))
  })
  const merged = createMemo(() => {
    const own = range
      ? range.api(binding?.() ?? null).trigger({ range: true })
      : (single?.api().trigger() ?? {})
    return mergeProps(normalizeProps(own), rest)
  })
  return (
    <Popover.Trigger {...merged()} render={local.render}>
      {local.children}
    </Popover.Trigger>
  )
}

/** Clears the value and every draft segment, then focuses the first segment. */
export function PickerClearTrigger(props: Own<JSX.ButtonHTMLAttributes<HTMLButtonElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const range = useDateRange()
  const binding = useFieldBindingPeek()
  const single = useContext(SingleContext)
  const env = useEnvironment()
  const clear = () => {
    if (range) range.send({ type: "CLEAR" })
    else single?.ctx.send({ type: "CLEAR" })
    const scope = range ? range.inputEl() : single?.ctx.inputEl()
    const first = scope?.querySelector<HTMLElement>("input[data-editable]")
    if (first) void focusSafely(first, env, "programmatic", env.modality.modality())
  }
  const merged = createMemo(() => {
    const own = range
      ? range.api(binding?.() ?? null).clearTrigger()
      : (single?.api().clearTrigger() ?? {})
    return mergeProps({ ...normalizeProps(own), onClick: clear }, rest)
  })
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

/** The popover's dialog, named by the trigger's name and the Label unless named otherwise. */
export function PickerContent(props: Parameters<typeof Popover.Content>[0]) {
  const [local, rest] = splitProps(props, ["aria-label", "aria-labelledby"])
  const range = useDateRange()
  const binding = useFieldBindingPeek()
  const single = useContext(SingleContext)
  const name = createMemo(() => {
    const ownName = range
      ? range.api(binding?.() ?? null).contentLabelledBy()
      : single?.api().contentLabelledBy()
    return local["aria-label"] !== undefined || local["aria-labelledby"] !== undefined
      ? { "aria-label": local["aria-label"], "aria-labelledby": local["aria-labelledby"] }
      : { "aria-labelledby": ownName }
  })
  return (
    <Popover.Content
      {...rest}
      aria-label={name()["aria-label"]}
      aria-labelledby={name()["aria-labelledby"]}
    />
  )
}

/** The data props the picker owns (spec "Picker — Calendar Binding"). */
type BoundCalendarProps =
  | "value"
  | "defaultValue"
  | "onValueChange"
  | "selectionMode"
  | "focusedValue"
  | "defaultFocusedValue"
  | "onFocusChange"
  | "minValue"
  | "maxValue"
  | "isDateUnavailable"
  | "disabled"
  | "readOnly"
  | "invalid"
  | "locale"
  | "firstDayOfWeek"
  | "allowsNonContiguousRanges"
  | "commitOnBlur"
  | "onDateSelect"
export type DatePickerCalendarProps = Omit<CalendarRootProps, BoundCalendarProps>

/** The Calendar bound to the picker: its data come from the field, its view props are its own. */
export function PickerCalendar(props: DatePickerCalendarProps) {
  const range = useDateRange()
  return range ? <RangeCalendar {...props} /> : <SingleCalendar {...props} />
}

/** A value the calendar can show: a time of day has no day (a time field has no picker). */
const onCalendar = (v: FieldValue | null | undefined): DateValue | null =>
  v == null || v instanceof Time ? null : v

function SingleCalendar(props: DatePickerCalendarProps) {
  const ctx = useDateField("Calendar")
  const popover = usePopoverControls()
  const single = useContext(SingleContext)
  const value = createMemo(() => onCalendar(ctx.view().values.value))
  const placeholder = onCalendar(ctx.picker.placeholder)
  const [focused, setFocused] = createSignal<CalendarDate>(
    dayOf(untrack(value) ?? placeholder ?? new CalendarDate(2001, 1, 1)),
  )
  // Typing while open: the value, or a draft's year and month, moves the calendar.
  const hint = createMemo(() => draftHint(ctx.view().context.draft))
  const followKey = createMemo(() => `${value()?.toString() ?? ""}|${hint().year}|${hint().month}`)
  createEffect(
    on(
      followKey,
      () => {
        const v = untrack(value)
        if (v) return setFocused(dayOf(v))
        setFocused((f) => draftFocus(untrack(hint), f) ?? f)
      },
      { defer: true },
    ),
  )
  // A pick that changed nothing (the selected date again) never ran onValueChange: an
  // earlier refusal must not keep the popover open.
  let changed = false
  const close = (modality: Modality) => {
    if (!changed) ctx.picker.cancelled.current = false
    changed = false
    // After the field's onValueChange ran: a refused pick keeps the popover open.
    queueMicrotask(() => {
      if (!ctx.picker.cancelled.current && untrack(ctx.picker.closeOnSelect)) {
        popover?.send({ type: "select", modality })
      }
    })
  }
  return (
    <Calendar.Root
      {...props}
      value={value()}
      onValueChange={(v, details) => {
        if (v === null || Array.isArray(v) || !("calendar" in v) || "start" in v) return
        changed = true
        ctx.send({
          type: "PICK",
          value: pickedValue(
            dayOf(v as DateValue),
            untrack(value),
            placeholder,
            untrack(ctx.base).granularity,
          ),
          modality: details.modality as Modality,
        })
      }}
      onDateSelect={(_d, d) => close(d.modality)}
      focusedValue={focused()}
      onFocusChange={setFocused}
      minValue={onCalendar(ctx.base().minValue)}
      maxValue={onCalendar(ctx.base().maxValue)}
      isDateUnavailable={ctx.base().isDateUnavailable}
      disabled={ctx.disabled()}
      readOnly={ctx.readOnly()}
      invalid={(single?.api().validity.message ?? "") !== "" || ctx.own().invalid === true}
      firstDayOfWeek={ctx.picker.firstDayOfWeek()}
    />
  )
}

function RangeCalendar(props: DatePickerCalendarProps) {
  const ctx = useDateRange()
  if (!ctx) throw new Error("unreachable: RangeCalendar outside a range Root")
  const popover = usePopoverControls()
  const env = useEnvironment(dateClockCapability)
  const start = () => (ctx.view().context.startValue as DateValue | null) ?? null
  const end = () => (ctx.view().context.endValue as DateValue | null) ?? null
  const value = () => ctx.view().values.value ?? null
  // Resume (spec "Picker — Range: Resume"): a committed start without a valid end is the
  // anchor when the popover opens (the content mounts per open), so a press sets the end.
  const anchor = untrack(() => {
    const s = start()
    return s !== null && (end() === null || ctx.state().invalidEdge === "end") ? dayOf(s) : null
  })
  // Typing while open (spec "Picker — Range: Typing And Clearing"): the calendar shows the
  // range's start, else the end last typed.
  const [focused, setFocused] = createSignal<CalendarDate>(
    untrack(() => {
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
    }),
  )
  const keys = createMemo(() => {
    const v = value()
    return `${v ? `${v.start}..${v.end}` : ""}|${start() ?? ""}|${end() ?? ""}`
  })
  let previous = { start: untrack(start), end: untrack(end) }
  createEffect(
    on(
      keys,
      () => {
        const now = { value: untrack(value), start: untrack(start), end: untrack(end) }
        const before = previous
        previous = { start: now.start, end: now.end }
        const moved = now.value
          ? (now.value.start as DateValue)
          : now.end && now.end !== before.end
            ? now.end
            : now.start && now.start !== before.start
              ? now.start
              : null
        if (moved) setFocused(dayOf(moved))
      },
      { defer: true },
    ),
  )
  let changed = false
  return (
    <Calendar.Root
      {...props}
      selectionMode="range"
      value={value() as never}
      defaultAnchor={anchor ?? undefined}
      focusedValue={focused()}
      onFocusChange={setFocused}
      onValueChange={(v) => {
        if (v === null || !("start" in (v as object))) return
        changed = true
        const r = v as unknown as { start: DateValue; end: DateValue }
        // Each end keeps its own type, time of day and zone (spec "Picker — Select").
        const pick = (day: DateValue, current: unknown) =>
          pickedValue(
            dayOf(day),
            (current as DateValue | null) ?? null,
            onCalendar(ctx.placeholderValue()),
            ctx.granularity() ?? "day",
          )
        const view = untrack(ctx.view)
        ctx.send({
          type: "PICK",
          start: pick(r.start, view.context.startValue),
          end: pick(r.end, view.context.endValue),
        } as never)
      }}
      onDateSelect={(_d, d) => {
        if (!changed) ctx.cancelled.current = false
        changed = false
        queueMicrotask(() => {
          if (!ctx.cancelled.current && untrack(ctx.closeOnSelect)) {
            popover?.send({ type: "select", modality: d.modality })
          }
        })
      }}
      // The picker forces "reset": leaving the calendar never commits half a range.
      commitOnBlur="reset"
      minValue={onCalendar(ctx.end().minValue)}
      maxValue={onCalendar(ctx.end().maxValue)}
      isDateUnavailable={ctx.end().isDateUnavailable}
      allowsNonContiguousRanges={ctx.allowsNonContiguousRanges()}
      disabled={ctx.end().disabled}
      readOnly={ctx.end().readOnly}
      invalid={ctx.state().message !== ""}
      firstDayOfWeek={ctx.firstDayOfWeek()}
    />
  )
}
