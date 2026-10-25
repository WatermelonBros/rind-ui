/** @jsxImportSource solid-js */
// Date Field parts: wiring only. The machine owns the draft and the value; connect every
// attribute, the key mapping and the insertion plan; core/dom the segment layout. The Root
// is a Field when not inside one (the shared Field host), or a plain element when embedded
// in a host component; the hidden native input carries name, constraints and reset.
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
  dateClockCapability,
  dateFieldConnect,
  dateFieldKey,
  dateFieldMachine,
  dateFieldMessages,
  defaultPlaceholderValue,
  describeKey,
  type FieldMessages,
  type FieldValue,
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
  type Validate,
  type ValidationBehavior,
  type ValidationMode,
  valueKind,
} from "@rind-ui/core"
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  For,
  type JSX,
  onCleanup,
  Show,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { useFieldBindingPeek, useFieldControl } from "../field/context"
import { FieldHost, HostDescription, HostErrorMessage, HostLabel } from "../field/field-host"
import { useFieldsetDisabled } from "../fieldset/context"
import { afterMount } from "../lifecycle"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { ScopedPopoverRoot, usePopoverControls } from "../popover/popover"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, reactive, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import {
  type BaseInput,
  type Ctx,
  DateFieldContext,
  type DateFieldState,
  InControlContext,
  RangeTriggersContext,
  SingleContext,
  useApi,
  useDateField,
  useDateFieldOrNull,
  useDateRange,
} from "./context"
import {
  calendarTabStop,
  controlElement,
  type DatePickerCloseReason,
  type DatePickerProps,
  PickerCalendar,
  PickerClearTrigger,
  PickerContent,
  PickerControl,
  PickerTrigger,
  SinglePicker,
} from "./date-picker"
import {
  DateRangeFieldRoot,
  type DateRangeFieldRootProps,
  DateRangeInput,
} from "./date-range-field"

declare module "../provider" {
  interface RindMessageScopes {
    "date-field": DateFieldMessages
  }
}

declare const process: { env: { NODE_ENV?: string } }

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

export type { DateFieldState }

export type DateFieldRootProps = Omit<
  JSX.HTMLAttributes<HTMLDivElement>,
  "children" | "defaultValue" | "onChange" | "dir" | "id"
> & {
  /** Base for the ids of the field's parts. Default: generated. */
  readonly id?: string | undefined
  /** The parts: Label, Input, Description, ErrorMessage and, for a picker, its parts. */
  readonly children?: JSX.Element
  /** A date, a date-time, a zoned date-time, or a `Time` (a time field). */
  readonly value?: FieldValue | null | undefined
  /** Read at creation; a later change only changes what a form reset restores. */
  readonly defaultValue?: FieldValue | null | undefined
  readonly onValueChange?:
    | ((value: FieldValue | null, details: DateFieldChangeDetails) => void)
    | undefined
  /** The value stepping starts from, and the type and zone without a value. */
  readonly placeholderValue?: FieldValue | undefined
  readonly granularity?: DateGranularity | undefined
  /**
   * `"hour"`: no date segments (a time field). A date-time keeps its date; without a value
   * or placeholder the field holds a `Time`. Default: `"hour"` for a `Time` value, else `"year"`.
   */
  readonly maxGranularity?: "year" | "hour" | undefined
  readonly hourCycle?: 12 | 24 | undefined
  readonly hideTimeZone?: boolean | undefined
  readonly shouldForceLeadingZeros?: boolean | undefined
  /** A `Time` bound compares with a date-time value on the value's own day. */
  readonly minValue?: FieldValue | null | undefined
  readonly maxValue?: FieldValue | null | undefined
  readonly isDateUnavailable?: ((date: DateValue) => boolean) | undefined
  readonly locale?: string | undefined
  /** The Root's `dir` and which way Left/Right move between segments. Default: the locale's. */
  readonly dir?: "ltr" | "rtl" | undefined
  /** Calendar systems other than gregorian (`createCalendar` from @internationalized/date). */
  readonly createCalendar?: CreateCalendar | undefined
  readonly form?: string | undefined
  /** On the hidden input only (`bday`, …). */
  readonly autoComplete?: string | undefined
  readonly messages?: MessageOverrides<DateFieldMessages> | undefined
  /** Inside a host component: no Field, no hidden input, no Label (date-field "Embedded Mode"). */
  readonly embedded?: boolean | undefined
  /** Embedded: the ids that name the segments (after each segment's name). */
  readonly labelledBy?: readonly string[] | undefined
  /** Embedded: the ids that describe the first segment (every segment while invalid). */
  readonly describedBy?: readonly string[] | undefined
  /** Embedded: the field's own validity, after mount and whenever it changes. */
  readonly onValidityChange?: ((flags: DateValidityFlags, message: string) => void) | undefined
  /** Auto-advance, Backspace or an arrow found no segment to move to. */
  readonly onBoundary?: ((boundary: DateFieldBoundary) => void) | undefined
  /** The committed year, month and day (a host following the typed date). */
  readonly onDraftChange?: ((hint: DateFieldDraftHint) => void) | undefined
  /** Embedded: select all + Backspace cleared the field (a range clears both ends). */
  readonly onClearAll?: (() => void) | undefined
  /** Arrows move across every field's segments inside this element (paired fields). */
  readonly segmentScope?: Accessor<Element | null> | undefined
  // Field props (the Root is a Field when not inside one).
  readonly name?: string | undefined
  readonly disabled?: boolean | undefined
  readonly readOnly?: boolean | undefined
  readonly required?: boolean | undefined
  /** `true` forces invalid, `false` valid; `undefined` validates. */
  readonly invalid?: boolean | undefined
  /** External errors (server): shown at once, cleared by the next change. */
  readonly errors?: readonly string[] | undefined
  /** Runs after the field's own constraints pass. */
  readonly validate?: Validate | undefined
  /** When errors are displayed. Default: `"submit"`. */
  readonly validationMode?: ValidationMode | undefined
  /** Whether an invalid Field blocks submission. Default: `"native"`. */
  readonly validationBehavior?: ValidationBehavior | undefined
  /** Delays `validate` in `change` mode (ms). Default: 0. */
  readonly validationDebounce?: number | undefined
  /** The Field's messages when the Root is the Field. */
  readonly fieldMessages?: MessageOverrides<FieldMessages> | undefined
  /** `"range"` selects a start and an end (DateRangeFieldRootProps). */
  readonly selectionMode?: "single" | undefined
} & DatePickerProps

