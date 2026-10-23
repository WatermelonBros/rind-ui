<script lang="ts">
import type { ChangeDetails, CollapsibleEvent } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { collapsibleContext, stateOf, useApi, useCollapsibleService } from "./service.svelte"
import type { CollapsibleRootProps } from "./types"

let {
  open = $bindable(),
  defaultOpen,
  onOpenChange,
  disabled = false,
  focusableWhenDisabled = false,
  closedContent = "until-found",
  id,
  child,
  children,
  ...rest
}: CollapsibleRootProps = $props()

const uid = $props.id()
const instance = $derived(id ?? uid)
const ctx = useCollapsibleService({
  scope: "collapsible",
  instance: () => instance,
  idBase: () => instance,
  label: "Collapsible",
  decoration: {},
  props: () => ({
    open,
    defaultOpen,
    onOpenChange: (next: boolean, details: ChangeDetails<CollapsibleEvent>) => {
      let cancelled = false
      onOpenChange?.(next, {
        ...details,
        cancel: () => {
          cancelled = true
          details.cancel()
        },
      })
      if (!cancelled && open !== undefined) open = next
    },
    disabled,
    focusableWhenDisabled,
    closedContent,
  }),
})
collapsibleContext.set(ctx)
const apiFor = useApi(ctx)
const merged = $derived(
  stripMarker(
    mergeProps({ ...normalizeProps(apiFor().root()), ...(id === undefined ? {} : { id }) }, rest),
  ),
)
const current = $derived(stateOf(ctx))
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <div {...attrs(merged)}>{@render children?.(current)}</div>
{/if}
