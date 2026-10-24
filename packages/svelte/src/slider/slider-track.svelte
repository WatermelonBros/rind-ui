<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { sliderContext } from "./context"
import type { SliderPartProps } from "./types"

const { child, children, ...rest }: SliderPartProps = $props()
const ctx = sliderContext.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().track()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <div {...attrs(merged)}>{@render children?.(ctx.state())}</div>
{/if}
