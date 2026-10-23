<script lang="ts">
import {
  announcerCapability,
  type ChangeDetails,
  createListCollection,
  focusSafely,
  layoutCapability,
  mergeFieldProps,
  type RadioGroupEvent,
  radioGroupConnect,
  radioGroupIds,
  radioGroupMachine,
  radioPartName,
  watchFieldsetDisabled,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { useCompositeHost } from "../composite-host.svelte"
import { DEV } from "../dev"
import { elementRef } from "../element-ref.svelte"
import { useFieldControl } from "../field/context.svelte"
import { useFieldsetDisabled } from "../fieldset/context"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { declaredStop, useCollectionItems } from "../use-collection-items.svelte"
import { usePartRegistry, useRenderedId } from "../use-ids.svelte"
import { useMachine } from "../use-machine.svelte"
import { radioGroupContext, radioGroupNaming } from "./context"
import type { RadioGroupRootProps } from "./types"

const EMPTY = createListCollection<{ key: string }>({
  items: [],
  getKey: (i) => i.key,
  getText: (i) => i.key,
})

let {
  value = $bindable(),
  defaultValue,
  onValueChange,
  orientation = "vertical",
  disabled = false,
  focusableWhenDisabled: ownFocusable,
  readonly: readOnly = false,
  required = false,
  invalid = false,
  name,
  form,
  id,
  "aria-label": ariaLabel,
  child,
  children,
  ...rest
}: RadioGroupRootProps = $props()

const env = useEnvironment(announcerCapability, layoutCapability)
const uid = $props.id()
const instance = $derived(id ?? uid)
const naming = radioGroupNaming.maybe() ?? null
const ids = $derived(naming ? radioGroupIds(instance, naming) : radioGroupIds(instance))
// The parts the effects below look up, under a host's names when the group is its part.
const hiddenPart = naming ? radioPartName(naming, "hidden-input") : "hidden-input"
const controlPart = naming?.control ?? "item-control"
const binding = useFieldControl(uid)
const fieldsetContext = useFieldsetDisabled()
let fieldsetDom = $state(false)
// Hosted by a Toolbar: its disabled state applies, its focusableWhenDisabled unless ours.
const host = useCompositeHost()
const focusableWhenDisabled = $derived(ownFocusable ?? host?.focusableWhenDisabled ?? false)
const field = $derived(
  mergeFieldProps(
    {
      role: "radiogroup",
      labelable: false,
      disabled: disabled || fieldsetContext() || fieldsetDom || host?.disabled === true,
      readOnly,
      required,
      invalid,
      name,
      ariaLabel: ariaLabel ?? undefined,
    },
    binding?.() ?? null,
  ),
)
const items = useCollectionItems()
const collection = $derived(items.collection ?? EMPTY)
const pending = { current: null as string | null }
// The reason of the latest accepted change, for the Field: only a user's clears its external
// (server) errors (base-ui#1745); a parent's value or a reset does not.
let lastReason: string | null = null
const machine = useMachine(
  radioGroupMachine,
  () => ({
    collection,
    strategy: "roving" as const,
    ids,
    loop: true,
    selectionMode: "single" as const,
    focusableWhenDisabled,
    value,
    defaultValue,
    // A user change (an arrow or a press) is dispatched on that item's input after update.
    onValueChange: (next: string | null, details: ChangeDetails<RadioGroupEvent>) => {
      lastReason = details.reason
      if (details.reason === "NAVIGATE" || details.reason === "PRESS") pending.current = next
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
    disabled: field.disabled,
    readOnly: field.readOnly,
  }),
  env,
)
const send = machine.send
const current = $derived(machine.view.values.value ?? null)
// The Label is expected unless something else names the group: the server HTML then
// already labels the root (base-ui#5597). Read once: the registry belongs to the instance.
const parts = usePartRegistry<"label" | "description" | "error-message">(
  untrack(() => ({
    scope: "radio-group",
    root: instance,
    ...(ariaLabel === undefined && binding === null ? { expected: ["label"] as const } : {}),
  })),
)
const renderedLabel = useRenderedId(parts, "label")
const renderedDescription = useRenderedId(parts, "description")
const renderedError = useRenderedId(parts, "error-message")
const api = (pendingStop: string | null = null) =>
  radioGroupConnect(
    {
      instance,
      ...(naming ? { naming } : {}),
      collection,
      value: current,
      highlightedKey: machine.view.context.highlightedKey,
      highlightSource: machine.view.context.highlightSource,
      pending: items.collection === null,
      pendingStop,
      orientation,
      disabled: field.disabled,
      focusableWhenDisabled,
      readOnly: field.readOnly,
      required: field.required || field["aria-required"] === "true",
      invalid: field.invalid,
      name: field.name,
      form,
      rendered: {
        label: renderedLabel.current,
        description: renderedDescription.current,
        errorMessage: renderedError.current,
      },
      ...(binding ? { field: binding().ids } : {}),
      ariaLabel: ariaLabel ?? undefined,
      hosted: host !== null,
    },
    send,
    env,
  )
const el = elementRef("div")
$effect(() => {
  const node = el.current
  if (!node) return
  const w = watchFieldsetDisabled(node, (d) => (fieldsetDom = d))
  fieldsetDom = w.disabled
  // A form reset is answered once, by the group (every item's input re-syncs).
  const doc = node.ownerDocument
  const onReset = (e: Event) => {
    if (e.defaultPrevented) return
    const input = node.querySelector<HTMLInputElement>(`[data-part="${hiddenPart}"]`)
    if (input && e.target === input.form) send({ type: "RESET" })
  }
  doc.addEventListener("reset", onReset)
  return () => {
    w.stop()
    doc.removeEventListener("reset", onReset)
  }
})
// After the items' updates: a proposal the parent refused never dispatches later; and,
// in development, a radiogroup needs a name (checked once registrations settled).
$effect(() => {
  const now = current
  const node = el.current
  void renderedLabel.current
  untrack(() => {
    if (pending.current !== null && pending.current !== now) pending.current = null
    if (!DEV || !node) return
    queueMicrotask(() => {
      if (!node.isConnected) return
      if (!node.getAttribute("aria-labelledby") && !node.getAttribute("aria-label")) {
        console.warn(
          `[rind-ui] radio-group: #${node.id} has no accessible name; render RadioGroup.Label or pass aria-label`,
        )
      }
    })
  })
})
// field-control: the group registers once as one (non-labelable) control.
$effect(() => {
  if (!binding || !el.current) return
  const groupId = instance
  return untrack(() => {
    const radios = () =>
      Array.from(
        el.current?.querySelectorAll<HTMLElement>(
          `[data-part="${controlPart}"][data-instance="${groupId}"]`,
        ) ?? [],
      )
    return binding().register(
      {
        id: groupId,
        labelable: false,
        // The checked radio, else the first enabled one (react-spectrum#3883).
        focus: (modality) => {
          const all = radios()
          const target =
            all.find((r) => r.getAttribute("aria-checked") === "true") ??
            all.find(
              (r) => r.getAttribute("aria-disabled") !== "true" && !r.hasAttribute("disabled"),
            )
          if (target) void focusSafely(target, env, "programmatic", modality)
        },
        validityElement: () =>
          el.current?.querySelector<HTMLInputElement>(`[data-part="${hiddenPart}"]`) ?? null,
        value: () => current,
      },
      groupId,
    )
  })
})
let reported = untrack(() => current)
$effect(() => {
  const now = current
  untrack(() => {
    if (reported === now) return
    reported = now
    const user = lastReason === "NAVIGATE" || lastReason === "PRESS"
    lastReason = null
    binding?.().report({ type: "change", value: now, user, composing: false })
    binding?.().report({ type: "commit" })
  })
})
radioGroupContext.set({
  api,
  send,
  registry: items.registry,
  parts,
  ids: () => ids,
  value: () => current,
  disabled: () => field.disabled,
  inField: binding !== null,
  invalid: () => field.invalid,
  pending,
  focusableWhenDisabled: () => focusableWhenDisabled,
  hosted: host !== null,
  stop: declaredStop(),
})
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...normalizeProps({ ...api().root(), ...binding?.().data }),
        ...(ariaLabel === undefined ? {} : { "aria-label": ariaLabel }),
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
