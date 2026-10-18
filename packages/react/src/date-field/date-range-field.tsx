// Date Field range mode (date-field spec "Range Mode"): wiring only. The coordinator machine
// derives the pair's value and validity; each end is an embedded Date Field; connect owns the
// group, the ends, the separator and the two hidden inputs.

import {
  type DateFieldMessages,
  type DateGranularity,
  type DateRangeEdge,
  type DateRangeFieldValue,
  type DateValue,
  dateFieldMessages,
  dateRangeConnect,
  dateRangeFieldMachine,
<<<<<<< HEAD
=======
  type FieldControlBinding,
>>>>>>> date-field-range
  type FieldMessages,
  focusSafely,
  hiddenFormInput,
  type MessageOverrides,
  mergeFieldProps,
  parseEndValue,
  rangeStateOf,
  resolveCalendar,
  setControlValidity,
  type Validate,
  type ValidationBehavior,
  type ValidationMode,
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { useFieldBindingPeek, useFieldControl } from "../field/field"
import { FieldHost } from "../field/use-field-host"
import { useFieldsetDisabled } from "../fieldset/fieldset"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useMachine } from "../use-machine"

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

export interface DateRangeFieldChangeDetails {
  readonly reason: string
  cancel(): void
}

/** The props both ends share (they are passed to each embedded field). */
export interface DateRangeEndProps {
  readonly placeholderValue?: DateValue
  readonly granularity?: DateGranularity
  readonly hourCycle?: 12 | 24
  readonly hideTimeZone?: boolean
  readonly shouldForceLeadingZeros?: boolean
  readonly minValue?: DateValue | null
  readonly maxValue?: DateValue | null
  readonly isDateUnavailable?: (date: DateValue) => boolean
  readonly locale?: string
  readonly dir?: "ltr" | "rtl"
}

export type DateRangeFieldRootProps = Omit<
  ComponentPropsWithRef<"div">,
  "children" | "defaultValue" | "onChange" | "dir"
> &
  DateRangeEndProps & {
    readonly children?: ReactNode
    readonly selectionMode: "range"
    readonly value?: DateRangeFieldValue
    readonly defaultValue?: DateRangeFieldValue
    readonly onValueChange?: (
      value: DateRangeFieldValue,
      details: DateRangeFieldChangeDetails,
    ) => void
    /** A range may contain unavailable dates (default false). */
    readonly allowsNonContiguousRanges?: boolean
    /** The hidden inputs' names. */
    readonly startName?: string
    readonly endName?: string
    readonly form?: string
    readonly messages?: MessageOverrides<DateFieldMessages>
    // Field props (the Root is a Field when not inside one).
    readonly name?: string
    readonly disabled?: boolean
    readonly readOnly?: boolean
    readonly required?: boolean
    readonly invalid?: boolean
    readonly errors?: readonly string[]
    readonly validate?: Validate
    readonly validationMode?: ValidationMode
    readonly validationBehavior?: ValidationBehavior
    readonly validationDebounce?: number
    readonly fieldMessages?: MessageOverrides<FieldMessages>
  }

type Machine = ReturnType<typeof useMachine<typeof dateRangeFieldMachine>>

interface RangeCtx {
  readonly instance: string
  readonly view: Machine["view"]
  readonly send: Machine["send"]
  readonly end: DateRangeEndProps & {
    readonly disabled: boolean
    readonly readOnly: boolean
    readonly messages?: MessageOverrides<DateFieldMessages>
  }
  readonly inputEl: { current: HTMLDivElement | null }
  readonly hidden: Record<DateRangeEdge, { current: HTMLInputElement | null }>
<<<<<<< HEAD
  readonly api: (labelledBy: string | undefined) => ReturnType<typeof dateRangeConnect>
=======
  /** The pair's api with the Field binding the part sees (the Root's own Field inside it). */
  readonly api: (binding: FieldControlBinding | null) => ReturnType<typeof dateRangeConnect>
>>>>>>> date-field-range
  readonly state: ReturnType<typeof rangeStateOf>
}

const RangeContext = createContext<RangeCtx | null>(null)
/** Inside a range Root (and not inside one of its embedded ends). */
export const useDateRange = () => useContext(RangeContext)

