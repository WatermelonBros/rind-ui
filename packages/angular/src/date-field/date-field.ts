// Date Field parts: wiring only. The machine owns the draft and the value; connect every
// attribute, the key mapping and the insertion plan; core/dom the segment layout. The Root
// is a Field when not inside one (the Field as a host directive), or a plain element when
// embedded in a range; the hidden native input carries name, constraints and reset.
import {
  afterEveryRender,
  afterNextRender,
  afterRenderEffect,
  booleanAttribute,
  Component,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  effect,
  forwardRef,
  inject,
  input,
  isDevMode,
  output,
  PLATFORM_ID,
  type Signal,
  signal,
  untracked,
  ViewEncapsulation,
  viewChild,
} from "@angular/core"
import {
  adjacentSegment,
  type CreateCalendar,
  type DateFieldBoundary,
  type DateFieldDraftHint,
  type DateFieldMessages,
  type DateFieldReason,
  type DateGranularity,
  type DateSegmentType,
  type DateValidityFlags,
  type DateValue,
  type DayOfWeek,
  dateClockCapability,
  dateFieldConnect,
  dateFieldKey,
  dateFieldMachine,
  dateFieldMessages,
  defaultPlaceholderValue,
  describeKey,
  type FieldValue,
  type FocusTarget,
  focusSafely,
  formatFor,
  formValueOf,
  hiddenFormInput,
  type MessageOverrides,
  mergeFieldProps,
  type PartProps,
  planSegmentInput,
  quirkActive,
  resolveCalendar,
  type SegmentPart,
  segmentAtPress,
  segmentId,
  setControlValidity,
  Time,
  today as todayOf,
  todayZone,
  valueKind,
} from "@rind-ui/core"
import { absentProps } from "../absent"
import { bindProps, joinHandlers } from "../bind-props"
import { FIELD_HOST, injectFieldBindingPeek, injectFieldControl } from "../field/context"
import { FieldRoot } from "../field/field"
import { injectFieldsetDisabled } from "../fieldset/context"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectModality } from "../inject-press"
import { injectRendered } from "../layer-context"
import {
  injectPopoverControls,
  POPOVER_OVERRIDE,
  POPOVER_SCOPE,
  PopoverRoot,
} from "../popover/popover"
import { injectEnvironment, injectLocale, injectMessages } from "../provider"
import { RindProps } from "../rind-props"
import {
  type BaseInput,
  type Ctx,
  DATE_FIELD,
  DATE_RANGE,
  type DateFieldState,
  IN_CONTROL,
  injectApi,
  injectDateField,
  injectDateFieldOrNull,
  injectDateRange,
  RANGE_TRIGGERS,
  SINGLE,
} from "./context"

/** Machine events → the public reasons (spec "Commit Points"). */
function publicReason(type: string): DateFieldReason {
  switch (type) {
    case "INCREASE":
    case "DECREASE":
    case "PAGE_PREV":
    case "PAGE_NEXT":
    case "FIRST":
    case "LAST":
      return "STEP"
    case "PASTE":
      return "PASTE"
    case "BACKSPACE":
    case "CLEAR_ALL":
    case "CLEAR":
      return "CLEAR"
    case "PICK":
      return "CALENDAR"
    case "RESET":
      return "RESET"
    default:
      return "SEGMENT.COMMIT"
  }
}

export interface DateFieldChangeDetails {
  readonly reason: DateFieldReason
  readonly modality: string | undefined
  cancel(): void
}

/** What a `valueChangeDetails` output emits. */
export interface DateFieldValueEvent {
  readonly value: FieldValue | null
  readonly details: DateFieldChangeDetails
}

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

/** What an `openChangeDetails` output emits. */
export interface DatePickerOpenEvent {
  readonly value: boolean
  readonly details: DatePickerOpenChangeDetails
}

export type { DateFieldState }

/** The calendar's tab stop in the open content: the initial focus (spec "Initial Focus"). */
export const calendarTabStop = (instance: string) => (): HTMLElement | null =>
  (typeof document === "undefined"
    ? null
    : document
        .getElementById(`date-field-${instance}-content`)
        ?.querySelector<HTMLElement>('[data-scope="calendar"][data-part="cell"][tabindex="0"]')) ??
  null

/** The picker's Control is the anchor and dismissal-inside element (spec "Dismissal"). */
export const controlElement = (instance: string): HTMLElement | null =>
  typeof document === "undefined" ? null : document.getElementById(`date-field-${instance}-anchor`)

