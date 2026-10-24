<script lang="ts">
// Date Field range mode (date-field spec "Range Mode"): wiring only. The coordinator machine
// derives the pair's value and validity; each end is an embedded Date Field; connect owns the
// group, the ends, the separator and the two hidden inputs.
import {
  type DateRangeFieldValue,
  dateFieldMessages,
  dateRangeConnect,
  dateRangeFieldMachine,
  type FieldControlBinding,
  hiddenFormInput,
  mergeFieldProps,
  parseEndValue,
  rangeStateOf,
  resolveCalendar,
  setControlValidity,
  Time,
} from "@rind-ui/core"
import { untrack } from "svelte"
import { useFieldBindingPeek } from "../field/context.svelte"
import FieldHost from "../field/field-host.svelte"
import { useFieldsetDisabled } from "../fieldset/context"
import { attrs, normalizeProps } from "../normalize-props"
import PopoverRoot from "../popover/popover-root.svelte"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { useMachine } from "../use-machine.svelte"
import { dateField, dateRange, type RangeCtx, rangeTriggers, single } from "./context"
import { calendarTabStop, controlElement } from "./picker"
import type { DatePickerOpenChangeDetails, DateRangeFieldRootProps } from "./types"

let {
  value = $bindable(),
  defaultValue,
  onValueChange,
  allowsNonContiguousRanges = false,
  allowsOvernight = false,
  startName,
  endName,
  form,
  messages: ownMessages,
  placeholderValue,
  granularity,
  maxGranularity,
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
  open = $bindable(),
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
}: DateRangeFieldRootProps = $props()

