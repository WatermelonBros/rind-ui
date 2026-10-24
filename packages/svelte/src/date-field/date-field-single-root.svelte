<script lang="ts">
// Date Field parts: wiring only. The machine owns the draft and the value; connect every
// attribute, the key mapping and the insertion plan; core/dom the segment layout. The Root
// is a Field when not inside one (the shared Field host), or a plain element when embedded
// in a host component; the hidden native input carries name, constraints and reset.
import {
  adjacentSegment,
  type DateFieldBoundary,
  type DateFieldDraftHint,
  type DateFieldReason,
  type DateSegmentType,
  dateClockCapability,
  dateFieldConnect,
  dateFieldMachine,
  dateFieldMessages,
  defaultPlaceholderValue,
  type FieldValue,
  focusSafely,
  formatFor,
  hiddenFormInput,
  mergeFieldProps,
  quirkActive,
  resolveCalendar,
  segmentId,
  setControlValidity,
  Time,
  today as todayOf,
  todayZone,
  valueKind,
} from "@rind-ui/core"
import { untrack } from "svelte"
import { useFieldBindingPeek } from "../field/context.svelte"
import FieldHost from "../field/field-host.svelte"
import { useFieldsetDisabled } from "../fieldset/context"
import { attrs, normalizeProps } from "../normalize-props"
import PopoverRoot from "../popover/popover-root.svelte"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { useMachine } from "../use-machine.svelte"
import { useModality } from "../use-modality.svelte"
import { type BaseInput, type Ctx, dateField, single } from "./context"
import HiddenInput from "./date-field-hidden-input.svelte"
import SinglePicker from "./date-field-single-picker.svelte"
import { calendarTabStop, controlElement } from "./picker"
import type {
  DateFieldChangeDetails,
  DateFieldSingleRootProps,
  DatePickerOpenChangeDetails,
} from "./types"

let {
  value = $bindable(),
  defaultValue = null,
  onValueChange,
  placeholderValue,
  granularity,
  maxGranularity,
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
  fieldMessages,
  children,
  id,
  selectionMode: _single,
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
}: DateFieldSingleRootProps = $props()

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