/** What one field reads: the single Root's inputs, or a range's end. */
export interface SingleOptions {
  readonly instance: () => string
  readonly embedded: boolean
  readonly value: () => FieldValue | null | undefined
  readonly defaultValue: () => FieldValue | null
  readonly placeholderValue: () => FieldValue | undefined
  readonly granularity: () => DateGranularity | undefined
  readonly maxGranularity: () => "year" | "hour" | undefined
  readonly hourCycle: () => 12 | 24 | undefined
  readonly hideTimeZone: () => boolean | undefined
  readonly shouldForceLeadingZeros: () => boolean | undefined
  readonly minValue: () => FieldValue | null | undefined
  readonly maxValue: () => FieldValue | null | undefined
  readonly isDateUnavailable: () => ((date: DateValue) => boolean) | undefined
  readonly locale: () => string | undefined
  readonly dir: () => "ltr" | "rtl" | undefined
  readonly createCalendar: () => CreateCalendar | undefined
  readonly messages: () => MessageOverrides<DateFieldMessages> | undefined
  /** The Root's own flags (the enclosing Field's and Fieldset's are added). */
  readonly disabled: () => boolean
  readonly readOnly: () => boolean
  readonly required: () => boolean
  readonly invalid: () => boolean | undefined
  readonly describedBy?: () => string | undefined
  readonly labelledBy?: () => string | undefined
  readonly autoComplete?: () => string | undefined
  readonly form?: () => string | undefined
  readonly segmentScope?: () => HTMLElement | null
  readonly closeOnSelect: () => boolean
  readonly firstDayOfWeek: () => DayOfWeek | undefined
  readonly onValueChange: (value: FieldValue | null, details: DateFieldChangeDetails) => void
  readonly onBoundary?: (boundary: DateFieldBoundary) => void
  readonly onDraftChange?: (hint: DateFieldDraftHint) => void
  readonly onClearAll?: () => void
  readonly onValidityChange?: (flags: DateValidityFlags, message: string) => void
}

/** One field's machine and context. Call it in a constructor. */
export function injectSingleField(o: SingleOptions): {
  readonly ctx: Ctx
  readonly rootApi: Signal<ReturnType<typeof dateFieldConnect>>
} {
  const env = injectEnvironment(dateClockCapability)
  const loc = injectLocale(o.locale, o.dir)
  const messages = injectMessages("date-field", dateFieldMessages, o.messages)
  // One calendar object per system: a new one each render would recompute the segments.
  let calendarObj: ReturnType<typeof resolveCalendar>["calendar"] | undefined
  const resolved = computed(() => {
    const r = resolveCalendar(loc().locale, o.createCalendar())
    if (calendarObj?.identifier !== r.calendar.identifier) calendarObj = r.calendar
    return { calendar: calendarObj, formatLocale: r.formatLocale }
  })
  const peeked = injectFieldBindingPeek()
  // Embedded: the host is the field; an enclosing Field is not this control's.
  const enclosing = () => (o.embedded ? null : (peeked?.() ?? null))
  const fieldsetDisabled = injectFieldsetDisabled()
  const disabled = () => o.disabled() || enclosing()?.state.disabled === true || fieldsetDisabled()
  const readOnly = () => o.readOnly() || enclosing()?.state.readOnly === true
  const required = () => o.required() || enclosing()?.state.required === true
  // Today is read once: a placeholder that moved at midnight would rewrite a stepped segment.
  let placeholder: FieldValue | undefined
  const placeholderNow = () => {
    if (placeholder) return placeholder
    const given = untracked(o.placeholderValue)
    if (given) {
      placeholder = given
      return given
    }
    const v = untracked(o.value)
    const current = v === undefined ? untracked(o.defaultValue) : v
    placeholder = defaultPlaceholderValue({
      today: todayOf(env.dateClock, todayZone(undefined, current instanceof Time ? null : current)),
      granularity: untracked(o.granularity),
      maxGranularity: untracked(o.maxGranularity),
      timeZone: current && "timeZone" in current ? current.timeZone : undefined,
      minValue: untracked(o.minValue),
      maxValue: untracked(o.maxValue),
    })
    return placeholder
  }
  const inputEl: { value: HTMLElement | null } = { value: null }
  const hiddenEl: { value: HTMLInputElement | null } = { value: null }
  const selectAll = { current: false }
  let pendingFocus: DateSegmentType | null = null
  const formInput = hiddenFormInput(
    {
      input: () => hiddenEl.value,
      control: () => inputEl.value?.querySelector<HTMLInputElement>("input[data-editable]") ?? null,
    },
    env,
  )
  // A consumer's details.cancel() of the last change (a refused pick keeps the popover open).
  const cancelled = { current: false }
  // Picker triggers rendered: Alt+ArrowDown opens only a picker.
  const triggers = signal(0)
  const machineEnv = {
    formInput: o.embedded ? undefined : formInput,
    navigation: {
      adjacent: (segment: DateSegmentType, direction: "next" | "previous") => {
        const root = inputEl.value
        const from = root?.ownerDocument.getElementById(segmentId(untracked(o.instance), segment))
        if (!root || !from) return null
        const scope = o.segmentScope?.() ?? null
        const el = adjacentSegment(from, direction, { root, scope, dir: untracked(loc).dir })
        if (!el) return null
        // Sound: every editable segment input carries its segment type as data-type (connect).
        if (root.contains(el)) return el.getAttribute("data-type") as DateSegmentType
        void focusSafely(el, env, "programmatic", "keyboard")
        return "external" as const
      },
    },
  }
  const machineProps = () => ({
    value: o.value(),
    defaultValue: o.defaultValue(),
    onValueChange: (v: FieldValue | null, details: { event: { type: string }; cancel(): void }) => {
      cancelled.current = false
      o.onValueChange(v, {
        reason: publicReason(details.event.type),
        modality: (details.event as { modality?: string }).modality,
        cancel: () => {
          cancelled.current = true
          details.cancel()
        },
      })
    },
    placeholderValue: placeholderNow(),
    locale: resolved().formatLocale,
    calendar: resolved().calendar,
    granularity: o.granularity(),
    maxGranularity: o.maxGranularity(),
    hourCycle: o.hourCycle(),
    hideTimeZone: o.hideTimeZone(),
    shouldForceLeadingZeros: o.shouldForceLeadingZeros(),
    disabled: disabled(),
    readOnly: readOnly(),
    onBoundary: (b: DateFieldBoundary) => o.onBoundary?.(b),
    onDraftChange: (hint: DateFieldDraftHint) => o.onDraftChange?.(hint),
    focusSegment: (t: DateSegmentType) => {
      pendingFocus = t
    },
    id: o.instance(),
  })
  // Sound: the props built here are the date-field machine's (React's own cast).
  const { view, send } = injectMachine(dateFieldMachine, machineProps as never, machineEnv)
  const modality = injectModality(env.modality, () => view().context.active !== null)
  const mounted = injectRendered()
  const base = (): BaseInput => {
    const v = view()
    const valueNow = v.values.value ?? null
    const format = formatFor(machineProps() as never, valueNow)
    const kindSource = valueNow ?? o.defaultValue() ?? placeholderNow()
    return {
      instance: o.instance(),
      format,
      draft: v.context.draft,
      value: valueNow,
      defaultValue: o.defaultValue(),
      kind: valueKind(kindSource),
      granularity: format.options.granularity,
      active: v.context.active,
      modality: modality(),
      composing: v.matches("composing"),
      minValue: o.minValue(),
      maxValue: o.maxValue(),
      isDateUnavailable: o.isDateUnavailable(),
      required: required(),
      messages: messages(),
      // Platform attributes after render only (date-segments "Server Rendering").
      plainTextbox: mounted() && quirkActive("ios-vo-spinbutton-input", env),
      embedded: o.embedded,
      autoComplete: o.autoComplete?.(),
      form: o.form?.(),
      dir: loc().dir,
    }
  }
  const own = () => ({
    disabled: disabled(),
    readOnly: readOnly(),
    required: required(),
    invalid: o.invalid(),
    describedBy: o.embedded ? o.describedBy?.() : undefined,
    labelledBy: o.embedded ? o.labelledBy?.() : undefined,
  })
  // The Root's own attributes and the validity need no Field binding.
  const rootApi = computed(() =>
    dateFieldConnect({
      ...base(),
      field: mergeFieldProps(
        {
          role: "group",
          labelable: false,
          disabled: disabled(),
          readOnly: readOnly(),
          required: required(),
        },
        null,
      ),
      labelledBy: own().labelledBy,
    }),
  )
  const state = (): DateFieldState => ({
    value: view().values.value ?? null,
    segments: rootApi().segments(),
    focusedSegment: view().context.active,
    composing: view().matches("composing"),
    disabled: disabled(),
    readOnly: readOnly(),
  })
  const ctx: Ctx = {
    instance: o.instance,
    view,
    send,
    base,
    own,
    embedded: o.embedded,
    onClearAll: () => o.onClearAll?.(),
    disabled,
    readOnly,
    dir: () => loc().dir,
    inputEl,
    hiddenEl,
    formInput,
    selectAll,
    state,
    picker: {
      closeOnSelect: o.closeOnSelect,
      firstDayOfWeek: o.firstDayOfWeek,
      placeholder: placeholderNow,
      cancelled,
      triggers,
    },
  }
  if (inject(PLATFORM_ID) === "browser") {
    // A requested focus move, once the step that asked for it is rendered (react-spectrum#10683).
    afterRenderEffect(() => {
      view()
      const t = pendingFocus
      if (t === null) return
      pendingFocus = null
      const el = inputEl.value?.ownerDocument.getElementById(segmentId(untracked(o.instance), t))
      if (el && el.ownerDocument.activeElement !== el) {
        void focusSafely(el, env, "programmatic", env.modality.modality())
      }
    })
    // The control's own validity: on the validity element, or to the embedding host.
    let reported: string | null = null
    afterRenderEffect(() => {
      const validity = rootApi().validity
      const key = `${validity.reason}|${validity.message}`
      if (reported === key) return
      reported = key
      if (o.embedded) o.onValidityChange?.(validity.flags, validity.message)
      else if (hiddenEl.value) setControlValidity(hiddenEl.value, validity.message)
    })
  }
  return { ctx, rootApi }
}

