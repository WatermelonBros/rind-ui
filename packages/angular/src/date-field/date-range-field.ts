// Date Field range mode (date-field spec "Range Mode"): wiring only. The coordinator machine
// derives the pair's value and validity; each end is an embedded Date Field; connect owns the
// group, the ends, the separator and the two hidden inputs.
import {
  afterEveryRender,
  afterNextRender,
  booleanAttribute,
  Component,
  computed,
  DestroyRef,
  type ElementRef,
  forwardRef,
  inject,
  input,
  output,
  PLATFORM_ID,
  type Signal,
  signal,
  untracked,
  ViewEncapsulation,
  viewChild,
} from "@angular/core"
import {
  type DateFieldMessages,
  type DateGranularity,
  type DateRangeFieldValue,
  type DateValue,
  type DayOfWeek,
  dateFieldMessages,
  dateRangeConnect,
  dateRangeFieldMachine,
  type FieldControlBinding,
  type FieldValue,
  type FocusTarget,
  hiddenFormInput,
  type MessageOverrides,
  mergeFieldProps,
  type PartProps,
  parseEndValue,
  rangeStateOf,
  resolveCalendar,
  setControlValidity,
  Time,
} from "@rind-ui/core"
import { bindProps } from "../bind-props"
import { FIELD_HOST, injectFieldBindingPeek } from "../field/context"
import { FieldRoot } from "../field/field"
import { injectFieldsetDisabled } from "../fieldset/context"
import { injectMachine } from "../inject-machine"
import { POPOVER_OVERRIDE, POPOVER_SCOPE, PopoverRoot } from "../popover/popover"
import { injectEnvironment, injectLocale, injectMessages } from "../provider"
import { RindProps } from "../rind-props"
import { DATE_FIELD, DATE_RANGE, RANGE_TRIGGERS, type RangeCtx, SINGLE } from "./context"
import {
  calendarTabStop,
  controlElement,
  type DatePickerCloseReason,
  type DatePickerOpenEvent,
  FIELD_INPUTS,
  POPOVER_INPUTS,
} from "./date-field"

export interface DateRangeFieldChangeDetails {
  readonly reason: string
  cancel(): void
}

/** What a `valueChangeDetails` output emits. */
export interface DateRangeFieldValueEvent {
  readonly value: DateRangeFieldValue
  readonly details: DateRangeFieldChangeDetails
}

const optionalBoolean = (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false)

/**
 * A range of two ends: `<div rindDateFieldRoot selectionMode="range">` (a Field, unless inside
 * one) holding a Label, an Input with a Start, a Separator and an End (rendered for you when
 * the Input is empty) and the picker parts.
 */
@Component({
  selector: "[rindDateFieldRoot][selectionMode=range]",
  exportAs: "rindDateFieldRoot",
  imports: [RindProps],
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [
    { directive: FieldRoot, inputs: FIELD_INPUTS },
    { directive: PopoverRoot, inputs: POPOVER_INPUTS },
  ],
  providers: [
    { provide: FIELD_HOST, useValue: { scope: "date-field" } },
    { provide: POPOVER_SCOPE, useValue: "date-field" },
    { provide: POPOVER_OVERRIDE, useFactory: () => ({ source: {} }) },
    { provide: DATE_RANGE, useFactory: () => inject(forwardRef(() => DateRangeFieldRoot)).ctx },
    {
      provide: RANGE_TRIGGERS,
      useFactory: () => inject(forwardRef(() => DateRangeFieldRoot)).ctx.triggers,
    },
    // Below the range: no single field (the ends provide their own).
    { provide: DATE_FIELD, useValue: null },
    { provide: SINGLE, useValue: null },
  ],
  template: `<ng-content /><input #start [rindProps]="hiddenStart()" /><input #end [rindProps]="hiddenEnd()" />`,
})
export class DateRangeFieldRoot {
  /** `range`: this Root (a static attribute). */
  readonly selectionMode = input<"range">()
  /** The pair (`[(value)]`): `{ start, end }` or null. */
  readonly value = input<DateRangeFieldValue>()
  readonly defaultValue = input<DateRangeFieldValue>()
  /** A range may contain unavailable dates (default false). */
  readonly allowsNonContiguousRanges = input(false, { transform: booleanAttribute })
  /** `Time` ends: an end before the start is the next day (default false). */
  readonly allowsOvernight = input(false, { transform: booleanAttribute })
  /** The hidden inputs' names. */
  readonly startName = input<string>()
  /** The end date's hidden input name. */
  readonly endName = input<string>()
  readonly form = input<string>()
  readonly messages = input<MessageOverrides<DateFieldMessages>>()
  // The inputs both ends share.
  readonly placeholderValue = input<FieldValue>()
  readonly granularity = input<DateGranularity>()
  /** `"hour"`: time ends (no date segments). Default: `"hour"` for `Time` ends. */
  readonly maxGranularity = input<"year" | "hour">()
  readonly hourCycle = input<12 | 24>()
  readonly hideTimeZone = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly shouldForceLeadingZeros = input<boolean | undefined, boolean | "" | undefined>(
    undefined,
    { transform: optionalBoolean },
  )
  readonly minValue = input<FieldValue | null>()
  readonly maxValue = input<FieldValue | null>()
  readonly isDateUnavailable = input<(date: DateValue) => boolean>()
  readonly locale = input<string>()
  readonly dir = input<"ltr" | "rtl">()
  /** A pick closes the popover (default true). */
  readonly closeOnSelect = input(true, { transform: booleanAttribute })
  /** The calendar's first day of the week. */
  readonly firstDayOfWeek = input<DayOfWeek>()
  /** The picker's first focus (default: the calendar's tab stop). */
  readonly initialFocus = input<(() => FocusTarget) | null>()
  /** Elements whose presses and focus count as inside the picker. */
  readonly persistentElements = input<() => readonly Element[]>()
  readonly valueChangeDetails = output<DateRangeFieldValueEvent>()
  /** The pair, for `[(value)]`. */
  readonly valueChange = output<DateRangeFieldValue>()
  /** Every open or close request of the picker, with `details.reason` and `details.cancel()`. */
  readonly openChangeDetails = output<DatePickerOpenEvent>()
  /** The picker's open state, for `[(open)]`. */
  readonly openChange = output<boolean>()

