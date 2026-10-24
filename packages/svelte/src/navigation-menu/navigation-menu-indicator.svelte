<script lang="ts">
import { navigationMenuIds } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useSelectionIndicator } from "../use-selection-indicator.svelte"
import { navLevel } from "./context.svelte"
import type { NavigationMenuIndicatorProps } from "./types"

// Decorative: the open trigger's box, inside List.
const { child, children, ...rest }: NavigationMenuIndicatorProps = $props()
const ctx = navLevel.get()
const el = elementRef("li")
useSelectionIndicator({
  el: () => el.current,
  selectedId: () => {
    const v = ctx.value()
    return v === null ? null : navigationMenuIds(ctx.root()).trigger(v)
  },
  itemSelector: '[data-scope="navigation-menu"][data-part="trigger"]',
  collection: () => ctx.shared.itemsVersion,
  onMeasure: (box, cause) => ctx.service.send({ type: "INDICATOR.MEASURE", box, cause }),
})
const merged = $derived(
  stripMarker(mergeProps({ ...normalizeProps(ctx.api().indicator()), ...el.props }, rest)),
)
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <li {...attrs(merged)}>{@render children?.()}</li>
{/if}