const optionalBoolean = (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false)

/** The picker's open state through the hosted Popover, re-emitted with the picker's reasons. */
function injectPickerOpen(
  readOnly: () => boolean,
  details: { emit(e: DatePickerOpenEvent): void },
  change: { emit(v: boolean): void },
) {
  const popover = inject(PopoverRoot, { self: true })
  popover.openChangeDetails.subscribe(({ value, details: d }) => {
    // Read-only: the trigger stays focusable but never opens.
    if (value && readOnly()) {
      d.cancel()
      return
    }
    details.emit({
      value,
      details: {
        reason: value ? "trigger" : (d.reason as DatePickerCloseReason),
        cancel: d.cancel,
      },
    })
  })
  popover.openChange.subscribe((v) => change.emit(v))
}

/** The Popover options the date field decides (its id, disabled, focus, the Control inside). */
function injectPickerPopover(
  instance: () => string,
  disabled: () => boolean,
  initialFocus: () => (() => FocusTarget) | null | undefined,
  persistent: () => (() => readonly Element[]) | undefined,
) {
  inject(POPOVER_OVERRIDE, { self: true }).source = {
    id: instance,
    disabled,
    initialFocus: () => {
      const given = initialFocus()
      return given === undefined ? calendarTabStop(instance()) : given
    },
    // The Control (field and triggers) is inside the picker for dismissal.
    persistentElements: () => {
      const control = controlElement(untracked(instance))
      return [...(control ? [control] : []), ...(untracked(persistent)?.() ?? [])]
    },
  }
}