/** Single mode (default), or a range of two ends with `selectionMode="range"`. */
function Root(props: DateFieldRootProps | DateRangeFieldRootProps) {
  // Decided once, as a component's choice between its two forms.
  return untrack(() =>
    props.selectionMode === "range" ? (
      <DateRangeFieldRoot {...(props as DateRangeFieldRootProps)} />
    ) : (
      <SingleRoot {...(props as DateFieldRootProps)} />
    ),
  )
}

const SINGLE_KEYS = [
  "value",
  "defaultValue",
  "onValueChange",
  "placeholderValue",
  "granularity",
  "maxGranularity",
  "hourCycle",
  "hideTimeZone",
  "shouldForceLeadingZeros",
  "minValue",
  "maxValue",
  "isDateUnavailable",
  "locale",
  "dir",
  "createCalendar",
  "form",
  "autoComplete",
  "messages",
  "embedded",
  "labelledBy",
  "describedBy",
  "onValidityChange",
  "onBoundary",
  "onDraftChange",
  "onClearAll",
  "segmentScope",
  "fieldMessages",
  "children",
  "id",
  "selectionMode",
  "open",
  "defaultOpen",
  "onOpenChange",
  "closeOnSelect",
  "modal",
  "initialFocus",
  "finalFocus",
  "positioning",
  "persistentElements",
  "firstDayOfWeek",
] as const

/** The Field props an embedded Root does not take (the host is the field). */
const FIELD_ONLY_KEYS = [
  "name",
  "required",
  "invalid",
  "errors",
  "validate",
  "disabled",
  "readOnly",
  "validationMode",
  "validationBehavior",
  "validationDebounce",
] as const

