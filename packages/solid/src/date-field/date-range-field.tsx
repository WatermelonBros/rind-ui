/** @jsxImportSource solid-js */
// Date Field range mode (date-field spec "Range Mode"): wiring only. The coordinator machine
// derives the pair's value and validity; each end is an embedded Date Field; connect owns the
// group, the ends, the separator and the two hidden inputs.
import {
  type DateFieldMessages,
  type DateRangeEdge,
  type DateRangeFieldValue,
  dateFieldMessages,
  dateRangeConnect,
  dateRangeFieldMachine,
  type FieldControlBinding,
  type FieldMessages,
  focusSafely,
  hiddenFormInput,
  type MessageOverrides,
  mergeFieldProps,
  parseEndValue,
  rangeStateOf,
  resolveCalendar,
  setControlValidity,
  Time,
  type Validate,
  type ValidationBehavior,
  type ValidationMode,
} from "@rind-ui/core"
import {
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { useFieldBindingPeek, useFieldControl } from "../field/context"
import { FieldHost } from "../field/field-host"
import { useFieldsetDisabled } from "../fieldset/context"
import { afterMount } from "../lifecycle"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { ScopedPopoverRoot } from "../popover/popover"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import {
  DateFieldContext,
  type DateRangeEndProps,
  RangeContext,
  type RangeCtx,
  RangeTriggersContext,
  SingleContext,
} from "./context"
import {
  calendarTabStop,
  controlElement,
  type DatePickerCloseReason,
  type DatePickerProps,
} from "./date-picker"

export interface DateRangeFieldChangeDetails {
  readonly reason: string
  cancel(): void
}

export type DateRangeFieldRootProps = Omit<
  JSX.HTMLAttributes<HTMLDivElement>,
  "children" | "defaultValue" | "onChange" | "dir" | "id"
> &
  DateRangeEndProps & {
    /** Base for the ids of the field's parts. Default: generated. */
    readonly id?: string | undefined
    readonly children?: JSX.Element
    readonly selectionMode: "range"
    readonly value?: DateRangeFieldValue | undefined
    readonly defaultValue?: DateRangeFieldValue | undefined
    readonly onValueChange?:
      | ((value: DateRangeFieldValue, details: DateRangeFieldChangeDetails) => void)
      | undefined
    /** A range may contain unavailable dates (default false). */
    readonly allowsNonContiguousRanges?: boolean | undefined
    /** `Time` ends: an end before the start is the next day (default false). */
    readonly allowsOvernight?: boolean | undefined
    /** The hidden inputs' names. */
    readonly startName?: string | undefined
    /** The end date's hidden input name. */
    readonly endName?: string | undefined
    readonly form?: string | undefined
    readonly messages?: MessageOverrides<DateFieldMessages> | undefined
    // Field props (the Root is a Field when not inside one).
    readonly name?: string | undefined
    readonly disabled?: boolean | undefined
    readonly readOnly?: boolean | undefined
    readonly required?: boolean | undefined
    readonly invalid?: boolean | undefined
    readonly errors?: readonly string[] | undefined
    readonly validate?: Validate | undefined
    readonly validationMode?: ValidationMode | undefined
    readonly validationBehavior?: ValidationBehavior | undefined
    readonly validationDebounce?: number | undefined
    readonly fieldMessages?: MessageOverrides<FieldMessages> | undefined
  } & DatePickerProps

const RANGE_KEYS = [
  "value",
  "defaultValue",
  "onValueChange",
  "allowsNonContiguousRanges",
  "allowsOvernight",
  "startName",
  "endName",
  "form",
  "messages",
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

export function DateRangeFieldRoot(props: DateRangeFieldRootProps) {
  const [o, fieldProps] = splitProps(props, RANGE_KEYS)
  const env = useEnvironment()
  const instance = useRootId(() => o.id)
  const loc = useLocale(
    () => o.locale,
    () => o.dir,
  )
  const allMessages = useMessages("date-field", dateFieldMessages, () => o.messages)
  // Time ends: a time field per end, named "Start time" / "End time" (spec "Range Mode").
  const sample = () => o.value?.start ?? o.defaultValue?.start ?? o.placeholderValue ?? null
  const timeEnds = () => o.maxGranularity === "hour" || sample() instanceof Time
  const messages = createMemo(() =>
    timeEnds()
      ? {
          ...allMessages(),
          startDate: allMessages().startTime,
          endDate: allMessages().endTime,
        }
      : allMessages(),
  )
  const enclosing = useFieldBindingPeek()
  const fieldsetDisabled = useFieldsetDisabled()
  const disabled = () =>
    fieldProps.disabled === true || enclosing?.().state.disabled === true || fieldsetDisabled()
  const readOnly = () => fieldProps.readOnly === true || enclosing?.().state.readOnly === true
  const required = () => fieldProps.required === true || enclosing?.().state.required === true
  // A consumer's details.cancel() of the last change (a refused pick keeps the popover open).
  const cancelled = { current: false }
  const [triggers, setTriggers] = createSignal(0)
  const machineProps = createMemo(
    () =>
      ({
        value: o.value,
        defaultValue: o.defaultValue,
        onValueChange: (
          v: DateRangeFieldValue,
          details: { event: { type: string }; cancel(): void },
        ) => {
          cancelled.current = false
          o.onValueChange?.(v, {
            reason: details.event.type,
            cancel: () => {
              cancelled.current = true
              details.cancel()
            },
          })
        },
        isDateUnavailable: o.isDateUnavailable,
        allowsNonContiguousRanges: o.allowsNonContiguousRanges ?? false,
        allowsOvernight: o.allowsOvernight ?? false,
        required: required(),
        messages: messages(),
      }) as never,
  )
  const { view, send } = useMachine(dateRangeFieldMachine, machineProps)
  const state = createMemo(() => rangeStateOf(view().context, machineProps()))
  const [inputEl, setInputEl] = createSignal<Element | null>(null)
  const [startHidden, setStartHidden] = createSignal<Element | null>(null)
  const [endHidden, setEndHidden] = createSignal<Element | null>(null)
  const [focusWithin, setFocusWithin] = createSignal(false)
  const api = (binding: FieldControlBinding | null) => {
    const { calendar, formatLocale } = resolveCalendar(loc().locale)
    const s = sample()
    return dateRangeConnect({
      instance: instance(),
      state: state(),
      start: view().context.start.value,
      end: view().context.end.value,
      // The ends' own default: minutes for a time or a date-time, else days.
      granularity: o.granularity ?? (timeEnds() || (s !== null && "hour" in s) ? "minute" : "day"),
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
      startName: o.startName,
      endName: o.endName,
      form: o.form,
      minValue: o.minValue,
      maxValue: o.maxValue,
      focusWithin: focusWithin(),
    } as Parameters<typeof dateRangeConnect>[0])
  }
  const own = createMemo(() => api(null))
  // Both hidden inputs: their values, a form reset, nothing adopted from autofill yet.
  const asInput = (el: Element | null) => (el instanceof HTMLInputElement ? el : null)
  const forms = {
    start: hiddenFormInput({ input: () => asInput(startHidden()), control: () => null }, env),
    end: hiddenFormInput({ input: () => asInput(endHidden()), control: () => null }, env),
  }
  afterMount(() => {
    createEffect(() => {
      // The pair's own validity on the start hidden input (the registered validity element).
      const start = asInput(startHidden())
      if (start) setControlValidity(start, state().message)
      endHidden()
      forms.start.sync({ value: own().formValue("start") }, { dispatch: false })
      forms.end.sync({ value: own().formValue("end") }, { dispatch: false })
    })
    for (const edge of ["start", "end"] as const) {
      onCleanup(
        forms[edge].track({
          onReset: () => send({ type: "RESET" }),
          current: () => ({ value: untrack(own).formValue(edge) }),
          // A browser autofill of a valid ISO string is adopted into that end.
          onNativeInput: (input) => {
            const v = parseEndValue(input.value, input.type)
            if (v === null) return false
            send({
              type: edge === "start" ? "START.COMMIT" : "END.COMMIT",
              value: v,
              reason: "ADOPT",
            } as never)
            return true
          },
        }),
      )
    }
  })
  const ctx: RangeCtx = {
    instance,
    view,
    send,
    end: () => ({
      placeholderValue: o.placeholderValue,
      granularity: o.granularity,
      maxGranularity: o.maxGranularity,
      hourCycle: o.hourCycle,
      hideTimeZone: o.hideTimeZone,
      shouldForceLeadingZeros: o.shouldForceLeadingZeros,
      minValue: o.minValue,
      maxValue: o.maxValue,
      isDateUnavailable: o.isDateUnavailable,
      locale: loc().locale,
      dir: loc().dir,
      disabled: disabled(),
      readOnly: readOnly(),
      messages: o.messages,
    }),
    inputEl,
    setInputEl,
    hidden: { start: startHidden, end: endHidden },
    api,
    state,
    triggers,
    setTriggers,
    cancelled,
    closeOnSelect: () => o.closeOnSelect ?? true,
    allowsNonContiguousRanges: () => o.allowsNonContiguousRanges ?? false,
    firstDayOfWeek: () => o.firstDayOfWeek,
    granularity: () => o.granularity,
    placeholderValue: () => o.placeholderValue,
  }
  const attrs = createMemo(() => ({
    ...normalizeProps(own().root()),
    onFocusIn: () => setFocusWithin(true),
    onFocusOut: (e: FocusEvent) => {
      if (!(e.currentTarget as Element).contains(e.relatedTarget as Node | null))
        setFocusWithin(false)
    },
  }))
  const hiddenStart = createMemo(() => normalizeProps(own().hiddenInput("start")))
  const hiddenEnd = createMemo(() => normalizeProps(own().hiddenInput("end")))
  return (
    <FieldHost
      {...fieldProps}
      scope="date-field"
      id={instance()}
      messages={o.fieldMessages}
      attrs={attrs}
    >
      <ScopedPopoverRoot
        id={instance()}
        scope="date-field"
        disabled={disabled()}
        open={o.open}
        defaultOpen={o.defaultOpen}
        onOpenChange={(next, details) => {
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
        persistentElements={() => {
          const control = controlElement(instance())
          return [...(control ? [control] : []), ...(o.persistentElements?.() ?? [])]
        }}
      >
        <RangeContext.Provider value={ctx}>
          <RangeTriggersContext.Provider value={triggers}>
            {/* Below the range: no single field (the ends provide their own). */}
            <DateFieldContext.Provider value={null}>
              <SingleContext.Provider value={null}>
                {o.children}
                <input {...hiddenStart()} ref={setStartHidden} />
                <input {...hiddenEnd()} ref={setEndHidden} />
              </SingleContext.Provider>
            </DateFieldContext.Provider>
          </RangeTriggersContext.Provider>
        </RangeContext.Provider>
      </ScopedPopoverRoot>
    </FieldHost>
  )
}

type InputProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "children"> & {
  readonly children?: JSX.Element
  readonly render?: RenderProp<undefined> | undefined
}

/** The one group of both ends; without children: Start, Separator, End. */
export function DateRangeInput(
  props: InputProps & { readonly renderEnd: (edge: DateRangeEdge) => JSX.Element },
) {
  const [local, rest] = splitProps(props, ["children", "render", "renderEnd"])
  const ctx = useContext(RangeContext)
  if (!ctx) throw new Error("DateField.Input must be inside DateField.Root")
  const env = useEnvironment()
  const binding = useFieldControl()
  const api = createMemo(() => ctx.api(binding?.() ?? null))
  const firstSegment = () =>
    ctx.inputEl()?.querySelector<HTMLElement>('[data-edge="start"] input[data-editable]') ?? null
  if (binding) {
    afterMount(() => {
      const first = untrack(() => api().ids.input)
      const id = firstSegment()?.id ?? `${first}-first`
      onCleanup(
        untrack(() =>
          binding().register(
            {
              id,
              labelable: false,
              focus: (m) => {
                const el = firstSegment()
                if (el) void focusSafely(el, env, "programmatic", m)
              },
              validityElement: () => asInput(ctx.hidden.start()),
              value: () => untrack(() => ctx.view().values.value ?? null),
            },
            id,
          ),
        ),
      )
      // Each change of the pair's value or validity is reported to the Field once.
      let reported = {
        value: untrack(() => ctx.view().values.value ?? null),
        message: untrack(() => ctx.state().message),
      }
      createEffect(() => {
        const value = ctx.view().values.value ?? null
        const message = ctx.state().message
        if (reported.value === value && reported.message === message) return
        reported = { value, message }
        untrack(() => binding().report({ type: "change", value, user: true, composing: false }))
      })
    })
  }
  const merged = createMemo(() =>
    mergeProps({ ...normalizeProps(api().input()), ref: ctx.setInputEl }, rest),
  )
  const edgeName = (edge: "start" | "end") => normalizeProps(api().edgeName(edge))
  const description = createMemo(() => api().valueDescription())
  const separator = createMemo(() => api().separator())
  const children = (): JSX.Element => (
    <>
      {local.children ?? (
        <>
          {local.renderEnd("start")}
          <span {...normalizeProps(separator())}>{separator()["children"] as JSX.Element}</span>
          {local.renderEnd("end")}
        </>
      )}
      <span {...edgeName("start")}>{api().edgeName("start")["children"] as JSX.Element}</span>
      <span {...edgeName("end")}>{api().edgeName("end")["children"] as JSX.Element}</span>
      {description() ? (
        <span {...normalizeProps(description() as never)}>
          {(description() as Record<string, unknown>)["children"] as JSX.Element}
        </span>
      ) : null}
    </>
  )
  return renderPart(local.render, merged, undefined, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

const asInput = (el: Element | null) => (el instanceof HTMLInputElement ? el : null)