/** The Field inputs a date field forwards to its Field (`fieldMessages`: the Field's own). */
export const FIELD_INPUTS = [
  "name",
  "disabled",
  "readonly",
  "required",
  "invalid",
  "touched",
  "dirty",
  "errors",
  "validate",
  "validationMode",
  "validationBehavior",
  "validationDebounce",
  "errorMessageAttribute",
  "messages: fieldMessages",
  "id",
]

/** The Popover inputs a date field forwards to its picker. */
export const POPOVER_INPUTS = ["open", "defaultOpen", "modal", "finalFocus", "positioning"]

/**
 * A date, a date-time or a time typed segment by segment, with an optional calendar picker:
 * `<div rindDateFieldRoot>` (a Field, unless inside one) holding a Label, an Input (or a
 * Control around it with a Trigger) and, in `<ng-template rindDateFieldPortal>`, a Positioner
 * holding the Content and its Calendar. `selectionMode="range"`: a pair of ends.
 */
@Component({
  selector: "[rindDateFieldRoot]:not([selectionMode=range])",
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
    { provide: DATE_FIELD, useFactory: () => inject(forwardRef(() => DateFieldRoot)).ctx },
    {
      provide: SINGLE,
      useFactory: () => {
        const ctx = inject(forwardRef(() => DateFieldRoot)).ctx
        return { ctx, api: injectApi(ctx) }
      },
    },
  ],
  template: `<ng-content /><input #hidden [rindProps]="hiddenProps()" />`,
})
export class DateFieldRoot {
  /** A date, a date-time, a zoned date-time, or a `Time` (a time field); `[(value)]`. */
  readonly value = input<FieldValue | null>()
  /** Read at creation; a later change only changes what a form reset restores. */
  readonly defaultValue = input<FieldValue | null>(null)
  /** The value stepping starts from, and the type and zone without a value. */
  readonly placeholderValue = input<FieldValue>()
  readonly granularity = input<DateGranularity>()
  /**
   * `"hour"`: no date segments (a time field). A date-time keeps its date; without a value
   * or placeholder the field holds a `Time`. Default: `"hour"` for a `Time` value, else `"year"`.
   */
  readonly maxGranularity = input<"year" | "hour">()
  readonly hourCycle = input<12 | 24>()
  readonly hideTimeZone = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly shouldForceLeadingZeros = input<boolean | undefined, boolean | "" | undefined>(
    undefined,
    { transform: optionalBoolean },
  )
  /** A `Time` bound compares with a date-time value on the value's own day. */
  readonly minValue = input<FieldValue | null>(null)
  readonly maxValue = input<FieldValue | null>(null)
  readonly isDateUnavailable = input<(date: DateValue) => boolean>()
  readonly locale = input<string>()
  /** The Root's `dir` and which way Left/Right move between segments. Default: the locale's. */
  readonly dir = input<"ltr" | "rtl">()
  /** Calendar systems other than gregorian (`createCalendar` from @internationalized/date). */
  readonly createCalendar = input<CreateCalendar>()
  readonly form = input<string>()
  /** On the hidden input only (`bday`, …). */
  readonly autoComplete = input<string>()
  readonly messages = input<MessageOverrides<DateFieldMessages>>()
  /** A pick closes the popover (default true). */
  readonly closeOnSelect = input(true, { transform: booleanAttribute })
  /** The calendar's first day of the week. */
  readonly firstDayOfWeek = input<DayOfWeek>()
  /** The picker's first focus (default: the calendar's tab stop). */
  readonly initialFocus = input<(() => FocusTarget) | null>()
  /** Elements whose presses and focus count as inside the picker. */
  readonly persistentElements = input<() => readonly Element[]>()
  readonly valueChangeDetails = output<DateFieldValueEvent>()
  /** The value, for `[(value)]`. */
  readonly valueChange = output<FieldValue | null>()
  /** Every open or close request of the picker, with `details.reason` and `details.cancel()`. */
  readonly openChangeDetails = output<DatePickerOpenEvent>()
  /** The picker's open state, for `[(open)]`. */
  readonly openChange = output<boolean>()
  /** Auto-advance, Backspace or an arrow found no segment to move to. */
  readonly boundary = output<DateFieldBoundary>()
  /** The committed year, month and day (a host following the typed date). */
  readonly draftChange = output<DateFieldDraftHint>()

  /** @internal */
  readonly ctx: Ctx
  /** The field's state, for the template (`#d="rindDateFieldRoot"`, `d.state()`). */
  readonly state: Signal<DateFieldState>
  /** @internal */
  protected readonly hiddenProps: Signal<PartProps>
  private readonly hiddenRef = viewChild<ElementRef<HTMLInputElement>>("hidden")