export function DateRangeFieldRoot({
  value,
  defaultValue,
  onValueChange,
  allowsNonContiguousRanges = false,
  startName,
  endName,
  form,
  messages: ownMessages,
  placeholderValue,
  granularity,
  hourCycle,
  hideTimeZone,
  shouldForceLeadingZeros,
  minValue,
  maxValue,
  isDateUnavailable,
  locale: ownLocale,
  dir: ownDir,
  fieldMessages,
  children,
  id,
  selectionMode: _mode,
  ...fieldProps
}: DateRangeFieldRootProps) {
  void _mode
  const env = useEnvironment()
  const generated = useId()
  const instance = id ?? generated
  const { locale, dir } = useLocale(ownLocale, ownDir)
  const messages = useMessages("date-field", dateFieldMessages, ownMessages)
  const { calendar, formatLocale } = resolveCalendar(locale)
  const enclosing = useFieldBindingPeek()
  const fieldsetDisabled = useFieldsetDisabled()
  const disabled =
    fieldProps.disabled === true || enclosing?.state.disabled === true || fieldsetDisabled
  const readOnly = fieldProps.readOnly === true || enclosing?.state.readOnly === true
  const required = fieldProps.required === true || enclosing?.state.required === true
  const latest = useRef(onValueChange)
  latest.current = onValueChange
  const machineProps = {
    value,
    defaultValue,
    onValueChange: (v: DateRangeFieldValue, details: { event: { type: string }; cancel(): void }) =>
      latest.current?.(v, { reason: details.event.type, cancel: details.cancel }),
    isDateUnavailable,
    allowsNonContiguousRanges,
    required,
    messages,
  }
  const { view, send } = useMachine(dateRangeFieldMachine, machineProps)
  const state = rangeStateOf(view.context, machineProps)
  const inputEl = useRef<HTMLDivElement | null>(null)
  const startHidden = useRef<HTMLInputElement | null>(null)
  const endHidden = useRef<HTMLInputElement | null>(null)
  const [focusWithin, setFocusWithin] = useState(false)
<<<<<<< HEAD
  const api = (labelledBy: string | undefined) =>
=======
  const api = (binding: FieldControlBinding | null) =>
>>>>>>> date-field-range
    dateRangeConnect({
      instance,
      state,
      start: (view.context.start.value as DateValue | null) ?? null,
      end: (view.context.end.value as DateValue | null) ?? null,
      granularity: granularity ?? "day",
      locale: formatLocale,
      calendar,
      messages,
      field: mergeFieldProps(
        { role: "group", labelable: false, disabled, readOnly, required },
<<<<<<< HEAD
        enclosing,
      ),
      labelledBy,
=======
        binding ?? enclosing,
      ),
      labelledBy: binding?.ids.label,
>>>>>>> date-field-range
      startName,
      endName,
      form,
      minValue,
      maxValue,
      focusWithin,
    })
<<<<<<< HEAD
  const own = api(undefined)
=======
  const own = api(null)
