<script lang="ts">
import { toKey } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useSelectionIndicator } from "../use-selection-indicator.svelte"
import { segmentedContext } from "./context"
import type { SegmentedControlIndicatorProps } from "./types"

const { child, children, ...rest }: SegmentedControlIndicatorProps = $props()
const ctx = segmentedContext.get()
const el = elementRef("span")
useSelectionIndicator({
  el: () => el.current,
  selectedId: () => {
    const value = ctx.value()
    return value === null ? null : ctx.ids().item(toKey(value))
  },
  itemSelector: `[data-part="item"][data-instance="${ctx.instance()}"]`,
  collection: ctx.collection,
  onMeasure: (box, cause) => ctx.send({ type: "INDICATOR.MEASURE", box, cause }),
})
const merged = $derived(
  stripMarker(mergeProps({ ...normalizeProps(ctx.api().indicator()), ...el.props }, rest)),
)
const current = $derived({ visible: merged["data-state"] === "visible" })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <span {...attrs(merged)}>{@render children?.(current)}</span>
{/if}
