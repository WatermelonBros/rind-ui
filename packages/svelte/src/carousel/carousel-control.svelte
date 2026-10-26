<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { carouselContext } from "./context"
import type { CarouselPartProps } from "./types"

/** Lays out the triggers. */
const { child, children, ...rest }: CarouselPartProps = $props()
const ctx = carouselContext.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().control()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <div {...attrs(merged)}>{@render children?.(ctx.state())}</div>
{/if}