const env = useEnvironment()
const uid = $props.id()
const instance = untrack(() => id ?? uid)
const loc = useLocale(
  () => ownLocale,
  () => ownDir,
)
const allMessages = useMessages("date-field", dateFieldMessages, () => ownMessages)
// Time ends: a time field per end, named "Start time" / "End time" (spec "Range Mode").
const sample = $derived(value?.start ?? defaultValue?.start ?? placeholderValue ?? null)
const timeEnds = $derived(maxGranularity === "hour" || sample instanceof Time)
const messages = $derived(
  timeEnds
    ? { ...allMessages(), startDate: allMessages().startTime, endDate: allMessages().endTime }
    : allMessages(),
)
const enclosing = useFieldBindingPeek()
const fieldsetDisabled = useFieldsetDisabled()
const disabled = $derived(
  fieldProps.disabled === true || enclosing?.().state.disabled === true || fieldsetDisabled(),
)
const readOnly = $derived(fieldProps.readonly === true || enclosing?.().state.readOnly === true)
const required = $derived(fieldProps.required === true || enclosing?.().state.required === true)
// A consumer's details.cancel() of the last change (a refused pick keeps the popover open).
const cancelled = { current: false }
const triggers = $state({ count: 0 })
const machineProps = () => ({
  value,
  defaultValue,
  onValueChange: (v: DateRangeFieldValue, details: { event: { type: string }; cancel(): void }) => {
    cancelled.current = false
    let refused = false
    onValueChange?.(v, {
      reason: details.event.type,
      cancel: () => {
        refused = true
        cancelled.current = true
        details.cancel()
      },
    })
    if (!refused && value !== undefined) value = v
  },
  isDateUnavailable,
  allowsNonContiguousRanges,
  allowsOvernight,
  required,
  messages,
})
const machine = useMachine(dateRangeFieldMachine, machineProps as never)
const view = $derived(machine.view)
const pair = $derived(rangeStateOf(view.context, machineProps() as never))
const inputEl: { current: HTMLElement | null } = { current: null }
const startHidden: { current: HTMLInputElement | null } = { current: null }
const endHidden: { current: HTMLInputElement | null } = { current: null }
let focusWithin = $state(false)
const api = (binding: FieldControlBinding | null) => {
  const { calendar, formatLocale } = resolveCalendar(loc.current.locale)
  const s = sample
  return dateRangeConnect({
    instance,
    state: pair,
    start: view.context.start.value,
    end: view.context.end.value,
    // The ends' own default: minutes for a time or a date-time, else days.
    granularity: granularity ?? (timeEnds || (s !== null && "hour" in s) ? "minute" : "day"),
    ...(s === null && timeEnds ? { kind: "time" as const } : {}),
    locale: formatLocale,
    calendar,
    messages,
    field: mergeFieldProps(
      { role: "group", labelable: false, disabled, readOnly, required },
      binding ?? enclosing?.() ?? null,
    ),
    labelledBy: binding?.ids.label,
    startName,
    endName,
    form,
    minValue,
    maxValue,
    focusWithin,
  })
}
const own = $derived(api(null))
// Both hidden inputs: their values, a form reset, nothing adopted from autofill yet.
const forms = {
  start: hiddenFormInput({ input: () => startHidden.current, control: () => null }, env),
  end: hiddenFormInput({ input: () => endHidden.current, control: () => null }, env),
}
$effect(() => {
  const message = pair.message
  const start = own.formValue("start")
  const end = own.formValue("end")
  untrack(() => {
    // The pair's own validity on the start hidden input (the registered validity element).
    if (startHidden.current) setControlValidity(startHidden.current, message)
    forms.start.sync({ value: start }, { dispatch: false })
    forms.end.sync({ value: end }, { dispatch: false })
  })
})
$effect(() =>
  untrack(() => {
    const stops = (["start", "end"] as const).map((edge) =>
      forms[edge].track({
        onReset: () => machine.send({ type: "RESET" }),
        current: () => ({ value: api(null).formValue(edge) }),
        // A browser autofill of a valid ISO string is adopted into that end.
        onNativeInput: (input) => {
          const v = parseEndValue(input.value, input.type)
          if (v === null) return false
          machine.send({
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
  }),
)
const ctx: RangeCtx = {
  instance,
  view: () => machine.view,
  send: machine.send,
  end: () => ({
    ...(placeholderValue ? { placeholderValue } : {}),
    ...(granularity ? { granularity } : {}),
    ...(maxGranularity ? { maxGranularity } : {}),
    ...(hourCycle ? { hourCycle } : {}),
    ...(hideTimeZone !== undefined ? { hideTimeZone } : {}),
    ...(shouldForceLeadingZeros !== undefined ? { shouldForceLeadingZeros } : {}),
    ...(minValue !== undefined ? { minValue } : {}),
    ...(maxValue !== undefined ? { maxValue } : {}),
    ...(isDateUnavailable ? { isDateUnavailable } : {}),
    locale: loc.current.locale,
    dir: loc.current.dir,
    disabled,
    readOnly,
    ...(ownMessages ? { messages: ownMessages } : {}),
  }),
  inputEl,
  hidden: { start: startHidden, end: endHidden },
  api,
  state: () => pair,
  triggers,
  cancelled,
  closeOnSelect: () => closeOnSelect,
  allowsNonContiguousRanges: () => allowsNonContiguousRanges,
  firstDayOfWeek: () => firstDayOfWeek,
  granularity: () => granularity,
  placeholderValue: () => placeholderValue,
}
dateRange.set(ctx)
rangeTriggers.set(triggers)
// Below the range: no single field (the ends set their own).
dateField.set(null)
single.set(null)
const field = $derived(
  Object.fromEntries(
    Object.entries(fieldProps).filter(([k]) =>
      [
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
      ].includes(k),
    ),
  ),
)
const plain = $derived(
  Object.fromEntries(Object.entries(fieldProps).filter(([k]) => !(k in field))),
)
const popoverChange = (next: boolean, details: { reason: string; cancel(): void }) => {
  if (next && readOnly) return details.cancel()
  const d: DatePickerOpenChangeDetails = {
    reason: next ? "trigger" : (details.reason as DatePickerOpenChangeDetails["reason"]),
    cancel: details.cancel,
  }
  onOpenChange?.(next, d)
  if (open !== undefined) open = next
}
const persistent = () => {
  const control = controlElement(instance)
  return [...(control ? [control] : []), ...(persistentElements?.() ?? [])]
}
const hiddenRef = (target: { current: HTMLInputElement | null }) => (node: HTMLInputElement) => {
  target.current = node
  return () => {
    if (target.current === node) target.current = null
  }
}
</script>

<FieldHost
  {...plain}
  {...field}
  scope="date-field"
  id={instance}
  {...fieldMessages ? { messages: fieldMessages } : {}}
  {...normalizeProps(own.root())}
  onfocusin={() => {
    focusWithin = true
  }}
  onfocusout={(e: FocusEvent) => {
    const root = e.currentTarget as Element
    if (!root.contains(e.relatedTarget as Node | null)) focusWithin = false
  }}
>
  <PopoverRoot
    id={instance}
    scope="date-field"
    {disabled}
    {...open === undefined ? {} : { open }}
    {...defaultOpen === undefined ? {} : { defaultOpen }}
    onOpenChange={popoverChange}
    {...modal === undefined ? {} : { modal }}
    initialFocus={initialFocus === undefined ? calendarTabStop(instance) : initialFocus}
    {...finalFocus === undefined ? {} : { finalFocus }}
    {...positioning === undefined ? {} : { positioning }}
    persistentElements={persistent}
  >
    {@render children?.()}<input
      {...attrs(normalizeProps(own.hiddenInput("start")))}
      {@attach hiddenRef(startHidden)}
    /><input {...attrs(normalizeProps(own.hiddenInput("end")))} {@attach hiddenRef(endHidden)} />
  </PopoverRoot>
</FieldHost>