  constructor() {
    const field = inject(FieldRoot, { self: true })
    const { ctx, rootApi } = injectSingleField({
      instance: field.instance,
      embedded: false,
      value: () => this.value(),
      defaultValue: () => this.defaultValue(),
      placeholderValue: () => this.placeholderValue(),
      granularity: () => this.granularity(),
      maxGranularity: () => this.maxGranularity(),
      hourCycle: () => this.hourCycle(),
      hideTimeZone: () => this.hideTimeZone(),
      shouldForceLeadingZeros: () => this.shouldForceLeadingZeros(),
      minValue: () => this.minValue(),
      maxValue: () => this.maxValue(),
      isDateUnavailable: () => this.isDateUnavailable(),
      locale: () => this.locale(),
      dir: () => this.dir(),
      createCalendar: () => this.createCalendar(),
      messages: () => this.messages(),
      disabled: () => field.disabled(),
      readOnly: () => field.readonly(),
      required: () => field.required(),
      invalid: () => field.invalid(),
      autoComplete: () => this.autoComplete(),
      form: () => this.form(),
      closeOnSelect: () => this.closeOnSelect(),
      firstDayOfWeek: () => this.firstDayOfWeek(),
      onValueChange: (v, d) => {
        let refused = false
        this.valueChangeDetails.emit({
          value: v,
          details: {
            ...d,
            cancel: () => {
              refused = true
              d.cancel()
            },
          },
        })
        if (!refused) this.valueChange.emit(v)
      },
      onBoundary: (b) => this.boundary.emit(b),
      onDraftChange: (h) => this.draftChange.emit(h),
    })
    this.ctx = ctx
    this.state = computed(() => ctx.state())
    injectPickerPopover(
      field.instance,
      () => ctx.disabled(),
      () => this.initialFocus(),
      () => this.persistentElements(),
    )
    injectPickerOpen(() => ctx.readOnly(), this.openChangeDetails, this.openChange)
    const api = injectApi(ctx)
    this.hiddenProps = computed(() => api().hiddenInput())
    bindProps(() => rootApi().root(), {
      owns: ["closeonselect", "firstdayofweek", "granularity", "locale", "form", "autocomplete"],
    })
    if (inject(PLATFORM_ID) !== "browser") return
    // The hidden native input: name, ISO value, constraints, validity, reset, autofill.
    const mirror = () => ({
      value: formValueOf(untracked(ctx.view).values.value ?? null, untracked(ctx.base).granularity),
    })
    afterEveryRender(() => {
      ctx.hiddenEl.value = this.hiddenRef()?.nativeElement ?? null
      ctx.formInput.sync(mirror(), { dispatch: false })
    })
    const destroy = inject(DestroyRef)
    afterNextRender(() =>
      destroy.onDestroy(
        ctx.formInput.track({
          onReset: () => ctx.send({ type: "RESET" }),
          current: mirror,
          onNativeInput: (el) => {
            ctx.send({ type: "INPUT.ADOPT", value: el.value })
            return true
          },
        }),
      ),
    )
  }
}

/** What a range gives one of its ends (an embedded field). Internal. */
export interface EmbeddedEnd {
  readonly options: Omit<SingleOptions, "instance" | "embedded">
}

/** An end of a range: an embedded field, no Field, no hidden input. Internal. */
@Directive({
  selector: "[rindDateFieldEmbedded]",
  providers: [
    {
      provide: DATE_FIELD,
      useFactory: () => inject(forwardRef(() => DateFieldEmbedded)).ctx,
    },
    { provide: SINGLE, useValue: null },
    { provide: IN_CONTROL, useValue: false },
  ],
})
export class DateFieldEmbedded {
  readonly rindDateFieldEmbedded = input.required<EmbeddedEnd>()
  /** @internal */
  readonly ctx: Ctx
  constructor() {
    const instance = injectRootId(() => undefined)
    const o = () => this.rindDateFieldEmbedded().options
    const { ctx, rootApi } = injectSingleField({
      instance,
      embedded: true,
      value: () => o().value(),
      defaultValue: () => o().defaultValue(),
      placeholderValue: () => o().placeholderValue(),
      granularity: () => o().granularity(),
      maxGranularity: () => o().maxGranularity(),
      hourCycle: () => o().hourCycle(),
      hideTimeZone: () => o().hideTimeZone(),
      shouldForceLeadingZeros: () => o().shouldForceLeadingZeros(),
      minValue: () => o().minValue(),
      maxValue: () => o().maxValue(),
      isDateUnavailable: () => o().isDateUnavailable(),
      locale: () => o().locale(),
      dir: () => o().dir(),
      createCalendar: () => o().createCalendar(),
      messages: () => o().messages(),
      disabled: () => o().disabled(),
      readOnly: () => o().readOnly(),
      required: () => o().required(),
      invalid: () => o().invalid(),
      describedBy: () => o().describedBy?.(),
      labelledBy: () => o().labelledBy?.(),
      segmentScope: () => untracked(o).segmentScope?.() ?? null,
      closeOnSelect: () => o().closeOnSelect(),
      firstDayOfWeek: () => o().firstDayOfWeek(),
      onValueChange: (v, d) => untracked(o).onValueChange(v, d),
      onBoundary: (b) => untracked(o).onBoundary?.(b),
      onClearAll: () => untracked(o).onClearAll?.(),
      onValidityChange: (f, m) => untracked(o).onValidityChange?.(f, m),
    })
    this.ctx = ctx
    // An embedded Root carries only plain element props (no Field props).
    bindProps(() => ({
      "data-scope": "date-field",
      "data-part": "root",
      "data-instance": instance(),
      ...rootApi().root(),
    }))
  }
}