export function SingleRoot(props: DateFieldRootProps) {
  const [o, fieldProps] = splitProps(props, SINGLE_KEYS)
  const env = useEnvironment(dateClockCapability)
  const instance = useRootId(() => o.id)
  const loc = useLocale(
    () => o.locale,
    () => o.dir,
  )
  const messages = useMessages("date-field", dateFieldMessages, () => o.messages)
  // One calendar object per system: a new one each render would recompute the segments.
  const resolved = createMemo(() => resolveCalendar(loc().locale, o.createCalendar), undefined, {
    equals: (a, b) =>
      a.calendar.identifier === b.calendar.identifier && a.formatLocale === b.formatLocale,
  })
  const peeked = useFieldBindingPeek()
  // Embedded: the host is the field; an enclosing Field is not this control's.
  const embedded = untrack(() => o.embedded === true)
  const enclosing = () => (embedded ? null : (peeked?.() ?? null))
  const fieldsetDisabled = useFieldsetDisabled()
  const disabled = () =>
    fieldProps.disabled === true || enclosing()?.state.disabled === true || fieldsetDisabled()
  const readOnly = () => fieldProps.readOnly === true || enclosing()?.state.readOnly === true
  const required = () => fieldProps.required === true || enclosing()?.state.required === true
  const current = () => (o.value === undefined ? o.defaultValue : o.value)
  const defaultValue = () => o.defaultValue ?? null
  // Today is read once: a placeholder that moved at midnight would rewrite a stepped segment.
  const placeholder: FieldValue = untrack(() => {
    const now = current() ?? null
    return (
      o.placeholderValue ??
      defaultPlaceholderValue({
        today: todayOf(env.dateClock, todayZone(undefined, now instanceof Time ? null : now)),
        granularity: o.granularity,
        maxGranularity: o.maxGranularity,
        timeZone: now && "timeZone" in now ? now.timeZone : undefined,
        minValue: o.minValue ?? null,
        maxValue: o.maxValue ?? null,
      })
    )
  })
  const [inputEl, setInputEl] = createSignal<Element | null>(null)
  const [hiddenEl, setHiddenEl] = createSignal<Element | null>(null)
  const selectAll = { current: false }
  let pendingFocus: DateSegmentType | null = null
  const formInput = hiddenFormInput(
    {
      input: () =>
        hiddenEl() instanceof HTMLInputElement ? (hiddenEl() as HTMLInputElement) : null,
      control: () => inputEl()?.querySelector<HTMLInputElement>("input[data-editable]") ?? null,
    },
    env,
  )
  // A consumer's details.cancel() of the last change (a refused pick keeps the popover open).
  const cancelled = { current: false }
  // Picker triggers rendered: Alt+ArrowDown opens only a picker.
  const [triggers, setTriggers] = createSignal(0)
  const machineEnv = {
    ...env,
    formInput: embedded ? undefined : formInput,
    navigation: {
      adjacent: (segment: DateSegmentType, direction: "next" | "previous") => {
        const root = inputEl()
        const from = root?.ownerDocument.getElementById(segmentId(instance(), segment))
        if (!root || !from) return null
        const scope = o.segmentScope?.() ?? null
        const el = adjacentSegment(from, direction, {
          root: root as HTMLElement,
          scope: scope as HTMLElement | null,
          dir: loc().dir,
        })
        if (!el) return null
        // Sound: every editable segment input carries its segment type as data-type (connect).
        if (root.contains(el)) return el.getAttribute("data-type") as DateSegmentType
        void focusSafely(el, env, "programmatic", "keyboard")
        return "external" as const
      },
    },
  }
  const machineProps = createMemo(
    () =>
      ({
        value: o.value,
        defaultValue: defaultValue(),
        onValueChange: (
          v: FieldValue | null,
          details: { event: { type: string }; cancel(): void },
        ) => {
          cancelled.current = false
          o.onValueChange?.(v, {
            reason: publicReason(details.event.type),
            modality: (details.event as { modality?: string }).modality,
            cancel: () => {
              cancelled.current = true
              details.cancel()
            },
          })
        },
        placeholderValue: placeholder,
        locale: resolved().formatLocale,
        calendar: resolved().calendar,
        granularity: o.granularity,
        maxGranularity: o.maxGranularity,
        hourCycle: o.hourCycle,
        hideTimeZone: o.hideTimeZone,
        shouldForceLeadingZeros: o.shouldForceLeadingZeros,
        disabled: disabled(),
        readOnly: readOnly(),
        onBoundary: (b: DateFieldBoundary) => o.onBoundary?.(b),
        onDraftChange: (h: DateFieldDraftHint) => o.onDraftChange?.(h),
        focusSegment: (t: DateSegmentType) => {
          pendingFocus = t
        },
        id: instance(),
      }) as never,
  )
  const { view, send } = useMachine(dateFieldMachine, machineProps, machineEnv)
  const focused = createMemo(() => view().context.active !== null)
  const modality = useModality(env.modality, focused)
  const [mounted, setMounted] = createSignal(false)
  afterMount(() => {
    setMounted(true)
    // A requested focus move, once the step that asked for it is rendered
    // (react-spectrum#10683).
    createEffect(() => {
      view()
      const t = pendingFocus
      if (t === null) return
      pendingFocus = null
      const el = untrack(inputEl)?.ownerDocument.getElementById(segmentId(untrack(instance), t))
      if (el && el.ownerDocument.activeElement !== el) {
        void focusSafely(el, env, "programmatic", env.modality.modality())
      }
    })
  })
  const base = createMemo((): BaseInput => {
    const v = view()
    const valueNow = v.values.value ?? null
    const format = formatFor(machineProps(), valueNow)
    const kindSource = valueNow ?? defaultValue() ?? placeholder
    return {
      instance: instance(),
      format,
      draft: v.context.draft,
      value: valueNow,
      defaultValue: defaultValue(),
      kind: valueKind(kindSource),
      granularity: format.options.granularity,
      active: v.context.active,
      modality: modality(),
      composing: v.matches("composing"),
      minValue: o.minValue ?? null,
      maxValue: o.maxValue ?? null,
      isDateUnavailable: o.isDateUnavailable,
      required: required(),
      messages: messages(),
      // Platform attributes after mount only (date-segments "Server Rendering").
      plainTextbox: mounted() && quirkActive("ios-vo-spinbutton-input", env),
      embedded,
      autoComplete: o.autoComplete,
      form: o.form,
      dir: loc().dir,
    } as BaseInput
  })
  const own = createMemo(() => ({
    disabled: disabled(),
    readOnly: readOnly(),
    required: required(),
    invalid: fieldProps.invalid,
    describedBy: embedded ? o.describedBy?.join(" ") : undefined,
    labelledBy: embedded ? o.labelledBy?.join(" ") : undefined,
  }))
  // The Root's own attributes and the validity need no Field binding.
  const rootApi = createMemo(() =>
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
  // The control's own validity: on the validity element, or to the embedding host.
  afterMount(() => {
    let reported: string | null = null
    let reportedEl: Element | null = null
    createEffect(() => {
      const validity = rootApi().validity
      const el = hiddenEl()
      const key = `${validity.reason}|${validity.message}`
      if (reported === key && reportedEl === el) return
      reported = key
      reportedEl = el
      if (embedded) untrack(() => o.onValidityChange?.(validity.flags, validity.message))
      else if (el instanceof HTMLInputElement) setControlValidity(el, validity.message)
    })
  })
  const state = createMemo(
    (): DateFieldState => ({
      value: view().values.value ?? null,
      segments: rootApi().segments(),
      focusedSegment: view().context.active,
      composing: view().matches("composing"),
      disabled: disabled(),
      readOnly: readOnly(),
    }),
  )
  const ctx: Ctx = {
    instance,
    view,
    send,
    base,
    own,
    embedded,
    onClearAll: () => o.onClearAll?.(),
    disabled,
    readOnly,
    dir: () => loc().dir,
    inputEl,
    setInputEl,
    hiddenEl,
    setHiddenEl,
    formInput,
    selectAll,
    state,
    picker: {
      closeOnSelect: () => o.closeOnSelect ?? true,
      firstDayOfWeek: () => o.firstDayOfWeek,
      placeholder,
      cancelled,
      triggers,
      setTriggers,
    },
  }
  const rootData = createMemo(() => normalizeProps(rootApi().root()))
  if (embedded) {
    const [, plain] = splitProps(fieldProps, FIELD_ONLY_KEYS)
    return (
      // An embedded Root forwards only plain element props (no Field props). Below a range's
      // end the picker parts and the Control are the range's.
      <div
        data-scope="date-field"
        data-part="root"
        data-instance={instance()}
        {...rootData()}
        {...plain}
      >
        <DateFieldContext.Provider value={ctx}>
          <SingleContext.Provider value={null}>
            <InControlContext.Provider value={false}>{o.children}</InControlContext.Provider>
          </SingleContext.Provider>
        </DateFieldContext.Provider>
      </div>
    )
  }
  return (
    <FieldHost
      {...fieldProps}
      scope="date-field"
      id={instance()}
      messages={o.fieldMessages}
      attrs={rootData}
    >
      <ScopedPopoverRoot
        id={instance()}
        scope="date-field"
        disabled={disabled()}
        open={o.open}
        defaultOpen={o.defaultOpen}
        onOpenChange={(next, details) => {
          // Read-only: the trigger stays focusable but never opens.
          if (next && readOnly()) return details.cancel()
          o.onOpenChange?.(next, {
            reason: next ? "trigger" : (details.reason as DatePickerCloseReason),
            cancel: details.cancel,
          })
        }}
        modal={o.modal}
        initialFocus={o.initialFocus === undefined ? calendarTabStop(instance()) : o.initialFocus}
        finalFocus={o.finalFocus}
        positioning={o.positioning}
        // The Control (field and triggers) is inside the picker for dismissal.
        persistentElements={() => {
          const control = controlElement(instance())
          return [...(control ? [control] : []), ...(o.persistentElements?.() ?? [])]
        }}
      >
        <DateFieldContext.Provider value={ctx}>
          <SinglePicker>{o.children}</SinglePicker>
          <HiddenInput />
        </DateFieldContext.Provider>
      </ScopedPopoverRoot>
    </FieldHost>
  )
}

/** The hidden native input: name, ISO value, constraints, validity, reset, autofill. */
function HiddenInput() {
  const ctx = useDateField("Root")
  const api = useApi(ctx)
  const mirror = () => ({
    value: formValueOf(ctx.view().values.value ?? null, ctx.base().granularity),
  })
  afterMount(() => {
    // The input shows the value (hydration, a parent's change); no events.
    createEffect(() => {
      ctx.hiddenEl()
      ctx.formInput.sync(mirror(), { dispatch: false })
    })
    onCleanup(
      ctx.formInput.track({
        onReset: () => ctx.send({ type: "RESET" }),
        current: () => untrack(mirror),
        onNativeInput: (input) => {
          ctx.send({ type: "INPUT.ADOPT", value: input.value })
          return true
        },
      }),
    )
  })
  const props = createMemo(() => normalizeProps(api().hiddenInput()))
  return <input {...props()} ref={ctx.setHiddenEl} />
}

type InputProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "children"> & {
  /** Segments in order; without children every segment renders automatically. */
  readonly children?: ((segments: readonly SegmentPart[]) => JSX.Element) | JSX.Element
  /** Another element: a function receiving the props and the field's state (not in range mode). */
  readonly render?: RenderProp<DateFieldState> | undefined
}

/** The group: one field's segments, or in range mode both ends with a separator. */
function Input(props: InputProps) {
  const single = useDateFieldOrNull()
  const range = useDateRange()
  if (!single && range) {
    // The range group renders no per-field state: a state render prop does not apply.
    const [local, rest] = splitProps(props, ["children", "render"])
    return (
      <DateRangeInput {...rest} renderEnd={(edge) => <RangeEnd edge={edge} />}>
        {typeof local.children === "function" ? undefined : local.children}
      </DateRangeInput>
    )
  }
  return <SingleInput {...props} />
}

/** One end of a range: an embedded field named by the end and the Label. */
function RangeEnd(
  props: Omit<JSX.HTMLAttributes<HTMLDivElement>, "children"> & {
    readonly edge: "start" | "end"
    readonly render?: RenderProp<undefined> | undefined
  },
) {
  const [local, rest] = splitProps(props, ["edge", "render"])
  const ctx = useDateRange()
  if (!ctx) throw new Error("DateField.Start / End must be inside a range DateField.Root")
  // The group registers with the Field; an end only reads its label's id.
  const binding = useFieldBindingPeek()
  const env = useEnvironment()
  const api = createMemo(() => ctx.api(binding?.() ?? null))
  const EDGE = local.edge === "start" ? "START" : "END"
  const value = () =>
    local.edge === "start" ? ctx.view().context.startValue : ctx.view().context.endValue
  const editable = (which: "start" | "end") =>
    Array.from(
      ctx.inputEl()?.querySelectorAll<HTMLElement>(`[data-edge="${which}"] input[data-editable]`) ??
        [],
    )
  const labelledBy = createMemo(
    () =>
      [
        local.edge === "start" ? api().ids.startName : api().ids.endName,
        binding?.().ids.label,
      ].filter((x): x is string => x !== undefined),
    undefined,
    { equals: (a, b) => a.length === b.length && a.every((x, i) => x === b[i]) },
  )
  const describedBy = createMemo(() => api().endDescribedBy(local.edge))
  const merged = createMemo(() => mergeProps(normalizeProps(api().edge(local.edge)), rest))
  const end = ctx.end
  const children = () => (
    <SingleRoot
      placeholderValue={end().placeholderValue}
      granularity={end().granularity}
      maxGranularity={end().maxGranularity}
      hourCycle={end().hourCycle}
      hideTimeZone={end().hideTimeZone}
      shouldForceLeadingZeros={end().shouldForceLeadingZeros}
      minValue={end().minValue}
      maxValue={end().maxValue}
      isDateUnavailable={end().isDateUnavailable}
      locale={end().locale}
      dir={end().dir}
      disabled={end().disabled}
      readOnly={end().readOnly}
      messages={end().messages}
      embedded
      value={value() as FieldValue | null}
      onValueChange={(v, details) =>
        ctx.send({ type: `${EDGE}.COMMIT`, value: v, reason: details.reason } as never)
      }
      // Select all + Backspace in either end clears the pair (both ends).
      onClearAll={() => ctx.send({ type: "CLEAR" })}
      onValidityChange={(flags, message) =>
        ctx.send({ type: `${EDGE}.VALIDITY`, flags, message } as never)
      }
      labelledBy={labelledBy()}
      // The pair's validity and the Field's description reach the ends' segments.
      invalid={api().invalid}
      describedBy={describedBy()}
      segmentScope={ctx.inputEl}
      // Focus between ends (spec "Range Mode — Focus Between Ends").
      onBoundary={(b) => {
        const edge = local.edge
        const target =
          edge === "start" && b.direction === "next" && b.reason === "advance"
            ? editable("end")[0]
            : edge === "end" && b.direction === "previous" && b.reason === "backspace"
              ? editable("start").at(-1)
              : undefined
        if (target) void focusSafely(target, env, "programmatic", "keyboard")
      }}
    >
      <SingleInput />
    </SingleRoot>
  )
  return renderPart(local.render, merged, undefined, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

function Start(props: Omit<JSX.HTMLAttributes<HTMLDivElement>, "children">) {
  return <RangeEnd edge="start" {...props} />
}
function End(props: Omit<JSX.HTMLAttributes<HTMLDivElement>, "children">) {
  return <RangeEnd edge="end" {...props} />
}
function Separator(props: JSX.HTMLAttributes<HTMLSpanElement>) {
  const ctx = useDateRange()
  if (!ctx) throw new Error("DateField.Separator must be inside a range DateField.Root")
  const [local, rest] = splitProps(props, ["children"])
  const sep = createMemo(() => ctx.api(null).separator())
  const merged = createMemo(() => mergeProps(normalizeProps(sep()), rest))
  return <span {...merged()}>{local.children ?? (sep()["children"] as JSX.Element)}</span>
}

const sameKeys = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((k, i) => k === b[i])

/** The group of segments, its hidden segment names and value description. */
function SingleInput(props: InputProps) {
  const [local, rest] = splitProps(props, ["children", "render"])
  const ctx = useDateField("Input")
  const env = useEnvironment()
  // An embedded field is not the Field's control (its host is): it claims nothing.
  const binding = useFieldControl({ skip: ctx.embedded })
  const api = useApi(ctx)
  const inControl = useContext(InControlContext)
  const firstId = createMemo(() => {
    const first = api()
      .segments()
      .find((s) => s.editable)
    return first ? segmentId(ctx.instance(), first.type as DateSegmentType) : undefined
  })
  if (binding && !ctx.embedded) {
    afterMount(() => {
      createEffect(() => {
        const id = firstId()
        if (!id) return
        onCleanup(
          untrack(() =>
            binding().register(
              {
                id,
                labelable: false,
                focus: (m) => {
                  const el = ctx.inputEl()?.ownerDocument.getElementById(id)
                  if (el) void focusSafely(el, env, "programmatic", m)
                },
                validityElement: () =>
                  ctx.hiddenEl() instanceof HTMLInputElement
                    ? (ctx.hiddenEl() as HTMLInputElement)
                    : null,
                value: () => untrack(() => ctx.view().values.value ?? null),
              },
              id,
            ),
          ),
        )
      })
      // Each commit that changed the value or the field's own validity is reported to the
      // Field once (date-field "Field Integration"): an impossible date leaves the value null
      // but must still be validated when the user leaves.
      let reported = {
        value: untrack(() => ctx.view().values.value ?? null),
        reason: untrack(() => api().validity.reason),
      }
      createEffect(() => {
        const value = ctx.view().values.value ?? null
        const reason = api().validity.reason
        if (reported.value === value && reported.reason === reason) return
        reported = { value, reason }
        untrack(() => binding().report({ type: "change", value, user: true, composing: false }))
      })
    })
  }
  const handlers = {
    // A press on the group outside a segment: the last filled segment before it (pointer only).
    onPointerDown: (e: PointerEvent) => {
      const root = ctx.inputEl()
      if (!root || ctx.disabled() || (e.target as Element).closest("input")) return
      const el = segmentAtPress(root as HTMLElement, e.clientX, ctx.dir())
      if (!el) return
      e.preventDefault()
      void focusSafely(el, env, "programmatic", "pointer")
    },
    // The press's mousedown would move focus to the body (the group is not focusable).
    onMouseDown: (e: MouseEvent) => {
      if (!(e.target as Element).closest("input")) e.preventDefault()
    },
  }
  // The segments are kept while their keys are: a typed digit changes a segment's text, not
  // its element (a rebuilt input would lose focus).
  const keys = createMemo(() => ctx.state().segments.map((s) => s.key), undefined, {
    equals: sameKeys,
  })
  const description = createMemo(() => api().valueDescription())
  const names = createMemo(() => api().segmentNames())
  const state = reactive(ctx.state)
  const content = (): JSX.Element => {
    const c = local.children
    if (typeof c === "function")
      return (c as (s: readonly SegmentPart[]) => JSX.Element)(ctx.state().segments)
    return (
      c ?? (
        <For each={keys()}>
          {(key) => {
            const segment = createMemo<SegmentPart>(
              // Sound: the key came from the current list; a removed key's last part is kept
              // until its element is disposed.
              (prev) => ctx.state().segments.find((s) => s.key === key) ?? (prev as SegmentPart),
            )
            return <Segment segment={segment()} />
          }}
        </For>
      )
    )
  }
  const merged = createMemo(() =>
    mergeProps(
      {
        ...joinHandlers(normalizeProps(api().input({ inControl })), handlers),
        ref: ctx.setInputEl,
      },
      rest,
    ),
  )
  const children = () => (
    <>
      {content()}
      <For each={names()}>
        {(n) => (
          <span {...normalizeProps(n.props)} aria-hidden="true">
            {n.text}
          </span>
        )}
      </For>
      <Show when={description()}>
        {(d) => (
          <span {...normalizeProps(d().props)} aria-hidden="true">
            {d().text}
          </span>
        )}
      </Show>
    </>
  )
  return renderPart(local.render, merged, state, children, (p) => <div {...p}>{children()}</div>)
}

/** A controlled input also writes its `value` attribute (as the framework's markup does). */
function withValueAttribute(props: Record<string | symbol, unknown>) {
  if (typeof props["value"] === "string") props["attr:value"] = props["value"]
  return props
}

type SegmentProps = Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "value" | "children"> & {
  /** The segment to render, one of those Input's children function receives. */
  readonly segment: SegmentPart
  /** Another element: a function receiving the props and the field's state. */
  readonly render?: RenderProp<DateFieldState> | undefined
}

/** One segment: an input for an editable segment or the zone, a hidden span for a literal. */
function Segment(props: SegmentProps) {
  const [local, rest] = splitProps(props, ["segment", "render"])
  const ctx = useDateField("Segment")
  const api = useApi(ctx)
  const state = reactive(ctx.state)
  // A key is one kind of segment for good: decided once.
  const type = untrack(() => local.segment.type)
  const own = createMemo(() => api().segment(local.segment))
  if (type === "literal") {
    return (
      <Literal
        segment={local.segment}
        own={own}
        rest={rest as Record<string, unknown>}
        render={local.render}
        state={state}
      />
    )
  }
  const [, setEl] = createSignal<Element | null>(null)
  if (type === "timeZoneName") {
    const merged = createMemo(() =>
      mergeProps({ ...withValueAttribute(normalizeProps(own())), ref: setEl }, rest),
    )
    return renderPart(
      local.render,
      merged,
      state,
      () => undefined,
      (p) => <input {...p} />,
    )
  }
  return (
    <EditableSegment
      segment={local.segment}
      own={own}
      api={api}
      rest={rest as Record<string, unknown>}
      render={local.render}
      state={state}
    />
  )
}

/**
 * A literal: the server's formatter may differ from the browser's in a literal only (a space
 * before AM/PM): hydrated as it came, then corrected to the browser's text.
 */
function Literal(props: {
  readonly segment: SegmentPart
  readonly own: Accessor<PartProps>
  readonly rest: Record<string, unknown>
  readonly render: RenderProp<DateFieldState> | undefined
  readonly state: DateFieldState
}) {
  const [el, setEl] = createSignal<Element | null>(null)
  afterMount(() => {
    createEffect(() => {
      const node = el()
      const text = props.segment.text
      const first = node?.firstChild
      // The text node Solid owns is updated in place: replacing it would orphan its updates.
      if (first instanceof Text && first.data !== text) first.data = text
    })
  })
  const merged = createMemo(() => {
    const { children: _c, ...span } = normalizeProps(props.own())
    void _c
    const { children: _r, ...spanRest } = props.rest
    void _r
    return mergeProps({ ...span, ref: setEl }, spanRest)
  })
  const children = () => props.segment.text
  return renderPart(props.render, merged, props.state, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

function EditableSegment(props: {
  readonly segment: SegmentPart
  readonly own: Accessor<PartProps>
  readonly api: Accessor<ReturnType<typeof useApi> extends Accessor<infer A> ? A : never>
  readonly rest: Record<string, unknown>
  readonly render: RenderProp<DateFieldState> | undefined
  readonly state: DateFieldState
}) {
  const ctx = useDateField("Segment")
  const env = useEnvironment()
  const popover = usePopoverControls()
  const rangeHost = useDateRange()
  // A range's triggers, provided above its embedded ends (Alt+ArrowDown).
  const rangeTriggers = useContext(RangeTriggersContext)
  const type = untrack(() => props.segment.type as DateSegmentType)
  const [el, setEl] = createSignal<Element | null>(null)
  // `beforeinput` is not the framework's onBeforeInput: insertions are planned before they apply.
  afterMount(() => {
    createEffect(() => {
      const input = el()
      if (!input) return
      const onBeforeInput = (e: Event) => {
        const ie = e as InputEvent
        if (untrack(ctx.view).matches("composing") || ie.isComposing) return
        const plan = planSegmentInput({ data: ie.data, inputType: ie.inputType }, type)
        if (plan.cancel) e.preventDefault()
        if (plan.event) ctx.send(plan.event)
      }
      input.addEventListener("beforeinput", onBeforeInput)
      onCleanup(() => input.removeEventListener("beforeinput", onBeforeInput))
    })
  })
  const handlers = {
    onFocusIn: (e: FocusEvent) => {
      ctx.selectAll.current = false
      ctx.send({ type: "SEGMENT.FOCUS", segment: type, modality: env.modality.modality() })
      // The whole text selected, as the native control highlights its sub-field.
      ;(e.currentTarget as HTMLInputElement).select()
    },
    onFocusOut: (e: FocusEvent) => {
      const next = e.relatedTarget as Node | null
      const inside = next !== null && ctx.inputEl()?.contains(next) === true
      ctx.send({ type: "SEGMENT.BLUR", related: inside ? "segment" : "outside" })
    },
    onKeyDown: (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      const event = dateFieldKey(describeKey(e, env), type, {
        dir: ctx.dir(),
        platform: env.platform,
        selectAll: ctx.selectAll.current,
      })
      if (event === "select-all") {
        ctx.selectAll.current = true
        return
      }
      if (event === "open-picker") {
        // Only a picker opens; otherwise the key is the browser's.
        // A range's ends are embedded: their host's triggers count.
        const count = ctx.embedded ? (rangeTriggers?.() ?? 0) : ctx.picker.triggers()
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
      ctx.send({ type: "COMPOSITION.END", segment: type, text: e.data }),
    onPaste: (e: ClipboardEvent) => {
      e.preventDefault()
      if (ctx.disabled() || ctx.readOnly()) return
      ctx.send({ type: "PASTE", text: e.clipboardData?.getData("text") ?? "" })
    },
    onCopy: (e: ClipboardEvent) => {
      e.preventDefault()
      e.clipboardData?.setData("text/plain", props.api().copyText(type))
    },
  }
  void rangeHost
  const merged = createMemo(() =>
    mergeProps(
      { ...joinHandlers(withValueAttribute(normalizeProps(props.own())), handlers), ref: setEl },
      props.rest,
    ),
  )
  return renderPart(
    props.render,
    merged,
    props.state,
    () => undefined,
    (p) => <input {...p} />,
  )
}

function warnEmbedded(part: string) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[rind-ui] date-field: an embedded field renders no ${part}; the host names it.`)
  }
}

/** Whether a Label-like part is inside an embedded field (it then renders nothing). */
function useHostPart(part: string): boolean {
  const single = useDateFieldOrNull()
  const range = useDateRange()
  if (!single && !range) throw new Error(`DateField.${part} must be inside DateField.Root`)
  const embedded = single?.embedded === true
  afterMount(() => {
    if (embedded) warnEmbedded(part)
  })
  return embedded
}

function Label(props: Parameters<typeof HostLabel>[0]) {
  // A range Root is the Field: its Label is the Field's (no single-field context there).
  return useHostPart("Label") ? null : <HostLabel {...props} />
}
function Description(props: Parameters<typeof HostDescription>[0]) {
  return useHostPart("Description") ? null : <HostDescription {...props} />
}
function ErrorMessage(props: Parameters<typeof HostErrorMessage>[0]) {
  return useHostPart("ErrorMessage") ? null : <HostErrorMessage {...props} />
}

/** The parts, by name: `date-field.parts.ts` re-exports them as the `DateField` namespace. */
export {
  Description,
  End,
  ErrorMessage,
  Input,
  Label,
  PickerCalendar as Calendar,
  PickerClearTrigger as ClearTrigger,
  PickerContent as Content,
  PickerControl as Control,
  PickerTrigger as Trigger,
  Root,
  Segment,
  Separator,
  Start,
}
