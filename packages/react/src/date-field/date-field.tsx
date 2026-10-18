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
  type DayOfWeek,
  dateFieldConnect,
  dateFieldKey,
  dateFieldMachine,
  dateFieldMessages,
  defaultPlaceholderValue,
  describeKey,
  type FieldMessages,
  focusSafely,
  formatFor,
  formValueOf,
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
  type Dispatch,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type SetStateAction,
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
import { ScopedPopoverRoot, usePopoverControls } from "../popover/popover"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import {
  calendarTabStop,
  controlElement,
  type DatePickerCloseReason,
  type DatePickerProps,
  PickerCalendar,
  PickerClearTrigger,
  PickerContent,
  PickerControl,
  PickerPortal,
  PickerPositioner,
  PickerTrigger,
  SinglePicker,
  useInControl,
} from "./date-picker"
import {
  DateRangeFieldRoot,
  type DateRangeFieldRootProps,
  DateRangeInput,
  useDateRange,
} from "./date-range-field"

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

export interface Ctx {
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
  /** The picker parts' options (date-field "Picker Parts"). */
  readonly picker: {
    readonly closeOnSelect: boolean
    readonly firstDayOfWeek: DayOfWeek | undefined
    readonly placeholder: DateValue
    readonly cancelled: { current: boolean }
    readonly triggers: number
    readonly setTriggers: Dispatch<SetStateAction<number>>
  }
  /** Embedded: select all + Backspace cleared this field (the host clears its pair). */
  readonly onClearAll: () => void
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
export function useApi(ctx: Ctx): Api {
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
export function useDateField(part: string): Ctx {
  const ctx = useContext(DateFieldContext)
  if (!ctx) throw new Error(`DateField.${part} must be inside DateField.Root`)
  return ctx
}

export type DateFieldRootProps = Omit<
  ComponentPropsWithRef<"div">,
  "children" | "defaultValue" | "onChange" | "dir"
> & {
  /** The parts: Label, Input, Description, ErrorMessage and, for a picker, its parts. */
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
  /** The Root's `dir` and which way Left/Right move between segments. Default: the locale's. */
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
  /** Embedded: select all + Backspace cleared the field (a range clears both ends). */
  readonly onClearAll?: () => void
  /** Arrows move across every field's segments inside this element (paired fields). */
  readonly segmentScope?: { readonly current: HTMLElement | null }
  // Field props (the Root is a Field when not inside one).
  readonly name?: string
  readonly disabled?: boolean
  readonly readOnly?: boolean
  readonly required?: boolean
  /** `true` forces invalid, `false` valid; `undefined` validates. */
  readonly invalid?: boolean
  /** External errors (server): shown at once, cleared by the next change. */
  readonly errors?: readonly string[]
  /** Runs after the field's own constraints pass. */
  readonly validate?: Validate
  /** When errors are displayed. Default: `"submit"`. */
  readonly validationMode?: ValidationMode
  /** Whether an invalid Field blocks submission. Default: `"native"`. */
  readonly validationBehavior?: ValidationBehavior
  /** Delays `validate` in `change` mode (ms). Default: 0. */
  readonly validationDebounce?: number
  /** The Field's messages when the Root is the Field. */
  readonly fieldMessages?: MessageOverrides<FieldMessages>
  /** `"range"` selects a start and an end (DateRangeFieldRootProps). */
  readonly selectionMode?: "single"
} & DatePickerProps

/** Single mode (default), or a range of two ends with `selectionMode="range"`. */
function Root(props: DateFieldRootProps | DateRangeFieldRootProps) {
  return props.selectionMode === "range" ? (
    <DateRangeFieldRoot {...props} />
  ) : (
    <SingleRoot {...props} />
  )
}

function SingleRoot({
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
  onClearAll,
  segmentScope,
  fieldMessages: ownFieldMessages,
  children,
  id,
  selectionMode: _single,
  open,
  defaultOpen,
  onOpenChange,
  closeOnSelect = true,
  modal,
  initialFocus,
  finalFocus,
  positioning,
  persistentElements,
  firstDayOfWeek,
  ...fieldProps
}: DateFieldRootProps) {
  void _single
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
  // A consumer's details.cancel() of the last change (a refused pick keeps the popover open).
  const cancelled = useRef(false)
  // Picker triggers rendered: Alt+ArrowDown opens only a picker.
  const [triggers, setTriggers] = useState(0)
  const latestOpen = useRef(onOpenChange)
  latestOpen.current = onOpenChange
  const latest = useRef({ onValueChange, onBoundary, onDraftChange, onClearAll, segmentScope, dir })
  latest.current = { onValueChange, onBoundary, onDraftChange, onClearAll, segmentScope, dir }
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
    onValueChange: (v: DateValue | null, details: { event: { type: string }; cancel(): void }) => {
      cancelled.current = false
      latest.current.onValueChange?.(v, {
        reason: publicReason(details.event.type),
        modality: (details.event as { modality?: string }).modality,
        cancel: () => {
          cancelled.current = true
          details.cancel()
        },
      })
    },
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
    onClearAll: () => latest.current.onClearAll?.(),
    disabled,
    readOnly,
    dir,
    inputEl,
    hiddenEl,
    formInput,
    selectAll,
    state,
    picker: {
      closeOnSelect,
      firstDayOfWeek,
      placeholder,
      cancelled,
      triggers,
      setTriggers,
    },
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
      <ScopedPopoverRoot
        id={instance}
        scope="date-field"
        disabled={disabled}
        {...(open === undefined ? {} : { open })}
        {...(defaultOpen === undefined ? {} : { defaultOpen })}
        onOpenChange={(next, details) => {
          // Read-only: the trigger stays focusable but never opens.
          if (next && readOnly) return details.cancel()
          latestOpen.current?.(next, {
            reason: next ? "trigger" : (details.reason as DatePickerCloseReason),
            cancel: details.cancel,
          })
        }}
        {...(modal === undefined ? {} : { modal })}
        initialFocus={initialFocus === undefined ? calendarTabStop(instance) : initialFocus}
        {...(finalFocus === undefined ? {} : { finalFocus })}
        {...(positioning === undefined ? {} : { positioning })}
        // The Control (field and triggers) is inside the picker for dismissal.
        persistentElements={() => {
          const control = controlElement(instance)
          return [...(control ? [control] : []), ...(persistentElements?.() ?? [])]
        }}
      >
        <DateFieldContext value={ctx}>
          <SinglePicker>{children}</SinglePicker>
          <HiddenInput />
        </DateFieldContext>
      </ScopedPopoverRoot>
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
  const granularity = ctx.base.granularity
  const latestGranularity = useRef(granularity)
  latestGranularity.current = granularity
  const [mirror] = useState(() => () => ({
    value: formValueOf(latest.current, latestGranularity.current),
  }))
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
  /** Another element or a render function receiving the props and the field's state (not in range mode). */
  readonly render?: RenderProp<DateFieldState>
}

/** The group: one field's segments, or in range mode both ends with a separator. */
function Input(props: InputProps) {
  const single = useContext(DateFieldContext)
  const range = useDateRange()
  if (!single && range) {
    // The range group renders no per-field state: a state render prop does not apply.
    const { children, render: _render, ...rest } = props
    void _render
    return (
      <DateRangeInput
        {...rest}
        {...(typeof children === "function" || children === undefined ? {} : { children })}
        renderEnd={(edge) => <RangeEnd edge={edge} />}
      />
    )
  }
  return <SingleInput {...props} />
}

/** One end of a range: an embedded field named by the end and the Label. */
function RangeEnd({
  edge,
  render,
  ...rest
}: Omit<ComponentPropsWithRef<"div">, "children"> & {
  readonly edge: "start" | "end"
  readonly render?: RenderProp<undefined>
}) {
  const ctx = useDateRange()
  if (!ctx) throw new Error("DateField.Start / End must be inside a range DateField.Root")
  // The group registers with the Field; an end only reads its label's id.
  const binding = useFieldBindingPeek()
  const api = ctx.api(binding)
  const env = useEnvironment()
  const EDGE = edge === "start" ? "START" : "END"
  const value = edge === "start" ? ctx.view.context.startValue : ctx.view.context.endValue
  const editable = (which: "start" | "end") =>
    Array.from(
      ctx.inputEl.current?.querySelectorAll<HTMLElement>(
        `[data-edge="${which}"] input[data-editable]`,
      ) ?? [],
    )
  const labelledBy = [
    edge === "start" ? api.ids.startName : api.ids.endName,
    binding?.ids.label,
  ].filter((x): x is string => x !== undefined)
  const props = mergeProps(normalizeProps(api.edge(edge)), rest)
  return renderPart(
    "div",
    {
      ...props,
      children: (
        <SingleRoot
          {...ctx.end}
          embedded
          // Sound: a range Root's ends are DateValues (Time ends come with time values).
          value={(value as DateValue | null) ?? null}
          onValueChange={(v, details) =>
            ctx.send({ type: `${EDGE}.COMMIT`, value: v, reason: details.reason })
          }
          // Select all + Backspace in either end clears the pair (both ends).
          onClearAll={() => ctx.send({ type: "CLEAR" })}
          onValidityChange={(flags, message) =>
            ctx.send({ type: `${EDGE}.VALIDITY`, flags, message })
          }
          labelledBy={labelledBy}
          // The pair's validity and the Field's description reach the ends' segments.
          invalid={api.invalid}
          describedBy={api.endDescribedBy(edge)}
          segmentScope={ctx.inputEl}
          // Focus between ends (spec "Range Mode — Focus Between Ends").
          onBoundary={(b) => {
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
      ),
    },
    render,
    undefined,
  )
}

function Start(props: Omit<ComponentPropsWithRef<"div">, "children">) {
  return <RangeEnd edge="start" {...props} />
}
function End(props: Omit<ComponentPropsWithRef<"div">, "children">) {
  return <RangeEnd edge="end" {...props} />
}
function Separator(props: ComponentPropsWithRef<"span">) {
  const ctx = useDateRange()
  if (!ctx) throw new Error("DateField.Separator must be inside a range DateField.Root")
  return (
    <span
      {...mergeProps(normalizeProps(ctx.api(null).separator()), props as Record<string, unknown>)}
    />
  )
}

/** The group of segments, its hidden segment names and value description. */
function SingleInput({ children, render, ref, ...rest }: InputProps) {
  const ctx = useDateField("Input")
  const env = useEnvironment()
  // An embedded field is not the Field's control (its host is): it claims nothing.
  const binding = useFieldControl({ skip: ctx.embedded })
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
  // Each commit that changed the value or the field's own validity is reported to the Field
  // once (date-field "Field Integration"): an impossible date leaves the value null but must
  // still be validated when the user leaves.
  const value = ctx.view.values.value ?? null
  const reason = api.validity.reason
  const reported = useRef({ value, reason })
  const report = ctx.embedded ? undefined : binding?.report
  useEffect(() => {
    if (reported.current.value === value && reported.current.reason === reason) return
    reported.current = { value, reason }
    report?.({ type: "change", value, user: true, composing: false })
  }, [value, reason, report])
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
    // The press's mousedown would move focus to the body (the group is not focusable).
    onMouseDown: (e: { target: EventTarget; preventDefault(): void }) => {
      if (!(e.target as Element).closest("input")) e.preventDefault()
    },
  }
  const content =
    typeof children === "function"
      ? children(ctx.state.segments)
      : (children ?? ctx.state.segments.map((s) => <Segment key={s.key} segment={s} />))
  const description = api.valueDescription()
  const inControl = useInControl()
  const props = mergeProps(
    {
      ...joinHandlers(normalizeProps(api.input({ inControl })), handlers),
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
  /** The segment to render, one of those Input's children function receives. */
  readonly segment: SegmentPart
  /** Another element or a render function receiving the props and the field's state. */
  readonly render?: RenderProp<DateFieldState>
}

/** One segment: an input for an editable segment or the zone, a hidden span for a literal. */
function Segment({ segment, render, ref, ...rest }: SegmentProps) {
  const ctx = useDateField("Segment")
  const api = useApi(ctx)
  const own = normalizeProps(api.segment(segment))
  if (segment.type === "literal") {
    return <Literal segment={segment} own={own} rest={rest} render={render} />
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

/**
 * A literal: the server's formatter may differ from the browser's in a literal only (a
 * space before AM/PM): hydrated without a warning, then corrected to the browser's text.
 */
function Literal({
  segment,
  own,
  rest,
  render,
}: {
  readonly segment: SegmentPart
  readonly own: Record<string, unknown>
  readonly rest: Record<string, unknown>
  readonly render: RenderProp<DateFieldState> | undefined
}) {
  const ctx = useDateField("Segment")
  const el = useRef<HTMLSpanElement | null>(null)
  useIsoLayoutEffect(() => {
    if (el.current && el.current.textContent !== segment.text) el.current.textContent = segment.text
  })
  const { children: _c, ...spanRest } = rest
  void _c
  return renderPart(
    "span",
    mergeProps(
      { ...own, ref: el, suppressHydrationWarning: true, children: segment.text },
      spanRest,
    ),
    render,
    ctx.state,
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
  const popover = usePopoverControls()
  const rangeHost = useDateRange()
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
      if (event === "open-picker") {
        // Only a picker opens; otherwise the key is the browser's.
        // A range's ends are embedded: their host's triggers count.
        const triggers = ctx.embedded ? (rangeHost?.triggers ?? 0) : ctx.picker.triggers
        if (triggers === 0 || !popover || popover.open) return
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

/** Whether a Label-like part is inside an embedded field (it then renders nothing). */
function useHostPart(part: string): boolean {
  const single = useContext(DateFieldContext)
  const range = useDateRange()
  if (!single && !range) throw new Error(`DateField.${part} must be inside DateField.Root`)
  return single?.embedded === true
}

function Label(props: ComponentPropsWithRef<typeof HostLabel>) {
  // A range Root is the Field: its Label is the Field's (no single-field context there).
  const embedded = useHostPart("Label")
  useEffect(() => {
    if (embedded) warnEmbedded("Label")
  }, [embedded])
  return embedded ? null : <HostLabel {...props} />
}
function Description(props: ComponentPropsWithRef<typeof HostDescription>) {
  // A range Root is the Field: its Label is the Field's (no single-field context there).
  const embedded = useHostPart("Description")
  useEffect(() => {
    if (embedded) warnEmbedded("Description")
  }, [embedded])
  return embedded ? null : <HostDescription {...props} />
}
function ErrorMessage(props: ComponentPropsWithRef<typeof HostErrorMessage>) {
  // A range Root is the Field: its Label is the Field's (no single-field context there).
  const embedded = useHostPart("ErrorMessage")
  useEffect(() => {
    if (embedded) warnEmbedded("ErrorMessage")
  }, [embedded])
  return embedded ? null : <HostErrorMessage {...props} />
}

export const DateField = {
  Root,
  Label,
  Description,
  ErrorMessage,
  Input,
  Segment,
  Start,
  End,
  Separator,
  Control: PickerControl,
  Trigger: PickerTrigger,
  ClearTrigger: PickerClearTrigger,
  Portal: PickerPortal,
  Positioner: PickerPositioner,
  Content: PickerContent,
  Calendar: PickerCalendar,
}