>>>>>>> date-field-range
  // The pair's own validity on the start hidden input (the registered validity element).
  useIsoLayoutEffect(() => {
    if (startHidden.current) setControlValidity(startHidden.current, state.message)
  })
  // Both hidden inputs: their values, a form reset, nothing adopted from autofill yet.
  const [forms] = useState(() => ({
    start: hiddenFormInput({ input: () => startHidden.current, control: () => null }, env),
    end: hiddenFormInput({ input: () => endHidden.current, control: () => null }, env),
  }))
  const iso = useRef(own.formValue)
  iso.current = own.formValue
  useIsoLayoutEffect(() => {
    forms.start.sync({ value: own.formValue("start") }, { dispatch: false })
    forms.end.sync({ value: own.formValue("end") }, { dispatch: false })
  })
  useEffect(() => {
    const stops = (["start", "end"] as const).map((edge) =>
      forms[edge].track({
        onReset: () => send({ type: "RESET" }),
        current: () => ({ value: iso.current(edge) }),
        // A browser autofill of a valid ISO string is adopted into that end.
        onNativeInput: (input) => {
          const v = parseEndValue(input.value, input.type)
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
    return () => {
      for (const stop of stops) stop()
    }
  }, [forms, send])
  const ctx: RangeCtx = {
    instance,
    view,
    send,
    end: {
      ...(placeholderValue ? { placeholderValue } : {}),
      ...(granularity ? { granularity } : {}),
      ...(hourCycle ? { hourCycle } : {}),
      ...(hideTimeZone !== undefined ? { hideTimeZone } : {}),
      ...(shouldForceLeadingZeros !== undefined ? { shouldForceLeadingZeros } : {}),
      ...(minValue !== undefined ? { minValue } : {}),
      ...(maxValue !== undefined ? { maxValue } : {}),
      ...(isDateUnavailable ? { isDateUnavailable } : {}),
      locale,
      dir,
      disabled,
      readOnly,
      ...(ownMessages ? { messages: ownMessages } : {}),
    },
    inputEl,
    hidden: { start: startHidden, end: endHidden },
    api,
    state,
  }
  return (
    <FieldHost
      scope="date-field"
      id={instance}
      {...fieldProps}
      {...(fieldMessages ? { messages: fieldMessages } : {})}
      {...normalizeProps(own.root())}
      onFocus={() => setFocusWithin(true)}
      onBlur={(e: { currentTarget: Element; relatedTarget: EventTarget | null }) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusWithin(false)
      }}
    >
      <RangeContext value={ctx}>
        {children}
        <input {...normalizeProps(own.hiddenInput("start"))} ref={startHidden} />
        <input {...normalizeProps(own.hiddenInput("end"))} ref={endHidden} />
      </RangeContext>
    </FieldHost>
  )
}

type InputProps = Omit<ComponentPropsWithRef<"div">, "children"> & {
  readonly children?: ReactNode
  readonly render?: RenderProp<undefined>
}

/** The one group of both ends; without children: Start, Separator, End. */
export function DateRangeInput({
  children,
  render,
  ref,
  renderEnd,
  ...rest
}: InputProps & { readonly renderEnd: (edge: DateRangeEdge) => ReactNode }) {
  const ctx = useContext(RangeContext)
  if (!ctx) throw new Error("DateField.Input must be inside DateField.Root")
  const env = useEnvironment()
  const binding = useFieldControl()
<<<<<<< HEAD
  const api = ctx.api(binding?.ids.label)
=======
  const api = ctx.api(binding)
>>>>>>> date-field-range
  const firstSegment = () =>
    ctx.inputEl.current?.querySelector<HTMLElement>('[data-edge="start"] input[data-editable]') ??
    null
  const register = binding?.register
  const firstId = `${api.ids.input}-first`
  useIsoLayoutEffect(() => {
    if (!register) return
    return register(
      {
        id: firstSegment()?.id ?? firstId,
        labelable: false,
        focus: (m) => {
          const el = firstSegment()
          if (el) void focusSafely(el, env, "programmatic", m)
        },
        validityElement: () => ctx.hidden.start.current,
        value: () => ctx.view.values.value ?? null,
      },
      firstSegment()?.id ?? firstId,
    )
  }, [register, env])
  // Each change of the pair's value or validity is reported to the Field once.
  const value = ctx.view.values.value ?? null
  const message = ctx.state.message
  const reported = useRef({ value, message })
  const report = binding?.report
  useEffect(() => {
    if (reported.current.value === value && reported.current.message === message) return
    reported.current = { value, message }
    report?.({ type: "change", value, user: true, composing: false })
  }, [value, message, report])
  const description = api.valueDescription()
  const content = children ?? (
    <>
      {renderEnd("start")}
      <span {...normalizeProps(api.separator())} />
      {renderEnd("end")}
    </>
  )
  const props = mergeProps(
    {
      ...normalizeProps(api.input()),
      ref: composeRefs(ctx.inputEl, ref),
      children: (
        <>
          {content}
          <span {...normalizeProps(api.edgeName("start"))} />
          <span {...normalizeProps(api.edgeName("end"))} />
          {description ? <span {...normalizeProps(description)} /> : null}
        </>
      ),
    },
    rest,
  )
  return renderPart("div", props, render, undefined)
}
