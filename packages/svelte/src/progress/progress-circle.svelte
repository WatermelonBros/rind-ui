<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import type { SVGAttributes } from "svelte/elements"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { progressContext } from "./context"
import type { ProgressPartProps } from "./types"

// The ring's `svg` (`aria-hidden`); holds CircleTrack and CircleIndicator.
const { child, children, ...rest }: ProgressPartProps = $props()
const ctx = progressContext.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().circle()), rest)))
const current = $derived(ctx.state())
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <svg {...merged as SVGAttributes<SVGElement>}>{@render children?.(current)}</svg>
{/if}