/** One segment: an input for an editable segment or the zone, a hidden span for a literal. */
@Directive({ selector: "[rindDateFieldSegment]", exportAs: "rindDateFieldSegment" })
export class DateFieldSegment {
  /** The segment to render, one of the Input's `segments()`. */
  readonly segment = input.required<SegmentPart>()
  constructor() {
    const ctx = injectDateField("Segment")
    const api = injectApi(ctx)
    const env = injectEnvironment()
    const el: Element = inject(ElementRef).nativeElement
    const popover = injectPopoverControls()
    // A range's triggers, provided above its embedded ends (Alt+ArrowDown).
    const rangeTriggers = inject(RANGE_TRIGGERS, { optional: true })
    const type = () => untracked(this.segment).type as DateSegmentType
    bindProps(() => {
      const s = this.segment()
      const own = api().segment(s)
      if (s.type === "literal") {
        // A literal's text is the segment's (the server's formatter may differ in a literal).
        return { ...own, children: s.text }
      }
      if (s.type === "timeZoneName") return own
      return joinHandlers(own, {
        onFocus: (e: FocusEvent) => {
          ctx.selectAll.current = false
          ctx.send({ type: "SEGMENT.FOCUS", segment: type(), modality: env.modality.modality() })
          // The whole text selected, as the native control highlights its sub-field.
          ;(e.currentTarget as HTMLInputElement).select()
        },
        onBlur: (e: FocusEvent) => {
          const next = e.relatedTarget as Node | null
          const inside = next !== null && ctx.inputEl.value?.contains(next) === true
          ctx.send({ type: "SEGMENT.BLUR", related: inside ? "segment" : "outside" })
        },
        onKeyDown: (e: KeyboardEvent) => {
          if (e.defaultPrevented) return
          const event = dateFieldKey(describeKey(e, env), type(), {
            dir: ctx.dir(),
            platform: env.platform,
            selectAll: ctx.selectAll.current,
          })
          if (event === "select-all") {
            ctx.selectAll.current = true
            return
          }
          if (event === "settle") {
            // Not prevented: the form's implicit submission follows, with the value committed.
            ctx.send({ type: "SETTLE" })
            return
          }
          if (event === "open-picker") {
            // Only a picker opens; otherwise the key is the browser's. A range's ends are
            // embedded: their host's triggers count.
            const count = ctx.embedded
              ? (untracked(() => rangeTriggers?.()) ?? 0)
              : untracked(ctx.picker.triggers)
            if (count === 0 || !popover || popover.open()) return
            e.preventDefault()
            popover.send({ type: "trigger", modality: "keyboard" })
            return
          }
          ctx.selectAll.current = false
          if (!event) return
          e.preventDefault()
          // Embedded: select all + Backspace clears the host's pair, even when this field's own
          // value does not change (a partial end).
          if (typeof event === "object" && event.type === "CLEAR_ALL") ctx.onClearAll()
          ctx.send(event)
        },
        onCompositionStart: () => ctx.send({ type: "COMPOSITION.START" }),
        onCompositionEnd: (e: CompositionEvent) =>
          ctx.send({ type: "COMPOSITION.END", segment: type(), text: e.data }),
        onPaste: (e: ClipboardEvent) => {
          e.preventDefault()
          if (ctx.disabled() || ctx.readOnly()) return
          ctx.send({ type: "PASTE", text: e.clipboardData?.getData("text") ?? "" })
        },
        onCopy: (e: ClipboardEvent) => {
          e.preventDefault()
          e.clipboardData?.setData("text/plain", untracked(api).copyText(type()))
        },
      })
    })
    if (inject(PLATFORM_ID) !== "browser") return
    // `beforeinput`: insertions are planned before they apply.
    const onBeforeInput = (e: Event) => {
      const t = untracked(this.segment).type
      if (t === "literal" || t === "timeZoneName") return
      const ie = e as InputEvent
      if (untracked(ctx.view).matches("composing") || ie.isComposing) return
      const plan = planSegmentInput({ data: ie.data, inputType: ie.inputType }, type())
      if (plan.cancel) e.preventDefault()
      if (plan.event) ctx.send(plan.event)
    }
    el.addEventListener("beforeinput", onBeforeInput)
    inject(DestroyRef).onDestroy(() => el.removeEventListener("beforeinput", onBeforeInput))
  }
}

/**
 * The group: `<div rindDateFieldInput>`, one field's segments (or, in range mode, both ends
 * with a separator) and their hidden names. Empty, it renders its segments itself;
 * `#i="rindDateFieldInput"`, `i.segments()`, for segments of your own
 * (`<input rindDateFieldSegment [segment]="s">`, a `<span>` for a literal).
 */
