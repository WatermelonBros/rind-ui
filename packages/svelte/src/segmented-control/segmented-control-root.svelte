<script lang="ts">
import {
  announcerCapability,
  type ChangeDetails,
  createListCollection,
  layoutCapability,
  type RadioGroupEvent,
  radioGroupMachine,
  segmentedControlConnect,
  segmentedControlIds,
  watchFieldsetDisabled,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { DEV } from "../dev"
import { elementRef } from "../element-ref.svelte"
import { useFieldsetDisabled } from "../fieldset/context"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { declaredStop, useCollectionItems } from "../use-collection-items.svelte"
import { usePartRegistry, useRenderedId } from "../use-ids.svelte"
import { useMachine } from "../use-machine.svelte"
import { segmentedContext } from "./context"
import type { SegmentedControlRootProps } from "./types"

const EMPTY = createListCollection<{ key: string }>({
  items: [],
  getKey: (i) => i.key,
  getText: (i) => i.key,
})

let {
  value = $bindable(),
  defaultValue,
  onValueChange,
  orientation = "horizontal",
  disabled = false,
  focusableWhenDisabled = false,
  readonly: readOnly = false,
  required = false,
  invalid = false,
  name,
  form,
  id,
  child,
  children,
  ...rest
}: SegmentedControlRootProps = $props()

const env = useEnvironment(announcerCapability, layoutCapability)
const uid = $props.id()
const instance = $derived(id ?? uid)
const ids = $derived(segmentedControlIds(instance))
const fieldsetContext = useFieldsetDisabled()
let fieldsetDom = $state(false)
const groupDisabled = $derived(disabled || fieldsetContext() || fieldsetDom)
const items = useCollectionItems()
const collection = $derived(items.collection ?? EMPTY)
const pending = { current: null as string | null }
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
    // A user change (an arrow or a press) is dispatched on that segment's input after update.
    onValueChange: (next: string | null, details: ChangeDetails<RadioGroupEvent>) => {
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
    disabled: groupDisabled,
    readOnly,
  }),
  env,
)
const send = machine.send
const current = $derived(machine.view.values.value ?? null)
// The Label is expected unless aria-label names the control: the server HTML then already
// labels the root (base-ui#5597). Read once: the registry belongs to the instance.
const parts = usePartRegistry<"label">(
  untrack(() => ({
    scope: "segmented-control",
    root: instance,
    ...(rest["aria-label"] === undefined ? { expected: ["label"] as const } : {}),
  })),
)
const labelRendered = useRenderedId(parts, "label")
const api = (pendingStop: string | null = null) =>
  segmentedControlConnect(
    {
      instance,
      collection,
      value: current,
      highlightedKey: machine.view.context.highlightedKey,
      highlightSource: machine.view.context.highlightSource,
      pending: items.collection === null,
      pendingStop,
      orientation,
      disabled: groupDisabled,
      focusableWhenDisabled,
      readOnly,
      required,
      invalid,
      name,
      form,
      labelRendered: labelRendered.current,
      ariaLabel: rest["aria-label"] ?? undefined,
      indicator: machine.view.context.indicator,
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
  // A form reset is answered once, by the control (every segment's input re-syncs).
  const doc = node.ownerDocument
  const onReset = (e: Event) => {
    if (e.defaultPrevented) return
    const input = node.querySelector<HTMLInputElement>('[data-part="hidden-input"]')
    if (input && e.target === input.form) send({ type: "RESET" })
  }
  doc.addEventListener("reset", onReset)
  return () => {
    w.stop()
    doc.removeEventListener("reset", onReset)
  }
})
// After the segments' updates: a proposal the parent refused never dispatches later; in
// development, a radiogroup needs a name (Label, aria-label or aria-labelledby).
$effect(() => {
  const now = current
  const node = el.current
  void labelRendered.current
  untrack(() => {
    if (pending.current !== null && pending.current !== now) pending.current = null
    if (!DEV || !node) return
    if (!node.getAttribute("aria-labelledby") && !node.getAttribute("aria-label")) {
      console.warn(
        `[rind-ui] segmented-control: #${node.id} has no accessible name; render SegmentedControl.Label or pass aria-label`,
      )
    }
  })
})
segmentedContext.set({
  instance: () => instance,
  api,
  send,
  registry: items.registry,
  collection: () => items.collection,
  parts,
  ids: () => ids,
  value: () => current,
  disabled: () => groupDisabled,
  pending,
  stop: declaredStop(),
})
const merged = $derived(
  stripMarker(mergeProps({ ...normalizeProps(api().root()), ...el.props }, rest)),
)
const controlState = $derived({ value: current, disabled: groupDisabled })
</script>

{#if child}
  {@render child({ props: merged, state: controlState })}
{:else}
  <div {...attrs(merged)}>{@render children?.(controlState)}</div>
{/if}
