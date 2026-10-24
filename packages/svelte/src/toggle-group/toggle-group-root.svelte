<script lang="ts">
import {
  announcerCapability,
  type ChangeDetails,
  createListCollection,
  layoutCapability,
  type ToggleGroupEvent,
  toggleGroupConnect,
  toggleGroupIds,
  toggleGroupMachine,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { useCompositeHost } from "../composite-host.svelte"
import { DEV } from "../dev"
import { elementRef } from "../element-ref.svelte"
import { useFieldsetDisabled } from "../fieldset/context"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { declaredStop, useCollectionItems } from "../use-collection-items.svelte"
import { useMachine } from "../use-machine.svelte"
import { groupContext } from "./context"
import type { ToggleGroupRootProps } from "./types"

const EMPTY = createListCollection<{ key: string }>({
  items: [],
  getKey: (i) => i.key,
  getText: (i) => i.key,
})

let {
  value = $bindable(),
  defaultValue,
  onValueChange,
  selectionMode = "single",
  disallowEmptySelection = false,
  orientation = "horizontal",
  loop = true,
  disabled = false,
  focusableWhenDisabled: ownFocusable,
  id,
  child,
  children,
  ...rest
}: ToggleGroupRootProps = $props()

const env = useEnvironment(announcerCapability, layoutCapability)
// Hosted by a Toolbar: its disabled state applies, its focusableWhenDisabled unless ours.
const host = useCompositeHost()
const focusableWhenDisabled = $derived(ownFocusable ?? host?.focusableWhenDisabled ?? false)
const uid = $props.id()
const instance = $derived(id ?? uid)
const ids = $derived(toggleGroupIds(instance))
const fieldsetDisabled = useFieldsetDisabled()
const groupDisabled = $derived(disabled || fieldsetDisabled() || host?.disabled === true)
const items = useCollectionItems()
const collection = $derived(items.collection ?? EMPTY)
const machine = useMachine(
  toggleGroupMachine,
  () => ({
    collection,
    strategy: "roving" as const,
    ids,
    loop,
    selectionMode,
    disallowEmptySelection,
    focusableWhenDisabled,
    value,
    defaultValue,
    onValueChange: (next: readonly string[], details: ChangeDetails<ToggleGroupEvent>) => {
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
  }),
  env,
)
const current = $derived(machine.view.values.value ?? [])
const api = (pendingStop: string | null = null) =>
  toggleGroupConnect(
    {
      instance,
      collection,
      value: current,
      highlightedKey: machine.view.context.highlightedKey,
      pending: items.collection === null,
      pendingStop,
      orientation,
      selectionMode,
      disabled: groupDisabled,
      focusableWhenDisabled,
      focusWithin: machine.view.matches("focused"),
      hosted: host !== null,
    },
    machine.send,
    env,
  )
const el = elementRef("div")
// Development: a group needs a name (aria-label or aria-labelledby: radix#754).
$effect(() => {
  const node = el.current
  void rest["aria-label"]
  void rest["aria-labelledby"]
  if (!DEV || !node) return
  if (!node.getAttribute("aria-label") && !node.getAttribute("aria-labelledby")) {
    console.warn(
      `[rind-ui] toggle-group: the root #${node.id} has no accessible name; pass aria-label or aria-labelledby`,
    )
  }
})
groupContext.set({
  api,
  send: machine.send,
  registry: items.registry,
  value: () => current,
  disabled: () => groupDisabled,
  focusableWhenDisabled: () => focusableWhenDisabled,
  stop: declaredStop(),
})
const merged = $derived(
  stripMarker(mergeProps({ ...normalizeProps(api().root()), ...el.props }, rest)),
)
const groupState = $derived({ value: current, disabled: groupDisabled })
</script>

{#if child}
  {@render child({ props: merged, state: groupState })}
{:else}
  <div {...attrs(merged)}>{@render children?.(groupState)}</div>
{/if}