@Component({
  selector: "[rindDateFieldInput]",
  exportAs: "rindDateFieldInput",
  imports: [
    RindProps,
    DateFieldSegment,
    forwardRef(() => DateFieldStart),
    forwardRef(() => DateFieldEnd),
  ],
  encapsulation: ViewEncapsulation.None,
  template: `<ng-content
      >@if (range) {<div rindDateFieldStart></div><span [rindProps]="separator()"></span
        ><div rindDateFieldEnd></div>} @else {@for (s of segments(); track s.key) {@if (s.type === "literal") {<span rindDateFieldSegment [segment]="s"></span>} @else {<input rindDateFieldSegment [segment]="s" />}}}</ng-content
    >@for (n of extras(); track n.key) {<span [rindProps]="n.props">{{ n.text }}</span>}`,
})
export class DateFieldInput {
  /** The segments in order, for segments of your own. */
  readonly segments: Signal<readonly SegmentPart[]>
  /** @internal In range mode (under the range Root, outside its ends). */
  protected readonly range: boolean
  /** @internal */
  protected readonly separator: Signal<PartProps>
  /** @internal The hidden segment names and value description (range: the ends' names). */
  protected readonly extras: Signal<readonly { key: string; props: PartProps; text: string }[]>

  constructor() {
    const single = injectDateFieldOrNull()
    const rangeCtx = injectDateRange()
    const env = injectEnvironment()
    const el: Element = inject(ElementRef).nativeElement
    this.range = !single && rangeCtx !== null
    if (this.range && rangeCtx) {
      const range = rangeCtx
      const binding = injectFieldControl()
      this.segments = signal([])
      this.separator = computed(() => range.api(binding?.() ?? null).separator())
      this.extras = computed(() => {
        const api = range.api(binding?.() ?? null)
        const description = api.valueDescription()
        const span = (key: string, p: PartProps) => {
          const { children, ...props } = p
          return { key, props, text: typeof children === "string" ? children : "" }
        }
        return [
          span("start", api.edgeName("start")),
          span("end", api.edgeName("end")),
          ...(description ? [span("description", description)] : []),
        ]
      })
      bindProps(() => range.api(binding?.() ?? null).input())
      if (inject(PLATFORM_ID) !== "browser") return
      range.inputEl.value = el instanceof HTMLElement ? el : null
      if (!binding) return
      const destroy = inject(DestroyRef)
      const firstSegment = () =>
        el.querySelector<HTMLElement>('[data-edge="start"] input[data-editable]')
      afterNextRender(() => {
        const api = untracked(() => range.api(binding()))
        const id = firstSegment()?.id ?? `${api.ids.input}-first`
        destroy.onDestroy(
          binding().register(
            {
              id,
              labelable: false,
              focus: (m) => {
                const f = firstSegment()
                if (f) void focusSafely(f, env, "programmatic", m)
              },
              validityElement: () => range.hidden.start.value,
              value: () => untracked(range.view).values.value ?? null,
            },
            id,
          ),
        )
      })
      // Each change of the pair's value or validity is reported to the Field once.
      const ready = injectRendered()
      let last: string | undefined
      effect(() => {
        const key = `${JSON.stringify(range.view().values.value ?? null)}|${range.state().message}`
        if (!ready() || last === undefined) {
          last = key
          return
        }
        if (key === last) return
        last = key
        untracked(() =>
          binding().report({
            type: "change",
            value: range.view().values.value ?? null,
            user: true,
            composing: false,
          }),
        )
      })
      return
    }
    const ctx = injectDateField("Input")
    // An embedded field is not the Field's control (its host is): it claims nothing.
    const binding = injectFieldControl({ skip: ctx.embedded })
    const api = injectApi(ctx)
    const inControl = inject(IN_CONTROL, { optional: true }) ?? false
    this.segments = computed(() => ctx.state().segments)
    this.separator = signal({})
    this.extras = computed(() => {
      const a = api()
      const description = a.valueDescription()
      return [
        ...a.segmentNames().map((n) => ({
          key: n.key,
          props: { ...n.props, "aria-hidden": "true" },
          text: n.text,
        })),
        ...(description
          ? [
              {
                key: "description",
                props: { ...description.props, "aria-hidden": "true" },
                text: description.text,
              },
            ]
          : []),
      ]
    })
    bindProps(() =>
      joinHandlers(api().input({ inControl }), {
        // A press on the group outside a segment: the last filled segment before it (pointer).
        onPointerDown: (e: PointerEvent) => {
          const root = ctx.inputEl.value
          if (!root || ctx.disabled() || (e.target as Element).closest("input")) return
          const seg = segmentAtPress(root, e.clientX, ctx.dir())
          if (!seg) return
          e.preventDefault()
          void focusSafely(seg, env, "programmatic", "pointer")
        },
        // The press's mousedown would move focus to the body (the group is not focusable).
        onMouseDown: (e: MouseEvent) => {
          if (!(e.target as Element).closest("input")) e.preventDefault()
        },
      }),
    )
    if (inject(PLATFORM_ID) !== "browser") return
    ctx.inputEl.value = el instanceof HTMLElement ? el : null
    if (!binding || ctx.embedded) return
    const destroy = inject(DestroyRef)
    const firstId = computed(() => {
      const first = api()
        .segments()
        .find((s) => s.editable)
      return first ? segmentId(ctx.instance(), first.type as DateSegmentType) : undefined
    })
    const ready = injectRendered()
    effect((onCleanup) => {
      const id = firstId()
      if (!ready() || !id) return
      onCleanup(
        untracked(() =>
          binding().register(
            {
              id,
              labelable: false,
              focus: (m) => {
                const f = el.ownerDocument.getElementById(id)
                if (f) void focusSafely(f, env, "programmatic", m)
              },
              validityElement: () => ctx.hiddenEl.value,
              value: () => untracked(ctx.view).values.value ?? null,
            },
            id,
          ),
        ),
      )
    })
    // Each commit that changed the value or the field's own validity is reported to the Field
    // once (date-field "Field Integration"): an impossible date leaves the value null but must
    // still be validated when the user leaves.
    let last: string | undefined
    effect(() => {
      const value = ctx.view().values.value ?? null
      const key = `${JSON.stringify(value)}|${api().validity.reason}`
      if (!ready() || last === undefined) {
        last = key
        return
      }
      if (key === last) return
      last = key
      untracked(() => binding().report({ type: "change", value, user: true, composing: false }))
    })
    void destroy
  }
}