const env = useEnvironment(dateClockCapability)
const uid = $props.id()
const instance = untrack(() => id ?? uid)
const loc = useLocale(
  () => ownLocale,
  () => ownDir,
)
const messages = useMessages("date-field", dateFieldMessages, () => ownMessages)
// One calendar object per system: a new one each render would recompute the segments.
let calendarObj = untrack(() => resolveCalendar(loc.current.locale, createCalendar).calendar)
const resolved = $derived.by(() => {
  const r = resolveCalendar(loc.current.locale, createCalendar)
  if (calendarObj.identifier !== r.calendar.identifier) calendarObj = r.calendar
  return { calendar: calendarObj, formatLocale: r.formatLocale }
})
const peeked = useFieldBindingPeek()
// Embedded: the host is the field; an enclosing Field is not this control's.
const enclosing = () => (embedded ? null : (peeked?.() ?? null))
const fieldsetDisabled = useFieldsetDisabled()
const disabled = $derived(
  fieldProps.disabled === true || enclosing()?.state.disabled === true || fieldsetDisabled(),
)
const readOnly = $derived(fieldProps.readonly === true || enclosing()?.state.readOnly === true)
const required = $derived(fieldProps.required === true || enclosing()?.state.required === true)
// Today is read once: a placeholder that moved at midnight would rewrite a stepped segment.
const placeholder = untrack(() => {
  const current = value === undefined ? defaultValue : value
  return (
    placeholderValue ??
    defaultPlaceholderValue({
      today: todayOf(env.dateClock, todayZone(undefined, current instanceof Time ? null : current)),
      granularity,
      maxGranularity,
      timeZone: current && "timeZone" in current ? current.timeZone : undefined,
      minValue,
      maxValue,
    })
  )
})
const inputEl: { current: HTMLElement | null } = { current: null }
const hiddenEl: { current: HTMLInputElement | null } = { current: null }
const selectAll = { current: false }
let pendingFocus: DateSegmentType | null = null
const formInput = hiddenFormInput(
  {
    input: () => hiddenEl.current,
    control: () => inputEl.current?.querySelector<HTMLInputElement>("input[data-editable]") ?? null,
  },
  env,
)
// A consumer's details.cancel() of the last change (a refused pick keeps the popover open).
const cancelled = { current: false }
// Picker triggers rendered: Alt+ArrowDown opens only a picker.
const triggers = $state({ count: 0 })
const machineEnv = {
  formInput: untrack(() => (embedded ? undefined : formInput)),
  navigation: {
    adjacent: (segment: DateSegmentType, direction: "next" | "previous") => {
      const root = inputEl.current
      const from = root?.ownerDocument.getElementById(segmentId(instance, segment))
      if (!root || !from) return null
      const scope = segmentScope?.() ?? null
      const el = adjacentSegment(from, direction, { root, scope, dir: loc.current.dir })
      if (!el) return null
      // Sound: every editable segment input carries its segment type as data-type (connect).
      if (root.contains(el)) return el.getAttribute("data-type") as DateSegmentType
      void focusSafely(el, env, "programmatic", "keyboard")
      return "external" as const
    },
  },
}
const machineProps = () => ({
  value,
  defaultValue,
  onValueChange: (v: FieldValue | null, details: { event: { type: string }; cancel(): void }) => {
    cancelled.current = false
    let refused = false
    const d: DateFieldChangeDetails = {
      reason: publicReason(details.event.type),
      modality: (details.event as { modality?: string }).modality,
      cancel: () => {
        refused = true
        cancelled.current = true
        details.cancel()
      },
    }
    onValueChange?.(v, d)
    if (!refused && value !== undefined) value = v
  },
  placeholderValue: placeholder,
  locale: resolved.formatLocale,
  calendar: resolved.calendar,
  granularity,
  maxGranularity,
  hourCycle,
  hideTimeZone,
  shouldForceLeadingZeros,
  disabled,
  readOnly,
  onBoundary: (b: DateFieldBoundary) => onBoundary?.(b),
  onDraftChange: (hint: DateFieldDraftHint) => onDraftChange?.(hint),
  focusSegment: (t: DateSegmentType) => {
    pendingFocus = t
  },
  id: instance,
})
const machine = useMachine(dateFieldMachine, machineProps as never, machineEnv)
const view = $derived(machine.view)
// A requested focus move, once the step that asked for it is rendered (react-spectrum#10683).
$effect(() => {
  void view
  untrack(() => {
    const t = pendingFocus
    if (t === null) return
    pendingFocus = null
    const el = inputEl.current?.ownerDocument.getElementById(segmentId(instance, t))
    if (el && el.ownerDocument.activeElement !== el) {
      void focusSafely(el, env, "programmatic", env.modality.modality())
    }
  })
})
const modality = useModality(env.modality, () => view.context.active !== null)
let mounted = $state(false)
$effect(() => {
  mounted = true
})
const base = (): BaseInput => {
  const valueNow = view.values.value ?? null
  const format = formatFor(machineProps() as never, valueNow)
  const kindSource = valueNow ?? defaultValue ?? placeholder
  return {
    instance,
    format,
    draft: view.context.draft,
    value: valueNow,
    defaultValue,
    kind: valueKind(kindSource),
    granularity: format.options.granularity,
    active: view.context.active,
    modality: modality.current,
    composing: view.matches("composing"),
    minValue,
    maxValue,
    isDateUnavailable,
    required,
    messages: messages(),
    // Platform attributes after mount only (date-segments "Server Rendering").
    plainTextbox: mounted && quirkActive("ios-vo-spinbutton-input", env),
    embedded,
    autoComplete,
    form,
    dir: loc.current.dir,
  }
}
const own = () => ({
  disabled,
  readOnly,
  required,
  invalid: fieldProps.invalid,
  describedBy: embedded ? describedBy?.join(" ") : undefined,
  labelledBy: embedded ? labelledBy?.join(" ") : undefined,
})
// The Root's own attributes and the validity need no Field binding.
const rootApi = $derived(
  dateFieldConnect({
    ...base(),
    field: mergeFieldProps({ role: "group", labelable: false, disabled, readOnly, required }, null),
    labelledBy: own().labelledBy,
  }),
)
// The control's own validity: on the validity element, or to the embedding host.
let reported: string | null = null
$effect(() => {
  const validity = rootApi.validity
  untrack(() => {
    const key = `${validity.reason}|${validity.message}`
    if (reported === key) return
    reported = key
    if (embedded) onValidityChange?.(validity.flags, validity.message)
    else if (hiddenEl.current) setControlValidity(hiddenEl.current, validity.message)
  })
})
const ctx: Ctx = {
  instance,
  view: () => machine.view,
  send: machine.send,
  base,
  own,
  embedded: untrack(() => embedded),
  onClearAll: () => onClearAll?.(),
  disabled: () => disabled,
  readOnly: () => readOnly,
  dir: () => loc.current.dir,
  inputEl,
  hiddenEl,
  formInput,
  selectAll,
  state: () => ({
    value: machine.view.values.value ?? null,
    segments: rootApi.segments(),
    focusedSegment: machine.view.context.active,
    composing: machine.view.matches("composing"),
    disabled,
    readOnly,
  }),
  picker: {
    closeOnSelect: () => closeOnSelect,
    firstDayOfWeek: () => firstDayOfWeek,
    placeholder,
    cancelled,
    triggers,
  },
}
dateField.set(ctx)
// Below a range's end, the picker parts are the range's; otherwise SinglePicker sets them.
if (untrack(() => embedded)) single.set(null)
const rootData = $derived(normalizeProps(rootApi.root()))
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
  // Read-only: the trigger stays focusable but never opens.
  if (next && readOnly) return details.cancel()
  const d: DatePickerOpenChangeDetails = {
    reason: next ? "trigger" : (details.reason as DatePickerOpenChangeDetails["reason"]),
    cancel: details.cancel,
  }
  onOpenChange?.(next, d)
  if (open !== undefined) open = next
}
// The Control (field and triggers) is inside the picker for dismissal.
const persistent = () => {
  const control = controlElement(instance)
  return [...(control ? [control] : []), ...(persistentElements?.() ?? [])]
}
</script>

{#if embedded}
  <div data-scope="date-field" data-part="root" data-instance={instance} {...attrs(rootData)} {...plain}>
    {@render children?.()}
  </div>
{:else}
  <FieldHost
    {...plain}
    {...field}
    scope="date-field"
    id={instance}
    {...fieldMessages ? { messages: fieldMessages } : {}}
    {...rootData}
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
      <SinglePicker>{@render children?.()}</SinglePicker><HiddenInput />
    </PopoverRoot>
  </FieldHost>
{/if}