  /** @internal */
  readonly ctx: RangeCtx
  /** @internal */
  protected readonly hiddenStart: Signal<PartProps>
  /** @internal */
  protected readonly hiddenEnd: Signal<PartProps>
  private readonly startRef = viewChild<ElementRef<HTMLInputElement>>("start")
  private readonly endRef = viewChild<ElementRef<HTMLInputElement>>("end")

  constructor() {
    const env = injectEnvironment()
    const field = inject(FieldRoot, { self: true })
    const popover = inject(PopoverRoot, { self: true })
    const instance = field.instance
    const loc = injectLocale(
      () => this.locale(),
      () => this.dir(),
    )
    const allMessages = injectMessages("date-field", dateFieldMessages, () => this.messages())
    // Time ends: a time field per end, named "Start time" / "End time" (spec "Range Mode").
    const sample = () =>
      this.value()?.start ?? this.defaultValue()?.start ?? this.placeholderValue() ?? null
    const timeEnds = () => this.maxGranularity() === "hour" || sample() instanceof Time
    const messages = () =>
      timeEnds()
        ? { ...allMessages(), startDate: allMessages().startTime, endDate: allMessages().endTime }
        : allMessages()
    const enclosing = injectFieldBindingPeek()
    const fieldsetDisabled = injectFieldsetDisabled()
    const disabled = () =>
      field.disabled() || enclosing?.().state.disabled === true || fieldsetDisabled()
    const readOnly = () => field.readonly() || enclosing?.().state.readOnly === true
    const required = () => field.required() || enclosing?.().state.required === true
    // A consumer's details.cancel() of the last change (a refused pick keeps the popover open).
    const cancelled = { current: false }
    const triggers = signal(0)
    const machineProps = () => ({
      value: this.value(),
      defaultValue: this.defaultValue(),
      onValueChange: (
        v: DateRangeFieldValue,
        details: { event: { type: string }; cancel(): void },
      ) => {
        cancelled.current = false
        let refused = false
        this.valueChangeDetails.emit({
          value: v,
          details: {
            reason: details.event.type,
            cancel: () => {
              refused = true
              cancelled.current = true
              details.cancel()
            },
          },
        })
        if (!refused) this.valueChange.emit(v)
      },
      isDateUnavailable: this.isDateUnavailable(),
      allowsNonContiguousRanges: this.allowsNonContiguousRanges(),
      allowsOvernight: this.allowsOvernight(),
      required: required(),
      messages: messages(),
    })
    // Sound: the props built here are the range machine's (React's own cast).
    const { view, send } = injectMachine(dateRangeFieldMachine, machineProps as never)
    const state = () => rangeStateOf(view().context, machineProps() as never)
    const inputEl: { value: HTMLElement | null } = { value: null }
    const startHidden: { value: HTMLInputElement | null } = { value: null }
    const endHidden: { value: HTMLInputElement | null } = { value: null }
    const focusWithin = signal(false)
    const api = (binding: FieldControlBinding | null) => {
      const { calendar, formatLocale } = resolveCalendar(loc().locale)
      const s = sample()
      return dateRangeConnect({
        instance: instance(),
        state: state(),
        start: view().context.start.value,
        end: view().context.end.value,
        // The ends' own default: minutes for a time or a date-time, else days.
        granularity:
          this.granularity() ?? (timeEnds() || (s !== null && "hour" in s) ? "minute" : "day"),
        ...(s === null && timeEnds() ? { kind: "time" as const } : {}),
        locale: formatLocale,
        calendar,
        messages: messages(),
        field: mergeFieldProps(
          {
            role: "group",
            labelable: false,
            disabled: disabled(),
            readOnly: readOnly(),
            required: required(),
          },
          binding ?? enclosing?.() ?? null,
        ),
        labelledBy: binding?.ids.label,
        startName: this.startName(),
        endName: this.endName(),
        form: this.form(),
        minValue: this.minValue(),
        maxValue: this.maxValue(),
        focusWithin: focusWithin(),
      })
    }
    this.ctx = {
      instance,
      view,
      send,
      end: () => {
        const placeholderValue = this.placeholderValue()
        const granularity = this.granularity()
        const maxGranularity = this.maxGranularity()
        const hourCycle = this.hourCycle()
        const hideTimeZone = this.hideTimeZone()
        const leading = this.shouldForceLeadingZeros()
        const minValue = this.minValue()
        const maxValue = this.maxValue()
        const isDateUnavailable = this.isDateUnavailable()
        const own = this.messages()
        return {
          ...(placeholderValue ? { placeholderValue } : {}),
          ...(granularity ? { granularity } : {}),
          ...(maxGranularity ? { maxGranularity } : {}),
          ...(hourCycle ? { hourCycle } : {}),
          ...(hideTimeZone !== undefined ? { hideTimeZone } : {}),
          ...(leading !== undefined ? { shouldForceLeadingZeros: leading } : {}),
          ...(minValue !== undefined ? { minValue } : {}),
          ...(maxValue !== undefined ? { maxValue } : {}),
          ...(isDateUnavailable ? { isDateUnavailable } : {}),
          locale: loc().locale,
          dir: loc().dir,
          disabled: disabled(),
          readOnly: readOnly(),
          ...(own ? { messages: own } : {}),
        }
      },
      inputEl,
      hidden: { start: startHidden, end: endHidden },
      api,
      state,
      triggers,
      cancelled,
      closeOnSelect: () => this.closeOnSelect(),
      allowsNonContiguousRanges: () => this.allowsNonContiguousRanges(),
      firstDayOfWeek: () => this.firstDayOfWeek(),
      granularity: () => this.granularity(),
      placeholderValue: () => this.placeholderValue(),
    }
    const own = computed(() => api(null))
    this.hiddenStart = computed(() => own().hiddenInput("start"))
    this.hiddenEnd = computed(() => own().hiddenInput("end"))
    // The picker: the Popover's id, disabled and focus are the range's.
    inject(POPOVER_OVERRIDE, { self: true }).source = {
      id: instance,
      disabled,
      initialFocus: () => {
        const given = this.initialFocus()
        return given === undefined ? calendarTabStop(instance()) : given
      },
      persistentElements: () => {
        const control = controlElement(untracked(instance))
        return [...(control ? [control] : []), ...(untracked(this.persistentElements)?.() ?? [])]
      },
    }
    popover.openChangeDetails.subscribe(({ value, details: d }) => {
      if (value && readOnly()) {
        d.cancel()
        return
      }
      this.openChangeDetails.emit({
        value,
        details: {
          reason: value ? "trigger" : (d.reason as DatePickerCloseReason),
          cancel: d.cancel,
        },
      })
    })
    popover.openChange.subscribe((v) => this.openChange.emit(v))
    bindProps(
      () => ({
        ...own().root(),
        onFocusIn: () => focusWithin.set(true),
        onFocusOut: (e: FocusEvent) => {
          const root = e.currentTarget as Element
          if (!root.contains(e.relatedTarget as Node | null)) focusWithin.set(false)
        },
      }),
      {
        owns: [
          "selectionmode",
          "startname",
          "endname",
          "form",
          "granularity",
          "locale",
          "closeonselect",
          "firstdayofweek",
        ],
      },
    )
    if (inject(PLATFORM_ID) !== "browser") return
    // Both hidden inputs: their values, a form reset, nothing adopted from autofill yet.
    const forms = {
      start: hiddenFormInput({ input: () => startHidden.value, control: () => null }, env),
      end: hiddenFormInput({ input: () => endHidden.value, control: () => null }, env),
    }
    afterEveryRender(() => {
      startHidden.value = this.startRef()?.nativeElement ?? null
      endHidden.value = this.endRef()?.nativeElement ?? null
      const a = untracked(() => api(null))
      // The pair's own validity on the start hidden input (the registered validity element).
      if (startHidden.value) setControlValidity(startHidden.value, untracked(state).message)
      forms.start.sync({ value: a.formValue("start") }, { dispatch: false })
      forms.end.sync({ value: a.formValue("end") }, { dispatch: false })
    })
    const destroy = inject(DestroyRef)
    afterNextRender(() => {
      for (const edge of ["start", "end"] as const) {
        destroy.onDestroy(
          forms[edge].track({
            onReset: () => send({ type: "RESET" }),
            current: () => ({ value: untracked(() => api(null)).formValue(edge) }),
            // A browser autofill of a valid ISO string is adopted into that end.
            onNativeInput: (el) => {
              const v = parseEndValue(el.value, el.type)
              if (v === null) return false
              send({
                type: edge === "start" ? "START.COMMIT" : "END.COMMIT",
                value: v,
                reason: "ADOPT",
              })
              return true
            },
          }),
        )
      }
    })
  }
}