/** One end of a range, the embedded field named by the end and the Label. */
@Directive()
abstract class RangeEndBase {
  /** @internal */
  protected end!: EmbeddedEnd
  /** @internal */
  protected wire(edge: "start" | "end") {
    const range = injectDateRange()
    if (!range) {
      throw new Error(
        "rindDateFieldStart / rindDateFieldEnd must be inside a range rindDateFieldRoot",
      )
    }
    // The group registers with the Field; an end only reads its label's id.
    const binding = injectFieldBindingPeek()
    const env = injectEnvironment()
    const api = () => range.api(binding?.() ?? null)
    const EDGE = edge === "start" ? "START" : "END"
    const editable = (which: "start" | "end") =>
      Array.from(
        range.inputEl.value?.querySelectorAll<HTMLElement>(
          `[data-edge="${which}"] input[data-editable]`,
        ) ?? [],
      )
    const end = () => range.end()
    this.end = {
      options: {
        value: () =>
          edge === "start" ? range.view().context.startValue : range.view().context.endValue,
        defaultValue: () => null,
        placeholderValue: () => end().placeholderValue,
        granularity: () => end().granularity,
        maxGranularity: () => end().maxGranularity,
        hourCycle: () => end().hourCycle,
        hideTimeZone: () => end().hideTimeZone,
        shouldForceLeadingZeros: () => end().shouldForceLeadingZeros,
        minValue: () => end().minValue,
        maxValue: () => end().maxValue,
        isDateUnavailable: () => end().isDateUnavailable,
        locale: () => end().locale,
        dir: () => end().dir,
        createCalendar: () => undefined,
        messages: () => end().messages,
        disabled: () => end().disabled,
        readOnly: () => end().readOnly,
        required: () => false,
        // The pair's validity and the Field's description reach the ends' segments.
        invalid: () => api().invalid,
        describedBy: () => api().endDescribedBy(edge).join(" ") || undefined,
        labelledBy: () =>
          [edge === "start" ? api().ids.startName : api().ids.endName, binding?.().ids.label]
            .filter((x): x is string => x !== undefined)
            .join(" "),
        segmentScope: () => range.inputEl.value,
        closeOnSelect: () => range.closeOnSelect(),
        firstDayOfWeek: () => range.firstDayOfWeek(),
        onValueChange: (v, details) =>
          range.send({ type: `${EDGE}.COMMIT`, value: v, reason: details.reason }),
        // Select all + Backspace in either end clears the pair (both ends).
        onClearAll: () => range.send({ type: "CLEAR" }),
        onValidityChange: (flags, message) =>
          range.send({ type: `${EDGE}.VALIDITY`, flags, message }),
        // Focus between ends (spec "Range Mode — Focus Between Ends").
        onBoundary: (b) => {
          const target =
            edge === "start" && b.direction === "next" && b.reason === "advance"
              ? editable("end")[0]
              : edge === "end" && b.direction === "previous" && b.reason === "backspace"
                ? editable("start").at(-1)
                : undefined
          if (target) void focusSafely(target, env, "programmatic", "keyboard")
        },
      },
    }
    bindProps(() => api().edge(edge))
  }
}

/** The range's start: `<div rindDateFieldStart>` (its own field inside). */
@Component({
  selector: "[rindDateFieldStart]",
  exportAs: "rindDateFieldStart",
  imports: [DateFieldEmbedded, forwardRef(() => DateFieldInput)],
  encapsulation: ViewEncapsulation.None,
  template: `<div [rindDateFieldEmbedded]="end"><div rindDateFieldInput></div></div>`,
})
export class DateFieldStart extends RangeEndBase {
  constructor() {
    super()
    this.wire("start")
  }
}

/** The range's end: `<div rindDateFieldEnd>` (its own field inside). */
@Component({
  selector: "[rindDateFieldEnd]",
  exportAs: "rindDateFieldEnd",
  imports: [DateFieldEmbedded, forwardRef(() => DateFieldInput)],
  encapsulation: ViewEncapsulation.None,
  template: `<div [rindDateFieldEmbedded]="end"><div rindDateFieldInput></div></div>`,
})
export class DateFieldEnd extends RangeEndBase {
  constructor() {
    super()
    this.wire("end")
  }
}

/** Between the ends: `<span rindDateFieldSeparator>`. */
@Directive({ selector: "[rindDateFieldSeparator]", exportAs: "rindDateFieldSeparator" })
export class DateFieldSeparator {
  constructor() {
    const range = injectDateRange()
    if (!range) throw new Error("rindDateFieldSeparator must be inside a range rindDateFieldRoot")
    bindProps(() => range.api(null).separator())
  }
}

void absentProps
void isDevMode
void DATE_RANGE
