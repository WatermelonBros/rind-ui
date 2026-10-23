<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useRegisterPart } from "../use-ids.svelte"
import { segmentedContext } from "./context"
import type { SegmentedControlLabelProps } from "./types"

// Not a <label>: a radiogroup is not labelable.
const { child, children, ...rest }: SegmentedControlLabelProps = $props()
const ctx = segmentedContext.get()
useRegisterPart(ctx.parts, "label", () => ctx.ids().label)
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().label()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <span {...attrs(merged)}>{@render children?.()}</span>
{/if}
