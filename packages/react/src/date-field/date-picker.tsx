// Date Field picker parts (date-field spec "Picker Parts", "Picker — …"): wiring only. The
// field's machine owns the one value; the Popover (re-scoped to `date-field`) owns the open
// state; the Calendar is a bound view whose pick commits through the field (`PICK`).

import {
  type CalendarDate,
  type DateValue,
  type DayOfWeek,
  dayOf,
  draftFocus,
  draftHint,
  focusSafely,
  type Modality,
  partId,
  pickedValue,
  today as todayOf,
  todayZone,
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import { Calendar, type CalendarRootProps } from "../calendar/calendar"
import { useFieldBindingPeek } from "../field/field"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { Popover, type PopoverRootProps } from "../popover"
import { usePopoverControls } from "../popover/popover"
import { useEnvironment } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useApi, useDateField } from "./date-field"
import { useDateRange } from "./date-range-field"

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
  readonly open?: boolean
  readonly defaultOpen?: boolean
  readonly onOpenChange?: (open: boolean, details: DatePickerOpenChangeDetails) => void
  /** A pick closes the popover (default true). */
  readonly closeOnSelect?: boolean
  /** The calendar's first day of the week. */
  readonly firstDayOfWeek?: DayOfWeek
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

const InControlContext = createContext(false)
/** Inside a Control: the Input is a presentation element (the Control is the group). */
export const useInControl = () => useContext(InControlContext)

type Own<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  readonly render?: RenderProp<undefined>
}

/** The group around the Input and the triggers; the popover is placed against it. */
export function PickerControl({ render, children, ...rest }: Own<"div">) {
  const range = useDateRange()
  const single = useContext(SingleOrNull)
  // Range: the pair's group is the Input itself; the Control only anchors and holds triggers.
  const own = range ? {} : normalizeProps(single?.api.control() ?? {})
  const { id: _id, ...props } = own as Record<string, unknown>
  void _id
  return (
    <Popover.Anchor
      {...(mergeProps(props, rest) as object)}
      {...(render ? { render: render as never } : {})}
    >
      <InControlContext value={!range}>{children}</InControlContext>
    </Popover.Anchor>
  )
}

/** The single Root's context and connect parts (null in range mode). */
const SingleOrNull = createContext<{
  readonly ctx: ReturnType<typeof useDateField>
  readonly api: ReturnType<typeof useApi>
} | null>(null)

/** The single Root's parts provider (Root renders it around its children). */
export function SinglePicker({ children }: { readonly children?: ReactNode }) {
  const ctx = useDateField("Root")
  const api = useApi(ctx)
  return <SingleOrNull value={{ ctx, api }}>{children}</SingleOrNull>
}

/** Opens the popover; counted so Alt+ArrowDown opens only a picker. */
export function PickerTrigger({ render, ref, children, ...rest }: Own<"button">) {
  const range = useDateRange()
  const binding = useFieldBindingPeek()
  const single = useContext(SingleOrNull)
  const setTriggers = range?.setTriggers ?? single?.ctx.picker.setTriggers ?? null
  useEffect(() => {
    if (!setTriggers) return
    setTriggers((n) => n + 1)
    return () => setTriggers((n) => n - 1)
  }, [setTriggers])
  const own = range ? range.api(binding).trigger({ range: true }) : (single?.api.trigger() ?? {})
  return (
    <Popover.Trigger
      {...(mergeProps(normalizeProps(own), rest) as object)}
      ref={ref as React.Ref<HTMLButtonElement>}
      {...(render ? { render: render as never } : {})}
    >
      {children}
    </Popover.Trigger>
  )
}

