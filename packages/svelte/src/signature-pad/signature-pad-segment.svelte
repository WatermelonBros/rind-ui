<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import type { SVGAttributes } from "svelte/elements"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { signaturePadContext } from "./context"
import type { SignaturePadSegmentProps } from "./types"

const { child, children, ...rest }: SignaturePadSegmentProps = $props()
const ctx = signaturePadContext.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().segment()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <svg {...attrs(merged) as SVGAttributes<SVGSVGElement>}>{#each ctx.api().paths as d, i (i)}<path {...attrs(normalizeProps(ctx.api().stroke(d))) as SVGAttributes<SVGPathElement>} />{/each}{@render children?.(ctx.state())}</svg>
{/if}
