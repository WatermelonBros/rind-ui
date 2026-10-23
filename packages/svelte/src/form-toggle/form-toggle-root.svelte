<script lang="ts">
import {
  type CheckedState,
  focusSafely,
  hiddenFormInput,
  type Modality,
  mergeFieldProps,
  partId,
  watchFieldsetDisabled,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { useFieldControl } from "../field/context.svelte"
import { useFieldsetDisabled } from "../fieldset/context"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { usePartRegistry } from "../use-ids.svelte"
import {
  type FormToggleContext,
  formToggleContext,
  formToggleGrouping,
  useApi,
} from "./context.svelte"
import type { FormToggleConfig, FormToggleRootProps } from "./types"

const mirrorOf = (v: CheckedState) => ({
  checked: v === true,
  indeterminate: v === "indeterminate",
})

let {
  config,
  checked = $bindable(),
  defaultChecked = false,
  onCheckedChange,
  disabled = false,
  focusableWhenDisabled = false,
  readonly: readOnly = false,
  required = false,
  invalid = false,
  name,
  value = "on",
  form,
  uncheckedValue,
  id,
  child,
  children,
  ...rest
}: FormToggleRootProps<CheckedState, unknown> & { config: FormToggleConfig } = $props()

const env = useEnvironment()
const uid = $props.id()
const instance = $derived(id ?? uid)
// Inside a Checkbox Group: the group owns the value, the flags and the Field binding.
const grouping = formToggleGrouping.maybe()
const grouped = $derived(
  config.scope === "checkbox"
    ? (grouping?.()?.resolve(value, { disabled, readOnly, required }) ?? null)
    : null,
)
const binding = useFieldControl(uid, { skip: untrack(() => grouped) !== null })
const controlEl: FormToggleContext["controlEl"] = { current: null }
const inputEl: FormToggleContext["inputEl"] = { current: null }
let controlTag = $state("button")
// A rind-ui Fieldset's context reaches portalled parts; the DOM tracker native fieldsets.
const fieldsetContext = useFieldsetDisabled()
let fieldsetDom = $state(false)
const field = $derived(
  mergeFieldProps(
    {
      role: config.role,
      labelable: true,
      disabled: (grouped?.props.disabled ?? disabled) || fieldsetContext() || fieldsetDom,
      readOnly: grouped?.props.readOnly ?? readOnly,
      required: grouped?.props.required ?? required,
      invalid: grouped?.props.invalid ?? invalid,
      name: grouped ? grouped.props.name : name,
    },
    binding?.() ?? null,
  ),
)
const formInput = hiddenFormInput(
  { input: () => inputEl.current, control: () => controlEl.current as HTMLElement | null },
  env,
)
// The reason of the latest proposal, for the Field's change report (user or reset).
let lastReason: string | null = null
const service = untrack(() => config).useService(
  () => ({
    // A grouped checkbox is controlled by its group (its CheckedState).
    checked: grouped ? grouped.props.checked : checked,
    defaultChecked,
    onCheckedChange: (next: CheckedState, details: unknown) => {
      lastReason = (details as { reason?: string }).reason ?? null // ChangeDetails
      if (grouped) {
        // The proposal's TOGGLE carries the modality (a RESET never reaches a grouped one).
        const event = (details as { event?: { modality?: Modality } }).event
        grouped.onChange(next, event?.modality ?? "virtual")
      }
      let cancelled = false
      const d = details as { cancel?: () => void }
      onCheckedChange?.(
        next,
        d.cancel
          ? {
              ...d,
              cancel: () => {
                cancelled = true
                d.cancel?.()
              },
            }
          : details,
      )
      if (!cancelled && checked !== undefined) checked = next
    },
    disabled: field.disabled,
    readOnly: field.readOnly,
  }),
  formInput,
)
const current = $derived(service.checked())
// After every update: the input reflects the value (hydration, re-renders); no events.
$effect(() => {
  const value = current
  untrack(() => formInput.sync(mirrorOf(value), { dispatch: false }))
})
$effect(() => {
  const isGrouped = grouped !== null
  return untrack(() =>
    formInput.track({
      onReset: () => service.send({ type: "RESET" }),
      current: () => mirrorOf(service.checked()),
      // A group answers its form's reset once, for every item.
      resetsWithForm: !isGrouped,
    }),
  )
})
const ids = $derived({
  control: binding?.().controlId ?? partId(config.scope, instance, "control"),
  label: partId(config.scope, instance, "label"),
  description: partId(config.scope, instance, "description"),
  hiddenInput: partId(config.scope, instance, "hidden-input"),
})
// field-control: register, report each accepted toggle and reset.
$effect(() => {
  const control = ids.control
  const tag = controlTag
  if (!binding) return
  return untrack(() =>
    binding().register(
      {
        id: control,
        labelable: tag === "button" || tag === "input",
        focus: (modality) => {
          const el = controlEl.current
          if (el instanceof HTMLElement) void focusSafely(el, env, "programmatic", modality)
        },
        validityElement: () => inputEl.current,
        value: () => service.checked(),
      },
      control,
    ),
  )
})
let reported = untrack(() => current)
$effect(() => {
  const now = current
  untrack(() => {
    if (reported === now) return
    reported = now
    const user = lastReason === "TOGGLE"
    lastReason = null
    binding?.().report({ type: "change", value: now, user, composing: false })
    binding?.().report({ type: "commit" })
  })
})
// Read once: the registry belongs to the instance.
const registry = usePartRegistry<"label" | "description">(
  untrack(() => ({ scope: config.scope, root: instance })),
)
const ctx: FormToggleContext = {
  config: untrack(() => config),
  instance: () => instance,
  service,
  binding,
  own: () => ({
    disabled: field.disabled,
    readOnly: field.readOnly,
    required: grouped?.props.required ?? required,
    invalid: grouped?.props.invalid ?? invalid,
    name: field.name,
  }),
  focusableWhenDisabled: () => focusableWhenDisabled,
  ids: () => ids,
  registry,
  controlEl,
  inputEl,
  controlTag: () => controlTag,
  setControlTag: (tag) => {
    controlTag = tag
  },
  hidden: () => ({
    value,
    form: grouped ? grouped.props.form : form,
    // A grouped item's server HTML submits its membership before hydration; its reset is the
    // group's (which re-syncs every item), so the attribute follows the group.
    defaultChecked: grouped ? grouped.props.checked : defaultChecked,
  }),
  uncheckedValue: () => uncheckedValue,
  grouped: () => grouped,
}
formToggleContext.set(ctx)
const apiFor = useApi(ctx)
const api = $derived(apiFor())
// The DOM tracker for native fieldsets, once the control is mounted.
$effect(() => {
  const node = controlEl.current
  if (!node) return
  const w = watchFieldsetDisabled(node, (d) => (fieldsetDom = d))
  fieldsetDom = w.disabled
  return w.stop
})
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...normalizeProps({ ...api.root(), ...grouped?.props.root }),
        ...(id === undefined ? {} : { id }),
      },
      rest,
    ),
  ),
)
const unchecked = $derived(api.uncheckedInput())
const toggleState = $derived({
  checked: current,
  disabled: field.disabled,
  readOnly: field.readOnly,
})
const captureInput = (node: HTMLInputElement) => {
  inputEl.current = node
  return () => {
    if (inputEl.current === node) inputEl.current = null
  }
}
</script>

{#snippet inputs()}
  <!-- After the control: never a wrapping label's first labelable descendant. -->
  <input {...attrs(normalizeProps(api.hiddenInput()))} {@attach captureInput} />
  {#if unchecked}<input {...attrs(normalizeProps(unchecked))} />{/if}
{/snippet}

{#if child}
  {@render child({ props: merged, state: toggleState })}
  {@render inputs()}
{:else}
  <div {...attrs(merged)}>{@render children?.(toggleState)}{@render inputs()}</div>
{/if}
