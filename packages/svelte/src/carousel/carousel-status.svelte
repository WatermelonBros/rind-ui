<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { carouselContext } from "./context"
import type { CarouselStatusProps } from "./types"

/** "3 / 6" (hidden from assistive technology). */
const { child, children, ...rest }: CarouselStatusProps = $props()
const ctx = carouselContext.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().status()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <span {...attrs(merged)}>{#if children}{@render children(ctx.state())}{:else}{ctx.api().statusText}{/if}</span>
{/if}
