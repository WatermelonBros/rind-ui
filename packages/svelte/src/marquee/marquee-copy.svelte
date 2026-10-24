<script lang="ts">
import { untabbable } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { marqueeContext } from "./context"
import type { MarqueePartProps } from "./types"

/** One hidden copy: same element and children, no tab stop inside (kept as content changes). */
const { index, child, children, ...rest }: MarqueePartProps & { readonly index: number } = $props()
const ctx = marqueeContext.get()
const hide = (node: Element) => (node instanceof HTMLElement ? untabbable(node) : undefined)
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().content(index)), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <div {...attrs(merged)} {@attach hide}>{@render children?.(ctx.state())}</div>
{/if}
