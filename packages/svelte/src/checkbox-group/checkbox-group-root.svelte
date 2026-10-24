<script lang="ts">
import {
  type ChangeDetails,
  type CheckboxGroupEvent,
  checkboxGroupConnect,
  checkboxGroupMachine,
  focusSafely,
  type Modality,
  mergeFieldProps,
  partId,
  readValidity,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { DEV } from "../dev"
import { elementRef } from "../element-ref.svelte"
import { useFieldControl } from "../field/context.svelte"
import { useFieldsetDisabled } from "../fieldset/context"
import { formToggleGrouping } from "../form-toggle/context.svelte"
import type { FormToggleGrouped, FormToggleGrouping } from "../form-toggle/types"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { usePartRegistry, useRenderedId } from "../use-ids.svelte"
import { useMachine } from "../use-machine.svelte"
import { checkboxGroupContext } from "./context"
import type { CheckboxGroupRootProps } from "./types"

let {
  value = $bindable(),
  defaultValue,
  onValueChange,
  allValues,
  disabled = false,
  readonly: readOnly = false,
  required = false,
  invalid = false,
  name,
  form,
  id,
  child,
  children,
  ...rest
}: CheckboxGroupRootProps = $props()

const env = useEnvironment()
const uid = $props.id()
const instance = $derived(id ?? uid)
const binding = useFieldControl(uid)
const fieldsetDisabled = useFieldsetDisabled()
const field = $derived(
  mergeFieldProps(
    {
      role: "group",
      labelable: false,
      disabled: disabled || fieldsetDisabled(),
      readOnly,
      required,
      invalid,
      name,
    },
    binding?.() ?? null,
  ),
)
const el = elementRef("div")
let labelTag = "span"
// The reason of the latest accepted change, for the Field: only a user's clears its external
// (server) errors (base-ui#1745); a parent's value or a reset does not.
let lastReason: string | null = null
const machine = useMachine(checkboxGroupMachine, () => ({
  value,
  defaultValue,
  onValueChange: (next: readonly string[], details: ChangeDetails<CheckboxGroupEvent>) => {
    lastReason = details.reason
    let cancelled = false
    onValueChange?.(next, {
      ...details,
      cancel: () => {
        cancelled = true
        details.cancel()
      },
    })
    if (!cancelled && value !== undefined) value = next
  },
  allValues,
  disabled: field.disabled,
  readOnly: field.readOnly,
}))
const send = machine.send
const current = $derived(machine.view.values.value ?? [])
// Read once: the registry belongs to the instance.
const registry = usePartRegistry<"label" | "description" | "error-message">(
  untrack(() => ({ scope: "checkbox-group", root: instance })),
)
const ids = $derived({
  label: partId("checkbox-group", instance, "label"),
  description: partId("checkbox-group", instance, "description"),
  errorMessage: partId("checkbox-group", instance, "error-message"),
})
const renderedLabel = useRenderedId(registry, "label")
const renderedDescription = useRenderedId(registry, "description")
const renderedError = useRenderedId(registry, "error-message")
const api = $derived.by(() => {
  // Rendered item Control ids in `allValues` order (the Parent's aria-controls).
  const items = machine.view.context.items
  const order = allValues ?? [...items.keys()]
  const controls = order.flatMap((v) => {
    const item = items.get(v)
    return item ? [item.id] : []
  })
  return checkboxGroupConnect({
    instance,
    value: current,
    allValues: allValues ?? [],
    disabled: field.disabled,
    readOnly: field.readOnly,
    required: field.required || field["aria-required"] === "true",
    invalid: field.invalid,
    name: field.name,
    form,
    rootTag: el.tag,
    labelTag,
    ids,
    rendered: {
      label: renderedLabel.current,
      description: renderedDescription.current,
      errorMessage: renderedError.current,
    },
    ...(binding ? { field: binding().ids } : {}),
    controls,
  })
})
// One stable register function per item value: re-renders never re-register.
const registers = new Map<string, (controlId: string, disabled: boolean) => () => void>()
const registerFor = (v: string) => {
  let fn = registers.get(v)
  if (!fn) {
    fn = (controlId, isDisabled) => {
      send({ type: "ITEM.REGISTER", value: v, id: controlId, disabled: isDisabled })
      return () => send({ type: "ITEM.UNREGISTER", value: v, id: controlId })
    }
    registers.set(v, fn)
  }
  return fn
}
const itemGrouping: FormToggleGrouping = {
  resolve: (v, own) => {
    if (DEV && v === "on") console.error("[rind-ui] checkbox-group: an item needs a `value`")
    return {
      props: api.item(v, own),
      onChange: (checked: boolean | "indeterminate", modality: Modality) =>
        send({ type: "ITEM.TOGGLE", value: v, checked: checked === true, modality }),
      register: registerFor(v),
    } satisfies FormToggleGrouped
  },
}
const parentGrouping: FormToggleGrouping = {
  resolve: () => ({
    props: api.parent(),
    onChange: (_checked, modality) => send({ type: "PARENT.TOGGLE", modality }),
  }),
}
// Development: `allValues` and the rendered items must agree (the Parent selects them).
$effect(() => {
  const registeredKey = [...machine.view.context.items.keys()].sort().join("\u0000")
  const allKey = allValues ? [...allValues].sort().join("\u0000") : null
  if (!DEV || allKey === null || registeredKey === "") return
  const registered = registeredKey.split("\u0000")
  const all = allKey.split("\u0000")
  const extra = registered.filter((v) => !all.includes(v))
  const missing = all.filter((v) => !registered.includes(v))
  if (extra.length > 0)
    console.warn(`[rind-ui] checkbox-group: items ${JSON.stringify(extra)} are not in allValues`)
  if (missing.length > 0)
    console.warn(
      `[rind-ui] checkbox-group: allValues ${JSON.stringify(missing)} have no rendered item`,
    )
})
// A form reset is answered once, by the group, for every item (RA#7749).
$effect(() => {
  const node = el.current
  if (!node) return
  const doc = node.ownerDocument
  const onReset = (e: Event) => {
    if (e.defaultPrevented) return
    const input = node.querySelector<HTMLInputElement>('[data-part="hidden-input"]')
    if (input && e.target === input.form) send({ type: "RESET" })
  }
  doc.addEventListener("reset", onReset)
  return () => doc.removeEventListener("reset", onReset)
})
// The items' hidden inputs (the Parent's submits nothing and validates nothing).
const controlInputs = () =>
  Array.from(
    el.current?.querySelectorAll<HTMLInputElement>('[data-part="hidden-input"]') ?? [],
  ).filter((i) => i.closest("[data-parent]") === null)
// field-control: the group registers once as one (non-labelable) control.
$effect(() => {
  if (!binding || !el.current) return
  const groupId = instance
  return untrack(() =>
    binding().register(
      {
        id: groupId,
        labelable: false,
        // The first invalid item, else the first enabled one (base-ui#5200).
        focus: (modality) => {
          const inputs = controlInputs()
          const target =
            inputs.find((i) => !i.disabled && !readValidity(i).valid) ??
            inputs.find((i) => !i.disabled)
          const control = target?.closest('[data-scope="checkbox"][data-part="root"]')
          const button = control?.querySelector<HTMLElement>('[data-part="control"]')
          if (button) void focusSafely(button, env, "programmatic", modality)
        },
        validityElement: () =>
          controlInputs().find((i) => !readValidity(i).valid) ?? controlInputs()[0] ?? null,
        value: () => current,
      },
      groupId,
    ),
  )
})
let reported = untrack(() => current)
$effect(() => {
  const now = current
  untrack(() => {
    if (reported === now) return
    reported = now
    const user = lastReason === "ITEM.TOGGLE" || lastReason === "PARENT.TOGGLE"
    lastReason = null
    binding?.().report({ type: "change", value: now, user, composing: false })
    binding?.().report({ type: "commit" })
  })
})
checkboxGroupContext.set({
  api: () => api,
  registry,
  ids: () => ids,
  setLabelTag: (tag) => {
    labelTag = tag
  },
  hasParent: () => allValues !== undefined,
  inField: binding !== null,
  invalid: () => field.invalid,
  parentGrouping,
})
formToggleGrouping.set(() => itemGrouping)
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...normalizeProps({ ...api.root(), ...binding?.().data }),
        ...(id === undefined ? {} : { id }),
        ...el.props,
      },
      rest,
    ),
  ),
)
const groupState = $derived({ value: current, disabled: field.disabled })
</script>

{#if child}
  {@render child({ props: merged, state: groupState })}
{:else}
  <div {...attrs(merged)}>{@render children?.(groupState)}</div>
{/if}