/** Clears the value and every draft segment, then focuses the first segment. */
export function PickerClearTrigger({ render, ref, onClick, ...rest }: Own<"button">) {
  const range = useDateRange()
  const binding = useFieldBindingPeek()
  const single = useContext(SingleOrNull)
  const env = useEnvironment()
  const own = range ? range.api(binding).clearTrigger() : (single?.api.clearTrigger() ?? {})
  const scope = range ? range.inputEl : single?.ctx.inputEl
  const clear = () => {
    if (range) range.send({ type: "CLEAR" })
    else single?.ctx.send({ type: "CLEAR" })
    const first = scope?.current?.querySelector<HTMLElement>("input[data-editable]")
    if (first) void focusSafely(first, env, "programmatic", env.modality.modality())
  }
  const props = mergeProps(
    { ...normalizeProps(own), ref, onClick: clear },
    { ...rest, ...(onClick ? { onClick } : {}) },
  )
  return renderPart("button", props, render, undefined)
}

export const PickerPortal = Popover.Portal
export const PickerPositioner = Popover.Positioner

/** The popover's dialog, named by the trigger's name and the Label unless named otherwise. */
export function PickerContent({
  "aria-label": label,
  "aria-labelledby": labelledBy,
  ...rest
}: ComponentPropsWithRef<typeof Popover.Content>) {
  const range = useDateRange()
  const binding = useFieldBindingPeek()
  const single = useContext(SingleOrNull)
  const ownName = range ? range.api(binding).contentLabelledBy() : single?.api.contentLabelledBy()
  const name =
    label !== undefined || labelledBy !== undefined
      ? { "aria-label": label, "aria-labelledby": labelledBy }
      : { "aria-labelledby": ownName }
  return <Popover.Content {...(rest as object)} {...name} />
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

function SingleCalendar(props: DatePickerCalendarProps) {
  const ctx = useDateField("Calendar")
  const popover = usePopoverControls()
  const value = ctx.view.values.value ?? null
  const api = useApi(ctx)
  const base = ctx.base
  const hint = draftHint(ctx.view.context.draft)
  const [focused, setFocused] = useState<CalendarDate>(() => dayOf(value ?? ctx.picker.placeholder))
  // Typing while open: the value, or a draft's year and month, moves the calendar.
  const valueKey = value?.toString() ?? ""
  const follow = useRef({ value, hint })
  follow.current = { value, hint }
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the value or the draft's month changes
  useEffect(() => {
    const { value: v, hint: h } = follow.current
    if (v) return setFocused(dayOf(v))
    setFocused((f) => draftFocus(h, f) ?? f)
  }, [valueKey, hint.year, hint.month])
  // A pick that changed nothing (the selected date again) never ran onValueChange: an
  // earlier refusal must not keep the popover open.
  const changed = useRef(false)
  const close = (modality: Modality) => {
    if (!changed.current) ctx.picker.cancelled.current = false
    changed.current = false
    // After the field's onValueChange ran: a refused pick keeps the popover open.
    queueMicrotask(() => {
      if (!ctx.picker.cancelled.current && ctx.picker.closeOnSelect) {
        popover?.send({ type: "select", modality })
      }
    })
  }
  return (
    <Calendar.Root
      {...props}
      value={value}
      onValueChange={(v, details) => {
        if (v === null || Array.isArray(v) || !("calendar" in v) || "start" in v) return
        changed.current = true
        ctx.send({
          type: "PICK",
          value: pickedValue(
            dayOf(v as DateValue),
            value,
            ctx.picker.placeholder,
            base.granularity,
          ),
          modality: details.modality as Modality,
        })
      }}
      onDateSelect={(_d, d) => close(d.modality)}
      focusedValue={focused}
      onFocusChange={setFocused}
      minValue={base.minValue ?? null}
      maxValue={base.maxValue ?? null}
      {...(base.isDateUnavailable ? { isDateUnavailable: base.isDateUnavailable } : {})}
      disabled={ctx.disabled}
      readOnly={ctx.readOnly}
      invalid={api.validity.message !== "" || ctx.own.invalid === true}
      {...(ctx.picker.firstDayOfWeek ? { firstDayOfWeek: ctx.picker.firstDayOfWeek } : {})}
    />
  )
}

function RangeCalendar(props: DatePickerCalendarProps) {
  const range = useDateRange()
  const popover = usePopoverControls()
  if (!range) throw new Error("unreachable: RangeCalendar outside a range Root")
  const ctx = range
  const value = ctx.view.values.value ?? null
  const start = (ctx.view.context.startValue as DateValue | null) ?? null
  const end = (ctx.view.context.endValue as DateValue | null) ?? null
  // Resume (spec "Picker — Range: Resume"): a committed start without a valid end is the
  // anchor when the popover opens (the content mounts per open), so a press sets the end.
  const [anchor] = useState(() =>
    start !== null && (end === null || ctx.state.invalidEdge === "end") ? dayOf(start) : null,
  )
  // Typing while open (spec "Picker — Range: Typing And Clearing"): the calendar shows the
  // range's start, else the end last typed.
  const env = useEnvironment()
  const [focused, setFocused] = useState<CalendarDate>(() => {
    if (value) return dayOf(value.start as DateValue)
    if (start) return dayOf(start)
    // Today (or the placeholder), within minValue / maxValue.
    const today = dayOf(ctx.placeholderValue ?? todayOf(env.dateClock, todayZone(undefined, null)))
    const min = ctx.end.minValue ? dayOf(ctx.end.minValue) : null
    const max = ctx.end.maxValue ? dayOf(ctx.end.maxValue) : null
    return min && today.compare(min) < 0 ? min : max && today.compare(max) > 0 ? max : today
  })
  const keys = `${value ? `${value.start}..${value.end}` : ""}|${start ?? ""}|${end ?? ""}`
  const follow = useRef({ value, start, end })
  const previous = useRef(follow.current)
  follow.current = { value, start, end }
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the value or an end changes
  useEffect(() => {
    const now = follow.current
    const before = previous.current
    previous.current = now
    const moved = now.value
      ? (now.value.start as DateValue)
      : now.end && now.end !== before.end
        ? now.end
        : now.start && now.start !== before.start
          ? now.start
          : null
    if (moved) setFocused(dayOf(moved))
  }, [keys])
  const changed = useRef(false)
  return (
    <Calendar.Root
      {...props}
      selectionMode="range"
      value={value as never}
      {...(anchor ? { defaultAnchor: anchor } : {})}
      focusedValue={focused}
      onFocusChange={setFocused}
      onValueChange={(v) => {
        if (v === null || !("start" in (v as object))) return
        changed.current = true
        const r = v as { start: DateValue; end: DateValue }
        // Each end keeps its own type, time of day and zone (spec "Picker — Select").
        const end = (day: DateValue, current: unknown) =>
          pickedValue(
            dayOf(day),
            (current as DateValue | null) ?? null,
            ctx.placeholderValue ?? null,
            ctx.granularity ?? "day",
          )
        ctx.send({
          type: "PICK",
          start: end(r.start, ctx.view.context.startValue),
          end: end(r.end, ctx.view.context.endValue),
        })
      }}
      onDateSelect={(_d, d) => {
        if (!changed.current) ctx.cancelled.current = false
        changed.current = false
        queueMicrotask(() => {
          if (!ctx.cancelled.current && ctx.closeOnSelect) {
            popover?.send({ type: "select", modality: d.modality })
          }
        })
      }}
      // The picker forces "reset": leaving the calendar never commits half a range.
      commitOnBlur="reset"
      minValue={ctx.end.minValue ?? null}
      maxValue={ctx.end.maxValue ?? null}
      {...(ctx.end.isDateUnavailable ? { isDateUnavailable: ctx.end.isDateUnavailable } : {})}
      allowsNonContiguousRanges={ctx.allowsNonContiguousRanges}
      disabled={ctx.end.disabled}
      readOnly={ctx.end.readOnly}
      invalid={ctx.state.message !== ""}
      {...(ctx.firstDayOfWeek ? { firstDayOfWeek: ctx.firstDayOfWeek } : {})}
    />
  )
}
