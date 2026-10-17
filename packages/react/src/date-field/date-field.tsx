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
  dateFieldConnect,
  dateFieldKey,
  dateFieldMachine,
  dateFieldMessages,
  defaultPlaceholderValue,
  describeKey,
  type FieldMessages,
  focusSafely,
  formatFor,
  hiddenFormInput,
  type MessageOverrides,
  mergeFieldProps,
  planSegmentInput,
  quirkActive,
  resolveCalendar,
  type SegmentPart,
  segmentAtPress,
  segmentId,
  setControlValidity,
  today as todayOf,
  todayZone,
  type Validate,
  type ValidationBehavior,
  type ValidationMode,
  valueKind,
} from "@rind-ui/core"
import {
  type ClipboardEvent,
  type ComponentPropsWithRef,
  createContext,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { useFieldBindingPeek, useFieldControl } from "../field/field"
import { FieldHost, HostDescription, HostErrorMessage, HostLabel } from "../field/use-field-host"
import { useFieldsetDisabled } from "../fieldset/fieldset"
import { joinHandlers } from "../join-handlers"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare module "../provider" {
  interface RindMessageScopes {
    "date-field": DateFieldMessages
  }
}

declare const process: { env: { NODE_ENV?: string } }

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

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
      return "CLEAR"
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

export interface DateFieldState {
  readonly value: DateValue | null
  readonly segments: readonly SegmentPart[]
  readonly focusedSegment: DateSegmentType | null
  readonly composing: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
}

type Machine = ReturnType<typeof useMachine<typeof dateFieldMachine>>
type Api = ReturnType<typeof dateFieldConnect>
type ConnectInput = Parameters<typeof dateFieldConnect>[0]
type BaseInput = Omit<ConnectInput, "field" | "fieldData" | "labelledBy">

interface Ctx {
  readonly instance: string
  readonly view: Machine["view"]
  readonly send: Machine["send"]
  /** Everything connect needs except the Field binding (read by each part under the host). */
  readonly base: BaseInput
  readonly own: {
    readonly disabled: boolean
    readonly readOnly: boolean
    readonly required: boolean
    readonly invalid: boolean | undefined
    readonly describedBy: string | undefined
    readonly labelledBy: string | undefined
  }
  readonly embedded: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
  readonly dir: "ltr" | "rtl"
  readonly inputEl: { current: HTMLDivElement | null }
  readonly hiddenEl: { current: HTMLInputElement | null }
  readonly formInput: ReturnType<typeof hiddenFormInput>
  readonly selectAll: { current: boolean }
  readonly state: DateFieldState
}

/** The api of a part, with the Field binding merged (none when embedded). */
function useApi(ctx: Ctx): Api {
  const peeked = useFieldBindingPeek()
  const binding = ctx.embedded ? null : peeked
  const { own } = ctx
  const field = mergeFieldProps(
    {
      role: "group",
      labelable: false,
      disabled: own.disabled,
      readOnly: own.readOnly,
      required: own.required,
      ...(own.invalid === undefined ? {} : { invalid: own.invalid }),
      ...(own.describedBy ? { describedBy: own.describedBy } : {}),
    },
    binding,
  )
  return dateFieldConnect({
    ...ctx.base,
    field,
    fieldData: binding?.data,
    labelledBy: ctx.embedded ? own.labelledBy : binding?.ids.label,
  })
}

const DateFieldContext = createContext<Ctx | null>(null)
function useDateField(part: string): Ctx {
  const ctx = useContext(DateFieldContext)
  if (!ctx) throw new Error(`DateField.${part} must be inside DateField.Root`)
  return ctx
}

export type DateFieldRootProps = Omit<
  ComponentPropsWithRef<"div">,
  "children" | "defaultValue" | "onChange" | "dir"
> & {
  readonly children?: ReactNode
  readonly value?: DateValue | null
  /** Read at creation; a later change only changes what a form reset restores. */
  readonly defaultValue?: DateValue | null
  readonly onValueChange?: (value: DateValue | null, details: DateFieldChangeDetails) => void
  /** The value stepping starts from, and the type and zone without a value. */
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
  /** Calendar systems other than gregorian (`createCalendar` from @internationalized/date). */
  readonly createCalendar?: CreateCalendar
  readonly form?: string
  /** On the hidden input only (`bday`, …). */
  readonly autoComplete?: string
  readonly messages?: MessageOverrides<DateFieldMessages>
  /** Inside a host component: no Field, no hidden input, no Label (date-field "Embedded Mode"). */
  readonly embedded?: boolean
  /** Embedded: the ids that name the segments (after each segment's name). */
  readonly labelledBy?: readonly string[]
  /** Embedded: the ids that describe the first segment (every segment while invalid). */
  readonly describedBy?: readonly string[]
  /** Embedded: the field's own validity, after mount and whenever it changes. */
  readonly onValidityChange?: (flags: DateValidityFlags, message: string) => void
  /** Auto-advance, Backspace or an arrow found no segment to move to. */
  readonly onBoundary?: (boundary: DateFieldBoundary) => void
  /** The committed year, month and day (a host following the typed date). */
  readonly onDraftChange?: (hint: DateFieldDraftHint) => void
  /** Arrows move across every field's segments inside this element (paired fields). */
  readonly segmentScope?: { readonly current: HTMLElement | null }
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

function Root({
  value,
  defaultValue = null,
  onValueChange,
  placeholderValue,
  granularity,
  hourCycle,
  hideTimeZone,
  shouldForceLeadingZeros,
  minValue = null,
  maxValue = null,
  isDateUnavailable,
  locale: ownLocale,
  dir: ownDir,
  createCalendar,
  form,
  autoComplete,
  messages: ownMessages,
  embedded = false,
  labelledBy,
  describedBy,
  onValidityChange,
  onBoundary,
  onDraftChange,
  segmentScope,
  fieldMessages: ownFieldMessages,
  children,
  id,
  ...fieldProps
}: DateFieldRootProps) {
  const env = useEnvironment()
  const generated = useId()
  const instance = id ?? generated
  const { locale, dir } = useLocale(ownLocale, ownDir)
  const messages = useMessages("date-field", dateFieldMessages, ownMessages)
  const resolved = resolveCalendar(locale, createCalendar)
  // One calendar object per system: a new one each render would recompute the segments.
  const calendarRef = useRef(resolved.calendar)
  if (calendarRef.current.identifier !== resolved.calendar.identifier) {
    calendarRef.current = resolved.calendar
  }
  const calendar = calendarRef.current
  const formatLocale = resolved.formatLocale
  const peeked = useFieldBindingPeek()
  // Embedded: the host is the field; an enclosing Field is not this control's.
  const enclosing = embedded ? null : peeked
  const fieldsetDisabled = useFieldsetDisabled()
  const disabled =
    fieldProps.disabled === true || enclosing?.state.disabled === true || fieldsetDisabled
  const readOnly = fieldProps.readOnly === true || enclosing?.state.readOnly === true
  const required = fieldProps.required === true || enclosing?.state.required === true
  const current = value === undefined ? defaultValue : value
  // Today is read once: a placeholder that moved at midnight would rewrite a stepped segment.
  const [placeholder] = useState(
    () =>
      placeholderValue ??
      defaultPlaceholderValue({
        today: todayOf(env.dateClock, todayZone(undefined, current)),
        granularity,
        timeZone: current && "timeZone" in current ? current.timeZone : undefined,
        minValue,
        maxValue,
      }),
  )
  const inputEl = useRef<HTMLDivElement | null>(null)
  const hiddenEl = useRef<HTMLInputElement | null>(null)
  const selectAll = useRef(false)
  const pendingFocus = useRef<DateSegmentType | null>(null)
  const [formInput] = useState(() =>
    hiddenFormInput(
      {
        input: () => hiddenEl.current,
        control: () =>
          inputEl.current?.querySelector<HTMLInputElement>("input[data-editable]") ?? null,
      },
      env,
    ),
  )
  const latest = useRef({ onValueChange, onBoundary, onDraftChange, segmentScope, dir })
  latest.current = { onValueChange, onBoundary, onDraftChange, segmentScope, dir }
  const [machineEnv] = useState(() => ({
    formInput: embedded ? undefined : formInput,
    navigation: {
      adjacent: (segment: DateSegmentType, direction: "next" | "previous") => {
        const root = inputEl.current
        const from = root?.ownerDocument.getElementById(segmentId(instance, segment))
        if (!root || !from) return null
        const scope = latest.current.segmentScope?.current ?? null
        const el = adjacentSegment(from, direction, { root, scope, dir: latest.current.dir })
        if (!el) return null
        // Sound: every editable segment input carries its segment type as data-type (connect).
        if (root.contains(el)) return el.getAttribute("data-type") as DateSegmentType
        void focusSafely(el, env, "programmatic", "keyboard")
        return "external" as const
      },
    },
  }))
  const machineProps = {
    value,
    defaultValue,
    onValueChange: (v: DateValue | null, details: { event: { type: string }; cancel(): void }) =>
      latest.current.onValueChange?.(v, {
        reason: publicReason(details.event.type),
        modality: (details.event as { modality?: string }).modality,
        cancel: details.cancel,
      }),
    placeholderValue: placeholder,
    locale: formatLocale,
    calendar,
    granularity,
    hourCycle,
    hideTimeZone,
    shouldForceLeadingZeros,
    disabled,
    readOnly,
    onBoundary: (b: DateFieldBoundary) => latest.current.onBoundary?.(b),
    onDraftChange: (h: DateFieldDraftHint) => latest.current.onDraftChange?.(h),
    focusSegment: (t: DateSegmentType) => {
      pendingFocus.current = t
    },
    id: instance,
  }
  const { view, send } = useMachine(dateFieldMachine, machineProps, machineEnv)
  // A requested focus move, once the step that asked for it is rendered (react-spectrum#10683).
  useIsoLayoutEffect(() => {
    const t = pendingFocus.current
    if (t === null) return
    pendingFocus.current = null
    const el = inputEl.current?.ownerDocument.getElementById(segmentId(instance, t))
    if (el && el.ownerDocument.activeElement !== el) {
      void focusSafely(el, env, "programmatic", env.modality.modality())
    }
  })
  const valueNow = view.values.value ?? null
  const format = formatFor(machineProps, valueNow)
  const kindSource = valueNow ?? defaultValue ?? placeholder
  const focused = view.context.active !== null
  const modality = useModality(env.modality, focused)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const base: BaseInput = {
    instance,
    format,
    draft: view.context.draft,
    value: valueNow,
    defaultValue,
    kind: valueKind(kindSource),
    granularity: format.options.granularity,
    active: view.context.active,
    modality,
    composing: view.matches("composing"),
    minValue,
    maxValue,
    isDateUnavailable,
    required,
    messages,
    // Platform attributes after mount only (date-segments "Server Rendering").
    plainTextbox: mounted && quirkActive("ios-vo-spinbutton-input", env),
    embedded,
    autoComplete,
    form,
    dir,
  }
  const own = {
    disabled,
    readOnly,
    required,
    invalid: fieldProps.invalid,
    describedBy: embedded ? describedBy?.join(" ") : undefined,
    labelledBy: embedded ? labelledBy?.join(" ") : undefined,
  }
  // The Root's own attributes and the validity need no Field binding.
  const api = dateFieldConnect({
    ...base,
    field: mergeFieldProps({ role: "group", labelable: false, disabled, readOnly, required }, null),
    labelledBy: own.labelledBy,
  })
  const validity = api.validity
  const reported = useRef<string | null>(null)
  // The control's own validity: on the validity element, or to the embedding host.
  useIsoLayoutEffect(() => {
    const key = `${validity.reason}|${validity.message}`
    if (reported.current === key) return
    reported.current = key
    if (embedded) onValidityChange?.(validity.flags, validity.message)
    else if (hiddenEl.current) setControlValidity(hiddenEl.current, validity.message)
  })
  const state: DateFieldState = {
    value: valueNow,
    segments: api.segments(),
    focusedSegment: view.context.active,
    composing: view.matches("composing"),
    disabled,
    readOnly,
  }
  const ctx: Ctx = {
    instance,
    view,
    send,
    base,
    own,
    embedded,
    disabled,
    readOnly,
    dir,
    inputEl,
    hiddenEl,
    formInput,
    selectAll,
    state,
  }
  const rootData = normalizeProps(api.root())
  if (embedded) {
    const {
      name: _n,
      required: _r,
      invalid: _i,
      errors: _e,
      validate: _v,
      ...plain
    } = fieldProps as typeof fieldProps & Record<string, unknown>
    void [_n, _r, _i, _e, _v]
    return (
      <div
        data-scope="date-field"
        data-part="root"
        data-instance={instance}
        {...rootData}
        {...plainDivProps(plain)}
      >
        <DateFieldContext value={ctx}>{children}</DateFieldContext>
      </div>
    )
  }
  return (
    <FieldHost
      scope="date-field"
      id={instance}
      {...fieldProps}
      {...(ownFieldMessages ? { messages: ownFieldMessages } : {})}
      {...rootData}
    >
      <DateFieldContext value={ctx}>
        {children}
        <HiddenInput />
      </DateFieldContext>
    </FieldHost>
  )
}

/** An embedded Root forwards only plain element props (no Field props). */
function plainDivProps(p: Record<string, unknown>) {
  const {
    disabled: _d,
    readOnly: _r,
    validationMode,
    validationBehavior,
    validationDebounce,
    ...rest
  } = p
  void [_d, _r, validationMode, validationBehavior, validationDebounce]
  return rest
}

/** The hidden native input: name, ISO value, constraints, validity, reset, autofill. */
function HiddenInput() {
  const ctx = useDateField("Root")
  const { send, formInput } = ctx
  const value = ctx.view.values.value ?? null
  const latest = useRef(value)
  latest.current = value
  const [mirror] = useState(() => () => ({ value: latest.current?.toString() ?? "" }))
  useIsoLayoutEffect(() => {
    formInput.sync(mirror(), { dispatch: false })
  })
  useEffect(
    () =>
      formInput.track({
        onReset: () => send({ type: "RESET" }),
        current: mirror,
        onNativeInput: (input) => {
          send({ type: "INPUT.ADOPT", value: input.value })
          return true
        },
      }),
    [formInput, send, mirror],
  )
  return <input {...normalizeProps(useApi(ctx).hiddenInput())} ref={ctx.hiddenEl} />
}

type InputProps = Omit<ComponentPropsWithRef<"div">, "children"> & {
  /** Segments in order; without children every segment renders automatically. */
  readonly children?: ((segments: readonly SegmentPart[]) => ReactNode) | ReactNode
  readonly render?: RenderProp<DateFieldState>
}

/** The group of segments, its hidden segment names and value description. */
function Input({ children, render, ref, ...rest }: InputProps) {
  const ctx = useDateField("Input")
  const env = useEnvironment()
  const binding = useFieldControl()
  const api = useApi(ctx)
  const { instance } = ctx
  const first = api.segments().find((s) => s.editable)
  const firstId = first ? segmentId(instance, first.type as DateSegmentType) : undefined
  const register = ctx.embedded ? undefined : binding?.register
  useIsoLayoutEffect(() => {
    if (!register || !firstId) return
    return register(
      {
        id: firstId,
        labelable: false,
        focus: (m) => {
          const el = ctx.inputEl.current?.ownerDocument.getElementById(firstId)
          if (el) void focusSafely(el, env, "programmatic", m)
        },
        validityElement: () => ctx.hiddenEl.current,
        value: () => ctx.view.values.value ?? null,
      },
      firstId,
    )
  }, [register, firstId, env])
  // Each applied change is reported to the Field once (date-field "Field Integration").
  const value = ctx.view.values.value ?? null
  const reported = useRef(value)
  const report = ctx.embedded ? undefined : binding?.report
  useEffect(() => {
    if (reported.current === value) return
    reported.current = value
    report?.({ type: "change", value, user: true, composing: false })
  }, [value, report])
  const handlers = {
    // A press on the group outside a segment: the last filled segment before it (pointer only).
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      const root = ctx.inputEl.current
      if (!root || ctx.disabled || (e.target as Element).closest("input")) return
      const el = segmentAtPress(root, e.clientX, ctx.dir)
      if (!el) return
      e.preventDefault()
      void focusSafely(el, env, "programmatic", "pointer")
    },
  }
  const content =
    typeof children === "function"
      ? children(ctx.state.segments)
      : (children ?? ctx.state.segments.map((s) => <Segment key={s.key} segment={s} />))
  const description = api.valueDescription()
  const props = mergeProps(
    {
      ...joinHandlers(normalizeProps(api.input()), handlers),
      ref: composeRefs(ctx.inputEl, ref),
      children: (
        <>
          {content}
          {api.segmentNames().map((n) => (
            <span key={n.key} {...normalizeProps(n.props)} aria-hidden="true">
              {n.text}
            </span>
          ))}
          {description ? (
            <span {...normalizeProps(description.props)} aria-hidden="true">
              {description.text}
            </span>
          ) : null}
        </>
      ),
    },
    rest,
  )
  return renderPart("div", props, render, ctx.state)
}

type SegmentProps = Omit<ComponentPropsWithRef<"input">, "value" | "defaultValue"> & {
  readonly segment: SegmentPart
  readonly render?: RenderProp<DateFieldState>
}

/** One segment: an input for an editable segment or the zone, a hidden span for a literal. */
function Segment({ segment, render, ref, ...rest }: SegmentProps) {
  const ctx = useDateField("Segment")
  const api = useApi(ctx)
  const own = normalizeProps(api.segment(segment))
  if (segment.type === "literal") {
    const { children: _c, ...spanRest } = rest as Record<string, unknown>
    void _c
    // The server's formatter may differ in a literal only (date-segments "Server Rendering").
    return renderPart(
      "span",
      mergeProps({ ...own, suppressHydrationWarning: true, children: segment.text }, spanRest),
      render,
      ctx.state,
    )
  }
  if (segment.type === "timeZoneName") {
    return renderPart("input", mergeProps({ ...own, ref }, rest), render, ctx.state)
  }
  return (
    <EditableSegment
      segment={segment}
      own={own}
      api={api}
      inputRef={ref}
      rest={rest}
      render={render}
    />
  )
}

function EditableSegment({
  segment,
  own,
  api,
  inputRef,
  rest,
  render,
}: {
  readonly segment: SegmentPart
  readonly own: Record<string, unknown>
  readonly api: Api
  readonly inputRef: SegmentProps["ref"]
  readonly rest: Omit<SegmentProps, "segment" | "render" | "ref">
  readonly render: RenderProp<DateFieldState> | undefined
}) {
  const ctx = useDateField("Segment")
  const env = useEnvironment()
  const type = segment.type as DateSegmentType
  const el = useRef<HTMLInputElement | null>(null)
  const latest = useRef(ctx)
  latest.current = ctx
  // `beforeinput` is not React's onBeforeInput: insertions are planned before they apply.
  useEffect(() => {
    const input = el.current
    if (!input) return
    const onBeforeInput = (e: Event) => {
      const ie = e as InputEvent
      if (latest.current.view.matches("composing") || ie.isComposing) return
      const plan = planSegmentInput({ data: ie.data, inputType: ie.inputType }, type)
      if (plan.cancel) e.preventDefault()
      if (plan.event) latest.current.send(plan.event)
    }
    input.addEventListener("beforeinput", onBeforeInput)
    return () => input.removeEventListener("beforeinput", onBeforeInput)
  }, [type])
  const { send } = ctx
  const handlers = {
    onFocus: (e: FocusEvent<HTMLInputElement>) => {
      ctx.selectAll.current = false
      send({ type: "SEGMENT.FOCUS", segment: type, modality: env.modality.modality() })
      // The whole text selected, as the native control highlights its sub-field.
      e.currentTarget.select()
    },
    onBlur: (e: FocusEvent<HTMLInputElement>) => {
      const next = e.relatedTarget as Node | null
      const inside = next !== null && ctx.inputEl.current?.contains(next) === true
      send({ type: "SEGMENT.BLUR", related: inside ? "segment" : "outside" })
    },
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.defaultPrevented) return
      const event = dateFieldKey(describeKey(e.nativeEvent, env), type, {
        dir: ctx.dir,
        platform: env.platform,
        selectAll: ctx.selectAll.current,
      })
      if (event === "select-all") {
        ctx.selectAll.current = true
        return
      }
      ctx.selectAll.current = false
      if (!event) return
      e.preventDefault()
      send(event)
    },
    // Only a composition changes the input natively; its text arrives at the end.
    onChange: () => {},
    onCompositionStart: () => send({ type: "COMPOSITION.START" }),
    onCompositionEnd: (e: { data: string }) =>
      send({ type: "COMPOSITION.END", segment: type, text: e.data }),
    onPaste: (e: ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault()
      if (ctx.disabled || ctx.readOnly) return
      send({ type: "PASTE", text: e.clipboardData.getData("text") })
    },
    onCopy: (e: ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault()
      e.clipboardData.setData("text/plain", api.copyText(type))
    },
  }
  const props = mergeProps(
    { ...joinHandlers(own, handlers), ref: composeRefs(el, inputRef) },
    rest as Record<string, unknown>,
  )
  return renderPart("input", props, render, ctx.state)
}

function warnEmbedded(part: string) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[rind-ui] date-field: an embedded field renders no ${part}; the host names it.`)
  }
}

function Label(props: ComponentPropsWithRef<typeof HostLabel>) {
  const ctx = useDateField("Label")
  useEffect(() => {
    if (ctx.embedded) warnEmbedded("Label")
  }, [ctx.embedded])
  return ctx.embedded ? null : <HostLabel {...props} />
}
function Description(props: ComponentPropsWithRef<typeof HostDescription>) {
  const ctx = useDateField("Description")
  useEffect(() => {
    if (ctx.embedded) warnEmbedded("Description")
  }, [ctx.embedded])
  return ctx.embedded ? null : <HostDescription {...props} />
}
function ErrorMessage(props: ComponentPropsWithRef<typeof HostErrorMessage>) {
  const ctx = useDateField("ErrorMessage")
  useEffect(() => {
    if (ctx.embedded) warnEmbedded("ErrorMessage")
  }, [ctx.embedded])
  return ctx.embedded ? null : <HostErrorMessage {...props} />
}

export const DateField = { Root, Label, Description, ErrorMessage, Input, Segment }
